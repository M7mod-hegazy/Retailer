# Pricing System Overhaul — Implementation Plan

**Status:** Draft — pending review
**Estimated effort:** 14-18 working days (with phased rollout)
**Risk level:** High (touches money/stock/inventory across 8+ pages)

---

## 1. Executive Summary

### What we're building
A unified pricing system that:
1. Tracks every price change across the system in a single audit tab
2. Lets users lock/unlock per-line whether each purchase updates master prices
3. Captures invoice-level price overrides in POS/Returns separately from master changes
4. Supports 5 costing methods (WACC, Last Purchase, Standard Cost, FIFO, LIFO) — all queryable from reports
5. Enforces "only purchases and bulk-update change master prices" with the item-edit page locked down
6. Adds a profit-preview button to /purchases/new

### Reality check
Original ask was "add a button, an animation, and a history tab" — about 2-3 days work. After exhaustive grilling on edge cases, bugs, costing methods, and consistency, scope is now **5-7x larger**. This is the result of insisting on a bulletproof system rather than a basic one. The plan below reflects the agreed scope. **Phased rollout** is mandatory to limit risk.

### What this plan does NOT include (explicitly excluded)
- LIFO usage warnings for tax/IFRS (decision: ship it anyway as a method option; owner's responsibility)
- Rollback button on price history tab (removed — users make a new bulk-update instead)
- Time-window restrictions on edits (removed)
- Per-supplier lock defaults (removed)
- Auto-suggest selling price as auto-fill (replaced with clickable hint per Q27.2)
- Weekly drift-detection cron (removed per user feedback as impractical)
- Anomaly detection in analytics (Tier 3 features excluded)

---

## 2. Holistic Impact Map

### Pages affected (8 total)
| Page | Type of change | Effort |
|---|---|---|
| `/purchases/new` (PurchaseFormPage) | Major UI overhaul — symmetric locks, profit modal, before→after badges, آخر شراء bar | 3 days |
| `/operations/bulk-price-update` | Add new price history tab with global + per-item drill-down + analytics | 3 days |
| `/pos` (POSPage) | Override capture backend + amber visual indicators + permission gate | 1 day |
| `/sales/returns/new` | Full symmetry with POS (Q26.1=A) | 1 day |
| `/purchases/returns/new` | Full symmetry with POS (Q26.3=A) | 1 day |
| `/operations/branch-transfer` | Backend-only override capture (Q26.2=C) | 0.5 day |
| `/items/edit` | Remove price editing fields entirely + replace with link hint | 0.5 day |
| `/items/new` | Log creation prices to `price_history` with `source=item_create` | 0.25 day |
| Reports center (P&L) | Add Standard Cost + FIFO + LIFO options to method dropdown | 0.5 day |
| Settings | Add `margin_alert_cost_method` setting | 0.25 day |

### Cross-cutting concerns not raised in grilling
| Concern | Impact | Mitigation |
|---|---|---|
| **The `PUT /:id/amend` endpoint exists separately** from in-place edit | Must coexist; both need to honor lock state | Update both routes with same lock logic |
| **Stock adjustment routes need mandatory cost field** (per Q23.2 defense 3) | Currently optional, breaks WACC if used | Add validation; existing adjustments backfilled with `purchase_price` |
| **Backup/restore version compatibility** | Schema changes break old backups | Bump backup version; document migration |
| **i18n strings** (every new UI element) | Both `ar.json` and `en.json` must have entries | Include in component PRs |
| **Page tour system** (`usePageTour`) | New lock UI needs explanation tour | Add tour steps for purchases page |
| **Dashboard recent activities** widget | Currently shows purchases; should it show price changes too? | NO — too noisy; price activity in dedicated tab |
| **Audit log page** | Should price_history appear there too? | NO — price_history has its own dedicated tab |
| **Excel export of reports** | Reports gain new cost method options | Existing export framework handles automatically |
| **Notification system** | Bulk-update sends notifications today | NO new notifications for purchase-driven price changes (too noisy) |
| **Existing margin alert UI** (red border in DataGrid when margin < threshold) | Must respect `margin_alert_cost_method` setting | Refactor `checkItemMargin` to accept method parameter |
| **Quotations and Purchase Orders** | They display prices but don't update masters | No changes — they're proposals, not transactions |

---

## 3. Database Schema Changes

### New columns
```sql
-- Lock state per purchase line (3 columns, default 1 = locked)
ALTER TABLE purchase_lines ADD COLUMN update_master_purchase_price BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE purchase_lines ADD COLUMN update_master_sale_price BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE purchase_lines ADD COLUMN update_master_wholesale_price BOOLEAN NOT NULL DEFAULT 1;

-- Override capture (master price at the moment the line was saved)
ALTER TABLE invoice_lines ADD COLUMN master_price_at_time REAL;
ALTER TABLE invoice_lines ADD COLUMN master_price_backfilled BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE sales_return_lines ADD COLUMN master_price_at_time REAL;
ALTER TABLE sales_return_lines ADD COLUMN master_price_backfilled BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE purchase_return_lines ADD COLUMN master_price_at_time REAL;
ALTER TABLE purchase_return_lines ADD COLUMN master_price_backfilled BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE branch_transfer_lines ADD COLUMN master_price_at_time REAL;
ALTER TABLE branch_transfer_lines ADD COLUMN master_price_backfilled BOOLEAN NOT NULL DEFAULT 0;

-- Distinguish source of price_history entries
ALTER TABLE price_history ADD COLUMN source TEXT;
-- Values: 'item_create', 'bulk_update', 'purchase_locked', 'item_edit' (legacy), 'manual_correction'
-- Existing rows: backfill from operation_id prefix (BPU-* → bulk_update, PUR-* → purchase_locked)

-- For FIFO/LIFO replay (track which lot a sale consumed from)
ALTER TABLE invoice_lines ADD COLUMN origin_purchase_line_id INTEGER REFERENCES purchase_lines(id);
ALTER TABLE invoice_lines ADD COLUMN origin_purchase_line_qty REAL;
-- NULL means "not allocated yet" (legacy data) — FIFO/LIFO reports use replay for these
```

### New tables
```sql
-- Pre-install integrity check results (Q23.3)
CREATE TABLE IF NOT EXISTS integrity_check_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at TEXT NOT NULL DEFAULT (datetime('now')),
  ran_by INTEGER,
  status TEXT NOT NULL,           -- 'clean', 'has_issues', 'all_resolved'
  total_issues INTEGER NOT NULL DEFAULT 0,
  unresolved_issues INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS integrity_check_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES integrity_check_runs(id),
  item_id INTEGER,
  issue_type TEXT NOT NULL,       -- 'stock_mismatch', 'wacc_drift', 'orphan_reference', etc.
  details TEXT,                   -- JSON with diagnostic info
  resolved_at TEXT,
  resolved_by INTEGER,
  resolution TEXT                 -- 'fixed', 'ignored', 'pending'
);

-- Opening balance as synthetic purchase rows (Q7 pick)
-- No new table — uses purchase_lines with new flag
ALTER TABLE purchase_lines ADD COLUMN is_opening_balance BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE purchases ADD COLUMN is_opening_balance BOOLEAN NOT NULL DEFAULT 0;
```

### Backfill operations (in migration)
1. `price_history`: backfill `source` column from `operation_id` prefix
2. `price_history`: insert "creation" rows for every existing item (one per non-zero price field), marked `source=item_create`
3. `invoice_lines.master_price_at_time`: best-effort fill with current `items.sale_price`, set `master_price_backfilled=1`
4. Same for `sales_return_lines`, `purchase_return_lines`, `branch_transfer_lines`
5. `purchase_lines.update_master_*` columns: default 1 (matches today's silent behavior)
6. For items with stock but no purchase history: create synthetic opening-balance purchase row dated `2020-01-01` with `cost=items.purchase_price`, qty=current stock, `is_opening_balance=1`

---

## 4. New Backend Services

### `server/src/services/costingService.js` (NEW — central cost engine)
```js
// Single entry point for all cost queries across the codebase
function computeCostByMethod(itemId, method, asOfDate, db) {
  // method: 'wacc' | 'last_purchase' | 'standard' | 'fifo' | 'lifo'
  // Returns: { cost, method, computed_at }
}

function computeFifoLifoCost(itemId, asOfDate, direction, db) {
  // direction: 'oldest' (FIFO) or 'newest' (LIFO)
  // Replays purchase_lines + invoice_lines + sales_return_lines chronologically
  // Returns cost-per-unit for the next sale
}

function getActiveCostMethod(db) {
  // Reads settings.margin_alert_cost_method; defaults to 'wacc'
}
```

### `server/src/services/priceLockService.js` (NEW — cascade-aware master price updates)
```js
function applyMasterPriceUpdate(itemId, field, newValue, source, operationId, db) {
  // field: 'sale_price' | 'wholesale_price' | 'purchase_price'
  // Cascade-check: only updates if current master == what this op originally set
  // OR if no previous lock-managed change exists
  // Returns: { applied: bool, reason: string, warning: string|null }
}

function revertMasterPrice(itemId, field, sourceOperationId, db) {
  // Used by void flow (Q13.1)
  // Cascade-check before reverting
}
```

### `server/src/services/overrideTrackingService.js` (NEW)
```js
function captureOverride(lineId, lineType, itemId, unitPrice, db) {
  // Reads current master price, stores in {table}.master_price_at_time
  // Called from POS save, return save, transfer save, purchase save (for selling/wholesale per-line)
}

function listOverrides(filters, db) {
  // Returns paginated list of lines where master_price_at_time IS NOT NULL
  // AND ABS(unit_price - master_price_at_time) > 0.001
  // Used by price history tab "tجاوزات الفواتير" sub-view
}
```

### `server/src/services/integrityCheckService.js` (NEW)
```js
function runFullCheck(db) {
  // Checks: stock invariant, WACC drift, orphan FKs, price coherence
  // Inserts results into integrity_check_runs + integrity_check_issues
}

function resolveIssue(issueId, action, userId, db) {
  // action: 'fixed' (apply auto-fix) | 'ignored' (with reason)
}
```

### Money math utility (NEW — apply everywhere)
```js
// utils/money.js
function roundMoney(value) {
  return Math.round(value * 10000) / 10000;
}

function multiplyMoney(a, b) {
  return roundMoney(a * b);
}

function divideMoney(a, b) {
  return b !== 0 ? roundMoney(a / b) : 0;
}
```
**Apply rule:** every monetary calculation across the entire codebase must use these helpers. Code review enforcement.

### Refactor: `waccService.js`
- Replace incremental WACC update with always-recompute-from-history
- Wrap all math through `roundMoney`
- Add `force_recompute` param
- Existing callers continue to work (signature compatible)

---

## 5. Frontend Changes Per Page

### `/purchases/new` (PurchaseFormPage.jsx) — Major overhaul
**Staging area row:**
- 3 price inputs (cost / مستهلك / جملة), each editable
- Lock icon directly above each input (🔒 emerald default, 🔓 amber when toggled)
- "آخر شراء: X.XX" bar below cost input
- "السعر المقترح للحفاظ على هامش X%: Y.YY" clickable hint below selling input (shown only for new items per Q27.2)
- before→after pill below any field whose value differs from master
- No dropdown above selling (Q25=A)

**DataGrid changes:**
- Add 3 lock columns to the DataGrid (one per price)
- Row tint (light blue background) when any lock is 🔓
- Existing margin warning (below-cost selling) respects user-configured cost method

**Header changes:**
- New button: "تحليل الربح" → opens profit modal

**Profit modal (new component):**
- Per-line: cost / selling / profit / margin% / risk flag
- Total: max expected profit with disclaimer
- Risk flags: ⚠ below target margin (configurable), 🔴 below minimum threshold

**Save flow:**
- Save always shows confirmation modal (Q18.3=A): lists locked vs unlocked lines, requires confirm
- On selling price drop > X% (configurable, default 15%): additional warning in modal

### `/operations/bulk-price-update` — Add new tab
**Top-level tabs:**
- (existing) تحديث جماعي للأسعار
- (existing) السجل
- **(NEW) سجل تغييرات الأسعار** ← new comprehensive tab

**New tab structure:**
- Top-tabs: [كل الأصناف] [تحليل صنف معين]
- Sub-filter: [الكل] [تغييرات رئيسية] [تجاوزات فواتير]
- Filter bar: search box, date range, source multi-select, price field, user, category, change magnitude slider, direction
- Sort: date, item name, magnitude
- Per-item view: price-over-time chart (Recharts) + change list + analytics widgets (current vs avg, last change, volatility, margin trend, override stats)
- Global view: counter cards (changes today/week/month), most-changed items, most-overridden items, source breakdown pie, shrinking-margin alerts

### POS / Sales Return / Purchase Return — Override UX
**Visual:**
- Amber border + small label "تجاوز للسعر الرئيسي: X.XX" when typed price differs from master
- No modal for large deviations (Q16.1=B)

**Behavior:**
- Permission check: `override_price` required to type different price (otherwise field is disabled at master value)
- Backend automatically captures `master_price_at_time` on save

**Sales Return + Purchase Return (Q26.1=A, Q26.3=A):**
- Same UI as POS: dropdown for price-type switching, last-price bar, amber on override

### `/operations/branch-transfer` — Backend-only (Q26.2=C)
- No UI changes
- Backend captures `master_price_at_time` if user happens to type different cost
- No amber indicators (don't encourage cost override)

### `/items/edit` — Lock down price fields
- Remove 3 price input fields entirely
- Replace with read-only display + hint: "لتغيير الأسعار، استخدم تحديث جماعي للأسعار أو فاتورة شراء جديدة"
- Hints are clickable links to those pages

### `/items/new` — Log creation to price_history
- No UI change
- Backend: on item insert, write 3 `price_history` rows with `old_value=0, source='item_create', is_baseline=1`

### Reports center — Add new cost methods
- Add "السعر المرجعي (Standard)" / "FIFO" / "LIFO" to the cost method dropdown
- Currently shows: WACC, Last Purchase
- Hook into `costingService.computeCostByMethod`
- Show method name prominently on every report header

### Settings page — New section
- "إعدادات الأسعار والتكلفة"
- `margin_alert_cost_method` dropdown (Q20=C, default WACC)
- Threshold settings: target margin %, minimum margin %, selling price drop warning %
- "فحص سلامة البيانات" button → runs `integrityCheckService.runFullCheck`

---

## 6. Permissions

### New permission keys
```
purchases.toggle_lock     → owner + manager (Q22.1)
purchases.edit_past       → owner + manager (Q12.3)
override_price            → owner + manager (Q16.2/22.3 — applies to POS, sales return, purchase return, transfer)
price_history.view        → owner + manager (Q22.2)
```

### Default permission matrix
| Role | toggle_lock | edit_past | override_price | price_history.view |
|---|---|---|---|---|
| Cashier | ✗ | ✗ | ✗ | ✗ |
| Manager | ✓ | ✓ | ✓ | ✓ |
| Owner | ✓ | ✓ | ✓ | ✓ |

Existing permissions (purchases.add/edit/delete) unchanged.

---

## 7. Migration Strategy (Q23 Final)

### Pre-install integrity check (Q23.3 — practical fix)
A new button in the CURRENT version's admin panel: "فحص سلامة البيانات".
- Runs all checks (stock invariant, WACC drift, orphan FKs, price coherence)
- Issues displayed with resolution options (fix / ignore-with-reason)
- New version's installer refuses to proceed unless integrity check is clean within last 24 hours
- This must be backported to the current version BEFORE the new version ships

### Install flow (Q23.1=C — fast structural + background backfill)
**Phase 0 (during install — seconds):**
- Add all new columns to existing tables
- Create new tables (integrity_check_runs, integrity_check_issues)
- Set defaults so existing data behaves as before

**Phase 1 (background after first launch — minutes):**
- Backfill `price_history` with item_create entries
- Backfill `master_price_at_time` on existing invoice_lines (with `backfilled=1` flag)
- Create synthetic opening-balance purchase rows for items with stock but no purchase history
- Run `recomputeWACCForItem` for every item (one-time sanity baseline)
- Progress indicator visible to user; can pause/resume

**Phase 2 (when user clicks "verify now" — on demand):**
- Run full integrity check; show any issues for owner review

### Drift prevention (Q23.2 — math defenses, no cron)
- Round all monetary math to 4 decimals via `utils/money.js`
- Always recompute WACC from purchase history (no incremental updates)
- Force cost on stock adjustments (UI + backend validation)
- No automated drift cron (per user feedback)

---

## 8. Phased Rollout (CRITICAL FOR RISK MANAGEMENT)

### Phase 1 — Foundation (no user-facing behavior change) — 4 days
- Schema changes + backfill migration
- `costingService.js` + `priceLockService.js` + `overrideTrackingService.js` + `utils/money.js`
- Refactor existing routes to use new services internally
- Backend tests for every cost method and lock combo
- **Risk: low** — invisible to users, can revert easily

### Phase 2 — POS / Returns / Transfer override capture (backend) — 1 day
- Wire override capture into POS save, sales return save, purchase return save, branch transfer save
- No UI changes yet — just data collection
- Wait 1 week to verify data integrity in production before Phase 3
- **Risk: low** — additive only

### Phase 3 — Price history tab (read-only) — 3 days
- Add the new tab to `/operations/bulk-price-update`
- Both views (global + per-item drill-down) with Tier 1+2 filters and analytics
- Permission-gated to owner+manager
- **Risk: medium** — new feature, but read-only (no data mutation)

### Phase 4 — /purchases/new overhaul — 3 days
- New staging UI with locks + before→after badges + آخر شراء bar + suggested price hint
- Profit modal button
- Save-time confirmation modal
- Audit log for lock toggles
- **Risk: high** — changes the most-used data entry flow
- Beta-test with one user before full rollout

### Phase 5 — POS / Returns visual indicators — 2 days
- Amber indicators for overrides
- Permission gates
- Full UI symmetry for sales return + purchase return
- **Risk: medium** — UI changes, no data mutation changes

### Phase 6 — Item edit lockdown + settings + reports — 1 day
- Remove price fields from item edit
- Add margin_alert_cost_method setting
- Add FIFO/LIFO/Standard to reports dropdown
- **Risk: low-medium** — power-user features

### Phase 7 — Polish + tour + i18n + docs — 1 day
- Page tour for new lock system
- All ar.json + en.json entries
- User documentation
- **Risk: low**

**Total:** 15 days + 1 week observation buffer between phases 2 and 3.

---

## 9. Testing Strategy

Since we removed the weekly drift cron (per user feedback), tests become the safety net.

### Required test coverage
- `costingService` — every method, edge cases (zero stock, negative qty, single line, mixed warehouses, opening balance)
- `priceLockService` — every cascade scenario (no prior change, same source previous change, different source previous change)
- `overrideTrackingService` — capture on POS, returns, transfers
- `waccService` — replay correctness, drift impossibility (1000-purchase fuzz test)
- `integrityCheckService` — every check type
- E2E: full purchase save with locks (locked/unlocked combinations) + verify expected master price state
- E2E: POS sale with override + verify override visible in price history tab
- E2E: edit purchase + verify cascade warning when applicable
- E2E: void purchase that updated master + verify revert prompt (full return)

### Money math invariant test
- For every monetary operation in the codebase, verify result is `roundMoney(result)`
- Lint rule: forbid raw `*` and `/` on money fields outside `utils/money.js`

---

## 10. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cascade logic bug → master prices silently wrong | Medium | High | Phase 1 backend tests + cascade-warning UI (Q12.2) |
| FIFO replay performance on large item history | Medium | Medium | Caching by (item, period); test with 10k purchases |
| Migration backfill corrupts data | Low | Critical | Pre-install integrity check + phase 0/1 split + DB backup before install |
| User confused by lock UX | High | Medium | Page tour + always-show save modal + clear visual treatment |
| User toggles 🔓 by accident → master prices stop updating | Medium | Medium | Save modal lists unlocked lines explicitly; audit log all toggles |
| Override permission too restrictive → cashiers blocked from legitimate discounts | Medium | Low | Granted to manager by default; owner can grant to specific cashiers |
| Standard Cost ↔ purchase_price field confusion | Medium | Medium | Clear documentation; field labeled "السعر المرجعي" in UI consistently |
| LIFO report numbers used for IFRS-incompliant tax filing | Low | High (legal) | Add warning banner on LIFO reports: "غير معتمد للتقارير الضريبية" |
| Tests catch bugs but not all of them → production drift | Low | High | Phased rollout; observation windows; pre-install integrity tool |
| User does a destructive operation in /items edit that's no longer possible there → confusion | High | Low | Friendly hint with clickable link to the right pages |

---

## 11. Open Questions to Confirm Before Build

Only one open question remains that wasn't explicitly answered:

**Do you want a "draft mode" for purchases?**
Currently saving = committing to all the WACC + lock + master price effects. A draft mode would let users save unfinished purchases without these effects. This came up implicitly several times but never asked directly. My recommendation: **NO** — no draft mode for V1. Add later if users request it.

If you don't object to this default within 1 day of plan review, treat it as accepted.

---

## 12. File-Level Change Summary

### New files
- `server/src/services/costingService.js`
- `server/src/services/priceLockService.js`
- `server/src/services/overrideTrackingService.js`
- `server/src/services/integrityCheckService.js`
- `server/src/utils/money.js`
- `client/src/components/purchases/PriceInputWithLock.jsx`
- `client/src/components/purchases/MasterPriceChangeBadge.jsx`
- `client/src/components/purchases/PurchaseProfitModal.jsx`
- `client/src/components/operations/PriceHistoryTab.jsx`
- `client/src/components/operations/PriceHistoryTimeline.jsx`
- `client/src/components/operations/PriceHistoryItemDrillDown.jsx`
- `client/src/components/operations/PriceHistoryAnalytics.jsx`
- `client/src/components/pos/PriceOverrideIndicator.jsx`
- `client/src/components/admin/IntegrityCheckPanel.jsx`
- `electron/migrations/096_pricing_system_schema.js`
- `electron/migrations/097_pricing_system_backfill.js`

### Major modifications
- `server/src/routes/purchases.routes.js` — lock-aware updates, override capture on selling/wholesale
- `server/src/routes/items.routes.js` — log item create to price_history, integrity check endpoints
- `server/src/routes/invoices.routes.js` — override capture
- `server/src/routes/returns.routes.js` — override capture
- `server/src/routes/branch-transfers.routes.js` — override capture (backend only)
- `server/src/services/waccService.js` — always-recompute pattern
- `client/src/pages/purchases/PurchaseFormPage.jsx` — major UI overhaul
- `client/src/pages/operations/BulkPriceUpdate.jsx` — new tab integration
- `client/src/pages/pos/POSPage.jsx` — amber indicator + permission gate
- `client/src/pages/sales/SalesReturnFormPage.jsx` — full UI symmetry
- `client/src/pages/purchases/PurchaseReturnFormPage.jsx` — full UI symmetry
- `client/src/pages/operations/BranchTransferFormPage.jsx` — backend-only changes
- `client/src/pages/items/ItemFormPage.jsx` — remove price editing
- `client/src/pages/reports/reportsCenterConfig.js` — add Standard/FIFO/LIFO methods
- `client/src/pages/SettingsPage.jsx` — add pricing settings section
- `client/src/locales/ar.json` + `en.json` — all new strings

---

## END OF PLAN
