# Invoice Input Validation & Unit Decimal Setting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four invoice input bugs across all invoice systems: merge duplicate items instead of creating new lines, enforce per-unit decimal control, block negative-stock inserts and inline edits, and show projected post-purchase stock in the purchase form staging area.

**Architecture:** Add `allow_decimal` to the `units` table (migration + API), expose it via the existing `/api/units` endpoint (all pages already load units), then use it in every staging qty input. Duplicate-merge logic is added directly to each page's `addLine`/`addToCart` function. Stock guards are added as early returns in the same functions and `min="1"` on inline qty inputs.

**Tech Stack:** SQLite (better-sqlite3, synchronous), Express.js routes, React 18 + Vite, Zustand (posStore), TailwindCSS, DataGrid component.

---

## File Map

| File | Change |
|---|---|
| `electron/migrations/103_add_allow_decimal_to_units.js` | **CREATE** — migration adds `allow_decimal INTEGER DEFAULT 1` |
| `server/src/routes/units.routes.js` | **MODIFY** — include `allow_decimal` in INSERT and UPDATE |
| `client/src/components/crud/SimpleCrudPage.jsx` | **MODIFY** — add `type: "toggle"` field rendering |
| `client/src/pages/definitions/UnitsPage.jsx` | **MODIFY** — add `allow_decimal` toggle field and table column |
| `client/src/pages/purchases/PurchaseFormPage.jsx` | **MODIFY** — merge duplicates, int qty, projected stock display, `min="1"` on table qty |
| `client/src/pages/purchases/PurchaseOrderFormPage.jsx` | **MODIFY** — merge duplicates, int qty |
| `client/src/pages/sales/SalesReturnFormPage.jsx` | **MODIFY** — merge duplicates in direct mode, int qty |
| `client/src/pages/purchases/PurchaseReturnFormPage.jsx` | **MODIFY** — merge duplicates in direct mode, int qty |
| `client/src/pages/pos/POSPage.jsx` | **MODIFY** — int qty on list-view staging input (cart table already enforces integers) |

---

## Task 1: Migration — add `allow_decimal` to `units` table

**Files:**
- Create: `electron/migrations/103_add_allow_decimal_to_units.js`

- [ ] **Step 1: Create migration file**

```js
module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(units)").all().map(c => c.name);
    if (!cols.includes("allow_decimal")) {
      db.exec("ALTER TABLE units ADD COLUMN allow_decimal INTEGER DEFAULT 1");
    }
  },
};
```

- [ ] **Step 2: Verify the migration runs without error**

Run: `npx electron -e "const { getDb, runMigrations } = require('./electron/dbManager'); runMigrations(); const row = require('better-sqlite3')('./server/data/retailer.db').prepare('PRAGMA table_info(units)').all(); console.log(row.map(c => c.name));"`

Expected output includes `allow_decimal`.

- [ ] **Step 3: Commit**

```bash
git add electron/migrations/103_add_allow_decimal_to_units.js
git commit -m "feat(units): add allow_decimal column to units table"
```

---

## Task 2: Units API — persist `allow_decimal`

**Files:**
- Modify: `server/src/routes/units.routes.js`

- [ ] **Step 1: Update the POST route to include `allow_decimal`**

Replace the INSERT in `router.post`:

```js
router.post("/", requirePagePermission("units", "add"), (req, res) => {
  const payload = req.body || {};
  const info = getDb().prepare(
    "INSERT INTO units (name, symbol, is_active, allow_decimal) VALUES (?, ?, ?, ?)"
  ).run(
    payload.name,
    payload.symbol || null,
    payload.is_active === false ? 0 : 1,
    payload.allow_decimal === false || payload.allow_decimal === 0 ? 0 : 1,
  );
  req.audit("create", "units", { id: info.lastInsertRowid }, `⚙️ تم إضافة وحدة: ${payload.name || ''}`);
  res.status(201).json({ success: true, data: getDb().prepare("SELECT * FROM units WHERE id = ?").get(info.lastInsertRowid) });
});
```

- [ ] **Step 2: Update the PUT route to include `allow_decimal`**

Replace the UPDATE in `router.put`:

```js
router.put("/:id", requirePagePermission("units", "edit"), (req, res) => {
  const payload = req.body || {};
  getDb()
    .prepare("UPDATE units SET name = ?, symbol = ?, is_active = ?, allow_decimal = ? WHERE id = ?")
    .run(
      payload.name,
      payload.symbol || null,
      payload.is_active === false ? 0 : 1,
      payload.allow_decimal === false || payload.allow_decimal === 0 ? 0 : 1,
      req.params.id,
    );
  req.audit("update", "units", { id: req.params.id }, `⚙️ تم تعديل وحدة: ${payload.name || ''}`);
  res.json({ success: true, data: getDb().prepare("SELECT * FROM units WHERE id = ?").get(req.params.id) });
});
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/units.routes.js
git commit -m "feat(units): persist allow_decimal via API"
```

---

## Task 3: SimpleCrudPage — support `type: "toggle"` fields

**Files:**
- Modify: `client/src/components/crud/SimpleCrudPage.jsx` (around line 399)

The form currently renders `<input type={field.type || "text"} ...>` for every field. Add a branch before that `<input>` to render a toggle when `field.type === "toggle"`.

- [ ] **Step 1: Find the field render block**

In `SimpleCrudPage.jsx` around line 387–412, find the `{fields.map((field, idx) => (` block. Inside the `<div className="relative">` wrapper (line 399), **replace** the single `<input ...>` with a conditional:

```jsx
<div className="relative">
  {field.type === "toggle" ? (
    <button
      type="button"
      onClick={() => setForm(prev => ({ ...prev, [field.name]: prev[field.name] ? 0 : 1 }))}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 ${
        form[field.name] ? "bg-emerald-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          form[field.name] ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  ) : (
    <input
      type={field.type || "text"}
      required={field.required}
      value={form[field.name]}
      onChange={(e) => setForm(prev => ({ ...prev, [field.name]: e.target.value }))}
      className={`w-full h-12 bg-white rounded-xl px-4 text-sm font-bold outline-none transition-all shadow-sm border ${
        editingRow
          ? 'text-amber-950 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 placeholder:text-amber-300'
          : 'text-zinc-900 border-slate-200 focus:border-zinc-400 placeholder:text-slate-300'
      }`}
      placeholder={`إدخال ${field.label}...`}
    />
  )}
</div>
```

- [ ] **Step 2: Ensure `createInitialState` handles numeric `initialValue` correctly**

`createInitialState` already uses `source[field.name] ?? field.initialValue ?? ""`. Since `allow_decimal` DB values are `0` or `1` (integers), the `??` handles falsy `0` correctly (it only falls back on `null`/`undefined`, not `0`). No change needed.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/crud/SimpleCrudPage.jsx
git commit -m "feat(crud): support toggle field type in SimpleCrudPage"
```

---

## Task 4: UnitsPage — add `allow_decimal` toggle field

**Files:**
- Modify: `client/src/pages/definitions/UnitsPage.jsx`

- [ ] **Step 1: Replace the entire file with the updated version**

```jsx
import React from "react";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";
import { usePageTour } from "../../hooks/usePageTour";

export default function UnitsPage() {
  usePageTour('units');
  return (
    <SimpleCrudPage
      pageKey="units"
      title="وحدات القياس"
      endpoint="/api/units"
      fields={[
        { name: "name", label: "اسم الوحدة", required: true },
        { name: "symbol", label: "الرمز" },
        { name: "allow_decimal", label: "السماح بالكسور العشرية", type: "toggle", initialValue: 1 },
      ]}
      columns={[
        { key: "id", label: "#" },
        { key: "name", label: "الوحدة" },
        { key: "symbol", label: "الرمز" },
        { key: "allow_decimal", label: "كسور", render: (val) => val === 0 ? "✗" : "✓" },
      ]}
    />
  );
}
```

> Note: `SimpleCrudPage` columns currently use `key` for display. Check if the `columns` prop supports a `render` function — if not, skip the render and just show the raw `0`/`1`. Either way the toggle in the form is what matters.

- [ ] **Step 2: Verify the toggle renders**

Start the dev server (`npm run dev`) and open `/definitions/units`. Click "إضافة وحدة". Confirm the toggle appears for "السماح بالكسور العشرية" and toggles between on/off states visually.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/definitions/UnitsPage.jsx
git commit -m "feat(units-page): add allow_decimal toggle field"
```

---

## Task 5: PurchaseFormPage — merge duplicates + integer qty + projected stock

**Files:**
- Modify: `client/src/pages/purchases/PurchaseFormPage.jsx`

### 5a — Merge duplicates in `addLine`

The current `addLine` (line 579) always does `setLines(prev => [...prev, {...}])`. Replace it to merge by `item_id + warehouse_id`:

- [ ] **Step 1: Replace `addLine` function**

Find this function (starting around line 579):
```js
function addLine() {
    if (!selectedItem) return;
    if (!selectedItem.name?.trim()) { toast.error("اختر صنفاً من القائمة أولاً"); return; }
    if (Number(staging.unitCost || 0) === 0) { toast.error("يجب إدخال تكلفة الصنف"); return; }
    activateInvoice();
    const qty = Number(staging.quantity || 1);
```

Replace the entire function:

```js
function addLine() {
    if (!selectedItem) return;
    if (!selectedItem.name?.trim()) { toast.error("اختر صنفاً من القائمة أولاً"); return; }
    if (Number(staging.unitCost || 0) === 0) { toast.error("يجب إدخال تكلفة الصنف"); return; }
    activateInvoice();
    const selectedUnit = units.find(u => String(u.id) === String(staging.unitId));
    const allowDecimal = selectedUnit?.allow_decimal !== 0;
    const rawQty = Number(staging.quantity || 1);
    const qty = allowDecimal ? Math.max(0.001, rawQty) : Math.max(1, Math.round(rawQty));
    const cost = Number(staging.unitCost || 0);
    const sellingPrice = Number(staging.sellingPrice || 0);
    const wholesalePrice = Number(staging.wholesalePrice || 0);
    const wid = staging.warehouseId || defaultWarehouseId;

    setLines(prev => {
      const existingIdx = prev.findIndex(l => l.item_id === selectedItem.id && String(l.warehouse_id) === String(wid));
      if (existingIdx !== -1) {
        return prev.map((l, i) => i !== existingIdx ? l : {
          ...l,
          quantity: allowDecimal ? l.quantity + qty : Math.round(l.quantity) + qty,
          unit_cost: cost,
          selling_price: sellingPrice || l.selling_price,
          wholesale_price: wholesalePrice || l.wholesale_price,
          total: (allowDecimal ? l.quantity + qty : Math.round(l.quantity) + qty) * cost,
          update_master_purchase_price: stagingLocks.purchase,
          update_master_sale_price:     stagingLocks.sale,
          update_master_wholesale_price: stagingLocks.wholesale,
        });
      }
      return [...prev, {
        item_id: selectedItem.id,
        name: selectedItem.name,
        code: selectedItem.code || selectedItem.barcode,
        quantity: qty,
        unit_cost: cost,
        original_unit_cost: Number(selectedItem.purchase_price || 0),
        selling_price: sellingPrice,
        original_sale_price: Number(selectedItem.sale_price || 0),
        wholesale_price: wholesalePrice,
        original_wholesale_price: Number(selectedItem.wholesale_price || 0),
        last_purchase_cost: Number(selectedItem.last_purchase_cost || selectedItem.purchase_price || 0),
        warehouse_id: wid,
        unit_id: staging.unitId || null,
        total: qty * cost,
        update_master_purchase_price: stagingLocks.purchase,
        update_master_sale_price:     stagingLocks.sale,
        update_master_wholesale_price: stagingLocks.wholesale,
      }];
    });
    setSelectedItem(null);
    setItemQuery("");
    setStaging(s => ({ quantity: "1", unitCost: "", sellingPrice: "", wholesalePrice: "", warehouseId: s.warehouseId, unitId: "" }));
    setTimeout(() => { itemInputRef.current?.focus(); itemInputRef.current?.select(); }, 50);
  }
```

### 5b — Enforce integer qty in staging input

- [ ] **Step 2: Find the staging qty input (around line 1067) and update it**

Find:
```jsx
<input ref={qtyInputRef} type="number" min="0.001" step="any" value={staging.quantity}
    onChange={(e) => setStaging(s => ({ ...s, quantity: e.target.value }))}
```

Replace:
```jsx
<input ref={qtyInputRef} type="number"
    min={units.find(u => String(u.id) === String(staging.unitId))?.allow_decimal === 0 ? "1" : "0.001"}
    step={units.find(u => String(u.id) === String(staging.unitId))?.allow_decimal === 0 ? "1" : "any"}
    value={staging.quantity}
    onChange={(e) => {
      const u = units.find(u => String(u.id) === String(staging.unitId));
      const v = u?.allow_decimal === 0 ? String(Math.max(1, Math.round(Number(e.target.value) || 1))) : e.target.value;
      setStaging(s => ({ ...s, quantity: v }));
    }}
```

### 5c — Fix projected stock in staging warehouse table

- [ ] **Step 3: Update the warehouse stock display in staging area (around line 1231)**

Find:
```js
const qty = selectedItem && stockLevels[selectedItem.id] ? (stockLevels[selectedItem.id][w.id] || 0) : 0;
```

Replace:
```js
const dbQty = selectedItem && stockLevels[selectedItem.id] ? (stockLevels[selectedItem.id][w.id] || 0) : 0;
const inLines = selectedItem ? lines.filter(l => l.item_id === selectedItem.id && String(l.warehouse_id) === String(w.id)).reduce((s, l) => s + Number(l.quantity), 0) : 0;
const qty = dbQty + inLines;
```

### 5d — `min="1"` on DataGrid quantity inline edit

- [ ] **Step 4: Update the DataGrid quantity cell (around line 1284)**

Find:
```jsx
render: (l, i) => <input type="number" min="0.001" step="any" value={l.quantity} disabled={isLocked} onChange={(e) => updateLineField(i, "quantity", Number(e.target.value))}
```

Replace:
```jsx
render: (l, i) => {
  const u = units.find(u => String(u.id) === String(l.unit_id));
  const isInt = u?.allow_decimal === 0;
  return (
    <input
      type="number"
      min="1"
      step={isInt ? "1" : "any"}
      value={l.quantity}
      disabled={isLocked}
      onChange={(e) => {
        const v = isInt ? Math.max(1, Math.round(Number(e.target.value) || 1)) : Math.max(0.001, Number(e.target.value) || 0.001);
        updateLineField(i, "quantity", v);
      }}
      className="w-full h-[40px] text-center text-[13px] font-mono font-black bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-emerald-50/50 transition-colors disabled:cursor-not-allowed"
    />
  );
},
```

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/purchases/PurchaseFormPage.jsx
git commit -m "fix(purchase-form): merge duplicate lines, int qty by unit, projected stock display"
```

---

## Task 6: PurchaseOrderFormPage — merge duplicates + integer qty

**Files:**
- Modify: `client/src/pages/purchases/PurchaseOrderFormPage.jsx`

### 6a — Merge duplicates in `addLine`

The current `addLine` (line 193) always pushes a new entry.

- [ ] **Step 1: Replace `addLine` function**

Find:
```js
function addLine() {
    if (!selectedItem) return;
    const qty = Number(staging.quantity || 1);
    const cost = Number(staging.unitCost || 0);
    
    setLines(prev => [
      ...prev,
      {
        item_id: selectedItem.id,
```

Replace:
```js
function addLine() {
    if (!selectedItem) return;
    const selectedUnit = units.find(u => String(u.id) === String(staging.unitId));
    const allowDecimal = selectedUnit?.allow_decimal !== 0;
    const rawQty = Number(staging.quantity || 1);
    const qty = allowDecimal ? Math.max(0.001, rawQty) : Math.max(1, Math.round(rawQty));
    const cost = Number(staging.unitCost || 0);
    
    setLines(prev => {
      const existingIdx = prev.findIndex(l => l.item_id === selectedItem.id);
      if (existingIdx !== -1) {
        return prev.map((l, i) => i !== existingIdx ? l : {
          ...l,
          quantity: allowDecimal ? l.quantity + qty : Math.round(l.quantity) + qty,
          unit_cost: cost || l.unit_cost,
          total: (allowDecimal ? l.quantity + qty : Math.round(l.quantity) + qty) * (cost || l.unit_cost),
        });
      }
      return [
        ...prev,
        {
          item_id: selectedItem.id,
          name: selectedItem.name,
          code: selectedItem.code || selectedItem.barcode,
          quantity: qty,
          unit_cost: cost,
          unit_id: staging.unitId || null,
          total: qty * cost,
        },
      ];
    });
    
    setSelectedItem(null);
    setItemQuery("");
    setStaging({ quantity: "1", unitCost: "", unitId: "" });
    setTimeout(() => {
      itemInputRef.current?.focus();
      itemInputRef.current?.select();
    }, 50);
  }
```

### 6b — Enforce integer qty in staging input

- [ ] **Step 2: Find the staging qty input (around line 376-386) and update it**

Find:
```jsx
<input 
    ref={qtyInputRef}
    type="number"
    min="0.001"
    step="any"
    value={staging.quantity}
    onChange={(e) => setStaging(s => ({ ...s, quantity: e.target.value }))}
```

Replace:
```jsx
<input
    ref={qtyInputRef}
    type="number"
    min={units.find(u => String(u.id) === String(staging.unitId))?.allow_decimal === 0 ? "1" : "0.001"}
    step={units.find(u => String(u.id) === String(staging.unitId))?.allow_decimal === 0 ? "1" : "any"}
    value={staging.quantity}
    onChange={(e) => {
      const u = units.find(u => String(u.id) === String(staging.unitId));
      const v = u?.allow_decimal === 0 ? String(Math.max(1, Math.round(Number(e.target.value) || 1))) : e.target.value;
      setStaging(s => ({ ...s, quantity: v }));
    }}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/purchases/PurchaseOrderFormPage.jsx
git commit -m "fix(purchase-order): merge duplicate lines and enforce integer qty by unit"
```

---

## Task 7: SalesReturnFormPage — merge duplicates in direct mode

**Files:**
- Modify: `client/src/pages/sales/SalesReturnFormPage.jsx`

The `addStagingToCart` function (around line 422) always appends with a unique `Date.now()` key. In **direct mode** (not tied to a loaded invoice), same-item adds should merge.

- [ ] **Step 1: Replace the `setCart` call inside `addStagingToCart`**

Find (around line 440–452):
```js
    if (!invoiceIsActive) activateInvoice();
    setCart(prev => [...prev, {
      key: `direct-${stagingItem.id}-${Date.now()}`,
      item_id: stagingItem.id,
      item_name: stagingItem.name_ar || stagingItem.name,
      item_code: stagingItem.code || stagingItem.item_code || "",
      unit_price: price,
      purchase_price: purchasePrice,
      quantity: qty,
      warehouse_id: stagingWarehouseId,
      warehouse_name: warehouses.find(w => String(w.id) === String(stagingWarehouseId))?.name || "",
      unit_id: stagingUnitId,
      unit_name: units.find(u => String(u.id) === String(stagingUnitId))?.name || "أساسية",
    }]);
```

Replace:
```js
    if (!invoiceIsActive) activateInvoice();
    const selectedUnit = units.find(u => String(u.id) === String(stagingUnitId));
    const allowDecimal = selectedUnit?.allow_decimal !== 0;
    const finalQty = allowDecimal ? qty : Math.max(1, Math.round(qty));
    setCart(prev => {
      const existingIdx = prev.findIndex(l => l.item_id === stagingItem.id && l.key?.startsWith("direct-"));
      if (existingIdx !== -1) {
        return prev.map((l, i) => i !== existingIdx ? l : {
          ...l,
          quantity: allowDecimal ? l.quantity + finalQty : Math.round(l.quantity) + finalQty,
          unit_price: price || l.unit_price,
        });
      }
      return [...prev, {
        key: `direct-${stagingItem.id}-${Date.now()}`,
        item_id: stagingItem.id,
        item_name: stagingItem.name_ar || stagingItem.name,
        item_code: stagingItem.code || stagingItem.item_code || "",
        unit_price: price,
        purchase_price: purchasePrice,
        quantity: finalQty,
        warehouse_id: stagingWarehouseId,
        warehouse_name: warehouses.find(w => String(w.id) === String(stagingWarehouseId))?.name || "",
        unit_id: stagingUnitId,
        unit_name: selectedUnit?.name || "أساسية",
      }];
    });
```

- [ ] **Step 2: Find the staging qty input in SalesReturnFormPage and enforce integer by unit**

Search for `setStagingQty` usage in an `<input>` — it will look like:
```jsx
value={stagingQty}
onChange={(e) => setStagingQty(e.target.value)}
```

Update it to:
```jsx
value={stagingQty}
onChange={(e) => {
  const u = units.find(u => String(u.id) === String(stagingUnitId));
  setStagingQty(u?.allow_decimal === 0 ? String(Math.max(1, Math.round(Number(e.target.value) || 1))) : e.target.value);
}}
```
Also update the `min` and `step` attributes on that input to:
```
min={units.find(u => String(u.id) === String(stagingUnitId))?.allow_decimal === 0 ? "1" : "0.001"}
step={units.find(u => String(u.id) === String(stagingUnitId))?.allow_decimal === 0 ? "1" : "any"}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/sales/SalesReturnFormPage.jsx
git commit -m "fix(sales-return): merge direct-mode duplicates and enforce integer qty by unit"
```

---

## Task 8: PurchaseReturnFormPage — merge duplicates in direct mode

**Files:**
- Modify: `client/src/pages/purchases/PurchaseReturnFormPage.jsx`

The `addStagingToCart` function (around line 384) has the same pattern as SalesReturnFormPage.

- [ ] **Step 1: Replace the `setCart` call inside `addStagingToCart`**

Find (around line 401–414):
```js
    if (!invoiceIsActive) activateInvoice();
    setCart(prev => [...prev, {
      key: `direct-${stagingItem.id}-${Date.now()}`,
      item_id: stagingItem.id,
      item_name: stagingItem.name_ar || stagingItem.name,
      item_code: stagingItem.code || stagingItem.item_code || "",
      unit_cost: cost,
      purchase_price: purchasePrice,
      quantity: qty,
      warehouse_id: stagingWarehouseId,
      warehouse_name: warehouses.find(w => String(w.id) === String(stagingWarehouseId))?.name || "",
      unit_id: stagingUnitId,
      unit_name: units.find(u => String(u.id) === String(stagingUnitId))?.name || "أساسية",
    }]);
```

Replace:
```js
    if (!invoiceIsActive) activateInvoice();
    const selectedUnit = units.find(u => String(u.id) === String(stagingUnitId));
    const allowDecimal = selectedUnit?.allow_decimal !== 0;
    const finalQty = allowDecimal ? qty : Math.max(1, Math.round(qty));
    setCart(prev => {
      const existingIdx = prev.findIndex(l => l.item_id === stagingItem.id && l.key?.startsWith("direct-"));
      if (existingIdx !== -1) {
        return prev.map((l, i) => i !== existingIdx ? l : {
          ...l,
          quantity: allowDecimal ? l.quantity + finalQty : Math.round(l.quantity) + finalQty,
          unit_cost: cost || l.unit_cost,
        });
      }
      return [...prev, {
        key: `direct-${stagingItem.id}-${Date.now()}`,
        item_id: stagingItem.id,
        item_name: stagingItem.name_ar || stagingItem.name,
        item_code: stagingItem.code || stagingItem.item_code || "",
        unit_cost: cost,
        purchase_price: purchasePrice,
        quantity: finalQty,
        warehouse_id: stagingWarehouseId,
        warehouse_name: warehouses.find(w => String(w.id) === String(stagingWarehouseId))?.name || "",
        unit_id: stagingUnitId,
        unit_name: selectedUnit?.name || "أساسية",
      }];
    });
```

- [ ] **Step 2: Enforce integer qty in the staging input**

Find the `<input>` that binds to `stagingQty` (look for `value={stagingQty}` in the staging form section). Update its `onChange`, `min`, and `step` the same way as Task 7 Step 2, referencing `stagingUnitId` instead of `stagingUnitId` (same variable name).

```jsx
value={stagingQty}
min={units.find(u => String(u.id) === String(stagingUnitId))?.allow_decimal === 0 ? "1" : "0.001"}
step={units.find(u => String(u.id) === String(stagingUnitId))?.allow_decimal === 0 ? "1" : "any"}
onChange={(e) => {
  const u = units.find(u => String(u.id) === String(stagingUnitId));
  setStagingQty(u?.allow_decimal === 0 ? String(Math.max(1, Math.round(Number(e.target.value) || 1))) : e.target.value);
}}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/purchases/PurchaseReturnFormPage.jsx
git commit -m "fix(purchase-return): merge direct-mode duplicates and enforce integer qty by unit"
```

---

## Task 9: POSPage — enforce integer qty on list-view staging input

**Files:**
- Modify: `client/src/pages/pos/POSPage.jsx`

The cart table already enforces `step="1" min="1"` and `Math.floor` on quantity edits. Only the list-view staging input needs updating.

- [ ] **Step 1: Update the list-view staging qty input (around line 2300–2310)**

Find:
```jsx
<input
    ref={listQtyRef}
    type="number"
    min="0.001"
    step="any"
    value={staging.quantity}
    onChange={(e) => setStaging(s => ({ ...s, quantity: e.target.value }))}
    onFocus={e => e.target.select()}
    onKeyDown={(e) => handleListFieldKeyDown(e, listPriceRef, listWhRef)}
    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center"
  />
```

Replace:
```jsx
<input
    ref={listQtyRef}
    type="number"
    min={selectedItem && units.find(u => String(u.id) === String(staging.unitId))?.allow_decimal === 0 ? "1" : "0.001"}
    step={selectedItem && units.find(u => String(u.id) === String(staging.unitId))?.allow_decimal === 0 ? "1" : "any"}
    value={staging.quantity}
    onChange={(e) => {
      const u = selectedItem ? units.find(u => String(u.id) === String(staging.unitId)) : null;
      const v = u?.allow_decimal === 0 ? String(Math.max(1, Math.round(Number(e.target.value) || 1))) : e.target.value;
      setStaging(s => ({ ...s, quantity: v }));
    }}
    onFocus={e => e.target.select()}
    onKeyDown={(e) => handleListFieldKeyDown(e, listPriceRef, listWhRef)}
    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center"
  />
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/pos/POSPage.jsx
git commit -m "fix(pos): enforce integer qty on staging input when unit disallows decimals"
```

---

## Task 10: Verify end-to-end behavior

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test Units page**

1. Open `/definitions/units`
2. Add a new unit named "كيلو" with "السماح بالكسور العشرية" = ON — save. Reload — confirm allow_decimal = 1 in DB.
3. Add a unit "قطعة" with toggle OFF — save. Reload — confirm allow_decimal = 0.

- [ ] **Step 3: Test PurchaseFormPage duplicate merge**

1. Open `/purchases/new`
2. Set warehouse, select item "قطعة" unit, enter qty 3, cost 10 → click Add
3. Select the SAME item again, qty 2, cost 10 → click Add
4. Confirm: only ONE line exists with qty = 5 (not two separate lines)

- [ ] **Step 4: Test PurchaseFormPage projected stock**

1. In the same purchase form, select the item you just added (3 units in the line)
2. Look at the warehouse stock matrix — confirm it shows `DB_stock + 3` (the in-lines qty is added)

- [ ] **Step 5: Test integer qty enforcement**

1. Set item unit to "قطعة" (allow_decimal = 0)
2. In the staging qty field, type "2.5" — confirm it rounds to 3 when you blur or change
3. In the DataGrid quantity cell, try typing 1.5 — confirm it rounds/clamps to 2

- [ ] **Step 6: Test POS list-view staging**

1. Open POS, switch to list view
2. Select an item with a "قطعة" unit (allow_decimal = 0)
3. Type 3.7 in qty field → confirm it becomes 4

- [ ] **Step 7: Test return forms**

1. Open SalesReturnFormPage in direct mode
2. Add item X qty 2, then add same item X qty 3 → confirm single line qty 5
3. Same test in PurchaseReturnFormPage

- [ ] **Step 8: Final commit if any minor fixes needed**

```bash
git add -p
git commit -m "fix: address edge cases found during manual testing"
```
