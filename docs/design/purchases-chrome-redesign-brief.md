# Design Brief: Purchases Page + Chrome Redesign

**Date:** 2026-05-13
**Register:** Product
**Color Strategy:** Committed (Emerald dominant)
**Theme:** Light

---

## 1. Feature Summary

Redesign three interconnected surfaces: the **Purchases form page** (create + edit + review), the **Sidebar** (app navigation), and the **Topbar** (page context + global actions). Used daily by owners/managers for fast purchase entry during rush hours and by accountants for end-of-day reconciliation. Every existing feature must be preserved: DataGrid excel-like item entry, today's purchases modal, all payment modes (cash, credit, bank transfer, future due, multi), supplier create-on-fly, image preview, print, edit/amend/void/lock states.

## 2. Primary User Action

Enter purchase line items quickly via the DataGrid, then save/post the invoice. Secondary: glance at today's purchases without leaving the form.

## 3. Design Direction

- **Color Strategy: Committed** — Professional Emerald moves from ≤10% accent to carrying 30-60% of key surfaces: sidebar active states, primary CTAs, section headers, key data highlights. Slate neutrals recede into background. Bolder, more confident retail presence.
- **Theme Scene:** Mixed shift — fluorescent-lit morning rush for fast entry, dimmer office light for end-of-day reconciliation. Surface must deliver high contrast and tight density for both.
- **Anchor References:** Square/Toast POS (confident CTAs, tight spacing, retail-grade visual weight) + Linear/Notion (compact sidebar, clean chrome hierarchy, command-bar efficiency).
- **Surface:** Light theme (office/retail fluorescent lighting demands contrast and legibility over dark mode).

## 4. Scope

| Dimension | Value |
|---|---|
| Fidelity | Production-ready |
| Breadth | 3 surfaces: PurchaseFormPage + Sidebar + Topbar |
| Interactivity | Full interactive, all existing behaviors preserved |
| Keep | DataGrid entry, today's purchases modal, all payment modes, supplier quick-create, image preview, print preview, edit/amend/void/lock |

## 5. Layout Strategy

**Sidebar:**
- Expanded: 220px wide (narrower than current 280px)
- Collapsed: 72px, icon-only tiles
- Hover on collapsed icon: floating popover with label + sub-items
- Accordion modules with fixed state tracking across navigation
- Sections: Primary shortcuts → Sales/Purchases → Treasury/Finance → Inventory → Definitions → System

**Topbar:**
- Compact 56px height
- Title/breadcrumb on the right (RTL)
- Global search bar (Ctrl+K) in center
- Notification bell + currency badge on the left
- Clean border separation from content

**Purchase Form:**
- Zone 1 — Header: supplier selector, date, warehouse, reference, lock/status badge
- Zone 2 — Items entry: full-width DataGrid with staging row above or inline
- Zone 3 — Footer: totals summary + payment method selector + action buttons (save, save & print, today's purchases)
- Today's purchases accessible via persistent toggle (button bar or collapsible panel)

## 6. Key States

| State | Behavior |
|---|---|
| Default (create) | Clean form, empty DataGrid, staging ready |
| Edit (locked) | Read-only, lock icon, edit button to unlock |
| Edit (amend) | Pre-filled form, "تعديل الفاتورة" banner |
| Loading | Skeleton placeholders |
| Empty (no lines) | Empty DataGrid with prompt to add first item |
| Error | Inline validation + toast on save failure |
| Saving | Button spinner, inputs disabled |
| Today's purchases open | Filterable list (date, supplier, item, user) |
| Sidebar collapsed | Icon tiles, hover popover with sub-items |
| Sidebar expanded | Full labels + accordion sub-items |

## 7. Interaction Model

- **Sidebar:** Click accordion toggles sub-items. Collapse button shrinks to 72px. Hover on collapsed icon → floating popover after 300ms. Active module highlighted with emerald indicator. Search filters modules in expanded mode.
- **Topbar:** Click search or Ctrl+K opens global search. Notification bell shows dropdown with unread count + mark-read. Currency badge is informational.
- **Purchase form:** Type item name → lookup dropdown → select → auto-fill qty/cost/price → adjust → click "إضافة" → DataGrid row appears. All existing keyboard shortcuts preserved (F2 for search, Enter to add, arrow navigation in lookups).

## 8. Content Requirements

- All UI labels in Arabic. Numeric/tabular data in Outfit/mono font.
- Existing i18n keys preserved. No new locale strings needed for chrome.
- Today's purchases: dynamic data from server, filterable by date range/supplier/item/user.

## 9. Recommended References

- spatial-design.md — sidebar proportions, topbar density, form zone partitioning
- interaction-design.md — DataGrid inline editing, lookup dropdowns, modal flows
- typography.md — weight-driven hierarchy enforcement
- ux-writing.md — empty state messages, status labels

## 10. Open Questions

- Popover animation: fade + scale at 200ms ease-out for collapsed sidebar hover?
- Today's purchases: persistent collapsible panel inside form page vs separate modal?
