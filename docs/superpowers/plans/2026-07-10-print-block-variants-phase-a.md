# Print Block Variants — Phase A (fix fake/blocked roll variants) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every design-variant choice already offered in Print Studio for `items_table`, `report_table`, `payments`, `receiver_signature`, `customer`, `doc_number`, and `image` render visibly differently on roll paper (58mm/80mm), instead of silently falling back to a default look. Also wire up `report_table`'s `cards`/`minimalist-list` variants on page (A4/A5), which are currently dead code there too.

**Architecture:** Each affected block component already receives a `family` prop (`"roll"` or `"page"`) and a `props.variant` string. Today several components only branch on `variant` inside an `if (family === "page")` block, so on roll paper the variant prop is accepted but ignored and the block silently renders its plain default. The fix in every case is additive: add a new roll-specific (or, for `report_table`, page-specific) branch for each affected variant value, styled for the target medium (thermal roll paper is monochrome — pure black borders/text, no `box-shadow`, no color tints; page paper keeps its existing look untouched). No shared abstraction or registry restructuring is needed: variant option lists (`BLOCK_VARIANTS` in `StudioInspector.jsx`) already offer the same value/label set on both families — only the rendering was incomplete.

**Tech Stack:** React 18 function components, inline `style` objects (no CSS modules in this directory), Vitest + `@testing-library/react` for tests (`client/src/components/print/__tests__/`).

## Global Constraints

- Roll (thermal) styling must stay monochrome: no `boxShadow`, no colored fills/tints, no `border-radius` colored backgrounds — only `#000` borders/text and `#fff`/transparent backgrounds (per existing convention seen in `ItemsTableBlock.jsx`'s roll table and `PaymentsBlock.jsx`'s roll stamp).
- Do not change any existing `family === "page"` rendering branch — page output for these 7 blocks is correct today and must stay pixel-identical.
- Do not change `BLOCK_VARIANTS` value/label entries in `StudioInspector.jsx` — only remove the redundant secondary items-table dropdown described in Task 1.
- Tests run from `client/`: `npx vitest run src/components/print/__tests__/<file>`.
- Follow existing code style in each file exactly (inline style objects, no CSS-in-JS libraries, Arabic label strings, RTL-appropriate `justifyContent`/`textAlign`).

---

### Task 1: `items_table` / `report_table` — roll cards & minimalist-list, page report_table wiring

**Files:**
- Modify: `client/src/components/print/blocks/ItemsTableBlock.jsx:56-282` (add roll variant branches; hoist `mergedItemName`)
- Modify: `client/src/components/print/blocks/ReportBlocks.jsx:303-418` (add `cards`/`minimalist-list` branches; extract shared cell-value getter)
- Modify: `client/src/components/print/studio/StudioInspector.jsx:967-978` (remove the redundant page-only secondary "طريقة العرض" dropdown — the main navigator at lines 565-660 already offers these three choices and now works on both families)
- Test: `client/src/components/print/__tests__/itemsTableVariants.test.jsx` (new)
- Test: `client/src/components/print/__tests__/reportTableVariants.test.jsx` (new)

**Interfaces:**
- Consumes: `ItemsTableBlock({ invoice, settings, props, family, editing })`, `ReportTableBlock({ invoice, settings, props, family })` — unchanged signatures.
- Produces: nothing consumed by later tasks (blocks are independent).

- [ ] **Step 1: Write the failing tests**

Create `client/src/components/print/__tests__/itemsTableVariants.test.jsx`:

```jsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ItemsTableBlock from "../blocks/ItemsTableBlock";

const invoice = {
  lines: [
    { product_name: "قميص أبيض", quantity: 2, unit_price: 85, sku: "SH-001" },
    { product_name: "بنطلون جينز", quantity: 1, unit_price: 230, sku: "PA-042" },
  ],
};

describe("ItemsTableBlock roll variants", () => {
  it("standard variant renders a table on roll", () => {
    const { container } = render(
      <ItemsTableBlock invoice={invoice} props={{ variant: "standard" }} family="roll" />
    );
    expect(container.querySelector("table")).not.toBeNull();
  });

  it("cards variant renders no table on roll and shows a dashed separator between items", () => {
    const { container } = render(
      <ItemsTableBlock invoice={invoice} props={{ variant: "cards" }} family="roll" />
    );
    expect(container.querySelector("table")).toBeNull();
    expect(container.innerHTML).toContain("dashed");
    expect(container.textContent).toContain("قميص أبيض");
    expect(container.textContent).toContain("بنطلون جينز");
  });

  it("minimalist-list variant renders no table and no dashed separators on roll", () => {
    const { container } = render(
      <ItemsTableBlock invoice={invoice} props={{ variant: "minimalist-list" }} family="roll" />
    );
    expect(container.querySelector("table")).toBeNull();
    expect(container.innerHTML).not.toContain("dashed");
    expect(container.textContent).toContain("قميص أبيض");
  });

  it("cards and minimalist-list produce different markup from each other on roll", () => {
    const cards = render(
      <ItemsTableBlock invoice={invoice} props={{ variant: "cards" }} family="roll" />
    ).container.innerHTML;
    const minimal = render(
      <ItemsTableBlock invoice={invoice} props={{ variant: "minimalist-list" }} family="roll" />
    ).container.innerHTML;
    expect(cards).not.toBe(minimal);
  });
});
```

Create `client/src/components/print/__tests__/reportTableVariants.test.jsx`:

```jsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ReportTableBlock } from "../blocks/ReportBlocks";

const invoice = {
  rows: [{ "0": "بند أول", "1": "100" }, { "0": "بند ثاني", "1": "50" }],
  columns: ["الوصف", "المبلغ"],
};

describe("ReportTableBlock variants (page)", () => {
  it("standard variant renders a table", () => {
    const { container } = render(
      <ReportTableBlock invoice={invoice} props={{ variant: "standard" }} family="page" />
    );
    expect(container.querySelector("table")).not.toBeNull();
  });

  it("cards variant renders no table and shows both column labels per row", () => {
    const { container } = render(
      <ReportTableBlock invoice={invoice} props={{ variant: "cards" }} family="page" />
    );
    expect(container.querySelector("table")).toBeNull();
    expect(container.textContent).toContain("بند أول");
    expect(container.textContent).toContain("الوصف");
  });

  it("minimalist-list variant renders no table", () => {
    const { container } = render(
      <ReportTableBlock invoice={invoice} props={{ variant: "minimalist-list" }} family="page" />
    );
    expect(container.querySelector("table")).toBeNull();
    expect(container.textContent).toContain("بند أول");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `client/`: `npx vitest run src/components/print/__tests__/itemsTableVariants.test.jsx src/components/print/__tests__/reportTableVariants.test.jsx`
Expected: FAIL — `cards`/`minimalist-list` on roll still render a `<table>` (the roll default), and `ReportTableBlock` always renders a `<table>` regardless of variant.

- [ ] **Step 3: Implement `ItemsTableBlock.jsx` roll variants**

In `client/src/components/print/blocks/ItemsTableBlock.jsx`, move the `mergedItemName` helper (currently defined at line 286, inside the roll section) up so both the page and roll branches can use it. Replace lines 56-58 through the start of the roll section as follows — insert the hoisted helper right after the `cellValign`/`zebraBg`/`textColor` declarations (after line 108) and before `if (family === "page")` (line 110):

```jsx
  const cellValign = props.cellValign || "middle";
  const zebraBg = props.zebraBgColor || "#f8fafc";
  const textColor = props.textColor || "#000";

  // Hoisted so both the page and roll branches can use it.
  const mergedItemName = (line) => {
    const code = codeOf(line);
    const name = nameOf(line);
    return code ? `${code} - ${name}` : name;
  };

  if (family === "roll") {
    const currencySymbol = g(s, "currency_symbol");

    // ── Variant: Cards (stacked block per item, dashed separators) ──
    if (props.variant === "cards") {
      return (
        <div style={{ display: "flex", flexDirection: "column", fontSize, marginBottom: "4px", color: "#000" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ borderTop: i > 0 ? "1px dashed #000" : "none", padding: "3px 0" }}>
              <div style={{ fontWeight: 900 }}>{mergedItemName(line)}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9em" }}>
                <span>{formatPrintDigits(s, String(line.quantity))} × {smartFormat(priceOf(line), s)}</span>
                <span style={{ fontWeight: 900 }}>{smartFormat(lineTotalOf(line), s)} {currencySymbol}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Minimalist List (borderless, one line per item) ──
    if (props.variant === "minimalist-list") {
      return (
        <div style={{ display: "flex", flexDirection: "column", fontSize, marginBottom: "4px", color: "#000" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
              <span>{mergedItemName(line)} ×{formatPrintDigits(s, String(line.quantity))}</span>
              <span style={{ fontWeight: 800 }}>{smartFormat(lineTotalOf(line), s)}</span>
            </div>
          ))}
        </div>
      );
    }
  }

  if (family === "page") {
```

Then delete the original `mergedItemName` definition later in the file (originally at line 286, now shifted — it directly follows the closing `}` of the `if (family === "page") { ... }` block, right before the `// Roll: merge code + name...` comment). Leave the rest of the roll section (the merged-column table, which is now the `standard` roll rendering) unchanged — it's the fallback when neither `cards` nor `minimalist-list` matched above.

- [ ] **Step 4: Implement `ReportBlocks.jsx` — `ReportTableBlock` cards/minimalist-list**

In `client/src/components/print/blocks/ReportBlocks.jsx`, extract the per-cell value getter used inside the `<tbody>` map (lines 391-400) into a standalone function right before the `return (` on line 374, so it can be reused by the new variants:

```jsx
  const cellValue = (row, c) => {
    const def = colDefs[c.key];
    if (scope === "reports_generic") {
      const arr = Array.isArray(row) ? row : Object.values(row);
      return arr[Number(c.key)] || "—";
    }
    if (def) return def.render(row);
    return row[c.key] || "—";
  };

  if (props.variant === "cards") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px", fontSize }}>
        {rows.map((row, i) => (
          <div key={i} style={{
            border: `1px solid ${lineColor}`,
            borderRadius: "8px",
            padding: "8px 12px",
            background: props.zebra !== false && i % 2 === 0 ? zebraBg : "#fff",
            color: textColor,
          }}>
            {cols.map((c) => (
              <div key={c.key} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span style={{ color: "#64748b", fontWeight: 700 }}>{c.label}</span>
                <span style={{ fontWeight: 800 }}>{cellValue(row, c)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (props.variant === "minimalist-list") {
    return (
      <div style={{ display: "flex", flexDirection: "column", fontSize, marginTop: "12px", borderBottom: `1px solid ${lineColor}`, paddingBottom: "6px" }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", padding: "3px 0", borderTop: i > 0 ? `1px dashed ${lineColor}` : "none" }}>
            {cols.map((c) => (
              <span key={c.key} style={{ color: textColor }}>
                <span style={{ color: "#64748b", fontSize: "0.85em" }}>{c.label}: </span>
                <span style={{ fontWeight: 700 }}>{cellValue(row, c)}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize, marginTop: 12, fontWeight: 600 }}>
```

Then simplify the existing `<tbody>` cell computation (lines 391-400) to call the new helper instead of recomputing:

```jsx
            {cols.map((c) => {
              const val = cellValue(row, c);
              const def = colDefs[c.key];
              return (
```

(keep the rest of that `<td>` block — `def` is still used for `def.align` — unchanged).

- [ ] **Step 5: Remove the redundant secondary dropdown**

In `client/src/components/print/studio/StudioInspector.jsx`, delete the `{family === "page" && (...)}` block at lines 969-976 (the `<Row label="طريقة العرض">` dropdown) entirely — the main variant navigator (lines 565-660) already covers `items_table`/`report_table` and now works correctly on both families, so this second control is redundant and could disagree with it.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/components/print/__tests__/itemsTableVariants.test.jsx src/components/print/__tests__/reportTableVariants.test.jsx`
Expected: PASS (all 7 tests).

- [ ] **Step 7: Manual verification**

Run `npm run dev` from repo root, open Print Studio for a POS receipt (`pos_receipt`), switch paper size to 80mm, select the items table block, cycle through "جدول تقليدي" / "كروت منفصلة (فاخر)" / "قائمة مبسطة (هادئ)" — confirm each looks visibly different (grid table / dashed-separated stacked cards / borderless tight list). Repeat at 58mm — confirm it doesn't overflow. Then switch to A4 and repeat — page rendering must look exactly as it did before this change.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/print/blocks/ItemsTableBlock.jsx client/src/components/print/blocks/ReportBlocks.jsx client/src/components/print/studio/StudioInspector.jsx client/src/components/print/__tests__/itemsTableVariants.test.jsx client/src/components/print/__tests__/reportTableVariants.test.jsx
git commit -m "feat(print): real roll-paper cards/minimalist-list variants for items_table, wire up report_table variants on page"
```

---

### Task 2: `payments` — roll table-row & badge-pill

**Files:**
- Modify: `client/src/components/print/blocks/PaymentsBlock.jsx:212-242` (add roll branches for `table-row`/`badge-pill` before the generic roll fallback)
- Test: `client/src/components/print/__tests__/paymentsVariants.test.jsx` (new)

**Interfaces:**
- Consumes: `PaymentsBlock({ invoice, settings, props, family, editing })` — unchanged signature. Uses existing module-level import `HEAVY_VAL` from `./blockUtils` (already imported at line 2) and existing in-scope variables `isRoll`, `currency`, `accent`, `getMethodName`, `renderStamp`, `payments`, `paid`, `grandTotal`, `plan`, `planTotal` (all already defined earlier in the component, lines 25-104).

- [ ] **Step 1: Write the failing test**

Create `client/src/components/print/__tests__/paymentsVariants.test.jsx`:

```jsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PaymentsBlock from "../blocks/PaymentsBlock";

const invoice = {
  payments: [
    { method_name: "نقدي", amount: 150 },
    { method_name: "شبكة", amount: 100 },
  ],
};
const settings = { show_payment_details: true };

describe("PaymentsBlock roll variants", () => {
  it("table-row variant on roll shows a top rule per payment row", () => {
    const { container } = render(
      <PaymentsBlock invoice={invoice} settings={settings} props={{ variant: "table-row" }} family="roll" />
    );
    expect(container.innerHTML).toContain("border-top");
    expect(container.textContent).toContain("نقدي");
    expect(container.textContent).toContain("شبكة");
  });

  it("badge-pill variant on roll shows bordered pill tags", () => {
    const { container } = render(
      <PaymentsBlock invoice={invoice} settings={settings} props={{ variant: "badge-pill" }} family="roll" />
    );
    expect(container.innerHTML).toContain("border-radius");
    expect(container.textContent).toContain("نقدي");
  });

  it("table-row and badge-pill produce different markup on roll", () => {
    const a = render(
      <PaymentsBlock invoice={invoice} settings={settings} props={{ variant: "table-row" }} family="roll" />
    ).container.innerHTML;
    const b = render(
      <PaymentsBlock invoice={invoice} settings={settings} props={{ variant: "badge-pill" }} family="roll" />
    ).container.innerHTML;
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/print/__tests__/paymentsVariants.test.jsx`
Expected: FAIL — roll ignores `variant` entirely today, so `table-row` and `badge-pill` render identical plain-list markup (no `border-top`/`border-radius`).

- [ ] **Step 3: Implement roll branches**

In `client/src/components/print/blocks/PaymentsBlock.jsx`, insert two new branches immediately before the `// roll (thermal)` comment (line 212), gated on `isRoll` and `props.variant`:

```jsx
  if (isRoll && props.variant === "table-row") {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {payments.map((p, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #000", padding: "2px 0" }}>
            <span style={{ fontWeight: 700 }}>{getMethodName(p.method_name)}</span>
            <span style={HEAVY_VAL}>{currency} {smartFormat(p.amount, s)}</span>
          </div>
        ))}
        {paid < grandTotal && plan.length === 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #000", padding: "2px 0" }}>
            <span style={{ fontWeight: 700 }}>المتبقي</span>
            <span style={HEAVY_VAL}>{currency} {smartFormat(grandTotal - paid, s)}</span>
          </div>
        )}
        {plan.length > 0 && (
          <div style={{ marginTop: "5px" }}>
            <div style={{ fontWeight: 700, marginBottom: "2px" }}>جدول الأقساط ({plan.length}):</div>
            {plan.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #000", padding: "2px 0" }}>
                <span style={{ fontWeight: 700 }}>قسط {r.installment_no ?? i + 1} <span dir="ltr">{fmtDate(r.due_date)}</span></span>
                <span dir="ltr" style={HEAVY_VAL}>{currency} {smartFormat(r.amount, s)}</span>
              </div>
            ))}
          </div>
        )}
        {renderStamp()}
      </div>
    );
  }

  if (isRoll && props.variant === "badge-pill") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {payments.map((p, i) => (
          <span key={i} style={{ border: "1px solid #000", borderRadius: "10px", padding: "1px 8px", fontSize: "0.9em", fontWeight: 800 }}>
            {getMethodName(p.method_name)}: {currency} {smartFormat(p.amount, s)}
          </span>
        ))}
        {paid < grandTotal && plan.length === 0 && (
          <span style={{ border: "1px dashed #000", borderRadius: "10px", padding: "1px 8px", fontSize: "0.9em", fontWeight: 800 }}>
            متبقي: {currency} {smartFormat(grandTotal - paid, s)}
          </span>
        )}
        {renderStamp()}
      </div>
    );
  }

  // roll (thermal)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/print/__tests__/paymentsVariants.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Manual verification**

In Print Studio, open a POS receipt at 80mm, select the payments block, cycle to "صفوف الجدول الموزعة" (table-row) and "كبسولات ملونة" (badge-pill) — confirm distinct visual treatments (ruled rows vs. bordered pill tags), and confirm "ختم الحالة" (status-stamp, already working) and default are unaffected. Repeat at A4 — page rendering unchanged.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/print/blocks/PaymentsBlock.jsx client/src/components/print/__tests__/paymentsVariants.test.jsx
git commit -m "feat(print): real roll-paper table-row/badge-pill variants for payments block"
```

---

### Task 3: `receiver_signature` — roll split

**Files:**
- Modify: `client/src/components/print/blocks/ReceiverSignatureBlock.jsx:114` (extend the `split` condition to also handle roll, with a narrow-width-safe layout)
- Test: `client/src/components/print/__tests__/receiverSignatureVariants.test.jsx` (new)

**Interfaces:**
- Consumes: `ReceiverSignatureBlock({ settings, props, family, editing })` — unchanged. Uses in-scope `label`, `showName`, `showId`, `showDate`, `headingSize`, `borderColor`, `BlankLine` (already defined earlier in the component, lines 33-79).

- [ ] **Step 1: Write the failing test**

Create `client/src/components/print/__tests__/receiverSignatureVariants.test.jsx`:

```jsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ReceiverSignatureBlock from "../blocks/ReceiverSignatureBlock";

const settings = { show_receiver_signature: true };

describe("ReceiverSignatureBlock split variant", () => {
  it("renders a two-column grid on page", () => {
    const { container } = render(
      <ReceiverSignatureBlock settings={settings} props={{ variant: "split" }} family="page" />
    );
    expect(container.innerHTML).toContain("grid-template-columns");
  });

  it("renders a two-column grid on roll too (not the plain stacked fallback)", () => {
    const { container } = render(
      <ReceiverSignatureBlock settings={settings} props={{ variant: "split" }} family="roll" />
    );
    expect(container.innerHTML).toContain("grid-template-columns");
  });

  it("standard variant on roll has no grid", () => {
    const { container } = render(
      <ReceiverSignatureBlock settings={settings} props={{ variant: "standard" }} family="roll" />
    );
    expect(container.innerHTML).not.toContain("grid-template-columns");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/print/__tests__/receiverSignatureVariants.test.jsx`
Expected: FAIL on the second test — today `variant === "split" && family === "page"` excludes roll, so roll falls through to the plain stacked layout (no grid).

- [ ] **Step 3: Implement the roll-safe split layout**

In `client/src/components/print/blocks/ReceiverSignatureBlock.jsx`, replace line 114's condition:

```jsx
  if (variant === "split") {
    return (
      <div style={wrapStyle}>
        {label && (
          <div style={{
            fontSize: headingSize,
            fontWeight: 900,
            color: borderColor,
            textAlign: "center",
            letterSpacing: "0.3px",
            marginBottom: "8px",
          }}>
            {label}
          </div>
        )}
        <div style={{
          display: "grid",
          gridTemplateColumns: isRoll ? "1fr" : "1fr 1fr",
          gap: isRoll ? "4px" : "12px",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: isRoll ? "1fr 1fr" : "1fr", gap: isRoll ? "8px" : "0" }}>
            {showName && <BlankLine text="الاسم" />}
            {showId   && <BlankLine text="رقم الهوية" />}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isRoll ? "1fr 1fr" : "1fr", gap: isRoll ? "8px" : "0" }}>
            {showDate && <BlankLine text="التاريخ" />}
            <BlankLine text="التوقيع" />
          </div>
        </div>
      </div>
    );
  }
```

(This keeps the exact page rendering — outer grid is still `1fr 1fr` with `12px` gap and each inner group stacks single-column when `family === "page"` — while roll gets a single-column outer stack with each pair (name/id, date/signature) laid out as its own compact 2-column row so labels don't collide at 48-72mm printable width.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/print/__tests__/receiverSignatureVariants.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Manual verification**

In Print Studio at 58mm, select receiver-signature block, choose "توزيع ثنائي متقابل" (split) — confirm the two-column grouping stays inside the printable band without overlapping text, distinct from "افتراضي متسلسل" (standard, stacked) and "صندوق توقيع مغلق" (boxed). Repeat at 80mm and A4 (A4 must render exactly as before).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/print/blocks/ReceiverSignatureBlock.jsx client/src/components/print/__tests__/receiverSignatureVariants.test.jsx
git commit -m "feat(print): real roll-paper split variant for receiver_signature block"
```

---

### Task 4: `customer` — roll two-column

**Files:**
- Modify: `client/src/components/print/blocks/CustomerBlock.jsx:116` (split `two-column` out of the shared `boxed` branch on roll into its own compact paired-line layout)
- Test: `client/src/components/print/__tests__/customerVariants.test.jsx` (new)

**Interfaces:**
- Consumes: `CustomerBlock({ invoice, settings, props, family, editing })` — unchanged. Uses in-scope `label`, `name`, `phone`, `address`, `taxId`, `balance`, `points`, `showPhone`, `showAddress`, `showTaxId`, `showBalance`, `showPoints`, `currency` (already defined earlier in the component, lines 14-32). Requires `smartFormat` — check the top of the file: it's referenced at lines 55/78/107/144/etc. but not currently imported at the top (only `g` is imported at line 2); the roll `boxed`/`two-column` branch already calls `smartFormat` today, so it must already resolve via some existing import — confirm by checking line 2 of the file before writing this task's diff; if missing, add `smartFormat` to the `./blockUtils` import.

- [ ] **Step 1: Confirm the `smartFormat` import**

Run: `grep -n "^import" client/src/components/print/blocks/CustomerBlock.jsx`
If `smartFormat` is not already imported from `./blockUtils`, change line 2 from `import { g } from "./blockUtils";` to `import { g, smartFormat } from "./blockUtils";` before proceeding (this is pre-existing behavior being preserved, not new — the new roll `two-column` branch below also needs it).

- [ ] **Step 2: Write the failing test**

Create `client/src/components/print/__tests__/customerVariants.test.jsx`:

```jsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import CustomerBlock from "../blocks/CustomerBlock";

const invoice = { customer_name: "أحمد محمد", customer_phone: "0501234567" };
const settings = { show_customer_name: true };

describe("CustomerBlock two-column variant on roll", () => {
  it("boxed variant on roll renders a bordered box", () => {
    const { container } = render(
      <CustomerBlock invoice={invoice} settings={settings} props={{ variant: "boxed", showPhone: true }} family="roll" />
    );
    expect(container.innerHTML).toContain("border");
  });

  it("two-column variant on roll pairs name and phone on the same line, distinct from boxed", () => {
    const boxed = render(
      <CustomerBlock invoice={invoice} settings={settings} props={{ variant: "boxed", showPhone: true }} family="roll" />
    ).container.innerHTML;
    const twoCol = render(
      <CustomerBlock invoice={invoice} settings={settings} props={{ variant: "two-column", showPhone: true }} family="roll" />
    ).container.innerHTML;
    expect(twoCol).not.toBe(boxed);
    expect(twoCol).toContain("flex-wrap");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/print/__tests__/customerVariants.test.jsx`
Expected: FAIL on the second test — today `variant === "boxed" || variant === "two-column"` (line 116) produces byte-identical markup for both values on roll.

- [ ] **Step 4: Implement the roll two-column layout**

In `client/src/components/print/blocks/CustomerBlock.jsx`, change line 116 from:

```jsx
  if (variant === "boxed" || variant === "two-column") {
```

to:

```jsx
  if (variant === "boxed") {
```

Then insert a new block immediately after that `if (variant === "boxed") { ... }` block closes (right before the final fallback `return (` on line 157), for the `two-column` case:

```jsx
  if (variant === "two-column") {
    const pairs = [
      [label || "العميل", name],
      showPhone && phone ? ["الهاتف", phone] : null,
      showAddress && address ? ["العنوان", address] : null,
      showTaxId && taxId ? ["الرقم الضريبي", taxId] : null,
      showBalance && balance !== undefined ? ["الرصيد", `${currency} ${smartFormat(balance, s)}`] : null,
      showPoints && points !== undefined ? ["النقاط", String(points)] : null,
    ].filter(Boolean);
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: "10px" }}>
        {pairs.map(([k, v]) => (
          <span key={k}>
            <span style={{ fontWeight: 700 }}>{k}: </span>
            <span>{v}</span>
          </span>
        ))}
      </div>
    );
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/print/__tests__/customerVariants.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Manual verification**

In Print Studio at 58mm and 80mm, select the customer block, choose "تقسيم لعمودين متقابلين" (two-column) with phone enabled — confirm label:value pairs wrap onto the line(s) as tight tags rather than a bordered box, distinct from "صندوق بيانات العميل" (boxed). Confirm A4 rendering (real CSS grid) is unchanged.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/print/blocks/CustomerBlock.jsx client/src/components/print/__tests__/customerVariants.test.jsx
git commit -m "feat(print): real roll-paper two-column variant for customer block"
```

---

### Task 5: `doc_number` — roll giant

**Files:**
- Modify: `client/src/components/print/blocks/DocNumberBlock.jsx:86` (split `giant` out of the shared `boxed` branch on roll into a large centered treatment)
- Test: `client/src/components/print/__tests__/docNumberVariants.test.jsx` (new)

**Interfaces:**
- Consumes: `DocNumberBlock({ invoice, settings, props, family, editing })` — unchanged. Uses in-scope `no`, `showLabel`, `rollLabel` (already defined at lines 25-26/83).

- [ ] **Step 1: Write the failing test**

Create `client/src/components/print/__tests__/docNumberVariants.test.jsx`:

```jsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DocNumberBlock from "../blocks/DocNumberBlock";

const invoice = { invoice_no: "INV-2026-0001" };

describe("DocNumberBlock giant variant on roll", () => {
  it("boxed variant on roll renders a border", () => {
    const { container } = render(
      <DocNumberBlock invoice={invoice} props={{ variant: "boxed" }} family="roll" />
    );
    expect(container.innerHTML).toContain("border");
  });

  it("giant variant on roll renders a large centered number, distinct from boxed", () => {
    const boxed = render(
      <DocNumberBlock invoice={invoice} props={{ variant: "boxed" }} family="roll" />
    ).container.innerHTML;
    const giant = render(
      <DocNumberBlock invoice={invoice} props={{ variant: "giant" }} family="roll" />
    ).container.innerHTML;
    expect(giant).not.toBe(boxed);
    expect(giant).toContain("INV-2026-0001");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/print/__tests__/docNumberVariants.test.jsx`
Expected: FAIL on the second test — today `variant === "boxed" || variant === "giant"` (line 86) produces identical markup on roll.

- [ ] **Step 3: Implement the roll giant treatment**

In `client/src/components/print/blocks/DocNumberBlock.jsx`, change line 86 from:

```jsx
  if (variant === "boxed" || variant === "giant") {
```

to:

```jsx
  if (variant === "boxed") {
```

Then insert a new block immediately after that block closes (right before the final fallback `return (` on line 95):

```jsx
  if (variant === "giant") {
    return (
      <div style={{ textAlign: "center", margin: "6px 0", borderBottom: "1px dashed #000", paddingBottom: "4px" }}>
        {showLabel && rollLabel && <div style={{ fontSize: "9px", fontWeight: 700 }}>{rollLabel}</div>}
        <div style={{ fontSize: "18px", fontWeight: 900, fontFamily: "monospace" }}>{no}</div>
      </div>
    );
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/print/__tests__/docNumberVariants.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Manual verification**

In Print Studio at 58mm/80mm, select the doc-number block, choose "رقم ضخم أعلى المستند" (giant) — confirm a large centered number distinct from "صندوق بارز ملون" (boxed) and "رقم مدمج مبسط" (inline). Confirm A4 rendering unchanged.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/print/blocks/DocNumberBlock.jsx client/src/components/print/__tests__/docNumberVariants.test.jsx
git commit -m "feat(print): real roll-paper giant variant for doc_number block"
```

---

### Task 6: `image` — thermal-safe card & banner

**Files:**
- Modify: `client/src/components/print/blocks/ImageBlock.jsx:50-75` (make `card`/`banner` styling family-aware: no shadow on roll, use double-border/dashed-rule instead)
- Test: `client/src/components/print/__tests__/imageVariants.test.jsx` (new)

**Interfaces:**
- Consumes: `ImageBlock({ props, family, editing })` — unchanged signature.

- [ ] **Step 1: Write the failing test**

Create `client/src/components/print/__tests__/imageVariants.test.jsx`:

```jsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ImageBlock from "../blocks/ImageBlock";

const props = { src: "/uploads/logo.png" };

describe("ImageBlock roll-safe card/banner variants", () => {
  it("standard variant on roll has no box-shadow and no border", () => {
    const { container } = render(<ImageBlock props={{ ...props, variant: "standard" }} family="roll" />);
    const img = container.querySelector("img");
    expect(img.style.boxShadow).toBe("none");
  });

  it("card variant on roll uses a double border instead of a shadow", () => {
    const { container } = render(<ImageBlock props={{ ...props, variant: "card" }} family="roll" />);
    const img = container.querySelector("img");
    expect(img.style.boxShadow).toBe("none");
    expect(img.style.border).toContain("double");
  });

  it("banner variant on roll uses dashed top/bottom rules instead of a shadow", () => {
    const { container } = render(<ImageBlock props={{ ...props, variant: "banner" }} family="roll" />);
    const img = container.querySelector("img");
    expect(img.style.boxShadow).toBe("none");
    expect(img.style.borderTop).toContain("dashed");
    expect(img.style.borderBottom).toContain("dashed");
  });

  it("card variant on page keeps the existing shadow", () => {
    const { container } = render(<ImageBlock props={{ ...props, variant: "card" }} family="page" />);
    const img = container.querySelector("img");
    expect(img.style.boxShadow).not.toBe("none");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/print/__tests__/imageVariants.test.jsx`
Expected: FAIL — today `shadow`/`borderRadius`/`borderColor` are computed purely from `variant`, with no `family` branching, so `card`/`banner` carry the same (ineffective-on-thermal) `boxShadow` on roll as they do on page.

- [ ] **Step 3: Implement family-aware styling**

In `client/src/components/print/blocks/ImageBlock.jsx`, replace lines 54-75:

```jsx
  const borderWidth = props.borderWidth != null ? Number(props.borderWidth) : (variant === "card" ? 1 : 0);
  const borderStyle = props.borderStyle || "solid";
  const borderColor = props.borderColor || (variant === "card" ? "#e2e8f0" : "#000");
  const borderRadius = props.borderRadius != null ? Number(props.borderRadius) : (variant === "card" ? 8 : variant === "banner" ? 4 : 0);
  const shadow = props.shadow || (variant === "card" ? "md" : "none");
  const shadowMap = {
    none: "none",
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px rgba(0,0,0,0.1)",
    lg: "0 10px 15px rgba(0,0,0,0.15)"
  };

  const imgStyle = {
    maxHeight: `${maxHeight}px`,
    objectFit: variant === "banner" ? "cover" : "contain",
    display: "block",
    ...(variant === "banner" ? { width: "100%" } : {}),
    ...(variant === "card" ? { padding: "4px", background: "#fff" } : {}),
    ...(borderWidth > 0 ? { border: `${borderWidth}px ${borderStyle} ${borderColor}` } : {}),
    ...(borderRadius > 0 ? { borderRadius: `${borderRadius}px` } : {}),
    boxShadow: shadowMap[shadow] || "none"
  };
```

with:

```jsx
  const isRoll = family === "roll";

  // Thermal heads can't render box-shadow (1-bit, no grayscale) — roll
  // substitutes a double border ("card") or dashed top/bottom rules
  // ("banner") for the elevation effect page paper gets via shadow.
  const borderWidth = props.borderWidth != null
    ? Number(props.borderWidth)
    : (isRoll ? (variant === "card" ? 3 : 0) : (variant === "card" ? 1 : 0));
  const borderStyle = props.borderStyle || (isRoll && variant === "card" ? "double" : "solid");
  const borderColor = props.borderColor || (isRoll ? "#000" : (variant === "card" ? "#e2e8f0" : "#000"));
  const borderRadius = props.borderRadius != null
    ? Number(props.borderRadius)
    : (isRoll ? 0 : (variant === "card" ? 8 : variant === "banner" ? 4 : 0));
  const shadow = isRoll ? "none" : (props.shadow || (variant === "card" ? "md" : "none"));
  const shadowMap = {
    none: "none",
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px rgba(0,0,0,0.1)",
    lg: "0 10px 15px rgba(0,0,0,0.15)"
  };

  const imgStyle = {
    maxHeight: `${maxHeight}px`,
    objectFit: variant === "banner" ? "cover" : "contain",
    display: "block",
    ...(variant === "banner" ? { width: "100%" } : {}),
    ...(variant === "card" && !isRoll ? { padding: "4px", background: "#fff" } : {}),
    ...(borderWidth > 0 ? { border: `${borderWidth}px ${borderStyle} ${borderColor}` } : {}),
    ...(isRoll && variant === "banner" ? { borderTop: "1px dashed #000", borderBottom: "1px dashed #000" } : {}),
    ...(borderRadius > 0 ? { borderRadius: `${borderRadius}px` } : {}),
    boxShadow: shadowMap[shadow] || "none"
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/print/__tests__/imageVariants.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Manual verification**

In Print Studio at 58mm/80mm with an uploaded logo, select the image block, choose "كرت بحدود وظل" (card) — confirm a double black border with no shadow — and "بنر ممتد بالكامل" (banner) — confirm dashed top/bottom rules with no shadow. Confirm A4/A5 rendering (border + real shadow) is unchanged.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/print/blocks/ImageBlock.jsx client/src/components/print/__tests__/imageVariants.test.jsx
git commit -m "feat(print): thermal-safe card/banner variants for image block on roll paper"
```

---

## Self-Review Notes

- **Spec coverage:** All 7 Phase A blocks from the spec (`items_table`, `report_table`, `payments`, `receiver_signature`, `customer`, `doc_number`, `image`) have a task. The redundant secondary items-table dropdown removal (spec's data-model note) is folded into Task 1, Step 5.
- **No `BLOCK_VARIANTS` restructuring needed:** confirmed during planning that no block in this phase needs a different value/label set between roll and page — only the underlying rendering was incomplete — so the `{roll, page}` object-shape data model proposed in the design spec is unnecessary here and is dropped. It may still be needed in Phase C for any block whose available choices genuinely must differ; re-evaluate there if that arises.
- **Type/signature consistency:** every task keeps each component's existing prop signature (`{ invoice, settings, props, family, editing }` or subsets) unchanged — no call-site updates required anywhere else in the codebase.
