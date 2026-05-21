# Returns Edit Flow — POS Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix edit mode for `SalesReturnFormPage` and `PurchaseReturnFormPage` so that doc number, date/time, item SKU code, unit, and warehouse all populate correctly when reopening an existing return for editing.

**Architecture:** (1) Make `useInvoiceActivation` reactive so it syncs async edit values after mount. (2) Enrich the server return-line queries with `item_code` and `unit_id` from the items table. (3) Fix per-line warehouse bug in both edit functions. (4) Refactor both form pages to a two-effect pattern: Effect 1 fetches and stores raw data; Effect 2 fires once reference lists (warehouses, units) are loaded and resolves names into the cart.

**Tech Stack:** React 18, Express.js, better-sqlite3 (synchronous), Jest (server tests), Vite

---

## File Map

| File | What changes |
|------|-------------|
| `client/src/hooks/useInvoiceActivation.js` | Add `useEffect` import; add reactive sync effect |
| `server/src/services/returnService.js` | `getReturnDetails` lines query: +2 columns; `editSalesReturn` line 384: per-line warehouse fix |
| `server/src/routes/purchases.routes.js` | `GET /returns/:id` lines query: +2 columns; `editPurchaseReturn` lines 971 + 983: per-line warehouse fix |
| `client/src/pages/sales/SalesReturnFormPage.jsx` | Add `rawEditData` state; replace single edit effect with Effect 1 + Effect 2 |
| `client/src/pages/purchases/PurchaseReturnFormPage.jsx` | Symmetric changes to above |
| `server/tests/returnService.test.js` | Two new tests: `getReturnDetails` enrichment + per-line warehouse correctness |

---

## Task 1: Fix `useInvoiceActivation` — doc number and date/time in edit mode

**Files:**
- Modify: `client/src/hooks/useInvoiceActivation.js`

**Problem:** `useState(editValues?.docNo ?? null)` only runs once on first render. When both returns pages call the hook, `editActivation` is still `null` at that moment (API call not yet complete). The hook never re-initialises, so the header always shows `"—"`.

- [ ] **Step 1: Add `useEffect` to the import**

Open `client/src/hooks/useInvoiceActivation.js`. Change line 1 from:
```js
import { useState, useRef, useCallback } from "react";
```
to:
```js
import { useState, useRef, useCallback, useEffect } from "react";
```

- [ ] **Step 2: Add the reactive sync effect inside the hook**

After the three `useState` lines (after `const [isActive, setIsActive] = useState(isEditMode);`) and before the `activate` callback, add:

```js
  // Sync when editValues arrive asynchronously (returns pages load edit data from API after mount)
  useEffect(() => {
    if (editValues?.docNo && !isActive) {
      setDocNo(editValues.docNo);
      setCreatedAt(editValues.createdAt ?? null);
      setIsActive(true);
    }
  }, [editValues?.docNo]);
```

The full file after the change:
```js
import { useState, useRef, useCallback, useEffect } from "react";
import api from "../services/api";

/**
 * Manages idle → active state for invoice forms.
 * Doc number and createdAt are null until the user's first meaningful interaction.
 *
 * @param {string} documentType - 'pos_sale' | 'purchase_receipt' | 'sales_return' | 'purchase_return'
 * @param {{ docNo: string, createdAt: string }|null} editValues
 *   Pass existing doc_no + created_at when in edit/amend mode — skips activation entirely.
 */
export function useInvoiceActivation(documentType, editValues = null) {
  const isEditMode = !!editValues;

  const [docNo, setDocNo] = useState(editValues?.docNo ?? null);
  const [createdAt, setCreatedAt] = useState(editValues?.createdAt ?? null);
  const [isActive, setIsActive] = useState(isEditMode);
  const activating = useRef(false);

  // Sync when editValues arrive asynchronously (returns pages load edit data from API after mount)
  useEffect(() => {
    if (editValues?.docNo && !isActive) {
      setDocNo(editValues.docNo);
      setCreatedAt(editValues.createdAt ?? null);
      setIsActive(true);
    }
  }, [editValues?.docNo]);

  // Call on first meaningful user interaction (add item / select party / toggle search).
  const activate = useCallback(async () => {
    if (isActive || activating.current || isEditMode) return;
    activating.current = true;
    try {
      const res = await api.post("/api/documents/reserve", { type: documentType });
      const reserved = res.data.data.doc_no;
      const now = new Date().toISOString();
      setDocNo(reserved);
      setCreatedAt(now);
      setIsActive(true);
    } catch {
      // Non-fatal: doc number will be generated server-side on save as fallback
    } finally {
      activating.current = false;
    }
  }, [isActive, isEditMode, documentType]);

  // Reset to idle state — call after successful save
  const reset = useCallback(() => {
    setDocNo(null);
    setCreatedAt(null);
    setIsActive(false);
    activating.current = false;
  }, []);

  return { docNo, createdAt, isActive, activate, reset };
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useInvoiceActivation.js
git commit -m "fix: make useInvoiceActivation reactive to async edit values"
```

---

## Task 2: Enrich `getReturnDetails` lines with `item_code` and `unit_id`

**Files:**
- Modify: `server/src/services/returnService.js` (lines 338–343)
- Test: `server/tests/returnService.test.js`

**Problem:** The lines query in `getReturnDetails` does not return `item_code` or `unit_id`. The items table is already LEFT JOINed (for `item_name`), so only two SELECT columns need adding.

- [ ] **Step 1: Write the failing test**

Open `server/tests/returnService.test.js`. Add this test inside the existing `describe("returnService", ...)` block (after the existing test):

```js
test("getReturnDetails returns item_code and unit_id for each line", () => {
  const db = getDb();
  db.prepare("UPDATE items SET code = 'SKU-001' WHERE id = 1").run();

  const invoice = createInvoice({
    lines: [{ item_id: 1, quantity: 2, unit_price: 500 }],
    discount: 0,
    payment_type: "cash",
    warehouse_id: 1,
  });

  const invoiceLine = db
    .prepare("SELECT * FROM invoice_lines WHERE invoice_id = ?")
    .get(invoice.id);

  const { createReturn, getReturnDetails } = require("../src/services/returnService");
  const ret = createReturn(invoice.id, {
    lines: [{ invoice_line_id: invoiceLine.id, quantity: 1 }],
  });

  const details = getReturnDetails(ret.id);
  expect(details.lines).toHaveLength(1);
  expect(details.lines[0].item_code).toBe("SKU-001");
  expect(details.lines[0].unit_id).toBe(1);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test --prefix server -- --testPathPattern=returnService
```

Expected output: FAIL — `details.lines[0].item_code` is `undefined`.

- [ ] **Step 3: Fix the query in `getReturnDetails`**

In `server/src/services/returnService.js`, replace the lines query (lines 338–343):

```js
  const lines = db.prepare(`
    SELECT srl.*, COALESCE(srl.item_name_ar, i.name) as item_name
    FROM sales_return_lines srl
    LEFT JOIN items i ON i.id = srl.item_id
    WHERE srl.sales_return_id = ?
  `).all(id);
```

with:

```js
  const lines = db.prepare(`
    SELECT srl.*,
           COALESCE(srl.item_name_ar, i.name) as item_name,
           i.code as item_code,
           i.unit_id
    FROM sales_return_lines srl
    LEFT JOIN items i ON i.id = srl.item_id
    WHERE srl.sales_return_id = ?
  `).all(id);
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test --prefix server -- --testPathPattern=returnService
```

Expected output: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/returnService.js server/tests/returnService.test.js
git commit -m "fix: include item_code and unit_id in getReturnDetails lines"
```

---

## Task 3: Fix per-line warehouse bug in `editSalesReturn`

**Files:**
- Modify: `server/src/services/returnService.js` (line 384)
- Test: `server/tests/returnService.test.js`

**Problem:** On line 384, `warehouse_id: payload.warehouse_id || 1` uses a single root-level value for all lines. When the client sends per-line `warehouse_id` values, stock reversals go to the wrong warehouse. The fix reads `requestedLine.warehouse_id` first.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe("returnService", ...)` block in `server/tests/returnService.test.js`:

```js
test("editSalesReturn uses per-line warehouse_id for stock adjustments", () => {
  const db = getDb();
  db.prepare("INSERT INTO warehouses (name) VALUES ('Warehouse B')").run();
  db.prepare("INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (1, 2, 5)").run();
  db.prepare("INSERT INTO treasuries (name, balance) VALUES ('Cash', 10000)").run();
  db.prepare("UPDATE settings SET default_treasury_id = 1 WHERE id = 1").run();

  const { createGeneralReturn, editSalesReturn } = require("../src/services/returnService");

  // Create a general return from warehouse 1
  const ret = createGeneralReturn({
    lines: [{ item_id: 1, quantity: 2, unit_price: 500, warehouse_id: 1 }],
    refund_method: "cash_back",
  });

  // warehouse 1 stock: 10 + 2 = 12
  expect(db.prepare("SELECT quantity FROM stock_levels WHERE item_id=1 AND warehouse_id=1").get().quantity).toBe(12);

  // Edit: change to warehouse 2, qty 1
  editSalesReturn(ret.id, {
    lines: [{ item_id: 1, quantity: 1, unit_price: 500, warehouse_id: 2 }],
    refund_method: "cash_back",
  });

  // Old stock reversed at warehouse 1: 12 - 2 = 10
  expect(db.prepare("SELECT quantity FROM stock_levels WHERE item_id=1 AND warehouse_id=1").get().quantity).toBe(10);
  // New stock applied at warehouse 2: 5 + 1 = 6
  expect(db.prepare("SELECT quantity FROM stock_levels WHERE item_id=1 AND warehouse_id=2").get().quantity).toBe(6);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test --prefix server -- --testPathPattern=returnService
```

Expected: FAIL — warehouse 2 stock is 5 (not 6) because the bug routes new stock to warehouse 1.

- [ ] **Step 3: Fix line 384 in `editSalesReturn`**

In `server/src/services/returnService.js`, find this line inside `editSalesReturn` (the direct-return branch, `if (!sr.invoice_id)`):

```js
        preparedLines.push({ invoice_line_id: null, item_id: requestedLine.item_id, quantity: Number(requestedLine.quantity), unit_price: Number(requestedLine.unit_price), line_total: lineTotal, warehouse_id: payload.warehouse_id || 1, item_name_ar: itemRow?.name || null, item_name_en: itemRow?.name_en || null, cost_wacc: snap.cost_wacc, cost_last_purchase: snap.cost_last_purchase });
```

Replace `warehouse_id: payload.warehouse_id || 1` with `warehouse_id: requestedLine.warehouse_id || payload.warehouse_id || 1`:

```js
        preparedLines.push({ invoice_line_id: null, item_id: requestedLine.item_id, quantity: Number(requestedLine.quantity), unit_price: Number(requestedLine.unit_price), line_total: lineTotal, warehouse_id: requestedLine.warehouse_id || payload.warehouse_id || 1, item_name_ar: itemRow?.name || null, item_name_en: itemRow?.name_en || null, cost_wacc: snap.cost_wacc, cost_last_purchase: snap.cost_last_purchase });
```

- [ ] **Step 4: Run all returnService tests to confirm they all pass**

```bash
npm test --prefix server -- --testPathPattern=returnService
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/returnService.js server/tests/returnService.test.js
git commit -m "fix: use per-line warehouse_id in editSalesReturn"
```

---

## Task 4: Fix purchase return detail query and per-line warehouse bug in `editPurchaseReturn`

**Files:**
- Modify: `server/src/routes/purchases.routes.js` (lines 154–159 and lines 971, 983)

There is no isolated unit-test file for `editPurchaseReturn` (it lives in the route file, not a service file). Correctness is verified in Task 6 (manual browser test of the purchase return edit flow).

- [ ] **Step 1: Fix the `GET /returns/:id` lines query (lines 154–159)**

In `server/src/routes/purchases.routes.js`, replace:

```js
      const lines = db.prepare(`
        SELECT prl.*, i.name as item_name
        FROM purchase_return_lines prl
        LEFT JOIN items i ON i.id = prl.item_id
        WHERE prl.purchase_return_id = ?
      `).all(req.params.id);
```

with:

```js
      const lines = db.prepare(`
        SELECT prl.*,
               i.name as item_name,
               i.code as item_code,
               i.unit_id
        FROM purchase_return_lines prl
        LEFT JOIN items i ON i.id = prl.item_id
        WHERE prl.purchase_return_id = ?
      `).all(req.params.id);
```

- [ ] **Step 2: Fix the per-line warehouse bug in `editPurchaseReturn` — direct mode (line 971)**

Find this line inside `editPurchaseReturn` in the `if (!pr.purchase_id)` branch:

```js
        preparedLines.push({ purchase_line_id: null, item_id: requestedLine.item_id, quantity: Number(requestedLine.quantity), unit_cost: Number(requestedLine.unit_cost), line_total: lineTotal, warehouse_id: payload.warehouse_id || 1 });
```

Change `warehouse_id: payload.warehouse_id || 1` to `warehouse_id: requestedLine.warehouse_id || payload.warehouse_id || 1`:

```js
        preparedLines.push({ purchase_line_id: null, item_id: requestedLine.item_id, quantity: Number(requestedLine.quantity), unit_cost: Number(requestedLine.unit_cost), line_total: lineTotal, warehouse_id: requestedLine.warehouse_id || payload.warehouse_id || 1 });
```

- [ ] **Step 3: Fix the per-line warehouse bug in `editPurchaseReturn` — purchase-linked mode (line 983)**

Find this line inside the `else` branch of `editPurchaseReturn`:

```js
        preparedLines.push({ purchase_line_id: purchaseLine.id, item_id: purchaseLine.item_id, quantity: qty, unit_cost: purchaseLine.unit_cost, line_total: lineTotal, warehouse_id: payload.warehouse_id || 1 });
```

Change `warehouse_id: payload.warehouse_id || 1` to `warehouse_id: requestedLine.warehouse_id || purchaseLine.warehouse_id || payload.warehouse_id || 1`:

```js
        preparedLines.push({ purchase_line_id: purchaseLine.id, item_id: purchaseLine.item_id, quantity: qty, unit_cost: purchaseLine.unit_cost, line_total: lineTotal, warehouse_id: requestedLine.warehouse_id || purchaseLine.warehouse_id || payload.warehouse_id || 1 });
```

- [ ] **Step 4: Run the full server test suite to confirm no regressions**

```bash
npm test --prefix server
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/purchases.routes.js
git commit -m "fix: enrich purchase return lines with item_code/unit_id; use per-line warehouse_id in editPurchaseReturn"
```

---

## Task 5: Refactor `SalesReturnFormPage` — two-effect pattern

**Files:**
- Modify: `client/src/pages/sales/SalesReturnFormPage.jsx`

**What this fixes:** warehouse_name and unit_name blank in direct-mode cart on edit; doc number and date already fixed by Task 1 via `editActivation` → hook sync.

- [ ] **Step 1: Add `rawEditData` state**

In `SalesReturnFormPage`, after the existing `const [editActivation, setEditActivation] = useState(null);` line, add:

```js
  const [rawEditData, setRawEditData] = useState(null);
```

- [ ] **Step 2: Replace the existing single edit effect with Effect 1**

Find and **delete** the existing `useEffect` that starts with:
```js
  useEffect(() => {
    if (!isEditMode) return;
    setIsLocked(true);
    api.get(`/api/invoices/returns/${editReturnId}`).then(r => {
```
(it runs through to line 271, ending with `}, [isEditMode, editReturnId]);`)

Replace it entirely with:

```js
  // Effect 1: fetch edit data — sets non-cart fields only
  useEffect(() => {
    if (!isEditMode) return;
    setIsLocked(true);
    api.get(`/api/invoices/returns/${editReturnId}`).then(r => {
      const sr = r.data.data;
      setRawEditData(sr);
      setEditActivation({ docNo: sr.doc_no || "", createdAt: sr.created_at || new Date().toISOString() });
      setRefundMethod(sr.refund_method || "cash_back");
      if (sr.refund_method === "split") setSplitCashAmount(String(sr.cash_amount || ""));
      setReason(sr.reason || "other");
      if (sr.customer_id) setCustomer({ id: sr.customer_id, name: sr.customer_name || String(sr.customer_id) });
      setMode(sr.invoice_id ? "invoice" : "direct");
    }).catch(() => {});
  }, [isEditMode, editReturnId]);
```

- [ ] **Step 3: Add Effect 2 immediately after Effect 1**

```js
  // Effect 2: resolve warehouse/unit names once reference lists are loaded
  useEffect(() => {
    if (!rawEditData || !warehouses.length || !units.length) return;
    const sr = rawEditData;

    if (sr.invoice_id) {
      api.get(`/api/invoices/${sr.invoice_id}`).then(inv => {
        const invData = inv.data.data;
        setLoadedInvoice(invData);
        const returnedIds = new Set((sr.lines || []).map(l => l.invoice_line_id));
        setInvoiceLines((invData.lines || []).map(l => {
          const returnLine = (sr.lines || []).find(rl => rl.invoice_line_id === l.id);
          const alreadyReturned = Number(l.returned_quantity || 0);
          return {
            invoice_line_id: l.id,
            item_id: l.item_id,
            item_code: l.item_code || l.barcode || "",
            item_name: l.item_name_ar || l.item_name || l.name,
            unit_price: Number(l.unit_price || 0),
            original_qty: Number(l.quantity),
            already_returned: alreadyReturned,
            qty_to_return: returnLine ? Number(returnLine.quantity) : 0,
            checked: !!returnLine,
          };
        }).filter(l => l.original_qty - l.already_returned > 0 || returnedIds.has(l.invoice_line_id)));
      }).catch(() => {});
    } else {
      setCart((sr.lines || []).map((l, idx) => ({
        key: `edit-${l.id || idx}`,
        item_id: l.item_id,
        item_name: l.item_name_ar || l.item_name || l.name,
        item_code: l.item_code || "",
        unit_price: Number(l.unit_price || 0),
        quantity: Number(l.quantity),
        warehouse_id: l.warehouse_id || "",
        warehouse_name: warehouses.find(w => String(w.id) === String(l.warehouse_id))?.name || "—",
        unit_id: String(l.unit_id || ""),
        unit_name: units.find(u => String(u.id) === String(l.unit_id))?.name || "أساسية",
      })));
    }
  }, [rawEditData, warehouses, units]);
```

- [ ] **Step 4: Start the dev server and manually verify the edit flow**

```bash
npm run dev
```

1. Open any existing sales return from the returns list (navigate to `/sales/returns`, click a row, then click Edit).
2. Confirm the header shows the original doc number (e.g. `SR-250520-0001`) and original date — not `"—"`.
3. For a **direct-mode** return: confirm the cart table shows the correct warehouse name and unit name (not blank).
4. For an **invoice-mode** return: confirm the invoice lines load correctly with item codes.
5. Make a small edit (change a quantity) and click Save. Confirm success toast and the return saves correctly.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/sales/SalesReturnFormPage.jsx
git commit -m "fix: two-effect edit pattern in SalesReturnFormPage — warehouse, unit, item_code now populate on edit"
```

---

## Task 6: Refactor `PurchaseReturnFormPage` — two-effect pattern (symmetric)

**Files:**
- Modify: `client/src/pages/purchases/PurchaseReturnFormPage.jsx`

All changes are symmetric to Task 5, with these differences: API endpoint is `/api/purchases/returns/:id`; invoice mode uses `purchase_id` / `purchaseLines` / `loadedPurchase`; cart price field is `unit_cost` not `unit_price`; mode string is `"purchase"` not `"invoice"`.

- [ ] **Step 1: Add `rawEditData` state**

After `const [editActivation, setEditActivation] = useState(null);`, add:

```js
  const [rawEditData, setRawEditData] = useState(null);
```

- [ ] **Step 2: Replace the existing single edit effect with Effect 1**

Find and delete the existing `useEffect` that starts with:
```js
  useEffect(() => {
    if (!isEditMode) return;
    setIsLocked(true);
    api.get(`/api/purchases/returns/${editReturnId}`).then(r => {
```
(ends with `}, [isEditMode, editReturnId]);`)

Replace with:

```js
  // Effect 1: fetch edit data — sets non-cart fields only
  useEffect(() => {
    if (!isEditMode) return;
    setIsLocked(true);
    api.get(`/api/purchases/returns/${editReturnId}`).then(r => {
      const pr = r.data.data;
      setRawEditData(pr);
      setEditActivation({ docNo: pr.doc_no || "", createdAt: pr.created_at || new Date().toISOString() });
      setSettlementType(pr.settlement_type || "account");
      if (pr.settlement_type === "split") setSplitCashAmount(String(pr.cash_amount || ""));
      setReason(pr.reason || "other");
      if (pr.supplier_id) setSupplier({ id: pr.supplier_id, name: pr.supplier_name || String(pr.supplier_id) });
      setMode(pr.purchase_id ? "purchase" : "direct");
    }).catch(() => {});
  }, [isEditMode, editReturnId]);
```

- [ ] **Step 3: Add Effect 2 immediately after Effect 1**

```js
  // Effect 2: resolve warehouse/unit names once reference lists are loaded
  useEffect(() => {
    if (!rawEditData || !warehouses.length || !units.length) return;
    const pr = rawEditData;

    if (pr.purchase_id) {
      api.get(`/api/purchases/${pr.purchase_id}`).then(pur => {
        const purData = pur.data.data;
        setLoadedPurchase(purData);
        const returnedIds = new Set((pr.lines || []).map(l => l.purchase_line_id));
        setPurchaseLines((purData.lines || []).map(l => {
          const returnLine = (pr.lines || []).find(rl => rl.purchase_line_id === l.id);
          const alreadyReturned = Number(l.returned_quantity || 0);
          return {
            purchase_line_id: l.id,
            item_id: l.item_id,
            item_code: l.item_code || l.barcode || "",
            item_name: l.item_name_ar || l.item_name || l.name,
            unit_cost: Number(l.unit_cost || l.unit_price || 0),
            original_qty: Number(l.quantity),
            already_returned: alreadyReturned,
            qty_to_return: returnLine ? Number(returnLine.quantity) : 0,
            checked: !!returnLine,
          };
        }).filter(l => l.original_qty - l.already_returned > 0 || returnedIds.has(l.purchase_line_id)));
      }).catch(() => {});
    } else {
      setCart((pr.lines || []).map((l, idx) => ({
        key: `edit-${l.id || idx}`,
        item_id: l.item_id,
        item_name: l.item_name_ar || l.item_name || l.name,
        item_code: l.item_code || "",
        unit_cost: Number(l.unit_cost || l.unit_price || 0),
        quantity: Number(l.quantity),
        warehouse_id: l.warehouse_id || "",
        warehouse_name: warehouses.find(w => String(w.id) === String(l.warehouse_id))?.name || "—",
        unit_id: String(l.unit_id || ""),
        unit_name: units.find(u => String(u.id) === String(l.unit_id))?.name || "أساسية",
      })));
    }
  }, [rawEditData, warehouses, units]);
```

- [ ] **Step 4: Start the dev server and manually verify the purchase return edit flow**

```bash
npm run dev
```

1. Open any existing purchase return from `/purchases/returns`, click Edit.
2. Confirm the header shows the original doc number and date — not `"—"`.
3. For a **direct-mode** return: confirm warehouse name and unit name are visible in the cart.
4. For a **purchase-linked** return: confirm purchase lines load correctly.
5. Edit a quantity and Save. Confirm success.

- [ ] **Step 5: Run the full server test suite one final time**

```bash
npm test --prefix server
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/purchases/PurchaseReturnFormPage.jsx
git commit -m "fix: two-effect edit pattern in PurchaseReturnFormPage — warehouse, unit, item_code now populate on edit"
```
