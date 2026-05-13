---
name: ElHegazi Retailer
description: Professional Arabic-first desktop POS and retail management system
colors:
  professional-emerald: "#059669"
  text-primary: "#0f172a"
  text-secondary: "#475569"
  text-muted: "#94a3b8"
  bg-base: "#f4f6f8"
  bg-surface: "#ffffff"
  bg-elevated: "#ffffff"
  bg-input: "#f1f5f9"
  bg-overlay: "#f8fafc"
  border-default: "#e2e8f0"
  border-strong: "#94a3b8"
  status-success-bg: "#ecfdf5"
  status-success-text: "#047857"
  status-success-border: "#6ee7b7"
  status-danger: "#dc2626"
  status-danger-bg: "#fef2f2"
  status-danger-text: "#b91c1c"
  status-danger-border: "#fca5a5"
  status-warning-bg: "#fffbeb"
  status-warning-text: "#b45309"
  status-warning-border: "#fcd34d"
  status-info-bg: "#f0f9ff"
  status-info-text: "#0369a1"
  status-info-border: "#7dd3fc"
  scroll-thumb: "rgba(15, 23, 42, 0.15)"
  scroll-track: "transparent"
typography:
  display:
    fontFamily: "Tajawal, Noto Sans Arabic, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Tajawal, Noto Sans Arabic, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Noto Sans Arabic, Tajawal, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "Noto Sans Arabic, Tajawal, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.625
  label:
    fontFamily: "Noto Sans Arabic, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 800
    letterSpacing: "0.1em"
  mono:
    fontFamily: "Outfit, Inter, monospace"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "#059669"
    textColor: "#ffffff"
    rounded: "12px"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "#047857"
    textColor: "#ffffff"
    rounded: "12px"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "#f1f5f9"
    textColor: "#0f172a"
    borderColor: "#e2e8f0"
    rounded: "12px"
    padding: "10px 16px"
  button-danger:
    backgroundColor: "#fef2f2"
    textColor: "#b91c1c"
    borderColor: "#fca5a5"
    rounded: "12px"
    padding: "10px 16px"
  input-default:
    backgroundColor: "#f1f5f9"
    borderColor: "#e2e8f0"
    rounded: "12px"
    padding: "10px 14px"
  input-focus:
    backgroundColor: "#ffffff"
    borderColor: "#059669"
    rounded: "12px"
  card-default:
    backgroundColor: "#ffffff"
    borderColor: "rgba(15, 23, 42, 0.06)"
    rounded: "16px"
    padding: "16px 20px"
  sidebar-item:
    backgroundColor: "transparent"
    textColor: "#475569"
    rounded: "8px"
    padding: "10px 12px"
  sidebar-item-active:
    backgroundColor: "#0f172a"
    textColor: "#ffffff"
    rounded: "8px"
---

# Design System: ElHegazi Retailer

## 1. Overview

**Creative North Star: "The Polished Counter"**

This system treats every screen like a well-organized retail counter. Data has a place, every action has its spot, and nothing is left loose. The aesthetic is professional and tactile: buttons have weight, cards have presence, and the slate-gray palette with emerald accents evokes a modern retail terminal: precise, trustworthy, ready for back-to-back transactions.

**Key Characteristics:**
- Monochromatic ash-slate base with a single emerald accent voice
- Solid, tactile components with dense, efficient layouts
- Flat by default, shadows on interaction only
- RTL by default, Arabic-first typography
- Compact sizing built for extended daily use

## 2. Colors

The palette is Restrained: tinted cool neutrals with Professional Emerald as a single accent carrying ≤10% of any given surface. Semantic colors (green, red, amber, blue) are used strictly for status signaling, never decoration.

### Primary
- **Professional Emerald** (#059669): Primary actions, current selection indicators, active state badges. Rare enough that when it appears, the user knows something is actionable.

### Neutral
- **Text Primary** (#0f172a): Primary body text, headings, labels. Maximum contrast against backgrounds.
- **Text Secondary** (#475569): Secondary labels, metadata, hints.
- **Text Muted** (#94a3b8): Placeholder text, disabled states, subtle secondary info.
- **Background Base** (#f4f6f8): The outer hull — page background, workspace backdrop.
- **Background Surface** (#ffffff): Content surfaces — cards, panels, inputs at rest.
- **Background Input** (#f1f5f9): Input fields at rest, muted containers.
- **Background Overlay** (#f8fafc): Sidebar panels, secondary surface.
- **Border Default** (#e2e8f0): Standard dividers, card borders, input borders at rest.
- **Border Strong** (#94a3b8): Hover borders, active dividers.

### Semantic
- **Success** (#047857, bg #ecfdf5, border #6ee7b7): Positive confirmations, saved states.
- **Danger** (#dc2626, bg #fef2f2, border #fca5a5): Destructive actions, errors, voids.
- **Warning** (#b45309, bg #fffbeb, border #fcd34d): Price changes, unusual states.
- **Info** (#0369a1, bg #f0f9ff, border #7dd3fc): System info, locked states.

### Named Rules
**The One Voice Rule.** Professional Emerald occupies ≤10% of any given screen. Its rarity signals actionability. Semantic colors carry their own weight — green for good, red for bad — and are never used decoratively.

## 3. Typography

**Display Font:** Tajawal (800-900 weights, Noto Sans Arabic fallback)
**Body Font:** Noto Sans Arabic (500-700 weights, Tajawal fallback)
**Label/Mono Font:** Outfit for Latin numerals (700-900 weights, Inter fallback)

**Character:** A weight-driven hierarchy built for speed. Arabic reading demands strong contour differentiation, so the system uses maximum weight contrast (900 for titles → 500 for body) rather than size alone. Numeric data in Outfit ensures legibility in monetary and quantity columns.

### Hierarchy
- **Display** (900, 1.875rem / 30px, 1.2): Page titles, section hero headings. One per surface.
- **Headline** (800, 1.25rem / 20px, 1.3): Section titles, card headers, modal titles.
- **Title** (700, 0.9375rem / 15px, 1.5): Panel titles, sidebar headers, form section labels.
- **Body** (500-700, 0.8125rem / 13px, 1.625): Data text, table cells, descriptions.
- **Label** (800, 0.6875rem / 11px, 0.1em tracking uppercase): Form labels, table headers, metadata badges.
- **Mono** (700, 0.8125rem / 13px, 1.5): Currency amounts, order references, barcodes, SKUs.

### Named Rules
**The Weight-First Rule.** Hierarchy is driven by font weight (900 → 500) before size. Weight jumps are more legible than size jumps for Arabic in compact POS screens.

**The Outfit Number Rule.** All numeric data in financial contexts uses Outfit, not the Arabic body font. This ensures consistent numeral width across columns and totals.

## 4. Elevation

The system is flat by default. Surfaces are distinguished by tonal contrast (white surface on light gray base with 1px border), not by shadows. Shadows appear only as responses to interaction: hover, focus, elevated state, modal context.

### Shadow Vocabulary
- **Card Shadow** (`0 2px 4px rgba(15,23,42,0.02), 0 8px 16px rgba(15,23,42,0.04)`): Subtle presence under resting surfaces. Nearly imperceptible.
- **Elevated Shadow** (`0 4px 6px rgba(15,23,42,0.05), 0 12px 40px rgba(15,23,42,0.08)`): Hover states, dropdowns, popovers.
- **Modal Shadow** (`0 10px 30px rgba(15,23,42,0.06), 0 30px 60px rgba(15,23,42,0.1)`): Dialog containers, floating panels.
- **Focus Glow** (`0 0 0 2px #ffffff, 0 0 0 4px rgba(5,150,105,0.2)`): Focus ring on interactive elements.

### Named Rules
**The Flat-By-Default Rule.** Surface distinction comes from tonal layering (base → surface → input), not shadows. A shadow means something happened — an interaction, a state change, a temporary elevation.

## 5. Components

### Buttons
- **Shape:** Gently curved edges (12px radius). Compact padding for dense interfaces.
- **Primary** (Professional Emerald #059669, white text): Exclusive to the primary action. One per view.
- **Hover:** Darken to #047857, subtle green glow shadow, translateY(-1px).
- **Ghost** (#f1f5f9 bg, text primary, 1px border): Secondary actions, non-destructive alternatives.
- **Danger** (#fef2f2 bg, #b91c1c text, #fca5a5 border): Destructive actions (delete, void, clear).
- **Icon Button** (40x40px, ghost styling): Toolbar actions, table inline actions.

### Inputs / Fields
- **Style:** Subtle border, tinted bg (#f1f5f9), 12px radius, 44px min-height.
- **Focus:** Border shifts to Professional Emerald, bg brightens to white, green focus ring. No layout shift.
- **Error:** Red border (#dc2626), pink tint bg (#fef2f2).
- **Disabled:** Reduced opacity (0.5), not-allowed cursor, no interaction feedback.

### Cards / Containers
- **Corner Style:** 16px radius for large cards, 12px for small.
- **Background:** Pure white (#ffffff), no shadow at rest.
- **Border:** 1px solid rgba(15,23,42,0.06).
- **Padding:** 16px-24px depending on density.

### Navigation (Sidebar)
- **Style:** Single-column vertical nav, 260px expanded / 72px collapsed. Right-aligned (RTL).
- **Active:** Dark bg (#0f172a), white text, Professional Emerald icon.
- **Hover:** Light tint (#f1f5f9).
- **Collapsed:** Icons only (72px). Click reveals temporary popover with sub-items.
- **Module accordions:** Expandable sections with 2px indicator bar on active items.

### DataGrid
- **Style:** Border-collapse, hover highlight (#f8fafc), 45px row height.
- **Headers:** Muted text (#94a3b8), weight 800, uppercase tracking.
- **Cells:** Inline-editable for quantity/cost/price. Numeric data in Outfit.
- **Empty state:** Centered icon + message.

### Modals
- **Use sparingly** — inline alternatives preferred.
- **Style:** 16px radius, elevated shadow, centered overlay.
- **Overlay:** Semi-transparent (rgba(0,0,0,0.4)), click outside to close.

### Status Pills
- **Success:** Green tint bg (#ecfdf5), green text (#047857), green border.
- **Danger:** Red tint bg (#fef2f2), red text (#b91c1c), red border.
- **Warning:** Amber tint bg (#fffbeb), amber text (#b45309), amber border.
- **Info:** Blue tint bg (#f0f9ff), blue text (#0369a1), blue border.

## 6. Do's and Don'ts

### Do:
- **Do** use the gray tonal scale (base → surface → input) for surface distinction.
- **Do** reserve Professional Emerald for primary actions and active indicators only.
- **Do** use weight-driven hierarchy: 900 for page titles, 800 for sections, 700 for labels, 500 for body.
- **Do** use Outfit for all numeric data in financial contexts.
- **Do** compact tables tightly (45px rows, 11-13px type) — density serves power users.
- **Do** use RTL variants for directional styles instead of hardcoded left/right.
- **Do** provide hover, focus, active, and disabled states for every interactive component.
- **Do** use flat surfaces at rest; shadows indicate state change.
- **Do** use semantic colors strictly for status: green for good, red for bad, amber for caution, blue for info.

### Don't:
- **Don't** use `#000` or `#fff` — tint every neutral toward the cool slate hue.
- **Don't** use side-stripe colored borders (border-left/border-right > 1px) on cards, list items, or alerts.
- **Don't** use gradient text for emphasis — use weight or size instead.
- **Don't** use glassmorphism or decorative blur effects.
- **Don't** use identical card grids with icon + heading + text repeated endlessly.
- **Don't** put decorative motion on screens — motion conveys state, not style.
- **Don't** use display fonts in UI labels, buttons, or data.
- **Don't** use em dashes in UI copy.
- **Don't** default to modals — exhaust inline and progressive alternatives first.
- **Don't** make it look like a generic POS template — this is a purpose-built professional tool.
