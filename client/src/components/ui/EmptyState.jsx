import React from 'react';

const PRESETS = {
  invoices:      { icon: '🧾', title_ar: 'لا توجد فواتير',        desc_ar: 'ابدأ بإنشاء أول فاتورة بيع' },
  customers:     { icon: '👥', title_ar: 'لا يوجد عملاء',         desc_ar: 'أضف عميلك الأول للبدء' },
  items:         { icon: '📦', title_ar: 'لا توجد أصناف',         desc_ar: 'أضف أصنافك أو استوردها من Excel' },
  stock_ok:      { icon: '✅', title_ar: 'المخزون بخير!',         desc_ar: 'جميع الأصناف فوق الحد الأدنى' },
  stock_low:     { icon: '⚠️', title_ar: 'لا تنبيهات مخزون',     desc_ar: 'جميع الأصناف في مستوى جيد' },
  payments:      { icon: '💰', title_ar: 'لا توجد مدفوعات',       desc_ar: 'سجل أول دفعة من عميل' },
  reports:       { icon: '📊', title_ar: 'لا توجد بيانات',        desc_ar: 'غيّر الفترة الزمنية أو الفلاتر' },
  notifications: { icon: '🔔', title_ar: 'لا إشعارات جديدة',      desc_ar: 'ستظهر هنا تنبيهات المخزون والمواعيد' },
  search:        { icon: '🔍', title_ar: 'لا نتائج للبحث',        desc_ar: 'جرّب كلمة بحث مختلفة أو قلّل الفلاتر' },
  purchases:     { icon: '🛒', title_ar: 'لا توجد مشتريات',       desc_ar: 'أضف أول فاتورة شراء من الموردين' },
  shifts:        { icon: '🕐', title_ar: 'لا توجد ورديات',        desc_ar: 'افتح أول وردية لبدء العمل' },
  expenses:      { icon: '📋', title_ar: 'لا توجد مصروفات',       desc_ar: 'سجّل المصروفات لتتبع التدفق النقدي' },
};

export function EmptyState({
  type,
  icon,
  title,
  description,
  message,
  lang = 'ar',
  action,
  steps, // optional teaching steps: ["أضف مخزن", "أضف صنف", ...] — turns the empty page into a mini-guide
}) {
  const preset = type ? PRESETS[type] : null;

  const displayIcon  = icon  || preset?.icon        || '📭';
  const displayTitle = title || preset?.[`title_${lang}`] || preset?.title_ar || message || 'لا توجد بيانات';
  const displayDesc  = description || preset?.[`desc_${lang}`] || preset?.desc_ar || '';

  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <span style={{ fontSize: '1.75rem' }}>{displayIcon}</span>
      </div>
      <h3 className="empty-state__title">{displayTitle}</h3>
      {displayDesc && (
        <p className="empty-state__desc">{displayDesc}</p>
      )}
      {Array.isArray(steps) && steps.length > 0 && (
        <ol dir="rtl" className="mt-4 mx-auto max-w-xs space-y-2 text-start">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-xl border border-border bg-bg-surface p-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-black text-white">
                {i + 1}
              </span>
              <span className="text-[11px] font-bold text-text-secondary leading-relaxed pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;