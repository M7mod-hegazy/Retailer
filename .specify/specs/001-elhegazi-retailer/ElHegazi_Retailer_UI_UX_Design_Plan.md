# ElHegazi Retailer — Complete UI/UX & Design System Plan
## Dark Glassmorphism · Arabic RTL · Micro-Animations · Every Screen · Every Interaction
### Version 1.0 | April 2026

---

# TABLE OF CONTENTS

| # | Section |
|---|---------|
| 1 | Design Philosophy & Visual Language |
| 2 | Color System |
| 3 | Typography System (Arabic-First) |
| 4 | Spacing, Radius & Shadow System |
| 5 | Animation & Motion System |
| 6 | Global Components Design |
| 7 | App Shell & Navigation |
| 8 | Login & License Screens |
| 9 | Setup Wizard |
| 10 | Dashboard |
| 11 | POS Sales Screen |
| 12 | Items & Prices |
| 13 | Customers & Suppliers |
| 14 | Purchases |
| 15 | Sales Returns |
| 16 | Payments |
| 17 | Expenses & Revenues |
| 18 | Stock Management |
| 19 | Reports |
| 20 | Operations |
| 21 | Settings |
| 22 | Notifications Center |
| 23 | Shift Management |
| 24 | Global Search |
| 25 | Smart Help System |
| 26 | Print Layouts |
| 27 | Mobile / LAN Browser Layout |
| 28 | Tailwind Config & CSS Variables |
| 29 | Animation Code Reference |
| 30 | RTL Rules & Implementation |

---

# 1. DESIGN PHILOSOPHY & VISUAL LANGUAGE

## 1.1 Core Aesthetic: Dark Glassmorphism

ElHegazi Retailer uses **Dark Glassmorphism** — frosted glass panels floating over a deep dark gradient background with glowing ambient color orbs. This creates:
- Visual depth without heavy shadows
- A premium, modern feel that impresses customers
- Clear hierarchy between background, panels, and foreground actions
- A dramatic contrast that makes numbers and data stand out

## 1.2 The "Living Background"

The app background is never static. It uses **slow-moving ambient gradient orbs** — large blurred circles of deep color that drift very slowly. This makes the background feel alive even when nothing else is animating.

```css
/* The living background — 3 ambient orbs */
.app-background {
  background: #0A0E1A;  /* Deep dark navy base */
  position: fixed;
  inset: 0;
  overflow: hidden;
}

.orb-1 {
  /* Deep teal/green orb — top right */
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%);
  position: absolute; top: -200px; right: -200px;
  animation: orb-drift-1 25s ease-in-out infinite;
  border-radius: 50%;
  filter: blur(40px);
}

.orb-2 {
  /* Deep purple orb — bottom left */
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(124, 58, 237, 0.12) 0%, transparent 70%);
  position: absolute; bottom: -150px; left: -150px;
  animation: orb-drift-2 30s ease-in-out infinite;
  border-radius: 50%;
  filter: blur(50px);
}

.orb-3 {
  /* Warm amber orb — center left — very subtle */
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, transparent 70%);
  position: absolute; top: 40%; left: 20%;
  animation: orb-drift-3 20s ease-in-out infinite;
  border-radius: 50%;
  filter: blur(60px);
}

@keyframes orb-drift-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%       { transform: translate(-40px, 30px) scale(1.05); }
  66%       { transform: translate(20px, -20px) scale(0.95); }
}
@keyframes orb-drift-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%       { transform: translate(30px, -40px) scale(1.08); }
}
@keyframes orb-drift-3 {
  0%, 100% { transform: translate(0, 0); }
  50%       { transform: translate(-20px, 20px); }
}
```

## 1.3 Glass Panel Formula

Every card, modal, sidebar, and panel uses this exact glass formula:

```css
/* Standard glass panel */
.glass-panel {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
}

/* Elevated glass (modals, dropdowns) */
.glass-elevated {
  background: rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05);
}

/* Active/selected glass */
.glass-active {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
}
```

---

# 2. COLOR SYSTEM

## 2.1 Base Palette

```javascript
// tailwind.config.js — colors
colors: {
  // ── Background Layers ─────────────────────────────
  bg: {
    base:     '#0A0E1A',   // Deepest background
    surface:  '#0F1525',   // Card/panel background
    elevated: '#151C30',   // Modals, dropdowns
    overlay:  '#1A2238',   // Hover states
  },

  // ── Brand — Emerald Green (primary) ───────────────
  // This is the ElHegazi brand color
  primary: {
    50:       '#ECFDF5',
    100:      '#D1FAE5',
    200:      '#A7F3D0',
    300:      '#6EE7B7',
    400:      '#34D399',
    DEFAULT:  '#10B981',   // Main brand green
    600:      '#059669',
    700:      '#047857',
    800:      '#065F46',
    900:      '#064E3B',
    glow:     'rgba(16, 185, 129, 0.4)',  // For glow effects
  },

  // ── Semantic Colors ───────────────────────────────
  success: {
    DEFAULT:  '#10B981',
    light:    'rgba(16, 185, 129, 0.15)',
    glow:     'rgba(16, 185, 129, 0.3)',
  },
  danger: {
    DEFAULT:  '#EF4444',
    light:    'rgba(239, 68, 68, 0.15)',
    glow:     'rgba(239, 68, 68, 0.3)',
  },
  warning: {
    DEFAULT:  '#F59E0B',
    light:    'rgba(245, 158, 11, 0.15)',
    glow:     'rgba(245, 158, 11, 0.3)',
  },
  info: {
    DEFAULT:  '#3B82F6',
    light:    'rgba(59, 130, 246, 0.15)',
    glow:     'rgba(59, 130, 246, 0.3)',
  },

  // ── Text ──────────────────────────────────────────
  text: {
    primary:   '#F1F5F9',   // Main text — near white
    secondary: '#94A3B8',   // Secondary text
    muted:     '#475569',   // Muted/disabled text
    accent:    '#10B981',   // Brand-colored text
  },

  // ── Borders ───────────────────────────────────────
  border: {
    subtle:  'rgba(255, 255, 255, 0.06)',
    normal:  'rgba(255, 255, 255, 0.10)',
    strong:  'rgba(255, 255, 255, 0.18)',
    accent:  'rgba(16, 185, 129, 0.35)',
  },
}
```

## 2.2 Color Semantic Rules

| Context | Color | Usage |
|---------|-------|-------|
| Primary actions (Save, Confirm) | `primary.DEFAULT` (#10B981) | Buttons, active states, progress |
| Destructive actions (Delete) | `danger.DEFAULT` (#EF4444) | Delete buttons, void invoices |
| Warnings (low stock, due cheques) | `warning.DEFAULT` (#F59E0B) | Alert badges, warning toasts |
| Information | `info.DEFAULT` (#3B82F6) | Info tooltips, neutral notifications |
| Cash/money values | `primary.400` (#34D399) | All currency displays |
| Negative amounts (returns, deductions) | `danger.DEFAULT` | Negative numbers |
| Stock status — OK | `success.DEFAULT` | Green stock badge |
| Stock status — Low | `warning.DEFAULT` | Orange stock badge |
| Stock status — Out | `danger.DEFAULT` | Red stock badge |
| Shift open | `success.DEFAULT` | Shift status pill |
| Shift closed | `text.muted` | Shift status pill |

## 2.3 Glow Effects

Glow effects are used on active/focused elements and important numbers to create the "premium" feel:

```css
/* Primary button glow */
.btn-primary {
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.3),
              0 4px 15px rgba(16, 185, 129, 0.2);
}
.btn-primary:hover {
  box-shadow: 0 0 30px rgba(16, 185, 129, 0.5),
              0 8px 25px rgba(16, 185, 129, 0.3);
}

/* Danger button glow */
.btn-danger {
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
}

/* Large number glow (invoice total, dashboard KPIs) */
.number-glow {
  text-shadow: 0 0 20px rgba(16, 185, 129, 0.6),
               0 0 40px rgba(16, 185, 129, 0.3);
}
```

---

# 3. TYPOGRAPHY SYSTEM (ARABIC-FIRST)

## 3.1 Font Stack

```css
/* Primary: Noto Sans Arabic — covers all Arabic characters beautifully */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;600;700;800;900&display=swap');
/* Secondary for numbers and Latin: Inter — pairs well with Arabic */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

body {
  font-family: 'Noto Sans Arabic', 'Inter', sans-serif;
  direction: rtl;
  text-align: right;
}

/* Numbers always use Inter for consistent digits */
.number, .currency, .quantity, .invoice-number {
  font-family: 'Inter', sans-serif;
  font-variant-numeric: tabular-nums; /* Prevents layout shift on number changes */
}
```

## 3.2 Type Scale

```css
/* All sizes in the design */
--text-xs:   12px;   /* Badge labels, hints, footnotes */
--text-sm:   13px;   /* Table cell secondary info */
--text-base: 14px;   /* Default body text */
--text-md:   15px;   /* Slightly emphasized body */
--text-lg:   16px;   /* Card titles, section headings */
--text-xl:   18px;   /* Page sub-titles */
--text-2xl:  22px;   /* Page titles */
--text-3xl:  28px;   /* Dashboard KPI numbers */
--text-4xl:  36px;   /* POS invoice total */
--text-5xl:  48px;   /* Big KPI highlight */
--text-display: 64px; /* Splash/hero numbers */
```

## 3.3 Arabic Typography Rules

```css
/* Arabic text needs 20% more line height than Latin */
p, li, td { line-height: 1.8; }
h1, h2, h3 { line-height: 1.4; }

/* Arabic font size compensation — Arabic glyphs appear smaller */
.ar-text { font-size: 1.05em; }

/* Mixed Arabic + Latin numbers */
.mixed-number {
  font-family: 'Inter', 'Noto Sans Arabic', sans-serif;
  direction: ltr;    /* Numbers always LTR */
  display: inline-block;
}

/* Invoice numbers, codes — always LTR regardless of page direction */
.code, .invoice-ref, .barcode-text {
  direction: ltr;
  font-family: 'Inter', monospace;
  letter-spacing: 0.05em;
}
```

---

# 4. SPACING, RADIUS & SHADOW SYSTEM

## 4.1 Spacing Scale

```
4px   (1 unit)  — Internal icon padding
8px   (2 units) — Tight element gaps
12px  (3 units) — Form field internal padding
16px  (4 units) — Card padding (compact)
20px  (5 units) — Default element spacing
24px  (6 units) — Card padding (standard)
32px  (8 units) — Section spacing
40px  (10 units) — Major section gaps
48px  (12 units) — Page-level padding
```

## 4.2 Border Radius Scale

```
4px   — Badges, small tags
8px   — Buttons, inputs, small cards
12px  — Standard cards
16px  — Large cards, modals
20px  — Feature panels
24px  — Hero panels
9999px — Pills, full-round buttons
```

## 4.3 Shadow Layers

```css
/* Card shadow — lifts panel off background */
--shadow-card: 0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.2);

/* Elevated shadow — modals, dropdowns */
--shadow-elevated: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.06);

/* Focus ring */
--shadow-focus: 0 0 0 3px rgba(16, 185, 129, 0.4);

/* Button active press */
--shadow-pressed: inset 0 2px 4px rgba(0, 0, 0, 0.3);

/* Brand glow — primary interactive elements */
--shadow-glow-green: 0 0 20px rgba(16, 185, 129, 0.35), 0 4px 12px rgba(16, 185, 129, 0.2);

/* Danger glow */
--shadow-glow-red: 0 0 20px rgba(239, 68, 68, 0.35);

/* Warning glow */
--shadow-glow-amber: 0 0 20px rgba(245, 158, 11, 0.35);
```

---

# 5. ANIMATION & MOTION SYSTEM

## 5.1 Animation Philosophy

**Rule:** Every state change must be animated. Nothing should snap instantly. Duration and easing must feel natural, not mechanical.

```
Enter animations:  ease-out (starts fast, slows at end) — feels responsive
Exit animations:   ease-in  (starts slow, speeds at end) — feels intentional
Hover:             ease-in-out — balanced
Spring/bounce:     cubic-bezier(0.34, 1.56, 0.64, 1) — premium feel
```

## 5.2 Duration Scale

```
--duration-instant: 80ms    — Input focus rings, checkbox tick
--duration-fast:   150ms    — Hover color changes, small badges
--duration-normal: 250ms    — Buttons, cards, dropdowns open
--duration-slow:   400ms    — Modals, page transitions, drawers
--duration-slower: 600ms    — Dashboard number count-up
--duration-lazy:   800ms    — Onboarding animations, splash
```

## 5.3 Standard Micro-Interactions Library

### Button Interactions
```css
.btn {
  transition: all 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
  transform: translateY(0) scale(1);
}
.btn:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: var(--shadow-glow-green);
}
.btn:active {
  transform: translateY(0) scale(0.97);
  box-shadow: var(--shadow-pressed);
  transition-duration: 80ms;
}
```

### Card Hover — Lift Effect
```css
.card {
  transition: transform 250ms ease-out,
              box-shadow 250ms ease-out,
              border-color 250ms ease-out;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4),
              0 0 0 1px rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.25);
}
```

### Input Focus
```css
.input {
  transition: border-color 150ms ease, box-shadow 150ms ease,
              background 150ms ease;
}
.input:focus {
  border-color: rgba(16, 185, 129, 0.6);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15),
              0 0 12px rgba(16, 185, 129, 0.1);
  background: rgba(255, 255, 255, 0.06);
  outline: none;
}
```

### Table Row Hover
```css
.table-row {
  transition: background 120ms ease;
}
.table-row:hover {
  background: rgba(255, 255, 255, 0.04);
  /* Subtle left border accent in RTL = right border */
  border-inline-start: 2px solid rgba(16, 185, 129, 0.4);
}
.table-row:hover .row-actions {
  opacity: 1;
  transform: translateX(0);
}
.row-actions {
  opacity: 0;
  transform: translateX(8px);  /* Slides in from right in LTR; RTL auto-flips */
  transition: opacity 150ms ease, transform 150ms ease;
}
```

### Badge / Pill Pulse (for notifications/alerts)
```css
@keyframes pulse-ring {
  0%   { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.6); opacity: 0; }
}
.badge-pulse::before {
  content: '';
  position: absolute; inset: -3px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-ring 1.5s ease-out infinite;
}
```

### Modal Enter/Exit
```css
/* Modal backdrop */
.modal-backdrop {
  animation: fadeIn 250ms ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Modal panel */
.modal-panel {
  animation: modalEnter 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes modalEnter {
  from { opacity: 0; transform: scale(0.92) translateY(16px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* Modal exit */
.modal-panel[data-closing] {
  animation: modalExit 200ms ease-in forwards;
}
@keyframes modalExit {
  to { opacity: 0; transform: scale(0.94) translateY(8px); }
}
```

### Drawer Slide (Sidebar, panels)
```css
/* Sidebar — slides from right in RTL */
.sidebar {
  transform: translateX(100%);  /* RTL: off-screen to the right */
  transition: transform 350ms cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar[data-open] {
  transform: translateX(0);
}
```

### Toast Notification
```css
@keyframes toastSlide {
  from {
    opacity: 0;
    transform: translateX(calc(100% + 16px));  /* Slides from right in RTL */
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.toast {
  animation: toastSlide 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast[data-removing] {
  animation: toastSlide 250ms ease-in reverse forwards;
}
```

### Number Count-Up (Dashboard KPIs)
```javascript
// Animate numbers from 0 to target on mount
function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let startTime;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}
```

### Barcode Scan Flash (POS)
```css
/* When item is scanned — brief green flash on the item row */
@keyframes scanFlash {
  0%   { background: rgba(16, 185, 129, 0); }
  20%  { background: rgba(16, 185, 129, 0.3); }
  100% { background: rgba(16, 185, 129, 0); }
}
.scan-flash {
  animation: scanFlash 600ms ease-out;
}
```

### Invoice Total Bounce (POS — when total changes)
```css
@keyframes totalBounce {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.08); }
  70%  { transform: scale(0.97); }
  100% { transform: scale(1); }
}
.total-bounce {
  animation: totalBounce 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Skeleton Loading
```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.03) 25%,
    rgba(255,255,255,0.07) 50%,
    rgba(255,255,255,0.03) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}
```

### Page Transition (between routes)
```css
/* Each page wraps in this — fades + slides up slightly on enter */
@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.page-wrapper {
  animation: pageEnter 300ms ease-out;
}
```

### Success Checkmark (after saving)
```css
/* Animated checkmark circle — drawn via stroke-dashoffset */
.success-circle {
  stroke-dasharray: 166;
  stroke-dashoffset: 166;
  animation: drawCircle 600ms ease-out forwards;
}
.success-check {
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  animation: drawCheck 300ms ease-out 400ms forwards;
}
@keyframes drawCircle {
  to { stroke-dashoffset: 0; }
}
@keyframes drawCheck {
  to { stroke-dashoffset: 0; }
}
```

### Floating Label Input
```css
/* Label floats up when input is focused or has value */
.floating-label-wrapper {
  position: relative;
}
.floating-label {
  position: absolute;
  top: 50%;
  right: 14px;   /* RTL: label on the right */
  transform: translateY(-50%);
  transition: all 150ms ease;
  pointer-events: none;
  color: var(--text-muted);
  font-size: 14px;
}
.floating-label-wrapper:focus-within .floating-label,
.floating-label-wrapper.has-value .floating-label {
  top: -10px;
  transform: translateY(0);
  font-size: 11px;
  color: var(--primary);
  background: var(--bg-surface);
  padding: 0 4px;
}
```

---

# 6. GLOBAL COMPONENTS DESIGN

## 6.1 Button System

### Primary Button
```
Background:  linear-gradient(135deg, #10B981 0%, #059669 100%)
Text:        White (#F1F5F9), font-weight: 600, 14px
Padding:     10px 20px
Radius:      8px
Shadow:      0 0 20px rgba(16,185,129,0.3)
Hover:       translateY(-2px), shadow increases to 0 0 30px rgba(16,185,129,0.5)
Active:      translateY(0), scale(0.97), shadow becomes inset
Loading:     Spinner replaces icon (never disables text entirely)
Transition:  150ms cubic-bezier(0.34, 1.56, 0.64, 1)
```

### Danger Button
```
Background:  linear-gradient(135deg, #EF4444 0%, #DC2626 100%)
Shadow:      0 0 20px rgba(239,68,68,0.3)
Hover:       Glow intensifies to rgba(239,68,68,0.5)
```

### Secondary Button (Ghost)
```
Background:  rgba(255,255,255,0.05)
Border:      1px solid rgba(255,255,255,0.10)
Text:        #94A3B8
Hover:       Background rgba(255,255,255,0.09), border rgba(255,255,255,0.18),
             text #F1F5F9, no glow
```

### Icon Button
```
Background:  rgba(255,255,255,0.05)
Size:        36×36px
Radius:      8px
Hover:       rgba(255,255,255,0.09), slight scale(1.05)
Active:      scale(0.93)
```

## 6.2 Input Fields

```
Background:     rgba(255,255,255,0.04)
Border:         1px solid rgba(255,255,255,0.08)
Radius:         8px
Padding:        10px 14px
Text:           #F1F5F9, 14px
Placeholder:    #475569
Focus border:   rgba(16,185,129,0.6)
Focus glow:     0 0 0 3px rgba(16,185,129,0.15)
Error border:   rgba(239,68,68,0.6)
Error glow:     0 0 0 3px rgba(239,68,68,0.15)
Disabled:       opacity: 0.5, cursor: not-allowed
```

**All inputs use floating labels (not placeholder-only).**

### Select / Dropdown
```
Same as input
Chevron icon:      Right side in LTR, LEFT side in RTL (auto-flipped)
Dropdown panel:    Glass elevated
Options hover:     rgba(16,185,129,0.1) background
Selected option:   rgba(16,185,129,0.15) + left border accent (RTL: right)
Dropdown enter:    slideDown 200ms ease-out + fade
```

### Currency Input
```
Special display: Large Inter font for the number part
Symbol:          Shows AFTER the number in Arabic: "٢٥٠.٠٠ ر.س"
Thousands sep:   Auto-formatted as user types with commas
Color:           #34D399 when valid, dim otherwise
```

## 6.3 Table Component

```
Header row:
  Background:  rgba(255,255,255,0.03)
  Text:        #94A3B8, 12px, font-weight: 600, uppercase, letter-spacing: 0.05em
  Border:      1px solid rgba(255,255,255,0.06) on bottom

Data rows:
  Alternating: even rows rgba(255,255,255,0.01) — very subtle
  Border:      1px solid rgba(255,255,255,0.04) on bottom
  Hover:       rgba(255,255,255,0.04), left border accent 2px solid primary
  Selected:    rgba(16,185,129,0.08), left border 2px solid primary
  Row actions: Hidden by default, slide in on hover (opacity 0→1, translateX)

Column types:
  Numeric:     font-family: Inter, text-end (RTL-aware right-align)
  Currency:    text-end, color: #34D399
  Date:        font-family: Inter, ltr direction inline
  Status:      Colored pill badge
  Actions:     Always last column (in RTL = leftmost visually)
```

## 6.4 Badge / Status Pill

```
Base style:  4px radius, 6px 10px padding, font-weight: 600, font-size: 11px

Active/OK:   background rgba(16,185,129,0.15), text #10B981, border rgba(16,185,129,0.3)
Danger/Out:  background rgba(239,68,68,0.15), text #EF4444, border rgba(239,68,68,0.3)
Warning:     background rgba(245,158,11,0.15), text #F59E0B, border rgba(245,158,11,0.3)
Info:        background rgba(59,130,246,0.15), text #3B82F6, border rgba(59,130,246,0.3)
Neutral:     background rgba(255,255,255,0.07), text #94A3B8

All have subtle inner glow matching their color
Hover:       Lifts slightly (translateY -1px)
With pulse:  Absolute ::before ring for live/critical alerts
```

## 6.5 Modal / Dialog

```
Backdrop:     rgba(0,0,0,0.7) blur(4px), fadeIn 250ms
Panel:        glass-elevated, radius: 16px
Max width:    600px (form), 900px (wide)
Animation:    modalEnter (scale + translateY spring)
Header:       Bold title + close X (top-left in RTL)
Footer:       Action buttons — Cancel always on right in RTL, Save on left
Close on esc: Yes, with dirty-check warning
Scroll:       Max-height 80vh, inner scroll on content only

Close button (X):
  Position: top-left in RTL
  Style:    icon button, hover: rotation 90deg + color change to danger
  Transition: 200ms ease
```

## 6.6 Tooltips

```
Background:    rgba(15,21,37,0.95) — near opaque dark glass
Border:        1px solid rgba(255,255,255,0.1)
Text:          #F1F5F9, 12px
Padding:       6px 10px
Radius:        6px
Arrow:         Small triangle pointing to trigger
Animation:     fadeIn + translateY(4px → 0) in 150ms
Max width:     220px (wraps)
Delay:         400ms (prevents tooltip flicker on fast mouse passes)
Placement:     Auto collision-aware (see Chapter 35 help system)
```

## 6.7 Confirm Dialog

```
Panel:         glass-elevated, smaller modal (400px max)
Icon:          Large warning/danger icon with colored glow ring
Title:         Bold, 18px
Body:          14px gray, describes consequence
Animation:     Same as modal + icon bounces in with spring
Buttons:       [Cancel] [Confirm — red with danger glow]
Confirm text:  Must describe the action: "نعم، حذف الفاتورة" not just "تأكيد"
Type to confirm: For very destructive actions (delete customer with history),
                 user must type "حذف" before button enables
```

---

# 7. APP SHELL & NAVIGATION

## 7.1 Sidebar Design (Desktop — RTL Right Side)

```
Position:      Fixed, right side (RTL default)
Width:         Expanded: 256px | Collapsed: 64px (icon-only)
Background:    glass-panel with extra subtle dark gradient
Border:        1px solid rgba(255,255,255,0.06) on left edge (RTL)
Transition:    width 300ms cubic-bezier(0.4,0,0.2,1)

App logo area (top):
  Height: 64px
  Logo: ElHegazi Retailer logo + "إلهيجازي للتجزئة" text
  Text fades out when collapsed (opacity transition)
  Separator line: 1px gradient line below (transparent → rgba(255,255,255,0.06) → transparent)

Nav items:
  Height:  44px each
  Padding: 0 12px
  Radius:  8px (inside sidebar padding)
  Gap:     2px between items

  Default:  transparent background, text #94A3B8
  Hover:    rgba(255,255,255,0.05), text #F1F5F9
             translateX(3px) — slides slightly toward content in RTL
  Active:   rgba(16,185,129,0.12), text #10B981, border-right 3px solid #10B981
            (RTL: border on the right = inner/content side)
  Active glow: subtle right-edge glow matching primary color

  Icon:    24px, marginEnd: 12px when expanded
           When collapsed: icon centered, tooltip on hover shows label
  Label:   14px, font-weight: 500
           Slides out with opacity when collapsing

Sub-menu items:
  Indent: 16px from parent
  Smaller: 13px
  Animated: height 0→auto with overflow hidden + fade
  Chevron: Rotates 90deg when sub-menu open (RTL-aware)

User area (bottom):
  Avatar: 32px circle, initials fallback
  Name + role below
  Logout button with door-exit icon
  Hover: slide up 2px

Collapse toggle button:
  Position: Bottom of sidebar above user area
  Icon: Arrow chevron that rotates 180deg on collapse
  Tooltip: "طي القائمة" / "توسيع القائمة"
```

## 7.2 Topbar Design

```
Height:     60px
Background: rgba(10,14,26,0.8) with backdrop-filter blur(20px)
Border:     1px solid rgba(255,255,255,0.06) on bottom
Sticky:     Yes, always on top (z-index: 50)

Contents (RTL order — right to left visually):
  1. Page title + breadcrumb (right side)
  2. Global search (center)
  3. Notification bell (left side)
  4. User menu (leftmost)

Page title:
  Bold 18px, white
  Breadcrumb below: 12px gray, "الرئيسية > المبيعات > فواتير البيع"
  Breadcrumb items separated by / (RTL: auto)

Global search:
  Width: 280px normal, expands to 400px on focus
  Transition: width 300ms ease-out
  Background: rgba(255,255,255,0.05)
  Placeholder: "بحث... Ctrl+K"
  Icon: search icon, animates to X when focused
  Shortcut badge: shows "Ctrl+K" pill that fades when focused
  Results dropdown: glassmorphism, grouped sections

Notification bell:
  Icon with animated pulse ring if unread notifications > 0
  Badge: count pill (red, top-right of icon)
  Hover: bell shakes animation 400ms
  Click: dropdown or navigate to /notifications

User menu:
  Avatar + name
  Dropdown on click:
    - Profile / Change password
    - Switch language (AR/EN)
    - Theme toggle
    - Logout
  Dropdown: glassmorphism, 200px wide
```

## 7.3 Breadcrumb Navigation

```
Separator:    › (chevron right) — auto-flipped in RTL to ‹
Items:        Clickable links except last (current page)
Hover:        Color transitions to primary
Active:       Primary color, not clickable
Animation:    Slides in from right on route change (RTL: from left)
Transition:   Each item staggers in by 50ms
```

---

# 8. LOGIN & LICENSE SCREENS

## 8.1 Login Screen

```
Layout:
  Full screen with living background (orbs)
  Centered glass card: 420px wide
  Logo above card with subtle drop animation on load

Card entrance:
  Comes down from above: translateY(-40px) → 0
  Fade in: opacity 0 → 1
  Duration: 600ms cubic-bezier(0.34, 1.56, 0.64, 1)
  Logo enters first, then card slides in 150ms later

Logo animation on login page:
  Gentle pulse every 4 seconds (scale 1→1.03→1)
  Subtle glow ring expands and fades

Form fields:
  Both fields fade in staggered (username first, then password, 100ms apart)
  Each field slides up from translateY(8px) on appear

Login button:
  Full width
  On hover: grows to full width + 4px, glow increases
  On click: button shows spinner, label changes to "جاري الدخول..."
  On success: button turns into green checkmark animation

Error state:
  Fields shake horizontally: translateX -8px → +8px × 3 times, 400ms total
  Error message slides down below the form

Branding footer:
  "نظام إلهيجازي للتجزئة" — subtle, 12px gray
  Version number
```

## 8.2 License Activation Screen

```
Same full-screen glass card layout
License key input: Monospace font, auto-formats XXXX-XXXX-XXXX-XXXX as user types
Hardware ID: Shown in small code block below, copyable
Activate button: Same as login button
Status indicator: Three states with animated transitions:
  - Checking: Spinning ring animation
  - Success: Green checkmark draw animation
  - Error: Red X with shake
```

---

# 9. SETUP WIZARD

```
Layout:
  Full screen — large centered card (700px wide)
  Progress bar at top showing 5 steps
  Step indicators: numbered circles connected by line

Progress bar:
  Fills with primary color as steps complete
  Each step dot: inactive (gray ring), active (pulsing green glow), done (filled green ✓)
  Transition between steps: 400ms ease

Step transitions:
  Outgoing step: slides out to the left (RTL: right) + fades
  Incoming step: slides in from the right (RTL: left) + fades
  Duration: 350ms

Each step:
  Title: 22px bold, slides in with step
  Subtitle: 14px gray
  Form fields: appear one by one with 80ms stagger (translateY(8px) → 0)

Navigation buttons:
  [← السابق] and [التالي →] — RTL-aware arrows
  On final step: [✓ إنهاء الإعداد]
  
  "التالي" button: pulse animation when all fields valid
  Disabled state: opacity 0.4, no hover effects

Logo upload area:
  Dashed border box with upload icon
  Drag-over state: border color changes to primary, background lightens
  Icon bounces on drag-over
  After upload: image preview slides in with scale 0.8→1
```

---

# 10. DASHBOARD

## 10.1 KPI Cards (4 cards, top row)

```
Each card:
  Glass panel, 12px radius
  Hover: lift effect (translateY -4px), border accent color glow
  Content:
    - Icon in colored glass circle (top)
    - Arabic label (medium, gray)
    - Large number (36px Inter, bold, primary color glow)
    - Trend indicator (↑ green / ↓ red) with small text

Number count-up:
  On page load, all 4 numbers count up from 0 simultaneously
  Duration: 800ms ease-out cubic

Icon circle:
  40px glass circle with colored background matching card theme
  Subtle rotation animation on hover (5 degrees)

KPI cards:
  1. إجمالي مبيعات اليوم — green
  2. عدد الفواتير اليوم — blue
  3. إجمالي المصروفات — amber
  4. الأرباح الصافية — green/purple
```

## 10.2 Charts Section

```
Revenue line chart (Recharts):
  Background: glass panel
  Line: gradient from primary-300 to primary-600
  Area fill: gradient from rgba(16,185,129,0.3) to rgba(16,185,129,0)
  Grid lines: rgba(255,255,255,0.05)
  Tooltip: glass-elevated card with shadow
  Hover dot: expands from 4px to 8px with glow ring
  Animation: line draws from left to right on mount (1000ms)

Category pie chart:
  Donut style (not full pie)
  Center: total amount in large text
  Legend: right side in RTL, items fade in staggered
  Hover slice: expands out 8px, tooltip shows
  Enter animation: segments rotate in from 0 degrees

Top items bar chart:
  Horizontal bars (better for Arabic labels)
  Bars fill from 0 width with 600ms stagger (100ms per bar)
  Hover: bar brightens + tooltip
```

## 10.3 Recent Activity Feed

```
Each item:
  Left icon circle (colored) + description + time
  In RTL: icon circle on RIGHT
  Items stagger-fade in from bottom: each 50ms apart
  Hover: subtle background highlight
  New items (added live): slide down from above with green flash
```

## 10.4 Quick Actions

```
4 large glass buttons:
  [نقطة البيع] [فاتورة شراء] [عميل جديد] [تقرير اليوم]

Each button:
  80px height, icon above text
  Icon: 28px, colored
  Hover: translateY(-6px), scale(1.02), glow
  Active: scale(0.97)
  Stagger fade-in on dashboard load
```

---

# 11. POS SALES SCREEN

## 11.1 Layout & Background

```
Full screen layout (hides topbar, uses F11 fullscreen option)
Background: dark — same living background orbs

Left panel (65%):
  Search bar at top
  Category tabs (horizontal scroll)
  Item grid below

Right panel (35%):
  Glass panel — customer + invoice lines + payment + totals
```

## 11.2 POS Search Bar (Critical Path)

```
Height:     52px — bigger than normal inputs
Font size:  16px
Placeholder: "ابحث أو امسح الباركود... (F2)"
Animation on focus:
  Box expands slightly: box-shadow grows from 0 to full glow ring
  Background lightens
  Camera/barcode icon animates: pulse once

Barcode scan flash:
  When scanner fires: input briefly highlights green (100ms)
  The matched item in grid: green flash animation (scanFlash)
```

## 11.3 Category Filter Tabs

```
Horizontal scrolling row
Each tab: pill shape, 36px height
Default:  transparent + gray text
Active:   primary background + white text + subtle glow
Hover:    rgba(255,255,255,0.07)
Scroll:   Hidden scrollbar, drag to scroll, fade at edges indicating more

Active tab transition:
  Uses a "sliding underline" approach — the highlight slides between tabs
  300ms ease-out cubic
  Not a simple color swap — the background shape MOVES
```

## 11.4 Item Grid

```
Cards: 3 or 4 columns (configurable)
Each item card:
  Background: glass-panel
  Top half: item image (or colored icon if no image)
  Bottom: item name (bold, 13px), price (Inter, primary color)
  Stock badge: tiny pill top-right corner
  Hover:
    - Card lifts translateY(-6px)
    - Subtle green border glow
    - Image/icon scales slightly (scale 1.05)
    - Price pulses (scale 1→1.05→1 in 200ms)
    - "Add" icon fades in on top
  Active (tap):
    - Quick scale(0.95) then back — haptic feel
    - Brief green flash on card
    - Added item in invoice lines: NEW row slides down from above (300ms)

Out-of-stock items:
  Grayscale filter
  "نفد المخزون" overlay
  Pointer events: none (cannot tap)
  Hover: red glow instead of green

Item variants (size/color):
  After tap: small variant picker slides up from bottom
  Options as pill grid
  Selected variant: primary color fill
```

## 11.5 Invoice Lines Panel

```
Each line row:
  Item name: bold, white
  Qty: editable inline — tap to edit
  Price: editable inline — shows pencil icon on hover if permission
  Line total: Inter, right-aligned, primary color
  Delete: X button, always visible, hover red glow

Editing a line:
  Tap on qty: input appears in place with auto-select all
  Input: large font (18px), centered
  +/- buttons: either side of qty input
  Confirm: tap outside or Enter
  Cancel: Escape

New line added:
  Slides in from top with spring animation
  Brief green background flash (scanFlash)

Line being deleted:
  Slides out to the right + fades (RTL: to the left)
  Row height collapses after exit
  Total bounces to reflect new value

Scrollable when many lines:
  Custom thin scrollbar (2px width, primary color, rounded)
```

## 11.6 Totals & Payment Panel

```
Subtotal, discount, tax, total — each row:
  Separator line: subtle gradient
  Label: gray, right-aligned (RTL)
  Value: Inter, larger font, end-aligned

Grand total row:
  Extra large font (36px)
  Primary color glow text
  Bounces every time it changes (totalBounce animation)

Payment method selector:
  4 large glass buttons: نقداً / آجل / بطاقة / متعدد
  Selected: primary glass + glow
  Hover: scale up + border brightens
  Icons in each button

Cash tendered input:
  Extra large (24px font)
  Change shown below with animation: slides down when change > 0

Save buttons:
  [حفظ وطباعة] — primary, full width, F12 shortcut badge visible
  [حفظ فقط] — secondary
  [إيقاف مؤقت] — ghost

On save:
  Button shows spinner
  Brief full-panel success overlay: checkmark animation + "تم الحفظ" (500ms then auto-dismiss)
  Panel resets with slide animation
  Success sound (visual pulse ring in green)
```

## 11.7 Held Invoices Drawer

```
Slides from the right side (RTL)
Shows up to 5 held invoice slots
Each slot: customer name + line count + total + time held
Empty slots: dashed box with "+" hint
Hover: slot lifts + primary glow
Resume: click → slides open + invoice contents animate in
```

## 11.8 Customer Selector

```
Auto-complete input at top of right panel
Results dropdown: glass-elevated
Each result:
  Customer name (bold) + phone + balance pill
Balance warning:
  If credit limit near: amber glow ring around result
  If blacklisted: red glow + lock icon
Creating new:
  "＋ عميل جديد" at bottom of results
  Click: small modal slides up with quick-add form
```

---

# 12. ITEMS & PRICES MODULE

## 12.1 Items List

```
Page header: title + "إضافة صنف" button (primary, top-left in RTL)
Search + filters row: glass panel

Table columns (RTL order right→left visually):
  الإجراءات | الحالة | المخزون | السعر | الوحدة | الباركود | الاسم | صورة | #

Image column:
  32px circle avatar
  If no image: colored circle with first Arabic letter
  Hover: image expands in tooltip (200×200 preview)

Actions column (always leftmost visually in RTL):
  Icons: Edit ✏️, View 👁, Delete 🗑
  Default: hidden (opacity: 0, translateX(8px))
  On row hover: icons slide in staggered (each 50ms apart)

Row hover:
  Background: rgba(255,255,255,0.04)
  Border-inline-start: 2px solid rgba(16,185,129,0.4)
  Transition: 120ms

Pagination:
  Glass panel at bottom
  Current page number bounces on change
  Arrow buttons: disabled state fades
```

## 12.2 Item Form (Create/Edit)

```
Section groups:
  Each section has a glowing colored left-border (RTL: right-border)
  Section title: 12px uppercase, spaced, gray
  Glass panel per section

Image upload:
  Large drag-drop zone (120px height)
  Dashed animated border (dashes rotate slowly)
  Drag-over: border solid primary, background pulse
  Image preview: fades in with scale 0.9→1 animation

Multiple barcodes:
  Tag-style: each barcode is a removable pill
  Add: type + Enter → pill slides in
  Remove: × on pill → pill shrinks and fades out

Price fields:
  4 price columns side-by-side
  Each highlights to primary color on focus
  Min price: special warning indicator if set below cost

Save button at bottom:
  Sticky bar that slides up from below on scroll
```

---

# 13. CUSTOMERS & SUPPLIERS

## 13.1 Customer List

```
Balance column:
  Positive (they owe us): primary color
  Zero: gray
  Shown as formatted currency

Status pill:
  Active: green
  Blacklisted: red + lock icon + pulse ring

Row click: navigates to customer detail
Action buttons appear on hover

Summary cards at top (total customers, total receivable, overdue):
  Glass stat cards, count-up on load
  Overdue card: amber glow when > 0
```

## 13.2 Customer Detail Page

```
Header:
  Large avatar (64px circle with initials)
  Name (22px bold), customer code, phone
  Status badge
  Action buttons (Edit, Blacklist, Add Payment)

Stats row:
  3 glass cards: Total Sales | Balance | Last Purchase Date
  Numbers count up on load
  Balance: extra large font with color (primary = owed, green = paid)

Tabs bar:
  Pills style (not bordered tabs)
  Active pill: primary color fills
  Slides between tabs with spring animation

Transaction table (inside tabs):
  Type column: colored icon pill (Invoice/Payment/Return)
  Each row stagger-fades in as the tab animates in
```

---

# 14. PURCHASES MODULE

## 14.1 Purchase Form

```
Identical layout to POS but for purchases
Supplier field replaces customer
Cost price fields instead of sell prices
Supplier invoice number: extra field with hint tooltip

After saving: stock increase animation
  Stock level badge on item temporarily shows +N in green then merges
  Brief green flash on each updated item row
```

---

# 15. SALES RETURNS

## 15.1 Return Flow

```
Step 1 — Search original invoice:
  Search input with "بحث برقم الفاتورة" placeholder
  Found invoice: slides in as preview card from right
  Invoice lines shown with checkboxes

Step 2 — Select items to return:
  Checkbox selects line
  Selected lines: highlight primary color
  Qty spinner appears next to selected line
  Running return total shows at bottom, updates live

Step 3 — Payment method for refund:
  Same payment panel as POS
  Red accent instead of green (this is a refund)

Save return:
  Button: red primary
  Success overlay: red-themed (return confirmed)
  Brief red flash on affected items
```

---

# 16. PAYMENTS MODULE

## 16.1 Payment Form

```
Customer balance shown large below customer selector:
  Primary color if positive (they owe us)
  Updates live as amount entered

Invoice allocation:
  Expandable section (chevron to reveal)
  Each invoice: checkbox, number, date, amount, remaining
  As payment is allocated:
    Invoice remaining animates down (count-down)
    Progress bar fills on each invoice
    Fully-paid invoices get green ✓ icon that bounces in

Payment method visual:
  Large icon for each method
  Selected: primary glow ring
```

---

# 17. EXPENSES & REVENUES

## 17.1 Expense List

```
Category shown as colored chip (each category has auto-assigned color from palette)
Amount: red tinted (it's an outgoing)
Receipt image: thumbnail, click to expand in lightbox

Lightbox:
  Backdrop blur, image centered
  Zoom on scroll
  Close: X or backdrop click
  Enter: fade + scale(0.9→1)
```

---

# 18. STOCK MANAGEMENT

## 18.1 Stock Levels Page

```
Color-coded rows:
  Normal stock:  default styling
  Low stock:     amber left-border, amber badge
  Out of stock:  red left-border, red badge, row background red tint
  Overstock:     blue badge

Stock level column:
  Mini inline progress bar (0 to max_stock)
  Fills with color matching stock status
  Animates fill on page load (width 0% → actual%)

Low stock items float to top (sorted)

Quick adjust button (per row):
  "+/-" icon
  Click: inline editor with +N / -N input
  Confirm: value animates to new number
```

## 18.2 Physical Count Page

```
Progress indicator:
  "Items counted: 45 / 320" with progress ring
  Ring fills as items are counted
  Percentage in center, bounces on each item confirmed

Variance column (System vs Counted):
  Green if match, orange if close, red if far off
  Count is editable inline by clicking

Confirm count button:
  Large, primary, disabled until all items have a value
  On confirm: rows flash green one by one in sequence (50ms stagger)
  Then summary modal slides in with totals
```

---

# 19. REPORTS MODULE

## 19.1 Reports Center

```
Grid of report cards (2 or 3 columns):
  Each card: icon + name + description + "عرض" button
  Category groups: المبيعات | المخزون | المالية | الكاشير
  Hover: card lifts + icon glows matching card category color

Report filter panel:
  Collapsible (chevron toggle)
  Date range picker:
    Calendar popup: glassmorphism
    Today / هذا الأسبوع / هذا الشهر buttons — quick select
    Selected range highlights in primary color
    Hover dates: secondary highlight
  Submit: "تحديث" button turns into spinner while loading

Report loading state:
  Table shows skeleton rows (shimmer animation)
  Chart shows skeleton shape (same dimensions as real chart)
  After data loads: content fades in with stagger

Export buttons:
  [PDF] [Excel] with icons
  Click: button shows "جاري التحضير..." + progress bar below
  Download ready: button flashes green + "تحميل جاهز"
```

## 19.2 Sales Heatmap Report

```
Grid of Day × Hour cells
Each cell: color intensity based on sales volume
  Low: dark transparent
  Medium: primary color at 30% opacity
  High: primary color at 80% opacity
  Peak: primary color 100% + slight glow

Cells animate in: each row stagger-fades in (100ms apart)
Hover: cell pops up (scale 1.3) + tooltip shows exact amount
```

---

# 20. OPERATIONS MODULE

## 20.1 Treasury Transfer

```
From/To selectors:
  Large cards showing treasury name + current balance
  Arrow in between: animated arrow bouncing toward destination
  On amount entry: animated flow from source to destination (visual effect)

Flow animation:
  Small dots move from source card to destination card along a curved path
  CSS path animation: 600ms, ease-in-out
  Triggered when user enters valid amount
```

## 20.2 Cheques Module

```
Cheque cards (not table rows) — visual card per cheque:
  Bank logo area (placeholder if not set)
  Amount: large Inter font
  Due date: with countdown "متبقي 3 أيام"
  Status pill with color

Due soon: amber glow ring on card
Overdue: red glow ring + pulsing badge

Status change:
  Card flips (CSS 3D flip 500ms) to show new status on back side
  Or: status pill slides from old to new with scale animation
```

---

# 21. SETTINGS MODULE

## 21.1 Settings Layout

```
Left sidebar (inner) — vertical tabs:
  Glass panel on left (RTL: right) side
  Tab items: same style as main sidebar
  Active: primary color indicator

Content panel:
  Glass panel, fills remaining space
  Each section fades in when tab changes

Settings tab change animation:
  Old content: opacity 1→0 + translateX(8px), 150ms
  New content: opacity 0→1 + translateX(0), 200ms
  50ms delay between exit and enter
```

## 21.2 Receipt Template Designer

```
Split screen:
  Left (40%): settings controls panel
  Right (60%): live preview

Live preview:
  Looks like an actual thermal receipt (white background, dark text)
  Has subtle paper texture background
  Updates in real-time as settings change (debounced 200ms)
  Transitions: each element fades in/out as toggled
  Preview container has a slight 3D tilt effect (perspective)

Toggle animations:
  Toggle on: element in preview slides down into place
  Toggle off: element in preview slides up and fades out
```

## 21.3 Theme / Display Settings

```
Theme toggle (Dark/Light):
  Custom animated toggle:
    Dark mode: moon icon, deep background
    Light mode: sun icon, light background
  Transition: full page theme transition with circular wipe effect
    Starting from the toggle position, circle expands to cover full screen

Language switcher (AR/EN):
  On switch: brief flip animation of the language button
  Then page dir attribute changes
  Content reflows with direction-aware transition
```

---

# 22. NOTIFICATIONS CENTER

## 22.1 Notification Bell Dropdown

```
Bell icon:
  On unread notifications: ring animation plays (bell shakes) — 400ms
  Badge: count number bounces in when count increases
  
  Hover: bell wiggles 15 degrees left-right (ring-bell animation)

Dropdown:
  glass-elevated, 360px wide
  Slides down from bell + fade: 250ms
  
  Header: "الإشعارات" + "قراءة الكل" link
  Separator
  Notification items (max 8 visible, scroll)

Each notification:
  Left (RTL: right) colored icon circle matching type
  Title bold + message 12px gray
  Time: relative ("منذ 5 دقائق")
  Unread: left (RTL: right) 3px border in notification color
  Background: slightly brighter than others

  Hover: background lightens
  
  New notification entry animation:
    Slides in from top (pushes others down)
    Brief color flash matching notification type
    Sound icon triggers if critical

  Mark as read:
    Border fades out
    Background dims
    Transition: 300ms

  Dismiss (×):
    Appears on hover (right side, RTL: left)
    Click: row slides to the right + opacity 0 (RTL: to left)
    Others close the gap smoothly
```

## 22.2 Critical Notifications (Full Toast)

```
Low stock:    amber toast, slides from top-right
Shift overdue: warning toast, stays until dismissed
License expiry: persistent banner under topbar (cannot dismiss)
  Banner: amber gradient, closes only via settings
  Pulsing border-bottom
```

---

# 23. SHIFT MANAGEMENT

## 23.1 Shift Open Modal

```
Large modal that MUST be completed before POS
Central design: clock animation showing current time
Opening balance input: extra large (40px font)
Currency hint below
Big green "فتح الوردية" button
Shift number shown: "الوردية #SHIFT-2026-00142"
```

## 23.2 Shift Status Bar (Inside POS)

```
Fixed at top of POS screen (below topbar)
Height: 36px
Background: rgba(16,185,129,0.1)
Content: Shift # | Cashier | Open since X hours | Running total
Live clock: ticks every second with fade transition
Pay-in/Pay-out: quick action icons
```

## 23.3 Shift Close Modal

```
Step 1: Summary
  The shift stats — all numbers count up from 0
  X-Report style display but inside modal
  
Step 2: Cash Count
  Large input for declared cash
  System expected shown above
  Difference calculated live:
    Match: green glow + "✓ مطابق"
    Small difference: amber warning
    Large difference: red warning + override required

Step 3: Print & Confirm
  Z-Report preview (scrollable)
  Two buttons: [طباعة و إغلاق] [إغلاق بدون طباعة]
  On close: modal exits with success animation
```

---

# 24. GLOBAL SEARCH

## 24.1 Search Overlay

```
Trigger: Ctrl+K or clicking topbar search
Animation:
  Backdrop: fadeIn 200ms
  Search panel: slides down from top + scale(0.95→1) 250ms spring
  Input auto-focuses

Panel: glass-elevated, centered, 600px wide, max-height 70vh
Search input: large (20px font), no background (just cursor line)
Placeholder: "ابحث في كل شيء..."

Results:
  Groups: الأصناف | العملاء | الموردون | الفواتير | المشتريات
  Each group header: small uppercase colored label
  Each result item:
    Icon circle + primary text + secondary text
    Hover: primary glass background
    Arrow key navigation: focus moves through results
    Active result: primary glow left-border

Transitions:
  Results section fades in as typing
  Each result stagger-appears (30ms apart)
  No results: empty state with magnifying glass SVG animation
```

---

# 25. SMART HELP SYSTEM (Tours & Tooltips)

## 25.1 Tour Spotlight

```
Backdrop: rgba(0,0,0,0.55) covers whole screen
Spotlight cutout: no background — lets target element show through
  Border: 2px solid rgba(59,130,246,0.7)
  Radius: 8px
  Spotlight follows element with smooth transition if element moves

Tour popup:
  glass-elevated, 320px wide
  Position: auto collision-aware (see Chapter 35)
  Animation: scales in from element direction (spring)

Step indicator dots:
  Active: primary color, scale(1.2)
  Inactive: gray
  Transition: smooth between steps

Navigation:
  [← السابق] [التالي →] — RTL-aware
  Final step: [انتهى ✓]
  Skip: small underlined text top-right

Target pulsing:
  While spotlight is on element, element has subtle pulsing ring
  ring expands outward every 2 seconds
```

## 25.2 Smart Tooltips (?)

```
(?) icon: 16px blue circle, fontweight bold
Hover cursor: pointer
Click opens:
  Tooltip: glass panel, 280px, RTL-aware collision detection
  Arrow pointing to trigger
  Text: 12px, relaxed line-height

Tooltip animation:
  fadeIn + translate from arrow direction: 150ms ease-out
  Close: same reversed 100ms
```

---

# 26. PRINT LAYOUTS

## 26.1 Receipt Preview Modal

```
Modal shows thermal receipt simulation
Background: white (always — regardless of dark mode)
Container: simulated paper with subtle grain texture
Receipt content in Noto Sans Arabic
A "paper curl" at the top corner (subtle CSS effect)

Print button:
  Shows browser print dialog

Preview is scrollable if content taller than viewport
Width matches selected paper: 80mm or 58mm (shown to scale-ish)
```

## 26.2 A4 Invoice Print

```
Print preview modal: glass-elevated, large
A4 page inside with:
  Company header with logo
  Invoice number prominent
  Table with lines
  Signature areas at bottom

Print area is a white div with dark text (always print-safe)
```

---

# 27. MOBILE / LAN BROWSER LAYOUT

## 27.1 Mobile Breakpoints

```
< 640px (phone):      Single column, bottom navigation
640–1023px (tablet):  Bottom navigation, slightly more density
≥ 1024px (desktop):   Full sidebar layout
```

## 27.2 Bottom Navigation (Mobile)

```
Fixed bottom bar: 60px height
4 tabs: الرئيسية | نقطة البيع | الفواتير | المزيد
Center POS tab: larger (icon 28px, primary glow ring)
Active tab: primary color icon + label, subtle top indicator line
Tab change: icons bounce on switch
```

## 27.3 Mobile POS

```
Two tabs: الأصناف | الفاتورة
Items tab: 2-column grid (larger cards)
Invoice tab: full-screen invoice lines + payment
Items: larger tap targets (minimum 56px)
Qty buttons: large ＋/－ buttons either side of quantity

Swipe gestures:
  Swipe right on invoice line → delete (with red reveal)
  Swipe right on held invoice slot → resume
```

## 27.4 Mobile Cards vs Tables

```
All list pages use cards on mobile (no tables)
Each card:
  Glass panel
  Main info prominent (name, amount)
  Secondary info below (date, status)
  Tap to view detail
  Long-press (500ms): action sheet slides up from bottom

Action sheet:
  Slides up from bottom: translateY(100%) → 0
  Background: glass-elevated
  Handle bar at top
  Dismiss: swipe down or backdrop tap
```

---

# 28. TAILWIND CONFIG & CSS VARIABLES

## 28.1 Complete tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0',
          300: '#6EE7B7', 400: '#34D399',
          DEFAULT: '#10B981',
          600: '#059669', 700: '#047857', 800: '#065F46', 900: '#064E3B',
        },
        bg: {
          base: '#0A0E1A', surface: '#0F1525',
          elevated: '#151C30', overlay: '#1A2238',
        },
        border: {
          subtle: 'rgba(255,255,255,0.06)',
          normal: 'rgba(255,255,255,0.10)',
          strong: 'rgba(255,255,255,0.18)',
          accent: 'rgba(16,185,129,0.35)',
        },
      },
      fontFamily: {
        sans: ['Noto Sans Arabic', 'Inter', 'sans-serif'],
        mono: ['Inter', 'monospace'],
      },
      borderRadius: {
        card: '12px', modal: '16px', pill: '9999px',
      },
      boxShadow: {
        card:    '0 4px 24px rgba(0,0,0,0.3)',
        elevated:'0 20px 60px rgba(0,0,0,0.5)',
        glow:    '0 0 20px rgba(16,185,129,0.35)',
        'glow-red': '0 0 20px rgba(239,68,68,0.35)',
        'glow-amber': '0 0 20px rgba(245,158,11,0.35)',
        focus:   '0 0 0 3px rgba(16,185,129,0.4)',
      },
      backdropBlur: {
        glass: '20px', 'glass-heavy': '30px',
      },
      animation: {
        'fade-in':       'fadeIn 250ms ease-out',
        'slide-up':      'slideUp 300ms cubic-bezier(0.34,1.56,0.64,1)',
        'slide-down':    'slideDown 300ms cubic-bezier(0.34,1.56,0.64,1)',
        'modal-enter':   'modalEnter 300ms cubic-bezier(0.34,1.56,0.64,1)',
        'toast-enter':   'toastSlide 350ms cubic-bezier(0.34,1.56,0.64,1)',
        'scan-flash':    'scanFlash 600ms ease-out',
        'total-bounce':  'totalBounce 350ms cubic-bezier(0.34,1.56,0.64,1)',
        'shimmer':       'shimmer 1.5s infinite',
        'pulse-ring':    'pulseRing 1.5s ease-out infinite',
        'orb-drift-1':   'orbDrift1 25s ease-in-out infinite',
        'orb-drift-2':   'orbDrift2 30s ease-in-out infinite',
        'bell-ring':     'bellRing 400ms ease-in-out',
        'count-up':      'none', // handled by JS
        'page-enter':    'pageEnter 300ms ease-out',
        'draw-circle':   'drawCircle 600ms ease-out forwards',
        'draw-check':    'drawCheck 300ms ease-out 400ms forwards',
      },
      keyframes: {
        fadeIn:       { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:      { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideDown:    { from: { opacity: 0, transform: 'translateY(-12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        modalEnter:   { from: { opacity: 0, transform: 'scale(0.92) translateY(16px)' }, to: { opacity: 1, transform: 'scale(1) translateY(0)' } },
        toastSlide:   { from: { opacity: 0, transform: 'translateX(calc(100% + 16px))' }, to: { opacity: 1, transform: 'translateX(0)' } },
        scanFlash:    { '0%': { background: 'rgba(16,185,129,0)' }, '20%': { background: 'rgba(16,185,129,0.3)' }, '100%': { background: 'rgba(16,185,129,0)' } },
        totalBounce:  { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.08)' }, '70%': { transform: 'scale(0.97)' }, '100%': { transform: 'scale(1)' } },
        shimmer:      { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulseRing:    { '0%': { transform: 'scale(1)', opacity: 1 }, '100%': { transform: 'scale(1.6)', opacity: 0 } },
        orbDrift1:    { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '33%': { transform: 'translate(-40px,30px) scale(1.05)' }, '66%': { transform: 'translate(20px,-20px) scale(0.95)' } },
        orbDrift2:    { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(30px,-40px) scale(1.08)' } },
        bellRing:     { '0%,100%': { transform: 'rotate(0)' }, '25%': { transform: 'rotate(-15deg)' }, '75%': { transform: 'rotate(15deg)' } },
        pageEnter:    { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        drawCircle:   { to: { strokeDashoffset: 0 } },
        drawCheck:    { to: { strokeDashoffset: 0 } },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('tailwindcss-animate'),
    require('tailwindcss-flip'),   // Auto RTL flip for directional utilities
  ],
};
```

---

# 29. ANIMATION CODE REFERENCE

## 29.1 Required npm Packages

```bash
npm install tailwindcss-animate tailwindcss-flip framer-motion
npm install @tabler/icons-react  # Icon library
npm install react-spring         # For spring physics animations
```

## 29.2 Reusable Animation Components

```jsx
// components/ui/AnimatedNumber.jsx
// Count-up animation for KPI numbers
export function AnimatedNumber({ value, duration = 600, className }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let startTime;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <span className={className}>{display.toLocaleString('ar-SA')}</span>;
}

// components/ui/PageWrapper.jsx
// Wraps every page for entry animation
export function PageWrapper({ children }) {
  return (
    <div className="animate-page-enter min-h-full">
      {children}
    </div>
  );
}

// components/ui/GlassCard.jsx
export function GlassCard({ children, className, hover = true }) {
  return (
    <div className={cn(
      'bg-white/[0.04] backdrop-blur-[20px] border border-white/[0.08]',
      'rounded-[12px] transition-all duration-250',
      hover && 'hover:-translate-y-1 hover:shadow-elevated hover:border-primary/20',
      className
    )}>
      {children}
    </div>
  );
}

// components/ui/SuccessOverlay.jsx
// Brief success flash after saving
export function SuccessOverlay({ message, onComplete }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm rounded-[12px]
                    flex flex-col items-center justify-center animate-fade-in z-50">
      {/* Animated SVG checkmark */}
      <svg className="w-16 h-16" viewBox="0 0 52 52">
        <circle className="success-circle" cx="26" cy="26" r="25"
          fill="none" stroke="#10B981" strokeWidth="2"/>
        <path className="success-check" fill="none" stroke="#10B981"
          strokeWidth="3" d="M14 27l7 7 17-17"/>
      </svg>
      <p className="text-primary font-bold text-lg mt-3">{message}</p>
    </div>
  );
}

// components/ui/SkeletonRow.jsx
// Shimmer skeleton for table loading
export function SkeletonRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 skeleton rounded w-full" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}
```

---

# 30. RTL RULES & IMPLEMENTATION

## 30.1 Global RTL Setup

```html
<!-- index.html -->
<html dir="rtl" lang="ar">
```

```javascript
// main.jsx
document.documentElement.dir = 'rtl';
document.documentElement.lang = 'ar';
```

## 30.2 RTL-Aware Tailwind Class Rules

```
NEVER USE:           USE INSTEAD:
ml-*                 ms-*  (margin-inline-start)
mr-*                 me-*  (margin-inline-end)
pl-*                 ps-*  (padding-inline-start)
pr-*                 pe-*  (padding-inline-end)
text-left            text-start
text-right           text-end
border-l-*           border-s-*
border-r-*           border-e-*
left-*               start-*
right-*              end-*
rounded-l-*          rounded-s-*
rounded-r-*          rounded-e-*
```

## 30.3 Icons That Must Flip in RTL

```jsx
// These icons should rotate 180deg in RTL
const FLIP_ICONS = [
  'ArrowRight', 'ArrowLeft', 'ChevronRight', 'ChevronLeft',
  'ArrowForward', 'Send', 'Reply', 'Logout', 'Login',
  'MenuOpen', 'ArrowBack', 'NavigateNext', 'NavigateBefore'
];

// Usage
<ChevronRight className="rtl:rotate-180 transition-transform" />
```

## 30.4 Icons That Must NOT Flip

```
Clock, Calendar, Search, Settings, Phone, Email,
Currency symbols, Star, Heart, Warning triangle,
External link (always points up-right), QR code
```

## 30.5 Animation Direction Correction

```css
/* In RTL, slides enter from the LEFT visually */
/* Tailwind handles this with tailwindcss-flip plugin */
/* But for custom animations you need RTL variants: */

[dir="rtl"] .slide-in-from-right {
  --tw-translate-x: calc(-1 * var(--tw-enter-translate-x));
}

/* Toast notification in RTL should slide from LEFT */
[dir="rtl"] .toast-enter {
  animation-name: toastSlideRTL;
}
@keyframes toastSlideRTL {
  from {
    opacity: 0;
    transform: translateX(calc(-100% - 16px));
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

## 30.6 Number Handling in Arabic UI

```jsx
// All currency and numbers displayed to user:
const formatCurrency = (amount, currency = 'EGP') =>
  new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100); // amount stored as integer piastres

// Result: ١٢٥.٠٠ ج.م (in Arabic numerals)

// For invoice numbers, barcodes, codes — always LTR:
<span dir="ltr" className="font-mono">INV-000142</span>

// For mixed content (Arabic text + number):
<span dir="rtl">
  الرصيد المستحق:
  <span dir="ltr" className="inline-block font-mono text-primary">
    {formattedAmount}
  </span>
</span>
```

---

*End of ElHegazi Retailer UI/UX Design Plan*
*Version 1.0 | April 2026*
*Covers: 30 sections | Every screen | Every animation | Every interaction | Full RTL implementation*
*Stack: React 18 + Tailwind CSS 3 + tailwindcss-animate + tailwindcss-flip + Framer Motion*
