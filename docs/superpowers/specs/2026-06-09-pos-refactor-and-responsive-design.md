# POS Page Refactor + Responsive Layout — Design

**Date:** 2026-06-09
**Status:** Approved for spec review
**Scope:** All four phases (logic extraction, view split, persistent summary, smart sidebar)

## Problem

`client/src/pages/pos/POSPage.jsx` is a 4,221-line monolith that is hard to control and risky to change.

Evidence from the line-by-line review:

- **Two complete render branches in one file**, with heavy duplication:
  - List view: `if (viewMode === "list") return (...)` — lines **1608–3069**
  - Grid/detailed view: `return (...)` — lines **3070–4221**
  - Duplicated between them: customer card, "ملخص الفاتورة" summary, discount/increase inputs (`1842–1913` ≈ `~3110`), the "إجمالي المستحق" total card (`1917` ≈ `~3110`), the payment panel, and **all modals (rendered once per branch)**.
- **~70 `useState`/`useRef`** in a single component body (`429–579`).
- **Existing reusable components are ignored**: `components/pos/{PaymentPanel,InvoiceLines,ItemGrid}.jsx` exist and are used by `SalesReturnFormPage.jsx`, but `POSPage` imports none of them and reimplements all three inline.
- **Two navigation guards** active at once: custom `useNavGuard` (`299`) and `useUnsavedChangesGuard` (`705`) — redundant.
- **Duplicated column-resize logic**: `onDetailedResizeStart` (`849`) and `onCartResizeStart` (`871`) are near-identical.
- Small/square screens: the sidebar (`DesktopLayout.jsx`) already supports drag-resize (160–420px, persisted) and full-hide, but has no compact rail mode and no way to keep key totals visible when the POS aside is hidden.

## Goals

1. Break the POS page into small, independently understandable parts.
2. Eliminate the list/grid duplication — one source of truth per UI piece.
3. Keep critical info (total, item count, pay action) **always visible**, even when the sidebar or the summary aside is hidden, in **both** views.
4. Give the sidebar smart modes for small/square screens without breaking the existing resize/hide behavior.

## Non-goals

- Changing POS business logic, save payload, validation rules, or keyboard shortcuts (F1/F2/F9/F12). Behavior must remain identical.
- Refactoring the returns page or unifying its shared components with POS (explicitly out of scope to avoid regressions).
- Backend/API changes, except adding one settings key for the opt-in auto-rail.

## Key decisions

- **Component reuse:** Extract POS's richer inline logic into **new** `pages/pos/parts/*` components. Do **not** modify `components/pos/{PaymentPanel,InvoiceLines,ItemGrid}.jsx` (the returns page depends on them). Lowest-risk path; reconciling the two sets is a deferred, optional cleanup.
- **Auto-rail on POS:** Opt-in **setting**, default off. No surprise behavior change.

## Architecture

### Phase 1 — Extract logic into hooks

Page-local state and handlers move out of the component into focused hooks under `pages/pos/hooks/`. Cart/customer/discount/increase state already lives in `usePosStore` and stays there.

- `usePosBootstrap()` — `/api/pos/bootstrap` load; owns `customers/items/categories/warehouses/banks/treasuries/units/employees/stockLevels/storeSettings/paymentMethods`; exposes `fetchStockForItems`, `mergeStockRows`, `getLineMaxStock`, `stockLoaded`.
- `usePosSearch()` — item search (paginated), customer search, detailed search, sort/filter; exposes results + `loadMorePOSItems`.
- `usePosStaging()` — `selectedItem`, `staging`, price type, `addCurrentLine`, `handleSelectItem`, entry-field keyboard nav, `resetStaging`.
- `usePosPayment()` — `paymentType`, amounts, multi-payment state, `resetPaymentFields`, payment validation helpers.
- `usePosSave()` — `saveInvoice`, amend flow, `saveSuccess`/`lastSavedInvoice`, supervisor override.
- `usePosShortcuts()` — F1/F2/F9/F12 wiring.
- **Remove** `useNavGuard` + `NavLockModal`; keep only `useUnsavedChangesGuard`.

Each hook has one clear purpose and a documented return shape. `POSPage` composes them.

### Phase 2 — Split views, share parts

```
pages/pos/
  POSPage.jsx            ← thin shell (~150 lines): compose hooks, pick view, render modals ONCE
  hooks/                 ← Phase 1 hooks
  views/
    PosListView.jsx      ← list layout (from lines 1608–3069)
    PosGridView.jsx      ← grid/detailed layout (from lines 3070–4221)
  parts/
    PosHeader.jsx        ← invoice no, seller select, view toggle, action buttons
    PosCustomerCard.jsx  ← customer search/select + walk-in WhatsApp capture
    PosCart.jsx          ← cart table (sortable/resizable columns, line warnings)
    PosItemPicker.jsx    ← grid/list item picker + staging entry fields
    PosSummary.jsx       ← summary + total (see Phase 3)
    PosPaymentPanel.jsx  ← payment type + amounts + multi-payment
    PosModals.jsx        ← all modals in one place, rendered once
```

- One shared column-resize helper (`useColumnResize`) replaces the two duplicated functions.
- `POSPage` renders `PosModals` once; both views consume the same modal set via props/context.

### Phase 3 — Persistent summary ("sticky total")

Single `PosSummary` component with a `mode` prop, used by both views:

- `mode="full"` — full card: subtotal, item count, discount input, increase input, big "إجمالي المستحق" total, blocking-error list.
- `mode="bar"` — compact always-visible strip: total + item count + Pay button (+ error badge).

Mode is chosen by a container-width breakpoint **or** the sidebar-hidden signal. When the aside is hidden or the viewport is small/square, the total collapses into the bar instead of disappearing. Discount/increase inputs live only in `mode="full"`; the bar links/opens the full summary when needed.

### Phase 4 — Smart sidebar

Extend `DesktopLayout.jsx` from a 2-state (full/hidden) to a 3-state model:

- Persist `retailer.sidebar.mode` ∈ `{ 'full', 'rail', 'hidden' }` (migrate the existing `retailer.sidebar.hidden` boolean).
- **Rail (~56px):** module icons only; click/hover flyout for sub-items. Keep drag-resize for `full` (min lowered toward ~150).
- **Auto-rail on `/pos`:** opt-in setting (`pos_auto_rail`, default off). When on, entering `/pos` switches to rail and restores the prior mode on leaving.
- **Command palette: DROPPED.** A full Ctrl+K global search already exists (`pages/search/GlobalSearchPage.jsx` via `useUiStore.openGlobalSearch`, bound in `Topbar.jsx:141`). It already searches pages/items/customers/invoices/etc. and navigates. Building a second palette would conflict and duplicate. The rail mode relies on this existing palette for fast navigation while collapsed.

## Data flow

`POSPage` (shell) → composes hooks → passes state + callbacks down to `views/*` → which compose `parts/*`. No part owns cross-cutting state; all shared state stays in hooks/`usePosStore`. Modals are controlled by the shell.

## Error handling

- Behavior parity is the acceptance bar: same validation, same toasts/`saveMessage`, same blocking-error gating before save/print.
- Sidebar mode migration falls back to `full` on any parse error (matches existing `useLocalStorageState` try/catch).
- Command palette is additive; failure to load nav data degrades to the existing sidebar.

## Testing

- Existing tests: `client/src/components/layout/__tests__/{DesktopLayout,Topbar}.test.jsx` must pass; extend `DesktopLayout` tests for the 3-state mode + migration.
- Manual parity checklist per phase, both views: add line, edit qty/price/discount, hold/resume, all payment types (cash/bank/credit/installments/multi), amend flow, save + print, keyboard shortcuts, offline banner.
- Verify the returns page (`SalesReturnFormPage`) is unaffected (no shared components touched).
- Small-screen check: total stays visible at narrow widths and with sidebar hidden/rail, in both views.

## Rollout

Phases are independently shippable and should land in order (1 → 4), each behind a working build with the parity checklist run before moving on. Phase 1 is internal-only (no visible change) and de-risks everything after it.
