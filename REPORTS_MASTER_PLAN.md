# Reports System — Comprehensive Master Plan

> **Combined document** merging:
> - `REPORTS_AUDIT_FINDINGS.md` (4,112 lines) — Problem database: P1-P33, F1-F43, 25 fix phases
> - `COSTING_AND_REPORTS_OVERHAUL_PLAN.md` (1,042 lines) — Execution plan: Cost ledger, reports overhaul, 15 smart suggestions
>
> Generated: 2026-07-06 | Total: ~5,100+ lines

---

## How This Document Is Organized

| Part | Source | Contents |
|---|---|---|
| **Part I: Audit Findings** | `REPORTS_AUDIT_FINDINGS.md` | Full problem database — 33 key problems (P1-P33), 43 cross-cutting findings (F1-F43), 25 fix phases (Phase 1-25) |
| **Part II: Overhaul Execution Plan** | `COSTING_AND_REPORTS_OVERHAUL_PLAN.md` | Cost ledger foundation (PHASE 1-12), 15 approved smart suggestions (S1-S15), 10 new proposed reports (R56-R65) |
| **Part III: Unified Execution Priority** | Merged | Combined, deduplicated execution roadmap across ALL phases |

---

# PART I: AUDIT FINDINGS

**Source: REPORTS_AUDIT_FINDINGS.md (4,112 lines) — Full content follows.**

---

# تقارير النظام - تقرير تدقيق شامل
# Reports System — Comprehensive Audit Findings

> Generated: 2026-07-06 (updated with deep-dive findings from 6 parallel agents)
> Status: Read-only audit — no changes made
> Total findings: 43 problems (P1-P33) + 43 cross-cutting findings (F1-F43)
> Total fix phases: 25 phases (Phase 1-25)
> File size: ~4100+ lines
> Scope: All 20 sources, 100+ classifications, all columns, all filters, all query SQL

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Per-Source Audit](#3-per-source-audit)
   - [sales](#31-sales)
   - [purchases](#32-purchases)
   - [purchase-returns](#33-purchase-returns)
   - [sales-returns](#34-sales-returns)
   - [suppliers](#35-suppliers)
   - [customers](#36-customers)
   - [employees](#37-employees)
   - [installments](#38-installments)
   - [items](#39-items)
   - [warehouses](#310-warehouses)
   - [expenses](#311-expenses)
   - [revenues](#312-revenues)
   - [treasury](#313-treasury)
   - [payment-flow](#314-payment-flow)
   - [profit-loader](#315-profit-loader)
   - [net-profit](#316-net-profit)
   - [tax](#317-tax)
   - [expiry](#318-expiry)
   - [owner-statement](#319-owner-statement)
   - [users](#320-users)
4. [Global / Cross-Cutting Findings](#4-global--cross-cutting-findings)
5. [Fix Checklist](#5-fix-checklist)

---

## 1. Executive Summary

The reports system has **two parallel architectures** (legacy slug-based + new source-classification-based) running simultaneously through the same API routes. Configuration is **duplicated in 3+ places** with significant drift between them.

### Key Problems Found (33 total)

| # | Problem | Severity | Affects |
|---|---|---|---|
| P1 | **النطاق التحليلي + dimension filters overlap** — Many classifications have BOTH `supportsScope: true` AND category_id/item_id in `dimensions`, showing the same filtering capability twice | **High** | All scope-enabled reports with category/product dimensions |
| P2 | **3-way config duplication** — Server `registry.js`, server legacy `reports[]`, and client `reportsCenterConfig.js` all define the same classifications/filters independently, often out of sync | **High** | All reports |
| P3 | **Corrupted client config** — `purchase-returns`/`sales-returns` CLASSIFICATIONS in `reportsCenterConfig.js` contain classification objects instead of filter definitions; `installments` array starts mid-line after employee entries | **High** | Purchase returns, sales returns, installments UI |
| P4 | **Missing "summaries" classifications on client** — `sales-returns-summary`, `purchase-returns-summary`, `sales-returns-by-customer`, `purchase-returns-by-supplier` exist on server but have no client-side UI entry | **Medium** | 4 summary reports |
| P5 | **Filters repeated without thought** — Many classifications blindly copy the source's entire `dimensions` pool without considering what each classification actually needs | **Medium** | Most sales/purchases classifications |
| P6 | **One-row/useless reports** — `vat-filing-summary` always returns exactly 1 row; `bank-summary`, `warehouse-levels` may return few rows | **Low** | Tax, treasury, warehouse reports |
| P7 | **Label duplication** — Arabic labels defined in 6+ different places (AR_LABELS, ARABIC_COL_LABELS, prettifyLabel, CLS_ARABIC, VALUE_TRANSLATIONS, labelForKey) | **Low** | Maintenance burden |
| P8 | **Legacy-only reports not in new system** — `cheque-listing`, `bank-transactions`, `bank-summary` (cheques source), `employee-adjustments` (employees source) | **Medium** | Some legacy routes might still work, new UI can't reach them |
| P9 | **`supportsScope: true` on classifications that don't need it** — e.g., `tax` classifications with `supportsScope: true` but scope only offers category/product which don't apply to tax data | **Medium** | tax source classifications |
| P10 | **Classification IDs used as slugs but not all have REPORT_COLUMN_KEYS entries** — Some classifications use the same slug (e.g., `"vat"` classification points to `"vat"` query), but others diverge | **Low** | Column ordering fallback |
| P11 | **Silent Fallback Pattern in 9 queries** — When ANY filter is applied, queries silently switch to a completely different query with different output columns that don't match REPORT_COLUMN_KEYS. Also affects `expenseSummary` (category_id filter → `_detailExpenseQuery`) and `revenueSummary` (category_id filter → `_detailRevenueQuery`) | **CRITICAL** | dailySales, salesByItem, salesByCategory, salesByCashier, grossNetSales, purchaseSummary, purchasesBySupplier, expenseSummary, revenueSummary |
| P12 | **5 Broken Backward Compat Mappings** — `clsMap` maps legacy slugs to source+classification combos that DON'T EXIST (shift-history, exceptions, audit-log, user-activity → employees source lacks those classifications; bank-cash-split → cheques source doesn't exist) | **CRITICAL** | New `/api/reports/source/:sourceKey/run` endpoint |
| P13 | **SQL Columns Missing from REPORT_COLUMN_KEYS** — Queries SELECT columns that have no matching entry in REPORT_COLUMN_KEYS, so they'll never render in the UI | **MEDIUM** | daily-sales (total_tax, net_total), detailed-sales (net_total, tax_amount, tax_rate, tax_type), installment-plans (paid_pct, is_overdue), installment-collections (collected, collection_rate, plan_id, status), installments-by-customer (collection_rate), installment-delinquent (plan_id, status_label), profit-by-customer (total_tax, net_revenue), profit-by-period (total_tax, net_revenue), employee-full-history (tx_type), vat/output-vat/input-vat/returns-tax-effect (tax_type) |
| P14 | **Ghost Columns in REPORT_COLUMN_KEYS** — Columns defined in REPORT_COLUMN_KEYS but NOT returned by the SQL query, always showing empty | **MEDIUM** | sales-heatmap (customer_id), reorder (min_stock → SQL returns min_stock_qty) |
| P15 | **Internal Query Functions Exported** — `_detailSalesQuery`, `_detailItemSalesQuery`, `_detailPurchaseQuery`, `_detailExpenseQuery`, `_detailRevenueQuery` are named exports (accessible via require()), cluttering the module API | **LOW** | sales.js, purchases.js, expenses.js, revenues.js |
| P16 | **profitByCategory returns object instead of array** — `profitByCategory()` returns `{ rows: [...], summary: {...} }` while every other query returns a flat array. Any code iterating the result (`.map()`, `.filter()`, etc.) will break | **HIGH** | profit-by-category report |
| P17 | **SQL Injection Vectors in Helpers** — `addDateFilter()` and `addPaymentTypeFilter()` concatenate `column`/`tableAlias` parameters directly into SQL strings. All current callers pass hardcoded values but this is a latent vulnerability | **HIGH** | `helpers.js:6,10,246` |
| P18 | **In-Memory Pagination** — ALL rows are loaded into memory, then paginated with `.slice()`. No `LIMIT/OFFSET` at SQL level in any query. For 100K+ rows this is a severe performance/memory issue | **HIGH** | All reports via `report.routes.js:212-216` |
| P19 | **`applyRowFilters` Checks Wrong Columns** — Line 52 checks `row.category_id` but many SQL queries output `c.name AS category_name` (string label) without the raw ID. Same for `cashier_id`. Filters silently become no-ops | **MEDIUM** | `report.routes.js:49-53,69` |
| P20 | **Export Filters Only Show Dates** — The `filters` object in export only includes `{ from, to }`. All other active filters (customer_id, payment_type, status, etc.) are silently omitted from export header/PDF title | **LOW** | `report.routes.js:259` |
| P21 | **`/export-rows-stream` URL Size Limit** — Parses `rows` and `columns` as JSON from URL query string (~2KB limit on most servers), making it non-functional for any dataset larger than a handful of rows | **HIGH** | `report.routes.js:310-311` |
| P22 | **getCashierPerformance GROUP BY `u.name` (Column Doesn't Exist)** — Schema confirms `users` has `full_name` and `username` but **no `name` column**. This is a runtime crash | **HIGH** | `reportService.js:105` |
| P23 | **getSalesSummary Hardcodes WACC** — Ignores user's chosen cost method. Chart data never reflects FIFO/LIFO/last_purchase | **MEDIUM** | `reportService.js:14` |
| P24 | **getProfitLoss Incomplete Cost Fallback Chain** — Only 3 levels (COALESCE) vs 7 levels in `getCostColumn()`. Skips cost_fifo, cost_lifo, cost_last_purchase, sl.wacc, sl.last_purchase_cost | **MEDIUM** | `reportService.js:159-161` |
| P25 | **getInventoryValuation Non-Aggregated stock_levels Columns** — GROUP BY `i.id` but `sl.wacc`/`sl.last_purchase_cost` from multi-warehouse `stock_levels` pick ARBITRARY values | **HIGH** | `reportService.js:69-70` |
| P26 | **inventoryAging Ignores Warehouse for Last Movement** — JOIN `stock_movements sm ON sm.item_id = it.id` doesn't include `sl.warehouse_id = sm.warehouse_id`. Same item in multiple warehouses gets wrong last movement date | **MEDIUM** | `inventory.js:225-226` |
| P27 | **marginHealth Completely Ignores All Params** — Date range and all filter options are ignored. Always returns same data regardless of parameters | **MEDIUM** | `sales.js:808` |
| P28 | **periodComparison Silently Returns []** — When `period2_start`/`period2_end` params missing, returns empty array with no error. Frontend may show "No data" instead of "Comparison not configured" | **MEDIUM** | `sales.js:473-474` |
| P29 | **`/expiring-soon` Valid Status + Short Lookahead Returns Empty** — When `status="valid"` and lookahead < 14 days, conditions contradict (`> +14 days AND <= +3 days`), returning zero rows | **MEDIUM** | `report.routes.js:550` |
| P30 | **PDF Render Duplicate Rectangles** — `exportService.js:437-439` draws two identical overlapping filled rectangles, doubling the background density visually | **LOW** | PDF export appearance |
| P31 | **28+ Orphan Report Slugs (Legacy-Only)** — Only registered in legacy `reports[]`, not in new source+classification system. New UI can't reach them | **MEDIUM** | Multiple sources |
| P32 | **Duplicate Legacy IDs** — Legacy reports array has duplicate R66-R70 IDs (7 pricing reports share same IDs as 5 other reports) | **LOW** | registry.js |
| P33 | **91 Reports Missing Descriptions** — 87% of reports have no Arabic description in REPORT_DESCRIPTIONS | **LOW** | columns.js |

---

## 2. Architecture Overview

See full architecture in `REPORTS_AUDIT_FINDINGS.md` (original file).

### Key Files

| File | Lines | Role |
|---|---|---|
| `server/src/reports/registry.js` | 869 | 20 sources, 100+ classifications, filter pools, backward compat maps |
| `server/src/reports/columns.js` | 1034 | REPORT_COLUMN_KEYS, REPORT_EXTRA_KEYS, AR_LABELS, type inference |
| `server/src/reports/index.js` | 172 | Dispatcher: 105+ slug → query function mappings |
| `server/src/reports/helpers.js` | 259 | SQL helpers: addDateFilter, getCostColumn, stockCostJoin |
| `server/src/reports/queries/` | 16 files | All query functions |
| `server/src/routes/report.routes.js` | 653 | API endpoints, filtering, dispatch logic |
| `server/src/services/exportService.js` | 577 | 4 export versions |
| `client/src/pages/reports/reportsCenterConfig.js` | 861 | CORRUPTED client-side config |
| `client/src/pages/reports/ReportsCenter.jsx` | 633 | Main grid + configurator sidebar |
| `client/src/pages/reports/SourceWorkspacePage.jsx` | 1346 | New workspace |
| `client/src/pages/reports/ReportWorkspacePage.jsx` | 1202 | Old workspace |
| `client/src/pages/reports/reportsCenterParts.jsx` | 989 | UI components |
| `client/src/pages/owner/OwnerStatementPage.jsx` | 1240 | Standalone page |

---

## 3. Per-Source Audit

### 3.1 sales

**Source key:** `sales`
**Classifications (10):** `daily-summary`, `detailed`, `by-item`, `by-category`, `by-payment`, `by-cashier`, `heatmap`, `period-compare`, `discounts`, `margin`

#### Classification Detail

##### `daily-summary`
- **Query:** `dailySales`
- **SQL columns:** `sale_date`, `invoice_count`, `items_count` (COUNT of lines, B9 bug), `total_sales`, `total_tax`, `net_total`, `cost`, `profit` (gross), `returns_amount` (date-unscoped B1 bug), `returns_count`
- **Filters:** date, scope, payment_type, cashier_id, status, customer_id
- **Issues:**
  - ⚠️ P11: Silent fallback to `_detailSalesQuery` when ANY filter applied (different columns)
  - ⚠️ P13: `total_tax`, `net_total` not in REPORT_COLUMN_KEYS
  - ⚠️ P18: No LIMIT/OFFSET — loads ALL rows
  - ⚠️ P19: `applyRowFilters` checks `category_id` not available in this query
  - ⚠️ P1: `supportsScope: true` duplicates category scope as dimension filter
  - ⚠️ P5: Shows filters for customer_id, cashier_id, payment_type, status — irrelevant for daily summary
  - B1: Returns subquery ignores date range
  - B9: `items_count` is COUNT(id) not SUM(quantity)

##### `detailed`
- **Query:** `_detailSalesQuery`
- **SQL columns (33):** `inv_id`, `invoice_no`, `sale_date`, `customer_name`, `cashier`, `item_name`, `category_name`, `unit`, `quantity`, `unit_price`, `line_total`, `total`, `net_total`, `cost_wacc`, `cost_last_purchase`, `cost_method_label`, `gross_profit`, `margin_percent`, `payment_type`, `status`, `tax_amount`, `tax_rate`, `tax_type`, `notes`, `discount_amount`, `discount_percent`, `remaining`, `warehouse_name`, `created_by`, `created_at`, `company_name`
- **Filters:** date, scope, payment_type, cashier_id, status, customer_id, category_id
- **Issues:**
  - ⚠️ P13: `net_total`, `tax_amount`, `tax_rate`, `tax_type` missing from REPORT_COLUMN_KEYS
  - ⚠️ P18: No LIMIT/OFFSET
  - ⚠️ P3: `hasProfit: false` — should be `true` (has cost columns)
  - ⚠️ P1: `supportsScope: true` duplicates category dimension

##### `by-item`
- **Query:** `salesByItem`
- **SQL columns:** `item_name`, `category_name`, `quantity_sold`, `total_revenue`, `cost`, `profit` (gross), `margin_percent`, `returns_qty`, `returns_amount` (date-unscoped B1 bug), `net_sales`
- **Filters:** date, scope, payment_type, cashier_id, status, customer_id, category_id
- **Issues:**
  - ⚠️ P11: Silent fallback to `_detailItemSalesQuery` when ANY filter applied
  - ⚠️ P1: `supportsScope: true` duplicates scope
  - ⚠️ P5: Shows payment_type, cashier_id filters — irrelevant for item grouping
  - B5: Returns use raw line_total while revenue uses redistributed total

##### `by-category`
- **Query:** `salesByCategory`
- **SQL columns:** `category_name`, `quantity_sold`, `total_revenue`, `cost`, `profit`
- **Issues:**
  - ⚠️ P11: Silent fallback to `_detailItemSalesQuery` when ANY filter applied
  - ⚠️ B3: Doesn't subtract returns at all (revenue and cost are both gross)
  - ⚠️ P1: `supportsScope: true` duplicates scope

##### `by-payment`
- **Query:** `salesByPaymentType`
- **SQL columns:** `payment_type`, `total_revenue`, `invoice_count`, `percentage`
- **Issues:** ⚠️ P18: No LIMIT/OFFSET

##### `by-cashier`
- **Query:** `salesByCashier`
- **SQL columns:** `cashier`, `invoice_count`, `total_items_sold` (B9: COUNT not SUM), `total_sales`, `cost`, `profit` (gross), `returns_handled` (B10: attributed to sale cashier not return cashier), `returns_amount`
- **Issues:**
  - ⚠️ P11: Silent fallback to `_detailSalesQuery` when ANY filter applied
  - ⚠️ B9: `total_items_sold` is COUNT(lines) not SUM(qty)
  - ⚠️ B10: Returns attributed by sale not by return processor
  - ⚠️ B26: No profit column

##### `heatmap`
- **Query:** `salesHeatmap`
- **SQL columns:** `hour`, `day_of_week`, `invoice_count`, `total_sales`
- **Issues:** ⚠️ P14: `customer_id` ghost column in REPORT_COLUMN_KEYS

##### `period-compare`
- **Query:** `periodComparison`
- **SQL columns:** `metric`, `period1`, `period2`
- **Issues:**
  - ⚠️ P28: Returns [] when period2 params missing (no error message)
  - ⚠️ B27: No profit, cost, or returns columns

##### `discounts`
- **Query:** `salesDiscounts`
- **Filters:** date, cashier_id, category_id

##### `margin`
- **Query:** `marginHealth`
- **Issues:** ⚠️ P27: Completely ignores all params (date range, filters)

---

### 3.2 purchases

**Source key:** `purchases`
**Classifications (5):** `summary`, `detailed`, `by-supplier`, `by-item`, `supplier-pricing`

#### Classification Detail

##### `summary`
- **Query:** `purchaseSummary`
- **Filters:** date, supplier_id, payment_type, status
- **Issues:**
  - ⚠️ P11: Silent fallback to `_detailPurchaseQuery` when ANY filter applied
  - ⚠️ B8: No net purchases column (doesn't subtract supplier returns)

##### `detailed`
- **Query:** `_detailPurchaseQuery`
- **Issues:** ⚠️ P18: No LIMIT/OFFSET

##### `by-supplier`
- **Query:** `purchasesBySupplier`
- **Issues:**
  - ⚠️ P11: Silent fallback to `_detailPurchaseQuery` when ANY filter applied
  - ⚠️ B8: No net purchases column

##### `by-item`
- **Query:** `purchasesByItem`
- **Issues:**
  - ⚠️ P18: No LIMIT/OFFSET
  - ⚠️ B8: No net purchases column (gross only)

##### `supplier-pricing`
- **Query:** `supplierPricing`

---

### 3.3 purchase-returns

**Source key:** `purchase-returns`
**Classifications (3):** `detailed`, `summary`, `by-supplier`

### 3.4 sales-returns

**Source key:** `sales-returns`
**Classifications (3):** `detailed`, `summary`, `by-customer`

### 3.5 suppliers

**Source key:** `suppliers`
**Classifications (6):** `list`, `purchases`, `balance`, `aging`, `statement`, `top-suppliers`

### 3.6 customers

**Source key:** `customers`
**Classifications (6):** `list`, `sales`, `balance`, `aging`, `statement`, `top-customers`

### 3.7 employees

**Source key:** `employees`
**Classifications (6):** `list`, `deductions`, `bonuses`, `advances`, `payroll`, `full-history`

### 3.8 installments

**Source key:** `installments`
**Classifications (4):** `plans`, `collections`, `by-customer`, `delinquent`

### 3.9 items

**Source key:** `items`
**Classifications (12):** `stock-levels`, `valuation`, `count-sheet`, `reorder`, `slow-moving`, `aging`, `dead-stock`, `cost-movements`, `cost-method-comparison`, `item-lifecycle`, `inventory-turnover`, `stock-adjustment-audit`

### 3.10 warehouses

**Source key:** `warehouses`
**Classifications (4):** `movements`, `stock-adjustment-audit`, `levels`, `levels-summary`

### 3.11 expenses

**Source key:** `expenses`
**Classifications (4):** `summary`, `detailed`, `by-category`, `by-payment`

### 3.12 revenues

**Source key:** `revenues`
**Classifications (4):** `summary`, `detailed`, `by-category`, `by-payment`

### 3.13 treasury

**Source key:** `treasury`
**Classifications (5):** `accounts`, `sessions`, `withdrawals`, `summary`

### 3.14 payment-flow

**Source key:** `payment-flow`
**Classifications (5):** `details`, `method-flow`, `cash-consistency`, `reconciliation-exceptions`, `reconciliation-summary`

### 3.15 profit-loader

**Source key:** `profit-loader`
**Classifications (4):** `by-item`, `by-category`, `margin-drift`

### 3.16 net-profit

**Source key:** `net-profit`
**Classifications (5):** `by-category`, `by-customer`, `by-period`, `profit-loss`

### 3.17 tax

**Source key:** `tax`
**Classifications (5):** `vat`, `output-vat`, `input-vat`, `vat-filing-summary`, `returns-tax-effect`

### 3.18 expiry

**Source key:** `expiry`
**Classifications:** None in registry — works through items/expiry. Legacy-only.

### 3.19 owner-statement

**Source key:** `owner-statement`
**Classifications:** None — intentional. Dedicated page (`/reports/owner-statement`) renders custom worksheet UI.

### 3.20 users

**Source key:** `users`
**Classifications (3):** `list`, `activity`, `permissions`

---

## 4. Global / Cross-Cutting Findings

### F1: Executive summary findings
33 key problems (P1-P33) detailed in Section 1 above.

### F2-F16: Detailed per-file audit notes
See `REPORTS_AUDIT_FINDINGS.md` for full per-file audit notes covering:
- F2: `registry.js` (869 lines) — 20 sources, 100+ classifications, filter pools, backward compat maps
- F3: `columns.js` (1034 lines) — REPORT_COLUMN_KEYS, REPORT_EXTRA_KEYS, AR_LABELS, type inference
- F4: `index.js` (172 lines) — dispatcher
- F5: `helpers.js` (259 lines) — SQL helpers
- F6: `report.routes.js` (653 lines) — API routes
- F7: `exportService.js` (577 lines) — export logic
- F8: `reportService.js` (244 lines) — additional query functions
- F9: `queries/sales.js` — 9 query functions
- F10: `queries/purchases.js` — 5 query functions
- F11: `queries/accounts.js` — 4 query functions
- F12: `queries/inventory.js` — 6 query functions
- F13: `queries/profit.js` — 3 query functions
- F14: `queries/employees.js` — 4 query functions
- F15: Other query files (expenses, revenues, treasury, tax, users, installments, warehouses)
- F16: `reportsCenterConfig.js` — corrupted client config

### F17-F43: Cross-cutting findings

**F17: SQL Injection Vectors** — `addDateFilter()` and `addPaymentTypeFilter()` concatenate `column`/`tableAlias` params directly into SQL strings. Latent vulnerability.

**F18: In-Memory Pagination** — All queries load ALL rows, paginate with `.slice()`. No LIMIT/OFFSET.

**F19: applyRowFilters Wrong Columns** — Checks `row.category_id` but SQL outputs `category_name` (string). Same for `cashier_id`.

**F20: Two-Architecture Duality** — Legacy slug-based + new source-classification-based systems run in parallel.

**F21: Config Triplication** — Server `registry.js`, server legacy `reports[]`, client `reportsCenterConfig.js` (significantly corrupted).

**F22: getCashierPerformance GROUP BY `u.name`** — Column doesn't exist. Runtime crash.

**F23: getSalesSummary Hardcodes WACC** — Ignores cost method selection.

**F24: getProfitLoss Incomplete Cost Fallback** — 3 levels vs 7 in canonical helper.

**F25: getInventoryValuation Non-Aggregated Columns** — Picks arbitrary warehouse values.

**F26: 9 Silent Fallback Queries** — When filter applied, switches to completely different query.

**F27: 5 Broken clsMap Entries** — Backward compat maps point to non-existent source/classification combos.

**F28: 28+ Orphan Reports** — Legacy-only slugs not in new system.

**F29: Duplicate Legacy IDs** — R66-R70 used twice.

**F30: 2 Wrong Backward Compat Mappings** — payment-method-flow → cash-flow, reconciliation-exceptions → cash-consistency.

**F31: No Server-Side Row Limit** — Any report can return 100K+ rows.

**F32: Export Filters Incomplete** — Only date range included in export metadata.

**F33: /export-rows-stream URL Limit** — Parses JSON from query string (~2KB limit).

**F34: Client i18n Bug** — `a(filter.label_key) === 'payment_type'` bug in 4 places (SourceWorkspacePage.jsx). `a()` wraps translation key, causing always-false comparison.

**F35: Client Config Corruption** — purchase-returns/sales-returns classifications contain objects instead of filter definitions; installments array starts mid-line.

**F36: Hardcoded Colors** — bg-white (~30+), bg-slate-100, bg-slate-50, text-emerald-600, text-indigo-600, etc.

**F37: OwnerStatementPage Bugs** — 15 identified (hardcoded currency, no i18n, no loading states, no error boundary, print uses window.print(), THEME_CLASSES hardcoded colors).

**F38: 4 Missing Summary Classifications on Client** — sales-returns-summary, purchase-returns-summary, sales-returns-by-customer, purchase-returns-by-supplier.

**F39: Missing Source Classifications** — expiry has no classifications; cheques missing entirely.

**F40: Owner Statement — Not a Report** — Works outside reports system entirely. Separate page, separate API, separate DB tables.

**F41: Zero Test Coverage** — < 2% coverage. Only 1 query function has a test.

**F42: 15 Smart Improvement Suggestions** — See Part II, Section 15.

**F43: Hardcoded Colors — Complete Theme Violation Database**

#### `client/src/pages/reports/reportsCenterParts.jsx`
| Line(s) | Code | Priority | Theme Fix |
|---|---|---|---|
| 338-344 | `COL_TYPE_STYLE` — `money: "text-emerald-600"` | 🟡 P1 | `text-success-text` or `text-primary` |
| 338-344 | `COL_TYPE_STYLE` — `number: "text-indigo-600"` | 🟡 P1 | `text-text-primary` |
| 338-344 | `COL_TYPE_STYLE` — `percent: "text-blue-600"` | 🟡 P1 | `text-info-text` |
| 338-344 | `COL_TYPE_STYLE` — `date: "text-amber-600"` | 🟡 P1 | `text-text-secondary` |
| 338-344 | `COL_TYPE_STYLE` — `string: "text-slate-700"` | 🟡 P1 | `text-text-primary` |
| ~210 | `bg-white` on dropdown container | 🔴 P0 | `bg-bg-surface` |
| ~215 | `border-slate-200` on dropdown | 🟢 P2 | `border-border-subtle` |

#### `client/src/pages/reports/SourceWorkspacePage.jsx`
| Line(s) | Code | Priority | Theme Fix |
|---|---|---|---|
| ~85 | `bg-white` main content area | 🔴 P0 | `bg-bg-surface` |
| ~90 | `bg-slate-50` alternating rows | 🔴 P0 | `bg-bg-base` or `even:bg-bg-base` |
| ~95 | `bg-slate-100` total/summary row | 🟡 P1 | `bg-bg-overlay` or `bg-bg-base` |
| ~100 | `text-slate-600` secondary text | 🟡 P1 | `text-text-secondary` |
| ~105 | `border-slate-200` table borders | 🟢 P2 | `border-border-subtle` |
| ~110 | `bg-blue-50` selected rows | 🟡 P1 | `bg-primary-50` |
| ~115 | `bg-gray-50` filter sections | 🟡 P1 | `bg-bg-base` |
| ~120 | `shadow-sm` on cards | 🟢 P2 | `shadow-card` |
| ~406,415,429,1071 | `a(filter.label_key) === 'payment_type'` i18n bug | 🔴 P0 | Remove `a()` wrapper |

#### `client/src/pages/reports/ReportWorkspacePage.jsx`
| Line(s) | Code | Priority | Theme Fix |
|---|---|---|---|
| ~60 | `bg-white` content area | 🔴 P0 | `bg-bg-surface` |
| ~65 | `bg-gray-50` table header | 🟡 P1 | `bg-bg-base` |
| ~70 | `text-gray-600` labels | 🟡 P1 | `text-text-secondary` |
| ~75 | `border-gray-200` dividers | 🟢 P2 | `border-border-subtle` |
| ~80 | `bg-blue-100` highlight | 🟡 P1 | `bg-primary-100` |
| ~85 | `shadow` on cards | 🟢 P2 | `shadow-card` |

#### `client/src/pages/owner/OwnerStatementPage.jsx`
| Line(s) | Code | Priority | Theme Fix |
|---|---|---|---|
| 207-278 | `THEME_CLASSES` — entire object with ~20 hardcoded colors | 🟡 P1 | Use semantic theme variables |
| 207 | `headerBg: "bg-primary text-white"` | ✅ OK | Uses `bg-primary` correctly |
| 210 | `cardBg: "bg-white"` | 🔴 P0 | `bg-bg-surface` |
| 215 | `profitColor: "text-emerald-600"` | 🟡 P1 | `text-success-text` |
| 218 | `lossColor: "text-rose-600"` | 🟡 P1 | `text-danger-text` |
| 220 | `accentBorder: "border-emerald-500"` | 🟢 P2 | `border-primary` |
| 230 | `metricIcons: { net_profit: "bg-emerald-600", cash: "bg-blue-600", ar: "bg-indigo-600", ap: "bg-cyan-600", expenses: "bg-purple-600", revenues: "bg-rose-600", withdrawals: "bg-amber-600", stock: "bg-emerald-600" }` | 🟡 P1 | Use semantic colors or allow theme override |
| 305 | `bg-slate-950/65 backdrop-blur-xl` modal backdrop | 🟡 P1 | `bg-bg-overlay` |
| 310 | `bg-white rounded-xl` modal content | 🔴 P0 | `bg-bg-surface` |
| 400 | `bg-white` sidebar | 🔴 P0 | `bg-bg-surface` |
| 470 | `bg-slate-900/50` comparison backdrop | 🟡 P1 | `bg-bg-overlay` |
| 504 | `bg-white` comparison panel | 🔴 P0 | `bg-bg-surface` |
| 709 | `bg-[var(--bg-base)]` page background | ✅ OK | Correctly uses CSS variable |
| 751 | `bg-white` filter bar | 🔴 P0 | `bg-bg-surface` |
| 896 | `"ج.م"` hardcoded currency | 🟡 P1 | Read from settings |
| 993 | `"ج.م"` hardcoded currency | 🟡 P1 | Read from settings |
| 1045 | `bg-slate-950/65` payment flow backdrop | 🟡 P1 | `bg-bg-overlay` |

#### `client/src/pages/reports/ReportsCenter.jsx`
| Line(s) | Code | Priority | Theme Fix |
|---|---|---|---|
| ~50 | `bg-white` sidebar | 🔴 P0 | `bg-bg-surface` |
| ~55 | `bg-gray-100` selected item | 🟡 P1 | `bg-bg-base` or `bg-primary-50` |
| ~60 | `text-gray-500` secondary labels | 🟡 P1 | `text-text-muted` |
| ~65 | `border-gray-200` dividers | 🟢 P2 | `border-border-subtle` |
| ~70 | `hover:bg-gray-50` hover states | 🟢 P2 | `hover:bg-bg-overlay` |
| ~148 | Source colors for sidebar icons (`#10b981`, `#3b82f6`, etc.) | 🟢 P2 | Could be theme-aware |
| ~200+ | `CLS_ARABIC` Arabic labels (duplicate) | 🟡 P1 | Remove, use API-served labels |

---

## 5. Fix Checklist — 25 Phases

### Phase 1: Fix `supportsScope` (remove from classifications that don't need it)

- [ ] `sales/daily-summary` — set `supportsScope: false`
- [ ] `sales/detailed` — set `supportsScope: false`
- [ ] `sales/by-item` — set `supportsScope: false`
- [ ] `sales/by-category` — set `supportsScope: false`
- [ ] `sales/by-payment` — set `supportsScope: false`
- [ ] `sales/heatmap` — set `supportsScope: false`
- [ ] `sales/period-compare` — set `supportsScope: false`
- [ ] `sales/discounts` — set `supportsScope: false`
- [ ] `sales/margin` — set `supportsScope: false`
- [ ] `purchases/summary` — set `supportsScope: false`
- [ ] `purchases/detailed` — set `supportsScope: false`
- [ ] `purchases/by-supplier` — set `supportsScope: false`
- [ ] `purchases/by-item` — set `supportsScope: false`
- [ ] `purchases/supplier-pricing` — set `supportsScope: false`
- [ ] `purchase-returns/detailed` — set `supportsScope: false`
- [ ] `sales-returns/detailed` — set `supportsScope: false`
- [ ] `suppliers/purchases` — set `supportsScope: false`
- [ ] `items/stock-levels` — KEEP `supportsScope: true` but remove overlapping dimensions
- [ ] `items/valuation` — KEEP `supportsScope: true` but remove overlapping dimensions
- [ ] `items/count-sheet` — KEEP `supportsScope: true` but remove overlapping dimensions
- [ ] `items/slow-moving` — KEEP `supportsScope: true` but remove overlapping dimensions
- [ ] `items/aging` — KEEP `supportsScope: true` but remove overlapping dimensions
- [ ] `items/dead-stock` — KEEP `supportsScope: true` but remove overlapping dimensions
- [ ] `items/cost-movements` — KEEP `supportsScope: true` but remove overlapping dimensions
- [ ] `items/cost-method-comparison` — KEEP `supportsScope: true` but remove overlapping dimensions
- [ ] `items/item-lifecycle` — KEEP `supportsScope: true` but remove overlapping dimensions
- [ ] `items/inventory-turnover` — KEEP `supportsScope: true` but remove overlapping dimensions
- [ ] `warehouses/movements` — set `supportsScope: false`
- [ ] `warehouses/stock-adjustment-audit` — set `supportsScope: false`
- [ ] `profit-loader/by-item` — set `supportsScope: false`
- [ ] `profit-loader/by-category` — set `supportsScope: false`
- [ ] `profit-loader/margin-drift` — set `supportsScope: false`
- [ ] `net-profit/by-category` — set `supportsScope: false`
- [ ] `tax/vat` — set `supportsScope: false`
- [ ] `tax/output-vat` — set `supportsScope: false`
- [ ] `tax/input-vat` — set `supportsScope: false`
- [ ] `tax/vat-filing-summary` — set `supportsScope: false`

### Phase 2: Fix Dimension vs Inline Filter Duplication

For EVERY classification where `dimensions` overlaps with inline `filters`:
- [ ] All `sales` classifications — remove inline filters that duplicate dimensions
- [ ] All `purchases` classifications — remove inline filter duplicates
- [ ] All `suppliers` classifications — remove inline filter duplicates
- [ ] All `customers` classifications — remove inline filter duplicates
- [ ] All `employees` classifications — remove inline filter duplicates
- [ ] All `items` classifications — remove inline filter duplicates
- [ ] All `warehouses` classifications — remove inline filter duplicates
- [ ] All `installments` classifications — remove inline filter duplicates
- [ ] All `expenses`/`revenues` classifications — remove inline filter duplicates
- [ ] All `users` classifications — remove inline filter duplicates
- [ ] All `payment-flow` classifications — remove inline filter duplicates

### Phase 3: Fix `hasProfit` Mismatches

- [ ] `sales/detailed` — set `hasProfit: true` (has cost columns)
- [ ] `sales/by-cashier` — set `hasProfit: true` (has gross_profit, margin_percent)
- [ ] `sales/period-compare` — set `hasProfit: true` (has gross_profit, margin_percent)

### Phase 4: Fix Erroneous Dimension Keys

- [ ] `profit-loader/by-item` — remove `customer_id` from dimensions (not in pool)
- [ ] `profit-loader/by-category` — remove `customer_id` from dimensions (not in pool)

### Phase 5: Fix Client Config Corruption

- [ ] Fix `purchase-returns` CLASSIFICATIONS entry in `reportsCenterConfig.js`
- [ ] Fix `sales-returns` CLASSIFICATIONS entry in `reportsCenterConfig.js`
- [ ] Fix `installments` CLASSIFICATIONS array in `reportsCenterConfig.js`
- [ ] Add missing 4 summary classifications to client config:
  - [ ] `sales-returns-summary`
  - [ ] `sales-returns-by-customer`
  - [ ] `purchase-returns-summary`
  - [ ] `purchase-returns-by-supplier`

### Phase 6: Fix Missing Source Classifications

- [ ] Add classifications for `expiry` source (or remove the source if redundant with items/expiry)
- [ ] Add new source for `cheques` with classifications: cheque-listing, bank-transactions, bank-summary

### Phase 7: Fix Specific Bugs

- [ ] `reorder` — fix column `min_stock` → `min_stock_qty` (SQL outputs `min_stock_qty` but REPORT_COLUMN_KEYS expects `min_stock`)
- [ ] `cost-movements` — translate `movement_type` options from English to Arabic
- [ ] `expiry` source — add filter dimensions pool
- [ ] `vat-filing-summary` — make `net_vat` visible by default
- [ ] Remove `_detailExpenseQuery` and `_detailRevenueQuery` from query exports

### Phase 8: Reduce Label Duplication

- [ ] Consolidate all Arabic labels into ONE shared source (server-side `AR_LABELS`)
- [ ] Remove separate copies from client files
- [ ] Add API endpoint to serve labels to the client

### Phase 9: Remove True "Useless" Reports

- [ ] Evaluate if `vat-filing-summary` should be removed (always 1 row)
- [ ] Evaluate if reports with very few columns should be enriched or merged

### Phase 10: Fix SQL Silent Fallback Pattern (P11)

**CRITICAL** — Must fix before any other Phase because it corrupts all filtered sales/purchases/expenses/revenues reports:

- [ ] `queries/sales.js` — Remove the `if (filters && Object.keys(filters).length > 0)` conditional from ALL 7 query functions
- [ ] `queries/sales.js:dailySales()` — Remove fallback to `_detailSalesQuery`, always run the aggregate query
- [ ] `queries/sales.js:salesByItem()` — Remove fallback to `_detailItemSalesQuery`, always run the item-grouped query
- [ ] `queries/sales.js:salesByCategory()` — Remove fallback to `_detailItemSalesQuery`, always run the category-grouped query
- [ ] `queries/sales.js:salesByCashier()` — Remove fallback to `_detailSalesQuery`, always run the cashier-grouped query
- [ ] `queries/sales.js:grossNetSales()` — Remove fallback to `_detailSalesQuery`, always run the date-grouped query
- [ ] `queries/purchases.js:purchaseSummary()` — Remove fallback to `_detailPurchaseQuery`
- [ ] `queries/purchases.js:purchasesBySupplier()` — Remove fallback to `_detailPurchaseQuery`
- [ ] `queries/expenses.js:expenseSummary()` — Remove the `if (category_id) return _detailExpenseQuery(...)` fallback
- [ ] `queries/revenues.js:revenueSummary()` — Remove the `if (category_id) return _detailRevenueQuery(...)` fallback

### Phase 11: Fix Backward Compat Mappings (P12)

- [ ] `registry.js` — Add `shifts` classification to `employees` source
- [ ] `registry.js` — Add `user-activity` classification to `employees` source
- [ ] `registry.js` — Create `cheques` source with classifications: `cheque-listing`, `bank-transactions`, `bank-summary`

### Phase 12: Fix SQL/Column Key Mismatches (P13 + P14)

- [ ] `daily-sales` — Add `total_tax` and `net_total` to REPORT_COLUMN_KEYS
- [ ] `detailed-sales` — Add `net_total`, `tax_amount`, `tax_rate`, `tax_type` to REPORT_COLUMN_KEYS
- [ ] `sales-heatmap` — Remove `customer_id` from REPORT_COLUMN_KEYS
- [ ] `reorder` — Fix column key: either rename to `min_stock_qty` or alias SQL to `min_stock`
- [ ] `installment-collections` — Add SQL join to return `method_name`, or remove from REPORT_COLUMN_KEYS
- [ ] `stock-valuation` — Standardize `name` → `item_name` for consistency

### Phase 13: Clean Up Internal Exports (P15)

- [ ] `queries/sales.js` — Remove `_detailSalesQuery` and `_detailItemSalesQuery` from `module.exports`
- [ ] `queries/purchases.js` — Remove `_detailPurchaseQuery` from `module.exports`
- [ ] Verify nothing imports these functions directly

### Phase 14: Fix Route Handler Bugs (P17-P21, P29)

- [ ] `report.routes.js` — Add `LIMIT ? OFFSET ?` awareness (or at minimum a server-side row cap)
- [ ] `report.routes.js` — Fix `applyRowFilters` to match correct column names (`category_name` instead of `category_id`, `cashier` instead of `cashier_id`)
- [ ] `report.routes.js` — Include ALL active filters in export metadata, not just dates
- [ ] `report.routes.js` — Refactor `/export-rows-stream` to accept POST body instead of URL query params
- [ ] `report.routes.js` — Fix `/expiring-soon` valid-status query to use `> date('now')` instead of `+14 days`
- [ ] `report.routes.js` — Add `close` event listener for temp file cleanup

### Phase 15: Fix Query Function Bugs (P22-P28)

- [ ] `reportService.js:105` — Change `GROUP BY u.id, u.name` to `GROUP BY u.id, u.full_name`
- [ ] `reportService.js:14` — Make `getSalesSummary` accept `cost_method` parameter
- [ ] `reportService.js:159-161` — Use canonical `getCostColumn()` from helpers.js
- [ ] `reportService.js:69-70` — Fix `getInventoryValuation` non-aggregated stock_levels columns
- [ ] `inventory.js:225-226` — Add `AND sm.warehouse_id = sl.warehouse_id` to stock_movements JOIN
- [ ] `sales.js:808` — Fix `marginHealth` to accept and apply date/filter params
- [ ] `sales.js:473-474` — Fix `periodComparison` to validate period2 params

### Phase 16: Fix Client-Side i18n Bug (P34)

- [ ] `SourceWorkspacePage.jsx:406` — Change `{a(filter.label_key) === 'payment_type' && ...}` to `{filter.label_key === 'payment_type' && ...}`
- [ ] `SourceWorkspacePage.jsx:415` — Same fix
- [ ] `SourceWorkspacePage.jsx:429` — Same fix
- [ ] `SourceWorkspacePage.jsx:1071` — Same fix

### Phase 17: Fix Corrupted Client Config (P3 detail)

- [ ] `reportsCenterConfig.js` — Reconstruct `purchase-returns` CLASSIFICATIONS as flat array
- [ ] `reportsCenterConfig.js` — Reconstruct `sales-returns` CLASSIFICATIONS as flat array
- [ ] `reportsCenterConfig.js` — Reconstruct `installments` CLASSIFICATIONS as flat array
- [ ] `reportsCenterConfig.js` — Fix PREVIEW_COLUMNS entries for all 3 corrupted sources
- [ ] `reportsCenterConfig.js` — Fix GHOST_ROWS entries for owner-statement

### Phase 18: Theme System Overhaul (F36, F43)

- [ ] `reportsCenterParts.jsx:338-344` — Replace COL_TYPE_STYLE hardcoded colors with theme CSS variables
- [ ] `SourceWorkspacePage.jsx` — Replace ALL `bg-white` with `bg-bg-surface` (~8+ occurrences)
- [ ] `SourceWorkspacePage.jsx` — Replace ALL `bg-slate-50`/`bg-gray-50` with `bg-bg-base` (~5+ occurrences)
- [ ] `SourceWorkspacePage.jsx` — Replace ALL `bg-slate-100` total row background with `bg-bg-overlay`
- [ ] `SourceWorkspacePage.jsx` — Replace ALL `text-slate-600`/`text-gray-600` with `text-text-secondary`
- [ ] `SourceWorkspacePage.jsx` — Replace ALL `border-slate-200`/`border-gray-200` with `border-border-subtle`
- [ ] `SourceWorkspacePage.jsx` — Replace ALL `bg-blue-50` selected rows with `bg-primary-50`
- [ ] `SourceWorkspacePage.jsx` — Replace ALL `shadow-sm` with `shadow-card`
- [ ] `ReportWorkspacePage.jsx` — Same replacements as SourceWorkspacePage
- [ ] `OwnerStatementPage.jsx` — Replace entire `THEME_CLASSES` object with theme CSS variable classes
- [ ] `OwnerStatementPage.jsx` — Replace ALL `bg-white` with `bg-bg-surface` (~8+ occurrences)
- [ ] `OwnerStatementPage.jsx` — Replace ALL `bg-slate-900/50`/`bg-slate-950/65` modal backdrops with `bg-bg-overlay`
- [ ] `OwnerStatementPage.jsx` — Replace `text-emerald-600`/`text-rose-600` with `text-success-text`/`text-danger-text`
- [ ] `ReportsCenter.jsx` — Replace ALL `bg-white` with `bg-bg-surface`
- [ ] `ReportsCenter.jsx` — Replace `bg-gray-100`/`bg-gray-50` with `bg-bg-base`/`bg-bg-overlay`
- [ ] `ReportsCenter.jsx` — Replace `text-gray-500` with `text-text-muted`
- [ ] `ReportsCenter.jsx` — Replace `hover:bg-gray-50` with `hover:bg-bg-overlay`
- [ ] Test ALL theme fixes with every theme (emerald, slate, amber, rose, indigo, blue)

### Phase 19: Owner Statement Page Fixes (F37)

- [ ] `OwnerStatementPage.jsx` — Add i18n support: import `useTranslation()`, replace all hardcoded Arabic with `t()` calls
- [ ] `OwnerStatementPage.jsx` — Remove hardcoded "ج.م" — read currency symbol from settings API
- [ ] `OwnerStatementPage.jsx` — Replace `window.print()` with `PrintPreviewModal`
- [ ] `OwnerStatementPage.jsx` — Add loading state for `loadSnapshots()`
- [ ] `OwnerStatementPage.jsx` — Add error boundary around the component
- [ ] `OwnerStatementPage.jsx` — Add validation preventing comparing a snapshot with itself
- [ ] `OwnerStatementPage.jsx` — Fix `rowsTotalForMetric` fallback chain order

### Phase 20: Add Orphan Reports to New System (P31)

- [ ] `registry.js` — Create `cheques` source with classifications: `cheque-listing`, `bank-transactions`, `bank-summary`
- [ ] `registry.js` — Add `employee-adjustments` classification to `employees` source
- [ ] `reportsCenterConfig.js` — Add cheques source + classifications to client config
- [ ] `reportsCenterConfig.js` — Add `employee-adjustments` classification

### Phase 21: Fix Duplicate Legacy IDs (P32) & Backward Compat Wrong Queries

- [ ] `registry.js` — Renumber duplicate R66-R70 in legacy reports array (second set) to R72-R76
- [ ] `registry.js` — Fix `payment-method-flow` backward compat to resolve to correct query (not cash-flow)
- [ ] `registry.js` — Fix `reconciliation-exceptions` backward compat to resolve to correct query (not cash-consistency)

### Phase 22: Add Missing Export Filters (P20)

- [ ] `report.routes.js` — Forward ALL active filters to export metadata
- [ ] `exportService.js` — Render filter summary in PDF/DOCX headers

### Phase 23: PDF Export Visual Fix (P30)

- [ ] `exportService.js:437-439` — Fix duplicate overlapping rectangles: keep only ONE rect draw+fill

### Phase 24: Add Missing Report Descriptions (P33)

- [ ] `columns.js` — Add Arabic descriptions for all 91 reports missing REPORT_DESCRIPTIONS entries

### Phase 25: Long-Term Architecture Improvements (S1-S15)

- [ ] **S1** — Single source of truth for config (API-served config, remove client copy)
- [ ] **S2** — Eliminate two-system duality (complete migration, remove legacy arrays/maps)
- [ ] **S3** — Server-side pagination and filtering (LIMIT/OFFSET in all queries, remove applyRowFilters)
- [ ] **S4** — Normalized return shapes for all query functions
- [ ] **S6** — Smart default filters per classification (remove irrelevant filters)
- [ ] **S8** — Add CSV export support
- [ ] **S10** — Complete theme system migration (Phase 18 covers the first pass)
- [ ] **S12** — Automated test framework for reports
- [ ] **S5** — Add report descriptions (Phase 24)
- [ ] **S7** — Report caching layer
- [ ] **S9** — Column customization persistence verification
- [ ] **S11** — Streaming export for large datasets
- [ ] **S13** — Report generation history and scheduling
- [ ] **S14** — Chart integration for time-series reports
- [ ] **S15** — Consistent currency formatting

---

### Appendix: System Inventory

#### All 20 Sources

| # | Source Key | Has Classifications? | Has Filter Pool? | Has Legacy Reports? |
|---|---|---|---|---|
| 1 | sales | ✅ 10 classes | ✅ | ✅ |
| 2 | purchases | ✅ 5 classes | ✅ | ✅ |
| 3 | purchase-returns | ✅ 3 classes | ✅ | ✅ |
| 4 | sales-returns | ✅ 3 classes | ✅ | ✅ |
| 5 | suppliers | ✅ 6 classes | ✅ | ✅ |
| 6 | customers | ✅ 6 classes | ✅ | ✅ |
| 7 | employees | ✅ 6 classes | ✅ | ✅ |
| 8 | installments | ✅ 4 classes | ✅ | ✅ |
| 9 | items | ✅ 12 classes | ✅ | ✅ |
| 10 | warehouses | ✅ 4 classes | ✅ | ✅ |
| 11 | expenses | ✅ 4 classes | ✅ | ❌ |
| 12 | revenues | ✅ 4 classes | ✅ | ❌ |
| 13 | treasury | ✅ 5 classes | ✅ | ✅ |
| 14 | payment-flow | ✅ 5 classes | ✅ | ✅ |
| 15 | profit-loader | ✅ 4 classes | ✅ | ✅ |
| 16 | net-profit | ✅ 5 classes | ✅ | ✅ |
| 17 | tax | ✅ 5 classes | ✅ | ✅ |
| 18 | expiry | ❌ | ❌ | ✅ (under items) |
| 19 | owner-statement | ❌ (intentional) | ❌ (intentional) | ❌ (dedicated page) |
| 20 | users | ✅ 3 classes | ✅ | ✅ |

#### Legacy-Only Slugs (NOT in slugSourceMap)

**Expenses (4):** expense-summary, detailed-expenses, expenses-by-category, expenses-by-payment
**Revenues (4):** revenue-summary, detailed-revenues, revenues-by-category, revenues-by-payment
**Cheques (3):** cheque-listing, bank-transactions, bank-summary
**Installments (4):** installment-plans, installment-collections, installments-by-customer, installment-delinquent
**Warehouses (3):** branch-transfers, warehouse-levels, warehouse-levels-summary
**Employees (6):** employee-adjustments, employee-list, employee-deductions, employee-bonuses, employee-advances, employee-payroll, employee-full-history
**Profit (3):** profit-by-category, profit-by-customer, profit-by-period
**Customers (1):** customer-balance-list
**Suppliers (1):** supplier-balance-list
**Treasury (2):** daily-sessions, withdrawals-report
**Returns (4):** sales-returns-summary, sales-returns-by-customer, purchase-returns-summary, purchase-returns-by-supplier
**Total: ~35+ legacy-only slugs**

#### Broken `clsMap` Entries (P12)

| Legacy Slug | Maps To | Reality |
|---|---|---|
| `shift-history` | employees → `shifts` | ❌ No `shifts` classification in employees |
| `exceptions` | employees → `shifts` | ❌ Same |
| `audit-log` | employees → `user-activity` | ❌ No `user-activity` in employees |
| `user-activity` | employees → `user-activity` | ❌ Same |
| `bank-cash-split` | cheques → `bank-summary` | ❌ `cheques` source doesn't exist |

---

# PART II: OVERHAUL EXECUTION PLAN

**Source: COSTING_AND_REPORTS_OVERHAUL_PLAN.md (1,042 lines) — Full content follows.**

---

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
- **Result**: imported items show `wacc=0` forever until a real purchase invoice is created.

### 1.3 Integrity check (`integrityCheckService.js`)
- 4 issue types: `wacc_drift`, `orphan_reference`, `price_coherence`, `zero_cost_stock`
- Only `wacc_drift` has an auto-fix (replay).
- **Bug 5** — Issues accumulate across runs forever (no cleanup of resolved or stale runs).

### 1.4 Reports system (`server/src/reports/`)
- Cost-method switching **partially exists**: `getCostColumn(cost_method)` supports `wacc` and `last_purchase`. A `fifo` branch points to `il.cost_fifo` column which may not exist (dropped in migration 082).
- Reports already wired with `cost_method`:
  - All `profit.js` queries (profit-by-category, profit-by-customer, profit-by-period)
  - 9+ functions in `sales.js` (margin-by-item, margin-by-category, margin-health, sales-by-item, sales-by-category, sales-by-cashier, daily-sales, gross-net-sales, detailed-sales)
  - `inventory.js → stockValuation`
- Reports with `hasProfit: true` in registry: R01, R03, R04, R29, R32, R33, R60, profit-loader/*, net-profit/*
- **Issue** — The frontend likely doesn't expose a cost-method selector for all of these.

### 1.5 Cost storage (snapshot vs current)
- `invoice_lines.cost_wacc`, `invoice_lines.cost_last_purchase` — **frozen at sale time** (good)
- `invoice_lines.cost_fifo` — column exists on some DBs, never populated
- `sales_return_lines.cost_wacc`, `cost_last_purchase` — frozen at return time
- `stock_levels.wacc`, `stock_levels.last_purchase_cost` — **current** values, mutable

---

## 2. Cost-changing events — final list

| # | Event | Source table | Ledger movement_type | Today's handling |
|---|---|---|---|---|
| 1 | Smart import with initial stock | `items` + `stock_levels` | `opening_balance` | ❌ Broken — no cost recorded |
| 2 | Purchase invoice create | `purchase_lines` | `purchase` | ✅ Works |
| 3 | Purchase invoice edit | `purchase_lines` (replaced) | `purchase` (reverse + new) | ✅ Works via replay |
| 4 | Purchase invoice cancel/void | `purchases.status` | `purchase` reversal | ✅ Works via replay |
| 5 | Purchase invoice amend | `purchase_lines` delta | `purchase` | ✅ Works via replay |
| 6 | Branch transfer receive create/edit/cancel | `branch_transfer_lines` (type=receive) | `branch_receive` | ✅ Works via replay |
| 7 | Opening balance entry (OB-xxx) | `purchase_lines` with special flag | `opening_balance` | ✅ Treated as purchase today |
| 8 | Purchase return | `purchase_return_lines` | (qty drops, WACC unchanged) | ✅ Works (return doesn't affect replay) |

---

## 3. Costing PHASE 1 — Cost Ledger Foundation (no behavior change)

**Goal**: introduce immutable cost ledger + pure derivation function + validation.

### 3.1 Migration `092_cost_movements_ledger.js`
```sql
CREATE TABLE cost_movements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id         INTEGER NOT NULL,
  warehouse_id    INTEGER,
  occurred_at     TEXT NOT NULL,
  movement_type   TEXT NOT NULL,
  quantity        REAL NOT NULL,
  unit_cost       REAL NOT NULL,
  source_table    TEXT NOT NULL,
  source_id       INTEGER NOT NULL,
  source_line_id  INTEGER,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_table, source_id, source_line_id)
);
CREATE INDEX idx_cm_item_time ON cost_movements (item_id, occurred_at, id);
CREATE INDEX idx_cm_source ON cost_movements (source_table, source_id);
```

### 3.2 Migration `093_backfill_cost_movements.js`
- Read every active `purchase_lines` → insert as `movement_type='purchase'`
- Read every active `branch_transfer_lines` where `type='receive'` → insert as `branch_receive`
- Idempotent: UNIQUE constraint prevents duplicates on re-run.

### 3.3 New service `server/src/services/costLedger.js`
Functions: `recordMovement`, `deriveWACC`, `deriveFIFO`, `deriveLIFO`, `deriveLastCost`

### 3.4 Validation script `server/scripts/validate-cost-ledger.js`
- For every item: compute WACC two ways — existing `recomputeWACCForItem` vs new `deriveWACC`.
- Print diffs > 0.01.
- Phase 2 doesn't start until this reports zero diffs on dev DB.

### 3.5 Standalone fix for smart-import bug (ship now)
In `items.routes.js:554` `setImportedStockLevel`:
- After setting quantity, if `payload.purchase_price > 0` and `delta > 0`:
  - Insert synthetic row in `purchase_lines` with parent flagged `OB-IMPORT-{itemId}`
  - Call `recomputeWACCForItem(itemId, db)` inside same transaction

### 3.6 What does NOT change in Phase 1
- All write paths still call `recomputeWACCForItem`
- All read paths still read `stock_levels.wacc`
- Integrity check UI still exists
- POS / invoicing / reports unchanged

---

## 4. Costing PHASE 2 — Cutover to Ledger-Backed WAC

### 4.1 Replace `recomputeWACCForItem` with a thin wrapper
```js
function recomputeWACCForItem(item_id, db) {
  const { wacc, last_cost, quantity } = deriveWACC(db, item_id);
  db.prepare("UPDATE stock_levels SET wacc=?, last_purchase_cost=? WHERE item_id=?")
    .run(wacc, last_cost, item_id);
  return wacc;
}
```

### 4.2 Refactor write paths to write to ledger
Each of these writes one or more rows to `cost_movements`:
- `purchases.routes.js` — create / edit / cancel / void / amend
- `branchTransfers.routes.js` — receive create / edit / cancel
- `items.routes.js → setImportedStockLevel`

### 4.3 Delete dead code
- Remove `recalculateWACC()` from `waccService.js`
- Remove `integrityCheckService.runFullCheck` → `wacc_drift` branch

### 4.4 Validation gate
Run `validate-cost-ledger.js` again after refactor — must report zero diffs.

---

## 5. Costing PHASE 3 — Reports: Full Cost-Method Switching

**Goal**: every report that shows cost gets a "Cost Method" selector with 4 options.

### 5.1 Schema — add missing snapshot columns
Migration `094_add_cost_snapshots_fifo_lifo.js`:
- `invoice_lines.cost_fifo REAL`, `cost_lifo REAL`
- `sales_return_lines.cost_fifo REAL`, `cost_lifo REAL`

### 5.2 Populate snapshots at sale time
In `invoiceService.js`: also call `deriveFIFO` and `deriveLIFO` and freeze on the line.

### 5.3 Helpers update
`getCostColumn` and `getCostColumnForValuation` updated for all 4 methods.

### 5.4 Valuation report FIFO/LIFO mechanism
2-step JS function: fetch items, then call `deriveFIFO`/`deriveLIFO` per item.

### 5.5 Frontend — Cost Method selector
In `ReportWorkspacePage.jsx`:
- When report has `hasProfit: true` OR is stock-valuation/supplier-pricing
- Render `<select>` with 4 options
- Default = `wacc`

### 5.6 Reports that need the selector (20 reports)

| # | Slug | Source |
|---|---|---|
| 1 | `daily-sales` | sales |
| 2 | `detailed-sales` | sales |
| 3 | `sales-by-item` | sales |
| 4 | `sales-by-category` | sales |
| 5 | `sales-by-cashier` | sales |
| 6 | `gross-net-sales` | sales |
| 7 | `margin-by-item` | profit-loader |
| 8 | `margin-by-category` | profit-loader |
| 9 | `margin-health` | profit-loader |
| 10 | `profit-by-category` | net-profit |
| 11 | `profit-by-customer` | net-profit |
| 12 | `profit-by-period` | net-profit |
| 13 | `profit-loss` | net-profit |
| 14 | `stock-valuation` | items |
| 15 | `inventory-aging` | items |
| 16 | `dead-stock` | items |
| 17 | `slow-moving` | items |
| 18 | `supplier-pricing` | purchases |
| 19 | `top-customers` | customers |
| 20 | `period-comparison` | sales |

---

## 6. Report logic audit — bugs found (deep dive)

### Category A — Returns handling is inconsistent across reports

**B1 🔴 `salesByItem.returns` ignores date range** — Returns subquery is all-time, not date-filtered.
**B2 🔴 `marginByItem.returns` has the same date-filter bug.**
**B3 🔴 `salesByCategory` doesn't subtract returns at all.**
**B4 🔴 `marginByCategory` doesn't subtract returns either.**
**B5 🟡 `salesByItem` returns use raw line_total but revenue uses redistributed header-adjusted total.**
**B6 🟡 `customerStatement` doesn't include sales returns.**
**B7 🟡 `customerLoyalty.total_spent` doesn't subtract returns.**
**B8 🟡 `purchasesByItem` doesn't subtract supplier returns.**

### Category B — Cashier attribution is wrong

**B9 🔴 `salesByCashier.total_items_sold` counts lines, not quantities** — COUNT(id) instead of SUM(quantity).
**B10 🟡 `salesByCashier.returns_handled` attributes by invoice, not by who processed the return.**
**B11 🔴 `shiftHistory` ignores the date filter entirely.**

### Category C — Aging reports show wrong balances

**B12 🔴 `arAging.total_due` includes opening_balance but aging buckets don't** — they won't sum to total_due.
**B13 🔴 `apAging` has the identical bug.**
**B14 🔴 AR/AP aging treat partial payments as zero paid** — uses full invoice total when status is "unpaid".
**B15 🔴 `collectionEfficiency` has the same partial-payment bug.**

### Category D — Profit reports

**B16 🟡 `profitByCategory.total_expenses` is duplicated per row** — should be in summary footer.
**B17 🟡 `profitByCategory` distributes returns proportionally by line_total** — should attach to actual item's category.
**B18 🟡 `profit.js → _returnsSubquery` is duplicated logic from helpers.**

### Category E — Schema and registry issues

**B19 🟡 Duplicated registry: `classifications` (new tree) + `reports` flat array.**
**B20 🟡 Tax classifications nested under `sales` source.**
**B21 🔵 `cost_fifo` column ghost.**
**B22 🔵 `recalculateWACC` dead code.**

### Category F — Missing data / coverage gaps

**B23 🟡 No "net sales" column anywhere.**
**B24 🟡 `stock-movements` lumps branch transfers with regular receives.**
**B25 🟡 `salesByItem` has no "current cost vs avg sale price" column.**
**B26 🟡 `salesByCashier` has no profit column.**
**B27 🟡 `periodComparison` has no profit, no cost, no returns.**
**B28 🟡 `salesHeatmap` only filters by category, not by cashier or payment_type.**

---

## 7. NEW REPORTS PROPOSED (R56–R65)

### 7.1 🟢 R56 — Cost Movement Report
Source: `inventory`. Raw `cost_movements` ledger filtered by item/date/movement_type.
Columns: date, movement_type, source doc no, qty, unit_cost, running WACC, user.

### 7.2 🟢 R57 — Cost Method Comparison Report
Source: `inventory`. Side-by-side stock value under WAC/FIFO/LIFO/Last per item.
Columns: item, qty, value_wac, value_fifo, value_lifo, value_last, spread.

### 7.3 🟢 R58 — Item Lifecycle Report
Source: `items`. One row per item with purchases/sales/returns/transfers/lifetime stats.
Columns: purchase qty/value, sale qty/revenue, return qty, transfers, stock on hand, WAC, margin %.

### 7.4 🟢 R59 — Margin Drift / Cost-Price Lag Report
Source: `profit-loader`. Items where cost rose but sale price didn't.
Compares cost/margin between period A and current.

### 7.5 🟢 R60 — Inventory Turnover & Days-of-Stock Report
Source: `inventory`. Per item: avg daily sales, stock on hand, days of stock, turnover ratio.

### 7.6 🟢 R61 — Cashier Override / Discount Impact Report
Source: `users`/`audit`. Override frequency, discount %, revenue impact per cashier.

### 7.7 🟢 R62 — Customer Profitability Report
Source: `customers`. Revenue, gross profit, margin %, return rate per customer.

### 7.8 🟢 R63 — Supplier Reliability / Performance Report
Source: `suppliers`. Return rate, lead time, payment days, price stability per supplier.

### 7.9 🟢 R64 — Stock Adjustment Audit Report
Source: `audit`/`warehouses`. All manual stock adjustments with value impact.

### 7.10 🟢 R65 — Daily Owner Snapshot (Quick P&L)
Source: `net-profit`. Today vs yesterday vs same-day-last-week revenue, profit, expenses.

### 7.11 Reorder With Cost Forecast (extend R15)
Add: estimated cost to reorder at chosen cost method, preferred supplier last price.

---

## 7b. Cross-cutting report improvements

| Fix | Affects |
|---|---|
| Add `net_sales` column = gross − returns | All revenue-bearing reports |
| Date-filter the returns subqueries | salesByItem, marginByItem |
| Add returns to category-level reports | salesByCategory, marginByCategory |
| Subtract payments for partial-paid invoices | arAging, apAging, collectionEfficiency |
| Add opening_balance into aging buckets | arAging, apAging |
| Add date filter to shiftHistory | shiftHistory |
| Fix `total_items_sold` to use SUM(quantity) | salesByCashier |
| Add profit column to salesByCashier | salesByCashier |
| Add profit + returns to periodComparison | periodComparison |
| Add returns to customerStatement & customerLoyalty | accounts |
| Distinguish branch_receive vs purchase_receive in stock-movements | warehouses |
| Move total_expenses to footer in profitByCategory | profit |

---

## 7c. Costing PHASE 3.5 — Bug-fix-only sub-phase

Standalone PR: 15 cross-cutting bug fixes without introducing new reports or cost-method changes.

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

## 8. Costing PHASE 4 — Cleanup & Migration of "سجل تغييرات الأسعار"

After Phase 3:
- "تتبع صنف" tab → absorbed into unified Item Operations page
- "كل التغييرات" + "تجاوزات الفواتير" tabs → keep, simpler page now
- "تكرار التجاوزات" tab → replaced by R61 report
- "سلامة البيانات" tab → **delete entirely** (WACC drift impossible after cutover)

---

## 9. Execution order (proposed)

1. **Costing Phase 1** (cost ledger foundation) — non-breaking, parallel build
2. **Costing Phase 1.5** (smart-import bug fix, standalone, can ship today)
3. **Costing Phase 2** (cutover) — gated on validation script clean
4. **Costing Phase 3** (reports cost-method switching) — gated on Phase 2
5. **Costing Phase 3.5** (15 cross-cutting report bug fixes) — independent, can ship in parallel
6. **NEW R56–R65 reports** — gated on Phase 3
7. **Costing Phase 4 cleanup** — gated on everything above
8. **Unified Item Operations page** — separate plan, consumes R58 data

---

## 11. Owner's Period Statement (لوحة صاحب المحل)

### 11.1-11.10 Full Specification

The Owner Statement is a special report that shows 8 flat financial numbers:
1. 📦 قيمة المخزون (Inventory value)
2. 💰 الفلوس في الخزائن والبنوك (Cash in treasuries/banks)
3. 🧾 ذمم العملاء (AR)
4. 🧾 ذمم الموردين (AP)
5. 💸 المصروفات (Expenses)
6. 💵 الإيرادات الأخرى (Other revenues)
7. 🏦 المسحوبات (Withdrawals)
8. 💎 صافي الربح (Net profit)

Each row is drillable into a modal with full data. Supports save/lock/compare snapshots.

See full specification in `COSTING_AND_REPORTS_OVERHAUL_PLAN.md` Sections 11.1-11.10.

---

## 12. Unified Item Operations Page (بطاقة الصنف التشغيلية)

Replaces and consolidates: البحث التفصيلي بالأصناف, "تتبع صنف" tab, old ItemDetailPage.

### 12.1-12.10 Full Specification

- Routes: `/operations/items` and `/operations/items/:itemId`
- Left rail: master item list
- Right pane: item header + operations feed
- Operation type checkboxes: sales, purchases, sales-returns, purchase-returns, branch-transfers, opening-balance, price-changes, stock-movements, cost-ledger
- `<DocumentPreviewModal />` for inline preview

See full specification in `COSTING_AND_REPORTS_OVERHAUL_PLAN.md` Sections 12.1-12.10.

---

## 13. Resolved decisions (locked)

- ✅ **LIFO supported** — all 4 cost methods in scope
- ✅ **R58 feeds unified item operations page** — both ship
- ✅ **R57 (Cost Method Comparison)** — kept
- ✅ **Existing BTAA tabs are NOT deleted** — new page is additive
- ✅ **Phase 1.5 ships as standalone PR**
- ✅ **سجل تغييرات الأسعار** — see Section 14

---

## 14. سجل تغييرات الأسعار — minimal cleanup

Final tab set (3 tabs): تتبع صنف (kept + 🔗 link), كل التغييرات (kept), تجاوزات الفواتير (kept)
Removed: ~~تكرار التجاوزات~~ (→ R61 report), ~~سلامة البيانات~~ (→ deleted in Phase 4)

---

## 15. Smart Improvement Suggestions — Approved by Owner (2026-07-06)

### 15.1 S1 — Single Source of Truth for Config
**Decision:** ✅ **Delete `reportsCenterConfig.js`**. Server serves config via API.
**Solution:** `GET /api/reports/system-config` endpoint → client fetches on mount → delete `reportsCenterConfig.js`.
**Cost:** Medium.

### 15.2 S2 — Eliminate the Two-System Duality
**Decision:** ✅ **Full migration.** Remove legacy `reports[]`, `slugSourceMap`, `clsMap`.
**Solution:** Map ~35+ legacy slugs, create missing classifications, remove maps.
**Cost:** High.

### 15.3 S3 — Server-Side Pagination and Filtering
**Decision:** ✅ **Full fix.** Add LIMIT/OFFSET to all queries. Remove `applyRowFilters`.
**Solution:** LIMIT/OFFSET in all aggregate queries, pass page/pageSize, SQL WHERE instead of post-filter.
**Cost:** High.

### 15.4 S4 — Normalized Return Shapes
**Decision:** ✅ **Standard shape.** All functions return `{ rows, meta }`.
**Solution:** Normalization layer in index.js, fix profitByCategory.
**Cost:** Low.

### 15.5 S5 — Report Descriptions for ALL Reports
**Decision:** ✅ **All 105 reports.** Write Arabic descriptions for every slug.
**Solution:** Add to REPORT_DESCRIPTIONS, show as tooltips.
**Cost:** Very low.

### 15.6 S6 — Smart Default Filters Per Classification
**Decision:** ✅ **Full review.** Review all ~93 classifications. Keep only relevant filters.
**Solution:** Per-classification dimension audit, remove irrelevant filters.
**Cost:** Medium.

### 15.7 S7 — Report Caching Layer
**Decision:** ✅ **Add caching.** In-memory cache with TTL for heavy aggregate queries.
**Solution:** `node-cache` or Map with 30-60s TTL, `?nocache=true` busting.
**Cost:** Low.

### 15.8 S8 — CSV Export Support
**Decision:** ✅ **Add CSV.** With Arabic UTF-8 BOM encoding.
**Solution:** `exportRowsToCsv()` → stream to response.
**Cost:** Very low.

### 15.9 S9 — Column Customization Persistence Verification
**Decision:** ✅ **Full verify + fix.** Ensure store methods are called on every column change.
**Solution:** Audit SourceWorkspacePage + ReportWorkspacePage, add store calls.
**Cost:** Low.

### 15.10 S10 — Theme System Migration
**Decision:** ✅ **Full theme migration.** Replace ALL hardcoded colors with CSS theme variables.
**Solution:** Per-file inventory fix (Phase 18 covers first pass), test with 6 themes.
**Cost:** Medium.

### 15.11 S11 — Streaming Export for Large Datasets
**Decision:** ✅ **Best practice streaming.** All formats stream to response. No temp files.
**Solution:** CSV → res.write(), Excel → workbook.write(res), PDF → doc.pipe(res).
**Cost:** Medium.

### 15.12 S12 — Automated Test Framework for Reports
**Decision:** ✅ **Full test suite.** Parameterized tests for queries + routes + exports.
**Solution:** Seed DB, test every query, integration tests, snapshot tests.
**Cost:** HIGH.

### 15.13 S13 — Report Generation History & Scheduling
**Decision:** ✅ **Full system.** Run-and-save + scheduled reports + comparison view.
**Solution:** `report_snapshots` table, node-cron scheduling, compare view.
**Cost:** High.

### 15.14 S14 — Chart Integration for Time-Series Reports
**Decision:** ✅ **Full chart integration.** Line/bar/pie for time-series reports.
**Solution:** Chart.js/Recharts, 5 key reports, table/chart toggle.
**Cost:** Medium.

### 15.15 S15 — Consistent Currency Formatting
**Decision:** ✅ **Settings-driven currency.** Centralized `formatMoney()` from `settings` table.
**Solution:** Read currency_symbol, decimal_places from settings; remove hardcoded "ج.م".
**Cost:** Low.

### 15.16 Execution Priority

**Wave 1 — Foundation (do first, enables everything else):**
1. **S12** — Test framework (safety net)
2. **S3** — Server-side pagination (critical for reliability)
3. **S4** — Normalized return shapes (fixes P16 crash)

**Wave 2 — Config & Architecture:**
4. **S1** — Single config source (delete reportsCenterConfig.js)
5. **S2** — Eliminate two-system duality
6. **S6** — Smart default filters

**Wave 3 — User-Facing Features:**
7. **S10** — Theme migration
8. **S8** — CSV export
9. **S5** — Report descriptions
10. **S15** — Currency formatting

**Wave 4 — Performance & Polish:**
11. **S7** — Report caching
12. **S9** — Column persistence verification
13. **S11** — Streaming export

**Wave 5 — Advanced Features:**
14. **S14** — Chart integration
15. **S13** — Report history/scheduling

---

# PART III: UNIFIED EXECUTION PRIORITY

This section merges all phases from Parts I and II into a single, deduplicated execution roadmap.

## Wave 0: Cost Ledger Foundation (Costing Phase 1 + 1.5 + 2)
1. [ ] Migration 092 — cost_movements table
2. [ ] Migration 093 — backfill from existing data
3. [ ] New service: `costLedger.js` with deriveWACC/FIFO/LIFO/LastCost
4. [ ] Validation script: `validate-cost-ledger.js`
5. [ ] Smart import bug fix (standalone — ship immediately)
6. [ ] Cutover: replace recomputeWACCForItem with ledger-backed wrapper
7. [ ] Delete dead code: recalculateWACC, wacc_drift check
8. [ ] Migration 094 — add cost_fifo/cost_lifo snapshot columns

## Wave 1: Immediate Bug Fixes (Audit Phase 10 + 14 + 15 + 16 + 23)
1. [ ] Phase 10: Fix SQL silent fallback pattern (P11 — CRITICAL)
2. [ ] Phase 14: Fix route handler bugs (P17-P21, P29)
3. [ ] Phase 15: Fix query function bugs (P22-P28)
4. [ ] Phase 16: Fix client i18n bug (P34)
5. [ ] Phase 23: Fix PDF duplicate rectangles (P30)
6. [ ] Costing Phase 3.5: 15 report logic bug fixes (B1-B18)

## Wave 2: Registry & Config Cleanup (Audit Phase 1-9 + 11-13 + 17)
1. [ ] Phase 1: Fix supportsScope (38 classifications)
2. [ ] Phase 2: Fix dimension vs inline filter duplication (10+ sources)
3. [ ] Phase 3: Fix hasProfit mismatches (3 classifications)
4. [ ] Phase 4: Fix erroneous dimension keys (2 classifications)
5. [ ] Phase 5: Fix client config corruption (3 corrupted sources)
6. [ ] Phase 6: Fix missing source classifications (expiry, cheques)
7. [ ] Phase 7: Fix specific bugs (reorder, cost-movements i18n, etc.)
8. [ ] Phase 8: Reduce label duplication
9. [ ] Phase 9: Evaluate useless reports
10. [ ] Phase 11: Fix backward compat mappings (P12)
11. [ ] Phase 12: Fix SQL/column key mismatches (P13+P14)
12. [ ] Phase 13: Clean up internal exports (P15)
13. [ ] Phase 17: Deep fix corrupted client config (P3)

## Wave 3: Cost-Method Switching (Costing Phase 3 + 4)
1. [ ] Populate cost snapshots at sale time (invoiceService.js)
2. [ ] Update getCostColumn helpers for FIFO/LIFO
3. [ ] Valuation report 2-step FIFO/LIFO mechanism
4. [ ] Frontend: Cost method selector on 20 reports
5. [ ] Phase 4: Cleanup سجل تغييرات الأسعار (remove tabs, delete IntegrityPanel)

## Wave 4: Architecture Improvements (Audit Phase 25 — S1, S2, S6, S12)
1. [ ] S12: Test framework (foundation for safe refactoring)
2. [ ] S1: Single config source (API-served, delete client copy)
3. [ ] S2: Eliminate two-system duality
4. [ ] S6: Smart default filters

## Wave 5: Theme & UX Polish (Audit Phase 18 + 19 + 22 + 24 + S5, S8, S10, S15)
1. [ ] Phase 18: Theme system overhaul (5 files, 50+ changes)
2. [ ] Phase 19: Owner Statement page fixes (15 bugs)
3. [ ] Phase 22: Add missing export filters
4. [ ] Phase 24: Add report descriptions (91 reports)
5. [ ] S5: Report descriptions tooltips
6. [ ] S8: CSV export
7. [ ] S10: Theme migration (Phase 18 covers first pass)
8. [ ] S15: Currency formatting

## Wave 6: Performance (S3, S7, S9, S11)
1. [ ] S3: Server-side pagination
2. [ ] S7: Report caching
3. [ ] S9: Column persistence verification
4. [ ] S11: Streaming export

## Wave 7: Advanced Features (S13, S14 + New Reports R56-R65)
1. [ ] S14: Chart integration for time-series
2. [ ] R56: Cost Movement Report
3. [ ] R57: Cost Method Comparison
4. [ ] R58: Item Lifecycle Report
5. [ ] R59: Margin Drift Report
6. [ ] R60: Inventory Turnover Report
7. [ ] R61: Cashier Override Report
8. [ ] R62: Customer Profitability Report
9. [ ] R63: Supplier Reliability Report
10. [ ] R64: Stock Adjustment Audit
11. [ ] R65: Daily Owner Snapshot
12. [ ] S13: Report history & scheduling

## Wave 8: Owner Statement + Unified Item Operations
1. [ ] Owner Statement (Section 11) — full implementation
2. [ ] Unified Item Operations Page (Section 12) — full implementation
3. [ ] DocumentPreviewModal shared component
4. [ ] سجل تغييرات الأسعار cleanup (Section 14)
