# Smart Backup, Export & Empty Database — Design

**Date:** 2026-06-04
**Area:** Settings → Backup tab (`client/src/pages/settings/BackupSettingsTab.jsx`), server `backupService.js` / `backup.routes.js`
**Status:** Approved design — pending implementation plan

## 1. Goal

Replace the current "copy the `.db` file" backup with a complete, size-efficient backup system, plus two new sibling systems — **Export** and **Empty database** — all living in the existing Settings → Backup tab, privilege-controlled, with clear previews, warnings, and animations.

Three user-facing systems:

1. **Smart Backup** — create backups (with a pre-backup preview), browse them in a Year → Month → Day tree, and restore from any day checkpoint.
2. **Export** — produce a single portable, self-contained file (`.zip`) for a chosen checkpoint that can be moved to another machine and fully re-imported.
3. **Empty database** — wipe the system (keep-setup OR full factory reset, chosen at runtime), always forcing a safety backup first and requiring the owner password.

## 2. The core problem this fixes

The current backup copies **only `data/retailer.db`**. But uploaded files — **product images and the store logo** — live on disk in the `uploads/` folder; the database only stores their *paths* (e.g. `item_images.image_url = "/uploads/123.png"`). A `.db`-only backup therefore silently omits all images:

- Restoring an old `.db` → image rows point at files that may no longer exist (broken images).
- Exporting a `.db` to another machine → every product image and the logo are missing.

`uploads/` (served via `express.static(getUploadsDir())`) is the **only** persistent on-disk user data. The Excel/CSV writer in `exportService.js` is unrelated temp report output.

**Requirement:** a backup must capture **both** the database **and** `uploads/`, and every checkpoint must be a complete, restorable point.

## 3. Storage model — dedup pool + per-checkpoint manifest

Naively bundling all images into every checkpoint would bloat disk. Instead we use a content-addressed shared pool (the model used by Time Machine / restic / git):

```
<backup-root>/
  _blobs/                          # shared image pool — each image stored ONCE, keyed by content hash
    a3/a3f9c2e1….png
  2026/06/04/
    retailer-backup-<ts>.db        # FULL database snapshot (small, ~4 MB)
    retailer-backup-<ts>.json      # sidecar: metadata + manifest (commit marker, written LAST)
```

- **Database** is small and always changing → full snapshot every backup. Simple and bulletproof.
- **Images** are large-ish and effectively immutable (upload filenames are unique timestamps) → each distinct image (by SHA-256 of its bytes) is copied into `_blobs/` **only if not already present**. Adding another backup does not re-copy existing images.
- **Manifest** (inside the sidecar) records, for the moment of backup, every image that existed: `{ originalPath, hash, sizeBytes }`. This pins exactly which images belong to that checkpoint.

**Result:** a checkpoint costs ≈ the DB size only (a few MB). Total backup footprint ≈ one copy of all images ever seen + N small DB files. The folder does not balloon, yet **every checkpoint is a complete restore point** that reproduces the exact data + image set of that day.

### Sidecar JSON shape

```json
{
  "schemaVersion": 1,
  "createdAt": "2026-06-04T17:30:00.000Z",
  "triggerType": "manual",          // manual | auto | pre-restore | pre-empty
  "label": "before price update",   // optional user note
  "appVersion": "6.13",
  "db": { "fileName": "retailer-backup-<ts>.db", "sizeBytes": 4063232 },
  "recordCounts": { "items": 120, "customers": 45, "invoices": 980, "...": 0 },
  "images": {
    "count": 38,
    "totalSizeBytes": 5242880,
    "manifest": [ { "originalPath": "/uploads/123.png", "hash": "a3f9c2…", "sizeBytes": 20480 } ]
  },
  "keepForever": false               // reserved; no auto-cleanup in this build
}
```

The sidecar is written **last** and is the commit marker. A `.db` with no sidecar = incomplete or legacy → listed but flagged "images not included".

## 4. Server design

All routes stay under `/api/backup`, behind `authRequired` + `requireRole("admin")` as the floor, with the destructive ones additionally gated on new permission actions (§6).

### 4.1 `backupService.js` (extended)

- `computeBackupPreview()` → dry run, writes nothing. Returns record counts (one `SELECT COUNT(*)` per relevant table), DB size, image count + total size, **new vs reused** image breakdown (hash each `uploads/` file, check `_blobs/`), estimated on-disk size (DB + new blobs), and the target `YYYY/MM/DD` folder.
- `performBackup({ triggerType, label })` → checkpoint the DB (`wal_checkpoint(TRUNCATE)`), copy DB into the day folder, dedup-copy each `uploads/` file into `_blobs/`, then write the sidecar last. Order: **blobs → db → sidecar**. Returns the sidecar summary.
- `listBackups()` → walk the backup root, parse sidecars, return a tree grouped `year → month → day → [snapshots]`, newest first. Legacy bare `.db` files are synthesized into entries flagged `legacy: true`.
- `restoreBackup({ path })` → validate `path` is inside the backup root (path-traversal guard), then: stage a copy, take a `pre-restore` safety backup, `closeDb()`, copy snapshot over live DB, rebuild `uploads/` from the manifest (materialize each blob to its `originalPath`, delete files not in the manifest), `initDb()`. On any failure, roll back to the `pre-restore` backup (existing rollback pattern). Legacy/db-only restore skips image rebuild and warns.
- `exportCheckpoint({ path, destPath })` → build a self-contained `.zip` at `destPath` containing the checkpoint `.db` + only its manifest's images (pulled from `_blobs/`) + an `info.json`. Uses `adm-zip` (small new dependency).
- `emptyDatabase({ mode, ownerPassword })` → see §4.3.

Helpers reused: `resolveCurrentDbPath`, `isLikelySqliteFile`, `getDbPath`, `closeDb`, `initDb`, `ensureSystemOwnerAccount`.

### 4.2 Routes

| Method | Path | Purpose | Extra gate |
|---|---|---|---|
| GET | `/api/backup/preview` | dry-run summary before creating | `create` |
| POST | `/api/backup/trigger` | create backup `{ label }` | `create` |
| GET | `/api/backup/list` | Year→Month→Day tree | `view` |
| POST | `/api/backup/restore` | restore by `{ path }` (server-side) | `restore` + type-to-confirm (client) |
| POST | `/api/backup/restore-upload` | existing upload-file restore (fallback, accepts `.db` and `.zip`) | `restore` |
| POST | `/api/backup/export` | build portable `.zip` `{ path, destPath }` | `export` |
| POST | `/api/backup/empty` | wipe `{ mode, ownerPassword }` | `empty` + owner password |
| GET/PUT | `/api/backup/settings` | auto-backup enable, **daily time**, root folder | `view` / `create` |

### 4.3 Empty database

Body `{ mode: 'keep-setup' | 'factory-reset', ownerPassword }`.

1. Verify `ownerPassword` against the **system owner's current `password_hash` in the `users` table** (same credential as owner login, so rotation propagates), falling back to the `SYSTEM_OWNER_PASSWORD_HASH` env var and failing closed if neither exists — no hardcoded default. Reject on mismatch (no wipe).
2. **Force** a `pre-empty` backup (non-skippable).
3. In a single transaction:
   - `keep-setup`: `DELETE FROM` an **explicit, hardcoded allowlist** of operational tables (invoices, invoice_lines, sales_returns + lines, payments, payment_allocations, purchases + lines, purchase_orders + lines, purchase_payments, purchase_returns + lines, quotations + lines, shifts, shift_transactions, daily_sessions, daily_withdrawals, withdrawals, expenses, revenues, stock_movements, stock_adjustments, **stock_levels**, **item_batches** (stock lots), cost_movements, price_history, branch_transfers + lines, physical_count_sessions + lines, loyalty_transactions, cheques, installments, ajal_debts/payments/schedules, bank_transactions, notifications, owner_statement*, pos_drafts, import_batch*, customer_notes, supplier_notes, employee_adjustments, integrity_check*, audit_logs, document_sequences). **Keep** users, role_permissions, settings, settings_kv, print_settings_per_doc, branches, warehouses, customers, suppliers, items + categories/images, units, payment_methods, price_groups, customer_groups, *_categories, banks, treasuries, employees, promotions, licenses, license_runtime, user_help_state, `_migrations`.
     - **Reset cached/derived columns on kept tables** (otherwise surviving master rows contradict the now-empty history): `treasuries.balance` → 0, `banks.balance` → 0, `customers.total_spent` → 0, `customers.loyalty_points` → 0. Intentional setup (`opening_balance`, `credit_limit`, prices) is left untouched. (`resetDerivedBalances`, column-guarded.)
   - `factory-reset`: `DELETE FROM` every table except `_migrations`, then reseed (`ensureSystemOwnerAccount`, default settings row). Optionally also clear `uploads/`.
4. `VACUUM`. Audit-log the action.

The allowlist is hardcoded and reviewed against the 81-table schema — never auto-derived — so master data cannot be wiped by accident.

## 5. Client UI — Backup tab restructured

Four `PermissionGate`-wrapped sections, RTL, matching existing styling (`rounded-sm`, `font-black uppercase tracking-widest`, `active:scale-95`). Animated expand/collapse and modal entrances (framer-motion-style height/opacity).

1. **Create backup** — "Create now" button + label input + auto-backup settings (enable toggle, **daily time picker**, root-folder picker via Electron `dialog:open-file` directory mode). Clicking "Create" first opens the **preview modal** (§5.1).
2. **Restore from a checkpoint** — collapsible **Year → Month → Day** tree from `/api/backup/list`. Each day row shows the latest snapshot's time, size, trigger badge, label, and record-count chips; expand to choose an earlier snapshot of that day. "Restore" opens the type-to-confirm modal (type the store name or `استعادة`).
3. **Export** — pick a checkpoint → OS save dialog (`dialog:save-file`, `.zip`) → progress → success toast with the saved path.
4. **Empty database** (danger zone, rose-styled) — radio: keep-setup vs factory-reset → warning modal → owner-password field → shows the forced pre-empty backup as a locked step.

### 5.1 Pre-backup preview modal

Calls `/api/backup/preview` (writes nothing) and shows:

- **Your data:** record counts (products, customers, invoices, purchases, payments, shifts, …) + DB size.
- **Your pictures:** total image count + size; **new** (added to pool now) vs **already saved** (reused, no extra space).
- **This backup:** estimated on-disk size (DB + new images only), target folder `…/2026/06/04/`, label input, trigger type.
- Single **"Confirm & back up now"** button — nothing is written until pressed.

All new strings added to `client/src/locales/ar.json` + `en.json`.

## 6. Privileges & safety

- Extend the `backup` page permission actions from `['view','create','restore']` → add **`export`** and **`empty`** in both `client/src/constants/pagePermissions.js` and `server/src/constants/pagePermissions.js`.
- Routes keep `requireRole("admin")` as the floor; destructive routes additionally check the new action so an admin can be denied `empty`/`export` via `role_permissions`.
- **Restore:** type-to-confirm phrase (client) before confirm enables.
- **Empty:** owner-password verification (server, bcrypt) + warning modal.
- Every destructive op writes a `pre-*` safety backup and is audit-logged.

## 7. Edge cases

- **Crash mid-backup:** sidecar written last = commit marker; sidecar-less `.db` treated as incomplete/legacy.
- **Image changed in place / duplicates:** hash by content, so a changed file gets a new blob and identical images dedup to one blob.
- **Legacy bare `.db` backups:** still listed and restorable as "db-only (images not included)" with a warning.
- **Path traversal:** restore/export validate the checkpoint path resolves inside the backup root; `.zip` import and manifest rebuild guard every entry against Zip Slip (reject names that escape `uploads/`).
- **Active shift:** auto-backup keeps the existing "skip if a shift is open" guard; manual/empty are explicit user actions.
- **Two-DB layout:** backup always resolves the live `main` DB via `PRAGMA database_list`, so it snapshots whichever DB the running process uses.
- **Blob garbage collection:** deferred (no auto-cleanup this build); a "compact unreferenced images" action can be added later. (YAGNI)

## 8. Dependencies

- Add `adm-zip` to `server` (small) — used only for Export and `.zip` import.

## 9. Testing

Extend `server/tests/backupService.test.js`:

- Sidecar write/read round-trip; manifest correctness.
- `listBackups` tree building incl. legacy no-sidecar entries.
- Dedup: same image across two backups stored once in `_blobs/`.
- Path-traversal rejection on restore/export.
- Restore rebuilds `uploads/` exactly from manifest (adds expected, removes extras).
- `empty` keep-setup preserves master tables and clears operational tables; factory-reset reseeds the owner.
- Owner-password gate rejects a wrong password (no wipe) and the forced pre-empty backup exists afterward.
- Preview returns counts/sizes and writes nothing.

## 10. Out of scope (this build)

- Auto-cleanup / retention of old backups.
- Blob garbage collection UI.
- Excel/CSV data export (the existing `exportService.js` reporting feature is untouched).
- Cloud/off-machine backup destinations.
