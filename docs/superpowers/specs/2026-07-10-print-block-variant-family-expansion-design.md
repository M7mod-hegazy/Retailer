# Print block variant expansion: family-aware designs + new variants

## Problem

The Print Studio's per-block "design variant" picker (`BLOCK_VARIANTS` in
`client/src/components/print/studio/StudioInspector.jsx`) shows one flat list
of design choices per block, regardless of whether the document being edited
is roll paper (58mm/80mm) or page paper (A4/A5). This causes two problems:

1. **Fake choices**: some variants are coded to only take effect on page
   paper and silently no-op on roll paper (e.g. `items_table`'s "cards" and
   "minimalist-list" render as the default table on roll, even though the
   picker offers them). The user sees a choice that does nothing.
2. **Design variety is uneven**: many blocks have only 3 near-identical
   choices (standard/inline/badge-shaped), and 16 registered block types have
   no design choice at all — they render one fixed look.

## Goals

- Every offered variant must render *visibly differently* from the others,
  within the paper family it's shown in (roll vs page). No for-show options.
- Roll paper (58mm+80mm, unified as one family per existing
  `familyForSize()`) and page paper (A4/A5) can offer different designs for
  the same block where the existing design doesn't translate.
- Expand the overall design variety: blocks stuck at a thin 3-option set get
  one more; blocks with zero variants today get a first set.
- No new abstractions beyond what's needed: reuse the existing
  `family: ["page"] | ALL` gating already in `blocks/registry.js`, and the
  existing flat-array shape of `BLOCK_VARIANTS` wherever a block's current
  variants already work fine on both families.

## Non-goals

- No true 58mm-vs-80mm split. Both roll sizes share one implementation per
  variant (per earlier decision) — layouts must not visually break at 58mm,
  but are not bespoke-tuned per exact width.
- No changes to `blocks/registry.js` family gating (`doc_title`, `watermark`,
  `signature_lines` stay page-only; the 13 report/statement blocks below
  stay page-only).
- `pattern_divider` is left untouched — it already has its own multi-pattern
  selector (double/dotted/dash-dot/geometric/star) outside `BLOCK_VARIANTS`.
- `spacer` (size picker) and `watermark` (opacity picker) are not "design"
  variants in this sense and are not expanded.

## Data model

`BLOCK_VARIANTS[key]` keeps its current flat-array shape for every block
whose variants already render distinctly on both families (the majority).
For blocks where roll and page need genuinely different treatments, the
value becomes `{ roll: [...], page: [...] }`. `StudioInspector.jsx` reads
`family` (already computed via `familyOfSize`/`familyForSize`, currently
unused for this lookup) to resolve which array to show:

```js
function variantsFor(key, family) {
  const entry = BLOCK_VARIANTS[key];
  if (!entry) return null;
  return Array.isArray(entry) ? entry : entry[family] || [];
}
```

The now-dead secondary "طريقة العرض" dropdown duplicated for
`items_table`/`report_table` (StudioInspector.jsx ~969-976) is removed once
the main navigator is family-aware, to avoid two controls disagreeing.

## Phase A — fix family-blind/family-blocked blocks (7 blocks)

These already have `{roll, page}`-worthy variant sets; the page renderings
are correct today and untouched. Only roll renderings are added/fixed.

- **items_table / report_table** — `cards` (roll): each row as a stacked
  block (bold name line, then qty×price=total line, dashed separator between
  items). `minimalist-list` (roll): borderless ultra-compact lines (name +
  qty + total), tightest vertical rhythm. `report_table` additionally gets
  its `cards`/`minimalist-list` wired up on page at all (currently dead code
  — the component never reads `props.variant`), mirroring `items_table`.
- **payments** — `table-row` (roll): aligned 2-column rows (method left,
  amount right) with a thin top rule. `badge-pill` (roll): bracketed inline
  tags per method, no shadow/radius (thermal-safe).
- **receiver_signature** — `split` (roll): two compressed signature slots
  side-by-side via flex, wrapping gracefully at 58mm width.
- **customer** — `two-column` (roll): tight "label: value   label: value"
  paired single-line layout instead of a real 2-column CSS grid.
- **doc_number** — `giant` (roll): large bold centered number, matching the
  visual weight of `grand_total`'s "huge" variant.
- **image** — `card` (roll): double thin border instead of box-shadow.
  `banner` (roll): full-width with dashed top/bottom rules instead of
  shadow.

## Phase B — expand thin existing blocks (+1 variant each, 14 blocks)

Each block below is currently limited to 3 near-identical choices
(standard + 2 minor tweaks). Add one new variant drawn from the shared
vocabulary, picking whichever archetype isn't already represented in that
block's existing set. These are family-agnostic unless noted — implement on
whichever family(ies) the block already supports per `registry.js`.

**Shared vocabulary** (reused/adapted per block's content shape):
- *Accent-band* — filled colored strip using the doc's accent color
- *Ruled/Framed* — thin top+bottom rules framing the content
- *Underline-accent* — colored side/under-line instead of a full box
- *Badge/Stamp* — rounded pill treatment for short values
- *Split* — side-by-side layout where width allows
- *Minimal-rule* — no box, just a thin separating rule (quiet/editorial)

| Block | Existing | New variant |
|---|---|---|
| doc_date | standard/inline/badge | +ruled |
| cashier | standard/inline/badge | +boxed |
| barcode | standard/centered/compact | +framed |
| order_number | standard/huge/badge | +boxed |
| receipt_header_text | standard/boxed/centered | +underline-accent |
| footer_text | standard/boxed/centered | +underline-accent |
| signature_lines | standard/split/boxed | +dotted-ruled |
| branch | standard/badge/inline | +boxed |
| address | standard/inline/boxed | +badge |
| tax_id | standard/boxed/inline | +badge |
| subtotal | standard/plain/boxed | +badge |
| discount | standard/badge/plain | +underline-accent |
| increase | standard/plain/boxed | +badge |
| tax | standard/inline/plain | +ruled |

Left alone (already rich): `company_name`(5), `grand_total`(9),
`doc_title`(4), `logo`(4), `qr`(4), `notes`(4), `divider`(7),
`custom_text`(4), `custom_field`(4).

## Phase C — first variants for zero-variant blocks (16 blocks)

All belong to `client/src/components/print/blocks/registry.js`; none appear
in `BLOCK_VARIANTS` today (single fixed rendering).

**Metric-strip blocks (7, page-only, share one `MetricCard` helper in
`ReportBlocks.jsx` — one implementation cascades to all 7):**
`bank_statement_metrics`, `ajal_statement_metrics`, `ajal_schedule_metrics`,
`daily_treasury_metrics`, `ajal_full_statement_metrics`,
`cheque_register_metrics`, `payment_methods_report_metrics`.
New variants: `standard` (current) / `accent-band` (colored top border per
metric tile) / `minimal-rule` (no box, big number + label under a thin
rule).

**Tables (page-only):**
- `daily_treasury_summaries`, `payment_methods_by_method` → +`striped-compact`
  (zebra rows, tighter row height, accent header).
- `account_statement_ledger` (heaviest/most complex block) → +`banded`
  (alternating background bands per transaction group). Kept to one new
  variant given data density.
- `account_statement_summary` → +`boxed-strip`.

**Party cards (page-only):**
- `ajal_party`, `account_statement_party` → +`boxed-accent` (colored left
  border, matching the treatment used elsewhere for customer/party blocks).

**Family:ALL utility blocks (roll+page relevant):**
- `doc_grid` → `standard` / `boxed` / `compact`.
- `bank_details` → `standard` / `boxed` / `inline`.

`pattern_divider` is explicitly out of scope (see Non-goals).

## Testing / verification

No automated visual-regression tooling exists for this area (per prior
memory, print tests are Vitest smoke tests, not pixel comparisons). Manual
verification in Print Studio for each touched block: cycle through
58mm → 80mm → A5 → A4 and confirm every offered variant is visibly distinct
from its siblings within that family. For Phase A blocks, additionally
confirm the roll rendering no longer matches the previous unstyled no-op
fallback.

## Execution plan

Three sequential, independently reviewable passes (separate PRs/commits):
Phase A (fix existing fake/blocked variants) → Phase B (expand 14 thin
blocks) → Phase C (new variants for 16 zero-variant blocks). Given the
volume of mechanical, well-specified per-block styling work, execution is a
good candidate for delegation to subagents per block group, with review
gates between phases.
