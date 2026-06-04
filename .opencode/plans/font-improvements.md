# Font & Typography Improvement Plan

## Problem
- Font sizes too small (base 15px, xs 11px, 2xs 10px)
- 4 different fonts fighting each other (Tajawal, Noto Sans Arabic, Outfit, Inter)
- No global font size/family control in settings
- Printing defaults use monospace (poor Arabic readability)

---

## Phase 1: tailwind.config.js

### Font Family changes (lines 75-79)
```js
// OLD
fontFamily: {
  sans: ["Noto Sans Arabic", "Inter", "sans-serif"],
  inter: ["Inter", "sans-serif"],
  mono: ["Inter", "monospace"],
},

// NEW
fontFamily: {
  sans: ['var(--font-body)', 'Noto Sans Arabic', 'Tajawal', 'sans-serif'],
  number: ['Outfit', 'sans-serif'],
  mono: ['Outfit', 'monospace'],
},
```

### Font Size bumps (lines 170-182)
```js
// OLD                          // NEW (rem → ~px at 16px base)
'2xs': ['0.625rem', ...],      // 0.6875rem → ~11px
'xs': ['0.6875rem', ...],      // 0.75rem   → ~12px
'2sm': ['0.75rem', ...],       // 0.8125rem → ~13px
'sm': ['0.8125rem', ...],      // 0.875rem  → ~14px
'base': ['0.9375rem', ...],    // 1rem      → ~16px
'lg': ['1.0625rem', ...],      // 1.125rem  → ~18px
'xl': ['1.125rem', ...],       // 1.25rem   → ~20px
'2xl': ['1.25rem', ...],       // 1.375rem  → ~22px
'3xl': ['1.5rem', ...],        // 1.625rem  → ~26px
'4xl': ['1.875rem', ...],      // 2rem      → ~32px
'5xl': ['2.25rem', ...],       // 2.5rem    → ~40px
```

The lineHeight values stay the same for each size.

---

## Phase 2: index.css

### 2a: Add font CSS variables to `:root` (after line 16)
```css
:root {
  /* existing vars... */
  
  /* Font System */
  --font-body: 'Noto Sans Arabic', 'Tajawal', sans-serif;
  --font-number: 'Outfit', sans-serif;
  --font-mono: 'Outfit', monospace;
  --font-scale: 1;
}
```

### 2b: Update `body` font-family (line 138)
```css
/* OLD */
font-family: 'Tajawal', 'Noto Sans Arabic', 'Outfit', sans-serif;

/* NEW */
font-family: var(--font-body);
```

### 2c: Update number classes (lines 197-200)
```css
/* OLD */
.number, .currency, .quantity, .invoice-number {
  font-family: 'Outfit', sans-serif;
  font-variant-numeric: tabular-nums;
}

/* NEW */
.number, .currency, .quantity, .invoice-number {
  font-family: var(--font-number);
  font-variant-numeric: tabular-nums;
}
```

### 2d: Update .code, .mixed-number classes
```css
/* OLD line 206-209 */
.mixed-number {
  font-family: 'Outfit', 'Tajawal', sans-serif;
  direction: ltr;
  display: inline-block;
}

/* NEW */
.mixed-number {
  font-family: var(--font-number), var(--font-body);
  direction: ltr;
  display: inline-block;
}
```

```css
/* OLD line 212-217 */
.code, .invoice-ref, .barcode-text {
  direction: ltr;
  font-family: 'Outfit', monospace;
  letter-spacing: 0.05em;
  display: inline-block;
}

/* NEW */
.code, .invoice-ref, .barcode-text {
  direction: ltr;
  font-family: var(--font-mono);
  letter-spacing: 0.05em;
  display: inline-block;
}
```

### 2e: Update .kpi-card__value font (lines 684-691)
```css
/* OLD */
.kpi-card__value {
  /* ... */
  font-family: 'Inter', sans-serif;
}

/* NEW */
.kpi-card__value {
  /* ... */
  font-family: var(--font-number);
}
```

### 2f: Remove duplicate Google Fonts weights @import (line 1)
Current import loads 6 weights each of 3 fonts (18 total). Reduce to what's actually used:
```css
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Noto+Sans+Arabic:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap');
```
(Removed: Tajawal 300, Noto Sans Arabic 300, Outfit 300 — never used.)

---

## Phase 3: Font Settings Tab (NEW FILE)

### 3a: Create `client/src/pages/settings/FontSettingsTab.jsx`

A new component with:
- **Font Family dropdown**: Noto Sans Arabic (default), Tajawal
- **Font Size radio/button group**: Normal (1x), Large (1.125x), X-Large (1.25x)
- **Live preview panel** showing sample Arabic text + numbers in the selected font/size
- The preview updates immediately as user changes selections
- Font is NOT applied globally until "Save Settings" is clicked in SettingsPage

Preview content (in Arabic):
```
نص تجريبي للخط
هذا النص يستخدم لعرض شكل الخط الجديد قبل تطبيقه.
الأرقام: 0 1 2 3 4 5 6 7 8 9
الأرقام العربية: ٠ ١ ٢ ٣ ٤ ٥ ٦ ٧ ٨ ٩
المبالغ: ١٬٢٥٠٫٠٠ ر.س | $1,250.00
```

### 3b: Add "appearance" tab to SettingsPage tabs array (line 14-21)
Add:
```js
{ id: "appearance", label: "المظهر", hint: "الخطوط وحجم النص العام" },
```

Between "printing" and "system" (after line 18).

### 3c: Add render condition in SettingsPage (after "printing" section, line 495)
```jsx
{activeTab === "appearance" && (
  <FontSettingsTab settings={settings} onChange={handleChange} />
)}
```

Import at top:
```jsx
import FontSettingsTab from './FontSettingsTab';
```

---

## Phase 4: Global Font Application Hook

### 4a: Create `client/src/hooks/useFontSettings.js`

A hook that:
1. On mount, reads `font_family` and `font_size` from settings DB via API
2. Applies them to `document.documentElement`:
   - Sets `--font-body` CSS var for font family
   - Sets `font-size` on `<html>` for scaling (16px = normal, 18px = large, 20px = xlarge)
3. Returns `{ fontFamily, fontSize, applyFont }` for use in settings

Scale map:
- `normal` → html font-size: 16px
- `large` → html font-size: 18px
- `xlarge` → html font-size: 20px

### 4b: Use hook in App.jsx
Add in App component before the return:
```jsx
useFontSettings();
```

This applies the saved font settings on every app load.

---

## Phase 5: Scrub Hardcoded Font Sizes

Search project for excessively small hardcoded font sizes (`text-xs`, `text-2xs`, `text-[11px]`, `fontSize: 11`, etc.) in:
- Sidebar.jsx — `text-[11.5px]`, `text-[15px]`
- SettingsPage.jsx — many `text-[11px]`, `text-[13px]`, `text-[14px]`
- LoginPage.jsx and related login components
- POS components (ItemGrid, InvoiceLines, PaymentPanel)
- All page files

Strategy: Most of these will naturally improve with the Tailwind config bump (since `text-sm` now = 14px instead of 13px). For inline `text-[Npx]` values, convert to Tailwind tokens (e.g., `text-xs` → now 12px) where possible.

---

## Phase 6: Fix Print Defaults

In `PrintingSettingsPanel.jsx` (around line 1451-1496):
- Change `print_font` default from `'monospace'` to `'Noto Sans Arabic'`
- Bump defaults: `body_font_size` 11→13, `item_font_size` 11→13, `footer_font_size` 10→11

---

## Phase 7: Remove Dead Dependency

In `client/package.json`:
- Remove `"@fontsource/noto-sans-arabic": "^5.2.10"` from dependencies
- Run `npm install` to update lockfile

---

## Files Summary

| File | Action |
|------|--------|
| `client/tailwind.config.js` | Edit — bump sizes, change fontFamily |
| `client/src/index.css` | Edit — add font vars, clean up |
| `client/src/pages/settings/FontSettingsTab.jsx` | **NEW** — font settings + preview |
| `client/src/pages/settings/SettingsPage.jsx` | Edit — add appearance tab |
| `client/src/hooks/useFontSettings.js` | **NEW** — global font application hook |
| `client/src/App.jsx` | Edit — use font hook |
| `client/src/pages/settings/PrintingSettingsPanel.jsx` | Edit — fix print defaults |
| `client/package.json` | Edit — remove @fontsource |

Total: ~8 files (2 new, 6 edits)
