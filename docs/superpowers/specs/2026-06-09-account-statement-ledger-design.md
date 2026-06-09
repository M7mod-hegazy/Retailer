# Account Statement Ledger (كشف حساب) — Rebuild Design

Date: 2026-06-09
Reports affected: `suppliers/statement` (`supplier-statement`), `customers/statement` (`customer-statement`)

## Goal

Rebuild the supplier/customer account statement so it renders as a clear ledger
matching `حركة كشف حساب بالأصناف.xls`, records **every** account interaction (the
same set the account "movements" tab shows), computes balances correctly, and
shows a helpful preview when no party is selected. All UI in Arabic / RTL.

## Background findings

- The statement queries live in `server/src/reports/queries/accounts.js`
  (`supplierStatementV2`, `customerStatementV2`). They return a structured object
  `{ party_name, opening_balance, closing_balance, transactions }` which
  `normalizeStructuredReport` (in `columns.js`) splits into `rows` + `summary`.
- The client (`SourceWorkspacePage.jsx`) renders the rows through the generic
  `DataGrid` and the generic `ReportPrintTemplate` — nothing like the XLS ledger.
- `MovementsTab` in `CustomerAccountsPage.jsx` collects the canonical set of
  interactions: documents (invoices/purchases), payments, returns, **and manual
  adjustments** (`customer_notes`/`supplier_notes` where `type='adjustment'`),
  plus an opening-balance reconciliation row.

### The balance model (core correctness fix)

`opening_balance` on `customers`/`suppliers` is **mutated on every transaction**
(invoice, purchase, payment, return, adjustment — confirmed across
`invoiceService`, `purchases.routes`, `payments.routes`, `returnService`,
`ajalDebts.routes`, `customers/suppliers.routes`). Despite its name it holds the
**live current balance**, not a historical opening.

Therefore the current statement query is wrong: it uses the live balance as the
starting point and then adds in-period transactions on top, double-counting.

Correct model (same approach `MovementsTab` uses — back-computation):

```
trueOpening   = liveBalance − Σ(all txns ever)
periodOpening = trueOpening + Σ(txns strictly before `from`)     // رصيد أول المدة
periodClosing = periodOpening + Σ(in-period txns)                // رصيد الحركة
```

When `to` = today, `periodClosing` reconciles to the live `opening_balance`.

Sign convention (unchanged from existing rows): `amount > 0 → debit (مدين)`,
`amount < 0 → credit (دائن)`; adjustments use their signed `amount` the same way
(`amount > 0` increases balance).

## Changes

### Backend — `server/src/reports/queries/accounts.js`

1. Fetch **all** transactions for the party (no date filter), from four sources:
   purchases/invoices, returns, payments, and `*_notes` adjustments
   (`type='adjustment'`).
2. Keep full `created_at` (date **and** time) on each row for display
   (`02/05/2026 11:45:34 ص`).
3. Compute `trueOpening = liveBalance − Σ(all amounts)`,
   `periodOpening = trueOpening + Σ(amounts strictly before from)`.
4. Accumulate running balance forward over **in-period** rows only.
5. Return enriched structured object (still compatible with
   `normalizeStructuredReport`):
   `{ party_name, party_code, opening_balance: periodOpening,
      closing_balance: periodClosing, total_debit, total_credit, transactions }`.
6. Keep the `_has_items` / `_is_item` flatten markers so exports and the generic
   path keep working; the new renderer re-nests from those markers.

### Frontend — dedicated ledger renderer

- New `client/src/pages/reports/templates/AccountStatementLedger.jsx`.
- `SourceWorkspacePage.jsx`: when `classificationId === "statement"` and a party
  is selected, render the ledger for the table tab instead of `DataGrid`.
- Re-nest flat rows → documents. Render XLS layout:
  - header band: `كود المورد | المـورد` (or العميل),
  - `رصيد أول المدة` row,
  - per-document rows: date+time, مدين / دائن / الرصيد, description,
  - nested item sub-table: الصنف / الكمية / السعر / الإجمالي,
  - `إجمالي` footer: Σدائن / Σمدين / رصيد الحركة.
- Print/PDF: a statement branch in `ReportPrintTemplate.jsx` (or sibling) that
  renders the same ledger for paper instead of the generic column grid.

### Empty state — prompt + ghost preview

When the required party filter is unset, replace the generic "لا توجد بيانات"
with a clear CTA (`اختر مورد لعرض كشف الحساب` / `اختر عميل…`) plus a faded
skeleton of the ledger (opening row → document → إجمالي).

## Out of scope

- Other reports and the generic `DataGrid` path.
- Renaming the misleading `opening_balance` column app-wide (only documented).

## Risks / verification

- Confirm nothing else consumes `supplierStatement`/`customerStatement` outputs
  before changing their shape (grep `dispatcher`/`listRows` consumers).
- Verify the back-computed `periodClosing` reconciles to the live balance when
  `to` = today, against `MovementsTab` for the same party.
