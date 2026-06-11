# Accounts Import/Export — Design Spec
**Date:** 2026-06-11
**Branch:** feat/edge-case-engine
**Scope:** Customers and Suppliers list pages

---

## 1. Overview

Add bulk import (Excel/CSV) and history/undo to the Customers and Suppliers list pages, following the same pattern as the existing items import (`/definitions/items/import`) but with a simpler 3-step wizard. Export is already present in `SimpleCrudPage` (CSV download button) — no changes needed.

---

## 2. Routes & Pages

| Route | Component | Purpose |
|---|---|---|
| `/definitions/customers/import` | `AccountImportPage` (entityType="customers") | Customers import wizard |
| `/definitions/suppliers/import` | `AccountImportPage` (entityType="suppliers") | Suppliers import wizard |

`AccountImportPage` is a single shared component parameterized by `entityType`. It mirrors the structure of `ItemImportPage` (Upload tab + History tab).

---

## 3. Navigation Entry Points

`SimpleCrudPage` receives a new optional prop `importPath: string`. When provided, an "استيراد" button (Upload icon) is rendered next to the existing "تصدير السجلات" button in the top action bar.

- `CustomersListPage` passes `importPath="/definitions/customers/import"`
- `SuppliersListPage` passes `importPath="/definitions/suppliers/import"`

---

## 4. Wizard Flow (Upload Tab)

Four steps, progressing linearly. Steps 3 is skipped if there are no duplicates.

### Step 1 — Upload
- File picker + drag-and-drop zone. Accepts `.xlsx`, `.xls`, `.csv`.
- On file load: run `parseExcelFile` + `detectHeaderRow` from `excelImportExport.js`.
- Run account-specific column detection (see Section 6) to auto-map columns.
- Display a mapping summary chip row: `"اكتشف: الاسم ← Resources | الرصيد ← Raseed | الهاتف ← Mobile"`.
- If `name` column is not detected, show a warning banner (non-blocking — user can still proceed).
- Back button navigates to the list page.

### Step 2 — Preview
- Table showing all parsed rows with columns: name, phone, address, opening_balance.
- Per-row status chip:
  - `جديد` (green) — name not found in existing records
  - `مكرر` (amber) — name matches an existing record
  - `خطأ` (red) — name cell is empty
- User can remove individual rows via a delete icon per row.
- Summary bar at bottom: `X جديد | Y مكرر | Z خطأ`.
- "متابعة →" is disabled when any red rows exist OR when there are zero actionable rows (new + update = 0).
- If zero duplicates: clicking "متابعة" jumps directly to Step 4 (import runs).

### Step 3 — Duplicate Resolution *(skipped if no duplicates)*
- Shows only the duplicate rows.
- Per row: name, current system `opening_balance`, file `opening_balance`, phone, address.
- Per-row toggle: **تخطي** (default) / **تحديث**.
- "تنفيذ الاستيراد →" button runs the import.
- Back → Step 2.

### Step 4 — Result
- Count chips: `تم إضافة X | تم تحديث Y | تم تخطي Z`.
- Two action buttons: "العودة للقائمة" and "استيراد ملف آخر" (resets wizard to Step 1).

---

## 5. History Tab

Same tab switcher UI as `ItemImportPage` (Upload / السجل).

**Table columns:** file name, user, date, إضافة count, تحديث count, status chip, actions.

**Status chips:**
- `نشطة` (green, pulsing) — within 24-hour undo window
- `منتهية المهلة` (amber) — past 24 hours, no undo
- `تم التراجع` (slate) — already undone

**Actions per row:**
- **تنزيل** — re-downloads the original uploaded file from the blob stored in the DB.
- **تراجع** — available only when status is `نشطة` and the user has `import_undo` permission on the relevant page (`customers` or `suppliers`). Triggers undo with a confirm dialog.

---

## 6. Column Detection

New account field definitions added to `excelImportExport.js` as `ACCOUNT_FIELDS`:

| Field | Required | Aliases |
|---|---|---|
| `name` | yes | name, resources, اسم, الاسم, اسم العميل, اسم المورد |
| `phone` | no | phone, mobile, هاتف, جوال, موبايل |
| `address` | no | address, عنوان, العنوان | maps to the `addresses` DB column (plain text) |
| `opening_balance` | no | raseed, balance, رصيد, الرصيد, رصيد افتتاحي, الرصيد الافتتاحي, opening balance |

Detection reuses `normalizeKey` and a slightly modified `detectColumnHeaders` — the function gains an optional second parameter `fields` (defaults to `ITEM_FIELDS` to preserve existing behaviour). `detectHeaderRow` similarly accepts an optional `fields` argument so it can score rows against account aliases. The sample file (`أرصدة الموردين`) maps cleanly: `Raseed→opening_balance`, `Mobile→phone`, `Address→address`, `Resources→name`.

---

## 7. Database — New Tables

### `account_import_batches`
```sql
CREATE TABLE account_import_batches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type     TEXT NOT NULL CHECK(entity_type IN ('customers','suppliers')),
  file_name       TEXT,
  file_mime       TEXT,
  file_blob       BLOB,
  inserted        INTEGER DEFAULT 0,
  updated         INTEGER DEFAULT 0,
  skipped         INTEGER DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','undone')),
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT DEFAULT (datetime('now')),
  undone_at       TEXT,
  undone_by       INTEGER REFERENCES users(id)
);
```

### `account_import_batch_rows`
```sql
CREATE TABLE account_import_batch_rows (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id    INTEGER NOT NULL REFERENCES account_import_batches(id) ON DELETE CASCADE,
  entity_id   INTEGER NOT NULL,
  action      TEXT NOT NULL CHECK(action IN ('insert','update')),
  prior_json  TEXT
);
```

A migration (`NNN_account_import_tables.js`) creates both tables with `addColumnIfMissing`-style idempotency guards.

---

## 8. Server Endpoints

All endpoints are added to `customers.routes.js` and `suppliers.routes.js`.

### Import
`POST /api/customers/import`
`POST /api/suppliers/import`

Request body:
```json
{
  "rows": [
    { "action": "insert", "name": "...", "phone": "...", "address": "...", "opening_balance": 0 },
    { "action": "update", "existing_id": 5, "name": "...", "phone": "...", "address": "...", "opening_balance": 350 }
  ],
  "file_name": "أرصدة.xls",
  "file_mime": "application/vnd.ms-excel",
  "file_base64": "..."
}
```

Runs in a single `db.transaction()`. For each row:
- `insert`: `INSERT INTO customers/suppliers`
- `update`: `UPDATE customers/suppliers SET ... WHERE id = existing_id`, snapshot saved to `account_import_batch_rows.prior_json`

Saves one `account_import_batches` record + one `account_import_batch_rows` per affected row. Returns `{ batch_id, inserted, updated, skipped }`.

### History
`GET /api/customers/import/batches` — list batches for customers (entity_type='customers'), joined with users for user_name.
`GET /api/suppliers/import/batches` — same for suppliers.

### File Download
`GET /api/customers/import/batches/:id/file`
`GET /api/suppliers/import/batches/:id/file`

Returns the `file_blob` as the original file. 404 if blob is null.

### Undo
`POST /api/customers/import/batches/:id/undo`
`POST /api/suppliers/import/batches/:id/undo`

Undo rules:
- Batch must have `status = 'active'` → else 409 `already_undone`.
- Batch must be within 24 hours → else 409 `expired`.
- For each `insert` row: block undo if the entity has any linked invoices / payments / quotations / purchase receipts → 409 `activity`.
- For each `update` row: restore `prior_json` unconditionally.
- For each `insert` row with no activity: hard-delete the entity.
- Mark batch `status = 'undone'`.

---

## 9. Permissions

Reuses existing page permissions:
- Import requires `add` permission on `customers` / `suppliers`.
- History view requires `view` permission.
- Undo requires `import_undo` permission (same key as items, scoped per page).

---

## 10. Files to Create / Modify

### New files
- `client/src/pages/accounts/import/AccountImportPage.jsx`
- `client/src/pages/accounts/import/AccountImportHistoryTab.jsx`
- `client/src/pages/accounts/import/useAccountImportWizard.js`
- `electron/migrations/NNN_account_import_tables.js`

### Modified files
- `client/src/components/crud/SimpleCrudPage.jsx` — add optional `importPath` prop
- `client/src/pages/customers/CustomersListPage.jsx` — pass `importPath`
- `client/src/pages/suppliers/SuppliersListPage.jsx` — pass `importPath`
- `client/src/utils/excelImportExport.js` — add `ACCOUNT_FIELDS`
- `client/src/App.jsx` (or router file) — add two new import routes
- `server/src/routes/customers.routes.js` — add import/history/undo endpoints
- `server/src/routes/suppliers.routes.js` — add import/history/undo endpoints
- `client/src/locales/ar.json` + `en.json` — new translation keys

---

## 11. Out of Scope
- Importing `credit_limit` (customers) or `payment_terms` (suppliers) — not present in the sample file; can be added later.
- XLSX format for export — existing CSV export is sufficient.
- Column remapping UI — auto-detection covers the known file formats; manual remap can be added in a follow-up.
