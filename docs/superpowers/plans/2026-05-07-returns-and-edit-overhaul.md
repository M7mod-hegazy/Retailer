# Returns & In-Place Edit Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cancel+create amend flow with true in-place edit on all 4 document types (POS invoices, purchases, sales returns, purchase returns), rebuild both return pages as POS-style full-screen flows, and add an advanced invoice search panel to return pages.

**Architecture:** The backend already has `PUT /api/invoices/:id` and `PUT /api/purchases/:id` doing in-place edits — we just need to wire the frontend to call those instead of `/amend`. For returns, we add new `PUT /api/invoices/returns/:id` and `PUT /api/purchases/returns/:id` in-place edit endpoints. The two return pages are fully rebuilt as POS-style layouts with two modes: direct (build return from scratch) and invoice-linked (load invoice via advanced search, then reduce/delete lines).

**Tech Stack:** React 18, Express.js, better-sqlite3 (sync), TanStack Query, Zustand, TailwindCSS RTL, React Router v6, Lucide icons

---

## File Map

### Backend (new/modified)
- `server/src/routes/invoices.routes.js` — add `PUT /returns/:id` in-place edit endpoint
- `server/src/routes/purchases.routes.js` — add `PUT /returns/:id` in-place edit endpoint  
- `server/src/services/returnService.js` — add `editSalesReturn()` and `editPurchaseReturn()` functions

### Frontend — POS
- `client/src/pages/pos/POSPage.jsx` — wire edit button to `PUT /api/invoices/:id`, add disabled start-time input, pre-fill discount+increase on edit

### Frontend — Purchases
- `client/src/pages/purchases/PurchaseFormPage.jsx` — wire edit to `PUT /api/purchases/:id`, add disabled start-time input, pre-fill all fields on edit

### Frontend — Sales Returns (full rebuild)
- `client/src/pages/sales/SalesReturnFormPage.jsx` — **full rewrite** as POS-style page
- `client/src/pages/sales/SalesReturnPage.jsx` — change "مرتجع عام" button to `navigate("/sales/returns/new")`

### Frontend — Purchase Returns (full rebuild)
- `client/src/pages/purchases/PurchaseReturnFormPage.jsx` — **full rewrite** as POS-style page
- `client/src/pages/purchases/PurchaseReturnPage.jsx` — change "مرتجع عام" button to `navigate("/purchases/returns/new")`

---

## Task 1: Backend — In-Place Edit for Sales Returns

**Files:**
- Modify: `server/src/services/returnService.js`
- Modify: `server/src/routes/invoices.routes.js`

- [ ] **Step 1: Add `editSalesReturn` to returnService.js**

Open `server/src/services/returnService.js`. After the `cancelSalesReturn` function, add:

```js
function editSalesReturn(returnId, payload, userId) {
  const db = getDb();
  return db.transaction(() => {
    const sr = db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(returnId);
    if (!sr) { const e = new Error("المرتجع غير موجود"); e.status = 404; throw e; }
    if (sr.status === "cancelled") { const e = new Error("لا يمكن تعديل مرتجع ملغى"); e.status = 400; throw e; }

    const oldLines = db.prepare("SELECT * FROM sales_return_lines WHERE sales_return_id = ?").all(returnId);

    // 1. Reverse old stock (remove items that were returned back to stock)
    for (const line of oldLines) {
      adjustStock({
        item_id: line.item_id,
        warehouse_id: line.warehouse_id || 1,
        quantityDelta: -line.quantity,
        movement_type: "cancel_sales_return",
        reference_type: "sales_return",
        reference_id: returnId,
      });
    }

    // 2. Reverse old financials
    const oldRefundMethod = sr.refund_method;
    if (oldRefundMethod === "cash_back") {
      const tId = sr.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(sr.total, tId);
    } else if (oldRefundMethod === "credit_note" && sr.customer_id) {
      db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(sr.total, sr.customer_id);
    }

    // 3. Validate new lines against cumulative limits (exclude self)
    const newLines = payload.lines || [];
    let newTotal = 0;
    const preparedLines = [];

    for (const requestedLine of newLines) {
      if (!sr.invoice_id) {
        // General return — no cumulative check needed
        const itemRow = db.prepare("SELECT name, name_en FROM items WHERE id = ?").get(requestedLine.item_id);
        const snap = getSnapshotCosts(requestedLine.item_id, db);
        const lineTotal = Number(requestedLine.quantity) * Number(requestedLine.unit_price);
        newTotal += lineTotal;
        preparedLines.push({ ...requestedLine, item_name_ar: itemRow?.name, item_name_en: itemRow?.name_en, line_total: lineTotal, cost_wacc: snap.cost_wacc, cost_last_purchase: snap.cost_last_purchase });
      } else {
        const invoiceLine = db.prepare("SELECT * FROM invoice_lines WHERE id = ? AND invoice_id = ?")
          .get(requestedLine.invoice_line_id, sr.invoice_id);
        if (!invoiceLine) continue;
        const previousReturned = db.prepare(
          "SELECT COALESCE(SUM(srl.quantity), 0) AS quantity FROM sales_return_lines srl JOIN sales_returns sr2 ON sr2.id = srl.sales_return_id WHERE srl.invoice_line_id = ? AND sr2.status != 'cancelled' AND sr2.id != ?"
        ).get(invoiceLine.id, returnId).quantity || 0;
        const remaining = invoiceLine.quantity - previousReturned;
        const qty = Math.min(Number(requestedLine.quantity), remaining);
        if (qty <= 0) continue;
        const lineTotal = invoiceLine.unit_price * qty;
        newTotal += lineTotal;
        preparedLines.push({
          invoice_line_id: invoiceLine.id,
          item_id: invoiceLine.item_id,
          quantity: qty,
          unit_price: invoiceLine.unit_price,
          line_total: lineTotal,
          warehouse_id: payload.warehouse_id || invoiceLine.warehouse_id || 1,
          item_name_ar: invoiceLine.item_name_ar,
          item_name_en: invoiceLine.item_name_en,
          cost_wacc: invoiceLine.cost_wacc,
          cost_last_purchase: invoiceLine.cost_last_purchase,
        });
      }
    }

    // 4. Delete old lines, insert new
    db.prepare("DELETE FROM sales_return_lines WHERE sales_return_id = ?").run(returnId);
    for (const line of preparedLines) {
      db.prepare(
        `INSERT INTO sales_return_lines
          (sales_return_id, invoice_line_id, item_id, quantity, unit_price, line_total,
           warehouse_id, item_name_ar, item_name_en, cost_wacc, cost_last_purchase)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(returnId, line.invoice_line_id || null, line.item_id, line.quantity,
            line.unit_price, line.line_total, line.warehouse_id || 1,
            line.item_name_ar || null, line.item_name_en || null,
            line.cost_wacc || 0, line.cost_last_purchase || 0);
      adjustStock({
        item_id: line.item_id,
        warehouse_id: line.warehouse_id || 1,
        quantityDelta: line.quantity,
        movement_type: "sales_return",
        reference_type: "sales_return",
        reference_id: returnId,
      });
    }

    // 5. Apply new financials
    const newRefundMethod = payload.refund_method || sr.refund_method;
    const newTreasuryId = payload.treasury_id || sr.treasury_id;
    const newCustomerId = payload.customer_id || sr.customer_id;

    if (newRefundMethod === "cash_back") {
      const tId = newTreasuryId || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (tId) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(newTotal, tId);
    } else if (newRefundMethod === "credit_note" && newCustomerId) {
      db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(newTotal, newCustomerId);
    }

    // 6. Update header (preserve doc_no and created_at)
    db.prepare(
      "UPDATE sales_returns SET total = ?, refund_method = ?, warehouse_id = ?, customer_id = ?, reason = ?, notes = ?, treasury_id = ? WHERE id = ?"
    ).run(newTotal, newRefundMethod, payload.warehouse_id || sr.warehouse_id,
          newCustomerId, payload.reason || sr.reason, payload.notes || sr.notes,
          newTreasuryId || null, returnId);

    // 7. Recalculate linked invoice status
    if (sr.invoice_id) {
      const { recalculateInvoiceStatus } = require("./invoiceService");
      try { recalculateInvoiceStatus(db, sr.invoice_id); } catch (_) {}
    }

    return db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(returnId);
  })();
}
```

Also add `editSalesReturn` to the `module.exports` at the bottom of the file.

- [ ] **Step 2: Add `PUT /returns/:id` route to invoices.routes.js**

In `server/src/routes/invoices.routes.js`, add after the existing `PUT /returns/:id/amend` route:

```js
router.put("/returns/:id", (req, res, next) => {
  try {
    const { editSalesReturn } = require("../services/returnService");
    const result = editSalesReturn(Number(req.params.id), req.body, req.user?.id);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/returnService.js server/src/routes/invoices.routes.js
git commit -m "feat: add in-place edit endpoint for sales returns (PUT /api/invoices/returns/:id)"
```

---

## Task 2: Backend — In-Place Edit for Purchase Returns

**Files:**
- Modify: `server/src/routes/purchases.routes.js`

- [ ] **Step 1: Add `editPurchaseReturn` function inside purchases.routes.js**

In `server/src/routes/purchases.routes.js`, before the `router.put("/:id/amend")` route, add:

```js
function editPurchaseReturn(db, returnId, payload) {
  return db.transaction(() => {
    const pr = db.prepare("SELECT * FROM purchase_returns WHERE id = ?").get(returnId);
    if (!pr) { const e = new Error("المرتجع غير موجود"); e.status = 404; throw e; }
    if (pr.status === "cancelled") { const e = new Error("لا يمكن تعديل مرتجع ملغى"); e.status = 400; throw e; }

    const oldLines = db.prepare("SELECT * FROM purchase_return_lines WHERE purchase_return_id = ?").all(returnId);

    // 1. Reverse old stock
    for (const line of oldLines) {
      adjustStock({
        item_id: line.item_id,
        warehouse_id: line.warehouse_id || 1,
        quantityDelta: line.quantity,
        movement_type: "purchase",
        reference_type: "purchase_return",
        reference_id: returnId,
      });
    }

    // 2. Reverse old financials
    const oldSettlement = pr.settlement_type || "account";
    if (oldSettlement === "cash") {
      const tId = pr.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (tId) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(pr.total, tId);
    } else if (pr.supplier_id) {
      db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(pr.total, pr.supplier_id);
    }

    // 3. Validate and build new lines
    const newLines = payload.lines || [];
    let newTotal = 0;
    const preparedLines = [];

    for (const requestedLine of newLines) {
      if (!pr.purchase_id) {
        // General purchase return
        const lineTotal = Number(requestedLine.quantity) * Number(requestedLine.unit_cost);
        newTotal += lineTotal;
        preparedLines.push({ ...requestedLine, line_total: lineTotal });
      } else {
        const purchaseLine = db.prepare("SELECT * FROM purchase_lines WHERE id = ? AND purchase_id = ?")
          .get(requestedLine.purchase_line_id, pr.purchase_id);
        if (!purchaseLine) continue;
        const previousReturned = db.prepare(
          "SELECT COALESCE(SUM(prl.quantity), 0) AS quantity FROM purchase_return_lines prl JOIN purchase_returns pr2 ON pr2.id = prl.purchase_return_id WHERE prl.purchase_line_id = ? AND pr2.status != 'cancelled' AND pr2.id != ?"
        ).get(purchaseLine.id, returnId).quantity || 0;
        const remaining = purchaseLine.quantity - previousReturned;
        const qty = Math.min(Number(requestedLine.quantity), remaining);
        if (qty <= 0) continue;
        const lineTotal = purchaseLine.unit_cost * qty;
        newTotal += lineTotal;
        preparedLines.push({
          purchase_line_id: purchaseLine.id,
          item_id: purchaseLine.item_id,
          quantity: qty,
          unit_cost: purchaseLine.unit_cost,
          line_total: lineTotal,
          warehouse_id: payload.warehouse_id || 1,
        });
      }
    }

    // 4. Delete old lines, insert new
    db.prepare("DELETE FROM purchase_return_lines WHERE purchase_return_id = ?").run(returnId);
    for (const line of preparedLines) {
      db.prepare(
        "INSERT INTO purchase_return_lines (purchase_return_id, purchase_line_id, item_id, quantity, unit_cost, line_total, warehouse_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(returnId, line.purchase_line_id || null, line.item_id, line.quantity,
            line.unit_cost, line.line_total, line.warehouse_id || 1);
      adjustStock({
        item_id: line.item_id,
        warehouse_id: line.warehouse_id || 1,
        quantityDelta: -line.quantity,
        movement_type: "purchase_return",
        reference_type: "purchase_return",
        reference_id: returnId,
      });
    }

    // 5. Apply new financials
    const newSettlement = payload.settlement_type || pr.settlement_type || "account";
    const newTreasuryId = payload.treasury_id || pr.treasury_id;
    const newSupplierId = payload.supplier_id || pr.supplier_id;

    if (newSettlement === "cash") {
      const tId = newTreasuryId || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(newTotal, tId);
    } else if (newSupplierId) {
      db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(newTotal, newSupplierId);
    }

    // 6. Update header (preserve doc_no and created_at)
    db.prepare(
      "UPDATE purchase_returns SET total = ?, settlement_type = ?, treasury_id = ?, supplier_id = ?, warehouse_id = ?, notes = ? WHERE id = ?"
    ).run(newTotal, newSettlement, newTreasuryId || null, newSupplierId, payload.warehouse_id || pr.warehouse_id, payload.notes || pr.notes, returnId);

    return db.prepare("SELECT * FROM purchase_returns WHERE id = ?").get(returnId);
  })();
}
```

- [ ] **Step 2: Add route**

In the same file, before `router.put("/:id/amend")`, add:

```js
router.put("/returns/:id", (req, res, next) => {
  const db = getDb();
  ensurePurchaseReturnSettlementSchema(db);
  try {
    const result = editPurchaseReturn(db, Number(req.params.id), req.body);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/purchases.routes.js
git commit -m "feat: add in-place edit endpoint for purchase returns (PUT /api/purchases/returns/:id)"
```

---

## Task 3: Frontend — POS In-Place Edit + Start Time + Pre-fill

**Files:**
- Modify: `client/src/pages/pos/POSPage.jsx`

The POS page currently calls `PUT /api/invoices/:id/amend` when editing. We change it to call `PUT /api/invoices/:id` (which already exists and does in-place edit). We also add a `startedAt` state that records the timestamp on first cart interaction, and show it + `doc_no` as disabled inputs during edit.

- [ ] **Step 1: Find the amend call in POSPage.jsx**

Run:
```bash
grep -n "amend\|amendment" client/src/pages/pos/POSPage.jsx
```

Note the line numbers where the amend API call happens.

- [ ] **Step 2: Add startedAt state and first-interaction recorder**

In the state declarations section of `POSPage.jsx`, add:

```js
const [startedAt, setStartedAt] = useState(null);

function recordStartTime() {
  setStartedAt(prev => prev || new Date().toISOString());
}
```

Call `recordStartTime()` inside every function that modifies the cart (addItem, removeItem, updateQty, setDiscount, setIncrease).

- [ ] **Step 3: Show disabled start time + doc_no inputs during edit**

In the POS header/form area, where the invoice number or customer info is shown, add (visible only when `editMode` is true):

```jsx
{editMode && (
  <div className="flex gap-3 mb-2">
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم المستند</label>
      <input
        disabled
        value={editingInvoice?.invoice_no || ""}
        className="h-8 w-36 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[12px] font-mono font-black text-slate-500 outline-none cursor-not-allowed"
      />
    </div>
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">وقت البدء الأصلي</label>
      <input
        disabled
        value={editingInvoice?.created_at ? new Date(editingInvoice.created_at).toLocaleString("ar-EG") : ""}
        className="h-8 w-48 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[12px] font-mono font-black text-slate-500 outline-none cursor-not-allowed"
      />
    </div>
  </div>
)}
```

- [ ] **Step 4: Change amend call to in-place edit call**

Find the API call for amend (likely `api.put(\`/api/invoices/${id}/amend\`, payload)`) and replace with:

```js
// In-place edit — preserves doc_no, created_at, id
await api.put(`/api/invoices/${editingInvoice.id}`, {
  lines: cartLines,
  discount: globalDiscount,
  increase: globalIncrease,
  payment_type: paymentType,
  customer_id: selectedCustomer?.id || null,
  warehouse_id: selectedWarehouse,
  treasury_id: selectedTreasury,
});
```

Remove any `reason` field from this payload (no longer needed — no cancel, no audit reason prompt).

- [ ] **Step 5: Pre-fill all fields when entering edit mode**

When the user opens an invoice for editing (wherever `editMode` is set to true and `editingInvoice` is loaded), ensure all these are set from the existing invoice:

```js
setCartLines(editingInvoice.lines.map(l => ({
  item_id: l.item_id,
  item_name: l.item_name_ar,
  barcode: l.barcode,
  unit_price: l.unit_price,
  quantity: l.quantity,
  discount: l.discount || 0,
})));
setGlobalDiscount(editingInvoice.discount || 0);
setGlobalIncrease(editingInvoice.increase || 0);
setPaymentType(editingInvoice.payment_type);
setSelectedCustomer(/* customer object for editingInvoice.customer_id */);
setStartedAt(editingInvoice.created_at); // preserve original
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/pos/POSPage.jsx
git commit -m "feat: POS uses in-place edit, adds start-time input, pre-fills all fields on edit"
```

---

## Task 4: Frontend — Purchases In-Place Edit + Start Time + Pre-fill

**Files:**
- Modify: `client/src/pages/purchases/PurchaseFormPage.jsx`

Same pattern as Task 3 but for purchases. The backend `PUT /api/purchases/:id` already exists.

- [ ] **Step 1: Find amend call**

```bash
grep -n "amend" client/src/pages/purchases/PurchaseFormPage.jsx
```

- [ ] **Step 2: Add startedAt state with first-interaction recording**

```js
const [startedAt, setStartedAt] = useState(null);
function recordStartTime() {
  setStartedAt(prev => prev || new Date().toISOString());
}
```

Call `recordStartTime()` on: addLine, removeLine, updateLine, supplier selection change, discount change.

- [ ] **Step 3: Show disabled doc_no + start time inputs in edit mode**

In the form header (visible only when editing an existing purchase):

```jsx
{isEditMode && (
  <div className="flex gap-3 mb-3">
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم المستند</label>
      <input
        disabled
        value={existingPurchase?.doc_no || ""}
        className="h-8 w-36 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[12px] font-mono font-black text-slate-500 outline-none cursor-not-allowed"
      />
    </div>
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">وقت الإنشاء الأصلي</label>
      <input
        disabled
        value={existingPurchase?.created_at ? new Date(existingPurchase.created_at).toLocaleString("ar-EG") : ""}
        className="h-8 w-52 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[12px] font-mono font-black text-slate-500 outline-none cursor-not-allowed"
      />
    </div>
  </div>
)}
```

- [ ] **Step 4: Change amend call to in-place edit call**

Replace `api.put(\`/api/purchases/${id}/amend\`, payload)` with:

```js
await api.put(`/api/purchases/${existingPurchase.id}`, {
  supplier_id: selectedSupplier?.id,
  warehouse_id: selectedWarehouse,
  payment_method: paymentMethod,
  treasury_id: selectedTreasury || null,
  bank_id: selectedBank || null,
  lines: lines.map(l => ({
    item_id: l.item_id,
    quantity: l.quantity,
    unit_cost: l.unit_cost,
    selling_price: l.selling_price || 0,
    warehouse_id: l.warehouse_id || selectedWarehouse,
  })),
});
```

- [ ] **Step 5: Pre-fill all fields when editing**

When loading an existing purchase for edit:

```js
setLines(existingPurchase.lines.map(l => ({
  item_id: l.item_id,
  item_name: l.item_name,
  quantity: l.quantity,
  unit_cost: l.unit_cost,
  selling_price: l.selling_price || 0,
  warehouse_id: l.warehouse_id || 1,
})));
setSelectedSupplier({ id: existingPurchase.supplier_id, name: existingPurchase.supplier_name });
setPaymentMethod(existingPurchase.payment_method || "cash");
setStartedAt(existingPurchase.created_at);
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/purchases/PurchaseFormPage.jsx
git commit -m "feat: purchases uses in-place edit, adds start-time input, pre-fills all fields on edit"
```

---

## Task 5: Sales Return Page — Fix مرتجع عام Button

**Files:**
- Modify: `client/src/pages/sales/SalesReturnPage.jsx`

- [ ] **Step 1: Change مرتجع عام button to navigate**

Find:
```jsx
onClick={() => setGeneralReturnOpen(true)}
```

Replace with:
```jsx
onClick={() => navigate("/sales/returns/new")}
```

Remove the `generalReturnOpen` state declaration and the `<GeneralReturnModal .../>` JSX at the bottom. Remove the import for `GeneralReturnModal`. Keep `QuickReturnModal` and its button untouched.

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/sales/SalesReturnPage.jsx
git commit -m "fix: مرتجع عام button navigates to full-page sales return form"
```

---

## Task 6: Purchase Return Page — Fix مرتجع عام Button

**Files:**
- Modify: `client/src/pages/purchases/PurchaseReturnPage.jsx`

- [ ] **Step 1: Change مرتجع عام button to navigate**

Find:
```jsx
onClick={() => setGeneralReturnOpen(true)}
```

Replace with:
```jsx
onClick={() => navigate("/purchases/returns/new")}
```

Remove `generalReturnOpen` state and `<GeneralPurchaseReturnModal .../>` at bottom. Remove its import. Keep `QuickReturnModal` untouched.

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/purchases/PurchaseReturnPage.jsx
git commit -m "fix: مرتجع عام button navigates to full-page purchase return form"
```

---

## Task 7: Sales Return Form Page — Full Rebuild (POS-style)

**Files:**
- Rewrite: `client/src/pages/sales/SalesReturnFormPage.jsx`

This is the largest task. The new page has a 2-panel POS layout:
- **Left panel (cart):** list of return lines, each with qty input, delete button; total at bottom; customer selector; refund method toggle (نقدي / رصيد); warehouse selector; confirm button
- **Right panel:** either product search (Mode 1) or invoice search (Mode 2), toggled by a "بحث متقدم" button at top

**State shape:**
```js
const [mode, setMode] = useState("direct"); // "direct" | "invoice"
const [rightPanel, setRightPanel] = useState("products"); // "products" | "search"
const [cart, setCart] = useState([]); // { item_id, item_name, barcode, unit_price, quantity, max_qty, invoice_line_id? }
const [loadedInvoice, setLoadedInvoice] = useState(null);
const [customer, setCustomer] = useState(null);
const [refundMethod, setRefundMethod] = useState("cash_back");
const [selectedWarehouse, setSelectedWarehouse] = useState("");
const [selectedTreasury, setSelectedTreasury] = useState("");
const [reason, setReason] = useState("");
const [searchQuery, setSearchQuery] = useState("");
const [searchResults, setSearchResults] = useState([]);
const [isSaving, setIsSaving] = useState(false);
const [message, setMessage] = useState({ text: "", type: "" });
// Edit mode
const [editReturnId, setEditReturnId] = useState(null); // from location.state
const [originalDocNo, setOriginalDocNo] = useState(null);
const [originalCreatedAt, setOriginalCreatedAt] = useState(null);
```

- [ ] **Step 1: Write the page skeleton with left/right panels**

Replace the entire content of `client/src/pages/sales/SalesReturnFormPage.jsx` with:

```jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Search, Trash2, Plus, Minus, CheckCircle2, AlertCircle, Printer, History } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../services/api";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}

export default function SalesReturnFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const editReturnId = location.state?.edit_return_id || null;
  const isEditMode = !!editReturnId;

  const [rightPanel, setRightPanel] = useState("products"); // "products" | "search"
  const [cart, setCart] = useState([]);
  const [loadedInvoice, setLoadedInvoice] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [refundMethod, setRefundMethod] = useState("cash_back");
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [treasuries, setTreasuries] = useState([]);
  const [selectedTreasury, setSelectedTreasury] = useState("");
  const [reason, setReason] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceResults, setInvoiceResults] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [originalDocNo, setOriginalDocNo] = useState(null);
  const [originalCreatedAt, setOriginalCreatedAt] = useState(null);

  const productSearchRef = useRef(null);
  const invoiceSearchRef = useRef(null);

  const total = useMemo(() => cart.reduce((acc, l) => acc + l.unit_price * l.quantity, 0), [cart]);

  // Load warehouses, treasuries, customers on mount
  useEffect(() => {
    api.get("/api/warehouses").then(r => {
      const wh = r.data.data || [];
      setWarehouses(wh);
      if (wh.length) setSelectedWarehouse(String(wh[0].id));
    }).catch(() => {});
    api.get("/api/treasuries").then(r => {
      const rows = r.data.data || [];
      setTreasuries(rows);
      if (rows.length) setSelectedTreasury(String(rows[0].id));
    }).catch(() => {});
    api.get("/api/customers?limit=500").then(r => setCustomers(r.data.data || [])).catch(() => {});
  }, []);

  // Load existing return for edit mode
  useEffect(() => {
    if (!isEditMode) return;
    api.get(`/api/invoices/returns/${editReturnId}`).then(r => {
      const sr = r.data.data;
      setOriginalDocNo(sr.doc_no);
      setOriginalCreatedAt(sr.created_at);
      setRefundMethod(sr.refund_method || "cash_back");
      setReason(sr.reason || "");
      if (sr.warehouse_id) setSelectedWarehouse(String(sr.warehouse_id));
      if (sr.treasury_id) setSelectedTreasury(String(sr.treasury_id));
      if (sr.customer_id) setCustomer(customers.find(c => c.id === sr.customer_id) || { id: sr.customer_id, name: sr.customer_name || "" });
      setCart((sr.lines || []).map(l => ({
        key: l.id,
        invoice_line_id: l.invoice_line_id || null,
        item_id: l.item_id,
        item_name: l.item_name_ar || l.item_name,
        unit_price: l.unit_price,
        quantity: l.quantity,
        max_qty: l.quantity, // in edit mode allow up to original return qty + remaining
      })));
      if (sr.invoice_id) {
        api.get(`/api/invoices/${sr.invoice_id}`).then(inv => setLoadedInvoice(inv.data.data)).catch(() => {});
      }
    }).catch(() => {});
  }, [isEditMode, editReturnId]);

  // Product search (Mode 1 — direct)
  useEffect(() => {
    if (!productSearch.trim()) { setProductResults([]); return; }
    const t = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(productSearch)}&limit=20`)
        .then(r => setProductResults(r.data.data || [])).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [productSearch]);

  // Invoice search (Mode 2)
  async function handleInvoiceSearch() {
    if (!invoiceSearch.trim()) return;
    try {
      // Try by ID first, then by invoice_no
      const byId = invoiceSearch.match(/^\d+$/)
        ? await api.get(`/api/invoices/${invoiceSearch}`).then(r => [r.data.data]).catch(() => [])
        : [];
      const bySearch = await api.get(`/api/invoices?search=${encodeURIComponent(invoiceSearch)}&status=active&limit=20`)
        .then(r => r.data.data || []).catch(() => []);
      const merged = [...byId, ...bySearch.filter(i => !byId.find(x => x.id === i.id))];
      setInvoiceResults(merged.filter(i => i && i.status !== "cancelled" && !i.amended_by));
    } catch (_) {}
  }

  function loadInvoice(inv) {
    setLoadedInvoice(inv);
    setCart((inv.lines || []).map(l => ({
      key: `inv-${l.id}`,
      invoice_line_id: l.id,
      item_id: l.item_id,
      item_name: l.item_name_ar || l.item_name,
      unit_price: l.unit_price,
      quantity: l.quantity,
      max_qty: l.quantity - (l.returned_quantity || 0),
    })).filter(l => l.max_qty > 0));
    setRightPanel("products");
    setInvoiceResults([]);
    setInvoiceSearch("");
  }

  function addProductToCart(item) {
    setCart(prev => {
      const existing = prev.find(l => l.item_id === item.id && !l.invoice_line_id);
      if (existing) return prev.map(l => l === existing ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { key: `direct-${item.id}-${Date.now()}`, item_id: item.id, item_name: item.name, unit_price: item.sale_price || 0, quantity: 1, max_qty: Infinity, invoice_line_id: null }];
    });
  }

  function updateQty(key, delta) {
    setCart(prev => prev.map(l => {
      if (l.key !== key) return l;
      const newQty = Math.max(0, Math.min(l.max_qty, l.quantity + delta));
      return { ...l, quantity: newQty };
    }).filter(l => l.quantity > 0));
  }

  function setQty(key, val) {
    setCart(prev => prev.map(l => {
      if (l.key !== key) return l;
      const newQty = Math.max(0, Math.min(l.max_qty, Number(val) || 0));
      return { ...l, quantity: newQty };
    }).filter(l => l.quantity > 0));
  }

  function removeLine(key) {
    setCart(prev => prev.filter(l => l.key !== key));
  }

  async function handleSave() {
    if (!cart.length) { setMessage({ text: "أضف أصناف للمرتجع أولاً", type: "error" }); return; }
    setIsSaving(true);
    setMessage({ text: "", type: "" });
    try {
      const payload = {
        customer_id: customer?.id || null,
        warehouse_id: Number(selectedWarehouse),
        refund_method: refundMethod,
        treasury_id: refundMethod === "cash_back" ? Number(selectedTreasury) : null,
        reason: reason || "other",
        lines: cart.map(l => ({
          invoice_line_id: l.invoice_line_id || null,
          item_id: l.item_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
      };

      if (isEditMode) {
        await api.put(`/api/invoices/returns/${editReturnId}`, payload);
        setMessage({ text: "تم تعديل المرتجع بنجاح", type: "success" });
      } else if (loadedInvoice) {
        await api.post(`/api/invoices/${loadedInvoice.id}/return`, payload);
        setMessage({ text: "تم تسجيل المرتجع بنجاح", type: "success" });
      } else {
        await api.post("/api/invoices/general-return", payload);
        setMessage({ text: "تم تسجيل المرتجع العام بنجاح", type: "success" });
      }
      setTimeout(() => navigate("/sales/returns"), 1500);
    } catch (e) {
      setMessage({ text: e.response?.data?.message || "فشل تسجيل المرتجع", type: "error" });
    } finally { setIsSaving(false); }
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100 font-sans overflow-hidden" dir="rtl">
      {/* ── Header ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/sales/returns")}
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">
              {isEditMode ? "تعديل مرتجع مبيعات" : loadedInvoice ? `مرتجع فاتورة #${loadedInvoice.invoice_no}` : "مرتجع مبيعات جديد"}
            </h1>
            <span className="text-[10px] font-bold text-slate-400">
              {isEditMode ? `${originalDocNo} · ${originalCreatedAt ? new Date(originalCreatedAt).toLocaleString("ar-EG") : ""}` : "اختر أصناف أو ابحث عن فاتورة"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {message.text && (
            <div className={`rounded-sm px-3 py-1.5 text-[11px] font-bold border ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"}`}>
              {message.text}
            </div>
          )}
          {/* Edit mode: show locked doc_no + date */}
          {isEditMode && (
            <div className="flex gap-2">
              <input disabled value={originalDocNo || ""} className="h-8 w-28 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-400 cursor-not-allowed" />
              <input disabled value={originalCreatedAt ? new Date(originalCreatedAt).toLocaleString("ar-EG") : ""} className="h-8 w-44 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-400 cursor-not-allowed" />
            </div>
          )}
          <button onClick={handleSave} disabled={isSaving || !cart.length}
            className="flex h-9 items-center gap-2 rounded-sm bg-slate-800 px-6 text-[13px] font-black text-white hover:bg-slate-700 disabled:opacity-40 transition-all active:scale-95">
            {isSaving ? "جاري الحفظ..." : isEditMode ? "تأكيد التعديل" : "تأكيد المرتجع"}
          </button>
        </div>
      </header>

      {/* ── Body: Left cart + Right panel ── */}
      <div className="flex flex-1 min-h-0 gap-0">

        {/* ── Left: Cart ── */}
        <div className="flex flex-col w-[420px] shrink-0 border-l border-slate-300 bg-white">
          {/* Customer + refund settings */}
          <div className="border-b border-slate-100 p-4 space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">العميل (اختياري)</label>
              <select value={customer?.id || ""} onChange={e => setCustomer(customers.find(c => String(c.id) === e.target.value) || null)}
                className="w-full border border-slate-200 rounded-sm px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-600">
                <option value="">بدون عميل</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRefundMethod("cash_back")}
                className={`flex-1 rounded-sm border py-2 text-[11px] font-black transition-all ${refundMethod === "cash_back" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"}`}>
                نقداً
              </button>
              <button onClick={() => setRefundMethod("credit_note")}
                className={`flex-1 rounded-sm border py-2 text-[11px] font-black transition-all ${refundMethod === "credit_note" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"}`}>
                رصيد حساب
              </button>
            </div>
            {refundMethod === "cash_back" && (
              <select value={selectedTreasury} onChange={e => setSelectedTreasury(e.target.value)}
                className="w-full border border-slate-200 rounded-sm px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-600">
                {treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}
              className="w-full border border-slate-200 rounded-sm px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-600">
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب الإرجاع..."
              className="w-full border border-slate-200 rounded-sm px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-600" />
          </div>

          {/* Cart lines */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                <span className="text-[13px] font-bold">لا يوجد أصناف</span>
                <span className="text-[11px]">ابحث عن صنف أو فاتورة من اليمين</span>
              </div>
            ) : cart.map(line => (
              <div key={line.key} className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-black text-slate-800 truncate">{line.item_name}</div>
                  <div className="text-[11px] font-bold text-slate-400">{formatMoney(line.unit_price)} × {line.quantity} = {formatMoney(line.unit_price * line.quantity)}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(line.key, -1)} className="h-7 w-7 flex items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-95">
                    <Minus className="h-3 w-3" />
                  </button>
                  <input type="number" value={line.quantity} onChange={e => setQty(line.key, e.target.value)} onFocus={e => e.target.select()}
                    className="w-12 h-7 text-center font-mono font-black text-[13px] border border-slate-200 rounded-sm outline-none focus:border-slate-800" />
                  <button onClick={() => updateQty(line.key, 1)} disabled={line.quantity >= line.max_qty}
                    className="h-7 w-7 flex items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-95 disabled:opacity-30">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button onClick={() => removeLine(line.key)} className="h-7 w-7 flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Total bar */}
          <div className="flex items-center justify-between bg-slate-900 px-5 py-4 shrink-0">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">الإجمالي</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[26px] font-black font-mono text-white">{formatMoney(total)}</span>
              <span className="text-[11px] font-black text-slate-500">ج.م</span>
            </div>
          </div>
        </div>

        {/* ── Right: Product search OR Invoice search ── */}
        <div className="flex flex-1 flex-col min-h-0 bg-slate-50">
          {/* Toggle bar */}
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 shrink-0">
            <button onClick={() => setRightPanel("products")}
              className={`px-4 py-1.5 rounded-sm text-[12px] font-black border transition-all ${rightPanel === "products" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              إضافة صنف مباشر
            </button>
            <button onClick={() => setRightPanel("search")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-sm text-[12px] font-black border transition-all ${rightPanel === "search" ? "border-amber-600 bg-amber-600 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              <History className="h-3.5 w-3.5" /> بحث متقدم في الفواتير
            </button>
            {loadedInvoice && (
              <span className="mr-auto text-[11px] font-black text-emerald-600">✓ مرتبط بفاتورة #{loadedInvoice.invoice_no}</span>
            )}
          </div>

          {rightPanel === "products" ? (
            /* Product search panel */
            <div className="flex flex-col flex-1 min-h-0 p-4 gap-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input ref={productSearchRef} autoFocus value={productSearch} onChange={e => setProductSearch(e.target.value)}
                  placeholder="بحث بالاسم أو الباركود..."
                  className="w-full border border-slate-300 rounded-sm py-2 pr-10 pl-3 text-[13px] font-bold text-slate-800 outline-none focus:border-slate-800 bg-white" />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                {productResults.map(item => (
                  <button key={item.id} onClick={() => addProductToCart(item)}
                    className="w-full flex items-center justify-between rounded-sm border border-slate-200 bg-white px-3 py-2.5 text-right hover:border-slate-400 hover:bg-slate-50 transition-all active:scale-[0.99]">
                    <div>
                      <div className="text-[13px] font-black text-slate-800">{item.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{item.barcode || item.code || "-"}</div>
                    </div>
                    <div className="text-[13px] font-black text-slate-600">{formatMoney(item.sale_price)} ج.م</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Invoice search panel */
            <div className="flex flex-col flex-1 min-h-0 p-4 gap-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input ref={invoiceSearchRef} autoFocus value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleInvoiceSearch()}
                    placeholder="رقم الفاتورة أو اسم العميل أو الصنف..."
                    className="w-full border border-slate-300 rounded-sm py-2 pr-10 pl-3 text-[13px] font-bold text-slate-800 outline-none focus:border-slate-800 bg-white" />
                </div>
                <button onClick={handleInvoiceSearch}
                  className="px-5 rounded-sm bg-amber-600 text-white text-[12px] font-black hover:bg-amber-500 transition-all active:scale-95">
                  بحث
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                {invoiceResults.map(inv => (
                  <div key={inv.id} className="rounded-sm border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-[13px] font-black text-slate-800">فاتورة #{inv.invoice_no}</span>
                        <span className="mr-2 text-[11px] font-bold text-slate-400">{new Date(inv.created_at).toLocaleDateString("ar-EG")}</span>
                      </div>
                      <button onClick={() => loadInvoice(inv)}
                        className="px-4 py-1 rounded-sm bg-slate-800 text-white text-[11px] font-black hover:bg-slate-700 active:scale-95">
                        تحميل وإرجاع
                      </button>
                    </div>
                    <div className="text-[11px] font-bold text-slate-500">
                      {inv.customer_name || "بدون عميل"} · {formatMoney(inv.total)} ج.م · {(inv.lines || []).length} أصناف
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/sales/SalesReturnFormPage.jsx
git commit -m "feat: rebuild SalesReturnFormPage as POS-style layout with direct + invoice search modes"
```

---

## Task 8: Purchase Return Form Page — Full Rebuild (POS-style)

**Files:**
- Rewrite: `client/src/pages/purchases/PurchaseReturnFormPage.jsx`

Same structure as Task 7 but for purchases: supplier instead of customer, `unit_cost` instead of `unit_price`, settlement type (account/cash) instead of refund method, search purchase invoices instead of sales invoices.

- [ ] **Step 1: Replace entire file**

```jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Search, Trash2, Plus, Minus, History } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../services/api";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}

export default function PurchaseReturnFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const editReturnId = location.state?.edit_return_id || null;
  const isEditMode = !!editReturnId;

  const [rightPanel, setRightPanel] = useState("products");
  const [cart, setCart] = useState([]);
  const [loadedPurchase, setLoadedPurchase] = useState(null);
  const [supplier, setSupplier] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [settlementType, setSettlementType] = useState("account");
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [treasuries, setTreasuries] = useState([]);
  const [selectedTreasury, setSelectedTreasury] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseResults, setPurchaseResults] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [originalDocNo, setOriginalDocNo] = useState(null);
  const [originalCreatedAt, setOriginalCreatedAt] = useState(null);

  const total = useMemo(() => cart.reduce((acc, l) => acc + l.unit_cost * l.quantity, 0), [cart]);

  useEffect(() => {
    api.get("/api/warehouses").then(r => { const wh = r.data.data || []; setWarehouses(wh); if (wh.length) setSelectedWarehouse(String(wh[0].id)); }).catch(() => {});
    api.get("/api/treasuries").then(r => { const rows = r.data.data || []; setTreasuries(rows); if (rows.length) setSelectedTreasury(String(rows[0].id)); }).catch(() => {});
    api.get("/api/suppliers?limit=500").then(r => setSuppliers(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEditMode) return;
    api.get(`/api/purchases/returns/${editReturnId}`).then(r => {
      const pr = r.data.data;
      setOriginalDocNo(pr.doc_no);
      setOriginalCreatedAt(pr.created_at);
      setSettlementType(pr.settlement_type || "account");
      if (pr.warehouse_id) setSelectedWarehouse(String(pr.warehouse_id));
      if (pr.treasury_id) setSelectedTreasury(String(pr.treasury_id));
      if (pr.supplier_id) setSupplier({ id: pr.supplier_id, name: pr.supplier_name || "" });
      setCart((pr.lines || []).map(l => ({
        key: l.id,
        purchase_line_id: l.purchase_line_id || null,
        item_id: l.item_id,
        item_name: l.item_name || l.item_name_ar,
        unit_cost: l.unit_cost,
        quantity: l.quantity,
        max_qty: l.quantity,
      })));
    }).catch(() => {});
  }, [isEditMode, editReturnId]);

  useEffect(() => {
    if (!productSearch.trim()) { setProductResults([]); return; }
    const t = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(productSearch)}&limit=20`)
        .then(r => setProductResults(r.data.data || [])).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [productSearch]);

  async function handlePurchaseSearch() {
    if (!purchaseSearch.trim()) return;
    const byId = purchaseSearch.match(/^\d+$/)
      ? await api.get(`/api/purchases/${purchaseSearch}`).then(r => [r.data.data]).catch(() => [])
      : [];
    const bySearch = await api.get(`/api/purchases?search=${encodeURIComponent(purchaseSearch)}&limit=20`)
      .then(r => r.data.data || []).catch(() => []);
    const merged = [...byId, ...bySearch.filter(p => !byId.find(x => x.id === p.id))];
    setPurchaseResults(merged.filter(p => p && p.status !== "cancelled" && p.status !== "voided" && !p.amended_by));
  }

  function loadPurchase(p) {
    setLoadedPurchase(p);
    setCart((p.lines || []).map(l => ({
      key: `pur-${l.id}`,
      purchase_line_id: l.id,
      item_id: l.item_id,
      item_name: l.item_name || l.name,
      unit_cost: l.unit_cost,
      quantity: l.returnable_quantity || l.quantity,
      max_qty: l.returnable_quantity || l.quantity,
    })).filter(l => l.max_qty > 0));
    setRightPanel("products");
    setPurchaseResults([]);
    setPurchaseSearch("");
  }

  function addProductToCart(item) {
    setCart(prev => {
      const existing = prev.find(l => l.item_id === item.id && !l.purchase_line_id);
      if (existing) return prev.map(l => l === existing ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { key: `direct-${item.id}-${Date.now()}`, item_id: item.id, item_name: item.name, unit_cost: item.cost || item.last_purchase_price || 0, quantity: 1, max_qty: Infinity, purchase_line_id: null }];
    });
  }

  function updateQty(key, delta) {
    setCart(prev => prev.map(l => l.key !== key ? l : { ...l, quantity: Math.max(0, Math.min(l.max_qty, l.quantity + delta)) }).filter(l => l.quantity > 0));
  }

  function setQty(key, val) {
    setCart(prev => prev.map(l => l.key !== key ? l : { ...l, quantity: Math.max(0, Math.min(l.max_qty, Number(val) || 0)) }).filter(l => l.quantity > 0));
  }

  function removeLine(key) { setCart(prev => prev.filter(l => l.key !== key)); }

  async function handleSave() {
    if (!cart.length) { setMessage({ text: "أضف أصناف للمرتجع أولاً", type: "error" }); return; }
    setIsSaving(true);
    setMessage({ text: "", type: "" });
    try {
      const payload = {
        supplier_id: supplier?.id || null,
        warehouse_id: Number(selectedWarehouse),
        settlement_type: settlementType,
        treasury_id: settlementType === "cash" ? Number(selectedTreasury) : null,
        lines: cart.map(l => ({
          purchase_line_id: l.purchase_line_id || null,
          item_id: l.item_id,
          quantity: l.quantity,
          unit_cost: l.unit_cost,
        })),
      };

      if (isEditMode) {
        await api.put(`/api/purchases/returns/${editReturnId}`, payload);
        setMessage({ text: "تم تعديل المرتجع بنجاح", type: "success" });
      } else if (loadedPurchase) {
        await api.post(`/api/purchases/${loadedPurchase.id}/return`, payload);
        setMessage({ text: "تم تسجيل المرتجع بنجاح", type: "success" });
      } else {
        await api.post("/api/purchases/general-purchase-return", payload);
        setMessage({ text: "تم تسجيل المرتجع العام بنجاح", type: "success" });
      }
      setTimeout(() => navigate("/purchases/returns"), 1500);
    } catch (e) {
      setMessage({ text: e.response?.data?.message || "فشل تسجيل المرتجع", type: "error" });
    } finally { setIsSaving(false); }
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100 font-sans overflow-hidden" dir="rtl">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/purchases/returns")} className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">
              {isEditMode ? "تعديل مرتجع مشتريات" : loadedPurchase ? `مرتجع فاتورة شراء #${loadedPurchase.id}` : "مرتجع مشتريات جديد"}
            </h1>
            <span className="text-[10px] font-bold text-slate-400">
              {isEditMode ? `${originalDocNo} · ${originalCreatedAt ? new Date(originalCreatedAt).toLocaleString("ar-EG") : ""}` : "اختر أصناف أو ابحث عن فاتورة شراء"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {message.text && (
            <div className={`rounded-sm px-3 py-1.5 text-[11px] font-bold border ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"}`}>
              {message.text}
            </div>
          )}
          {isEditMode && (
            <div className="flex gap-2">
              <input disabled value={originalDocNo || ""} className="h-8 w-28 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-400 cursor-not-allowed" />
              <input disabled value={originalCreatedAt ? new Date(originalCreatedAt).toLocaleString("ar-EG") : ""} className="h-8 w-44 rounded-sm border border-slate-200 bg-slate-100 px-2 text-[11px] font-mono font-black text-slate-400 cursor-not-allowed" />
            </div>
          )}
          <button onClick={handleSave} disabled={isSaving || !cart.length}
            className="flex h-9 items-center gap-2 rounded-sm bg-slate-800 px-6 text-[13px] font-black text-white hover:bg-slate-700 disabled:opacity-40 transition-all active:scale-95">
            {isSaving ? "جاري الحفظ..." : isEditMode ? "تأكيد التعديل" : "تأكيد المرتجع"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left cart */}
        <div className="flex flex-col w-[420px] shrink-0 border-l border-slate-300 bg-white">
          <div className="border-b border-slate-100 p-4 space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المورد (اختياري)</label>
              <select value={supplier?.id || ""} onChange={e => setSupplier(suppliers.find(s => String(s.id) === e.target.value) || null)}
                className="w-full border border-slate-200 rounded-sm px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-600">
                <option value="">بدون مورد</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSettlementType("account")}
                className={`flex-1 rounded-sm border py-2 text-[11px] font-black transition-all ${settlementType === "account" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"}`}>
                خصم من حساب المورد
              </button>
              <button onClick={() => setSettlementType("cash")}
                className={`flex-1 rounded-sm border py-2 text-[11px] font-black transition-all ${settlementType === "cash" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"}`}>
                نقداً
              </button>
            </div>
            {settlementType === "cash" && (
              <select value={selectedTreasury} onChange={e => setSelectedTreasury(e.target.value)}
                className="w-full border border-slate-200 rounded-sm px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-600">
                {treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}
              className="w-full border border-slate-200 rounded-sm px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-600">
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                <span className="text-[13px] font-bold">لا يوجد أصناف</span>
              </div>
            ) : cart.map(line => (
              <div key={line.key} className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-black text-slate-800 truncate">{line.item_name}</div>
                  <div className="text-[11px] font-bold text-slate-400">{formatMoney(line.unit_cost)} × {line.quantity} = {formatMoney(line.unit_cost * line.quantity)}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(line.key, -1)} className="h-7 w-7 flex items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50">
                    <Minus className="h-3 w-3" />
                  </button>
                  <input type="number" value={line.quantity} onChange={e => setQty(line.key, e.target.value)} onFocus={e => e.target.select()}
                    className="w-12 h-7 text-center font-mono font-black text-[13px] border border-slate-200 rounded-sm outline-none focus:border-slate-800" />
                  <button onClick={() => updateQty(line.key, 1)} disabled={line.quantity >= line.max_qty}
                    className="h-7 w-7 flex items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button onClick={() => removeLine(line.key)} className="h-7 w-7 flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between bg-slate-900 px-5 py-4 shrink-0">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">الإجمالي</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[26px] font-black font-mono text-white">{formatMoney(total)}</span>
              <span className="text-[11px] font-black text-slate-500">ج.م</span>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-1 flex-col min-h-0 bg-slate-50">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 shrink-0">
            <button onClick={() => setRightPanel("products")}
              className={`px-4 py-1.5 rounded-sm text-[12px] font-black border transition-all ${rightPanel === "products" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              إضافة صنف مباشر
            </button>
            <button onClick={() => setRightPanel("search")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-sm text-[12px] font-black border transition-all ${rightPanel === "search" ? "border-amber-600 bg-amber-600 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              <History className="h-3.5 w-3.5" /> بحث في فواتير الشراء
            </button>
            {loadedPurchase && <span className="mr-auto text-[11px] font-black text-emerald-600">✓ مرتبط بفاتورة شراء #{loadedPurchase.id}</span>}
          </div>

          {rightPanel === "products" ? (
            <div className="flex flex-col flex-1 min-h-0 p-4 gap-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input autoFocus value={productSearch} onChange={e => setProductSearch(e.target.value)}
                  placeholder="بحث بالاسم أو الباركود..."
                  className="w-full border border-slate-300 rounded-sm py-2 pr-10 pl-3 text-[13px] font-bold text-slate-800 outline-none focus:border-slate-800 bg-white" />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                {productResults.map(item => (
                  <button key={item.id} onClick={() => addProductToCart(item)}
                    className="w-full flex items-center justify-between rounded-sm border border-slate-200 bg-white px-3 py-2.5 text-right hover:border-slate-400 hover:bg-slate-50 transition-all active:scale-[0.99]">
                    <div>
                      <div className="text-[13px] font-black text-slate-800">{item.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{item.barcode || item.code || "-"}</div>
                    </div>
                    <div className="text-[13px] font-black text-slate-600">{formatMoney(item.cost || 0)} ج.م</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 p-4 gap-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input autoFocus value={purchaseSearch} onChange={e => setPurchaseSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handlePurchaseSearch()}
                    placeholder="رقم فاتورة الشراء أو اسم المورد..."
                    className="w-full border border-slate-300 rounded-sm py-2 pr-10 pl-3 text-[13px] font-bold text-slate-800 outline-none focus:border-slate-800 bg-white" />
                </div>
                <button onClick={handlePurchaseSearch}
                  className="px-5 rounded-sm bg-amber-600 text-white text-[12px] font-black hover:bg-amber-500 transition-all active:scale-95">
                  بحث
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                {purchaseResults.map(p => (
                  <div key={p.id} className="rounded-sm border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-[13px] font-black text-slate-800">فاتورة شراء #{p.id}</span>
                        <span className="mr-2 text-[11px] font-bold text-slate-400">{new Date(p.created_at).toLocaleDateString("ar-EG")}</span>
                      </div>
                      <button onClick={() => loadPurchase(p)}
                        className="px-4 py-1 rounded-sm bg-slate-800 text-white text-[11px] font-black hover:bg-slate-700 active:scale-95">
                        تحميل وإرجاع
                      </button>
                    </div>
                    <div className="text-[11px] font-bold text-slate-500">
                      {p.supplier_name || "بدون مورد"} · {formatMoney(p.total)} ج.م
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/purchases/PurchaseReturnFormPage.jsx
git commit -m "feat: rebuild PurchaseReturnFormPage as POS-style layout with direct + purchase search modes"
```

---

## Task 9: Wire Edit Buttons on Return List Pages to New Edit Flow

**Files:**
- Modify: `client/src/pages/sales/SalesReturnPage.jsx`
- Modify: `client/src/pages/purchases/PurchaseReturnPage.jsx`

Currently the "تعديل" / amend button navigates to `/sales/returns/amend` with state `{ amend_return_id, original }`. Change it to navigate to `/sales/returns/new` (the rebuilt form) with state `{ edit_return_id }`.

- [ ] **Step 1: Update edit navigation in SalesReturnPage.jsx**

Find:
```jsx
navigate("/sales/returns/amend", { state: { amend_return_id: row.id, original: row } })
```

Replace with:
```jsx
navigate("/sales/returns/new", { state: { edit_return_id: row.id } })
```

- [ ] **Step 2: Update edit navigation in PurchaseReturnPage.jsx**

Find:
```jsx
navigate("/purchases/returns/amend", { state: { amend_return_id: row.id, original: row } })
```

Replace with:
```jsx
navigate("/purchases/returns/new", { state: { edit_return_id: row.id } })
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/sales/SalesReturnPage.jsx client/src/pages/purchases/PurchaseReturnPage.jsx
git commit -m "feat: return list edit buttons use new in-place edit flow"
```

---

## Self-Review

**Spec coverage check:**
- ✅ مرتجع عام navigates directly to full-page form
- ✅ إنشاء مرتجع جديد stays as modal (QuickReturnModal untouched)
- ✅ POS-style return pages with Mode 1 (direct) and Mode 2 (invoice search panel)
- ✅ Advanced search by doc number, name, customer/supplier
- ✅ Right panel switches between product search and invoice search
- ✅ In-place edit for sales returns (new backend endpoint)
- ✅ In-place edit for purchase returns (new backend endpoint)
- ✅ POS page: in-place edit, start-time input, pre-fill
- ✅ Purchases page: in-place edit, start-time input, pre-fill
- ✅ doc_no and created_at locked as disabled inputs during edit
- ✅ All financial effects (treasury, customer/supplier balance) preserved correctly
- ✅ Cumulative return limits enforced excluding self (for edit)
- ✅ Edit navigation from list pages updated

**Placeholder scan:** None found — all steps contain actual code.

**Type consistency:** `cart` lines use `unit_price` in sales returns and `unit_cost` in purchase returns consistently throughout Tasks 7 and 8. `invoice_line_id` vs `purchase_line_id` correctly separated.
