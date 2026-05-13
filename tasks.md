# Tasks: Purchases Page + Chrome Redesign

**Brief:** `docs/design/purchases-chrome-redesign-brief.md`

---

## Phase 1: Design System Foundation

- [ ] **T1.1** Create `DESIGN.json` sidecar — extracted tokens from DESIGN.md (colors, typography, spacing, rounded) as a single JSON importable by any component. Use OKLCH values where possible.

## Phase 2: Sidebar (`Sidebar.jsx`)

- [ ] **T2.1** Reduce expanded width from 280px to 220px. Adjust all internal padding/margins proportionally.
- [ ] **T2.2** Fix collapse behavior: collapsed = 72px, icon-only. Expand button toggles. When collapsed and user clicks an accordion header, expand sidebar automatically.
- [ ] **T2.3** Add collapsed hover popover: hovering an icon tile in collapsed state shows a floating popover (120px from icon, label + sub-items list) after 300ms delay.
- [ ] **T2.4** Fix accordion state tracking: ensure active accordion opens on navigation, manual toggle works independently, only one accordion open at a time.
- [ ] **T2.5** Apply Committed color strategy: active items use emerald-heavy styling (emerald bg or emerald icon + dark text), hover states use strong slate tint.
- [ ] **T2.6** Clean up module section order and icons. Match brief section ordering.
- [ ] **T2.7** Audit permission filtering: ensure all pageKeys correctly gate visibility.

## Phase 3: Topbar (`Topbar.jsx`)

- [ ] **T3.1** Reduce height from 80px to 56px. Adjust all internal spacing.
- [ ] **T3.2** Reflow layout: title/breadcrumb right (RTL), global search center, notification bell + currency badge left.
- [ ] **T3.3** Tighten padding, font sizes, and icon sizes to match compact 56px chrome.
- [ ] **T3.4** Ensure Ctrl+K global search still works. Clean up border/shadow treatment.

## Phase 4: Purchase Form Page (`PurchaseFormPage.jsx`)

- [ ] **T4.1** Restructure layout into 3 clear zones: Header (supplier/date/warehouse/reference/status) → Items (DataGrid) → Footer (totals/payment/actions).
- [ ] **T4.2** Apply Committed color strategy: emerald for primary CTAs, active states, key data highlights. Slate neutrals for backgrounds and secondary elements.
- [ ] **T4.3** Apply DESIGN.md typography: weight-driven hierarchy, Outfit for numeric data, Tajawal for headings.
- [ ] **T4.4** Ensure empty DataGrid shows a clean prompt to add first item (not just blank rows).
- [ ] **T4.5** Today's purchases: decide on panel vs modal (resolve open question from brief). Implement as a collapsible side panel within the form page.
- [ ] **T4.6** Preserve all existing features: DataGrid inline editing, lookup dropdowns, keyboard shortcuts, payment modes, supplier create-on-fly, image preview, print preview, edit/amend/void/lock states, preview modal.
- [ ] **T4.7** Audit all modals used in the form — replace with inline/progressive alternatives where the brief allows.

## Phase 5: Integration & Polish

- [ ] **T5.1** Verify navigation routing: sidebar links match actual routes, active states compute correctly.
- [ ] **T5.2** Visual cohesion pass: sidebar, topbar, and form page use the same token system (DESIGN.json), consistent spacing, same border/radius/shadow language.
- [ ] **T5.3** State audit: check loading, empty, error, saving states on all three surfaces.
- [ ] **T5.4** RTL audit: ensure all directional styles use Tailwind RTL variants correctly.
- [ ] **T5.5** Build and verify no console errors, no broken imports, no layout shift.
