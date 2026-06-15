# طلبات التوريد (Supply / Purchase Orders) — Full Activation

**Date:** 2026-06-15
**Branch:** feat/feature-modules-wiring
**Status:** Approved design, pending implementation plan

## Goal

Make the **طلبات التوريد** (Purchase Orders, "PO") feature genuinely usable end‑to‑end:
fix the unit handling, give the buyer live stock visibility, route receiving
through the real Purchases invoice page with a permanent "came‑from‑PO" link,
and make the PO surfaces visually impossible to confuse with the Purchases
invoice page.

## Current state (as of this branch)

- **Pages:** `client/src/pages/purchases/PurchaseOrdersPage.jsx` (list + receive
  modal + detail modal), `client/src/pages/purchases/PurchaseOrderFormPage.jsx`
  (create).
- **Backend:** `server/src/routes/purchaseOrders.routes.js`.
- **Flow today:** create PO (`pending`) → approve → **receive** via an in‑list
  modal that *silently* `INSERT`s a `purchases` row, adjusts stock, recomputes
  WACC, **and** bumps `suppliers.opening_balance` — a second, divergent invoice
  path that never touches `PurchaseFormPage`.

### Known defects this work fixes
1. **Unit discarded.** The form lets the user pick a unit, but
   `POST /api/purchase-orders` only stores `item_id, quantity, unit_cost`
   (route lines ~87‑91). The unit is silently dropped.
2. **Unit dropdown unscoped.** The form offers *all* system units for *any*
   item, allowing nonsense (e.g. "metre" of a drink).
3. **Divergent invoice path / double supplier balance.** The receive modal
   updates `suppliers.opening_balance` itself; the normal purchases route also
   maintains supplier balance. Two paths = reconciliation bugs.
4. **No on‑hand visibility** when ordering.
5. **No visual distinction** between the PO page and the Purchases invoice page.
6. **No trace** that a purchase invoice originated from a PO.

## Approved decisions

- **Conversion:** one path only — "استلام / تحويل لفاتورة" opens the real
  **Purchases invoice page, prefilled** from the PO. The old in‑list receive
  modal and the `/receive` endpoint are **retired**.
- **Warehouse on receive:** single destination warehouse for the receipt, with a
  live per‑warehouse stock panel for context (no per‑line warehouse split).
- **Units:** locked to the **item's own** configured units
  (`/api/items/:id/units`) + base unit; default base.

## Design

### A. Data model (migration `electron/migrations/NNN_*.js`)
Use the `addColumnIfMissing` / PRAGMA‑check idempotent pattern.
1. `purchase_order_lines.unit_id INTEGER` (nullable) — persist the chosen unit.
2. `purchase_orders.warehouse_id INTEGER` (nullable) — optional *suggested*
   destination warehouse, used as the convert‑time default.
3. `purchases.source_purchase_order_id INTEGER` (nullable) + index — mirrors the
   existing `amendment_of` linking pattern; tags an invoice as born from a PO.

### B. Backend — `purchaseOrders.routes.js`
- `POST /` — persist `unit_id` per line and optional `warehouse_id` on the header.
- `GET /:id` and `GET /` — return `unit_id`, joined `unit_name`, and
  `warehouse_id`; keep `remaining_quantity` per line.
- **Remove** the `/receive` endpoint (logic moves to the purchases route).
  Keep `approve` / `cancel` / list / detail.

### C. Backend — `purchases.routes.js` `POST /`
When the payload carries `source_purchase_order_id` (and each relevant line a
`purchase_order_line_id`), inside the **same transaction** that creates the
purchase:
1. Store `source_purchase_order_id` on the `purchases` row.
2. For each line with a `purchase_order_line_id`: validate
   `received_quantity + qty <= ordered quantity` (reject over‑receive, 400),
   then `received_quantity += qty` on that PO line. Quantities are compared in
   the **PO line's stored unit** (no implicit conversion — convert flow prefills
   the same unit).
3. Recompute PO status: all lines fully received → `received`; some → 
   `partially_received`; else unchanged.
4. Guard: reject if the PO is `cancelled` or already `received`.
Supplier balance / stock / WACC continue to be handled by the **single** normal
purchases path (no duplicate logic).

### D. PO form — `PurchaseOrderFormPage.jsx`
1. **Lock units:** on item pick, load that item's units (`/api/items/:id/units`;
   reuse already‑loaded `item.units` if present). Dropdown = item units + base;
   default base. Persist `unit_id`; add a **Unit column** to the grid.
2. **Live on‑hand panel:** reuse the warehouse stock‑table pattern from
   `PurchaseFormPage` as a **read‑only** per‑warehouse on‑hand display for the
   selected item (informational — a PO does not move stock).
3. **Suggested destination warehouse:** optional selector, saved on the PO.
4. **PO identity:** keep indigo accent; add a prominent banner
   **"طلب توريد — ليس فاتورة. المخزون لن يتأثر حتى الاستلام."**

### E. PO list — `PurchaseOrdersPage.jsx`
1. **Convert button** ("استلام / تحويل لفاتورة") → on click, play a smooth
   success/transition animation (framer‑motion, consistent with existing row
   animations) **then** `navigate("/purchases/new", { state: { fromPurchaseOrder: {...} } })`
   with: `supplier`, `source_purchase_order_id`, suggested `warehouse_id`, and
   `lines` = remaining‑qty lines carrying `purchase_order_line_id`, `item_id`,
   `unit_id`, `unit_cost`.
2. **Detailed order modal (improved):** supplier, status, suggested warehouse,
   created date, notes; a clear line table — `code · name · unit · ordered ·
   received · remaining · unit cost · line total`; order totals (items / qty /
   value); and, if already (partially) received, a link to the generated
   invoice(s). Remove the old receive modal entirely.
3. **Identity:** header reads "أوامر توريد — ليست فواتير"; indigo accent retained.

### F. Purchases page + detail/list — "from PO" surfacing
1. `PurchaseFormPage` reads `location.state.fromPurchaseOrder`: prefill supplier +
   lines (editable; qty defaults to remaining), default warehouse, and keep
   `source_purchase_order_id` + per‑line `purchase_order_line_id` in state and in
   the save payload.
2. **Source badge** 📦 **"ناتج عن أمر توريد PO‑00012"** (back‑link to the PO) on:
   the prefilled form header, the saved purchase **detail page**, and the
   purchases **list row**.

## Edge cases / correctness
- Partial receive: editing qty down → PO `partially_received`; remaining
  re‑convertible later (prefill recomputes remaining).
- Over‑receive blocked server‑side (per line).
- Cancelled / fully‑received PO cannot be converted (button hidden + server guard).
- Single supplier‑balance update (only the purchases path).
- Idempotent migrations (PRAGMA checks); new NOT‑NULL columns avoided (all
  nullable) per SQLite rules.

## i18n
All new strings added to both `client/src/locales/ar.json` and `en.json`.

## Out of scope
- Per‑line warehouse split on receive.
- Supplier‑facing PO printing/PDF (existing print path unchanged).
- Reworking approve/cancel semantics (kept as‑is).
