# ElHegazi Retailer — Complete Product Blueprint V1
## Single-Branch · SQLite Local Database · Electron Desktop · Arabic-First
### The Five-Star Implementation Guide — Zero Gaps, Zero Assumptions

**Stack:** SQLite (Local) · Node.js · Express · React · Electron · Arabic RTL
**Version:** 1.0 | **Target:** Windows 10/11 (min: Windows 10) | **Audience:** Senior Dev Team

---

# TABLE OF CONTENTS

| # | Chapter | Pages |
|---|---------|-------|
| 1 | Project Vision & Architecture | ~8 |
| 2 | Tech Stack & Complete Folder Structure | ~6 |
| 3 | Database Schema — All 28 Collections | ~18 |
| 4 | Authentication, Sessions & Security | ~8 |
| 5 | License System & Copy Protection | ~7 |
| 6 | Electron Desktop Architecture | ~9 |
| 7 | Setup & Onboarding Wizard | ~5 |
| 8 | Desktop vs Mobile UI System | ~7 |
| 9 | UI/UX Design System | ~8 |
| 10 | Codes & Definitions Module | ~6 |
| 11 | Items & Prices Module | ~8 |
| 12 | POS — Sales Invoice Screen | ~10 |
| 13 | Sales Returns Module | ~4 |
| 14 | Purchases Module | ~6 |
| 15 | Purchase Returns Module | ~3 |
| 16 | Payments Module | ~5 |
| 17 | Expenses Module | ~3 |
| 18 | Other Revenues Module | ~3 |
| 19 | Operations Module | ~7 |
| 20 | Stock Management Module | ~6 |
| 21 | Reports Module | ~10 |
| 22 | Search & Global Lookup | ~3 |
| 23 | Notifications & Alerts System | ~3 |
| 24 | Backup, Restore & Data Integrity | ~4 |
| 25 | Settings Module | ~4 |
| 26 | API Endpoints — Complete Reference | ~14 |
| 27 | Error Handling & Edge Cases | ~6 |
| 28 | Security Architecture | ~5 |
| 29 | Performance Optimization | ~4 |
| 30 | Offline Mode & Data Sync | ~3 |
| 31 | Testing Strategy & Checklist | ~5 |
| 32 | Build, Package & Distribution | ~4 |
| 33 | Future Roadmap (V2 Features) | ~3 |
| 34 | Environment Variables Reference | ~2 |
| 35 | Smart Help System & Guided Onboarding | ~9 |
| 36 | Shift Management & Cash Reconciliation (X/Z Reports) | ~6 |
| 37 | Promotions & Discount Rules Engine | ~5 |
| 38 | Granular Permissions, Role Control & Supervisor PIN | ~8 |

---

# 1. PROJECT VISION & ARCHITECTURE

## 1.1 What We Are Building

ElHegazi Retailer V1 is a **full-featured, Arabic-first, RTL Point-of-Sale and Business Management desktop application** that:

- Runs as a native Windows/Linux desktop app (Electron wrapper)
- **Minimum OS: Windows 10** (Windows 7 machines supported as LAN browser clients only — see Section 1.5)
- Stores all data locally (SQLite, zero cloud dependency, single .db file)
- Is designed to be sold as a **per-branch license** — one installation per branch
- Replaces Microsoft Access-based legacy desktop software
- Supports barcode scanners, thermal receipt printers, touchscreens
- Has a fully responsive UI that adapts between desktop, tablet, and mobile (for LAN access)
- Has built-in hardware-locked copy protection and remote license management
- Is designed from day one to be upgraded to a multi-branch cloud version in V2

## 1.2 Core Design Principles (Non-Negotiable)

These principles must be respected in every technical decision:

| Principle | Rule |
|-----------|------|
| **Arabic-First** | All UI defaults to Arabic RTL. English is secondary. Dates, numbers, currency all support Arabic locale |
| **Offline-First** | The app must work 100% without internet. Internet is only needed for license activation |
| **Data Safety** | Never lose data. Every destructive action requires confirmation. Soft-deletes everywhere. Audit log on everything |
| **Speed** | POS operations must feel instant. No user should wait >300ms for any POS action |
| **Simplicity** | Cashiers need zero training. Complexity is hidden behind roles |
| **Correctness** | Financial calculations must be penny-perfect. Use integer arithmetic for currency |

## 1.3 User Roles & Access Matrix

| Role | Arabic | Level | Description |
|------|--------|-------|-------------|
| `admin` | مدير | Full | Full system access. Setup, users, settings, all modules, delete |
| `branch_manager` | مدير فرع | High | All operations, no settings/users/delete |
| `accountant` | محاسب | Medium | Financial data, reports, no delete, no POS |
| `cashier` | كاشير | Low | POS + basic sales view only |
| `viewer` | مشاهد | Minimal | Read-only on allowed modules |

## 1.4 Full System Architecture

```
╔══════════════════════════════════════════════════════════════════╗
║                    ELECTRON DESKTOP APP                          ║
║                                                                  ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │  MAIN PROCESS (Node.js runtime)                          │    ║
║  │                                                          │    ║
║  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │    ║
║  │  │ MongoDB       │  │ Express API  │  │ License       │ │    ║
║  │  │ Manager       │  │ Server       │  │ Manager       │ │    ║
║  │  │ (spawns       │  │ :5000        │  │ (hardware ID, │ │    ║
║  │  │  mongod)      │  │ localhost    │  │  online check)│ │    ║
║  │  └──────────────┘  └──────────────┘  └───────────────┘ │    ║
║  │                                                          │    ║
║  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │    ║
║  │  │ Auto-Updater │  │ System Tray  │  │ IPC Bridge    │ │    ║
║  │  │ (electron-   │  │ (minimize to │  │ (preload.js)  │ │    ║
║  │  │  updater)    │  │  tray)       │  │               │ │    ║
║  │  └──────────────┘  └──────────────┘  └───────────────┘ │    ║
║  └─────────────────────────────────────────────────────────┘    ║
║                              ↕ IPC                               ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │  RENDERER PROCESS (Chromium)                             │    ║
║  │                                                          │    ║
║  │  React App → HTTP → localhost:5000 (Express API)        │    ║
║  │                                                          │    ║
║  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │    ║
║  │  │ Desktop UI  │  │ Mobile UI    │  │  POS Screen   │  │    ║
║  │  │ (≥1024px)   │  │  (<1024px)   │  │  (fullscreen) │  │    ║
║  │  └─────────────┘  └──────────────┘  └───────────────┘  │    ║
║  └─────────────────────────────────────────────────────────┘    ║
║                                                                  ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │  LOCAL STORAGE                                           │    ║
║  │  SQLite database file  ←→  %APPDATA%/ElHegazi/db   │    ║
║  │  File Uploads              ←→  %APPDATA%/ElHegazi/files│    ║
║  │  Backups                   ←→  User-selected folder      │    ║
║  │  Logs                      ←→  %APPDATA%/ElHegazi/logs │    ║
║  └─────────────────────────────────────────────────────────┘    ║
╚══════════════════════════════════════════════════════════════════╝
                              ↕ HTTPS (license only)
╔══════════════════════════════════════╗
║  ACTIVATION SERVER (your VPS)        ║
║  Simple Node.js + MongoDB Atlas      ║
║  License keys, hardware IDs, status  ║
╚══════════════════════════════════════╝
```

## 1.5 LAN Mode Architecture

When a branch has multiple workstations (e.g., server PC + 3 cashier PCs):

```
Branch Local Network (192.168.x.x)
│
├── Server PC (Windows 10+): ElHegazi Retailer installed, SQLite, Express on :5000
│             LAN mode ON → binds to 0.0.0.0
│
├── Cashier PC 1 (Win 10+): Browser → http://192.168.1.100:5000
├── Cashier PC 2 (Win 10+): Browser → http://192.168.1.100:5000
├── Old PC      (Win 7):    Browser → http://192.168.1.100:5000  ← LAN client only
└── Manager Tablet:         Browser → http://192.168.1.100:5000
```

The license lives on the server PC. Other clients are just browsers — no license needed per client.

**Windows 7 Support Policy:**
Windows 7 machines CANNOT run the ElHegazi Retailer Electron app (Electron 29 requires Windows 10+).
However, any Windows 7 machine with Chrome or Firefox can access the system as a **LAN browser client** — full cashier POS, invoice viewing, and basic reports work in the browser. This covers the majority of Windows 7 use cases without compromising the main codebase.

## 1.6 Data Flow for a Sale (Critical Path)

```
Cashier scans barcode
        ↓
BarcodeListener fires (event listener on keydown, reads serial input)
        ↓
Zustand POS store: addLine(item)
        ↓
UI updates instantly (no API call yet)
        ↓
Cashier clicks "Save Invoice"
        ↓
POST /api/invoices
        ↓
Express validates → begins MongoDB session (transaction)
        ↓
├── generateInvoiceNumber (atomic $inc on settings.invoice_counter)
├── deductStock (atomic $inc on stockLevel.quantity)
├── createInvoice document
├── updateCustomerBalance (if credit sale)
├── updateTreasury balance (if cash)
└── createAuditLog entry
        ↓
Commit transaction
        ↓
Response → React prints receipt
        ↓
Zustand store clears (new invoice ready)
```

## 1.7 Invoice Number Generation (Race-Condition Safe)

All counters use MongoDB's atomic `$inc` to guarantee uniqueness even if two cashiers save simultaneously:

```javascript
// Generates: INV-BR1-000001, INV-BR1-000002, etc.
const generateNumber = async (type) => {
  const field = `${type}_counter`;
  const prefix = type === 'sale' ? settings.invoice_prefix : settings.purchase_prefix;
  const settings = await Settings.findOneAndUpdate(
    {},
    { $inc: { [field]: 1 } },
    { new: true, returnDocument: 'after' }
  );
  return `${prefix}${String(settings[field]).padStart(6, '0')}`;
};
```

---

# 2. TECH STACK & COMPLETE FOLDER STRUCTURE

## 2.1 Complete Technology Decisions

### Frontend
| Package | Version | Purpose | Why This Choice |
|---------|---------|---------|-----------------|
| React | 18.x | UI framework | Ecosystem, team familiarity |
| React Router DOM | 6.x | Routing | Standard |
| TanStack Query | 5.x | Server state + caching | Automatic stale/refetch, devtools |
| Zustand | 4.x | Client state (POS cart, auth, UI) | Minimal boilerplate, no Redux complexity |
| React Hook Form | 7.x | Form state + validation | Best performance, native inputs |
| Zod | 3.x | Schema validation (shared FE/BE) | TypeScript-first, composable |
| Axios | 1.x | HTTP client | Interceptors for auth + error handling |
| i18next | Latest | AR/EN translations | RTL support, plural forms |
| Recharts | 2.x | Charts | Simplest React-native chart lib |
| react-to-print | Latest | Receipt + report printing | Direct DOM printing |
| react-hot-toast | Latest | Toast notifications | Simple, beautiful |
| Lucide React | Latest | Icons | Tree-shakeable, consistent |
| Tailwind CSS | 3.x | Styling | Utility-first, RTL plugin |
| @tailwindcss/forms | Latest | Form reset styles | Consistent inputs |
| Headless UI | Latest | Accessible modals, dropdowns | WCAG compliant |
| date-fns | Latest | Date formatting with AR locale | Lightweight, tree-shakeable |
| react-barcode-reader | Latest | USB barcode scanner support | Intercepts HID input |
| JsBarcode | Latest | Barcode generation for labels | Multiple formats |
| idb | Latest | IndexedDB wrapper (offline POS) | Promise-based, simple |
| react-virtualized | Latest | Virtual scroll (large lists) | Required for 10k+ items |
| electron-store | Latest | Encrypted local config (license) | Key-value, encrypted |

### Backend
| Package | Version | Purpose |
|---------|---------|---------|
| Node.js | 20.x LTS | Runtime |
| Express | 4.x | HTTP framework |
| better-sqlite3 | 9.x | SQLite driver (synchronous, fastest Node.js SQLite) |
| jsonwebtoken | 9.x | JWT auth tokens |
| bcryptjs | Latest | Password hashing |
| Joi | 17.x | Request body validation |
| multer | Latest | File upload handling (local storage) |
| node-cron | Latest | Scheduled jobs (auto-backup, alerts) |
| nodemailer | Latest | Email (optional for alerts) |
| pdfkit | Latest | PDF generation |
| exceljs | Latest | Excel export |
| cors | Latest | CORS (allow localhost only) |
| helmet | Latest | Security headers |
| morgan | Latest | Request logging |
| compression | Latest | Gzip |
| express-rate-limit | Latest | Rate limiting (brute force protection) |
| winston | Latest | Structured logging to file |
| express-mongo-sanitize | Latest | Prevent NoSQL injection |
| xss-clean | Latest | XSS sanitization |
| hpp | Latest | HTTP parameter pollution |

### Electron
| Package | Version | Purpose |
|---------|---------|---------|
| electron | 29.x | Desktop wrapper |
| electron-builder | Latest | Build + packaging |
| electron-updater | Latest | Auto-updates |
| electron-store | Latest | Encrypted config |
| node-machine-id | Latest | Hardware fingerprint |
| better-sqlite3 | 9.x | SQLite (bundled with app, no external process) |

### Development
| Package | Purpose |
|---------|---------|
| Vite | Frontend build tool (fast HMR) |
| concurrently | Run multiple processes in dev |
| nodemon | Auto-restart server on change |
| eslint + prettier | Code quality |
| jest | Unit testing |
| playwright | E2E testing |

## 2.2 Complete Folder Structure

```
elhegazi/
│
├── electron/                              # Electron layer
│   ├── main.js                            # Main process entry
│   ├── preload.js                         # Secure IPC bridge
│   ├── tray.js                            # System tray
│   ├── updater.js                         # Auto-update logic
│   ├── windowManager.js                   # Window creation/management
│   ├── licenseManager.js                  # Hardware ID + activation
│   ├── hardwareId.js                      # Machine fingerprint
│   ├── dbManager.js                       # Open/close SQLite connection
│   ├── serverManager.js                   # Start Express server
│   ├── ipcHandlers.js                     # All IPC event handlers
│   ├── menuBuilder.js                     # Native app menu
│   └── assets/
│       ├── icon.png                       # App icon (512x512)
│       ├── icon.ico                       # Windows icon
│       ├── tray-icon.png                  # 16x16 tray icon
│       └── tray-icon-alert.png            # Tray icon with alert dot
│
├── client/                                # React frontend
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json                  # PWA (for LAN browser access)
│   │   └── icons/
│   ├── src/
│   │   ├── main.jsx                       # Entry + i18n + RTL setup
│   │   ├── App.jsx                        # Router setup
│   │   ├── index.css                      # Tailwind + custom
│   │   │
│   │   ├── assets/
│   │   │   ├── fonts/                     # Noto Sans Arabic
│   │   │   ├── sounds/                    # beep.mp3, error.mp3, success.mp3
│   │   │   └── logo.svg
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.jsx           # Layout router (desktop/mobile)
│   │   │   │   ├── DesktopLayout.jsx      # Sidebar + topbar layout
│   │   │   │   ├── MobileLayout.jsx       # Bottom nav layout
│   │   │   │   ├── Sidebar.jsx            # Full navigation sidebar
│   │   │   │   ├── SidebarItem.jsx        # Nav item with sub-menu
│   │   │   │   ├── Topbar.jsx             # Top bar with user/search
│   │   │   │   ├── MobileDrawer.jsx       # Slide-out all-items drawer
│   │   │   │   ├── PageHeader.jsx         # Page title + breadcrumb + actions
│   │   │   │   ├── PrintLayout.jsx        # Print-specific wrapper
│   │   │   │   └── DesktopOnly.jsx        # Blocks mobile access
│   │   │   │
│   │   │   ├── ui/                        # Reusable UI primitives
│   │   │   │   ├── Button.jsx             # Variants: primary, danger, ghost
│   │   │   │   ├── Input.jsx              # With label, error, prefix/suffix
│   │   │   │   ├── Textarea.jsx
│   │   │   │   ├── Select.jsx             # Native + Headless UI version
│   │   │   │   ├── Checkbox.jsx
│   │   │   │   ├── Radio.jsx
│   │   │   │   ├── Toggle.jsx
│   │   │   │   ├── Modal.jsx              # Base modal with backdrop
│   │   │   │   ├── Drawer.jsx             # Side drawer
│   │   │   │   ├── Table.jsx              # Sortable + selectable
│   │   │   │   ├── Pagination.jsx
│   │   │   │   ├── Badge.jsx              # Status badges
│   │   │   │   ├── Card.jsx
│   │   │   │   ├── DatePicker.jsx         # With Arabic locale
│   │   │   │   ├── DateRangePicker.jsx    # For report filters
│   │   │   │   ├── SearchInput.jsx        # Debounced search input
│   │   │   │   ├── AsyncSelect.jsx        # Search + select (customers, items)
│   │   │   │   ├── ConfirmDialog.jsx      # Destructive action confirm
│   │   │   │   ├── LoadingSpinner.jsx
│   │   │   │   ├── FullPageLoader.jsx
│   │   │   │   ├── EmptyState.jsx         # No data illustration
│   │   │   │   ├── ErrorState.jsx         # API error with retry
│   │   │   │   ├── StatCard.jsx           # Dashboard metric card
│   │   │   │   ├── InfoTooltip.jsx        # (?) icon with tooltip
│   │   │   │   ├── StatusDot.jsx          # Green/red/yellow dot
│   │   │   │   ├── NumberDisplay.jsx      # Locale-formatted number
│   │   │   │   ├── CurrencyDisplay.jsx    # With currency symbol
│   │   │   │   ├── Tabs.jsx               # Tab group component
│   │   │   │   ├── Accordion.jsx
│   │   │   │   └── ProgressBar.jsx
│   │   │   │
│   │   │   ├── forms/
│   │   │   │   ├── FormField.jsx          # label + input + error wrapper
│   │   │   │   ├── CurrencyInput.jsx      # Formatted currency entry
│   │   │   │   ├── PhoneInput.jsx         # With country code
│   │   │   │   ├── PercentageInput.jsx    # 0-100 with validation
│   │   │   │   ├── BarcodeInput.jsx       # Barcode field with scan icon
│   │   │   │   └── ImageUpload.jsx        # Local file + preview
│   │   │   │
│   │   │   ├── pos/
│   │   │   │   ├── ItemGrid.jsx           # Touch-friendly item grid
│   │   │   │   ├── ItemCard.jsx           # Single item tile
│   │   │   │   ├── InvoiceLines.jsx       # Invoice line items table
│   │   │   │   ├── InvoiceLine.jsx        # Single editable line
│   │   │   │   ├── PaymentPanel.jsx       # Cash/credit payment panel
│   │   │   │   ├── BarcodeListener.jsx    # Global barcode input capture
│   │   │   │   ├── CustomerSelector.jsx   # Quick customer search
│   │   │   │   ├── DiscountPanel.jsx      # Discount controls
│   │   │   │   ├── ReceiptPreview.jsx     # Print preview modal
│   │   │   │   ├── HoldInvoiceList.jsx    # Held transactions
│   │   │   │   └── NumericKeypad.jsx      # Touch keypad
│   │   │   │
│   │   │   ├── print/
│   │   │   │   ├── Receipt80mm.jsx        # 80mm thermal receipt
│   │   │   │   ├── Receipt58mm.jsx        # 58mm thermal receipt
│   │   │   │   ├── InvoiceA4.jsx          # A4 formal invoice
│   │   │   │   ├── PurchaseOrderPrint.jsx
│   │   │   │   └── BarcodeLabel.jsx       # Label printing
│   │   │   │
│   │   │   ├── charts/
│   │   │   │   ├── RevenueChart.jsx       # Line/bar sales over time
│   │   │   │   ├── CategoryChart.jsx      # Sales by category (pie)
│   │   │   │   ├── TopItemsChart.jsx      # Top 10 items bar chart
│   │   │   │   ├── StockChart.jsx         # Stock levels chart
│   │   │   │   └── PaymentTypeChart.jsx   # Cash vs credit breakdown
│   │   │   │
│   │   │   └── mobile/
│   │   │       ├── MobileCard.jsx         # List item card for mobile
│   │   │       ├── MobileListPage.jsx     # Cards + pull-to-refresh
│   │   │       ├── MobilePOSKeypad.jsx    # Large touch numpad
│   │   │       └── MobileStatCard.jsx     # Compact stat card
│   │   │
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   ├── ChangePassword.jsx
│   │   │   │   └── LicenseActivation.jsx
│   │   │   │
│   │   │   ├── setup/
│   │   │   │   └── SetupWizard.jsx        # First-run wizard (5 steps)
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   └── Dashboard.jsx          # KPI cards + charts
│   │   │   │
│   │   │   ├── definitions/               # Codes & Definitions
│   │   │   │   ├── CompanyInfo.jsx
│   │   │   │   ├── Users.jsx
│   │   │   │   ├── UserForm.jsx
│   │   │   │   ├── UserPermissions.jsx
│   │   │   │   ├── Employees.jsx
│   │   │   │   ├── EmployeeForm.jsx
│   │   │   │   ├── Units.jsx
│   │   │   │   ├── Warehouses.jsx
│   │   │   │   ├── Banks.jsx
│   │   │   │   ├── Suppliers.jsx
│   │   │   │   ├── SupplierForm.jsx
│   │   │   │   ├── Customers.jsx
│   │   │   │   ├── CustomerForm.jsx
│   │   │   │   ├── ExpenseCategories.jsx
│   │   │   │   ├── RevenueCategories.jsx
│   │   │   │   ├── ItemCategories.jsx
│   │   │   │   └── PriceGroups.jsx
│   │   │   │
│   │   │   ├── items/
│   │   │   │   ├── Items.jsx              # Items list
│   │   │   │   ├── ItemForm.jsx           # Create/edit item
│   │   │   │   ├── ItemDetail.jsx         # Item detail + stock + history
│   │   │   │   └── ItemImport.jsx         # Excel import
│   │   │   │
│   │   │   ├── sales/
│   │   │   │   ├── POSScreen.jsx          # Main POS screen
│   │   │   │   ├── MobilePOS.jsx          # Mobile POS
│   │   │   │   ├── SalesInvoices.jsx      # Invoice list
│   │   │   │   ├── InvoiceDetail.jsx      # View/print invoice
│   │   │   │   └── SalesReturns.jsx       # Returns list + new return
│   │   │   │
│   │   │   ├── purchases/
│   │   │   │   ├── PurchaseInvoices.jsx
│   │   │   │   ├── PurchaseForm.jsx
│   │   │   │   ├── PurchaseDetail.jsx
│   │   │   │   ├── PurchaseReturns.jsx
│   │   │   │   └── PurchaseOrders.jsx
│   │   │   │
│   │   │   ├── payments/
│   │   │   │   ├── CustomerPayments.jsx
│   │   │   │   ├── SupplierPayments.jsx
│   │   │   │   └── PaymentDetail.jsx
│   │   │   │
│   │   │   ├── expenses/
│   │   │   │   ├── Expenses.jsx
│   │   │   │   ├── ExpenseForm.jsx
│   │   │   │   └── OtherRevenues.jsx
│   │   │   │
│   │   │   ├── operations/
│   │   │   │   ├── TreasuryTransfer.jsx
│   │   │   │   ├── BankOperations.jsx
│   │   │   │   ├── Cheques.jsx
│   │   │   │   ├── ChequeForm.jsx
│   │   │   │   ├── Installments.jsx
│   │   │   │   ├── InstallmentDetail.jsx
│   │   │   │   ├── BulkPriceUpdate.jsx
│   │   │   │   ├── IncentivesPenalties.jsx
│   │   │   │   └── BarcodePrinting.jsx
│   │   │   │
│   │   │   ├── stock/
│   │   │   │   ├── StockLevels.jsx
│   │   │   │   ├── StockMovements.jsx
│   │   │   │   ├── StockTransfer.jsx
│   │   │   │   ├── PhysicalCount.jsx
│   │   │   │   └── StockAdjustment.jsx
│   │   │   │
│   │   │   ├── reports/
│   │   │   │   ├── ReportsCenter.jsx
│   │   │   │   ├── SalesReport.jsx
│   │   │   │   ├── PurchasesReport.jsx
│   │   │   │   ├── ReturnsReport.jsx
│   │   │   │   ├── CustomerReport.jsx
│   │   │   │   ├── SupplierReport.jsx
│   │   │   │   ├── EmployeeReport.jsx
│   │   │   │   ├── StockReport.jsx
│   │   │   │   ├── TreasuryReport.jsx
│   │   │   │   ├── BankReport.jsx
│   │   │   │   ├── ExpensesReport.jsx
│   │   │   │   ├── ProfitLossReport.jsx
│   │   │   │   ├── DailyClosingReport.jsx
│   │   │   │   ├── ShiftReport.jsx
│   │   │   │   ├── TaxReport.jsx
│   │   │   │   └── AuditReport.jsx
│   │   │   │
│   │   │   ├── search/
│   │   │   │   └── GlobalSearch.jsx
│   │   │   │
│   │   │   ├── notifications/
│   │   │   │   └── NotificationsCenter.jsx
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── Settings.jsx
│   │   │       ├── CompanySettings.jsx
│   │   │       ├── ReceiptSettings.jsx
│   │   │       ├── InvoiceSettings.jsx
│   │   │       ├── BackupSettings.jsx
│   │   │       ├── PrinterSettings.jsx
│   │   │       ├── DisplaySettings.jsx
│   │   │       └── LicenseInfo.jsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.js                 # Auth state + login/logout
│   │   │   ├── useBarcode.js              # Barcode scanner listener
│   │   │   ├── usePrint.js                # Print helpers
│   │   │   ├── useRTL.js                  # Direction helpers
│   │   │   ├── useOfflinePOS.js           # IndexedDB offline queue
│   │   │   ├── useMediaQuery.js           # Responsive breakpoints
│   │   │   ├── usePermission.js           # Check user permissions
│   │   │   ├── useDebounce.js             # Input debounce
│   │   │   ├── useLocalStorage.js         # Persistent UI state
│   │   │   ├── useSound.js               # Beep/error sounds
│   │   │   ├── useCurrency.js             # Format currency
│   │   │   ├── useDate.js                 # Format dates (Arabic)
│   │   │   └── useElectron.js            # Access window.electron safely
│   │   │
│   │   ├── stores/
│   │   │   ├── authStore.js              # User, token, permissions
│   │   │   ├── posStore.js               # Active invoice state
│   │   │   ├── uiStore.js                # Sidebar open, theme, language
│   │   │   └── notificationStore.js      # Unread alerts count
│   │   │
│   │   ├── services/
│   │   │   ├── api.js                    # Axios instance + interceptors
│   │   │   ├── auth.service.js
│   │   │   ├── items.service.js
│   │   │   ├── invoices.service.js
│   │   │   ├── customers.service.js
│   │   │   ├── suppliers.service.js
│   │   │   ├── reports.service.js
│   │   │   └── offline.service.js        # IndexedDB offline queue
│   │   │
│   │   ├── utils/
│   │   │   ├── currency.js               # Integer arithmetic for money
│   │   │   ├── dateHelpers.js
│   │   │   ├── printHelpers.js
│   │   │   ├── validators.js
│   │   │   ├── formatters.js             # Arabic number formatting
│   │   │   └── errorMessages.js          # Arabic error messages map
│   │   │
│   │   ├── constants/
│   │   │   ├── permissions.js            # Permission keys
│   │   │   ├── routes.js                 # Route paths
│   │   │   ├── queryKeys.js              # React Query keys
│   │   │   └── config.js                 # App-wide constants
│   │   │
│   │   └── locales/
│   │       ├── ar.json                   # Arabic translations
│   │       └── en.json                   # English translations
│   │
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── index.html
│
├── server/                                # Express backend
│   ├── src/
│   │   ├── index.js                      # Entry: connects DB, starts server
│   │   ├── app.js                        # Express setup + middleware + routes
│   │   ├── config/
│   │   │   ├── database.js              # MongoDB connection (local)
│   │   │   ├── storage.js               # Local file storage (multer)
│   │   │   └── logger.js                # Winston logger
│   │   │
│   │   ├── models/                       # SQLite table definitions + query helpers
│   │   │   ├── Settings.js
│   │   │   ├── User.js
│   │   │   ├── Employee.js
│   │   │   ├── Item.js
│   │   │   ├── ItemCategory.js
│   │   │   ├── ItemPrice.js
│   │   │   ├── PriceGroup.js
│   │   │   ├── Unit.js
│   │   │   ├── Warehouse.js
│   │   │   ├── Customer.js
│   │   │   ├── CustomerGroup.js
│   │   │   ├── Supplier.js
│   │   │   ├── Bank.js
│   │   │   ├── Treasury.js
│   │   │   ├── Invoice.js
│   │   │   ├── InvoiceLine.js
│   │   │   ├── Payment.js
│   │   │   ├── Expense.js
│   │   │   ├── ExpenseCategory.js
│   │   │   ├── Revenue.js
│   │   │   ├── RevenueCategory.js
│   │   │   ├── StockLevel.js
│   │   │   ├── StockMovement.js
│   │   │   ├── Cheque.js
│   │   │   ├── Installment.js
│   │   │   ├── AuditLog.js
│   │   │   ├── Shift.js
│   │   │   ├── Notification.js
│   │   │   └── PurchaseOrder.js
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── settings.routes.js
│   │   │   ├── user.routes.js
│   │   │   ├── employee.routes.js
│   │   │   ├── item.routes.js
│   │   │   ├── customer.routes.js
│   │   │   ├── supplier.routes.js
│   │   │   ├── invoice.routes.js
│   │   │   ├── purchase.routes.js
│   │   │   ├── payment.routes.js
│   │   │   ├── expense.routes.js
│   │   │   ├── stock.routes.js
│   │   │   ├── cheque.routes.js
│   │   │   ├── installment.routes.js
│   │   │   ├── report.routes.js
│   │   │   ├── upload.routes.js
│   │   │   ├── notification.routes.js
│   │   │   ├── shift.routes.js
│   │   │   ├── audit.routes.js
│   │   │   └── backup.routes.js
│   │   │
│   │   ├── controllers/               # [mirrors routes]
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT verify + attach user to req
│   │   │   ├── permission.js         # RBAC guard
│   │   │   ├── audit.js              # Auto-log mutations
│   │   │   ├── validate.js           # Joi validation runner
│   │   │   ├── upload.js             # Multer config
│   │   │   ├── rateLimiter.js        # Per-route limits
│   │   │   ├── errorHandler.js       # Global error handler
│   │   │   └── requestLogger.js      # Morgan + Winston
│   │   │
│   │   ├── services/
│   │   │   ├── stockService.js       # All stock mutations
│   │   │   ├── invoiceService.js     # Invoice + counter logic
│   │   │   ├── reportService.js      # MongoDB aggregations
│   │   │   ├── pdfService.js         # pdfkit PDF generation
│   │   │   ├── excelService.js       # exceljs export
│   │   │   ├── backupService.js      # mongodump/restore
│   │   │   ├── notificationService.js# Create/check notifications
│   │   │   └── shiftService.js       # Shift open/close logic
│   │   │
│   │   ├── jobs/
│   │   │   ├── lowStockAlert.js      # Daily: check min stock
│   │   │   ├── chequeReminder.js     # Daily: due cheques
│   │   │   ├── installmentReminder.js# Daily: due installments
│   │   │   └── autoBackup.js         # Configurable: auto backup
│   │   │
│   │   └── utils/
│   │       ├── apiResponse.js        # Standardized {success, data, error}
│   │       ├── helpers.js
│   │       └── currencyMath.js       # Integer-safe math
│   │
│   └── package.json
│
├── shared/
│   └── validations/                  # Zod schemas (used FE + BE)
│       ├── invoice.schema.js
│       ├── item.schema.js
│       ├── customer.schema.js
│       └── user.schema.js
│
├── activation-server/                # Separate small server YOU host
│   ├── src/
│   │   ├── index.js
│   │   ├── models/License.js
│   │   ├── routes/license.routes.js
│   │   └── routes/admin.routes.js   # Your admin panel to manage licenses
│   └── package.json
│
├── scripts/
│   ├── seed.js                       # Development seed data
│   ├── create-indexes.js             # MongoDB indexes
│   └── generate-license.js          # Generate license keys
│
├── package.json                      # Root: electron + build scripts
├── electron-builder.yml              # Build config
├── .env.example
└── README.md
```

---

# 3. DATABASE SCHEMA — ALL TABLES

> **V2 Change:** ElHegazi Retailer uses **SQLite** (single `.db` file) instead of MongoDB.
> All "collections" are now **SQL tables**. Schemas below show the logical structure.
> Implementation uses `better-sqlite3` with synchronous queries — no async/await needed.
>
> **Key benefits over MongoDB:**
> - Zero startup time — SQLite opens in milliseconds
> - Invoice save: 5–20ms (vs 200–600ms with MongoDB)
> - Backup = copy one file
> - No `mongod` process to manage or bundle
>
> ```javascript
> // How queries look with better-sqlite3 (synchronous)
> const item = db.prepare('SELECT * FROM items WHERE barcode = ?').get(barcode);
> const invoice = db.prepare('SELECT * FROM invoices WHERE invoice_number = ?').get(num);
> // Returns instantly — microseconds — no await needed
> ```

## 3.1 Settings (Single Document — Branch Configuration)

```javascript
// Collection: settings
// Always exactly ONE document in this collection
{
  _id: ObjectId,

  // ── Company Identity ──────────────────────────────────────────
  company_name: { type: String, required: true },       // اسم الشركة
  company_name_en: String,
  branch_name: { type: String, required: true },        // اسم الفرع
  branch_code: { type: String, required: true },        // "BR1" — invoice prefix
  logo_path: String,                                    // Local file path
  address: String,
  phone: String,
  phone2: String,
  email: String,
  website: String,
  tax_id: String,                                       // الرقم الضريبي
  commercial_register: String,                          // السجل التجاري

  // ── Financial Settings ────────────────────────────────────────
  currency: { type: String, default: 'SAR' },
  currency_symbol: { type: String, default: 'ر.س' },
  decimal_places: { type: Number, default: 2 },        // 0, 2, or 3
  tax_rate: { type: Number, default: 0 },               // % e.g. 15
  tax_type: { type: String, enum: ['inclusive', 'exclusive', 'none'], default: 'none' },
  fiscal_year_start: { type: String, default: '01-01' }, // MM-DD

  // ── Invoice Settings ──────────────────────────────────────────
  invoice_prefix: { type: String, default: 'INV-' },
  invoice_counter: { type: Number, default: 0 },
  purchase_prefix: { type: String, default: 'PUR-' },
  purchase_counter: { type: Number, default: 0 },
  return_sale_prefix: { type: String, default: 'RET-' },
  return_sale_counter: { type: Number, default: 0 },
  return_purchase_prefix: { type: String, default: 'RPUR-' },
  return_purchase_counter: { type: Number, default: 0 },
  payment_prefix: { type: String, default: 'PAY-' },
  payment_counter: { type: Number, default: 0 },
  expense_prefix: { type: String, default: 'EXP-' },
  expense_counter: { type: Number, default: 0 },

  // ── POS Behavior ─────────────────────────────────────────────
  pos_require_customer: { type: Boolean, default: false },
  pos_allow_negative_stock: { type: Boolean, default: false },
  pos_auto_open_cash_drawer: { type: Boolean, default: true },
  pos_print_on_save: { type: Boolean, default: true },
  pos_show_item_images: { type: Boolean, default: true },
  pos_items_per_page: { type: Number, default: 20 },
  pos_default_warehouse_id: ObjectId,
  pos_default_treasury_id: ObjectId,
  default_customer_id: ObjectId,                       // "Walk-in customer" ID

  // ── Receipt Settings ──────────────────────────────────────────
  receipt_width: { type: String, enum: ['58mm', '80mm', 'A4'], default: '80mm' },
  receipt_show_logo: { type: Boolean, default: true },
  receipt_show_tax: { type: Boolean, default: true },
  receipt_show_barcode: { type: Boolean, default: false },
  receipt_header: String,                              // Custom header text (AR)
  receipt_footer: String,                              // Custom footer text (AR)
  receipt_copies: { type: Number, default: 1 },

  // ── Display & Locale ──────────────────────────────────────────
  language: { type: String, enum: ['ar', 'en'], default: 'ar' },
  date_format: { type: String, default: 'YYYY/MM/DD' },
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  show_item_cost: { type: Boolean, default: false },   // Show cost price in item lists

  // ── Backup Settings ───────────────────────────────────────────
  auto_backup: { type: Boolean, default: true },
  auto_backup_frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
  auto_backup_time: { type: String, default: '02:00' }, // HH:mm
  backup_path: String,                                 // Local folder path
  backup_keep_last: { type: Number, default: 30 },     // Keep last N backups

  // ── License ───────────────────────────────────────────────────
  license_key: String,
  hardware_id: String,
  license_status: {
    type: String,
    enum: ['trial', 'active', 'expired', 'suspended'],
    default: 'trial'
  },
  trial_start_date: Date,
  trial_expires_at: Date,
  license_activated_at: Date,
  license_expires_at: Date,                            // null = perpetual
  license_customer_name: String,
  license_branch_name: String,
  license_last_checked: Date,

  // ── Notifications ─────────────────────────────────────────────
  alert_low_stock: { type: Boolean, default: true },
  alert_cheque_days_before: { type: Number, default: 3 }, // Days before due
  alert_installment_days_before: { type: Number, default: 3 },

  // ── Metadata ──────────────────────────────────────────────────
  is_setup_complete: { type: Boolean, default: false },
  setup_completed_at: Date,
  db_version: { type: Number, default: 1 },            // For future migrations
  created_at: Date,
  updated_at: Date
}
```

## 3.2 User

```javascript
// Collection: users
{
  _id: ObjectId,
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },          // bcrypt hashed
  role: {
    type: String,
    enum: ['admin', 'branch_manager', 'accountant', 'cashier', 'viewer'],
    required: true
  },
  
  // Granular permission overrides (on top of role defaults)
  permissions: {
    // Sales
    sales_view: Boolean,
    sales_create: Boolean,
    sales_edit: Boolean,
    sales_delete: Boolean,
    sales_export: Boolean,
    sales_return: Boolean,
    
    // Purchases
    purchases_view: Boolean,
    purchases_create: Boolean,
    purchases_edit: Boolean,
    purchases_delete: Boolean,
    purchases_export: Boolean,
    purchases_return: Boolean,
    
    // Customers
    customers_view: Boolean,
    customers_create: Boolean,
    customers_edit: Boolean,
    customers_delete: Boolean,
    customers_view_balance: Boolean,
    
    // Suppliers
    suppliers_view: Boolean,
    suppliers_create: Boolean,
    suppliers_edit: Boolean,
    suppliers_delete: Boolean,
    
    // Items
    items_view: Boolean,
    items_create: Boolean,
    items_edit: Boolean,
    items_delete: Boolean,
    items_view_cost: Boolean,
    
    // Stock
    stock_view: Boolean,
    stock_transfer: Boolean,
    stock_adjust: Boolean,
    stock_physical_count: Boolean,
    
    // Expenses
    expenses_view: Boolean,
    expenses_create: Boolean,
    expenses_edit: Boolean,
    expenses_delete: Boolean,
    
    // Payments
    payments_view: Boolean,
    payments_create: Boolean,
    payments_edit: Boolean,
    payments_delete: Boolean,
    
    // Reports
    reports_view: Boolean,
    reports_export: Boolean,
    reports_profit: Boolean,          // Can see profit/cost data
    
    // Users & Settings
    users_manage: Boolean,
    settings_edit: Boolean,
    
    // POS-specific
    can_discount: Boolean,
    can_edit_price: Boolean,
    can_edit_cost: Boolean,
    max_discount_pct: Number,         // null = no limit
    can_delete_invoice: Boolean,
    can_change_invoice_date: Boolean,
    can_view_shift_report: Boolean,
    can_open_close_shift: Boolean,
    can_hold_invoice: Boolean,
    
    // Operations
    treasury_transfer: Boolean,
    bank_operations: Boolean,
    cheques_manage: Boolean,
    installments_manage: Boolean,
  },
  
  // Session control
  is_active: { type: Boolean, default: true },
  force_password_change: { type: Boolean, default: false },
  last_login: Date,
  last_login_ip: String,
  failed_login_attempts: { type: Number, default: 0 },
  locked_until: Date,
  
  // Audit
  created_by: ObjectId,
  created_at: Date,
  updated_at: Date,
  deleted_at: Date,                                    // Soft delete
  deleted_by: ObjectId
}
```

## 3.3 Employee

```javascript
// Collection: employees
{
  _id: ObjectId,
  employee_code: { type: String, unique: true },       // Auto-generated EMP-001
  name: { type: String, required: true },
  name_en: String,
  photo_path: String,
  phone: String,
  phone2: String,
  email: String,
  national_id: String,
  job_title: String,
  department: String,
  salary: Number,
  salary_type: { type: String, enum: ['monthly', 'daily', 'hourly'] },
  hire_date: Date,
  end_date: Date,
  is_active: { type: Boolean, default: true },
  notes: String,
  user_id: ObjectId,                                  // Linked user account (optional)
  
  created_by: ObjectId,
  created_at: Date,
  updated_at: Date,
  deleted_at: Date
}
```

## 3.4 ItemCategory

```javascript
// Collection: item_categories
{
  _id: ObjectId,
  name: { type: String, required: true },
  name_en: String,
  code: String,
  parent_id: ObjectId,                                // Hierarchical: null = top-level
  image_path: String,
  color: String,                                      // For POS grid display (#hex)
  sort_order: Number,
  is_active: { type: Boolean, default: true },
  
  created_by: ObjectId,
  created_at: Date,
  updated_at: Date
}
```

## 3.5 Unit

```javascript
// Collection: units
{
  _id: ObjectId,
  name: { type: String, required: true },             // "كيلوغرام"
  name_en: String,                                    // "Kilogram"
  abbreviation: { type: String, required: true },     // "كغ"
  abbreviation_en: String,                            // "kg"
  is_active: { type: Boolean, default: true },
  
  created_at: Date,
  updated_at: Date
}
```

## 3.6 Item

```javascript
// Collection: items
{
  _id: ObjectId,
  item_code: { type: String, unique: true },          // Auto or manual
  name: { type: String, required: true },
  name_en: String,
  barcode: { type: String },                          // Main barcode
  barcodes: [String],                                 // Additional barcodes
  category_id: { type: ObjectId, ref: 'ItemCategory' },
  unit_id: { type: ObjectId, ref: 'Unit' },
  purchase_unit_id: ObjectId,                         // Different unit for buying
  purchase_unit_factor: Number,                       // 1 box = 12 pcs
  
  // Pricing
  cost_price: Number,                                 // Last purchase cost (in smallest currency unit, e.g. halala)
  price1: Number,                                     // Primary sell price
  price2: Number,                                     // Wholesale price
  price3: Number,                                     // Special price
  price4: Number,                                     // Reserved
  min_price: Number,                                  // Cannot sell below this
  max_discount_pct: Number,                           // Item-level max discount
  
  // Tax
  tax_rate: Number,                                   // Override global if set
  tax_type: { type: String, enum: ['inclusive', 'exclusive', 'none'] },
  
  // Stock
  track_stock: { type: Boolean, default: true },
  allow_negative_stock: { type: Boolean, default: false },
  min_stock_qty: Number,                              // Alert threshold
  max_stock_qty: Number,                              // Overstock alert
  
  // Serial number tracking
  track_serial: { type: Boolean, default: false },
  
  // Item type
  item_type: {
    type: String,
    enum: ['product', 'service', 'composite'],        // Composite = bundled
    default: 'product'
  },
  
  // For composite items
  components: [{
    item_id: ObjectId,
    quantity: Number
  }],
  
  // Expiry tracking
  track_expiry: { type: Boolean, default: false },
  
  image_path: String,
  description: String,
  notes: String,
  tags: [String],                                     // For search
  
  is_active: { type: Boolean, default: true },
  is_featured: Boolean,                               // Show on POS home grid
  sort_order: Number,
  
  created_by: ObjectId,
  created_at: Date,
  updated_at: Date,
  deleted_at: Date
}

// Index:
// { barcode: 1 } — for barcode scan lookup
// { name: 'text', name_en: 'text', item_code: 'text', tags: 'text' } — full-text search
// { category_id: 1 }
// { is_active: 1, is_featured: 1 }
```

## 3.7 PriceGroup

```javascript
// Collection: price_groups
// Enables assigning a price group to a customer (e.g. "wholesale" always gets price2)
{
  _id: ObjectId,
  name: { type: String, required: true },
  price_column: { type: String, enum: ['price1', 'price2', 'price3', 'price4'], default: 'price1' },
  discount_pct: { type: Number, default: 0 },         // Additional % discount on top
  is_default: Boolean,
  is_active: { type: Boolean, default: true },
  
  created_at: Date,
  updated_at: Date
}
```

## 3.8 Customer

```javascript
// Collection: customers
{
  _id: ObjectId,
  customer_code: { type: String, unique: true },      // Auto CUS-001
  name: { type: String, required: true },
  name_en: String,
  customer_type: { type: String, enum: ['individual', 'company'], default: 'individual' },
  phone: { type: String },
  phone2: String,
  email: String,
  address: String,
  city: String,
  tax_id: String,                                     // For B2B
  commercial_register: String,
  
  // Financial
  price_group_id: ObjectId,                           // Links to PriceGroup
  credit_limit: { type: Number, default: 0 },        // 0 = no limit
  payment_terms_days: { type: Number, default: 0 },  // Net 30, etc.
  opening_balance: { type: Number, default: 0 },     // Debit = positive (they owe us)
  current_balance: { type: Number, default: 0 },     // Running balance (updated on each transaction)
  
  // Points / Loyalty
  loyalty_points: { type: Number, default: 0 },
  
  // Notes
  notes: String,
  is_active: { type: Boolean, default: true },
  is_blacklisted: { type: Boolean, default: false }, // Block sales on credit
  blacklist_reason: String,
  
  // Statistics (denormalized for speed)
  total_invoices: { type: Number, default: 0 },
  total_sales: { type: Number, default: 0 },
  last_sale_date: Date,
  
  created_by: ObjectId,
  created_at: Date,
  updated_at: Date,
  deleted_at: Date
}

// Index:
// { phone: 1 }
// { customer_code: 1 }
// { name: 'text', phone: 'text' }
```

## 3.9 Supplier

```javascript
// Collection: suppliers
{
  _id: ObjectId,
  supplier_code: { type: String, unique: true },
  name: { type: String, required: true },
  name_en: String,
  contact_person: String,
  phone: String,
  phone2: String,
  email: String,
  address: String,
  city: String,
  tax_id: String,
  commercial_register: String,
  
  payment_terms_days: { type: Number, default: 0 },
  opening_balance: { type: Number, default: 0 },    // Positive = we owe them
  current_balance: { type: Number, default: 0 },
  credit_limit: Number,
  
  notes: String,
  is_active: { type: Boolean, default: true },
  
  total_purchases: { type: Number, default: 0 },
  last_purchase_date: Date,
  
  created_by: ObjectId,
  created_at: Date,
  updated_at: Date,
  deleted_at: Date
}
```

## 3.10 Warehouse

```javascript
// Collection: warehouses
{
  _id: ObjectId,
  name: { type: String, required: true },
  code: String,
  address: String,
  manager_id: ObjectId,
  is_default: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  
  created_at: Date,
  updated_at: Date
}
```

## 3.11 Treasury (Cash Box)

```javascript
// Collection: treasuries
{
  _id: ObjectId,
  name: { type: String, required: true },             // "الخزينة الرئيسية"
  code: String,
  opening_balance: { type: Number, default: 0 },
  current_balance: { type: Number, default: 0 },     // Kept in sync with transactions
  is_default: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  assigned_cashier_id: ObjectId,                     // Optional: one cashier per treasury
  
  created_at: Date,
  updated_at: Date
}
```

## 3.12 Bank Account

```javascript
// Collection: banks
{
  _id: ObjectId,
  bank_name: { type: String, required: true },
  account_name: String,
  account_number: String,
  iban: String,
  currency: { type: String, default: 'SAR' },
  opening_balance: { type: Number, default: 0 },
  current_balance: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  notes: String,
  
  created_at: Date,
  updated_at: Date
}
```

## 3.13 Invoice (Sales & Returns)

```javascript
// Collection: invoices
{
  _id: ObjectId,
  invoice_number: { type: String, unique: true, required: true }, // INV-BR1-000001
  invoice_type: {
    type: String,
    enum: ['sale', 'sale_return'],
    required: true
  },
  
  // Reference (for returns)
  original_invoice_id: ObjectId,                     // If sale_return
  original_invoice_number: String,
  
  date: { type: Date, required: true },
  time: String,                                       // HH:mm
  
  customer_id: ObjectId,
  customer_name: String,                             // Snapshot at time of sale
  customer_phone: String,
  customer_tax_id: String,
  
  warehouse_id: { type: ObjectId, required: true },
  
  // Financials
  subtotal: Number,                                  // Sum of line totals before discount
  discount_type: { type: String, enum: ['amount', 'percent'], default: 'amount' },
  discount_value: { type: Number, default: 0 },
  discount_amount: { type: Number, default: 0 },    // Calculated
  additions: { type: Number, default: 0 },           // Extra charges (e.g. delivery)
  tax_amount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  
  // Payment
  payment_type: {
    type: String,
    enum: ['cash', 'credit', 'card', 'bank_transfer', 'multiple'],
    default: 'cash'
  },
  paid_amount: Number,
  change_amount: Number,                             // Change given back
  remaining_amount: Number,                         // For credit sales
  
  // Cash payment destination
  treasury_id: ObjectId,
  bank_id: ObjectId,
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'confirmed', 'partially_returned', 'returned', 'cancelled'],
    default: 'confirmed'
  },
  
  // Shift tracking
  shift_id: ObjectId,
  
  notes: String,
  printed: { type: Boolean, default: false },
  print_count: { type: Number, default: 0 },
  
  created_by: { type: ObjectId, required: true },
  created_by_name: String,                          // Snapshot
  created_at: Date,
  updated_at: Date,
  deleted_at: Date,
  deleted_by: ObjectId,
  delete_reason: String
}

// Indexes:
// { invoice_number: 1 } unique
// { date: -1 }
// { customer_id: 1, date: -1 }
// { status: 1 }
// { shift_id: 1 }
```

## 3.14 InvoiceLine

```javascript
// Collection: invoice_lines
{
  _id: ObjectId,
  invoice_id: { type: ObjectId, required: true },
  invoice_type: String,                              // 'sale' | 'purchase'
  
  item_id: { type: ObjectId, required: true },
  item_code: String,                                 // Snapshot
  item_name: String,                                 // Snapshot
  item_barcode: String,                              // Snapshot
  unit_id: ObjectId,
  unit_name: String,
  warehouse_id: ObjectId,
  
  quantity: { type: Number, required: true },
  unit_price: { type: Number, required: true },      // Price per unit
  cost_price: Number,                                // Cost at time of sale (for profit calc)
  
  discount_type: { type: String, enum: ['amount', 'percent'], default: 'amount' },
  discount_value: { type: Number, default: 0 },
  discount_amount: Number,
  
  tax_rate: Number,
  tax_amount: Number,
  
  line_total: { type: Number, required: true },      // After discount, before tax
  line_total_with_tax: Number,
  
  serial_numbers: [String],                          // If item tracks serials
  expiry_date: Date,                                 // If item tracks expiry
  batch_number: String,
  
  notes: String,
  sort_order: Number
}

// Index: { invoice_id: 1 }
```

## 3.15 Purchase

```javascript
// Collection: purchases
// Mirrors invoice structure but for supplier purchases
{
  _id: ObjectId,
  purchase_number: { type: String, unique: true },
  purchase_type: { type: String, enum: ['purchase', 'purchase_return'] },
  original_purchase_id: ObjectId,
  purchase_order_id: ObjectId,                      // If created from PO
  
  date: Date,
  supplier_id: ObjectId,
  supplier_name: String,
  supplier_invoice_number: String,                  // Supplier's own number
  
  warehouse_id: ObjectId,
  
  subtotal: Number,
  discount_type: String,
  discount_value: Number,
  discount_amount: Number,
  additions: Number,                                // Extra charges
  tax_amount: Number,
  total: Number,
  
  payment_type: { type: String, enum: ['cash', 'credit', 'card', 'bank_transfer', 'multiple'] },
  paid_amount: Number,
  remaining_amount: Number,
  treasury_id: ObjectId,
  bank_id: ObjectId,
  
  status: { type: String, enum: ['draft', 'confirmed', 'partially_returned', 'returned', 'cancelled'] },
  
  notes: String,
  
  created_by: ObjectId,
  created_by_name: String,
  created_at: Date,
  updated_at: Date,
  deleted_at: Date
}
```

## 3.16 PurchaseOrder

```javascript
// Collection: purchase_orders
{
  _id: ObjectId,
  po_number: { type: String, unique: true },
  date: Date,
  expected_date: Date,
  supplier_id: ObjectId,
  warehouse_id: ObjectId,
  
  lines: [{
    item_id: ObjectId,
    item_name: String,
    quantity_ordered: Number,
    quantity_received: Number,
    unit_price: Number,
    unit_id: ObjectId
  }],
  
  total: Number,
  notes: String,
  status: {
    type: String,
    enum: ['draft', 'sent', 'partially_received', 'received', 'cancelled'],
    default: 'draft'
  },
  
  created_by: ObjectId,
  created_at: Date,
  updated_at: Date
}
```

## 3.17 Payment

```javascript
// Collection: payments
// Records any payment transaction (customer receipt or supplier payment)
{
  _id: ObjectId,
  payment_number: { type: String, unique: true },     // PAY-000001
  payment_type: {
    type: String,
    enum: ['customer_receipt', 'supplier_payment'],
    required: true
  },
  
  date: { type: Date, required: true },
  
  // Party (one of these, based on type)
  customer_id: ObjectId,
  customer_name: String,
  supplier_id: ObjectId,
  supplier_name: String,
  
  amount: { type: Number, required: true },
  
  payment_method: {
    type: String,
    enum: ['cash', 'bank_transfer', 'cheque', 'card'],
    required: true
  },
  
  // Payment source
  treasury_id: ObjectId,
  bank_id: ObjectId,
  
  // Invoice allocation
  allocations: [{
    invoice_id: ObjectId,
    invoice_number: String,
    allocated_amount: Number
  }],
  
  reference_number: String,                          // Cheque no., transfer ref, etc.
  notes: String,
  
  created_by: ObjectId,
  created_by_name: String,
  created_at: Date,
  updated_at: Date,
  deleted_at: Date
}
```

## 3.18 StockLevel

```javascript
// Collection: stock_levels
// One document per item + warehouse combination
{
  _id: ObjectId,
  item_id: { type: ObjectId, required: true },
  warehouse_id: { type: ObjectId, required: true },
  quantity: { type: Number, default: 0 },
  reserved_quantity: { type: Number, default: 0 },  // Reserved for pending orders
  available_quantity: Number,                        // quantity - reserved (virtual)
  
  updated_at: Date
}

// Compound index: { item_id: 1, warehouse_id: 1 } unique
```

## 3.19 StockMovement

```javascript
// Collection: stock_movements
// Append-only audit trail of every stock change
{
  _id: ObjectId,
  item_id: ObjectId,
  item_name: String,                                 // Snapshot
  warehouse_id: ObjectId,
  warehouse_name: String,
  
  movement_type: {
    type: String,
    enum: [
      'sale',
      'sale_return',
      'purchase',
      'purchase_return',
      'transfer_out',
      'transfer_in',
      'adjustment_plus',
      'adjustment_minus',
      'physical_count',
      'opening_balance'
    ]
  },
  
  reference_id: ObjectId,                           // invoice_id, transfer_id, etc.
  reference_number: String,
  
  quantity_before: Number,
  quantity_change: Number,                          // Positive = added, negative = removed
  quantity_after: Number,
  
  unit_cost: Number,
  total_cost: Number,
  
  notes: String,
  created_by: ObjectId,
  created_by_name: String,
  created_at: Date
}

// Index: { item_id: 1, created_at: -1 }
// Index: { created_at: -1 }
```

## 3.20 Expense

```javascript
// Collection: expenses
{
  _id: ObjectId,
  expense_number: String,
  date: { type: Date, required: true },
  category_id: { type: ObjectId, required: true },
  category_name: String,
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  payment_method: { type: String, enum: ['cash', 'bank_transfer', 'cheque'] },
  treasury_id: ObjectId,
  bank_id: ObjectId,
  employee_id: ObjectId,                            // Who requested
  receipt_path: String,                             // Attached receipt image
  notes: String,
  is_recurring: { type: Boolean, default: false },
  recurring_frequency: String,
  
  created_by: ObjectId,
  created_by_name: String,
  created_at: Date,
  updated_at: Date,
  deleted_at: Date
}
```

## 3.21 Revenue (Other Income)

```javascript
// Collection: revenues
{
  _id: ObjectId,
  revenue_number: String,
  date: Date,
  category_id: ObjectId,
  category_name: String,
  amount: Number,
  description: String,
  payment_method: String,
  treasury_id: ObjectId,
  bank_id: ObjectId,
  notes: String,
  
  created_by: ObjectId,
  created_by_name: String,
  created_at: Date,
  updated_at: Date,
  deleted_at: Date
}
```

## 3.22 Cheque

```javascript
// Collection: cheques
{
  _id: ObjectId,
  cheque_number: { type: String, required: true },
  cheque_type: { type: String, enum: ['received', 'issued'], required: true },
  
  // Received: from customer | Issued: to supplier
  customer_id: ObjectId,
  customer_name: String,
  supplier_id: ObjectId,
  supplier_name: String,
  
  bank_id: ObjectId,                               // Bank account
  bank_name: String,
  drawer_bank: String,                             // Bank name on cheque
  
  amount: { type: Number, required: true },
  issue_date: Date,
  due_date: { type: Date, required: true },
  
  status: {
    type: String,
    enum: ['pending', 'deposited', 'cleared', 'bounced', 'cancelled'],
    default: 'pending'
  },
  
  linked_payment_id: ObjectId,
  notes: String,
  cleared_date: Date,
  bounce_reason: String,
  
  created_by: ObjectId,
  created_at: Date,
  updated_at: Date
}
```

## 3.23 Installment Plan

```javascript
// Collection: installments
{
  _id: ObjectId,
  plan_number: String,
  invoice_id: ObjectId,
  invoice_number: String,
  customer_id: ObjectId,
  customer_name: String,
  
  total_amount: Number,
  down_payment: Number,
  financed_amount: Number,
  number_of_installments: Number,
  installment_amount: Number,
  start_date: Date,
  frequency: { type: String, enum: ['weekly', 'monthly', 'quarterly'] },
  
  status: { type: String, enum: ['active', 'completed', 'defaulted', 'cancelled'] },
  
  schedule: [{
    installment_number: Number,
    due_date: Date,
    amount: Number,
    paid_amount: { type: Number, default: 0 },
    paid_date: Date,
    status: { type: String, enum: ['pending', 'paid', 'partial', 'overdue'] },
    payment_id: ObjectId
  }],
  
  notes: String,
  created_by: ObjectId,
  created_at: Date,
  updated_at: Date
}
```

## 3.24 Shift

```javascript
// Collection: shifts
{
  _id: ObjectId,
  shift_number: String,
  cashier_id: { type: ObjectId, required: true },
  cashier_name: String,
  treasury_id: ObjectId,
  
  opened_at: { type: Date, required: true },
  closed_at: Date,
  
  opening_balance: { type: Number, required: true }, // Cash in drawer at start
  expected_closing_balance: Number,                 // Calculated: opening + cash sales - payouts
  actual_closing_balance: Number,                   // What cashier counted
  difference: Number,                               // Actual - Expected (short/over)
  
  // Summary
  total_sales: Number,
  total_returns: Number,
  total_cash_sales: Number,
  total_card_sales: Number,
  total_credit_sales: Number,
  cash_in: Number,
  cash_out: Number,
  
  invoices_count: Number,
  returns_count: Number,
  
  status: { type: String, enum: ['open', 'closed'] },
  notes: String,
  closing_notes: String,
  
  created_at: Date,
  updated_at: Date
}
```

## 3.25 AuditLog

```javascript
// Collection: audit_logs
// Immutable: never updated or deleted
{
  _id: ObjectId,
  user_id: ObjectId,
  user_name: String,
  action: String,                                   // 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', etc.
  resource: String,                                 // 'Invoice', 'Customer', etc.
  resource_id: ObjectId,
  resource_number: String,                          // Human-readable reference
  
  // Before/After for edits
  changes: {
    before: Object,
    after: Object
  },
  
  ip_address: String,
  user_agent: String,
  
  created_at: { type: Date, required: true }        // Index this
}

// Index: { created_at: -1 }
// Index: { user_id: 1 }
// Index: { resource: 1, resource_id: 1 }
```

## 3.26 Notification

```javascript
// Collection: notifications
{
  _id: ObjectId,
  type: {
    type: String,
    enum: [
      'low_stock',
      'cheque_due',
      'installment_due',
      'customer_credit_limit',
      'backup_required',
      'license_expiring',
      'license_expired',
      'shift_not_closed'
    ]
  },
  title: String,
  message: String,
  severity: { type: String, enum: ['info', 'warning', 'danger'] },
  is_read: { type: Boolean, default: false },
  reference_id: ObjectId,                           // item_id, cheque_id, etc.
  reference_type: String,
  
  created_at: Date,
  read_at: Date
}
```

## 3.27 CustomerGroup

```javascript
// Collection: customer_groups
{
  _id: ObjectId,
  name: String,
  discount_pct: Number,
  price_group_id: ObjectId,
  is_active: Boolean,
  created_at: Date
}
```

## 3.28 ExpenseCategory / RevenueCategory

```javascript
// Collection: expense_categories
{
  _id: ObjectId,
  name: { type: String, required: true },
  name_en: String,
  parent_id: ObjectId,                              // Sub-categories
  is_active: { type: Boolean, default: true },
  created_at: Date
}

// Same structure for revenue_categories
```

---

# 4. AUTHENTICATION, SESSIONS & SECURITY

## 4.1 JWT Strategy

```javascript
// JWT payload (minimal — never put sensitive data in JWT)
{
  sub: "userId",
  username: "ahmed",
  role: "cashier",
  name: "Ahmed Mohamed",
  iat: 1234567890,
  exp: 1234567890   // 8 hours for normal users, 24h for admin
}
```

Token refresh strategy:
- Access token: 8 hours
- On each API request, if token has less than 1 hour remaining → auto-refresh
- Logout: token added to in-memory blacklist (small, since app is single-machine)
- Admin can force-logout any user (sets `locked_until` far future)

## 4.2 Login Flow

```
POST /api/auth/login
{ username, password }
        ↓
Find user by username
        ↓
Check is_active → 403 if inactive
        ↓
Check locked_until → 429 if still locked
        ↓
bcrypt.compare(password, hash)
        ↓
If wrong: increment failed_attempts
  → if >= 5: set locked_until = now + 30min
  → return 401
        ↓
If correct: reset failed_attempts to 0
Update last_login
        ↓
Sign JWT → return { token, user }
```

## 4.3 Password Policy

- Minimum 8 characters
- At least one uppercase, one lowercase, one number
- Cannot reuse last 3 passwords (store hashed history)
- Admin can set `force_password_change: true` on user creation
- Password reset only by admin (no email reset — offline app)

## 4.4 Session Control

```javascript
// middleware/auth.js
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'NO_TOKEN' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Refresh user from DB on each request (catches deactivation/role changes)
    const user = await User.findById(decoded.sub).select('-password');
    if (!user || !user.is_active) return res.status(401).json({ error: 'USER_INACTIVE' });
    if (user.locked_until && user.locked_until > new Date()) {
      return res.status(401).json({ error: 'USER_LOCKED' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'TOKEN_EXPIRED' });
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
};
```

## 4.5 Role-Based Permission Defaults

```javascript
// constants/permissions.js
const ROLE_DEFAULTS = {
  admin: {
    // Admin has everything = true, no limits
    sales_view: true, sales_create: true, sales_edit: true, sales_delete: true,
    sales_export: true, sales_return: true,
    // ... all true
    can_discount: true, can_edit_price: true, can_edit_cost: true,
    max_discount_pct: null, can_delete_invoice: true,
    reports_profit: true, users_manage: true, settings_edit: true,
  },
  branch_manager: {
    sales_view: true, sales_create: true, sales_edit: true, sales_delete: false,
    sales_export: true, sales_return: true,
    purchases_view: true, purchases_create: true, purchases_edit: true,
    can_discount: true, can_edit_price: true, max_discount_pct: 20,
    reports_profit: true, users_manage: false, settings_edit: false,
  },
  accountant: {
    sales_view: true, sales_create: false, sales_edit: false, sales_delete: false,
    sales_export: true,
    purchases_view: true, purchases_export: true,
    customers_view: true, customers_view_balance: true,
    reports_view: true, reports_export: true, reports_profit: true,
    settings_edit: false,
  },
  cashier: {
    sales_view: true, sales_create: true, sales_edit: false, sales_delete: false,
    sales_return: false,
    can_discount: false, can_edit_price: false, max_discount_pct: 0,
    customers_view: true,
    items_view: true,
    reports_view: false,
    settings_edit: false,
  },
  viewer: {
    sales_view: true, purchases_view: true,
    customers_view: true, suppliers_view: true,
    items_view: true, stock_view: true,
    reports_view: true,
    // everything else false
  }
};

// Merge: role defaults + user.permissions overrides (user.permissions takes priority)
const getEffectivePermissions = (user) => ({
  ...ROLE_DEFAULTS[user.role],
  ...Object.fromEntries(
    Object.entries(user.permissions).filter(([_, v]) => v !== null && v !== undefined)
  )
});
```

## 4.6 Express API Security Stack

```javascript
// app.js security middleware order:
app.use(helmet());                          // Security headers
app.use(cors({ origin: ['http://localhost:5000', 'http://127.0.0.1:5000'] }));
app.use(express.json({ limit: '10mb' }));
app.use(mongoSanitize());                   // Prevent NoSQL injection ($, . in keys)
app.use(xss());                             // Strip XSS from string inputs
app.use(hpp());                             // Prevent parameter pollution

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }); // 10 login attempts/15min
const apiLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 500 });  // 500 req/min
app.use('/api/auth/login', authLimiter);
app.use('/api', apiLimiter);
```

---



---

# 4.7 GRANULAR PERMISSION SYSTEM (Full RBAC)

> *Gap Analysis V2 — Domain 1A*
> The following extends the basic role matrix with a complete, per-flag permission schema.
> Add a `role_permissions` collection — one document per role — to allow admin-configurable feature flags.

```javascript
// Collection: role_permissions
{
  _id: ObjectId,
  role: String,           // 'admin' | 'branch_manager' | 'accountant' | 'cashier' | 'viewer'
  is_system_role: Boolean,
  label_ar: String,
  label_en: String,

  pos: {
    can_access:                Boolean,
    can_apply_manual_discount: Boolean,
    can_apply_item_discount:   Boolean,
    can_apply_invoice_discount:Boolean,
    max_discount_percent:      Number,
    can_change_item_price:     Boolean,
    can_delete_invoice_line:   Boolean,
    can_void_invoice:          Boolean,
    can_hold_invoice:          Boolean,
    can_retrieve_held_invoice: Boolean,
    can_select_customer:       Boolean,
    can_change_payment_method: Boolean,
    can_accept_credit_sale:    Boolean,
    can_open_cash_drawer_manually: Boolean,
    can_process_return:        Boolean,
    can_print_receipt:         Boolean,
    can_reprint_receipt:       Boolean,
    can_apply_promotions_manually: Boolean,
    can_see_item_cost_price:   Boolean,
    can_add_new_customer:      Boolean,
    can_do_pay_in:             Boolean,
    can_do_pay_out:            Boolean,
  },

  shift: {
    can_open_shift:            Boolean,
    can_close_own_shift:       Boolean,
    can_close_any_shift:       Boolean,
    can_view_own_shift_report: Boolean,
    can_view_all_shifts:       Boolean,
    can_print_x_report:        Boolean,
    can_print_z_report:        Boolean,
    can_override_discrepancy:  Boolean,
  },

  inventory: {
    can_view_items:            Boolean,
    can_create_item:           Boolean,
    can_edit_item:             Boolean,
    can_delete_item:           Boolean,
    can_view_stock_levels:     Boolean,
    can_adjust_stock:          Boolean,
    can_view_cost_prices:      Boolean,
    can_edit_prices:           Boolean,
    can_print_barcode_labels:  Boolean,
    can_import_items:          Boolean,
    can_export_items:          Boolean,
  },

  crm: {
    can_view_customers:        Boolean,
    can_create_customer:       Boolean,
    can_edit_customer:         Boolean,
    can_delete_customer:       Boolean,
    can_view_customer_balance: Boolean,
    can_edit_customer_credit_limit: Boolean,
    can_view_suppliers:        Boolean,
    can_create_supplier:       Boolean,
    can_edit_supplier:         Boolean,
  },

  finance: {
    can_view_payments:         Boolean,
    can_create_payment:        Boolean,
    can_view_expenses:         Boolean,
    can_create_expense:        Boolean,
    can_view_revenues:         Boolean,
    can_create_revenue:        Boolean,
    can_view_treasury:         Boolean,
    can_transfer_between_treasuries: Boolean,
  },

  reports: {
    can_view_sales_reports:    Boolean,
    can_view_inventory_reports:Boolean,
    can_view_financial_reports:Boolean,
    can_view_customer_reports: Boolean,
    can_view_cashier_reports:  Boolean,
    can_view_profit_reports:   Boolean,
    can_view_audit_log:        Boolean,
    can_export_reports:        Boolean,
    can_schedule_reports:      Boolean,
  },

  settings: {
    can_view_settings:         Boolean,
    can_edit_company_info:     Boolean,
    can_edit_receipt_settings: Boolean,
    can_edit_tax_settings:     Boolean,
    can_edit_user_permissions: Boolean,
    can_manage_users:          Boolean,
    can_manage_roles:          Boolean,
    can_run_backup:            Boolean,
    can_restore_backup:        Boolean,
    can_view_license:          Boolean,
    can_reset_help_state:      Boolean,
  },

  purchases: {
    can_view_purchases:        Boolean,
    can_create_purchase:       Boolean,
    can_edit_purchase:         Boolean,
    can_approve_purchase:      Boolean,
    can_view_purchase_returns: Boolean,
    can_create_purchase_return:Boolean,
  },

  created_at: Date,
  updated_at: Date,
}
```

### Default Role Defaults Table

| Permission Group | admin | branch_manager | accountant | cashier | viewer |
|-----------------|-------|----------------|------------|---------|--------|
| POS: can_access | ✓ | ✓ | ✗ | ✓ | ✗ |
| POS: can_change_item_price | ✓ | ✓ | ✗ | ✗ | ✗ |
| POS: can_void_invoice | ✓ | ✓ | ✗ | ✗ | ✗ |
| POS: max_discount_percent | 100 | 50 | 0 | 10 | 0 |
| POS: can_accept_credit_sale | ✓ | ✓ | ✗ | ✓* | ✗ |
| POS: can_see_item_cost_price | ✓ | ✓ | ✓ | ✗ | ✗ |
| Reports: can_view_profit | ✓ | ✓ | ✓ | ✗ | ✗ |
| Inventory: can_adjust_stock | ✓ | ✓ | ✗ | ✗ | ✗ |
| Settings: can_edit_permissions | ✓ | ✗ | ✗ | ✗ | ✗ |

*configurable by admin

---

# 4.8 SUPERVISOR PIN OVERRIDE (Manager Approval Workflow)

> *Gap Analysis V2 — Domain 1B*

When a cashier tries a restricted action, instead of a hard block the system prompts for a **supervisor PIN** to authorize the action once without logging out.

```javascript
// Add to users collection:
supervisor_pin: { type: String },   // 4–6 digit PIN, bcrypt hashed
                                    // Used ONLY for action-level overrides

// Actions that support supervisor override (configurable per permission):
override_actions: [
  'apply_discount_above_limit',
  'change_item_price',
  'void_invoice',
  'accept_credit_sale',
  'open_cash_drawer',
  'process_return',
  'close_shift_with_discrepancy',
]

// UI Flow:
// 1. Cashier attempts restricted action
// 2. Modal: "هذا الإجراء يتطلب موافقة المشرف"
// 3. Supervisor enters PIN (4-6 digits)
// 4. System verifies PIN against any user with can_override = true
// 5. If valid: action proceeds, logged to audit_log with both user IDs
// 6. If invalid 3x: lock override attempts for 5 minutes

// API:
POST /api/auth/supervisor-override
Body: { action: String, supervisor_pin: String, context: Object }
Returns: { authorized: Boolean, supervisor_id: ObjectId } | 401
```

---

# 4.9 MFA FOR ADMIN (Multi-Factor Authentication)

> *Gap Analysis V1 — GAP 2*

Admin and branch_manager roles support TOTP-based MFA (Google Authenticator / any TOTP app).

```javascript
// Add to users collection:
mfa_enabled: { type: Boolean, default: false },
mfa_secret:  { type: String },          // encrypted TOTP secret
mfa_backup_codes: [String],             // 8 one-time emergency codes, hashed

// New API endpoints:
POST  /api/auth/mfa/setup       → Generate QR code + secret for user
POST  /api/auth/mfa/verify      → Verify TOTP code, activate MFA
POST  /api/auth/mfa/login       → Second-factor login step
POST  /api/auth/mfa/disable     → Disable MFA (requires current TOTP code)
POST  /api/auth/mfa/backup      → Use one backup code to login

// Login flow change:
// Step 1: POST /api/auth/login → returns { requires_mfa: true, temp_token }
// Step 2: POST /api/auth/mfa/login → returns full JWT

// Packages to add (Backend):
// speakeasy   — TOTP generation and verification
// qrcode      — QR code generation for authenticator app setup
```

**MFA is mandatory for `admin` role. Optional for `branch_manager`. Not applicable to `cashier` or `viewer`.**

---

# 4.10 SESSION AUTO-LOCK (Inactivity Timeout)

> *Gap Analysis V1 — GAP 2*

Auto-lock after N minutes of inactivity. User re-enters their PIN to resume.

```javascript
// Add to Settings collection:
session_timeout_minutes: { type: Number, default: 15 },  // 0 = disabled
cashier_pin_lock: { type: Boolean, default: true },

// Add to users collection:
pin_code: { type: String },   // 4-digit PIN, bcrypt hashed.
                              // Used ONLY for screen unlock — not for login.

// Frontend logic (AppShell.jsx):
// Track last user activity (mousemove, keydown, click)
// After timeout: blur all content, show lock overlay
// User enters 4-digit PIN → verify via POST /api/auth/unlock
// Wrong PIN 3x → force full logout

// New API endpoint:
POST /api/auth/unlock   → body: { pin_code } → returns { ok: true } or 401
```

---

# 4.11 ACCOUNT LOCKOUT & CONCURRENT SESSION CONTROL

> *Gap Analysis V1 — GAP 2*

```javascript
// Add to users collection:
login_attempts: { type: Number, default: 0 },
locked_until:   { type: Date, default: null },
active_session_token: { type: String, default: null },

// Lockout logic in POST /api/auth/login:
// 1. If locked_until > now → reject with 423 and time remaining
// 2. On wrong password: $inc login_attempts
//    - After 5 attempts: lock for 15 minutes
//    - After 10 attempts: lock for 1 hour (requires admin to unlock)
// 3. On correct password: reset login_attempts = 0, locked_until = null

// New API endpoint (admin only):
POST /api/users/:id/unlock-account  → Reset login_attempts, clear locked_until

// Concurrent session control:
// On login: save current JWT jti here
// On every request: middleware checks if req.token.jti === user.active_session_token
// If mismatch: return 401 "تم تسجيل الدخول من جهاز آخر"
// Exception: admin and viewer roles are allowed concurrent sessions
```

---

# 4.12 DATA ENCRYPTION AT REST

> *Gap Analysis V1 — GAP 2*

```
Electron-level (electron-store — already encrypted):
  ✓ license_key, JWT secret, hardware ID — encrypted by electron-store

Application-level field encryption (priority fields):
  - users.password_hash        → bcrypt (already done)
  - users.mfa_secret           → AES-256-GCM encrypted before storing
  - users.mfa_backup_codes     → bcrypt each code
  - customers.phone            → encrypt if storing PII
  - settings.jwt_secret        → stored only in electron-store, never in DB

// Package to add:
// mongoose-field-encryption  — Field-level AES encryption for Mongoose
```

---

# 4.13 TOLERANCE POLICY & DISCOUNT HARD LIMITS

> *Gap Analysis V2 — Domain 1D*

```javascript
// Add to settings collection:
tolerance_policy: {
  max_cash_discrepancy_warn:   Number,  // Warn if shift cash diff > X SAR
  max_cash_discrepancy_block:  Number,  // Block Z-report if diff > Y SAR
  max_single_discount_percent: Number,  // Global hard cap (default: 50%)
  max_daily_returns_per_cashier: Number,
  max_void_per_shift:          Number,
  require_reason_for_discount_above: Number, // e.g. >20% → mandatory reason
}

// When cashier discount exceeds 'require_reason_for_discount_above':
// Modal: "يرجى إدخال سبب الخصم" with free-text field (mandatory)
// Logged to audit_log with reason text
```


---

# 5. LICENSE SYSTEM & COPY PROTECTION

## 5.1 Hardware Fingerprint Generation

```javascript
// electron/hardwareId.js
const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');
const os = require('os');

function generateHardwareId() {
  try {
    const machineId = machineIdSync({ original: true });
    const cpuModel = os.cpus()[0]?.model || 'unknown';
    const platform = os.platform();
    const combined = `elhegazi::${machineId}::${cpuModel}::${platform}`;
    return crypto.createHash('sha256').update(combined).digest('hex').slice(0, 32).toUpperCase();
  } catch (err) {
    // Fallback: less stable, but functional
    const hostname = os.hostname();
    const networkInterfaces = Object.values(os.networkInterfaces())
      .flat().filter(i => !i.internal && i.mac !== '00:00:00:00:00:00')[0]?.mac || '';
    return crypto.createHash('sha256').update(`${hostname}::${networkInterfaces}`).digest('hex').slice(0, 32).toUpperCase();
  }
}
```

## 5.2 License Check on Startup

```javascript
// electron/licenseManager.js
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days offline grace
const ACTIVATION_URL = 'https://activate.elhegazi.com';

async function checkLicense(store) {
  const licenseKey = store.get('license_key');
  const hardwareId = generateHardwareId();
  const firstRun = store.get('first_run_date');
  
  // --- Trial logic ---
  if (!firstRun) store.set('first_run_date', Date.now());
  const trialDays = 30;
  const daysSinceFirstRun = (Date.now() - (store.get('first_run_date') || Date.now())) / 86400000;
  
  if (!licenseKey) {
    if (daysSinceFirstRun < trialDays) {
      return { valid: true, status: 'trial', daysRemaining: Math.ceil(trialDays - daysSinceFirstRun) };
    }
    return { valid: false, status: 'trial_expired', daysRemaining: 0 };
  }
  
  // --- Check cache ---
  const cache = store.get('license_cache');
  if (cache?.valid && (Date.now() - cache.timestamp) < CACHE_DURATION) {
    // Check expiry even from cache
    if (cache.expires_at && new Date(cache.expires_at) < new Date()) {
      return { valid: false, status: 'expired' };
    }
    return { valid: true, status: 'active', fromCache: true, expires_at: cache.expires_at };
  }
  
  // --- Online verification ---
  try {
    const { data } = await axios.post(`${ACTIVATION_URL}/api/verify`, {
      license_key: licenseKey,
      hardware_id: hardwareId,
    }, { timeout: 8000 });
    
    store.set('license_cache', { valid: data.valid, timestamp: Date.now(), expires_at: data.expires_at });
    return data;
    
  } catch (networkErr) {
    // Network unreachable: fall back to cache if available
    if (cache?.valid) return { valid: true, status: 'active', fromCache: true, offline: true };
    return { valid: false, status: 'network_error' };
  }
}
```

## 5.3 License Activation Flow (Electron Window)

```
User enters license key
        ↓
POST /api/activate to activation server
  { license_key, hardware_id }
        ↓
Server checks:
  - Key exists?
  - Status = 'available' or (status = 'active' AND hardware_id matches)?
  - Not expired?
        ↓
If OK:
  - Set hardware_id, status='active', activated_at
  - Return { success: true, expires_at, branch_name }
        ↓
Electron stores key + cache
App relaunches → main window opens
```

## 5.4 Activation Server (Your VPS)

```javascript
// activation-server/src/models/License.js
{
  _id: ObjectId,
  license_key: { type: String, unique: true },     // ELH-XXXX-XXXX-XXXX-XXXX
  hardware_id: String,                             // Bound machine
  
  status: {
    type: String,
    enum: ['available', 'active', 'suspended', 'expired', 'revoked'],
    default: 'available'
  },
  
  // License info
  customer_name: String,
  branch_name: String,
  phone: String,
  notes: String,
  
  // Dates
  expires_at: Date,                                // null = perpetual
  activated_at: Date,
  suspended_at: Date,
  suspend_reason: String,
  
  // Activity
  last_verified_at: Date,
  verification_count: Number,
  
  created_at: Date
}
```

**Admin Panel (simple HTML page on activation server):**
- List all licenses + status
- Generate new license key
- Suspend / unsuspend a license
- Extend expiry date
- View verification history per license

## 5.5 In-App License Status Display

Show in the topbar (subtle) and in Settings → License Info:

- ✅ Active | Expires: 31/12/2027
- ⚠️ Trial Mode | 12 days remaining
- 🔴 License Expired — contact support
- 📴 Offline (cached, 5 days until next check required)

## 5.6 What Happens When License Expires

- App shows full-screen warning banner
- All operations are READ-ONLY (can view data, print, but cannot create/edit)
- This gives the branch time to contact support without losing data access
- After 15 days past expiry → full block (license activation screen only)

---

# 6. ELECTRON DESKTOP ARCHITECTURE

## 6.1 Main Process (main.js) — Full Implementation

```javascript
// electron/main.js
const { app, BrowserWindow, dialog, Menu, shell, nativeTheme } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { openDatabase, closeDatabase } = require('./dbManager');
const { startExpressServer } = require('./serverManager');
const { checkLicense } = require('./licenseManager');
const { generateHardwareId } = require('./hardwareId');
const { setupTray } = require('./tray');
const { setupUpdater } = require('./updater');
const { registerIpcHandlers } = require('./ipcHandlers');
const { buildMenu } = require('./menuBuilder');

const store = new Store({ encryptionKey: 'elhegazi-v1-2026' });

let mainWindow = null;
let licenseWindow = null;
let splashWindow = null;
let isQuitting = false;

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Create splash screen (shows while MongoDB + Express start)
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400, height: 300,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false,
    webPreferences: { contextIsolation: true }
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366, height: 768,
    minWidth: 1024, minHeight: 600,
    title: 'ElHegazi Retailer',
    icon: path.join(__dirname, 'assets/icon.png'),
    show: false, // Show only when ready
    backgroundColor: '#F9FAFB',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadURL('http://127.0.0.1:5000');

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) { splashWindow.close(); splashWindow = null; }
    mainWindow.show();
    mainWindow.focus();
  });

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://127.0.0.1:5000') && !url.startsWith('http://localhost:5000')) {
      event.preventDefault();
      shell.openExternal(url); // Open in system browser instead
    }
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  Menu.setApplicationMenu(buildMenu(mainWindow));
}

function createLicenseWindow() {
  licenseWindow = new BrowserWindow({
    width: 520, height: 600,
    resizable: false, frame: true,
    title: 'تفعيل ElHegazi Retailer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  licenseWindow.loadURL('http://127.0.0.1:5000/license-activation');
}

async function initialize() {
  createSplashWindow();

  try {
    // Step 1: Open SQLite database (instant — no process to start)
    await openDatabase(store);
    
    // Step 2: Start Express API
    await startExpressServer();
    
    // Step 3: Check license
    const licenseResult = await checkLicense(store);

    if (splashWindow) { splashWindow.close(); splashWindow = null; }

    if (!licenseResult.valid) {
      createLicenseWindow();
    } else {
      createMainWindow();
      setupTray(mainWindow, () => { isQuitting = true; app.quit(); });
      setupUpdater(mainWindow);
    }
    
    registerIpcHandlers(store, mainWindow);

  } catch (error) {
    if (splashWindow) splashWindow.close();
    dialog.showErrorBox(
      'خطأ في تشغيل البرنامج',
      `حدث خطأ أثناء تشغيل البرنامج:\n\n${error.message}\n\nيرجى إعادة المحاولة.`
    );
    app.quit();
  }
}

app.whenReady().then(initialize);

app.on('before-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault();
    isQuitting = true;
    closeDatabase();
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // Don't quit on all-windows-closed — app lives in tray
});
```

## 6.2 SQLite Database Manager

> **V2 Change:** Replaces mongoManager.js. No external process — SQLite opens in milliseconds.

```javascript
// electron/dbManager.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;

function getDbPath(store) {
  return store.get('db_path') || path.join(app.getPath('userData'), 'elhegazi.db');
}

function openDatabase(store) {
  const dbPath = getDbPath(store);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  // Opens instantly — no process, no socket, no wait
  db = new Database(dbPath);

  // Performance tuning for POS (safe on Windows 10 SSD)
  db.pragma('journal_mode = WAL');   // Write-Ahead Logging — faster writes
  db.pragma('synchronous = NORMAL'); // Safe + fast (not paranoid-slow)
  db.pragma('cache_size = -64000');  // 64MB cache
  db.pragma('foreign_keys = ON');    // Enforce relationships

  // Run migrations on every open
  runMigrations(db);

  console.log(`SQLite opened: ${dbPath}`);
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('SQLite closed');
  }
}

function getDb() {
  if (!db) throw new Error('Database not open');
  return db;
}

function runMigrations(db) {
  // Create schema version table if not exists
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`);
  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get();
  const current = row.v || 0;

  const migrations = [
    { version: 1, sql: require('./migrations/001_initial_schema').up },
    // Add future migrations here: { version: 2, sql: require('./migrations/002_...').up }
  ];

  for (const m of migrations) {
    if (m.version > current) {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_version VALUES (?)').run(m.version);
      console.log(`Migration ${m.version} applied`);
    }
  }
}

module.exports = { openDatabase, closeDatabase, getDb };
```

**Startup time comparison:**
```
MongoDB: App waits 4–6 seconds for mongod process to start
SQLite:  Database open in < 50ms — user barely sees the splash screen
```

## 6.3 Preload (Secure IPC Bridge)

```javascript
// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// IMPORTANT: Only expose what the renderer NEEDS
// Never expose ipcRenderer itself, shell, or fs directly
contextBridge.exposeInMainWorld('electron', {
  // License management
  activateLicense: (key) => ipcRenderer.invoke('license:activate', key),
  getLicenseStatus: () => ipcRenderer.invoke('license:status'),
  getHardwareId: () => ipcRenderer.invoke('license:hardware-id'),
  
  // Backup & Restore
  chooseFolder: () => ipcRenderer.invoke('dialog:choose-folder'),
  chooseFile: (filters) => ipcRenderer.invoke('dialog:choose-file', filters),
  createBackup: (targetPath) => ipcRenderer.invoke('backup:create', targetPath),
  restoreBackup: (backupPath) => ipcRenderer.invoke('backup:restore', backupPath),
  
  // Printing (native print dialog)
  printPage: (options) => ipcRenderer.invoke('print:page', options),
  
  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => process.platform,
  
  // Updates
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  
  // Tray notifications
  showNotification: (title, body) => ipcRenderer.invoke('notification:show', title, body),
  
  // Open items in OS
  openPath: (filePath) => ipcRenderer.invoke('shell:open-path', filePath),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  
  // Listen to events from main
  on: (channel, callback) => {
    const allowedChannels = ['update-available', 'update-downloaded', 'license-status-changed'];
    if (allowedChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  off: (channel, callback) => ipcRenderer.off(channel, callback),
});
```

## 6.4 System Tray

```javascript
// electron/tray.js
const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let tray = null;

function setupTray(mainWindow, onQuit) {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/tray-icon.png'));
  tray = new Tray(icon);
  tray.setToolTip('ElHegazi Retailer');
  
  const menu = Menu.buildFromTemplate([
    {
      label: 'فتح البرنامج',
      click: () => { mainWindow.show(); mainWindow.focus(); }
    },
    { type: 'separator' },
    {
      label: 'لوحة التحكم',
      click: () => { mainWindow.show(); mainWindow.webContents.executeJavaScript("window.location.hash = '/dashboard'"); }
    },
    {
      label: 'نقطة البيع',
      click: () => { mainWindow.show(); mainWindow.webContents.executeJavaScript("window.location.hash = '/pos'"); }
    },
    { type: 'separator' },
    { label: 'إنهاء البرنامج', click: onQuit }
  ]);
  
  tray.setContextMenu(menu);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

module.exports = { setupTray };
```

## 6.5 Auto-Updater

```javascript
// electron/updater.js
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const log = require('electron-log');

autoUpdater.logger = log;
autoUpdater.autoDownload = false;

function setupUpdater(mainWindow) {
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info);
    dialog.showMessageBox({
      type: 'info',
      title: 'تحديث متاح',
      message: `الإصدار ${info.version} متاح للتحديث. هل تريد التحديث الآن؟`,
      buttons: ['تحديث الآن', 'لاحقاً'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate();
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'جاهز للتثبيت',
      message: 'تم تحميل التحديث. سيتم إعادة تشغيل البرنامج لإتمام التثبيت.',
      buttons: ['إعادة التشغيل'],
    }).then(() => autoUpdater.quitAndInstall());
  });

  // Check for updates every 6 hours
  setInterval(() => autoUpdater.checkForUpdates(), 6 * 60 * 60 * 1000);
  // Check on startup (after 30 seconds)
  setTimeout(() => autoUpdater.checkForUpdates(), 30000);
}
```

## 6.6 Electron Builder Config

```yaml
# electron-builder.yml
appId: com.elhegazi.pos
productName: ElHegazi Retailer
copyright: "Copyright © 2026 ElHegazi"
asar: true

directories:
  output: dist
  buildResources: electron/assets

files:
  - "electron/**/*"
  - "client/dist/**/*"
  - "server/src/**/*"
  - "server/node_modules/**/*"
  - "node_modules/electron-store/**/*"
  - "node_modules/node-machine-id/**/*"

extraResources:
  - from: "bin/${os}"
    to: "bin"
    filter: ["mongod*", "mongodump*", "mongorestore*"]

win:
  target:
    - target: nsis
      arch: [x64]
  icon: electron/assets/icon.ico
  requestedExecutionLevel: asInvoker
  
nsis:
  oneClick: false
  perMachine: true
  allowToChangeInstallationDirectory: true
  installerIcon: electron/assets/installer.ico
  uninstallerIcon: electron/assets/uninstaller.ico
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: ElHegazi Retailer
  installerHeaderIcon: electron/assets/installer-header.ico
  include: electron/installer.nsh
  
linux:
  target: AppImage
  icon: electron/assets/icon.png
  category: Office

publish:
  provider: generic
  url: https://updates.elhegazi.com/releases/latest/
  channel: stable
```

---



---

## 6.7 POS CRASH RECOVERY (IndexedDB Draft)

> *Gap Analysis V2 — Domain 10C*

```javascript
// If app crashes during an active POS invoice:
// 1. Zustand POS store is periodically persisted to IndexedDB every 30 seconds
//    and on every item add (idb is already in the tech stack)
// 2. On next app launch: check for unsaved draft in IndexedDB
// 3. If found: toast "تم العثور على فاتورة غير محفوظة — هل تريد استعادتها؟"
// 4. User can restore or discard

// Add to folder structure:
// client/src/store/posRecovery.js  — persist/restore POS draft

// Persistence interval: every 30 seconds AND on every addLine() call
// Auto-clear: on successful invoice save OR explicit discard
```


---

# 7. SETUP & ONBOARDING WIZARD

## 7.1 Wizard Flow (5 Steps)

Triggered on first launch when `settings.is_setup_complete = false`.

### Step 1 — License Activation
- Enter license key (or continue with trial)
- Validates online → shows "Activated ✅" or "Trial: 30 days"

### Step 2 — Company Information
```
Fields:
- Company Name (AR) *required
- Company Name (EN)
- Branch Name *required
- Branch Code (for invoice prefix) *required, 2-5 chars, uppercase
- Logo (upload local image)
- Address
- Phone
- Tax ID (الرقم الضريبي)
- Commercial Register
- Currency *required (dropdown: SAR, EGP, AED, USD, KWD, etc.)
- Currency Symbol *auto-filled
- Decimal Places (0, 2, 3)
- Tax Rate % (default 0)
- Tax Type (Inclusive / Exclusive / None)
```

### Step 3 — Financial & Invoice Settings
```
Fields:
- Invoice Prefix (default "INV-")
- Purchase Prefix (default "PUR-")
- Fiscal Year Start (Month, default January)
- Date Format
- Language (AR/EN)
```

### Step 4 — Create Admin Account
```
Fields:
- Full Name *required
- Username *required (min 4 chars, alphanumeric)
- Password *required (min 8 chars, strength indicator)
- Confirm Password
```
This account is created with role = 'admin'. Cannot be the same as other users.

### Step 5 — Defaults Setup
```
Fields:
- Default Warehouse (create one if none exist): Name, Code
- Default Treasury (cash box): Name, Opening Balance
- Default Walk-in Customer: Name (default "زبون نقدي")
- Receipt width: 80mm / 58mm / A4
- Auto-backup: On/Off, path selection
```

### After Completion
- `settings.is_setup_complete = true`
- Redirect to login page
- Show success animation

## 7.2 Wizard Edge Cases
- User closes browser mid-wizard → progress saved in localStorage → can resume
- Validation on each step before proceeding
- Step 5 warehouse/treasury creation is done via API — if it fails, show error + retry
- Back navigation allowed except after admin creation

---



## 7.3 SETUP WIZARD COMPLETION TRACKER

> *Gap Analysis V2 — Domain 10D*

```javascript
// Add to settings collection:
setup_wizard: {
  completed: Boolean,
  steps_completed: {
    company_info:    Boolean,
    admin_user:      Boolean,
    warehouse:       Boolean,
    treasury:        Boolean,
    receipt_settings:Boolean,
    first_item:      Boolean,
    test_print:      Boolean,
  },
  completed_at: Date,
}

// If setup_wizard.completed = false → redirect to /setup on every login
// Cannot access main app until wizard is done
// Admin can re-run wizard from Settings (resets to step 1, doesn't delete data)
```


---

# 8. DESKTOP vs MOBILE UI SYSTEM

## 8.1 Breakpoint Strategy

| Breakpoint | Width | Device | Layout |
|------------|-------|--------|--------|
| `sm` | < 640px | Phone | Mobile layout, simplified content |
| `md` | 640–1023px | Tablet | Mobile layout, slightly more content |
| `lg` | ≥ 1024px | Desktop/Laptop | Full desktop layout |

The Electron window's minimum size is 1024px wide, so the app always shows desktop layout in the native window. Mobile/tablet layout is for **LAN browser access** from phones and tablets.

## 8.2 AppShell — Layout Router

```jsx
// src/components/layout/AppShell.jsx
import { useEffect } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import DesktopLayout from './DesktopLayout';
import MobileLayout from './MobileLayout';
import { useAuthStore } from '../../stores/authStore';

export default function AppShell({ children }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { user } = useAuthStore();
  
  // Apply RTL direction
  useEffect(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }, []);
  
  const Layout = isDesktop ? DesktopLayout : MobileLayout;
  return <Layout user={user}>{children}</Layout>;
}
```

## 8.3 DesktopLayout — Full Sidebar

```jsx
// components/layout/DesktopLayout.jsx
// Features:
// - Fixed sidebar (64px collapsed, 240px expanded)
// - Topbar with: search, notifications bell, user menu
// - Main content area with padding
// - Sidebar can be collapsed (icon-only mode)
// - Active route highlighted in sidebar
// - Sidebar groups with expandable sub-menus
// - Keyboard shortcut: Ctrl+B to toggle sidebar
```

**Sidebar Navigation Groups:**
```
الرئيسية (Dashboard)
─────────────────────────
المبيعات (Sales)
  ├── نقطة البيع (POS)
  ├── فواتير البيع (Sales Invoices)
  └── مردودات البيع (Sales Returns)
المشتريات (Purchases)
  ├── فواتير الشراء (Purchases)
  ├── مردودات الشراء (Purchase Returns)
  └── أوامر الشراء (Purchase Orders)
العملاء والموردين
  ├── العملاء (Customers)
  └── الموردين (Suppliers)
المخزون (Stock)
  ├── مستويات المخزون (Stock Levels)
  ├── حركات المخزون (Stock Movements)
  ├── تحويل مخزون (Stock Transfer)
  └── جرد (Physical Count)
المالية (Finance)
  ├── مدفوعات العملاء (Customer Payments)
  ├── مدفوعات الموردين (Supplier Payments)
  ├── المصروفات (Expenses)
  ├── إيرادات أخرى (Other Revenues)
  ├── الشيكات (Cheques)
  └── الأقساط (Installments)
العمليات (Operations)
  ├── تحويل خزينة (Treasury Transfer)
  ├── عمليات بنكية (Bank Operations)
  └── تحديث أسعار جملة (Bulk Price Update)
التقارير (Reports)
الكودات (Definitions)
  ├── معلومات الشركة
  ├── المستخدمين
  ├── الموظفين
  ├── الأصناف والأسعار
  ├── التصنيفات
  ├── الوحدات
  ├── المستودعات
  ├── البنوك
  └── الخزائن
البحث (Search)
الإشعارات (Notifications)
─────────────────────────
الإعدادات (Settings)
```

## 8.4 MobileLayout — Bottom Navigation

```jsx
// Bottom nav items (4 primary tabs):
// 1. الرئيسية — Dashboard
// 2. نقطة البيع — POS (prominent, center)
// 3. الفواتير — Invoices
// 4. القائمة — More (opens full drawer)

// Full drawer shows all sections with cards
// Mobile POS is a simplified two-tab flow
```

## 8.5 Mobile-Specific UX Rules

```
✅ DO:
- Large touch targets (minimum 44x44px)
- Card lists instead of tables
- Full-screen forms with back button
- Sticky headers on lists
- Pull-to-refresh on all lists
- Swipe right to go back
- Large, readable text (min 16px)
- Reduced information density

❌ DON'T:
- Show settings/user management on mobile (admin operations)
- Show complex multi-column forms
- Show hover effects (no hover on touch)
- Show bulk operations
- Show reports with complex filters
- Show delete operations (dangerous on small screen)
```

## 8.6 DesktopOnly Guard Component

```jsx
// components/layout/DesktopOnly.jsx
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Monitor } from 'lucide-react';

export default function DesktopOnly({ children, message }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  
  if (!isDesktop) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-8 text-center" dir="rtl">
        <Monitor size={48} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-600 mb-2">متاح على الكمبيوتر فقط</h2>
        <p className="text-gray-400 text-sm">
          {message || 'يرجى فتح هذه الصفحة على جهاز كمبيوتر للوصول إلى جميع الميزات'}
        </p>
      </div>
    );
  }
  
  return children;
}

// Usage:
// <DesktopOnly><UserManagement /></DesktopOnly>
// <DesktopOnly message="إعدادات النظام متاحة على الكمبيوتر فقط"><Settings /></DesktopOnly>
```

---

# 9. UI/UX DESIGN SYSTEM

## 9.1 Color Palette (Tailwind CSS Extension)

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: {
          50: '#E8F7F2',
          100: '#C6EBE0',
          200: '#8DD6C0',
          300: '#54C29F',
          DEFAULT: '#1D9E75', // Main green — used for primary actions
          600: '#188A65',
          700: '#147355',
          800: '#0F5C44',
          900: '#0B4733',
        },
        // Semantic
        danger: { DEFAULT: '#DC2626', light: '#FEE2E2', dark: '#991B1B' },
        warning: { DEFAULT: '#D97706', light: '#FEF3C7', dark: '#92400E' },
        success: { DEFAULT: '#16A34A', light: '#DCFCE7', dark: '#14532D' },
        info: { DEFAULT: '#2563EB', light: '#DBEAFE', dark: '#1E3A8A' },
        // Neutrals
        surface: '#FFFFFF',
        background: '#F9FAFB',
        border: '#E5E7EB',
        'text-primary': '#111827',
        'text-secondary': '#6B7280',
        'text-muted': '#9CA3AF',
      },
      fontFamily: {
        sans: ['Noto Sans Arabic', 'Noto Sans', 'sans-serif'],
        mono: ['Noto Sans Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
        dropdown: '0 10px 15px -3px rgba(0,0,0,0.1)',
        modal: '0 25px 50px -12px rgba(0,0,0,0.25)',
      },
      borderRadius: {
        card: '12px',
        button: '8px',
        input: '8px',
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
  // RTL support
  future: { hoverOnlyWhenSupported: true },
};
```

## 9.2 Typography Scale

```
h1: 24px / font-bold / text-gray-900     — Page titles
h2: 20px / font-semibold / text-gray-900 — Section titles
h3: 16px / font-semibold / text-gray-900 — Card titles
body: 14px / font-normal / text-gray-700 — Default body
small: 12px / font-normal / text-gray-500 — Labels, hints
mono: 13px / font-mono               — Numbers, codes

Number formatting rule: Always use Intl.NumberFormat with ar-SA locale for display
Currency: Always show symbol AFTER amount in Arabic: "٢٥٠.٠٠ ر.س"
```

## 9.3 Button Component Variants

```jsx
// components/ui/Button.jsx
// Variants:
// primary — bg-primary text-white (confirm, save, submit)
// secondary — bg-white border text-gray-700 (cancel, back)
// danger — bg-danger text-white (delete, remove)
// ghost — text-primary hover:bg-primary-50 (inline actions)
// icon — square, icon only (table row actions)
//
// Sizes: sm, md (default), lg, xl
//
// States: default, hover, active, disabled, loading
//
// Loading state: spinner replaces icon, text stays, button disabled
```

## 9.4 Table Component

The Table component is the most used component in the app. It must support:

```
- Sortable columns (click header to sort)
- Row selection (checkbox for bulk actions)
- Sticky header on scroll
- Row hover highlight
- Clickable rows (optional)
- Status badge column
- Currency column (right-aligned, formatted)
- Date column (formatted)
- Action column (Edit, Delete, View buttons)
- Loading skeleton rows
- Empty state (no data message)
- Pagination (integrated)
- Row count display: "عرض 1-20 من 150 سجل"
```

## 9.5 Form Patterns

```
Standard form rules:
- Labels ALWAYS above inputs (never placeholder-only)
- Required fields: red asterisk (*)
- Validation: on blur + on submit (not on every keystroke)
- Error message: red text below input
- Success state: green border (for unique checks like username/barcode)
- Disabled state: gray background
- Read-only state: no border, plain text

Modal forms:
- Max width: 600px (single column) or 900px (two-column)
- Footer: [Save] [Cancel] — always in this order (RTL: Cancel on right, Save on left)
- Close on backdrop click: NO for create/edit (prevent accidental loss)
- Close on ESC: YES with confirmation if form is dirty

Keyboard navigation:
- Tab between fields
- Enter on last field submits
- Escape closes modal
```

## 9.6 Print Styles

```css
/* In PrintLayout.jsx — applied via react-to-print */
@media print {
  /* Hide all UI chrome */
  .no-print { display: none !important; }
  
  /* Receipt paper sizes */
  .receipt-80mm { width: 80mm; }
  .receipt-58mm { width: 58mm; }
  
  /* Force colors to print */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  
  /* Page break rules */
  .page-break-before { page-break-before: always; }
  .no-break { page-break-inside: avoid; }
}
```

## 9.7 Sound Feedback (POS)

```javascript
// hooks/useSound.js
// Sounds give cashiers immediate feedback without looking at screen

const sounds = {
  scan: new Audio('/sounds/beep.mp3'),      // Item scanned
  success: new Audio('/sounds/success.mp3'), // Invoice saved
  error: new Audio('/sounds/error.mp3'),     // Invalid barcode / error
  alert: new Audio('/sounds/alert.mp3'),     // Out of stock warning
};

export function useSound() {
  const play = (type) => {
    const sound = sounds[type];
    if (sound) { sound.currentTime = 0; sound.play().catch(() => {}); }
  };
  return { play };
}
```

## 9.8 Loading States Pattern

```
Rule: Never show a blank screen. Every data-loading state must show a skeleton.

Skeleton pattern:
- Table loading: 5 skeleton rows with animated pulse
- Card loading: gray rounded rectangles
- Stats loading: gray boxes same size as stats

Error state:
- Show: "حدث خطأ في تحميل البيانات" + Retry button
- Log error to winston
- Never show raw error messages to user
```

## 9.9 Notification Toast System

```javascript
// Using react-hot-toast with Arabic messages

toast.success('تم حفظ الفاتورة بنجاح');
toast.error('خطأ: رصيد الخزينة غير كافٍ');
toast.loading('جاري الحفظ...');

// Rules:
// - Duration: success = 3s, error = 5s (needs more reading time)
// - Position: top-center (Arabic RTL, best position)
// - Max visible at once: 3
// - Stack downward
```

---



## 9.10 PAGE & SIDEBAR VISIBILITY PER PERMISSION

> *Gap Analysis V2 — Domain 1C*

The sidebar navigation and pages **hide automatically** based on role permissions. A cashier should never see Reports or Settings menu items they cannot access.

```javascript
// client/src/config/navigation.js
export const navItems = [
  { key: 'pos',       label_ar: 'نقطة البيع',    icon: 'ShoppingCart', path: '/pos',       permission: 'pos.can_access' },
  { key: 'items',     label_ar: 'الأصناف',        icon: 'Package',      path: '/items',     permission: 'inventory.can_view_items' },
  { key: 'customers', label_ar: 'العملاء',        icon: 'Users',        path: '/customers', permission: 'crm.can_view_customers' },
  { key: 'purchases', label_ar: 'المشتريات',      icon: 'ShoppingBag',  path: '/purchases', permission: 'purchases.can_view_purchases' },
  { key: 'payments',  label_ar: 'المدفوعات',      icon: 'CreditCard',   path: '/payments',  permission: 'finance.can_view_payments' },
  {
    key: 'reports', label_ar: 'التقارير', icon: 'BarChart2', path: '/reports',
    permission: 'reports.can_view_sales_reports',
    children: [
      { key: 'report_sales',      label_ar: 'تقارير المبيعات',    permission: 'reports.can_view_sales_reports' },
      { key: 'report_inventory',  label_ar: 'تقارير المخزون',     permission: 'reports.can_view_inventory_reports' },
      { key: 'report_financial',  label_ar: 'التقارير المالية',   permission: 'reports.can_view_financial_reports' },
      { key: 'report_cashier',    label_ar: 'تقارير الكاشير',     permission: 'reports.can_view_cashier_reports' },
      { key: 'report_audit',      label_ar: 'سجل المراجعة',       permission: 'reports.can_view_audit_log' },
    ],
  },
  { key: 'settings', label_ar: 'الإعدادات', icon: 'Settings', path: '/settings', permission: 'settings.can_view_settings' },
];

// Hook: usePermission
// client/src/hooks/usePermission.js
export const usePermission = (permissionKey) => {
  const { user } = useAuthStore();
  const [group, flag] = permissionKey.split('.');
  return user?.permissions?.[group]?.[flag] ?? false;
};

// Usage:
// const canVoid = usePermission('pos.can_void_invoice');
// {canVoid && <button onClick={handleVoid}>إلغاء الفاتورة</button>}
```

## 9.11 DARK MODE SUPPORT

> *Gap Analysis V2 — Domain 10B*

```javascript
// Add to user settings (per user preference, not global):
// users.ui_theme: 'light' | 'dark' | 'system'  (default: 'system')

// Tailwind dark mode: class strategy
// Add 'dark' class to <html> based on user preference + system detection
// All components already use Tailwind: add dark: variants to existing classes
// Persist preference: localStorage (user-level, not synced to DB)

// POS screen: dark mode especially useful for evening/night shifts
// Receipt preview: always light background (thermal printer)
```


---

# 10. CODES & DEFINITIONS MODULE

## 10.1 Company Info Page

**Read/Write settings for:**
- All company identity fields (name, logo, address, phone, tax ID)
- Logo upload with preview and crop
- Receipt header/footer preview

**Validation:**
- Company name: required, max 100 chars
- Branch code: required, 2-5 uppercase alphanumeric, unique (validated against existing prefix)
- Phone: valid format
- Tax ID: format validation per country (configurable)

## 10.2 Users Module

**List view columns:**
- Name | Username | Role | Status | Last Login | Actions

**Create/Edit user form:**
- Basic info (name, username, password)
- Role selector with live permission preview
- Granular permission overrides (shown as table with checkboxes)
- Max discount % (if can_discount is on)
- Active/Inactive toggle

**Edge cases:**
- Cannot delete own account
- Cannot delete the last admin account
- Cannot deactivate own account
- Username uniqueness: check on blur (AJAX call)
- Password change: admin can reset without knowing old password
- User activity log: shows last 10 logins

## 10.3 Customers Module

**List view:**
- Sortable by name, code, phone, balance
- Filter by: active/inactive, has balance, city, price group
- Export to Excel

**Customer form:**
- All customer fields
- Credit limit: 0 = unlimited, else enter amount
- Price group selector
- Opening balance (note: creates journal entry if non-zero)
- Blacklist toggle with reason field

**Customer detail view:**
- Summary cards: total sales, balance, last sale date
- Tabs: Invoices | Payments | Installments | Cheques | Statement
- Account statement tab shows all transactions chronologically

**Edge cases:**
- Cannot delete customer with transactions → deactivate instead
- Cannot create sale if blacklisted (show warning at POS)
- Credit limit warning at POS (allow override with permission)
- Duplicate phone detection on save

## 10.4 Suppliers Module

Same structure as customers but oriented for purchases. Additional fields:
- Preferred payment terms
- Bank account details for transfers

## 10.5 Items & Prices Module (See Chapter 11)

## 10.6 Units of Measure

Simple CRUD. Validation: cannot delete unit if in use by items.

## 10.7 Warehouses

CRUD + default warehouse flag (only one can be default). Cannot delete if stock exists.

## 10.8 Item Categories

Tree structure (parent/child). UI shows expandable tree. Drag-to-reorder. Cannot delete if items exist in category.

## 10.9 Expense & Revenue Categories

Same tree structure. System-created categories cannot be edited/deleted.

## 10.10 Price Groups

| Name | Price Column | Extra Discount % |
|------|-------------|-----------------|
| أسعار التجزئة | price1 | 0% |
| أسعار الجملة | price2 | 0% |
| عملاء مميزون | price1 | 10% |

---

# 11. ITEMS & PRICES MODULE

## 11.1 Items List

**Columns:** Image | Code | Name | Category | Barcode | Unit | Price1 | Stock | Status | Actions

**Filters:**
- Category (multi-select tree)
- Status (active/inactive)
- Item type (product/service/composite)
- Has stock (above/below min)
- Price range

**Bulk Actions:**
- Activate / Deactivate selected
- Change category for selected
- Export selected to Excel

## 11.2 Item Form — Full Field List

```
SECTION: Basic Information
─────────────────────────────
- Item Code (auto-generated or manual, unique)
- Name (AR) * required
- Name (EN)
- Category *
- Unit *
- Item Type: Product / Service / Composite
- Tags (comma-separated for search)
- Description
- Is Active toggle
- Is Featured toggle (shows on POS home grid)
- Image (local file upload, preview)

SECTION: Pricing
─────────────────────────────
- Cost Price (purchase price)
- Price 1 (Retail) *required
- Price 2 (Wholesale)
- Price 3 (Special)
- Price 4 (Reserved)
- Minimum Price (cannot sell below this — hard stop)
- Maximum Discount % (item-level override)

SECTION: Tax
─────────────────────────────
- Tax Rate % (override global setting)
- Tax Type (Inclusive / Exclusive / None)

SECTION: Barcodes
─────────────────────────────
- Primary Barcode (scan to fill, or generate)
- Additional Barcodes (multiple, e.g. old barcode + new barcode)
- Barcode Type (EAN-13, EAN-8, Code-128, QR, Custom)

SECTION: Stock Settings
─────────────────────────────
- Track Stock (toggle)
- Allow Negative Stock (toggle)
- Minimum Stock Qty (trigger low-stock alert)
- Maximum Stock Qty (trigger overstock alert)
- Track Serial Numbers (toggle)
- Track Expiry Dates (toggle)

SECTION: Purchase Unit (Optional)
─────────────────────────────
- Purchase Unit (e.g. "كرتون")
- Factor (1 كرتون = 12 قطعة)
```

## 11.3 Item Detail View (Read-Only Summary)

After clicking an item:
- Header: image + name + code + status badges
- Tabs:
  1. **Prices** — all price columns + tax
  2. **Stock** — per-warehouse stock levels with add/view buttons
  3. **Stock Movements** — paginated history with filter
  4. **Sales History** — recent invoices containing this item
  5. **Purchase History** — recent purchases
  6. **Serial Numbers** — if tracking enabled

## 11.4 Excel Import for Items

Support bulk import via Excel file:

```
Required columns: الاسم، الباركود، التصنيف، الوحدة، السعر1
Optional: الكود، الاسم_إنجليزي، السعر2، السعر3، سعر_الشراء، الحد_الأدنى

Process:
1. User downloads template
2. Fills template
3. Uploads file
4. System shows preview table with validation errors highlighted
5. User fixes errors in Excel and re-uploads, OR proceeds with valid rows only
6. System creates items, skips invalid rows, shows final report
```

## 11.5 Barcode Printing

```
Select items → choose count per item → choose label size → print

Label sizes:
- 30x20mm (small)
- 50x30mm (medium)
- 70x40mm (large — shows item name)

Print options:
- Include item name: Yes/No
- Include price: Yes/No
- Include item code: Yes/No
- Copies per item: 1-100
```

## 11.6 Composite Items (Bundled Products)

A composite item is made of other items. When sold, each component is deducted separately from stock.

Example: "طقم شاي" = 6 قطعة "كوب شاي" + 1 قطعة "إبريق شاي"

When selling "طقم شاي":
- Stock of "كوب شاي" decreases by 6
- Stock of "إبريق شاي" decreases by 1

---



## 11.7 ITEM VARIANTS (SIZE / COLOR / WEIGHT)

> *Gap Analysis V1 — GAP 9*

```javascript
// Add to items collection:
has_variants: { type: Boolean, default: false },
variants: [{
  _id: ObjectId,
  sku: String,
  attributes: Map,          // { "size": "L", "color": "أحمر" }
  barcode: String,
  price_override: Number,   // null = use parent price
  cost_price_override: Number,
  stock_quantity: Number,   // separate stock per variant
}]

// When has_variants = true:
// POS shows a variant picker modal when the item is added
// Each variant has its own barcode (can be scanned directly)
// Stock deduction is per-variant
```

## 11.8 CUSTOMER GROUP / PRICE LIST CLARIFICATION

> *Gap Analysis V1 — GAP 11*

```javascript
// Each item has an array of price levels:
prices: [{
  price_group: String,      // 'retail' | 'wholesale' | 'vip' | custom name
  price: Number,
}]

// Each customer has a price_group field:
// customers.price_group: String (default: 'retail')

// POS logic: When customer is selected, all item prices automatically
// switch to that customer's price group.
// If no price defined for that group → fall back to 'retail' price.

// UI: In Items page, show all price columns side by side for easy editing
```

## 11.9 DECIMAL QUANTITY & STEP CONFIGURATION

> *Gap Analysis V2 — Domain 4E*

```javascript
// Add to items collection:
allow_decimal_quantity: { type: Boolean, default: false },
quantity_step: { type: Number, default: 1 },  // 0.5 for half-kg items

// When cashier clicks QTY field: numeric keypad auto-opens
// Supports: decimal quantities (e.g. 1.5 kg)
// Items like "bottle" = integer only, "kg" = decimal allowed
```

## 11.10 EXPIRY DATE TRACKING (BATCHES)

> *Gap Analysis V2 — Domain 5D*

```javascript
// Add to items collection:
track_expiry: { type: Boolean, default: false },

// Add sub-documents to stockLevel:
batches: [{
  batch_number: String,
  expiry_date: Date,
  qty: Number,
  cost_price: Number,
  received_at: Date,
  purchase_invoice_id: ObjectId,
}]
// FIFO selling: always deduct from earliest-expiry batch first

// Expiry alerts (Chapter 23):
// - Items expiring within 30 days: daily notification to manager
// - Items already expired: immediate alert
```

## 11.11 BULK ITEM IMPORT / EXPORT

> *Gap Analysis V2 — Domain 5C*

```javascript
// Import: Excel/CSV template with columns:
// name_ar | name_en | barcode | category | unit | cost_price | retail_price | min_stock

// Import workflow:
// 1. Download template
// 2. Upload filled file
// 3. Validation step: show preview table with errors highlighted
// 4. Confirm → batch create/update items

// Export: Current item list to Excel with all fields

// APIs:
GET  /api/items/export         → Returns Excel file
POST /api/items/import/preview → Upload file, returns validation result
POST /api/items/import/confirm → Commit validated import

// Components:
// client/src/pages/items/ItemImportWizard.jsx — Step 1: upload, Step 2: preview, Step 3: confirm
```

## 11.12 REORDER / PURCHASE REQUEST AUTOMATION

> *Gap Analysis V2 — Domain 5E*

```javascript
// Add to items collection:
preferred_supplier_id: { type: ObjectId, ref: 'Supplier' },
max_stock: { type: Number, default: 0 },
reorder_point: { type: Number, default: 0 }, // slightly higher than min_stock

// When stock falls below min_stock:
// 1. Notification generated (Chapter 23 — already planned)
// 2. Item added to "suggested purchase list"

// New page: Stock → قائمة إعادة الطلب
// Shows all items below min_stock with:
//   - Suggested order qty: (max_stock - current_qty)
//   - Last purchase price
//   - Preferred supplier
// Button: "إنشاء طلب شراء" → creates draft purchase invoice with all items pre-filled
```


---

# 12. POS — SALES INVOICE SCREEN

## 12.1 Screen Layout (Desktop — Two-Panel)

```
┌──────────────────────────────────────┬─────────────────────────┐
│  LEFT PANEL (65% width)              │  RIGHT PANEL (35%)      │
│                                      │                          │
│  ┌────────────────────────────────┐  │  Customer: [Search...]   │
│  │ Search: [barcode/name/code...] │  │ Ahmed Mohamed            │
│  │ [Category Filter Tabs]         │  │ Balance: ١٢٥.٥٠ ر.س     │
│  └────────────────────────────────┘  │                          │
│                                      │  ─────────────────────── │
│  ┌────────────────────────────────┐  │  INVOICE LINES           │
│  │ Item Grid (touch-friendly)     │  │                          │
│  │ ┌──────┐ ┌──────┐ ┌──────┐   │  │  صنف     كمية  سعر   مج  │
│  │ │ Item │ │ Item │ │ Item │   │  │  ─────────────────────── │
│  │ │      │ │      │ │      │   │  │  عصير     2    5    10   │
│  │ └──────┘ └──────┘ └──────┘   │  │  ماء      5    2    10   │
│  │ ┌──────┐ ┌──────┐ ┌──────┐   │  │  ─────────────────────── │
│  │ │ Item │ │ Item │ │ Item │   │  │                          │
│  │ └──────┘ └──────┘ └──────┘   │  │  المجموع:     ٢٠.٠٠      │
│  └────────────────────────────────┘  │  الخصم:       ٠.٠٠       │
│                                      │  الإضافات:    ٠.٠٠       │
│                                      │  الضريبة:     ٠.٠٠       │
│                                      │  الإجمالي:   ٢٠.٠٠ ر.س  │
│                                      │                          │
│                                      │  [💵 نقداً]  [💳 آجل]   │
│                                      │  [🏦 بنك]   [متعدد]     │
│                                      │  ─────────────────────── │
│                                      │  [🖨 حفظ وطباعة]        │
│                                      │  [💾 حفظ فقط]           │
│                                      │  [⏸ إيقاف مؤقت]        │
└──────────────────────────────────────┴─────────────────────────┘
```

## 12.2 Barcode Scanner Support

```javascript
// components/pos/BarcodeListener.jsx
// The barcode scanner types characters rapidly, ending with Enter
// This listener captures the sequence:

useEffect(() => {
  let buffer = '';
  let lastKeyTime = 0;
  const SCAN_TIMEOUT = 50; // ms between chars (scanner = fast, human = slow)
  const MIN_BARCODE_LENGTH = 4;

  const handleKeydown = (e) => {
    const now = Date.now();
    
    // If gap too large, reset buffer (human typing, not scanner)
    if (now - lastKeyTime > 300) buffer = '';
    lastKeyTime = now;
    
    if (e.key === 'Enter' && buffer.length >= MIN_BARCODE_LENGTH) {
      e.preventDefault();
      onScan(buffer.trim());
      buffer = '';
    } else if (e.key.length === 1) {
      buffer += e.key;
    }
  };

  window.addEventListener('keydown', handleKeydown);
  return () => window.removeEventListener('keydown', handleKeydown);
}, [onScan]);

// onScan handler:
const handleScan = async (barcode) => {
  playSound('scan');
  
  // Check active invoice lines first (update qty if same item)
  const existingLine = lines.find(l => l.item_barcode === barcode);
  if (existingLine) {
    updateLineQty(existingLine.index, existingLine.quantity + 1);
    return;
  }
  
  // Lookup item by barcode
  const item = await searchItemByBarcode(barcode);
  if (!item) {
    playSound('error');
    toast.error(`الباركود غير موجود: ${barcode}`);
    return;
  }
  
  addItemToInvoice(item);
};
```

## 12.3 Invoice Lines — Edit Operations

Each line supports:
- **Quantity:** editable field, up/down arrows, scanner can add to existing
- **Unit Price:** editable if `can_edit_price` permission (shows current, customer's price group applied automatically)
- **Discount:** amount or percent (toggle), limited by `max_discount_pct`
- **Line Total:** auto-calculated, read-only
- **Delete line:** ✕ button on the right
- **Serial Numbers:** if item tracks serials → modal to enter/scan serial numbers (must match quantity)
- **Expiry Date:** if item tracks expiry → date picker per line

## 12.4 Customer Selector

```jsx
// AsyncSelect with search-as-you-type
// Shows: Name | Phone | Balance | Price Group
// "Walk-in" always first option
// Creates new customer inline (mini form in dropdown)
// Shows balance warning if near/over credit limit
// Shows blacklist warning if customer is blacklisted (with override option for authorized users)
```

## 12.5 Discount Panel

```
Invoice-level discount (applied after all lines):
- Type: Toggle between Amount (مبلغ) / Percent (نسبة)
- Value: numeric input
- Calculated discount amount always shown

When discount is percentage:
  discount_amount = subtotal × (discount_value / 100)

Limits:
- If user has max_discount_pct, the percentage input is limited
- If user does NOT have can_discount, discount fields are disabled
```

## 12.6 Payment Panel

```
Payment type tabs:
1. نقداً (Cash):
   - Paid amount input (can be more than total → shows change)
   - Treasury selector (if multiple treasuries)

2. آجل (Credit):
   - Entire amount on customer account
   - Customer must be selected (not walk-in)
   - Blacklist check
   - Credit limit check (warn or block based on setting)

3. بطاقة (Card):
   - Terminal reference number (optional)
   - Bank selector

4. تحويل بنكي (Bank Transfer):
   - Reference number
   - Bank selector

5. متعدد (Split Payment):
   - Multiple rows: Method | Amount
   - Total must equal invoice total
   - Remaining shown dynamically
```

## 12.7 Save Invoice — Full Process

```
Client-side pre-checks:
1. At least one line
2. All required serials entered
3. Payment total matches invoice total (for split)
4. Customer selected if pos_require_customer = true

POST /api/invoices

Server-side process (inside MongoDB transaction):
1. Validate all fields (Joi schema)
2. Re-validate stock for all lines (prevent race condition if two cashiers)
3. Generate invoice number (atomic $inc)
4. Create invoice document
5. Create invoice_line documents
6. Deduct stock for each line (atomic $inc)
7. Update customer balance (if credit)
8. Update treasury/bank balance (if cash/card)
9. Create stock_movement records
10. Update customer stats (total_invoices, total_sales, last_sale_date)
11. Create audit_log entry
12. If shift open → update shift totals

Commit transaction.

Response includes: invoice with number

Client-side after save:
1. Play success sound
2. Clear POS store
3. If auto-print → open print dialog
4. Show success toast with invoice number
```

## 12.8 Held Invoices (Hold & Resume)

```
"إيقاف مؤقت" button saves current invoice to localStorage:
- Held invoices list shown as numbered slots (max 5)
- Each slot shows: customer name, line count, total
- Tap a slot to resume (replaces current invoice)
- Held invoices persist across app restart (localStorage)
- Warning if open held invoices on shift close
```

## 12.9 Keyboard Shortcuts (Desktop POS)

| Shortcut | Action |
|----------|--------|
| F1 | Focus barcode/search input |
| F2 | Open customer selector |
| F3 | Apply discount |
| F4 | Open payment panel |
| F5 | Save & print |
| F9 | Hold invoice |
| F10 | Resume held invoice |
| Esc | Cancel / close modal |
| Ctrl+Z | Remove last added line |
| + / - | Increase/decrease qty of selected line |

## 12.10 Shift Management

```
Shift Open:
- Must open shift before making first sale
- Enter opening cash balance
- Shift number assigned (SHIFT-001, etc.)
- Locked to current cashier

Shift Close:
- Shows shift summary: sales, returns, cash in/out
- Cashier enters actual cash counted in drawer
- System shows: Expected vs Actual, Difference
- Cash difference flagged if outside tolerance (configurable)
- Print shift report option

Rules:
- Only one open shift at a time per terminal
- Admin can force-close a shift
- Warning if trying to log out with open shift
```

---



## 12.11 CASH PAY-IN / PAY-OUT OPERATIONS

> *Gap Analysis V1 — GAP 7*

Non-sale cash movements in and out of the register during a shift.

```
Pay-In:  Cash added to drawer mid-shift (e.g., starting change float top-up)
Pay-Out: Cash removed from drawer mid-shift (e.g., petty cash, moving bills to safe)

UI: Buttons "نقدية +" and "نقدية −" in POS toolbar (manager-only)
Clicking either opens a modal:
  - Amount (required)
  - Reason / note (required)
  - Confirm → logged to current shift's pay_ins / pay_outs array
  - Prints a small slip from thermal printer (optional)

These movements appear on the X-report and Z-report automatically.
```

## 12.12 VOID INVOICE WITH MANDATORY REASON

> *Gap Analysis V1 — GAP 8*

```
Voiding an invoice (before it's finalized) vs. Returns (after it's finalized):

VOID: Invoice was saved but NOT yet paid/given to customer.
  → Requires mandatory reason (dropdown + free text)
  → Logged to audit_log with full details
  → Stock is reversed (if already deducted)
  → Only manager role can void. Cashier must request void.
  → Void reasons: ['خطأ في الإدخال', 'رفض العميل', 'تكرار فاتورة', 'أخرى']

RETURN: Invoice was completed and customer received goods.
  → Use the existing Sales Returns Module (Chapter 13)
  → Requires original invoice number
```

## 12.13 SPLIT PAYMENT (دفع مختلط)

> *Gap Analysis V2 — Domain 4A*

```javascript
// Invoice can have multiple payment_lines:
payment_lines: [{
  method: String,     // 'cash' | 'credit' | 'points' (loyalty)
  amount: Number,
}]
// Validation: sum of payment_lines must equal invoice total
// Each method recorded separately in treasury/customer balance

// UI:
// "الدفع المختلط" button opens multi-line payment panel
// Cashier adds rows: [Cash: 150] [Credit: 50]
// System validates total matches grand total
// Change calculated only on cash portion
```

## 12.14 PER-LINE ITEM NOTES / SPECIAL INSTRUCTIONS

> *Gap Analysis V2 — Domain 4B*

```javascript
// Add to invoice_lines:
note: { type: String, default: '' }  // Free text per line

// UI: Long-press or (✏) button on a line opens note input
// Prints on receipt if show_item_notes = true in receipt settings
// Use case: "بدون سكر", "تغليف هدية", size instructions
```

## 12.15 CUSTOMER ACCOUNT STATEMENT FROM POS

> *Gap Analysis V2 — Domain 4C*

```
Button: "كشف الحساب" (when a credit customer is selected) → prints mini thermal statement:
  Customer: سارة علي
  ─────────────────────
  INV-000142  2026/04/10  400.00  paid ✓
  INV-000156  2026/04/12  250.00  paid ✓
  INV-000170  2026/04/15  600.00  UNPAID
  ─────────────────────
  إجمالي مديونية: 600.00 ر.س
```

## 12.16 RECENT INVOICES QUICK ACCESS

> *Gap Analysis V2 — Domain 4D*

```
Button in POS topbar: "الفواتير الأخيرة"
Opens side drawer: Last 20 invoices (today)
Click any → shows invoice detail
Actions: Reprint | Return | View
```

## 12.17 INVOICE GENERAL NOTE FIELD

> *Gap Analysis V2 — Domain 4F*

```javascript
// Add to invoices collection:
invoice_note: { type: String, default: '' }   // General note for entire invoice
// Shown in invoice detail view and optionally printed on receipt
// UI: small (ملاحظة) field below invoice lines
```

## 12.18 COMPLETE KEYBOARD SHORTCUTS MAP

> *Gap Analysis V2 — Domain 10A*

```javascript
const POS_SHORTCUTS = {
  'F1':         'Open customer search',
  'F2':         'Focus barcode/item search',
  'F3':         'Apply discount to current line',
  'F4':         'Change qty of selected line',
  'F5':         'Hold current invoice',
  'F6':         'Retrieve held invoice',
  'F7':         'Open recent invoices panel',
  'F8':         'Process return',
  'F9':         'Pay-in / Pay-out',
  'F10':        'Open/close cash drawer manually',
  'F11':        'Fullscreen toggle',
  'F12':        'Save invoice & print receipt',
  'Escape':     'Cancel current action / close modal',
  'Delete':     'Remove selected invoice line',
  'Ctrl+Z':     'Undo last item added',
  'Ctrl+P':     'Reprint last receipt',
  'Ctrl+N':     'New invoice (clear current)',
  'Ctrl+S':     'Save invoice (same as F12)',
  '+':          'Increase qty of selected line',
  '-':          'Decrease qty of selected line',
  'NumPad*':    'Quick multiply qty (type qty then *)',
};

// Shortcut help overlay: Shift+? → shows all shortcuts in a modal
// Shortcut hints visible on buttons as small badges (e.g. [F12])
```


---

# 13. SALES RETURNS MODULE

## 13.1 Return Process

```
Two ways to create a return:
1. From original invoice (preferred)
2. Manual return (no original invoice reference)
```

## 13.2 Return From Original Invoice

```
1. Search original invoice by number or date
2. View invoice lines
3. Select which items to return + quantity (≤ original quantity - already returned)
4. System prevents over-returning
5. Reason for return (optional text)
6. Return payment method:
   - Cash back → treasury
   - Credit note (reduce customer balance)
7. Save → creates sale_return invoice
8. Stock restored for returned items
9. Customer balance updated
10. Original invoice status updated:
    - All items returned → status: 'returned'
    - Partial → status: 'partially_returned'
```

## 13.3 Return Validation Edge Cases

- Cannot return if original invoice is cancelled
- Cannot return more than original quantity
- Cannot return quantities already returned in a previous return
- If original paid by cash → refund must go back to same treasury
- If original was credit → adjust customer balance
- Permission check: `sales_return` permission required

---

# 14. PURCHASES MODULE

## 14.1 Purchase Invoice Form

Same structure as sales invoice but:
- **Supplier** instead of Customer
- **Cost prices** instead of sell prices (cashier cannot see sell price in purchase)
- Items auto-updates `cost_price` to latest purchase price
- Additional field: Supplier Invoice Number

## 14.2 Purchase Flow — Stock Update

```
POST /api/purchases

Server process (in transaction):
1. Generate purchase number
2. Create purchase document
3. Add stock for each line (atomic $inc)
4. Update item cost_price to line unit_price (FIFO / Last cost)
5. Update supplier balance (if credit)
6. Update treasury/bank (if cash payment)
7. Create stock_movement records
8. Create audit log
```

## 14.3 Purchase Orders (PO)

```
PO workflow:
1. Create PO (items, quantities, supplier)
2. Print PO for supplier
3. When goods arrive → "Receive PO" button
4. Receiving form: confirm quantities received (may be partial)
5. Creates purchase invoice automatically from received quantities
6. PO status: draft → sent → partially_received → received
```

## 14.4 Receiving PO (Partial Receipt)

```
Example:
PO: 100 units of Item A
First delivery: 60 units received
  → PO status: partially_received
  → Purchase invoice created for 60 units
Second delivery: 40 units received
  → PO status: received
  → Purchase invoice created for 40 units
```

---

# 15. PURCHASE RETURNS MODULE

Same logic as sales returns but for purchases:
- Deducts stock of returned items
- Updates supplier balance
- References original purchase invoice
- Creates `purchase_return` document

---

# 16. PAYMENTS MODULE

## 16.1 Customer Payments (Receipt)

Used when a customer pays their credit balance (not at POS).

```
Form fields:
- Date
- Customer (search, shows current balance)
- Amount *
- Payment method: cash, bank transfer, cheque, card
- Treasury / Bank (based on method)
- Reference number (cheque no., transfer ref)
- Notes
- Invoice allocation (optional):
  - List customer's unpaid invoices
  - Allocate payment to specific invoices or leave unallocated
```

## 16.2 Invoice Allocation Logic

```
Customer owes:
  Invoice A: 500 SAR
  Invoice B: 300 SAR
  Total: 800 SAR

Customer pays: 600 SAR

Allocation options:
1. Auto-allocate oldest first (FIFO) — default
2. Manual: tick invoices to allocate against

Result:
  Invoice A: 500 SAR → fully paid → status 'paid'
  Invoice B: 100 SAR allocated → remaining: 200 SAR → status 'partial'
  Payment: 600 SAR, allocated: 600 SAR, unallocated: 0
```

## 16.3 Supplier Payments

Same structure, used to pay suppliers for credit purchases.

## 16.4 Payment Edge Cases

- Cannot pay more than owed (configurable: allow overpayment → credit on account)
- Cheque payment → creates cheque record automatically
- Partial payments → invoice balance updates
- Delete payment → reverse all balance changes (audit trail)

---

# 17. EXPENSES MODULE

## 17.1 Expense Form

```
- Date *
- Category * (searchable tree dropdown)
- Amount *
- Description *
- Payment method: cash / bank transfer / cheque
- Treasury / Bank
- Employee (who submitted the expense)
- Receipt image upload (local)
- Notes
- Is Recurring toggle → frequency + start date
```

## 17.2 Recurring Expenses

```
If is_recurring = true:
- System creates the first expense
- cron job creates subsequent expenses on schedule
- Each auto-created expense is marked as 'auto_created'
- User can pause/stop recurring expense
```

## 17.3 Expense Categories Hierarchy

```
مصروفات التشغيل
  ├── الإيجار
  ├── الكهرباء والماء
  ├── الاتصالات
  └── مستلزمات المكتب
مصروفات الموظفين
  ├── الرواتب
  ├── المكافآت
  └── مكافأة نهاية الخدمة
مصروفات التسويق
  ├── إعلانات
  └── عروض وتخفيضات
مصروفات أخرى
```

---

# 18. OTHER REVENUES MODULE

Same form structure as expenses but for non-sales income:
- Rent received
- Commission income
- Investment returns
- Miscellaneous income

---

# 19. OPERATIONS MODULE

## 19.1 Treasury Transfer

```
Transfer cash between two cash boxes or from treasury to bank.

Form:
- Date
- From: [Treasury A / Bank A]
- To: [Treasury B / Bank B]
- Amount *
- Reference
- Notes

Validation:
- Source balance must be sufficient
- Cannot transfer to same account

Process (transaction):
1. Deduct from source
2. Add to destination
3. Create two movement records
4. Audit log
```

## 19.2 Bank Operations

```
Types:
1. إيداع (Deposit): Cash → Bank
2. سحب (Withdrawal): Bank → Cash
3. تحويل بين حسابات: Bank A → Bank B

Each creates movement records and updates balances.
```

## 19.3 Cheques Module

**Cheques Received (from customers):**
```
Status flow: pending → deposited → cleared
                                 ↘ bounced
                                 ↘ cancelled

When deposited: treasury balance doesn't change yet
When cleared: bank balance increases
When bounced: customer balance increases (they owe again) + bounce fee option
```

**Cheques Issued (to suppliers):**
```
Status flow: pending → presented → cleared
                                 ↘ bounced

When issued: supplier balance decreases (we paid)
When bounced: supplier balance increases + bank charges
```

**Cheque Due Alerts:**
Daily cron job checks cheques due in next N days (configurable). Creates notifications.

## 19.4 Installment Plans

```
Creating a plan:
- Linked to a sale invoice
- Down payment (optional, deducted from first payment)
- Number of installments
- Frequency: weekly / monthly / quarterly
- System generates schedule automatically

Tracking:
- Dashboard shows upcoming installments
- Daily alert for overdue installments
- Mark payment: select installment(s) → payment method → save

Reports:
- Active plans
- Overdue plans by customer
- Collected vs outstanding
```

## 19.5 Bulk Price Update

```
Update prices for multiple items at once:

Filters: Category, Supplier, Tags, Price range
Update options:
- Set fixed price
- Increase by amount
- Increase by percentage
- Decrease by amount
- Decrease by percentage
- Copy from price column (e.g. price2 = price1 + 10%)

Preview: shows before/after for each item in grid
Confirm: applies changes + audit log
```

## 19.6 Incentives & Penalties (Employee)

```
Record bonuses or deductions for employees:
- Employee
- Type: incentive (مكافأة) / penalty (خصم)
- Amount
- Reason
- Date
- Linked to salary period
```

---



## 19.7 QUOTATION / PROFORMA INVOICE (عرض سعر)

> *Gap Analysis V2 — Domain 9A*

```javascript
// New Collection: quotations (collection #34)
{
  _id: ObjectId,
  quotation_number: String,    // QUO-000001
  customer_id: ObjectId,
  status: String,              // 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted'
  valid_until: Date,
  lines: [/* same as invoice lines */],
  totals: { /* same as invoice */ },
  converted_to_invoice_id: ObjectId,  // set when approved
  notes: String,
  created_by: ObjectId,
  created_at: Date,
}

// Print format: A4 formal quotation letter (Arabic RTL)
// API: POST /api/quotations | PUT | PATCH /:id/convert-to-invoice
// UI: Operations → عروض الأسعار
```

## 19.8 CUSTOMER / SUPPLIER STATEMENT PRINT

> *Gap Analysis V2 — Domain 6B*

```javascript
// API: GET /api/customers/:id/statement?from=&to=
// Returns: structured statement with all invoices, payments, balance timeline
// Print formats: A4 (formal letter) + thermal mini-statement

// Content:
// Header: Customer info + date range
// Table: Date | Type (Invoice/Payment) | Debit | Credit | Balance
// Footer: Total Debit | Total Credit | Net Balance
// Signature lines: "تم الاستلام" (for customer acknowledgement)
```

## 19.9 SMS / WHATSAPP CUSTOMER NOTIFICATIONS

> *Gap Analysis V2 — Domain 6C*

```javascript
// Trigger SMS when:
// - Invoice created (with total + invoice# as SMS)
// - Payment received (confirmation)
// - Low balance warning (approaching credit limit)
// - Account statement sent

// Add to settings:
sms_settings: {
  enabled: Boolean,
  provider: String,           // 'twilio' | 'local_gateway' | 'msegat' (Saudi SMS gateway)
  api_key: String,
  sender_name: String,        // "PlazaStore"
  templates: {
    invoice_created: String,  // AR template with {customer_name}, {invoice_number}, {total}
    payment_received: String,
    low_balance: String,
  }
}
```

## 19.10 CUSTOMER CREDIT LIMIT ENFORCEMENT

> *Gap Analysis V2 — Domain 6A*

```javascript
// Add to customers collection:
credit_limit: { type: Number, default: 0 },    // 0 = no credit
credit_used: { type: Number, default: 0 },      // Current outstanding balance

// POS enforcement:
// When cashier selects credit payment:
// 1. Check: customer.credit_used + invoice_total <= customer.credit_limit
// 2. If exceeded: show warning with current balance + limit
// 3. Options: A) Partial credit + cash B) Request override (supervisor PIN) C) Cancel

// Add to settings:
credit_limit_behavior: String,  // 'block' | 'warn_only' | 'warn_and_override'
```


---

# 20. STOCK MANAGEMENT MODULE

## 20.1 Stock Levels Page

```
View: All items × all warehouses
Columns: Item | Category | Unit | Warehouse | Qty | Min Stock | Status | Last Movement

Filters:
- Warehouse
- Category
- Status: normal / low / critical / overstock / out-of-stock
- Search

Color coding:
- Out of stock (0): Red background
- Below minimum: Orange
- Normal: White
- Overstock (above max): Blue

Quick actions from this page:
- View movements history for item
- Quick adjustment (+/-)
- Transfer to another warehouse
```

## 20.2 Stock Movements History

```
Searchable, filterable log:
- Date range
- Item
- Warehouse
- Movement type
- User

Columns: Date | Item | Type | Reference | Qty Before | Change | Qty After | User
```

## 20.3 Stock Transfer Between Warehouses

```
Form:
- Date
- From warehouse *
- To warehouse *
- Items: search and add lines with quantity
- Notes

Validation:
- Source warehouse has sufficient stock for each item
- From ≠ To

Process:
1. For each line: deduct from source warehouse stock_level
2. For each line: add to destination warehouse stock_level
3. Create 2 stock_movement records per line (transfer_out + transfer_in)
4. Audit log
```

## 20.4 Physical Count (Stock Taking)

```
Process:
1. Create new count session (date, warehouse, status: 'in_progress')
2. Print count sheet (blank qty columns for manual counting)
3. Enter counted quantities:
   - Can do by category
   - Scan barcode to find item
   - Enter actual counted qty
4. System shows variance: System Qty | Counted Qty | Variance
5. Review screen: filter by variances only
6. Confirm count:
   - Creates adjustment records for all items with variance
   - stock_level.quantity updated to counted qty
   - stock_movement records created (type: 'physical_count')
7. Count session closed

Rules:
- Only one active count per warehouse at a time
- Counts can be paused and resumed
- All variances logged regardless of direction
```

## 20.5 Stock Adjustment (Manual)

```
For quick corrections without full physical count:
- Item
- Warehouse
- Current quantity (shown automatically)
- New quantity OR adjustment amount (+/-)
- Reason (required for audit): damaged, correction, opening balance, etc.
- Date
```

---



## 20.6 BARCODE LABEL PRINTING (Full Workflow)

> *Gap Analysis V2 — Domain 5A*

```javascript
// Label sizes to support:
// - 40mm × 25mm (standard retail sticker)
// - 58mm × 40mm (larger label)
// - A4 sheet (multiple labels per page, for laser printers)

// Label content (configurable per label template):
label_template: {
  show_item_name_ar: Boolean,
  show_item_name_en: Boolean,
  show_barcode:      Boolean,   // Code128 or EAN-13
  show_price:        Boolean,
  show_price_group:  String,    // Which price: 'retail' | 'wholesale'
  show_unit:         Boolean,
  show_sku:          Boolean,
  custom_text:       String,    // e.g. store name, "Made in Egypt"
}

// Trigger from:
// 1. Items list: select N items → "طباعة ملصقات" → enter qty per item
// 2. Purchase invoice: after saving → "طباعة ملصقات البضاعة الواردة"
// 3. Stock adjustment: after adjusting → print labels for adjusted items

// UI flow:
// Select items → Label Print Modal:
//   - Label template selector (A4 / 40×25 / 58×40)
//   - Qty per item (default: 1)
//   - Preview grid of labels
//   - Print button

// New API:
POST /api/labels/print   → body: { items: [{id, qty}], template }
                         → returns: PDF with label grid
```

## 20.7 MANUAL STOCK ADJUSTMENT MODULE

> *Gap Analysis V2 — Domain 5B*

```javascript
// New Collection: stock_adjustments (collection #33)
{
  _id: ObjectId,
  reference: String,            // ADJ-000001
  type: String,                 // 'add' | 'subtract' | 'set' | 'damage' | 'expired' | 'count_correction'
  reason: String,               // Required
  reason_category: String,      // 'count_correction' | 'damage' | 'expired' | 'theft' | 'other'
  warehouse_id: ObjectId,
  lines: [{
    item_id: ObjectId,
    qty_before: Number,
    qty_change: Number,         // Positive or negative
    qty_after: Number,
    cost_at_adjustment: Number,
  }],
  approved_by: ObjectId,        // Required for 'subtract' type (manager approval)
  approved_at: Date,
  created_by: ObjectId,
  created_at: Date,
  notes: String,
}

// UI: Stock Management → "تسوية مخزون جديدة"
// Type selector: Add Stock | Remove Stock | Set Exact Count | Mark as Damaged
// For subtract/damage: shows supervisor override prompt if user lacks permission
// After save: stock_adjustments record + stockLevel update (atomic)
// Logged to audit_log

// New APIs:
POST  /api/stock-adjustments          → Create adjustment
GET   /api/stock-adjustments          → List with filters
GET   /api/stock-adjustments/:id      → Detail
POST  /api/stock-adjustments/:id/approve → Manager approval
```

## 20.8 INVENTORY REPLENISHMENT PAGE (قائمة إعادة الطلب)

> *Gap Analysis V2 — Domain 5E*

```
New page: Stock → قائمة إعادة الطلب
Shows all items below min_stock with:
  - Suggested order qty: (max_stock - current_qty)
  - Last purchase price
  - Preferred supplier
Button: "إنشاء طلب شراء" → creates draft purchase invoice with all items pre-filled
```


---

# 21. REPORTS MODULE

## 21.1 Reports Architecture

All reports follow the same pattern:

```
1. Filter panel (collapsible)
2. Summary cards (total, key metrics)
3. Chart (when applicable)
4. Data table (virtualized for large datasets)
5. Action buttons: Print PDF | Export Excel | Share

Filter panel always includes:
- Date range: Today / This Week / This Month / This Quarter / Custom
- Quick date navigation: < prev month | month name | next month >
```

## 21.2 Daily Closing Report (الحساب اليومي)

**The most important daily report. Must be perfect.**

```
Summary:
- Total sales (by payment type breakdown)
- Total returns
- Net sales
- Expenses
- Revenue (non-sales)
- Cash movements (in/out treasury)
- Bank deposits/withdrawals
- Expected cash balance per treasury
- Collections from customers
- Payments to suppliers

Table: Itemized list of all transactions for the day

Totals cross-check:
Opening balance + Cash in - Cash out = Expected closing balance
```

## 21.3 Sales Report

```
Filters:
- Date range
- Customer
- Item / Category
- Payment type
- Cashier
- Invoice status
- Warehouse

Views (tabs):
1. Summary by day
2. Summary by item
3. Summary by category
4. Summary by customer
5. Summary by cashier
6. Detailed invoice list

Columns for detailed view:
Invoice # | Date | Customer | Items | Subtotal | Discount | Tax | Total | Payment | Cashier
```

## 21.4 Purchases Report

```
Similar to sales report but:
- Supplier instead of customer
- Cost prices
- Purchase number
- Supplier invoice number
```

## 21.5 Stock Report

```
Tabs:
1. Current Stock — snapshot of all items
   Columns: Item | Category | Unit | Total Qty | Total Value (at cost) | Total Value (at price1)
2. Stock Movements — filtered by date/item/warehouse
3. Low Stock Items — items below minimum
4. Zero Stock Items
5. Inactive Items with Stock (items disabled but still have qty)
6. Stock Valuation Summary — by category

Stock Valuation Calculation:
Total value at cost = SUM(qty × cost_price) per item
Total value at price = SUM(qty × price1) per item
Potential profit = price value - cost value
```

## 21.6 Customer Report

```
Tabs:
1. Customer Account Statement:
   - Selected customer
   - Date range
   - Shows all invoices, payments, returns
   - Running balance
   - Print: official statement letter

2. Customers with Balance:
   - List all customers with non-zero balance
   - Aging analysis: 0-30 days | 31-60 | 61-90 | >90

3. Top Customers by Sales (bar chart)

4. Customer Payment Analysis
```

## 21.7 Supplier Report

Same as customer report but for suppliers (purchase invoices, payments, balance aging).

## 21.8 Profit & Loss Report

```
Critical accuracy requirements:
- Sales revenue (net of returns)
- Cost of goods sold (at purchase cost)
- Gross profit
- Gross profit margin %
- Expenses by category
- Other revenues
- Net profit / loss

Time comparison:
- This period vs previous period
- Line chart showing profit trend

Permission: requires reports_profit permission
```

## 21.9 Treasury Report

```
Per-treasury detailed report:
- Opening balance
- All transactions (in/out) for period
- Closing balance
- Balance verification

Transactions list:
- Date | Type | Reference | Amount | Direction | Running Balance
```

## 21.10 Shift Report

```
Per-shift summary (linked to shift_id):
- Cashier name + shift time
- Sales count + total
- Returns count + total
- Cash expected vs counted
- Difference
- Breakdown by payment type
- List of voided/deleted invoices (with reasons)
```

## 21.11 Tax Report

```
For VAT/tax filing:
- Total taxable sales
- Total tax collected
- Total taxable purchases
- Total tax paid
- Net tax liability (to pay to authorities)

Breakdown by tax rate (if multiple rates used)
Formatted for official submission
```

## 21.12 Audit Report

```
Who did what, when:
- Filter by user, action type, resource, date
- All CREATE / UPDATE / DELETE operations logged
- Shows before/after for updates
- Cannot be deleted by any user (including admin)
```

## 21.13 Employee Report

```
- Sales by employee (for commission tracking)
- Incentives and penalties summary
- Salary report (if salary module used)
```

## 21.14 PDF Generation

Using `pdfkit`:
```javascript
// All reports support PDF export
// PDF includes:
// - Company logo + name in header
// - Branch name + report title
// - Report period + generated date/time
// - Filtered criteria shown
// - Data table (paginated across PDF pages)
// - Page numbers: "صفحة 1 من 5"
// - Footer: generated by + date
// - Watermark: "سري" if includes cost/profit data

// RTL support in PDF:
// Use Noto Sans Arabic font embedded in PDF
// Set text direction RTL per block
```

---



---

# 21.15 COMPLETE REPORT SPECIFICATIONS

> *Gap Analysis V2 — Domain 2A-2F | Gap Analysis V1 — GAP 5, 6*

## SALES REPORTS (Complete Spec)

### 21.15.1 Daily Sales Summary (الملخص اليومي)
```
Filters: Date | Cashier | Payment Type
Columns: Date/Hour | Invoices Count | Gross Sales | Discounts | Returns | Net Sales
         Tax Amount | Cash Collected | Credit Sales | Voids Count
Footer totals for all numeric columns
Chart: Bar chart by hour showing sales volume
Export: Excel, PDF
```

### 21.15.2 Sales by Item (مبيعات حسب الصنف)
```
Filters: Date range | Category | Supplier | Item | Min Qty
Columns: Item Name | Category | Barcode | Qty Sold | Unit | Avg Price
         Total Revenue | Cost Total | Gross Profit | Profit Margin %
Sort: by revenue DESC (default), or by qty, margin
Chart: Top 10 items bar chart
Highlight: Items with margin below threshold (red)
Export: Excel, PDF
```

### 21.15.3 Sales by Category (مبيعات حسب الفئة)
```
Filters: Date range
Columns: Category | Items Count | Qty Sold | Revenue | Cost | Gross Profit | % of Total
Chart: Pie chart of revenue by category
Export: Excel, PDF
```

### 21.15.4 Sales by Cashier (مبيعات حسب الكاشير)
```
Filters: Date range | Cashier
Columns: Cashier | Invoices | Gross Sales | Discounts Given | Returns | Voids | Net Sales
         Avg Invoice Value | Cash Handled | Credit Sales
Flags: High void count | High discount rate (red badges)
Export: Excel, PDF
```

### 21.15.5 Sales by Payment Method (مبيعات حسب طريقة الدفع)
```
Filters: Date range
Columns: Payment Method | Transactions Count | Total Amount | % of Total
Chart: Pie + bar dual chart
```

### 21.15.6 Hourly Sales Heatmap (ذروة المبيعات)
```
Filters: Date range
Visual: Grid table — Days (rows) × Hours (columns) — cell color intensity = sales volume
Purpose: Identify peak hours and slow periods for staffing decisions
Export: Excel (with conditional formatting preserved)
```

### 21.15.7 Sales Exceptions Report (تقرير الاستثناءات) — Fraud Detection
```
Filters: Date range | Cashier | Type
Sections:
  - Voided Invoices: Invoice# | Cashier | Time | Amount | Reason | Authorized By
  - Large Discounts: Invoice# | Cashier | Discount% | Reason | Amount Lost
  - Returns Processed: Invoice# | Cashier | Return Reason | Items | Amount
  - Manual Price Changes: Item | Original Price | New Price | Cashier | Reason
Access: manager + admin only
Export: Excel, PDF
```

### 21.15.8 Comparative Sales Report (مقارنة فترات)
```
Filters: Period A (date range) | Period B (date range)
Columns: Metric | Period A | Period B | Difference | Change %
Rows: Revenue | Transactions | Avg Invoice | Top Item | Returns Rate
```

## INVENTORY REPORTS (Complete Spec)

### 21.15.9 Current Stock Level (مستوى المخزون الحالي)
```
Filters: Category | Supplier | Low Stock Only | Out of Stock Only | Warehouse
Columns: Item | Category | Barcode | Unit | On Hand | Min Stock | Max Stock
         Status (OK/Low/Out) | Cost Value | Retail Value
Sort: by stock status (Out → Low → OK)
Highlight: Out of stock = red row | Low stock = yellow row
Export: Excel
```

### 21.15.10 Stock Valuation Report (تقييم المخزون)
```
Filters: As of Date | Category | Warehouse
Columns: Item | On Hand Qty | Avg Cost | Total Cost Value | Retail Price | Total Retail Value
Totals: Grand total cost value | Grand total retail value | Potential profit
Access: manager + admin + accountant only
Export: Excel, PDF
```

### 21.15.11 Dead Stock / Slow Movers (البضاعة الراكدة)
```
Filters: Period | Category | Zero sales only | < N units sold
Columns: Item | Category | On Hand | Last Sale Date | Days Since Last Sale
         Total Cost of Dead Stock
Sort: by Days Since Last Sale DESC
Action Button: "Mark for markdown" (creates promotion)
Export: Excel
```

### 21.15.12 Stock Count Sheet (ورقة الجرد)
```
Purpose: Print blank count sheets for physical inventory counting
Filters: Category | Warehouse
Output: Printable table with Item | Barcode | System Qty | Actual Count (blank) | Variance
Format: A4 or thermal print, optimized for clipboard use
After counting: can upload actual counts → generates variance report
```

### 21.15.13 Inventory Replenishment Report (تقرير إعادة الطلب)
```
Filters: Below min stock | Below X days coverage
Columns: Item | Supplier | On Hand | Min Stock | Suggested Order Qty
         Last Purchase Price | Estimated Total Cost
Action: "Generate Purchase Order" from selected items
```

### 21.15.14 Item Expiry Report (تقرير انتهاء الصلاحية)
```
Columns: Item | Batch | Expiry Date | Qty | Days Until Expiry | Cost Value at Risk
Highlight: Expired = red | Expiring within 7 days = orange
```

## FINANCIAL REPORTS (Complete Spec)

### 21.15.15 Daily Revenue Summary (ملخص الإيرادات اليومية)
```
Sections:
  A. Sales Revenue: Gross | Discounts | Returns | Net
  B. Other Revenue: per category
  C. Expenses: per category
  D. Net Revenue: A(Net) + B - C
  E. Cash Flow: Opening Cash + Collections - Expenses = Closing Cash
  F. Payment breakdown: Cash vs Credit received
Print: Auto-print each day at closing (configurable)
```

### 21.15.16 Customer Receivables Aging (ذمم العملاء)
```
Filters: As of date | Customer | Overdue only | By aging bucket
Columns: Customer | Total Invoices | Total Paid | Balance Due
         Aging: 0-30 days | 31-60 days | 61-90 days | 90+ days
Highlight: Overdue > 90 days in red
Total: Grand total receivables
Export: Excel, PDF
```

### 21.15.17 Supplier Payables (ذمم الموردين)
```
Same structure as customer receivables but for supplier balances owed
```

### 21.15.18 Profit & Loss Summary (ملخص الأرباح والخسائر)
```
Filters: Date range
Lines:
  Gross Revenue
  - Cost of Goods Sold (COGS)
  = Gross Profit
  - Operating Expenses (by category)
  = Net Profit
  Gross Margin %
  Net Margin %
Access: manager + admin + accountant only
Export: Excel, PDF
```

### 21.15.19 Cash Flow Report (تقرير التدفق النقدي)
```
Filters: Date range
Sections:
  Inflows: Sales (cash) | Customer payments received | Other revenues
  Outflows: Purchases (cash) | Supplier payments | Expenses paid
  Treasury movements: Cash-in / Cash-out / Transfers between treasuries
  Net Flow per day (bar chart)
```

### 21.15.20 Treasury / Safe Balance Report (تقرير الخزينة)
```
Filters: Date range | Treasury
Columns per treasury: Opening Balance | Cash In | Cash Out | Closing Balance
Detail: Every transaction that affected each treasury
```

## CUSTOMER REPORTS (Complete Spec)

### 21.15.21 Customer Purchase History (سجل مشتريات العميل)
```
Filters: Customer (required) | Date range | Category
Columns: Date | Invoice# | Items | Qty | Amount | Payment Type | Balance
Total: Total purchases | Total paid | Outstanding balance
Action buttons: Print statement | Send SMS (if configured)
```

### 21.15.22 Top Customers Report (أفضل العملاء)
```
Filters: Date range | N (top N customers)
Columns: Customer | Invoices Count | Total Spent | Avg Invoice | Last Purchase Date
         Loyalty Points (if enabled) | Outstanding Balance
Sort: by Total Spent DESC
Chart: Bar chart top 10
```

### 21.15.23 Customer Aging Report (تقادم الذمم)
```
Standard receivables aging by customer with full aging bucket breakdown
Legal template for debt collection follow-up
```

### 21.15.24 Loyalty Program Report (تقرير نقاط الولاء)
```
Filters: Date range | Tier
Columns: Customer | Points Earned | Points Redeemed | Points Balance | Tier | Total Spent
Totals: Total outstanding points liability (SAR value)
```

## CASHIER & SHIFT REPORTS (Complete Spec)

> *Also covers Gap Analysis V1 — GAP 6*

### 21.15.25 Cashier Performance Summary (أداء الكاشير)
```
Filters: Date range | Cashier
Columns: Cashier | Shifts | Total Invoices | Gross Sales | Discounts | Returns
         Voids | Avg Invoice | Cash Discrepancies Total
Flags: Anomalous void rate | Anomalous discount rate
Void/Discount anomaly alerts: if cashier voids >X invoices/day or grants discounts >Y% → notification alert
```

### 21.15.26 Shift History Report (سجل الورديات)
```
Filters: Date range | Cashier | Status (open/closed)
Columns: Shift# | Cashier | Opened At | Closed At | Duration
         Opening Cash | Sales | Returns | Expected | Declared | Discrepancy
Highlight: Shifts with discrepancy > threshold
```

### 21.15.27 Exceptions & Anomalies Dashboard (لوحة الاستثناءات)
```
Real-time dashboard visible to managers:
- Unusually large discounts today (> threshold)
- High void rate cashiers today
- Shifts open > 12 hours (forgot to close)
- Stock adjustments made today (manual)
- Failed login attempts in past 24 hours
- Large cash discrepancies in last 7 days
```

## AUDIT LOG VIEWER

> *Gap Analysis V1 — GAP 5*

```
Page: /reports/audit-log
Access: admin only
Filters: user, action_type, entity_type, date range
Columns: timestamp | user | action | entity | details | IP address

Example rows:
2026-04-18 09:14  أحمد  تعديل سعر  صنف: كولا 330ml  من: 3.50 → إلى: 4.00
2026-04-18 11:02  سارة  حذف فاتورة  INV-000143  سبب: خطأ في الإدخال
2026-04-18 13:45  مشرف  تسجيل دخول فاشل  محاولة 3/5

API:
GET  /api/audit-logs    → Query with filters (admin only)
     ?user_id=...&action=...&entity=...&from=...&to=...&page=...

Cannot be deleted or edited (read-only)
Export to Excel (for compliance)
```

## REPORT SCHEDULING & AUTO-DELIVERY

> *Gap Analysis V2 — Domain 2F*

```javascript
// New Collection: report_schedules (collection #32 from V2)
{
  _id: ObjectId,
  report_type: String,    // e.g. 'daily_summary' | 'weekly_sales' | 'stock_level'
  frequency: String,      // 'daily' | 'weekly' | 'monthly'
  run_at: String,         // "23:59"
  day_of_week: Number,
  day_of_month: Number,
  recipients: [ObjectId],
  auto_print: Boolean,
  format: String,         // 'pdf' | 'excel'
  filters: Object,
  is_active: Boolean,
  last_run_at: Date,
  created_by: ObjectId,
}

// node-cron job: every minute checks report_schedules,
// generates report, saves to /outputs/, optionally prints

// API:
GET    /api/report-schedules
POST   /api/report-schedules
PUT    /api/report-schedules/:id
DELETE /api/report-schedules/:id
POST   /api/report-schedules/:id/run-now    // Manual trigger
```


---

# 22. GLOBAL SEARCH MODULE

## 22.1 Global Search Bar (Topbar)

```
Keyboard shortcut: Ctrl+K / Ctrl+F to focus

Searches across:
- Items (by name, barcode, code)
- Customers (by name, phone, code)
- Suppliers (by name, phone, code)
- Invoices (by number)
- Purchases (by number)

Results shown in grouped dropdown:
──── الأصناف (2) ────
  📦 عصير برتقال — كود: 001 — الباركود: 6281...
──── العملاء (1) ────
  👤 أحمد محمد — 0501234567
──── فواتير (3) ────
  🧾 INV-000045 — ١٢٥.٠٠ ر.س — ٢٠٢٦/٠٤/١٠

Click result → navigate to relevant page with item/record highlighted
```

## 22.2 Search Performance

```
- Debounce input: 300ms
- MongoDB text index on item name + customer name + phone
- Results limited to 5 per category (15 total max)
- Index all searchable collections on app start
```

---

# 23. NOTIFICATIONS & ALERTS SYSTEM

## 23.1 Notification Types

| Type | Trigger | Severity | Action |
|------|---------|----------|--------|
| `low_stock` | Item qty < min_stock_qty | Warning | View item |
| `cheque_due` | Due date within N days | Warning | View cheque |
| `installment_due` | Due date within N days | Warning | View plan |
| `customer_credit_limit` | Customer balance > credit_limit | Danger | View customer |
| `backup_required` | Last backup > 7 days ago | Warning | Run backup |
| `license_expiring` | License expires in < 30 days | Warning | Renew |
| `license_expired` | License past expiry date | Danger | Renew |
| `shift_not_closed` | Open shift from previous day | Warning | Close shift |

## 23.2 Notification Bell (Topbar)

```
Bell icon with unread count badge
Click → dropdown or full notification center page

Notification item shows:
- Icon (colored by severity)
- Title + message
- Time ago (relative)
- Link to relevant page

Bulk actions: Mark all read | Clear all
```

## 23.3 Cron Jobs Schedule

```javascript
// jobs/lowStockAlert.js — runs daily at 08:00
cron.schedule('0 8 * * *', async () => {
  const lowItems = await StockLevel.aggregate([
    { $lookup: { from: 'items', localField: 'item_id', foreignField: '_id', as: 'item' } },
    { $unwind: '$item' },
    { $match: { $expr: { $lt: ['$quantity', '$item.min_stock_qty'] }, 'item.min_stock_qty': { $gt: 0 } } }
  ]);
  
  for (const item of lowItems) {
    await createNotification({
      type: 'low_stock',
      title: 'مخزون منخفض',
      message: `${item.item.name} — الكمية: ${item.quantity} (الحد الأدنى: ${item.item.min_stock_qty})`,
      severity: item.quantity === 0 ? 'danger' : 'warning',
      reference_id: item.item_id,
      reference_type: 'item',
    });
  }
});
```

---



## 23.4 COMPLETE NOTIFICATION TYPES (Full List)

> *Gap Analysis V2 — Domain 8A*

```javascript
const NOTIFICATION_TYPES = {
  // Stock alerts
  STOCK_LOW:           'stock_low',
  STOCK_OUT:           'stock_out',
  STOCK_EXPIRY_NEAR:   'stock_expiry_near',  // expiry within 30 days
  STOCK_EXPIRED:       'stock_expired',

  // Customer alerts
  CUSTOMER_CREDIT_NEAR_LIMIT:  'customer_credit_near',   // used > 80% of limit
  CUSTOMER_CREDIT_EXCEEDED:    'customer_credit_over',
  CUSTOMER_OVERDUE_BALANCE:    'customer_overdue',        // balance > 90 days old

  // Cashier & shift alerts
  SHIFT_OPEN_TOO_LONG:         'shift_open_long',         // shift > 12 hours
  SHIFT_LARGE_DISCREPANCY:     'shift_discrepancy',       // cash diff > threshold
  CASHIER_HIGH_VOID_RATE:      'cashier_high_voids',
  CASHIER_HIGH_DISCOUNT_RATE:  'cashier_high_discounts',

  // Security alerts
  FAILED_LOGIN_REPEATED:       'failed_login',            // 3+ failed attempts
  ACCOUNT_LOCKED:              'account_locked',
  SUPERVISOR_OVERRIDE_USED:    'supervisor_override',     // log every override

  // System alerts
  BACKUP_FAILED:               'backup_failed',
  BACKUP_SUCCESS:              'backup_success',
  LICENSE_EXPIRY_NEAR:         'license_expiry',          // 30/7/1 days
  DB_SIZE_HIGH:                'db_size_high',            // > 80% of disk space
  APP_UPDATE_AVAILABLE:        'app_update',
}
```

## 23.5 NOTIFICATION PREFERENCES PER USER

> *Gap Analysis V2 — Domain 8B*

```javascript
// Add to users collection:
notification_preferences: {
  stock_alerts:         Boolean,   // default: true for manager+
  cashier_alerts:       Boolean,   // default: true for manager+
  security_alerts:      Boolean,   // default: true for admin
  system_alerts:        Boolean,   // default: true for admin
  email_digest:         Boolean,
  digest_email:         String,
}
```


---

# 24. BACKUP, RESTORE & DATA INTEGRITY

## 24.1 Manual Backup

```
Settings → Backup → Create Backup Now

Process:
1. User selects destination folder (IPC → dialog:choose-folder)
2. System calls mongodump:
   mongodump --host 127.0.0.1 --port 27017 --db elhegazi --out /path/to/backup
3. Compresses result to .tar.gz with timestamp:
   elhegazi-backup-2026-04-18-14-30-00.tar.gz
4. Shows success + file size
5. Verifies backup by checking file size > 0
6. Adds to backup history list in settings
```

## 24.2 Auto-Backup (Cron)

```javascript
// jobs/autoBackup.js
// Runs based on settings.auto_backup_frequency
// Daily: runs at settings.auto_backup_time
// Cleans up old backups: keeps settings.backup_keep_last most recent

cron.schedule(`${minute} ${hour} * * *`, async () => {
  const settings = await Settings.findOne();
  if (!settings.auto_backup || !settings.backup_path) return;
  
  await createBackup(settings.backup_path);
  await cleanOldBackups(settings.backup_path, settings.backup_keep_last);
  
  await Notification.create({
    type: 'info',
    title: 'تم النسخ الاحتياطي',
    message: `تم إنشاء نسخة احتياطية بنجاح في ${settings.backup_path}`
  });
});
```

## 24.3 Restore Process

```
WARNING: This will REPLACE all current data

Process:
1. Show confirmation dialog: "هذا سيحذف جميع البيانات الحالية. هل أنت متأكد؟"
2. Require admin password to confirm
3. User selects backup file (.tar.gz)
4. Decompress to temp folder
5. Run mongorestore:
   mongorestore --host 127.0.0.1 --port 27017 --db elhegazi /path/to/backup/elhegazi --drop
6. Restart Express server (to re-init Mongoose)
7. Show success + redirect to login

Error handling:
- If restore fails: show error, ensure old data is not lost
- Log restore attempt in audit (or plain log file)
```

## 24.4 Database Integrity Checks

Run on app startup:
```javascript
// Check for orphaned invoice_lines (invoice_id not in invoices)
// Check stock_level quantities consistency with stock_movements
// Check customer/supplier balance consistency with transactions
// If issues found: log to error file, show warning to admin
// These are diagnostic only — do not auto-fix without admin confirmation
```

## 24.5 Soft Delete Policy

```
NEVER hard-delete data that affects financial records:
- Invoices: soft-delete (deleted_at, deleted_by, delete_reason)
- Customers/Suppliers: soft-delete
- Payments: soft-delete
- Items: soft-delete

Safe to hard-delete:
- Notification records
- Audit logs (never — immutable)
- Draft invoices

Soft-delete cascades:
Deleting a customer marks them deleted, NOT their invoices.
Invoices remain fully intact for historical reporting.
```

---



## 24.6 BACKUP INTEGRITY VERIFICATION

> *Gap Analysis V2 — Domain 7A*

```javascript
// Each backup file must include a checksum:
const backupMeta = {
  created_at: new Date(),
  db_version: currentDbVersion,
  collections_count: N,
  documents_count: totalDocs,
  checksum: sha256(backupFileBuffer),   // SHA-256 of entire backup file
  elhegazi_version: appVersion,
  hardware_id: machineId,
}
// Meta saved as backup_meta.json alongside backup file

// When restoring:
// 1. Recalculate checksum of uploaded backup file
// 2. Compare to stored checksum in backup_meta.json
// 3. If mismatch: REJECT restore — file corrupted or tampered
// UI shows: checksum status badge "✓ سليم" or "✗ تالف" before confirming restore
```

## 24.7 PRE-RESTORE SAFETY SNAPSHOT

> *Gap Analysis V2 — Domain 7B*

```javascript
// Before ANY restore operation:
// Automatically create a "safety snapshot" backup of current data
// Saved to: %APPDATA%/ElHegazi/safety_snapshots/pre_restore_{timestamp}.bak
// Keep last 3 safety snapshots, auto-delete older ones
// UI shows: "تم حفظ نسخة احتياطية تلقائية قبل الاستعادة"
// If restore fails: one-click rollback to safety snapshot
```

## 24.8 BACKUP SCHEDULE WITH ROTATION POLICY

> *Gap Analysis V2 — Domain 7C*

```javascript
// Add to settings:
backup_schedule: {
  auto_backup_enabled: Boolean,
  frequency: String,               // 'daily' | 'weekly'
  run_at_time: String,             // "23:00"
  backup_path: String,
  keep_last_n_backups: Number,     // Default: 30
  compress: Boolean,               // gzip compression
  backup_on_app_close: Boolean,    // Always backup when app closes
  notify_on_backup_success: Boolean,
  notify_on_backup_failure: Boolean,  // System tray alert
}

// Auto-rotation: after backup succeeds, delete oldest if count > keep_last_n_backups
// Backup filename: ElHegazi Retailer_backup_2026-04-18_23-00.bak.gz
```

## 24.9 FULL DATA EXPORT FOR MIGRATION

> *Gap Analysis V2 — Domain 7D*

```javascript
// Settings → Data → تصدير البيانات

POST /api/export/full       → Full MongoDB dump (for migration/backup)
POST /api/export/items      → Items + prices as Excel
POST /api/export/customers  → Customers as Excel
POST /api/export/invoices   → Invoices as Excel (date range filter)
POST /api/export/suppliers  → Suppliers as Excel

// Useful for:
// - Migrating to ElHegazi Retailer V2 (multi-branch cloud)
// - Providing accountant with data in standard format
// - Regulatory compliance (data portability)
```


---

# 25. SETTINGS MODULE

## 25.1 Settings Pages Structure

```
Settings
├── معلومات الشركة (Company Info) — same as wizard step 2
├── إعدادات الفواتير (Invoice Settings)
│   - Invoice/purchase/return prefixes and current counters
│   - Allow editing invoice date
│   - Invoice notes (default notes shown on invoice)
├── إعدادات الإيصالات (Receipt Settings)
│   - Paper size (58mm / 80mm / A4)
│   - Logo on/off
│   - Tax on/off
│   - Header / footer text
│   - Number of copies
│   - Custom fields (up to 3)
├── إعدادات نقطة البيع (POS Settings)
│   - Require customer
│   - Allow negative stock
│   - Auto-print on save
│   - Default warehouse
│   - Default treasury
│   - Items per page in grid
│   - Show item images
│   - POS screen layout (grid / list)
├── إعدادات الضرائب (Tax Settings)
│   - Tax rate
│   - Tax type (inclusive / exclusive / none)
├── الإشعارات (Notifications)
│   - Low stock: on/off + days before
│   - Cheque due: on/off + days before
│   - Installments: on/off + days before
├── النسخ الاحتياطي (Backup)
│   - Auto-backup: on/off + frequency + time + path
│   - Keep last N backups
│   - Manual backup button
│   - Restore button
│   - Backup history list
├── الطابعة (Printer)
│   - Default printer selection
│   - Test print button
│   - Cash drawer pulse command (for supported printers)
├── العرض (Display)
│   - Language (AR / EN)
│   - Theme (Light / Dark)
│   - Date format
│   - Number format
├── معلومات الترخيص (License Info)
│   - Current license key (masked: PLAZA-****-****-****-XXXX)
│   - Hardware ID
│   - Status + expiry
│   - Days until expiry warning
│   - Contact support button
└── حول البرنامج (About)
    - Version number
    - Check for updates button
    - Open log files folder
```

---



## 25.2 RECEIPT TEMPLATE VISUAL DESIGNER

> *Gap Analysis V1 — GAP 10 | Gap Analysis V2 — Domain 3A*

```javascript
// Add to settings collection — receipt_template:
receipt_template: {
  paper_width_mm: Number,       // 58 | 80

  header: {
    show_logo: Boolean,
    logo_path: String,
    logo_alignment: String,     // 'left' | 'center' | 'right'
    show_store_name: Boolean,
    store_name_font_size: String,
    store_name_bold: Boolean,
    show_address: Boolean,
    show_phone: Boolean,
    show_tax_number: Boolean,
    show_commercial_register: Boolean,
    custom_line_1: String,
    custom_line_2: String,
    custom_line_3: String,
    show_divider_after_header: Boolean,
  },

  invoice_info: {
    show_invoice_number: Boolean,
    show_date: Boolean,
    show_time: Boolean,
    date_format: String,
    show_cashier_name: Boolean,
    show_shift_number: Boolean,
    show_customer_name: Boolean,
    show_customer_phone: Boolean,
    show_customer_balance_after: Boolean,
  },

  items_table: {
    show_item_number_col: Boolean,
    show_barcode_col: Boolean,
    show_unit_col: Boolean,
    show_qty_col: Boolean,
    show_unit_price_col: Boolean,
    show_discount_col: Boolean,
    show_total_col: Boolean,
    item_name_max_chars: Number,
    use_arabic_numerals: Boolean,
  },

  totals: {
    show_subtotal: Boolean,
    show_discount_total: Boolean,
    show_tax_amount: Boolean,
    show_grand_total: Boolean,
    show_amount_paid: Boolean,
    show_change_due: Boolean,
    grand_total_font_size: String,
    grand_total_bold: Boolean,
  },

  footer: {
    show_payment_method: Boolean,
    show_barcode_of_invoice: Boolean,
    show_loyalty_points_earned: Boolean,
    show_loyalty_balance: Boolean,
    custom_line_1: String,   // e.g. "شكراً لزيارتكم"
    custom_line_2: String,   // e.g. "لا يقبل الاسترداد بعد 7 أيام"
    custom_line_3: String,
    custom_line_4: String,
    show_qr_code: Boolean,
    qr_code_content: String,
    show_divider_before_footer: Boolean,
  },

  behavior: {
    auto_print_on_save: Boolean,
    print_copies: Number,
    prompt_before_print: Boolean,
    print_return_receipt: Boolean,
    print_x_report_format: String,
    print_z_report_format: String,
  },
}
```

**Receipt Template Editor UI:**
```
Page: Settings → الطباعة والإيصالات
Layout: Split screen
  LEFT: Settings panel (toggles, text inputs, selectors)
  RIGHT: Live preview — real-time thermal receipt preview
         Paper width selector: [58mm] [80mm]
         Preview updates instantly as settings change

Components to build:
  client/src/pages/settings/ReceiptTemplateEditor.jsx    — Split-screen editor
  client/src/pages/settings/ReceiptSettingsPanel.jsx     — All toggle/input controls
  client/src/pages/settings/ReceiptLivePreview.jsx       — Simulated thermal receipt
  client/src/pages/settings/ReceiptLogoUpload.jsx        — Logo upload with size warning
```

## 25.3 MULTIPLE RECEIPT PROFILES

> *Gap Analysis V2 — Domain 3B*

```javascript
// New Collection: receipt_profiles (collection #32)
{
  _id: ObjectId,
  name_ar: String,          // e.g. "إيصال العميل" | "نسخة المحاسبة"
  name_en: String,
  is_default: Boolean,
  template: { /* all receipt_template fields */ }
}

// Use cases:
// - Customer copy vs. merchant copy (different footers)
// - Return receipt (different header: "إيصال مرتجع")
// - Quote/proforma receipt (no "paid" stamp)
// - Gift receipt (hide prices, different footer message)
```

## 25.4 SYSTEM HEALTH DASHBOARD

> *Gap Analysis V2 — Domain 10E*

```javascript
// Settings → النظام (new tab)
// Shows:
// - Database size (current / estimated limit)
// - Total records: invoices, customers, items counts
// - Last backup: date + status
// - App version + latest available
// - License status + expiry
// - Active users (currently logged in)
// - Disk space: free / total

// API: GET /api/system/health
// Returns all metrics in one call
// Auto-refresh every 30 seconds on settings page
```

## 25.5 LOYALTY PROGRAM SETTINGS

> *Gap Analysis V1 — GAP 4*

```javascript
// Add to settings collection:
loyalty_enabled: { type: Boolean, default: false },
points_per_currency_unit: { type: Number, default: 1 },  // 1 point per 1 SAR
points_redemption_value: { type: Number, default: 0.10 }, // 1 point = 0.10 SAR
min_points_to_redeem: { type: Number, default: 100 },
tier_thresholds: {
  silver: { type: Number, default: 1000 },   // SAR total spend
  gold:   { type: Number, default: 5000 },
},
```


---

# 26. API ENDPOINTS — COMPLETE REFERENCE

## 26.1 Auth Endpoints

```
POST   /api/auth/login              — Login, returns JWT
POST   /api/auth/logout             — Invalidate token
POST   /api/auth/change-password    — Change own password
GET    /api/auth/me                 — Get current user
POST   /api/auth/refresh            — Refresh token
```

## 26.2 Settings Endpoints

```
GET    /api/settings                — Get settings
PATCH  /api/settings                — Update settings (admin only)
POST   /api/settings/setup          — Complete first-time setup
GET    /api/settings/license        — Get license status
POST   /api/settings/license/activate — Activate license key
```

## 26.3 Users Endpoints

```
GET    /api/users                   — List users
POST   /api/users                   — Create user
GET    /api/users/:id               — Get user
PATCH  /api/users/:id               — Update user
DELETE /api/users/:id               — Soft delete
POST   /api/users/:id/reset-password — Admin reset password
PATCH  /api/users/:id/toggle-active — Activate/deactivate
```

## 26.4 Items Endpoints

```
GET    /api/items                   — List (paginated, filtered)
POST   /api/items                   — Create
GET    /api/items/:id               — Get with stock + prices
PATCH  /api/items/:id               — Update
DELETE /api/items/:id               — Soft delete
GET    /api/items/barcode/:code     — Lookup by barcode (POS scan)
POST   /api/items/import            — Bulk import from Excel
POST   /api/items/bulk-update       — Update multiple items
GET    /api/items/:id/movements     — Stock movement history
GET    /api/items/:id/history       — Sales/purchase history
```

## 26.5 Customers Endpoints

```
GET    /api/customers               — List
POST   /api/customers               — Create
GET    /api/customers/:id           — Get + stats
PATCH  /api/customers/:id           — Update
DELETE /api/customers/:id           — Soft delete
GET    /api/customers/:id/statement — Account statement
GET    /api/customers/:id/invoices  — Customer's invoices
GET    /api/customers/:id/payments  — Customer's payments
POST   /api/customers/check-balance — POS credit check
```

## 26.6 Invoices Endpoints

```
GET    /api/invoices                — List (paginated, filtered)
POST   /api/invoices                — Create sale invoice
GET    /api/invoices/:id            — Get with lines
DELETE /api/invoices/:id            — Soft delete (permission required)
GET    /api/invoices/:number        — Get by invoice number
POST   /api/invoices/:id/print      — Log print event
POST   /api/invoices/returns        — Create sale return
GET    /api/invoices/:id/returns    — Returns for this invoice
```

## 26.7 Purchases Endpoints

```
GET    /api/purchases               — List
POST   /api/purchases               — Create
GET    /api/purchases/:id           — Get
DELETE /api/purchases/:id           — Soft delete
POST   /api/purchases/returns       — Create return
GET    /api/purchase-orders         — PO list
POST   /api/purchase-orders         — Create PO
PATCH  /api/purchase-orders/:id     — Update PO
POST   /api/purchase-orders/:id/receive — Receive PO (creates purchase)
```

## 26.8 Payments Endpoints

```
GET    /api/payments                — List
POST   /api/payments                — Create payment
GET    /api/payments/:id            — Get payment
DELETE /api/payments/:id            — Soft delete
PATCH  /api/payments/:id/allocate   — Allocate to invoices
```

## 26.9 Stock Endpoints

```
GET    /api/stock                   — All stock levels (filtered)
GET    /api/stock/item/:itemId      — Stock by item (all warehouses)
GET    /api/stock/warehouse/:wId    — All items in warehouse
POST   /api/stock/transfer          — Transfer between warehouses
POST   /api/stock/adjustment        — Manual adjustment
GET    /api/stock/movements         — Movements log (filtered)
POST   /api/stock/count/start       — Start physical count
GET    /api/stock/count/:id         — Get count session
PATCH  /api/stock/count/:id/update  — Update item count
POST   /api/stock/count/:id/confirm — Confirm count (applies adjustments)
```

## 26.10 Expenses Endpoints

```
GET    /api/expenses                — List
POST   /api/expenses                — Create
GET    /api/expenses/:id
PATCH  /api/expenses/:id
DELETE /api/expenses/:id
GET    /api/revenues                — Other revenues
POST   /api/revenues
PATCH  /api/revenues/:id
DELETE /api/revenues/:id
```

## 26.11 Operations Endpoints

```
POST   /api/treasury/transfer       — Treasury-to-treasury transfer
GET    /api/treasury/:id/balance    — Current balance
GET    /api/cheques                 — List cheques
POST   /api/cheques                 — Create cheque
PATCH  /api/cheques/:id/status      — Update cheque status
GET    /api/installments            — List plans
POST   /api/installments            — Create plan
GET    /api/installments/:id        — Get with schedule
POST   /api/installments/:id/pay    — Record payment for installment
POST   /api/items/bulk-price-update — Bulk price update
```

## 26.12 Reports Endpoints

```
GET    /api/reports/daily-closing   — Daily report
GET    /api/reports/sales           — Sales report (filtered)
GET    /api/reports/purchases       — Purchases report
GET    /api/reports/returns         — Returns report
GET    /api/reports/stock           — Stock report
GET    /api/reports/customers       — Customer report
GET    /api/reports/suppliers       — Supplier report
GET    /api/reports/profit-loss     — P&L report
GET    /api/reports/treasury        — Treasury report
GET    /api/reports/bank            — Bank report
GET    /api/reports/expenses        — Expenses report
GET    /api/reports/tax             — Tax report
GET    /api/reports/shifts          — Shift reports
GET    /api/reports/audit           — Audit log report
POST   /api/reports/export/pdf      — Generate PDF
POST   /api/reports/export/excel    — Generate Excel
```

## 26.13 Shifts Endpoints

```
GET    /api/shifts                  — List shifts
POST   /api/shifts/open             — Open shift
GET    /api/shifts/current          — Current open shift
POST   /api/shifts/:id/close        — Close shift
GET    /api/shifts/:id              — Get shift + summary
```

## 26.14 Notifications Endpoints

```
GET    /api/notifications           — List (unread first)
PATCH  /api/notifications/:id/read  — Mark as read
POST   /api/notifications/read-all  — Mark all read
DELETE /api/notifications/:id
GET    /api/notifications/count     — Unread count (for bell badge)
```

## 26.15 Backup Endpoints (IPC + API)

```
POST   /api/backup/create           — Trigger backup (returns file path)
POST   /api/backup/restore          — Restore from file
GET    /api/backup/history          — List backup files

IPC handlers (Electron-only):
dialog:choose-folder                — OS folder picker
dialog:choose-file                  — OS file picker
backup:create                       — Create + download
backup:restore                      — Restore flow
```

## 26.16 API Response Standard

Every API response follows this structure:

```javascript
// Success
{ success: true, data: {...}, message: 'تم الحفظ بنجاح' }
// Success with pagination
{ success: true, data: [...], total: 150, page: 1, limit: 20, pages: 8 }
// Error
{ success: false, error: { code: 'VALIDATION_ERROR', message: 'البيانات غير صحيحة', fields: { name: 'مطلوب' } } }
// Business error
{ success: false, error: { code: 'INSUFFICIENT_STOCK', message: 'المخزون غير كافٍ', itemId: '...' } }
```

## 26.17 Error Codes Reference

```
AUTH errors: NO_TOKEN, TOKEN_EXPIRED, INVALID_TOKEN, USER_INACTIVE, USER_LOCKED, WRONG_PASSWORD
Permission errors: FORBIDDEN, INSUFFICIENT_PERMISSION
Validation errors: VALIDATION_ERROR (+ fields object)
Business errors:
  INSUFFICIENT_STOCK
  CREDIT_LIMIT_EXCEEDED
  CUSTOMER_BLACKLISTED
  SHIFT_NOT_OPEN
  SHIFT_ALREADY_OPEN
  INVALID_RETURN_QUANTITY
  CANNOT_DELETE_IN_USE
  NEGATIVE_STOCK_NOT_ALLOWED
  DUPLICATE_INVOICE_NUMBER (should never happen — atomic counter)
  PAYMENT_EXCEEDS_BALANCE
  LAST_ADMIN_CANNOT_DELETE
  LICENSE_EXPIRED
  LICENSE_TRIAL_ENDED
Server errors: INTERNAL_ERROR, DATABASE_ERROR
```

---

# 27. ERROR HANDLING & EDGE CASES

## 27.1 Financial Calculation Edge Cases

```
RULE: All monetary values stored as INTEGERS (halala, piastre, fils)
Example: 150.75 SAR stored as 15075

Why: Floating point errors like 0.1 + 0.2 = 0.30000000000000004
Solution: Convert to integer on input, format for display only

// currencyMath.js
const toSmallestUnit = (amount, decimalPlaces) =>
  Math.round(amount * Math.pow(10, decimalPlaces));

const fromSmallestUnit = (amount, decimalPlaces) =>
  amount / Math.pow(10, decimalPlaces);

// NEVER: 150.75 + 20.50 (floating point)
// ALWAYS: 15075 + 2050 = 17125 → 171.25
```

## 27.2 Concurrent Sale Edge Cases

```
Scenario: Two cashiers sell the last unit of an item simultaneously

Solution: MongoDB atomic transaction

const stock = await StockLevel.findOneAndUpdate(
  {
    item_id: line.item_id,
    warehouse_id: line.warehouse_id,
    quantity: { $gte: line.quantity } // Only matches if sufficient stock
  },
  { $inc: { quantity: -line.quantity } },
  { session, new: true }
);

if (!stock) {
  // Check if negative stock is allowed for this item
  const item = await Item.findById(line.item_id).session(session);
  if (!item.allow_negative_stock) {
    throw new BusinessError('INSUFFICIENT_STOCK', { itemId: line.item_id, itemName: line.item_name });
  }
  // Force update for negative-allowed items
  await StockLevel.findOneAndUpdate(
    { item_id: line.item_id, warehouse_id: line.warehouse_id },
    { $inc: { quantity: -line.quantity } },
    { session, upsert: true }
  );
}
```

## 27.3 MongoDB Connection Loss

```
Scenario: MongoDB crashes while app is running

Mongoose reconnection strategy:
mongoose.connect(uri, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,
  maxPoolSize: 10,
  minPoolSize: 2,
  heartbeatFrequencyMS: 10000,
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error:', err);
  // Notify frontend via IPC
  mainWindow?.webContents.send('db-connection-error');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected — attempting reconnect...');
  mainWindow?.webContents.send('db-disconnected');
});

// Frontend shows: Red banner "قطع الاتصال بقاعدة البيانات — جاري إعادة الاتصال..."
// POS operates from offline queue if disconnected
```

## 27.4 Disk Full Edge Case

```
Before backup: check available disk space
Before upload: check available disk space
Set MongoDB wiredTigerCacheSizeGB to 0.25 (limit memory)

Monitor disk usage:
GET /api/system/health
Returns: { dbSizeMB, freeSpaceMB, uploadsCount, backupCount }

Alert when free space < 500MB
```

## 27.5 Invoice Deletion Edge Cases

```
Cannot delete invoice if:
- Payment has been allocated to it (un-allocate first)
- It's been fully or partially returned (cannot delete a returned invoice)
- Cheque linked to it is in deposited/cleared status

Can delete (with permission):
- Confirmed invoice with no allocations
- Creates audit log with reason
- Restores stock
- Reverses financial entries
```

## 27.6 Opening Balance Edge Cases

```
When setting customer/supplier opening balance:
- If positive: creates an "opening_balance" entry in the appropriate account
- If updating: reverses old entry + creates new entry
- Date: always fiscal year start
- Cannot be changed after first financial transaction

When setting treasury/bank opening balance:
- Creates a single adjustment movement record
- Date: setup date
```

## 27.7 Fiscal Year End

```
End of fiscal year process (optional, for V1 show as future feature):
- Close all open customer/supplier balances
- Carry forward to new year
- Archive old transactions
- Reset invoice counters (configurable)
```

## 27.8 Large Dataset Performance

```
Items: If >10,000 items:
- Virtual scroll in item grid (react-virtualized)
- MongoDB text index for search
- Cache frequently searched items in memory

Invoices: If >100,000 records:
- Pagination (20 per page) mandatory
- Date range filter mandatory for reports
- Aggregation pipelines use indexes

Stock movements: Append-only → grows large
- Archive movements older than 2 years to archive collection
- Keep current year in main collection
- Reports query both (union)
```

---

# 28. SECURITY ARCHITECTURE

## 28.1 Electron Security Checklist

Based on official Electron security guidelines:

```javascript
// In BrowserWindow creation:
webPreferences: {
  contextIsolation: true,       // ✅ REQUIRED — prevents renderer from accessing Node.js
  nodeIntegration: false,       // ✅ REQUIRED — renderer cannot use Node.js directly
  sandbox: true,                // ✅ Chromium sandbox
  webSecurity: true,            // ✅ Same-origin policy
  allowRunningInsecureContent: false, // ✅ No HTTP content
  experimentalFeatures: false,  // ✅ No experimental APIs
  enableBlinkFeatures: '',      // ✅ No blink feature overrides
}

// Prevent navigation to untrusted URLs
mainWindow.webContents.on('will-navigate', (event, url) => {
  if (!url.startsWith('http://127.0.0.1:5000')) {
    event.preventDefault();
  }
});

// Prevent new windows
mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

// Disable DevTools in production
if (app.isPackaged) {
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') event.preventDefault();
    if (input.control && input.shift && input.key === 'I') event.preventDefault();
  });
}
```

## 28.2 API Security

```javascript
// CORS: only allow localhost
cors({ origin: ['http://127.0.0.1:5000', 'http://localhost:5000'] })

// For LAN mode: additionally allow specific LAN IPs from settings
// This is configured dynamically after settings load

// Content Security Policy for served HTML
helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind needs inline
    imgSrc: ["'self'", "data:", "blob:"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
  }
});
```

## 28.3 Data Security

```
Sensitive data handling:
- Passwords: bcrypt with salt rounds = 12
- JWT secret: random 64-char string in .env
- License key: stored encrypted via electron-store
- No cloud storage — all data local
- Log files: never write sensitive data (prices, customer info)

ASAR Protection:
electron-builder's asar option packs app code into .asar archive
Add asar integrity checking in production builds

Source code obfuscation (optional for V2):
- Use electron-builder's asar unpacked for binaries
- JavaScript minification in Vite production build
```

## 28.4 Local Network Security (LAN Mode)

```
When LAN mode enabled:
- Bind to LAN IP, not 0.0.0.0 (avoid exposing to internet)
- JWT authentication still required for all API calls
- HTTPS not available (local LAN — acceptable for LAN-only)
- Consider adding firewall instructions in installer documentation
- Warn admin about LAN mode security in settings
```

## 28.5 Audit Trail (Immutable)

```
All financial changes are recorded:
- Invoice created/deleted
- Payment created/deleted
- Stock adjustments
- Price changes
- User login/logout
- Settings changes
- Backup/restore operations

Audit log records: WHO, WHAT, WHEN, IP ADDRESS
Audit log records CANNOT be deleted by any user
Audit log CANNOT be disabled
Admin can VIEW all audit logs
Admin can EXPORT audit logs to Excel/PDF
```

---

# 29. PERFORMANCE OPTIMIZATION

## 29.1 MongoDB Indexes (Critical)

```javascript
// scripts/create-indexes.js — run on first install + migrations

// items — most frequently queried
db.items.createIndex({ barcode: 1 });
db.items.createIndex({ 'barcodes': 1 });
db.items.createIndex({ item_code: 1 }, { unique: true, sparse: true });
db.items.createIndex({ category_id: 1, is_active: 1 });
db.items.createIndex({ name: 'text', name_en: 'text', item_code: 'text', tags: 'text' });
db.items.createIndex({ deleted_at: 1 }); // Soft delete filter

// invoices
db.invoices.createIndex({ invoice_number: 1 }, { unique: true });
db.invoices.createIndex({ date: -1 });
db.invoices.createIndex({ customer_id: 1, date: -1 });
db.invoices.createIndex({ status: 1 });
db.invoices.createIndex({ shift_id: 1 });
db.invoices.createIndex({ created_by: 1, date: -1 });

// invoice_lines
db.invoice_lines.createIndex({ invoice_id: 1 });
db.invoice_lines.createIndex({ item_id: 1 });

// stock_levels
db.stock_levels.createIndex({ item_id: 1, warehouse_id: 1 }, { unique: true });
db.stock_levels.createIndex({ warehouse_id: 1 });

// stock_movements
db.stock_movements.createIndex({ item_id: 1, created_at: -1 });
db.stock_movements.createIndex({ created_at: -1 });
db.stock_movements.createIndex({ reference_id: 1 });

// customers
db.customers.createIndex({ customer_code: 1 }, { unique: true });
db.customers.createIndex({ phone: 1 });
db.customers.createIndex({ name: 'text', phone: 'text', customer_code: 'text' });

// audit_logs
db.audit_logs.createIndex({ created_at: -1 });
db.audit_logs.createIndex({ user_id: 1, created_at: -1 });
db.audit_logs.createIndex({ resource: 1, resource_id: 1 });
```

## 29.2 React Query Cache Strategy

```javascript
// constants/queryKeys.js + stale times

const STALE_TIMES = {
  settings: Infinity,             // Never stale — changes rarely
  items: 5 * 60 * 1000,          // 5 min
  categories: 10 * 60 * 1000,    // 10 min
  customers: 2 * 60 * 1000,      // 2 min
  invoices: 30 * 1000,           // 30 sec
  stockLevels: 30 * 1000,        // 30 sec (changes often)
  reports: 0,                     // Always fresh
  notifications: 60 * 1000,      // 1 min
};

// Prefetch on hover (for navigation):
// When user hovers over "Customers" nav item → prefetch customers
// When POS loads → prefetch items + categories + default warehouse/treasury
```

## 29.3 POS Screen Performance

```
Critical path: item search must return in <100ms

Optimizations:
1. Load all active items into memory on POS mount (paginated: 200 at a time)
2. Client-side filtering for category filter tabs (no API call)
3. Barcode lookup: MongoDB indexed query → <10ms
4. Debounce text search: 200ms
5. Virtual scroll for item grid (react-virtualized WindowScroller)
6. Memoize item cards (React.memo — only re-render if item changes)
7. Zustand POS store updates are synchronous — no async
```

## 29.4 Report Generation Performance

```
For large reports (10,000+ rows):
1. Run aggregation in background (streaming)
2. Show progress bar
3. Paginate: 50 rows per page in UI table
4. Export (PDF/Excel) generated server-side, sent as file

MongoDB aggregation optimizations:
- Always use $match before $lookup
- Use covered queries (index-only) where possible
- Use $project early to reduce document size through pipeline
- Set maxTimeMS: 30000 (30 second timeout)
```

## 29.5 App Startup Time

```
Target: App ready for use < 10 seconds

Optimization:
1. MongoDB startup: ~3-5 sec (first start), ~1 sec (subsequent)
2. Express startup: ~0.5 sec
3. React hydration: ~1 sec (production build)
4. Splash screen shown during steps 1-2
5. Main window shown at step 3 (React loads in background)
6. Don't block startup on license check (check async, show app first)
7. Show skeleton UI immediately while data loads
```

---

# 30. OFFLINE MODE & DATA SYNC

## 30.1 POS Offline Queue

The POS screen must work even if the Express server has a brief hiccup (MongoDB reconnect, etc.).

```javascript
// services/offline.service.js — IndexedDB queue

import { openDB } from 'idb';

const DB_NAME = 'elhegazi_offline';
const STORE_NAME = 'pending_invoices';

export async function queueInvoice(invoiceData) {
  const db = await openDB(DB_NAME, 1, {
    upgrade(db) { db.createObjectStore(STORE_NAME, { autoIncrement: true }); }
  });
  await db.add(STORE_NAME, { ...invoiceData, queued_at: Date.now() });
}

export async function getPendingInvoices() {
  const db = await openDB(DB_NAME, 1);
  return db.getAll(STORE_NAME);
}

export async function removePendingInvoice(id) {
  const db = await openDB(DB_NAME, 1);
  await db.delete(STORE_NAME, id);
}
```

```javascript
// hooks/useOfflinePOS.js
// When save invoice fails with network error:
// 1. Save to IndexedDB queue
// 2. Show "محفوظ مؤقتاً — سيتم إرساله تلقائياً"
// 3. Continue POS usage

// When connection restores (detect via periodic ping):
// 1. Get pending invoices from queue
// 2. Submit each one to API
// 3. Show "تم إرسال 3 فواتير معلقة"
// 4. Clear queue
```

## 30.2 Offline Data Available

```
Available without API (loaded on startup, cached):
- All active items + prices (React Query cache + IndexedDB)
- All categories
- All customers (paginated cache)
- Settings

Not available offline:
- Real-time stock levels
- Reports
- New customers (cannot look up, use walk-in customer)
```

---

# 31. TESTING STRATEGY & CHECKLIST

## 31.1 Unit Tests (Jest)

```
Test coverage requirements: ≥ 80% for:
- currencyMath.js — all rounding edge cases
- invoiceService.js — number generation, total calculation
- stockService.js — deduction, addition, negative stock
- permissions.js — role defaults + overrides
- validators.js — all Zod schemas
```

## 31.2 Integration Tests (Jest + Supertest)

```
Test all API endpoints:
- Auth: login, wrong password, locked account, expired token
- Invoice: create, stock deduction, concurrent creates
- Customer: balance update on sale + return + payment
- Stock: transfer, adjustment, physical count
- Reports: all endpoints return 200 with correct shape
```

## 31.3 E2E Tests (Playwright)

```
Critical flows to test:
□ Full sale flow: open POS → scan barcode → set qty → cash payment → save → print receipt
□ Sale with serial numbers
□ Credit sale → credit limit warning
□ Sale return from original invoice
□ Customer payment with invoice allocation
□ Purchase with stock update
□ Stock transfer between warehouses
□ Physical count → confirm → verify stock levels
□ User permission block: cashier tries to access reports
□ Invoice number uniqueness under concurrent creates (2 parallel requests)
□ Offline POS: disconnect → save invoice → reconnect → queue syncs
□ Shift open → sales → close shift → verify totals
□ Backup → wipe data → restore → verify data intact
□ License trial expiry → app goes read-only
□ Setup wizard first run
□ Bulk price update
□ Cheque lifecycle: create → deposit → clear
```

## 31.4 Performance Testing

```
Test with realistic data:
- 5,000 items
- 10,000 customers
- 50,000 invoices
- 200,000 stock movements

Targets:
- POS barcode scan: < 100ms
- Item text search (3 chars): < 300ms
- Invoice save: < 800ms
- Customer list (page 1, 20 rows): < 200ms
- Monthly sales report: < 3 seconds
- Daily closing report: < 1 second
- PDF generation (50-page report): < 8 seconds
- App startup (cold): < 10 seconds
- App startup (warm): < 4 seconds
```

## 31.5 Regression Checklist (Before Each Release)

```
Financial accuracy:
□ Invoice totals match sum of lines
□ Customer balance is consistent across all reports
□ Supplier balance is consistent across all reports
□ Treasury balance matches all cash movements
□ Stock level matches sum of all movements

Data integrity:
□ No orphaned invoice_lines
□ No negative stock for items with allow_negative=false
□ Shift totals match invoice totals for that shift
□ Audit log created for all financial operations
```

---

# 32. BUILD, PACKAGE & DISTRIBUTION

## 32.1 Build Process

```bash
# Development
npm run dev  # Runs Express (port 5000) + Vite HMR (port 5173) + Electron

# Production build
npm run build:client  # Vite build → client/dist/
npm run build:electron  # electron-builder → dist/

# Output files:
# dist/ElHegazi Retailer-POS-Setup-1.0.0.exe  — Windows installer
# dist/ElHegazi Retailer-POS-1.0.0.AppImage  — Linux portable
```

## 32.2 Windows Installer (NSIS)

```nsh
; electron/installer.nsh
; Custom NSIS script

; During installation:
; 1. Stop any running MongoDB
; 2. Install app files
; 3. Verify Node.js 20+ is installed (no MongoDB needed)
; 4. Create data directory
; 5. Register Windows service for MongoDB (optional)
; 6. Create desktop + Start menu shortcuts
; 7. Register app for "Programs and Features"

; During uninstallation:
; 1. Ask: "هل تريد حذف قاعدة البيانات؟" (Yes/No)
; 2. If No: keep data folder
; 3. Stop MongoDB service
; 4. Remove app files
```

## 32.3 SQLite Bundling (Zero Effort)

```
SQLite requires NO bundling — better-sqlite3 is a Node.js package.
It compiles a small native addon (~2MB) that is included in node_modules.
electron-builder packages it automatically with the app.

No external binary needed.
No separate process.
No user installation step.
Installer size is ~40-60MB smaller than MongoDB approach.

The entire database is the single elhegazi.db file created on first run.
```

## 32.4 Code Signing (Windows)

```
For trusted Windows installer (no "Unknown Publisher" warning):
1. Purchase code signing certificate (EV or OV) from DigiCert, Sectigo, etc.
2. Sign the .exe with signtool.exe
3. Configure in electron-builder.yml:
   win:
     certificateFile: cert.pfx
     certificatePassword: ${CSC_KEY_PASSWORD}
```

## 32.5 Update Channel Strategy

```
Distribution:
- Production channel: stable
- Testing channel: beta (for trusted branches to test before release)
- Update server: simple Express app serving latest.yml + installer file

Update flow:
1. New version built + signed
2. Uploaded to update server
3. App checks update server every 6 hours
4. Shows update notification to admin
5. Admin triggers update → downloads + installs on next app restart
6. Data is preserved (update only replaces app code)
```

---

# 33. FUTURE ROADMAP (V2 FEATURES)

## 33.1 V2 — Cloud + Multi-Branch

```
Architecture change: Add optional cloud sync

Each branch keeps local database (offline-first)
But adds sync layer to cloud MongoDB Atlas:
- Nightly sync of transactions to cloud
- Owner can see all branches in web dashboard
- Cross-branch reports
- Remote inventory visibility

Implementation: MongoDB Change Streams + conflict resolution
```

## 33.2 V2 — WhatsApp Integration

```
Send invoices via WhatsApp:
- After sale → "إرسال للعميل عبر واتساب" button
- Uses WhatsApp Business API (Green API / Meta official)
- Sends receipt image or PDF
- Auto-reminders for due installments/cheques
```

## 33.3 V2 — Employee Attendance & Payroll

```
Fingerprint / QR code clock-in/clock-out
Attendance reports
Salary calculation based on attendance
Overtime tracking
Leave management
```

## 33.4 V2 — Customer Loyalty Program

```
Points earned per purchase (configurable: 1 point per X SAR)
Points redemption at POS
Loyalty tiers (Silver/Gold/Platinum)
Birthday discount automation
```

## 33.5 V2 — E-Commerce Integration

```
Sync items + stock to WooCommerce or Shopify
Orders from online store appear in POS
Stock deducted from both channels
Customer unified across online/offline
```

## 33.6 V2 — Accounting Module (Full)

```
Journal entries
Chart of accounts
Trial balance
Balance sheet
Cash flow statement
Linked to all transactions (auto-journal entries)
```

## 33.7 V2 — Customer Display (Second Screen)

```
Show items being scanned on a second monitor facing customer
Total displayed clearly
Payment confirmation
Thank you screen
Advertisement/promotions between sales
```

## 33.8 V2 — Kitchen Display (For Cafes/Restaurants)

```
If used in food service:
Order items displayed on kitchen monitor
Category-based routing (drinks → bar screen, food → kitchen screen)
Order status: received → preparing → ready
```

## 33.9 V2 — Advanced Analytics

```
Sales forecasting (ML-based)
Seasonal trends detection
Customer lifetime value (CLV)
ABC analysis (A = high value, B = medium, C = low)
Reorder point suggestions based on sales velocity
```

---

# 34. ENVIRONMENT VARIABLES REFERENCE

## 34.1 Server (.env)

```bash
# Application
NODE_ENV=production              # development | production
PORT=5000                        # Express port
HOST=127.0.0.1                   # Bind host (127.0.0.1 = local only, 0.0.0.0 = LAN)

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/elhegazi
MONGODB_DB_NAME=elhegazi

# Authentication
JWT_SECRET=your-random-64-char-secret-here
JWT_EXPIRES_IN=8h

# Storage
APP_DATA_PATH=./data             # Base path for uploads + logs
UPLOADS_PATH=./data/uploads
LOGS_PATH=./data/logs

# Activation Server
ACTIVATION_SERVER_URL=https://activate.elhegazi.com

# Development only
SEED_DB=false
LOG_LEVEL=info                   # error | warn | info | debug
```

## 34.2 Client (.env)

```bash
VITE_API_URL=http://127.0.0.1:5000
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=production
```

## 34.3 Activation Server (.env)

```bash
PORT=3001
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/elhegazi-licenses
JWT_SECRET=activation-server-secret
ADMIN_KEY=your-admin-key-to-generate-licenses
```

## 34.4 Electron (electron-store, encrypted)

Keys stored by `electron-store` (encrypted on disk):
```
license_key          — Activated license key
license_cache        — { valid, timestamp, expires_at }
first_run_date       — Unix timestamp of first app launch
db_path              — Custom MongoDB data path (if changed)
lan_mode             — Boolean
lan_port             — Number
```

---



---

# 36. SHIFT MANAGEMENT & CASH RECONCILIATION (X/Z Reports)

> *Gap Analysis V1 — GAP 1 (Critical)*

## 36.1 Overview

Every professional POS system tracks cash using a Shift lifecycle:

```
Cashier Opens Shift → enters starting cash amount
         ↓
Cashier runs sales, returns, pay-ins, pay-outs
         ↓
X-Report: mid-shift snapshot (can run any time, does NOT reset counters)
         ↓
Z-Report: end-of-shift final close (resets counters, prints summary)
         ↓
Manager reviews: Expected cash vs Actual counted cash
         ↓
Discrepancy flagged if mismatch exceeds threshold
```

## 36.2 Updated `shifts` Collection (Collection #29)

```javascript
{
  _id: ObjectId,
  shift_number: String,           // "SHIFT-2026-0001"
  cashier_id: ObjectId,           // ref: users
  opened_at: Date,
  closed_at: Date,                // null if open
  status: String,                 // 'open' | 'closed'

  opening_cash: Number,           // Cash placed in drawer at start

  // Totals accumulated during shift
  sales_total: Number,
  returns_total: Number,
  cash_sales: Number,
  credit_sales: Number,
  discount_total: Number,
  voids_count: Number,
  transactions_count: Number,

  // Cash drawer movements (non-sale)
  pay_ins:  [{ amount: Number, reason: String, at: Date }],
  pay_outs: [{ amount: Number, reason: String, at: Date }],

  // End-of-shift reconciliation
  expected_cash: Number,          // System calculated: opening + cash_sales + pay_ins - pay_outs - returns_cash
  declared_cash: Number,          // What cashier actually counted
  discrepancy: Number,            // declared - expected (negative = short, positive = over)
  discrepancy_note: String,

  z_report_printed: Boolean,
  z_report_printed_at: Date,

  created_at: Date,
  updated_at: Date
}
```

## 36.3 API Endpoints

```
POST   /api/shifts/open             → Open new shift (enter starting cash)
GET    /api/shifts/current          → Get current open shift for logged-in cashier
GET    /api/shifts/:id/x-report     → Generate X-report (snapshot, no reset)
POST   /api/shifts/:id/pay-in       → Add cash to drawer (with reason)
POST   /api/shifts/:id/pay-out      → Remove cash from drawer (with reason)
POST   /api/shifts/:id/close        → Close shift (declare cash, print Z-report)
GET    /api/shifts                  → Shift history (manager/admin)
GET    /api/shifts/:id              → Single shift detail
```

## 36.4 UI Components

```
client/src/pages/pos/
├── ShiftOpenModal.jsx       — Forces cashier to enter opening cash before accessing POS
├── ShiftStatusBar.jsx       — Small bar at top of POS: Shift #, time open, running total
├── PayInOutModal.jsx        — Modal for cash-in / cash-out with reason field
└── ShiftCloseModal.jsx      — Step-by-step close: count cash → compare → print Z-report

client/src/pages/reports/
└── ShiftHistoryPage.jsx     — Manager view of all shifts with filters
```

## 36.5 X-Report Format (Mid-Shift Snapshot)

```
══════════════════════════════════
      تقرير الوردية الجزئي (X)
══════════════════════════════════
كاشير:        أحمد محمد
بداية الوردية: 09:00  |  الآن: 14:32
──────────────────────────────────
رصيد افتتاحي:        500.00
مبيعات نقدية:      2,340.00
مبيعات آجلة:         800.00
مرتجعات:            (120.00)
إضافة نقدية:         200.00
سحب نقدية:         (300.00)
──────────────────────────────────
الرصيد المتوقع:    2,620.00
──────────────────────────────────
عدد الفواتير: 23  |  ملغاة: 1
══════════════════════════════════
* هذا التقرير لا يُغلق الوردية
══════════════════════════════════
```

## 36.6 Z-Report Format (End-of-Shift — Final)

```
══════════════════════════════════
      تقرير إغلاق الوردية (Z)
══════════════════════════════════
رقم الوردية: SHIFT-2026-00142
كاشير:        أحمد محمد
الفترة: 09:00 — 17:15 (8 ساعات 15 د)
──────────────────────────────────
رصيد افتتاحي:        500.00
مبيعات نقدية:      4,200.00
مبيعات آجلة:       1,100.00
مرتجعات نقدية:      (250.00)
إضافات نقدية:        300.00
سحوبات نقدية:       (500.00)
──────────────────────────────────
الرصيد المتوقع:    4,350.00
الرصيد المُعلَن:   4,340.00
الفرق:              (10.00) ↓ عجز
──────────────────────────────────
عدد الفواتير: 47  |  ملغاة: 2
إجمالي الخصومات:     180.00
══════════════════════════════════
  هذا التقرير يُغلق الوردية نهائياً
══════════════════════════════════
```

## 36.7 Role Rules for Shift (Add to Chapter 1.3)

| Role | Shift Permissions |
|------|------------------|
| cashier | Can: open shift, run POS, print X-report, close own shift |
| cashier | Cannot: view other cashiers' shifts, override discrepancy |
| branch_manager | Can: view all shifts, force-close shifts, print any Z-report |

---

# 37. PROMOTIONS & DISCOUNT RULES ENGINE

> *Gap Analysis V1 — GAP 3 (Critical)*

## 37.1 Overview

The current plan has manual discounts on invoice lines. This chapter defines **automatic promotion rules** that fire without cashier input.

```
Types of promotions to support:
✓ Percentage discount on specific item or category (e.g., 10% off all drinks)
✓ Fixed amount off total invoice (e.g., 20 SAR off orders above 200 SAR)
✓ Buy X get Y free (e.g., buy 2 get 1 free)
✓ Quantity break pricing (e.g., 1-9 units = 10 SAR, 10+ units = 8 SAR)
✓ Time-based (e.g., happy hour: 20% off between 14:00–16:00)
✓ Customer group discount (e.g., VIP customers always get 5% off)
✓ Minimum invoice total to unlock discount
```

## 37.2 New Collection: `promotions` (Collection #31)

```javascript
{
  _id: ObjectId,
  name_ar: String,
  name_en: String,
  type: String,           // 'percentage' | 'fixed' | 'buy_x_get_y' | 'quantity_break'
  is_active: Boolean,
  priority: Number,       // Higher = applied first. Only one promotion applies per line.

  // Conditions (what triggers this promotion)
  condition: {
    applies_to: String,   // 'all' | 'item' | 'category' | 'customer_group'
    item_ids: [ObjectId],
    category_ids: [ObjectId],
    customer_groups: [String],
    min_invoice_total: Number,
    min_quantity: Number,
    time_start: String,   // "14:00" (HH:mm)
    time_end: String,     // "16:00"
    days_of_week: [Number], // 0=Sun, 6=Sat
    date_start: Date,
    date_end: Date,
  },

  // Reward (what the promotion gives)
  reward: {
    discount_percentage: Number,
    discount_fixed: Number,
    free_item_id: ObjectId,   // for buy X get Y
    free_quantity: Number,
    quantity_breaks: [{ from: Number, price: Number }],
  },

  created_by: ObjectId,
  created_at: Date,
}
```

## 37.3 POS Integration

```javascript
// After addLine() in Zustand POS store:
// Call POST /api/promotions/evaluate with current cart
// Server returns: { applied: [{ promotion_id, line_index, discount_amount, label_ar }] }
// UI shows promotion label in green under the line: "خصم 10% - عرض المشروبات"
```

## 37.4 API Endpoints

```
POST  /api/promotions/evaluate    → Pass cart lines, returns applicable promotions
GET   /api/promotions             → List all promotions (admin)
POST  /api/promotions             → Create promotion
PUT   /api/promotions/:id         → Update promotion
PATCH /api/promotions/:id/toggle  → Activate / deactivate
DELETE /api/promotions/:id        → Soft delete
```

---

# 38. CUSTOMER LOYALTY POINTS SYSTEM

> *Gap Analysis V1 — GAP 4 (Important — moved from V2 roadmap to V1)*

## 38.1 Overview

```
Customer earns points per purchase → redeems points for discount at checkout
```

## 38.2 Add to `customers` Collection

```javascript
loyalty_points: { type: Number, default: 0 },
loyalty_tier: { type: String, enum: ['bronze', 'silver', 'gold'], default: 'bronze' },
total_spent: { type: Number, default: 0 },  // Lifetime spend for tier calculation
```

## 38.3 New Collection: `loyalty_transactions` (Collection #30)

```javascript
{
  _id: ObjectId,
  customer_id: ObjectId,
  invoice_id: ObjectId,       // null if manual adjustment
  type: String,               // 'earn' | 'redeem' | 'expire' | 'adjustment'
  points: Number,             // positive = earned, negative = redeemed/expired
  balance_after: Number,
  note: String,
  created_by: ObjectId,
  created_at: Date,
}
```

## 38.4 POS Integration

```
When customer is selected at POS:
→ Show loyalty balance: "رصيد النقاط: 450 نقطة (تساوي 45 ر.س)"
→ Checkbox: "استخدام النقاط كخصم" (Use points as discount)
→ When checked: apply equivalent discount, deduct points on invoice save
→ Points earned from this purchase shown on receipt
```

## 38.5 API Endpoints

```
GET   /api/customers/:id/loyalty          → Balance + tier + history
POST  /api/loyalty/redeem                 → Redeem points on invoice
POST  /api/loyalty/adjust                 → Manual admin adjustment
GET   /api/loyalty/report                 → Loyalty program summary report
```


---

# APPENDIX A — DATABASE MIGRATION STRATEGY

```javascript
// server/src/config/database.js — Migration runner

const CURRENT_DB_VERSION = 1;

async function runMigrations(currentVersion) {
  const migrations = {
    1: require('./migrations/001_initial_indexes'),
    2: require('./migrations/002_add_price_groups'),   // Future
  };
  
  for (let v = currentVersion + 1; v <= CURRENT_DB_VERSION; v++) {
    if (migrations[v]) {
      await migrations[v].up();
      await Settings.updateOne({}, { db_version: v });
      logger.info(`Migration ${v} applied`);
    }
  }
}

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Run migrations on every startup
  const settings = await Settings.findOne({});
  const currentVersion = settings?.db_version || 0;
  if (currentVersion < CURRENT_DB_VERSION) {
    await runMigrations(currentVersion);
  }
}
```
# CHAPTER 35 — SMART HELP SYSTEM & GUIDED ONBOARDING

> **Where to insert this chapter in the main blueprint:**
> Place it **after Chapter 34 (Environment Variables Reference)** and **before Appendix A**.
> Also add `| 35 | Smart Help System & Guided Onboarding | ~9 |` to the Table of Contents after Chapter 34.

---

## 35.1 Overview & Design Goals

The Smart Help System provides **zero-friction, context-aware guidance** to new users while staying completely out of the way for experienced ones. It operates in two layers:

| Layer | What It Does |
|-------|-------------|
| **Page Tour (Onboarding Modal)** | Step-by-step guided walkthrough shown automatically the first time a user visits any page, explaining what the page does and how to use its key features |
| **Smart Tooltips** | Inline `(?)` icons and hover/tap tooltips on individual fields, buttons, and sections — shown at any time, with collision-avoidance to prevent overlap |

**Core principles:**
- The system tracks first-visit state **per user, per page** — not just per device
- Every tour can be **stopped immediately** via a single click and never shown again for that user on that page
- Tooltips are **collision-aware**: they never render off-screen or overlap other open tooltips
- The entire system is **Arabic-first RTL** with full English fallback
- Help content is **centrally defined** in one config file — easy to maintain, translate, or extend
- Works identically in **Electron (desktop)** and **LAN browser** modes

---

## 35.2 Database Schema — `user_help_state` Collection

Tracks which pages each user has already seen the onboarding tour for, and their global help preferences.

```javascript
// Collection: user_help_state
{
  _id: ObjectId,
  user_id: ObjectId,            // ref: users._id
  
  // Per-page tour completion flags
  // Key = page_key (string), Value = true when tour dismissed
  toured_pages: {
    type: Map,
    of: Boolean,
    default: {}
  },
  // Example: { "pos_sales": true, "items_list": true, "reports_daily": false }

  // Global preference: user permanently disabled all tours
  tours_disabled_globally: { type: Boolean, default: false },

  // Global preference: user permanently disabled all tooltips
  tooltips_disabled_globally: { type: Boolean, default: false },

  // Timestamps
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}

// Indexes
db.user_help_state.createIndex({ user_id: 1 }, { unique: true });
```

**API Endpoints for Help State:**

```
GET    /api/help/state                     → { toured_pages, tours_disabled_globally, tooltips_disabled_globally }
PATCH  /api/help/state/tour/:page_key      → Mark one page tour as completed (body: { seen: true })
PATCH  /api/help/state/disable-tours       → Set tours_disabled_globally = true
PATCH  /api/help/state/disable-tooltips   → Set tooltips_disabled_globally = true
PATCH  /api/help/state/reset              → Admin only — reset all help state for user_id (for testing)
```

---

## 35.3 Help Content Configuration — Central Definition

All tour steps and tooltip texts live in **one config file** per language. Never hardcoded in components.

### File: `client/src/help/helpContent.js`

```javascript
// helpContent.js — Single source of truth for all help text
// Each page_key maps to: { title, steps[], tooltips{} }

export const helpContent = {

  // ─────────────────────────────────────────────────────────
  // POS — Sales Invoice Screen
  // ─────────────────────────────────────────────────────────
  pos_sales: {
    title_ar: 'مرحباً بك في شاشة نقطة البيع',
    title_en: 'Welcome to the POS Screen',
    steps: [
      {
        id: 'pos_search',
        target: '[data-help="pos-search-bar"]',
        title_ar: 'البحث عن المنتج أو مسح الباركود',
        title_en: 'Search or Scan a Product',
        body_ar: 'اكتب اسم المنتج أو الباركود هنا، أو استخدم الماسح الضوئي مباشرةً. سيُضاف المنتج تلقائياً إلى الفاتورة.',
        body_en: 'Type the product name or barcode here, or use your scanner. The item is added to the invoice automatically.',
        placement: 'bottom',
      },
      {
        id: 'pos_grid',
        target: '[data-help="pos-item-grid"]',
        title_ar: 'شبكة المنتجات السريعة',
        title_en: 'Quick Item Grid',
        body_ar: 'انقر على أي منتج لإضافته مباشرةً. يمكنك التصفية حسب الفئة من الأعلى.',
        body_en: 'Tap any product to add it directly. Filter by category using the tabs above.',
        placement: 'left',
      },
      {
        id: 'pos_lines',
        target: '[data-help="pos-invoice-lines"]',
        title_ar: 'بنود الفاتورة',
        title_en: 'Invoice Lines',
        body_ar: 'هنا تظهر المنتجات المضافة. يمكنك تعديل الكمية أو الخصم أو حذف أي بند بنقرة واحدة.',
        body_en: 'Added products appear here. You can edit quantity, discount, or delete any line.',
        placement: 'right',
      },
      {
        id: 'pos_payment',
        target: '[data-help="pos-payment-panel"]',
        title_ar: 'لوحة الدفع',
        title_en: 'Payment Panel',
        body_ar: 'اختر طريقة الدفع (نقداً / آجل) وأدخل المبلغ المستلم. سيُحسب المتبقي تلقائياً.',
        body_en: 'Select payment method (Cash / Credit) and enter the received amount. Change is calculated automatically.',
        placement: 'top',
      },
      {
        id: 'pos_save',
        target: '[data-help="pos-save-btn"]',
        title_ar: 'حفظ وطباعة الفاتورة',
        title_en: 'Save & Print Invoice',
        body_ar: 'بعد إدخال الدفع، اضغط هنا لحفظ الفاتورة وطباعة الإيصال. مفتاح الاختصار: F12',
        body_en: 'After entering payment, press here to save and print. Shortcut: F12',
        placement: 'top',
      },
    ],
    tooltips: {
      discount_field: {
        ar: 'أدخل قيمة الخصم كنسبة مئوية أو مبلغ ثابت. الخصم لا يمكن أن يتجاوز إجمالي السطر.',
        en: 'Enter discount as percentage or fixed amount. Cannot exceed the line total.',
      },
      hold_btn: {
        ar: 'تعليق الفاتورة يحفظها مؤقتاً حتى تتمكن من خدمة عميل آخر والعودة إليها لاحقاً.',
        en: 'Hold invoice saves it temporarily so you can serve another customer and return to it.',
      },
      customer_selector: {
        ar: 'اختر العميل لربط الفاتورة بحسابه. مطلوب للمبيعات الآجلة.',
        en: 'Select customer to link the invoice to their account. Required for credit sales.',
      },
    },
  },

  // ─────────────────────────────────────────────────────────
  // Items & Prices
  // ─────────────────────────────────────────────────────────
  items_list: {
    title_ar: 'صفحة الأصناف والأسعار',
    title_en: 'Items & Prices',
    steps: [
      {
        id: 'items_search',
        target: '[data-help="items-search"]',
        title_ar: 'البحث والتصفية',
        title_en: 'Search & Filter',
        body_ar: 'ابحث عن أي صنف بالاسم أو الباركود. استخدم الفئة لتصفية النتائج.',
        body_en: 'Search any item by name or barcode. Use the category filter to narrow results.',
        placement: 'bottom',
      },
      {
        id: 'items_add',
        target: '[data-help="items-add-btn"]',
        title_ar: 'إضافة صنف جديد',
        title_en: 'Add New Item',
        body_ar: 'اضغط هنا لفتح نموذج إضافة صنف جديد. يمكنك إدخال أسعار متعددة لكل صنف.',
        body_en: 'Click here to open the new item form. You can set multiple price levels per item.',
        placement: 'bottom',
      },
      {
        id: 'items_table',
        target: '[data-help="items-table"]',
        title_ar: 'جدول الأصناف',
        title_en: 'Items Table',
        body_ar: 'انقر على أي صنف لتعديله. يمكن ترتيب العمود بالنقر على رأس الجدول.',
        body_en: 'Click any item to edit it. Click column headers to sort.',
        placement: 'top',
      },
    ],
    tooltips: {
      barcode_field: {
        ar: 'أدخل الباركود يدوياً أو اضغط زر المسح لاستخدام الماسح. تركه فارغاً سيُنشئ باركود تلقائياً.',
        en: 'Enter barcode manually or press the scan button. Leave empty to auto-generate.',
      },
      price_group: {
        ar: 'مجموعات الأسعار تتيح لك تحديد سعر مختلف لكل نوع عميل (جملة / تجزئة / خاص).',
        en: 'Price groups let you set a different price per customer type (wholesale / retail / special).',
      },
      min_stock: {
        ar: 'عند وصول الكمية إلى هذا الحد ستظهر تنبيه نفاد المخزون في صفحة الإشعارات.',
        en: 'When stock reaches this level, a low-stock alert appears on the Notifications page.',
      },
    },
  },

  // ─────────────────────────────────────────────────────────
  // Purchases
  // ─────────────────────────────────────────────────────────
  purchases_list: {
    title_ar: 'صفحة المشتريات',
    title_en: 'Purchases',
    steps: [
      {
        id: 'purchases_new',
        target: '[data-help="purchases-new-btn"]',
        title_ar: 'فاتورة شراء جديدة',
        title_en: 'New Purchase Invoice',
        body_ar: 'اضغط هنا لإدخال فاتورة شراء جديدة من المورد. سيُحدَّث المخزون تلقائياً عند الحفظ.',
        body_en: 'Press here to enter a new purchase invoice. Stock is updated automatically on save.',
        placement: 'bottom',
      },
      {
        id: 'purchases_supplier',
        target: '[data-help="purchases-supplier"]',
        title_ar: 'اختيار المورد',
        title_en: 'Select Supplier',
        body_ar: 'اربط الفاتورة بالمورد لتتبع ذمم الموردين ومديونياتك بدقة.',
        body_en: 'Link the invoice to a supplier to accurately track supplier balances.',
        placement: 'right',
      },
    ],
    tooltips: {
      cost_price: {
        ar: 'سعر التكلفة المُدخَل هنا سيُحدِّث متوسط التكلفة للصنف في المخزون (WACC).',
        en: 'The cost price entered here updates the weighted average cost of the item in stock.',
      },
    },
  },

  // ─────────────────────────────────────────────────────────
  // Reports
  // ─────────────────────────────────────────────────────────
  reports_dashboard: {
    title_ar: 'لوحة التقارير',
    title_en: 'Reports Dashboard',
    steps: [
      {
        id: 'reports_date',
        target: '[data-help="reports-date-range"]',
        title_ar: 'تحديد الفترة الزمنية',
        title_en: 'Set Date Range',
        body_ar: 'اختر تاريخ البداية والنهاية لعرض البيانات الخاصة بتلك الفترة. جميع التقارير تتحدث فور تغيير التاريخ.',
        body_en: 'Select start and end date. All reports update instantly when the date changes.',
        placement: 'bottom',
      },
      {
        id: 'reports_export',
        target: '[data-help="reports-export-btn"]',
        title_ar: 'تصدير البيانات',
        title_en: 'Export Data',
        body_ar: 'يمكنك تصدير أي تقرير بصيغة Excel أو PDF بنقرة واحدة.',
        body_en: 'Export any report as Excel or PDF with one click.',
        placement: 'bottom',
      },
    ],
    tooltips: {
      gross_profit: {
        ar: 'إجمالي الربح = الإيرادات − تكلفة البضاعة المباعة (COGS). لا يشمل المصروفات التشغيلية.',
        en: 'Gross profit = Revenue − Cost of Goods Sold (COGS). Does not include operating expenses.',
      },
    },
  },

  // ─────────────────────────────────────────────────────────
  // Settings
  // ─────────────────────────────────────────────────────────
  settings_main: {
    title_ar: 'صفحة الإعدادات',
    title_en: 'Settings',
    steps: [
      {
        id: 'settings_tabs',
        target: '[data-help="settings-tabs"]',
        title_ar: 'أقسام الإعدادات',
        title_en: 'Settings Sections',
        body_ar: 'الإعدادات مُقسَّمة إلى تبويبات: الشركة، الطابعة، المخزون، الأمان والنسخ الاحتياطي.',
        body_en: 'Settings are organized into tabs: Company, Printer, Stock, Security, and Backup.',
        placement: 'bottom',
      },
    ],
    tooltips: {
      invoice_prefix: {
        ar: 'بادئة رقم الفاتورة تظهر قبل الرقم التسلسلي. مثال: "INV-" ينتج "INV-000001".',
        en: 'Invoice prefix appears before the sequence number. Example: "INV-" produces "INV-000001".',
      },
      tax_rate: {
        ar: 'نسبة الضريبة المضافة على المبيعات. اتركها صفراً إذا لم تكن مسجلاً في ضريبة القيمة المضافة.',
        en: 'VAT rate applied to sales. Leave at zero if not VAT-registered.',
      },
    },
  },

  // ─────────────────────────────────────────────────────────
  // Users & Permissions
  // ─────────────────────────────────────────────────────────
  users_list: {
    title_ar: 'صفحة المستخدمين والصلاحيات',
    title_en: 'Users & Permissions',
    steps: [
      {
        id: 'users_roles',
        target: '[data-help="users-role-badge"]',
        title_ar: 'أدوار المستخدمين',
        title_en: 'User Roles',
        body_ar: 'كل مستخدم له دور يحدد ما يراه ويستطيع فعله: مدير، محاسب، كاشير، أو مشاهد.',
        body_en: 'Each user has a role that defines what they see and can do: Admin, Accountant, Cashier, or Viewer.',
        placement: 'right',
      },
    ],
    tooltips: {
      force_logout: {
        ar: 'إنهاء جميع جلسات هذا المستخدم الحالية على الفور. مفيد عند تغيير كلمة المرور أو إلغاء الوصول.',
        en: 'Immediately terminates all active sessions for this user. Useful after password change or access revocation.',
      },
    },
  },

  // Add more pages following the same pattern...
  // stock_management, payments, expenses, customers, suppliers, etc.
};
```

---

## 35.4 Frontend — Zustand Help Store

```javascript
// client/src/store/helpStore.js
import { create } from 'zustand';
import axios from '../lib/axios';

export const useHelpStore = create((set, get) => ({
  // Loaded from API on login
  touredPages: {},              // { page_key: true/false }
  toursDisabledGlobally: false,
  tooltipsDisabledGlobally: false,
  isLoaded: false,

  // Active tour state
  activeTourPageKey: null,
  activeTourStepIndex: 0,
  isTourVisible: false,

  // Active tooltip state (only one at a time)
  activeTooltipKey: null,

  // ─── Load from API after login ───────────────────────────
  loadHelpState: async () => {
    try {
      const { data } = await axios.get('/api/help/state');
      set({
        touredPages: data.toured_pages || {},
        toursDisabledGlobally: data.tours_disabled_globally,
        tooltipsDisabledGlobally: data.tooltips_disabled_globally,
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true }); // Fail silently — help is non-critical
    }
  },

  // ─── Called by each page on mount ────────────────────────
  triggerPageTour: (pageKey) => {
    const { touredPages, toursDisabledGlobally } = get();
    if (toursDisabledGlobally) return;
    if (touredPages[pageKey]) return; // Already seen
    set({
      activeTourPageKey: pageKey,
      activeTourStepIndex: 0,
      isTourVisible: true,
    });
  },

  // ─── Tour navigation ─────────────────────────────────────
  nextTourStep: (totalSteps) => {
    const { activeTourStepIndex } = get();
    if (activeTourStepIndex < totalSteps - 1) {
      set({ activeTourStepIndex: activeTourStepIndex + 1 });
    } else {
      get().completeTour();
    }
  },

  prevTourStep: () => {
    const { activeTourStepIndex } = get();
    if (activeTourStepIndex > 0) {
      set({ activeTourStepIndex: activeTourStepIndex - 1 });
    }
  },

  // ─── Dismiss current tour (mark as seen) ─────────────────
  completeTour: async () => {
    const { activeTourPageKey, touredPages } = get();
    if (!activeTourPageKey) return;

    set({
      isTourVisible: false,
      touredPages: { ...touredPages, [activeTourPageKey]: true },
      activeTourPageKey: null,
      activeTourStepIndex: 0,
    });

    // Persist to API (fire and forget)
    try {
      await axios.patch(`/api/help/state/tour/${activeTourPageKey}`, { seen: true });
    } catch { /* silent */ }
  },

  // ─── "Don't show any tours" global toggle ────────────────
  disableAllTours: async () => {
    set({ isTourVisible: false, toursDisabledGlobally: true });
    try {
      await axios.patch('/api/help/state/disable-tours');
    } catch { /* silent */ }
  },

  // ─── Tooltip control ─────────────────────────────────────
  openTooltip: (key) => set({ activeTooltipKey: key }),
  closeTooltip: () => set({ activeTooltipKey: null }),
}));
```

---

## 35.5 Frontend — Page Tour Hook

Add this hook to any page component. It automatically triggers the tour for new users.

```javascript
// client/src/hooks/usePageTour.js
import { useEffect } from 'react';
import { useHelpStore } from '../store/helpStore';
import { helpContent } from '../help/helpContent';

/**
 * Call this at the top of any page component.
 * @param {string} pageKey  — Must match a key in helpContent.js
 */
export const usePageTour = (pageKey) => {
  const { isLoaded, triggerPageTour } = useHelpStore();

  useEffect(() => {
    // Wait for help state to load from API
    if (!isLoaded) return;
    // Validate page key exists in content config
    if (!helpContent[pageKey]) return;

    // Small delay so the page elements are rendered before we highlight them
    const timer = setTimeout(() => triggerPageTour(pageKey), 600);
    return () => clearTimeout(timer);
  }, [isLoaded, pageKey]);
};

// ── Usage inside any page ─────────────────────────────────
// import { usePageTour } from '../../hooks/usePageTour';
// function POSSalesPage() {
//   usePageTour('pos_sales');
//   return <div>...</div>;
// }
```

---

## 35.6 Frontend — Tour Modal Component (Anti-Overlap, RTL-Aware)

```jsx
// client/src/components/help/PageTour.jsx
import { useEffect, useRef, useState } from 'react';
import { useHelpStore } from '../../store/helpStore';
import { helpContent } from '../../help/helpContent';
import { useTranslation } from 'react-i18next';

const SPOTLIGHT_PADDING = 8;   // px around the target element
const POPUP_WIDTH = 320;       // px
const POPUP_HEIGHT_EST = 200;  // px — estimated, used for placement fallback

export function PageTour() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const isRTL = lang === 'ar';

  const {
    isTourVisible, activeTourPageKey, activeTourStepIndex,
    nextTourStep, prevTourStep, completeTour, disableAllTours,
  } = useHelpStore();

  const [popupStyle, setPopupStyle] = useState({});
  const [spotlightStyle, setSpotlightStyle] = useState({});
  const popupRef = useRef(null);

  const pageConfig = helpContent[activeTourPageKey];
  const steps = pageConfig?.steps ?? [];
  const currentStep = steps[activeTourStepIndex];
  const isLast = activeTourStepIndex === steps.length - 1;

  // ─── Position calculation (collision-aware) ───────────────
  useEffect(() => {
    if (!isTourVisible || !currentStep) return;

    const target = document.querySelector(currentStep.target);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Spotlight
    setSpotlightStyle({
      top: rect.top - SPOTLIGHT_PADDING,
      left: rect.left - SPOTLIGHT_PADDING,
      width: rect.width + SPOTLIGHT_PADDING * 2,
      height: rect.height + SPOTLIGHT_PADDING * 2,
    });

    // Preferred placement from config
    let placement = currentStep.placement ?? 'bottom';

    // ─ Collision detection: flip if not enough room ─
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const spaceRight = vw - rect.right;
    const spaceLeft = rect.left;

    if (placement === 'bottom' && spaceBelow < POPUP_HEIGHT_EST + 20) placement = 'top';
    if (placement === 'top'    && spaceAbove < POPUP_HEIGHT_EST + 20) placement = 'bottom';
    if (placement === 'right'  && spaceRight < POPUP_WIDTH + 20)      placement = 'left';
    if (placement === 'left'   && spaceLeft  < POPUP_WIDTH + 20)      placement = 'right';

    // Flip left/right in RTL mode
    if (isRTL) {
      if (placement === 'right') placement = 'left';
      else if (placement === 'left') placement = 'right';
    }

    // Calculate final popup position
    let style = { width: POPUP_WIDTH, position: 'fixed', zIndex: 9999 };
    const centerX = rect.left + rect.width / 2 - POPUP_WIDTH / 2;
    const centerY = rect.top  + rect.height / 2 - POPUP_HEIGHT_EST / 2;

    switch (placement) {
      case 'bottom':
        style.top  = rect.bottom + SPOTLIGHT_PADDING + 8;
        style.left = Math.max(8, Math.min(centerX, vw - POPUP_WIDTH - 8));
        break;
      case 'top':
        style.bottom = vh - rect.top + SPOTLIGHT_PADDING + 8;
        style.left   = Math.max(8, Math.min(centerX, vw - POPUP_WIDTH - 8));
        break;
      case 'right':
        style.left = rect.right + SPOTLIGHT_PADDING + 8;
        style.top  = Math.max(8, Math.min(centerY, vh - POPUP_HEIGHT_EST - 8));
        break;
      case 'left':
        style.right = vw - rect.left + SPOTLIGHT_PADDING + 8;
        style.top   = Math.max(8, Math.min(centerY, vh - POPUP_HEIGHT_EST - 8));
        break;
      default:
        style.top  = rect.bottom + 8;
        style.left = Math.max(8, Math.min(centerX, vw - POPUP_WIDTH - 8));
    }

    setPopupStyle(style);

    // Scroll target into view if offscreen
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  }, [isTourVisible, currentStep, activeTourStepIndex, isRTL]);

  if (!isTourVisible || !pageConfig || !currentStep) return null;

  return (
    <>
      {/* ── Dark backdrop with spotlight cutout ── */}
      <div
        className="fixed inset-0 z-[9990]"
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={completeTour}
      />

      {/* Spotlight — transparent rectangle over target */}
      <div
        className="fixed z-[9991] rounded-lg pointer-events-none"
        style={{
          ...spotlightStyle,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          border: '2px solid rgba(59,130,246,0.7)',
        }}
      />

      {/* ── Tour popup ── */}
      <div
        ref={popupRef}
        dir={isRTL ? 'rtl' : 'ltr'}
        className="z-[9999] bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-5 border border-blue-200"
        style={popupStyle}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-snug">
            {currentStep[`title_${lang}`]}
          </h3>
          {/* Close (X) — on left in RTL, right in LTR */}
          <button
            onClick={completeTour}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg leading-none ml-2 rtl:ml-0 rtl:mr-2 flex-shrink-0"
            aria-label="إغلاق / Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4">
          {currentStep[`body_${lang}`]}
        </p>

        {/* Step indicator dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === activeTourStepIndex ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={disableAllTours}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
          >
            {lang === 'ar' ? 'لا تعرض هذه الشرح مرة أخرى' : 'Don\'t show tours again'}
          </button>

          <div className="flex gap-2">
            {activeTourStepIndex > 0 && (
              <button
                onClick={prevTourStep}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {lang === 'ar' ? '← السابق' : '← Back'}
              </button>
            )}
            <button
              onClick={() => nextTourStep(steps.length)}
              className="px-4 py-1.5 text-sm rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium"
            >
              {isLast
                ? (lang === 'ar' ? 'انتهى ✓' : 'Done ✓')
                : (lang === 'ar' ? 'التالي →' : 'Next →')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
```

---

## 35.7 Frontend — Smart Tooltip Component (Collision-Aware)

```jsx
// client/src/components/help/SmartTooltip.jsx
import { useRef, useState, useEffect } from 'react';
import { useHelpStore } from '../../store/helpStore';
import { helpContent } from '../../help/helpContent';
import { useTranslation } from 'react-i18next';

/**
 * Usage:
 * <SmartTooltip pageKey="pos_sales" tooltipKey="discount_field" />
 *
 * Renders a (?) icon. On click/hover, shows the tooltip text.
 * Only one tooltip is open at a time globally.
 * Collision-aware: flips direction if too close to viewport edge.
 */
export function SmartTooltip({ pageKey, tooltipKey, className = '' }) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const isRTL = lang === 'ar';

  const { tooltipsDisabledGlobally, activeTooltipKey, openTooltip, closeTooltip } = useHelpStore();
  const iconRef = useRef(null);
  const [tooltipStyle, setTooltipStyle] = useState({});

  const globalKey = `${pageKey}__${tooltipKey}`;
  const isOpen = activeTooltipKey === globalKey;
  const text = helpContent[pageKey]?.tooltips?.[tooltipKey]?.[lang];

  useEffect(() => {
    if (!isOpen || !iconRef.current) return;

    const rect = iconRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const TIP_W = 280;

    let left = isRTL
      ? rect.left - TIP_W + rect.width
      : rect.left;

    // Clamp to viewport
    left = Math.max(8, Math.min(left, vw - TIP_W - 8));

    setTooltipStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left,
      width: TIP_W,
      zIndex: 9950,
    });
  }, [isOpen, isRTL]);

  if (tooltipsDisabledGlobally || !text) return null;

  return (
    <span className={`inline-flex items-center ${className}`}>
      <button
        ref={iconRef}
        onClick={() => isOpen ? closeTooltip() : openTooltip(globalKey)}
        onMouseLeave={() => closeTooltip()}
        className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-[10px] font-bold leading-none flex items-center justify-center hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="مساعدة / Help"
      >
        ?
      </button>

      {isOpen && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 leading-relaxed shadow-xl"
          style={tooltipStyle}
          onClick={closeTooltip}
        >
          {text}
          <div className="absolute -top-1.5 w-3 h-3 bg-gray-900 rotate-45 rounded-sm" />
        </div>
      )}
    </span>
  );
}
```

---

## 35.8 Frontend — Global Tour Renderer Placement

Mount `<PageTour />` **once**, at the app shell level. It reads from the global store and renders wherever needed.

```jsx
// client/src/components/layout/AppShell.jsx  (excerpt — add these two lines)

import { PageTour } from '../help/PageTour';

function AppShell() {
  return (
    <>
      {/* Existing layout... */}
      <DesktopLayout />

      {/* ─ Global Smart Help Layer ─ Always mounted, renders only when active ─ */}
      <PageTour />
    </>
  );
}
```

---

## 35.9 Backend — API Routes

```javascript
// server/src/routes/help.routes.js

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const UserHelpState = require('../models/UserHelpState');

// GET /api/help/state
router.get('/state', authenticate, async (req, res) => {
  let state = await UserHelpState.findOne({ user_id: req.user._id });
  if (!state) {
    state = await UserHelpState.create({ user_id: req.user._id });
  }
  res.json({
    toured_pages: Object.fromEntries(state.toured_pages),
    tours_disabled_globally: state.tours_disabled_globally,
    tooltips_disabled_globally: state.tooltips_disabled_globally,
  });
});

// PATCH /api/help/state/tour/:page_key
router.patch('/state/tour/:page_key', authenticate, async (req, res) => {
  const { page_key } = req.params;
  await UserHelpState.findOneAndUpdate(
    { user_id: req.user._id },
    { $set: { [`toured_pages.${page_key}`]: true, updated_at: new Date() } },
    { upsert: true }
  );
  res.json({ ok: true });
});

// PATCH /api/help/state/disable-tours
router.patch('/state/disable-tours', authenticate, async (req, res) => {
  await UserHelpState.findOneAndUpdate(
    { user_id: req.user._id },
    { $set: { tours_disabled_globally: true, updated_at: new Date() } },
    { upsert: true }
  );
  res.json({ ok: true });
});

// PATCH /api/help/state/disable-tooltips
router.patch('/state/disable-tooltips', authenticate, async (req, res) => {
  await UserHelpState.findOneAndUpdate(
    { user_id: req.user._id },
    { $set: { tooltips_disabled_globally: true, updated_at: new Date() } },
    { upsert: true }
  );
  res.json({ ok: true });
});

// PATCH /api/help/state/reset  (Admin only — dev/testing)
router.patch('/state/reset', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  await UserHelpState.findOneAndUpdate(
    { user_id: req.body.user_id || req.user._id },
    { $set: { toured_pages: new Map(), tours_disabled_globally: false, tooltips_disabled_globally: false } }
  );
  res.json({ ok: true });
});

module.exports = router;
```

```javascript
// server/src/models/UserHelpState.js
const mongoose = require('mongoose');

const UserHelpStateSchema = new mongoose.Schema({
  user_id:                  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  toured_pages:             { type: Map, of: Boolean, default: {} },
  tours_disabled_globally:  { type: Boolean, default: false },
  tooltips_disabled_globally: { type: Boolean, default: false },
  created_at:               { type: Date, default: Date.now },
  updated_at:               { type: Date, default: Date.now },
});

module.exports = mongoose.model('UserHelpState', UserHelpStateSchema);
```

---

## 35.10 Help Settings UI — Inside Settings Module

Users can manage their help preferences from Settings → Help tab.

```jsx
// client/src/pages/settings/HelpSettingsTab.jsx

import { useHelpStore } from '../../store/helpStore';
import { useTranslation } from 'react-i18next';
import axios from '../../lib/axios';
import toast from 'react-hot-toast';

export function HelpSettingsTab() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { toursDisabledGlobally, tooltipsDisabledGlobally, disableAllTours } = useHelpStore();

  const resetAllTours = async () => {
    try {
      await axios.patch('/api/help/state/reset');
      window.location.reload(); // Simple — force re-load help state
    } catch {
      toast.error(lang === 'ar' ? 'حدث خطأ' : 'Error resetting help state');
    }
  };

  return (
    <div className="space-y-6 max-w-lg" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        {lang === 'ar' ? 'إعدادات المساعدة والشروحات' : 'Help & Onboarding Settings'}
      </h2>

      {/* Tour global toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
        <div>
          <p className="font-medium text-sm text-gray-900 dark:text-white">
            {lang === 'ar' ? 'الشروحات التوجيهية للصفحات' : 'Page Onboarding Tours'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {lang === 'ar'
              ? 'تعرض شرحاً تلقائياً عند زيارة الصفحة للمرة الأولى'
              : 'Shows a walkthrough automatically on first visit to each page'}
          </p>
        </div>
        <span className={`text-sm font-medium ${toursDisabledGlobally ? 'text-red-500' : 'text-green-500'}`}>
          {toursDisabledGlobally
            ? (lang === 'ar' ? 'مُعطَّلة' : 'Disabled')
            : (lang === 'ar' ? 'مُفعَّلة' : 'Enabled')}
        </span>
      </div>

      {/* Reset all tours button */}
      <button
        onClick={resetAllTours}
        className="w-full py-2.5 text-sm rounded-lg border border-blue-300 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
      >
        {lang === 'ar' ? '↺ إعادة عرض شروحات جميع الصفحات' : '↺ Reset All Tour Steps (re-show on next visit)'}
      </button>

      {/* Disable tours button */}
      {!toursDisabledGlobally && (
        <button
          onClick={disableAllTours}
          className="w-full py-2.5 text-sm rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          {lang === 'ar' ? '✕ تعطيل جميع الشروحات نهائياً' : '✕ Disable All Tours Permanently'}
        </button>
      )}
    </div>
  );
}
```

---

## 35.11 Adding `data-help` Attributes to Page Elements

Every element targeted by a tour step **must** have a `data-help` attribute. This is the only contract between the help system and the UI components.

```jsx
// Example: inside POSSalesPage.jsx

<input
  data-help="pos-search-bar"        // ← targeted by pos_sales tour, step 0
  className="..."
  placeholder="ابحث أو امسح الباركود..."
/>

<div data-help="pos-item-grid" className="...">
  {/* item grid */}
</div>

<table data-help="pos-invoice-lines">
  {/* invoice lines */}
</table>

<div data-help="pos-payment-panel" className="...">
  {/* payment section */}
  <label>
    {lang === 'ar' ? 'الخصم' : 'Discount'}
    <SmartTooltip pageKey="pos_sales" tooltipKey="discount_field" className="mr-1" />
  </label>
</div>

<button data-help="pos-save-btn" className="...">
  {lang === 'ar' ? 'حفظ وطباعة' : 'Save & Print'}
</button>
```

**Rule:** `data-help` values must be **unique per page**. They are not IDs — they are semantic markers only. Do not style against them.

---

## 35.12 Folder Structure — New Files Added by This Chapter

```
client/src/
│
├── help/
│   └── helpContent.js                  # Central help text config (AR + EN)
│
├── hooks/
│   └── usePageTour.js                  # One-line hook for any page
│
├── store/
│   └── helpStore.js                    # Zustand help state store
│
└── components/
    └── help/
        ├── PageTour.jsx                # Full tour modal + spotlight + navigation
        └── SmartTooltip.jsx            # (?) icon with collision-aware popup

server/src/
├── models/
│   └── UserHelpState.js               # Mongoose schema
└── routes/
    └── help.routes.js                 # 5 REST endpoints

client/src/pages/settings/
└── HelpSettingsTab.jsx                # Settings UI for help preferences
```

---

## 35.13 Behavior Summary Table

| Scenario | System Behavior |
|----------|----------------|
| User logs in for the very first time | `user_help_state` document created. All `toured_pages` empty. |
| User visits POS page (first time) | Tour fires after 600ms delay. Backdrop + spotlight rendered. |
| User visits POS page (second time) | `toured_pages.pos_sales = true` — no tour fired. |
| User clicks ✕ on tour popup | Tour marked complete for that page. Never shown again for this user. |
| User clicks "Don't show tours again" | `tours_disabled_globally = true`. No tours ever for this user on any page. |
| User clicks (?) tooltip icon | Tooltip opens. Any other open tooltip closes (one at a time rule). |
| Tooltip near right viewport edge | Collision logic flips it to the left automatically. |
| RTL mode (Arabic) | Left/right placements swapped. `dir="rtl"` on popup. Close button on left. |
| Admin resets help state | All `toured_pages` cleared. Tours will show again on next page visit. |
| User on a page with no help content | `usePageTour` finds no config → silently does nothing. |
| Network down when saving tour state | API call fails silently. Tour still marked complete in local Zustand state for the session. |

---

## 35.14 Integration Checklist

```
For each new page added to ElHegazi Retailer:

□ Add a page_key entry to helpContent.js with:
    □ title_ar and title_en
    □ At least 2-4 tour steps with target selectors
    □ Tooltip texts for complex fields

□ Add data-help="..." attributes to all targeted elements in the JSX

□ Add <SmartTooltip pageKey="..." tooltipKey="..." /> next to complex fields

□ Call usePageTour('page_key') at the top of the page component

□ Verify tour popup doesn't clip viewport on smallest supported resolution (1024x768)

□ Test in RTL (Arabic) mode — confirm placement flips correctly

□ Test "Don't show again" → refresh → confirm tour does not re-appear
```

---

*End of Chapter 35 — Smart Help System & Guided Onboarding*

---

# APPENDIX B — ARABIC LOCALIZATION NOTES

```
Currency display rules:
- Amount always before symbol: "١٢٥.٠٠ ر.س" (not "ر.س ١٢٥.٠٠")
- Use Arabic-Indic numerals in Arabic mode (١٢٣ not 123) — optional
- Decimal separator: "." in most Arab countries
- Thousands separator: "," e.g. "١٢,٥٠٠.٠٠ ر.س"

Date display rules:
- Default: Gregorian calendar (أكثر شيوعاً في التجارة)
- Format: 2026/04/18 (YYYY/MM/DD) — Arabic standard
- Hijri date: show alongside if requested

RTL rules:
- All forms: labels on right, inputs extend to left
- Tables: RTL, numbers still read left-to-right
- Sidebar: on the right side
- Icons with text: icon on the right of text (in RTL)
- Modals: Close (X) button on the left (visually right in LTR)
- Status badges, amounts: always visually right-to-left direction
- PDF: use Cairo/Noto Arabic fonts, set PDFKit RTL mode

Text expansion:
- Arabic text is often 20-30% longer than English equivalent
- Design all UI elements with this in mind
- No truncation on critical data (customer name, item name)
- Use ellipsis only for non-critical long strings
```

---

# APPENDIX C — DEPLOYMENT CHECKLIST

```
Before first deployment to a branch:

Pre-installation:
□ Windows 10/11 64-bit confirmed
□ .NET Framework (if needed by installer)
□ Antivirus whitelist (may flag Electron apps)
□ Firewall rules (if LAN mode needed)
□ Thermal printer installed + tested
□ Barcode scanner tested (USB HID mode)
□ UPS (uninterruptible power supply) recommended

Installation:
□ Run installer as Administrator
□ Choose installation directory
□ Desktop shortcut created
□ App opens to license activation screen

First-run:
□ Activate license key
□ Complete setup wizard
□ Create admin account
□ Create warehouses + treasury
□ Configure receipt settings + test print
□ Import initial item list (if available)
□ Enter opening balances for customers/suppliers
□ Set up auto-backup path

Training checklist:
□ Cashier: POS screen usage + barcode scanning
□ Manager: end-of-day report + shift close
□ Admin: backup + restore demo
□ All: login + password policy
```

---

*End of ElHegazi Retailer — Complete Product Blueprint V1*
*Total coverage: 38 chapters | 38 database collections | 120+ API endpoints*
*100% single-branch | Local MongoDB | Electron Desktop | Arabic RTL*
*Built for a billion-dollar implementation — no gaps, no assumptions*

**Next Steps:**
1. Review and approve this blueprint with the full dev team
2. Create GitHub repository with folder structure
3. Set up development environment (Node.js 20+, no MongoDB needed — SQLite is embedded)
4. Sprint 1: Auth + Setup Wizard + Basic Settings
5. Sprint 2: Items + Customers + Basic POS
6. Sprint 3: Full POS + Stock + Basic Reports
7. Sprint 4: All modules + Advanced Reports
8. Sprint 5: Electron packaging + License system + Testing
9. Sprint 6: Performance testing + Bug fixes + Deployment
