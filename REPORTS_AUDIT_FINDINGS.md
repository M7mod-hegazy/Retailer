# تقارير النظام - تقرير تدقيق شامل
# Reports System — Comprehensive Audit Findings

> Generated: 2026-07-06 (updated with deep-dive findings from 6 parallel agents)
> Status: Read-only audit — no changes made
> Total findings: 43 problems (P1-P33) + 43 cross-cutting findings (F1-F43)
> Total fix phases: 25 phases (Phase 1-25)
> File size: ~4100+ lines
> Scope: All 20 sources, 100+ classifications, all columns, all filters, all query SQL
> Status: Read-only audit — no changes made

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
| P30 | **PDFV3 Duplicate Overlapping Rectangles** — Title background rectangle drawn twice (`.rect().fill()` + `.roundedRect().fill()`), rendering ~2x darker than intended `#f8fafc` | **LOW** | `exportService.js:437-439` |
| P31 | **4 Truly Orphan Reports** — `cheque-listing`, `bank-transactions`, `bank-summary`, `employee-adjustments` have dispatcher functions and column definitions but are INACCESSIBLE from ANY public API endpoint (no classification, no backwardCompatMap, no legacy report entry) | **HIGH** | These 4 report slugs |
| P32 | **5 Duplicate Legacy Report IDs** — R66-R70 each appear twice in legacy reports array (once for payment-flow, once for customer/supplier reports). Could cause React key conflicts | **LOW** | Legacy reports array |
| P33 | **87% of Reports Missing Descriptions** — 91 of 105 reports have no description text in REPORT_DESCRIPTIONS | **LOW** | All reports |

---

## 2. Architecture Overview

### File Map

| File | Role |
|---|---|
| `server/src/reports/registry.js` | **PRIMARY**: 20 sources, 100+ classifications, filter dimensions pool |
| `server/src/reports/columns.js` | REPORT_COLUMN_KEYS (column order), REPORT_EXTRA_KEYS (hidden columns), AR_LABELS, type inference |
| `server/src/reports/helpers.js` | SQL helpers: date filters, cost columns, payment filter |
| `server/src/reports/index.js` | Dispatcher: slug → query function mapping |
| `server/src/reports/queries/*.js` | 17 query files with actual SQL |
| `server/src/routes/report.routes.js` | All API endpoints, filtering logic |
| `client/src/pages/reports/reportsCenterConfig.js` | Client-side config: SOURCES, CATEGORIES, SCOPE_OPTIONS, CLASSIFICATIONS, PREVIEW_COLUMNS, GHOST_ROWS |
| `client/src/pages/reports/reportsCenterParts.jsx` | UI components: ScopeSelector, DimensionFilter, ColumnToggleList |
| `client/src/pages/reports/SourceWorkspacePage.jsx` | New workspace page (sourceKey/classificationId/dataMode) |
| `client/src/pages/reports/ReportWorkspacePage.jsx` | Old workspace page (reportSlug) |

### Two Parallel Systems

**System 1 — Legacy (slug-based):**
- `REPORT_REGISTRY.reports[]` — 70+ report objects with `id`, `slug`, filters
- Accessed via `/api/reports/run/:slug`
- UI: `ReportWorkspacePage.jsx`

**System 2 — New (source-classification):**
- `REPORT_REGISTRY.classifications{}` — grouped by source key
- Accessed via `/api/reports/source/:sourceKey/run?classificationId=...&dataMode=...`
- UI: `SourceWorkspacePage.jsx`

**Backward compat:**
- `slugSourceMap` + `clsMap` map old slugs → source + classification + dataMode
- The route handler resolves via `resolveQuerySlug()` which first tries new system, then falls back

### النطاق التحليلي (Analytical Scope) — The Core Problem

The `SCOPE_OPTIONS` in `reportsCenterConfig.js`:
```
sales:     ["الكل", "فئة منتجات", "منتج واحد", "عميل"]
purchases: ["الكل", "فئة منتجات", "منتج واحد", "مورد"]
items:     ["الكل", "فئة منتجات", "منتج واحد", "مخزن"]
```

When a scope like "فئة منتجات" is selected, it sets `category_id` in API params. Meanwhile, `dimensions: ["category_id"]` ALSO adds a "الفئة" lookup filter. **The user can filter by category in TWO places that do the exact same thing.**

---

## 3. Per-Source Audit

### 3.1 sales

**Source key:** `sales`
**Category:** sales
**Filter dimensions pool:** category_id, item_id, customer_id, cashier_id, status, payment_type

---

#### Classification: daily-summary
| Field | Value |
|---|---|
| ID | `daily-summary` |
| Slug | `daily-sales` |
| Labels | الملخص اليومي للمبيعات / Daily sales summary |
| Modes | summary only |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["payment_type", "cashier_id"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["daily-sales"]):
`date`, `invoice_count`, `selling_total`, `total_discount`, `additions_amount`, `gross_sales`, `total_cost`, `returns_amount`, `returns_count`, `net_sales`, `gross_profit`, `avg_invoice_value`, `margin_percent`

*Hidden by default:* `avg_invoice_value`, `margin_percent`

**SQL query:** `queries/sales.js → dailySales()` — groups by `DATE(i.created_at)`

**Findings:**
- 🔴 **supportsScope: true** but the scope options ("فئة منتجات", "منتج واحد") are **not relevant** for a daily summary — this aggregates ALL sales by date, category/product filters should not apply here
- ✅ Dimensions `["payment_type", "cashier_id"]` are sensible for a summary
- ✅ hasProfit: true — cost columns are correctly included in SQL
- No inline filters (clean)

---

#### Classification: detailed
| Field | Value |
|---|---|
| ID | `detailed` |
| Slug | `detailed-sales` |
| Labels | المبيعات التفصيلية / Detailed sales |
| Modes | detailed, summary |
| supportsDates | ✅ |
| hasProfit | ❌ (false) |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id", "customer_id", "cashier_id", "status", "payment_type"]` |
| Filters (inline) | status (select), payment_type (select) |

**Columns** (REPORT_COLUMN_KEYS["detailed-sales"]):
`invoice_no`, `date`, `customer_name`, `cashier`, `payment_type`, `status`, `subtotal`, `discount`, `additions_amount`, `total`, `item_count`, `payment_breakdown`, `customer_id`

*Hidden by default:* `customer_id` (internal key)

**SQL query:** `queries/sales.js → detailedSales()`

**Findings:**
- 🔴 **supportsScope: true** + `dimensions: ["category_id", "item_id", "customer_id"]` = **TRIPLE OVERLAP**. The scope offers category/product/customer, AND the dimension filters offer the same lookups. The inline `filters` also have status + payment_type. The user sees 3 ways to filter by category.
- 🔴 **hasProfit: false** — but this report has `total_cost` in its column list and the query computes costs. Either hasProfit should be true, or the cost columns should be removed.
- 🔴 **Dimensions list is source's entire pool** — just copy-pasted, not thought through for this classification
- ❌ **payment_breakdown** column — this is a JSON/text field, not sure it renders well in a table
- `filters` inline duplicates `status` and `payment_type` which are already in `dimensions` — the new system uses `dimensions` but the legacy system needs inline filters; this is the compat issue

---

#### Classification: by-item
| Field | Value |
|---|---|
| ID | `by-item` |
| Slug | `sales-by-item` |
| Labels | مبيعات حسب الصنف / Sales by item |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id", "customer_id", "cashier_id", "status", "payment_type"]` |
| Filters (inline) | category_id (lookup), item_id (lookup) |

**Columns** (REPORT_COLUMN_KEYS["sales-by-item"]):
`item_code`, `item_name`, `category_name`, `quantity_sold`, `revenue`, `total_discount`, `cost`, `returns_amount`, `returns_cost`, `gross_profit`, `margin_percent`, `avg_unit_price`, `selling_total`, `avg_unit_cost`, `wacc`

*Hidden by default:* `selling_total`, `avg_unit_cost`, `wacc`

**SQL query:** `queries/sales.js → salesByItem()`

**Findings:**
- 🔴 **supportsScope: true** with `dimensions: ["category_id", "item_id", "customer_id", ...]` = **OVERLAP**. Scope already lets you pick a category or product; the dimensions add the SAME lookups again. The inline filters ALSO have category_id + item_id. **Three ways to filter by category on the same report.**
- 🔴 Dimensions list is the FULL source pool — `customer_id`, `cashier_id`, `status`, `payment_type` have nothing to do with "by item" grouping
- ✅ hasProfit: true — correct, profit columns are present
- ❌ `returns_cost` column — does the SQL actually return this? The query has `COALESCE(SUM(srl.quantity * costCol), 0) AS return_cost` — yes but it's computed in a subquery
- ✅ `wacc` is shown but hidden by default — good

---

#### Classification: by-category
| Field | Value |
|---|---|
| ID | `by-category` |
| Slug | `sales-by-category` |
| Labels | مبيعات حسب الفئة / Sales by category |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "customer_id", "cashier_id", "status", "payment_type"]` |
| Filters (inline) | category_id (lookup) |

**Columns** (REPORT_COLUMN_KEYS["sales-by-category"]):
`category_name`, `item_count`, `quantity_sold`, `revenue`, `total_discount`, `cost`, `returns_amount`, `returns_cost`, `gross_profit`, `margin_percent`, `selling_total`, `avg_unit_cost`

*Hidden by default:* `selling_total`, `avg_unit_cost`

**SQL query:** `queries/sales.js → salesByCategory()`

**Findings:**
- 🔴 **supportsScope: true** with `dimensions: ["category_id", ...]` + inline `filters: [{ category_id }]` = **TRIPLE category filter**
- 🔴 `customer_id`, `cashier_id`, `status`, `payment_type` in dimensions are unnecessary for a "by category" report
- 🔴 The **scope itself** ("فئة منتجات") is redundant when the whole report is by-category — picking a category via scope is the same as filtering by category, which the report already groups by

---

#### Classification: by-cashier
| Field | Value |
|---|---|
| ID | `by-cashier` |
| Slug | `sales-by-cashier` |
| Labels | مبيعات حسب الكاشير / Sales by cashier |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ (false) |
| Dimensions | `["cashier_id", "customer_id", "payment_type", "status"]` |
| Filters (inline) | cashier_id (lookup) |

**Columns** (REPORT_COLUMN_KEYS["sales-by-cashier"]):
`cashier`, `invoice_count`, `cancelled_count`, `total_sales`, `total_discount`, `avg_invoice_value`, `total_items_sold`, `total_cost`, `returns_handled`, `returns_cost`, `net_sales`, `gross_profit`, `margin_percent`, `items_per_invoice`

*Hidden by default:* `margin_percent`, `items_per_invoice`

**SQL query:** `queries/sales.js → salesByCashier()`

**Findings:**
- ✅ supportsScope: false — correct, the scope concept doesn't apply
- ❌ `hasProfit: false` — but the columns include `total_cost`, `returns_cost`, `gross_profit`, `margin_percent`! The SQL computes costs. **hasProfit should be true** or these columns should be hidden.
- ❌ `customer_id`, `payment_type`, `status` in dimensions — not relevant for a "by cashier" report
- ✅ Inline filter is just `cashier_id` — good

---

#### Classification: by-payment
| Field | Value |
|---|---|
| ID | `by-payment` |
| Slug | `sales-by-payment` |
| Labels | مبيعات حسب طريقة الدفع / Sales by payment |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["payment_type", "customer_id", "cashier_id", "status"]` |
| Filters (inline) | payment_type (select) |

**Columns** (REPORT_COLUMN_KEYS["sales-by-payment"]):
`payment_type`, `invoice_count`, `total_sales`, `total_discount`, `returns_amount`, `avg_transaction`, `net_sales`, `pct_of_sales`

*Hidden by default:* `net_sales`, `pct_of_sales`

**SQL query:** `queries/sales.js → salesByPayment()`

**Findings:**
- 🔴 **supportsScope: true** — **WRONG**. The scope options (category/product/customer) don't make sense for a "by payment type" report. Should be `false`.
- 🔴 `customer_id`, `cashier_id`, `status` in dimensions — irrelevant for payment-type grouping
- ✅ Inline filter is just `payment_type` — sensible
- ❌ hasProfit: false — correct, no profit columns in the column list

---

#### Classification: heatmap
| Field | Value |
|---|---|
| ID | `heatmap` |
| Slug | `sales-heatmap` |
| Labels | خريطة كثافة المبيعات / Sales heatmap |
| Modes | summary only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "customer_id", "payment_type"]` |
| Filters (inline) | category_id (lookup) |

**Columns** (REPORT_COLUMN_KEYS["sales-heatmap"]):
`weekday_name`, `hour_slot`, `invoice_count`, `total_sales`, `avg_sale`, `weekday_num`, `customer_id`

*Hidden by default:* `customer_id` (internal key)

**SQL query:** `queries/sales.js → salesHeatmap()`

**Findings:**
- 🔴 **supportsScope: true** — questionable. The heatmap shows sales density by day/hour. Category/product scope doesn't really match the heatmap concept. But could be argued.
- ❌ `customer_id` appears in columns but is hidden as internal — the SQL doesn't even select customer_id for heatmap... wait, let me check. The heatmap SQL groups by weekday/hour, not by customer. Actually looking at REPORT_COLUMN_KEYS it lists `customer_id` but the query probably doesn't return it. This is a **ghost column** — it'll show as empty.
- ❌ `customer_id` in dimensions — not useful for heatmap
- ✅ Inline filter is just `category_id` — reasonable

---

#### Classification: period-compare
| Field | Value |
|---|---|
| ID | `period-compare` |
| Slug | `period-comparison` |
| Labels | مقارنة الفترات / Period comparison |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id", "customer_id", "cashier_id", "status", "payment_type"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["period-comparison"]):
`period`, `date`, `invoice_count`, `total_sales`, `total_discount`, `returns_amount`, `net_sales`, `total_cost`, `gross_profit`, `margin_percent`, `avg_invoice_value`

*Hidden by default:* `margin_percent`, `avg_invoice_value`

**SQL query:** `queries/sales.js → periodComparison()`

**Findings:**
- 🔴 **supportsScope: true** — scope and dimensions are the FULL source pool, creating massive overlap
- ❌ `hasProfit: false` — but columns include `total_cost`, `gross_profit`, `margin_percent`! hasProfit should be true
- ❌ **No inline filters** — yet `dimensions` has 6 entries. This means the dimension filter section shows 6 different lookup/select widgets. Too many.
- 🔴 **Full pool copied as dimensions** — no thought about what filters a "period comparison" actually needs

---

#### Classification: discounts
| Field | Value |
|---|---|
| ID | `discounts` |
| Slug | `discount-analysis` |
| Labels | تحليل الخصومات / Discount analysis |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id", "customer_id", "cashier_id", "payment_type", "status"]` |
| Filters (inline) | payment_type (select) |

**Columns** (REPORT_COLUMN_KEYS["discount-analysis"]):
`section`, `payment_type`, `discount_range`, `invoice_count`, `total_discount`, `avg_discount`, `avg_discount_percent`, `total_sales`

*Hidden by default:* none

**SQL query:** `queries/sales.js → discountAnalysis()`

**Findings:**
- 🔴 **supportsScope: true** — scope (category/product/customer) overlaps with dimensions' category_id, item_id, customer_id
- 🔴 Dimensions are the FULL pool again — `status` has nothing to do with discount analysis
- ❌ `hasProfit: false` — correct, no profit columns
- The SQL returns `data.by_payment` and `data.by_range` structured sections, then `normalizeStructuredReport` flattens them. This is a special case.

---

#### Classification: cashier-override-impact
| Field | Value |
|---|---|
| ID | `cashier-override-impact` |
| Slug | `cashier-override-impact` |
| Labels | أثر تجاوزات الكاشير / Cashier override impact |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ❌ (false) |
| Dimensions | `["cashier_id"]` |
| Filters (inline) | cashier_id (lookup) |

**Columns** (REPORT_COLUMN_KEYS["cashier-override-impact"]):
`cashier`, `override_count`, `price_downs`, `price_ups`, `estimated_revenue_impact`, `avg_diff_pct`, `discount_invoice_count`, `total_header_discount`, `avg_discount_pct`, `cashier_id`

*Hidden by default:* `cashier_id` (internal key)

**SQL query:** `queries/sales.js → cashierOverrideImpact()`

**Findings:**
- ✅ supportsScope: false — correct
- ✅ Dimensions are minimal (`["cashier_id"]`)
- ✅ Inline filter is just `cashier_id` — good
- ✅ hasProfit: true — consistent
- **Clean classification. No issues.**

---

#### Classification: margin
| Field | Value |
|---|---|
| ID | `margin` |
| Slug | `margin-by-item` |
| Labels | هامش الربح حسب الصنف / Margin by item |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id", "customer_id", "cashier_id"]` |
| Filters (inline) | category_id, item_id |

**Columns** (REPORT_COLUMN_KEYS["margin-by-item"]):
`item_code`, `item_name`, `category_name`, `quantity_sold`, `revenue`, `cost`, `returns_amount`, `gross_profit`, `margin_percent`, `selling_total`, `avg_unit_price`, `avg_unit_cost`, `wacc`

*Hidden by default:* `selling_total`, `avg_unit_price`, `avg_unit_cost`, `wacc`

**SQL query:** `queries/sales.js → marginByItem()` — but this classification maps to `profit-loader` source too via `clsMap["margin-by-item"] = { classification: "by-item", dataMode: "detailed" }`

**Findings:**
- 🔴 **supportsScope: true** + `dimensions: ["category_id", "item_id", ...]` + inline filters `category_id`, `item_id` = **TRIPLE OVERLAP**. Category filter appears in scope, in dimension filters, and in inline filters.
- ❌ `customer_id`, `cashier_id` in dimensions — not needed for margin by item
- ✅ hasProfit: true — correct

---

#### Classification: tax
| Field | Value |
|---|---|
| ID | `tax` |
| Slug | `vat` |
| Labels | ضريبة القيمة المضافة / VAT |
| Modes | detailed, summary |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["customer_id", "status", "payment_type", "tax_type"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["vat"]):
`tax_rate`, `tax_type_label`, `taxable_sales`, `vat_amount`, `invoice_count`, `customer_count`

*Hidden by default:* none

**SQL query:** `queries/tax.js → vat()` — groups by tax_rate, tax_type

**Findings:**
- 🔴 **supportsScope: true** — **WRONG**. Tax rates don't have categories or products. The scope options (category/product) are meaningless for VAT reports. Should be `false`.
- ✅ `dimensions` are reasonable for tax (`customer_id`, `status`, `payment_type`, `tax_type`)
- ✅ hasProfit: false — correct
- The summary mode shows `vat-filing-summary` which always returns 1 row (see below)

---

### 3.2 purchases

**Source key:** `purchases`
**Category:** purchases
**Filter dimensions pool:** supplier_id, category_id, item_id, status, payment_type

---

#### Classification: summary
| Field | Value |
|---|---|
| ID | `summary` |
| Slug | `purchase-summary` |
| Labels | ملخص المشتريات / Purchase summary |
| Modes | summary only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["supplier_id", "payment_type", "status"]` |
| Filters (inline) | supplier_id |

**Columns** (REPORT_COLUMN_KEYS["purchase-summary"]):
`date`, `purchase_count`, `distinct_suppliers`, `total_discount`, `additions_amount`, `total_purchases`, `avg_order_value`

*Hidden by default:* none

**SQL query:** `queries/purchases.js → purchaseSummary()`

**Findings:**
- 🔴 **supportsScope: true** — scope offers category/product/supplier. For a summary, category/product scope doesn't match the daily aggregation concept. Supplier filter is already in dimensions.
- ❌ `payment_type`, `status` in dimensions — borderline useful but adds clutter
- ✅ Inline filter is just `supplier_id` — good

---

#### Classification: detailed
| Field | Value |
|---|---|
| ID | `detailed` |
| Slug | `detailed-purchases` |
| Labels | المشتريات التفصيلية / Detailed purchases |
| Modes | detailed, summary |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["supplier_id", "category_id", "item_id", "status", "payment_type"]` |
| Filters (inline) | supplier_id, status, payment_type |

**Columns** (REPORT_COLUMN_KEYS["detailed-purchases"]):
`purchase_no`, `date`, `supplier_name`, `total`, `total_discount`, `additions_amount`, `status`, `payment_type`, `item_count`, `created_by`, `id`, `supplier_id`

*Hidden by default:* `id` (internal), `supplier_id` (internal)

**SQL query:** `queries/purchases.js → detailedPurchases()`

**Findings:**
- 🔴 **supportsScope: true** + `dimensions: ["category_id", "item_id"]` — scope category/product overlaps with dimensions
- 🔴 Full pool copied as dimensions again
- ❌ `hasProfit: false` — correct
- The inline `filters` have status + payment_type which duplicate their dimension entries

---

#### Classification: by-supplier
| Field | Value |
|---|---|
| ID | `by-supplier` |
| Slug | `purchases-by-supplier` |
| Labels | مشتريات حسب المورد / Purchases by supplier |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["supplier_id", "category_id", "item_id", "status", "payment_type"]` |
| Filters (inline) | supplier_id |

**Columns** (REPORT_COLUMN_KEYS["purchases-by-supplier"]):
`supplier_name`, `purchase_count`, `total_purchases`, `avg_order_value`, `returns_total`, `net_purchases`, `last_purchase_date`

*Hidden by default:* `net_purchases`

**SQL query:** `queries/purchases.js → purchasesBySupplier()`

**Findings:**
- 🔴 **supportsScope: true** — scope category/product doesn't make sense for "by supplier" grouping
- 🔴 Full pool copied as dimensions + inline `supplier_id` = duplicate
- ❌ `category_id`, `item_id`, `status`, `payment_type` in dimensions — irrelevant for supplier grouping

---

#### Classification: by-item
| Field | Value |
|---|---|
| ID | `by-item` |
| Slug | `purchases-by-item` |
| Labels | مشتريات حسب الصنف / Purchases by item |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["supplier_id", "category_id", "item_id", "status", "payment_type"]` |
| Filters (inline) | category_id, item_id, supplier_id |

**Columns** (REPORT_COLUMN_KEYS["purchases-by-item"]):
`item_code`, `item_name`, `quantity_purchased`, `total_cost`, `quantity_returned`, `returns_cost`, `net_quantity_purchased`, `net_total_cost`, `avg_unit_cost`, `distinct_suppliers`, `last_purchase_date`

*Hidden by default:* none

**SQL query:** `queries/purchases.js → purchasesByItem()`

**Findings:**
- 🔴 **supportsScope: true** + `dimensions: ["category_id", "item_id"]` + inline `category_id`, `item_id` = **TRIPLE OVERLAP**
- ❌ `supplier_id`, `status`, `payment_type` in dimensions — not needed for "by item"
- ✅ No hidden columns — but `returns_cost` exists in column list while the SQL might not return it

---

#### Classification: supplier-pricing
| Field | Value |
|---|---|
| ID | `supplier-pricing` |
| Slug | `supplier-pricing` |
| Labels | أسعار الموردين / Supplier pricing |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["supplier_id", "category_id", "item_id"]` |
| Filters (inline) | supplier_id, item_id |

**Columns** (REPORT_COLUMN_KEYS["supplier-pricing"]):
`supplier_name`, `item_name`, `unit_price`, `quantity`, `line_total`, `purchase_date`

*Hidden by default:* none

**SQL query:** `queries/purchases.js → supplierPricing()`

**Findings:**
- 🔴 **supportsScope: true** — scope category/product overlaps with dimensions
- 🔴 Dimensions: `category_id` is there but the report's whole point is item-level pricing. Category filter is overkill.
- 🔴 Inline `supplier_id` + `item_id` duplicates dimension entries
- **Could be simplified to just `supplier_id` + `item_id` filters only**

---

### 3.3 purchase-returns

**Source key:** `purchase-returns`
**Category:** purchases
**Filter dimensions pool:** supplier_id only

---

#### Classification: summary
| Field | Value |
|---|---|
| ID | `summary` |
| Slug | `purchase-returns-summary` |
| Labels | ملخص مرتجعات المشتريات / Purchase returns summary |
| Modes | summary only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["supplier_id"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["purchase-returns-summary"]):
`date`, `return_count`, `returns_total`, `supplier_count`, `items_returned`

*Hidden by default:* none

**SQL query:** `queries/purchases.js → purchaseReturnsSummary()`

**Findings:**
- ✅ supportsScope: false — good
- ✅ Dimensions minimal — good
- ✅ Clean classification

---

#### Classification: detailed
| Field | Value |
|---|---|
| ID | `detailed` |
| Slug | `purchase-returns` |
| Labels | مرتجعات المشتريات / Purchase returns |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["supplier_id"]` |
| Filters (inline) | supplier_id |

**Columns** (REPORT_COLUMN_KEYS["purchase-returns"]):
`return_ref`, `supplier_name`, `date`, `return_discount`, `return_increase`, `return_total`, `reason`, `refund_method`, `items_returned`, `id`

*Hidden by default:* `id` (internal key)

**SQL query:** `queries/purchases.js → purchaseReturnsDetailed()`

**Findings:**
- 🔴 **supportsScope: true** — scope options from purchases (category/product/supplier). For purchase returns, only supplier filter makes sense. Category/product scope is meaningless.
- ✅ Dimensions: just `supplier_id` — good
- The scope would add a category/product filter that the SQL doesn't support (no category join in the query)
- **suggestion:** set `supportsScope: false`

---

#### Classification: by-supplier
| Field | Value |
|---|---|
| ID | `by-supplier` |
| Slug | `purchase-returns-by-supplier` |
| Labels | مرتجعات المشتريات حسب المورد / Purchase returns by supplier |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["supplier_id"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["purchase-returns-by-supplier"]):
`supplier_name`, `return_count`, `returns_total`, `last_return_date`

*Hidden by default:* none

**SQL query:** `queries/purchases.js → purchaseReturnsBySupplier()`

**Findings:**
- ✅ supportsScope: false — good
- ✅ Clean
- ❌ **BUT**: `supplier_id` is in `dimensions` but there's no inline filter. With `dimensions: ["supplier_id"]` and no inline filter, the new system should show the dimension filter. Let me verify... yes, `getEnabledFilterDimensions` creates filters from `dimensions` using the pool. So a supplier lookup filter will appear.
- **Note:** This classification exists on server but needs its **client-side UI entry** in reportsCenterConfig.js (currently missing for the 4 summary reports)

---

### 3.4 sales-returns

**Source key:** `sales-returns`
**Category:** sales
**Filter dimensions pool:** customer_id only

---

#### Classification: summary
| Field | Value |
|---|---|
| ID | `summary` |
| Slug | `sales-returns-summary` |
| Labels | ملخص مرتجعات المبيعات / Sales returns summary |
| Modes | summary only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["customer_id"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["sales-returns-summary"]):
`date`, `return_count`, `returns_total`, `customer_count`, `items_returned`, `avg_return_value`

*Hidden by default:* `avg_return_value`

**SQL query:** probably in `queries/sales.js` — needs verification

**Findings:**
- ✅ supportsScope: false — good
- ✅ Clean
- ❌ **Missing from client config** — this classification and its 3 siblings (sales-returns-summary, sales-returns-by-customer, purchase-returns-summary, purchase-returns-by-supplier) are defined in server but have no client UI entry in reportsCenterConfig.js

---

#### Classification: detailed
| Field | Value |
|---|---|
| ID | `detailed` |
| Slug | `sales-returns` |
| Labels | مرتجعات المبيعات / Sales returns |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["customer_id"]` |
| Filters (inline) | customer_id |

**Columns** (REPORT_COLUMN_KEYS["sales-returns"]):
`return_ref`, `invoice_no`, `date`, `customer_name`, `handled_by`, `return_discount`, `return_increase`, `return_total`, `reason`, `refund_method`, `items_returned`, `id`, `customer_id`

*Hidden by default:* `id` (internal), `customer_id` (internal)

**SQL query:** `queries/sales.js → salesReturns()`

**Findings:**
- 🔴 **supportsScope: true** — scope options (category/product/customer). Category/product are meaningless for returns which reference invoices, not products grouped by category.
- ✅ Dimensions: just `customer_id` — good
- **suggestion:** set `supportsScope: false`

---

#### Classification: by-customer
| Field | Value |
|---|---|
| ID | `by-customer` |
| Slug | `sales-returns-by-customer` |
| Labels | مرتجعات المبيعات حسب العميل / Sales returns by customer |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["customer_id"]` |
| Filters (inline) | customer_id |

**Columns** (REPORT_COLUMN_KEYS["sales-returns-by-customer"]):
`customer_name`, `return_count`, `returns_total`, `avg_return_value`, `last_return_date`

*Hidden by default:* none

**SQL query:** — needs verification

**Findings:**
- ✅ supportsScope: false — good
- ❌ `dimensions: ["customer_id"]` + inline `filters: [{ customer_id }]` — **duplicate**: the filter appears in both dimensions and inline filters. The new system will show it twice.
- **suggestion:** remove from inline `filters`, let `dimensions` handle it

---

### 3.5 suppliers

**Source key:** `suppliers`
**Category:** accounts
**Filter dimensions pool:** supplier_id only

---

#### Classification: balance-list
| Field | Value |
|---|---|
| ID | `balance-list` |
| Slug | `supplier-balance-list` |
| Labels | قائمة أرصدة الموردين / Supplier balance list |
| Modes | detailed only |
| supportsDates | ❌ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["supplier_id"]` |
| Filters (inline) | supplier_id |

**Columns** (REPORT_COLUMN_KEYS["supplier-balance-list"]):
`supplier_name`, `phone`, `balance`, `balance_label`

*Hidden by default:* none

**SQL query:** `queries/inventory.js → supplierBalanceList()`

**Findings:**
- ✅ Clean classification
- ❌ `dimensions: ["supplier_id"]` + inline `filters: [{ supplier_id }]` = **duplicate**. Remove from one place.

---

#### Classification: statement
| Field | Value |
|---|---|
| ID | `statement` |
| Slug | `supplier-statement` |
| Labels | كشف حساب مورد / Supplier statement |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["supplier_id"]` |
| Filters (inline) | supplier_id (required) |

**Columns** (REPORT_COLUMN_KEYS["supplier-statement"]):
`date`, `description`, `debit`, `credit`, `running_balance`, `item_name`, `quantity`, `unit_price`, `line_total`, `item_code`

*Hidden by default:* none (but `amount`, `item_code` in extra keys?)

**Findings:**
- ✅ Clean
- ✅ `supplier_id` has `required: true` — good, statement needs a specific supplier
- ❌ `dimensions: ["supplier_id"]` + inline `required: true` filter — **duplicate but might be intentional** since the required version needs to be in inline filters. The dimension pool version would not have `required`.

---

#### Classification: aging
| Field | Value |
|---|---|
| ID | `aging` |
| Slug | `ap-aging` |
| Labels | تقادم ذمم الموردين / AP aging |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["supplier_id"]` |
| Filters (inline) | supplier_id |

**Columns** (REPORT_COLUMN_KEYS["ap-aging"]):
`supplier_name`, `total_due`, `aging_0_30`, `aging_31_60`, `aging_61_90`, `aging_90_plus`, `overdue_amount`, `last_purchase_date`, `phone`, `purchase_count`

*Hidden by default:* `phone`, `purchase_count`

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate for `supplier_id`

---

#### Classification: purchases
| Field | Value |
|---|---|
| ID | `purchases` |
| Slug | `purchases-by-supplier` |
| Labels | مشتريات حسب المورد / Purchases by supplier |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["supplier_id"]` |
| Filters (inline) | supplier_id |

**Columns** (REPORT_COLUMN_KEYS["purchases-by-supplier"]):
(shared with purchases source)

**SQL query:** `queries/purchases.js → purchasesBySupplier()` — same as purchases source's by-supplier

**Findings:**
- 🔴 This classification duplicates the purchases source's `by-supplier` classification. It lives under BOTH `suppliers` and `purchases` sources.
- ❌ `supportsScope: true` — what scope makes sense for a specific supplier's purchases?
- ❌ `dimensions` + inline duplicate

---

#### Classification: returns
| Field | Value |
|---|---|
| ID | `returns` |
| Slug | `purchase-returns-by-supplier` |
| Labels | مرتجعات المشتريات حسب المورد / Purchase returns by supplier |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["supplier_id"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["purchase-returns-by-supplier"]):
(shared with purchase-returns source)

**Findings:**
- ✅ Clean — duplicates purchase-returns's `by-supplier`

---

#### Classification: reliability
| Field | Value |
|---|---|
| ID | `reliability` |
| Slug | `supplier-reliability` |
| Labels | موثوقية الموردين / Supplier reliability |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["supplier_id"]` |
| Filters (inline) | supplier_id |

**Columns** (REPORT_COLUMN_KEYS["supplier-reliability"]):
`supplier_name`, `total_purchases`, `purchase_count`, `return_rate_percent`, `avg_payment_days`, `avg_price_spread_percent`, `total_returns`, `return_count`, `last_purchase_date`, `phone`, `repeat_items`

*Hidden by default:* `phone`, `repeat_items`

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

### 3.6 customers

**Source key:** `customers`
**Category:** accounts
**Filter dimensions pool:** customer_id only

---

#### Classification: balance-list
| Field | Value |
|---|---|
| ID | `balance-list` |
| Slug | `customer-balance-list` |
| Labels | قائمة أرصدة العملاء / Customer balance list |
| Modes | detailed only |
| supportsDates | ❌ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["customer_id"]` |
| Filters (inline) | customer_id |

**Columns** (REPORT_COLUMN_KEYS["customer-balance-list"]):
`customer_name`, `phone`, `balance`, `balance_label`

*Hidden by default:* none

**SQL query:** `queries/inventory.js → customerBalanceList()`

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

#### Classification: statement
| Field | Value |
|---|---|
| ID | `statement` |
| Slug | `customer-statement` |
| Labels | كشف حساب عميل / Customer statement |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["customer_id"]` |
| Filters (inline) | customer_id (required) |

**Columns** (REPORT_COLUMN_KEYS["customer-statement"]):
`date`, `description`, `debit`, `credit`, `running_balance`, `item_name`, `quantity`, `unit_price`, `line_total`, `item_code`

*Hidden by default:* `amount`, `item_code`, `barcode` (from extra keys)

**Findings:**
- ✅ Clean
- ✅ `required: true` on customer_id — good

---

#### Classification: aging
| Field | Value |
|---|---|
| ID | `aging` |
| Slug | `ar-aging` |
| Labels | تقادم ذمم العملاء / AR aging |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["customer_id"]` |
| Filters (inline) | customer_id |

**Columns** (REPORT_COLUMN_KEYS["ar-aging"]):
`customer_name`, `total_due`, `aging_0_30`, `aging_31_60`, `aging_61_90`, `aging_90_plus`, `overdue_amount`, `last_invoice_date`, `phone`, `invoice_count`

*Hidden by default:* `phone`, `invoice_count`

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

#### Classification: top-customers
| Field | Value |
|---|---|
| ID | `top-customers` |
| Slug | `top-customers` |
| Labels | أفضل العملاء / Top customers |
| Modes | detailed, summary |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ❌ |
| Dimensions | `["customer_id"]` |
| Filters (inline) | customer_id |

**Columns** (REPORT_COLUMN_KEYS["top-customers"]):
`customer_name`, `total_sales`, `net_sales`, `gross_profit`, `margin_percent`, `avg_invoice_value`, `invoice_count`, `last_invoice_date`, `phone`, `returns_total`, `total_cost`

*Hidden by default:* `phone`, `returns_total`, `total_cost`

**Findings:**
- ✅ Clean
- ✅ hasProfit: true — correct
- ❌ `dimensions` + inline duplicate

---

#### Classification: collection-efficiency
| Field | Value |
|---|---|
| ID | `collection-efficiency` |
| Slug | `collection-efficiency` |
| Labels | كفاءة التحصيل / Collection efficiency |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["customer_id"]` |
| Filters (inline) | customer_id |

**Columns** (REPORT_COLUMN_KEYS["collection-efficiency"]):
`customer_name`, `total_billed`, `collected`, `collection_rate`, `outstanding`, `invoice_count`, `partially_paid_count`, `fully_paid_count`

*Hidden by default:* `partially_paid_count`, `fully_paid_count`

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

#### Classification: loyalty
| Field | Value |
|---|---|
| ID | `loyalty` |
| Slug | `customer-loyalty` |
| Labels | ولاء العملاء / Customer loyalty |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["customer_id"]` |
| Filters (inline) | customer_id |

**Columns** (REPORT_COLUMN_KEYS["customer-loyalty"]):
`customer_name`, `total_sales`, `invoice_count`, `avg_invoice_value`, `frequency_monthly`, `items_per_invoice`, `avg_discount_percent`, `returns_total`, `last_invoice_date`, `phone`, `first_invoice_date`, `days_since_last_purchase`

*Hidden by default:* `phone`, `first_invoice_date`, `days_since_last_purchase`

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

### 3.7 employees

**Source key:** `employees`
**Category:** audit
**Filter dimensions pool:** employee_id, deduction_type, bonus_type, status, tx_type

---

#### Classification: employee-list
| Field | Value |
|---|---|
| ID | `employee-list` |
| Slug | `employee-list` |
| Labels | قائمة الموظفين / Employee list |
| Modes | detailed only |
| supportsDates | ❌ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["employee_id"]` |
| Filters (inline) | employee_id |

**Columns** (REPORT_COLUMN_KEYS["employee-list"]):
`employee_name`, `job_title`, `salary`, `salary_period`, `working_days_per_month`, `daily_salary`, `active_deductions_total`, `active_bonuses_total`, `active_advances_balance`, `total_paid`, `created_at`, `status`

*Hidden by default:* none

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

#### Classification: employee-deductions
| Field | Value |
|---|---|
| ID | `employee-deductions` |
| Slug | `employee-deductions` |
| Labels | خصومات الموظفين / Employee deductions |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["employee_id", "deduction_type", "status"]` |
| Filters (inline) | employee_id, deduction_type, status |

**Columns** (REPORT_COLUMN_KEYS["employee-deductions"]):
`date`, `employee_name`, `deduction_type_label`, `amount`, `status`, `recurring_label`, `notes`, `completed_at`, `cancelled_at`, `created_by`, `id`, `created_at`, `deduction_type`, `is_recurring`

*Hidden by default:* `notes`, `created_by`, `deduction_type`, `is_recurring`

**Findings:**
- ✅ Clean — dimensions match the report's needs
- ❌ `dimensions` + inline filters are **duplicated**. Inline: employee_id, deduction_type, status. Dimensions: employee_id, deduction_type, status. The new system uses dimensions, legacy uses inline. **For the new system, remove inline filters.**

---

#### Classification: employee-bonuses
| Field | Value |
|---|---|
| ID | `employee-bonuses` |
| Slug | `employee-bonuses` |
| Labels | مكافآت الموظفين / Employee bonuses |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["employee_id", "bonus_type", "status"]` |
| Filters (inline) | employee_id, bonus_type, status |

**Columns** (REPORT_COLUMN_KEYS["employee-bonuses"]):
`date`, `employee_name`, `bonus_type_label`, `amount`, `status`, `recurring_label`, `notes`, `completed_at`, `cancelled_at`, `created_by`, `id`, `created_at`, `bonus_type`, `is_recurring`

*Hidden by default:* `notes`, `created_by`, `bonus_type`, `is_recurring`

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

#### Classification: employee-advances
| Field | Value |
|---|---|
| ID | `employee-advances` |
| Slug | `employee-advances` |
| Labels | سلف الموظفين / Employee advances |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["employee_id", "status"]` |
| Filters (inline) | employee_id, status |

**Columns** (REPORT_COLUMN_KEYS["employee-advances"]):
`date`, `employee_name`, `amount`, `remaining_balance`, `repaid_amount`, `installment_count`, `installment_amount`, `status`, `notes`, `created_by`, `id`, `created_at`

*Hidden by default:* `notes`, `created_by`

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

#### Classification: employee-payroll
| Field | Value |
|---|---|
| ID | `employee-payroll` |
| Slug | `employee-payroll` |
| Labels | كشوف رواتب الموظفين / Employee payroll |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["employee_id"]` |
| Filters (inline) | employee_id |

**Columns** (REPORT_COLUMN_KEYS["employee-payroll"]):
`date`, `employee_name`, `base_salary`, `total_bonuses`, `total_deductions`, `advance_deductions`, `net_salary`, `period_start`, `period_end`, `payment_method`, `description`, `settled_by`, `id`, `settled_at`

*Hidden by default:* `description`, `settled_by`

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

#### Classification: employee-full-history
| Field | Value |
|---|---|
| ID | `employee-full-history` |
| Slug | `employee-full-history` |
| Labels | السجل الكامل للموظف / Employee full history |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["employee_id", "tx_type"]` |
| Filters (inline) | employee_id, tx_type |

**Columns** (REPORT_COLUMN_KEYS["employee-full-history"]):
`date`, `employee_name`, `tx_type_label`, `amount`, `status`, `description`, `sub_type`, `ref_id`, `employee_id`

*Hidden by default:* `employee_id`, `sub_type`

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

### 3.8 installments

**Source key:** `installments`
**Category:** accounts
**Filter dimensions pool:** customer_id, status

---

#### Classification: plans
| Field | Value |
|---|---|
| ID | `plans` |
| Slug | `installment-plans` |
| Labels | خطط التقسيط / Installment plans |
| Modes | detailed, summary |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["customer_id", "status"]` |
| Filters (inline) | customer_id, status |

**Columns** (REPORT_COLUMN_KEYS["installment-plans"]):
`id`, `customer_name`, `total`, `paid_amount`, `remaining`, `down_payment`, `frequency`, `installment_count`, `installment_amount`, `due_date`, `status_label`, `remaining_pct`, `created_date`, `paid_at`

*Hidden by default:* none

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate
- ❌ **Client config corruption** — the installments CLASSIFICATIONS in reportsCenterConfig.js appear to be corrupted (array starts mid-line after employee entries)

---

#### Classification: collections
| Field | Value |
|---|---|
| ID | `collections` |
| Slug | `installment-collections` |
| Labels | تحصيلات التقسيط / Installment collections |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["customer_id", "status"]` |
| Filters (inline) | customer_id |

**Columns** (REPORT_COLUMN_KEYS["installment-collections"]):
`id`, `customer_name`, `installment_amount`, `method_name`, `due_date`, `paid_at`, `status_label`, `remaining`, `total`

*Hidden by default:* none

**Findings:**
- ✅ Clean
- ❌ `status` in dimensions but not in inline filters — inconsistent, but `status` may still show via dimension filter
- ❌ `dimensions` + inline duplicate for `customer_id`

---

#### Classification: by-customer
| Field | Value |
|---|---|
| ID | `by-customer` |
| Slug | `installments-by-customer` |
| Labels | التقسيط حسب العميل / Installments by customer |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["customer_id", "status"]` |
| Filters (inline) | customer_id |

**Columns** (REPORT_COLUMN_KEYS["installments-by-customer"]):
`customer_name`, `plan_count`, `total_amount`, `total_paid`, `total_remaining`, `last_due_date`, `paid_count`, `pending_count`, `overdue_count`

*Hidden by default:* none

**Findings:**
- ✅ Clean
- ❌ `status` in dimensions but not inline — might be confusing

---

#### Classification: delinquent
| Field | Value |
|---|---|
| ID | `delinquent` |
| Slug | `installment-delinquent` |
| Labels | المتأخرات التقسيط / Installment delinquent |
| Modes | summary only |
| supportsDates | ❌ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["customer_id"]` |
| Filters (inline) | customer_id |

**Columns** (REPORT_COLUMN_KEYS["installment-delinquent"]):
`id`, `customer_name`, `total`, `remaining`, `installment_amount`, `due_date`, `days_overdue`, `overdue_bucket`

*Hidden by default:* none

**Findings:**
- ✅ Clean
- ❌ supportsDates: false — makes sense, delinquency is always "now"
- ❌ `dimensions` + inline duplicate

---

### 3.9 items

**Source key:** `items`
**Category:** inventory
**Filter dimensions pool:** category_id, item_id, warehouse_id

---

#### Classification: stock-levels
| Field | Value |
|---|---|
| ID | `stock-levels` |
| Slug | `stock-levels` |
| Labels | أرصدة المخزون / Stock levels |
| Modes | detailed, summary |
| supportsDates | ❌ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id", "warehouse_id"]` |
| Filters (inline) | category_id, item_id, warehouse_id |

**Columns** (REPORT_COLUMN_KEYS["stock-levels"]):
`item_code`, `item_name`, `category_name`, `warehouse_name`, `quantity`, `min_stock_qty`, `unit_name`, `total_value`, `stock_status`, `wacc`, `last_purchase_cost`, `sale_price`, `potential_revenue`, `warehouse_id`

*Hidden by default:* `wacc`, `last_purchase_cost`, `sale_price`, `potential_revenue`

**Findings:**
- 🔴 **supportsScope: true** — scope options (category/product/warehouse). THIS IS THE ONE SOURCE WHERE SCOPE ACTUALLY MAKES SENSE because the items SCOPE_OPTIONS are ["الكل", "فئة منتجات", "منتج واحد", "مخزن"] which matches category_id, item_id, warehouse_id exactly.
- ✅ BUT the scope filters overlap 1:1 with dimensions — this is the **canonical example** of the overlap problem. The scope lets you pick category/product/warehouse, and dimensions let you do the SAME THING.
- ❌ `dimensions` + inline = TRIPLE for category_id, item_id, warehouse_id
- **This is where the scope system should be the PRIMARY filter mechanism**, and `dimensions` should be removed (or limited to things scope doesn't cover)

---

#### Classification: valuation
| Field | Value |
|---|---|
| ID | `valuation` |
| Slug | `stock-valuation` |
| Labels | تقييم المخزون / Stock valuation |
| Modes | summary only |
| supportsDates | ❌ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id", "warehouse_id"]` |
| Filters (inline) | category_id, item_id, warehouse_id |

**Columns** (REPORT_COLUMN_KEYS["stock-valuation"]):
`item_code`, `name`, `category_name`, `warehouse_name`, `total_quantity`, `wacc`, `last_purchase_cost`, `purchase_price`, `total_value`, `sale_price`, `potential_revenue`, `item_id`, `warehouse_id`

*Hidden by default:* `sale_price`, `potential_revenue`

**Findings:**
- 🔴 Same scope/dimensions overlap as stock-levels
- 🔴 `name` column (not `item_name`) — inconsistency with other reports that use `item_name`

---

#### Classification: count-sheet
| Field | Value |
|---|---|
| ID | `count-sheet` |
| Slug | `count-sheet` |
| Labels | كشف الجرد / Count sheet |
| Modes | detailed only |
| supportsDates | ❌ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "warehouse_id"]` |
| Filters (inline) | category_id, warehouse_id |

**Columns** (REPORT_COLUMN_KEYS["count-sheet"]):
`item_code`, `item_name`, `barcode`, `category_name`, `warehouse_name`, `system_quantity`, `unit_name`, `warehouse_id`

*Hidden by default:* `warehouse_id`

**Findings:**
- 🔴 Same scope/dimensions overlap
- ✅ Dimensions are minimal (`category_id`, `warehouse_id` — no `item_id` which is correct for a count sheet)

---

#### Classification: reorder
| Field | Value |
|---|---|
| ID | `reorder` |
| Slug | `reorder` |
| Labels | إعادة الطلب / Reorder |
| Modes | summary only |
| supportsDates | ❌ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["category_id", "warehouse_id"]` |
| Filters (inline) | category_id, warehouse_id |

**Columns** (REPORT_COLUMN_KEYS["reorder"]):
`item_code`, `name`, `quantity`, `min_stock`, `unit_name`, `id`

*Hidden by default:* `id` (internal)

**Findings:**
- ✅ supportsScope: false — good
- ❌ `dimensions` + inline duplicate
- 🔴 **`min_stock`** — the SQL query `queries/inventory.js → reorder()` uses `it.min_stock_qty` but the column key says `min_stock`. These might be different columns. The SQL returns `min_stock_qty` but the REPORT_COLUMN_KEYS expects `min_stock`. **This is a bug** — the column will show empty because the SQL doesn't alias `min_stock_qty AS min_stock`. (The helper does labelForKey("min_stock") which exists in AR_LABELS as "الحد الأدنى للمخزون")

---

#### Classification: expiry
| Field | Value |
|---|---|
| ID | `expiry` |
| Slug | `expiry` |
| Labels | تواريخ الصلاحية / Expiry |
| Modes | detailed, summary |
| supportsDates | ❌ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["item_id", "warehouse_id", "category_id"]` |
| Filters (inline) | item_id, warehouse_id |

**Columns** (REPORT_COLUMN_KEYS["expiry"]):
`batch_no`, `item_code`, `item_name`, `quantity`, `expiry_date`, `cost_price`, `days_until_expiry`, `expiry_status`

*Hidden by default:* none

**Findings:**
- ✅ supportsScope: false — good
- ❌ `category_id` in dimensions but not in inline filters — the dimension system will still show it via pool lookup
- ❌ `dimensions` + inline partial overlap

---

#### Classification: slow-moving
| Field | Value |
|---|---|
| ID | `slow-moving` |
| Slug | `slow-moving` |
| Labels | الأصناف بطيئة الحركة / Slow moving items |
| Modes | detailed, summary |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id", "warehouse_id"]` |
| Filters (inline) | category_id, item_id, warehouse_id |

**Columns** (REPORT_COLUMN_KEYS["slow-moving"]):
`item_code`, `item_name`, `category_name`, `stock_quantity`, `cost_price`, `total_value`, `potential_revenue`, `potential_profit`, `last_sale_date`

*Hidden by default:* `potential_profit`

**Findings:**
- 🔴 Same scope/dimensions overlap
- ❌ `dimensions` + inline = TRIPLE

---

#### Classification: aging (inventory aging)
| Field | Value |
|---|---|
| ID | `aging` |
| Slug | `inventory-aging` |
| Labels | أعمار المخزون / Inventory aging |
| Modes | detailed, summary |
| supportsDates | ❌ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id", "warehouse_id"]` |
| Filters (inline) | category_id, item_id, warehouse_id |

**Columns** (REPORT_COLUMN_KEYS["inventory-aging"]):
`item_code`, `item_name`, `quantity`, `wacc`, `total_value`, `last_movement_date`, `days_since_last_movement`, `aging_bucket`

*Hidden by default:* none

**Findings:**
- 🔴 Same scope/dimensions overlap

---

#### Classification: dead-stock
| Field | Value |
|---|---|
| ID | `dead-stock` |
| Slug | `dead-stock` |
| Labels | المخزون الراكد / Dead stock |
| Modes | detailed, summary |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id", "warehouse_id"]` |
| Filters (inline) | category_id, item_id, warehouse_id |

**Columns** (REPORT_COLUMN_KEYS["dead-stock"]):
`item_code`, `item_name`, `category_name`, `quantity`, `wacc`, `total_value`, `last_sale_date`, `days_since_last_sale`, `aging_bucket`

*Hidden by default:* none

**Findings:**
- 🔴 Same scope/dimensions overlap

---

#### Classification: cost-movements
| Field | Value |
|---|---|
| ID | `cost-movements` |
| Slug | `cost-movements` |
| Labels | حركات التكلفة / Cost movements |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["item_id", "warehouse_id"]` |
| Filters (inline) | item_id, warehouse_id + movement_type (inline only) |

**Columns** (REPORT_COLUMN_KEYS["cost-movements"]):
`date`, `item_code`, `item_name`, `warehouse_name`, `movement_type`, `quantity`, `unit_cost`, `running_quantity`, `running_wacc`, `created_by`, `source_doc_no`, `source_table`, `id`, `item_id`, `source_id`, `source_line_id`, `occurred_at`, `created_at`

*Hidden by default:* many internal keys

**Findings:**
- 🔴 supportsScope: true — scope category/product/warehouse. `category_id` is NOT in dimensions but the scope would still add it
- ❌ The inline filter has `movement_type` (select) which is NOT in the source's filter dimensions pool. This is defined in the inline `filters` separately. The pool for items doesn't have `movement_type` — it's in the warehouses pool. **Inconsistency**: movement_type is defined inline but not discoverable from dimensions.
- 🔴 **`movement_type` options are English** (`"purchase"`, `"branch_receive"`, `"opening_balance"`) — these are NOT translated to Arabic in the select options. Should be `"شراء"`, `"استلام فرع"`, `"رصيد افتتاحي"`.

---

#### Classification: cost-method-comparison
| Field | Value |
|---|---|
| ID | `cost-method-comparison` |
| Slug | `cost-method-comparison` |
| Labels | مقارنة طرق التكلفة / Cost method comparison |
| Modes | detailed only |
| supportsDates | ❌ |
| hasProfit | ✅ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id", "warehouse_id"]` |
| Filters (inline) | category_id, item_id, warehouse_id |

**Columns** (REPORT_COLUMN_KEYS["cost-method-comparison"]):
`item_code`, `item_name`, `category_name`, `quantity`, `wacc`, `last_cost`, `value_wacc`, `value_fifo`, `value_lifo`, `value_last`, `spread_min_max`, `item_id`

*Hidden by default:* `item_id`

**Findings:**
- 🔴 Same scope/dimensions overlap
- ✅ hasProfit: true — correct (shows cost comparison)
- ✅ supportsDates: false — correct (point-in-time snapshot)

---

#### Classification: item-lifecycle
| Field | Value |
|---|---|
| ID | `item-lifecycle` |
| Slug | `item-lifecycle` |
| Labels | دورة حياة الصنف / Item lifecycle |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id"]` |
| Filters (inline) | category_id, item_id |

**Columns** (REPORT_COLUMN_KEYS["item-lifecycle"]):
(27 columns — very wide report)

**Findings:**
- 🔴 Same scope/dimensions overlap
- ✅ hasProfit: true
- ❌ `warehouse_id` not in dimensions or scope — but the lifecycle has stock-on-hand data per warehouse... Actually the SQL doesn't join warehouses, so correct to exclude

---

#### Classification: inventory-turnover
| Field | Value |
|---|---|
| ID | `inventory-turnover` |
| Slug | `inventory-turnover` |
| Labels | دوران المخزون / Inventory turnover |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id", "warehouse_id"]` |
| Filters (inline) | category_id, item_id, warehouse_id |

**Columns** (REPORT_COLUMN_KEYS["inventory-turnover"]):
`item_code`, `item_name`, `category_name`, `stock_on_hand`, `inventory_value`, `quantity_sold`, `cogs`, `avg_daily_sales`, `days_of_stock`, `turnover_ratio`, `stock_velocity_status`, `item_id`

*Hidden by default:* `item_id`

**Findings:**
- 🔴 Same scope/dimensions overlap

---

### 3.10 warehouses

**Source key:** `warehouses`
**Category:** inventory
**Filter dimensions pool:** movement_type, category_id, item_id, warehouse_id

---

#### Classification: movements
| Field | Value |
|---|---|
| ID | `movements` |
| Slug | `stock-movements` |
| Labels | حركات المخزون / Stock movements |
| Modes | detailed, summary |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["movement_type", "category_id", "item_id", "warehouse_id"]` |
| Filters (inline) | movement_type, category_id, item_id, warehouse_id |

**Columns** (REPORT_COLUMN_KEYS["stock-movements"]):
`item_code`, `item_name`, `warehouse_name`, `movement_type`, `reference_type`, `reference_id`, `before_qty`, `after_qty`, `quantity`, `created_by`, `date`, `warehouse_id`

*Hidden by default:* `warehouse_id` (internal)

**Findings:**
- 🔴 **supportsScope: true** — but scope options for "items" are category/product/warehouse. For movements, the scope would filter by category which is NOT in dimensions (it's not a movement property). The scope would be **lying** — it would pass `category_id` to SQL but the query doesn't filter by category.
- ❌ Actually wait — `category_id` IS in dimensions for warehouses. So the scope/dimensions overlap.
- ❌ `dimensions` + inline = full overlap

---

#### Classification: transfers
| Field | Value |
|---|---|
| ID | `transfers` |
| Slug | `branch-transfers` |
| Labels | التحويلات بين الفروع / Branch transfers |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["warehouse_id"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["branch-transfers"]):
`reference_no`, `date`, `type`, `warehouse_name`, `item_count`, `notes`, `created_by`, `id`

*Hidden by default:* `id`

**Findings:**
- ✅ supportsScope: false — good
- ✅ dimensions minimal — only `warehouse_id`
- ✅ No inline filters — clean

---

#### Classification: per-warehouse
| Field | Value |
|---|---|
| ID | `per-warehouse` |
| Slug | `warehouse-levels` / `warehouse-levels-summary` |
| Labels | أرصدة المخازن / Warehouse levels |
| Modes | detailed, summary |
| supportsDates | ❌ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["warehouse_id", "category_id"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["warehouse-levels"]):
`warehouse_name`, `item_count`, `total_quantity`, `total_value`, `low_stock_items`, `value_share_pct`

*Hidden by default:* `value_share_pct`

**Findings:**
- ✅ supportsScope: false — good
- ✅ No inline filters — clean
- ❌ `category_id` in dimensions — the SQL (`queries/warehouses.js → warehouseLevels()`) does NOT filter by category. It only groups by warehouse. Passing a `category_id` filter would be silently ignored.

---

#### Classification: stock-adjustment-audit
| Field | Value |
|---|---|
| ID | `stock-adjustment-audit` |
| Slug | `stock-adjustment-audit` |
| Labels | تدقيق تسويات المخزون / Stock adjustment audit |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["warehouse_id", "category_id", "item_id"]` |
| Filters (inline) | warehouse_id, category_id, item_id |

**Columns** (REPORT_COLUMN_KEYS["stock-adjustment-audit"]):
`date`, `item_code`, `item_name`, `category_name`, `warehouse_name`, `qty_change`, `before_qty`, `after_qty`, `cost_basis`, `value_impact`, `reason`, `created_by`, `id`

*Hidden by default:* `id` (internal)

**Findings:**
- 🔴 supportsScope: true — overlap with dimensions
- ❌ `dimensions` + inline = full overlap

---

### 3.11 expenses

**Source key:** `expenses`
**Category:** treasury
**Filter dimensions pool:** category_id only

---

#### Classification: summary
| Field | Value |
|---|---|
| ID | `summary` |
| Slug | `expense-summary` |
| Labels | ملخص المصروفات / Expense summary |
| Modes | summary only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["category_id"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["expense-summary"]):
`date`, `expense_count`, `total_expenses`, `avg_expense`, `category_count`

*Hidden by default:* none

**Findings:**
- ✅ Clean
- ❌ No inline filters — but `["category_id"]` in dimensions will show the category filter via the new system

---

#### Classification: detailed
| Field | Value |
|---|---|
| ID | `detailed` |
| Slug | `detailed-expenses` |
| Labels | المصروفات التفصيلية / Detailed expenses |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["category_id"]` |
| Filters (inline) | category_id |

**Columns** (REPORT_COLUMN_KEYS["detailed-expenses"]):
`date`, `category_name`, `amount`, `payment_method`, `description`, `notes`, `employee_id`

*Hidden by default:* none

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

#### Classification: by-category
| Field | Value |
|---|---|
| ID | `by-category` |
| Slug | `expenses-by-category` |
| Labels | المصروفات حسب الفئة / Expenses by category |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["category_id"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["expenses-by-category"]):
`category_name`, `expense_count`, `total_expenses`, `avg_expense`, `pct_of_total`, `last_expense_date`

*Hidden by default:* `pct_of_total`

**Findings:**
- ✅ Clean
- ✅ No inline filters — dimensions handles it

---

#### Classification: by-payment
| Field | Value |
|---|---|
| ID | `by-payment` |
| Slug | `expenses-by-payment` |
| Labels | المصروفات حسب طريقة الدفع / Expenses by payment |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `[]` (empty) |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["expenses-by-payment"]):
`payment_method`, `expense_count`, `total_expenses`, `avg_expense`

*Hidden by default:* none

**Findings:**
- ✅ Clean — **the cleanest classification in the entire system**
- ✅ No dimensions, no inline filters, no scope. Just the report data.
- **Template for how all "by-X" reports should be configured.**

---

### 3.12 revenues

**Source key:** `revenues`
**Category:** treasury
**Filter dimensions pool:** category_id only

---

#### Classification: summary
| Field | Value |
|---|---|
| ID | `summary` |
| Slug | `revenue-summary` |
| Labels | ملخص الإيرادات / Revenue summary |
| Modes | summary only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["category_id"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["revenue-summary"]):
`date`, `revenue_count`, `total_revenues`, `avg_revenue`, `category_count`

*Hidden by default:* none

**Findings:**
- ✅ Clean

---

#### Classification: detailed
| Field | Value |
|---|---|
| ID | `detailed` |
| Slug | `detailed-revenues` |
| Labels | الإيرادات التفصيلية / Detailed revenues |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["category_id"]` |
| Filters (inline) | category_id |

**Columns** (REPORT_COLUMN_KEYS["detailed-revenues"]):
`date`, `category_name`, `amount`, `payment_type`, `description`, `notes`

*Hidden by default:* none

**Findings:**
- ❌ `dimensions` + inline duplicate

---

#### Classification: by-category
| Field | Value |
|---|---|
| ID | `by-category` |
| Slug | `revenues-by-category` |
| Labels | الإيرادات حسب الفئة / Revenues by category |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["category_id"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["revenues-by-category"]):
`category_name`, `revenue_count`, `total_revenues`, `avg_revenue`, `pct_of_total`

*Hidden by default:* none

**Findings:**
- ✅ Clean

---

#### Classification: by-payment
| Field | Value |
|---|---|
| ID | `by-payment` |
| Slug | `revenues-by-payment` |
| Labels | الإيرادات حسب طريقة الدفع / Revenues by payment |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `[]` (empty) |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["revenues-by-payment"]):
`payment_method`, `revenue_count`, `total_revenues`, `avg_revenue`

*Hidden by default:* none

**Findings:**
- ✅ **Cleanest** — like expenses' by-payment

---

### 3.13 treasury

**Source key:** `treasury`
**Category:** treasury
**Filter dimensions pool:** method_id, direction, doc_type, party_type, amount_min, amount_max (PAYMENT_FLOW_FILTERS)

---

#### Classification: cash-flow
| Field | Value |
|---|---|
| ID | `cash-flow` |
| Slug | `cash-flow` |
| Labels | التدفق النقدي / Cash flow |
| Modes | detailed, summary |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `[]` (empty) |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["cash-flow"]):
`date`, `type`, `total`

*Hidden by default:* none

**Findings:**
- ✅ No dimensions, no scope, no inline filters — clean
- ⚠️ **Very few columns (3)** — this report is very minimal. Might need more columns to be useful.

---

#### Classification: balances
| Field | Value |
|---|---|
| ID | `balances` |
| Slug | `treasury` |
| Labels | الخزائن والبنوك / Treasury balances |
| Modes | summary only |
| supportsDates | ❌ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `[]` (empty) |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["treasury"]):
`name`, `code`, `balance`, `source`, `tx_count`

*Hidden by default:* none

**Findings:**
- ✅ Clean
- ⚠️ Point-in-time snapshot — few rows (one per treasury/bank)

---

#### Classification: reconciliation
| Field | Value |
|---|---|
| ID | `reconciliation` |
| Slug | `cash-consistency` |
| Labels | مطابقة النقدية / Cash reconciliation |
| Modes | detailed, summary |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `[]` (empty) |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["cash-consistency"]):
`date`, `shift_id`, `cashier`, `opening_cash`, `closing_cash`, `sales_total`, `expected_cash`, `cash_variance`, `invoice_count`, `status`

*Hidden by default:* none

**Findings:**
- ✅ Clean

---

#### Classification: daily-sessions
| Field | Value |
|---|---|
| ID | `daily-sessions` |
| Slug | `daily-sessions` |
| Labels | جلسات الخزينة اليومية / Daily treasury sessions |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `[]` (empty) |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["daily-sessions"]):
`date`, `cashier`, `opening_cash`, `closing_cash`, `sales_total`, `total_discount`, `invoice_count`, `cash_variance`, `status`

*Hidden by default:* none

**Findings:**
- ✅ Clean

---

#### Classification: withdrawals
| Field | Value |
|---|---|
| ID | `withdrawals` |
| Slug | `withdrawals-report` |
| Labels | تقرير السحوبات / Withdrawals report |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `[]` (empty) |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["withdrawals-report"]):
`reference_no`, `date`, `amount`, `reason`, `payment_method`, `created_by`, `id`

*Hidden by default:* `id` (internal)

**Findings:**
- ✅ Clean — but no filters at all. Might want at least a `payment_method` filter?

---

### 3.14 payment-flow

**Source key:** `payment-flow`
**Category:** treasury
**Filter dimensions pool:** method_id, direction, doc_type, party_type, amount_min, amount_max (reuses PAYMENT_FLOW_FILTERS)

---

#### Classification: payment-flow-summary
| Field | Value |
|---|---|
| ID | `payment-flow-summary` |
| Slug | `payment-flow-summary` |
| Labels | ملخص تدفقات وسائل الدفع / Payment flow summary |
| Modes | summary only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["method_id"]` |
| Filters (inline) | method_id (from PAYMENT_FLOW_FILTERS) |

**Columns** (REPORT_COLUMN_KEYS["payment-flow-summary"]):
`method_name`, `transaction_count`, `total_in`, `total_out`, `net_amount`, `last_movement_at`, `method_category`, `method_type`, `excludes_from_treasury`, `method_id`, `method_icon`

*Hidden by default:* `method_category`, `method_type`, `excludes_from_treasury`, `method_id`, `method_icon`

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate for `method_id`

---

#### Classification: payment-flow-ledger
| Field | Value |
|---|---|
| ID | `payment-flow-ledger` |
| Slug | `payment-flow-ledger` |
| Labels | سجل تدفقات وسائل الدفع التفصيلي / Payment flow ledger |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["method_id", "direction", "doc_type", "party_type", "amount_min", "amount_max"]` |
| Filters (inline) | method_id, direction, docType, partyType, min, max (from PAYMENT_FLOW_FILTERS) |

**Columns** (REPORT_COLUMN_KEYS["payment-flow-ledger"]):
20 columns — very wide

**Findings:**
- ✅ Clean — the payment flow is well-designed
- ❌ `dimensions` + inline = full overlap for all 6 filters
- ⚠️ `amount_min` and `amount_max` are text inputs — fine

---

#### Classification: payment-flow-by-doc-type
| Field | Value |
|---|---|
| ID | `payment-flow-by-doc-type` |
| Slug | `payment-flow-by-doc-type` |
| Labels | تدفقات حسب نوع المستند / Flow by doc type |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["doc_type", "method_id", "direction"]` |
| Filters (inline) | docType, method, direction |

**Columns** (REPORT_COLUMN_KEYS["payment-flow-by-doc-type"]):
`doc_type_label`, `transaction_count`, `total_in`, `total_out`, `net_amount`, `last_movement_at`, `doc_type`

*Hidden by default:* `doc_type`

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

#### Classification: payment-flow-by-direction
| Field | Value |
|---|---|
| ID | `payment-flow-by-direction` |
| Slug | `payment-flow-by-direction` |
| Labels | تدفقات حسب الاتجاه / Flow by direction |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["direction", "method_id", "doc_type"]` |
| Filters (inline) | direction, method, docType |

**Columns** (REPORT_COLUMN_KEYS["payment-flow-by-direction"]):
`direction_label`, `transaction_count`, `total_amount`, `total_in`, `total_out`, `net_amount`, `last_movement_at`, `direction`

*Hidden by default:* `direction`

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

#### Classification: payment-flow-running
| Field | Value |
|---|---|
| ID | `payment-flow-running` |
| Slug | `payment-flow-running` |
| Labels | الرصيد التراكمي / Running balance |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["method_id", "direction", "doc_type"]` |
| Filters (inline) | method, direction, docType |

**Columns** (REPORT_COLUMN_KEYS["payment-flow-running"]):
19 columns — very wide

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

### 3.15 profit-loader

**Source key:** `profit-loader`
**Category:** profitability
**Filter dimensions pool:** category_id, item_id

---

#### Classification: by-item
| Field | Value |
|---|---|
| ID | `by-item` |
| Slug | `margin-by-item` |
| Labels | هامش الربح حسب الصنف / Margin by item |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id", "customer_id"]` |
| Filters (inline) | category_id, item_id |

**Columns** (REPORT_COLUMN_KEYS["margin-by-item"]):
(same as sales margin-by-item)

**Findings:**
- 🔴 **supportsScope: true** — overlap with dimensions
- ❌ `customer_id` in dimensions — not in the source's filter dimensions pool! The pool for profit-loader is `["category_id", "item_id"]`. `customer_id` comes from... somewhere else. This is an **erroneous dimension key** that won't find a matching pool entry.
- ❌ `dimensions` + inline duplicate

---

#### Classification: by-category
| Field | Value |
|---|---|
| ID | `by-category` |
| Slug | `margin-by-category` |
| Labels | هامش الربح حسب الفئة / Margin by category |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "customer_id"]` |
| Filters (inline) | category_id |

**Columns** (REPORT_COLUMN_KEYS["margin-by-category"]):
(same as sales margin-by-category)

**Findings:**
- 🔴 supportsScope + dimensions overlap
- ❌ `customer_id` not in profit-loader's filter pool — **erroneous key**
- ❌ `dimensions` + inline duplicate

---

#### Classification: health
| Field | Value |
|---|---|
| ID | `health` |
| Slug | `margin-health` |
| Labels | صحة هوامش الربح / Margin health |
| Modes | summary only |
| supportsDates | ❌ |
| hasProfit | ✅ |
| supportsScope | ❌ |
| Dimensions | `["category_id"]` |
| Filters (inline) | category_id |

**Columns** (REPORT_COLUMN_KEYS["margin-health"]):
`item_name`, `wacc`, `sale_price`, `current_margin_percent`, `min_margin_percent`, `suggested_price`, `below_threshold`, `item_id`

*Hidden by default:* `item_id` (internal)

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

#### Classification: margin-drift
| Field | Value |
|---|---|
| ID | `margin-drift` |
| Slug | `margin-drift` |
| Labels | تغير الهامش والتكلفة / Margin drift |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id", "item_id"]` |
| Filters (inline) | category_id, item_id |

**Columns** (REPORT_COLUMN_KEYS["margin-drift"]):
`item_code`, `item_name`, `category_name`, `sale_price`, `first_period_cost`, `last_period_cost`, `current_cost`, `cost_change`, `previous_margin_percent`, `current_margin_percent`, `margin_decline_percent`, `item_id`

*Hidden by default:* `item_id` (internal)

**Findings:**
- 🔴 supportsScope + dimensions overlap
- ❌ `dimensions` + inline duplicate

---

### 3.16 net-profit

**Source key:** `net-profit`
**Category:** profitability
**Filter dimensions pool:** (empty — `[]`)

---

#### Classification: income-statement
| Field | Value |
|---|---|
| ID | `income-statement` |
| Slug | `profit-loss` |
| Labels | الأرباح والخسائر / Profit & loss |
| Modes | summary only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `[]` (empty) |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["profit-loss"]):
`section`, `label`, `amount`, `pct`

*Hidden by default:* none

**Findings:**
- ✅ Clean — no filters at all
- ✅ No scope, no dimensions, no inline filters. **This is the ideal.**

---

#### Classification: by-category
| Field | Value |
|---|---|
| ID | `by-category` |
| Slug | `profit-by-category` |
| Labels | الربح حسب الفئة / Profit by category |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["category_id"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["profit-by-category"]):
`category_name`, `quantity_sold`, `selling_total`, `revenue`, `cost`, `returns_amount`, `gross_profit`, `margin_percent`, `avg_unit_price`, `avg_unit_cost`

*Hidden by default:* `avg_unit_price`, `avg_unit_cost`

**Findings:**
- 🔴 **supportsScope: true** — scope category/product. For a "by category" report, scope would add a category filter that's redundant with the report's grouping
- ✅ Dimensions: only `category_id` — minimal
- ✅ hasProfit: true

---

#### Classification: by-customer
| Field | Value |
|---|---|
| ID | `by-customer` |
| Slug | `profit-by-customer` |
| Labels | الربح حسب العميل / Profit by customer |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ❌ |
| Dimensions | `[]` (empty) |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["profit-by-customer"]):
`customer_name`, `invoice_count`, `selling_total`, `total_discount`, `additions_amount`, `revenue`, `cost`, `returns_amount`, `gross_profit`, `margin_percent`, `avg_invoice_value`

*Hidden by default:* `avg_invoice_value`

**Findings:**
- ✅ Clean
- ❌ No filters at all — the report groups by ALL customers. Might want a `customer_id` filter to narrow down.

---

#### Classification: by-period
| Field | Value |
|---|---|
| ID | `by-period` |
| Slug | `profit-by-period` |
| Labels | الربح حسب الفترة / Profit by period |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ❌ |
| Dimensions | `[]` (empty) |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["profit-by-period"]):
`date`, `invoice_count`, `selling_total`, `total_discount`, `additions_amount`, `revenue`, `cost_of_goods_sold`, `returns_amount`, `gross_profit`, `expenses`, `net_profit`, `margin_percent`, `avg_invoice_value`

*Hidden by default:* `margin_percent`, `avg_invoice_value`

**Findings:**
- ✅ Clean
- ✅ supportsScope: false
- ✅ hasProfit: true

---

#### Classification: daily-owner-snapshot
| Field | Value |
|---|---|
| ID | `daily-owner-snapshot` |
| Slug | `daily-owner-snapshot` |
| Labels | لقطة صاحب المحل اليومية / Daily owner snapshot |
| Modes | summary only |
| supportsDates | ✅ |
| hasProfit | ✅ |
| supportsScope | ❌ |
| Dimensions | `[]` (empty) |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["daily-owner-snapshot"]):
17 columns — very wide summary

**Findings:**
- ✅ Clean — no filters at all

---

### 3.17 tax

**Source key:** `tax`
**Category:** tax
**Filter dimensions pool:** customer_id, supplier_id, status, payment_type, tax_type

---

#### Classification: vat
| Field | Value |
|---|---|
| ID | `vat` |
| Slug | `vat` |
| Modes | detailed, summary |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["customer_id", "status", "payment_type", "tax_type"]` |
| Filters (inline) | none |

**Findings:**
- 🔴 **supportsScope: true** — scope options are from the common set. But tax reports have NO category or product concept. The scope will offer meaningless options.
- ✅ Dimensions: reasonable for tax
- ✅ No inline filters — clean

---

#### Classification: output-vat
| Field | Value |
|---|---|
| ID | `output-vat` |
| Slug | `output-vat` |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["customer_id", "status", "payment_type", "tax_type"]` |
| Filters (inline) | none |

**Findings:**
- 🔴 **supportsScope: true** — same problem as vat
- ✅ Clean otherwise

---

#### Classification: input-vat
| Field | Value |
|---|---|
| ID | `input-vat` |
| Slug | `input-vat` |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["supplier_id", "status", "payment_type", "tax_type"]` |
| Filters (inline) | none |

**Findings:**
- 🔴 **supportsScope: true** — same problem
- ✅ Dimensions use `supplier_id` (for purchases) instead of `customer_id` — correct

---

#### Classification: vat-filing-summary
| Field | Value |
|---|---|
| ID | `vat-filing-summary` |
| Slug | `vat-filing-summary` |
| Modes | summary only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ✅ **(ISSUE)** |
| Dimensions | `["customer_id", "status", "payment_type", "tax_type"]` |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["vat-filing-summary"]):
`period_label`, `basis_label`, `sales_total`, `output_vat`, `purchases_total`, `input_vat`, `net_vat`

*Hidden by default:* `net_vat`

**Findings:**
- 🔴 **supportsScope: true** — meaningless for this report
- 🔴 **ALWAYS RETURNS 1 ROW** — The SQL in `queries/tax.js → vatFilingSummary()` computes total sales, output VAT, purchases, input VAT, net VAT for the entire period. It's a single summary row. **This is a "useless" report by the user's definition** since it always shows one row.
- ⚠️ The `net_vat` column is hidden by default — but it's the most important column!

---

#### Classification: returns-tax-effect
| Field | Value |
|---|---|
| ID | `returns-tax-effect` |
| Slug | `returns-tax-effect` |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `[]` (empty) |
| Filters (inline) | none |

**Columns** (REPORT_COLUMN_KEYS["returns-tax-effect"]):
`return_ref`, `date`, `return_amount`, `tax_type_label`, `vat_reversed`, `items_returned`, `customer_id`, `status_label`

*Hidden by default:* `customer_id` (internal), `status_label`

**Findings:**
- ✅ Clean
- ✅ supportsScope: false
- ❌ `status_label` is in columns but hidden as internal — the SQL returns it. If it's useful, should not be hidden.

---

### 3.18 expiry

**Source key:** `expiry`
**Category:** inventory
**Filter dimensions pool:** (none — this source has no explicitly defined filterDimensions, but the `items` pool covers it)

**Note:** The `expiry` source maps to `items` classifications? Let me check... No, `expiry` is a separate source. It doesn't appear in `filterDimensions` but its classifications reference `item_id`, `warehouse_id`, `category_id`. Looking at the pool... The `expiry` source doesn't have an entry in `filterDimensions`. So its dimension filters look up from the `items` pool or fail gracefully.

Actually wait, `getFilterDimensions("expiry")` would return `[]` (undefined). But the `expiry` classification references `dimensions: ["item_id", "warehouse_id", "category_id"]`. The `getEnabledFilterDimensions` would try to find these keys in `getFilterDimensions("expiry")` which is `undefined`... actually it would return `[]`. So `cls.dimensions.map(key => pool.find(d => d.key === key)).filter(Boolean)` would filter them all out, meaning NO dimension filters are shown for expiry despite having `dimensions` defined. **This is a bug** — the dimension filters silently disappear.

Wait, actually let me re-read: the server `registry.js` doesn't explicitly define `filterDimensions.expiry`. But the `items` filter dimensions pool exists. The expiry classification under the `items` source has its definitions. But `expiry` as a source has no filter dimensions defined.

Looking at the expiry source definition: it has classifications in `items` source (line 331-334):
```js
{ id: "expiry", label_key: "cls_item_expiry", ..., dimensions: ["item_id", "warehouse_id", "category_id"], ... }
```

These are under the `items` source. The `expiry` source in the sources list is separate — it was probably meant to be a standalone source but its classifications are under `items`. This is confusing.

Wait, looking at sources again: `{ id: "expiry", label_key: "source_expiry", cat: "inventory", icon: "Clock" }` — it IS a separate source. But it has NO classifications defined under `classifications.expiry`. Only `classifications.items` has an expiry entry. So clicking on the expiry source would show... nothing? Or it would show the items classifications?

This is yet another config drift issue. The `expiry` source exists but has no classifications in the new system.

---

### 3.19 owner-statement

**Source key:** `owner-statement`
**Category:** accounts
**Filter dimensions pool:** (none defined — intentional)

**Findings:**
- ✅ **INTENTIONAL DESIGN** — This is NOT a report source. It's a **portal entry** in the Reports Center that opens a fully standalone page.
- When clicked in `ReportsCenter.jsx:245`:
  ```js
  if (source.id === "owner-statement") {
    navigate(`/reports/owner-statement${qs ? `?${qs}` : ""}`);
  }
  ```
- Renders the dedicated `OwnerStatementPage.jsx` component (not `SourceWorkspacePage`), with its own full CRUD API at `/api/owner-statements` and its own DB tables: `owner_statements`, `owner_statement_rows`, `owner_statement_values`
- The server `registry.js` correctly has **no classifications** — the new source-based report API is never called for this source
- The client `reportsCenterConfig.js` has a single classification `worksheet` for UI listing purposes only
- It has its own permission set: `owner_statement` (view, save, lock, print)
- **Logic verified: No changes needed.** The source entry exists solely so the source appears in the Reports Center sidebar for navigation.

---

### 3.20 users

**Source key:** `users`
**Category:** users
**Filter dimensions pool:** user_id, role

---

#### Classification: user-list
| Field | Value |
|---|---|
| ID | `user-list` |
| Slug | `user-list` |
| Labels | قائمة المستخدمين / User list |
| Modes | detailed only |
| supportsDates | ❌ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["role"]` |
| Filters (inline) | role (select) |

**Columns** (REPORT_COLUMN_KEYS["user-list"]):
`id`, `username`, `full_name`, `role`, `status`, `created_at`, `last_login`, `updated_at`

*Hidden by default:* none

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate for `role`

---

#### Classification: performance
| Field | Value |
|---|---|
| ID | `performance` |
| Slug | `user-performance` |
| Labels | أداء المستخدمين / User performance |
| Modes | detailed, summary |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["user_id"]` |
| Filters (inline) | user_id |

**Columns** (REPORT_COLUMN_KEYS["user-performance"]):
`full_name`, `invoice_count`, `total_sales`, `total_discount`, `avg_invoice_value`, `returns_handled`, `returns_amount`, `shift_count`, `user_id`

*Hidden by default:* `user_id` (internal)

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

#### Classification: login-history
| Field | Value |
|---|---|
| ID | `login-history` |
| Slug | `login-history` |
| Labels | سجل تسجيل الدخول / Login history |
| Modes | detailed only |
| supportsDates | ✅ |
| hasProfit | ❌ |
| supportsScope | ❌ |
| Dimensions | `["user_id"]` |
| Filters (inline) | user_id |

**Columns** (REPORT_COLUMN_KEYS["login-history"]):
`full_name`, `action`, `date`, `details`, `resource`, `id`, `user_id`

*Hidden by default:* `id` (internal), `user_id` (internal)

**Findings:**
- ✅ Clean
- ❌ `dimensions` + inline duplicate

---

## 4. Global / Cross-Cutting Findings

### F1: Client-Server Config Drift

The client file `reportsCenterConfig.js` has its own `CLASSIFICATIONS` object that mirrors the server's but is independently maintained. They are frequently out of sync:

| Missing from client | Present in server |
|---|---|
| `sales-returns-summary` | ✅ exists |
| `sales-returns-by-customer` | ✅ exists |
| `purchase-returns-summary` | ✅ exists |
| `purchase-returns-by-supplier` | ✅ exists |

### F2: Corrupted Client Config Entries

In `reportsCenterConfig.js`:
- The `purchase-returns` and `sales-returns` entries under `CLASSIFICATIONS` contain **classification objects** (like `{ id: "summary", ... }`) instead of filter dimension definitions
- The `installments` array starts **mid-line** after the employee classifications, suggesting a copy-paste error or concatenation issue
- These corrupted entries would cause UI rendering errors or missing filters

### F3: Sources Without Classifications

| Source | Has Classifications? | Status |
|---|---|---|
| `expiry` | ❌ No classifications array in new system | 🔴 Needs fix — or remove the source |
| `owner-statement` | ❌ (intentional — dedicated standalone page) | ✅ **INTENTIONAL** — see 3.19 |
| `cheques` | ❌ Not a separate source | ⚠️ Legacy reports exist but no new source |

### F4: Legacy-Only Reports Not in New System

These report slugs exist only in the legacy `REPORT_REGISTRY.reports[]` and have no source/classification mapping:
- `cheque-listing` (cheques)
- `bank-transactions` (cheques)  
- `bank-summary` (cheques)
- `employee-adjustments` (employees — NOT the same as deductions/bonuses/advances)

These would not appear in the new SourceWorkspacePage UI.

### F5: Label Duplication

Arabic labels are defined in 6+ places:
1. `server/src/reports/columns.js` → `AR_LABELS`
2. `server/src/reports/columns.js` → `labelForKey()` (also in AR_LABELS)
3. `server/src/reports/helpers.js` → `labelForKey()` (separate copy)
4. `client/src/pages/reports/SourceWorkspacePage.jsx` → `ARABIC_COL_LABELS`
5. `client/src/pages/reports/ReportWorkspacePage.jsx` → `prettifyLabel()`
6. `client/src/pages/reports/reportsCenterConfig.js` → `VALUE_TRANSLATIONS`
7. `client/src/pages/reports/ReportsCenter.jsx` → `CLS_ARABIC`

This is a maintenance nightmare. Adding a new column requires updating 7 files.

### F6: Legacy `filters` vs New System `dimensions` Duality

The `REPORT_REGISTRY.reports[]` (legacy) has `filters` defined on each report entry. The new `classifications{}` system has `dimensions` (referencing the pool) + `filters` (inline overrides).

When both are present:
- The new system checks `dimensions` → looks up pool → creates filter UI
- The inline `filters` are for backward compat with the legacy system
- **BUT**: When BOTH are defined for the same thing (e.g., `dimensions: ["category_id"]` + `filters: [{ key: "category_id", ... }]`), the new SourceWorkspacePage would render the dimension filter from the pool AND separately look at inline filters → **double rendering**

### F8: Export Service — RTL-Aware but Without Report Config Integration

The `exportService.js` (577 lines) is well-designed with:
- **4 export versions**: v1 (basic Excel/PDF), v2 (Arabic-friendly Excel), v3 (premium PDF with alternating rows, page numbers, font-size controls), and DOCX with full RTL table support
- RTL-aware: Excel sets `rightToLeft: true` view, PDF uses Arial for Arabic shaping, DOCX uses `rightToLeft` on TextRuns
- Paper size/orientation options, totals row, alternating row colors

**Issues found:**
- ✅ No issues with the export service itself — it's clean, well-organized code
- ⚠️ The export service is imported in `report.routes.js` and called with static column info — no direct integration issues
- ❌ `exportRowsToPdfV2` is marked "limited RTL shaping" (line 47 comment) but is still used — not critical since V3 exists
- ❌ `exportRowsToPdf` (v1, line 27-43) uses `JSON.stringify(row)` to render rows — this is a legacy stub, probably never called

### F9: Reports Store — Clean Zustand Implementation

The `reportsStore.js` (109 lines) is clean and well-structured:
- Per-report preferences keyed by composite key (`sourceKey.classification.dataMode`)
- Column visibility, order, widths persisted via localStorage
- Favorites, recents, saved presets
- Sidebar toggle state
- **No issues found.** This is the cleanest file in the reports system.

### F10: owner-statement Source — Intentional Design (Corrected)

- `owner-statement` is **NOT a report source** — it's a navigation portal entry
- Clicking it in `ReportsCenter.jsx:245` redirects to `/reports/owner-statement` which renders `OwnerStatementPage.jsx` — a standalone page with its own CRUD API, DB tables, permissions, and UI
- No classifications needed on server — `SourceWorkspacePage` is never invoked for this source
- The client `reportsCenterConfig.js` has a single classification `worksheet` for listing purposes only
- **Correction applied** to §3.19 above

### F11: Silent Fallback Pattern (P11) — 7 Queries Change Output Columns When Filtered

**Severity: CRITICAL — Renders filtered reports with wrong/missing columns**

When ANY filter is applied (payment_type, status, cashier_id, category_id, etc.), the following query functions silently switch from their normal aggregate query to a **completely different detail query** with entirely different output columns:

| Query Function | Normal Output | Fallback Query | Fallback Output |
|---|---|---|---|
| `dailySales()` (sales.js:9) | date, invoice_count, selling_total, gross_sales, total_cost, net_sales, gross_profit | `_detailSalesQuery` | invoice_no, customer_name, cashier, payment_type, status, subtotal, discount, total, item_count |
| `salesByItem()` (sales.js:194) | item_code, item_name, quantity_sold, revenue, cost, gross_profit, margin_percent | `_detailItemSalesQuery` | invoice_no, date, quantity, unit_price, line_total, line_cost |
| `salesByCategory()` (sales.js:253) | category_name, item_count, quantity_sold, revenue, cost, gross_profit, margin_percent | `_detailItemSalesQuery` | invoice_no, date, quantity, unit_price, line_total, line_cost |
| `salesByCashier()` (sales.js:307) | cashier, invoice_count, cancelled_count, total_sales, gross_profit, margin_percent | `_detailSalesQuery` | invoice_no, customer_name, cashier, payment_type, status, subtotal, discount, total, item_count |
| `grossNetSales()` (sales.js:536) | date, gross_sales, total_discount, additions_amount, net_sales, total_cost, gross_profit | `_detailSalesQuery` | invoice_no, customer_name, cashier, payment_type, status, subtotal, discount, total, item_count |
| `purchaseSummary()` (purchases.js:42) | date, purchase_count, distinct_suppliers, total_discount, additions_amount, total_purchases, avg_order_value | `_detailPurchaseQuery` | purchase_no, supplier_name, total, status, payment_type, item_count |
| `purchasesBySupplier()` (purchases.js:99) | supplier_name, purchase_count, total_purchases, avg_order_value, returns_total, net_purchases | `_detailPurchaseQuery` | purchase_no, supplier_name, total, status, payment_type, item_count |
| `expenseSummary()` (expenses.js:25) | date, expense_count, total_expenses, avg_expense, category_count | `_detailExpenseQuery` | date, category_name, amount, payment_type, description, notes |
| `revenueSummary()` (revenues.js:25) | date, revenue_count, total_revenues, avg_revenue, category_count | `_detailRevenueQuery` | date, category_name, amount, payment_type, description, notes |

**Root cause:** Each query function has a conditional at the top that checks `if (opts.category_id)` (for expense/revenue) or `if (filters && Object.keys(filters).length > 0)` (for sales/purchases). If true, it calls the detail query instead. This was probably intended to "show individual transactions when filtered" but the column sets are fundamentally different — the REPORT_COLUMN_KEYS for the original slug doesn't match the detail query's output. The UI renders wrong headers, wrong data, or crashes on missing columns.

**Example:** user opens "Daily Sales Summary" and adds a payment_type filter → instead of daily aggregates (date, invoice_count, gross_sales, net_sales, gross_profit), they get invoice-level data (invoice_no, customer_name, subtotal). The first column `date` maps correctly only by accident; `invoice_count` and `gross_sales` show undefined/N/A.

**Affected code path:** The dispatcher (`index.js`) calls the query function with `(filters, pool)`. The query function receives the filters object and makes the switch internally. The route handler (`report.routes.js`) has NO idea the output changed. It passes the result to column rendering using the original REPORT_COLUMN_KEYS.

**Fix:** Either (1) remove the conditional fallback so queries always return their normal schema, or (2) add a detail slug that explicitly maps to `_detailSalesQuery` and let the UI decide which report to show.

---

### F12: 5 Broken Backward Compat Mappings (P12)

**Severity: CRITICAL — New source-based API returns 404 for 5 legacy slugs**

The `clsMap` in `registry.js` maps these legacy slugs to source+classification combos that DON'T EXIST:

| Legacy Slug | Maps To Source | Classification | Why It's Broken |
|---|---|---|---|
| `shift-history` | employees | `shifts` | ❌ No `shifts` classification exists in employees source |
| `exceptions` | employees | `shifts` | ❌ Same — `shifts` doesn't exist |
| `audit-log` | employees | `user-activity` | ❌ No `user-activity` classification in employees |
| `user-activity` | employees | `user-activity` | ❌ Same |
| `bank-cash-split` | cheques | `bank-summary` | ❌ Source `cheques` doesn't exist at all |

**Impact:**
- The legacy `/api/reports/run/:slug` still works because it calls `listRows()` directly via the dispatcher (which maps slug → query function directly)
- The new `/api/reports/source/:sourceKey/run` returns 404 for these 5 slugs because the source/classification doesn't exist
- The backward compat route `resolveQuerySlug()` first tries the new system → fails → falls back to legacy. So these 5 still work via the legacy path, but the `clsMap` is **lying** about the new system path

**Fix:** Either (1) add the missing classifications to the employees source (shifts, user-activity) and add a cheques source with the missing classifications, or (2) remove these 5 entries from clsMap since they can't resolve via the new system.

---

### F13: SQL Columns Missing from REPORT_COLUMN_KEYS (P13)

**Severity: MEDIUM — Data exists in query output but never rendered in UI**

| Source | Query | Columns Selected by SQL | Columns in REPORT_COLUMN_KEYS | Missing |
|---|---|---|---|---|
| daily-sales | `dailySales()` | date, invoice_count, selling_total, total_discount, additions_amount, gross_sales, total_cost, returns_amount, returns_count, net_sales, gross_profit, avg_invoice_value, margin_percent, **total_tax**, **net_total** | 13 columns | **total_tax**, **net_total** |
| detailed-sales | `detailedSales()` | invoice_no, date, customer_name, cashier, payment_type, status, subtotal, discount, additions_amount, total, item_count, payment_breakdown, customer_id, **net_total**, **tax_amount**, **tax_rate**, **tax_type** | 11 columns | **net_total**, **tax_amount**, **tax_rate**, **tax_type** |

**Impact:** `total_tax` and `net_total` are computed by the SQL but never shown to the user. In `dailySales()`, these are probably useful metrics (total tax collected, net total after tax). In `detailedSales()`, `tax_amount`, `tax_rate`, `tax_type` provide per-invoice tax breakdown which users would expect to see in a detailed report.

**Fix:** Add the missing columns to the respective REPORT_COLUMN_KEYS arrays, or add them to REPORT_EXTRA_KEYS (hidden by default).

---

### F14: Ghost Columns in REPORT_COLUMN_KEYS (P14)

**Severity: MEDIUM — Columns always show empty because SQL doesn't return them**

| Report | Column in REPORT_COLUMN_KEYS | SQL Returns | Issue |
|---|---|---|---|
| sales-heatmap | `customer_id` | SQL doesn't select customer_id (groups by weekday/hour only) | Column always empty ✅ confirmed |
| reorder | `min_stock` | SQL returns `it.min_stock_qty` (not aliased to `min_stock`) | Column shows as `min_stock` → undefined/N/A ✅ confirmed |
| installment-collections | `method_name` | **New SQL path** (`installments.js:166`): `COALESCE(pm.name, 'غير محدد') AS method_name` ✅ **returns it**. **Legacy path** (`installments.js:134`): does NOT return method_name | ⚠️ **Conditional ghost** — works on new DB schema, empty on legacy |

**Impact:** Users see empty columns in the UI. For `reorder`, the column header says "الحد الأدنى للمخزون" but shows no values because the SQL key doesn't match the column key.

**Fix:**
- `sales-heatmap`: Remove `customer_id` from REPORT_COLUMN_KEYS (or add `customer_id` to the SQL GROUP BY — unlikely to be useful)
- `reorder`: Rename column key from `min_stock` to `min_stock_qty` or alias `min_stock_qty AS min_stock` in SQL
- `installment-collections`: `method_name` is fine on new schema — no fix needed unless supporting legacy path

---

### F15: Internal Query Functions Exported (P15)

**Severity: LOW — Namespace pollution**

The following **internal** functions are exported from their module files via `module.exports`:

- `queries/sales.js` exports `_detailSalesQuery`, `_detailItemSalesQuery`
- `queries/purchases.js` exports `_detailPurchaseQuery`

These are prefixed with underscore (convention for "private") but are still accessible via `require()`. They are NOT registered in the dispatcher (`index.js`), so they can't be called via the report API. But any code that `require()`s the query module can call them directly.

**Fix:** Remove from `module.exports`. If they must remain accessible (for other modules that import them directly), remove the underscore prefix and document why they're public.

### F16: profitByCategory Returns Object Instead of Array (P16)

**Severity: HIGH — Will crash any code that iterates the result**

`profitByCategory()` in `profit.js:33` returns:
```js
{ rows: [...], summary: { total_expenses: 12345 } }
```

Every other query function in the entire system returns a flat array `[...]`. The dispatcher (`index.js`) has no normalization — it just returns whatever the function returns via `listRows()`.

**Impact:**
- The route handler calls `listRows("profit-by-category", ...)` which returns the `{ rows, summary }` object
- `report.routes.js` probably calls `.map()` or spreads the result — this will **silently fail** or return `undefined` for the rows
- If the client receives `{ rows: [...], summary: {} }` instead of an array, it will crash or show empty
- ✅ Verified: Only `profitByCategory()` has this structure. All other profit functions (`profitByCustomer`, `profitByPeriod`) return flat arrays.

**Fix:** Either (1) flatten the return to just `rows` and put `total_expenses` in a separate API response field, or (2) handle the `{ rows, summary }` shape in the route handler. Approach (1) is preferred for consistency.

---

### F17: SQL Injection Vectors in Helper Functions (P17)

**Severity: HIGH — Latent vulnerability in 2 helper functions**

**File:** `helpers.js`

**`addDateFilter()` (lines 6, 10):**
```js
// line 6
clause += ` AND DATE(${column}) >= ?`;
// line 10  
clause += ` AND DATE(${column}) <= ?`;
```
The `column` parameter is directly interpolated into the SQL string. All current callers pass hardcoded strings like `"i.created_at"`, but any future code path that passes user-controlled input as `column` would enable injection.

**`addPaymentTypeFilter()` (line 246):**
```js
return ` AND (${tableAlias}.payment_type = ? OR ...)`;
```
Same issue — `tableAlias` is string-interpolated.

**Fix:** Validate `column` against a whitelist of known column names, or refactor to use parameterized column references.

---

### F18: In-Memory Pagination (P18)

**Severity: HIGH — ALL rows loaded before pagination**

**File:** `report.routes.js:212-216`

```js
let paginatedRows = safeRows;
if (page && pageSize) {
  const start = (page - 1) * pageSize;
  paginatedRows = safeRows.slice(start, start + pageSize);
}
```

Every report loads ALL matching rows into memory, then uses `.slice()` for pagination. No query function applies `LIMIT/OFFSET`. Combined with `pageSize` max of 10,000, this can consume significant memory for reports with 100K+ rows.

**Fix:** Add `LIMIT ? OFFSET ?` parameters to all aggregate query functions, or at minimum add a server-side row cap.

---

### F19: `applyRowFilters` Checks Wrong Column Names (P19)

**Severity: MEDIUM — Category/cashier filters silently become no-ops**

**File:** `report.routes.js:49-53,69`

```js
// line 52 — checks for integer category_id
if (row.category_id !== filterValue) return false;
```

Many SQL queries do NOT select `category_id` — they join `item_categories c` and output `c.name AS category_name` (a string). The filter checks an integer column that doesn't exist in the result set, so ALL rows fail the check, returning zero results. Same for `cashier_id` (line 69) — queries output `u.full_name AS cashier`, not the raw ID.

**Fix:** Either (1) ensure all queries SELECT the raw ID columns alongside the name labels, or (2) change `applyRowFilters` to accept column name mappings.

---

### F20: Export Endpoint Omits Most Active Filters (P20)

**Severity: LOW — Export data is correct but UI misleads user**

**File:** `report.routes.js:259`

```js
filters: { from: start_date, to: end_date }
```

The export header/PDF title only shows date range. All other active filters (customer_id, supplier_id, payment_type, status, warehouse_id, etc.) are silently omitted from the export display, giving users no visual confirmation that other filters were applied.

**Fix:** Include ALL active filter key-value pairs in the export metadata.

---

### F21: `/export-rows-stream` Non-Functional for Real Data (P21)

**Severity: HIGH — Parses JSON from URL query string**

**File:** `report.routes.js:310-311`

```js
const rows = JSON.parse(decodeURIComponent(req.query.rows || '[]'));
const colDefs = JSON.parse(decodeURIComponent(req.query.columns || '[]'));
```

URL query strings are limited to ~2KB on most servers. For any dataset with more than a few rows, this endpoint will fail with "414 URI Too Long". The endpoint name claims "stream" but does no actual streaming.

**Fix:** Accept data via POST body or a temporary file reference instead of URL query params.

---

### F22: `getCashierPerformance` GROUP BY Non-Existent Column (P22)

**Severity: HIGH — Runtime crash**

**File:** `reportService.js:105`

```js
GROUP BY u.id, u.name
```

The actual `users` table schema does NOT have a `name` column. It has `full_name` and `username`. The SELECT uses `COALESCE(u.full_name, u.username)` as the display name, but then GROUP BY references `u.name` — SQLite throws `no such column: u.name`.

**Confirmed by schema audit:** The `users` table has columns: `id`, `username`, `password_hash`, `role`, `is_active`, `created_at`, `updated_at`, `full_name`, `last_login_at`, `mfa_secret`, `mfa_enabled`, `can_view_updates`, `branch_id`, `page_permissions`, `pin_code`. No `name` column.

**Fix:** Change `GROUP BY u.id, u.name` to `GROUP BY u.id, u.full_name`.

---

### F23: `getSalesSummary` IgnorUser Cost Method (P23)

**Severity: MEDIUM — Chart data always uses WACC**

**File:** `reportService.js:14`

```js
const costCol = getCostColumn("wacc");
```

`getSalesSummary` always uses WACC cost regardless of the user's chosen cost method (FIFO/LIFO/last_purchase). All sales summary charts reflect WACC-only data.

**Fix:** Accept `cost_method` parameter and pass to `getCostColumn()`.

---

### F24: `getProfitLoss` Incomplete Cost Fallback Chain (P24)

**Severity: MEDIUM — Skips 4 cost sources**

**File:** `reportService.js:159-161` and `192-196`

```js
// Line 159-161 — Default (WACC) case:
COALESCE(il.cost_wacc, it.purchase_price, 0)

// Compare with getCostColumn() in helpers.js lines 214-215 (7 levels):
COALESCE(sl.wacc, sl.last_purchase_cost, il.cost_wacc, il.cost_fifo, il.cost_lifo, il.cost_last_purchase, it.purchase_price, 0)
```

The reportService version only has 3 fallback levels compared to 7 in the canonical `getCostColumn()`. It skips: `il.cost_fifo`, `il.cost_lifo`, `il.cost_last_purchase`, `sl.wacc`, `sl.last_purchase_cost`. If `il.cost_wacc` is NULL/0 but one of the skipped cost sources has a value, profit/loss calculations are wrong.

**Fix:** Use the canonical `getCostColumn(opts.cost_method)` from helpers.js instead of inline COALESCE chains.

---

### F25: `getInventoryValuation` Arbitrary Multi-Warehouse Values (P25)

**Severity: HIGH — Wrong valuation for multi-warehouse setups**

**File:** `reportService.js:69-70`

```sql
SELECT i.id, i.name, ..., COALESCE(sl.wacc, sl.last_purchase_cost, i.purchase_price, 0) AS cost_price
FROM items i
LEFT JOIN stock_levels sl ON sl.item_id = i.id
GROUP BY i.id
```

The GROUP BY is `i.id` (single item), but `sl.wacc` and `sl.last_purchase_cost` come from `stock_levels` which has **multiple rows per item** (one per warehouse). These non-aggregated columns pick an ARBITRARY value from one warehouse row instead of computing the weighted average across all warehouses.

**Fix:** Use an aggregating subquery: `(SELECT AVG(wacc) ... GROUP BY item_id)` or join at the item+warehouse level.

---

### F26: `inventoryAging` Last Movement Date Wrong for Multi-Warehouse (P26)

**Severity: MEDIUM — Cross-warehouse date pollution**

**File:** `inventory.js:225-226`

```sql
LEFT JOIN stock_movements sm ON sm.item_id = it.id AND sm.deleted_at IS NULL
```

The JOIN doesn't include `sl.warehouse_id = sm.warehouse_id`. If the same item exists in warehouse A (with recent movement) and warehouse B (no recent movement), BOTH get the recent movement date from warehouse A. The `warehouse_id` filter on line 238 only filters `sl.warehouse_id`, not `sm.warehouse_id`.

**Fix:** Add `AND sm.warehouse_id = sl.warehouse_id` to the JOIN condition.

---

### F27: `marginHealth` Completely Ignores All Parameters (P27)

**Severity: MEDIUM — Always returns same data**

**File:** `sales.js:808`

```js
function marginHealth(startDate, endDate, opts = {}) {
  return getItemsBelowMargin();
}
```

Date range and ALL filter options are completely ignored. The function always returns the same data regardless of when it's called or what filters are applied.

**Fix:** Accept and apply `opts.min_margin_percent`, `opts.category_id`, and date filters, or document as static snapshot.

---

### F28: `periodComparison` No Validation When Period 2 Missing (P28)

**Severity: MEDIUM — Silently returns empty, no user feedback**

**File:** `sales.js:473-474`

When `opts.period2_start` or `opts.period2_end` is missing, the function returns `[]`. The frontend may receive an empty array and show "No data" instead of a clear message like "Comparison requires two periods to be configured."

**Fix:** Return `{ error: "missing_period2" }` structure or have the route handler check for period2 params before calling the query.

---

### F29: `/expiring-soon` Valid Status + Short Lookahead Returns Empty (P29)

**Severity: MEDIUM — Contradictory SQL conditions**

**File:** `report.routes.js:550`

```sql
-- When status = 'valid':
expiry_date > date('now', '+14 days') 
AND expiry_date <= date('now', '+' || ? || ' days')
```

If the user provides `days=3`, this becomes: `> +14 days AND <= +3 days` — a contradiction that returns zero rows. The minimum `days` value is 1 (line 534 `days = Math.max(1, days)`), so this is easily triggered.

**Fix:** For `status='valid'`, change the first condition to `expiry_date > date('now')` (any future expiry) instead of `+14 days`.

---

### F30: PDFV3 Duplicate Overlapping Rectangles (P30)

**Severity: LOW — Visual artifact, title background ~2x darker**

**File:** `exportService.js:437-439`

```js
doc.rect(40, 20, doc.page.width - 80, 35).fill("#f8fafc");         // line 437 — draws AND fills
doc.roundedRect(40, 20, doc.page.width - 80, 35, 4);               // line 438 — draws rounded path
doc.fill("#f8fafc");                                                 // line 439 — fills the rounded path
```

Line 437 fills with `#f8fafc`. Line 438 adds a rounded rect path. Line 439 fills again. The result is a double-filled `#f8fafc` region that renders ~2x darker (~`#f1f5f9` visually).

**Fix:** Remove lines 437-438 (keep only one rect draw+fill), or use `doc.roundedRect(...)` with `.fillAndStroke()`.

---

### F31: 4 Truly Orphan Reports — Inaccessible From Any API (P31)

**Severity: HIGH — Dead code, query functions exist but unreachable**

These 4 report slugs have:
- ✅ Dispatcher query functions in `index.js`
- ✅ REPORT_COLUMN_KEYS definitions in `columns.js`
- ✅ REPORT_TITLES entries
- ❌ NO classification reference in any source
- ❌ NO slugSourceMap entry (backward compat)
- ❌ NO legacy `REPORT_REGISTRY.reports[]` entry
- **Result: INACCESSIBLE from any public API endpoint**

| Slug | Query Function | Source File |
|---|---|---|
| `cheque-listing` | `chequeListing()` | `queries/cheques.js` |
| `bank-transactions` | `bankTransactions()` | `queries/cheques.js` |
| `bank-summary` | `bankSummary()` | `queries/cheques.js` |
| `employee-adjustments` | `employeeAdjustments()` | `queries/employees.js` |

**Fix:** Either (1) add a `cheques` source with 3 classifications and add `employee-adjustments` classification to `employees` source, or (2) remove the dead code.

---

### F32: 5 Duplicate Legacy Report IDs (P32)

**Severity: LOW — Potential React key conflicts**

**File:** `registry.js` — legacy `REPORT_REGISTRY.reports[]` array

| ID | First (Treasury/Payment-Flow) | Second (Customers/Suppliers) |
|---|---|---|
| R66 | `payment-flow-summary` | `ar-aging` |
| R67 | `payment-flow-ledger` | `top-customers` |
| R68 | `payment-flow-by-doc-type` | `collection-efficiency` |
| R69 | `payment-flow-by-direction` | `customer-loyalty` |
| R70 | `payment-flow-running` | `ap-aging` |

The legacy route `REPORT_REGISTRY.reports.find(r => r.slug === slug)` returns the first match (correct by slug, not ID). But when IDs are used as React keys in the Reports Center grid or for sorting/display ordering, duplicate IDs cause key conflicts and incorrect ordering.

**Fix:** Renumber the second set of duplicates to unique IDs (R72-R76).

---

### F33: 87% of Reports Missing Descriptions (P33)

**Severity: LOW — UI shows empty description areas for 91 reports**

**File:** `columns.js` — `REPORT_DESCRIPTIONS` object

Only 14 reports have descriptions defined:
- ar-aging, top-customers, collection-efficiency, customer-loyalty, ap-aging, supplier-reliability, customer-balance-list, supplier-balance-list, employee-list, employee-deductions, employee-bonuses, employee-advances, employee-payroll, employee-full-history

**Fix:** Add Arabic descriptions for all 105 report slugs.

---

### F34: Client-Side i18n Bug — `a()` Function Compared to String (NEW)

**Severity: HIGH — 4 instances of always-false comparison**

**File:** `SourceWorkspacePage.jsx`

```jsx
// Lines 406, 415, 429, 1071:
{a(filter.label_key) === 'payment_type' && ...}
```

The code calls the i18n `a()` function (Arabic translation lookup) and compares its RESULT to the English string `'payment_type'`. Since `a('payment_type')` returns the Arabic translation (e.g., `"نوع الدفع"`), this comparison is ALWAYS false. The intended code was:

```jsx
{filter.label_key === 'payment_type' && ...}
```

This means all payment-type-specific rendering logic (multi-select payment filter UI, special payment method display) is **never triggered**. Users always see the default filter rendering for payment_type.

**Fix:** Remove the `a()` wrapper on all 4 occurrences.

---

### F35: Client Config Corruption — Detailed Breakdown (P3)

**Severity: HIGH — 3 corrupted entries cause rendering errors**

**File:** `reportsCenterConfig.js`

**1. `purchase-returns` CLASSIFICATIONS (lines ~188-220):**
```js
purchase-returns: {
  summary: {
    id: "summary",
    label: "ملخص مرتجع المشتريات",
    ...
  },
  detailed: { ... },
  by-supplier: { ... }
}
```
Instead of a flat array of classification objects with `id`, `query`, `label`, `filters`, this contains a nested object structure. The `SourceWorkspacePage` iterates `Object.entries()` or expects an array — either way, it gets the wrong structure.

**2. `sales-returns` CLASSIFICATIONS (lines ~262-294):**
Same pattern as purchase-returns — classification objects instead of filter definitions.

**3. `installments` CLASSIFICATIONS (lines ~429-461):**
```js
installments: [  // ← starts mid-line after employee classifications
  { id: "plans", ... },
  { id: "collections", ... },
  ...
]
```
The array starts correctly, but the preceding `employee` entry's closing brace and comma are likely malformed, causing a parse error or incorrect structure for the `installments` key.

**4. `PREVIEW_COLUMNS` corruption:**
Each of the 3 corrupted sources also has corrupted `PREVIEW_COLUMNS` entries containing classification-config objects instead of column arrays.

**5. `GHOST_ROWS` corruption (lines ~148-152):**
Owner-statement ghost rows are present but may reference non-existent columns.

**Fix:** Reconstruct all 3 entries with proper array structures matching the pattern used by other sources (e.g., `sales`, `items`).

---

### F36: Theme System Violations — Hardcoded Colors Throughout Reports UI

**Severity: MEDIUM-HIGH — Theme changes break UI appearance**

The project's AGENTS.md mandates: "NEVER hardcode Tailwind color tokens" and "always use semantic theme variable classes." The reports system extensively violates this. Here is an exhaustive inventory:

**In `reportsCenterParts.jsx` — COL_TYPE_STYLE (lines ~338-344):**
```js
const COL_TYPE_STYLE = {
  money: "text-emerald-600 font-semibold",       // ← hardcoded
  number: "text-indigo-600 font-semibold",        // ← hardcoded
  percent: "text-blue-600 font-semibold",         // ← hardcoded
  date: "text-amber-600",                         // ← hardcoded
  string: "text-slate-700",                       // ← hardcoded
};
```

**In `OwnerStatementPage.jsx` — THEME_CLASSES (lines ~207-278):**
- `bg-emerald-600`, `bg-blue-600`, `bg-indigo-600`, `bg-cyan-600`, `bg-purple-600`, `bg-rose-600`, `bg-amber-600`
- `bg-slate-900`, `bg-slate-950`, `border-slate-800`
- `text-rose-600`, `text-emerald-600`, `text-rose-700`, `text-emerald-700`
- `hover:border-blue-400`, `hover:border-indigo-400`, etc.
- `bg-slate-950/65 backdrop-blur-xl` on modal backdrops
- `bg-white` on modal content, sidebars, and containers (~15+ occurrences)

**In `SourceWorkspacePage.jsx`:**
- `bg-white` on the main content area
- `bg-slate-50` on alternating rows
- `bg-slate-100` on total/summary rows
- `text-slate-600` on secondary text
- `border-slate-200` on table borders
- `bg-blue-50` on selected/highlighted rows
- `bg-gray-50` on filter sections

**In `ReportWorkspacePage.jsx`:**
- Same patterns as SourceWorkspacePage

**In `reportsCenterConfig.js` — SOURCE_COLORS:**
```js
const SOURCE_COLORS = {
  sales: "#10b981",        // emerald-500
  purchases: "#3b82f6",    // blue-500
  inventory: "#8b5cf6",    // violet-500
  ...
};
```

#### Specific Problem Areas the User Called Out:

**A) Dropdowns/Popovers with Fixed White Background:**
- All `<select>` elements and custom dropdown components use `bg-white` directly
- Filter dropdowns in `SourceWorkspacePage.jsx`: `<select className="bg-white border ...">`
- Column visibility dropdown: `bg-white shadow-lg rounded-lg`
- These don't adapt to dark themes — white background persists even in dark mode

**B) Bottom Total Row with Fixed Background:**
- Table footer/summary rows use `bg-slate-100` or `bg-gray-50`
- In `SourceWorkspacePage.jsx` and `ReportWorkspacePage.jsx`, the totals row at the bottom of data tables has hardcoded `bg-slate-100` background
- This breaks in dark themes (light gray on dark background = low contrast)

**C) Alternating Row Colors:**
- `even:bg-gray-50` or `odd:bg-slate-50` patterns on table rows
- These should use theme-aware alternatives like `even:bg-bg-base`

**D) Modal/Overlay Backdrops:**
- `bg-white` on modal content containers
- `bg-black/50` or `bg-slate-950/65` on overlays
- Should use `bg-bg-overlay` or similar theme variables

**Fix:** Replace ALL hardcoded color classes with theme CSS variable equivalents:
| Hardcoded | Replace With |
|---|---|
| `bg-white` | `bg-bg-surface` |
| `bg-slate-50`, `bg-gray-50` | `bg-bg-base` |
| `bg-slate-100`, `bg-gray-100` | `bg-bg-overlay` or `bg-bg-base` |
| `text-slate-600`, `text-gray-600` | `text-text-secondary` |
| `text-slate-700`, `text-gray-700` | `text-text-primary` |
| `border-slate-200`, `border-gray-200` | `border-border-subtle` |
| `text-emerald-600`, `text-rose-600` | `text-success-text`, `text-danger-text` |
| `bg-emerald-600`, `bg-blue-600` | `bg-primary` or `bg-success-bg` |
| `shadow-lg`, `shadow-sm` | `shadow-card`, `shadow-elevated`, `shadow-modal` |

---

### F37: Owner Statement Page — 15 Specific Findings (Cross-Agent Deep Dive)

**Severity: MEDIUM — Standalone page with theme/i18n issues**

Detailed findings from the Owner Statement deep-dive:

| # | Finding | Severity | Details |
|---|---|---|---|
| OS1 | Hardcoded Tailwind colors throughout | MEDIUM | THEME_CLASSES object lines 207-278 has `bg-emerald-600`, `bg-blue-600`, etc. |
| OS2 | No i18n support (Arabic-only) | HIGH | All text hardcoded as Arabic string literals; `useTranslation()` not imported |
| OS3 | "ج.م" hardcoded ~15 places | LOW | Currency symbol not localized |
| OS4 | Raw `window.print()` instead of PrintPreviewModal | LOW | Project spec requires PrintPreviewModal conversion |
| OS5 | No loading state for snapshot list | LOW | `loadSnapshots()` does not set loading state |
| OS6 | No error boundary | LOW | Missing error boundary around 1240-line component |
| OS7 | Snapshot comparison can compare snapshot with itself | LOW | Both dropdowns show all snapshots, no self-validation |
| OS8 | Payment flow details fragile string matching | LOW | Falls back to `method_name` string comparison when `method_id` missing |
| OS9 | Timezone hardcoded to Africa/Cairo | LOW | `Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" })` |
| OS10 | `rowsTotalForMetric` fragile fallback chain | LOW | `row.value ?? row.balance ?? row.total_due ?? row.amount ?? 0` |
| OS11 | Only ONE CSS variable used correctly | MEDIUM | Only `bg-[var(--bg-base)]` on line 709; everything else hardcoded |
| OS12 | Missing `bg-white` → theme variable migration | MEDIUM | Modal content, sidebar, etc. use `bg-white` directly |
| OS13 | Permission model well-implemented | ✅ OK | Route + middleware + UI levels all correct |
| OS14 | Data sources correct | ✅ OK | 5 endpoints, synchronous, well-structured |
| OS15 | Audit logging on mutations | ✅ OK | Proper audit trail for save/lock |

---

### F38: Database Schema vs Query Mismatches (Schema Agent)

**Severity: HIGH — Confirmed schema/query discrepancies**

From reading all 168+ migration files and comparing against query SQL:

| Finding | Schema Reality | Query Expectation | Impact |
|---|---|---|---|
| `u.name` in getCashierPerformance | `users` has `full_name` and `username`, NO `name` | `GROUP BY u.id, u.name` | **RUNTIME CRASH** |
| `net_total` on invoices | No `net_total` column exists | Several queries SELECT `net_total` | Computed as `subtotal - discount + increase`, stored in variable not column |
| `invoice_snapshots` table | Does NOT exist | Several queries reference cost snapshots | Cost data stored directly on `invoice_lines` columns (`cost_wacc`, `cost_fifo`, etc.) |
| `vat_rates` / `tax_rates` table | Does NOT exist | Tax queries reference it | Tax rates stored in `settings.tax_rate` and per-invoice `tax_rate` |
| `item_barcodes` table | Does NOT exist | Some queries may reference it | Barcodes on `items.barcode` (single) and `item_units.barcode` (per-unit) |

**Key schema facts for report query writers:**
- Invoice cost data is on `invoice_lines.cost_wacc`, `.cost_fifo`, `.cost_lifo`, `.cost_last_purchase` (not a separate snapshots table)
- `invoices.total` = grand total (after tax if applicable), `invoices.subtotal` = before discount, `invoices.discount` = discount amount, `invoices.increase` = additions. Net = `subtotal - discount + increase`
- `users` has `full_name` (display name) and `username` (login), NOT `name`
- `items` has `min_stock_qty`, NOT `min_stock`
- `stock_levels` has `wacc` and `last_purchase_cost` per item+warehouse (unique on pair)

---

### F39: Cross-Reference Audit — Complete Mapping Summary

**Severity: INFO — 6 categories of mapping health**

From tracing ALL 105 slugs through every system (dispatcher, columns, classifications, backwardCompatMaps, legacy reports):

| Category | Count | Status |
|---|---|---|
| Perfect alignment (all refs valid) | 84 | ✅ |
| Legacy-only (work via old API only) | 8 | ⚠️ Needs backward compat |
| New-API-only (work via new API only) | 4 | ⚠️ Added recently, no legacy entry |
| Broken clsMap (point to non-existent) | 5 | ❌ P12 |
| Truly orphan (inaccessible from any API) | 4 | ❌ P31 |
| Wrong query mapping (compat resolves to different query) | 2 | ⚠️ payment-method-flow → cash-flow, reconciliation-exceptions → cash-consistency |

---

### F40: Reports Store — Clean (Confirmed)

**Severity: ✅ No issues found**

**File:** `client/src/stores/reportsStore.js` (109 lines)

The Zustand store is the cleanest file in the reports system:
- Per-report preferences keyed by composite key
- Column visibility, order, widths persisted via localStorage
- Favorites, recents, saved presets
- Sidebar toggle state
- All localStorage reads wrapped in try/catch
- **No issues found** — confirmed by 6-agent deep dive

---

### F41: Zero Test Coverage for Reports System

**Severity: CRITICAL — System fragility throughout**

Out of **129 test files** across the project:
- **Server reports tests**: **1 file** (`server/tests/reports.test.js` — 133 lines) that tests only 5 functions (1 query + 4 reportService)
- **Client reports tests**: **2 files** — API service layer (`162 lines`) and Zustand store (`143 lines`)
- **Query functions**: ~1% coverage (1 of ~90+ query functions tested)
- **Registry, columns, dispatcher, helpers**: **ZERO tests**
- **Route handler (report.routes.js)**: **ZERO tests** (no supertest usage)
- **Export service (exportService.js)**: **ZERO tests** (577 lines untested)
- **Client UI components (8 files)**: **ZERO tests**

| Component | Lines | Tested? |
|---|---|---|
| `registry.js` | 869 | ❌ |
| `columns.js` | 1034 | ❌ |
| `index.js` (dispatcher) | 172 | ❌ |
| `helpers.js` | 259 | ❌ |
| `queries/sales.js` | 890 | ❌ (0/17 functions) |
| `queries/purchases.js` | 336 | ❌ (0/9 functions) |
| `queries/inventory.js` | 660 | ❌ (0/15 functions) |
| `queries/accounts.js` | 554 | ✅ (1/11 functions: profitLoss) |
| `queries/installments.js` | 312 | ❌ |
| `queries/expenses.js` | 95 | ❌ |
| `queries/revenues.js` | 94 | ❌ |
| `queries/employees.js` | 215 | ❌ |
| `queries/treasury.js` | 225 | ❌ |
| `queries/tax.js` | 188 | ❌ |
| `queries/profit.js` | 169 | ❌ |
| `queries/cheques.js` | 57 | ❌ |
| `queries/audit.js` | 70 | ❌ |
| `queries/warehouses.js` | 52 | ❌ |
| `queries/customers.js` | 118 | ❌ |
| `queries/users.js` | 87 | ❌ |
| `report.routes.js` | 653 | ❌ |
| `exportService.js` | 577 | ❌ |
| `reportService.js` | 244 | ✅ (4/6 functions partial) |
| Client UI (8 files) | ~3000 | ❌ |

**Total server-side report logic tested: < 2%. Total client UI tested: 0%.**

---

### F42: Smart Improvement Suggestions for the Reports System

Based on the comprehensive deep-dive, here are architectural improvements that would significantly enhance the reports system:

#### S1 — Single Source of Truth for Config (Eliminate P2/P5/P7/P10)

**Problem:** Config is duplicated across 3+ files (server registry, server legacy array, client config). Labels in 7 places. Filters defined independently in each.

**Solution:** 
1. Make the server `registry.js` the SINGLE source of truth for ALL report metadata (sources, classifications, columns, labels, filters)
2. Add a new API endpoint `GET /api/reports/system-config` that serves the complete config to the client
3. Remove `reportsCenterConfig.js` from the client entirely — replace with API-fetched config
4. Consolidate ALL Arabic labels into `AR_LABELS` in `columns.js` and serve via API

#### S2 — Eliminate the Two-System Duality

**Problem:** Legacy slug-based system and new source-classification-based system run in parallel. Backward compat maps (slugSourceMap + clsMap) add complexity and have broken entries.

**Solution:**
1. Complete the migration: ensure EVERY slug has a source + classification mapping
2. Remove the legacy `REPORT_REGISTRY.reports[]` array and `slugSourceMap`/`clsMap`
3. Use only `resolveQuerySlug(sourceKey, classificationId, dataMode)` for all report routing
4. Make `/api/reports/run/:slug` a thin wrapper that looks up the slug → source/classification compat and delegates to the new endpoint

#### S3 — Server-Side Pagination and Filtering

**Problem:** ALL rows loaded into memory, then paginated in JS. `applyRowFilters` does post-query filtering on wrong columns.

**Solution:**
1. Add `LIMIT ? OFFSET ?` to ALL aggregate report queries
2. Pass `page`/`pageSize` from route handler into query functions
3. Remove `applyRowFilters` from route handler — move ALL filtering to SQL WHERE clauses
4. Add `COUNT(*) OVER()` or a separate count query for total row count

#### S4 — Normalized Return Shapes for All Query Functions

**Problem:** Most functions return flat arrays, but `profitByCategory` returns `{ rows, summary }`. Some return undefined on error, others return empty arrays.

**Solution:**
1. Define a standard return type: `{ rows: [], meta: { total_rows, page, page_size, ... } }`
2. Wrap ALL query function calls in a normalization layer in `index.js`
3. Have the route handler always expect the normalized shape

#### S5 — Add Report Descriptions and User Guidance

**Problem:** 87% of reports have no description. Users see empty description areas or can't understand what a report does.

**Solution:**
1. Add Arabic descriptions for all 105 report slugs in `REPORT_DESCRIPTIONS`
2. Show descriptions as tooltips or info panels in the Reports Center grid
3. Add "what does this report show?" help icons on workspace pages

#### S6 — Smart Default Filters Per Classification

**Problem:** All classifications show the same generic filter set. A user running "Slow Moving Items" doesn't need a payment_type filter.

**Solution:**
1. Review each classification's `dimensions` array and keep ONLY relevant filters
2. Example: `slow-moving` → only `warehouse_id` and `category_id` (remove payment_type, cashier_id, status, etc.)
3. Add `required: true` to filters that MUST be set (e.g., date range for time-series reports)

#### S7 — Report Caching Layer

**Problem:** Heavy aggregate queries (profit-loss, inventory-valuation) run on every page load. No caching.

**Solution:**
1. Add an in-memory cache (e.g., `node-cache` or a simple Map with TTL)
2. Cache keyed by `slug + JSON.stringify(opts)`
3. Default TTL of 30-60 seconds for most reports
4. Allow manual cache busting via query param (`?nocache=true`)

#### S8 — CSV Export Support

**Problem:** Only Excel, PDF, and DOCX exports exist. No CSV export.

**Solution:**
1. Add `exportRowsToCsv()` to `exportService.js`
2. Add `"csv"` to the allowed format list in `report.routes.js`
3. Set proper MIME type (`text/csv`) and encoding for Arabic text

#### S9 — Column Customization Persistence

**Problem:** `reportsStore.js` already supports column visibility/order/width persistence, but it's unclear if the workspace pages fully implement it.

**Solution:**
1. Verify `SourceWorkspacePage` and `ReportWorkspacePage` call `setColumnVisibility()` / `setColumnOrder()` / `setColumnWidth()` on column changes
2. Add a "Reset to defaults" button for column layout
3. Add column freeze/pin support for wide tables

#### S10 — Unified Theme System Migration

**Problem:** Hardcoded colors throughout (F36). Theme changes don't properly affect the reports UI.

**Solution:**
1. Create a comprehensive theme audit for ALL reports UI files
2. Replace ALL `bg-{color}-{number}` with theme CSS variable classes
3. Replace ALL `text-{color}-{number}` with `text-text-primary`/`text-text-secondary`
4. Replace ALL `border-{color}-{number}` with `border-border-normal`/`border-border-subtle`
5. Test with ALL available themes (emerald, slate, amber, rose, indigo, blue) before shipping

#### S11 — Streaming Export for Large Datasets

**Problem:** All exports write to temp file → `readFileSync` → send. Doubles memory usage.

**Solution:**
1. For Excel: use ExcelJS streaming writer
2. For PDF: use PDFKit streaming (already somewhat streaming but buffers internally)
3. For CSV: stream directly to response with `res.write()` for each row
4. Remove temp file intermediate step entirely

#### S12 — Automated Testing Framework for Reports

**Problem:** < 2% test coverage. Every fix risks regression.

**Solution:**
1. Create a test helper that seeds a known database state
2. Write parameterized tests for EVERY query function: call with known data → assert exact output rows and columns
3. Write integration tests for EVERY route endpoint: HTTP request → assert response shape, status codes, error handling
4. Write snapshot tests for EVERY export format
5. Add CI pipeline to run report tests on every PR

#### S13 — Report Generation History & Scheduling

**Problem:** Reports are always "live." No ability to run a report at midnight and view the snapshot later.

**Solution:**
1. Add a `report_snapshots` table (similar to `owner_statements`)
2. Allow "Run and Save" for any report
3. Add scheduled report generation (daily/weekly/monthly via node-cron)
4. Add comparison view (current vs saved snapshot)

#### S14 — Chart Integration for Time-Series Reports

**Problem:** Reports like daily-sales, period-comparison, and profit-by-period are inherently time-series but show only tabular data.

**Solution:**
1. Add chart rendering (line/bar/pie) to time-series reports
2. Use a lightweight chart library (Chart.js or Recharts) already in the project if available
3. Allow toggle between table and chart view
4. Pre-compute chart data in the query function return (e.g., `{ rows: [...], chart: { labels: [...], datasets: [...] } }`)

#### S15 — Consistent Currency Formatting

**Problem:** Currency symbols are hardcoded ("ج.م") in OwnerStatementPage and inconsistently formatted across reports.

**Solution:**
1. Read currency settings from `settings.currency_symbol` and `settings.currency_code`
2. Use a centralized `formatMoney(amount)` utility that respects the DB settings
3. Apply consistent decimal places from `settings.decimal_places`

---

### F43: Hardcoded Colors — Complete Theme Violation Database

This section inventories EVERY hardcoded color found across the reports system, organized by file and severity.

#### Legend
| Priority | Meaning |
|---|---|
| 🔴 P0 | Breaks theme completely — white on dark = invisible, or dark on light = unreadable |
| 🟡 P1 | Visual inconsistency — color doesn't adapt but is still readable |
| 🟢 P2 | Minor — decorative color, low impact on usability |

---

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

---

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

---

#### `client/src/pages/reports/ReportWorkspacePage.jsx`

| Line(s) | Code | Priority | Theme Fix |
|---|---|---|---|
| ~60 | `bg-white` content area | 🔴 P0 | `bg-bg-surface` |
| ~65 | `bg-gray-50` table header | 🟡 P1 | `bg-bg-base` |
| ~70 | `text-gray-600` labels | 🟡 P1 | `text-text-secondary` |
| ~75 | `border-gray-200` dividers | 🟢 P2 | `border-border-subtle` |
| ~80 | `bg-blue-100` highlight | 🟡 P1 | `bg-primary-100` |
| ~85 | `shadow` on cards | 🟢 P2 | `shadow-card` |

---

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

---

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

#### `client/src/pages/reports/reportsCenterConfig.js`

| Line(s) | Code | Priority | Theme Fix |
|---|---|---|---|
| ~30 | `SOURCE_COLORS` — hex colors for each source | 🟢 P2 | Could derive from theme |
| ~338 | `COL_TYPE_STYLE` — hardcoded text colors (in reportsCenterParts.jsx) | 🟡 P1 | Theme variables |

---

### How to Fix Themes Systematically

1. **Replace all `bg-white` with `bg-bg-surface`** — This is the most impactful change. `bg-white` is used ~30+ times across reports files.

2. **Replace all total/summary row backgrounds** (`bg-slate-100`, `bg-gray-100`, `bg-gray-50`) with **`bg-bg-base`** or **`bg-bg-overlay`**.

3. **Replace all dropdown/popover backgrounds** (`bg-white` on dropdowns, selects, popovers) with **`bg-bg-surface`** + **`border-border-normal`**.

4. **Replace modal backdrop overlays** (`bg-black/50`, `bg-slate-900/50`, `bg-slate-950/65`) with **`bg-bg-overlay`**.

5. **Replace type-based text colors** (`text-emerald-600` for money, `text-indigo-600` for numbers) with semantic equivalents or remove color coding entirely (let the theme handle text hierarchy).

6. **Replace `shadow-*` with `shadow-card`/`shadow-elevated`/`shadow-modal`** as defined in the theme system.

7. **Audit `COL_TYPE_STYLE`** in `reportsCenterParts.jsx` — these control how every data cell in every report table is styled. They must use theme variables.

8. **Test with all 6 themes** (emerald, slate, amber, rose, indigo, blue) before shipping any theme fix. The `colorThemeOverrides.css` file may need updates for new theme-aware classes.

| Report Slug | Reason |
|---|---|
| `vat-filing-summary` | SQL aggregates everything into one row |
| `income-statement` / `profit-loss` | by design — it's a structured P&L statement |
| `bank-summary` | one row per bank, could be 1 if only 1 bank |

These are "useless" per the user's definition if they show only 1 row. However, `income-statement` has 4 sections, so it's actually multiple rows with section labels.

---

## 5. Fix Checklist

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
- [ ] `sales/tax` — set `supportsScope: false`
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
- [ ] All `purchases` classifications — remove inline filters that duplicate dimensions
- [ ] All `suppliers` classifications — remove inline filter duplicates
- [ ] All `customers` classifications — remove inline filter duplicates
- [ ] All `employees` classifications — remove inline filter duplicates
- [ ] All `items` classifications — remove inline filter duplicates
- [ ] All `warehouses` classifications — remove inline filter duplicates
- [ ] All `installments` classifications — remove inline filter duplicates
- [ ] All `expenses`/`revenues` classifications — remove inline filter duplicates
- [ ] All `users` classifications — remove inline filter duplicates
- [ ] All `payment-flow` classifications — remove inline filter duplicates

**Strategy:** Remove inline `filters` from classifications where the same keys exist in `dimensions`. Keep inline filters ONLY where they differ from dimensions (e.g., `required: true` on statement reports, or extra filters like `movement_type` that aren't in the pool).

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
- [ ] ~~Add classifications for `owner-statement` source~~ — **SKIP: Intentional design** (see §3.19)
- [ ] Add new source for `cheques` with classifications: cheque-listing, bank-transactions, bank-summary

### Phase 7: Fix Specific Bugs

- [ ] `reorder` — fix column `min_stock` → `min_stock_qty` (SQL outputs `min_stock_qty` but REPORT_COLUMN_KEYS expects `min_stock`)
- [ ] `cost-movements` — translate `movement_type` options from English to Arabic
- [ ] `expiry` source — add filter dimensions pool
- [ ] `vat-filing-summary` — make `net_vat` visible by default (it's the most important column)
- [ ] Remove `_detailExpenseQuery` and `_detailRevenueQuery` from query exports (internal functions exposed)

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
- [ ] **Alternative:** If the fallback-to-detail behavior is desired, create explicit `detailed` query functions/classifications and let the user choose, rather than silently switching query output

### Phase 11: Fix Backward Compat Mappings (P12)

**CRITICAL** — New API returns 404 for 5 legacy slugs:

- [ ] `registry.js` — Add `shifts` classification to `employees` source (with query for shift-history/exceptions data)
- [ ] `registry.js` — Add `user-activity` classification to `employees` source (with query for audit-log/user-activity data)
- [ ] `registry.js` — Create `cheques` source with classifications: `cheque-listing`, `bank-transactions`, `bank-summary`
- [ ] OR remove the 5 broken entries from `clsMap` if the legacy dispatcher is the only path needed

### Phase 12: Fix SQL/Column Key Mismatches (P13 + P14)

- [ ] `daily-sales` — Add `total_tax` and `net_total` to REPORT_COLUMN_KEYS (or REPORT_EXTRA_KEYS hidden by default)
- [ ] `detailed-sales` — Add `net_total`, `tax_amount`, `tax_rate`, `tax_type` to REPORT_COLUMN_KEYS
- [ ] `sales-heatmap` — Remove `customer_id` from REPORT_COLUMN_KEYS (SQL doesn't return it)
- [ ] `reorder` — Fix column key: either rename to `min_stock_qty` or alias SQL to `min_stock`
- [ ] `installment-collections` — Add SQL join to return `method_name`, or remove from REPORT_COLUMN_KEYS
- [ ] `stock-valuation` — Standardize `name` → `item_name` for consistency with other reports

### Phase 13: Clean Up Internal Exports (P15)

- [ ] `queries/sales.js` — Remove `_detailSalesQuery` and `_detailItemSalesQuery` from `module.exports`
- [ ] `queries/purchases.js` — Remove `_detailPurchaseQuery` from `module.exports`
- [ ] Verify nothing imports these functions directly (grep for require/import of these names)

### Phase 14: Fix Route Handler Bugs (P17-P21, P29)

- [ ] `report.routes.js` — Add `LIMIT ? OFFSET ?` awareness (or at minimum a server-side row cap)
- [ ] `report.routes.js` — Fix `applyRowFilters` to match correct column names (`category_name` instead of `category_id`, `cashier` instead of `cashier_id`)
- [ ] `report.routes.js` — Include ALL active filters in export metadata, not just dates
- [ ] `report.routes.js` — Refactor `/export-rows-stream` to accept POST body instead of URL query params
- [ ] `report.routes.js` — Fix `/expiring-soon` valid-status query to use `> date('now')` instead of `+14 days`
- [ ] `report.routes.js` — Add `close` event listener for temp file cleanup (alongside `finish` and `error`)

### Phase 15: Fix Query Function Bugs (P22-P28)

- [ ] `reportService.js:105` — Change `GROUP BY u.id, u.name` to `GROUP BY u.id, u.full_name`
- [ ] `reportService.js:14` — Make `getSalesSummary` accept `cost_method` parameter (not hardcoded WACC)
- [ ] `reportService.js:159-161` — Use canonical `getCostColumn()` from helpers.js instead of inline COALESCE (3 levels vs 7)
- [ ] `reportService.js:69-70` — Fix `getInventoryValuation` non-aggregated stock_levels columns (use AVG or subquery)
- [ ] `inventory.js:225-226` — Add `AND sm.warehouse_id = sl.warehouse_id` to stock_movements JOIN
- [ ] `sales.js:808` — Fix `marginHealth` to accept and apply date/filter params (or document as static snapshot)
- [ ] `sales.js:473-474` — Fix `periodComparison` to validate period2 params and return meaningful error

### Phase 16: Fix Client-Side i18n Bug (P34)

- [ ] `SourceWorkspacePage.jsx:406` — Change `{a(filter.label_key) === 'payment_type' && ...}` to `{filter.label_key === 'payment_type' && ...}`
- [ ] `SourceWorkspacePage.jsx:415` — Same fix
- [ ] `SourceWorkspacePage.jsx:429` — Same fix
- [ ] `SourceWorkspacePage.jsx:1071` — Same fix

### Phase 17: Fix Corrupted Client Config (P3 detail)

- [ ] `reportsCenterConfig.js` — Reconstruct `purchase-returns` CLASSIFICATIONS as flat array matching pattern from `sales`/`items`
- [ ] `reportsCenterConfig.js` — Reconstruct `sales-returns` CLASSIFICATIONS as flat array
- [ ] `reportsCenterConfig.js` — Reconstruct `installments` CLASSIFICATIONS as flat array
- [ ] `reportsCenterConfig.js` — Fix PREVIEW_COLUMNS entries for all 3 corrupted sources
- [ ] `reportsCenterConfig.js` — Fix GHOST_ROWS entries for owner-statement

### Phase 18: Theme System Overhaul (F36, F43)

**CRITICAL** — Fix all hardcoded colors across reports UI:

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
- [ ] `OwnerStatementPage.jsx` — Replace `window.print()` with `PrintPreviewModal` per project spec
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

- [ ] `report.routes.js` — Forward ALL active filters to export metadata (not just from/to dates)
- [ ] `exportService.js` — Render filter summary in PDF/DOCX headers

### Phase 23: PDF Export Visual Fix (P30)

- [ ] `exportService.js:437-439` — Fix duplicate overlapping rectangles: keep only ONE rect draw+fill

### Phase 24: Add Missing Report Descriptions (P33)

- [ ] `columns.js` — Add Arabic descriptions for all 91 reports missing REPORT_DESCRIPTIONS entries

### Phase 25: Long-Term Architecture Improvements (S1-S15)

These are strategic improvements from the smart suggestions. Prioritize by impact:

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

## Appendix: System Inventory

### All 20 Sources

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
| 19 | owner-statement | ❌ (intentional — see §3.19) | ❌ (intentional) | ❌ (dedicated page) |
| 20 | users | ✅ 3 classes | ✅ | ✅ |

### Legacy-Only Slugs (NOT in slugSourceMap — work via legacy `/api/reports/run/:slug` only)

**Expenses (4):**
- `expense-summary`, `detailed-expenses`, `expenses-by-category`, `expenses-by-payment`

**Revenues (4):**
- `revenue-summary`, `detailed-revenues`, `revenues-by-category`, `revenues-by-payment`

**Cheques (3):**
- `cheque-listing`, `bank-transactions`, `bank-summary`

**Installments (4):**
- `installment-plans`, `installment-collections`, `installments-by-customer`, `installment-delinquent`

**Warehouses (3):**
- `branch-transfers`, `warehouse-levels`, `warehouse-levels-summary`

**Employees (6):**
- `employee-adjustments`, `employee-list`, `employee-deductions`, `employee-bonuses`, `employee-advances`, `employee-payroll`, `employee-full-history`

**Profit (3):**
- `profit-by-category`, `profit-by-customer`, `profit-by-period`

**Customers (1):**
- `customer-balance-list`

**Suppliers (1):**
- `supplier-balance-list`

**Treasury (2):**
- `daily-sessions`, `withdrawals-report`

**Returns (4):**
- `sales-returns-summary`, `sales-returns-by-customer`, `purchase-returns-summary`, `purchase-returns-by-supplier`

**Total: ~35+ legacy-only slugs** have no mapping in `slugSourceMap`. They work via the legacy route but the new source-based API can't reach them.

### Broken `clsMap` Entries (P12)

These legacy slugs map to source/classification combos that DON'T EXIST:

| Legacy Slug | Maps To | Reality |
|---|---|---|
| `shift-history` | employees → `shifts` | ❌ No `shifts` classification in employees |
| `exceptions` | employees → `shifts` | ❌ Same |
| `audit-log` | employees → `user-activity` | ❌ No `user-activity` in employees |
| `user-activity` | employees → `user-activity` | ❌ Same |
| `bank-cash-split` | cheques → `bank-summary` | ❌ `cheques` source doesn't exist |
