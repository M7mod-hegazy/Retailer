# Returns Edit Flow — POS-Parity Design

**Date:** 2026-05-20
**Scope:** `SalesReturnFormPage` (`/sales/returns/new`) and `PurchaseReturnFormPage` (`/purchase/returns/new`)

---

## Problem

When opening an existing sales or purchase return for editing, the cart shows blank values for the warehouse (`المستودع`) and unit (`الوحدة`) columns because:

1. The API response for return lines does not include `warehouse_name`, `unit_name`, or `item_code`.
2. The client populates the cart immediately in the same effect that fetches the return data — before the `warehouses` and `units` lists finish loading (race condition).

Additionally, a correctness bug in `editSalesReturn` uses a single root-level `warehouse_id` for all direct-return lines instead of per-line values, causing stock reversals to target the wrong warehouse.

The original doc number and date/time are already shown correctly (via `useInvoiceActivation` with `editActivation` seed).

---

## Approach

**Client-side resolution (POS amendment pattern):** Keep the API mostly unchanged. Split the current single edit effect into two effects — matching how POSPage handles `amendContext` — so that name resolution happens after reference lists are loaded.

**Server:** Minimal additions only — two extra SELECT columns in the return line queries, and one warehouse bug fix.

---

## Architecture

### Two-Effect Pattern (both form pages)

**Effect 1** — deps: `[isEditMode, editReturnId]`
- Fetches `GET /api/invoices/returns/:id` (sales) or `GET /api/purchases/returns/:id` (purchases).
- Stores raw API data in new `rawEditData` state.
- Sets non-cart fields: `editActivation`, `refundMethod`, `splitCashAmount`, `reason`, `customer`/`supplier`, `mode`.
- Does NOT touch cart or invoice/purchase lines yet.

**Effect 2** — deps: `[rawEditData, warehouses, units]`
- Fires only when all three are non-empty (guard: `if (!rawEditData || !warehouses.length || !units.length) return`).
- **Direct mode:** Builds cart objects with resolved `warehouse_name` and `unit_name`.
- **Invoice/purchase mode:** Fetches the original invoice/purchase document (same API call as today), then sets `invoiceLines` / `purchaseLines` (unchanged logic, just moved here).

---

## Server Changes

### 1. `server/src/services/returnService.js` — `getReturnDetails`

Extend the lines query SELECT to include two extra columns (items table already LEFT JOINed):

```sql
SELECT srl.*,
       COALESCE(srl.item_name_ar, i.name) as item_name,
       i.code as item_code,       -- NEW
       i.unit_id                  -- NEW
FROM sales_return_lines srl
LEFT JOIN items i ON i.id = srl.item_id
WHERE srl.sales_return_id = ?
```

### 2. `server/src/routes/purchases.routes.js` — purchase return detail query

Apply the same JOIN additions (`i.code as item_code`, `i.unit_id`) to the purchase return lines SELECT. The items table join pattern is the same.

### 3. `server/src/services/returnService.js` — `editSalesReturn` bug fix (line ~384)

```js
// Before (bug):
warehouse_id: payload.warehouse_id || 1

// After:
warehouse_id: requestedLine.warehouse_id || payload.warehouse_id || 1
```

This ensures stock reversals on direct-return edits target the correct per-line warehouse.

---

## Client Changes

### New state (both pages)

```js
const [rawEditData, setRawEditData] = useState(null);
```

### Effect 1 (replace existing single edit effect)

```js
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

### Effect 2 (new)

```js
useEffect(() => {
  if (!rawEditData || !warehouses.length || !units.length) return;
  const sr = rawEditData;

  if (sr.invoice_id) {
    // invoice mode: load original invoice (existing logic)
    api.get(`/api/invoices/${sr.invoice_id}`).then(inv => {
      /* ... existing loadInvoice + returnedIds logic unchanged ... */
    }).catch(() => {});
  } else {
    // direct mode: resolve names from loaded lists
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

### PurchaseReturnFormPage — symmetric

Identical two-effect pattern. API endpoint: `GET /api/purchases/returns/:id`. Cart field `unit_price` → `unit_cost`. Mode values: `"purchase"` instead of `"invoice"`.

---

## Financial / Side-Effect Context

The server's `editSalesReturn` and purchase equivalent already correctly handle all financial reversals:
- Reverses old stock movements before applying new ones.
- Reverses old treasury balance changes (cash refund out / cash received back).
- Reverses old customer `opening_balance` (store_credit) and supplier `opening_balance` (account settlement).
- Re-applies everything with new line values.

No changes needed to this logic — the per-line warehouse fix (Fix 3) is the only correctness gap.

---

## Files Changed

| File | Change |
|------|--------|
| `server/src/services/returnService.js` | `getReturnDetails` lines query: +2 SELECT columns; `editSalesReturn`: per-line warehouse fix |
| `server/src/routes/purchases.routes.js` | Purchase return detail lines query: +2 SELECT columns |
| `client/src/pages/sales/SalesReturnFormPage.jsx` | Add `rawEditData` state; split edit effect into Effect 1 + Effect 2 |
| `client/src/pages/purchases/PurchaseReturnFormPage.jsx` | Same symmetric changes |

---

## Out of Scope

- No DB migrations (unit resolution uses current item unit via JOIN, not stored at creation time).
- No changes to invoice/purchase mode line display (warehouse column not shown there; internal warehouse_id already comes from original document line).
- No changes to treasury, accounts, or delete flows (already correct on server).
