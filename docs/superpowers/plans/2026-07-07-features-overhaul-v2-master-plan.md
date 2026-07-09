# Features Overhaul v2 Master Plan — "Every Shop Type, For Real"

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-07-07 · **Branch:** new `feat/features-overhaul-v2` off `main` (one branch per phase is also acceptable: `feat/fov2-<phase>`)
**Executor:** phases are executed one at a time by an implementation agent; a senior reviewer checks the work **after every phase**. Do not start a phase before the previous phase is reviewed.

**Goal:** Turn the Settings → Features system into an owner-facing, safely-reversible module system with a shop-type wizard, hard conflict locks, a blockers-gated deactivation flow — and upgrade every feature module (restaurant v2, new manufacturing module, plus nine per-feature upgrade packages) while guaranteeing the core app is bug-free with all flags off.

**Architecture:** Everything stays additive and flag-guarded exactly like the 2026-06-12 feature-modules plan. Deactivation is "freeze & hide" (no data mutation), guarded server-side by a per-feature blockers registry and owner-password verification. New Playwright "off-suite" proves the all-flags-off core after every phase.

**Tech Stack:** existing stack only — Express + better-sqlite3 (synchronous), React 18 + Vite, Zustand, TanStack Query, i18next, Playwright (client e2e), Jest (server).

## Global Constraints

These inherit and extend the non-negotiable rules of `2026-06-12-feature-modules-master-plan.md`. They apply to EVERY phase; every task's requirements implicitly include this section.

1. **Current behavior is the default.** All flags default OFF. With all flags off the app behaves byte-for-byte like today. This is the owner's #1 priority.
2. **Additive only.** Never modify/remove existing columns or endpoint contracts. Core-file feature code sits inside a flag-guarded branch whose `else` is the existing code unchanged.
3. **Deactivation = freeze & hide.** Data untouched; UI hidden; routes 403 `{ error: "feature_disabled" }`; re-enable restores everything. **No row-level soft-delete flags.**
4. **Blockers gate deactivation.** Server refuses to disable a feature with in-flight state and returns the checklist (see Phase F). UI shows it with links.
5. **Owner password required to deactivate** — verified server-side via the existing `verifyOwnerPassword` pattern (`server/src/services/backupService.js:230-242`, hash from `system_owner` / `SYSTEM_OWNER_PASSWORD_HASH`).
6. **Conflicts:** exactly one global hard lock — `feature_serials` × `feature_multi_unit` — enforced server-side AND in UI. Gold×units/PLU and recipe×BOM are **per-item** guards, not global locks.
7. **Migrations:** `electron/migrations/NNN_description.js`, idempotent (`CREATE TABLE IF NOT EXISTS`, `addColumnIfMissing` via `PRAGMA table_info`), `module.exports = { up(db) }`, NOT NULL additions always carry DEFAULT, SQLite cannot ALTER COLUMN. **Next free number at plan time: 172 — VERIFY at the start of every phase** (other branches land migrations; `sync-system-overhaul` is active). Test against `server/data/retailer.db`, not `data/retailer.db`.
8. **better-sqlite3 is synchronous** — no async/await on DB calls in server code.
9. **i18n:** every new UI string in BOTH `client/src/locales/ar.json` and `en.json`. Arabic primary. RTL-first (`rtl:`/`ltr:` variants, no hardcoded left/right).
10. **Theme tokens only** — semantic CSS vars/classes (`bg-danger-bg`, `text-success-text`…), never raw Tailwind colors.
11. **Audit:** mutating routes use `auditMutation`/`req.audit`.
12. **Bank/treasury money** only via `bankService.recordBankMovement` — never UPDATE balances directly.
13. **Client API calls** via `client/src/services/api.js`; server-side filtering for dropdowns (never client-side filtering of paginated lists — see outflow-stock-filter rule).
14. **Self-explanatory features (owner requirement):** every feature gets (a) a rich detail drawer on the Features tab, and (b) teaching empty states on its actual pages — first-visit guidance in plain Arabic explaining what the page does and the first action to take.
15. **Verification per phase:** `npm test --prefix server` passes, the Playwright off-suite (built in Phase F) passes, plus the phase's manual list. One commit series per phase, `feat(<module>): ...`.

### Owner's locked decisions (grill session 2026-07-07 — do not re-litigate)

- Owner/admin self-serve toggling (Features tab no longer dev-only); dev escape hatch stays.
- Deactivation: freeze & hide + blockers + owner password (above).
- Restaurant v2 = full dine-in lifecycle + order types with delivery/drivers + KDS page. NO reservations, NO waiter accounts.
- Manufacturing = BOM + production orders (Draft → Complete + cancel-with-reversal). Cost = materials + optional manual cost lines. Raw materials are `items` rows with an `item_kind` flag but get **separate dedicated pages**; hidden from POS/sales everywhere. Manufacturing BOM tables are **separate from restaurant recipes** (owner's explicit choice); per-item guard: an item never has both.
- Per-feature packages: exactly the selections listed in each phase below. **Cheques gets no upgrades. Tax gets only e-invoice data groundwork. Expiry gets no auto-discount. Repairs gets no intake photos. Serials gets no warehouse transfers.**
- Features tab UX = shop-type wizard + upgraded cards with detail drawers.
- Verification = all-flags-OFF Playwright core suite + flag-guard code convention. No pairwise-combination matrix (may be added later).
- Phase order: Foundation → Restaurant v2 → Manufacturing → scale → expiry → serials → multi-unit → variants → repairs → gold → promotions → tax.

---

# PHASE F — Foundation: deactivation engine, conflicts, wizard, off-suite

Everything else depends on this phase. It contains the only edits to the feature-flag core, so it gets full task-level detail. Later phases are specs at the same altitude as the 2026-06-12 plan and get their own detailed task breakdown at execution time.

### Current state (verified 2026-07-07)

- `server/src/routes/settings.routes.js:135-140` — `FEATURE_KEYS` (10 keys, **missing `feature_tax` and `feature_manufacturing`**; `FeaturesTab.jsx` renders a `feature_tax` card, so the key exists client-side — Task F1 reconciles this).
- `settings.routes.js:145` — `guardFeatureChanges(req, current, updates)`: enabling is dev-only, disabling silently ignored (one-way). **Both rules get replaced.**
- `server/src/utils/features.js` — `isFeatureEnabled(db, key)` + `featureGate(key)` middleware. Keep as-is.
- `client/src/pages/settings/SettingsPage.jsx:290-292,309-312,975` — dev-only gating of the features tab (`isDev`). Gets removed (admin sees it).
- `client/src/pages/settings/FeaturesTab.jsx` — enable-only cards with "irreversible" warning. Gets rebuilt (wizard + deactivate).
- `client/src/components/ui/FeatureRoute.jsx` — route gate exists; **`repairs/*` (App.jsx:529) and `gold/rates` (App.jsx:532) are NOT wrapped in FeatureRoute** — Task F5 audits and fixes all of these.
- Blocker sources: `dining_tables.status/current_order_id` (restaurant), `repair_orders.status` with CHECK set `('received','diagnosing','waiting_parts','in_repair','waiting_customer','ready','delivered','cancelled')` (migration 127), `cheques.status` default `'pending'` (migration 006).

### Task F1: Migration + key reconciliation

**Files:**
- Create: `electron/migrations/172_feature_overhaul_foundation.js`
- Modify: `server/src/routes/settings.routes.js` (FEATURE_KEYS + COLUMN_META)

**Interfaces:**
- Produces: settings columns `feature_manufacturing INTEGER NOT NULL DEFAULT 0`, `features_wizard_done INTEGER NOT NULL DEFAULT 0`; `FEATURE_KEYS` includes `feature_manufacturing` and (after verification) `feature_tax`.

- [ ] **Step 1:** Check whether `feature_tax` exists as a settings column: `npx electron -e "const db=require('better-sqlite3')('server/data/retailer.db'); console.log(db.prepare(\"PRAGMA table_info(settings)\").all().map(c=>c.name).filter(n=>n.startsWith('feature_')))"`. If missing, add it in the migration below (same DEFAULT 0 pattern); if it exists under another name (e.g. `tax_enabled` doubles as the flag), record which and use that key consistently client+server.
- [ ] **Step 2:** Write `172_feature_overhaul_foundation.js` using the `addColumnIfMissing` pattern (copy helper from migration 130): add `feature_manufacturing`, `features_wizard_done` (+ `feature_tax` if Step 1 found it missing), all `INTEGER NOT NULL DEFAULT 0`, to `settings`.
- [ ] **Step 3:** Add the new keys to `FEATURE_KEYS` and to `COLUMN_META` as `"bool"` in `settings.routes.js`.
- [ ] **Step 4:** Run migrations against the dev DB (`npm run dev:server` boots them, or the migration test harness if one exists in `server/src/__tests__`), verify columns exist and default 0.
- [ ] **Step 5:** Commit `feat(features): migration 172 — manufacturing flag, wizard flag, key reconciliation`.

### Task F2: Blockers registry (server)

**Files:**
- Create: `server/src/services/featureBlockers.js`
- Test: `server/src/__tests__/featureBlockers.test.js` (follow the existing test setup pattern in `server/src/__tests__/` — in-memory or temp DB fixture used by other suites)

**Interfaces:**
- Produces: `getFeatureBlockers(db, featureKey) → Array<{ type: string, count: number, label: string, link: string }>` (empty array = safe to disable). Registry is data-driven so later phases (manufacturing) register their own checks.

- [ ] **Step 1: Write the failing tests** — seed fixture rows and assert:

```js
const { getFeatureBlockers } = require("../services/featureBlockers");

test("restaurant: occupied tables block deactivation", () => {
  db.prepare("INSERT INTO dining_tables (name, status) VALUES ('T1','occupied')").run();
  const blockers = getFeatureBlockers(db, "feature_restaurant");
  expect(blockers).toEqual([expect.objectContaining({ type: "open_tables", count: 1, link: "/restaurant/tables" })]);
});

test("repairs: undelivered orders block deactivation", () => {
  db.prepare(`INSERT INTO repair_orders (order_number, reported_issue, status) VALUES ('R1','x','in_repair')`).run();
  expect(getFeatureBlockers(db, "feature_repair_orders")[0]).toMatchObject({ type: "open_repairs", count: 1 });
});

test("cheques: pending cheques block deactivation", () => {
  db.prepare("INSERT INTO cheques (status) VALUES ('pending')").run();
  expect(getFeatureBlockers(db, "feature_cheques")[0]).toMatchObject({ type: "pending_cheques", count: 1 });
});

test("features without in-flight state return no blockers", () => {
  expect(getFeatureBlockers(db, "feature_variants")).toEqual([]);
  expect(getFeatureBlockers(db, "feature_gold")).toEqual([]);
});

test("delivered/cancelled repairs do not block", () => {
  db.prepare(`INSERT INTO repair_orders (order_number, reported_issue, status) VALUES ('R2','x','delivered')`).run();
  expect(getFeatureBlockers(db, "feature_repair_orders")).toEqual([]);
});
```

- [ ] **Step 2:** Run: `npm test --prefix server -- featureBlockers` → FAIL (module not found).
- [ ] **Step 3: Implement** `featureBlockers.js`:

```js
// Each check runs only if its table exists (features may predate their tables on old DBs).
function tableExists(db, name) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

const BLOCKER_CHECKS = {
  feature_restaurant: [
    (db) => {
      if (!tableExists(db, "dining_tables")) return null;
      const { c } = db.prepare(
        "SELECT COUNT(*) c FROM dining_tables WHERE status='occupied' OR current_order_id IS NOT NULL"
      ).get();
      return c ? { type: "open_tables", count: c, label: `${c} طاولة مفتوحة — أغلق حساباتها أولاً`, link: "/restaurant/tables" } : null;
    },
  ],
  feature_repair_orders: [
    (db) => {
      if (!tableExists(db, "repair_orders")) return null;
      const { c } = db.prepare(
        "SELECT COUNT(*) c FROM repair_orders WHERE status NOT IN ('delivered','cancelled')"
      ).get();
      return c ? { type: "open_repairs", count: c, label: `${c} أمر صيانة غير مُسلَّم — سلّمه أو ألغِه أولاً`, link: "/repairs" } : null;
    },
  ],
  feature_cheques: [
    (db) => {
      if (!tableExists(db, "cheques")) return null;
      const { c } = db.prepare("SELECT COUNT(*) c FROM cheques WHERE status='pending'").get();
      return c ? { type: "pending_cheques", count: c, label: `${c} شيك قيد التحصيل — سوِّ حالته أولاً`, link: "/operations/cheques" } : null;
    },
  ],
  // Phase M registers feature_manufacturing: draft production orders.
};

function getFeatureBlockers(db, featureKey) {
  return (BLOCKER_CHECKS[featureKey] || []).map((fn) => fn(db)).filter(Boolean);
}

module.exports = { getFeatureBlockers, BLOCKER_CHECKS };
```

- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** Commit `feat(features): blockers registry for safe deactivation`.

### Task F3: guardFeatureChanges rewrite + blockers endpoint

**Files:**
- Modify: `server/src/routes/settings.routes.js` (`guardFeatureChanges`, new GET route)
- Test: `server/src/__tests__/featureGuard.test.js`

**Interfaces:**
- Consumes: `getFeatureBlockers` (F2), `verifyOwnerPassword` (export it from `backupService.js` if not already exported, or move to `systemOwner.service.js` — pick the location that avoids a require cycle).
- Produces: `FEATURE_CONFLICTS = { feature_serials: ["feature_multi_unit"] }` (exported for client mirroring/tests); PUT `/api/settings` accepts `owner_password` alongside updates when disabling; `GET /api/settings/features/blockers` → `{ success, data: { [featureKey]: Blocker[] } }` for all enabled features.

New rules (replacing dev-only/one-way):
1. **Enable:** admin or dev. Reject with 409 + Arabic message if any conflicting key is currently 1 (`لا يمكن تفعيل «تتبع السيريال» مع «وحدات القياس المتعددة» — عطّل الأخرى أولاً`). Conflict check is bidirectional.
2. **Disable:** admin or dev, AND `verifyOwnerPassword(db, req.body.owner_password)` must pass (401 otherwise, message `كلمة مرور المالك غير صحيحة`), AND `getFeatureBlockers` must be empty (409 with `{ blockers }` in the response body otherwise). On success the flag simply goes to 0 — no data is touched.
3. Both PUT `/` and POST `/bulk` paths go through the same guard (they already call it — keep that).

- [ ] **Step 1: Failing tests** (use the existing route-test pattern with supertest or direct function tests — match whichever style `server/src/__tests__` already uses):

```js
test("enabling serials while multi_unit is on → 409 conflict", () => {
  const blocked = guardFeatureChanges(adminReq({}), { feature_multi_unit: 1 }, { feature_serials: 1 });
  expect(blocked.status).toBe(409);
});
test("enabling by admin (non-dev) succeeds", () => {
  expect(guardFeatureChanges(adminReq({}), { }, { feature_variants: 1 })).toBeUndefined();
});
test("disabling without owner password → 401", () => {
  const blocked = guardFeatureChanges(adminReq({}), { feature_variants: 1 }, { feature_variants: 0 });
  expect(blocked.status).toBe(401);
});
test("disabling with wrong password → 401; with correct password and no blockers → allowed", () => { /* seed hash, two asserts */ });
test("disabling restaurant with occupied table → 409 with blockers array", () => { /* seed dining_tables, expect blocked.blockers.length === 1 */ });
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (guard signature stays `(req, current, updates)`; read `req.body.owner_password`). **Step 4:** Run → PASS.
- [ ] **Step 5:** Add `GET /api/settings/features/blockers` (authRequired + settings view permission): loops enabled FEATURE_KEYS, returns blockers map. No gating by featureGate (it must work while deciding to disable).
- [ ] **Step 6:** Commit `feat(features): owner-gated reversible flags with conflict matrix and blockers`.

### Task F4: FeaturesTab v2 — wizard, deactivation flow, detail drawers

**Files:**
- Modify: `client/src/pages/settings/FeaturesTab.jsx` (rebuild), `client/src/pages/settings/SettingsPage.jsx` (remove `isDev` gating at lines 290-292, 309-312, 975 — tab visible to admin+dev), `client/src/locales/ar.json`, `client/src/locales/en.json`
- Create: `client/src/pages/settings/FeatureWizard.jsx`, `client/src/pages/settings/FeatureDeactivateModal.jsx`

**Spec (component-level; the FEATURES metadata array in FeaturesTab.jsx stays the single source of card content and gains `feature_manufacturing`):**

1. **Wizard (`FeatureWizard.jsx`):** shown inside the tab when `features_wizard_done === 0` (dismiss or finish sets it to 1 via silent save; a "إعادة تشغيل المعالج" link in the tab header re-opens it anytime). One screen: "ما نوع محلك؟" with big icon choices → each pre-selects a bundle (checkboxes remain editable) → confirm bulk-enables via the existing `onSilentSave`:
   - سوبر ماركت / بقالة → multi_unit, scale_barcodes, expiry
   - ملابس وأحذية → variants
   - موبايل وإلكترونيات → serials
   - ورشة / صيانة → repair_orders
   - مطعم / كافيه → restaurant
   - ذهب ومجوهرات → gold
   - مصنع / إنتاج غذائي → manufacturing (+expiry suggested)
   - جملة → multi_unit, cheques, tax
   - عام / أخرى → none pre-selected
   Conflict rule applies inside the wizard too (serials and multi_unit can't both be checked; checking one disables the other with an inline note).
2. **Cards:** current card layout stays, plus: an enabled card gets a `تعطيل` (secondary/danger-ghost) button → opens `FeatureDeactivateModal`; a card whose hard-conflict peer is enabled renders its enable button disabled with tooltip `عطّل «X» أولاً` (no more "enable with conflict" path — remove the `تفعيل (تعارض)` button and the modal's conflict-warning section from the old design).
3. **`FeatureDeactivateModal`:** on open, fetch `GET /api/settings/features/blockers`; if this feature has blockers → render the checklist (label + count + link buttons navigating to the page) and a disabled confirm; if clean → explain freeze & hide (`البيانات لا تُحذف — تختفي الصفحات فقط وتعود عند إعادة التفعيل`) + owner-password input → confirm sends the flag=0 update with `owner_password` in the same PUT body; render server 401/409 messages inline.
4. Remove the "لا يمكن التراجع" irreversible warning from `ConfirmEnableModal` — replaced by a one-line note that the feature can be deactivated later from this tab.
5. All new strings in both locale files.

- [ ] Steps: build wizard → build deactivate modal → rewire cards → remove SettingsPage dev gating → manual verify (enable as admin, disable with wrong/right password, blockers render with links, wizard bundles + conflict behavior, re-run wizard link) → commit `feat(features): shop-type wizard + reversible feature cards`.

### Task F5: Route/sidebar gating audit

**Files:**
- Modify: `client/src/App.jsx` (wrap `repairs/*`:529 and `gold/rates`:532 in `FeatureRoute` with their keys; sweep every feature page route for a missing wrapper), `client/src/constants/navigation.js` (verify every feature entry carries `featureKey`)

- [ ] Audit every route/page belonging to the 12 feature keys: FeatureRoute wrapper present, sidebar entry has `featureKey`, server routes carry `featureGate`. Fix gaps (grep `featureGate(` in `server/src/routes/` against the key list — restaurant/gold/repairs routes must each be gated).
- [ ] Manual verify: with each feature off, its sidebar entry is gone, deep-linking its URL shows the FeatureRoute empty state, and its API returns 403.
- [ ] Commit `fix(features): complete featureGate/FeatureRoute coverage`.

### Task F6: Playwright all-flags-OFF core suite

**Files:**
- Create: `client/e2e/core-all-flags-off.spec.js` (match the existing spec layout under `client/e2e/` — check `playwright.config` for dir/naming)

**Spec:** one serial spec, fresh dev DB with every `feature_*` = 0, covering: login → create item → purchase receipt (stock in) → POS sale (shift open, sale, payment) → sales return → shift close → open reports center. Assertions include *absence* checks: no restaurant/repairs/gold/cheques/manufacturing sidebar entries, no unit selector on POS lines, no variants tab in the item form. This suite **must run and pass at the end of every subsequent phase** — it is the zero-bugs guarantee.

- [ ] Write spec → run `npm run test:e2e --prefix client` → fix flakiness (this suite must be stable, it gates every phase) → commit `test(e2e): all-flags-off core regression suite`.

### Phase F verification

1. `npm test --prefix server` passes; off-suite passes.
2. Admin (non-dev) can enable features; serials×multi-unit blocked both directions with clear message.
3. Disable flow: blockers render and link correctly (seed an occupied table); wrong owner password rejected; correct password disables; re-enable restores all data/pages.
4. All-flags-off app is visually and behaviorally identical to `main`.

---

# PHASE R — Restaurant v2 (`feature_restaurant`)

Scope locked: **full dine-in lifecycle + order types with delivery + KDS page.** No reservations, no waiter accounts. Detailed task breakdown is written at phase start (verify next migration number first); this spec is the reviewer's contract.

### Migrations (indicative numbers 173–174)

- `dining_zones (id, name, sort_order)` + `dining_tables.zone_id INTEGER REFERENCES dining_zones(id)` (nullable), `dining_tables.seats INTEGER DEFAULT 4`, `dining_tables.occupied_at TEXT` (for timers).
- Order rounds: `restaurant_order_rounds (id, order_id, round_no, created_at)` + nullable `round_id` on the order-lines table used by restaurant orders (inspect migration 128/166 for actual table names before writing).
- Delivery: `delivery_drivers (id, name, phone, active INTEGER DEFAULT 1)`; nullable on invoices: `driver_id`, `delivery_fee REAL`, `delivery_status TEXT` (`preparing|out|delivered|returned`). `invoices.order_type` already exists (migration 167).
- KDS: `kitchen_ticket_status TEXT DEFAULT 'new'` (`new|preparing|ready|served`) on restaurant order lines or a `kitchen_tickets` table — choose after inspecting how kitchen-ticket printing groups lines by section today.

### Server

- Extend `restaurant.routes.js` (all inside `featureGate("feature_restaurant")`): zones CRUD; table lifecycle (`seat`, `add round`, `move table`, `split bill` — split creates N invoices from selected lines, `merge` moves an order's lines onto another table's order); delivery board endpoints (`GET /delivery/board`, `PATCH /orders/:id/delivery-status`, driver CRUD); driver settlement summary for shift close (cash collected per driver); KDS: `GET /kds/tickets?since=` (client polls every 4s — no websocket in v1) + `PATCH /kds/lines/:id/status`.
- Blockers registration: extend `featureBlockers.js` — open delivery orders (`delivery_status IN ('preparing','out')`) join open tables as restaurant blockers.
- Service charge: verify existing implementation (FeaturesTab card mentions it); if absent, percentage setting applied at order close, shown as its own invoice line/total field.

### Client

- **TableMapPage v2:** zone tabs/strip, table cards show occupancy timer (from `occupied_at`), running total, rounds count; actions: seat/open, add round (jumps to POS bound to the table), split bill (line-picker modal → N payments), merge, close-to-invoice.
- **POS:** order-type selector (dine-in/takeaway/delivery) when flag on — dine-in requires a table, delivery requires customer + driver (driver assignable later from the board) + delivery fee field.
- **DeliveryBoardPage (new, sidebar under المطعم):** columns preparing → out → delivered; assign driver; mark returned (feeds the return flow).
- **KDSPage (new):** full-screen ticket columns (new/preparing/ready), 4s polling, big touch targets, auto-sound on new ticket; reachable at its route from a LAN browser (verify LAN reachability of the dev/packaged server — note the retailer:// named-pipe transport applies only to the packaged local renderer; a LAN device uses TCP, so document the required firewall/port note in the page's help state).
- Shift close: driver settlement section (only when flag on + delivery orders exist in shift).
- Teaching empty states on all new pages (rule 14).

### Verification

Off-suite passes. With flag on: seat→rounds→split→close flow produces correct invoices/stock/treasury; delivery order lifecycle + driver settlement totals correct; KDS reflects status changes from a second browser. Disabling with an occupied table or out-for-delivery order is blocked with links; after tables closed, disable succeeds and POS shows no order-type UI.

---

# PHASE M — Manufacturing (`feature_manufacturing`, new module)

Scope locked: BOM + production orders; Draft → Complete (+ cancel-with-reversal); cost = materials + manual cost lines; raw materials = `items` rows with `item_kind`, own pages, hidden from sales; BOM separate from restaurant recipes; per-item both-guard.

### Migrations (indicative 175–176)

- `items.item_kind TEXT NOT NULL DEFAULT 'sellable'` CHECK-free (SQLite ALTER can't add CHECK) — values `sellable|raw|both`, validated in routes.
- `boms (id, finished_item_id UNIQUE REFERENCES items(id), output_qty REAL NOT NULL DEFAULT 1, notes, created_at)`
- `bom_lines (id, bom_id, raw_item_id REFERENCES items(id), quantity REAL NOT NULL)`
- `production_orders (id, order_number UNIQUE, bom_id, finished_item_id, quantity REAL, status TEXT DEFAULT 'draft' /* draft|completed|cancelled */, source_warehouse_id, dest_warehouse_id, material_cost REAL DEFAULT 0, extra_cost REAL DEFAULT 0, unit_cost REAL DEFAULT 0, notes, created_by, created_at, completed_at)`
- `production_order_lines (id, production_order_id, raw_item_id, planned_qty REAL, actual_qty REAL, unit_cost REAL)` — actual editable before completion; (actual − planned) is the wastage record.
- `production_order_costs (id, production_order_id, label TEXT, amount REAL)` — manual cost lines (labor, electricity, packaging).

### Server

- `manufacturing.routes.js` gated by `featureGate("feature_manufacturing")`: BOM CRUD (reject if the finished item has a restaurant recipe — the both-guard, enforced in both directions: recipe routes also reject items that have a BOM); production order CRUD; `POST /:id/complete` in one transaction: re-check raw stock in `source_warehouse_id`, deduct `actual_qty` per line at current item cost (snapshot into `unit_cost`), sum + extra cost lines → `unit_cost = total / quantity`, add finished goods to `dest_warehouse_id` at that cost (reuse the same stock-movement + cost-update helpers purchases use — find them in the purchases service and reuse, do not reimplement averaging); `POST /:id/cancel` on completed orders reverses both movements, allowed only while finished-goods stock since completion ≥ produced qty.
- Items routes: raw items (`item_kind='raw'`) excluded from POS/sales/quotation item searches server-side (extend the existing `in_stock_only`-style params); purchasable as normal.
- Per-item guards: `feature_gold` items can't get `item_units` or PLU and vice versa (implemented in the respective routes; written defensively with PRAGMA checks since gold columns may not exist).
- Blockers: draft production orders block deactivation (register in `featureBlockers.js`).

### Client

- New sidebar category **«التصنيع»** (featureKey-gated): **المواد الخام** (dedicated list+form page writing `items` rows with `item_kind='raw'`; shows stock, purchase history), **الوصفات الصناعية (BOM)** (finished item + output qty + raw lines with live cost preview), **أوامر الإنتاج** (list + form: pick BOM → qty → auto-filled planned lines → edit actuals → cost lines → complete; completed orders show cost breakdown and a cancel button), **تقرير الإنتاج** (period totals, cost breakdown, wastage = actual−planned).
- Item form: `item_kind` selector (only when flag on; default sellable; `both` = raw that also sells).
- Teaching empty states everywhere (rule 14): BOM page explains the flow in 3 steps on first visit.

### Verification

Off-suite passes. Produce flow: raws deduct from source warehouse, finished goods arrive in dest at correct computed cost, profit reports use it; cancel restores both sides; both-guard blocks recipe+BOM on one item in both directions; raw items invisible in POS search but purchasable; draft orders block deactivation.

---

# PER-FEATURE UPGRADE PHASES (P1–P9, in this order)

Each is an independent review-gated phase; detailed tasks written at phase start. Scope per phase is **exactly** the owner's selections — nothing more.

### P1 — Scale barcodes
PLU management page (all scale items + PLU, duplicate-PLU detection, export file for scale devices — start with a generic CSV profile); multiple named scale profiles (migrate the 4 global `scale_*` settings into a `scale_profiles` table, keep the global ones as the default profile for backward compat); weight-label printing via a print-studio template.

### P2 — Expiry (FEFO)
Batches management page (live batches, filters expired/critical/warning, batch stock adjustment, write-off «إعدام تالف» posting quantity out with an expense/waste audit trail); analytics dashboard card + notification when batches enter the critical window. **No auto-discount.**

### P3 — Serials/IMEI
Serial lifecycle timeline on the serial-lookup page (`client/src/pages/stock/SerialLookupPage.jsx`): purchased → stocked → sold (invoice link) → returned/claimed, from existing serial movement rows; warranty expiry alerts (dashboard/notification) + printable warranty certificate template at sale; bulk serial entry on purchase receipt (paste/scan list, validates count vs qty, duplicate detection). **No warehouse transfers.**

### P4 — Multi-unit
Purchasing by unit on PO/receipt lines (qty × factor into base stock — the pattern already specified in the 2026-06-12 plan Phase 1 client notes; finish and polish it); mixed-unit stock display helper (`formatStockInUnits(baseQty, units)` → "3 كرتونة + 5 قطعة") used in items list, stock pages, low-stock alerts; per-unit price tiers (retail/wholesale per unit + auto-pick by customer group at POS — coordinate with P8's pricing layer, build the shared price-resolution function once here); unit barcode label printing (print studio, template per unit).

### P5 — Variants
Matrix stock grid (size × color) on the item page + stock-matrix report; POS visual variant picker (grid with per-cell stock badges replacing dropdown); per-variant images (picker + invoice details) + batch label printing for a whole matrix; season/collection tag on variants + report filter.

### P6 — Repair orders
Kanban board (columns = the 8 existing statuses collapsed to received → diagnosing/waiting_parts/in_repair → ready → delivered; drag updates status with the same validation as the detail page); "جهازك جاهز" notify button on `ready` via the existing messaging center (مركز الرسائل) — template with order fields; technician assignment (`assigned_to` exists) + workload/completed report + optional commission per repair feeding a technician report. **No intake photos/ticket.**

### P7 — Gold
Buyback «شراء ذهب كسر» flow: weigh + karat → price from today's rate minus configurable margin → pay from treasury (through payments/bankService rules) → scrap enters a dedicated non-sellable stock bucket (an `item_kind`-style scrap item per karat); rate history chart + margin report separating workmanship (مصنعية) profit from metal-value movement; online rate fetch (optional button + source URL setting, graceful offline, manual stays default); gold invoice print template (weight/karat/rate/workmanship per line).

### P8 — Promotions rule engine v2
Rule types: buy-X-get-Y, bundle price, time-window (happy hour / weekday range) — evaluated server-side at POS pricing time with a visible "عرض مطبّق" badge on the line and the rule name on the invoice detail. Rules stack policy: best-single-rule-wins in v1 (no stacking). Unify with P4's price-resolution function so promotions, unit tiers, and customer-group prices resolve in one documented precedence order: manual line price > promotion > customer-group/unit tier > base.

### P9 — Tax: e-invoice groundwork only
Data shape only, no API integration: tax registration number + activity code fields on settings and on customers/suppliers (nullable columns); invoice lines store their tax breakdown in a structured way (verify what migration 116 already stores; add nullable `tax_code` if needed); an export view (JSON) of an invoice matching ETA field naming as a developer-facing endpoint. Nothing user-visible beyond the two registration fields in settings/party forms.

---

## Execution & review protocol

1. One phase at a time, in order: **F → R → M → P1 … P9.** Each phase = fresh detailed task breakdown (this document's specs are the contract) → implementation by executor agent → `npm test --prefix server` + off-suite + phase manual list → senior review → commit series merged before the next phase starts.
2. **At every phase start:** verify next free migration number; rebase on latest main; re-read Global Constraints.
3. **Reviewer checklist every phase:** all-flags-off byte-identical behavior (off-suite green + spot manual check), every core-file edit inside a flag guard, blockers registered for any new in-flight state, i18n both locales, theme tokens only, teaching empty states present, audit middleware on mutations, money through bankService.

## Self-review notes (already applied)

- `feature_tax` client/server key mismatch caught → Task F1 reconciles before anything else builds on FEATURE_KEYS.
- `repairs/*` and `gold/rates` routes missing FeatureRoute caught → Task F5.
- Old "irreversible" UX and `تفعيل (تعارض)` path explicitly removed in Task F4 (contradicts new model).
- P4/P8 pricing overlap resolved: single price-resolution function, precedence documented.
- Restaurant recipes vs manufacturing BOM both-guard enforced in both features' routes (M spec), matching the owner's two-separate-systems choice.
