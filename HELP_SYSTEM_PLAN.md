# Help System Rebuild Plan — Per-Page Help Steps

> Every page gets its own **spotlight tour** (element-highlighting steps) + **illustrated guide** (modal visual guide).
> All text in **Egyptian Arabic accent** (عامية مصرية). SVG illustrations where needed.

---

## PHASE 1: usePageTour Hooks — Add to pages missing them

> **COMPLETED** — All 29+ pages now have usePageTour hooks.

- [x] `payments/PaymentsListPage.jsx` → `usePageTour('payments')`
- [x] `operations/ItemOperationsPage.jsx` → `usePageTour('item_operations')`
- [x] `definitions/CustomerProfilePage.jsx` → `usePageTour('customer_profile')`
- [x] `definitions/SupplierProfilePage.jsx` → `usePageTour('supplier_profile')`
- [x] `operations/EmployeeAdjustments.jsx` → `usePageTour('employee_adjustments')`
- [x] `notifications/NotificationsPage.jsx` → `usePageTour('notifications')`
- [x] `purchases/PurchaseOrderFormPage.jsx` → `usePageTour('purchase_order_form')`
- [x] `purchases/PurchaseReturnFormPage.jsx` → `usePageTour('purchase_return_form')`
- [x] `operations/BranchTransferFormPage.jsx` → `usePageTour('branch_transfer_form')`
- [x] `operations/QuotationFormPage.jsx` → `usePageTour('quotation_form')`
- [x] `sync/SyncPage.jsx` → `usePageTour('sync_page')`
- [x] `restaurant/TableMapPage.jsx` → `usePageTour('table_map')`
- [x] `restaurant/ModifierGroupsPage.jsx` → `usePageTour('modifier_groups')`
- [x] `gold/GoldRatesPage.jsx` → `usePageTour('gold_rates')`
- [x] `stock/SerialLookupPage.jsx` → `usePageTour('serial_lookup')`
- [x] `pos/InvoiceDetailPage.jsx` → `usePageTour('invoice_detail')`
- [x] `pos/CashflowLedgerPage.jsx` → `usePageTour('cashflow_ledger')`
- [x] `sales/SalesHubPage.jsx` → `usePageTour('sales_hub')`
- [x] `sales/SalesReturnFormPage.jsx` → `usePageTour('sales_return_form')`
- [x] `pos/SalesReturnDetailPage.jsx` → `usePageTour('sales_return_detail')`
- [x] `payments/PaymentFormPage.jsx` → `usePageTour('payment_form')`
- [x] `purchases/PurchaseReturnDetailPage.jsx` → `usePageTour('purchase_return_detail')`
- [x] `items/import/ItemImportPage.jsx` → `usePageTour('item_import')`
- [x] `reports/ExpiryReportPage.jsx` → `usePageTour('expiry_report')`
- [x] `definitions/RevenueCategoriesPage.jsx` → `usePageTour('revenue_categories')`
- [x] `definitions/ExpenseCategoriesPage.jsx` → `usePageTour('expense_categories')`
- [x] `accounts/import/AccountImportPage.jsx` → `usePageTour('account_import')`
- [x] `sync/SyncConfig.jsx` → `usePageTour('sync_config')`
- [x] `reports/SourceWorkspacePage.jsx` → `usePageTour('source_workspace')`
- [x] All 7 workspace pages → `usePageTour` with workspace keys
- [x] `whatsapp/WhatsAppCrmPage.jsx` → `usePageTour('whatsapp_crm')`

---

## PHASE 2: New Spotlight Tour Entries in `helpContent.js`

> **COMPLETED** — All pages now have page-specific spotlight tour steps.

### 2A. Detail Pages (shared pattern: breadcrumb → summary → actions → timeline)

- [x] `invoice_detail` — فاتورة بيع (5 steps)
- [x] `sales_return_detail` — مرتجع مبيعات (4 steps)
- [x] `purchase_return_detail` — مرتجع شراء (4 steps)

### 2B. Hub/List Pages

- [x] `sales_hub` — فواتير المبيعات (4 steps)
- [x] `payments` — سجل المقبوضات والمدفوعات (4 steps)

### 2C. Form Pages

- [x] `sales_return_form` — إنشاء مرتجع مبيعات (6 steps)
- [x] `payment_form` — تسجيل حركة مالية (5 steps)

### 2D. Specialized Pages

- [x] `cashflow_ledger` — كشف الحركات التفصيلي (3 steps)
- [x] `item_import` — الرفع الذكي للأصناف (2 steps)
- [x] `expiry_report` — تقرير انتهاء الصلاحية (3 steps)
- [x] `source_workspace` — تقرير مخصص (3 steps)
- [x] `revenue_categories` — تصنيفات الإيرادات (1 step)
- [x] `expense_categories` — أقسام المصروفات (1 step)
- [x] `account_import` — استيراد الحسابات (2 steps)
- [x] `sync_config` — ربط المتجر الإلكتروني (3 steps)
- [x] `sync_page` — المزامنة (4 steps)
- [x] `table_map` — خريطة الطاولات (3 steps)
- [x] `modifier_groups` — إعدادات الإضافات (3 steps)
- [x] `gold_rates` — أسعار الذهب (3 steps)
- [x] `serial_lookup` — البحث بالسيريال (2 steps)

### 2E. Workspace Pages (TAB-AWARE)

> Each workspace page has detailed per-tab steps with `tab` property.
> PageTour auto-switches tabs when a step targets an element on an inactive tab.

- [x] `finance_workspace` — 6 steps (header, tabs, payments, expenses, revenues, methods)
- [x] `purchases_workspace` — 5 steps (header, tabs, purchases, orders, returns)
- [x] `inventory_workspace` — 6 steps (header, tabs, levels, movements, transfer, count)
- [x] `operations_workspace` — 5 steps (header, tabs, cheques, installments, transfers)
- [x] `catalog_workspace` — 6 steps (header, tabs, items, categories, units, promotions)
- [x] `parties_workspace` — 4 steps (header, tabs, customers, suppliers)
- [x] `resources_workspace` — 4 steps (header, tabs, warehouses, treasuries)
- [x] `team_workspace` — 4 steps (header, tabs, users, employees)

---

## PHASE 3: New Illustrated Guide Entries in `pageGuides.jsx`

> **COMPLETED** — All pages now have modal visual guides with SVG illustrations.

- [x] `invoice_detail` — فاتورة البيع (icon: FileText)
- [x] `sales_return_detail` — مرتجع المبيعات (icon: RotateCcw)
- [x] `purchase_return_detail` — مرتجع المشتريات (icon: RotateCcw)
- [x] `sales_hub` — فواتير المبيعات (icon: Receipt)
- [x] `payment_form` — تسجيل حركة مالية (icon: HandCoins)
- [x] `cashflow_ledger` — كشف الحركات (icon: BookOpen)
- [x] `item_import` — استيراد الأصناف (icon: Download)
- [x] `expiry_report` — انتهاء الصلاحية (icon: Clock)
- [x] `source_workspace` — التقارير المخصصة (icon: BarChart3)
- [x] `revenue_categories` — تصنيفات الإيرادات (icon: Tags)
- [x] `expense_categories` — أقسام المصروفات (icon: Tags)
- [x] `account_import` — استيراد الحسابات (icon: Download)
- [x] `sync_config` — ربط المتجر (icon: Wifi)
- [x] `sync_page` — المزامنة (icon: RefreshCw)
- [x] `table_map` — خريطة الطاولات (icon: UtensilsCrossed)
- [x] `modifier_groups` — الإضافات (icon: UtensilsCrossed)
- [x] `gold_rates` — أسعار الذهب (icon: Gem)
- [x] `serial_lookup` — البحث بالسيريال (icon: ScanBarcode)
- [x] `whatsapp_crm` — واتساب CRM (icon: MessageSquare)
- [x] `customer_profile` — ملف العميل (icon: User)
- [x] `supplier_profile` — ملف المورد (icon: Building2)
- [x] `item_detail` — تفاصيل الصنف (icon: Package2)

---

## PHASE 4: Rebuild Existing Spotlight Tours (helpContent.js)

> **COMPLETED** — All existing pages rebuilt with strong Egyptian accent and page-specific content.

All ~45 existing page entries rebuilt with:
- Egyptian Arabic accent (عامية مصرية) throughout
- Page-specific examples and concrete numbers
- `demo_ar` arrays with step-by-step walkthroughs
- `highlight_type: "glow"` on key action steps
- `placement` tuned per step (bottom for headers, top for content areas)

---

## PHASE 5: Rebuild Existing Illustrated Guides (pageGuides.jsx)

> **COMPLETED** — All existing guide content rebuilt.

All ~50 existing guide entries rebuilt with:
- Expanded weak single-step entries (branches, units, financial_categories, revenue_categories, expense_categories)
- Removed 4 duplicate keys
- Added icon flows, points, notes, and SVG illustrations

---

## PHASE 6: Update `routeHelp.js` with New Route Matchers

> **COMPLETED** — ~71 route matchers, properly ordered (specific before generic).

- [x] All new routes mapped to page keys
- [x] Specific routes (e.g., `/payments/new`) before generic (`/payments`)

---

## PHASE 7: Update `HelpSettingsTab.jsx`

> **COMPLETED** — PAGE_TOURS array expanded from 39 to ~93 entries.

- [x] All new page keys added with Arabic labels
- [x] Workspace pages added: finance, purchases, inventory, operations, catalog, parties, resources, team
- [x] Organized by category with section comments

---

## PHASE 8: SVG Illustration Components

> **COMPLETED** — 11 inline SVG components created in `guideIllustrations.jsx`.

- [x] InvoiceTimeline — Document version chain (used by detail pages)
- [x] PaymentAllocation — Amount splitting across invoices
- [x] CashflowEquation — Opening + income - expenses = closing
- [x] ImportWizardFlow — 5-step import progression
- [x] SerialLifecycle — Stock → Sold → Returned journey
- [x] ExpiryTimeline — Progress bars with days remaining
- [x] SyncConflict — Side-by-side POS vs ECOM
- [x] GoldFormula — Weight × Rate + Craftsmanship
- [x] Plus additional illustrations for other pages

---

## PHASE 9: Tab-Awareness for Help System

> **COMPLETED** — Spotlight tours now auto-switch tabs on workspace and WhatsApp CRM pages.

### What was done:
1. **`Tabs.jsx`** — Added `data-help-tab={tab.value}` to each tab button (propagates to all workspace pages)
2. **`PageTour.jsx`** — Modified `tryFind()`: when target not found and step has `tab` property, clicks `[data-help-tab="step.tab"]` to switch tabs, waits 400ms, then retries
3. **`PageTour.jsx`** — Modified TopicPicker: shows ALL explicit steps (including inactive tabs) so users can jump to any step
4. **`WhatsAppCrmPage.jsx`** — Added `data-help` attributes on header, tab bar, and tab content panels
5. **`helpContent.js`** — WhatsApp CRM steps rewritten with proper `data-help` targets and `tab` property
6. **`helpContent.js`** — All 8 workspace pages rewritten with detailed per-tab steps

---

## VERIFICATION

- [x] `npm run build` — passes cleanly
- [ ] Test each page: spotlight tour triggers on first visit
- [ ] Test each page: illustrated guide opens via BookOpen icon
- [ ] Test help settings: all new pages appear in admin toggle
- [ ] Test: tour completion persists across refresh
- [ ] Test: tour does not re-trigger after completion
- [ ] Test: workspace page tabs auto-switch during tour
- [ ] Test: WhatsApp CRM tabs auto-switch during tour
- [ ] Verify all Arabic text uses Egyptian accent (عامية مصرية)
- [ ] Verify no hardcoded Tailwind colors in new components
