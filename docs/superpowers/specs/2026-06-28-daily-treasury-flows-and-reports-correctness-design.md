# Daily Treasury — correctness fixes, flows-log rebuild, and reports edit/delete audit

**Date:** 2026-06-28
**Status:** Approved (design)
**Area:** `client/src/pages/pos/DailyTreasuryPage.jsx`, `server/src/routes/dailySessions.routes.js`, `server/src/services/dailySessionService.js`, `server/src/reports/queries/*`

## Problem

The Daily Treasury page (`DailyTreasuryPage`) has correctness and UX gaps:

1. **"حركة الوسائل اليوم" card miscounts when an invoice is cancelled/amended/deleted.** Invoice
   cancellation and amendment are *soft* — the invoice row is set to `status='cancelled'`
   (amendment also sets `amended_by`, leaving the original `cancelled`), and the associated
   `payments` / `payment_allocations` rows are **never deleted**. The treasury equation
   (`dailySessionService` summary) and the POS transaction list both filter
   `status != 'cancelled'`, but `GET /today/payment-methods` aggregates `payments`,
   `ajal_payments`, and `purchase_payments` **by date only, with no invoice-status guard**.
   Cancelled/amended invoice payments therefore keep inflating each wallet/bank method's
   in/out/net.

2. **The "حركة الوسائل اليوم" card is not wired into the double-way highlight system.** The
   equation cash-in / cash-out / non-cash rows support forward highlight (row → matching
   transactions) and reverse highlight (transaction → `txAffects` → row). The payment-method
   in/out chips have no equivalent linkage.

3. **The transactions explorer ("سجل التدفقات المالية" / كل الحركات) is a flat tabbed list**
   with no running balance, no reconciliation to the equation, weak filtering, and it does not
   reliably surface the source document number. The user considers it low-value and wants it
   rebuilt as a true cash-flow ledger.

4. **Reports handle invoice edit/delete inconsistently.** `server/src/reports/queries/sales.js`
   filters cancelled/amended heavily (~74 references), but several modules
   (`revenues.js`, `expenses.js`, `employees.js`, `warehouses.js`) have **zero** status
   handling. Any invoice-derived figure in those reports may include cancelled or
   superseded-by-amendment invoices.

## Goals

- Every aggregation that derives cash/wallet/bank movement excludes cancelled and
  amended-away invoices consistently.
- The payment-method movement card participates in the same click-to-trace highlight system as
  the equation rows.
- The transactions area becomes a running-balance cash-flow ledger that reconciles exactly to
  the treasury equation, with smart filters, per-row double-entry preview, export/print, and
  anomaly flags — and captures the correct source document number.
- Invoice-touching reports uniformly exclude cancelled invoices and count only the live version
  of an amendment chain.

## Non-goals

- Changing how invoices are cancelled/amended (the soft-delete model stays).
- Reworking the treasury equation math itself (it is already cancellation-correct).
- Multi-day / cross-session cash-flow views (this is a single-day ledger).

---

## Part 1 — Correctness: exclude cancelled/amended invoices from movement aggregations

### Affected query: `GET /api/daily-sessions/today/payment-methods`
File: `server/src/routes/dailySessions.routes.js` (~line 113).

For each source that can be tied to an invoice/purchase, add an invoice-status guard:

- **`payments`** (customer + supplier): exclude rows whose `invoice_id` references a cancelled
  invoice. Standalone payments (`invoice_id IS NULL`) are kept. Use
  `LEFT JOIN invoices i ON i.id = payments.invoice_id` and
  `WHERE COALESCE(i.status,'') != 'cancelled'`. For multi-payment splits that are linked through
  `payment_allocations` rather than `payments.invoice_id`, also exclude payments allocated solely
  to cancelled invoices.
- **`purchase_payments`**: exclude payments for purchases with
  `status IN ('voided','cancelled')` (join `purchases`).
- **`ajal_payments`**: these settle debts, not invoices directly; verify whether a cancelled
  invoice cascades to its debt. If the debt is voided on cancellation, guard on
  `ajal_debts.status`. If not, document that ajal payments are intentionally independent.
- **`expenses` / `revenues` / `withdrawals`**: no invoice linkage — unchanged, but confirmed in
  the audit.

### Verification
Audit (do not assume) the summary service (`dailySessionService`) and the
`/today/transactions` union for any remaining source that lacks a cancellation guard, and the
hard-delete path (if any invoice can be truly `DELETE`d, the orphaned-rows behaviour must be
confirmed). Document findings inline.

### Tests
`server/tests/dailyTreasury.test.js`:
- Create a card/wallet-paid invoice → assert the method total includes it.
- Cancel that invoice → assert the method total drops by the same amount.
- Amend an invoice (original → cancelled, new active) → assert the method total counts only the
  amendment, not both.

---

## Part 2 — Double-way highlight for "حركة الوسائل اليوم"

The card renders from `methodTotals` (`DailyTreasuryPage.jsx` ~line 1620). Wire it into the
existing highlight state (`activeEquationRowId`, `txAffects`, `handleEquationRowClick`):

- Treat each method's in and out as selectable buckets with stable ids
  (e.g. `method_<id>_in`, `method_<id>_out`).
- Extend `getEquationRowAffects(tx)` so a non-cash transaction also yields an affect entry
  pointing at the relevant `method_<id>_<dir>` bucket (derived from `tx.payment_splits` /
  method name).
- Clicking a method in/out chip filters the ledger to its contributing transactions (forward);
  clicking a transaction highlights the contributing method chip (reverse), using the same amber
  "← هذه الحركة: {amount}" badge and ring styling as the equation rows.

Visual language must match the equation rows exactly (no new color system — reuse existing
theme tokens per the project convention).

---

## Part 3 — Flows-log rebuild: running-balance cash-flow ledger

### New endpoint: `GET /api/daily-sessions/:date/cashflow`
File: `server/src/routes/dailySessions.routes.js`.

Returns a single time-ordered array of movements for the day, cancellation-correct, each with:

| field | meaning |
|---|---|
| `created_at` | timestamp, used for ordering |
| `doc_type` | pos_invoice, expense, revenue, sales_return, … (existing taxonomy) |
| `doc_no` | **correct source document number** (invoice_no, return doc_no, etc.) |
| `party` | customer/supplier/category name |
| `direction` | `in` \| `out` \| `non_cash` |
| `amount` | signed cash effect (or movement amount for non-cash) |
| `running_balance` | server-computed cumulative cash balance |
| `bucket_id` | the equation/method bucket this row feeds (for per-row double-entry preview) |
| `flags` | anomaly markers: `cancelled` (only if explicitly shown), `amended`, `large`, `deleted_source` |

`running_balance` starts at the session opening balance and accumulates only cash-affecting rows
in time order; the final value MUST equal the equation's expected cash. The endpoint reuses the
same cancellation guards as Part 1 so the ledger and the equation cannot disagree.

### UI (replaces the current tabbed list in `DailyTreasuryPage.jsx`)
The flat `TABS` transaction explorer (~line 1696) is replaced by the ledger:

- **Columns:** time, movement (type + doc_no + party), داخل, خارج, الرصيد (running balance).
  Opening-balance synthetic first row, closing summary last row.
- **Reconciliation badge:** closing running balance vs equation المتوقع → green "مطابق" or red
  "فرق X ج.م".
- **Smart filters** (combinable): direction (in/out/non-cash), payment method, doc type, amount
  range, time range; a quick "نقدي فقط" toggle. Filtering does not corrupt the running balance
  (balance is computed on the full ordered set; filtered-out rows are hidden but the balance
  column still reflects true cumulative state, or is dimmed — decide during implementation and
  keep it unambiguous).
- **Per-row double-entry preview:** each row shows the bucket it feeds and supports the same
  forward/reverse highlight; drill-in opens the existing slide-over with full document detail.
- **Export / print:** reuse `PrintPreviewModal` patterns; export the ledger.
- **Anomaly flags** surfaced inline.

The existing `/today/transactions` endpoint and slide-over detail loaders remain (drill-in still
uses them); only the list presentation changes.

### Tests
Endpoint test: build a day with mixed cash/non-cash/cancelled movements; assert ordering,
`running_balance` accumulation, and that closing == expected cash from the summary.

---

## Part 4 — Reports edit/delete correctness audit

### Discovery pass
Enumerate every query in `server/src/reports/queries/*` that reads from `invoices`,
`invoice_items`, `payments`, `payment_allocations`, or `sales_returns`. For each, record whether
it: (a) excludes `status='cancelled'`, and (b) handles amendment chains (counts only the live
version — since the amended original is already `cancelled`, the same guard usually suffices, but
verify reports that join on `amendment_of` / `amended_by`).

Known zero-handling modules to inspect first: `revenues.js`, `expenses.js`, `employees.js`,
`warehouses.js`. Known good reference: `sales.js`.

### Fix
Apply the uniform guard to each affected query. Where a report intentionally includes cancelled
rows (e.g. an audit/void report), document why and leave it. Scope is bounded by the discovery
pass; low-value reports with negligible invoice exposure may be deferred with a noted rationale.

### Tests
For each fixed report, a regression test: figure before cancel/amend, then after, asserting the
cancelled/superseded invoice is excluded.

---

## Rollout / sequencing

1. Part 1 (server correctness + tests) — foundational; the ledger depends on it.
2. Part 3 server endpoint (reuses Part 1 guards).
3. Part 2 + Part 3 UI together (shared highlight wiring).
4. Part 4 audit + fixes (independent; can run in parallel).

## Risks

- **Filtered running balance ambiguity** — must present cumulative balance unambiguously when
  filters hide rows. Resolve explicitly in implementation.
- **ajal_payments ↔ cancelled invoice linkage** — needs verification before guarding; wrong
  guard could hide legitimate debt settlements.
- **Part 4 scope creep** — bounded by the discovery pass; defer low-value reports.

## Testing summary

- Jest (`server/tests/`): Part 1 method-total exclusion, Part 3 cashflow running balance +
  reconciliation, Part 4 per-report regressions.
- Manual UI verification (`npm run dev`): Parts 2 & 3 highlight, filters, reconciliation badge,
  export/print. Per project convention, all new UI text added to both `ar.json` and `en.json`
  and uses theme tokens, not hardcoded colors.
