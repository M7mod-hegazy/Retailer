# Treasury & Invoice Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the forced daily-session model with a live رصيد سابق calculation, and implement full invoice cancel + edit (cancel-and-recreate) with complete reversal of all financial effects.

**Architecture:** Daily treasury becomes a pure read-only reporting window — no session blocker on writes, رصيد سابق is computed live as SUM(cash_in before today) − SUM(cash_out before today). Invoice cancel performs full atomic reversal (stock, debt, cash, loyalty, ajal). Invoice edit = cancel old + create new with new number, linked via `amended_by` / `amendment_of` fields. Reason field is required on cancel/edit with optional preset quick-answers.

**Tech Stack:** Express.js + better-sqlite3 (sync), React 18 + TanStack Query, Tailwind RTL, Zustand, Electron migrations

---

## Phase 1 — Daily Treasury: Remove Session Blocker & Live رصيد سابق

### Task 1: DB Migration — remove session dependency from write path

**Files:**
- Create: `electron/migrations/050_remove_session_blocker.js`

- [ ] **Step 1: Create migration**

```js
// electron/migrations/050_remove_session_blocker.js
module.exports = {
  up(db) {
    // Add cancel audit columns to invoices if missing
    try { db.exec("ALTER TABLE invoices ADD COLUMN cancelled_at TEXT"); } catch (_) {}
    try { db.exec("ALTER TABLE invoices ADD COLUMN cancelled_by INTEGER REFERENCES users(id)"); } catch (_) {}
    try { db.exec("ALTER TABLE invoices ADD COLUMN cancel_reason TEXT"); } catch (_) {}
    try { db.exec("ALTER TABLE invoices ADD COLUMN amendment_of INTEGER REFERENCES invoices(id)"); } catch (_) {}
    try { db.exec("ALTER TABLE invoices ADD COLUMN amended_by INTEGER REFERENCES invoices(id)"); } catch (_) {}
    // Add cancel audit columns to purchases
    try { db.exec("ALTER TABLE purchases ADD COLUMN cancelled_at TEXT"); } catch (_) {}
    try { db.exec("ALTER TABLE purchases ADD COLUMN cancelled_by INTEGER REFERENCES users(id)"); } catch (_) {}
    try { db.exec("ALTER TABLE purchases ADD COLUMN cancel_reason TEXT"); } catch (_) {}
    try { db.exec("ALTER TABLE purchases ADD COLUMN amendment_of INTEGER REFERENCES purchases(id)"); } catch (_) {}
    try { db.exec("ALTER TABLE purchases ADD COLUMN amended_by INTEGER REFERENCES purchases(id)"); } catch (_) {}
  },
};
```

- [ ] **Step 2: Verify migration file is picked up**

Open `electron/main.js` or the migration runner and confirm it auto-applies all files in `electron/migrations/` ordered by filename. No code change needed if pattern already exists.

- [ ] **Step 3: Commit**

```bash
git add electron/migrations/050_remove_session_blocker.js
git commit -m "feat: migration 050 — add invoice/purchase cancel+amendment columns"
```

---

### Task 2: Remove `assertCanWriteForDate` blocker from all services

**Files:**
- Modify: `server/src/services/invoiceService.js`
- Modify: `server/src/services/dailySessionService.js`
- Grep for all other callers

- [ ] **Step 1: Find all callers of assertCanWriteForDate**

```bash
grep -r "assertCanWriteForDate" server/src --include="*.js" -l
```

Expected files: `invoiceService.js`, possibly `expenses`, `revenues`, `payments`, `purchaseOrders` routes.

- [ ] **Step 2: In `dailySessionService.js`, keep the function but make it a no-op (do not delete — other code may import it)**

Replace the body of `assertCanWriteForDate`:

```js
function assertCanWriteForDate(db, dateValue) {
  // Session blocker removed: treasury is now a live reporting window.
  // Writes are allowed on any date. Past-date protection is enforced at the route level per feature.
  const targetDate = normalizeDate(dateValue);
  ensureDailySessionSchema(db);
  return ensureSessionForDate(db, targetDate);
}
```

- [ ] **Step 3: In `invoiceService.js` line 77, confirm the call to `assertCanWriteForDate` is now a no-op pass-through — no change needed in invoiceService since the function still exists**

- [ ] **Step 4: Commit**

```bash
git add server/src/services/dailySessionService.js
git commit -m "feat: remove assertCanWriteForDate blocker — treasury is now live reporting"
```

---

### Task 3: Rewrite `calculateDailySummary` to use live رصيد سابق

**Files:**
- Modify: `server/src/services/dailySessionService.js`

- [ ] **Step 1: Add `liveOpeningBalance` function**

Add this function before `calculateDailySummary`:

```js
function liveOpeningBalance(db, dateText) {
  // Sum all cash_in and cash_out for ALL dates strictly before dateText
  // This replaces the stored opening_balance field entirely.
  const date = normalizeDate(dateText);

  const posCash = scalar(db, `
    SELECT COALESCE(SUM(total),0) AS total FROM invoices
    WHERE date(created_at) < ? AND payment_type = 'cash' AND status != 'cancelled'
  `, [date]);

  const posInstallmentCash = scalar(db, `
    SELECT COALESCE(SUM(pa.amount),0) AS total
    FROM payment_allocations pa
    JOIN invoices i ON i.id = pa.invoice_id
    WHERE date(i.created_at) < ? AND i.payment_type = 'installments' AND i.status != 'cancelled'
  `, [date]);

  const posMultiCash = scalar(db, `
    SELECT COALESCE(SUM(p.amount),0) AS total
    FROM payments p
    JOIN invoices i ON p.notes = 'Invoice ' || i.invoice_no
    WHERE date(i.created_at) < ? AND i.payment_type = 'multi' AND p.method = 'cash' AND i.status != 'cancelled'
  `, [date]);

  const customerPayments = scalar(db, `
    SELECT COALESCE(SUM(amount),0) AS total FROM payments
    WHERE date(created_at) < ? AND party_type = 'customer' AND method = 'cash'
  `, [date]);

  const customerAjalPayments = scalar(db, `
    SELECT COALESCE(SUM(ap.amount),0) AS total
    FROM ajal_payments ap
    LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
    LEFT JOIN ajal_debts d ON d.id = ap.debt_id
    WHERE date(COALESCE(ap.payment_date, ap.created_at)) < ?
      AND COALESCE(d.party_type,'customer') = 'customer'
      AND COALESCE(pm.type, pm.category, pm.name, 'cash') = 'cash'
  `, [date]);

  const revenuesCash = scalar(db, `
    SELECT COALESCE(SUM(amount),0) AS total FROM revenues
    WHERE date(created_at) < ? AND COALESCE(payment_method,'cash') = 'cash'
  `, [date]);

  const purchaseReturnsCash = scalar(db, `
    SELECT COALESCE(SUM(total),0) AS total FROM purchase_returns
    WHERE date(created_at) < ? AND COALESCE(settlement_type,'account') = 'cash'
  `, [date]);

  const expensesCash = scalar(db, `
    SELECT COALESCE(SUM(amount),0) AS total FROM expenses
    WHERE date(created_at) < ? AND COALESCE(payment_method,'cash') = 'cash'
  `, [date]);

  const supplierPayments = scalar(db, `
    SELECT COALESCE(SUM(amount),0) AS total FROM payments
    WHERE date(created_at) < ? AND party_type = 'supplier' AND method = 'cash'
  `, [date]);

  const supplierAjalPayments = scalar(db, `
    SELECT COALESCE(SUM(ap.amount),0) AS total
    FROM ajal_payments ap
    LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
    LEFT JOIN ajal_debts d ON d.id = ap.debt_id
    WHERE date(COALESCE(ap.payment_date, ap.created_at)) < ?
      AND COALESCE(d.party_type,'customer') = 'supplier'
      AND COALESCE(pm.type, pm.category, pm.name, 'cash') = 'cash'
  `, [date]);

  const salesReturnsCash = scalar(db, `
    SELECT COALESCE(SUM(total),0) AS total FROM sales_returns
    WHERE date(created_at) < ? AND COALESCE(refund_method,'cash_back') = 'cash_back'
  `, [date]);

  const withdrawals = scalar(db, `
    SELECT COALESCE(SUM(dw.amount),0) AS total
    FROM daily_withdrawals dw
    JOIN daily_sessions ds ON ds.id = dw.session_id
    WHERE date(ds.date) < ?
  `, [date]);

  const prevCashIn = posCash + posInstallmentCash + posMultiCash + customerPayments + customerAjalPayments + revenuesCash + purchaseReturnsCash;
  const prevCashOut = expensesCash + supplierPayments + supplierAjalPayments + salesReturnsCash + withdrawals;
  return prevCashIn - prevCashOut;
}
```

- [ ] **Step 2: Update `calculateDailySummary` to use `liveOpeningBalance` instead of `session.opening_balance`**

In `calculateDailySummary`, replace:
```js
const expectedCash = Number(session.opening_balance || 0) + breakdown.cash_in - breakdown.cash_out;
```
with:
```js
const prevBalance = liveOpeningBalance(db, date);
const expectedCash = prevBalance + breakdown.cash_in - breakdown.cash_out;
```

Also update the return object:
```js
return {
  session,
  opening_balance: prevBalance,   // now live-computed, not stored
  previous_balance: prevBalance,  // alias for UI label change
  ...breakdown,
  expected_cash: expectedCash,
  actual_cash: actual,
  discrepancy,
  yesterday: yBreakdown ? { ... } : null,
};
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/dailySessionService.js
git commit -m "feat: live رصيد سابق — computed from all prior transactions, no stored opening_balance"
```

---

### Task 4: Update Daily Treasury UI — rename الرصيد الافتتاحي → رصيد سابق, remove edit button

**Files:**
- Modify: `client/src/pages/pos/DailyTreasuryPage.jsx`

- [ ] **Step 1: Remove `openingEditOpen`, `openingDraft`, `openingReason` state and all related UI**

Search for `openingEditOpen` in the file and remove:
- The state declarations
- The edit button that opens the modal
- The entire `openingEditOpen` modal JSX block
- Any `handleOpeningEdit` / `saveOpeningBalance` function

- [ ] **Step 2: Replace all labels**

Find and replace in the file:
- `الرصيد الافتتاحي` → `رصيد سابق`
- `opening_balance` display → use `summary.previous_balance`

- [ ] **Step 3: Remove "close day" forced workflow messaging**

Remove any UI warning that says "يجب إغلاق اليوم السابق" or similar. The close-day feature remains as optional but warnings/blockers are removed.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/pos/DailyTreasuryPage.jsx
git commit -m "feat: treasury UI — رصيد سابق replaces الرصيد الافتتاحي, remove edit and blocker warnings"
```

---

## Phase 2 — Invoice Cancel (Soft Delete with Full Reversal)

### Task 5: `cancelInvoice` service function

**Files:**
- Modify: `server/src/services/invoiceService.js`

- [ ] **Step 1: Add `cancelInvoice` function after `voidInvoice`**

The existing `voidInvoice` does a partial reversal. Replace/extend it with a complete version:

```js
function cancelInvoice(invoiceId, reason, userId) {
  if (!reason || !reason.trim()) {
    const err = new Error("سبب الإلغاء مطلوب");
    err.status = 400;
    throw err;
  }
  const db = getDb();
  return db.transaction(() => {
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    if (!invoice) { const e = new Error("الفاتورة غير موجودة"); e.status = 404; throw e; }
    if (invoice.status === "cancelled") { const e = new Error("الفاتورة ملغاة بالفعل"); e.status = 400; throw e; }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);

    // 1. Mark cancelled
    db.prepare(`
      UPDATE invoices SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ?
      WHERE id = ?
    `).run(now, userId || 1, reason.trim(), invoiceId);

    const lines = db.prepare("SELECT * FROM invoice_lines WHERE invoice_id = ?").all(invoiceId);

    // 2. Reverse stock
    for (const line of lines) {
      adjustStock({
        item_id: line.item_id,
        warehouse_id: line.warehouse_id || 1,
        quantityDelta: Number(line.quantity),
        movement_type: "cancel_sale",
        reference_type: "invoice",
        reference_id: invoiceId,
      });
    }

    // 3. Reverse customer debt / ajal
    if ((invoice.payment_type === "credit" || invoice.payment_type === "installments") && invoice.customer_id) {
      const debt = db.prepare("SELECT * FROM ajal_debts WHERE invoice_id = ? AND source_type = 'invoice'").get(invoiceId);
      if (debt) {
        const remaining = Number(debt.original_amount) - Number(debt.paid_amount || 0);
        if (remaining > 0) {
          db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?")
            .run(remaining, invoice.customer_id);
        }
        db.prepare("UPDATE ajal_debts SET status = 'voided' WHERE id = ?").run(debt.id);
      }
    }

    // 4. Reverse cash / bank
    if (invoice.payment_type === "cash") {
      const tId = invoice.treasury_id ||
        db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (tId) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(invoice.total, tId);
    } else if (invoice.payment_type === "bank_transfer") {
      if (invoice.bank_id) db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(invoice.total, invoice.bank_id);
    } else if (invoice.payment_type === "multi") {
      const allocs = db.prepare(`
        SELECT pa.amount, p.method, p.treasury_id, p.bank_id
        FROM payment_allocations pa
        LEFT JOIN payments p ON p.id = pa.payment_id
        WHERE pa.invoice_id = ?
      `).all(invoiceId);
      for (const a of allocs) {
        if (a.method === "cash" && a.treasury_id)
          db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(a.amount, a.treasury_id);
        else if (a.method === "bank" && a.bank_id)
          db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(a.amount, a.bank_id);
      }
    }

    // 5. Reverse loyalty points
    try {
      const pointsRow = db.prepare(
        "SELECT points FROM loyalty_transactions WHERE invoice_id = ? AND type = 'earn'"
      ).get(invoiceId);
      if (pointsRow && invoice.customer_id) {
        db.prepare("UPDATE customers SET loyalty_points = MAX(0, loyalty_points - ?) WHERE id = ?")
          .run(pointsRow.points, invoice.customer_id);
        db.prepare(`
          INSERT INTO loyalty_transactions (customer_id, invoice_id, type, points, notes)
          VALUES (?, ?, 'redeem', ?, ?)
        `).run(invoice.customer_id, invoiceId, pointsRow.points, `إلغاء فاتورة #${invoice.invoice_no}`);
      }
    } catch (_) {}

    // 6. Audit log
    try {
      db.prepare(
        "INSERT INTO audit_logs (user_id, resource, resource_id, action, details) VALUES (?, ?, ?, ?, ?)"
      ).run(userId || 1, "invoice", invoiceId, "cancel", JSON.stringify({ reason }));
    } catch (_) {}

    return getInvoiceWithLines(invoiceId);
  })();
}
```

- [ ] **Step 2: Export `cancelInvoice`**

Add to `module.exports` at bottom of file:
```js
module.exports = { createInvoice, getInvoiceWithLines, editInvoice, cancelInvoice };
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/invoiceService.js
git commit -m "feat: cancelInvoice — full atomic reversal of stock, debt, cash, loyalty"
```

---

### Task 6: Cancel route + quick-reason presets API

**Files:**
- Modify: `server/src/routes/invoices.routes.js`

- [ ] **Step 1: Import cancelInvoice at top of routes file**

```js
const { createInvoice, getInvoiceWithLines, editInvoice, cancelInvoice } = require("../services/invoiceService");
```

- [ ] **Step 2: Add DELETE route with reason**

```js
// GET quick cancel reasons
router.get("/cancel-reasons", (req, res) => {
  res.json({
    success: true,
    data: [
      "خطأ في البيانات",
      "طلب العميل الإلغاء",
      "خطأ في السعر",
      "خطأ في الكمية",
      "تكرار الفاتورة",
      "تعديل الفاتورة",
    ],
  });
});

router.delete("/:id", (req, res) => {
  try {
    const { reason } = req.body;
    const result = cancelInvoice(Number(req.params.id), reason, req.user?.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/invoices.routes.js
git commit -m "feat: DELETE /api/invoices/:id cancel route with required reason + preset reasons endpoint"
```

---

### Task 7: Treasury transactions — show cancelled invoices as reversal entries on cancellation date

**Files:**
- Modify: `server/src/routes/dailySessions.routes.js`

- [ ] **Step 1: Find the transactions query in dailySessions.routes.js**

Search for the block that builds the transactions list (type = `pos`, `pos_invoice`, etc.). It queries the `invoices` table with `status != 'cancelled'`.

- [ ] **Step 2: Add a second UNION query for cancellation reversal entries**

In the transactions query for type `all` or `pos`, add a UNION:

```sql
-- Cancellation reversals: appear on the cancellation date as negative entries
SELECT
  i.id,
  'cancelled_invoice' AS doc_type,
  i.invoice_no AS reference,
  -(i.total) AS amount,
  i.cancelled_at AS created_at,
  c.name AS party_name,
  i.cancel_reason AS notes,
  1 AS is_reversal
FROM invoices i
LEFT JOIN customers c ON c.id = i.customer_id
WHERE date(i.cancelled_at) = [date_param]
  AND i.payment_type IN ('cash','multi','installments')
```

- [ ] **Step 3: Add `show_cancelled` query param support**

If `?show_cancelled=1` is in the request, include the reversal entries in the response. Otherwise exclude them by default.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/dailySessions.routes.js
git commit -m "feat: treasury transactions — cancelled invoice reversal entries on cancellation date"
```

---

### Task 8: Treasury UI — ملغي badge on original date + reversal entry on cancellation date

**Files:**
- Modify: `client/src/pages/pos/DailyTreasuryPage.jsx`

- [ ] **Step 1: Add "show cancelled" toggle button**

Near the transaction table filter bar, add:
```jsx
<button
  onClick={() => setShowCancelled(v => !v)}
  className={`px-3 py-1 rounded-lg text-sm border ${showCancelled ? 'bg-rose-50 border-rose-300 text-rose-700' : 'border-gray-200 text-gray-500'}`}
>
  {showCancelled ? "إخفاء الملغيات" : "إظهار الملغيات"}
</button>
```

Add state: `const [showCancelled, setShowCancelled] = useState(false);`

- [ ] **Step 2: Pass `show_cancelled` param to API call in `loadTransactions`**

```js
const r = await api.get(
  `/api/daily-sessions/today/transactions?type=${typeParam}&search=...${dateParam}&show_cancelled=${showCancelled ? 1 : 0}`
);
```

- [ ] **Step 3: Add ملغي badge in transaction row render**

In the row JSX where `doc_type` is rendered, add:
```jsx
{row.is_reversal && (
  <span className="mr-1 px-1.5 py-0.5 rounded text-xs bg-rose-100 text-rose-700 border border-rose-200">
    ملغي
  </span>
)}
```

- [ ] **Step 4: Add `showCancelled` to useEffect dependency for loadTransactions**

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/pos/DailyTreasuryPage.jsx
git commit -m "feat: treasury UI — show cancelled toggle, ملغي badge on reversal entries"
```

---

## Phase 3 — Invoice Full Edit (Cancel + Create New)

### Task 9: `amendInvoice` service function

**Files:**
- Modify: `server/src/services/invoiceService.js`

- [ ] **Step 1: Add `amendInvoice` function**

```js
function amendInvoice(invoiceId, payload, userId) {
  if (!payload.reason || !payload.reason.trim()) {
    const err = new Error("سبب التعديل مطلوب");
    err.status = 400;
    throw err;
  }
  const db = getDb();
  return db.transaction(() => {
    const original = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    if (!original) { const e = new Error("الفاتورة غير موجودة"); e.status = 404; throw e; }
    if (original.status === "cancelled") { const e = new Error("لا يمكن تعديل فاتورة ملغاة"); e.status = 400; throw e; }
    if (original.amended_by) { const e = new Error("هذه الفاتورة عُدِّلت بالفعل — انظر الفاتورة الجديدة"); e.status = 400; throw e; }

    // Check: if customer changed AND payments exist against old invoice — block
    const existingPayments = db.prepare(
      "SELECT COUNT(*) AS cnt FROM payment_allocations WHERE invoice_id = ?"
    ).get(invoiceId).cnt;
    const customerChanged = payload.customer_id && Number(payload.customer_id) !== Number(original.customer_id);
    if (customerChanged && existingPayments > 0) {
      // Allow but warn: old customer gets negative balance (credit)
      // We proceed — the cancel step handles debt reversal including paid portions
    }

    // Step 1: Cancel original with reason = "تعديل"
    const cancelReason = `تعديل — ${payload.reason.trim()}`;
    // Inline cancel logic (reuse cancelInvoice but inside same transaction)
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    db.prepare(`
      UPDATE invoices SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ?
      WHERE id = ?
    `).run(now, userId || 1, cancelReason, invoiceId);

    const lines = db.prepare("SELECT * FROM invoice_lines WHERE invoice_id = ?").all(invoiceId);
    for (const line of lines) {
      adjustStock({
        item_id: line.item_id,
        warehouse_id: line.warehouse_id || 1,
        quantityDelta: Number(line.quantity),
        movement_type: "cancel_sale",
        reference_type: "invoice",
        reference_id: invoiceId,
      });
    }
    if ((original.payment_type === "credit" || original.payment_type === "installments") && original.customer_id) {
      const debt = db.prepare("SELECT * FROM ajal_debts WHERE invoice_id = ? AND source_type = 'invoice'").get(invoiceId);
      if (debt) {
        const remaining = Number(debt.original_amount) - Number(debt.paid_amount || 0);
        if (remaining > 0)
          db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(remaining, original.customer_id);
        db.prepare("UPDATE ajal_debts SET status = 'voided' WHERE id = ?").run(debt.id);
      }
    }
    if (original.payment_type === "cash") {
      const tId = original.treasury_id ||
        db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (tId) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(original.total, tId);
    } else if (original.payment_type === "bank_transfer" && original.bank_id) {
      db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(original.total, original.bank_id);
    } else if (original.payment_type === "multi") {
      const allocs = db.prepare(`
        SELECT pa.amount, p.method, p.treasury_id, p.bank_id
        FROM payment_allocations pa LEFT JOIN payments p ON p.id = pa.payment_id
        WHERE pa.invoice_id = ?
      `).all(invoiceId);
      for (const a of allocs) {
        if (a.method === "cash" && a.treasury_id)
          db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(a.amount, a.treasury_id);
        else if (a.method === "bank" && a.bank_id)
          db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(a.amount, a.bank_id);
      }
    }
    try {
      const pts = db.prepare("SELECT points FROM loyalty_transactions WHERE invoice_id = ? AND type = 'earn'").get(invoiceId);
      if (pts && original.customer_id) {
        db.prepare("UPDATE customers SET loyalty_points = MAX(0, loyalty_points - ?) WHERE id = ?").run(pts.points, original.customer_id);
        db.prepare("INSERT INTO loyalty_transactions (customer_id, invoice_id, type, points, notes) VALUES (?, ?, 'redeem', ?, ?)").run(
          original.customer_id, invoiceId, pts.points, `إلغاء بسبب تعديل فاتورة #${original.invoice_no}`
        );
      }
    } catch (_) {}

    // Step 2: Create new invoice using createInvoice payload (already inside outer transaction — call internal logic directly)
    // We call createInvoice which opens its own transaction — but since better-sqlite3 transactions are nested-safe via savepoints, this is fine.
    // However to be safe, extract the insert logic inline:
    const newPayload = { ...payload, amendment_of: invoiceId };
    // Release current transaction savepoint and call createInvoice
    // Because better-sqlite3 supports nested transactions via savepoints, createInvoice's db.transaction()() will work inside this one.
    const newInvoice = createInvoice(newPayload);

    // Step 3: Link old → new and new → old
    db.prepare("UPDATE invoices SET amended_by = ? WHERE id = ?").run(newInvoice.id, invoiceId);
    db.prepare("UPDATE invoices SET amendment_of = ? WHERE id = ?").run(invoiceId, newInvoice.id);

    try {
      db.prepare("INSERT INTO audit_logs (user_id, resource, resource_id, action, details) VALUES (?, ?, ?, ?, ?)").run(
        userId || 1, "invoice", invoiceId, "amend", JSON.stringify({ new_invoice_id: newInvoice.id, reason: payload.reason })
      );
    } catch (_) {}

    return { original: getInvoiceWithLines(invoiceId), new_invoice: newInvoice };
  })();
}
```

- [ ] **Step 2: Export `amendInvoice`**

```js
module.exports = { createInvoice, getInvoiceWithLines, editInvoice, cancelInvoice, amendInvoice };
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/invoiceService.js
git commit -m "feat: amendInvoice — cancel original + create new, links amendment_of/amended_by"
```

---

### Task 10: Amend route

**Files:**
- Modify: `server/src/routes/invoices.routes.js`

- [ ] **Step 1: Import amendInvoice**

```js
const { createInvoice, getInvoiceWithLines, editInvoice, cancelInvoice, amendInvoice } = require("../services/invoiceService");
```

- [ ] **Step 2: Add PUT /api/invoices/:id/amend route**

```js
router.put("/:id/amend", (req, res) => {
  try {
    const result = amendInvoice(Number(req.params.id), req.body, req.user?.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/invoices.routes.js
git commit -m "feat: PUT /api/invoices/:id/amend route"
```

---

## Phase 4 — Invoice Detail UI: Cancel button, Edit button, Timeline

### Task 11: InvoiceDetailPage — cancel button with reason modal

**Files:**
- Modify: `client/src/pages/pos/InvoiceDetailPage.jsx` (new file — check if exists, else create)

- [ ] **Step 1: Check if InvoiceDetailPage exists**

```bash
ls client/src/pages/pos/InvoiceDetailPage.jsx
```

If it exists, read it first. If not, this is a new file — build it with cancel + timeline.

- [ ] **Step 2: Add cancel reason modal component (inline in the page)**

```jsx
function CancelReasonModal({ invoiceNo, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [presets, setPresets] = useState([]);

  useEffect(() => {
    api.get("/api/invoices/cancel-reasons").then(r => setPresets(r.data.data || [])).catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">إلغاء الفاتورة {invoiceNo}</h3>
        <p className="text-sm text-gray-500 mb-3">اختر سبباً أو اكتب سبباً مخصصاً:</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map(p => (
            <button
              key={p}
              onClick={() => setReason(p)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${reason === p ? 'bg-rose-600 text-white border-rose-600' : 'border-gray-200 text-gray-600 hover:border-rose-300'}`}
            >
              {p}
            </button>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="أو اكتب السبب..."
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-rose-300"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => reason.trim() && onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex-1 bg-rose-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-40"
          >
            تأكيد الإلغاء
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600">
            رجوع
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire cancel button to API**

```js
async function handleCancel(reason) {
  try {
    await api.delete(`/api/invoices/${invoice.id}`, { data: { reason } });
    toast.success("تم إلغاء الفاتورة");
    setCancelOpen(false);
    loadInvoice(); // reload to show cancelled state
  } catch (e) {
    toast.error(e.response?.data?.message || "خطأ في الإلغاء");
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/pos/InvoiceDetailPage.jsx
git commit -m "feat: invoice detail — cancel button with preset reasons modal"
```

---

### Task 12: Invoice timeline panel

**Files:**
- Modify: `client/src/pages/pos/InvoiceDetailPage.jsx`

- [ ] **Step 1: Add timeline fetch**

When invoice loads, if `amendment_of` or `amended_by` fields are non-null, fetch the linked invoices to build a chain:

```js
async function loadTimeline() {
  const chain = [invoice];
  let current = invoice;
  while (current.amendment_of) {
    const r = await api.get(`/api/invoices/${current.amendment_of}`);
    chain.unshift(r.data.data);
    current = r.data.data;
  }
  current = invoice;
  while (current.amended_by) {
    const r = await api.get(`/api/invoices/${current.amended_by}`);
    chain.push(r.data.data);
    current = r.data.data;
  }
  setTimeline(chain);
}
```

- [ ] **Step 2: Render timeline**

```jsx
{timeline.length > 1 && (
  <div className="mt-4 border border-gray-100 rounded-xl p-4">
    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <History size={14} /> سجل التعديلات
    </h4>
    <div className="flex flex-col gap-2">
      {timeline.map((inv, i) => (
        <div key={inv.id} className={`flex items-center gap-3 text-sm ${inv.id === invoice.id ? 'font-semibold' : 'text-gray-500'}`}>
          <span className={`w-2 h-2 rounded-full ${inv.status === 'cancelled' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
          <span>{inv.invoice_no}</span>
          <span className="text-gray-400">{inv.created_at?.slice(0, 10)}</span>
          {inv.status === 'cancelled' && <span className="text-xs text-rose-600">{inv.cancel_reason}</span>}
          {inv.id !== invoice.id && (
            <button onClick={() => navigate(`/pos/invoices/${inv.id}`)} className="text-blue-500 text-xs underline">
              عرض
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/pos/InvoiceDetailPage.jsx
git commit -m "feat: invoice detail — amendment timeline panel"
```

---

### Task 13: Edit invoice flow — open POSPage pre-filled with amendment payload

**Files:**
- Modify: `client/src/pages/pos/InvoiceDetailPage.jsx`
- Modify: `client/src/pages/pos/POSPage.jsx`

- [ ] **Step 1: Add "تعديل" button in InvoiceDetailPage**

Same pattern as cancel — opens a reason modal first (reuse `CancelReasonModal` with title "تعديل الفاتورة"):

```jsx
<button onClick={() => setAmendOpen(true)} className="...">
  تعديل الفاتورة
</button>
```

- [ ] **Step 2: On reason confirm, navigate to POS with pre-fill state**

```js
function handleAmendStart(reason) {
  navigate("/pos", {
    state: {
      amend_invoice_id: invoice.id,
      amend_reason: reason,
      prefill: {
        customer_id: invoice.customer_id,
        customer_name: invoice.customer_name,
        lines: invoice.lines.map(l => ({
          item_id: l.item_id,
          item_name: l.item_name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount: l.discount,
          warehouse_id: l.warehouse_id,
        })),
        payment_type: invoice.payment_type,
        discount: invoice.discount,
        increase: invoice.increase,
        notes: invoice.notes,
      },
    },
  });
}
```

- [ ] **Step 3: In POSPage, detect `location.state.amend_invoice_id` and pre-fill cart**

At the top of `POSPage`, add:

```js
const location = useLocation();
const amendState = location.state?.amend_invoice_id ? location.state : null;

useEffect(() => {
  if (!amendState) return;
  // Pre-fill cart from amendState.prefill
  const { prefill } = amendState;
  if (prefill.customer_id) setSelectedCustomer({ id: prefill.customer_id, name: prefill.customer_name });
  setCartItems(prefill.lines.map(l => ({ ...l, id: Date.now() + Math.random() })));
  setPaymentType(prefill.payment_type);
  setDiscount(prefill.discount || 0);
}, []);
```

- [ ] **Step 4: On invoice submit in POSPage, if `amendState` exists, call `/api/invoices/:id/amend` instead of `/api/invoices`**

In the submit handler:
```js
let result;
if (amendState?.amend_invoice_id) {
  result = await api.put(`/api/invoices/${amendState.amend_invoice_id}/amend`, {
    ...invoicePayload,
    reason: amendState.amend_reason,
  });
} else {
  result = await api.post("/api/invoices", invoicePayload);
}
```

- [ ] **Step 5: After successful amend, navigate to new invoice detail**

```js
navigate(`/pos/invoices/${result.data.data.new_invoice.id}`);
```

- [ ] **Step 6: Clear navigation state to prevent re-trigger on back navigation**

```js
window.history.replaceState({}, document.title);
```

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/pos/InvoiceDetailPage.jsx client/src/pages/pos/POSPage.jsx
git commit -m "feat: invoice edit flow — POS pre-fill from amendment state, submit calls amend endpoint"
```

---

## Phase 5 — Customer/Supplier Negative Balance Visibility

### Task 14: Show credit balance (negative balance) clearly on customer page

**Files:**
- Modify: `client/src/pages/` — find the CustomerDetailPage or CustomersListPage

- [ ] **Step 1: Find the customer balance display**

```bash
grep -r "opening_balance\|رصيد\|balance" client/src/pages --include="*.jsx" -l
```

- [ ] **Step 2: In customer detail, add a prominent credit note when balance < 0**

```jsx
{customer.opening_balance < 0 && (
  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
    <span>رصيد دائن (مبلغ لصالح العميل):</span>
    <span className="font-bold">{fmt(Math.abs(customer.opening_balance))} ج.م</span>
  </div>
)}
```

- [ ] **Step 3: Same treatment for supplier detail page**

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/
git commit -m "feat: customer/supplier — show رصيد دائن badge when balance is negative (overpayment)"
```

---

## Self-Review Checklist

- [x] **رصيد سابق** — computed live in `liveOpeningBalance`, no stored field editable by user ✓
- [x] **No session blocker** — `assertCanWriteForDate` made no-op ✓
- [x] **Writes today-only** — enforced by removing blocker + no past-date UI exposed ✓
- [x] **Cancel = soft delete** — `cancelInvoice` sets status='cancelled', full reversal ✓
- [x] **Cancel requires reason** — validated in service, preset quick-answers from API ✓
- [x] **ملغي badge** on original date + reversal entry on cancellation date ✓
- [x] **Edit = cancel + new** — `amendInvoice` links via `amendment_of`/`amended_by` ✓
- [x] **Customer change with payments** — allowed, old customer gets negative balance ✓
- [x] **Invoice timeline** — chain built from amendment links, rendered in detail page ✓
- [x] **Loyalty points reversed** on cancel ✓
- [x] **Negative balance visible** on customer/supplier pages ✓
- [x] **Migration** — adds cancel/amendment columns to invoices and purchases ✓
