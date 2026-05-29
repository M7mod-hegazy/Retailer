# Print Designer — Phase 1: Foundation (Shared Block Library) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the two monolithic print renderers (`PrintThermalDoc`, `PrintA4Doc`) into a shared, registry-driven block library rendered through a `LayoutRenderer` + family wrappers, with default block order identical to today's output, and unify the `DOC_TYPES` list across client and server.

**Architecture:** Each visual piece becomes a small block component looked up via a registry. `LayoutRenderer` renders an ordered list of blocks inside a family wrapper (`RollWrapper` for 58/80mm, `PageWrapper` for A5/A4). With no saved layout, it uses a default order that reproduces current markup byte-for-functional-equivalence, verified by characterization snapshot tests written before the refactor. No `layout` field is read yet — that is Phase 2.

**Tech Stack:** React 18, Vite, Vitest (`npm test --prefix client` → `vitest run`), better-sqlite3 (server). No new dependencies in Phase 1.

**Spec:** `docs/superpowers/specs/2026-05-29-interactive-print-designer-design.md` (§3, §4 registry-fix, §6)

---

## File Structure

- `shared/docTypes.js` — **new** — single source of truth for the doc-type list (CommonJS, importable by server and client).
- `server/src/routes/printSettings.routes.js` — **modify** — import the shared list instead of the local `DOC_TYPES` array.
- `client/src/pages/settings/PrintingSettingsPanel.jsx` — **modify** — derive its `DOC_TYPES`/config from the shared list; add `purchase_return`.
- `client/src/components/print/blocks/registry.js` — **new** — maps block `type` → `{ component, label, group, families }`.
- `client/src/components/print/blocks/*.jsx` — **new** — one component per block type.
- `client/src/components/print/families/RollWrapper.jsx`, `PageWrapper.jsx` — **new** — structural wrappers.
- `client/src/components/print/LayoutRenderer.jsx` — **new** — orders + renders blocks in a wrapper; default-order fallback.
- `client/src/components/print/PrintDoc.jsx` — **modify** — `PrintThermalDoc`/`PrintA4Doc` become thin shims calling `LayoutRenderer`.
- `client/src/components/print/__tests__/*.test.jsx` — **new** — characterization + unit tests.

---

## Task 1: Characterization snapshot of current thermal output

Lock today's `PrintThermalDoc` output BEFORE touching it, so the refactor cannot change rendered markup.

**Files:**
- Test: `client/src/components/print/__tests__/printThermal.characterization.test.jsx`

- [ ] **Step 1: Write the characterization test**

```jsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PrintThermalDoc } from "../PrintDoc";

const INVOICE = {
  invoice_no: "INV-2025-0042",
  created_at: "2025-06-01T10:00:00Z",
  customer_name: "محمد الهيجازي",
  cashier_name: "أحمد صالح",
  lines: [
    { sku: "SKU-001", product_name: "قميص قطني L", quantity: 2, unit_price: 60, discount_amount: 0 },
    { sku: "SKU-002", product_name: "بنطلون جينز", quantity: 1, unit_price: 110, discount_amount: 10 },
  ],
  payments: [{ method_name: "نقداً", amount: 250 }],
};
const SETTINGS = {
  company_name: "إلهيجازي للتجزئة", branch_name: "الفرع الرئيسي",
  address: "شارع الملك فهد", phone: "0500000000", tax_id: "310122393500003",
  receipt_width: "80mm", show_qr: true, accent_color: "#0f172a",
};

describe("PrintThermalDoc characterization", () => {
  it("80mm output is stable", () => {
    const { container } = render(<PrintThermalDoc invoice={INVOICE} settings={{ ...SETTINGS, receipt_width: "80mm" }} />);
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("58mm output is stable", () => {
    const { container } = render(<PrintThermalDoc invoice={INVOICE} settings={{ ...SETTINGS, receipt_width: "58mm" }} />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run to generate the baseline snapshot**

Run: `npm test --prefix client -- printThermal.characterization`
Expected: PASS (2 passed) and a new `__snapshots__/printThermal.characterization.test.jsx.snap` is written. If `@testing-library/react` is missing, install it: `npm i -D @testing-library/react --prefix client`, then re-run.

- [ ] **Step 3: Commit the baseline**

```bash
git add client/src/components/print/__tests__/printThermal.characterization.test.jsx client/src/components/print/__tests__/__snapshots__
git commit -m "test: characterization snapshot of current thermal print output"
```

---

## Task 2: Characterization snapshot of current A4/A5 output

**Files:**
- Test: `client/src/components/print/__tests__/printA4.characterization.test.jsx`

- [ ] **Step 1: Write the test** (reuse the INVOICE/SETTINGS shape from Task 1)

```jsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PrintA4Doc } from "../PrintDoc";

const INVOICE = {
  invoice_no: "INV-2025-0042", created_at: "2025-06-01T10:00:00Z",
  customer_name: "محمد الهيجازي", cashier_name: "أحمد صالح",
  lines: [
    { sku: "SKU-001", product_name: "قميص قطني L", quantity: 2, unit_price: 60, discount_amount: 0 },
    { sku: "SKU-002", product_name: "بنطلون جينز", quantity: 1, unit_price: 110, discount_amount: 10 },
  ],
  payments: [{ method_name: "نقداً", amount: 250 }],
};
const SETTINGS = { company_name: "إلهيجازي للتجزئة", branch_name: "الفرع الرئيسي", tax_id: "310122393500003", show_qr: true, accent_color: "#0f172a" };

describe("PrintA4Doc characterization", () => {
  it("A4 output is stable", () => {
    const { container } = render(<PrintA4Doc invoice={INVOICE} settings={SETTINGS} size="A4" />);
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("A5 output is stable", () => {
    const { container } = render(<PrintA4Doc invoice={INVOICE} settings={SETTINGS} size="A5" />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run to generate baseline**

Run: `npm test --prefix client -- printA4.characterization`
Expected: PASS (2 passed), snapshot written.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/print/__tests__/printA4.characterization.test.jsx client/src/components/print/__tests__/__snapshots__
git commit -m "test: characterization snapshot of current A4/A5 print output"
```

---

## Task 3: Shared DOC_TYPES constant (registry fix)

Eliminate the client/server drift found in the audit (`purchase_return`, `ajal_full_statement` were rejected by the server).

**Files:**
- Create: `shared/docTypes.js`
- Modify: `server/src/routes/printSettings.routes.js:9-24` (replace local `DOC_TYPES`)
- Test: `server/src/routes/__tests__/printSettings.docTypes.test.js`

- [ ] **Step 1: Write the failing server test**

```js
const { DOC_TYPES } = require("../../../../shared/docTypes");

describe("shared DOC_TYPES", () => {
  it("includes previously-missing doc types", () => {
    expect(DOC_TYPES).toContain("purchase_return");
    expect(DOC_TYPES).toContain("ajal_full_statement");
  });
  it("covers all originally-supported types", () => {
    ["pos_receipt","sales_invoice","purchase_order","sales_return","quotation","branch_transfer",
     "bank_statement","ajal_statement","ajal_schedule","cheque_register","payment_receipt",
     "daily_treasury","payment_methods_report","reports_generic"].forEach(t => expect(DOC_TYPES).toContain(t));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --prefix server -- printSettings.docTypes`
Expected: FAIL — `Cannot find module '../../../../shared/docTypes'`.

- [ ] **Step 3: Create the shared constant**

Create `shared/docTypes.js`:
```js
// Single source of truth for printable document types.
// Imported by server (CommonJS) and client (via ESM interop in Vite).
const DOC_TYPES = [
  "pos_receipt", "sales_invoice", "purchase_order", "sales_return", "purchase_return",
  "quotation", "branch_transfer", "bank_statement", "ajal_statement", "ajal_schedule",
  "ajal_full_statement", "cheque_register", "payment_receipt", "daily_treasury",
  "payment_methods_report", "reports_generic",
];
module.exports = { DOC_TYPES };
```

- [ ] **Step 4: Wire the server route to it**

In `server/src/routes/printSettings.routes.js`, delete the local `const DOC_TYPES = [ ... ];` (lines 9-24) and add near the other requires:
```js
const { DOC_TYPES } = require("../../../shared/docTypes");
```

- [ ] **Step 5: Run server tests**

Run: `npm test --prefix server -- printSettings.docTypes`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add shared/docTypes.js server/src/routes/printSettings.routes.js server/src/routes/__tests__/printSettings.docTypes.test.js
git commit -m "fix: unify printable DOC_TYPES across client/server (adds purchase_return, ajal_full_statement)"
```

---

## Task 4: Block registry + first two blocks (pattern-setter)

Establish the registry and the extraction pattern with two representative blocks: `CompanyNameBlock` (simple, settings-bound) and `GrandTotalBlock` (computed from invoice).

**Files:**
- Create: `client/src/components/print/blocks/CompanyNameBlock.jsx`
- Create: `client/src/components/print/blocks/GrandTotalBlock.jsx`
- Create: `client/src/components/print/blocks/registry.js`
- Test: `client/src/components/print/__tests__/blocks.test.jsx`

- [ ] **Step 1: Write the failing block tests**

```jsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BLOCK_REGISTRY } from "../blocks/registry";

const S = { company_name: "إلهيجازي للتجزئة", header_font_size: 16, accent_color: "#0f172a", currency_symbol: "ر.س", tax_rate: 15 };
const INV = { lines: [{ unit_price: 100, quantity: 2, discount_amount: 0 }], payments: [] };

describe("block registry", () => {
  it("renders company name from settings", () => {
    const { component: Block } = BLOCK_REGISTRY.company_name;
    render(<Block invoice={{}} settings={S} props={{}} family="roll" />);
    expect(screen.getByText("إلهيجازي للتجزئة")).toBeTruthy();
  });
  it("computes grand total = subtotal - discount + tax", () => {
    const { component: Block } = BLOCK_REGISTRY.grand_total;
    const { container } = render(<Block invoice={INV} settings={S} props={{}} family="roll" />);
    // 200 - 0 + 15% = 230.00
    expect(container.textContent).toContain("230.00");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --prefix client -- blocks.test`
Expected: FAIL — `Cannot find module '../blocks/registry'`.

- [ ] **Step 3: Implement the two blocks**

Create `client/src/components/print/blocks/CompanyNameBlock.jsx`:
```jsx
import React from "react";
import { g } from "./blockUtils";
export default function CompanyNameBlock({ settings: s, family }) {
  const name = s.company_name || (family === "roll" ? "" : "");
  if (!name) return null;
  return <div style={{ fontSize: `${g(s, "header_font_size")}px`, fontWeight: 900, color: g(s, "accent_color") }}>{name}</div>;
}
```

Create `client/src/components/print/blocks/GrandTotalBlock.jsx`:
```jsx
import React from "react";
import { g, computeTotals } from "./blockUtils";
export default function GrandTotalBlock({ invoice, settings: s }) {
  const { grandTotal } = computeTotals(invoice, s);
  const currency = g(s, "currency_symbol");
  const accent = g(s, "accent_color");
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, borderTop: `1px solid ${accent}`, paddingTop: "3px", marginTop: "4px" }}>
      <span>المستحق:</span><span>{currency} {grandTotal.toFixed(2)}</span>
    </div>
  );
}
```

- [ ] **Step 4: Extract shared helpers**

Create `client/src/components/print/blocks/blockUtils.js` by moving the `DEFAULTS` map and `g()` helper out of `PrintDoc.jsx` (currently `PrintDoc.jsx:4-30`) so blocks and the shims share one copy:
```jsx
export const DEFAULTS = {
  receipt_width: "80mm", invoice_prefix: "INV",
  receipt_header: "", receipt_footer: "شكراً لزيارتكم — يسعدنا خدمتكم دائماً",
  header_font_size: 16, body_font_size: 11, footer_font_size: 10,
  item_font_size: 11, print_font: "monospace", logo_max_height: 48,
  logo_alignment: "center", accent_color: "#0f172a",
  margin_top: 4, margin_side: 4, qr_size: 44,
  show_cashier_name: true, show_customer_name: true, show_tax: true,
  show_footer: true, show_qr: false, show_logo: true,
  show_discount_line: true, show_payment_details: true, show_subtotal: true,
  show_phone: true, show_address: true, show_tax_id: true,
  show_branch: true, show_invoice_date: true,
  tax_rate: 15, currency_symbol: "ر.س", show_item_code: true,
  address_font_size: 9, address_alignment: "right",
  tax_id_font_size: 9, tax_id_alignment: "right",
};
export const g = (s, k) => {
  const raw = (s[k] !== undefined && s[k] !== null) ? s[k] : DEFAULTS[k];
  if (k.startsWith("show_") || k.startsWith("logo_on_")) {
    if (raw === 0 || raw === "0" || raw === "false") return false;
    if (raw === 1 || raw === "1" || raw === "true") return true;
  }
  return raw;
};
export function computeTotals(invoice = {}, s = {}) {
  const lines = invoice.lines || [];
  const taxRate = parseFloat(g(s, "tax_rate") || 0);
  const subtotal = lines.reduce((sum, l) => sum + ((Number(l.unit_price) || Number(l.unit_cost) || 0) * Number(l.quantity)), 0);
  const totalDiscount = lines.reduce((sum, l) => sum + (Number(l.discount_amount) || 0), 0);
  const taxAmount = g(s, "show_tax") !== false ? (subtotal - totalDiscount) * (taxRate / 100) : 0;
  const grandTotal = subtotal - totalDiscount + taxAmount;
  const paid = (invoice.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return { subtotal, totalDiscount, taxAmount, grandTotal, paid, change: paid - grandTotal, taxRate };
}
```
Then in `PrintDoc.jsx`, replace its local `DEFAULTS` and `g` with `import { DEFAULTS, g } from "./blocks/blockUtils";` (keep behavior identical — the snapshots from Tasks 1-2 guard this).

- [ ] **Step 5: Create the registry**

Create `client/src/components/print/blocks/registry.js`:
```jsx
import CompanyNameBlock from "./CompanyNameBlock";
import GrandTotalBlock from "./GrandTotalBlock";
// Further blocks are added in Task 5.
export const BLOCK_REGISTRY = {
  company_name: { component: CompanyNameBlock, label: "اسم الشركة", group: "brand", families: ["roll", "page"] },
  grand_total:  { component: GrandTotalBlock,  label: "المستحق",    group: "money", families: ["roll", "page"] },
};
```

- [ ] **Step 6: Run block tests + characterization**

Run: `npm test --prefix client -- blocks.test printThermal.characterization printA4.characterization`
Expected: PASS (blocks: 2 passed; characterization snapshots still PASS — helper extraction changed nothing).

- [ ] **Step 7: Commit**

```bash
git add client/src/components/print/blocks/ client/src/components/print/__tests__/blocks.test.jsx client/src/components/print/PrintDoc.jsx
git commit -m "feat(print): add block registry + blockUtils, extract first two blocks"
```

---

## Task 5: Extract the remaining blocks

Move each remaining piece of `PrintDoc.jsx` into its own block component and register it. Each block keeps the EXACT markup/styles from its source lines (the characterization snapshots are the safety net). One component per row below; props signature is always `({ invoice, settings, props, family, editing })`.

**Files (create each):** `client/src/components/print/blocks/<Name>Block.jsx`, and add to `registry.js`.

| Block type | Component | Source in PrintDoc.jsx | Group / families |
|---|---|---|---|
| `logo` | LogoBlock | thermal `:68-71`, a4 `:282-284` | brand / roll,page |
| `branch` | BranchBlock | `:72`, `:285` | brand / roll,page |
| `address` | AddressBlock | thermal `:73-95`, a4 `:286-307` (incl. additional_addresses/phones, address_position) | brand / roll,page |
| `tax_id` | TaxIdBlock | `:91`, `:304` | brand / roll,page |
| `receipt_header_text` | ReceiptHeaderTextBlock | `:97-99`, `:320-322` | foot / roll,page |
| `doc_number` | DocNumberBlock | thermal `:107-110` (invoice_no row), a4 `:311` | dochead / roll,page |
| `doc_date` | DocDateBlock | `:111-116`, `:312-316` | dochead / roll,page |
| `customer` | CustomerBlock | `:117-121`, `:328-330` | dochead / roll,page |
| `cashier` | CashierBlock | `:122-126`, `:331-333` | dochead / roll,page |
| `items_table` | ItemsTableBlock | thermal `:134-160`, a4 `:342-372` (column visibility via `show_item_code`) | body / roll,page |
| `subtotal` | SubtotalBlock | `:166-169`, `:380-385` | money / roll,page |
| `discount` | DiscountBlock | `:171-175`, `:386-391` | money / roll,page |
| `tax` | TaxBlock | `:176-180`, `:392-397` | money / roll,page |
| `payments` | PaymentsBlock | `:188-205`, `:408-420` | money / roll,page |
| `footer_text` | FooterTextBlock | `:208-216`, `:423-431` | foot / roll,page |
| `qr` | QrBlock | `:218-220`, `:433-437` | foot / roll,page |
| `custom_text` | CustomTextBlock | renders a `BlockRenderer`-style text block from `props.text` (see `pages/settings/CustomTextBlocks`) | inserted / roll,page |
| `divider` | DividerBlock | dashed rule: `borderTop: 1px dashed ${accent}66` | inserted / roll,page |
| `spacer` | SpacerBlock | `<div style={{ height: props.height ?? 8 }} />` | inserted / roll,page |

- [ ] **Step 1: Write a presence test for the full registry**

In `client/src/components/print/__tests__/blocks.test.jsx`, add:
```jsx
it("registry covers all v1 block types", () => {
  const expected = ["logo","company_name","branch","address","tax_id","receipt_header_text",
    "doc_number","doc_date","customer","cashier","items_table","subtotal","discount","tax",
    "grand_total","payments","footer_text","qr","custom_text","divider","spacer"];
  expected.forEach(t => expect(BLOCK_REGISTRY[t], `missing block: ${t}`).toBeTruthy());
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --prefix client -- blocks.test`
Expected: FAIL — missing block types.

- [ ] **Step 3: Create each block component** by moving its markup from the cited source lines into `({ invoice, settings, props, family })` form, using `g`/`computeTotals` from `blockUtils`. `ItemsTableBlock` reads visible columns from `props.columns` when provided, else falls back to `show_item_code` + the default 3-column thermal / numbered page layout. Register each in `registry.js`.

- [ ] **Step 4: Run the registry test**

Run: `npm test --prefix client -- blocks.test`
Expected: PASS (all 3 describe blocks pass).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/print/blocks/
git commit -m "feat(print): extract all remaining print blocks into the registry"
```

---

## Task 6: Family wrappers + default order

Define `RollWrapper`/`PageWrapper` (structural chrome) and the canonical default block order per family that reproduces today's documents.

**Files:**
- Create: `client/src/components/print/families/RollWrapper.jsx`
- Create: `client/src/components/print/families/PageWrapper.jsx`
- Create: `client/src/components/print/families/defaultOrder.js`
- Test: `client/src/components/print/__tests__/defaultOrder.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from "vitest";
import { DEFAULT_ORDER } from "../families/defaultOrder";

describe("default order", () => {
  it("roll starts with brand and ends with qr", () => {
    expect(DEFAULT_ORDER.roll[0]).toBe("logo");
    expect(DEFAULT_ORDER.roll).toContain("items_table");
    expect(DEFAULT_ORDER.roll.at(-1)).toBe("qr");
  });
  it("page contains the same block set as roll", () => {
    expect([...DEFAULT_ORDER.page].sort()).toEqual([...DEFAULT_ORDER.roll].sort());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --prefix client -- defaultOrder.test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement default order + wrappers**

Create `client/src/components/print/families/defaultOrder.js`:
```js
const COMMON = [
  "logo", "company_name", "branch", "address", "tax_id", "receipt_header_text",
  "doc_number", "doc_date", "customer", "cashier",
  "items_table", "subtotal", "discount", "tax", "grand_total", "payments",
  "footer_text", "qr",
];
export const DEFAULT_ORDER = { roll: [...COMMON], page: [...COMMON] };
```

Create `client/src/components/print/families/RollWrapper.jsx`:
```jsx
import React from "react";
import { g } from "../blocks/blockUtils";
export default function RollWrapper({ settings: s, children }) {
  const w = (s.receipt_width || g(s, "receipt_width")) === "58mm" ? "58mm" : "80mm";
  return (
    <div dir="rtl" style={{ fontFamily: g(s, "print_font"), fontSize: `${g(s, "body_font_size")}px`,
      width: w, margin: "0 auto", padding: `${g(s, "margin_top")}mm ${g(s, "margin_side")}mm`,
      color: g(s, "accent_color"), background: "#fff" }}>{children}</div>
  );
}
```

Create `client/src/components/print/families/PageWrapper.jsx`:
```jsx
import React from "react";
import { g } from "../blocks/blockUtils";
export default function PageWrapper({ settings: s, size = "A4", children }) {
  const w = size === "A5" ? "148mm" : "210mm";
  return (
    <div dir="rtl" style={{ width: w, padding: `${g(s, "margin_top")}mm ${g(s, "margin_side")}mm`,
      fontFamily: g(s, "print_font"), fontSize: `${g(s, "body_font_size")}px`,
      color: "#1e293b", background: "#fff" }}>{children}</div>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npm test --prefix client -- defaultOrder.test`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/print/families/
git commit -m "feat(print): add family wrappers and default block order"
```

---

## Task 7: LayoutRenderer

Render an ordered block list inside a family wrapper. Order comes from `layout.<family>.order` when present, else `DEFAULT_ORDER`. (Reading `layout` is harmless now — Phase 2 populates it.)

**Files:**
- Create: `client/src/components/print/LayoutRenderer.jsx`
- Test: `client/src/components/print/__tests__/layoutRenderer.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LayoutRenderer from "../LayoutRenderer";

const INV = { invoice_no: "INV-1", lines: [{ product_name: "X", quantity: 1, unit_price: 10 }], payments: [] };

describe("LayoutRenderer", () => {
  it("renders default order when no layout given", () => {
    const { container } = render(<LayoutRenderer family="roll" invoice={INV} settings={{ company_name: "ACME", show_qr: true }} />);
    expect(container.textContent).toContain("ACME");
  });
  it("honors an explicit order (company name before nothing else)", () => {
    const layout = { roll: { order: ["company_name", "grand_total"] } };
    const { container } = render(<LayoutRenderer family="roll" invoice={INV} settings={{ company_name: "ACME", layout }} layout={layout} />);
    const txt = container.textContent;
    expect(txt.indexOf("ACME")).toBeLessThan(txt.indexOf("المستحق"));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --prefix client -- layoutRenderer.test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement LayoutRenderer**

Create `client/src/components/print/LayoutRenderer.jsx`:
```jsx
import React from "react";
import { BLOCK_REGISTRY } from "./blocks/registry";
import { DEFAULT_ORDER } from "./families/defaultOrder";
import RollWrapper from "./families/RollWrapper";
import PageWrapper from "./families/PageWrapper";

export default function LayoutRenderer({ family = "roll", invoice = {}, settings = {}, layout = null, size = "A4", editing = false }) {
  const famLayout = (layout || settings.layout || {})[family] || {};
  const order = Array.isArray(famLayout.order) && famLayout.order.length ? famLayout.order : DEFAULT_ORDER[family];
  const perBlock = famLayout.perBlock || {};

  const blocks = order.map((type, i) => {
    const entry = BLOCK_REGISTRY[type];
    if (!entry || !entry.families.includes(family)) return null;
    const Block = entry.component;
    const props = { ...(entry.defaultProps || {}), ...(perBlock[type] || {}) };
    return <Block key={`${type}-${i}`} invoice={invoice} settings={settings} props={props} family={family} editing={editing} />;
  });

  const Wrapper = family === "roll" ? RollWrapper : PageWrapper;
  return <Wrapper settings={settings} size={size}>{blocks}</Wrapper>;
}
```

- [ ] **Step 4: Run the test**

Run: `npm test --prefix client -- layoutRenderer.test`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/print/LayoutRenderer.jsx client/src/components/print/__tests__/layoutRenderer.test.jsx
git commit -m "feat(print): add LayoutRenderer (ordered blocks in family wrapper)"
```

---

## Task 8: Convert PrintThermalDoc / PrintA4Doc into shims

Make the public renderers delegate to `LayoutRenderer`, then prove output is unchanged via the Task 1-2 snapshots.

**Files:**
- Modify: `client/src/components/print/PrintDoc.jsx`

- [ ] **Step 1: Replace the renderer bodies with shims**

In `PrintDoc.jsx`, replace the `PrintThermalDoc` and `PrintA4Doc` function bodies with:
```jsx
import LayoutRenderer from "./LayoutRenderer";

export function PrintThermalDoc({ invoice = {}, settings = {} }) {
  const family = "roll";
  return <LayoutRenderer family={family} invoice={invoice} settings={settings} layout={settings.layout || null} />;
}

export function PrintA4Doc({ invoice = {}, settings = {}, size = "A4" }) {
  return <LayoutRenderer family="page" invoice={invoice} settings={settings} layout={settings.layout || null} size={size} />;
}
```
Keep the `import { DEFAULTS, g } from "./blocks/blockUtils";` line; delete now-dead local markup.

- [ ] **Step 2: Run the characterization snapshots**

Run: `npm test --prefix client -- printThermal.characterization printA4.characterization`
Expected: Likely FAIL on first run because whitespace/attribute order differs from the captured baseline even when visually identical.

- [ ] **Step 3: Manually verify equivalence, then re-baseline**

Inspect the snapshot diff: confirm every difference is cosmetic (attribute ordering, whitespace, equivalent style strings) and there is **no missing/added text, no changed numbers, no removed element**. If — and only if — the diff is purely cosmetic, update the baseline:
Run: `npm test --prefix client -- -u printThermal.characterization printA4.characterization`
Expected: PASS, snapshots updated. If the diff shows real content changes, fix the offending block instead of updating the snapshot.

- [ ] **Step 4: Full client test run**

Run: `npm test --prefix client`
Expected: All suites PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/print/PrintDoc.jsx client/src/components/print/__tests__/__snapshots__
git commit -m "refactor(print): PrintThermalDoc/PrintA4Doc delegate to LayoutRenderer (output equivalent)"
```

---

## Task 9: Unify the settings panel doc-type list

Make `PrintingSettingsPanel` derive its doc-type nav from the shared list so `purchase_return` becomes configurable and the lists can't drift.

**Files:**
- Modify: `client/src/pages/settings/PrintingSettingsPanel.jsx:51-88` (DOC_TYPES nav + DOC_PAPER_CONFIG)
- Test: `client/src/pages/settings/__tests__/docTypeCoverage.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from "vitest";
import { DOC_PAPER_CONFIG } from "../PrintingSettingsPanel";
import { DOC_TYPES } from "../../../../../shared/docTypes";

describe("settings panel doc-type coverage", () => {
  it("every shared doc type has a paper config", () => {
    DOC_TYPES.forEach(t => expect(DOC_PAPER_CONFIG[t], `missing paper config: ${t}`).toBeTruthy());
  });
});
```
(Adjust the relative depth of the `shared/docTypes` import to match the file location.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --prefix client -- docTypeCoverage`
Expected: FAIL — `purchase_return` (and any other) missing from `DOC_PAPER_CONFIG`.

- [ ] **Step 3: Add the missing config**

In `PrintingSettingsPanel.jsx`, add to `DOC_PAPER_CONFIG`:
```js
purchase_return: { sizes: ["58mm","80mm","A5","A4"], defaultSize: "80mm" },
```
and add a nav entry to the `DOC_TYPES` array used for the sidebar:
```js
{ key: "purchase_return", label: "مرتجع مشتريات", icon: "PRT" },
```

- [ ] **Step 4: Run the test**

Run: `npm test --prefix client -- docTypeCoverage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/settings/PrintingSettingsPanel.jsx client/src/pages/settings/__tests__/docTypeCoverage.test.js
git commit -m "feat(settings): make purchase_return configurable; cover all shared doc types"
```

---

## Task 10: Phase 1 verification

- [ ] **Step 1: Run the full client + server suites**

Run: `npm test --prefix client` then `npm test --prefix server`
Expected: All PASS, including both characterization snapshots.

- [ ] **Step 2: Manual smoke test (real app)**

Run: `npm run dev`. Open POS, complete a sale, open the print preview for `pos_receipt` at 80mm and A4. Confirm the receipt looks identical to before this phase (same fields, order, totals). Open Settings → Printing and confirm `مرتجع مشتريات` (purchase_return) now appears and its settings save without a 400.

- [ ] **Step 3: Commit any snapshot/lint fixups**

```bash
git add -A
git commit -m "chore(print): phase 1 foundation verification fixups"
```

---

## Self-Review notes
- **Spec §3 (shared block library):** Tasks 4-7 (registry, blocks, wrappers, LayoutRenderer).
- **Spec §4 registry fix:** Tasks 3 + 9.
- **Spec §6 (print pipeline):** Task 8 (shims) — `PrintPreviewModal` keeps calling `PrintThermalDoc`/`PrintA4Doc`, now routed through `LayoutRenderer`.
- **Deferred to Phase 2:** the `layout` field write path, seeding, sync rules (LayoutRenderer already *reads* `layout` defensively).
- **Deferred to Phase 3:** Designer overlay, dnd-kit, inline editing, column editor UI, ruler.
- Type consistency: block signature `({ invoice, settings, props, family, editing })`, `BLOCK_REGISTRY[type] = { component, label, group, families, defaultProps? }`, and `DEFAULT_ORDER[family]` are used consistently across Tasks 4-8.
