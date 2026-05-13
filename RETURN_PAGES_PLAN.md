# Return Pages Redesign Plan

## Scope
- `SalesReturnFormPage` (emerald)
- `PurchaseReturnFormPage` (amber)
- `SalesReturnDetailPage` + `PurchaseReturnDetailPage`
- Returns list pages (sales + purchases)
- `InvoiceDetailPage` / purchase detail page — returns badge + link
- `POSPage` — idle screen polish

---

## 1. Color Scheme
- Sales Return → **emerald** (keep)
- Purchase Return → **amber** (keep)
- Applied consistently: header, idle screen, panels, buttons, badges

---

## 2. Idle / Active State Pattern

### Idle Screen (before activation)
- Centered card with **two choices**:
  1. **مرتجع مباشر** — add products directly (no invoice reference)
  2. **مرتجع من فاتورة** — search and load an existing invoice
- Doc number shows `"—"` in header
- Mode is **locked** once chosen — no switching mid-session

### Active State (after mode chosen)
- Full form renders
- Doc number + date populate in header via `useInvoiceActivation`
- Back button → **warning modal** → resets to idle (2-choice screen), does NOT navigate away

---

## 3. Header (both modes)
- Back button → idle with warning modal if active
- Page title + subtitle
- Doc number input (read-only, `"—"` when idle)
- Date input (read-only, `"—"` when idle)
- Lock badge (edit mode, locked state)
- Editor name badge (edit mode, unlocked)
- **Print** button (disabled until first save)
- **Edit** button (locked state only, same pattern as PurchaseFormPage)
- **Delete** button (edit mode only)
- **Save** button
- Link: "عرض كل مرتجعات هذه الفاتورة" (invoice mode only, once original invoice is loaded)

---

## 4. Left Panel (both direct and invoice modes)

### Top
- **Today's returns** button → opens today's returns modal (§9)

### Party Selector
- Customer selector (sales) / Supplier selector (purchases)
- **Balance panel** (visible once party selected):
  - Current balance
  - Balance after this return — live: `balance - returnTotal`
  - Ajal debt pending (sales return only)
  - Link to party profile page

### Settings
- Refund method toggle:
  - Sales: `نقداً (cash_back)` / `رصيد حساب (credit_note)`
  - Purchases: `حساب (account)` / `نقداً (cash)`
- Treasury selector (visible when cash refund selected)
- Warehouse selector
- **Reason dropdown**: عيب في المنتج / خطأ في الطلب / تلف أثناء الشحن / لا يطابق الوصف / أخرى
  - Free-text input appears when "أخرى" is selected

### Total Footer
- Live total = sum of selected lines × qty
- Large total display at bottom (emerald/amber footer style)

---

## 5. Direct Mode — Right Panel
- Same structured entry as **PurchaseFormPage**:
  - Item search lookup (live debounced)
  - Staging area: qty input + price input
  - Add button
- Lines list below staging area
- Each line: item name, price, qty controls (+/−/input), remove button

---

## 6. Invoice Mode — Right Panel

### Step 1: Invoice Search (before invoice loaded)
- Live debounced search (250ms) — no manual button
- Results as cards: invoice no, date, customer/supplier, total, status badge (`مرتجع جزئياً` etc.)
- Clicking a card → loads invoice directly into lines table, activates form (no separate review modal)

### Step 2: Lines Table (after invoice loaded)
| Checkbox | Item | Original Qty | Already Returned | Qty to Return | Count After Return |
|----------|------|-------------|-----------------|---------------|--------------------|
- **Checkbox** unlocks the row for editing
- **Qty to return**: defaults to max returnable (`original - already_returned`), editable, capped at max
- **Count after return** = `original_qty - already_returned - qty_to_return` (live, updates as qty changes)
- No new products can be added in invoice mode
- All totals + balance panel update live as checkboxes/quantities change
- Invoice header info shown above table (read-only): customer/supplier, original date, original total, payment method

---

## 7. Edit Mode (locked/unlocked pattern)
- Opening existing return: form is **locked** (read-only, all inputs disabled)
- Header shows lock badge
- **Edit button** → warning modal → unlocks form
- After unlocking: all inputs editable, save button active
- Delete button visible in edit mode
- Edit of invoice-linked return: shows lines table in invoice mode (same checkboxes/qty UI)
- Edit of direct return: shows direct mode right panel

---

## 8. Post-Save Behavior
- New return saved → reset to **idle** (2-choice screen)
- Success message in header with optional **print button**
- Edit mode saved → stays in locked view of saved return
- Print does not block reset — optional action

---

## 9. Today's Returns Modal
- Triggered by button in left panel top area
- **DataGrid** columns: return doc no, date, original invoice no, customer/supplier, reason, refund method, total, status
- Per row actions:
  - **View** → opens return detail page
  - **Edit** → loads return into current page in edit mode (no navigation away)
- Supports coming from any mode (direct or invoice)

---

## 10. Multiple Return Invoices Against One Original

- Re-entering original invoice from return page → always creates a **new** return invoice
- Editing existing return invoice → updates that specific document only
- Each new return decreases remaining returnable qty per line (`returned_quantity` accumulates)
- When all lines fully returned → original invoice status = `fully_returned`

### Viewing all returns for one original invoice
- Dedicated returns list page filtered by original invoice id
- Triggered from **two entry points**:
  1. Badge on original invoice detail page (sales/purchases): `"يوجد N مرتجع بقيمة X ج.م"` → links to filtered list
  2. Header link on return form when original invoice is loaded: "عرض كل مرتجعات هذه الفاتورة"

### Original invoice detail page (sales/purchases)
- Always shows **original amounts** — untouched
- Shows notice badge: `"يوجد N مرتجع بقيمة X ج.م"` — informational only, no number changes
- Badge links to filtered returns list

---

## 11. Returns List Page (sales + purchases)
- Columns: return doc no, date, original invoice no (clickable → invoice detail), customer/supplier (clickable → profile), reason, refund method, total, status
- Per row actions: **edit** (loads into return form), **print**, **view detail**
- Filters: date range, party, refund method, reason, original invoice id (used for filtered view)
- Supports navigation from original invoice detail page with invoice id pre-filter applied

---

## 12. Return Invoice Detail Page (`SalesReturnDetailPage` / `PurchaseReturnDetailPage`)
- Header: return doc no, date, status, refund method, reason
- Party info with link to profile
- Original invoice link (if linked) — clickable → opens invoice detail
- Link: "عرض كل مرتجعات هذه الفاتورة" (if linked to original)
- Lines table: item, qty returned, unit price, line total
- Summary: total, treasury used (if cash refund)
- Actions: **edit** (loads into return form), **print**, **delete**

---

## 13. Reason Visibility
- Return invoice detail page — prominently near header
- Today's returns modal — as a column in DataGrid
- Returns list page — as a column

---

## 14. POSPage — Idle Screen Polish
- Idle screen (before `invoiceIsActive`) gets consistent treatment:
  - Same layout shell style as return pages idle screen
  - Doc number shows `"—"` consistently
- No structural change to list/grid views

---

## Keyboard Shortcuts
- None (mouse only — user preference)

---

## 15. Cleanup
- Delete `client/src/components/returns/GeneralPurchaseReturnModal.jsx` — dead code, fully replaced by `PurchaseReturnFormPage` direct mode

---

## 16. Print Template
- Return invoice print template follows **purchase receipt style**
- Must respect all existing print settings rules (logo, margins, custom text blocks, etc.) from `PrintingSettingsPanel`
- Party optional — print gracefully handles anonymous returns

