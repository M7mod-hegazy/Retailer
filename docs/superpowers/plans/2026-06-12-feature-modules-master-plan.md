# Feature Modules Master Plan — "One App, Every Shop Type"

**Date:** 2026-06-12 · **Branch:** `feat/edge-case-engine` (or a new `feat/feature-modules` branch per phase)
**Executor:** this plan is written for step-by-step execution by an implementation agent. A senior reviewer checks the work **after every phase**. Do not start a phase before the previous phase is reviewed.

---

## Context

ElHegazi Retailer today serves general retail well but cannot serve clothing shops (no variants), phone/electronics shops (no serial/IMEI tracking), supermarkets/butchers (no scale barcodes, no carton↔piece units), repair shops (no work orders), cafés/restaurants (no modifiers/recipes/tables), or gold shops (no weight×rate pricing). This plan adds all of these as **optional feature modules** controlled from a new Settings → Features tab.

### Non-negotiable rules (apply to EVERY phase)

1. **Current behavior is the default.** Every feature flag defaults to **OFF (0)**. With all flags off, the app must behave byte-for-byte like it does today.
2. **Additive only.** Never modify or remove existing columns, never change existing endpoint contracts, never alter existing core logic paths except by inserting a flag-guarded branch whose `else` is the existing code unchanged. New tables and new nullable/defaulted columns only.
3. **Way out, always.** Disabling a feature must be safe at any time: data is preserved (never deleted), feature UI disappears, feature endpoints return 403 `{ error: "feature_disabled" }`, and core flows never read feature tables while the flag is off. Features with live open documents (repair tickets, open restaurant tables) must **block disabling** until those are closed, with a clear Arabic message telling the user what to close.
4. **Migrations:** follow `electron/migrations/` conventions — next free number is **121**. Idempotent (`CREATE TABLE IF NOT EXISTS`, `addColumnIfMissing` via `PRAGMA table_info`), `module.exports = { up(db) }`, NOT NULL additions always carry `DEFAULT`. SQLite cannot ALTER COLUMN. Migrations run for both DBs automatically (Electron `data/retailer.db` and dev `server/data/retailer.db`); test against `server/data/retailer.db`.
5. **better-sqlite3 is synchronous** — no async/await on DB calls in server code.
6. **i18n:** every new UI string gets a key in BOTH `client/src/locales/ar.json` and `en.json`. Arabic is primary.
7. **RTL-first** UI; use Tailwind `rtl:`/`ltr:` variants.
8. **Audit:** mutating routes use the existing `auditMutation` middleware.
9. **One commit (or small commit series) per phase**, message `feat(<module>): ...`. Run `npm test --prefix server` before claiming a phase done, plus the phase's manual verification list.

### Decisions already made by the owner (do not re-litigate)

- Phased delivery in dependency order; each feature independently toggleable, with a description + "recommended for" shop types shown on its settings card.
- Variants are **rows in the existing `items` table** (parent/child), not a separate variants table.
- Serial tracking: best practice = **strict by default** (must scan serial to sell a tracked item) with a lenient sub-setting.
- Gold rates: **manual daily entry**, plus an optional "fetch online" button (graceful when offline).
- Repair deposits flow through the **existing `payments` table** (new nullable `repair_order_id` column), so treasury/shift stay correct; auto-allocated to the final invoice.
- Café mode is **full restaurant mode v1**: tables/dine-in + modifiers + recipes + kitchen ticket.

---

## Phase 0 — Feature Toggle Framework

Everything else depends on this. Small, zero behavior change.

### Migration `electron/migrations/121_feature_module_flags.js`

Add to the single-row `settings` table (id=1), all `INTEGER NOT NULL DEFAULT 0`:

```
feature_multi_unit, feature_variants, feature_serials, feature_scale_barcodes,
feature_repair_orders, feature_restaurant, feature_gold,
serials_strict_mode INTEGER NOT NULL DEFAULT 1
```

Use the `addColumnIfMissing` helper copied from `electron/migrations/116_invoice_notes_and_sales_tax.js`.

### Server

- `server/src/utils/features.js` (new): `isFeatureEnabled(db, key)` → reads `settings` row, returns boolean. `featureGate(key)` → Express middleware factory returning 403 `{ error: "feature_disabled", feature: key }` when off. Synchronous, no caching needed (better-sqlite3 read on a 1-row table is microseconds).
- Register the new keys in `COLUMN_META` in `server/src/routes/settings.routes.js` as `"bool"` so coercion works (same pattern as `tax_enabled`).

### Client

- `client/src/hooks/useFeature.js` (new): `useFeatureEnabled(key)` reading `useAppSettingsStore` (`client/src/stores/appSettingsStore.js`). **Default to `false` when the key is missing** (current behavior is default — note this is the opposite of what a naive implementation does).
- Ensure settings are loaded into `appSettingsStore` at app start (AppShell mount → `GET /api/settings` → `applySettings`); verify whether this already happens, add if not.
- **Sidebar gating:** add optional `featureKey` to entries in `client/src/constants/navigation.js`; in `client/src/components/layout/Sidebar.jsx` extend the existing `usePermissionFilter` so an item with a `featureKey` whose flag is off is hidden **for everyone including admin** (feature off = module doesn't exist).
- **Route gating:** in the router, wrap feature pages in a small `FeatureRoute` component that renders a "الميزة غير مفعّلة" empty state when off (protects deep links/bookmarks).
- **Settings → Features tab** in `client/src/pages/settings/SettingsPage.jsx`: new tab `{ id: "features" }` following the existing tab/section pattern (`FieldGroup`, toggle switches). One card per feature: name, 1-2 line description, **"موصى به لـ:" chips** (e.g., variants → ملابس وأحذية; serials → محلات موبايل وإلكترونيات), and toggle. Top of tab: info banner "تعطيل ميزة لا يحذف بياناتها — تختفي من الواجهة فقط وتعود عند إعادة التفعيل." Saving uses the existing `POST /api/settings/bulk`.
- Disable-guard UX: when the server blocks disabling (409 from phases 5/6), show the server's message.

### Verification (phase 0)

1. `npm test --prefix server` passes.
2. Fresh dev DB: all flags exist, all 0. App behaves exactly as before (POS sale, purchase, return).
3. Toggle a flag on/off in Settings → persists across restart.
4. With a flag off, hitting a (future) gated route returns 403 — test by temporarily gating a dummy route, then remove.

---

## Phase 1 — Multi-Unit (carton / dozen / piece) — `feature_multi_unit`

**Recommended for:** سوبر ماركت، بقالة، جملة ونصف جملة. **Why first:** smallest schema, most shared concepts (POS line changes) that later phases build on.

### Domain rules (learned, must hold)

- Stock is ALWAYS stored in the item's **base unit** (existing `items.unit` / stock_levels semantics unchanged). Sub-units are pure conversion views: qty_in_base = qty_entered × factor.
- Each sale unit can have its own sale price and its own barcode (scanning a carton barcode adds 1 carton = N pieces).
- Rounding: quantities convert exactly (factor is integer ≥ 1 for v1 — **do not allow fractional factors in v1**, it's the classic 4.99998 bug); money rounds at 2dp at line level only.
- Serial-tracked items (phase 3) must never sell in a unit with factor > 1.

### Migration `122_item_units.js`

```sql
CREATE TABLE IF NOT EXISTS item_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  unit_name TEXT NOT NULL,            -- "كرتونة", "دستة"
  factor INTEGER NOT NULL CHECK(factor >= 1),
  sale_price REAL,                    -- NULL = base price × factor
  wholesale_price REAL,
  barcode TEXT UNIQUE,
  is_default_sale INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_item_units_item ON item_units(item_id);
CREATE INDEX IF NOT EXISTS idx_item_units_barcode ON item_units(barcode);
```

Add to `invoice_lines` (nullable — old rows unaffected): `sold_unit_name TEXT`, `sold_unit_factor INTEGER`, `sold_unit_qty REAL` (denormalized snapshot; `quantity` stays in BASE units so all existing stock/report logic is untouched).

### Server

- `server/src/routes/itemUnits.routes.js` (new, gated by `featureGate("feature_multi_unit")`): CRUD under `/api/items/:id/units`. Validations: factor integer ≥1, barcode unique across BOTH `items.barcode` and `item_units.barcode` (check both tables), reject factor>1 units on serial-tracked items (forward guard, column exists after phase 3 — write the check defensively with `PRAGMA table_info`).
- `invoiceService.js`: when a line payload carries `unit_id` (only sent by client when flag on): resolve unit, set `quantity = sold_unit_qty × factor`, snapshot the three new columns, price the line from the unit's price. **When `unit_id` absent → existing code path untouched.** Same for returns in `returnService.js` (return in same unit as sold; restock converts back to base).
- Barcode lookup endpoint used by POS (find where POS resolves a scanned barcode — `search.routes.js` or `items.routes.js`): when flag on, also match `item_units.barcode` and return `{ item, unit }`.

### Client

- Item form: "وحدات إضافية" section (only when flag on): grid of unit rows (name, factor, prices, barcode).
- POS: unit selector on the cart line (default = base or `is_default_sale` unit); scanning a unit barcode auto-selects that unit; line shows "2 كرتونة (24 قطعة)". Receipt print: show sold unit (extend the Items print block to prefer `sold_unit_*` when present).
- Purchases: allow receiving in a unit (qty × factor into stock) — same pattern on the purchase line.

### Way out

Flag off → unit UI disappears, POS sends no `unit_id`, barcode lookup skips `item_units`. Old invoices still display their snapshot columns (display-only read is allowed — reading denormalized columns on the invoice itself is not "reading feature tables").

### Verification

1. Flag OFF: full POS sale/return regression — identical to before.
2. Flag ON: create item piece + carton(12) w/ own barcode+price; scan carton barcode → 1 carton line; stock drops 12; return 1 carton → stock +12; report quantities consistent in base units.
3. Duplicate barcode across items/item_units rejected. Factor 0 / fractional rejected.

---

## Phase 2 — Variants (size/color matrix) — `feature_variants`

**Recommended for:** ملابس، أحذية، إكسسوارات.

### Model (decided): variants ARE items rows

- Parent item: normal `items` row with `is_variant_parent=1`. **Not sellable**: excluded from POS search/scan and cannot be added to any document line (server-side check in `invoiceService`/purchase line validation — only when flag on; with flag off no parents exist so behavior is unchanged).
- Child variant: normal `items` row with `parent_item_id`, `variant_attributes` (JSON like `{"size":"L","color":"أحمر"}`), own barcode/prices/stock. Because a child IS an item, **POS, stock, FEFO batches, returns, promotions, reports all work today with zero changes.**
- Attribute dictionaries to prevent the "Gray/Grey/رمادي" mess: `variant_attributes` + `variant_attribute_values` tables; matrix generation only picks from defined values.

### Migration `123_variants.js`

`addColumnIfMissing(items)`: `is_variant_parent INTEGER NOT NULL DEFAULT 0`, `parent_item_id INTEGER REFERENCES items(id)`, `variant_attributes TEXT` (JSON). New tables:

```sql
CREATE TABLE IF NOT EXISTS variant_attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);         -- "المقاس","اللون"
CREATE TABLE IF NOT EXISTS variant_attribute_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attribute_id INTEGER NOT NULL REFERENCES variant_attributes(id),
  value TEXT NOT NULL, sort_order INTEGER DEFAULT 0,
  UNIQUE(attribute_id, value));
CREATE INDEX IF NOT EXISTS idx_items_parent ON items(parent_item_id);
```

### Server

- `server/src/routes/variants.routes.js` (gated): attribute/value CRUD; `POST /api/items/:id/generate-variants` — body `{ attributes: { size:[...], color:[...] } }` → transactionally creates child items (auto SKU = parent SKU + suffix, auto name = parent name + values, barcode optional per child), marks parent `is_variant_parent=1`. Skip combos that already exist (idempotent regenerate).
- Sellability guard (flag-on only): reject document lines whose item has `is_variant_parent=1` with a clear error.
- POS/items search: when flag on, exclude parents from sale search but ADD a grouped result: picking a parent opens variant selection. Reports: `GET /api/reports/...` add optional `group_by=parent` roll-up (additive param).

### Client

- Item form: "هذا الصنف له متغيرات" toggle (flag-on only) → matrix builder UI (pick attributes/values → preview grid → generate). Children editable in a grid (barcode, prices) under the parent.
- POS: selecting a parent opens a size/color picker modal showing per-variant stock.
- Items list: children collapse under parent with expand.

### Way out

Flag off → matrix UI/endpoints gone. Existing child items remain plain sellable items (names already include the attribute values, so nothing breaks); parents stop being blocked but they have no barcode and users simply don't pick them — document this caveat on the settings card ("عند التعطيل تظل أصناف المتغيرات تعمل كأصناف عادية").

### Verification

1. Flag OFF regression: items CRUD + POS unchanged.
2. Flag ON: build shirt with 3 sizes × 2 colors → 6 children; sell/return a child; stock correct per child; parent not sellable (POS + direct API); report rolls up by parent; regenerate matrix doesn't duplicate.

---

## Phase 3 — Serial / IMEI Tracking — `feature_serials`

**Recommended for:** محلات الموبايل والإلكترونيات والأجهزة.

### Domain rules (learned, must hold)

- Per-item flag `track_serials`. Serial uniqueness is **per item** (UNIQUE(item_id, serial)) — different vendors may reuse strings across products.
- Lifecycle: `in_stock → sold → returned → in_stock` (again sellable) plus `defective`. Every transition stamps the document id.
- Strict mode (`serials_strict_mode`, default 1): selling a tracked item REQUIRES scanning exactly `quantity` distinct in-stock serials; lenient mode warns and allows skipping (serials recorded as unknown). Returns of tracked items must reference a serial **sold on that invoice** (kills fake-return fraud). Purchases capture serials at receiving (count must equal qty in strict mode).
- Tracked items: integer quantities only; cannot have multi-unit factors > 1 (guard added in phase 1 becomes active).

### Migration `124_serials.js`

`addColumnIfMissing(items)`: `track_serials INTEGER NOT NULL DEFAULT 0`.

```sql
CREATE TABLE IF NOT EXISTS item_serials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  serial TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_stock'
    CHECK(status IN ('in_stock','sold','returned','defective')),
  warehouse_id INTEGER DEFAULT 1,
  purchase_id INTEGER, purchase_line_id INTEGER,
  invoice_id INTEGER, invoice_line_id INTEGER,
  warranty_months INTEGER, sold_at TEXT, returned_at TEXT,
  notes TEXT, created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(item_id, serial));
CREATE INDEX IF NOT EXISTS idx_serials_serial ON item_serials(serial);
CREATE INDEX IF NOT EXISTS idx_serials_status ON item_serials(item_id, status);
```

### Server

- `server/src/routes/serials.routes.js` (gated): search serial (global "أين السيريال" lookup → item, status, history), mark defective, list per item/status.
- `invoiceService.js` flag-guarded block: if any line's item has `track_serials=1` → validate `line.serials[]` (exist, in_stock, count==qty in strict mode; duplicates rejected) then mark sold with invoice ids — all inside the existing sale transaction. `returnService.js`: validate serial(s) belong to the original invoice, flip to `returned`/`in_stock`.
- Purchases receive flow: accept `serials[]` per line, bulk insert as `in_stock`; duplicate serial on receive → reject that serial with message (quarantine pattern), not silent skip.
- Warranty: `sold_at + items.default_warranty_months` (add nullable `default_warranty_months` to items in same migration) → serial lookup returns warranty validity.

### Client

- Item form: "تتبع السيريال/IMEI" toggle + default warranty months.
- POS: adding a tracked item opens a serial-scan box (scan N serials, shows N/qty); blocks complete-sale in strict mode until satisfied. Returns: serial picker limited to that invoice's serials.
- Purchases receiving: serial entry list per tracked line (scan repeatedly).
- New page `pages/stock/SerialLookupPage.jsx` (nav entry gated): search any serial → full history + warranty status.

### Way out

Flag off → no prompts anywhere, lookup page hidden, serial rows frozen in place. Selling tracked items proceeds without serials (data gets holes — stated on the settings card). Re-enable resumes.

### Verification

1. Flag OFF regression (sale/return/purchase).
2. Flag ON strict: receive 3 serials; sell qty 2 → must scan 2 distinct; selling an already-sold serial rejected; return validates against invoice; serial history shows full chain; lenient mode allows skip with warning.

---

## Phase 4 — Scale Barcodes (وزن مدمج في الباركود) — `feature_scale_barcodes`

**Recommended for:** سوبر ماركت، جزارة، خضار وفاكهة، أجبان.

### Domain rules (learned, must hold)

- Scale prints EAN-13: `P PPPP IIIII VVVVV C` patterns vary; the common Egyptian config is prefix `2x` (configurable 20–29), then item code (4–5 digits), then value (5 digits = weight in grams OR price in piasters), then EAN check digit.
- Config must be flexible: settings fields `scale_prefix` (e.g. "22"), `scale_item_code_length` (4 or 5), `scale_value_type` ('weight'|'price'), `scale_value_decimals` (e.g. 3 for kg with 3dp). Validate the EAN-13 check digit before trusting the code; on mismatch fall through to normal barcode lookup.
- Weight mode: qty = value/10^decimals, price = qty × item price. Price mode: total = value/100, qty = total/item price (rounded 3dp).

### Migration `125_scale_barcodes.js`

`addColumnIfMissing(settings)`: `scale_prefix TEXT DEFAULT '22'`, `scale_item_code_length INTEGER DEFAULT 5`, `scale_value_type TEXT DEFAULT 'weight'`, `scale_value_decimals INTEGER DEFAULT 3`. `addColumnIfMissing(items)`: `scale_plu TEXT` (the short code the scale knows; indexed).

### Implementation

- `client/src/utils/scaleBarcode.js` (new, pure function + unit-testable): `parseScaleBarcode(code, config) → { plu, qty?, price? } | null` (null = not a scale code → existing flow). Wire into the POS scan handler BEFORE normal lookup, only when flag on.
- Server: items search by `scale_plu` (small additive param on the barcode-lookup endpoint). Items form gets a PLU field (flag-on). Settings card gets the 4 config fields. Item must have `allow_decimal` unit semantics — reuse `units.allow_decimal` (migration 103); enforce qty 3dp max.
- Note: invoice lines already accept decimal quantity? **Executor must verify** `invoice_lines.quantity` accepts REAL (it's INTEGER-typed in early migrations but SQLite is dynamically typed; confirm POS/server don't `Math.floor` quantities — if they do, fix only inside the flag-on path).

### Way out

Flag off → parser bypassed entirely; PLU field hidden. Zero residue.

### Verification

Unit tests for the parser (valid weight code, valid price code, bad check digit, non-scale code). Manual: scan `2212345012503` style code → correct item, qty 1.250, price right; normal barcodes still work; flag off → such a code is just "not found".

---

## Phase 5 — Repair / Service Work Orders — `feature_repair_orders`

**Recommended for:** صيانة موبايل وكمبيوتر وأجهزة منزلية، ترزي.

### Workflow (learned best practice)

`received → diagnosing → waiting_approval → repairing → testing → ready → delivered`, plus `cancelled`. Ticket = one record holding customer, device (brand/model/serial/condition/accessories), reported issue, technician, parts, labor, deposit, notes. WhatsApp "جاهز للاستلام" on `ready`. Final invoice on `delivered` = parts + labor − deposit.

### Migration `126_repair_orders.js`

```sql
CREATE TABLE IF NOT EXISTS repair_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no TEXT UNIQUE,                  -- prefix from settings_kv like other docs
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  device_desc TEXT NOT NULL, device_serial TEXT, condition_notes TEXT,
  problem_desc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK(status IN
    ('received','diagnosing','waiting_approval','repairing','testing','ready','delivered','cancelled')),
  technician_id INTEGER REFERENCES employees(id),
  estimate REAL, labor_total REAL NOT NULL DEFAULT 0,
  invoice_id INTEGER REFERENCES invoices(id),
  user_id INTEGER, shift_id INTEGER,
  promised_at TEXT, delivered_at TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT);
CREATE TABLE IF NOT EXISTS repair_order_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_order_id INTEGER NOT NULL REFERENCES repair_orders(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  quantity REAL NOT NULL, unit_price REAL NOT NULL, warehouse_id INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS repair_order_labor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_order_id INTEGER NOT NULL REFERENCES repair_orders(id),
  description TEXT NOT NULL, amount REAL NOT NULL);
CREATE TABLE IF NOT EXISTS repair_status_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_order_id INTEGER NOT NULL, from_status TEXT, to_status TEXT,
  user_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
```

`addColumnIfMissing(payments)`: `repair_order_id INTEGER` (nullable).

### Server `server/src/routes/repairOrders.routes.js` (gated)

- CRUD + `PATCH /:id/status` enforcing legal transitions (copy the quotation/PO status-transition pattern from `server/src/routes/quotations.routes.js` / `purchaseOrders.routes.js`); each change logged to `repair_status_log`.
- Parts: adding a part **deducts stock immediately** via the same stock-adjust mechanism invoices use (movement type `repair_part`); removing a part restores it. (Immediate deduction, not reservation — simpler and matches a small shop's reality.)
- Deposit: `POST /:id/deposit` → creates a row in the existing `payments` table (`party_type='customer'`, `repair_order_id` set, treasury/method honored) so treasury and shift reconciliation work with **zero new treasury code**.
- `ready` transition: enqueue WhatsApp via existing outbox — new `kind='repair_ready'` row in `message_templates` (seed in migration: "مرحباً {name}، جهازك ({device}) جاهز للاستلام 🛠️ — {shop}") + `POST /whatsapp/enqueue` pattern from `server/src/routes/whatsapp.routes.js`.
- `delivered` transition: creates an invoice through the existing `invoiceService` (parts as normal item lines — stock already deducted, so pass a flag-on-only option `skip_stock_deduction` per line, OR restock-then-invoice atomically; **executor: implement `skip_stock` per-line option guarded by the feature, default absent = current behavior**; labor as a non-stock line — see below), allocates the deposit payment(s) to it via existing `payment_allocations`, links `invoice_id`.
- Labor lines: add `addColumnIfMissing(invoice_lines)`: `is_non_stock INTEGER NOT NULL DEFAULT 0`; in `invoiceService` skip `adjustStock` when `is_non_stock=1` (flag-guarded; default 0 keeps current behavior). `item_id` nullable for such lines — **verify** invoice_lines.item_id is nullable; if NOT NULL, use a hidden system item "خدمة صيانة" created by the migration instead (safer than table recreation).
- Disable-guard: `PUT /api/settings` rejects turning `feature_repair_orders` off with 409 + Arabic message while any ticket is in a non-terminal status.

### Client

- New pages under `pages/repairs/`: board/list page (status columns or filterable list — use `SimpleCrudPage` only if it fits; otherwise a dedicated page following an existing operations page pattern), ticket detail (status stepper, parts picker pulling from items, labor rows, deposit button, WhatsApp indicator), intake form.
- Print: add `repair_ticket` to `shared/docTypes.js` DOC_TYPES + a template component under `client/src/components/print/templates/` rendered via `LayoutRenderer` (customer copy at intake: ticket no, device, problem, estimate, deposit).
- Nav module "الصيانة" gated by `featureKey: "feature_repair_orders"`, `pageKey: "repairs"` added to permissions constants.

### Verification

Full lifecycle: intake+print → deposit (check treasury balance & shift) → parts (stock drops) → ready (wa_outbox row created) → delivered (invoice = parts+labor, deposit allocated, status paid/partial correct) → try disabling feature with an open ticket → blocked 409; close all → disable works; flag OFF regression on invoices/payments.

---

## Phase 6 — Restaurant Mode (tables + modifiers + recipes + kitchen ticket) — `feature_restaurant`

**Recommended for:** كافيه، مطعم، عصائر، كشري. Largest phase — executor should expect this to take the longest; sub-commits per chunk (6a tables, 6b modifiers, 6c recipes, 6d kitchen print).

### Migration `127_restaurant.js`

```sql
CREATE TABLE IF NOT EXISTS dining_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  zone TEXT, seats INTEGER DEFAULT 4, is_active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS modifier_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  min_select INTEGER NOT NULL DEFAULT 0, max_select INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS modifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES modifier_groups(id),
  name TEXT NOT NULL, price_delta REAL NOT NULL DEFAULT 0,
  recipe_item_id INTEGER REFERENCES items(id),  -- optional ingredient this modifier consumes
  recipe_qty REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS item_modifier_groups (
  item_id INTEGER NOT NULL REFERENCES items(id),
  group_id INTEGER NOT NULL REFERENCES modifier_groups(id),
  PRIMARY KEY(item_id, group_id));
CREATE TABLE IF NOT EXISTS item_recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),        -- finished product (e.g. ساندوتش)
  component_item_id INTEGER NOT NULL REFERENCES items(id),
  quantity REAL NOT NULL,
  UNIQUE(item_id, component_item_id));
```

`addColumnIfMissing(items)`: `has_recipe INTEGER NOT NULL DEFAULT 0`. `addColumnIfMissing(invoice_lines)`: `modifiers_json TEXT` (display + kitchen snapshot), `table_id INTEGER`. Add `addColumnIfMissing(invoices)`: `table_id INTEGER`, `order_type TEXT` ('takeaway' default, 'dine_in').

Check `server/src/routes/posDrafts.js` / pos drafts table: add `table_id INTEGER` column to the drafts table — **open table orders are pos drafts with a table_id** (reuse, don't build a parallel orders system).

### Rules

- Recipe deduction: selling a `has_recipe` item deducts COMPONENTS (qty × line qty), not the item's own stock; the finished item itself is non-stock. Modifier with `recipe_item_id` adds its ingredient deduction. All inside the invoice transaction, flag-guarded; insufficient component stock follows the same policy the app uses today for insufficient stock (match existing behavior — executor: find and mirror it).
- Modifier price deltas adjust the line unit price; `modifiers_json` snapshots names+deltas for receipt/kitchen.
- Tables: POS gets a table-map screen (flag-on): pick table → opens/resumes that table's draft; "تحويل لفاتورة" closes the table. Takeaway = current POS flow untouched.
- Kitchen ticket: new `kitchen_ticket` doc type in `shared/docTypes.js` + template (big item names + modifiers, no prices); printed on demand / on order-send. Per-doc printer choice already lives in print settings per doc type.
- Disable-guard: block turning the flag off while any table has an open draft (409 + message).

### Server / Client work

- `server/src/routes/restaurant.routes.js` (gated): tables CRUD, modifier groups/modifiers CRUD, recipes CRUD (`/api/items/:id/recipe`).
- `invoiceService.js`: flag-guarded recipe-explosion + modifier pricing block; `returnService.js` restores components.
- Client: tables map page, modifier-pick modal in POS (opens when added item has groups; enforces min/max), recipe editor on item form ("مكونات الوصفة"), kitchen print button. Nav module "المطعم" gated.

### Verification

Flag OFF regression. Flag ON: build sandwich recipe (bread+cheese), modifier group "إضافات" (جبنة زيادة +5 consuming cheese); dine-in: open table → add items+modifiers → kitchen ticket prints → close to invoice → components deducted correctly (base + modifier), table freed; return restores components; disable blocked while a table is open.

---

## Phase 7 — Gold & Jewelry Pricing — `feature_gold`

**Recommended for:** محلات الذهب والمجوهرات.

### Rules (learned)

- Egyptian market: 21K dominant; karat price = 24K × karat/24 but shops enter per-karat rates directly (local market premium varies) → store per-karat rates, don't derive.
- Item price = weight_grams × rate(karat) + workmanship (مصنعية, per gram or flat — support both). Buy-back (شراء من العميل) uses rate without workmanship — v1: selling only; buy-back later.

### Migration `128_gold.js`

```sql
CREATE TABLE IF NOT EXISTS gold_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  karat INTEGER NOT NULL CHECK(karat IN (24,22,21,18,14)),
  rate_per_gram REAL NOT NULL,
  rate_date TEXT NOT NULL DEFAULT (date('now')),
  source TEXT DEFAULT 'manual',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(karat, rate_date));
```

`addColumnIfMissing(items)`: `gold_karat INTEGER`, `gold_weight_grams REAL`, `gold_workmanship REAL DEFAULT 0`, `gold_workmanship_type TEXT DEFAULT 'per_gram'` ('per_gram'|'flat').

### Server / Client

- `server/src/routes/gold.routes.js` (gated): `GET/POST /api/gold/rates` (today's rates, history), `POST /api/gold/rates/fetch-online` — tries a public EGP gold endpoint with short timeout; on any failure returns `{ ok:false }` and the UI says "تعذر الجلب — أدخل السعر يدويًا" (graceful offline).
- POS pricing: when flag on and item has `gold_karat`+`gold_weight_grams`, server computes unit price from TODAY's rate at sale time (reject sale with clear message if today's rate for that karat is missing — force the morning entry habit); line stores the computed price (snapshot — historical invoices never re-price). Manual price override still allowed per existing discount/override rules.
- Client: "أسعار الذهب اليوم" quick screen (rates per karat + fetch button + history); item form gold section; POS line shows weight/karat/rate breakdown; receipt template addition (weight + karat columns) via existing print blocks.

### Verification

Flag OFF regression. Flag ON: enter 21K rate; sell 5g 21K ring with 50/g workmanship → price = 5×rate + 250; missing-rate karat blocks with message; fetch button fails gracefully offline; yesterday's invoice keeps yesterday's price.

---

## Execution protocol (for the implementing agent)

1. Work phase-by-phase **in order**. Never start phase N+1 before the reviewer approves phase N.
2. Per phase: write the migration first → run dev server once to apply → server changes + tests → client changes → i18n (ar + en) → run `npm test --prefix server` → walk the phase's Verification list manually → commit.
3. If anything in this plan conflicts with what you find in the code, **stop and report** — do not improvise around core code. The rule "additive only, core untouched when flags are off" outranks finishing the task.
4. Add at least one Jest test per phase for the pure server logic (e.g., scale parser port, serial validation, unit conversion, gold price computation).
5. Never edit applied migrations; fixes go in new migrations.
/
## Reviewer checklist (per phase)

- All-flags-off regression: POS sale, return, purchase receive, payment — behavior identical.
- Grep the diff for edits inside existing functions: each must be inside an `if (featureEnabled)` guard with the legacy path intact.
- Migration is idempotent (run twice).
- ar.json/en.json keys both present; RTL checked.
- Way-out tested: toggle off → UI gone, endpoints 403, no console/server errors, data intact after re-enable.
