# Tasks: ElHegazi Retailer V1

**Input**: Design documents from `/specs/001-elhegazi-retailer/`
**Prerequisites**: plan.md (required), spec.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Scaffold the monorepo, install all dependencies, configure build tools, and strictly establish the testing frameworks per the constitution.

- [X] T001 Initialize root `package.json` with Electron 29, electron-builder, concurrently scripts in `package.json`
- [X] T002 [P] Scaffold `client/` Vite + React 18 project via `npx create-vite` with React template in `client/`
- [X] T003 [P] Configure `client/package.json` with Tailwind CSS, Zustand, TanStack Query, React Hook Form, Zod.
- [X] T004 [P] Configure `client/package.json` with i18next, `idb` (for POS offline storage), and Headless UI.
- [X] T005 [P] Scaffold `server/` Express 4 project.
- [X] T006 [P] Configure `server/package.json` with `better-sqlite3`, `bcryptjs`, `jsonwebtoken`, `cors`, `helmet`.
- [X] T007 [P] Configure `server/package.json` with `node-cron`, `pdfkit`, `exceljs` for background jobs and exports.
- [X] T008 [P] Initialize Jest testing framework inside `server/` with `server/jest.config.js`.
- [X] T009 [P] Initialize Playwright testing framework inside `client/` with `client/playwright.config.js`.
- [X] T010 [P] Create `electron/main.js` entry with single-instance lock, splash window, and `app.whenReady()` bootstrap.
- [X] T011 [P] Create `electron/preload.js` with `contextBridge` exposing whitelisted IPC channels (license, backup, print, dialogs).
- [X] T012 Configure Tailwind CSS with RTL plugin, custom color palette, Noto Sans Arabic font in `client/tailwind.config.js`.
- [X] T013 Create global CSS resets and font imports in `client/src/index.css`.
- [X] T014 [P] Create `client/.env.example` and `server/.env.example` with documented variables per spec Chapter 34.
- [X] T015 [P] Create `electron-builder.yml` with NSIS installer config, explicitly configuring `nativeRebuild: true` and `.asar.unpacked` for `better-sqlite3`.
- [X] T016 [P] Create `.gitignore` covering node_modules, dist, *.db, .env, data/ directories.
- [X] T017 Create root `npm run dev` script using `concurrently` to launch server + client + electron dev mode.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that ALL user stories depend on. Decomposed database schemas prevent single-task bottlenecks. MUST complete before feature work. 

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Database & Migrations

- [X] T018 Create `electron/dbManager.js` with `openDatabase()`, WAL pragma, `NORMAL` sync, `foreign_keys = ON`, migration runner.
- [X] T019 Write Jest Unit Test: `server/tests/dbManager.test.js` validating WAL mode enablement and file creation.
- [X] T020 Create migration: `electron/migrations/001_core_settings.js` (settings, users, role_permissions, audit_logs).
- [X] T021 Create migration: `electron/migrations/002_master_data.js` (item_categories, units, items, price_groups).
- [X] T022 Create migration: `electron/migrations/003_trading_parties.js` (customer_groups, customers, suppliers, employees).
- [X] T023 Create migration: `electron/migrations/004_financial_core.js` (warehouses, treasuries, banks, expense_categories, revenues, expenses).
- [X] T024 Create migration: `electron/migrations/005_invoicing_purchases.js` (invoices, invoice_lines, purchases, purchase_orders, quotations).
- [X] T025 Create migration: `electron/migrations/006_payments.js` (payments, cheques, installments, shifts).
- [X] T026 Create migration: `electron/migrations/007_stock_tracking.js` (stock_levels, stock_movements, stock_adjustments).
- [X] T027 Create migration: `electron/migrations/008_promotions.js` (promotions, loyalty_transactions, user_help_state, notifications).
- [X] T028 Create migration: `electron/migrations/009_indexes.js` creating indexes for barcodes, phone numbers, and dates.
- [X] T029 [P] Create `server/src/config/database.js` receiving the db instance from Electron IPC or direct require, exporting `getDb()` helper.

### Express Server Core

- [X] T030 Create `server/src/app.js` with Express setup: helmet, cors (127.0.0.1 + LAN), json body parser (10mb), rate limiting.
- [X] T031 Create `server/src/index.js` entry that opens database, starts Express on configurable PORT/HOST.
- [X] T032 [P] Create `electron/serverManager.js` that requires and starts the Express server inside Electron main process.
- [X] T033 [P] Create `server/src/config/logger.js` using Winston with file + console transports, structured JSON format.

### Authentication & Authorization

- [X] T034 Create `server/src/middleware/auth.js` with JWT verification, user lookup, token refresh logic.
- [X] T035 [P] Create `server/src/middleware/permission.js` with `requirePermission(flag)` middleware checking role defaults + user overrides.
- [X] T036 [P] Create `server/src/middleware/audit.js` middleware that logs every mutation to `audit_logs` table.
- [X] T037 Create `server/src/routes/auth.routes.js` with POST /login, /change-password, /unlock endpoints.
- [X] T038 Write Jest Unit Test: `server/tests/auth.test.js` validating JWT generation and failure on bad credentials.
- [X] T039 [P] Create `server/src/models/user.model.js` with findByUsername, create, update, verifyPassword (bcrypt).
- [X] T040 [P] Create `server/src/constants/permissions.js` with ROLE_DEFAULTS map and `getEffectivePermissions(user)` merge function.

### Shared Utilities

- [X] T041 [P] Create `shared/validations/schemas.js` with Zod schemas user auth, master data parameters.
- [X] T042 [P] Create `shared/validations/invoiceSchemas.js` with Zod schemas for invoices and POS items to share between FE/BE.
- [X] T043 [P] Create `server/src/utils/currencyMath.js` with integer-only `add`, `subtract`, `multiply`, `percent` functions.
- [X] T044 Write Jest Unit Test: `server/tests/currencyMath.test.js` verifying integer calculation bounds up to 1,000,000,000 halala without float errors.
- [X] T045 [P] Create `client/src/utils/currency.js` mirroring server currencyMath for client-side display.
- [X] T046 [P] Create `server/src/utils/apiResponse.js` with `success(data)` and `error(code, msg)` standards.
- [X] T047 [P] Create `server/src/middleware/validate.js` executing Zod schemas on req.body.

### Frontend Core Shell

- [X] T048 Create `client/src/main.jsx` with React 18 createRoot, i18next init (ar default), RTL direction setup.
- [X] T049 [P] Create `client/src/locales/ar.json` and `client/src/locales/en.json` with baseline translation keys.
- [X] T050 Create `client/src/App.jsx` with React Router v6 routes, AuthGuard, SetupGuard, and lazy-loaded page imports.
- [X] T051 [P] Create `client/src/stores/authStore.js` Zustand store tracking user session.
- [X] T052 [P] Create `client/src/services/api.js` Axios instance with JWT interceptor and token refresh logic.
- [X] T053 Create `client/src/components/layout/AppShell.jsx` rendering DesktopLayout vs MobileLayout.
- [X] T054 [P] Create `client/src/components/layout/DesktopLayout.jsx` with collapsible sidebar.
- [X] T055 [P] Create `client/src/components/layout/Topbar.jsx` with search, notifications, user menu.
- [X] T056 [P] Create `client/src/components/layout/Sidebar.jsx` with full Arabic navigation hierarchy.

### UI Component Library

- [X] T057 [P] Create `client/src/components/ui/Button.jsx` with primary/secondary/danger/ghost variant styles.
- [X] T058 [P] Create `client/src/components/ui/Input.jsx` with label, error text, required asterisk styling.
- [X] T059 [P] Create `client/src/components/ui/Modal.jsx` with title, close on ESC, backdrop, and locked form guard.
- [X] T060 [P] Create `client/src/components/ui/ConfirmDialog.jsx` for all destructive actions per Constitution.
- [X] T061 [P] Create `client/src/components/ui/Table.jsx` supporting sticky header, pagination, and empty states.
- [X] T062 [P] Create `client/src/components/ui/Select.jsx` and `Tabs.jsx`.
- [X] T063 [P] Create `client/src/components/ui/Card.jsx` and `StatCard.jsx`.
- [X] T064 [P] Create `client/src/components/forms/CurrencyInput.jsx` directly binding to halala integers on change.
- [X] T065 [P] Create `client/src/hooks/usePermission.js` evaluating active session against feature flags.

### Error Handling & Feedback

- [X] T066 [P] Create `server/src/middleware/errorHandler.js` centralizing Express errors to Arabic JSON response.
- [X] T067 [P] Create `client/src/components/ui/ErrorState.jsx` and `EmptyState.jsx`.

**Checkpoint**: Foundation ready — database atomic migrations complete, core utility pipelines pass unit tests.

---

## Phase 3: User Story 1 — Setup Wizard & Login (Priority: P1) 🎯 MVP

**Goal**: First-time user can launch the app, complete the 5-step setup wizard, log in, and see the dashboard.

**Independent Test**: Launch fresh app → wizard appears → complete all steps → login screen → log in → dashboard loads with empty data.

- [X] T068 [US1] Create `server/src/routes/settings.routes.js` with GET/PUT /api/settings.
- [X] T069 [US1] Create `server/src/models/settings.model.js` handling the `settings` table CRUD operations.
- [X] T070 [P] [US1] Create `client/src/pages/setup/SetupWizard.jsx` tracking the active step index.
- [X] T071 [P] [US1] Create `client/src/pages/setup/steps/CompanyInfoStep.jsx` (Company Name, VAT number, tax rate).
- [X] T072 [P] [US1] Create `client/src/pages/setup/steps/AdminAccountStep.jsx` (First username and securely verified password).
- [X] T073 [P] [US1] Create `client/src/pages/setup/steps/DefaultsStep.jsx` (Default locations for operations).
- [X] T074 [US1] Create `client/src/pages/auth/LoginPage.jsx` managing authStore login state and feedback errors.
- [X] T075 [US1] Create `client/src/pages/dashboard/DashboardPage.jsx` with summary stat cards placeholder.
- [X] T076 [US1] Create `server/src/routes/dashboard.routes.js` aggregating today/week metrics.
- [X] T077 [US1] Write Playwright E2E Test: `client/tests/e2e/setup-wizard.spec.js` asserting sequential wizard flow completes to login.

**Checkpoint**: App launches → wizard → login → dashboard. Core loop works.

---

## Phase 4: User Story 2 — Definitions & Master Data (Priority: P1)

**Goal**: Admin can manage all master data: items, categories, units, customers, suppliers, warehouses, treasuries, banks, users, employees.

**Independent Test**: Create category → create unit → create item with prices → create customer → create supplier → verify all appear in list views.

### Backend Models & Routes

- [X] T078 [P] [US2] Create `server/src/models/category.model.js` supporting infinite nested parent/child paths.
- [X] T079 [P] [US2] Create `server/src/models/item.model.js` managing CRUD, strict barcode constraints, and tax application.
- [X] T080 Write Jest Unit Test: `server/tests/items.test.js` validating duplicate barcodes are properly rejected.
- [X] T081 [P] [US2] Create `server/src/models/unit.model.js`.
- [X] T082 [P] [US2] Create `server/src/models/customer.model.js` maintaining starting balance parameters.
- [X] T083 [P] [US2] Create `server/src/models/supplier.model.js`.
- [X] T084 [P] [US2] Create `server/src/models/warehouse.model.js` and `treasury.model.js`.
- [X] T085 [P] [US2] Create `server/src/models/bank.model.js` and `employee.model.js`.
- [X] T086 [US2] Create `server/src/routes/items.routes.js` including `/api/items/barcode/:barcode` endpoint.
- [X] T087 [P] [US2] Create `server/src/routes/categories.routes.js` and `units.routes.js`.
- [X] T088 [P] [US2] Create `server/src/routes/customers.routes.js` and `suppliers.routes.js`.
- [X] T089 [P] [US2] Create `server/src/routes/warehouses.routes.js`, `treasuries.routes.js`, and `banks.routes.js`.
- [X] T090 [P] [US2] Create `server/src/routes/users.routes.js` and `employees.routes.js`.

### Frontend Pages

- [X] T091 [P] [US2] Create `client/src/pages/definitions/CategoriesPage.jsx` with drag/drop expandable UI tree.
- [X] T092 [P] [US2] Create `client/src/pages/items/ItemsListPage.jsx` grid.
- [X] T093 [P] [US2] Create `client/src/pages/items/ItemFormModal.jsx` incorporating multi-tier price inputs and barcodes.
- [X] T094 [P] [US2] Create `client/src/pages/items/ItemDetailPage.jsx` displaying stock/prices tabs.
- [X] T095 [P] [US2] Create `client/src/pages/customers/CustomersListPage.jsx` and `CustomerFormModal.jsx`.
- [X] T096 [P] [US2] Create `client/src/pages/customers/CustomerDetailPage.jsx` reviewing past transactions.
- [X] T097 [P] [US2] Create `client/src/pages/suppliers/SuppliersListPage.jsx` and `SupplierFormModal.jsx`.
- [X] T098 [P] [US2] Create `client/src/pages/definitions/UnitsPage.jsx`, `WarehousesPage.jsx`, and `TreasuriesPage.jsx`.
- [X] T099 [P] [US2] Create `client/src/pages/definitions/BanksPage.jsx`.
- [X] T100 [P] [US2] Create `client/src/pages/definitions/UsersPage.jsx` supporting role adjustments and logs checking.
- [X] T101 [P] [US2] Create `client/src/pages/definitions/EmployeesPage.jsx`.

**Checkpoint**: All master data CRUD works and is strictly tested. Items, customers, suppliers all manageable.

---

## Phase 5: User Story 3 — POS Sales Screen (Priority: P1) 🎯 MVP

**Goal**: Cashier can open shift, scan/search items, build invoice, apply discounts, process payment (cash/credit), save and print receipt.

**Independent Test**: Login as cashier → open shift → scan barcode → add items → apply discount → pay cash → invoice saved → receipt printed → treasury updated.

### POS Backend Engine
- [X] T102 [P] [US3] Create `server/src/models/shift.model.js` supporting active checking, Open, Close logic.
- [X] T103 [P] [US3] Create `server/src/routes/shifts.routes.js` handling `/open`, `/close`, `/pay-out`.
- [X] T104 [P] [US3] Create `server/src/models/stockLevel.model.js` and `stockMovement.model.js`.
- [X] T105 [P] [US3] Create `server/src/services/stockService.js` strictly wrapping stock level alterations in transactions.
- [X] T106 [P] [US3] Create `server/src/models/invoice.model.js` mapping standard fields and statuses.
- [X] T107 [P] [US3] Create `server/src/models/invoiceLine.model.js` for fast bulk insertion.
- [X] T108 [US3] Create `server/src/services/invoiceService.js` Orchestrator (validate cart, create invoice, insert lines, deduct stock, update customer balance, update shift payload, trigger audit).
- [X] T109 Write Jest Unit Test: `server/tests/invoiceService.test.js` ensuring full rollback of invoice + lines + stock happens safely upon a simulated failure.
- [X] T110 [US3] Create `server/src/routes/invoices.routes.js`.

### POS Frontend UI
- [X] T111 [US3] Create `client/src/stores/posStore.js` (Zustand) holding active cart, line quantities, active customer, applied discounts.
- [X] T112 [US3] Create `client/src/stores/posRecovery.js` wrapping `idb` to auto-cache the POS cart locally against network drops.
- [X] T113 [US3] Create `client/src/pages/pos/POSPage.jsx` splitting into 65% cart grid and 35% item catalog panels.
- [X] T114 [P] [US3] Create `client/src/components/pos/BarcodeListener.jsx` measuring keystroke threshold (50ms) to intercept physical scanner guns.
- [X] T115 [P] [US3] Create `client/src/components/pos/ItemGrid.jsx` rendering touch-friendly item image cards.
- [X] T116 [P] [US3] Create `client/src/components/pos/InvoiceLines.jsx` handling interactive quantity modifiers and row deletions.
- [X] T117 [P] [US3] Create `client/src/components/pos/PaymentPanel.jsx` rendering numpad / cash amount calculators.
- [X] T118 [P] [US3] Create `client/src/components/pos/CustomerSelector.jsx` integrating async dropdowns and inline creation.
- [X] T119 [US3] Create `client/src/pages/pos/ShiftOpenModal.jsx` blocking POS usage until cash drawer float is declared.
- [X] T120 [P] [US3] Create `client/src/pages/pos/ShiftCloseModal.jsx` calculating variance between user count and system totals.
- [X] T121 [P] [US3] Create `client/src/pages/pos/ShiftStatusBar.jsx`.
- [X] T122 [US3] Integrate global POS Keybinds in `POSPage.jsx` (F1-F12 layouts).
- [X] T123 Write Playwright E2E Test: `client/tests/e2e/pos.spec.js` opening shift, scanning code, receiving payment, and validating database mutations.

### Hardware Feedback
- [X] T124 [P] [US3] Create `client/src/components/print/Receipt80mm.jsx` utilizing standard 80mm thermal layouts with arabic mappings and totals.
- [X] T125 [P] [US3] Create `client/src/components/print/Receipt58mm.jsx` utilizing slim 58mm layout logic.
- [X] T126 [P] [US3] Create `client/src/hooks/usePrint.js` mapping React refs natively.
- [X] T127 [P] [US3] Create `client/src/hooks/useSound.js` mounting base64 MP3 beeps for scan confirmations to improve cashier rhythm.

**Checkpoint**: Full POS loop works. Cashier can sell remotely or locally, print identically, and shift boundaries are secure.

---

## Phase 6: User Story 4 — Sales Returns (Priority: P1)

**Goal**: Return items from a previous invoice with stock restoration and balance adjustment.

**Independent Test**: Find original invoice → select items to return → process return → stock increases → customer balance adjusts → return receipt prints.

- [X] T128 [US4] Create `server/src/services/returnService.js` housing inverse logic: validate remaining returnable quantity, increment stock, adjust treasury/customer ledgers.
- [X] T129 Write Jest Unit Test: `server/tests/returnService.test.js` validating partial line-item returns.
- [X] T130 [US4] Create POST `/api/invoices/:id/return` endpoint in `invoices.routes.js`.
- [X] T131 [US4] Create `client/src/pages/sales/SalesReturnPage.jsx` tracking previous lookup data.
- [X] T132 [US4] Create `client/src/components/sales/ReturnLinePicker.jsx` visual list builder for selecting lines to revert.

**Checkpoint**: Full sale + exact return cycle works reliably.

---

## Phase 7: User Story 5 — Purchases & Purchase Returns (Priority: P1)

**Goal**: Create purchase invoices from suppliers, receive goods (stock increases), manage purchase orders, and process purchase returns.

**Independent Test**: Create purchase invoice → stock increases → supplier balance increases → create PO → receive PO → purchase auto-created.

- [X] T133 [P] [US5] Create `server/src/models/purchase.model.js` supporting direct purchase creation linked to stock services.
- [X] T134 [P] [US5] Create `server/src/models/purchaseLine.model.js`.
- [X] T135 [P] [US5] Create `server/src/models/purchaseOrder.model.js` supporting Pending to Received lifecycle.
- [X] T136 [US5] Create `server/src/routes/purchases.routes.js`.
- [X] T137 [US5] Create `server/src/routes/purchaseOrders.routes.js` matching POST `/receive` endpoints.
- [X] T138 [P] [US5] Create `client/src/pages/purchases/PurchaseFormPage.jsx` with complex data entry table grid for 100+ line orders.
- [X] T139 [P] [US5] Create `client/src/pages/purchases/PurchasesListPage.jsx`.
- [X] T140 [P] [US5] Create `client/src/pages/purchases/PurchaseOrdersPage.jsx` visualizing pipeline delays.
- [X] T141 [US5] Create `client/src/pages/purchases/PurchaseReturnPage.jsx` processing exact reversals back to supplier ledgers.

**Checkpoint**: Full purchase cycle works. Procurement orders are tracked correctly.

---

## Phase 8: User Story 6 — Payments (Priority: P2)

**Goal**: Record customer receipts and supplier payments with invoice allocation, cheque management, and installment plans.

**Independent Test**: Customer pays credit balance → allocate to invoices → balance decreases → treasury increases. Create installment plan → mark payments → track schedule.

- [X] T142 [P] [US6] Create `server/src/models/payment.model.js` linking receipts to distinct invoices or opening balances.
- [X] T143 [P] [US6] Create `server/src/routes/payments.routes.js`.
- [X] T144 Write Jest Unit Test: `server/tests/payments.test.js` validating fractional overpay scenarios.
- [X] T145 [P] [US6] Create `server/src/models/cheque.model.js` managing Pending -> Deposited -> Cleared cycle impacts.
- [X] T146 [US6] Create `server/src/routes/cheques.routes.js` exposing status patch endpoints.
- [X] T147 [P] [US6] Create `server/src/models/installment.model.js` defining distinct payment timelines.
- [X] T148 [P] [US6] Create `server/src/routes/installments.routes.js`.
- [X] T149 [P] [US6] Create `client/src/pages/payments/PaymentFormPage.jsx` mapping customer drops to grid invoice selections.
- [X] T150 [P] [US6] Create `client/src/pages/payments/PaymentsListPage.jsx`.
- [X] T151 [P] [US6] Create `client/src/pages/operations/ChequesPage.jsx` visualizing due dates securely.
- [X] T152 [P] [US6] Create `client/src/pages/operations/InstallmentsPage.jsx`.

**Checkpoint**: Full payment cycle for both AR/AP works successfully maintaining balance integrity.

---

## Phase 9: User Story 7 — Expenses & Revenues (Priority: P2)

**Goal**: Record and categorize business expenses and other revenues with treasury/bank deductions.

**Independent Test**: Create expense → category assigned → treasury decreases → appears in expense list. Create revenue → treasury increases.

- [X] T153 [P] [US7] Create `server/src/models/expense.model.js`.
- [X] T154 [P] [US7] Create `server/src/models/revenue.model.js`.
- [X] T155 [P] [US7] Create `server/src/routes/expenses.routes.js`.
- [X] T156 [P] [US7] Create `server/src/routes/revenues.routes.js`.
- [X] T157 [P] [US7] Create `client/src/pages/expenses/ExpensesListPage.jsx`.
- [X] T158 [P] [US7] Create `client/src/pages/expenses/ExpenseFormModal.jsx` evaluating treasury availability.
- [X] T159 [P] [US7] Create `client/src/pages/expenses/RevenuesListPage.jsx`.
- [X] T160 [P] [US7] Create `client/src/pages/expenses/RevenueFormModal.jsx`.
- [X] T161 [P] [US7] Create `client/src/pages/definitions/ExpenseCategoriesPage.jsx` tree.
- [X] T162 [P] [US7] Create `client/src/pages/definitions/RevenueCategoriesPage.jsx` tree.

**Checkpoint**: Full general ledger expense classification handles securely.

---

## Phase 10: User Story 8 — Stock Management (Priority: P2)

**Goal**: View stock levels, perform transfers between warehouses, manual adjustments, and physical inventory counts.

**Independent Test**: View stock levels → transfer items between warehouses → adjust stock → run physical count → variances flagged and resolved.

- [X] T163 [US8] Create `server/src/services/stockTransferService.js` validating transit logs and atomic deductions across warehouse bounds.
- [X] T164 [P] [US8] Create `server/src/routes/stock.routes.js` serving `/levels`, `/transfer`, `/physical-count`.
- [X] T165 [P] [US8] Create `client/src/pages/stock/StockLevelsPage.jsx` filtering by precise warehouse dimensions.
- [X] T166 [P] [US8] Create `client/src/pages/stock/StockMovementsPage.jsx` establishing universal audit table view.
- [X] T167 [P] [US8] Create `client/src/pages/stock/StockTransferPage.jsx`.
- [X] T168 [US8] Create `client/src/pages/stock/PhysicalCountPage.jsx` implementing exact session validation UI for tracking variance.

**Checkpoint**: Internal multi-warehouse tracking acts securely.

---

## Phase 11: User Story 9 — Operations (Priority: P2)

**Goal**: Treasury transfers, bank operations, bulk price update, and quotations.

**Independent Test**: Transfer between treasuries → balances update. Create quotation → convert to invoice.

- [X] T169 [P] [US9] Create `server/src/routes/operations.routes.js` handling `/treasury-transfer`.
- [X] T170 [P] [US9] Create `server/src/models/quotation.model.js`.
- [X] T171 [P] [US9] Create `server/src/routes/quotations.routes.js` providing `/convert-to-invoice`.
- [X] T172 [P] [US9] Create `client/src/pages/operations/TreasuryTransferPage.jsx`.
- [X] T173 [P] [US9] Create `client/src/pages/operations/BankOperationsPage.jsx`.
- [X] T174 [P] [US9] Create `client/src/pages/operations/BulkPriceUpdatePage.jsx` iterating global price updates sequentially.
- [X] T175 [P] [US9] Create `client/src/pages/operations/QuotationsPage.jsx`.

**Checkpoint**: All system operations module features work.

---

## Phase 12: User Story 10 — Reports (Priority: P2)

**Goal**: Generate and export sales, purchases, stock, financial, customer, cashier, and audit reports.

**Independent Test**: Select date range → view sales report with totals → export to Excel → verify data matches.

- [X] T176 [US10] Create `server/src/services/salesAnalytics.js` processing SQLite grouping by dates/users/items.
- [X] T177 [US10] Create `server/src/services/stockAnalytics.js` generating valuation models.
- [X] T178 [US10] Create `server/src/services/financeAnalytics.js` running P&L computations directly isolating actual revenues from cost.
- [X] T179 Write Jest Unit Test: `server/tests/reports.test.js` validating P&L formulas accurately align exactly to base integer ledger values.
- [X] T180 [US10] Create `server/src/services/exportService.js` utilizing `pdfkit` and `exceljs` mapping JSON to physical assets.
- [X] T181 [US10] Create `server/src/routes/reports.routes.js` surfacing analytics engines securely via JSON endpoints.
- [X] T182 [P] [US10] Create `client/src/pages/reports/ReportsPage.jsx` layout wrapper.
- [X] T183 [P] [US10] Create `client/src/pages/reports/SalesReportPage.jsx` utilizing `Recharts` visualizations.
- [X] T184 [P] [US10] Create `client/src/pages/reports/ProfitLossPage.jsx` providing deep variance comparisons.
- [X] T185 [P] [US10] Create `client/src/pages/reports/StockReportPage.jsx`.
- [X] T186 [P] [US10] Create `client/src/pages/reports/CustomerReportPage.jsx`.
- [X] T187 [P] [US10] Create `client/src/pages/reports/ShiftHistoryPage.jsx`.
- [X] T188 [P] [US10] Create `client/src/pages/reports/AuditLogPage.jsx` mapping every mutation securely.

**Checkpoint**: All reporting modules provide subsecond extraction and export seamlessly.

---

## Phase 13: User Story 11 — Promotions & Loyalty (Priority: P3)

**Goal**: Admin creates automatic promotion rules; customers earn and redeem loyalty points at POS.

**Independent Test**: Create "10% off drinks" promotion → add drink at POS → discount auto-applied. Customer earns points on purchase → redeems points on next purchase.

- [X] T189 [P] [US11] Create `server/src/models/promotion.model.js` creating rules-engine logic (buy/get, limits, date boundaries).
- [X] T190 Write Jest Unit Test: `server/tests/promotions.test.js` ensuring stacking promotion bounds logic operates accurately.
- [X] T191 [P] [US11] Create `server/src/routes/promotions.routes.js`.
- [X] T192 [P] [US11] Create `server/src/services/loyaltyService.js` mapping invoice totals securely against loyalty mapping records.
- [X] T193 [P] [US11] Create `server/src/routes/loyalty.routes.js`.
- [X] T194 [P] [US11] Create `client/src/pages/definitions/PromotionsPage.jsx`.
- [X] T195 [US11] Integrate `evaluateCart` listener internally to `client/src/stores/posStore.js` auto-applying bounds securely.

**Checkpoint**: Promotions auto-fire natively at POS terminals.

---

## Phase 14: User Story 12 — Settings & Notifications (Priority: P3)

**Goal**: Admin manages all application settings; system generates notifications for low stock, due cheques, license expiry.

**Independent Test**: Change receipt settings → print reflects changes. Low stock item triggers notification bell badge.

- [X] T196 [P] [US12] Create `client/src/pages/settings/SettingsPage.jsx` splitting config into Tax, Hardware, Operations tabs.
- [X] T197 [P] [US12] Create `server/src/jobs/notificationJobs.js` securely deploying `node-cron` listeners (lowStock, checksDue).
- [X] T198 [P] [US12] Create `server/src/models/notification.model.js`.
- [X] T199 [P] [US12] Create `server/src/routes/notifications.routes.js`.
- [X] T200 [P] [US12] Create `client/src/pages/notifications/NotificationsPage.jsx`.
- [X] T201 [P] [US12] Create `client/src/stores/notificationStore.js` and topbar badge icon polling mechanisms.

**Checkpoint**: Settings update in real-time. System autonomously communicates critical states.

---

## Phase 15: User Story 13 — License, Backup & Electron Packaging (Priority: P3)

**Goal**: License activation, auto-backup, restore, and production Electron build.

**Independent Test**: Activate license key → status shows active. Create backup → restore from backup → data intact. Build installer → install on clean Windows → app runs.

- [X] T202 [P] [US13] Create `electron/licenseManager.js` combining SHA-256 machine properties against server payload APIs.
- [X] T203 [P] [US13] Create `electron/hardwareId.js`.
- [X] T204 [P] [US13] Create `electron/ipcHandlers.js` binding deep platform methods over Contexts safely.
- [X] T205 [US13] Create `server/src/services/backupService.js` implementing raw `fs.copyFileSync` of the SQLite base to hierarchical `/year/month/day/` folders.
- [X] T206 [P] [US13] Create `server/src/routes/backup.routes.js`.
- [X] T207 [P] [US13] Create `server/src/jobs/autoBackup.js` mapping background copy mechanisms strictly off-shift.
- [X] T208 [US13] Create `electron/tray.js` constructing functional native windows navigation menus.
- [X] T209 [P] [US13] Create `electron/updater.js` deploying generic auto-updater listeners against generic buckets.
- [X] T210 [P] [US13] Create `electron/windowManager.js` building isolated renderer states.
- [X] T211 [US13] Create `client/src/pages/settings/BackupSettingsTab.jsx` for manual trigger configurations.

**Checkpoint**: App is robustly distributable exactly meeting single-device offline boundaries.

---

## Phase 16: User Story 14 — Smart Help & Onboarding (Priority: P3)

**Goal**: First-time tours on each page, smart tooltips, user-controlled help preferences.

**Independent Test**: New user visits POS → tour auto-starts → dismiss → never shows again. Click (?) tooltip → help text appears.

- [X] T212 [P] [US14] Create `server/src/models/userHelpState.model.js` isolating boolean steps completed by active users.
- [X] T213 [P] [US14] Create `server/src/routes/help.routes.js`.
- [X] T214 [P] [US14] Create `client/src/help/helpContent.js` housing deep AR+EN string arrays contextually.
- [X] T215 [P] [US14] Create `client/src/stores/helpStore.js`.
- [X] T216 [P] [US14] Create `client/src/components/help/PageTour.jsx` overlaying spotlight boxes directly via bounding rects.
- [X] T217 [P] [US14] Create `client/src/components/help/SmartTooltip.jsx`.
- [X] T218 [US14] Create `client/src/hooks/usePageTour.js`.
- [X] T219 [US14] Map exact `data-help` tags across critical Item boundaries, Settings boundaries, and POS terminals.

**Checkpoint**: Learning curve eliminated organically layout by layout.

---

## Phase 17: Polish & Cross-Cutting Concerns

**Purpose**: Improvements, edge cases, system verification flows, and production hardening across all stories.

### Print & Export Formats

- [X] T220 [P] Create `client/src/components/print/InvoiceA4.jsx` establishing formal A4 company print mappings.
- [X] T221 [P] Create `client/src/components/print/BarcodeLabel.jsx` aligning precise CSS grid boundaries matching physical printer feeds.

### Excel Workflows

- [X] T222 Create `client/src/pages/items/ItemImportWizard.jsx` tracking massive payload insertions smoothly.

### MFA & Security Hardening

- [X] T223 [P] Create formal MFA multi-factor validation endpoint extensions across `server/src/routes/auth.routes.js` (`speakeasy`/`qrcode`).
- [X] T224 [P] Create session auto-locking UX states via `client/src/components/layout/ScreenLock.jsx`.

### UX Quality

- [X] T225 Create persistent dark mode handlers across `client/src/stores/uiStore.js` binding directly to `<html>` tags securely.
- [X] T226 [P] Create `client/src/components/layout/MobileLayout.jsx` strictly managing browser interfaces seamlessly scaling responsively.
- [X] T227 [P] Create `client/src/components/mobile/MobilePOS.jsx` enabling safe remote browser client execution across physical lanes.
- [X] T228 Create `client/src/pages/search/GlobalSearchPage.jsx` orchestrating multi-table parallel lookups.

### Performance & Final Validation QA Checks

- [X] T229 QA: Ensure `001_initial_schema.js` and subsequent migrations deploy 100% cleanly offline creating database payload mapping.
- [X] T230 QA: Confirm Quickstart sequences exactly construct offline test runs seamlessly.
- [X] T231 QA: Confirm Destructive behaviors natively trigger generic ConfirmDialog arrays inherently.
- [X] T232 QA: Confirm Integer format validations correctly isolate numeric display mappings.
- [X] T233 Production: Execute `npm run build` validating Vite strict mode dependencies evaluate without memory limits.
- [X] T234 Production: Execute `electron-builder --win` generating finalized packaged payload output.
- [X] T235 Write Playwright E2E Test: `client/tests/e2e/production-sanity.spec.js` running generic tests across full bounds.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 Setup Wizard (Phase 3)**: Depends on Foundational
- **US2 Definitions (Phase 4)**: Depends on Foundational, can run parallel with US1
- **US3 POS (Phase 5)**: Depends on US2 (needs items, customers, warehouses, treasuries)
- **US4 Returns (Phase 6)**: Depends on US3 (needs invoices to return)
- **US5 Purchases (Phase 7)**: Depends on US2, can run parallel with US3
- **US6 Payments (Phase 8)**: Depends on US3 + US5 (needs invoices to allocate)
- **US7 Expenses (Phase 9)**: Depends on Foundational only, can run parallel with US3+
- **US8 Stock (Phase 10)**: Depends on US2 (needs items, warehouses)
- **US9 Operations (Phase 11)**: Depends on US2 + US6 (needs treasuries, banks)
- **US10 Reports (Phase 12)**: Depends on US3-US7 (needs data to report on)
- **US11 Promotions (Phase 13)**: Depends on US3 (needs POS integration)
- **US12 Settings (Phase 14)**: Depends on Foundational
- **US13 Electron (Phase 15)**: Depends on all stories (packaging)
- **US14 Help (Phase 16)**: Depends on all pages existing
- **Polish (Phase 17)**: Depends on all stories

### Parallel Opportunities

After Phase 2 Foundation:
- **Team A**: US1 (Setup Wizard) + US3 (POS) → US4 (Returns)
- **Team B**: US2 (Definitions) + US5 (Purchases) → US8 (Stock)
- **Team C**: US7 (Expenses) + US12 (Settings) → US9 (Operations)
- **Converge**: US6 (Payments) → US10 (Reports) → US11-14 → Polish

---

## Implementation Strategy

### MVP First (Phase 1-5 = Core POS)

1. Complete Phase 1: Setup *(~2 days)*
2. Complete Phase 2: Foundation *(~5 days)*
3. Complete Phase 3: Setup Wizard *(~2 days)*
4. Complete Phase 4: Definitions *(~5 days)*
5. Complete Phase 5: POS *(~5 days)*
6. **STOP and VALIDATE**: Cashier can sell, print receipts, track shifts
7. Deploy/demo MVP

### Incremental Delivery

- **MVP**: Phases 1-5 = Setup + Login + Items + POS + Receipts
- **V1.1**: + Returns + Purchases + Payments (Phases 6-8)
- **V1.2**: + Expenses + Stock Management + Operations (Phases 9-11)
- **V1.3**: + Reports + Promotions + Settings + Help (Phases 12-16)
- **V1.4**: Polish + Electron Build + Production Release (Phase 17)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- All monetary values are INTEGER (halala) — enforced at every layer
- Arabic-first: all UI labels must have `ar.json` key before English
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently

