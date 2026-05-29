# Print Designer — Phase 1b: Page Zones + Production Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a zone-aware page (A4/A5) layout to the block library, preserve legacy custom text blocks in `LayoutRenderer`, then cut the production renderers (`PrintThermalDoc`/`PrintA4Doc`) over to `LayoutRenderer` with zero visual/content regression — guarded by the Phase 1 characterization snapshots plus an explicit custom-blocks-preserved test.

**Architecture:** Page family is not a flat stack. A `PageZoneLayout` groups the ordered blocks by their registry `group` into four zones: a two-column **header** (brand on the right, doc-meta on the left), a full-width **body**, a right-aligned **totals** box, and a **footer**. Roll family stays flat (Phase 1). `LayoutRenderer` learns to interleave legacy custom blocks (`getCustomBlocks`) at their saved positions so existing receipts are unchanged after cutover.

**Tech Stack:** React 18, Vitest. No new dependencies.

**Depends on:** Phase 1 (block registry, `LayoutRenderer`, `RollWrapper`, characterization snapshots).
**Spec:** `docs/superpowers/specs/2026-05-29-interactive-print-designer-design.md` (§3 family wrappers, §6 print pipeline).

---

## File Structure

- `client/src/components/print/blocks/DocTitleBlock.jsx` — **new** — the page header title (e.g. "فاتورة"); roll renders nothing.
- `client/src/components/print/blocks/registry.js` — **modify** — register `doc_title`; add page-aware rendering notes.
- `client/src/components/print/blocks/*.jsx` — **modify** — give each block its page-family branch (colors, table header background) matching `PrintA4Doc`.
- `client/src/components/print/families/PageZoneLayout.jsx` — **new** — groups blocks into header/body/totals/footer zones.
- `client/src/components/print/families/PageWrapper.jsx` — **modify** — outer A4/A5 frame; renders `PageZoneLayout`.
- `client/src/components/print/customBlockBridge.js` — **new** — maps legacy `getCustomBlocks(settings)` to positioned inserts for `LayoutRenderer`.
- `client/src/components/print/LayoutRenderer.jsx` — **modify** — interleave custom blocks; pass zone grouping to page.
- `client/src/components/print/PrintDoc.jsx` — **modify** — `PrintThermalDoc`/`PrintA4Doc` become shims.
- `client/src/components/print/__tests__/*.test.jsx` — **new/modify** — zone tests, custom-block preservation, cutover equivalence.

---

## Task 1: DocTitleBlock + page header title

**Files:**
- Create: `client/src/components/print/blocks/DocTitleBlock.jsx`
- Modify: `client/src/components/print/blocks/registry.js`
- Test: `client/src/components/print/__tests__/blocks.test.jsx`

- [ ] **Step 1: Write the failing test** (append to existing `blocks.test.jsx`)

```jsx
it("doc_title renders props.title on page, nothing on roll", () => {
  const { component: Block } = BLOCK_REGISTRY.doc_title;
  const page = render(<Block invoice={{}} settings={{ accent_color: "#0f172a" }} props={{ title: "فاتورة" }} family="page" />);
  expect(page.container.textContent).toContain("فاتورة");
  const roll = render(<Block invoice={{}} settings={{}} props={{ title: "فاتورة" }} family="roll" />);
  expect(roll.container.textContent).toBe("");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --prefix client -- blocks.test`
Expected: FAIL — `BLOCK_REGISTRY.doc_title` undefined.

- [ ] **Step 3: Implement DocTitleBlock**

Create `client/src/components/print/blocks/DocTitleBlock.jsx`:
```jsx
import React from "react";
import { g } from "./blockUtils";
export default function DocTitleBlock({ settings: s, props = {}, family }) {
  if (family === "roll" || !props.title) return null;
  return <div style={{ fontSize: "18px", fontWeight: 900, color: g(s, "accent_color") }}>{props.title}</div>;
}
```
Register in `registry.js`:
```jsx
import DocTitleBlock from "./DocTitleBlock";
// add inside BLOCK_REGISTRY:
doc_title: { component: DocTitleBlock, label: "عنوان المستند", group: "dochead", families: ["page"] },
```

- [ ] **Step 4: Run test**

Run: `npm test --prefix client -- blocks.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/print/blocks/DocTitleBlock.jsx client/src/components/print/blocks/registry.js client/src/components/print/__tests__/blocks.test.jsx
git commit -m "feat(print): add doc_title block for page header"
```

---

## Task 2: Page-family branches on each block

Each block must render its A4 appearance when `family === "page"` (accent colors, table header background, alternating rows), matching `PrintA4Doc` (`PrintDoc.jsx` page renderer). Roll branch already done in Phase 1.

**Files:**
- Modify: every `client/src/components/print/blocks/*Block.jsx` that differs on page.
- Test: `client/src/components/print/__tests__/pageBlocks.test.jsx`

- [ ] **Step 1: Write failing page-block tests**

```jsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BLOCK_REGISTRY } from "../blocks/registry";

const S = { accent_color: "#123456", currency_symbol: "ر.س", tax_rate: 15, item_font_size: 11, show_item_code: true };
const INV = { lines: [{ sku: "K1", product_name: "صنف", quantity: 2, unit_price: 50, discount_amount: 0 }] };

describe("page-family blocks", () => {
  it("items_table uses accent header background on page", () => {
    const { component: Block } = BLOCK_REGISTRY.items_table;
    const { container } = render(<Block invoice={INV} settings={S} props={{}} family="page" />);
    expect(container.querySelector("thead tr").getAttribute("style")).toContain("rgb(18, 52, 86)"); // #123456
  });
  it("items_table has a numbered '#' column on page", () => {
    const { component: Block } = BLOCK_REGISTRY.items_table;
    const { container } = render(<Block invoice={INV} settings={S} props={{}} family="page" />);
    expect(container.querySelector("thead").textContent).toContain("#");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --prefix client -- pageBlocks.test`
Expected: FAIL — page branch not implemented (no accent thead / no "#").

- [ ] **Step 3: Implement page branches** by porting markup from `PrintA4Doc` for each block. Reference source (current `PrintDoc.jsx` page renderer): items table `thead/tbody` with `#`, optional code column, `سعر`, alternating row backgrounds; totals rows with `#64748b` labels; payments "طريقة الدفع" header; footer color `#94a3b8`; header company color `accent`. Each block switches on `family`.

`ItemsTableBlock` page branch outline:
```jsx
if (family === "page") {
  const accent = g(s, "accent_color");
  const showCode = props.columns ? props.columns.some(c => c.key === "code" && c.visible !== false) : g(s, "show_item_code") !== false;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: `${g(s,"item_font_size")}px`, marginBottom: "8px" }}>
      <thead><tr style={{ background: accent, color: "#fff" }}>
        <th style={{ textAlign: "right", padding: "4px 6px" }}>#</th>
        {showCode && <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "9px", opacity: 0.85 }}>كود</th>}
        <th style={{ textAlign: "right", padding: "4px 6px" }}>المنتج</th>
        <th style={{ textAlign: "center", padding: "4px 6px" }}>كمية</th>
        <th style={{ textAlign: "center", padding: "4px 6px" }}>سعر</th>
        <th style={{ textAlign: "left", padding: "4px 6px" }}>إجمالي</th>
      </tr></thead>
      <tbody>{(invoice.lines||[]).map((line,i)=>{
        const lineTotal = ((Number(line.unit_price)||Number(line.unit_cost)||0)*Number(line.quantity))-(Number(line.discount_amount)||0);
        return (<tr key={i} style={{ background: i%2===0?"#f8fafc":"#fff" }}>
          <td style={{ padding:"3px 6px", color:"#94a3b8" }}>{i+1}</td>
          {showCode && <td style={{ textAlign:"center", padding:"3px 6px", fontSize:"9px", color:"#94a3b8", fontFamily:"monospace" }}>{line.sku||line.barcode||line.product_code||""}</td>}
          <td style={{ padding:"3px 6px", fontWeight:600 }}>{line.product_name||line.item_name||line.name||""}</td>
          <td style={{ textAlign:"center", padding:"3px 6px" }}>{line.quantity}</td>
          <td style={{ textAlign:"center", padding:"3px 6px" }}>{(Number(line.unit_price)||Number(line.unit_cost)||0).toFixed(2)}</td>
          <td style={{ textAlign:"left", padding:"3px 6px", fontWeight:700 }}>{lineTotal.toFixed(2)}</td>
        </tr>);
      })}</tbody>
    </table>
  );
}
```
Apply the analogous `family === "page"` branch to: `CompanyNameBlock` (already colors on page), `BranchBlock` (color `#64748b`), `AddressBlock` (color `#94a3b8`), `SubtotalBlock`/`DiscountBlock`/`TaxBlock` (label color `#64748b`, padding `2px 0`), `GrandTotalBlock` (accent background box), `PaymentsBlock` ("طريقة الدفع" header), `FooterTextBlock` (color `#94a3b8`), `QrBlock` (right-aligned wrapper).

- [ ] **Step 4: Run page-block tests**

Run: `npm test --prefix client -- pageBlocks.test blocks.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/print/blocks/ client/src/components/print/__tests__/pageBlocks.test.jsx
git commit -m "feat(print): add page-family rendering branches to blocks"
```

---

## Task 3: PageZoneLayout (group blocks into zones)

**Files:**
- Create: `client/src/components/print/families/PageZoneLayout.jsx`
- Modify: `client/src/components/print/families/PageWrapper.jsx`
- Test: `client/src/components/print/__tests__/pageZone.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LayoutRenderer from "../LayoutRenderer";

const INV = { invoice_no: "INV-9", customer_name: "زبون", lines: [{ product_name: "X", quantity: 1, unit_price: 100 }], payments: [] };
const S = { company_name: "ACME", accent_color: "#0f172a", show_qr: true, tax_rate: 15 };

describe("page zones", () => {
  it("renders a two-column header (brand + doc-meta side by side)", () => {
    const { container } = render(<LayoutRenderer family="page" size="A4" invoice={INV} settings={S} />);
    const header = container.querySelector("[data-zone='header']");
    expect(header).toBeTruthy();
    expect(header.querySelectorAll("[data-zone-col]").length).toBe(2);
  });
  it("totals zone is right-aligned", () => {
    const { container } = render(<LayoutRenderer family="page" size="A4" invoice={INV} settings={S} />);
    const totals = container.querySelector("[data-zone='totals']");
    expect(totals.getAttribute("style")).toContain("flex-end");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --prefix client -- pageZone.test`
Expected: FAIL — no `[data-zone]` elements (page still renders flat).

- [ ] **Step 3: Implement PageZoneLayout**

Create `client/src/components/print/families/PageZoneLayout.jsx`:
```jsx
import React from "react";
import { g } from "../blocks/blockUtils";

// Groups already-rendered, ordered block descriptors into zones by registry group.
// `items` is an array of { type, group, node } in layout order.
export default function PageZoneLayout({ items, settings: s }) {
  const accent = g(s, "accent_color");
  const pick = (...groups) => items.filter(it => groups.includes(it.group)).map(it => it.node);
  const brand = pick("brand");
  const meta = items.filter(it => it.group === "dochead").map(it => it.node);
  const body = pick("body");
  const totals = pick("money");
  const foot = pick("foot");

  return (
    <>
      <div data-zone="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${accent}`, paddingBottom: "8px", marginBottom: "10px" }}>
        <div data-zone-col="brand">{brand}</div>
        <div data-zone-col="meta" style={{ textAlign: "left" }}>{meta}</div>
      </div>
      <div data-zone="body">{body}</div>
      <div data-zone="totals" style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: "45%" }}>{totals}</div>
      </div>
      <div data-zone="footer">{foot}</div>
    </>
  );
}
```

Modify `PageWrapper.jsx` to render children inside the A4/A5 frame (zone layout is supplied by `LayoutRenderer` in Task 4); keep the outer frame only.

- [ ] **Step 4: Run test** (will still fail until Task 4 wires LayoutRenderer to emit zone items — that's expected; proceed to Task 4, then re-run)

- [ ] **Step 5: Commit**

```bash
git add client/src/components/print/families/PageZoneLayout.jsx client/src/components/print/families/PageWrapper.jsx client/src/components/print/__tests__/pageZone.test.jsx
git commit -m "feat(print): add PageZoneLayout for two-column header + right totals"
```

---

## Task 4: LayoutRenderer — page zones + custom-block interleaving

**Files:**
- Create: `client/src/components/print/customBlockBridge.js`
- Modify: `client/src/components/print/LayoutRenderer.jsx`
- Test: `client/src/components/print/__tests__/customBlocks.test.jsx`

- [ ] **Step 1: Write the failing custom-block test**

```jsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LayoutRenderer from "../LayoutRenderer";

// Legacy custom blocks live in settings.custom_text_blocks (see pages/settings/CustomTextBlocks).
const settings = {
  company_name: "ACME",
  custom_text_blocks: JSON.stringify([{ id: "x", position: "after_header", type: "text", text: "نص مخصص هام", paperSizes: ["80mm","A4"] }]),
};

describe("custom blocks preserved", () => {
  it("renders legacy custom text in roll output", () => {
    const { container } = render(<LayoutRenderer family="roll" invoice={{ lines: [] }} settings={settings} />);
    expect(container.textContent).toContain("نص مخصص هام");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test --prefix client -- customBlocks.test`
Expected: FAIL — custom block text absent (LayoutRenderer ignores legacy custom blocks).

- [ ] **Step 3: Implement the bridge + wire LayoutRenderer**

Create `client/src/components/print/customBlockBridge.js`:
```jsx
import { getCustomBlocks } from "../../pages/settings/CustomTextBlocks";

// Map legacy position -> the block type it should follow in the default order.
const POSITION_AFTER = {
  after_header: "receipt_header_text",
  before_meta: "doc_number",
  after_meta: "cashier",
  before_items: "items_table",
  after_totals: "grand_total",
  before_footer: "footer_text",
};

export function customInserts(settings, family) {
  const blocks = getCustomBlocks(settings) || [];
  return blocks
    .filter(b => !b.paperSizes || b.paperSizes.length === 0 || b.paperSizes.some(sz =>
      family === "roll" ? (sz === "58mm" || sz === "80mm") : (sz === "A4" || sz === "A5")))
    .map(b => ({ after: POSITION_AFTER[b.position] || "footer_text", type: "custom_text", props: { text: b.text, align: b.align, fontSize: b.fontSize, color: b.color } }));
}
```

Modify `LayoutRenderer.jsx`: build the ordered list of `{ type, group, node }`, splicing in custom inserts after their anchor block; for `page`, pass the list to `PageZoneLayout`; for `roll`, render the nodes directly in `RollWrapper`.
```jsx
import React from "react";
import { BLOCK_REGISTRY } from "./blocks/registry";
import { DEFAULT_ORDER } from "./families/defaultOrder";
import RollWrapper from "./families/RollWrapper";
import PageWrapper from "./families/PageWrapper";
import PageZoneLayout from "./families/PageZoneLayout";
import { customInserts } from "./customBlockBridge";

export default function LayoutRenderer({ family = "roll", invoice = {}, settings = {}, layout = null, size = "A4", editing = false }) {
  const famLayout = (layout || settings.layout || {})[family] || {};
  const order = Array.isArray(famLayout.order) && famLayout.order.length ? famLayout.order : DEFAULT_ORDER[family];
  const perBlock = famLayout.perBlock || {};
  const inserts = customInserts(settings, family);

  const items = [];
  let key = 0;
  const pushBlock = (type, extraProps) => {
    const entry = BLOCK_REGISTRY[type];
    if (!entry || !entry.families.includes(family)) return;
    const Block = entry.component;
    const props = { ...(entry.defaultProps || {}), ...(perBlock[type] || {}), ...(extraProps || {}) };
    items.push({ type, group: entry.group, node: <Block key={`${type}-${key++}`} invoice={invoice} settings={settings} props={props} family={family} editing={editing} /> });
  };

  order.forEach((type) => {
    pushBlock(type);
    inserts.filter(ins => ins.after === type).forEach(ins => pushBlock(ins.type, ins.props));
  });

  if (family === "page") {
    return <PageWrapper settings={settings} size={size}><PageZoneLayout items={items} settings={settings} /></PageWrapper>;
  }
  return <RollWrapper settings={settings}>{items.map(it => it.node)}</RollWrapper>;
}
```

- [ ] **Step 4: Run custom-block + page-zone tests**

Run: `npm test --prefix client -- customBlocks.test pageZone.test layoutRenderer.test`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/print/customBlockBridge.js client/src/components/print/LayoutRenderer.jsx client/src/components/print/__tests__/customBlocks.test.jsx
git commit -m "feat(print): interleave legacy custom blocks; page renders via zones"
```

---

## Task 5: Production cutover (shims) + equivalence

**Files:**
- Modify: `client/src/components/print/PrintDoc.jsx`

- [ ] **Step 1: Replace renderer bodies with shims**

In `PrintDoc.jsx` replace the `PrintThermalDoc`/`PrintA4Doc` bodies:
```jsx
import LayoutRenderer from "./LayoutRenderer";
export function PrintThermalDoc({ invoice = {}, settings = {} }) {
  return <LayoutRenderer family="roll" invoice={invoice} settings={settings} layout={settings.layout || null} />;
}
export function PrintA4Doc({ invoice = {}, settings = {}, size = "A4" }) {
  return <LayoutRenderer family="page" invoice={invoice} settings={settings} layout={settings.layout || null} size={size} />;
}
```
Delete the now-dead legacy markup. Keep `import { DEFAULTS, g } from "./blocks/blockUtils";` only if still referenced; otherwise remove.

- [ ] **Step 2: Run characterization snapshots**

Run: `npm test --prefix client -- printThermal.characterization printA4.characterization`
Expected: FAIL with diffs (structure changed even where visually equivalent).

- [ ] **Step 3: Verify equivalence before re-baselining**

Inspect each snapshot diff. Confirm for both roll and page: **same visible text, same numbers, same fields present/absent, same column set, header is two-column on page, totals right-aligned on page.** Only if every diff is cosmetic (attribute order / equivalent styles / wrapper nesting) update the baseline:
Run: `npm test --prefix client -- -u printThermal.characterization printA4.characterization`
Expected: PASS, snapshots updated. If any real content/layout difference exists, fix the block/zone — do NOT update the snapshot.

- [ ] **Step 4: Full client suite**

Run: `npm test --prefix client`
Expected: print suites PASS (pre-existing unrelated failures in Topbar/LoadingSpinner/usePageTour may remain — confirm no NEW failures in print/settings).

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`. Print a POS receipt (80mm) and a sales invoice (A4); compare against a build from before this phase. Verify: identical fields/order/totals, custom text blocks still appear, A4 header is two-column, A4 totals right-aligned.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/print/PrintDoc.jsx client/src/components/print/__tests__/__snapshots__
git commit -m "refactor(print): cut PrintThermalDoc/PrintA4Doc over to LayoutRenderer (output equivalent)"
```

---

## Self-Review notes
- **Spec §3 (page wrapper/zones):** Tasks 1-3.
- **Spec §6 (pipeline cutover):** Tasks 4-5; `PrintPreviewModal` keeps importing `PrintThermalDoc`/`PrintA4Doc`, now zone/registry-backed.
- **Custom blocks preserved:** Task 4 bridge + test (the regression risk that deferred cutover in Phase 1).
- **Roll unaffected:** roll still renders flat via `RollWrapper`.
- Type consistency: `PageZoneLayout` consumes `items: [{ type, group, node }]`; `customInserts(settings, family) -> [{ after, type, props }]`; `LayoutRenderer` builds `items` and branches on `family`. Names align across Tasks 3-5.
- **Deferred to Phase 2:** writing `layout` (order/perBlock/columns) from a real editor + seeding + sync; Phase 1b only *reads* layout defensively (already supported).
```
