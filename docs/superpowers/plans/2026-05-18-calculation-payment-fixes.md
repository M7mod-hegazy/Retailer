# Calculation & Payment Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 bugs in invoice totals, expense/revenue treasury handling, void invoice tracking, and promotion discount persistence.

**Architecture:** All changes are server-side only. The invoice total calculation is fixed in `createInvoice` and `editInvoice` to deduct line discounts and promotion_discount from stored totals. Expense/revenue routes are fixed to use the system's default treasury instead of a hardcoded id=1, and to reverse balances on edit and delete. Two new DB columns (`invoices.treasury_id`, `invoices.promotion_discount`) require a migration.

**Tech Stack:** Node.js, Express.js, better-sqlite3 (synchronous), Jest

---

## Bug Summary

| ID | Severity | File | Fix |
|---|---|---|---|
| BUG-02 | CRITICAL | `invoiceService.js` | `subtotal` and `total` must include line discounts and promotion_discount |
| BUG-03 | MEDIUM | `expenses.routes.js`, `revenues.routes.js` | Replace hardcoded `treasury id=1` with dynamic default |
| BUG-04 | MEDIUM | same | Edit (PUT) must reverse old balance and apply new |
| BUG-05 | MEDIUM | same | Delete must reverse balance before deleting |
| BUG-11 | MEDIUM | `invoiceService.js` | `voidInvoice` must set `cancelled_at`, `cancelled_by`, `cancel_reason` |
| BUG-08 | LOW-MEDIUM | migration + `invoiceService.js` | Add `treasury_id` column to invoices; store it on create |
| BUG-10 | LOW | migration + `invoiceService.js` | Add `promotion_discount` column to invoices; store it on create/edit |
| BUG-09 | LOW | `invoiceService.js` | Discount 15% guard should use post-line-discount subtotal (fixed by BUG-02) |
| BUG-07 | LOW | `invoiceService.js` | Remove dead `generateInvoiceNumber` function |

---

## Files Modified / Created

| File | Role |
|---|---|
| `server/src/services/invoiceService.js` | Fix `createInvoice`, `editInvoice`, `voidInvoice`; remove dead code |
| `server/src/routes/expenses.routes.js` | Fix POST/PUT/DELETE treasury handling |
| `server/src/routes/revenues.routes.js` | Fix POST/PUT/DELETE treasury handling |
| `electron/migrations/076_invoice_treasury_promo.js` | New migration: add `treasury_id` + `promotion_discount` to invoices |
| `server/tests/invoiceService.test.js` | Add tests for BUG-02, BUG-08, BUG-10, BUG-11, BUG-09 |
| `server/tests/expenses.test.js` | Add tests for BUG-03, BUG-04, BUG-05 |
| `server/tests/revenues.test.js` | Add tests for BUG-03, BUG-04, BUG-05 (mirror of expenses) |

---

## Task 1: BUG-02 — Fix Invoice Total Calculation (CRITICAL)

**Problem:** `createInvoice` accumulates `subtotal` using pre-line-discount row amounts (`qty × price`). It also ignores `promotion_discount` entirely. The stored `total` is therefore higher than what the customer was shown.

**Files:**
- Modify: `server/src/services/invoiceService.js:136-137` (createInvoice subtotal accumulation)
- Modify: `server/src/services/invoiceService.js:178-179` (createInvoice total computation)
- Modify: `server/src/services/invoiceService.js:636-650` (editInvoice subtotal accumulation)
- Modify: `server/src/services/invoiceService.js:665-666` (editInvoice total computation)
- Test: `server/tests/invoiceService.test.js`

- [ ] **Step 1: Write failing tests for BUG-02**

Add to `server/tests/invoiceService.test.js` (append inside the `describe` block, after existing tests):

```js
test("total deducts line discounts from subtotal", () => {
  // item qty=1 price=100 line_discount=10 → line_net=90
  // no header discount, no promo
  // expected: subtotal=90, total=90
  const inv = createInvoice({
    lines: [{ item_id: 1, quantity: 1, unit_price: 100, discount: 10 }],
    discount: 0,
    payment_type: "cash",
  });
  expect(inv.subtotal).toBe(90);
  expect(inv.total).toBe(90);
});

test("total deducts promotion_discount", () => {
  // qty=1 price=100, no line discount, header discount=0, promo=8
  // expected: subtotal=100, total=92
  const inv = createInvoice({
    lines: [{ item_id: 1, quantity: 1, unit_price: 100, discount: 0 }],
    discount: 0,
    promotion_discount: 8,
    payment_type: "cash",
  });
  expect(inv.subtotal).toBe(100);
  expect(inv.total).toBe(92);
});

test("total deducts both line discounts and promotion_discount and header discount", () => {
  // qty=1 price=100, line_discount=10 → line_net=90
  // header discount=5, promo=8
  // expected: subtotal=90, total = 90 - 5 - 8 = 77
  const inv = createInvoice({
    lines: [{ item_id: 1, quantity: 1, unit_price: 100, discount: 10 }],
    discount: 5,
    promotion_discount: 8,
    payment_type: "cash",
  });
  expect(inv.subtotal).toBe(90);
  expect(inv.total).toBe(77);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test --prefix server -- --testPathPattern=invoiceService
```

Expected: FAIL — `subtotal` and `total` reflect pre-discount values.

- [ ] **Step 3: Fix `createInvoice` — subtotal accumulation**

In `server/src/services/invoiceService.js`, change lines 136-137:

```js
// BEFORE:
const rowSubtotal = quantity * unitPrice;
subtotal += rowSubtotal;

// AFTER:
const rowSubtotal = quantity * unitPrice;
const lineNet = Math.max(0, rowSubtotal - lineDiscount);
subtotal += lineNet;
```

- [ ] **Step 4: Fix `createInvoice` — total computation and promotion_discount**

Change lines 166-179 (the discount guard and total computation):

```js
const discount = Number(payload.discount || 0);
const promoDiscount = Number(payload.promotion_discount || 0);

// BUG-09 also fixed here: subtotal is now post-line-discount, so 15% is correct
const maxDiscountAllowed = subtotal * 0.15;
if (discount > maxDiscountAllowed && !payload.supervisor_override) {
  const error = new Error("Discount exceeds the maximum allowed limit of 15%. Supervisor override required.");
  error.status = 403;
  error.code = 'DISCOUNT_LIMIT_EXCEEDED';
  throw error;
}

const increaseAmount = Math.max(0, Number(payload.increase || 0));
const total = Math.max(0, subtotal - discount - promoDiscount + increaseAmount);
```

- [ ] **Step 5: Fix `editInvoice` — subtotal accumulation**

In `editInvoice` (around line 636-650), change subtotal accumulation:

```js
// BEFORE:
subtotal += lineSubtotal;

// AFTER:
subtotal += lineTotal;   // lineTotal is already Math.max(0, lineSubtotal - lineDiscount)
```

- [ ] **Step 6: Fix `editInvoice` — total computation**

Change lines 664-666 (after the loop, where `newTotal` is computed):

```js
const discount = Number(payload.discount ?? invoice.discount ?? 0);
const increase = Number(payload.increase ?? invoice.increase ?? 0);
const promoDiscount = Number(payload.promotion_discount ?? invoice.promotion_discount ?? 0);
const newTotal = Math.max(0, subtotal - discount - promoDiscount + increase);
```

- [ ] **Step 7: Run tests to verify they pass**

```
npm test --prefix server -- --testPathPattern=invoiceService
```

Expected: PASS for all tests including the 3 new ones.

- [ ] **Step 8: Commit**

```bash
git add server/src/services/invoiceService.js server/tests/invoiceService.test.js
git commit -m "fix(invoice): deduct line discounts and promotion_discount from stored total (BUG-02, BUG-09)"
```

---

## Task 2: BUG-11 — Fix `voidInvoice` to Set `cancelled_at`

**Problem:** `voidInvoice` only sets `status = 'cancelled'` but never writes `cancelled_at`, `cancelled_by`, or `cancel_reason`. This means voided invoices are invisible to the `cancellationReversalSql` query (which filters on `cancelled_at IS NOT NULL`), so their daily treasury reversals are silently missing.

**Files:**
- Modify: `server/src/services/invoiceService.js:416` (the UPDATE inside `voidInvoice`)
- Test: `server/tests/invoiceService.test.js`

- [ ] **Step 1: Write failing test for BUG-11**

Append inside the `describe` block in `server/tests/invoiceService.test.js`:

```js
test("voidInvoice sets cancelled_at and cancel_reason", () => {
  const { getDb } = require("../src/config/database");
  const { voidInvoice } = require("../src/services/invoiceService");

  const inv = createInvoice({
    lines: [{ item_id: 1, quantity: 1, unit_price: 100 }],
    discount: 0,
    payment_type: "cash",
  });

  voidInvoice(inv.id, "test void reason", 1);

  const row = getDb().prepare("SELECT * FROM invoices WHERE id = ?").get(inv.id);
  expect(row.status).toBe("cancelled");
  expect(row.cancelled_at).toBeTruthy();
  expect(row.cancel_reason).toBe("test void reason");
  expect(row.cancelled_by).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test --prefix server -- --testPathPattern=invoiceService
```

Expected: FAIL — `cancelled_at` is null.

- [ ] **Step 3: Fix `voidInvoice` — set cancelled_at**

In `server/src/services/invoiceService.js`, find and replace the single-line UPDATE inside `voidInvoice` (around line 416):

```js
// BEFORE:
db.prepare("UPDATE invoices SET status = 'cancelled' WHERE id = ?").run(invoiceId);

// AFTER:
const now = new Date().toISOString().replace("T", " ").slice(0, 19);
db.prepare("UPDATE invoices SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ?")
  .run(now, userId || 1, reason || null, invoiceId);
```

- [ ] **Step 4: Run tests**

```
npm test --prefix server -- --testPathPattern=invoiceService
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/invoiceService.js server/tests/invoiceService.test.js
git commit -m "fix(invoice): voidInvoice now sets cancelled_at, cancelled_by, cancel_reason (BUG-11)"
```

---

## Task 3: BUG-08 + BUG-10 — Add `treasury_id` and `promotion_discount` Columns to Invoices

**Problem:** `invoices.treasury_id` never exists, so cancel/void always falls back to the system default treasury — wrong when a cashier chose a specific treasury. `invoices.promotion_discount` doesn't exist, so it can't be stored even after Task 1 computes it.

**Files:**
- Create: `electron/migrations/076_invoice_treasury_promo.js`
- Modify: `server/src/services/invoiceService.js` (INSERT in createInvoice; UPDATE in editInvoice)
- Test: `server/tests/invoiceService.test.js`

- [ ] **Step 1: Write failing test for BUG-08 + BUG-10**

Append inside the `describe` block in `server/tests/invoiceService.test.js`:

```js
test("createInvoice stores treasury_id on the invoice row", () => {
  const { getDb } = require("../src/config/database");
  // treasury id=1 is the default; use it explicitly
  const inv = createInvoice({
    lines: [{ item_id: 1, quantity: 1, unit_price: 100 }],
    discount: 0,
    payment_type: "cash",
    treasury_id: 1,
  });
  const row = getDb().prepare("SELECT treasury_id FROM invoices WHERE id = ?").get(inv.id);
  expect(row.treasury_id).toBe(1);
});

test("createInvoice stores promotion_discount on the invoice row", () => {
  const { getDb } = require("../src/config/database");
  const inv = createInvoice({
    lines: [{ item_id: 1, quantity: 1, unit_price: 100 }],
    discount: 0,
    promotion_discount: 15,
    payment_type: "cash",
  });
  const row = getDb().prepare("SELECT promotion_discount FROM invoices WHERE id = ?").get(inv.id);
  expect(row.promotion_discount).toBe(15);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test --prefix server -- --testPathPattern=invoiceService
```

Expected: FAIL — column does not exist.

- [ ] **Step 3: Create migration 076**

Create `electron/migrations/076_invoice_treasury_promo.js`:

```js
function up(db) {
  try { db.exec("ALTER TABLE invoices ADD COLUMN treasury_id INTEGER REFERENCES treasuries(id)"); } catch (_) {}
  try { db.exec("ALTER TABLE invoices ADD COLUMN promotion_discount REAL NOT NULL DEFAULT 0"); } catch (_) {}
}

module.exports = { up };
```

- [ ] **Step 4: Apply migration in test setup**

The test `beforeEach` calls `initDb(path)` which runs all migrations automatically. Verify migration 076 is in the directory and named correctly so `initDb` picks it up.

```
ls electron/migrations/ | sort | tail -3
```

Expected: `074_...`, `075_...`, `076_invoice_treasury_promo.js`

- [ ] **Step 5: Update `createInvoice` INSERT to include both new columns**

In `server/src/services/invoiceService.js`, find the `INSERT INTO invoices` statement (around line 193-209). Change it:

```js
// BEFORE column list:
"INSERT INTO invoices (invoice_no, customer_id, subtotal, discount, increase, total, payment_type, status, seller_id, user_id, amount_received) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"

// AFTER column list:
"INSERT INTO invoices (invoice_no, customer_id, subtotal, discount, increase, promotion_discount, total, payment_type, status, seller_id, user_id, amount_received, treasury_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
```

Also add the two new values at the end of the `.run(...)` call:

```js
.run(
  invoiceNo,
  payload.customer_id || null,
  subtotal,
  discount,
  increaseAmount,
  promoDiscount,          // NEW
  total,
  paymentType,
  remainingAmount > 0 ? (amountReceived > 0 ? "partial" : "unpaid") : "paid",
  payload.seller_id ? Number(payload.seller_id) : null,
  payload.user_id ? Number(payload.user_id) : null,
  amountReceived,
  payload.treasury_id || null,  // NEW
);
```

- [ ] **Step 6: Update `editInvoice` UPDATE to include promotion_discount**

In `editInvoice`, find the `UPDATE invoices SET ...` (around line 720-730). Add `promotion_discount`:

```js
db.prepare(`
  UPDATE invoices SET customer_id = ?, subtotal = ?, discount = ?, increase = ?,
    promotion_discount = ?, total = ?,
    payment_type = ?, amount_received = ?, status = ?, seller_id = ?
  WHERE id = ?
`).run(
  newCustomerId, subtotal, discount, increase,
  promoDiscount,  // NEW — already computed in Task 1 Step 6
  newTotal,
  newPaymentType, amountReceived, newStatus,
  payload.seller_id ? Number(payload.seller_id) : invoice.seller_id,
  invoiceId,
);
```

- [ ] **Step 7: Run tests**

```
npm test --prefix server -- --testPathPattern=invoiceService
```

Expected: PASS for all tests.

- [ ] **Step 8: Commit**

```bash
git add electron/migrations/076_invoice_treasury_promo.js server/src/services/invoiceService.js server/tests/invoiceService.test.js
git commit -m "feat(invoice): store treasury_id and promotion_discount on invoice row (BUG-08, BUG-10)"
```

---

## Task 4: BUG-03/04/05 — Fix Expenses Treasury Handling

**Problem 1 (BUG-03):** POST hardcodes `WHERE id = 1` instead of reading the system's `default_treasury_id`.
**Problem 2 (BUG-04):** PUT changes the DB record but never reverses the old treasury balance or applies the new one.
**Problem 3 (BUG-05):** DELETE removes the record without restoring the treasury balance.

**Files:**
- Modify: `server/src/routes/expenses.routes.js` (POST, PUT, DELETE handlers)
- Test: `server/tests/expenses.test.js`

- [ ] **Step 1: Write failing tests for BUG-03/04/05 in expenses**

Replace the contents of `server/tests/expenses.test.js` with the following (the existing tests are kept; new ones are added):

```js
const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createApp } = require("../src/app");
const { initDb, setDb, getDb } = require("../src/config/database");

let app;
let token;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-expenses-"));
  initDb(path.join(dir, "expenses.db"));
  app = createApp();
  token = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");
  // Ensure treasury id=1 exists with known balance
  const db = getDb();
  try {
    db.prepare("INSERT OR IGNORE INTO treasuries (id, name, balance) VALUES (1, 'الصندوق الرئيسي', 10000)").run();
    db.prepare("UPDATE settings SET default_treasury_id = 1 WHERE id = 1").run();
  } catch (_) {}
});

describe("Expenses Routes", () => {
  let expenseId;

  it("GET /api/expenses returns empty list", async () => {
    const res = await request(app).get("/api/expenses").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/expenses creates an expense and deducts from correct treasury (BUG-03)", async () => {
    const before = getDb().prepare("SELECT balance FROM treasuries WHERE id = 1").get()?.balance ?? 0;
    const res = await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "إيجار المحل", amount: 3000, payment_method: "cash" });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(3000);
    expenseId = res.body.data.id;
    const after = getDb().prepare("SELECT balance FROM treasuries WHERE id = 1").get()?.balance ?? 0;
    expect(after).toBe(before - 3000);
  });

  it("GET /api/expenses shows the created expense", async () => {
    const res = await request(app).get("/api/expenses").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.some(e => e.id === expenseId)).toBe(true);
  });

  it("PUT /api/expenses/:id adjusts treasury balance when amount changes (BUG-04)", async () => {
    const before = getDb().prepare("SELECT balance FROM treasuries WHERE id = 1").get()?.balance ?? 0;
    // Change amount from 3000 to 5000 — net effect should be -2000 more
    const res = await request(app)
      .put(`/api/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 5000 });
    expect(res.status).toBe(200);
    const after = getDb().prepare("SELECT balance FROM treasuries WHERE id = 1").get()?.balance ?? 0;
    expect(after).toBe(before - 2000);
  });

  it("DELETE /api/expenses/:id restores treasury balance (BUG-05)", async () => {
    const before = getDb().prepare("SELECT balance FROM treasuries WHERE id = 1").get()?.balance ?? 0;
    const res = await request(app).delete(`/api/expenses/${expenseId}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const after = getDb().prepare("SELECT balance FROM treasuries WHERE id = 1").get()?.balance ?? 0;
    // Amount at delete time is 5000 (updated above)
    expect(after).toBe(before + 5000);
  });
});
```

- [ ] **Step 2: Run tests to verify relevant ones fail**

```
npm test --prefix server -- --testPathPattern=expenses
```

Expected: treasury balance assertions fail (BUG-04 and BUG-05 tests fail).

- [ ] **Step 3: Fix POST — replace hardcoded treasury id=1**

In `server/src/routes/expenses.routes.js`, replace the treasury deduction block inside `router.post` (around line 89-91):

```js
// BEFORE:
if ((payload.payment_method || "cash") === "cash") {
  db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = 1").run(amount);
}

// AFTER:
if ((payload.payment_method || "cash") === "cash") {
  const tId = payload.treasury_id ||
    db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
  if (tId) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(amount, tId);
}
```

Also fix the INSERT to store the actual treasury_id (replace the hardcoded `1` in the INSERT VALUES):

```js
// BEFORE (in INSERT statement):
`INSERT INTO expenses
 (doc_no, amount, category_id, notes, description, payment_method, employee_id, receipt_image, is_recurring, recurring_frequency, treasury_id, bank_id, created_at, created_by)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`

// AFTER (pass tId as parameter — compute tId before the INSERT):
// 1. Compute tId before the INSERT:
const tId = payload.treasury_id ||
  db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id ||
  null;

// 2. Change the INSERT:
`INSERT INTO expenses
 (doc_no, amount, category_id, notes, description, payment_method, employee_id, receipt_image, is_recurring, recurring_frequency, treasury_id, bank_id, created_at, created_by)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

// 3. Add tId to the .run() arguments (replacing the hardcoded 1 positionally):
.run(
  docNo,
  Number(payload.amount || 0),
  payload.category_id || null,
  payload.notes || null,
  payload.description || null,
  payload.payment_method || "cash",
  payload.employee_id || null,
  payload.receipt_image || null,
  payload.is_recurring ? 1 : 0,
  payload.recurring_frequency || null,
  tId,                          // was hardcoded 1
  payload.bank_id || null,
  `${createdDate} ${new Date().toTimeString().slice(0, 8)}`,
  req.user?.id || null,
)
```

- [ ] **Step 4: Fix PUT — reverse old balance, apply new**

Replace the entire `router.put("/:id", ...)` handler in `expenses.routes.js`:

```js
router.put("/:id", requirePagePermission("expenses", "edit"), (req, res) => {
  try {
    const db = getDb();
    const payload = req.body || {};
    const old = db.prepare("SELECT * FROM expenses WHERE id = ?").get(req.params.id);
    if (!old) return res.status(404).json({ success: false, message: "Expense not found" });

    db.transaction(() => {
      // Reverse old balance effect
      if ((old.payment_method || "cash") === "cash" && old.amount > 0) {
        const tId = old.treasury_id ||
          db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
        if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(Number(old.amount), tId);
      } else if (old.payment_method === "bank_transfer" && old.bank_id && old.amount > 0) {
        db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(Number(old.amount), old.bank_id);
      }

      db.prepare(`UPDATE expenses SET amount = COALESCE(?, amount), category_id = COALESCE(?, category_id), notes = COALESCE(?, notes), description = COALESCE(?, description), payment_method = COALESCE(?, payment_method), updated_at = datetime('now') WHERE id = ?`)
        .run(payload.amount != null ? Number(payload.amount) : null, payload.category_id || null, payload.notes || null, payload.description || null, payload.payment_method || null, req.params.id);

      // Re-fetch updated record and apply new balance effect
      const updated = db.prepare("SELECT * FROM expenses WHERE id = ?").get(req.params.id);
      const newAmount = Number(updated.amount || 0);
      if ((updated.payment_method || "cash") === "cash" && newAmount > 0) {
        const tId = updated.treasury_id ||
          db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
        if (tId) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(newAmount, tId);
      } else if (updated.payment_method === "bank_transfer" && updated.bank_id && newAmount > 0) {
        db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(newAmount, updated.bank_id);
      }
    })();

    req.audit("update", "expenses", { id: req.params.id }, `💰 تم تعديل مصروف #${req.params.id}${payload.amount != null ? ` — المبلغ: ${Number(payload.amount).toLocaleString('ar-EG')}` : ''}`, `/expenses`);
    res.json({ success: true, data: db.prepare("SELECT * FROM expenses WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
```

- [ ] **Step 5: Fix DELETE — reverse balance before deleting**

Replace the `router.delete("/:id", ...)` handler in `expenses.routes.js`:

```js
router.delete("/:id", requirePagePermission("expenses", "delete"), (req, res) => {
  try {
    const db = getDb();
    const old = db.prepare("SELECT * FROM expenses WHERE id = ?").get(req.params.id);
    if (!old) return res.status(404).json({ success: false, message: "Expense not found" });

    db.transaction(() => {
      // Reverse balance before deleting
      if ((old.payment_method || "cash") === "cash" && Number(old.amount) > 0) {
        const tId = old.treasury_id ||
          db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
        if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(Number(old.amount), tId);
      } else if (old.payment_method === "bank_transfer" && old.bank_id && Number(old.amount) > 0) {
        db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(Number(old.amount), old.bank_id);
      }
      db.prepare("DELETE FROM expenses WHERE id = ?").run(req.params.id);
    })();

    req.audit("delete", "expenses", { id: req.params.id }, `💰 تم حذف مصروف`, `/expenses`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
```

- [ ] **Step 6: Run expenses tests**

```
npm test --prefix server -- --testPathPattern=expenses
```

Expected: PASS for all tests.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/expenses.routes.js server/tests/expenses.test.js
git commit -m "fix(expenses): dynamic treasury id, reverse balance on edit and delete (BUG-03, BUG-04, BUG-05)"
```

---

## Task 5: BUG-03/04/05 — Fix Revenues Treasury Handling

**Problem:** Same three bugs mirrored in `revenues.routes.js`.

**Files:**
- Modify: `server/src/routes/revenues.routes.js` (POST, PUT, DELETE handlers)
- Test: `server/tests/revenues.test.js`

- [ ] **Step 1: Write failing tests for revenues**

Replace the contents of `server/tests/revenues.test.js` with:

```js
const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createApp } = require("../src/app");
const { initDb, setDb, getDb } = require("../src/config/database");

let app;
let token;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-revenues-"));
  initDb(path.join(dir, "revenues.db"));
  app = createApp();
  token = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");
  const db = getDb();
  try {
    db.prepare("INSERT OR IGNORE INTO treasuries (id, name, balance) VALUES (1, 'الصندوق الرئيسي', 10000)").run();
    db.prepare("UPDATE settings SET default_treasury_id = 1 WHERE id = 1").run();
  } catch (_) {}
});

describe("Revenues Routes", () => {
  let revenueId;

  it("GET /api/revenues returns empty list", async () => {
    const res = await request(app).get("/api/revenues").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/revenues creates a revenue and credits correct treasury (BUG-03)", async () => {
    const before = getDb().prepare("SELECT balance FROM treasuries WHERE id = 1").get()?.balance ?? 0;
    const res = await request(app)
      .post("/api/revenues")
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "إيراد متنوع", amount: 2000, payment_method: "cash" });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(2000);
    revenueId = res.body.data.id;
    const after = getDb().prepare("SELECT balance FROM treasuries WHERE id = 1").get()?.balance ?? 0;
    expect(after).toBe(before + 2000);
  });

  it("PUT /api/revenues/:id adjusts treasury balance when amount changes (BUG-04)", async () => {
    const before = getDb().prepare("SELECT balance FROM treasuries WHERE id = 1").get()?.balance ?? 0;
    const res = await request(app)
      .put(`/api/revenues/${revenueId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 4000 });
    expect(res.status).toBe(200);
    const after = getDb().prepare("SELECT balance FROM treasuries WHERE id = 1").get()?.balance ?? 0;
    expect(after).toBe(before + 2000);
  });

  it("DELETE /api/revenues/:id reverses treasury balance (BUG-05)", async () => {
    const before = getDb().prepare("SELECT balance FROM treasuries WHERE id = 1").get()?.balance ?? 0;
    const res = await request(app).delete(`/api/revenues/${revenueId}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const after = getDb().prepare("SELECT balance FROM treasuries WHERE id = 1").get()?.balance ?? 0;
    expect(after).toBe(before - 4000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test --prefix server -- --testPathPattern=revenues
```

Expected: FAIL on BUG-04 and BUG-05 tests.

- [ ] **Step 3: Fix POST in revenues.routes.js — replace hardcoded treasury id=1**

In `server/src/routes/revenues.routes.js`, in `router.post`, replace the treasury update (around line 88-90):

```js
// BEFORE:
if ((payload.payment_method || "cash") === "cash") {
  db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = 1").run(amount);
}

// AFTER:
if ((payload.payment_method || "cash") === "cash") {
  const tId = payload.treasury_id ||
    db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
  if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(amount, tId);
}
```

- [ ] **Step 4: Fix PUT in revenues.routes.js**

Replace the entire `router.put("/:id", ...)` handler:

```js
router.put("/:id", requirePagePermission("revenues", "edit"), (req, res) => {
  try {
    const db = getDb();
    const payload = req.body || {};
    const old = db.prepare("SELECT * FROM revenues WHERE id = ?").get(req.params.id);
    if (!old) return res.status(404).json({ success: false, message: "Revenue not found" });

    db.transaction(() => {
      // Reverse old balance effect
      if ((old.payment_method || "cash") === "cash" && Number(old.amount) > 0) {
        const tId = old.treasury_id ||
          db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
        if (tId) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(Number(old.amount), tId);
      } else if (old.payment_method === "bank_transfer" && old.bank_id && Number(old.amount) > 0) {
        db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(Number(old.amount), old.bank_id);
      }

      db.prepare(`UPDATE revenues SET amount = COALESCE(?, amount), category_id = COALESCE(?, category_id), notes = COALESCE(?, notes), description = COALESCE(?, description), payment_method = COALESCE(?, payment_method), updated_at = datetime('now') WHERE id = ?`)
        .run(payload.amount != null ? Number(payload.amount) : null, payload.category_id || null, payload.notes || null, payload.description || null, payload.payment_method || null, req.params.id);

      // Re-fetch and apply new balance effect
      const updated = db.prepare("SELECT * FROM revenues WHERE id = ?").get(req.params.id);
      const newAmount = Number(updated.amount || 0);
      if ((updated.payment_method || "cash") === "cash" && newAmount > 0) {
        const tId = updated.treasury_id ||
          db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
        if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(newAmount, tId);
      } else if (updated.payment_method === "bank_transfer" && updated.bank_id && newAmount > 0) {
        db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(newAmount, updated.bank_id);
      }
    })();

    req.audit("update", "revenues", { id: req.params.id }, `💰 تم تعديل إيراد #${req.params.id}${payload.amount != null ? ` — المبلغ: ${Number(payload.amount).toLocaleString('ar-EG')}` : ''}`);
    res.json({ success: true, data: db.prepare("SELECT * FROM revenues WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
```

- [ ] **Step 5: Fix DELETE in revenues.routes.js**

Replace the `router.delete("/:id", ...)` handler:

```js
router.delete("/:id", requirePagePermission("revenues", "delete"), (req, res) => {
  try {
    const db = getDb();
    const old = db.prepare("SELECT * FROM revenues WHERE id = ?").get(req.params.id);
    if (!old) return res.status(404).json({ success: false, message: "Revenue not found" });

    db.transaction(() => {
      if ((old.payment_method || "cash") === "cash" && Number(old.amount) > 0) {
        const tId = old.treasury_id ||
          db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
        if (tId) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(Number(old.amount), tId);
      } else if (old.payment_method === "bank_transfer" && old.bank_id && Number(old.amount) > 0) {
        db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(Number(old.amount), old.bank_id);
      }
      db.prepare("DELETE FROM revenues WHERE id = ?").run(req.params.id);
    })();

    req.audit("delete", "revenues", { id: req.params.id }, `💰 تم حذف إيراد`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
```

- [ ] **Step 6: Run revenues tests**

```
npm test --prefix server -- --testPathPattern=revenues
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/revenues.routes.js server/tests/revenues.test.js
git commit -m "fix(revenues): dynamic treasury id, reverse balance on edit and delete (BUG-03, BUG-04, BUG-05)"
```

---

## Task 6: BUG-07 — Remove Dead Code `generateInvoiceNumber`

**Problem:** Function defined at lines 8-14 of `invoiceService.js` but never called. Dead code creates confusion.

**Files:**
- Modify: `server/src/services/invoiceService.js:8-14`

- [ ] **Step 1: Delete the dead function**

In `server/src/services/invoiceService.js`, delete lines 8-14:

```js
// DELETE this entire function:
function generateInvoiceNumber(db) {
  const settings = db.prepare("SELECT branch_code, invoice_prefix FROM settings WHERE id = 1").get() || {};
  const prefix = settings.invoice_prefix || "INV-";
  const branch = settings.branch_code ? `${settings.branch_code}-` : "";
  const count = db.prepare("SELECT COUNT(*) AS total FROM invoices").get().total + 1;
  return `${prefix}${branch}${String(count).padStart(6, "0")}`;
}
```

- [ ] **Step 2: Run full test suite to confirm nothing broke**

```
npm test --prefix server
```

Expected: PASS — no test imported or called `generateInvoiceNumber`.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/invoiceService.js
git commit -m "refactor(invoice): remove dead generateInvoiceNumber function (BUG-07)"
```

---

## Task 7: Final Integration Check

- [ ] **Step 1: Run full server test suite**

```
npm test --prefix server
```

Expected: All tests pass. Note final pass count.

- [ ] **Step 2: Verify migration file is present**

```
ls electron/migrations/ | grep 076
```

Expected: `076_invoice_treasury_promo.js`

- [ ] **Step 3: Start dev server and smoke-test manually**

```
npm run dev:server
```

Create one POS invoice with a line discount and promotion discount. Verify:
- Displayed total matches stored `total` in the DB
- Treasury balance is deducted by the correct (lower) amount

- [ ] **Step 4: Final commit if any fixes applied during smoke test**

```bash
git add -p
git commit -m "fix: post-smoke-test corrections"
```

---

## Notes

- **BUG-06** (daily treasury retroactive cancellation) is deliberately excluded from this plan. It requires either a snapshot approach (lock cashBreakdown when day closes) or a separate cancellation-reversal query keyed by `cancelled_at`. This is a reporting/UX concern with no data loss risk and warrants its own separate plan.
- **BUG-09** is automatically resolved when BUG-02 is fixed — once `subtotal` is post-line-discount, the 15% guard applies to the correct net amount with no additional code change.
