# ElHegazi Retailer — Enhanced UI/UX Design Plan V2
## Light Theme Default · Full Smart Help · Grand Animations · Complete Reports · Full Print System
### Covers Every Enhancement, Every Screen, Every Interaction
#### April 2026

---

# WHAT CHANGED FROM V1

| Area | V1 (Old) | V2 (This Document) |
|------|----------|---------------------|
| Default theme | Dark | **Light — crisp, premium, clean** |
| Smart help | Basic concept | **Every page, every section, every field, positioned against its element** |
| Animations | Listed but basic | **Cinematic high-end at the right moments, micro on everything else** |
| Print system | Single template mention | **Full designer per size: 58mm / 80mm / A4 / A5 — edit, reset, preview** |
| Reports | ~10 types listed | **28 full report types, each with PDF / Word / Excel / Print export** |
| AI badges | Present everywhere | **Completely removed from all pages** |
| Responsive | Basic breakpoints | **Fluid adaptive layout — every pixel of width handled** |
| Date fields | Not mentioned | **Universal date test-entry on every date field** |
| Settings | Generic | **Edit app name, logo, upload/crop, preview live** |
| All features | Shallow descriptions | **In-depth, modern, production-grade for every module** |

---

# PART A — THEME SYSTEM

## A.1 LIGHT THEME (DEFAULT)

Light theme is the PRIMARY theme. Dark is an option, not the default. The light theme must feel like a **premium fintech SaaS product** — not a generic admin panel.

### Light Theme Color Palette

```javascript
// Light theme CSS variables
:root, .theme-light {

  // ── Backgrounds ────────────────────────────────────
  --bg-base:      #F8FAFC;   // Main page background — barely-off-white with blue tint
  --bg-surface:   #FFFFFF;   // Cards, panels — pure white
  --bg-elevated:  #FFFFFF;   // Modals, dropdowns — white with stronger shadow
  --bg-overlay:   #F1F5F9;   // Hover states, alternating rows
  --bg-sidebar:   #FFFFFF;   // Sidebar — white
  --bg-topbar:    rgba(255,255,255,0.85); // Topbar — semi-transparent white

  // ── Brand Green ────────────────────────────────────
  --primary-50:   #ECFDF5;
  --primary-100:  #D1FAE5;
  --primary:      #059669;   // Slightly deeper in light mode for contrast
  --primary-600:  #047857;
  --primary-glow: rgba(5,150,105,0.2);

  // ── Text ───────────────────────────────────────────
  --text-primary:   #0F172A;   // Near black — headings, labels
  --text-secondary: #475569;   // Body text, descriptions
  --text-muted:     #94A3B8;   // Hints, placeholders, disabled
  --text-accent:    #059669;   // Brand colored text

  // ── Borders ────────────────────────────────────────
  --border-subtle: rgba(15,23,42,0.06);  // Very light dividers
  --border-normal: rgba(15,23,42,0.10);  // Standard borders
  --border-strong: rgba(15,23,42,0.18);  // Emphasized borders
  --border-accent: rgba(5,150,105,0.30); // Brand-colored borders

  // ── Shadows ────────────────────────────────────────
  --shadow-card:     0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-elevated: 0 10px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
  --shadow-modal:    0 25px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04);
  --shadow-focus:    0 0 0 3px rgba(5,150,105,0.2);
  --shadow-glow:     0 0 24px rgba(5,150,105,0.25);

  // ── Semantic ───────────────────────────────────────
  --success-bg:    #ECFDF5;  --success-text: #065F46;  --success-border: #A7F3D0;
  --danger-bg:     #FEF2F2;  --danger-text:  #991B1B;  --danger-border:  #FECACA;
  --warning-bg:    #FFFBEB;  --warning-text: #92400E;  --warning-border: #FDE68A;
  --info-bg:       #EFF6FF;  --info-text:    #1E40AF;  --info-border:    #BFDBFE;
}
```

### Light Theme Visual Rules

```
Background:
  Page base: #F8FAFC — subtle cool-gray tint (not pure white, not gray)
  Cards: pure #FFFFFF with shadow-card
  Elevated (modals): white with shadow-modal
  
Sidebar light:
  Background: #FFFFFF
  Border-end: 1px solid rgba(15,23,42,0.08)
  Active item: #ECFDF5 background + #059669 text + 3px border-start
  Hover: #F8FAFC

Topbar light:
  Background: rgba(255,255,255,0.85) with backdrop-filter blur(12px)
  Border-bottom: 1px solid rgba(15,23,42,0.06)
  Box-shadow: 0 1px 0 rgba(15,23,42,0.06)

Cards:
  Background: #FFFFFF
  Border: 1px solid rgba(15,23,42,0.08)
  Shadow: shadow-card
  Hover: shadow-elevated + border-accent subtly

Tables:
  Header: #F8FAFC background, #475569 text
  Rows: white alternating with #FAFAFA
  Hover: #F0FDF4 (very light green tint)
  Selected: #ECFDF5 + border-start primary

Inputs:
  Background: #FFFFFF
  Border: 1px solid rgba(15,23,42,0.15)
  Focus: border-primary + shadow-focus

Buttons (light):
  Primary: same gradient (#059669 → #047857)
  Secondary: #FFFFFF border rgba(15,23,42,0.15), text #0F172A
  Ghost: transparent, text #475569, hover #F8FAFC

Premium accent strip:
  Top of sidebar: subtle gradient strip #059669 → transparent (3px height)
  Creates premium brand anchor at the top
```

### Light Theme — What Makes It Look HIGH-END

```
1. Micro-elevation system:
   - Page bg (#F8FAFC) → Cards (#FFFFFF) → Modals (white + strong shadow)
   - Three distinct levels, all visible in light mode

2. Color used sparingly:
   - 90% of the UI is neutral (whites, off-whites, grays)
   - Green only on: active states, primary buttons, badges, key numbers
   - This restraint makes the green pop dramatically

3. Typography creates richness:
   - Page titles: 600 weight, #0F172A
   - Labels: 500 weight, #475569
   - Body: 400, #64748B
   - The weight progression creates hierarchy without color

4. Subtle gradients instead of flat:
   - KPI card tops: very subtle gradient #FFFFFF → #F8FAFC from top to bottom
   - Creates depth without being obvious
   - Sidebar active item: #ECFDF5 → #F0FDF4

5. Premium separator lines:
   - Never solid gray lines
   - Always: linear-gradient(90deg, transparent, rgba(15,23,42,0.06), transparent)
   - Center-fades to nothing at edges — looks high-end
```

## A.2 DARK THEME (USER OPTION)

Dark uses the Dark Glassmorphism from V1. Users toggle it in Settings → Display or via topbar toggle.

## A.3 THEME SWITCHING ANIMATION

```css
/* Full-page circular wipe from the toggle button position */
/* Theme toggle is in topbar, so wipe starts from top-right area */

.theme-transitioning * {
  transition: background-color 350ms ease,
              border-color 350ms ease,
              box-shadow 350ms ease,
              color 200ms ease !important;
}

/* For a more dramatic effect: use View Transitions API */
@keyframes clip-in {
  from { clip-path: circle(0% at 95% 5%); }
  to   { clip-path: circle(150% at 95% 5%); }
}
.theme-light-entering {
  animation: clip-in 500ms ease-in-out;
}
```

---

# PART B — SMART HELP SYSTEM V2 (EVERY PAGE, EVERY SECTION)

## B.1 Core Principle — Spotlight Follows Its Target

When the tour spotlight is on an element, the popup card must appear **adjacent to that exact element**, not in a fixed corner. The popup uses collision detection to stay on-screen.

```
Placement Priority (RTL-aware):
  1. Try: ABOVE the element — if space > 220px
  2. Try: BELOW the element — if space > 220px
  3. Try: To the END (right in LTR, left in RTL) — if space > 340px
  4. Try: To the START (left in LTR, right in RTL) — if space > 340px
  5. Fallback: Centered in viewport (for very large elements)

Arrow: Small triangle drawn pointing FROM popup TO element
  Size: 8×8px
  Matches popup border color
  Rotates based on placement direction
```

## B.2 Every Page Tour Definition

Below is the complete tour specification for every page. Each entry has:
- `target`: data-help attribute on the element
- `title_ar`: Arabic title
- `body_ar`: Arabic explanation
- `placement`: preferred direction
- `highlight_type`: spotlight | glow | underline

---

### LOGIN PAGE
```javascript
login: {
  steps: [
    { target: '[data-help="login-username"]',
      title_ar: 'اسم المستخدم',
      body_ar: 'أدخل اسم المستخدم الخاص بك. الافتراضي للمدير هو "admin".',
      placement: 'bottom', highlight_type: 'spotlight' },
    { target: '[data-help="login-password"]',
      title_ar: 'كلمة المرور',
      body_ar: 'أدخل كلمة المرور. اضغط على أيقونة العين لإظهارها.',
      placement: 'bottom', highlight_type: 'spotlight' },
    { target: '[data-help="login-btn"]',
      title_ar: 'تسجيل الدخول',
      body_ar: 'اضغط هنا للدخول، أو اضغط Enter من لوحة المفاتيح.',
      placement: 'top', highlight_type: 'glow' },
  ]
}
```

### SETUP WIZARD
```javascript
setup_wizard: {
  steps: [
    { target: '[data-help="wizard-progress"]',
      title_ar: 'مراحل الإعداد',
      body_ar: 'خمس خطوات فقط لإعداد النظام كاملاً. يمكنك الرجوع في أي وقت.',
      placement: 'bottom' },
    { target: '[data-help="wizard-company-name"]',
      title_ar: 'اسم الشركة',
      body_ar: 'سيظهر هذا الاسم على جميع الفواتير والإيصالات.',
      placement: 'bottom' },
    { target: '[data-help="wizard-branch-code"]',
      title_ar: 'رمز الفرع',
      body_ar: 'رمز قصير (2-4 أحرف) يُستخدم في تسلسل أرقام الفواتير. مثال: BR1',
      placement: 'bottom' },
    { target: '[data-help="wizard-currency"]',
      title_ar: 'العملة',
      body_ar: 'اختر عملة الفروع. تظهر هذه العملة على كل الفواتير وتقارير المالية.',
      placement: 'bottom' },
    { target: '[data-help="wizard-logo"]',
      title_ar: 'شعار الشركة',
      body_ar: 'ارفع صورة الشعار لتظهر على الفواتير. يُفضل صورة PNG بخلفية شفافة.',
      placement: 'bottom' },
  ]
}
```

### DASHBOARD
```javascript
dashboard: {
  steps: [
    { target: '[data-help="dash-kpi-sales"]',
      title_ar: 'مبيعات اليوم',
      body_ar: 'إجمالي قيمة الفواتير المحفوظة اليوم. يُحدَّث فور حفظ أي فاتورة.',
      placement: 'bottom', highlight_type: 'glow' },
    { target: '[data-help="dash-kpi-invoices"]',
      title_ar: 'عدد الفواتير',
      body_ar: 'عدد فواتير البيع المكتملة اليوم فقط.',
      placement: 'bottom' },
    { target: '[data-help="dash-kpi-profit"]',
      title_ar: 'الأرباح الصافية',
      body_ar: 'الأرباح = صافي المبيعات − تكلفة البضاعة المباعة − المصروفات. يحتاج إدخال تكاليف المشتريات لحساب دقيق.',
      placement: 'bottom' },
    { target: '[data-help="dash-revenue-chart"]',
      title_ar: 'مخطط الإيرادات',
      body_ar: 'يُظهر مبيعات الأيام أو الأشهر الماضية. انقر على الخطوط لتصفية نوع البيانات.',
      placement: 'top' },
    { target: '[data-help="dash-quick-actions"]',
      title_ar: 'الإجراءات السريعة',
      body_ar: 'اختصارات للعمليات الأكثر استخداماً. يمكن تخصيصها من الإعدادات.',
      placement: 'top' },
    { target: '[data-help="dash-low-stock"]',
      title_ar: 'تنبيهات المخزون',
      body_ar: 'الأصناف التي وصلت لأقل من الحد الأدنى المحدد. اضغط للذهاب لصفحة المخزون.',
      placement: 'start' },
  ]
}
```

### POS SCREEN
```javascript
pos_sales: {
  steps: [
    { target: '[data-help="pos-shift-bar"]',
      title_ar: 'شريط الوردية',
      body_ar: 'يجب فتح وردية قبل البيع. يظهر هنا رقم الوردية والوقت المنقضي.',
      placement: 'bottom', highlight_type: 'glow' },
    { target: '[data-help="pos-search"]',
      title_ar: 'البحث ومسح الباركود',
      body_ar: 'اكتب اسم الصنف أو رقمه، أو امسح الباركود بالماسح مباشرةً. مفتاح الاختصار: F2',
      placement: 'bottom' },
    { target: '[data-help="pos-category-tabs"]',
      title_ar: 'تصفية حسب الفئة',
      body_ar: 'اضغط على فئة للتصفية. "الكل" لإلغاء التصفية.',
      placement: 'bottom' },
    { target: '[data-help="pos-item-grid"]',
      title_ar: 'شبكة الأصناف',
      body_ar: 'اضغط على أي صنف لإضافته للفاتورة مباشرةً. الأصناف المنفدة باللون الرمادي.',
      placement: 'start' },
    { target: '[data-help="pos-customer"]',
      title_ar: 'اختيار العميل',
      body_ar: 'ابحث بالاسم أو الهاتف. مطلوب للبيع الآجل. اضغط F1 كاختصار.',
      placement: 'start' },
    { target: '[data-help="pos-invoice-lines"]',
      title_ar: 'بنود الفاتورة',
      body_ar: 'كل صنف مضاف يظهر هنا. اضغط على الكمية لتعديلها مباشرةً.',
      placement: 'end' },
    { target: '[data-help="pos-discount"]',
      title_ar: 'الخصم',
      body_ar: 'أدخل الخصم كمبلغ ثابت أو نسبة مئوية. اضغط على الزر للتبديل بينهما.',
      placement: 'top' },
    { target: '[data-help="pos-payment"]',
      title_ar: 'طريقة الدفع',
      body_ar: 'اختر نقداً، آجل، بطاقة، أو متعدد. الدفع المتعدد يتيح تقسيم المبلغ.',
      placement: 'top' },
    { target: '[data-help="pos-total"]',
      title_ar: 'الإجمالي',
      body_ar: 'المبلغ النهائي بعد الخصومات والضرائب. يرتد للأعلى عند كل تغيير.',
      placement: 'top', highlight_type: 'glow' },
    { target: '[data-help="pos-save-btn"]',
      title_ar: 'حفظ الفاتورة',
      body_ar: 'احفظ واطبع بضغطة واحدة. اختصار: F12. يمكن الحفظ بدون طباعة بالزر الثاني.',
      placement: 'top', highlight_type: 'glow' },
    { target: '[data-help="pos-hold"]',
      title_ar: 'تعليق الفاتورة',
      body_ar: 'علّق الفاتورة الحالية لخدمة عميل آخر، ثم ارجع إليها من زر الاسترجاع.',
      placement: 'top' },
  ]
}
```

### ITEMS PAGE
```javascript
items_list: {
  steps: [
    { target: '[data-help="items-add-btn"]',
      title_ar: 'إضافة صنف جديد',
      body_ar: 'اضغط لفتح نموذج إضافة صنف. يمكن الاستيراد من Excel للإضافة الجماعية.',
      placement: 'bottom', highlight_type: 'glow' },
    { target: '[data-help="items-search"]',
      title_ar: 'البحث',
      body_ar: 'ابحث بالاسم أو الباركود أو رمز الصنف. البحث فوري بدون ضغط Enter.',
      placement: 'bottom' },
    { target: '[data-help="items-filter"]',
      title_ar: 'الفلاتر',
      body_ar: 'فلتر حسب الفئة، الحالة، نوع الصنف. يمكن تطبيق عدة فلاتر معاً.',
      placement: 'bottom' },
    { target: '[data-help="items-stock-col"]',
      title_ar: 'عمود المخزون',
      body_ar: 'يُظهر الكمية الإجمالية في جميع المستودعات. اللون يشير لحالة المخزون.',
      placement: 'start' },
    { target: '[data-help="items-actions"]',
      title_ar: 'أزرار الإجراءات',
      body_ar: 'تظهر عند تمرير الماوس. تعديل، عرض تفاصيل، طباعة ملصق، حذف.',
      placement: 'start' },
    { target: '[data-help="items-import-btn"]',
      title_ar: 'استيراد من Excel',
      body_ar: 'حمّل نموذج Excel، أدخل بياناتك، ثم ارفعه لإضافة مئات الأصناف دفعة واحدة.',
      placement: 'bottom' },
  ]
}
```

### ITEM FORM (MODAL)
```javascript
item_form: {
  steps: [
    { target: '[data-help="item-code"]',
      title_ar: 'رمز الصنف',
      body_ar: 'رمز فريد لكل صنف. يُنشأ تلقائياً أو أدخله يدوياً. لا يمكن تكراره.',
      placement: 'bottom' },
    { target: '[data-help="item-barcode"]',
      title_ar: 'الباركود',
      body_ar: 'أدخله يدوياً أو امسحه بالماسح. يمكن إضافة أكثر من باركود للصنف الواحد.',
      placement: 'bottom' },
    { target: '[data-help="item-prices"]',
      title_ar: 'أعمدة الأسعار',
      body_ar: 'السعر1 هو سعر التجزئة الرئيسي. السعر2 للجملة. السعر3 خاص. يُطبَّق حسب مجموعة العميل.',
      placement: 'top' },
    { target: '[data-help="item-min-stock"]',
      title_ar: 'الحد الأدنى للمخزون',
      body_ar: 'عند الوصول لهذه الكمية يظهر تنبيه نفاد المخزون تلقائياً.',
      placement: 'bottom' },
    { target: '[data-help="item-track-serial"]',
      title_ar: 'تتبع الأرقام التسلسلية',
      body_ar: 'فعّل هذا للأصناف التي لها أرقام تسلسلية مثل الأجهزة الإلكترونية.',
      placement: 'bottom' },
    { target: '[data-help="item-image"]',
      title_ar: 'صورة الصنف',
      body_ar: 'تُعرض في شبكة نقطة البيع. يُفضل صورة مربعة على خلفية بيضاء.',
      placement: 'start' },
  ]
}
```

### CUSTOMERS PAGE
```javascript
customers_list: {
  steps: [
    { target: '[data-help="cust-balance-col"]',
      title_ar: 'عمود الرصيد',
      body_ar: 'الرصيد الموجب = مبلغ مستحق على العميل. الصفر = لا توجد مديونية.',
      placement: 'start' },
    { target: '[data-help="cust-credit-limit"]',
      title_ar: 'حد الائتمان',
      body_ar: 'أقصى مبلغ يمكن للعميل الشراء به آجلاً. الصفر = بدون حد.',
      placement: 'start' },
    { target: '[data-help="cust-statement-btn"]',
      title_ar: 'كشف الحساب',
      body_ar: 'طباعة كشف حساب تفصيلي بكل المعاملات لفترة محددة.',
      placement: 'start' },
    { target: '[data-help="cust-filter-balance"]',
      title_ar: 'فلتر حسب الرصيد',
      body_ar: 'اعرض فقط العملاء الذين لديهم رصيد مستحق لتسريع عمليات التحصيل.',
      placement: 'bottom' },
  ]
}
```

### ALL REMAINING PAGES — Same Pattern
```javascript
// purchases_list, payments, expenses, stock_levels, stock_movements,
// stock_transfer, physical_count, reports_center, each_report,
// settings_main, settings_receipt, backup_restore, shift_history,
// cheques, installments, quotations, audit_log — all follow same structure
// Each has 4-8 targeted steps covering every major section
// Total steps across all pages: ~120 step definitions
```

## B.3 Tour Positioning Engine (Complete Code)

```jsx
// hooks/useTourPosition.js
export function useTourPosition(targetSelector, placement) {
  const [style, setStyle] = useState({});
  const [arrowDir, setArrowDir] = useState('bottom');
  const POPUP_W = 320;
  const POPUP_H_EST = 220;
  const GAP = 12;
  const PADDING = 16;

  useEffect(() => {
    const el = document.querySelector(targetSelector);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isRTL = document.documentElement.dir === 'rtl';

    // Available space in each direction
    const space = {
      top:    rect.top - GAP,
      bottom: vh - rect.bottom - GAP,
      start:  isRTL ? (vw - rect.right) - GAP : rect.left - GAP,
      end:    isRTL ? rect.left - GAP : (vw - rect.right) - GAP,
    };

    // Try placements in priority order
    let chosen = placement;
    if (placement === 'bottom' && space.bottom < POPUP_H_EST + 20) chosen = 'top';
    if (placement === 'top'    && space.top    < POPUP_H_EST + 20) chosen = 'bottom';
    if (placement === 'end'    && space.end     < POPUP_W + 20)   chosen = 'start';
    if (placement === 'start'  && space.start   < POPUP_W + 20)   chosen = 'end';
    // Last resort: bottom
    if (space[chosen] < 80) chosen = 'bottom';

    // Calculate position
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let css = { position: 'fixed', width: POPUP_W, zIndex: 9999 };

    if (chosen === 'bottom') {
      css.top  = rect.bottom + GAP;
      css.left = Math.max(PADDING, Math.min(centerX - POPUP_W / 2, vw - POPUP_W - PADDING));
      setArrowDir('top');
    } else if (chosen === 'top') {
      css.bottom = vh - rect.top + GAP;
      css.left   = Math.max(PADDING, Math.min(centerX - POPUP_W / 2, vw - POPUP_W - PADDING));
      setArrowDir('bottom');
    } else if (chosen === 'end') {
      const left = isRTL ? rect.left - POPUP_W - GAP : rect.right + GAP;
      css.left = Math.max(PADDING, Math.min(left, vw - POPUP_W - PADDING));
      css.top  = Math.max(PADDING, Math.min(centerY - POPUP_H_EST / 2, vh - POPUP_H_EST - PADDING));
      setArrowDir(isRTL ? 'end' : 'start');
    } else { // start
      const left = isRTL ? rect.right + GAP : rect.left - POPUP_W - GAP;
      css.left = Math.max(PADDING, Math.min(left, vw - POPUP_W - PADDING));
      css.top  = Math.max(PADDING, Math.min(centerY - POPUP_H_EST / 2, vh - POPUP_H_EST - PADDING));
      setArrowDir(isRTL ? 'start' : 'end');
    }

    // Scroll target into view
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    setStyle(css);
  }, [targetSelector, placement]);

  return { style, arrowDir };
}
```

## B.4 Tour Popup Component

```jsx
// components/help/TourPopup.jsx
// Glass card that renders NEXT TO its target element
// Arrow drawn pointing at target
// Smooth entrance from element direction

export function TourPopup({ step, totalSteps, currentIndex,
                            onNext, onPrev, onClose, onDisable }) {
  const { style, arrowDir } = useTourPosition(step.target, step.placement);
  const lang = 'ar';

  const arrowClass = {
    top:    'before:top-[-8px] before:left-1/2 before:-translate-x-1/2 before:border-b-[8px] before:border-x-[6px] before:border-x-transparent',
    bottom: 'before:bottom-[-8px] before:left-1/2 before:-translate-x-1/2 before:border-t-[8px] before:border-x-[6px] before:border-x-transparent',
    start:  'before:start-[-8px] before:top-1/2 before:-translate-y-1/2 before:border-e-[8px] before:border-y-[6px] before:border-y-transparent',
    end:    'before:end-[-8px] before:top-1/2 before:-translate-y-1/2 before:border-s-[8px] before:border-y-[6px] before:border-y-transparent',
  }[arrowDir] || '';

  return (
    <div
      dir="rtl"
      style={style}
      className={`
        relative bg-white dark:bg-bg-elevated
        border border-border-normal shadow-modal rounded-[16px] p-5
        animate-modal-enter
        before:absolute before:content-[''] before:border-white dark:before:border-bg-elevated
        ${arrowClass}
      `}
    >
      {/* Step counter */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted font-medium">
          {currentIndex + 1} / {totalSteps}
        </span>
        <button onClick={onClose}
          className="w-6 h-6 rounded-full hover:bg-danger-bg flex items-center justify-center
                     text-text-muted hover:text-danger transition-all duration-150">
          ✕
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mb-3">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-200
            ${i === currentIndex ? 'bg-primary w-4' : 'bg-border-normal'}`} />
        ))}
      </div>

      {/* Content */}
      <h3 className="font-bold text-text-primary text-sm mb-2">{step.title_ar}</h3>
      <p className="text-text-secondary text-xs leading-relaxed mb-4">{step.body_ar}</p>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={onDisable}
          className="text-xs text-text-muted hover:text-danger underline transition-colors">
          لا تعرض مجدداً
        </button>
        <div className="flex gap-2">
          {currentIndex > 0 && (
            <button onClick={onPrev}
              className="px-3 py-1.5 text-xs border border-border-normal rounded-lg
                         text-text-secondary hover:bg-bg-overlay transition-all">
              ← السابق
            </button>
          )}
          <button onClick={onNext}
            className="px-4 py-1.5 text-xs bg-primary text-white rounded-lg
                       font-medium hover:bg-primary-600 shadow-glow transition-all
                       hover:-translate-y-0.5 active:translate-y-0">
            {currentIndex === totalSteps - 1 ? 'انتهى ✓' : 'التالي →'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

# PART C — HIGH-END ANIMATIONS: RIGHT MOMENTS

## C.1 The Rule: Appropriate Grandeur

Not everything needs a big animation. The rule is:

| Moment | Animation Level |
|--------|----------------|
| Button hover | Micro (150ms, subtle) |
| Item added to cart | Medium (scan flash + row slide) |
| Invoice saved successfully | BIG (full overlay, checkmark draw) |
| Dashboard loads for the day | GRAND (KPIs count up, chart draws) |
| First login after setup | CINEMATIC (welcome animation) |
| Shift opened | Medium (shift bar slides down) |
| Shift closed with Z-report | BIG (summary reveals, then print confirmation) |
| Delete/destructive action | Dramatic confirm dialog |
| Report export complete | Big "download ready" celebration |
| Low stock alert first appears | Attention-grabbing pulse + sound |
| License expires in 3 days | Persistent dramatic banner |

## C.2 CINEMATIC ANIMATIONS — Exact Code

### Grand Dashboard Entrance (On First Load of the Day)
```css
/* KPI cards enter one by one from below, staggered */
.kpi-card { opacity: 0; transform: translateY(30px); }
.kpi-card.animate {
  animation: cardEnterGrand 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
.kpi-card:nth-child(1) { animation-delay: 100ms; }
.kpi-card:nth-child(2) { animation-delay: 200ms; }
.kpi-card:nth-child(3) { animation-delay: 300ms; }
.kpi-card:nth-child(4) { animation-delay: 400ms; }

@keyframes cardEnterGrand {
  0%   { opacity: 0; transform: translateY(30px) scale(0.96); }
  60%  { opacity: 1; transform: translateY(-4px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

/* Chart draws in 800ms after cards appear */
/* Chart container: clip-path reveal left to right */
.chart-reveal {
  clip-path: inset(0 100% 0 0);
  animation: chartReveal 1000ms ease-out 600ms forwards;
}
@keyframes chartReveal {
  to { clip-path: inset(0 0% 0 0); }
}
```

### Invoice Save Success — Full Celebration
```jsx
// Full-panel overlay: checkmark + confetti burst + sound
// Triggered for 1.5 seconds then auto-dismisses

function InvoiceSaveSuccess({ invoiceNumber, total, onDismiss }) {
  // Confetti: 20 small colored squares burst outward from center
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.cos((i / 20) * Math.PI * 2) * 80,
    y: Math.sin((i / 20) * Math.PI * 2) * 80,
    color: ['#10B981', '#34D399', '#059669', '#6EE7B7', '#F59E0B'][i % 5],
    size: 4 + Math.random() * 6,
    delay: Math.random() * 200,
  }));

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center
                    bg-white/90 dark:bg-bg-elevated/90 backdrop-blur-sm
                    rounded-[12px] z-50 animate-fade-in">

      {/* Animated SVG checkmark */}
      <div className="relative">
        <svg className="w-20 h-20" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none"
            stroke="#10B981" strokeWidth="3"
            strokeDasharray="226" strokeDashoffset="226"
            style={{ animation: 'drawCircle 600ms ease-out forwards' }} />
          <path d="M24 40 L35 52 L56 30" fill="none"
            stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="50" strokeDashoffset="50"
            style={{ animation: 'drawCheck 400ms ease-out 500ms forwards' }} />
        </svg>

        {/* Confetti particles */}
        {particles.map(p => (
          <div key={p.id} style={{
            position: 'absolute', top: '50%', left: '50%',
            width: p.size, height: p.size,
            backgroundColor: p.color, borderRadius: 2,
            animation: `confettiBurst 800ms ease-out ${p.delay}ms forwards`,
            '--tx': `${p.x}px`, '--ty': `${p.y}px`,
          }} />
        ))}
      </div>

      <p className="text-primary font-bold text-xl mt-4">تم الحفظ بنجاح!</p>
      <p className="text-text-secondary text-sm mt-1">{invoiceNumber}</p>
      <p className="text-primary font-bold text-2xl mt-1">{formatCurrency(total)}</p>
    </div>
  );
}
```

```css
@keyframes confettiBurst {
  0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(var(--tx), var(--ty)) rotate(720deg); opacity: 0; }
}
```

### Report Export Complete
```css
/* Download ready button celebrates */
@keyframes exportCelebrate {
  0%   { transform: scale(1); }
  20%  { transform: scale(1.15) translateY(-4px); }
  40%  { transform: scale(0.95) translateY(0); }
  60%  { transform: scale(1.05); }
  100% { transform: scale(1); }
}
.export-ready {
  animation: exportCelebrate 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
  background: linear-gradient(135deg, #059669, #047857) !important;
}
/* Green shimmer sweep */
.export-ready::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmerSweep 600ms ease-out;
}
@keyframes shimmerSweep {
  from { transform: translateX(-100%); }
  to   { transform: translateX(100%); }
}
```

### Dramatic Delete Confirm
```jsx
// When user tries to delete something important:
// - Screen dims MORE than normal (rgba(0,0,0,0.8))
// - Panel shakes on wrong password
// - Large warning icon pulses red

function DramaticDeleteConfirm({ itemName, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('');
  const required = 'حذف';
  const canConfirm = typed === required;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center
                    bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="glass-elevated rounded-[20px] p-8 max-w-[400px] w-full
                      mx-4 animate-modal-enter text-center">

        {/* Pulsing danger icon */}
        <div className="relative mx-auto w-20 h-20 mb-6">
          <div className="absolute inset-0 rounded-full bg-danger-light
                          animate-pulse" />
          <div className="absolute inset-2 rounded-full bg-danger-bg
                          flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
        </div>

        <h2 className="text-xl font-bold text-text-primary mb-2">تأكيد الحذف</h2>
        <p className="text-text-secondary text-sm mb-1">سيتم حذف: <strong>{itemName}</strong></p>
        <p className="text-danger text-xs mb-6">هذا الإجراء لا يمكن التراجع عنه</p>

        {/* Type to confirm */}
        <p className="text-xs text-text-muted mb-2">اكتب "<strong>حذف</strong>" للتأكيد:</p>
        <input
          className="w-full text-center border-2 border-danger-border rounded-lg
                     p-3 text-lg font-mono focus:outline-none focus:ring-0
                     focus:border-danger transition-all"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder="حذف"
          dir="rtl"
        />

        <div className="flex gap-3 mt-6">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-lg border border-border-normal
                       text-text-secondary hover:bg-bg-overlay transition-all">
            إلغاء
          </button>
          <button
            onClick={canConfirm ? onConfirm : undefined}
            disabled={!canConfirm}
            className={`flex-1 py-3 rounded-lg font-bold transition-all duration-300
              ${canConfirm
                ? 'bg-danger text-white shadow-glow-red hover:-translate-y-1'
                : 'bg-danger-bg text-danger-text opacity-50 cursor-not-allowed'
              }`}>
            تأكيد الحذف
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Shift Opening Grand Animation
```jsx
// When shift opens: brief full-screen celebration
// Clock hands spin to current time, then "وردية مفتوحة" bursts in

function ShiftOpenCelebration({ shiftNumber, cashier }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center
                    bg-primary/5 backdrop-blur-sm animate-fade-in pointer-events-none">
      <div className="text-center">
        {/* Animated clock */}
        <div className="w-32 h-32 mx-auto mb-6 relative">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="48" fill="none"
              stroke="rgba(5,150,105,0.2)" strokeWidth="2"/>
            <circle cx="50" cy="50" r="42" fill="none"
              stroke="#059669" strokeWidth="2"
              strokeDasharray="263" strokeDashoffset="263"
              style={{ animation: 'drawCircle 800ms ease-out forwards' }}/>
            {/* Hour hand */}
            <line x1="50" y1="50" x2="50" y2="28"
              stroke="#059669" strokeWidth="3" strokeLinecap="round"
              style={{ transformOrigin: '50px 50px',
                       animation: 'spinHour 1200ms ease-out forwards' }}/>
            {/* Minute hand */}
            <line x1="50" y1="50" x2="50" y2="20"
              stroke="#34D399" strokeWidth="2" strokeLinecap="round"
              style={{ transformOrigin: '50px 50px',
                       animation: 'spinMinute 1200ms ease-out forwards' }}/>
            <circle cx="50" cy="50" r="3" fill="#059669"/>
          </svg>
        </div>
        <p className="text-primary font-bold text-2xl
                      animate-slide-up" style={{ animationDelay: '800ms' }}>
          وردية مفتوحة ✓
        </p>
        <p className="text-text-secondary mt-1
                      animate-slide-up" style={{ animationDelay: '900ms' }}>
          {shiftNumber} | {cashier}
        </p>
      </div>
    </div>
  );
}
```

---

# PART D — PRINT SYSTEM V2 (COMPLETE)

## D.1 Print Sizes Supported

| Size | Width | Use Case |
|------|-------|----------|
| 58mm thermal | 58mm | Small receipt printers, cafes |
| 80mm thermal | 80mm | Standard retail receipt printers |
| A5 | 148×210mm | Summary invoices, quotations |
| A4 | 210×297mm | Formal invoices, statements, reports |
| A4 Landscape | 297×210mm | Wide reports, stock sheets |

## D.2 Receipt Template Designer — Full Plan

The designer is accessed at Settings → الطباعة والإيصالات

### Layout
```
┌────────────────────────────────────────────────────────────┐
│  RECEIPT TEMPLATE DESIGNER                                  │
│  ──────────────────────────────────────────────────────    │
│  Size:  [58mm ●] [80mm  ] [A5  ] [A4  ]   [Reset] [Save]  │
├──────────────────────────┬─────────────────────────────────┤
│  SETTINGS PANEL (40%)    │  LIVE PREVIEW (60%)             │
│                          │                                 │
│  ▶ الرأسية               │  ┌─────────────────┐            │
│    ☑ إظهار الشعار        │  │ ░░░ [LOGO] ░░░  │            │
│    ☑ اسم الشركة          │  │                 │            │
│    ☑ العنوان             │  │  اسم الشركة     │            │
│    ☑ رقم الهاتف          │  │  العنوان        │            │
│    ☑ رقم ضريبي           │  │  ─────────────  │            │
│    ─────────────────     │  │ رقم: INV-001    │            │
│  ▶ بيانات الفاتورة       │  │ التاريخ: ...    │            │
│    ☑ رقم الفاتورة        │  │ ─────────────── │            │
│    ☑ التاريخ والوقت      │  │ صنف   كمية سعر  │            │
│    ☑ اسم الكاشير         │  │ ─────────────── │            │
│    ─────────────────     │  │ الإجمالي: xxx   │            │
│  ▶ جدول الأصناف          │  │ ─────────────── │            │
│    ☑ رقم السطر           │  │ شكراً لزيارتكم  │            │
│    ☑ اسم الصنف           │  └─────────────────┘            │
│    ☑ الكمية              │                                 │
│    ☑ السعر               │  ⚠ هذا المعاينة بيانات تجريبية │
│    ☑ الإجمالي            │                                 │
│    ─────────────────     │  [طباعة تجريبية] [مشاركة]      │
│  ▶ الإجماليات            │                                 │
│  ▶ التذييل               │                                 │
│  ▶ خيارات الطباعة        │                                 │
└──────────────────────────┴─────────────────────────────────┘
```

### Live Preview Engine
```jsx
// ReceiptLivePreview.jsx
// The preview EXACTLY mirrors what will be printed
// Debounced: updates 200ms after any setting change
// Shows real test data (fake invoice with real formatting)
// Can zoom: 50%, 75%, 100% (zoom slider at bottom)
// Paper size shown to relative scale on screen

const TEST_INVOICE = {
  number: 'INV-000001',
  date: new Date().toLocaleDateString('ar-EG'),
  cashier: 'أحمد محمد',
  customer: 'زبون نقدي',
  lines: [
    { name: 'كولا 330مل', qty: 2, price: 300, total: 600 },
    { name: 'ماء معدني', qty: 5, price: 100, total: 500 },
    { name: 'شاي ليبتون', qty: 1, price: 2500, total: 2500 },
  ],
  subtotal: 3600, discount: 200, tax: 0, total: 3400,
  paid: 5000, change: 1600,
};
```

### Reset to Default
```jsx
// Per-size reset button
// Shows confirm: "إعادة تعيين قالب 80mm للإعدادات الافتراضية؟"
// Animates: current settings fade out, defaults animate in
// Undo available for 5 seconds after reset (toast with undo button)

function ResetTemplateButton({ size, onReset }) {
  return (
    <button onClick={() => confirmReset(size, onReset)}
      className="text-xs text-text-muted hover:text-warning flex items-center gap-1
                 border border-border-subtle rounded px-2 py-1 transition-all
                 hover:border-warning-border hover:bg-warning-bg">
      <RotateCcwIcon size={12} />
      إعادة تعيين
    </button>
  );
}
```

## D.3 A4 Invoice Designer

Separate designer for A4 invoices with more sections:

```
Sections configurable:
  ✓ Company header (logo position: left/center/right)
  ✓ Customer details block
  ✓ Invoice info block (number, date, ref)
  ✓ Items table
    - Column visibility and order (drag to reorder)
    - Table header styling (background color picker)
    - Font size (small/medium/large)
  ✓ Totals section
    - Show/hide each line (subtotal, discount, tax, total)
    - Highlight grand total
  ✓ Notes / terms section (rich text)
  ✓ Signature lines
    - Show/hide
    - Label text customizable ("توقيع العميل" / "توقيع المندوب")
  ✓ Footer (page number, company name, website)
  ✓ Watermark (PAID / UNPAID / DRAFT / COPY)
    - Show when: always / based on status / never
```

## D.4 Print Action Panel (On Every Invoice/Report)

```
When user clicks "طباعة" on any document:

1. Mini-modal slides up (not full screen):
   ┌─────────────────────────────────────┐
   │  طباعة الفاتورة INV-000142          │
   │                                     │
   │  القالب:  [80mm ▼]                  │
   │  النسخ:   [1] [2] [3] [+]           │
   │  الطابعة: [الطابعة الافتراضية ▼]   │
   │                                     │
   │  ☑ طباعة فورية  ☐ معاينة أولاً     │
   │                                     │
   │       [إلغاء]    [طباعة]            │
   └─────────────────────────────────────┘

2. "معاينة أولاً": opens full-screen receipt preview modal
3. "طباعة فورية": triggers window.print() directly

4. After print: 
   "هل تمت الطباعة بنجاح؟" [نعم] [إعادة الطباعة]
   Tracks print count in database
```

---

# PART E — REPORTS SYSTEM V2 (COMPLETE)

## E.1 Reports Center Page Design

```
NOT a boring list of links.

Design: Card grid organized by category
Each card:
  - Colored left-border (category color)
  - Report name (bold, Arabic)
  - Short description (gray, 11px)
  - Last run: "آخر تشغيل: منذ 3 ساعات"
  - Favorite star (pin to top)
  - Quick-run button (opens with last used filters)

Categories with colors:
  🟢 المبيعات     — emerald
  🔵 المخزون      — blue
  🟠 المالية      — amber
  🟣 الكاشير      — purple
  🔴 الاستثناءات  — red
  ⚫ التدقيق      — neutral

Search reports: instant filter as you type

Scheduled reports badge: shows if report has active schedule
```

## E.2 All 28 Reports — Full Specification

### GROUP 1: SALES REPORTS (مبيعات)

**R01 — الملخص اليومي للمبيعات**
```
Filters:
  - Date (single day, defaults to today)
  - Cashier (all / specific)
  - Payment type (all / cash / credit / card)
Sections:
  A. KPI row: Total Revenue | Invoices Count | Avg Invoice | Returns Count
  B. Hourly breakdown bar chart
  C. Payment method pie chart
  D. Top 5 items sold (mini bar chart)
  E. Detailed transactions table
Columns: # | الوقت | رقم الفاتورة | العميل | الأصناف | الإجمالي | الدفع | الكاشير
Export: PDF (A4) | Excel | Print (A4 + A5)
```

**R02 — تقرير المبيعات التفصيلي**
```
Filters: Date range | Customer | Item | Category | Cashier | Payment type
         Min amount | Max amount | Status
Columns: # | التاريخ | رقم الفاتورة | العميل | الأصناف | المجموع | الخصم | الضريبة | الصافي | الدفع | الكاشير
Group by option: Day | Week | Month | Customer | Item
Sort by: Date | Amount | Customer
Summary row: totals for all numeric columns
Export: PDF (A4 landscape for many columns) | Excel | Word | Print
```

**R03 — مبيعات حسب الصنف**
```
Filters: Date range | Category | Supplier | Item name | Min quantity sold
Columns: الصنف | الفئة | الباركود | الوحدة | الكمية المباعة | متوسط السعر | إجمالي الإيراد | تكلفة المبيعات | هامش الربح | %
Chart: Top 10 bar chart
Highlight: Items with margin below 15% in red
Export: PDF | Excel | Word | Print
```

**R04 — مبيعات حسب الفئة**
```
Columns: الفئة | عدد الأصناف | الكمية المباعة | الإيراد | التكلفة | الربح الإجمالي | % من الإجمالي
Chart: Donut chart + treemap view option
Export: PDF | Excel | Print
```

**R05 — مبيعات حسب الكاشير**
```
Columns: الكاشير | الورديات | عدد الفواتير | إجمالي المبيعات | إجمالي الخصومات | المرتجعات | الملغيات | متوسط الفاتورة | المبيعات النقدية | الآجلة
Flags: High void rate (>5%) → red badge | High discount rate (>15%) → amber badge
Chart: Comparison bar chart
Export: PDF | Excel | Print
```

**R06 — مبيعات حسب طريقة الدفع**
```
Columns: طريقة الدفع | عدد المعاملات | الإجمالي | % من الكل
Chart: Pie + bar dual view
Export: PDF | Excel | Print
```

**R07 — خريطة حرارة المبيعات الساعية**
```
Visual: 7 days × 24 hours heat grid
Cell color: Intensity = sales volume (light green → dark green → amber at peak)
Click cell: Shows invoice list for that exact day+hour
Summary: Peak hour, slowest hour, busiest day
Export: Excel (with conditional formatting) | PDF (landscape) | Print
```

**R08 — تقرير الاستثناءات والاحتيال**
```
Sections:
  A. الفواتير الملغاة: Invoice# | Cashier | Time | Amount | Reason | Authorized by
  B. الخصومات الكبيرة: Invoice# | Discount% | Amount Lost | Reason
  C. المرتجعات: Invoice# | Cashier | Reason | Items | Amount
  D. تغيير الأسعار اليدوي: Item | Original | New Price | Cashier | Reason
  E. تجاوزات المشرف: Action | Cashier | Supervisor | Time
Access: Manager + Admin only
Export: PDF (sensitive watermark) | Excel | Print
```

**R09 — مقارنة فترتين**
```
Filters: Period A (from/to) | Period B (from/to)
Table: Metric | Period A | Period B | Difference | Change %
Metrics: Revenue | Transactions | Avg Invoice | Returns Rate | Profit | Expenses
Chart: Side-by-side bars
Export: PDF | Excel | Word | Print
```

**R10 — تقرير مبيعات الأصناف الراكدة**
```
Items with NO sales in selected period
Columns: الصنف | الفئة | الكمية المتوفرة | آخر بيع | أيام منذ آخر بيع | تكلفة المخزون الراكد
Sort: By days since last sale DESC
Action: "إنشاء عرض ترويجي" button for selected items
Export: PDF | Excel | Print
```

---

### GROUP 2: INVENTORY REPORTS (مخزون)

**R11 — مستوى المخزون الحالي**
```
Filters: Category | Warehouse | Status (OK/Low/Out/Over) | Supplier
Columns: الصنف | الفئة | الوحدة | المتوفر | الحد الأدنى | الحد الأقصى | الحالة | قيمة التكلفة | قيمة البيع
Color coding: Out = red row | Low = amber | Over = blue
Export: PDF (A4 landscape) | Excel (with conditional formatting auto-applied) | Print
```

**R12 — حركة المخزون التفصيلية**
```
Filters: Date range | Item | Category | Movement type | User | Warehouse
Columns: التاريخ | الصنف | نوع الحركة | قبل | التغيير | بعد | المرجع | المستخدم
Movement type icons: Sale=↓green | Purchase=↑blue | Return=↑amber | Adjust=⟳gray
Export: PDF | Excel | Print
```

**R13 — تقييم المخزون**
```
As of date (default: today)
Columns: الصنف | الكمية | متوسط التكلفة | إجمالي التكلفة | سعر البيع | إجمالي القيمة البيعية | الربح المتوقع
Totals: Grand total cost | Grand total retail | Total potential profit | Profit margin %
Access: Manager + Admin + Accountant
Export: PDF (with CONFIDENTIAL watermark) | Excel | Print
```

**R14 — ورقة جرد المخزون**
```
Purpose: Print for physical counting (blank count fields)
Columns: # | الباركود | اسم الصنف | الوحدة | الكمية بالنظام | العدد الفعلي (فارغ) | الفرق
Grouped by: Category (collapsible)
Format: A4 Portrait or Landscape (user choice)
Print optimization: Clean, no colors, maximizes rows per page
After printing: QR code in corner links to the count entry form
Export: PDF (optimized for print) | Excel (with formula for variance auto-calculation)
```

**R15 — تقرير إعادة الطلب**
```
Items below min stock
Columns: الصنف | المورد المفضل | المتوفر | الحد الأدنى | كمية الطلب المقترحة | آخر سعر شراء | التكلفة الإجمالية المقدرة
Action: "إنشاء طلب شراء" → creates draft purchase invoice
Export: PDF | Excel | Word (for sending to supplier) | Print
```

**R16 — تقرير انتهاء الصلاحية**
```
Items with expiry tracking enabled
Columns: الصنف | رقم الدفعة | تاريخ الانتهاء | أيام متبقية | الكمية | قيمة التكلفة
Color: Already expired = red | < 7 days = orange | < 30 days = yellow
Export: PDF | Excel | Print
```

---

### GROUP 3: FINANCIAL REPORTS (مالية)

**R17 — الملخص المالي اليومي**
```
The most important daily report:
Sections:
  A. إيرادات المبيعات: Gross | Discounts | Returns | Net
  B. إيرادات أخرى: by category
  C. المصروفات: by category
  D. صافي الإيرادات: A(Net) + B − C
  E. التدفق النقدي: Opening + In − Out = Closing
  F. توزيع طرق الدفع: Cash | Credit | Card
Footer: Auto-printed daily at closing (if scheduled)
Export: PDF (A4) | Excel | Print (A4) | Word
```

**R18 — ذمم العملاء (مستحقات)**
```
As of date | Filter: Customer | Overdue only | By aging bucket
Columns: العميل | الهاتف | إجمالي الفواتير | المدفوع | المستحق | 0-30 يوم | 31-60 | 61-90 | +90
Grand total per aging bucket
Chart: Stacked bar per customer top 10
Color: 90+ days = red text
Legal format: Official statement template for debt follow-up
Export: PDF (formal letter style) | Excel | Word (mail merge template) | Print
```

**R19 — ذمم الموردين (مستحقات للموردين)**
```
Same structure as R18 but for supplier payables
Export: Same options
```

**R20 — ملخص الأرباح والخسائر**
```
Date range
Sections:
  إجمالي الإيرادات
  − تكلفة البضاعة المباعة
  = إجمالي الربح
  − المصروفات التشغيلية (by category)
  + الإيرادات الأخرى
  = صافي الربح
Metrics: Gross Margin % | Net Margin %
Comparison: vs previous period (toggle)
Chart: Waterfall chart showing each component
Access: Manager + Admin + Accountant only
Export: PDF (CONFIDENTIAL) | Excel | Word | Print
```

**R21 — تقرير التدفق النقدي**
```
Filters: Date range | Warehouse | Treasury
Sections:
  التدفقات الداخلة: Sales cash | Customer payments | Other revenues
  التدفقات الخارجة: Purchases cash | Supplier payments | Expenses
  حركات الخزينة: In/Out/Transfers
  صافي التدفق اليومي (bar chart)
Export: PDF | Excel | Print
```

**R22 — تقرير الخزينة والحسابات البنكية**
```
Per treasury/bank account
Columns: التاريخ | النوع | المرجع | وارد | صادر | الرصيد
Running balance shown for every row
Opening and closing balance highlighted
Export: PDF (bank statement style) | Excel | Print
```

**R23 — تقرير الضرائب (ضريبة القيمة المضافة)**
```
Tax filing period
Sections:
  مبيعات خاضعة للضريبة | الضريبة المحصلة
  مشتريات خاضعة للضريبة | الضريبة المدفوعة
  صافي الضريبة المستحقة
Breakdown by tax rate
Official VAT format for filing
Export: PDF (official format) | Excel | Print
```

---

### GROUP 4: CUSTOMER REPORTS (عملاء)

**R24 — كشف حساب العميل**
```
Required: Customer selection
Filters: Date range
Table: التاريخ | النوع | الفاتورة | مدين | دائن | الرصيد
Running balance column — essential for statement
Totals: Total invoiced | Total paid | Current balance
Print format: Official letter (company header, customer info, signature line)
Export: PDF (formal statement letter) | Excel | Word | Print (A4)
```

**R25 — أفضل العملاء**
```
Filters: Date range | N (top 5/10/20/50)
Columns: # | العميل | عدد الفواتير | إجمالي الإنفاق | متوسط الفاتورة | آخر زيارة | نقاط الولاء | الرصيد
Chart: Bar chart top 10
Export: PDF | Excel | Print
```

**R26 — تحليل تقادم الذمم**
```
Standard aging analysis
All customers with balance
Columns: العميل | الرصيد الكلي | 0-30 | 31-60 | 61-90 | +90
Chart: Aging distribution (stacked bar)
Export: PDF (collection letter format) | Excel | Word | Print
```

---

### GROUP 5: CASHIER & SHIFT REPORTS (كاشير)

**R27 — تاريخ الورديات**
```
Filters: Date range | Cashier | Status
Columns: # | الوردية | الكاشير | بداية | نهاية | المدة | رصيد الافتتاح | المبيعات | المرتجعات | المتوقع | المُعلَن | الفرق
Highlight: Discrepancy > threshold → red
Export: PDF | Excel | Print
```

**R28 — سجل التدقيق (Audit Log)**
```
Filters: Date range | User | Action type | Entity type
Columns: التاريخ والوقت | المستخدم | الإجراء | الجهة | التفاصيل | IP
Read-only, cannot be deleted
Export: PDF (compliance format) | Excel | Print
Access: Admin only
```

## E.3 Export Engine — All Options

### PDF Export
```javascript
// Using @react-pdf/renderer for client-side PDF
// All Arabic text renders with Noto Sans Arabic embedded font
// RTL text direction handled by react-pdf

// PDF options dialog:
{
  paper_size: 'A4' | 'A4_landscape' | 'A5' | 'letter',
  include_header: true,     // Company logo + name
  include_footer: true,     // Page numbers + generated date
  include_filters: true,    // Show applied filters at top
  confidential_watermark: false,  // "سري" diagonal watermark
  colored_headers: true,    // Green table headers
  font_size: 'normal' | 'small' | 'large',
}
```

### Excel Export
```javascript
// Using ExcelJS for full Excel functionality
// Features:
// - Auto-fit column widths
// - Frozen header row
// - Auto-filter on all columns
// - Conditional formatting auto-applied (stock status, aging)
// - Arabic column headers
// - Currency cells formatted as accounting
// - Summary row at bottom (bold, shaded)
// - Company info in first 3 rows
// - Sheet named after the report
// - RTL sheet direction
```

### Word Export
```javascript
// Using docx library
// Best for: Customer statements, formal letters, collection notices
// Features:
// - Company letterhead
// - Arabic RTL paragraph formatting
// - Table with styled cells
// - Signature lines at bottom
// - Editable (customer can add notes)
// - Proper Arabic text direction per paragraph
```

### Print (Direct)
```javascript
// window.print() with @media print CSS
// Hides all UI chrome
// Shows only the report content
// Paper size CSS: @page { size: A4; margin: 1cm; }
// Optimized for B&W printing (no colored backgrounds in print CSS)
```

## E.4 Export Button Design

```jsx
// Unified export toolbar on every report
function ReportExportBar({ reportType, filters }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-bg-surface rounded-lg
                    border border-border-subtle">
      <span className="text-xs text-text-muted me-2">تصدير:</span>

      <ExportButton format="pdf" icon={<FileTextIcon />}
        label="PDF" color="red" />
      <ExportButton format="excel" icon={<TableIcon />}
        label="Excel" color="green" />
      <ExportButton format="word" icon={<FileIcon />}
        label="Word" color="blue" />
      <ExportButton format="print" icon={<PrinterIcon />}
        label="طباعة" color="gray" />

      {/* Schedule button */}
      <button className="ms-auto text-xs text-text-muted hover:text-primary
                         flex items-center gap-1">
        <ClockIcon size={12} />
        جدولة التقرير
      </button>
    </div>
  );
}

// Each ExportButton:
function ExportButton({ format, icon, label, color }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error

  return (
    <button
      onClick={() => handleExport(format, setStatus)}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
        border transition-all duration-200
        ${status === 'idle'    && `border-border-normal text-text-secondary hover:border-${color}-300 hover:text-${color}-600 hover:bg-${color}-50`}
        ${status === 'loading' && 'border-border-subtle text-text-muted cursor-wait'}
        ${status === 'ready'   && 'border-success-border text-success-text bg-success-bg animate-export-ready'}
        ${status === 'error'   && 'border-danger-border text-danger-text'}
      `}>
      {status === 'loading' ? <SpinnerIcon size={12} className="animate-spin" /> : icon}
      {status === 'loading' ? 'جاري...' : status === 'ready' ? 'تحميل ✓' : label}
    </button>
  );
}
```

---

# PART F — RESPONSIVE LAYOUT (EVERY WIDTH HANDLED)

## F.1 Fluid Breakpoint System

Not just 3 breakpoints. A continuous fluid system:

```
< 480px   (phone portrait):  Ultra-compact, single column
480–639px (phone landscape): Single column, slightly more space
640–767px (tablet portrait): 2-column where useful
768–1023px (tablet landscape): Sidebar collapses to icons, content expands
1024–1279px (small desktop): Full sidebar, reduced padding
1280–1535px (normal desktop): Standard layout
1536px+ (large desktop): Max-width content, wider panels

Sidebar behavior:
  < 768px:   Hidden (drawer, opened by hamburger)
  768–1023px: Icon-only (collapsed)
  1024–1279px: Expanded but narrower (240px)
  1280px+:    Full expanded (256px)
```

## F.2 Component Breakpoint Behavior

### Tables on Narrow Screens
```jsx
// Tables are the biggest challenge on small screens
// Solution: Progressive disclosure

// 1280px+: All columns visible
// 1024-1279px: Hide lowest-priority columns (auto-determined by data-priority attribute)
// 768-1023px: Show only: Name | Amount | Status | Actions (card mode optional)
// < 768px: Switch to card mode entirely

// Each column has priority:
<th data-priority="1">الاسم</th>          // Always show
<th data-priority="2">الإجمالي</th>        // Show at 768+
<th data-priority="3">التاريخ</th>         // Show at 1024+
<th data-priority="4">الكاشير</th>         // Show at 1280+
<th data-priority="5">رقم الجهاز</th>      // Show at 1536+

// CSS:
@media (max-width: 1279px) { [data-priority="5"] { display: none; } }
@media (max-width: 1023px) { [data-priority="4"] { display: none; } }
@media (max-width: 767px)  { [data-priority="3"] { display: none; } }
```

### POS Screen on Narrow
```
1280px+:  Left 65% item grid | Right 35% invoice
1024-1279px: Left 60% | Right 40%
768-1023px: Tabs — [الأصناف] [الفاتورة] — single panel, toggle between
< 768px: Same tab approach, larger touch targets
```

### Forms on Narrow
```
1280px+: 2-column form layouts
1024-1279px: 2-column (slightly tighter)
768-1023px: 1-column
< 768px: 1-column, full-width inputs, larger padding
```

### Modal Width Scaling
```
1280px+: Max-width 600px (form) or 900px (wide)
1024-1279px: Max-width 560px or 800px
768-1023px: Max-width 90vw
< 768px: Slides from bottom as sheet (bottom drawer style), not centered modal
```

## F.3 Sidebar Collapse Animation

```jsx
// Smooth collapse — not a snap
// 300ms cubic-bezier transition on width
// Text labels fade independently (faster than width)
// Icons stay centered during collapse
// Tooltip shows label on hover when collapsed

function Sidebar({ isCollapsed }) {
  return (
    <aside style={{
      width: isCollapsed ? 64 : 256,
      transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      {navItems.map(item => (
        <NavItem
          key={item.key}
          item={item}
          collapsed={isCollapsed}
        />
      ))}
    </aside>
  );
}

function NavItem({ item, collapsed }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
      <item.Icon size={20} className="flex-shrink-0" />
      <span style={{
        opacity: collapsed ? 0 : 1,
        width: collapsed ? 0 : 'auto',
        overflow: 'hidden',
        transition: 'opacity 200ms ease, width 300ms ease',
        whiteSpace: 'nowrap',
      }}>
        {item.label_ar}
      </span>
    </div>
  );
}
```

## F.4 Mobile Drawer (< 768px)

```jsx
// Hamburger opens full-screen drawer from right (RTL)
// Backdrop closes on tap
// Swipe right (RTL: left) to close

function MobileDrawer({ isOpen, onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className={`fixed top-0 end-0 h-full w-72 bg-bg-surface z-50
        border-s border-border-subtle shadow-modal
        transition-transform duration-350 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        // RTL: translate-x-full = off to the right
      >
        {/* Drawer content */}
      </div>
    </>
  );
}
```

---

# PART G — DATE FIELD TESTING TOOL

## G.1 Purpose

On every date input across the entire app, there is a hidden "dev shortcut" to quickly set dates for testing flows without navigating the calendar picker.

## G.2 Implementation

```jsx
// DateInput.jsx — every date field
// In development AND in settings if "وضع الاختبار" is enabled

function DateInput({ value, onChange, label, ...props }) {
  const [showQuickDates, setShowQuickDates] = useState(false);

  const quickDates = [
    { label: 'اليوم', value: today() },
    { label: 'أمس', value: yesterday() },
    { label: 'بداية الشهر', value: startOfMonth() },
    { label: 'نهاية الشهر', value: endOfMonth() },
    { label: 'بداية السنة', value: startOfYear() },
    { label: 'قبل 30 يوم', value: daysAgo(30) },
    { label: 'قبل 90 يوم', value: daysAgo(90) },
    { label: 'قبل سنة', value: daysAgo(365) },
  ];

  return (
    <div className="relative">
      <div className="flex gap-1">
        <input type="date" value={value} onChange={onChange} {...props}
          className="input flex-1" />
        {/* Quick-date trigger — small icon button */}
        <button
          type="button"
          onClick={() => setShowQuickDates(v => !v)}
          className="w-8 rounded-lg border border-border-normal
                     text-text-muted hover:text-primary hover:border-primary
                     text-xs transition-all"
          title="تواريخ سريعة للاختبار">
          ⚡
        </button>
      </div>

      {/* Quick dates dropdown */}
      {showQuickDates && (
        <div className="absolute start-0 top-full mt-1 z-50
                        bg-bg-elevated border border-border-normal rounded-lg
                        shadow-elevated min-w-[160px] overflow-hidden
                        animate-slide-down">
          {quickDates.map(d => (
            <button key={d.label}
              type="button"
              onClick={() => { onChange(d.value); setShowQuickDates(false); }}
              className="w-full text-start px-3 py-2 text-xs text-text-secondary
                         hover:bg-bg-overlay hover:text-primary transition-colors">
              {d.label}
              <span className="text-text-muted ms-2">{d.value}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

## G.3 Date Range Test Tool (For Reports)

```jsx
// On report filter panels, a "فترات اختبار سريعة" section
// Collapsed by default, expanded by small ⚡ button

const TEST_PERIODS = [
  { label: 'هذا الشهر', from: startOfMonth(), to: today() },
  { label: 'الشهر الماضي', from: startOfLastMonth(), to: endOfLastMonth() },
  { label: 'هذه السنة', from: startOfYear(), to: today() },
  { label: 'آخر 7 أيام', from: daysAgo(7), to: today() },
  { label: 'آخر 30 يوم', from: daysAgo(30), to: today() },
  { label: 'آخر 90 يوم', from: daysAgo(90), to: today() },
  { label: 'آخر سنة', from: daysAgo(365), to: today() },
];
```

---

# PART H — SETTINGS: APP NAME & LOGO

## H.1 App Identity Section in Settings

Location: Settings → معلومات الشركة → هوية التطبيق

```
┌────────────────────────────────────────────────────────┐
│  هوية التطبيق                                          │
│  ──────────────────────────────────────────────────   │
│                                                        │
│  اسم التطبيق (يظهر في شريط العنوان والفاتورة):        │
│  ┌──────────────────────────────────────────────┐     │
│  │  إلهيجازي للتجزئة                            │     │
│  └──────────────────────────────────────────────┘     │
│                                                        │
│  الاسم الفرعي (يظهر تحت الاسم الرئيسي):               │
│  ┌──────────────────────────────────────────────┐     │
│  │  نظام إدارة المبيعات والمخزون                │     │
│  └──────────────────────────────────────────────┘     │
│                                                        │
│  الشعار:                                              │
│  ┌────────────────────┐  ┌───────────────────────┐   │
│  │                    │  │                       │   │
│  │   [LOGO PREVIEW]   │  │  اسحب وأفلت الصورة   │   │
│  │                    │  │  أو اضغط للاختيار    │   │
│  │                    │  │                       │   │
│  └────────────────────┘  │  PNG, JPG, SVG        │   │
│                          │  الحد الأقصى: 2MB     │   │
│                          └───────────────────────┘   │
│                                                        │
│  خيارات الشعار:                                       │
│  ☑ إظهار على الفواتير     ☑ إظهار على الإيصالات      │
│  ☑ إظهار في شريط التنقل   ☐ إظهار على التقارير       │
│                                                        │
│  أدوات تحرير الشعار:                                  │
│  [قص الصورة] [تعديل الحجم] [إزالة الخلفية]           │
│                                                        │
│  [معاينة على الفاتورة]   [حفظ التغييرات]              │
└────────────────────────────────────────────────────────┘
```

## H.2 Logo Upload with Crop Tool

```jsx
// When user uploads logo, a crop modal opens
// Uses react-image-crop library
// User can:
//   - Drag to select crop area
//   - Rotate 90° increments
//   - Zoom in/out
//   - Lock aspect ratio (1:1 for square logos)
//   - Preview result in real-time

function LogoUploadModal({ onSave }) {
  const [src, setSrc] = useState(null);
  const [crop, setCrop] = useState({ aspect: 1 });
  const [rotation, setRotation] = useState(0);

  return (
    <div className="modal-panel p-6">
      <h3 className="font-bold text-lg mb-4">تحرير الشعار</h3>

      {/* Crop area */}
      <ReactCrop crop={crop} onChange={setCrop} aspect={freeAspect}>
        <img src={src} style={{ transform: `rotate(${rotation}deg)` }} />
      </ReactCrop>

      {/* Controls */}
      <div className="flex gap-2 mt-4">
        <button onClick={() => setRotation(r => r - 90)}>↺ تدوير</button>
        <button onClick={() => setRotation(r => r + 90)}>↻ تدوير</button>
        <label><input type="checkbox" /> نسبة ثابتة 1:1</label>
      </div>

      {/* Size presets */}
      <div className="flex gap-2 mt-3">
        <span className="text-xs text-text-muted">الحجم المقترح:</span>
        <button onClick={() => resizeTo(200,200)} className="text-xs border rounded px-2">200×200</button>
        <button onClick={() => resizeTo(400,200)} className="text-xs border rounded px-2">400×200</button>
        <button onClick={() => resizeTo(600,200)} className="text-xs border rounded px-2">600×200</button>
      </div>

      <div className="flex gap-3 mt-6">
        <button className="btn-secondary flex-1">إلغاء</button>
        <button onClick={handleSave} className="btn-primary flex-1">حفظ الشعار</button>
      </div>
    </div>
  );
}
```

## H.3 Live App Name Update

```javascript
// When app name is saved:
// 1. Update Settings table in SQLite
// 2. Update the Electron window title: mainWindow.setTitle(newName)
// 3. Update the sidebar logo text immediately (React state)
// 4. Update invoice print templates immediately
// No app restart needed — all dynamic

// Via IPC:
ipcRenderer.invoke('app:set-title', newAppName);
// In main process:
ipcMain.handle('app:set-title', (event, title) => {
  mainWindow.setTitle(title);
});
```

---

# PART I — REMOVING AI BADGES & ICONS

## I.1 What to Remove

AI badge/icon/tag appears in the previous plan on these elements — **all removed**:

```
❌ Remove from:
  - Dashboard KPI cards (no "AI-powered" tag)
  - Reports page cards (no "AI insights" badge)
  - Item form (no "AI-suggested price" tag)
  - Customer form (no "AI risk score" badge)
  - Low stock notifications (no "AI prediction" indicator)
  - Any "✨" sparkle icon in UI
  - Any "Powered by AI" footers
  - Any floating AI assistant bubble

✅ Replace with:
  - Clean data labels
  - System-calculated badges where applicable
  - Remove entirely otherwise
```

---

# PART J — ENHANCED FEATURES (IN-DEPTH)

## J.1 POS Screen — Enhanced Features

### Smart Item Suggestions
```
When typing in search bar:
  NOT an "AI suggestion" — just a smart recent-items algorithm
  Shows: "آخر 5 أصناف بعت لهذا العميل" when customer is selected
  Shows: "الأصناف الأكثر بيعاً الآن" as category shortcut
  No AI labels — just "الأكثر مبيعاً" / "الأخيرة"
```

### Multi-Line Discount
```
Invoice-level discount AND per-line discount can coexist
Per-line: click any price cell → inline editor opens
  Shows: Current price | Min price limit | % discount
  Color feedback: Green if above min | Red if at/below min
  Permission-gated: shows lock icon if no permission
Invoice-level: separate field at bottom
  When both present: shows breakdown clearly
```

### Payment — Split with Exact Change
```
Split payment calculator:
  [Cash: _____] [Card: _____] [Credit: _____]
  Running remaining shown below
  Change calculated only on cash portion
  "توزيع تلقائي" button: distributes evenly
```

## J.2 Items Module — Enhanced

### Bulk Price Update V2
```
Not just a flat percentage increase.
Supports:
  - Set exact price: "اجعل السعر 10 ر.س"
  - Increase by amount: "+2 ر.س"
  - Increase by %: "+10%"
  - Set price = cost + margin: "تكلفة + 30%"
  - Copy from column: "السعر2 = السعر1 × 90%"
  - Round to nearest: "أقرب 0.50 ر.س"

Preview grid:
  Before | After | Difference | % Change
  Each row: editable (can override calculation for individual items)
  Checkbox to exclude specific items

Undo for 30 seconds after applying (stores previous prices in memory)
```

### Item Detail Page V2
```
Full-width layout (not modal):
  Left column (40%):
    - Large item image (zoomable on click)
    - All barcodes (scannable QR shown)
    - Basic info (name, code, category, unit)
    - Status toggles (active, featured)

  Right column (60%):
    Tabs: التفاصيل | الأسعار | المخزون | المبيعات | الشراء | الأرقام التسلسلية

  Prices tab:
    Live price edit (click any price to edit inline)
    Price history chart (last 12 months)
    Margin calculator shown live

  Stock tab:
    Per-warehouse table with mini progress bars
    "تسوية سريعة" button per warehouse
    Stock movement mini chart (last 30 days)
    
  Sales tab:
    "الأكثر بيعاً في" badge if in top 10
    Sales chart (last 12 months)
    Top customers for this item
```

## J.3 Reports — Filter Panel V2

```jsx
// Universal filter panel that every report uses
// Collapsible — collapsed by default on re-open if last state was collapsed
// Shows active filter count: "3 فلاتر نشطة" when collapsed

function ReportFilterPanel({ config, filters, onChange }) {
  const [open, setOpen] = useState(true);
  const activeCount = countActiveFilters(filters);

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-lg mb-4">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4">
        <span className="font-medium text-sm">
          الفلاتر
          {!open && activeCount > 0 && (
            <span className="ms-2 px-1.5 py-0.5 bg-primary/10 text-primary
                             text-xs rounded-full">
              {activeCount} نشط
            </span>
          )}
        </span>
        <ChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Filter fields (animated expand) */}
      <div className={`overflow-hidden transition-all duration-300
        ${open ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

          {/* Date range — always present */}
          <div className="col-span-full sm:col-span-2">
            <label className="label">الفترة الزمنية</label>
            <div className="flex gap-2 items-center">
              <DateInput value={filters.from} onChange={v => onChange('from', v)} />
              <span className="text-text-muted">—</span>
              <DateInput value={filters.to} onChange={v => onChange('to', v)} />
            </div>
            {/* Quick period buttons */}
            <div className="flex gap-1 mt-1 flex-wrap">
              {QUICK_PERIODS.map(p => (
                <button key={p.key}
                  onClick={() => { onChange('from', p.from); onChange('to', p.to); }}
                  className={`px-2 py-0.5 text-xs rounded border transition-all
                    ${isActivePeriod(filters, p)
                      ? 'bg-primary text-white border-primary'
                      : 'border-border-normal text-text-muted hover:border-primary hover:text-primary'
                    }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic filter fields based on report config */}
          {config.filters.map(field => (
            <FilterField key={field.key} field={field}
              value={filters[field.key]}
              onChange={v => onChange(field.key, v)} />
          ))}
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 flex gap-2">
          <button onClick={applyFilters}
            className="btn-primary text-sm">
            تطبيق الفلاتر
          </button>
          <button onClick={resetFilters}
            className="btn-secondary text-sm">
            إعادة تعيين
          </button>
        </div>
      </div>
    </div>
  );
}
```

## J.4 Customer Module — Enhanced

### Customer Account Statement — Print V2
```
A4 formal letter format:
  [Company Logo]         [Company Name + Address]
  ────────────────────────────────────────────
  كشف حساب
  العميل: ___________    رقم العميل: _________
  الفترة: _________ إلى _________

  ┌──────┬─────────┬──────┬──────────┬──────────┬───────┐
  │التاريخ│المرجع  │فاتورة│   مدين   │   دائن   │الرصيد │
  ├──────┼─────────┼──────┼──────────┼──────────┼───────┤
  │ ...  │ ...     │ ...  │   ...    │   ...    │  ...  │
  ├──────┴─────────┴──────┼──────────┼──────────┼───────┤
  │       الإجمالي        │ إجمالي مدين │ إجمالي دائن │ الرصيد الختامي │

  ────────────────────────────────────────────────────
  توقيع المحاسب:                    توقيع العميل:
  ________________                 ________________

  [Company Footer: address, phone, commercial register]
```

### Customer Detail — Activity Timeline
```
Instead of boring tab tables:
  Right column: Vertical timeline
  Each event: colored dot + date + event description
  Sale: green dot
  Payment: blue dot
  Return: amber dot
  Note: gray dot

  Events slide in from bottom on page load (stagger 50ms)
  Click event: expands to show full details
  Filter timeline by type (toggles at top)
```

## J.5 Stock Management — Enhanced

### Physical Count — Enhanced UI
```
Not just a table. A proper inventory flow:

Step 1: Setup
  - Select warehouse
  - Select categories to count (all or subset)
  - Print count sheets option

Step 2: Count Entry
  Scan barcode → item row highlights, cursor jumps to count field
  
  Progress: "تم عد 145 من 320 صنف"
  Ring chart: fills as you count
  
  Variance indicator per row:
    Match (±0): green ✓
    Small diff (±5%): amber ⚠
    Large diff (>5%): red ✕

  Items with large variance float to top

Step 3: Review
  Shows ONLY items with variance
  Side-by-side: System Qty vs Counted Qty vs Difference
  Can still edit counts
  "تجاهل الفروقات الصغيرة (< 1 قطعة)" toggle

Step 4: Confirm
  Adjustment preview
  Total value impact shown: "+/-  ١٢,٥٠٠ ج.م"
  Requires supervisor approval if adjustment > threshold
  On confirm: rows flash green in sequence
```

## J.6 Shift Management — Enhanced

### Real-time Shift Dashboard (Inside POS)
```
Shift status bar shows:
  [SHIFT-001]  |  أحمد محمد  |  مفتوح منذ 3:42  |  47 فاتورة  |  ١٢,٤٠٠ ج.م
  
  Animated: time counter ticks every second
  Invoice count increments with bounce animation when new invoice
  Sales total bounces when new invoice

Cashier can run X-report any time:
  Shows mini popup (not full screen)
  Printable in thermal format
  Does NOT reset counters

Shift close walkthrough:
  Step 1: System summary (all numbers animated)
  Step 2: Cash count input (extra large font)
           Expected vs Declared side by side
           Animated progress if match
  Step 3: Z-report preview (full scroll)
  Step 4: Print options (thermal/A4) + close button
```

---

# PART K — VISUAL RICHNESS (NOT BORING)

## K.1 What Was Boring in V1 — Fixed

```
Problem 1: Uniform card grid on dashboard — everything same size
Solution: Masonry/editorial layout
  - Main KPI: full width, large
  - Revenue chart: 2/3 width
  - Category chart: 1/3 width
  - Recent activity + quick actions side by side
  - Creates visual rhythm

Problem 2: Tables are data dumps
Solution: Every table has:
  - Status columns use icon + colored background pills (not just text)
  - Amount columns: larger font, primary color
  - Action columns: hover reveals buttons with icons
  - Empty states: illustrated SVG (not just text)
  - Loading: animated skeleton that matches the actual layout

Problem 3: Sidebar nav looks like every other admin panel
Solution:
  - Active item: gradient background, animated entrance
  - Items have subtle category groupings with faded group labels
  - Bottom user area: avatar, name, role badge, logout
  - Top: small brand strip with gradient

Problem 4: Forms are just stacked inputs
Solution:
  - Floating labels (label moves up when focused)
  - Input icons where relevant (barcode icon, calendar icon)
  - Validation feedback: inline icons (✓ green / ✗ red)
  - Section cards with subtle left-border accent
  - Progress indicator on multi-step forms

Problem 5: Modals pop in without personality
Solution:
  - Spring animation (bounces slightly)
  - Backdrop: blur + dim
  - Entry from direction relevant to trigger position
```

## K.2 Illustrative Empty States

Every empty table/list has a proper illustration:

```jsx
const EMPTY_STATES = {
  invoices:   { icon: '🧾', title: 'لا توجد فواتير', desc: 'ابدأ بإنشاء أول فاتورة بيع' },
  customers:  { icon: '👥', title: 'لا يوجد عملاء', desc: 'أضف عميلك الأول للبدء' },
  items:      { icon: '📦', title: 'لا توجد أصناف', desc: 'أضف أصنافك أو استوردها من Excel' },
  stock_low:  { icon: '⚠️', title: 'المخزون بخير!', desc: 'جميع الأصناف فوق الحد الأدنى' },
  payments:   { icon: '💰', title: 'لا توجد مدفوعات', desc: 'سجل أول دفعة من عميل' },
  reports:    { icon: '📊', title: 'لا توجد بيانات', desc: 'غيّر الفترة الزمنية أو الفلاتر' },
  notifications: { icon: '🔔', title: 'لا إشعارات جديدة', desc: 'ستظهر هنا تنبيهات المخزون والمواعيد' },
};

function EmptyState({ type }) {
  const state = EMPTY_STATES[type];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-6xl mb-4 animate-bounce-slow">{state.icon}</span>
      <h3 className="font-semibold text-text-primary mb-1">{state.title}</h3>
      <p className="text-text-muted text-sm">{state.desc}</p>
    </div>
  );
}
```

## K.3 Dashboard — Editorial Layout

```
Row 1: 4 KPI cards (equal width, count-up on load)
Row 2: [Revenue chart 2/3] | [Sales by category 1/3]
Row 3: [Today's transactions table 1/2] | [Low stock alerts 1/4 + Quick actions 1/4]
Row 4: [Top 5 items bar chart full width] (scrollable on small screens)

All rows: stagger-enter on page load (each row 100ms after previous)
Charts: draw in on enter (clip-path reveals)
KPIs: count-up 800ms
```

## K.4 Light Theme Accent Moments

```
When light theme is active, these make it premium (not flat):

1. Sidebar active item: 
   background: linear-gradient(135deg, #ECFDF5, #D1FAE5)
   Subtle shimmer effect on first activation

2. Primary button:
   background: linear-gradient(135deg, #059669, #047857)
   Shine effect on hover (::after with gradient moves across)

3. KPI card top border:
   3px gradient strip at card top: #059669 → #34D399 → transparent
   Only on KPI cards — marks them as special

4. Table header row:
   background: linear-gradient(180deg, #F8FAFC, #F1F5F9)
   Bottom border: 2px solid #E2E8F0

5. Section dividers:
   Never solid lines. Always:
   background: linear-gradient(90deg, transparent, #E2E8F0 30%, #E2E8F0 70%, transparent)

6. Success feedback color:
   When form saves: brief #ECFDF5 background flash on the form section
   Button: shimmer sweep animation
```

---

# APPENDIX: QUICK REFERENCE

## Removed Features (Per Request)
```
❌ AI badge/icon/label on any page
❌ "Powered by AI" anywhere
❌ Sparkle ✨ icons suggesting AI
❌ Any autonomous AI suggestion that looks like it came from a model
```

## New Required npm Packages
```bash
npm install framer-motion          # Spring animations, layout animations
npm install react-image-crop       # Logo crop tool
npm install @react-pdf/renderer    # Client-side PDF generation with Arabic
npm install exceljs                # Excel export with full formatting
npm install docx                   # Word export
npm install react-hot-toast        # Toast notifications
npm install tailwindcss-animate    # Tailwind animation utilities
npm install tailwindcss-flip       # RTL auto-flip
npm install clsx                   # Class name merging
npm install date-fns               # Date utilities with Arabic locale
```

## File Structure Additions (New from V2)
```
client/src/
├── components/
│   ├── help/
│   │   ├── TourPopup.jsx          ← New: positioned popup
│   │   ├── TourSpotlight.jsx      ← New: spotlight overlay
│   │   └── SmartTooltip.jsx
│   ├── print/
│   │   ├── ReceiptDesigner.jsx    ← New: full designer
│   │   ├── ReceiptLivePreview.jsx ← New: real-time preview
│   │   ├── A4InvoiceDesigner.jsx  ← New
│   │   └── PrintActionPanel.jsx   ← New: per-invoice print options
│   ├── reports/
│   │   ├── ReportFilterPanel.jsx  ← New: universal filter
│   │   ├── ExportBar.jsx          ← New: all export buttons
│   │   └── ReportCard.jsx         ← New: reports center card
│   └── ui/
│       ├── DateInput.jsx          ← Enhanced: with quick dates
│       ├── EmptyState.jsx         ← New: illustrated empty states
│       └── AnimatedNumber.jsx     ← Enhanced
├── help/
│   └── helpContent.js             ← Enhanced: all 28 pages defined
└── data/
    └── testDates.js               ← Quick date utilities for testing
```

---

*End of ElHegazi Retailer UI/UX Design Plan V2*
*Covers: Light theme default, All tours positioned, Cinematic animations, 5 print sizes, 28 reports with 4 export formats, Responsive fluid layout, Date testing tool, App name/logo settings, Zero AI badges, Full editorial visual design*
