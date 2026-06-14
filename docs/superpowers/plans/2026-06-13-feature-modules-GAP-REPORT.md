# Feature Modules — GAP REPORT (built vs missing)

**Date:** 2026-06-13 · **Method:** direct code audit of the current branch (not the plan).
**Verdict:** the feature-flag *infrastructure* is real and working, but **consumption is missing on
almost every workflow page**. The cheap-model build did the easy 20% (toggle + server route + item
edit-modal section + a few standalone pages) and skipped the hard 80% (threading each feature through
the catalog list, POS sale flow, purchases, returns, **reports**, **daily treasury / all detail
models**, and print).

## What actually works (verified)
- Flag storage + persistence: `electron/migrations/122_feature_module_flags.js`; DB confirmed
  (`feature_multi_unit=1` is saved right now).
- Settings UI + save: `pages/settings/FeaturesTab.jsx` + `settings.routes.js` (one-way enable).
- Global wiring: `AppShell` loads `/api/settings` → `appSettingsStore`; `hooks/useFeature.js`
  `useFeatureEnabled`; `SettingsPage.handleChange` syncs flags to the store on toggle.
- Server routes gated by `featureGate`: gold, itemUnits, repairOrders, restaurant, serials, variants.
- Nav entries gated by `featureKey`: serial lookup, repairs, restaurant tables, gold rates.
- Scale barcode scan: `BarcodeListener` → `utils/scaleBarcode.parseScaleBarcode` → `/api/items/scale-plu`.

## The core finding
Feature flags are **read in only 4 component files**: `ItemFormModal`, `ItemUnitsSection`,
`VariantsSection`, `POSPage` (gold only). Therefore **every other page reacts to no flag**, including
`/definitions/items` (`ItemsListPage`), `ItemDetailPage`, POS sale flow (beyond a gold stub), purchases,
returns, all reports, daily treasury, and every invoice/transaction detail model.

Legend: ✅ built & wired · 🟡 partial · ❌ missing

---

## Per-feature × per-surface matrix

### Multi-unit (`feature_multi_unit`)
| Surface | State | Note |
|---|---|---|
| Item edit modal | 🟡 | `ItemUnitsSection`, but **edit-only** and rendered **after the Save button** |
| `/definitions/items` list | ❌ | no unit column/indicator |
| Item detail page | ❌ | no units shown |
| POS sale (unit selector, line display, unit-barcode add) | ❌ | POS has no multi-unit code at all |
| Purchases receiving in a unit | ❌ | |
| Sales/purchase returns in sold unit | ❌ | |
| Reports — new "sold unit" column on sales/inventory reports | ❌ | |
| Reports — new unit-mix report | ❌ | |
| Receipt/print column | ❌ | `ItemsTableBlock` hardcoded 5 cols |
| Invoice detail + treasury slide-over model | ❌ | |

### Variants (`feature_variants`)
| Surface | State | Note |
|---|---|---|
| Item edit modal | 🟡 | `VariantsSection`, edit-only, after Save button |
| `/definitions/items` list | ❌ | **no parent/child grouping; parents NOT excluded from list** |
| Item detail page | ❌ | no variant matrix shown |
| POS sale (variant picker, parent-not-sellable) | ❌ | |
| Reports — group-by-parent / sell-through | ❌ | |
| Import/export variant columns | ❌ | |
| Detail models | ❌ | |

### Serials / IMEI (`feature_serials`)
| Surface | State | Note |
|---|---|---|
| Item edit modal toggle | ✅ | |
| Serial Lookup page (nav-gated) | ✅ | |
| POS sale serial scan | ❌ | no capture on sale |
| Returns serial picker (limited to invoice serials) | ❌ | |
| Purchase receive serial capture | ❌ | |
| Reports — warranty / defective log | ❌ | |
| Receipt + detail models show serials | ❌ | |

### Scale barcodes (`feature_scale_barcodes`)
| Surface | State | Note |
|---|---|---|
| Item PLU field + scale config UI | ✅ | |
| POS scan parse | ✅ | most complete feature |
| Reports — scale/weight sales | ❌ | |

### Gold (`feature_gold`)
| Surface | State | Note |
|---|---|---|
| Item gold fields | ✅ | |
| Gold Rates page (nav-gated) | ✅ | |
| POS pricing hook | 🟡 | partial `useEffect`; no per-line breakdown UI |
| Morning rate-missing banner | ❌ | |
| Reports — daily rate & workmanship margin | ❌ | |
| Receipt + detail models (weight/karat/rate) | ❌ | |

### Restaurant + Repair (`feature_restaurant`, `feature_repair_orders`)
| Surface | State | Note |
|---|---|---|
| Table Map page / Repair Orders page (nav-gated) | ✅ | standalone pages exist |
| POS dine-in / table binding | ❌ | |
| Modifiers picker in POS | ❌ | |
| Recipe component deduction on sale | ❌ | |
| Kitchen ticket print + station routing | ❌ | |
| Service charge (invoice total + all breakdowns) | ❌ | |
| Reports — category/station, table turnover | ❌ | |

---

## Cross-cutting surfaces that are missing for MANY features

### Reports (entirely unwired)
- **No report reads any feature flag or column.** Confirmed: `server/src/reports/queries/*` contain no
  `sold_unit`/`serial`/`gold_`/`variant`/`service_charge` references; `reportsCenterConfig.js` has no
  variant/unit/serial/karat/station filter dimensions.
- Missing work splits into TWO kinds (both required):
  1. **New columns on existing reports** — sales/inventory/returns reports must surface sold unit,
     variant parent, serial, gold weight/karat, service charge where relevant.
  2. **New complete reports** — unit-mix, variant sell-through, serial warranty/defective, scale-weight
     sales, restaurant category/station + table turnover, gold rate & margin.
- Add to BOTH `client/reportsCenterConfig.js` (dimensions/classifications/columns) AND
  `server/src/reports/` (registry + queries + columns).

### Daily Treasury (`pos/DailyTreasuryPage.jsx`) — action-detail model
- The transaction slide-over (`slideOver` → `slideOverDetails`) shows each invoice/return breakdown.
  It currently shows **no** feature components. Required additions so the breakdown reconciles:
  - **Service charge as its own breakdown line** (else the dine-in total won't add up).
  - Per-line sold unit, modifiers + deltas, gold weight/karat/rate, serials; table/order-type header.

### All invoice/transaction detail "models" (shared rule)
Every place that renders an invoice/return/transaction breakdown is unwired and must show the snapshot
components. Audit at least: `pos/InvoiceDetailPage.jsx`, `pos/SalesReturnDetailPage.jsx`,
`pos/DailyTreasuryPage.jsx`, `history/HistoryPage.jsx`, `payments/PaymentsListPage.jsx`,
`operations/PaymentTransactionsPage.jsx`, `customers/CustomerDetailPage.jsx`,
`accounts/CustomerAccountsPage.jsx`, `operations/AjalTrackerPage.jsx`, `operations/InstallmentsPage.jsx`.
Best fix: add the snapshot fields once to the shared `getInvoiceWithLines` API so every consumer inherits.

### Catalog list & detail
- `/definitions/items` (`ItemsListPage`) and `ItemDetailPage` read no flag → no variant grouping/parent
  hiding, no unit/serial/gold indicators.

### Print
- `components/print/blocks/ItemsTableBlock.jsx` hardcodes 5 columns in both Designer and fallback paths;
  no doc types for kitchen ticket / labels are surfaced by flag.

---

## Plan-alignment deltas (built version vs the revised plan)
- Built has **`feature_repair_orders`** and a single **`feature_restaurant`**. The revised plan removes
  repair and splits restaurant into `feature_restaurant_tables` / `feature_modifiers` /
  `feature_recipes` / `feature_kitchen_ticket`. Reconcile before continuing.
- Disable model differs: built uses **one-way enable (can never disable)**; revised plan uses **lock
  OFF only while in use**. Decide which stands.
- Item form sections render **after the Save button** and **edit-only** — placement/UX fix needed.

---

## Why it *felt* like nothing works
The only surface where most flags visibly react is the **item edit modal**, and units/variants there
appear after the Save button and only when editing an existing item. Open the catalog list, POS, a
report, or the treasury and toggling a flag changes nothing — because those pages contain no code that
reads the flag.

## Recommended close-out order (one feature, full vertical slice, as the proof)
Multi-unit end-to-end: item form (fix placement) → `/definitions/items` indicator → POS unit
selector + unit-barcode + line display → purchase receiving → returns → invoice detail + treasury
slide-over → receipt column → unit-mix report. Once one flag lights up *every* surface, repeat the
pattern for the rest.
