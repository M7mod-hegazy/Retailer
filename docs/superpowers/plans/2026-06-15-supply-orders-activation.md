# طلبات التوريد (Supply Orders) Activation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make طلبات التوريد usable end-to-end — persist & lock units, show live stock, route receiving through the real Purchases invoice page with a permanent "from-PO" link, an improved detail modal, and a smooth accept→redirect animation.

**Architecture:** Add three nullable columns (PO line `unit_id`, PO header `warehouse_id`, purchase `source_purchase_order_id`). Retire the divergent in-list receive path; the PO list's "convert" button prefills `PurchaseFormPage` via `location.state`, and the existing `POST /api/purchases` transaction also advances the linked PO's received quantities/status. Frontend reuses existing patterns (item-units API, warehouse stock table, framer-motion, DocumentHeaderBar).

**Tech Stack:** Express + better-sqlite3 (synchronous), Jest + supertest (backend), React 18 + Vite + framer-motion + TanStack/axios (frontend), i18next (ar/en).

**Reference spec:** `docs/superpowers/specs/2026-06-15-supply-orders-activation-design.md`

---

## File Structure

- `electron/migrations/133_supply_orders_unit_and_source.js` — **create**: 3 idempotent columns.
- `server/src/routes/purchaseOrders.routes.js` — **modify**: persist/return `unit_id` + `warehouse_id`; remove `/receive`.
- `server/src/routes/purchases.routes.js` — **modify**: tag `source_purchase_order_id`, advance linked PO lines/status, block over-receive.
- `server/tests/purchaseOrders.test.js` — **modify**: drop `/receive` test, assert `unit_id` persisted.
- `server/tests/purchases.test.js` — **modify**: add PO→invoice linkage test.
- `client/src/pages/purchases/PurchaseOrderFormPage.jsx` — **modify**: lock units, unit column, suggested warehouse, on-hand panel, identity banner.
- `client/src/pages/purchases/PurchaseOrdersPage.jsx` — **modify**: convert button (animation→redirect), improved detail modal, remove receive modal, identity header.
- `client/src/pages/purchases/PurchaseFormPage.jsx` — **modify**: read `fromPurchaseOrder` prefill, source badge, carry linkage in save payload.
- `client/src/locales/ar.json`, `client/src/locales/en.json` — **modify**: new strings.

---

## Task 1: Migration — add unit_id, warehouse_id, source link

**Files:**
- Create: `electron/migrations/133_supply_orders_unit_and_source.js`

- [ ] **Step 1: Write the migration**

```js
function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((entry) => entry.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  // Persist the unit chosen on each PO line (was previously discarded).
  addColumnIfMissing(db, "purchase_order_lines", "unit_id", "INTEGER");
  // Optional suggested destination warehouse for the PO (default when converting).
  addColumnIfMissing(db, "purchase_orders", "warehouse_id", "INTEGER");
  // Link a purchase invoice back to the PO it was received from.
  addColumnIfMissing(db, "purchases", "source_purchase_order_id", "INTEGER");
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_purchases_source_po ON purchases(source_purchase_order_id)"
  );
}

module.exports = { up };
```

- [ ] **Step 2: Verify migration applies cleanly against the dev DB**

Run: `npx electron -e "const Database=require('better-sqlite3'); const db=new Database('server/data/retailer.db'); require('./electron/migrations/133_supply_orders_unit_and_source.js').up(db); console.log('cols PO lines:', db.prepare('PRAGMA table_info(purchase_order_lines)').all().map(c=>c.name).join(',')); console.log('cols purchases has source:', db.prepare('PRAGMA table_info(purchases)').all().some(c=>c.name==='source_purchase_order_id'));"`
Expected: output lists `unit_id` among PO line columns and prints `true` for the source column. Running it a second time must not error (idempotent).

- [ ] **Step 3: Commit**

```bash
git add electron/migrations/133_supply_orders_unit_and_source.js
git commit -m "feat(supply-orders): migration for PO unit_id, warehouse_id, purchase source link"
```

---

## Task 2: PO route — persist & return unit_id / warehouse_id; remove /receive

**Files:**
- Modify: `server/src/routes/purchaseOrders.routes.js`
- Test: `server/tests/purchaseOrders.test.js`

- [ ] **Step 1: Update the failing test (assert unit_id is persisted, drop /receive)**

In `server/tests/purchaseOrders.test.js`, replace the POST test and the receive test with:

```js
  it("POST /api/purchase-orders creates a PO and persists unit_id", async () => {
    const res = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplier_id: supplierId,
        warehouse_id: 1,
        lines: [{ item_id: itemId, quantity: 5, unit_cost: 30, unit_id: 1 }]
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending");
    poId = res.body.data.id;
  });

  it("GET /api/purchase-orders/:id returns line unit_id and unit_name", async () => {
    const res = await request(app).get(`/api/purchase-orders/${poId}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.lines[0].unit_id).toBe(1);
    expect(res.body.data.lines[0].unit_name).toBe("قطعة");
    expect(res.body.data.warehouse_id).toBe(1);
  });

  it("PATCH /api/purchase-orders/:id/approve approves the PO", async () => {
    const res = await request(app).patch(`/api/purchase-orders/${poId}/approve`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("approved");
  });
```

(Delete the old `...receive...` test — receiving is now covered in `purchases.test.js`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix server -- purchaseOrders`
Expected: FAIL — `unit_id` is `null`/undefined and `unit_name` missing.

- [ ] **Step 3: Persist unit_id + warehouse_id on POST**

In `purchaseOrders.routes.js`, change the `POST "/"` INSERTs:

```js
router.post("/", requirePagePermission("purchase_orders", "add"), (req, res) => {
  const db = getDb();
  const payload = req.body || {};
  const docNo = generateDocNumber('purchase_order');
  const result = db
    .prepare("INSERT INTO purchase_orders (doc_no, supplier_id, warehouse_id, status, notes) VALUES (?, ?, ?, 'pending', ?)")
    .run(docNo, payload.supplier_id || null, payload.warehouse_id || null, payload.notes || null);

  for (const line of payload.lines || []) {
    db.prepare(
      "INSERT INTO purchase_order_lines (purchase_order_id, item_id, quantity, unit_cost, unit_id, received_quantity) VALUES (?, ?, ?, ?, ?, 0)",
    ).run(result.lastInsertRowid, line.item_id, Number(line.quantity), Number(line.unit_cost || 0), line.unit_id || null);
  }

  req.audit("create", "purchaseOrders", { id: result.lastInsertRowid }, `📦 تم إنشاء أمر شراء`);
  res.status(201).json({
    success: true,
    data: db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(result.lastInsertRowid),
  });
});
```

- [ ] **Step 4: Return unit_name on GET /:id**

In the `GET "/:id"` handler, change the lines query to join units:

```js
    const lines = db
      .prepare(
        `SELECT pol.*, i.name AS item_name, i.code AS item_code, u.name AS unit_name
         FROM purchase_order_lines pol
         LEFT JOIN items i ON i.id = pol.item_id
         LEFT JOIN units u ON u.id = pol.unit_id
         WHERE pol.purchase_order_id = ?
         ORDER BY pol.id ASC`,
      )
      .all(req.params.id)
      .map((line) => ({ ...line, remaining_quantity: Number(line.quantity) - Number(line.received_quantity || 0) }));
```

- [ ] **Step 5: Remove the /receive endpoint and its helper**

Delete the entire `router.patch("/:id/receive", ...)` handler (≈ lines 124-227) and the now-unused `recordReceiptCost` helper (≈ lines 15-28) plus their now-unused imports (`adjustStock`, `recomputeWACCForItem`, `hasTable`/`recordMovement` from costLedger) **only if no longer referenced** in the file. Keep `generateDocNumber` (still used by POST).

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test --prefix server -- purchaseOrders`
Expected: PASS (3 tests: create+unit_id, get unit_name, approve).

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/purchaseOrders.routes.js server/tests/purchaseOrders.test.js
git commit -m "feat(supply-orders): persist/return PO unit_id & warehouse_id, retire /receive"
```

---

## Task 3: Purchases route — link PO, advance received qty, block over-receive

**Files:**
- Modify: `server/src/routes/purchases.routes.js`
- Test: `server/tests/purchases.test.js`

- [ ] **Step 1: Write the failing linkage test**

Append inside the `describe("Purchases Routes", ...)` block in `server/tests/purchases.test.js`:

```js
  it("POST /api/purchases linked to a PO tags source and advances PO received qty/status", async () => {
    // Create a PO with 5 units
    const poRes = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ supplier_id: supplierId, warehouse_id: 1, lines: [{ item_id: itemId, quantity: 5, unit_cost: 30, unit_id: 1 }] });
    const poId = poRes.body.data.id;
    const poDetail = await request(app).get(`/api/purchase-orders/${poId}`).set("Authorization", `Bearer ${token}`);
    const poLineId = poDetail.body.data.lines[0].id;

    // Partially receive 2 via a purchase invoice
    const buyRes = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplier_id: supplierId, warehouse_id: 1, payment_method: "cash",
        source_purchase_order_id: poId,
        lines: [{ item_id: itemId, quantity: 2, unit_cost: 30, purchase_order_line_id: poLineId }],
      });
    expect(buyRes.status).toBe(201);
    expect(buyRes.body.data.source_purchase_order_id).toBe(poId);

    const afterPartial = await request(app).get(`/api/purchase-orders/${poId}`).set("Authorization", `Bearer ${token}`);
    expect(afterPartial.body.data.status).toBe("partially_received");
    expect(afterPartial.body.data.lines[0].received_quantity).toBe(2);

    // Over-receive guard: receiving 99 more must be rejected
    const overRes = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplier_id: supplierId, warehouse_id: 1, payment_method: "cash",
        source_purchase_order_id: poId,
        lines: [{ item_id: itemId, quantity: 99, unit_cost: 30, purchase_order_line_id: poLineId }],
      });
    expect(overRes.status).toBe(400);

    // Receive the remaining 3 → fully received
    await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplier_id: supplierId, warehouse_id: 1, payment_method: "cash",
        source_purchase_order_id: poId,
        lines: [{ item_id: itemId, quantity: 3, unit_cost: 30, purchase_order_line_id: poLineId }],
      });
    const afterFull = await request(app).get(`/api/purchase-orders/${poId}`).set("Authorization", `Bearer ${token}`);
    expect(afterFull.body.data.status).toBe("received");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix server -- purchases`
Expected: FAIL — `source_purchase_order_id` is undefined on the response; PO status unchanged.

- [ ] **Step 3: Persist the source link on the purchases INSERT**

In `purchases.routes.js` `POST "/"`, change the purchases INSERT (≈ line 470) to include the source column:

```js
      const result = db
        .prepare("INSERT INTO purchases (doc_no, supplier_id, total, discount, increase, payment_method, created_at, created_by, notes, source_purchase_order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(docNo, payload.supplier_id || null, total, discount, increase, paymentMethod,
             `${createdDate} ${new Date().toTimeString().slice(0, 8)}`,
             payload.user_id || req.user?.id || null,
             payload.notes || null,
             payload.source_purchase_order_id || null);
```

- [ ] **Step 4: Advance PO lines + status (and guard over-receive) inside the transaction**

In the same handler, immediately **after** the `for (const line of payload.lines || [])` loop finishes and **before** the WACC replay line (`const newPurchaseItemIds = ...`, ≈ line 544), insert:

```js
      // ── Linked Purchase Order: advance received quantities + status ───────────
      if (payload.source_purchase_order_id) {
        const poId = Number(payload.source_purchase_order_id);
        const po = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(poId);
        if (!po) { const e = new Error("أمر التوريد غير موجود"); e.status = 404; throw e; }
        if (po.status === "cancelled" || po.status === "received") {
          const e = new Error("لا يمكن استلام أمر توريد ملغى أو مستلم بالكامل"); e.status = 400; throw e;
        }
        for (const line of payload.lines || []) {
          if (!line.purchase_order_line_id) continue;
          const pol = db.prepare("SELECT * FROM purchase_order_lines WHERE id = ? AND purchase_order_id = ?")
            .get(Number(line.purchase_order_line_id), poId);
          if (!pol) continue;
          const remaining = Number(pol.quantity) - Number(pol.received_quantity || 0);
          const qty = Number(line.quantity);
          if (qty > remaining + 1e-9) {
            const e = new Error("الكمية المستلمة تتجاوز المتبقي في أمر التوريد"); e.status = 400; throw e;
          }
          db.prepare("UPDATE purchase_order_lines SET received_quantity = received_quantity + ? WHERE id = ?")
            .run(qty, pol.id);
        }
        const updated = db.prepare("SELECT quantity, received_quantity FROM purchase_order_lines WHERE purchase_order_id = ?").all(poId);
        const allReceived = updated.every(l => Number(l.received_quantity || 0) >= Number(l.quantity || 0) - 1e-9);
        const anyReceived = updated.some(l => Number(l.received_quantity || 0) > 0);
        const nextStatus = allReceived ? "received" : anyReceived ? "partially_received" : po.status;
        db.prepare("UPDATE purchase_orders SET status = ? WHERE id = ?").run(nextStatus, poId);
      }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --prefix server -- purchases`
Expected: PASS (linkage test + existing tests green).

- [ ] **Step 6: Run the full backend suite to confirm no regressions**

Run: `npm test --prefix server`
Expected: PASS (no failures introduced; `purchaseOrders` + `purchases` suites green).

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/purchases.routes.js server/tests/purchases.test.js
git commit -m "feat(supply-orders): link purchase invoices to PO, advance received qty/status, block over-receive"
```

---

## Task 4: PO form — lock units, unit column, suggested warehouse, on-hand panel, identity banner

**Files:**
- Modify: `client/src/pages/purchases/PurchaseOrderFormPage.jsx`

> Context: this page already loads `/api/units`, `/api/stock/levels`, `/api/suppliers`, `/api/items`. We add per-item unit scoping, a warehouse selector + read-only on-hand panel, and an identity banner. Per-item units come from `/api/items/:id/units` (see `client/src/components/items/ItemUnitsSection.jsx`).

- [ ] **Step 1: Load warehouses and add suggested-warehouse + per-item-units state**

In the init `Promise.all` (≈ line 95), add `api.get("/api/warehouses")` and store it. Add state near the other `useState`s:

```js
  const [warehouses, setWarehouses] = useState([]);
  const [suggestedWarehouse, setSuggestedWarehouse] = useState("");
  const [itemUnits, setItemUnits] = useState([]); // units allowed for the selected item
```

In the resolved handler, set `setWarehouses(whRes.data.data || [])` and default `setSuggestedWarehouse(String(firstDefaultWhId))`.

- [ ] **Step 2: Scope units to the selected item on pick**

In `handlePickItem(item)` (≈ line 188), after setting staging, fetch the item's units and default to base:

```js
    api.get(`/api/items/${item.id}/units`)
      .then(r => {
        const list = r.data?.data || [];
        setItemUnits(list);
        // default to the item's base unit_id when present, else first configured unit
        const baseId = item.unit_id ? String(item.unit_id) : (list[0]?.unit_id ? String(list[0].unit_id) : "");
        setStaging(prev => ({ ...prev, unitId: baseId }));
      })
      .catch(() => { setItemUnits([]); setStaging(prev => ({ ...prev, unitId: item.unit_id ? String(item.unit_id) : "" })); });
```

- [ ] **Step 3: Replace the unit `<select>` options with the scoped list**

In the unit select (≈ line 418), build options from `itemUnits` (joined to `units` for names) plus the item's base unit, falling back to "أساسية" when empty:

```jsx
                    <select
                      ref={unitSelectRef}
                      value={staging.unitId}
                      onChange={(e) => setStaging(s => ({ ...s, unitId: e.target.value }))}
                      onKeyDown={(e) => handleKeyDown(e, { nextRef: costInputRef, prevRef: qtyInputRef })}
                      disabled={!selectedItem}
                      className="w-full h-[37px] appearance-none border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-2sm font-bold text-slate-800 outline-none focus:border-slate-800 disabled:opacity-50"
                    >
                      {(() => {
                        const opts = [];
                        if (selectedItem?.unit_id) {
                          const baseU = units.find(u => String(u.id) === String(selectedItem.unit_id));
                          opts.push({ id: selectedItem.unit_id, name: (baseU?.name || "أساسية") });
                        }
                        itemUnits.forEach(iu => {
                          if (!opts.some(o => String(o.id) === String(iu.unit_id))) {
                            const u = units.find(x => String(x.id) === String(iu.unit_id));
                            if (u) opts.push({ id: iu.unit_id, name: u.name });
                          }
                        });
                        if (opts.length === 0) return <option value="">أساسية</option>;
                        return opts.map(o => <option key={o.id} value={o.id}>{o.name}</option>);
                      })()}
                    </select>
```

- [ ] **Step 4: Carry unit_id into the line and the save payload**

`addLine` already sets `unit_id: staging.unitId || null` (≈ line 236) — keep it. In `handleSave` (≈ line 261), include warehouse + unit in the POST:

```js
      await api.post("/api/purchase-orders", {
        supplier_id: supplier.id,
        warehouse_id: suggestedWarehouse ? Number(suggestedWarehouse) : null,
        notes: notes,
        lines: lines.map(l => ({
          item_id: l.item_id,
          quantity: l.quantity,
          unit_cost: l.unit_cost,
          unit_id: l.unit_id || null,
        }))
      });
```

- [ ] **Step 5: Add a Unit column to the grid**

In the `DataGrid` columns array (after `quantity`, ≈ line 499), insert:

```jsx
                  {
                    id: "unit_id", header: "الوحدة", width: 80, sortable: false, headerClass: "text-center", cellClass: "text-center text-2sm font-bold text-slate-600 border-l border-slate-100",
                    render: (l) => (units.find(u => String(u.id) === String(l.unit_id))?.name || "أساسية")
                  },
```

- [ ] **Step 6: Add the suggested-warehouse selector + read-only on-hand panel**

In the right sidebar (`<aside>`, ≈ line 540), add above the status card:

```jsx
             <div className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-2sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-slate-400" /> المخزن المقترح للاستلام
                </h3>
                <select value={suggestedWarehouse} onChange={(e) => setSuggestedWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded-sm py-2 px-2 text-2sm font-bold text-slate-800 outline-none focus:border-slate-800">
                  <option value="">— بدون تحديد —</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                {selectedItem && (
                  <div className="mt-4">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">الرصيد الحالي ({selectedItem.name})</p>
                    <div className="rounded border border-slate-100 divide-y divide-slate-100 max-h-[160px] overflow-y-auto">
                      {warehouses.map(w => (
                        <div key={w.id} className="flex items-center justify-between px-3 py-1.5 text-2sm">
                          <span className="font-bold text-slate-600 truncate">{w.name}</span>
                          <span className="font-mono font-black text-slate-800">{(perWhStock[w.id] || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
             </div>
```

Add `Warehouse` to the lucide imports (top of file). Add per-warehouse stock state and populate it from `/api/stock/levels` (which already returns `warehouse_id`) in init:

```js
  const [perWhStockMap, setPerWhStockMap] = useState({}); // { item_id: { wh_id: qty } }
  // in the stock handler:
  const byWh = {};
  (stockRes.data.data || []).forEach(row => {
    if (!byWh[row.item_id]) byWh[row.item_id] = {};
    byWh[row.item_id][row.warehouse_id] = row.quantity;
  });
  setPerWhStockMap(byWh);
```

Then derive `perWhStock` for the selected item:

```js
  const perWhStock = selectedItem ? (perWhStockMap[selectedItem.id] || {}) : {};
```

- [ ] **Step 7: Add the "not an invoice" identity banner**

Directly under `<main ...>` (≈ line 307), add:

```jsx
        <div className="mb-3 flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2.5">
          <ClipboardList className="h-4 w-4 text-indigo-600 shrink-0" />
          <p className="text-2sm font-black text-indigo-800">طلب توريد — ليس فاتورة. المخزون لن يتأثر حتى الاستلام في صفحة المشتريات.</p>
        </div>
```

Add `ClipboardList` to the lucide imports.

- [ ] **Step 8: Verify the client builds and the form works**

Run: `npm run build --prefix client`
Expected: build succeeds (no import/JSX errors).
Manual: `npm run dev`, open طلبات التوريد → أمر توريد جديد. Pick an item → unit dropdown shows only that item's units; the on-hand panel lists per-warehouse balances; the indigo banner is visible; saving creates a PO (status pending).

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/purchases/PurchaseOrderFormPage.jsx
git commit -m "feat(supply-orders): lock units to item, on-hand panel, suggested warehouse, identity banner on PO form"
```

---

## Task 5: PO list — convert button (animation→redirect), improved detail modal, remove receive modal

**Files:**
- Modify: `client/src/pages/purchases/PurchaseOrdersPage.jsx`

- [ ] **Step 1: Add convert-with-animation state and handler**

Add state near the top of the component:

```js
  const [convertingId, setConvertingId] = useState(null);
```

Add a handler that fetches the PO, plays a short success animation, then navigates to the prefilled purchases page (import `useNavigate` from react-router-dom and create `const navigate = useNavigate();`):

```js
  async function handleConvert(id) {
    try {
      const res = await api.get(`/api/purchase-orders/${id}`);
      const order = res.data.data;
      setConvertingId(id); // triggers the row success animation
      const prefill = {
        source_purchase_order_id: order.id,
        po_doc_no: order.doc_no || `PO-${String(order.id).padStart(5, "0")}`,
        supplier_id: order.supplier_id,
        supplier_name: order.supplier_name,
        warehouse_id: order.warehouse_id || null,
        lines: (order.lines || [])
          .filter(l => Number(l.remaining_quantity) > 0)
          .map(l => ({
            purchase_order_line_id: l.id,
            item_id: l.item_id,
            name: l.item_name,
            code: l.item_code,
            quantity: l.remaining_quantity,
            unit_cost: l.unit_cost,
            unit_id: l.unit_id || null,
          })),
      };
      setTimeout(() => navigate("/purchases/new", { state: { fromPurchaseOrder: prefill } }), 650);
    } catch {
      toast.error("تعذر تجهيز الفاتورة من أمر التوريد");
      setConvertingId(null);
    }
  }
```

- [ ] **Step 2: Repoint the "استلام" button and add the success animation**

Replace the `canReceive` button (≈ line 309-315) to call `handleConvert` and show a converting state:

```jsx
                        {canReceive && (
                          <PermissionGate page="purchase_orders" action="edit">
                            <button data-help="convert-button" onClick={() => handleConvert(row.id)} disabled={convertingId === row.id}
                              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-black hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-100">
                              {convertingId === row.id
                                ? (<><CheckCircle2 className="h-5 w-5 animate-pulse" /> جاري التحويل…</>)
                                : (<>استلام / تحويل لفاتورة</>)}
                            </button>
                          </PermissionGate>
                        )}
```

Add a framer-motion success overlay on the row card. Wrap the row content so that when `convertingId === row.id`, an emerald flash plays. On the row `motion.div` (≈ line 263), append:

```jsx
                      animate={convertingId === row.id ? { scale: [1, 1.02, 1], boxShadow: "0 0 0 3px rgba(16,185,129,0.4)" } : undefined}
                      transition={convertingId === row.id ? { duration: 0.6 } : undefined}
```

(`CheckCircle2` is already imported.)

- [ ] **Step 3: Remove the receive modals and their now-dead code**

Delete the two receive `<Modal>` blocks (Step 1: Input ≈ line 397-447, Step 2: Confirm ≈ line 449-487) and the now-unused state/handlers: `activeOrder`, `receiptLines`, `receiveStep`, `selectedWarehouse`, `openReceiveModal`, `handleReceive`, `receiveConfirmLines`, `receiveTotal`, and the `receiveWh/receiveQty/receiveSubmit` refs. Keep `warehouses`/`loadData` (warehouses may still be shown in detail). Keep approve/cancel/detail.

- [ ] **Step 4: Improve the detail modal**

Replace the detail modal body (≈ line 350-395) with a richer version showing supplier, status, suggested warehouse, created date, notes, and a full line table with unit + received/remaining + totals:

```jsx
      <Modal open={!!detailOrder} onClose={() => setDetailOrder(null)} title={`طلب التوريد ${detailOrder?.doc_no || `PO-${String(detailOrder?.id || 0).padStart(5, "0")}`}`} maxWidth="max-w-4xl">
        {detailOrder && (
          <div className="space-y-6 p-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/60 p-5 rounded-2xl border border-slate-200/50">
              <div><span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">المورد</span><span className="text-sm font-black text-slate-900">{detailOrder.supplier_name || `مورد #${detailOrder.supplier_id}`}</span></div>
              <div><span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">الحالة</span><StatusBadge status={detailOrder.status} /></div>
              <div><span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">تاريخ الإصدار</span><span className="text-sm font-black font-mono text-slate-900">{new Date(detailOrder.created_at).toLocaleDateString("ar-EG-u-nu-latn")}</span></div>
              <div><span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">المخزن المقترح</span><span className="text-sm font-black text-slate-900">{warehouses.find(w => String(w.id) === String(detailOrder.warehouse_id))?.name || "—"}</span></div>
            </div>
            {detailOrder.notes && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-2.5 text-2sm font-bold text-amber-800">📝 {detailOrder.notes}</div>
            )}
            <div className="rounded-2xl border border-slate-200/60 bg-white overflow-hidden">
              <div className="grid grid-cols-[90px_1fr_70px_70px_70px_70px_110px] bg-slate-50 border-b border-slate-200">
                {["الكود","الصنف","الوحدة","مطلوب","مستلم","متبقي","الإجمالي"].map((h,i) => (
                  <div key={i} className={`px-3 py-3 text-[11px] font-black uppercase text-slate-400 tracking-widest ${i===6?"text-left":"text-center"} ${i<6?"border-l border-slate-200/50":""} ${i===1?"!text-right":""}`}>{h}</div>
                ))}
              </div>
              <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-50">
                {(detailOrder.lines || []).map(l => (
                  <div key={l.id} className="grid grid-cols-[90px_1fr_70px_70px_70px_70px_110px] items-center px-1 py-2 hover:bg-slate-50/60">
                    <div className="px-2 text-center font-mono text-2sm text-slate-500">{l.item_code || "—"}</div>
                    <div className="px-2 text-sm font-bold text-slate-800 truncate">{l.item_name}</div>
                    <div className="px-2 text-center text-2sm font-bold text-slate-600">{l.unit_name || "أساسية"}</div>
                    <div className="px-2 text-center font-black text-sm">{l.quantity}</div>
                    <div className="px-2 text-center font-black text-sm text-emerald-600">{l.received_quantity || 0}</div>
                    <div className="px-2 text-center font-black text-sm text-amber-500">{l.remaining_quantity}</div>
                    <div className="px-2 text-left font-black font-mono text-sm text-slate-900">{formatMoney(l.quantity * l.unit_cost)}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-200">
                <span className="text-2sm font-bold text-slate-500">عدد الأصناف: <span className="font-black text-slate-800">{(detailOrder.lines || []).length}</span></span>
                <span className="text-sm font-bold text-slate-500">القيمة الإجمالية: <span className="text-[18px] font-black font-mono text-slate-900">{formatMoney((detailOrder.lines || []).reduce((a, l) => a + l.quantity * l.unit_cost, 0))}</span> ج.م</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
```

- [ ] **Step 5: Strengthen the page identity**

Change the subtitle (≈ line 196) to make non-invoice status explicit:

```jsx
              <p className="text-sm font-bold text-slate-500 mt-1 max-w-[50ch]">أوامر توريد — ليست فواتير. تُحوَّل إلى فاتورة مشتريات عند الاستلام.</p>
```

- [ ] **Step 6: Verify build + flow**

Run: `npm run build --prefix client`
Expected: build succeeds.
Manual: open طلبات التوريد. Click "استلام / تحويل لفاتورة" on an approved order → emerald flash + "جاري التحويل…" → redirects to the purchases page prefilled. Open "تفاصيل" → detailed table with unit/received/remaining/totals.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/purchases/PurchaseOrdersPage.jsx
git commit -m "feat(supply-orders): convert-to-invoice with animation+redirect, richer detail modal, retire receive modal"
```

---

## Task 6: Purchases form — accept PO prefill + source badge + carry linkage

**Files:**
- Modify: `client/src/pages/purchases/PurchaseFormPage.jsx`

> Context: this page already reads `location.state` (for amend), has lines/warehouse/units. We add a `fromPurchaseOrder` prefill, a source badge, and pass linkage fields on save.

- [ ] **Step 1: Read the PO prefill on mount**

Add state near other state:

```js
  const [sourcePO, setSourcePO] = useState(null); // { id, doc_no }
```

In the init effect (where `location.state` is consulted), after warehouses/units load, apply the prefill:

```js
    const fromPO = location.state?.fromPurchaseOrder;
    if (fromPO) {
      setSourcePO({ id: fromPO.source_purchase_order_id, doc_no: fromPO.po_doc_no });
      if (fromPO.supplier_id) {
        // reuse existing supplier-pick path
        const s = suppliers.find(x => String(x.id) === String(fromPO.supplier_id));
        if (s) handlePickSupplier?.(s); // or set supplier state directly as this file does
      }
      const defWh = fromPO.warehouse_id ? String(fromPO.warehouse_id) : defaultWarehouseId;
      setLines((fromPO.lines || []).map(l => ({
        item_id: l.item_id,
        name: l.name,
        code: l.code,
        quantity: Number(l.quantity),
        unit_cost: Number(l.unit_cost),
        original_unit_cost: Number(l.unit_cost),
        unit_id: l.unit_id || null,
        warehouse_id: defWh,
        purchase_order_line_id: l.purchase_order_line_id,
        total: Number(l.quantity) * Number(l.unit_cost),
      })));
    }
```

(Match the exact supplier-setting idiom already used in this file — set `supplier`/`supplierQuery` the same way the amend path or `handlePickSupplier` does. The key additions are `purchase_order_line_id` and `unit_id` per line.)

- [ ] **Step 2: Carry linkage into the save payload**

In `buildPayload()` (used by the POST at ≈ line 839), add the source id at the top level and the PO line id per line:

```js
    return {
      // ...existing fields...
      source_purchase_order_id: sourcePO?.id || null,
      lines: lines.map(l => ({
        // ...existing line fields...
        purchase_order_line_id: l.purchase_order_line_id || null,
        unit_id: l.unit_id || null,
      })),
    };
```

- [ ] **Step 3: Show the source badge on the form header**

In the `DocumentHeaderBar` actions (or just under it), render when `sourcePO`:

```jsx
        {sourcePO && (
          <Link to="/purchases/orders" className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-2sm font-black text-indigo-800 hover:bg-indigo-100">
            <ClipboardList className="h-4 w-4" /> ناتج عن أمر توريد {sourcePO.doc_no}
          </Link>
        )}
```

Add `ClipboardList` (and `Link` from react-router-dom if not already imported) to imports.

- [ ] **Step 4: Verify build + end-to-end flow**

Run: `npm run build --prefix client`
Expected: build succeeds.
Manual: `npm run dev`. Create a PO → approve → "استلام / تحويل لفاتورة". On the purchases page: supplier + lines prefilled at remaining qty, the indigo "ناتج عن أمر توريد PO-xxxxx" badge shows. Save → invoice created. Reopen the PO list → status is `received` (or `partially_received` if you reduced a qty).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/purchases/PurchaseFormPage.jsx
git commit -m "feat(supply-orders): purchases form accepts PO prefill, shows source badge, carries linkage on save"
```

---

## Task 7: Surface "from PO" on purchase detail + list

**Files:**
- Modify: `client/src/pages/purchases/PurchaseFormPage.jsx` (detail/read view) and the purchases list page.

> Note: confirm the actual purchases **detail** and **list** components. The read view in `PurchaseFormPage.jsx` (UnitCell / read-only render near the top, ≈ lines 60-190) renders an existing purchase; the list is rendered elsewhere (search for where `/api/purchases` GET results are mapped to rows — likely `PurchasesHubPage.jsx` or a today/list modal).

- [ ] **Step 1: Ensure the API returns the source id on read**

Confirm `getPurchaseWithLines` / the purchases GET selects `source_purchase_order_id` (it `SELECT *`s the row if so — verify). If the list/detail query is column-explicit, add `p.source_purchase_order_id`. 

Run: `npm test --prefix server -- purchases`
Expected: still PASS (no behavior change if already `SELECT *`).

- [ ] **Step 2: Badge on the purchase detail/read view**

Where the read-only purchase header renders (in `PurchaseFormPage.jsx` view mode), add when `purchase.source_purchase_order_id`:

```jsx
            {purchase?.source_purchase_order_id && (
              <Link to="/purchases/orders" className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-800">
                <ClipboardList className="h-3.5 w-3.5" /> ناتج عن أمر توريد PO-{String(purchase.source_purchase_order_id).padStart(5, "0")}
              </Link>
            )}
```

- [ ] **Step 3: Badge on the purchases list row**

In the purchases list row renderer, add a small indigo chip "📦 PO" when `row.source_purchase_order_id` is set, with the same link target.

- [ ] **Step 4: Verify build**

Run: `npm run build --prefix client`
Expected: build succeeds.
Manual: open a purchase created from a PO — the detail header and its list row both show the PO chip linking back to طلبات التوريد.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/purchases/PurchaseFormPage.jsx client/src/pages/purchases/PurchasesHubPage.jsx
git commit -m "feat(supply-orders): surface from-PO badge on purchase detail and list"
```

---

## Task 8: i18n strings

**Files:**
- Modify: `client/src/locales/ar.json`, `client/src/locales/en.json`

- [ ] **Step 1: Add keys to both files**

Add (under an existing logical group, e.g. `purchaseOrders`): `convertToInvoice`, `notAnInvoiceBanner`, `suggestedWarehouse`, `currentStock`, `fromPurchaseOrder`, `converting`. Arabic values match the literals used above; English equivalents e.g. `"fromPurchaseOrder": "From supply order"`.

> If the surrounding components use hardcoded Arabic literals (as the current PO pages do), keep parity with that pattern but still add the keys so future refactors can switch. At minimum, do not introduce English-only hardcoded strings.

- [ ] **Step 2: Validate JSON**

Run: `node -e "require('./client/src/locales/ar.json'); require('./client/src/locales/en.json'); console.log('ok')"`
Expected: prints `ok` (both files are valid JSON).

- [ ] **Step 3: Commit**

```bash
git add client/src/locales/ar.json client/src/locales/en.json
git commit -m "chore(supply-orders): i18n keys for PO activation"
```

---

## Final verification

- [ ] Run full backend suite: `npm test --prefix server` → all green.
- [ ] Client build: `npm run build --prefix client` → succeeds.
- [ ] Manual smoke (`npm run dev`): create PO (locked units + on-hand panel + banner) → approve → convert (animation → redirect, prefilled + badge) → save invoice → PO becomes received/partially_received → from-PO chip visible on the purchase. Convert a partially-received PO again to confirm remaining recomputes.

---

## Self-Review notes (author)

- **Spec coverage:** units locked (T4), unit persisted/returned (T2), live stock panel (T4), suggested warehouse (T4/T2), single conversion path + retired modal/endpoint (T2/T5), source tagging + back-links (T3/T6/T7), over-receive/partial/cancelled guards (T3), PO identity (T4/T5), improved detail modal (T5), accept animation→redirect (T5), i18n (T8). All spec sections mapped.
- **Type/name consistency:** payload keys `source_purchase_order_id`, `purchase_order_line_id`, `unit_id`, `warehouse_id` are identical across PO route, purchases route, both forms, and tests.
- **Known follow-up to confirm during execution:** exact supplier-setting idiom in `PurchaseFormPage` (Task 6 Step 1) and the concrete purchases **list** component for the chip (Task 7 Step 3) — both flagged inline rather than guessed.
