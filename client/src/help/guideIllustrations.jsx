import React from "react";

const ACCENT = "var(--primary)";
const ACCENT_LIGHT = "var(--primary-50, #e8f5e9)";
const GREEN = "#22c55e";
const RED = "#ef4444";
const AMBER = "#f59e0b";
const MUTED = "var(--border-normal)";

/* ── POS Checkout Flow ─────────────────────────────────────────────────── */
export function PosCheckoutFlow() {
  return (
    <svg viewBox="0 0 320 80" fill="none" className="w-full max-w-xs mx-auto">
      <rect x="10" y="10" width="80" height="60" rx="12" fill={ACCENT_LIGHT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="50" y="32" textAnchor="middle" fontSize="9" fontWeight="700" fill={ACCENT}>🔍</text>
      <text x="50" y="48" textAnchor="middle" fontSize="8" fontWeight="800" fill="#334155">امسح</text>
      <text x="50" y="58" textAnchor="middle" fontSize="7" fontWeight="600" fill="#64748b">Barcode</text>
      <line x1="95" y1="40" x2="125" y2="40" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3"/>
      <polygon points="123,36 131,40 123,44" fill={ACCENT}/>
      <rect x="130" y="10" width="80" height="60" rx="12" fill={ACCENT_LIGHT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="170" y="32" textAnchor="middle" fontSize="9" fontWeight="700" fill={ACCENT}>📋</text>
      <text x="170" y="48" textAnchor="middle" fontSize="8" fontWeight="800" fill="#334155">راجع</text>
      <text x="170" y="58" textAnchor="middle" fontSize="7" fontWeight="600" fill="#64748b">الفاتورة</text>
      <line x1="215" y1="40" x2="245" y2="40" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3"/>
      <polygon points="243,36 251,40 243,44" fill={ACCENT}/>
      <rect x="250" y="10" width="60" height="60" rx="12" fill={GREEN} stroke={GREEN} strokeWidth="1.5"/>
      <text x="280" y="32" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">💰</text>
      <text x="280" y="48" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff">اقبض</text>
      <text x="280" y="58" textAnchor="middle" fontSize="7" fontWeight="600" fill="rgba(255,255,255,0.8)">اطبع</text>
    </svg>
  );
}

/* ── Daily Treasury Equation ───────────────────────────────────────────── */
export function TreasuryEquationFlow() {
  return (
    <svg viewBox="0 0 340 70" fill="none" className="w-full max-w-xs mx-auto">
      <rect x="5" y="5" width="70" height="60" rx="10" fill={ACCENT_LIGHT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="40" y="30" textAnchor="middle" fontSize="20">🏦</text>
      <text x="40" y="50" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">رصيد الصبح</text>
      <text x="40" y="59" textAnchor="middle" fontSize="7" fontWeight="600" fill="#64748b">١٠٠٠ ج</text>
      <text x="82" y="40" textAnchor="middle" fontSize="16" fontWeight="900" fill={ACCENT}>+</text>
      <rect x="95" y="5" width="70" height="60" rx="10" fill="#ecfdf5" stroke={GREEN} strokeWidth="1.5"/>
      <text x="130" y="30" textAnchor="middle" fontSize="20">📈</text>
      <text x="130" y="50" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">اللي دخل</text>
      <text x="130" y="59" textAnchor="middle" fontSize="7" fontWeight="600" fill={GREEN}>+٥٠٠٠</text>
      <text x="172" y="40" textAnchor="middle" fontSize="16" fontWeight="900" fill={ACCENT}>−</text>
      <rect x="185" y="5" width="70" height="60" rx="10" fill="#fef2f2" stroke={RED} strokeWidth="1.5"/>
      <text x="220" y="30" textAnchor="middle" fontSize="20">💸</text>
      <text x="220" y="50" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">اللي خرج</text>
      <text x="220" y="59" textAnchor="middle" fontSize="7" fontWeight="600" fill={RED}>−٢٠٠٠</text>
      <text x="262" y="40" textAnchor="middle" fontSize="16" fontWeight="900" fill={ACCENT}>=</text>
      <rect x="275" y="5" width="60" height="60" rx="10" fill={ACCENT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="305" y="30" textAnchor="middle" fontSize="20">✅</text>
      <text x="305" y="50" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#fff">المفروض</text>
      <text x="305" y="59" textAnchor="middle" fontSize="7" fontWeight="600" fill="rgba(255,255,255,0.8)">٤٠٠٠</text>
    </svg>
  );
}

/* ── Purchase Chain ────────────────────────────────────────────────────── */
export function PurchaseChainFlow() {
  return (
    <svg viewBox="0 0 320 80" fill="none" className="w-full max-w-xs mx-auto">
      <rect x="10" y="10" width="70" height="60" rx="10" fill={ACCENT_LIGHT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="45" y="30" textAnchor="middle" fontSize="18">📝</text>
      <text x="45" y="48" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">أمر شراء</text>
      <text x="45" y="58" textAnchor="middle" fontSize="6.5" fill="#64748b">اطلب من المورد</text>
      <line x1="85" y1="40" x2="120" y2="40" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3"/>
      <polygon points="118,36 126,40 118,44" fill={ACCENT}/>
      <rect x="125" y="10" width="80" height="60" rx="10" fill={ACCENT_LIGHT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="165" y="30" textAnchor="middle" fontSize="18">🚚</text>
      <text x="165" y="48" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">البضاعة في الطريق</text>
      <text x="165" y="58" textAnchor="middle" fontSize="6.5" fill="#64748b">مستنية توصل</text>
      <line x1="210" y1="40" x2="245" y2="40" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3"/>
      <polygon points="243,36 251,40 243,44" fill={ACCENT}/>
      <rect x="250" y="10" width="60" height="60" rx="10" fill={GREEN} stroke={GREEN} strokeWidth="1.5"/>
      <text x="280" y="30" textAnchor="middle" fontSize="18">📦</text>
      <text x="280" y="48" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#fff">استلام</text>
      <text x="280" y="58" textAnchor="middle" fontSize="6.5" fill="rgba(255,255,255,0.8)">→ مخزون</text>
    </svg>
  );
}

/* ── Branch Transfer Flow ──────────────────────────────────────────────── */
export function BranchTransferFlow() {
  return (
    <svg viewBox="0 0 340 80" fill="none" className="w-full max-w-xs mx-auto">
      <rect x="5" y="10" width="75" height="60" rx="10" fill={ACCENT_LIGHT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="42" y="30" textAnchor="middle" fontSize="18">🏪</text>
      <text x="42" y="48" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">الفرع المرسل</text>
      <text x="42" y="58" textAnchor="middle" fontSize="6.5" fill="#64748b">يخصم فوراً</text>
      <line x1="85" y1="40" x2="120" y2="40" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3"/>
      <polygon points="118,36 126,40 118,44" fill={ACCENT}/>
      <rect x="125" y="10" width="90" height="60" rx="10" fill="#fffbeb" stroke={AMBER} strokeWidth="1.5"/>
      <text x="170" y="28" textAnchor="middle" fontSize="18">🚛</text>
      <text x="170" y="46" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">في الطريق</text>
      <text x="170" y="56" textAnchor="middle" fontSize="6.5" fill="#64748b">مش على رف حد</text>
      <circle cx="170" cy="64" r="3" fill={AMBER} opacity="0.5"/>
      <line x1="220" y1="40" x2="255" y2="40" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3"/>
      <polygon points="253,36 261,40 253,44" fill={ACCENT}/>
      <rect x="260" y="10" width="75" height="60" rx="10" fill="#ecfdf5" stroke={GREEN} strokeWidth="1.5"/>
      <text x="297" y="28" textAnchor="middle" fontSize="18">✅</text>
      <text x="297" y="46" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">تأكيد الاستلام</text>
      <text x="297" y="56" textAnchor="middle" fontSize="6.5" fill="#64748b">← هنا بتدخل المخزون</text>
    </svg>
  );
}

/* ── Physical Count Flow ───────────────────────────────────────────────── */
export function PhysicalCountFlow() {
  return (
    <svg viewBox="0 0 320 80" fill="none" className="w-full max-w-xs mx-auto">
      <rect x="10" y="10" width="70" height="60" rx="10" fill={ACCENT_LIGHT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="45" y="28" textAnchor="middle" fontSize="16">📂</text>
      <text x="45" y="46" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">١. حدد</text>
      <text x="45" y="56" textAnchor="middle" fontSize="6.5" fill="#64748b">النطاق</text>
      <line x1="85" y1="40" x2="120" y2="40" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3"/>
      <polygon points="118,36 126,40 118,44" fill={ACCENT}/>
      <rect x="125" y="10" width="80" height="60" rx="10" fill="#fffbeb" stroke={AMBER} strokeWidth="1.5"/>
      <text x="165" y="28" textAnchor="middle" fontSize="16">📱</text>
      <text x="165" y="46" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">٢. عُدّ وسجّل</text>
      <text x="165" y="56" textAnchor="middle" fontSize="6.5" fill="#64748b">امشِ على الرف</text>
      <line x1="210" y1="40" x2="245" y2="40" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3"/>
      <polygon points="243,36 251,40 243,44" fill={ACCENT}/>
      <rect x="250" y="10" width="60" height="60" rx="10" fill={GREEN} stroke={GREEN} strokeWidth="1.5"/>
      <text x="280" y="28" textAnchor="middle" fontSize="16">⚖️</text>
      <text x="280" y="46" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#fff">٣. راجع</text>
      <text x="280" y="56" textAnchor="middle" fontSize="6.5" fill="rgba(255,255,255,0.8)">الفروقات</text>
    </svg>
  );
}

/* ── Cheque Lifecycle ──────────────────────────────────────────────────── */
export function ChequeLifecycleFlow() {
  return (
    <svg viewBox="0 0 340 80" fill="none" className="w-full max-w-xs mx-auto">
      <rect x="5" y="10" width="60" height="60" rx="10" fill={ACCENT_LIGHT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="35" y="30" textAnchor="middle" fontSize="18">📄</text>
      <text x="35" y="48" textAnchor="middle" fontSize="7" fontWeight="800" fill="#334155">مستلم</text>
      <text x="35" y="58" textAnchor="middle" fontSize="6" fill="#64748b">ورقة في الدرج</text>
      <line x1="70" y1="40" x2="100" y2="40" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3"/>
      <polygon points="98,36 106,40 98,44" fill={ACCENT}/>
      <rect x="105" y="10" width="65" height="60" rx="10" fill="#fffbeb" stroke={AMBER} strokeWidth="1.5"/>
      <text x="137" y="30" textAnchor="middle" fontSize="18">🏦</text>
      <text x="137" y="48" textAnchor="middle" fontSize="7" fontWeight="800" fill="#334155">مودَع</text>
      <text x="137" y="58" textAnchor="middle" fontSize="6" fill="#64748b">في البنك</text>
      <line x1="175" y1="40" x2="205" y2="40" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3"/>
      <polygon points="203,36 211,40 203,44" fill={ACCENT}/>
      <rect x="210" y="10" width="60" height="60" rx="10" fill="#ecfdf5" stroke={GREEN} strokeWidth="1.5"/>
      <text x="240" y="30" textAnchor="middle" fontSize="18">✅</text>
      <text x="240" y="48" textAnchor="middle" fontSize="7" fontWeight="800" fill="#22c55e">محصَّل</text>
      <text x="240" y="58" textAnchor="middle" fontSize="6" fill="#64748b">فلوس حقيقية</text>
      <line x1="275" y1="40" x2="305" y2="40" stroke={RED} strokeWidth="1.5" strokeDasharray="4 3"/>
      <polygon points="303,36 311,40 303,44" fill={RED}/>
      <rect x="275" y="10" width="60" height="60" rx="10" fill="#fef2f2" stroke={RED} strokeWidth="1.5" style={{transform:"translateX(30px)"}}/>
      <text x="315" y="30" textAnchor="middle" fontSize="18">↩️</text>
      <text x="315" y="48" textAnchor="middle" fontSize="7" fontWeight="800" fill={RED}>مرتد</text>
      <text x="315" y="58" textAnchor="middle" fontSize="6" fill="#64748b">ارجع كلّمه</text>
    </svg>
  );
}

/* ── Employee Payroll Equation ─────────────────────────────────────────── */
export function PayrollEquationFlow() {
  return (
    <svg viewBox="0 0 340 70" fill="none" className="w-full max-w-xs mx-auto">
      <rect x="5" y="5" width="65" height="60" rx="10" fill={ACCENT_LIGHT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="37" y="28" textAnchor="middle" fontSize="18">💵</text>
      <text x="37" y="48" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">الأساسي</text>
      <text x="37" y="58" textAnchor="middle" fontSize="6.5" fill="#64748b">٥٠٠٠ ج</text>
      <text x="77" y="38" textAnchor="middle" fontSize="16" fontWeight="900" fill={ACCENT}>+</text>
      <rect x="88" y="5" width="55" height="60" rx="10" fill="#ecfdf5" stroke={GREEN} strokeWidth="1.5"/>
      <text x="115" y="28" textAnchor="middle" fontSize="18">📈</text>
      <text x="115" y="48" textAnchor="middle" fontSize="7" fontWeight="800" fill="#334155">حوافز</text>
      <text x="115" y="58" textAnchor="middle" fontSize="6.5" fill={GREEN}>+٥٠٠</text>
      <text x="149" y="38" textAnchor="middle" fontSize="16" fontWeight="900" fill={ACCENT}>−</text>
      <rect x="160" y="5" width="55" height="60" rx="10" fill="#fef2f2" stroke={RED} strokeWidth="1.5"/>
      <text x="187" y="28" textAnchor="middle" fontSize="18">⚖️</text>
      <text x="187" y="48" textAnchor="middle" fontSize="7" fontWeight="800" fill="#334155">خصومات</text>
      <text x="187" y="58" textAnchor="middle" fontSize="6.5" fill={RED}>−٢٠٠</text>
      <text x="221" y="38" textAnchor="middle" fontSize="16" fontWeight="900" fill={ACCENT}>−</text>
      <rect x="232" y="5" width="55" height="60" rx="10" fill="#fffbeb" stroke={AMBER} strokeWidth="1.5"/>
      <text x="259" y="28" textAnchor="middle" fontSize="18">🤝</text>
      <text x="259" y="48" textAnchor="middle" fontSize="7" fontWeight="800" fill="#334155">سلف</text>
      <text x="259" y="58" textAnchor="middle" fontSize="6.5" fill={AMBER}>−١٠٠٠</text>
      <text x="293" y="38" textAnchor="middle" fontSize="16" fontWeight="900" fill={ACCENT}>=</text>
      <rect x="305" y="5" width="30" height="60" rx="10" fill={ACCENT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="320" y="30" textAnchor="middle" fontSize="16" fontWeight="900" fill="#fff">4.3K</text>
      <text x="320" y="50" textAnchor="middle" fontSize="6" fontWeight="800" fill="rgba(255,255,255,0.85)">صافي</text>
    </svg>
  );
}

/* ── Owner Statement Equation ──────────────────────────────────────────── */
export function OwnerEquationFlow() {
  return (
    <svg viewBox="0 0 340 70" fill="none" className="w-full max-w-xs mx-auto">
      <rect x="5" y="5" width="70" height="60" rx="10" fill={ACCENT_LIGHT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="40" y="28" textAnchor="middle" fontSize="18">🏦</text>
      <text x="40" y="48" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">رأس المال</text>
      <text x="40" y="58" textAnchor="middle" fontSize="6.5" fill="#64748b">١٠٠٬٠٠٠</text>
      <text x="82" y="38" textAnchor="middle" fontSize="16" fontWeight="900" fill={ACCENT}>+</text>
      <rect x="92" y="5" width="65" height="60" rx="10" fill="#ecfdf5" stroke={GREEN} strokeWidth="1.5"/>
      <text x="124" y="28" textAnchor="middle" fontSize="18">📈</text>
      <text x="124" y="48" textAnchor="middle" fontSize="7" fontWeight="800" fill="#334155">الأرباح</text>
      <text x="124" y="58" textAnchor="middle" fontSize="6.5" fill={GREEN}>+٢٥٬٠٠٠</text>
      <text x="164" y="38" textAnchor="middle" fontSize="16" fontWeight="900" fill={ACCENT}>−</text>
      <rect x="174" y="5" width="65" height="60" rx="10" fill="#fef2f2" stroke={RED} strokeWidth="1.5"/>
      <text x="206" y="28" textAnchor="middle" fontSize="18">💸</text>
      <text x="206" y="48" textAnchor="middle" fontSize="7" fontWeight="800" fill="#334155">المسحوبات</text>
      <text x="206" y="58" textAnchor="middle" fontSize="6.5" fill={RED}>−١٠٬٠٠٠</text>
      <text x="246" y="38" textAnchor="middle" fontSize="16" fontWeight="900" fill={ACCENT}>=</text>
      <rect x="256" y="5" width="78" height="60" rx="10" fill={GREEN} stroke={GREEN} strokeWidth="1.5"/>
      <text x="295" y="28" textAnchor="middle" fontSize="18">✅</text>
      <text x="295" y="48" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#fff">صافي حقك</text>
      <text x="295" y="58" textAnchor="middle" fontSize="6.5" fill="rgba(255,255,255,0.8)">١١٥٬٠٠٠</text>
    </svg>
  );
}

/* ── Cashflow Ledger Equation ──────────────────────────────────────────── */
export function CashflowEquationFlow() {
  return (
    <svg viewBox="0 0 340 70" fill="none" className="w-full max-w-xs mx-auto">
      <rect x="5" y="5" width="70" height="60" rx="10" fill={ACCENT_LIGHT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="40" y="28" textAnchor="middle" fontSize="18">🏦</text>
      <text x="40" y="48" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">رصيد الصبح</text>
      <text x="40" y="58" textAnchor="middle" fontSize="6.5" fill="#64748b">٣٠٠٠ ج</text>
      <text x="82" y="38" textAnchor="middle" fontSize="16" fontWeight="900" fill={ACCENT}>+</text>
      <rect x="92" y="5" width="65" height="60" rx="10" fill="#ecfdf5" stroke={GREEN} strokeWidth="1.5"/>
      <text x="124" y="28" textAnchor="middle" fontSize="18">📈</text>
      <text x="124" y="48" textAnchor="middle" fontSize="7" fontWeight="800" fill="#334155">الدخل</text>
      <text x="124" y="58" textAnchor="middle" fontSize="6.5" fill={GREEN}>+٨٠٠٠</text>
      <text x="164" y="38" textAnchor="middle" fontSize="16" fontWeight="900" fill={ACCENT}>−</text>
      <rect x="174" y="5" width="65" height="60" rx="10" fill="#fef2f2" stroke={RED} strokeWidth="1.5"/>
      <text x="206" y="28" textAnchor="middle" fontSize="18">💸</text>
      <text x="206" y="48" textAnchor="middle" fontSize="7" fontWeight="800" fill="#334155">الخروج</text>
      <text x="206" y="58" textAnchor="middle" fontSize="6.5" fill={RED}>−٤٠٠٠</text>
      <text x="246" y="38" textAnchor="middle" fontSize="16" fontWeight="900" fill={ACCENT}>=</text>
      <rect x="256" y="5" width="78" height="60" rx="10" fill={ACCENT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="295" y="28" textAnchor="middle" fontSize="18">✅</text>
      <text x="295" y="48" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#fff">الرصيد بالليل</text>
      <text x="295" y="58" textAnchor="middle" fontSize="6.5" fill="rgba(255,255,255,0.8)">٧٠٠٠ ج</text>
    </svg>
  );
}

/* ── Stock Levels Color Map ────────────────────────────────────────────── */
export function StockLevelsColorMap() {
  return (
    <svg viewBox="0 0 300 90" fill="none" className="w-full max-w-xs mx-auto">
      <rect x="10" y="10" width="80" height="70" rx="10" fill="#ecfdf5" stroke={GREEN} strokeWidth="1.5"/>
      <text x="50" y="30" textAnchor="middle" fontSize="16">📦</text>
      <text x="50" y="48" textAnchor="middle" fontSize="8" fontWeight="800" fill={GREEN}>فوق الحد</text>
      <text x="50" y="60" textAnchor="middle" fontSize="6.5" fill="#64748b">٥٠ قطعة</text>
      <text x="50" y="72" textAnchor="middle" fontSize="6" fontWeight="600" fill={GREEN}>✅ تمام</text>
      <rect x="110" y="10" width="80" height="70" rx="10" fill="#fffbeb" stroke={AMBER} strokeWidth="1.5"/>
      <text x="150" y="30" textAnchor="middle" fontSize="16">📦</text>
      <text x="150" y="48" textAnchor="middle" fontSize="8" fontWeight="800" fill={AMBER}>قرّب من الحد</text>
      <text x="150" y="60" textAnchor="middle" fontSize="6.5" fill="#64748b">٥ قطع</text>
      <text x="150" y="72" textAnchor="middle" fontSize="6" fontWeight="600" fill={AMBER}>⚠️ طلبية الجاية</text>
      <rect x="210" y="10" width="80" height="70" rx="10" fill="#fef2f2" stroke={RED} strokeWidth="1.5"/>
      <text x="250" y="30" textAnchor="middle" fontSize="16">📦</text>
      <text x="250" y="48" textAnchor="middle" fontSize="8" fontWeight="800" fill={RED}>تحت الحد</text>
      <text x="250" y="60" textAnchor="middle" fontSize="6.5" fill="#64748b">٠ قطعة</text>
      <text x="250" y="72" textAnchor="middle" fontSize="6" fontWeight="600" fill={RED}>🚨 بتخسر مبيعات</text>
    </svg>
  );
}

/* ── Gold Pricing Formula ──────────────────────────────────────────────── */
export function GoldPricingFormula() {
  return (
    <svg viewBox="0 0 320 70" fill="none" className="w-full max-w-xs mx-auto">
      <rect x="10" y="10" width="55" height="50" rx="10" fill="#fffbeb" stroke={AMBER} strokeWidth="1.5"/>
      <text x="37" y="30" textAnchor="middle" fontSize="18">⚖️</text>
      <text x="37" y="48" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">الوزن</text>
      <text x="37" y="56" textAnchor="middle" fontSize="6.5" fill="#64748b">١٠ جرام</text>
      <text x="72" y="36" textAnchor="middle" fontSize="14" fontWeight="900" fill={ACCENT}>×</text>
      <rect x="82" y="10" width="55" height="50" rx="10" fill="#fffbeb" stroke={AMBER} strokeWidth="1.5"/>
      <text x="109" y="30" textAnchor="middle" fontSize="18">💎</text>
      <text x="109" y="48" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">سعر الجرام</text>
      <text x="109" y="56" textAnchor="middle" fontSize="6.5" fill="#64748b">١٢٠٠ ج</text>
      <text x="144" y="36" textAnchor="middle" fontSize="14" fontWeight="900" fill={ACCENT}>+</text>
      <rect x="154" y="10" width="65" height="50" rx="10" fill={ACCENT_LIGHT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="186" y="30" textAnchor="middle" fontSize="18">🔨</text>
      <text x="186" y="48" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">المصنعية</text>
      <text x="186" y="56" textAnchor="middle" fontSize="6.5" fill="#64748b">٢٠٠٠ ج</text>
      <text x="226" y="36" textAnchor="middle" fontSize="14" fontWeight="900" fill={ACCENT}>=</text>
      <rect x="240" y="10" width="70" height="50" rx="10" fill={ACCENT} stroke={ACCENT} strokeWidth="1.5"/>
      <text x="275" y="30" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff">١٤٬٠٠٠ ج</text>
      <text x="275" y="48" textAnchor="middle" fontSize="7" fontWeight="800" fill="rgba(255,255,255,0.85)">السعر النهائي</text>
    </svg>
  );
}
