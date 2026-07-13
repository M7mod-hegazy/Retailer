# Price Health Input Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the POS and Sales Return price inputs a discreet, color-coded "health" signal (loss / thin margin / unusually high / healthy) plus a tiny hover/focus hint showing the cost or original-paid figure, without exposing sensitive numbers to anyone glancing at the screen.

**Architecture:** One shared pure-logic module (`client/src/utils/priceHealth.js`) computes a `level` from price + a reference value. POS uses `getMarginHealth(price, cost, listPrice)`; Sales Return uses `getRefundHealth(price, originalPrice)` — same output shape (`{ level, diffFlat, diffPct }`), different comparison direction. A new small component (`PriceHealthHint.jsx`) wraps an input and shows a muted, tiny label only on focus/hover — used only where the app doesn't already show the comparison value permanently. Four existing render call sites (2 in POS, 2 in Sales Return) are updated to consume this logic; each site keeps its own existing visual idiom (CSS `.entry-control` modifier classes vs. plain Tailwind utility classes) rather than forcing one visual system everywhere.

**Tech Stack:** React 18 (JSX), Tailwind CSS, plain CSS custom properties (theme tokens) in `client/src/index.css`, Vitest + `@testing-library/react` for tests.

## Global Constraints

- Margin thresholds (from the approved spec): **loss** = price ≤ cost; **thin** = 0% < margin < 10%; **healthy** = margin ≥ 10%; **high** (POS only) = price > listPrice × 1.3.
- Refund thresholds: **loss** = refund > 10% over what the customer paid; **thin** = 0–10% over; **healthy** = at or below what was paid.
- The literal cost figure in POS hints is gated behind the existing `canViewProfit` permission (from `usePermission("pos", "profit")`); the color signal is shown to everyone regardless of permission.
- Sales Return needs no permission gate — the original sale price is not proprietary data, it's what's already printed on the customer's receipt.
- Only these 4 render sites are in scope: POS entry-bar price input, POS cart-grid `unitPrice` cell, Sales Return staging price input (direct mode), Sales Return cart-grid return-price cell (direct mode). `POSDetailedView.jsx` and Sales Return "invoice" mode are explicitly out of scope (no editable price input exists there).
- Full spec: `docs/superpowers/specs/2026-07-13-price-health-input-hints-design.md`.

---

### Task 1: Shared price-health logic module

**Files:**
- Create: `client/src/utils/priceHealth.js`
- Test: `client/src/utils/__tests__/priceHealth.test.js`

**Interfaces:**
- Produces: `getMarginHealth(price, cost, listPrice) → { level: "loss"|"high"|"thin"|"healthy"|"neutral", diffFlat: number|null, diffPct: number|null }`
- Produces: `getRefundHealth(price, originalPrice) → { level: "loss"|"thin"|"healthy"|"neutral", diffFlat: number|null, diffPct: number|null }` (never returns `"high"`)
- Produces: `HEALTH_BORDER_CLASSES` — `{ loss, high, thin, healthy, neutral }` map of Tailwind utility strings, for plain (non-`.entry-control`) inputs.
- Produces: `ENTRY_HEALTH_CLASSES` — `{ loss, high, thin, healthy, neutral }` map of CSS class names, for inputs using the `.entry-control` base class.

- [ ] **Step 1: Write the failing tests**

Create `client/src/utils/__tests__/priceHealth.test.js`:

```js
import { describe, it, expect } from "vitest";
import { getMarginHealth, getRefundHealth, HEALTH_BORDER_CLASSES, ENTRY_HEALTH_CLASSES } from "../priceHealth";

describe("getMarginHealth", () => {
  it("is neutral when cost is unknown", () => {
    expect(getMarginHealth(100, 0, 100).level).toBe("neutral");
  });
  it("is neutral when price is zero", () => {
    expect(getMarginHealth(0, 50, 100).level).toBe("neutral");
  });
  it("flags loss when price equals cost", () => {
    expect(getMarginHealth(50, 50, 100).level).toBe("loss");
  });
  it("flags loss when price is below cost", () => {
    expect(getMarginHealth(40, 50, 100).level).toBe("loss");
  });
  it("flags thin margin just under the 10% band", () => {
    const r = getMarginHealth(54, 50, 100); // margin = 8%
    expect(r.level).toBe("thin");
    expect(r.diffPct).toBeCloseTo(8, 5);
  });
  it("is healthy at exactly 10% margin", () => {
    expect(getMarginHealth(55, 50, 100).level).toBe("healthy");
  });
  it("is healthy well above the thin band", () => {
    expect(getMarginHealth(80, 50, 100).level).toBe("healthy");
  });
  it("flags high when price exceeds list price by more than 30%", () => {
    expect(getMarginHealth(131, 50, 100).level).toBe("high");
  });
  it("is not high at exactly 30% over list price", () => {
    expect(getMarginHealth(130, 50, 100).level).toBe("healthy");
  });
  it("reports margin figures for a high price when cost is known", () => {
    const r = getMarginHealth(140, 50, 100);
    expect(r.level).toBe("high");
    expect(r.diffFlat).toBe(90);
  });
  it("is high even when cost is unknown, with null margin figures", () => {
    const r = getMarginHealth(140, 0, 100);
    expect(r.level).toBe("high");
    expect(r.diffFlat).toBeNull();
    expect(r.diffPct).toBeNull();
  });
});

describe("getRefundHealth", () => {
  it("is neutral when original price is unknown", () => {
    expect(getRefundHealth(50, 0).level).toBe("neutral");
  });
  it("is neutral when entered price is zero", () => {
    expect(getRefundHealth(0, 50).level).toBe("neutral");
  });
  it("is healthy when refunding exactly what was paid", () => {
    expect(getRefundHealth(50, 50).level).toBe("healthy");
  });
  it("is healthy when refunding less than what was paid", () => {
    expect(getRefundHealth(40, 50).level).toBe("healthy");
  });
  it("flags thin just over what was paid", () => {
    expect(getRefundHealth(54, 50).level).toBe("thin"); // +8%
  });
  it("is exactly at the 10% boundary -> thin, not loss", () => {
    expect(getRefundHealth(55, 50).level).toBe("thin"); // +10%
  });
  it("flags loss when refunding more than 10% over what was paid", () => {
    expect(getRefundHealth(56, 50).level).toBe("loss"); // +12%
  });
  it("never returns 'high'", () => {
    expect(getRefundHealth(1000, 50).level).not.toBe("high");
  });
});

describe("style maps", () => {
  it("HEALTH_BORDER_CLASSES has an entry for every level", () => {
    for (const level of ["loss", "high", "thin", "healthy", "neutral"]) {
      expect(HEALTH_BORDER_CLASSES).toHaveProperty(level);
    }
  });
  it("ENTRY_HEALTH_CLASSES has an entry for every level", () => {
    for (const level of ["loss", "high", "thin", "healthy", "neutral"]) {
      expect(ENTRY_HEALTH_CLASSES).toHaveProperty(level);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --prefix client -- priceHealth`
Expected: FAIL — `Failed to resolve import "../priceHealth"` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `client/src/utils/priceHealth.js`:

```js
// Selling context (POS): is the price a healthy margin over cost?
export function getMarginHealth(price, cost, listPrice) {
  const p = Number(price) || 0;
  const c = Number(cost) || 0;
  const list = Number(listPrice) || 0;

  if (list > 0 && p > list * 1.3) {
    return {
      level: "high",
      diffFlat: c > 0 ? p - c : null,
      diffPct: c > 0 ? ((p - c) / c) * 100 : null,
    };
  }

  if (c <= 0 || p <= 0) return { level: "neutral", diffFlat: null, diffPct: null };

  const diffFlat = p - c;
  const diffPct = (diffFlat / c) * 100;
  if (p <= c) return { level: "loss", diffFlat, diffPct };
  if (diffPct < 10) return { level: "thin", diffFlat, diffPct };
  return { level: "healthy", diffFlat, diffPct };
}

// Refund context (Sales Return): is the refund safe relative to what the customer actually paid?
export function getRefundHealth(price, originalPrice) {
  const p = Number(price) || 0;
  const orig = Number(originalPrice) || 0;
  if (orig <= 0 || p <= 0) return { level: "neutral", diffFlat: null, diffPct: null };

  const diffFlat = p - orig;
  const diffPct = (diffFlat / orig) * 100;
  if (diffPct > 10) return { level: "loss", diffFlat, diffPct };
  if (diffPct > 0) return { level: "thin", diffFlat, diffPct };
  return { level: "healthy", diffFlat, diffPct };
}

// For plain Tailwind inputs (no .entry-control base class), e.g. DataGrid/table cells.
export const HEALTH_BORDER_CLASSES = {
  loss: "border-rose-400 bg-rose-50",
  high: "border-sky-400 bg-sky-50",
  thin: "border-amber-400 bg-amber-50",
  healthy: "",
  neutral: "",
};

// For inputs using the .entry-control base class (needs !important to win, see index.css).
export const ENTRY_HEALTH_CLASSES = {
  loss: "entry-control--error",
  high: "entry-control--info",
  thin: "entry-control--warning",
  healthy: "",
  neutral: "",
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix client -- priceHealth`
Expected: PASS (19 tests)

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/priceHealth.js client/src/utils/__tests__/priceHealth.test.js
git commit -m "feat(pricing): add shared price-health logic for POS and sales return"
```

---

### Task 2: Discreet hover/focus hint component

**Files:**
- Create: `client/src/components/ui/PriceHealthHint.jsx`
- Test: `client/src/components/ui/__tests__/PriceHealthHint.test.jsx`

**Interfaces:**
- Consumes: nothing from Task 1 directly (just a `label: string|null` prop) — kept decoupled so it's reusable for any discreet-reveal case, not just price health.
- Produces: `<PriceHealthHint label={string|null}>{children}</PriceHealthHint>` — default export. When `label` is falsy, renders `children` with no wrapper. When truthy, wraps `children` in a positioned container and shows a tiny muted label on focus or hover (hides on blur/mouse-leave).

- [ ] **Step 1: Write the failing tests**

Create `client/src/components/ui/__tests__/PriceHealthHint.test.jsx`:

```jsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PriceHealthHint from "../PriceHealthHint";

describe("PriceHealthHint", () => {
  it("renders children directly with no tooltip markup when label is falsy", () => {
    const { container } = render(
      <PriceHealthHint label={null}><input aria-label="price" /></PriceHealthHint>
    );
    expect(screen.getByLabelText("price")).toBeInTheDocument();
    expect(container.querySelectorAll("span").length).toBe(0);
  });

  it("shows the label text on focus and hides it on blur", () => {
    render(
      <PriceHealthHint label="ت 18.00 · +7.00"><input aria-label="price" /></PriceHealthHint>
    );
    expect(screen.queryByText("ت 18.00 · +7.00")).not.toBeInTheDocument();
    fireEvent.focus(screen.getByLabelText("price"));
    expect(screen.getByText("ت 18.00 · +7.00")).toBeInTheDocument();
    fireEvent.blur(screen.getByLabelText("price"));
    expect(screen.queryByText("ت 18.00 · +7.00")).not.toBeInTheDocument();
  });

  it("shows the label text on mouse hover and hides it on mouse leave", () => {
    render(
      <PriceHealthHint label="ت 18.00"><input aria-label="price" /></PriceHealthHint>
    );
    const wrapper = screen.getByLabelText("price").parentElement;
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByText("ت 18.00")).toBeInTheDocument();
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByText("ت 18.00")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --prefix client -- PriceHealthHint`
Expected: FAIL — `Failed to resolve import "../PriceHealthHint"` (component doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `client/src/components/ui/PriceHealthHint.jsx`:

```jsx
import { useState } from "react";

export default function PriceHealthHint({ label, children }) {
  const [show, setShow] = useState(false);

  if (!label) return children;

  return (
    <div
      className="relative w-full"
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className="pointer-events-none absolute -bottom-4 inset-x-0 z-20 truncate rounded border border-slate-100 bg-white/95 px-1 py-0.5 text-center text-[9px] font-bold leading-none text-slate-400"
        >
          {label}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix client -- PriceHealthHint`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ui/PriceHealthHint.jsx client/src/components/ui/__tests__/PriceHealthHint.test.jsx
git commit -m "feat(ui): add PriceHealthHint discreet focus/hover label component"
```

---

### Task 3: CSS modifier classes for `.entry-control` inputs

**Files:**
- Modify: `client/src/index.css:729-742` (add transition to `.entry-control` base rule), `client/src/index.css:821` (add two new modifier rules after `.entry-control--error`)

**Interfaces:**
- Consumes: nothing (pure CSS).
- Produces: CSS classes `.entry-control--warning` and `.entry-control--info`, consumed by Task 4 and Task 6 via `ENTRY_HEALTH_CLASSES` from Task 1.

- [ ] **Step 1: Confirm current state**

Read `client/src/index.css` lines 725-825 and confirm the `.entry-control` rule (no `transition` property) and `.entry-control--error { border-color: var(--danger) !important; }` still match what's quoted below. If line numbers drifted, locate by content instead of line number.

- [ ] **Step 2: Add a border-color transition to `.entry-control`**

In `client/src/index.css`, find:

```css
  .entry-control {
    height: 38px;
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--border-normal);
    border-radius: 6px;
    background: var(--bg-input);
    padding: 0 0.5rem;
    font-size: 0.8125rem;
    font-weight: 800;
    color: var(--text-primary);
    box-shadow: var(--input-well);
    outline: none;
  }
```

Replace with (added `transition` line only):

```css
  .entry-control {
    height: 38px;
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--border-normal);
    border-radius: 6px;
    background: var(--bg-input);
    padding: 0 0.5rem;
    font-size: 0.8125rem;
    font-weight: 800;
    color: var(--text-primary);
    box-shadow: var(--input-well);
    outline: none;
    transition: border-color 150ms ease;
  }
```

- [ ] **Step 3: Add the two new modifier rules**

Find:

```css
  .entry-control--error { border-color: var(--danger) !important; }
```

Replace with:

```css
  .entry-control--error { border-color: var(--danger) !important; }
  .entry-control--warning { border-color: var(--warning-border) !important; }
  .entry-control--info { border-color: var(--info-border) !important; }
```

- [ ] **Step 4: Verify no CSS build errors**

Run: `npm run dev:client --prefix .` from the repo root is not needed for a plain CSS syntax check — instead run the client build to catch syntax errors: `npm run build --prefix client`
Expected: build succeeds (exit code 0), no PostCSS/Tailwind errors mentioning `index.css`.

- [ ] **Step 5: Commit**

```bash
git add client/src/index.css
git commit -m "style: add warning/info entry-control modifiers and border transition"
```

---

### Task 4: Wire the POS entry-bar price input

**Files:**
- Modify: `client/src/pages/pos/POSListView.jsx` (imports near line 1-30, and the price field JSX at ~line 1199-1206)

**Interfaces:**
- Consumes: `getMarginHealth` and `ENTRY_HEALTH_CLASSES` from `client/src/utils/priceHealth.js` (Task 1); `PriceHealthHint` from `client/src/components/ui/PriceHealthHint.jsx` (Task 2).

- [ ] **Step 1: Add the imports**

In `client/src/pages/pos/POSListView.jsx`, near the other `components/ui` imports (around line 17-24), add:

```js
import PriceHealthHint from "../../components/ui/PriceHealthHint";
import { getMarginHealth, ENTRY_HEALTH_CLASSES } from "../../utils/priceHealth";
```

- [ ] **Step 2: Locate and confirm the current price field**

Find this block (confirm it still matches; if the surrounding JSX shifted, locate by the `entry-field--price` class and `listPriceRef`):

```jsx
                <input ref={listPriceRef} type="number" step="any" value={staging.unitPrice}
                  onChange={(e) => canOverridePrice && setStaging(s => ({ ...s, unitPrice: e.target.value }))}
                  onFocus={e => canOverridePrice && e.target.select()}
                  onKeyDown={(e) => handleListFieldKeyDown(e, listDiscRef, listQtyRef)}
                  readOnly={!canOverridePrice}
                  title={!canOverridePrice ? "لا تملك صلاحية تعديل السعر" : (lastSalePrice !== null ? `آخر بيع: ${Number(lastSalePrice).toFixed(2)}` : undefined)}
                  className={`entry-control text-center ${selectedItem && Number(staging.unitPrice) > 0 && Number(staging.unitPrice) < Number(selectedItem.purchase_price || 0) ? "entry-control--error" : ""}`}
                />
```

- [ ] **Step 3: Replace it**

```jsx
                {(() => {
                  const priceHealth = getMarginHealth(staging.unitPrice, selectedItem?.purchase_price, selectedItem?.sale_price);
                  const hintLabel = canViewProfit && priceHealth.diffFlat != null
                    ? `ت ${Number(selectedItem?.purchase_price || 0).toFixed(2)} · ${priceHealth.diffFlat >= 0 ? "+" : ""}${priceHealth.diffFlat.toFixed(2)}`
                    : null;
                  return (
                    <PriceHealthHint label={hintLabel}>
                      <input ref={listPriceRef} type="number" step="any" value={staging.unitPrice}
                        onChange={(e) => canOverridePrice && setStaging(s => ({ ...s, unitPrice: e.target.value }))}
                        onFocus={e => canOverridePrice && e.target.select()}
                        onKeyDown={(e) => handleListFieldKeyDown(e, listDiscRef, listQtyRef)}
                        readOnly={!canOverridePrice}
                        title={!canOverridePrice ? "لا تملك صلاحية تعديل السعر" : (lastSalePrice !== null ? `آخر بيع: ${Number(lastSalePrice).toFixed(2)}` : undefined)}
                        className={`entry-control text-center ${ENTRY_HEALTH_CLASSES[priceHealth.level] || ""}`}
                      />
                    </PriceHealthHint>
                  );
                })()}
```

- [ ] **Step 4: Run the existing POS logic test suite for regressions**

Run: `npm test --prefix client -- posLogic`
Expected: PASS (no regressions — this suite doesn't touch rendering, but confirms nothing in shared POS utils broke on import graph changes)

- [ ] **Step 5: Manual verification**

Run `npm run dev` from the repo root, open the POS page, switch to List view, pick an item with a known `purchase_price`, and in the price field:
- Type a price below cost → input border turns red (rose), and (if your role has `pos.profit` permission) hovering/focusing shows a small muted "ت <cost> · <diff>" label under the field.
- Type a price giving 0-10% margin → border turns amber.
- Type a price ≥10% margin → no color (default).
- Type a price >30% over the item's list price → border turns blue (sky).
- Log in as (or simulate) a role without `pos.profit` permission → colors still show, but no hint label appears on focus/hover.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/pos/POSListView.jsx
git commit -m "feat(pos): add price-health color + discreet cost hint to entry-bar price input"
```

---

### Task 5: Wire the POS cart-grid `unitPrice` cell

**Files:**
- Modify: `client/src/pages/pos/POSListView.jsx` (the `unitPrice` column definition at ~line 1400-1413; imports already added in Task 4)

**Interfaces:**
- Consumes: `getMarginHealth` and `HEALTH_BORDER_CLASSES` from `client/src/utils/priceHealth.js`; `PriceHealthHint` from Task 2. Uses the `items` array and `canViewProfit`/`canOverridePrice` already in scope in `POSListView.jsx`.

- [ ] **Step 1: Add the extra import**

`ENTRY_HEALTH_CLASSES` was already imported in Task 4's import line; add `HEALTH_BORDER_CLASSES` to the same import:

```js
import { getMarginHealth, ENTRY_HEALTH_CLASSES, HEALTH_BORDER_CLASSES } from "../../utils/priceHealth";
```

- [ ] **Step 2: Locate and confirm the current cell**

Find this block (locate by `id: "unitPrice"` in the columns array if line numbers shifted):

```jsx
              ...(visibleColumns.includes("unitPrice") ? [{ id: "unitPrice", header: "السعر", width: 90, minWidth: 70, sortable: true, headerClass: "text-center hdr-center", cellClass: "p-0 border-l border-slate-100", render: (l, i) => {
                  const isOverride = l.item_id !== -1 && l.master_sale_price > 0 && Math.abs(Number(l.unit_price) - Number(l.master_sale_price)) > 0.001;
                  return (
                    <div className="relative w-full" title={!canOverridePrice ? "لا تملك صلاحية تعديل السعر" : undefined}>
                      <input type="number" step="any" value={l.unit_price}
                        data-grid-cell data-row={i} data-col="unit_price"
                        onChange={(e) => canOverridePrice && updateLine(cartLineKey(l), { unit_price: Number(e.target.value) || 0 })}
                        readOnly={!canOverridePrice}
                        className={`w-full h-[34px] text-center number-fmt-primary text-xs outline-none border-0 ring-0 focus:ring-0 transition-colors ${!canOverridePrice ? "bg-slate-50 text-slate-500 cursor-not-allowed" : isOverride ? "bg-amber-50 text-amber-800 focus:bg-amber-100" : "bg-transparent focus:bg-indigo-50/50"}`} />
                      {isOverride && <span title={`السعر الأصلي: ${Number(l.sale_price).toFixed(2)}`} className="absolute top-0.5 left-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 pointer-events-none" />}
                    </div>
                  );
                }
              }] : []),
```

- [ ] **Step 3: Replace it**

```jsx
              ...(visibleColumns.includes("unitPrice") ? [{ id: "unitPrice", header: "السعر", width: 90, minWidth: 70, sortable: true, headerClass: "text-center hdr-center", cellClass: "p-0 border-l border-slate-100", render: (l, i) => {
                  const isOverride = l.item_id !== -1 && l.master_sale_price > 0 && Math.abs(Number(l.unit_price) - Number(l.master_sale_price)) > 0.001;
                  const item = items.find((it) => String(it.id) === String(l.item_id));
                  const priceHealth = getMarginHealth(l.unit_price, item?.purchase_price, l.master_sale_price);
                  const hintLabel = canViewProfit && priceHealth.diffFlat != null
                    ? `ت ${Number(item?.purchase_price || 0).toFixed(2)} · ${priceHealth.diffFlat >= 0 ? "+" : ""}${priceHealth.diffFlat.toFixed(2)}`
                    : null;
                  return (
                    <div className="relative w-full" title={!canOverridePrice ? "لا تملك صلاحية تعديل السعر" : undefined}>
                      <PriceHealthHint label={hintLabel}>
                        <input type="number" step="any" value={l.unit_price}
                          data-grid-cell data-row={i} data-col="unit_price"
                          onChange={(e) => canOverridePrice && updateLine(cartLineKey(l), { unit_price: Number(e.target.value) || 0 })}
                          readOnly={!canOverridePrice}
                          className={`w-full h-[34px] text-center number-fmt-primary text-xs outline-none border border-transparent ring-0 focus:ring-0 transition-colors ${!canOverridePrice ? "bg-slate-50 text-slate-500 cursor-not-allowed" : (HEALTH_BORDER_CLASSES[priceHealth.level] || "bg-transparent focus:bg-indigo-50/50")}`} />
                      </PriceHealthHint>
                      {isOverride && <span title={`السعر الأصلي: ${Number(l.sale_price).toFixed(2)}`} className="absolute top-0.5 left-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 pointer-events-none" />}
                    </div>
                  );
                }
              }] : []),
```

Note: the base class changed from `border-0` to `border border-transparent` — with `border-0` (width 0), a `HEALTH_BORDER_CLASSES` border-color class would have had nothing to color. The old amber "override" background is intentionally dropped here — the small corner dot (`isOverride && <span .../>`) already signals "manually overridden", so the cell's border/background is now free to carry the margin-health signal instead without the two competing for the same amber color.

- [ ] **Step 4: Run the existing POS logic test suite for regressions**

Run: `npm test --prefix client -- posLogic`
Expected: PASS

- [ ] **Step 5: Manual verification**

In the same POS List view, add an item to the cart, then edit its price directly in the cart grid's price column:
- Price at/below cost → red border.
- Price 0-10% margin → amber border.
- Price ≥10% margin → no color.
- Price >30% over list price → blue border.
- The small amber corner dot still appears (and its hover title still shows the original price) whenever the price differs from `master_sale_price`, independent of the border color.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/pos/POSListView.jsx
git commit -m "feat(pos): add price-health color + discreet cost hint to cart grid price cell"
```

---

### Task 6: Wire the Sales Return staging price input (direct mode)

**Files:**
- Modify: `client/src/pages/sales/SalesReturnFormPage.jsx` (imports near the top, and the staging price field JSX at ~line 1659-1671)

**Interfaces:**
- Consumes: `getRefundHealth` and `ENTRY_HEALTH_CLASSES` from `client/src/utils/priceHealth.js` (Task 1). No `PriceHealthHint` here — this page already permanently displays "بيع X · شراء Y" plus `PriceDelta` under the field, so no additional discreet hover reveal is needed.

- [ ] **Step 1: Add the import**

Near the existing `import SmartTooltip from "../../components/ui/SmartTooltip";` line, add:

```js
import { getRefundHealth, ENTRY_HEALTH_CLASSES } from "../../utils/priceHealth";
```

- [ ] **Step 2: Locate and confirm the current staging price field**

Find this block (locate by `entry-field--price` and `stagingPriceRef` if line numbers shifted):

```jsx
                    {/* Return price input */}
                    <div className="entry-field entry-field--price">
                      <label className="entry-label">سعر المرتجع</label>
                      <input ref={stagingPriceRef} type="number" step="any" value={stagingPrice} onChange={e => setStagingPrice(e.target.value)} onFocus={e => e.target.select()} onKeyDown={e => handleFieldKeyDown(e, stagingWHRef, stagingQtyRef)}
                        title={stagingItem ? `بيع ${Number(stagingItem.sale_price || 0).toFixed(2)} · شراء ${Number(stagingPurchasePrice || 0).toFixed(2)}` : undefined}
                        className={`entry-control text-center ${stagingItem && Number(stagingPurchasePrice) > 0 && Number(stagingPrice) > 0 && Number(stagingPrice) < Number(stagingPurchasePrice) ? "entry-control--error" : ""}`} />
                      {stagingItem && (
                        <div className="flex items-center justify-center gap-2 overflow-hidden">
                          <span className="text-[9px] font-mono shrink-0 truncate" style={{ color: "var(--text-muted)" }}>بيع {Number(stagingItem.sale_price || 0).toFixed(2)} · شراء {Number(stagingPurchasePrice || 0).toFixed(2)}</span>
                          <PriceDelta entered={stagingPrice} baseline={stagingItem.sale_price} className="shrink-0" />
                        </div>
                      )}
                    </div>
```

- [ ] **Step 3: Replace it**

```jsx
                    {/* Return price input */}
                    <div className="entry-field entry-field--price">
                      <label className="entry-label">سعر المرتجع</label>
                      {(() => {
                        const returnHealth = getRefundHealth(stagingPrice, stagingItem?.sale_price);
                        return (
                          <input ref={stagingPriceRef} type="number" step="any" value={stagingPrice} onChange={e => setStagingPrice(e.target.value)} onFocus={e => e.target.select()} onKeyDown={e => handleFieldKeyDown(e, stagingWHRef, stagingQtyRef)}
                            title={stagingItem ? `بيع ${Number(stagingItem.sale_price || 0).toFixed(2)} · شراء ${Number(stagingPurchasePrice || 0).toFixed(2)}` : undefined}
                            className={`entry-control text-center ${ENTRY_HEALTH_CLASSES[returnHealth.level] || ""}`} />
                        );
                      })()}
                      {stagingItem && (
                        <div className="flex items-center justify-center gap-2 overflow-hidden">
                          <span className="text-[9px] font-mono shrink-0 truncate" style={{ color: "var(--text-muted)" }}>بيع {Number(stagingItem.sale_price || 0).toFixed(2)} · شراء {Number(stagingPurchasePrice || 0).toFixed(2)}</span>
                          <PriceDelta entered={stagingPrice} baseline={stagingItem.sale_price} className="shrink-0" />
                        </div>
                      )}
                    </div>
```

Note: the danger comparison changed from "return price below purchase cost" to "refund more than 10% above what the customer paid" — the corrected, return-relevant risk per the design spec.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open Sales Return in "direct" mode (not tied to an invoice), pick an item, and in the "سعر المرتجع" field:
- Enter a price ≤ the item's sale price → no color (default/emerald focus as before).
- Enter a price 0-10% above the sale price → amber border.
- Enter a price >10% above the sale price → red border.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/sales/SalesReturnFormPage.jsx
git commit -m "fix(sales-return): base staging return-price danger flag on original sale price, not cost"
```

---

### Task 7: Wire the Sales Return cart-grid return-price cell (direct mode)

**Files:**
- Modify: `client/src/pages/sales/SalesReturnFormPage.jsx` (the `return_price` cell in the direct-mode cart table at ~line 1818-1834; import already added in Task 6)

**Interfaces:**
- Consumes: `getRefundHealth` from Task 1 (already imported in Task 6).

- [ ] **Step 1: Locate and confirm the current cell**

Find this block (locate by `visibleColumns.includes("return_price")` if line numbers shifted):

```jsx
                          {visibleColumns.includes("return_price") && <td className="px-3 py-2.5 text-center">
                            {!isLocked ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <input type="number" step="any" min="0" value={l.unit_price}
                                  data-grid-cell data-row={idx} data-col="unit_price"
                                  onChange={e => updateCartPrice(l.key, e.target.value)}
                                  onFocus={e => e.target.select()}
                                  className={`w-24 rounded border px-2 py-1 text-center text-sm number-fmt-primary outline-none focus:ring-1 transition-colors
                                    ${l.purchase_price > 0 && Number(l.unit_price) > 0 && Number(l.unit_price) < l.purchase_price
                                      ? "border-rose-300 bg-rose-50 text-rose-700 focus:border-rose-400 focus:ring-rose-100"
                                      : "border-slate-200 bg-slate-50 text-slate-800 focus:border-emerald-400 focus:bg-white focus:ring-emerald-200"}`} />
                                <PriceDelta entered={l.unit_price} baseline={l.sale_price} />
                              </div>
                            ) : (
                              <span className="text-sm font-black text-slate-700 number-fmt">{formatMoney(l.unit_price)}</span>
                            )}
                          </td>}
```

- [ ] **Step 2: Replace it**

```jsx
                          {visibleColumns.includes("return_price") && <td className="px-3 py-2.5 text-center">
                            {!isLocked ? (() => {
                              const returnHealth = getRefundHealth(l.unit_price, l.sale_price);
                              const healthClasses = returnHealth.level === "loss"
                                ? "border-rose-300 bg-rose-50 text-rose-700 focus:border-rose-400 focus:ring-rose-100"
                                : returnHealth.level === "thin"
                                  ? "border-amber-300 bg-amber-50 text-amber-700 focus:border-amber-400 focus:ring-amber-100"
                                  : "border-slate-200 bg-slate-50 text-slate-800 focus:border-emerald-400 focus:bg-white focus:ring-emerald-200";
                              return (
                                <div className="flex flex-col items-center gap-0.5">
                                  <input type="number" step="any" min="0" value={l.unit_price}
                                    data-grid-cell data-row={idx} data-col="unit_price"
                                    onChange={e => updateCartPrice(l.key, e.target.value)}
                                    onFocus={e => e.target.select()}
                                    className={`w-24 rounded border px-2 py-1 text-center text-sm number-fmt-primary outline-none focus:ring-1 transition-colors ${healthClasses}`} />
                                  <PriceDelta entered={l.unit_price} baseline={l.sale_price} />
                                </div>
                              );
                            })() : (
                              <span className="text-sm font-black text-slate-700 number-fmt">{formatMoney(l.unit_price)}</span>
                            )}
                          </td>}
```

Note: kept this cell's existing bespoke Tailwind classes (with per-level focus-ring colors) rather than switching to the plainer shared `HEALTH_BORDER_CLASSES` map, following the codebase's existing pattern of one visual idiom per file/component. Only the *decision* (`getRefundHealth`) is shared, not the exact class strings — same approach `getMarginHealth`/`HEALTH_BORDER_CLASSES` uses for POS's grid cell, which does share the class map, since that cell had no bespoke per-level focus rings to preserve.

- [ ] **Step 3: Manual verification**

In the same Sales Return direct-mode session, add an item to the cart and edit its return price directly in the cart table's "سعر المرتجع" column:
- Price ≤ the line's sale price → default gray/emerald styling (unchanged from before).
- Price 0-10% above sale price → amber.
- Price >10% above sale price → red.
- The `PriceDelta` text underneath still updates as before.

- [ ] **Step 4: Run full client test suite for regressions**

Run: `npm test --prefix client`
Expected: PASS — all suites green, including the new `priceHealth` and `PriceHealthHint` tests from Tasks 1-2.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/sales/SalesReturnFormPage.jsx
git commit -m "fix(sales-return): base cart-grid return-price danger flag on original sale price, not cost"
```
