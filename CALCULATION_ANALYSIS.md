# Deep Analysis: Calculation, Payment & Record Logic

**Date:** 2026-05-18  
**Scope:** All invoice pages, daily treasury, report records  
**Analyst:** Claude Sonnet 4.6

---

## 1. Invoice Calculation Chain

### 1.1 Client-Side Calculation (`posStore.js`)

```
subtotal = sum(qty × unit_price - line_discount)   ← AFTER line discounts
total    = max(0, subtotal - (discount + promotionDiscount) + increase)
```

**Key fields tracked per line:**
- `line_discount` — per-line cash discount
- `unit_price` — sale price

**Key store-level fields:**
- `discount` — header-level cash discount (manual)
- `promotionDiscount` — discount from promotions engine (`/api/promotions/evaluate`)
- `increase` — surcharge added on top

### 1.2 Server-Side Calculation (`invoiceService.js createInvoice`)

```
rowSubtotal = qty × unit_price               ← PRE-line-discount
subtotal    = sum(rowSubtotal)               ← PRE-line-discount
line_total  = max(0, rowSubtotal - lineDiscount)  ← per-line stored value
total       = max(0, subtotal - headerDiscount + increase)  ← PRE-line-discount
```

Server reads line discount from `line.discount` (not `line.line_discount`).

**What is stored in `invoices` table:**
| Column | Value |
|--------|-------|
| `subtotal` | sum(qty × price) — NO line discounts deducted |
| `discount` | header-level discount amount |
| `increase` | surcharge |
| `total` | subtotal − discount + increase |

**What is stored per `invoice_lines`:**
| Column | Value |
|--------|-------|
| `unit_price` | sale price |
| `discount` | line-level discount |
| `line_total` | qty × price − line_discount (correct per-line) |

---

## 2. Bugs & Issues Found

### ~~BUG-01~~ — RESOLVED: Line Discount Field Name

`POSPage.jsx:1170` correctly remaps the field before sending to the server:
```js
lines: lines.map((l) => ({
  item_id:      l.item_id,
  quantity:     Number(l.quantity || 0),
  unit_price:   Number(l.unit_price || 0),
  warehouse_id: l.warehouse_id || null,
  discount:     Number(l.line_discount || 0),   // ← client maps line_discount → discount
})),
```
Server reads `line.discount` correctly. Not a bug.

---

### BUG-02 — Server `total` Excludes Both Line Discounts AND Promotion Discount

**Location:** `server/src/services/invoiceService.js:136-138, 179` + `POSPage.jsx:1173`  
**Severity:** CRITICAL

**Three formulas, three different results:**

```
Client displayed total = sum(qty × price - line_discount) - headerDiscount - promotionDiscount + increase

Server stored total    = sum(qty × price) - headerDiscount + increase
                         (line discounts and promotionDiscount both missing)

line_total per line    = qty × price - lineDiscount  (correct in invoice_lines table)
```

**What the server ignores:**
1. Line discounts are stored in `invoice_lines.line_total` but NOT deducted from `invoices.subtotal` or `invoices.total`
2. `promotion_discount` is sent by client (`payload.promotion_discount = promotionDiscount`) but **never read** by the server

**Evidence — POSPage.jsx payload construction:**
```js
discount,                           // manual header discount only
promotion_discount: promotionDiscount,  // sent but server ignores this field
```

**Evidence — server ignores it:**
```js
const discount = Number(payload.discount || 0);  // only reads payload.discount
// payload.promotion_discount never referenced anywhere in createInvoice
```

**Concrete example:**
```
Item: 100 × 1, line_discount = 10
Manual header discount = 5
Promotion discount = 8

Client shows total = (100 - 10) - 5 - 8 = 77
Server stores total = 100 - 5 = 95

Customer is charged 95, was shown 77. Discrepancy = 18.
```

**Impact scope:** Every invoice where line discounts or promotions are applied has a discrepant `total`. The treasury balance may reflect these inflated totals.

---

### BUG-03 — Expenses Always Debit Treasury ID=1 (Hardcoded)

**Location:** `server/src/routes/expenses.routes.js:90, 69`  
**Severity:** Medium

```js
// POST / — treasury_id hardcoded to 1 in SQL VALUES
`INSERT INTO expenses (..., treasury_id, ...) VALUES (?, ..., 1, ?, ...)`
// Balance update also hardcoded:
db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = 1").run(amount);
```

If the default treasury is not id=1, the wrong treasury is debited.  
`payload.treasury_id` is accepted in the form but ignored in the balance update.

**Same issue in `revenues.routes.js:89`:**
```js
db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = 1").run(amount);
```

---

### BUG-04 — Editing an Expense Does Not Adjust Treasury Balance

**Location:** `server/src/routes/expenses.routes.js:117-125`  
**Severity:** Medium

`PUT /:id` updates the DB record but performs zero treasury balance adjustments:
```js
db.prepare(`UPDATE expenses SET amount = ..., payment_method = ... WHERE id = ?`).run(...)
// No treasury UPDATE here
```

**Impact:** If an expense amount is changed from 100 → 200, treasury shows balance off by 100. Same if payment method changes from cash → bank.

**Same issue in `revenues.routes.js:104-112`.**

---

### BUG-05 — Deleting an Expense/Revenue Does Not Reverse Treasury Balance

**Location:** `server/src/routes/expenses.routes.js:128-133`, `revenues.routes.js:115-120`  
**Severity:** Medium

```js
router.delete("/:id", ..., (req, res) => {
  getDb().prepare("DELETE FROM expenses WHERE id = ?").run(req.params.id);
  // No treasury balance reversal
```

**Impact:** Deleting an expense of 100 cash does NOT add 100 back to treasury. Treasury balance drifts permanently.

---

### BUG-06 — Historical Daily Summary Retroactively Changes After Cancellations

**Location:** `server/src/services/dailySessionService.js cashBreakdown()`  
**Severity:** Medium (data integrity / reporting)

`cashBreakdown` queries invoices with current status:
```sql
WHERE date(created_at) = ? AND payment_type = 'cash' AND status != 'cancelled'
```

**Scenario:**
- Day 1: Invoice A created (cash +1000) → Day 1 summary shows +1000
- Day 2: Invoice A cancelled (treasury −1000)
- Viewing Day 1 summary now → Invoice A excluded → Day 1 summary shows 0

The closed session's `actual_cash` is locked (correct), but the live summary for open days shows different numbers retroactively. Cancellation reversals appear in the transaction list (`show_cancelled=1`) but NOT in `cashBreakdown` as a negative entry on the cancellation date.

**Also:** `cancellationReversalSql` in `dailySessions.routes.js` lines 375–417 shows cancelled invoices in the transaction list but `cashBreakdown` treats them as if they never happened on their cancellation date.

---

### BUG-07 — `generateInvoiceNumber` Is Dead Code

**Location:** `server/src/services/invoiceService.js:8-14`  
**Severity:** Low

Function is defined but never called. `createInvoice` uses `generateDocNumber('pos_sale')` instead:
```js
const invoiceNo = generateDocNumber('pos_sale');  // actual
// function generateInvoiceNumber(db) { ... }     // dead code
```

---

### BUG-08 — Invoice `treasury_id` Never Stored in DB

**Location:** `server/src/services/invoiceService.js:193-209`  
**Severity:** Low-Medium

The `INSERT INTO invoices` statement does not include a `treasury_id` column. On cancel/void, the code always falls back to `default_treasury_id`:
```js
const tId = invoice.treasury_id ||   // always null
  db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
```

This means if the system has multiple treasuries, all cash invoices always affect the default treasury regardless of POS intent.

---

### BUG-09 — Discount Hard Limit (15%) Checks Pre-Line-Discount Subtotal

**Location:** `server/src/services/invoiceService.js:170-176`  
**Severity:** Low

```js
const maxDiscountAllowed = subtotal * 0.15;
if (discount > maxDiscountAllowed && !payload.supervisor_override) { ... }
```

`subtotal` here does NOT include line discounts deducted. If items have line discounts, the effective price is lower, so the 15% of `subtotal` is HIGHER than 15% of the true net amount. This lets supervisors apply proportionally larger total discounts without triggering the guard.

---

### BUG-10 — Promotion Discount Not Persisted Separately

**Location:** `client/src/stores/posStore.js:250-253`  
**Severity:** Low

`promotionDiscount` is a UI-state-only field. It's folded into the total at display time but is not sent as a separate server field. The server receives only one `discount` value. The split between manual discount and promotion discount is lost after invoice creation.

**Impact:** Reports cannot distinguish "discount due to promotion" vs "manual discount". Also, if `POSPage.jsx` sends `discount + promotionDiscount` combined, the GAP-02 15% limit applies to the combined total (which could block valid promotions).

---

## 3. Payment Type Handling (Server)

### Complete Matrix (`invoiceService.js createInvoice`)

| Payment Type | Cash Goes To | Debt Created | Notes |
|---|---|---|---|
| `cash` | default treasury | No | `amountReceived = total` |
| `credit` | — | Yes (customer `opening_balance` + `ajal_debts`) | Requires `customer_id` |
| `bank_transfer` | specified bank | No | Uses `payload.bank_id` |
| `multi` | per-method routing | Maybe (credit portion) | Complex — see below |
| `installments` | default treasury (upfront) | Yes (remaining → `ajal_debts`) | Upfront cash via payment_allocations |

### Multi-Payment Routing Detail
```
For each payment in payload.payments:
  method.type = 'cash'  → UPDATE treasuries SET balance = balance + amount WHERE id = method.target_id
  method.type = 'bank'  → UPDATE banks SET balance = balance + amount WHERE id = method.target_id
  method.type = 'credit' → creates ajal_debt for creditSum
```

---

## 4. Sales Return Financial Logic (`returnService.js`)

### Return Type Decision Tree

```
Invoice payment_type = 'credit' OR payload.refund_method = 'credit_note'
  → customers.opening_balance -= total
  → ajal_debts.original_amount -= total (reduces original debt)

Invoice payment_type = 'bank_transfer'
  → banks.balance -= total

Invoice payment_type = 'multi'
  → proportional reversal per allocation:
      portion = (alloc.amount / invoice.total) × return_total
      if cash alloc → treasury.balance -= portion
      if bank alloc → bank.balance -= portion

Invoice payment_type = 'cash' OR refund_method = 'cash_back'
  → treasuries.balance -= total (default treasury)
```

**Issue:** Multi-payment proportional refund uses floating-point division. For a 3-way split, small rounding errors accumulate across multiple returns.

### General Return (`createGeneralReturn`)
- No link to original invoice
- `cash_back` → default treasury − total
- `credit_note` → `customers.opening_balance` − total
- Supplier general purchase returns: same logic in `invoices.routes.js:175-213`

---

## 5. Daily Treasury Calculation (`dailySessionService.js`)

### Cash Equation
```
expectedCash = liveOpeningBalance(today) + cashIn - cashOut

cashIn  = posCashSales + posInstallmentCash + posMultiCash
        + customerCashCollections + revenuesCash + purchaseReturnsCash

cashOut = expensesCash + supplierCashPayments + salesReturnsCash + withdrawals
```

### Opening Balance Resolution
```
liveOpeningBalance(today):
  anchor = latest closed session with actual_cash before today
  since  = anchor.anchor_date (or '1970-01-01' if none)
  
  add cash movements between anchor and today (exclusive both ends):
    + pos cash invoices
    + installment upfront payments
    + multi-payment cash portions
    + customer payments (non-invoice)
    + customer ajal payments (cash)
    + revenues (cash)
    + purchase returns (cash)
    
  subtract:
    - expenses (cash)
    - supplier payments (cash)
    - supplier ajal payments (cash)
    - sales returns cash refunds
    - withdrawals
    
  return anchorBalance + deltaCashIn - deltaCashOut
```

### Session Status Flow
```
create  → status = 'open'
close   → actual_cash entered → discrepancy calculated → status = 'closed'
reopen  → only latest closed day can be reopened (guard prevents earlier day reopen)
```

**Discrepancy = actual_cash − expectedCash**  
Closing also propagates `actual_cash` as next open day's `opening_balance`.

---

## 6. Void vs Cancel Invoice

Both paths exist but have different semantics:

| Action | Route | Function | stock_movement type | `cancelled_at` recorded |
|---|---|---|---|---|
| `DELETE /:id` | requires reason | `cancelInvoice` | `cancel_sale` | Yes |
| `POST /:id/void` | requires reason | `voidInvoice` | `void_sale` | No |

`voidInvoice` does NOT set `cancelled_at` or `cancel_reason` on the invoice — only sets `status = 'cancelled'`. This means voided invoices won't appear in the `cancellationReversalSql` (which uses `cancelled_at`), so their daily treasury reversal entries are missing.

**Fix needed:** `voidInvoice` should set `cancelled_at` and `cancel_reason` like `cancelInvoice` does.

---

## 7. Amendment Flow

```
amendInvoice(id, payload, userId):
  1. cancelInvoice(id, "تعديل — reason")  ← reverses all financial effects
  2. createInvoice(payload)               ← creates fresh invoice
  3. link original.amended_by = new.id
  4. link new.amendment_of = original.id
```

Guard: If `original.amended_by` is set, amendment is rejected (prevents double-amending).

**Note:** `amendSalesReturn` follows the same pattern: cancel original return, create new return.

---

## 8. Customer/Supplier Balance Model

Both customers and suppliers use a single `opening_balance` field as a running balance:

| Event | Customer `opening_balance` | Supplier `opening_balance` |
|---|---|---|
| Credit invoice created | + total | — |
| Invoice cancelled/voided | − remaining_debt | — |
| Customer payment recorded | − amount | — |
| Sales return (credit_note) | − return_total | — |
| Purchase created | — | + total (in purchases.routes.js) |
| Supplier payment | — | − amount |
| Purchase return (credit_note) | — | − total |

**Convention:** Positive = party OWES the business. This means:
- Customer `opening_balance > 0` = customer owes money
- Supplier `opening_balance > 0` = business owes supplier

The `balance-summary` endpoints simply return `SUM(opening_balance)` across active parties.

---

## 9. Expense & Revenue Record Logic

### Create Flow
```
POST /api/expenses:
  1. assertCanWriteForDate (ensures daily session exists)
  2. generateDocNumber('expense')
  3. INSERT INTO expenses (treasury_id = 1 HARDCODED)
  4. if payment_method = 'cash': UPDATE treasuries SET balance -= amount WHERE id = 1
  5. if payment_method = 'bank_transfer': UPDATE banks SET balance -= amount WHERE id = bank_id
```

**Missing:** Edit (PUT) and Delete don't update treasury/bank balances.

### Revenue Create Flow
```
POST /api/revenues:
  Same pattern, treasury += amount WHERE id = 1 (HARDCODED)
```

---

## 10. Report Records

Reports are query-only (no writes). Key aggregation patterns:

### Sales Reports
- Sales totals: `SUM(total) FROM invoices WHERE status != 'cancelled'`
- Profit: `SUM(line_total - cost_wacc * quantity)` from invoice_lines
- Payment method breakdown: JOIN to payments/payment_allocations for multi

### Daily Treasury Report
Uses `calculateDailySummary` directly. Reports on per-day cash flow.

### Account Statements (`reports/queries/accounts.js`)
Reconstructs ledger from: opening_balance + invoice totals − payments − returns

---

---

## 11. Edit Invoice System

### How Invoice Edit Works (`editInvoice` in `invoiceService.js`)

```
editInvoice(id, payload):
  1. Reverse OLD stock for all lines (quantityDelta = +old_quantity)
  2. DELETE old invoice_lines
  3. Re-insert new lines (stock check → INSERT → adjustStock −qty)
  4. Recalculate: new subtotal, new discount, new total, new status
  5. Fully reverse OLD financial effects:
       cash     → treasury -= old_amount_received
       credit   → customer.opening_balance -= old_total; ajal_debt.status = voided
       bank     → bank.balance -= old_amount_received
       install. → treasury -= each_old_alloc; ajal_debt.status = voided
       multi    → per-alloc treasury/bank reversal
  6. DELETE old payment_allocations + payments (for this invoice)
  7. UPDATE invoices header (new totals, payment_type, status)
  8. Apply NEW financial effects (same logic as createInvoice)
```

**Edit vs Amend:** Edit is an in-place change (same invoice_no, same id). Amend creates a new invoice and cancels the original (two records, linked by `amended_by / amendment_of`).

**Edit guards:**
- Cannot edit a cancelled invoice
- Stock availability checked per new line

**Issue with edit:** Same BUG-02 applies — new `total` is still computed without line discounts or promotion discount.

---

## 12. Return System — How Everything Connects

### Return Type A: Invoice-Linked Return (`POST /api/invoices/:id/return`)

```
Client: SalesReturnFormPage → selects invoice → picks lines + quantities
Server: createReturn(invoiceId, payload)
  1. Validate returnable quantity per line (vs previous returns)
  2. lineTotal = unit_price × quantity (from original invoice price)
  3. INSERT sales_returns record
  4. INSERT sales_return_lines (with cost snapshots)
  5. adjustStock +quantity (items go back to warehouse)
  6. Reverse financial effect:
       credit invoice        → customer.balance -= total; ajal_debt.original -= total
       bank_transfer invoice → bank -= total
       multi invoice         → proportional split (total/invoice_total × alloc_amount)
       cash invoice / cash_back → treasury -= total
  7. UPDATE invoices.status → 'returned' or 'partially_returned'
```

### Return Type B: General Return (`POST /api/invoices/general-return`)

```
Client: GeneralReturnModal → no original invoice → enter items + quantities freely
Server: createGeneralReturn(payload)
  1. No invoice link (invoice_id = NULL)
  2. total = sum(qty × unit_price)
  3. INSERT sales_returns (no invoice_id)
  4. INSERT sales_return_lines (each line)
  5. adjustStock +quantity
  6. cash_back  → treasury -= total
     credit_note → customer.opening_balance -= total
```

### Return Edit & Cancel

**Cancel return (`POST /api/invoices/returns/:id/cancel`):**
```
1. Reverse stock (adjustStock -quantity per line)
2. Reverse financials (opposite of what createReturn did):
   cash_back    → treasury += total
   credit_note  → customer.balance += total
3. UPDATE sales_returns.status = 'cancelled'
4. Recalculate original invoice status
```

**Amend return (`PUT /api/invoices/returns/:id/amend`):**
```
1. cancelSalesReturn(original)       ← full reversal
2. createReturn OR createGeneralReturn (new data)
3. Link original.amended_by = new.id
4. Link new.amendment_of = original.id
5. New doc_no = original-A1, original-A2 etc.
```

### Purchase Returns

**Invoice-linked:** `purchases.routes.js` — separate flow from sales returns  
**General:** `POST /api/invoices/general-purchase-return` (inline in `invoices.routes.js`)

```
Purchase return:
  stock: adjustStock -quantity (items LEAVE warehouse — sent back to supplier)
  cash_back    → treasury += total
  credit_note  → supplier.opening_balance -= total (reduces what we owe)
```

---

## 13. Full Data Flow Map

```
USER ACTION                     CLIENT                         SERVER                         DB
─────────────────────────────────────────────────────────────────────────────────────────────
Add item to cart           posStore.addLine()              —                          localStorage (persist)
Apply promotion            posStore.evaluateCart()         POST /api/promotions/evaluate   promotions table
Hold invoice               posStore.holdCurrentInvoice()   POST /api/pos-drafts (type=held)  pos_drafts
Resume held                posStore.resumeHeldInvoice()    DELETE /api/pos-drafts/:id     —

Save invoice               POSPage.saveInvoice()           POST /api/invoices          invoices
  → cash payment                                           createInvoice()             treasuries.balance += total
  → credit payment                                                                     customers.opening_balance += total
                                                                                        ajal_debts INSERT
  → installment                                                                         treasury += upfront
                                                                                        ajal_debts INSERT (remaining)
  → multi payment                                                                        per-method routing
                                                                                        payment_allocations INSERT
  → stock deducted                                                                       stock_levels UPDATE
  → loyalty points                                                                       loyalty_transactions INSERT

View invoice               InvoiceDetailPage               GET /api/invoices/:id        —
  → cancel invoice         DELETE /api/invoices/:id        cancelInvoice()             invoices.status = cancelled
                                                                                        stock RESTORED
                                                                                        treasury/bank REVERSED
                                                                                        ajal_debt VOIDED
  → amend invoice          PUT /api/invoices/:id/amend     amendInvoice()              cancel original + create new

Create return              SalesReturnFormPage             POST /api/invoices/:id/return  sales_returns INSERT
                                                           createReturn()              stock RESTORED
                                                                                        treasury/bank ADJUSTED

Daily treasury             DailyTreasuryPage               GET /api/daily-sessions/today/summary
  → calculateDailySummary()                                cashBreakdown() + liveOpeningBalance()
  → close day              POST /api/daily-sessions/today/close  closeDailySession()  daily_sessions.status=closed

Expense                    ExpensesListPage                POST /api/expenses          expenses INSERT
                                                                                        treasuries.balance -= amount
Revenue                    RevenuesListPage                POST /api/revenues          revenues INSERT
                                                                                        treasuries.balance += amount

Customer payment           PaymentFormPage                 POST /api/payments          payments INSERT
                                                                                        customers.opening_balance -= amount
                                                                                        ajal_debts.paid_amount += amount
```

---

## 14. Summary of Issues by Severity

| ID | Severity | Area | Description |
|---|---|---|---|
| BUG-02 | CRITICAL | Invoice total | Server `total` excludes line discounts AND promotion_discount; client shows different (lower) total than what is stored/charged |
| BUG-03 | MEDIUM | Expenses/Revenues | Treasury always debited at hardcoded `id = 1`, ignores `default_treasury_id` from settings |
| BUG-04 | MEDIUM | Expenses/Revenues | Edit (PUT) does not reverse/re-apply treasury balance |
| BUG-05 | MEDIUM | Expenses/Revenues | Delete does not restore treasury balance |
| BUG-06 | MEDIUM | Daily Treasury | Retroactive cancellation hides prior-day cash flows in live summary for open days |
| BUG-11 | MEDIUM | Void invoice | `voidInvoice` doesn't set `cancelled_at`; cancellation reversals missing from daily treasury transaction list |
| BUG-07 | LOW | Invoice service | `generateInvoiceNumber()` is dead code (never called) |
| BUG-08 | LOW | Invoice cancel | `treasury_id` never stored on invoice; cancel always falls back to default treasury |
| BUG-09 | LOW | Discount guard | 15% limit checked against pre-line-discount subtotal, so limit is softer than intended |
| BUG-10 | LOW | Promotions | Promotion discount sent to server as `promotion_discount` but completely ignored; not stored separately |

---

## 15. Recommended Fixes (Priority Order)

### P1 — BUG-02: Fix Invoice Total Calculation (CRITICAL)

In `invoiceService.js createInvoice`, change `subtotal` to reflect line discounts, and read `promotion_discount`:

```js
// Before:
const rowSubtotal = quantity * unitPrice;
subtotal += rowSubtotal;

// After:
const rowSubtotal = quantity * unitPrice;
const lineNet = Math.max(0, rowSubtotal - lineDiscount);
subtotal += lineNet;  // subtotal = post-line-discount total

// And read promotion_discount:
const promoDiscount = Number(payload.promotion_discount || 0);
const total = Math.max(0, subtotal - discount - promoDiscount + increaseAmount);
```

Also update the INSERT to store `promotion_discount` column.  
Same fix needed in `editInvoice`.

### P2 — BUG-03/04/05: Expenses/Revenues Treasury

In `expenses.routes.js` and `revenues.routes.js`:

```js
// POST: replace id=1 hardcode
const tId = payload.treasury_id || db.prepare(
  "SELECT default_treasury_id FROM settings WHERE id = 1"
).get()?.default_treasury_id;
db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(amount, tId);

// PUT: fetch old record, reverse old balance, apply new
const old = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
if (old.payment_method === 'cash') treasury += old.amount;  // restore
// ...then apply new amount

// DELETE: fetch and reverse
const old = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
if (old.payment_method === 'cash') treasury += old.amount;  // restore before delete
```

### P3 — BUG-11: Fix `voidInvoice` to Set `cancelled_at`

```js
const now = new Date().toISOString().replace("T", " ").slice(0, 19);
db.prepare("UPDATE invoices SET status='cancelled', cancelled_at=?, cancelled_by=?, cancel_reason=? WHERE id=?")
  .run(now, userId, reason, invoiceId);
```

### P4 — BUG-08: Store `treasury_id` on Invoice

Add `treasury_id` column to the `INSERT INTO invoices` statement so the cancel/void path knows which treasury to reverse rather than always using the default.

### P5 — BUG-06: Cancellation Reversals in `cashBreakdown`

Either:
- Add a separate query for cancellation reversals keyed by `cancelled_at` date
- Or use a snapshot approach: lock down `cashBreakdown` figures when a day is closed
