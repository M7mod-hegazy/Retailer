# Research: ElHegazi Retailer V1

**Phase 0 Output** | **Date**: 2026-04-19

## 1. SQLite with better-sqlite3 for Electron POS

**Decision**: Use `better-sqlite3` v9.x as the sole database driver with synchronous API.

**Rationale**:
- Synchronous API eliminates callback/promise complexity for POS-critical paths
- SQLite opens in < 50ms vs 4–6 seconds for MongoDB's `mongod` process
- Invoice save benchmark: 5–20ms (vs 200–600ms with MongoDB)
- Single `.db` file simplifies backup (file copy) and distribution
- WAL mode enables concurrent reads during writes without locks
- No external process to bundle, manage, or troubleshoot

**Alternatives considered**:
- `sql.js` (WASM-based): Slower, entire DB loaded in memory, no native performance
- `better-sqlite3-multiple-ciphers`: Adds encryption but unnecessary complexity for V1
- `knex.js` (query builder): Adds abstraction layer; raw prepared statements are faster for POS
- `MongoDB + Mongoose`: Original spec choice — rejected due to startup time, bundling complexity, and process management overhead

## 2. Integer Currency Arithmetic

**Decision**: Store all monetary values as integers in the smallest currency unit (halala for SAR = 1/100, piastre for EGP = 1/100).

**Rationale**:
- JavaScript `Number` type uses IEEE 754 doubles — `0.1 + 0.2 !== 0.3`
- Integer math is exact: `10 + 20 === 30` (representing 0.10 + 0.20 SAR)
- Display conversion: `amount / 100` only at the UI rendering layer
- Input conversion: `parseFloat(input) * 100 | 0` at entry points
- SQLite `INTEGER` type is 64-bit — supports values up to 9.2 quintillion halala

**Alternatives considered**:
- `decimal.js` / `big.js`: Runtime overhead, non-standard, not needed when integers suffice
- String-based math: Complex, slow, unnecessary
- PostgreSQL NUMERIC type: Would require abandoning SQLite

## 3. Electron 29 Security Model

**Decision**: Use `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` with a minimal `preload.js` IPC bridge.

**Rationale**:
- Electron 29 enforces context isolation by default
- `preload.js` exposes only whitelisted IPC channels via `contextBridge`
- Renderer process has zero direct Node.js access — all system operations go through IPC
- This prevents XSS attacks from escalating to full system access

**Alternatives considered**:
- `nodeIntegration: true`: Security risk, deprecated practice
- No preload (direct API only): Cannot access native dialogs, file system, or license hardware ID

## 4. SQLite WAL Mode + Transaction Strategy

**Decision**: Enable WAL mode on database open. Use explicit transactions (`db.transaction()`) for multi-table mutations (invoice save, stock deductions).

**Rationale**:
- WAL mode allows concurrent readers while one writer is active
- `NORMAL` synchronous pragma: safe on modern OS with journaling filesystem (NTFS)
- `db.transaction()` in better-sqlite3 is ~10x faster for batch inserts vs individual statements
- Atomic invoice save: insert invoice → insert lines → deduct stock → update customer balance → audit log — all in one transaction

**Alternatives considered**:
- DELETE journal mode: Slower writes, blocks readers during writes
- `FULL` synchronous: ~3x slower writes for marginal safety gain on NTFS
- No explicit transactions: Risk of partial writes on crash

## 5. Tailwind CSS RTL Strategy

**Decision**: Use `tailwindcss-rtl` plugin with logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`) plus `dir="rtl"` on `<html>`.

**Rationale**:
- Logical properties (`margin-inline-start` / `margin-inline-end`) automatically flip in RTL
- No duplicate stylesheets needed
- `@tailwindcss/forms` resets work with RTL
- Arabic text expansion (20–30% longer) handled by flexible layouts

**Alternatives considered**:
- Manual CSS with `[dir="rtl"]` selectors: Maintenance nightmare
- Separate RTL stylesheet: Doubles CSS bundle, easy to drift out of sync
- CSS-in-JS (styled-components): Adds runtime cost, violates Tailwind-first approach

## 6. State Management Split

**Decision**: Zustand for client-only state (POS cart, auth, UI), TanStack Query for server-state (items, customers, invoices, reports).

**Rationale**:
- Zustand: Minimal boilerplate, no providers, direct store access — ideal for POS cart mutations that must be instant
- TanStack Query: Automatic caching, stale-while-revalidate, devtools for debugging — ideal for data that lives on the server
- Clear separation: Zustand never makes API calls; TanStack Query never holds UI state

**Alternatives considered**:
- Redux Toolkit: More boilerplate, larger bundle, unnecessary complexity for this use case
- React Context: Performance issues with frequent POS cart updates (re-renders entire tree)
- SWR: Fewer features than TanStack Query (no mutation helpers, no optimistic updates)

## 7. Backup Strategy

**Decision**: `fs.copyFileSync(dbPath, backupPath)` where `backupPath` = `<user-selected-base>/<year>/<month>/<day>/elhegazi_<timestamp>.db`.

**Rationale**:
- SQLite in WAL mode: `fs.copyFileSync` is safe when using `.backup()` API or `VACUUM INTO`
- Actually, use `better-sqlite3`'s `db.backup(destination)` API for a hot backup (consistent snapshot even during writes)
- Hierarchical folder structure enables easy manual browsing and cleanup
- `node-cron` schedules auto-backup at configurable time (default 02:00)
- Keep last N backups (default 30), prune older ones

**Alternatives considered**:
- ZIP compression: Adds complexity, SQLite files compress poorly (already compact)
- Incremental backups: Overkill for single-file database < 500MB
- Cloud backup: Violates offline-first principle for V1

## 8. LAN Mode Architecture

**Decision**: When LAN mode is enabled, Express binds to `0.0.0.0:5000` instead of `127.0.0.1:5000`. Browser clients connect via the server PC's IP.

**Rationale**:
- Zero additional infrastructure — same Express server, same React app
- Browser clients get the full React SPA (minus Electron-specific features like backup dialog)
- CORS configured to allow LAN IP range
- License lives only on the server PC — clients don't need licenses

**Alternatives considered**:
- WebSocket real-time sync: Adds complexity; HTTP polling with TanStack Query's refetch is sufficient for V1
- Separate thin-client build: Maintenance overhead, same UI works in browser

## 9. Invoice Number Generation (Race-Safe in SQLite)

**Decision**: Use `UPDATE settings SET invoice_counter = invoice_counter + 1 RETURNING invoice_counter` inside the invoice-save transaction.

**Rationale**:
- SQLite transactions are serialized (one writer at a time) — no race conditions
- `RETURNING` clause (SQLite 3.35+) gives us the new counter value atomically
- Prefix + zero-padded counter: `INV-BR1-000001`

**Alternatives considered**:
- UUID: Not user-friendly for receipts, not sequential
- Application-level counter: Race condition risk if two browser clients save simultaneously

## 10. Electron Packaging

**Decision**: `electron-builder` with NSIS installer targeting Windows x64.

**Rationale**:
- NSIS allows custom install directory, desktop shortcut, start menu
- `asar: true` for file protection
- `better-sqlite3` requires native rebuild — handled by `electron-rebuild`
- Auto-update via `electron-updater` with generic provider (self-hosted releases)

**Alternatives considered**:
- Squirrel installer: Less customizable, no install directory choice
- Portable (no installer): No start menu/desktop shortcut, less professional
- MSI: More complex build setup
