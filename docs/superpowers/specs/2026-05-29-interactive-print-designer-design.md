# Interactive Print Designer — Design Spec

**Date:** 2026-05-29
**Status:** Approved (brainstorm), pending implementation plan
**Author:** brainstorm session

## 1. Goal

Add an **optional full-screen "Print Designer"** launched from the existing print preview. It gives users direct, mouse-driven, detailed control over how each document prints (drag to reorder, show/hide, align, edit text inline, change fonts/colors, resize, add sections, control table columns, drag margins).

It is **additive, not a replacement**: the current toggle/number Print Settings panel stays exactly as it is. The Designer and the simple panel are **two windows onto the same saved settings object**, so any change made in one is reflected in the other. There is no second copy of the data, so they cannot drift.

### Non-goals (v1)
- No free/absolute (x,y) positioning. Layout stays **flow-based** so it reflows safely across paper sizes.
- No deletion or redesign of the existing simple settings panel.
- No per-printer driver settings (paper size selection stays as today).

## 2. Key decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Editing model | **Structured drag** — reorder/show-hide/resize/align existing blocks, flow-based, data-bound |
| Where it lives | **Full-screen editor opened from the preview** (Print Settings tab; reusable from Print Preview modal) |
| Capability depth | **Tier 4** — rearrange + text styling + resize & insert elements + margin ruler + table-column control |
| Layout granularity | **Per size-family** — one `roll` layout (58/80mm) + one `page` layout (A5/A4) per doc type |
| Architecture | **Shared block library** — extract block components from current renderers; editor canvas and print pipeline render the *same* components (guaranteed WYSIWYG) |
| Relationship to current controls | **Keep both, one shared store** — simple panel and Designer edit the same per-doc settings object |

## 3. Architecture — shared block library

Today, `client/src/components/print/PrintDoc.jsx` contains two monolithic renderers: `PrintThermalDoc` (58/80mm) and `PrintA4Doc` (A4/A5). The preview in `PrintingSettingsPanel.jsx` re-implements similar markup.

We refactor the rendering into a **shared block library** so there is one implementation used by the simple preview, the Designer canvas, and the real print iframe:

```
components/print/
  blocks/                      # each block = small, isolated, testable component
    LogoBlock.jsx
    CompanyNameBlock.jsx
    BranchBlock.jsx
    AddressBlock.jsx
    TaxIdBlock.jsx
    DocTitleBlock.jsx
    DocNumberBlock.jsx
    DocDateBlock.jsx
    CustomerBlock.jsx
    CashierBlock.jsx
    ItemsTableBlock.jsx        # owns column config
    SubtotalBlock.jsx
    DiscountBlock.jsx
    TaxBlock.jsx
    GrandTotalBlock.jsx
    PaymentsBlock.jsx
    ReceiptHeaderTextBlock.jsx
    FooterTextBlock.jsx
    QrBlock.jsx
    BarcodeBlock.jsx
    CustomTextBlock.jsx        # inline-editable
    CustomImageBlock.jsx
    DividerBlock.jsx
    SpacerBlock.jsx
    registry.js                # type -> { component, label, group, families, dataBinding, defaultProps }
  families/
    RollWrapper.jsx            # 58/80mm: single narrow column, dashed dividers, monospace defaults
    PageWrapper.jsx            # A4/A5: wide, optional 2-col header zone, accent table header
  LayoutRenderer.jsx           # given (family, layout, invoice, settings) -> ordered blocks inside wrapper
```

- Each block component signature: `Block({ invoice, settings, props, family, editing })`.
  `editing` enables in-canvas affordances (handles, contentEditable); when false it renders print-clean.
- `LayoutRenderer` reads the block **order** from the layout, renders each block via the registry inside the correct family wrapper. Missing/empty layout → falls back to the **default order** (today's hardcoded order) so existing documents are unaffected.
- `PrintThermalDoc` / `PrintA4Doc` become thin shims that call `LayoutRenderer` with `family="roll"` / `family="page"`.

## 4. Data model — one shared store, extended

The single source of truth stays the existing per-doc settings JSON (`print_settings_per_doc.settings`, served by `printSettings.routes.js`). We **extend** it; we do not add a competing table.

```jsonc
{
  // ── existing fields (edited by the simple panel; UNCHANGED) ──
  "show_logo": true, "show_tax": true, "header_font_size": 16, /* … all current show_* / *_font_size / margins / custom blocks … */
  "paper_size": "80mm",

  // ── NEW: layout, per size-family ──
  "layout": {
    "roll": {
      "order": ["logo","company_name","branch","address","tax_id","doc_number","doc_date","customer","cashier",
                "items_table","subtotal","discount","tax","grand_total","payments","footer_text","qr"],
      "inserted": [ { "id":"c_1", "type":"custom_text", "after":"footer_text", "props":{ "text":"…" } } ],
      "perBlock": { "company_name": { "fontSize": 18, "align": "center", "color": "#0f172a", "bold": true } },
      "columns": { "items_table": [
        { "key":"code",  "label":"كود",   "visible":true,  "width":"auto", "align":"right" },
        { "key":"name",  "label":"الصنف", "visible":true,  "width":2,      "align":"right" },
        { "key":"qty",   "label":"كمية",  "visible":true,  "width":0.5,    "align":"center" },
        { "key":"total", "label":"إجمالي","visible":true,  "width":1,      "align":"left" }
      ] },
      "margins": { "top": 4, "side": 4, "bottom": 4 }
    },
    "page": { /* same shape */ }
  }
}
```

### Sync rules (how both editors stay consistent)
- **Visibility & shared fonts:** a block's `visible` and base font come from the **existing top-level fields** (`show_logo`, `header_font_size`, …). Toggling in the simple panel and toggling in the Designer write the *same* field → instant two-way sync.
- **Designer-only fields** (`order`, `inserted`, `perBlock` overrides, `columns`, per-family `margins`) live under `layout`. The simple panel doesn't render controls for these and leaves them untouched.
- **Resolution order at render:** `layout.<family>.perBlock[id]` override → top-level setting → block `defaultProps`.

### Seeding & backward compatibility
- On first Designer open for a doc type, build `layout.roll` and `layout.page` from current settings: default block order, existing `show_*`→still drives visibility, existing custom blocks → `inserted` entries at their positions, default columns for `items_table`.
- Documents with no `layout` print exactly as today (default order). Zero regressions for existing users.

### Registry fix (folds in audit findings)
Introduce one shared `DOC_TYPES` constant imported by client and server, adding the missing `purchase_return` and `ajal_full_statement` (currently rejected with 400 by the server and absent from the settings nav). This removes the drift class of bug found in the audit.

## 5. Designer UI/UX

A **full-screen overlay** opened by a "⛶ تحرير متقدم / Advanced editor" button on the preview (in the Print Settings tab; the same launcher can be added to `PrintPreviewModal`). Regions:

1. **Top bar** — current doc type (from context), **Roll / Page** family tabs, in-family size preview (58/80 or A5/A4), Reset, **Test print** (prints current layout), **Save & close**.
2. **Format toolbar** (Word-like) — font family, size, bold/italic, color, alignment. Acts on the selected block (writes to `perBlock` override or the shared field as appropriate).
3. **Left palette** — drag-to-insert: text, image, divider, spacer, QR; plus a "hidden blocks" tray to re-enable hidden blocks. Only blocks valid for the active family are offered.
4. **Center canvas** — the document rendered by the shared block library (`editing=true`), with: a **margin ruler** (drag markers → `margins`), block **selection** (outline + ⠿ drag handle), a blue **insertion line** during drag, **double-click to edit text** inline (contentEditable → block text/props), **corner resize handles** (logo height, QR size, font size, block width).
5. **Right inspector** — selected block's properties + its **data binding** label (e.g. `settings.company_name`); when the items table is selected it becomes a **column editor** (reorder ⠿, show/hide, width, align, add column from available item fields, overflow fit-meter). Below: an **Outline list** mirroring canvas order, also reorderable.

### Interaction library
Use **dnd-kit** (already React-friendly, pointer-based, works in Electron renderer) for drag/reorder/insert. Inline text editing via `contentEditable` on the block in editing mode. No platform-specific code — runs in the Electron renderer exactly like the current settings panel.

## 6. Print pipeline integration

- `PrintPreviewModal` already merges global + per-doc settings and renders via the renderers. After the refactor it renders via `LayoutRenderer`, automatically honoring `layout.<family>.order/columns/inserted/perBlock`.
- The real print path (`buildIframeAndPrint`) is unchanged — it serializes the same rendered DOM. WYSIWYG holds because the canvas and the print use the same block components.
- Paper-size → family mapping: `58mm`/`80mm` → `roll`; `A5`/`A4` → `page`.

## 7. Electron considerations
- Pure renderer feature (React); no main-process changes. Printing continues through the existing hidden-iframe `window.print()` approach.
- `contentEditable` and dnd-kit work in Chromium/Electron without extra config.

## 8. Testing strategy
- **Block units:** render each block with mock invoice/settings; assert visibility, binding, alignment.
- **Seeding/migration:** given legacy settings, assert generated `layout` matches default order, visibility carried over, custom blocks mapped to `inserted`.
- **Sync:** toggling `show_logo` in the simple model hides the logo block in `LayoutRenderer`; hiding via Designer writes `show_logo` — assert both directions.
- **Print snapshot:** snapshot `roll` and `page` output for a sample of doc types with default layout (must equal current output) and with a custom layout.
- **Column control:** reordering/hiding columns + fit-meter overflow logic.

## 9. Out-of-scope but related (from the print audit — recommend doing alongside)
1. Add missing `docType` to InvoiceDetailPage (`sales_invoice`), SalesReturnDetailPage (`sales_return`), PurchaseReturnDetailPage (`purchase_return`), BranchTransferFormPage (`branch_transfer`).
2. Convert raw `window.print()` sites (QuotationsPage → `quotation`, DocumentPreviewModal, OwnerStatementPage) to `PrintPreviewModal`.
3. Guard `PrintPreviewModal` so a missing `docType` still fetches `/api/settings` instead of forcing A4.

These are independent fixes; the registry unification in §4 is the only one required as a foundation for the Designer.

## 10. Rollout
1. Refactor renderers into the shared block library (behind no behavior change — default order = today).
2. Add `layout` field + seeding + sync resolution.
3. Build the Designer overlay (palette → canvas → inspector → toolbar → ruler).
4. Wire the launcher button on the preview; add column editor; add Test print.
5. Tests at each step; ship Designer as optional.
