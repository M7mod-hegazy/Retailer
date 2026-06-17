# POS Installment Plans — Design

**Date:** 2026-06-17
**Status:** Approved, implementing

## Problem

The POS "أقساط" (installments) payment type shows an "إعداد الأقساط" card with a down
payment and a single **تاريخ استحقاق القسط** date. That date is misleading: it only
becomes the parent debt's single `ajal_debts.due_date` — it does **not** create any
installment schedule. The real installment tracker (customer accounts / `InstallmentsTab`)
renders `ajal_schedules` rows, which are only ever created later via the AjalTracker
"schedule" generator, which ignores the POS date. So an installments sale is functionally
identical to a plain credit (آجل) sale, and the date the cashier types is effectively dead.

## Goal

Let the cashier build a real **multi-installment plan** at point of sale (down payment +
several scheduled payments), persist it as `ajal_schedules` at sale time so it appears on the
customer's account immediately, and surface monitoring/alerts:
- **Notifications** when each installment's due date arrives / passes.
- **Customer accounts:** a persistent warning while overdue installments exist.
- **Dashboard:** a dismissible (daily) warning banner.

## Non-goals (v1)

- Editing an installment plan via the invoice **amend** (PUT) path — keeps today's behavior.
- New tables. We reuse the existing `ajal_debts` + `ajal_schedules` schema.
- Touching the legacy/unused `installments` table (it is not what the tracker reads).

## Data model (existing, unchanged)

- `ajal_debts` — parent debt for the invoice's remaining amount (already created today).
- `ajal_schedules(id, debt_id, installment_no, due_date, amount, paid_at, status, created_at)`
  — one row per installment. This is what `CustomerAccountsPage` / `InstallmentsTab` render.

## Division of labor

The **client generates and edits** the schedule; the **server only persists the final rows**.
This keeps the server change minimal and makes "auto then editable" trivial.

## Client

### `InstallmentPlanner` component (new) — `client/src/components/pos/InstallmentPlanner.jsx`
Shared by both `POSListView.jsx` and `POSDetailedView.jsx` (state lives in `POSPage.jsx`).
Inputs:
- **Down payment** (existing `amountPaid`).
- **Number of installments** (`installmentCount`).
- **Frequency**: monthly / weekly / biweekly / custom days (`installmentFrequency`, `installmentCustomDays`).
- **First due date** (the existing date field, relabeled **تاريخ أول قسط**; `installmentStartDate`).

Behavior:
- Auto-generates `installmentRows = [{ installment_no, due_date, amount }]` from the inputs.
  Remaining = `total − downPayment`, split equally with the rounding remainder on the **last** row.
  First row uses the chosen first due date; each subsequent row adds the frequency interval
  (monthly = add 1 month; weekly = +7d; biweekly = +14d; custom = +N days).
- Each generated row's **date and amount are editable**.
- Live **"المتبقي للتوزيع"** figure = `remaining − sum(rows.amount)`.
- **Confirm-sale button is disabled until that figure is 0** (within a 1-cent tolerance).
- Installments **require a selected customer**; warn / disable otherwise.

### `POSPage.jsx`
- Add state: `installmentCount`, `installmentFrequency`, `installmentCustomDays`,
  `installmentStartDate` (replaces the role of `installmentDueDate`), `installmentRows`.
- Add `installment_plan: installmentRows` to the payload when `payment_type === "installments"`
  (replacing the lone `due_date`; debt `due_date` is derived server-side from row 1).
- Wire the disabled-save guard into the existing submit gating.

## Server — `invoiceService.js` (installments branch, ~507–518)

After creating the `ajal_debt` for `remainingAmount`:
- Capture the debt `lastInsertRowid`.
- If `payment_type === "installments"` and `payload.installment_plan` is a non-empty array:
  - **Validate** `sum(amounts) === remainingAmount` within a 1-cent tolerance → else **throw**
    (rolls back the whole sale transaction; no orphan debt/schedules).
  - Insert each row into `ajal_schedules (debt_id, installment_no, due_date, amount, status='pending')`.
  - Set the debt's `due_date` to **row 1's** due date (keeps overdue summary meaningful).

## Monitoring & alerts

### Notifications — `notificationJobs.js`
- New `scanInstallmentSchedules()` joining `ajal_schedules → ajal_debts`:
  - Overdue: `sch.due_date < today AND sch.status != 'paid'` → "⏰ قسط متأخر".
  - Due today: `sch.due_date = today AND sch.status != 'paid'` → "📅 قسط مستحق اليوم".
  - Deduped per schedule per day (body carries `#<schedule_id>`); link to the customer account.
- Modify `scanOverdueDebts` to add `AND NOT EXISTS (SELECT 1 FROM ajal_schedules s WHERE s.debt_id = ad.id)`
  so installment debts are not double-alerted at debt level. Both run on the 8am tick.

### Dashboard — dismissible banner
- Fix `dashboard.routes.js`: replace the stale `installments`-table query with
  `overdue_installments` + `due_today_installments` counts from `ajal_schedules`.
- New `installmentAlertStore` (mirrors `updateStore`) with a **date-stamped** localStorage
  dismiss key, so the banner reappears the next day / when new installments come due.
- `DashboardPage.jsx`: render a dismissible rose/amber banner — "X أقساط متأخرة، Y مستحقة اليوم"
  — with a button to the customer accounts page.

### Customer accounts — persistent warning
- `CustomerAccountsPage.jsx`: add a **non-dismissible** page-level warning banner summarizing
  total overdue + due-today installments (from the ajal-debts summary endpoint), shown whenever
  the count > 0. Per-customer red "متأخر" row highlighting stays as-is.

## Testing

- **Server:** creating an installments invoice with `installment_plan` produces N `ajal_schedules`
  summing to the remaining; a mismatched sum throws and rolls back (no debt, no schedules left).
- **Client:** unit-test the generator (date math per frequency; equal split with remainder on last row).

## i18n

All new strings added to both `client/src/locales/ar.json` and `en.json`.
