# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

ElHegazi Retailer is an **Electron-based desktop POS and retail management system** targeting Arabic-speaking markets. It uses a monorepo structure with a React/Vite frontend, Express.js/SQLite backend, and Electron shell packaged as a Windows `.exe`.

## Commands

### Development
```bash
npm run dev              # Start full stack: Express server + Vite client + Electron window
npm run dev:server       # Express server only (port 5000)
npm run dev:client       # Vite dev server only (port 5173)
npm run bootstrap        # Install all workspace dependencies
```

### Testing
```bash
npm test --prefix server       # Run Jest tests (backend)
npm run test:e2e --prefix client  # Playwright e2e tests (frontend)
```

### Build & Release
```bash
npm run build            # Build client only (Vite)
npm run dist             # Package as Windows .exe via Electron Builder
npm run start            # Build + run production build
npm run electron:rebuild # Rebuild native modules (better-sqlite3) after Electron version change
```

### Utilities
```bash
npm run kill:retailer-processes      # Kill running retailer processes
npm run windows:configure-users      # Configure Windows user accounts for hardening
npm run windows:harden-acl           # Apply Windows ACL security policy
```

## Architecture

### Stack
- **Frontend:** React 18 + Vite + React Router v6 + TailwindCSS (RTL/LTR via `tailwindcss-rtl`)
- **Backend:** Express.js + SQLite (`better-sqlite3`) — synchronous DB calls (no async/await for DB)
- **Desktop:** Electron with IPC bridge between renderer and main process
- **State:** Zustand stores in `client/src/stores/`
- **Data fetching:** TanStack Query (React Query) for server state
- **Forms:** React Hook Form + Zod validation
- **i18n:** i18next with Arabic (`ar`) as primary, English (`en`) as secondary

### Monorepo Layout
```
client/       React/Vite frontend
server/       Express.js API backend
electron/     Electron main process + migrations + scripts
shared/       Licensing and validation utilities shared across packages
vendor-license-service/  License server (separate service)
data/         SQLite database file (runtime)
uploads/      User-uploaded files
```

### Server Architecture (`server/src/`)
- `index.js` — entry point; starts Express, initializes DB, sets up auto-backup cron
- `routes/` — 35 route modules mounted at `/api/<resource>` (see list in README)
- `middleware/` — `auth.js` (JWT), `permission.js` (RBAC), `validate.js` (Zod), `audit.js` (activity log), `errorHandler.js`, `upload.js` (Multer)
- `db/` — SQLite setup and schema; all DB operations are synchronous (better-sqlite3 API)
- Database migrations live in `electron/migrations/` and are applied on app startup

### Client Architecture (`client/src/`)
- `pages/` — 86 JSX files organized by feature domain (pos, purchases, sales, stock, reports, etc.)
- `components/` — Shared components: `layout/` (AppShell, sidebar), `crud/` (generic CRUD UI), `pos/`, `print/`, `ui/`
- `services/` — Axios API client (`api.js`) and helper functions
- `hooks/` — Custom React hooks
- `stores/` — Zustand stores (auth, inventory, POS, etc.)
- `locales/ar.json`, `locales/en.json` — Translation strings

### Electron IPC
The Electron main process (`electron/main.js`) spawns the Express server in-process and communicates with the renderer via IPC channels for: license validation, database operations, window management, and tray menu.

### Key Domain Concepts
- **Shifts:** POS sessions with open/close reconciliation; invoices belong to a shift
- **Treasuries/Banks:** Multiple cash/bank accounts; payments are recorded against them
- **Warehouses:** Multi-warehouse inventory; stock transfers between warehouses
- **Purchase flow:** Quotation → Purchase Order → Purchase Receipt (3-step)
- **Loyalty:** Points-based customer loyalty program
- **Protection modes:** `hybrid_license` (default) or `windows_managed` (ACL-only, no license activation)

## Environment Setup

Copy `.env.example` to `.env` in both `client/` and `server/` directories.

Key server env vars:
- `PORT=5000`, `DB_PATH=./data/retailer.db`
- `JWT_SECRET` — must be set for auth to work
- `APP_PROTECTION_MODE` — `hybrid_license` or `windows_managed`
- `SYSTEM_OWNER_PASSWORD_HASH` — bcrypt hash; default plaintext is `275757`
- `ALLOW_DEV_BYPASS=true` — skip license check in development

### Database files — two separate DBs
There are **two** SQLite database files:
- `data/retailer.db` — used by the **Electron packaged app** (production)
- `server/data/retailer.db` — used by the **dev server** (`npm run dev:server` / `npm run dev:web`)

When diagnosing SQLite schema errors, always inspect `server/data/retailer.db`, not `data/retailer.db`.
Use `npx electron -e "..."` (not `node`) to load `better-sqlite3` — it is compiled against Electron's Node, not system Node.

### Port conflict (EADDRINUSE 5000)
nodemon sometimes restarts before the previous process fully releases port 5000.
Fix: run `npm run kill:retailer-processes` then restart the dev server.

## Important Conventions

- **RTL-first:** UI is Arabic/RTL by default. Use Tailwind's `rtl:` and `ltr:` variants for directional styles; avoid hardcoded `left`/`right`.
- **Synchronous DB:** `better-sqlite3` is synchronous — do not use `async/await` or `.then()` for database calls in server code.
- **All text must be translated:** Add keys to both `client/src/locales/ar.json` and `en.json` for any new UI text.
- **Audit logging:** Mutating routes should call the audit middleware to log user actions.
- **Client API calls:** Use the centralized Axios instance in `client/src/services/api.js`, not bare `fetch`.

## Theme System (CSS Variables)

The app uses a CSS variable-based theming system — **never hardcode Tailwind color tokens** (`emerald`, `slate`, `amber`, `rose`, `indigo`, `blue`, `white` with opacity, etc.). Always use semantic theme variable classes.

### Available Theme Classes

**Backgrounds:** `bg-bg-surface`, `bg-bg-base`, `bg-bg-overlay`, `bg-bg-input`, `bg-bg-page`
**Text:** `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-link`
**Borders:** `border-border-normal`, `border-border-subtle`, `border-border-strong`
**Primary brand:** `bg-primary`, `bg-primary-50`, `bg-primary-200`, `bg-primary-600`, `text-primary`, `border-primary`
**Semantic colors:** each has `-bg`, `-text`, `-border` variants:
  - `success` (green), `danger` (red), `warning` (amber/yellow), `info` (blue)
  - E.g., `bg-success-bg text-success-text border-success-border`
**Shadows:** `shadow-card`, `shadow-elevated`, `shadow-modal`
**Interaction:** `hover:bg-bg-overlay`, `hover:bg-bg-base`, `hover:border-primary`
**White text on brand bg:** `text-white` is acceptable only when on `bg-primary` or another colored brand/semantic background

### Rules
- NO hardcoded Tailwind color names in new code
- NO `bg-white/XX` or `text-white/XX` (use `bg-bg-surface/XX` or `text-text-secondary` instead)
- NO inline `background: white` or `background: #fff` — use CSS variables
- For `html2canvas` invoice captures, `backgroundColor: "#ffffff"` is acceptable as it needs a clean white canvas for image export
- Theme variables are defined in `client/src/index.css :root` and mapped to Tailwind in `client/tailwind.config.js`
- An override layer `client/src/utils/colorThemeOverrides.css` remaps hardcoded colors at runtime for non-default themes

## SQLite Migration Rules

- Migrations live in `electron/migrations/` and are discovered by `electron/dbManager.js` via `readdirSync` sorted by filename. Name new migrations `NNN_description.js` (zero-padded 3-digit number) and export `up(db)`.
- **SQLite cannot ALTER COLUMN** — you cannot add/remove NOT NULL or change defaults on existing columns with `ALTER TABLE`. To change a column constraint you must recreate the table: rename → create new → INSERT INTO new SELECT from old → DROP old → RENAME new.
- **Always use `DEFAULT` when adding NOT NULL columns** via `ALTER TABLE ADD COLUMN`. SQLite rejects `NOT NULL` additions without a default.
- When a new route INSERT fails with `NOT NULL constraint failed`, check whether the table has legacy columns (from an older schema) that are NOT NULL with no default. Fix both: (1) add those columns to the INSERT with a safe fallback value, (2) add a migration that recreates the table with proper defaults.
- The `addColumnIfMissing` / `addCol` helper pattern (check PRAGMA table_info first) is used in most migrations — follow the same pattern for idempotency.

## branch_transfers schema history
The `branch_transfers` table has legacy NOT NULL columns `from_warehouse_id` and `to_warehouse_id` (from the original schema before migration 065 added `warehouse_id`). Migration 091 recreates the table with `DEFAULT 1` on those columns. The route INSERT always includes them mapped to `headerWhId` for safety on un-migrated databases.

## 154_deductions_bonuses_timestamps
Adds `completed_at` and `cancelled_at` columns to `employee_deductions` and `employee_bonuses`. Server sets these when status transitions to `completed` (during settlement) or `cancelled` (DELETE endpoint). Always use `formatDateTime` from `client/src/utils/dateHelpers.js` for displaying all timestamps.
