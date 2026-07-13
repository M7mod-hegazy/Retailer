# Price health hints for price inputs (POS + Sales Return)

## Problem

On the POS page (`client/src/pages/pos/POSListView.jsx`), the cashier types a sale price with no feedback about whether it's a healthy margin, a loss, or a likely typo (extra digit). The item's purchase cost is known but never surfaced near the price input — and POS screens are sometimes visible to customers, so any cost reveal needs to be discreet (small, muted, hidden unless the cashier is actually focused on the field).

On the Sales Return page (`client/src/pages/sales/SalesReturnFormPage.jsx`, "direct" mode), the return price input already has a red "danger" flag, but it compares the entered price to the item's **purchase cost** — a copy-paste of the POS logic that doesn't make sense for a return. Refunding below cost isn't a risk to the business; refunding **more than the customer originally paid** is. The comparison baseline and danger direction need to flip.

## Scope

- **POS** (`POSListView.jsx` only — `POSDetailedView.jsx`'s cart has no editable price field, so it's out of scope):
  1. Quick-entry bar price input (~line 1199)
  2. Cart grid's `unitPrice` column, per line (~line 1400)
- **Sales Return** (`SalesReturnFormPage.jsx`, **direct mode only** — invoice mode's return price is read-only, copied from the original invoice line, so there's nothing to enhance there):
  1. Staging price input (~line 1660)
  2. Cart grid's return-price input, per line (~line 1821)

Not in scope: `POSDetailedView.jsx` (no price input exists), Sales Return "invoice" mode's read-only price display, the existing `purchase_price`/`selling_price` preview columns (left as-is).

## Shared logic — `client/src/utils/priceHealth.js` (new file)

Two small pure functions, framework-agnostic, so other pages (Purchase Return, etc.) can reuse the pattern later. Both return `{ level, diffFlat, diffPct }` where `level` is one of `"loss" | "high" | "thin" | "healthy" | "neutral"`.

```js
// Selling context (POS): is the price a healthy margin over cost?
export function getMarginHealth(price, cost, listPrice) {
  const p = Number(price) || 0;
  const c = Number(cost) || 0;
  const list = Number(listPrice) || 0;
  if (list > 0 && p > list * 1.3) {
    return { level: "high", diffFlat: c > 0 ? p - c : null, diffPct: c > 0 ? ((p - c) / c) * 100 : null };
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
  if (diffPct > 10) return { level: "loss", diffFlat, diffPct };   // refunding notably more than paid
  if (diffPct > 0) return { level: "thin", diffFlat, diffPct };    // refunding slightly more than paid
  return { level: "healthy", diffFlat, diffPct };                  // at or below what was paid — safe
}

export const HEALTH_BORDER_CLASSES = {
  loss:    "border-rose-400 bg-rose-50",
  high:    "border-sky-400 bg-sky-50",
  thin:    "border-amber-400 bg-amber-50",
  healthy: "",
  neutral: "",
};
```

Rules recap (priority order, first match wins):
- **loss** (red) — price at/below cost (POS), or refund >10% above what customer paid (Return)
- **high** (blue, POS only) — price >30% above the item's list price (typo/fat-finger catch, e.g. `250` vs `25`)
- **thin** (amber) — margin under 10% (POS), or refund 0–10% above what customer paid (Return)
- **healthy** — margin ≥10% (POS), or refund at/below original price (Return) — no color, default styling
- **neutral** — no cost/reference data available — no color, default styling

`level` changes get a ~150ms CSS color transition so crossing a threshold feels smooth, not a jarring flash.

## Discreet hint component — `client/src/components/ui/PriceHealthHint.jsx` (new)

A small wrapper, **not** a reuse of `SmartTooltip.jsx` (that one is a bold, high-contrast dark tooltip meant to be noticed — the opposite of what's needed here).

- Triggers on **focus AND hover** (React's `onFocus`/`onBlur` bubble from the wrapped input, so wrapping in a `div` works without needing tabIndex tricks) — POS entry is keyboard/tab-driven, must not require a mouse.
- Renders a tiny (`text-[9px] text-slate-400`), pale (`bg-white/95 border border-slate-100`), no-heavy-shadow label tucked directly under the input's corner.
- If `label` prop is falsy, renders `children` directly with no wrapper — i.e., no hint at all (used for permission gating on POS and for `neutral` health).

```jsx
<PriceHealthHint label={canViewProfit ? `ت ${cost.toFixed(2)} · ${diffFlat >= 0 ? "+" : ""}${diffFlat.toFixed(2)}` : null}>
  <input ... />
</PriceHealthHint>
```

## Wiring

### POS entry bar (`POSListView.jsx` ~1199)
- Compute `const health = getMarginHealth(staging.unitPrice, selectedItem?.purchase_price, selectedItem?.sale_price)`.
- Replace the current ad-hoc `entry-control--error` (below-cost-only) class with `HEALTH_BORDER_CLASSES[health.level]`.
- Wrap the `<input>` in `<PriceHealthHint label={canViewProfit && health.diffFlat != null ? ... : null}>`.
- Keep the existing native `title` attribute as-is (it shows "last sale price" and the "no override permission" message — unrelated info, not a duplicate of the new cost hint).

### POS cart grid `unitPrice` cell (`POSListView.jsx` ~1400)
- Per line: `const health = getMarginHealth(l.unit_price, item?.purchase_price, l.master_sale_price)`.
- Apply `HEALTH_BORDER_CLASSES[health.level]` alongside (not replacing) the existing override-amber background — priority: health color wins for border/background; the existing small corner dot (shows original price via `title` on hover, marks "this was manually overridden from list price") stays untouched as a separate, decoupled signal.
- Wrap in `PriceHealthHint` same as above.

### Sales Return staging price input (`SalesReturnFormPage.jsx` ~1660)
- Compute `const health = getRefundHealth(stagingPrice, stagingItem?.sale_price)`.
- Replace the current `entry-control--error` condition (`stagingPrice < stagingPurchasePrice`) with `HEALTH_BORDER_CLASSES[health.level]`.
- No `PriceHealthHint` needed — this page already shows cost/sale price permanently in a muted line (~1667) plus `PriceDelta` (~1668); those stay as-is. Just the input's border color changes to reflect the corrected (refund-vs-paid) logic instead of the old cost-based one.

### Sales Return cart grid return-price input (`SalesReturnFormPage.jsx` ~1821)
- Per line: `const health = getRefundHealth(l.unit_price, l.sale_price)`.
- Replace the existing inline ternary (`l.purchase_price > 0 && unit_price < purchase_price ? rose : slate/emerald`) with `HEALTH_BORDER_CLASSES[health.level]` (falling back to the current default emerald-focus styling when `healthy`/`neutral`).
- Existing `PriceDelta` display underneath stays unchanged.

### Not touched
- Sales Return "invoice" mode (~1924-1933): read-only price, comparison against purchase cost is a different, valid concern ("this item was historically sold below cost") — left as-is.
- `POSDetailedView.jsx`: no editable price input exists; out of scope.
- `purchase_price`/`selling_price` preview columns: unchanged.

## Permission handling

- POS: cost figure in the hint is gated behind `canViewProfit` (same permission gating the existing profit_pct column). Without permission, the color signal (red/amber/blue) still shows — a cashier without profit visibility still avoids loss-making or fat-fingered sales — but the literal cost number never renders.
- Sales Return: no gating. The comparison baseline is the customer's own original sale price, which the cashier already sees openly elsewhere on this page (not proprietary cost data), so there's no exposure concern.

## Edge cases

- Cost/reference price unknown or zero → `neutral`, no color, no hint (nothing to compare against).
- Manual/custom cart lines (`item_id === -1` in POS) → `getMarginHealth` naturally falls to `neutral` since there's no `item.purchase_price` to look up; unaffected.
- Price or reference is exactly zero while the other is positive → treated as no signal (`neutral`), avoiding a false "loss" flag while the cashier is still mid-typing (e.g., price field momentarily empty).

## Testing

- Unit tests for `getMarginHealth` / `getRefundHealth` in `client/src/utils/__tests__/priceHealth.test.js` covering each level's boundary (exactly at cost, just under/over the 10% band, just under/over the 1.3x list-price band, zero/missing inputs).
- No new component-level tests planned for `PriceHealthHint` beyond what's covered by existing POS/Sales-Return test suites exercising the price inputs, if any exist.
