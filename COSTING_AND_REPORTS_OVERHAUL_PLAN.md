# Costing & Reports Overhaul — Working Plan

> Living document. Edit step by step. Generated 2026-05-26 after code audit.

---

## 0. Glossary (simple words)

| Term | What it means |
|---|---|
| **WAC / المتوسط المرجح** | Average cost of all units in stock, weighted by quantity. |
| **FIFO / الوارد أولاً صادر أولاً** | Oldest stock is sold first. COGS = cost of oldest layer. |
| **LIFO / الوارد أخيراً صادر أولاً** | Newest stock is sold first. COGS = cost of newest layer. IFRS forbids it; report-only. |
| **Last Cost / آخر سعر شراء** | Use the most recent purchase cost regardless of layers. |
| **Cost Ledger** | An append-only log of every event that changes cost (`cost_movements` table). Sealed binder. |
| **Snapshot cost** | Cost frozen on an invoice line at sale time so reports don't shift later. |

---

## 1. Audit findings — what the code actually does today

### 1.1 WACC engine (`server/src/services/waccService.js`)
- `recomputeWACCForItem()` already does a **full chronological replay** from `purchase_lines` + `branch_transfer_lines (type=receive)` — architecturally correct.
- Called on every purchase create/edit/cancel/void/amend/return and every branch-receive (verified at routes).
- **Bug 1** — UPDATE has no `warehouse_id` filter (intentional now: user confirmed warehouses are storage locations only, WACC is item-level). Leave as-is.
- **Bug 2** — UPDATE silently affects 0 rows when no `stock_levels` row exists for the item. WACC is lost.
- **Bug 3** — `stockService.adjustStock()` inserts new `stock_levels` rows without WACC; they default to 0/NULL.
- **Bug 4** — `recalculateWACC()` (deprecated incremental version) is dead code — exported but no callers. Delete.

### 1.2 Smart import (`items.routes.js:554-572` — `setImportedStockLevel`)
- ✅ Writes `stock_levels.quantity` + `stock_movements` row
- ❌ Never sets `wacc` or `last_purchase_cost`
- ❌ Never writes to `purchase_lines`
- ❌ Never calls `recomputeWACCForItem`
- **Result**: imported items show `wacc=0` forever until a real purchase invoice is created. Source of most of the integrity-check noise.

### 1.3 Integrity check (`integrityCheckService.js`)
- 4 issue types: `wacc_drift`, `orphan_reference`, `price_coherence`, `zero_cost_stock`
- Only `wacc_drift` has an auto-fix (replay).
- **Bug 5** — Issues accumulate across runs forever (no cleanup of resolved or stale runs).
- UI is "سلامة البيانات" tab inside سجل تغييرات الأسعار. Confusing to end users.

### 1.4 Reports system (`server/src/reports/`)
- Cost-method switching **partially exists**: `getCostColumn(cost_method)` supports `wacc` and `last_purchase`. A `fifo` branch points to `il.cost_fifo` column which may not exist (dropped in migration 082).
- Reports already wired with `cost_method`:
  - All `profit.js` queries (`profit-by-category`, `profit-by-customer`, `profit-by-period`)
  - 9+ functions in `sales.js` (margin-by-item, margin-by-category, margin-health, sales-by-item, sales-by-category, sales-by-cashier, daily-sales, gross-net-sales, detailed-sales)
  - `inventory.js → stockValuation`
- Reports with `hasProfit: true` in registry: R01, R03, R04, R29, R32, R33, R60, profit-loader/*, net-profit/*
- **Issue** — The frontend likely doesn't expose a cost-method selector for all of these (need to verify in `ReportWorkspacePage.jsx`).
- **Issue** — Registry is duplicated: `classifications` (new structure) + `reports` (legacy flat list). Maintenance hazard.

### 1.5 Cost storage (snapshot vs current)
- `invoice_lines.cost_wacc`, `invoice_lines.cost_last_purchase` — **frozen at sale time** (good)
- `invoice_lines.cost_fifo` — column exists on some DBs, never populated
- `sales_return_lines.cost_wacc`, `cost_last_purchase` — frozen at return time
- `stock_levels.wacc`, `stock_levels.last_purchase_cost` — **current** values, mutable

**Implication**: switching cost method on sales/profit reports reads frozen snapshots — historical numbers stay stable. Switching method on valuation reports reads current state.

---

## 2. Cost-changing events — final list

| # | Event | Source table | Ledger movement_type | Today's handling |
|---|---|---|---|---|
| 1 | Smart import with initial stock | `items` + `stock_levels` | `opening_balance` | ❌ Broken — no cost recorded |
| 2 | Purchase invoice create | `purchase_lines` | `purchase` | ✅ Works |
| 3 | Purchase invoice edit | `purchase_lines` (replaced) | `purchase` (reverse + new) | ✅ Works via replay |
| 4 | Purchase invoice cancel/void | `purchases.status` | `purchase` reversal | ✅ Works via replay (status filter) |
| 5 | Purchase invoice amend | `purchase_lines` delta | `purchase` | ✅ Works via replay |
| 6 | Branch transfer receive create/edit/cancel | `branch_transfer_lines` (type=receive) | `branch_receive` | ✅ Works via replay |
| 7 | Opening balance entry (OB-xxx) | `purchase_lines` with special flag | `opening_balance` | ✅ Treated as purchase today |
| 8 | Purchase return | `purchase_return_lines` | (qty drops, WACC unchanged — conventional WAC) | ✅ Works (return doesn't affect replay) |

Events that do **NOT** change cost: sales, sales returns, branch transfer SEND, manual stock adjustment (qty only), item edit (locked when stock > 0).

---

## 3. PHASE 1 — Cost Ledger Foundation (no behavior change)

**Goal**: introduce immutable cost ledger + pure derivation function + validation that proves it matches existing WACC. Zero risk to production.

### 3.1 Migration `092_cost_movements_ledger.js`
```sql
CREATE TABLE cost_movements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id         INTEGER NOT NULL,
  warehouse_id    INTEGER,                -- nullable; recorded for traceability only, not used in math
  occurred_at     TEXT NOT NULL,          -- the business date of the event
  movement_type   TEXT NOT NULL,          -- 'purchase' | 'branch_receive' | 'opening_balance'
  quantity        REAL NOT NULL,          -- signed: + receive, - reversal
  unit_cost       REAL NOT NULL,
  source_table    TEXT NOT NULL,          -- 'purchase_lines' | 'branch_transfer_lines' | 'item_import'
  source_id       INTEGER NOT NULL,
  source_line_id  INTEGER,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_table, source_id, source_line_id)
);
CREATE INDEX idx_cm_item_time ON cost_movements (item_id, occurred_at, id);
CREATE INDEX idx_cm_source ON cost_movements (source_table, source_id);
```

### 3.2 Migration `093_backfill_cost_movements.js`
- Read every active `purchase_lines` → insert as `movement_type='purchase'` (or `opening_balance` if the parent `purchases.purchase_no LIKE 'OB-%'`).
- Read every active `branch_transfer_lines` where `type='receive'` → insert as `branch_receive`.
- Idempotent: UNIQUE constraint prevents duplicates on re-run.

### 3.3 New service `server/src/services/costLedger.js`
```js
function recordMovement(db, {
  item_id, warehouse_id, occurred_at, movement_type,
  quantity, unit_cost, source_table, source_id, source_line_id
}) { /* INSERT ... ON CONFLICT DO NOTHING */ }

function deriveWACC(db, item_id) {
  // Pure: SELECT all movements ordered by occurred_at,id and replay
  // Returns { quantity, wacc, last_cost, movement_count }
}

function deriveFIFO(db, item_id, consumedQty) {
  // Returns cost of next consumedQty units using oldest-first layers
}

function deriveLIFO(db, item_id, consumedQty) { /* newest-first */ }

function deriveLastCost(db, item_id) { /* most recent movement's unit_cost */ }
```

### 3.4 Validation script `server/scripts/validate-cost-ledger.js`
- For every item: compute WACC two ways — existing `recomputeWACCForItem` vs new `deriveWACC`.
- Print diffs > 0.01 ج.م.
- Phase 2 doesn't start until this reports zero diffs on dev DB.

### 3.5 Standalone fix for smart-import bug (ship now, independent of cutover)
In [items.routes.js:554](server/src/routes/items.routes.js#L554) `setImportedStockLevel`:
- After setting quantity, if `payload.purchase_price > 0` and `delta > 0`:
  - Insert a synthetic row in `purchase_lines` with a parent `purchases` row flagged `purchase_no = 'OB-IMPORT-' || itemId`
  - Call `recomputeWACCForItem(itemId, db)` inside the same transaction
- Backfill script: detect imported items with `stock_levels.wacc = 0` AND `items.purchase_price > 0` AND `quantity > 0` → fabricate the missing opening-balance purchase, recompute.

### 3.6 What does NOT change in Phase 1
- All write paths still call `recomputeWACCForItem`
- All read paths still read `stock_levels.wacc`
- Integrity check UI still exists
- POS / invoicing / reports unchanged

---

## 4. PHASE 2 — Cutover to Ledger-Backed WAC

### 4.1 Replace `recomputeWACCForItem` with a thin wrapper
```js
function recomputeWACCForItem(item_id, db) {
  const { wacc, last_cost, quantity } = deriveWACC(db, item_id);
  db.prepare("UPDATE stock_levels SET wacc=?, last_purchase_cost=? WHERE item_id=?")
    .run(wacc, last_cost, item_id);
  // Insert stock_levels row if missing — fix Bug 2
  return wacc;
}
```
- Source of truth = ledger. `stock_levels.wacc` becomes a read-cache.

### 4.2 Refactor write paths to write to ledger
Each of these writes one or more rows to `cost_movements` inside the existing transaction:
- `purchases.routes.js` — create / edit / cancel / void / amend / return (return-cancel doesn't add a row, just toggles status)
- `branchTransfers.routes.js` — receive create / edit / cancel
- `items.routes.js → setImportedStockLevel` (already done in 3.5)

For cancels: insert a reversing row `quantity = -original, unit_cost = original`.

### 4.3 Delete dead code
- Remove `recalculateWACC()` from `waccService.js` (no callers).
- Remove `integrityCheckService.runFullCheck` → `wacc_drift` branch (mathematically impossible after cutover).

### 4.4 Validation gate
Run `validate-cost-ledger.js` again after refactor — must report zero diffs.

---

## 5. PHASE 3 — Reports: Full Cost-Method Switching

**Goal**: every report that shows bought price, cost, or profit gets a "Cost Method" selector with 4 options: WAC / FIFO / LIFO / Last.

### 5.1 Schema — add missing snapshot columns
Migration `094_add_cost_snapshots_fifo_lifo.js`:
- `invoice_lines.cost_fifo REAL` (re-add if missing post-082)
- `invoice_lines.cost_lifo REAL`
- `sales_return_lines.cost_fifo REAL`, `cost_lifo REAL`

### 5.2 Populate snapshots at sale time
In `invoiceService.js` (where `cost_wacc` is currently frozen):
- Also call `deriveFIFO(db, item_id, quantity_being_sold)` and `deriveLIFO(...)` and freeze on the line.
- Backfill script for historical invoices: replay each invoice in chronological order against the ledger, populating `cost_fifo` / `cost_lifo` columns.

### 5.3 Helpers update
```js
function getCostColumn(costMethod) {
  switch (costMethod) {
    case "last_purchase": return "il.cost_last_purchase";
    case "fifo":          return "il.cost_fifo";
    case "lifo":          return "il.cost_lifo";
    default:              return "il.cost_wacc";
  }
}

function getCostColumnForValuation(costMethod) {
  // For valuation reports — uses CURRENT state, not snapshots
  // Returns a SQL expression that the inventory query plugs in
  switch (costMethod) {
    case "last_purchase": return "sl.last_purchase_cost";
    case "fifo":          return "/* call deriveFIFO via subquery — see 5.4 */";
    case "lifo":          return "/* same with deriveLIFO */";
    default:              return "sl.wacc";
  }
}
```

### 5.4 Valuation report FIFO/LIFO mechanism
Pure-SQL FIFO/LIFO across a whole catalog is awkward. Cleanest approach:
- `stockValuation` query becomes a 2-step JS function:
  1. Fetch items with their on-hand qty
  2. For each item: call `deriveFIFO(db, item_id, on_hand_qty)` to get total FIFO value (cost of holding those last N units bought)
- Slower than pure-SQL but only runs on demand; OK.

### 5.5 Frontend — Cost Method selector
In `client/src/pages/reports/ReportWorkspacePage.jsx`:
- When report's classification has `hasProfit: true` OR is `stock-valuation` or `supplier-pricing`:
- Render a `<select>` with 4 options near the date range filter.
- Persist selection in URL params (`?cost_method=fifo`).
- Default = `wacc`.

### 5.6 Reports that need the selector (final list — 20 reports)

| # | Slug | Source | Why |
|---|---|---|---|
| 1 | `daily-sales` | sales | Has profit column |
| 2 | `detailed-sales` | sales | Line-level cost |
| 3 | `sales-by-item` | sales | Cost / profit per item |
| 4 | `sales-by-category` | sales | Profit per category |
| 5 | `sales-by-cashier` | sales | Profit per cashier |
| 6 | `gross-net-sales` | sales | Gross profit |
| 7 | `margin-by-item` | profit-loader | Margin calc |
| 8 | `margin-by-category` | profit-loader | Margin calc |
| 9 | `margin-health` | profit-loader | Margin threshold |
| 10 | `profit-by-category` | net-profit | COGS |
| 11 | `profit-by-customer` | net-profit | COGS |
| 12 | `profit-by-period` | net-profit | COGS |
| 13 | `profit-loss` | net-profit | Income statement COGS |
| 14 | `stock-valuation` | items | Inventory value at method |
| 15 | `inventory-aging` | items | Optional (cost of aged stock) |
| 16 | `dead-stock` | items | Cost of dead inventory |
| 17 | `slow-moving` | items | Cost of slow-movers |
| 18 | `supplier-pricing` | purchases | Compare to current cost |
| 19 | `top-customers` | customers | Add profit column |
| 20 | `period-comparison` | sales | Add profit comparison |

---

## 6. Report logic audit — bugs found (deep dive)

> Severity: 🔴 wrong numbers shown to users | 🟡 inconsistent/misleading | 🔵 cleanup

### Category A — Returns handling is inconsistent across reports

**B1 🔴 `salesByItem.returns` ignores date range** ([sales.js:205-214](server/src/reports/queries/sales.js#L205))
The returns subquery aggregates **all-time** returns for each item regardless of the report's date filter. Run "January 2026" → revenue is January only, but `returns_amount` includes returns from every year. Profit numbers wrong.

**B2 🔴 `marginByItem.returns` has the same date-filter bug** ([sales.js:541-550](server/src/reports/queries/sales.js#L541))

**B3 🔴 `salesByCategory` doesn't subtract returns at all** ([sales.js:223](server/src/reports/queries/sales.js#L223))
Revenue, cost, and margin are all gross — returns ignored. Inconsistent with `salesByItem` which (partially) subtracts. A category with heavy returns looks more profitable than it is.

**B4 🔴 `marginByCategory` doesn't subtract returns either** ([sales.js:559](server/src/reports/queries/sales.js#L559))

**B5 🟡 `salesByItem` returns are line-total but revenue is header-adjusted** ([sales.js:184,207](server/src/reports/queries/sales.js#L184))
Revenue uses `line_total * i.total / inv_sums.line_sum` (redistributes header discount). Returns use raw `srl.line_total`. If invoices have header discounts, returns are overstated relative to revenue.

**B6 🟡 `customerStatement` doesn't include sales returns** ([accounts.js:94](server/src/reports/queries/accounts.js#L94))
A customer's statement of account shows invoices and payments but not credit-note returns. Owners reconciling with customers see wrong balance.

**B7 🟡 `customerLoyalty.total_spent` doesn't subtract returns** ([accounts.js:196](server/src/reports/queries/accounts.js#L196))

**B8 🟡 `purchasesByItem` doesn't subtract supplier returns** ([purchases.js:119](server/src/reports/queries/purchases.js#L119))
"Total purchased" is gross. Net purchases column missing.

### Category B — Cashier attribution is wrong

**B9 🔴 `salesByCashier.total_items_sold` counts lines, not quantities** ([sales.js:263,268](server/src/reports/queries/sales.js#L263))
`item_count = COUNT(id)` but the field is presented as "items sold". A sale of 5 units of one product + 3 of another shows as 2, not 8.

**B10 🟡 `salesByCashier.returns_handled` attributes by invoice, not by who processed the return** ([sales.js:264](server/src/reports/queries/sales.js#L264))
If cashier A made the sale and cashier B handled the return, the return reduces A's number. Should likely attribute to `sr.created_by`, or split into "returns_on_my_sales" + "returns_i_handled".

**B11 🔴 `shiftHistory` ignores the date filter entirely** ([sales.js:588-605](server/src/reports/queries/sales.js#L588))
No `addDateFilter` call. Always returns every shift in history. Pagination is the only thing saving it.

### Category C — Aging reports show wrong balances

**B12 🔴 `arAging.total_due` includes opening_balance but aging buckets don't** ([accounts.js:14-18](server/src/reports/queries/accounts.js#L14))
`total_due = opening_balance + unpaid_invoices`. The 4 aging columns (`aging_0_30`, `aging_31_60`, etc.) sum unpaid invoices only. **The buckets won't sum to total_due** if the customer has an opening balance. Owner sees a customer owing 5000, but aging columns sum to 3000. Looks broken.

**B13 🔴 `apAging` has the identical bug** ([accounts.js:37-41](server/src/reports/queries/accounts.js#L37))

**B14 🔴 AR/AP aging treat partial payments as zero paid** ([accounts.js:14,37](server/src/reports/queries/accounts.js#L14))
`CASE WHEN i.status != 'paid' THEN i.total ELSE 0 END` — uses full invoice total when status is "unpaid". If a 1000 invoice has 800 paid (partial), the report shows 1000 outstanding. Real outstanding = `i.total - SUM(payments allocated to i.id)`.

**B15 🔴 `collectionEfficiency` has the same partial-payment bug** ([accounts.js:152-153](server/src/reports/queries/accounts.js#L152))
`SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) AS collected` — partial payments count as zero. Collection rate is artificially low.

### Category D — Profit reports

**B16 🟡 `profitByCategory.total_expenses` is duplicated per row** ([profit.js:54-56](server/src/reports/queries/profit.js#L54))
A subquery for total period expenses is shown in every category row. Looks like each category had those expenses. Should be in a summary footer.

**B17 🟡 `profitByCategory` distributes returns proportionally by line_total** ([profit.js:44,47](server/src/reports/queries/profit.js#L44))
But customer returns are usually for specific items, not proportional. So returning expensive items but proportionally allocating to all original-invoice categories is wrong. Real returns should attach to the item's actual category.

**B18 🟡 `profit.js → _returnsSubquery` is duplicated logic from helpers** ([profit.js:13-28](server/src/reports/queries/profit.js#L13))
Same join pattern reimplemented instead of using `getReturnCostColumn` helper. Drift hazard.

### Category E — Schema and registry issues

**B19 🟡 Duplicated registry: `classifications` (new tree) + `reports` flat array** ([registry.js:100,472](server/src/reports/registry.js#L100))
Same report appears twice with potentially diverging filter/option lists. Maintenance hazard.

**B20 🟡 Tax classifications nested under `sales` source**
Tax has its own category id but lives under sales source. Inconsistent.

**B21 🔵 `cost_fifo` column ghost** — exists in some DBs, dropped by migration 082 in others. Fixed by Section 5.1.

**B22 🔵 `recalculateWACC` dead code** — already covered in Section 1.1.

### Category F — Missing data / coverage gaps

**B23 🟡 No "net sales" column anywhere**
Every revenue column is gross. Owners must mentally subtract returns. Should be standard everywhere.

**B24 🟡 `stock-movements` lumps branch transfers with regular receives**
Filter has 3 types (`in`, `out`, `transfer`) but `branch_receive` movements aren't distinguishable from `purchase` receives. Hard to audit transfer flow.

**B25 🟡 `salesByItem` has no "current cost vs avg sale price" column**
You can't see at a glance: "this item is selling at 50, current cost is 55 — losing money". Section 7.4 (Margin Drift) addresses this systematically.

**B26 🟡 `salesByCashier` has no profit column** ([sales.js:251](server/src/reports/queries/sales.js#L251))
Hard to evaluate cashier performance: high sales but bad-margin? No visibility.

**B27 🟡 `periodComparison` has no profit, no cost, no returns**
Just revenue comparison. Limited for a "compare two periods" report.

**B28 🟡 `salesHeatmap` only filters by category, not by cashier or payment_type**
A heatmap of "when does cashier X work fastest" is missing.

---

## 7. NEW REPORTS PROPOSED

Numbered R56–R65, prioritized.

### 7.1 🟢 R56 — Cost Movement Report
**Source**: `inventory`. Raw `cost_movements` ledger filtered by item / date / movement_type.
- Columns: date, movement type, source doc no (clickable), qty, unit_cost, running WACC after, user
- Purpose: full audit trail of cost changes per item. The "binder" itself, viewable.

### 7.2 🟢 R57 — Cost Method Comparison Report
**Source**: `inventory`. Side-by-side stock value under WAC / FIFO / LIFO / Last for every item.
- Columns: item, qty, value_wac, value_fifo, value_lifo, value_last, spread_min_max
- Purpose: financial reporting + decision support on which method to use. Single-screen comparison.

### 7.3 🟢 R58 — Item Lifecycle Report
**Source**: `items`. One row per item, end-to-end activity:
- **Purchases**: total qty, total value, distinct suppliers, first / last purchase date, avg unit cost
- **Sales**: total qty, total revenue, distinct customers, first / last sale date, avg unit price
- **Returns**: sales-returns qty/value, purchase-returns qty/value
- **Transfers**: incoming + outgoing transfer counts
- **Today**: stock on hand, current WAC, sale price, margin %
- **Lifetime**: gross profit, total transactions
- Purpose: covers what "البحث التفصيلي بالأصناف" tried to do but as a proper report row per item. Foundation for the unified item-operations page.

### 7.4 🟢 R59 — Margin Drift / Cost-Price Lag Report
**Source**: `profit-loader`. Items where cost rose but sale price didn't.
- Compare cost in period A (e.g. 60 days ago) vs current cost
- Compare margin in period A vs current
- Sort by margin decline %
- Optional filter: only items still being sold (active in last 30 days)
- Purpose: catches the slow-killer of retail profit — silent margin erosion. Owner sees "raw rice cost went from 40 to 50 but sale price still 60 → margin dropped from 50% to 20%".

### 7.5 🟢 R60 — Inventory Turnover & Days-of-Stock Report
**Source**: `inventory`. Per item:
- Avg daily sales (last 30/60/90 days, configurable)
- Stock on hand today
- **Days of stock = on_hand / avg_daily** (the critical KPI)
- Turnover ratio = cost_of_goods_sold_period / avg_inventory_value
- Status flag: overstocked / healthy / understocked / out
- Purpose: stock-decision tool. "Should I reorder? How much capital is stuck in slow-moving inventory?"

### 7.6 🟢 R61 — Cashier Override / Discount Impact Report
**Source**: `users` or `audit`. Per cashier:
- Number of price overrides during sales (count + frequency)
- Number of header discounts applied + avg discount %
- Estimated revenue impact vs master price
- Item/category breakdown of where overrides happen most
- Purpose: replaces the "تكرار التجاوزات" tab. Detects fraud patterns + identifies which cashiers need pricing training. Once R61 exists, that tab can be removed.

### 7.7 🟢 R62 — Customer Profitability Report
**Source**: `customers`. Like `topCustomers` but profit-based.
- Revenue, gross profit, margin %, return rate, days-since-last-purchase
- A customer can be in top revenue but unprofitable due to heavy discounts/returns
- Purpose: identify customers worth keeping vs unprofitable ones.

### 7.8 🟢 R63 — Supplier Reliability / Performance Report
**Source**: `suppliers`. Per supplier:
- Total purchases, total returns to supplier, return rate %
- Avg lead time (days from PO to receive — if tracked)
- Avg payment days
- Price stability for repeat items (coefficient of variation on unit_cost)
- Purpose: data-driven supplier selection and negotiation.

### 7.9 🟢 R64 — Stock Adjustment Audit Report
**Source**: `audit` / `warehouses`. All manual stock adjustments (damages, count corrections, write-offs).
- Date, item, warehouse, qty_change, reason, user, value impact (qty × WAC)
- Purpose: catch internal shrinkage / theft / data-entry errors. Currently completely invisible.

### 7.10 🟢 R65 — Daily Owner Snapshot (Quick P&L)
**Source**: `net-profit`. Single-page dashboard-style report.
- Today vs yesterday vs same-day-last-week revenue
- Gross profit, returns, expenses, net profit
- Top 5 items sold, top 5 categories
- Overdue receivables count
- Low stock alerts count
- Purpose: owner's "one report I read every morning". Goes to print/PDF for quick review.

### 7.11 (extension) Reorder With Cost Forecast (extend R15)
Today's `reorder` report shows suggested qty. Add: estimated cost to reorder at chosen cost method, preferred supplier last price.

---

## 7b. Cross-cutting report improvements (not new reports)

| Fix | Affects | Section |
|---|---|---|
| Add `net_sales` column = gross − returns | All revenue-bearing reports | Apply during Phase 3 |
| Date-filter the returns subqueries | salesByItem, marginByItem | Bug fixes B1, B2 |
| Add returns to category-level reports | salesByCategory, marginByCategory | Bug fixes B3, B4 |
| Subtract payments for partial-paid invoices | arAging, apAging, collectionEfficiency | Bug fixes B14, B15 |
| Add opening_balance into aging buckets | arAging, apAging | Bug fix B12, B13 |
| Add date filter to shiftHistory | shiftHistory | Bug fix B11 |
| Fix `total_items_sold` to use SUM(quantity) | salesByCashier | Bug fix B9 |
| Add profit column to salesByCashier | salesByCashier | Coverage B26 |
| Add profit + returns to periodComparison | periodComparison | Coverage B27 |
| Add returns to customerStatement & customerLoyalty | accounts | Bug fixes B6, B7 |
| Distinguish branch_receive vs purchase_receive in stock-movements | warehouses | Coverage B24 |
| Move total_expenses to footer in profitByCategory | profit | Bug fix B16 |
| Refactor profit.js to use helpers.getReturnCostColumn | profit | Cleanup B18 |
| Add cost-method selector to all hasProfit reports | UI | Section 5.5 |

---

## 7c. PHASE 3.5 — Bug-fix-only sub-phase (between cost ledger and report enhancements)

Standalone PR that fixes the 15 cross-cutting bugs above without introducing new reports or cost-method changes. Reviewable in isolation. Each bug = its own commit, ideally with a regression test.

Order:
1. Date-scope returns subqueries (B1, B2)
2. Add returns to category-level reports (B3, B4)
3. Partial-payment math in aging + collection (B14, B15)
4. Opening balance in aging buckets (B12, B13)
5. Shift history date filter (B11)
6. Cashier `total_items_sold` fix (B9)
7. Total_expenses footer in profit (B16)
8. Customer statement returns (B6, B7)

---

## 8. PHASE 4 — Cleanup & Migration of "سجل تغييرات الأسعار"

After Phase 3:
- "تتبع صنف" tab → absorbed into unified Item Operations page (original request part 2)
- "كل التغييرات" + "تجاوزات الفواتير" tabs → keep, simpler page now
- "تكرار التجاوزات" tab → replaced by R61 report
- "سلامة البيانات" tab → **delete entirely**. WACC drift is impossible; other 3 issue types move to dev-only diagnostics panel.

---

## 9. Execution order (proposed)

1. **Phase 1** (cost ledger foundation) — non-breaking, parallel build
2. **Phase 1.5** (smart-import bug fix, standalone, can ship today)
3. **Phase 2** (cutover) — gated on validation script clean
4. **Phase 3** (reports cost-method switching) — gated on Phase 2
5. **Phase 3.5** (15 cross-cutting report bug fixes — see Section 7c) — independent, can ship in parallel with Phase 3
6. **NEW R56–R65 reports** — gated on Phase 3 (some need cost ledger, some don't)
7. **Phase 4 cleanup** — gated on everything above
8. **Unified Item Operations page** — the original request (separate plan, will consume R58 data)

---

## 11. Owner's Period Statement (لوحة صاحب المحل) — dedicated worksheet page

**Not a report.** A top-level page that shows the owner's true financial picture for a chosen period. Lives outside `/reports` — its own navigation slot.

### 11.1 Concept
8 flat numbers on one screen. Owner picks a date range + cost-method, sees everything that matters. Click any number → modal with the breakdown. Save snapshots, lock, compare periods.

### 11.2 Page chrome
- **Period picker** at top: من / إلى dates + quick presets (الشهر الحالي / الشهر الماضي / ربع سنة / سنة / مخصص)
- **Cost method selector**: WAC ▾ (FIFO / LIFO / Last)
- **Action buttons** (top-right): حفظ نسخة | إقفال | طباعة | مقارنة فترتين

### 11.3 The 8 rows (flat, no sections, no formulas displayed)

| # | Row | Logic | Date logic | Cost-method dependent? |
|---|---|---|---|---|
| 1 | 📦 قيمة المخزون | `SUM(stock_levels.quantity × cost_at_method)` | End of range | ✅ Yes |
| 2 | 💰 الفلوس في الخزائن والبنوك | Sum of treasury + bank balances | End of range | ❌ No |
| 3 | 🧾 ذمم العملاء (لي) | AR total | End of range | ❌ No |
| 4 | 🧾 ذمم الموردين (عليّ) | AP total | End of range | ❌ No |
| 5 | 💸 المصروفات | `SUM(expenses.amount)` | Over range | ❌ No |
| 6 | 💵 الإيرادات الأخرى | `SUM(revenues.amount)` | Over range | ❌ No |
| 7 | 🏦 المسحوبات | `SUM(withdrawals.amount)` | Over range | ❌ No |
| 8 | 💎 صافي الربح | sales − COGS(method) − returns + other_revenue − expenses − withdrawals | Over range | ✅ Yes |

No manual entries. No formula breakdowns shown inline. Just the 8 numbers.

### 11.4 Drill-down modal (when clicking a row)
- **Size**: 90% viewport width, max 1400px, 85vh height
- **Backdrop close + Esc close**
- **Toolbar**: search box, context-specific filter dropdowns, sort by column, pagination (50/100/200)
- **Footer**: shows both "إجمالي المعروض" (after filters) and "إجمالي كلي" (no filters) to avoid confusion
- **Export**: Excel/PDF/Print of current filtered+sorted view; export header includes period + cost method + applied filters + timestamp
- **"↗ التقرير الكامل"** link opens the matching full report page in a new tab

#### Per-row modal content + filters

| Row | Columns shown | Filters | Full report link |
|---|---|---|---|
| 📦 قيمة المخزون | كود, صنف, قسم, كمية, تكلفة, قيمة | قسم, مخزن, حد أدنى للقيمة, مخزون منخفض | `stock-valuation` |
| 💰 النقدية | اسم الخزينة/البنك, نوع, الرصيد | نوع (treasury/bank), نشط فقط | `treasury` |
| 🧾 ذمم العملاء | اسم, تليفون, مستحق, 0-30, 31-60, 61-90, 90+ | فئة عمر, حد أدنى, blacklisted | `ar-aging` |
| 🧾 ذمم الموردين | اسم, تليفون, مستحق, فئات العمر | فئة عمر, حد أدنى | `ap-aging` |
| 💸 المصروفات | تاريخ, تصنيف, الوصف, طريقة الدفع, المبلغ | تصنيف, طريقة الدفع, نطاق فرعي, مستخدم | `detailed-expenses` |
| 💵 الإيرادات | تاريخ, تصنيف, الوصف, طريقة الدفع, المبلغ | تصنيف, طريقة الدفع, نطاق فرعي | `detailed-revenues` |
| 🏦 المسحوبات | تاريخ, المستخدم, المبلغ, السبب | مستخدم, تصنيف السبب, نطاق فرعي | `withdrawals-report` |
| 💎 صافي الربح | Mini-P&L: المبيعات / تكلفة / مرتجعات / إيرادات / مصروفات / مسحوبات / الصافي | (none — fixed breakdown) | `profit-loss` |

#### Nested drill-down
Each row inside a modal is itself drillable, replacing modal content with a breadcrumb:
```
📦 قيمة المخزون  ›  أرز بسمتي 5 كيلو    ← back arrow
```
No stacked modals. Single-modal breadcrumb navigation.

### 11.5 Save / Lock / Compare

- **حفظ نسخة** → freezes all 8 system values + period + cost-method as a snapshot row. Editable (re-save).
- **إقفال** → snapshot becomes permanent. Read-only, audit-logged.
- **مقارنة فترتين** → pick two saved snapshots → opens comparison view: 8 rows × 3 columns (الفترة الأولى / الفترة الثانية / الفرق + Δ%).

### 11.6 Saved-snapshot mode behavior
- When viewing a locked snapshot: title shows "🔒 نسخة محفوظة"
- All 8 numbers are frozen — even if underlying invoices change later
- Modals show frozen rows (snapshot stores the row-level data, not just totals)
- Cost-method selector is disabled (method was locked at save time)

### 11.7 Data model
New tables:
- `owner_statements`
  - `id, period_start, period_end, cost_method, status (draft|locked), created_by, created_at, locked_at, locked_by, notes`
- `owner_statement_values`
  - `statement_id, metric_key (stock|cash|ar|ap|expenses|revenues|withdrawals|net_profit), value`
- `owner_statement_rows`
  - `statement_id, metric_key, row_json` — frozen breakdown rows for modal display after lock

### 11.8 Navigation slot
**Not under /reports.** Add new sidebar entry: **"الإقفال الشهري"** (or **"لوحة صاحب المحل"**) with its own icon, near الخزينة. Different page chrome from reports — emphasizes "tool, not a report".

### 11.9 Permissions
- Only roles with `system_owner` or explicit `owner_statement` permission can view/save/lock
- Cashiers / regular users: page hidden from sidebar entirely

### 11.10 Print template
Single-page formal layout:
- Header: shop name, period, cost method, "تم الإقفال بواسطة: ..." if locked
- 8 numbers in a clean two-column ledger style
- Footer: timestamp + user + serial number of snapshot

---

## 12. Unified Item Operations Page (بطاقة الصنف التشغيلية)

Replaces and consolidates: البحث التفصيلي بالأصناف from `/sales` and `/purchases`, the "تتبع صنف" tab in سجل تغييرات الأسعار, the thin existing ItemDetailPage, and similar item-tracking views scattered around.

### 12.1 Page identity & routes
- Two entry points to the same page:
  - `/operations/items` → master list visible, no item pre-selected
  - `/operations/items/:itemId` → master list visible, item pre-selected, scroll into view
- Deep-links:
  - From `/sales` BTAA tab → `/operations/items/:itemId?types=sales`
  - From `/purchases` BTAA tab → `/operations/items/:itemId?types=purchases`
- Old `ItemDetailPage` route redirects to the new page.

### 12.2 Layout
- Left rail: master list of items (search + scroll), each row shows code, name, record count
- Right pane: item header card (code, category, current stock, current sale price) + operations feed

### 12.3 Operation type checkboxes (top of right pane)
Default ON (the "transactional story"):
- 🟦 مبيعات — sales invoice lines
- 🟩 مشتريات — purchase invoice lines
- 🟧 مرتجعات مبيعات — sales return lines
- 🟫 مرتجعات مشتريات — purchase return lines
- 🟨 تحويلات الفروع — branch transfer lines (in + out)
- 🟪 رصيد افتتاحي — opening balance entries

Default OFF (audit/admin views):
- ⚪ تغيير سعر — price changes (sale/wholesale/purchase)
- ⚪ حركة مخزون — manual stock adjustments
- ⚪ تغيير تكلفة — cost ledger movements (from Phase 1)

### 12.4 Feed behavior
- **Unified chronological feed** — all enabled types interleaved, newest-first default
- Sort toggle: newest / oldest
- Date range filter: from / to
- Search box: doc number or party name
- Pagination: 10 cards per page

### 12.5 Card structure
Each card = one operation, color-coded left border by type. Three zones:
1. **Header**: type badge + doc number + date
2. **Body**: party name (customer / supplier / from-to warehouse), qty, unit price, line total
3. **Context line** (type-specific): cost, profit, lock-status, etc.
4. **Actions**:
   - 👁 معاينة → opens `<DocumentPreviewModal />`
   - ✎ تعديل → navigates to source form (only on editable types)

Non-editable types (price changes, stock movements, cost ledger rows) hide the ✎ button.

### 12.6 Shared `<DocumentPreviewModal />` component
Path: `client/src/components/operations/DocumentPreviewModal.jsx`
Single component, prop-driven by `docType`. Handles: `invoice`, `sales_return`, `purchase`, `purchase_return`, `branch_transfer`, `opening_balance` (renders as purchase view).

Reused from existing code:
- Status pill map (`paid` / `partial` / `unpaid` / `cancelled`) from `InvoiceDetailPage`
- Payment label map (`نقدي` / `حوالة بنكية` / `آجل` / `أقساط` / `متعدد`) from `InvoiceDetailPage`
- Multi-payment allocation breakdown rendering from `InvoiceDetailPage`
- Refund-method display from `SalesReturnDetailPage`
- Card-and-modal animation pattern from `InvoicePickerTodayModal` / `PurchasePickerTodayModal`
- `PrintPreviewModal` plugs directly into the 🖨️ button — no rewrite

Modal structure:
1. **Header** — shared: doc no, date, status badge, party, total
2. **Lines table** — shared: qty / unit / line total
3. **Payment section** — doc-type-specific, using existing label maps:
   - Invoice / Purchase → `payment_type` badge + (if `multi`) full allocation table
   - Returns → refund method + refund amount + link to original doc
   - Branch transfer → from/to/type
4. **Footer actions** — `✎ تعديل` (navigate) | `↗ فتح كاملاً` (dedicated page) | `🖨️ طباعة` (PrintPreviewModal) | `إغلاق`

Side refactor (small, do during this work): extract duplicated status/payment label maps into `client/src/components/operations/docHelpers.js` and reuse across all detail pages.

### 12.7 Edit-route mapping
| Doc type | Navigate target |
|---|---|
| invoice | `/invoices/:id` |
| sales_return | `/pos/sales-returns/:id` |
| purchase | `/purchases/:id` |
| purchase_return | `/purchases/returns/:id` |
| branch_transfer | `/operations/branch-transfers/:id` |
| opening_balance | `/purchases/:id` (treated as purchase) |

### 12.8 Coexistence with existing surfaces (DO NOT DELETE)

The BTAA tabs and similar item-tracking views **stay** as quick entry points. The new unified page is the **canonical deep view**, additional to existing surfaces, not a replacement.

| Existing surface | Outcome |
|---|---|
| `/sales` → البحث التفصيلي بالأصناف tab | **Kept.** Each row gains a "🔗 عرض كامل" link → opens new page with item pre-selected and `?types=sales`. |
| `/purchases` → البحث التفصيلي بالأصناف tab | **Kept.** Same link → `?types=purchases`. |
| Other scattered item-tracking views | **Kept.** Add the same "🔗 عرض كامل" link where it makes sense. |
| سجل تغييرات الأسعار → "تتبع صنف" tab | Removed from this page; functionality migrates to the new unified page (and the page-level link above). See Section 13 for the redesigned سجل تغييرات الأسعار. |
| Old `ItemDetailPage` | Replaced; route redirects to the new page. |

### 12.9 سجل تغييرات الأسعار after this work
Goes from 5 tabs → 2 tabs:
- ✅ كل التغييرات (kept — cross-item view)
- ✅ تجاوزات الفواتير (kept — cross-item view)
- ❌ تتبع صنف → moved to Section 12 page
- ❌ تكرار التجاوزات → replaced by R61 report
- ❌ سلامة البيانات → deleted (Phase 4, after cost ledger removes drift possibility)

### 12.10 Backend
- One new endpoint: `GET /api/items/:id/operations?types=sales,purchases,...&from=...&to=...&search=...&page=...`
- Returns a unified ordered list of operation rows, each with a `type` discriminator and the minimal fields to render a card
- Detailed preview hits the existing per-type endpoints (`/api/invoices/:id`, etc.) — no new preview API needed

---

## 13. Resolved decisions (locked)

- ✅ **LIFO supported** — all 4 cost methods (WAC / FIFO / LIFO / Last) in scope for reports and the owner statement.
- ✅ **R58 (Item Lifecycle) data feeds the unified item operations page in Section 12** — R58 is the report version (rowed list of items), Section 12 is the UI for a single item's deep view. Both ship.
- ✅ **R57 (Cost Method Comparison)** — kept.
- ✅ **Existing BTAA tabs + scattered item-tracking views are NOT deleted.** The new unified page is additive; old surfaces get "🔗 عرض كامل" deep-links to it.
- ✅ **Phase 1.5 (smart-import bug fix) ships as a standalone PR** — does not wait for Phase 1.
- ✅ **سجل تغييرات الأسعار** — see Section 14.

---

## 14. سجل تغييرات الأسعار — minimal cleanup

Page keeps its current layout and identity. **Only the two confusing/redundant tabs are removed.**

### 14.1 Final tab set (3 tabs)

| Tab | Status | Notes |
|---|---|---|
| **تتبع صنف** | ✅ Kept | Works as today. Add a small `🔗 عرض كامل` link → opens Section 12 unified item page for deeper view. |
| **كل التغييرات** | ✅ Kept | Cross-item timeline of price changes. No changes. |
| **تجاوزات الفواتير** | ✅ Kept | Per-invoice price overrides. No changes. |
| ~~تكرار التجاوزات~~ | ❌ Removed | Replaced by **R61** report (Cashier Override Impact). |
| ~~سلامة البيانات~~ | ❌ Removed | Deleted in Phase 4 once cost ledger (Phase 2) eliminates WACC drift. Other 3 issue types move to dev-only diagnostics panel. |

### 14.2 Implementation
- Remove the two tab buttons + their render branches from [PriceHistoryTab.jsx](client/src/components/operations/PriceHistoryTab.jsx)
- Delete `IntegrityPanel` + `FrequencyPanel` components (or move IntegrityPanel to a dev-only settings page)
- Add one `<Link>` in the "تتبع صنف" tab header → `/operations/items/:itemId`
- Backend `/api/pricing/integrity/*` routes: gate behind `system_owner` role (don't delete — used by dev diagnostics)
- Backend `/api/pricing/overrides/frequency` route: keep — R61 report consumes the same data

### 14.3 Net effect
- 5 tabs → 3 tabs
- No identity change, no reframing, no navigation change
- One small link added for power users who want the Section 12 deep view
