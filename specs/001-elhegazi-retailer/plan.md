# Implementation Plan: ElHegazi Retailer V1

**Branch**: `001-elhegazi-retailer` | **Date**: 2026-04-19 | **Spec**: [spec.md](../../.specify/specs/001-elhegazi-retailer/spec.md)
**Input**: Feature specification from `.specify/specs/001-elhegazi-retailer/spec.md`

## Summary

ElHegazi Retailer V1 is a full-featured, Arabic-first, RTL Point-of-Sale and Business Management desktop application. It runs as a native Windows desktop app via Electron 29, stores all data locally in SQLite (better-sqlite3), and is designed as a per-branch licensed system replacing legacy Microsoft Access software. The system covers 38 functional modules including POS, inventory, purchases, payments, expenses, reports, shift management, promotions, loyalty, RBAC permissions, backup/restore, and Electron packaging.

## Technical Context

**Language/Version**: JavaScript/Node.js 20 LTS (backend), React 18 JSX (frontend)
**Primary Dependencies**: Electron 29, Express 4, better-sqlite3 9.x, React 18, Tailwind CSS 3.x (RTL), Zustand 4.x, TanStack Query 5.x, React Hook Form 7.x, Zod 3.x, Vite (build)
**Storage**: SQLite via better-sqlite3 — synchronous, single `.db` file, WAL journal mode, NORMAL synchronous pragma
**Testing**: Jest (unit), Playwright (E2E)
**Target Platform**: Windows 10+ 64-bit (Electron desktop) + LAN browser clients (any OS including Win 7)
**Project Type**: Desktop application (Electron) with embedded Express API server
**Performance Goals**: POS operations < 300ms, invoice save 5–20ms (SQLite), database open < 50ms
**Constraints**: 100% offline-capable, integer-only currency arithmetic, Arabic-first RTL UI, no jQuery, no class components
**Scale/Scope**: Single-branch deployment, 10k+ items, 50+ screens, 5 user roles, 28+ database tables

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Offline-First & Data Reliability | ✅ PASS | SQLite local database, WAL mode enabled in `openDatabase()`, no cloud dependency for operations |
| II | Financial Data Integrity | ✅ PASS | All monetary fields stored as integers (halala/piastre), `currencyMath.js` utility for integer-safe math, audit log on every financial mutation |
| III | Arabic-First RTL Interface | ✅ PASS | `document.documentElement.dir = 'rtl'`, i18next with `ar.json` primary, Tailwind RTL plugin, all labels/messages default Arabic |
| IV | Functional Modern Frontend | ✅ PASS | Functional components + hooks only, Zustand (not Redux), no jQuery in dependency list |
| V | Intentional & Safe UX | ✅ PASS | `ConfirmDialog.jsx` component required for all destructive actions, soft-deletes everywhere |
| — | Technology Stack | ✅ PASS | Electron 29, Node.js 20, Express 4, better-sqlite3, React 18, Tailwind CSS RTL, Windows 10+ |
| — | Backup Strategy | ✅ PASS | `year/month/day/` folder hierarchy, one `.db` file per backup via `fs.copyFileSync` |

**Gate Result: ALL PASS** — Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-elhegazi-retailer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
│   ├── auth.api.md
│   ├── items.api.md
│   ├── invoices.api.md
│   ├── customers.api.md
│   ├── suppliers.api.md
│   ├── payments.api.md
│   ├── stock.api.md
│   ├── shifts.api.md
│   ├── promotions.api.md
│   ├── reports.api.md
│   └── backup.api.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
elhegazi/
├── electron/                          # Electron main process
│   ├── main.js                        # Entry: single-instance lock, window management
│   ├── preload.js                     # Secure IPC bridge (contextBridge)
│   ├── dbManager.js                   # SQLite open/close/migrate + WAL pragma
│   ├── serverManager.js               # Start Express on :5000
│   ├── licenseManager.js              # Hardware ID + activation + cache
│   ├── hardwareId.js                  # SHA-256 machine fingerprint
│   ├── ipcHandlers.js                 # All IPC event handlers
│   ├── tray.js                        # System tray with Arabic labels
│   ├── updater.js                     # electron-updater auto-update
│   ├── menuBuilder.js                 # Native app menu
│   ├── windowManager.js               # Window creation helpers
│   ├── migrations/                    # SQLite schema migrations
│   │   └── 001_initial_schema.js
│   └── assets/                        # Icons (ico, png, tray)
│
├── client/                            # React 18 frontend (Vite)
│   ├── src/
│   │   ├── main.jsx                   # Entry + i18n + RTL setup
│   │   ├── App.jsx                    # Router setup
│   │   ├── index.css                  # Tailwind + custom RTL styles
│   │   ├── components/
│   │   │   ├── layout/                # AppShell, DesktopLayout, MobileLayout, Sidebar, Topbar
│   │   │   ├── ui/                    # Button, Input, Modal, Table, ConfirmDialog, etc.
│   │   │   ├── forms/                 # CurrencyInput, BarcodeInput, FormField
│   │   │   ├── pos/                   # ItemGrid, InvoiceLines, PaymentPanel, BarcodeListener
│   │   │   ├── print/                 # Receipt80mm, Receipt58mm, InvoiceA4, BarcodeLabel
│   │   │   ├── charts/               # RevenueChart, CategoryChart, TopItemsChart
│   │   │   ├── help/                  # PageTour, SmartTooltip
│   │   │   └── mobile/               # MobileCard, MobilePOS, MobileStatCard
│   │   ├── pages/                     # auth/, setup/, dashboard/, definitions/, items/, sales/,
│   │   │                              # purchases/, payments/, expenses/, operations/, stock/,
│   │   │                              # reports/, search/, notifications/, settings/
│   │   ├── hooks/                     # useAuth, useBarcode, usePrint, useRTL, usePermission, etc.
│   │   ├── stores/                    # authStore, posStore, uiStore, notificationStore, helpStore
│   │   ├── services/                  # api.js (Axios), auth.service, items.service, etc.
│   │   ├── utils/                     # currency.js (integer math), dateHelpers, formatters
│   │   ├── constants/                 # permissions.js, routes.js, queryKeys.js
│   │   ├── help/                      # helpContent.js (AR+EN)
│   │   └── locales/                   # ar.json, en.json
│   ├── tailwind.config.js             # RTL plugin config
│   ├── vite.config.js
│   └── package.json
│
├── server/                            # Express 4 backend
│   ├── src/
│   │   ├── index.js                   # Entry: opens DB, starts server
│   │   ├── app.js                     # Express setup + middleware stack
│   │   ├── config/
│   │   │   ├── database.js            # SQLite connection (better-sqlite3)
│   │   │   ├── storage.js             # Local file storage (multer)
│   │   │   └── logger.js              # Winston structured logging
│   │   ├── models/                    # SQLite query helper modules (28+ files)
│   │   ├── routes/                    # Express route definitions (20+ files)
│   │   ├── controllers/               # Request handlers (mirrors routes)
│   │   ├── middleware/                 # auth, permission, audit, validate, errorHandler
│   │   ├── services/                  # stockService, invoiceService, reportService, etc.
│   │   ├── jobs/                      # node-cron: lowStockAlert, autoBackup, chequeReminder
│   │   └── utils/                     # apiResponse, currencyMath, helpers
│   └── package.json
│
├── shared/
│   └── validations/                   # Zod schemas (used FE + BE)
│
├── activation-server/                 # Separate license management server (VPS)
│   └── src/
│
├── scripts/                           # seed.js, create-indexes.js
├── package.json                       # Root: Electron + build scripts
├── electron-builder.yml               # NSIS Windows installer config
└── .env.example
```

**Structure Decision**: Electron desktop app with three internal packages — `electron/` (main process), `client/` (React renderer), `server/` (Express API). The server runs embedded inside Electron's main process. LAN browser clients connect to the same Express server. Shared Zod validation schemas bridge frontend and backend.

## Complexity Tracking

> No constitution violations detected. No complexity justifications required.

## Post-Design Constitution Re-Check

| # | Principle | Status | Post-Design Evidence |
|---|-----------|--------|---------------------|
| I | Offline-First | ✅ PASS | SQLite `.db` file with WAL, no network calls except license activation |
| II | Financial Integrity | ✅ PASS | `currencyMath.js` integer-only arithmetic, audit middleware on all mutations |
| III | Arabic-First RTL | ✅ PASS | i18next `ar.json` primary, Tailwind RTL, `dir="rtl"` on `<html>` |
| IV | Functional Frontend | ✅ PASS | Zustand + hooks, React.FC only, no class components |
| V | Safe UX | ✅ PASS | `ConfirmDialog` component, soft-delete pattern |
| — | Stack | ✅ PASS | All versions match constitution |
| — | Backup | ✅ PASS | `fs.copyFileSync` → `year/month/day/elhegazi_<timestamp>.db` |

**Final Gate: ALL PASS**

---

## Post-Review Fixes (2026-07-04)

After V1 completion, a full codebase review of FeaturesTab, POS restaurant integration, and posStore/printService was conducted. The following fixes were applied:

### FeaturesTab Redesign
- **Rewrote `FeaturesTab.jsx`** — Individual feature cards in 2-column grid with icon, name, description, recommended shop types, expandable affected pages, enable button (or "مُفعّل" badge), confirmation modal with irreversible warning
- **Removed**: store-type grouping, pricing/subscription, payment dialogs, activation code flow, `feature_promotions` from standalone list
- **Added page permissions**: `restaurant_tables`, `restaurant_modifiers`, `gold_pricing`, `repair_orders`, `serial_search` to client and server `pagePermissions.js`

### Bug Fixes
| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| 1 | Modifier price not added to invoice total | MEDIUM | `handleModifierApply` now computes `adjustedPrice = masterPrice + modifierPriceDelta` and passes `unit_price` in onApply patch |
| 2 | Kitchen ticket filter excludes items without modifiers | MEDIUM | Changed filter from `l.modifiers?.length > 0` to `l.is_menu_item || l.modifiers?.length > 0`; added `is_menu_item: 1` to cart line payload |
| 3 | `useSearchParams` stale closure | LOW | Added `searchParams` and `restaurantEnabled` to effect deps; removed dead empty block |
| 4 | Negative modifier price display | LOW | LineConfigModal shows negative adjustments in red with proper sign |
| 5 | RecipeSection hidden for new menu items | MEDIUM | After POST, captures new item ID and transitions modal to edit mode inline (no save-close-reopen) |
| 6 | Field navigation `prevRef` skips gold fields | LOW | `prepTimeRef` prevRef now dynamically points to `goldMakingRef` or `warrantyMonthsRef` or `descriptionRef` |
| 7 | Silent error swallowing in RecipeSection | LOW | Added `toast.error` on fetch failure |
| 8 | Stale modifiers not cleared when groups deleted | LOW | useEffect filters `selectedModifiers` against valid IDs from fetched groups |
| 9 | `printContent` unhandled promise rejection | INFO | Added `.catch(() => {})` after kitchen ticket print call |
| 10 | Config button label with multi-unit + restaurant | INFO | Shows "unit + إضافات" when both features enabled |
| 11 | Server-side modifier price in `invoiceService.js` | NONE | **Verified correct** — client sends `unit_price` with modifier delta baked in; server uses it as-is for `rowSubtotal` and `line_total`. No fix needed. |
