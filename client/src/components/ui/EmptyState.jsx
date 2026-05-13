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
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;