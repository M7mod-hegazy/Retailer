// Arabic labels for page permissions, used to make privilege-change owner
// alerts readable. Without these the Telegram message said only "3 صفحة
// متأثرة" with raw English slugs — the owner could not tell whether someone
// was granted "view reports" or "delete invoices".
// Mirrored from client/src/constants/pagePermissions.js — the single source of
// truth behind the permissions UI. Keep the two in sync when pages/actions are
// added there; a missing key degrades gracefully to the raw slug.
const PAGE_LABELS = {
  owner_statement: "تقرير صاحب المحل",
  pos: "نقطة البيع",
  daily_treasury: "الخزينة اليومية",
  analytics: "التحليلات والمبيعات",
  purchases: "فواتير المشتريات",
  purchase_orders: "طلبات التوريد",
  purchase_returns: "مرتجع المشتريات",
  sales_returns: "مرتجع المبيعات",
  branch_transfer: "نقل المخزون",
  quotations: "عرض سعر",
  customer_accounts: "حسابات العملاء",
  supplier_accounts: "حسابات الموردين",
  revenues: "تسجيل الإيرادات",
  expenses: "تسجيل المصروفات",
  withdrawals: "تسجيل المسحوبات",
  payment_methods: "وسائل الدفع",
  cheques: "إدارة الشيكات",
  items: "قاعدة الأصناف",
  categories: "أقسام الأصناف",
  bulk_price_update: "تحديث الأسعار",
  stock_transfer: "تحويل مخزني",
  physical_count: "الجرد الفعلي",
  promotions: "العروض والتخفيضات",
  branches: "الفروع",
  customers: "العملاء",
  suppliers: "الموردين",
  warehouses: "المخازن",
  units: "وحدات القياس",
  financial_categories: "أقسام الحركات المالية",
  reports: "مركز التقارير",
  users: "المستخدمين",
  employees: "الموظفين",
  settings: "الإعدادات العامة",
  print_settings: "إعدادات الطباعة",
  dashboard: "لوحة التحكم",
  stock: "المخزون",
  payments: "المدفوعات",
  notifications: "الإشعارات",
  employee_adjustments: "مكافآت وخصومات",
  backup: "النسخ الاحتياطي",
  updates: "التحديثات",
  history: "سجل النشاط",
  whatsapp_crm: "مركز الرسائل والحملات",
  whatsapp_receipt: "إرسال إيصال واتساب",
  sync: "المزامنة (E-Commerce)",
  restaurant_tables: "طاولات المطعم",
  restaurant_modifiers: "إضافات المطعم (موديفير)",
  gold_pricing: "تسعير الذهب",
  repair_orders: "أوامر الصيانة",
  serial_search: "بحث سيريال / IMEI",
};

const ACTION_LABELS = {
  save: "حفظ",
  lock: "إقفال",
  view: "رؤية",
  add: "إضافة",
  edit: "تعديل",
  delete: "حذف",
  print: "طباعة",
  send: "إرسال",
  void: "إلغاء",
  hold: "تعليق",
  discount: "خصم",
  profit: "ربح",
  manage_permissions: "إدارة الصلاحيات",
  edit_general: "تعديل الإعدادات العامة",
  edit_security: "تعديل إعدادات الأمان",
  studio: "استوديو الطباعة",
  calibrate: "معايرة الطابعة",
  device_profile: "ملف جهاز الطابعة",
  adjust: "تسوية",
  transfer: "تحويل",
  export: "تصدير",
  create: "إنشاء",
  restore: "استعادة",
  import_undo: "التراجع عن الاستيراد",
  edit_tax_rate: "تعديل نسبة الضريبة",
  view_sensitive: "رؤية البيانات المالية الحساسة",
  backdate_records: "تعديل التواريخ السابقة",
  salary_view: "عرض الراتب",
  salary_edit: "تعديل الراتب",
  manage_advances: "إدارة السلف",
  manage_deductions: "إدارة الخصومات",
  manage_bonuses: "إدارة المكافئات",
  settle_payroll: "صرف الرواتب",
  manage_templates: "إدارة القوالب",
  connect: "ربط/فصل القنوات",
  manage_events: "إدارة أحداث التتبع",
  pull: "سحب بيانات من المتجر",
  push: "دفع البيانات إلى المتجر",
  configure: "إعداد المزامنة",
};

// Privileges that let someone move money, erase evidence, or unlock other
// privileges. Granting one of these is called out explicitly in the alert.
const SENSITIVE_ACTIONS = new Set([
  "delete", "void", "restore", "backdate_records", "discount", "profit",
  "view_sensitive", "edit_tax_rate", "manage_permissions", "edit_security",
  "settle_payroll", "manage_advances", "manage_deductions", "manage_bonuses",
  "salary_edit", "import_undo", "adjust", "transfer", "lock",
]);

function pageLabel(key) {
  return PAGE_LABELS[key] || key;
}

function actionLabel(key) {
  return ACTION_LABELS[key] || key;
}

// Renders a permission diff as simple Arabic text: one line per changed
// action, showing exactly what changed from what to what.
// Example output:
//   • نقطة البيع: ✅ حذف (تم التفعيل)
//   • التقارير: ❌ رؤية (تم التعطيل)
// `diff` is { pageKey: { before: [...], after: [...] } }.
function describePermissionDiff(diff, maxPages = 10) {
  const entries = Object.entries(diff || {});
  if (!entries.length) return { text: "—", sensitive: [] };

  const sensitive = [];
  const lines = [];
  for (const [page, change] of entries.slice(0, maxPages)) {
    const before = new Set(change?.before || []);
    const after = new Set(change?.after || []);

    // Actions that were granted (off → on)
    for (const a of [...after].filter((a) => !before.has(a))) {
      const label = `${pageLabel(page)}: ${actionLabel(a)}`;
      if (SENSITIVE_ACTIONS.has(a)) sensitive.push(label);
      lines.push(`• ${label} — ✅ تم التفعيل`);
    }

    // Actions that were revoked (on → off)
    for (const a of [...before].filter((b) => !after.has(b))) {
      const label = `${pageLabel(page)}: ${actionLabel(a)}`;
      if (SENSITIVE_ACTIONS.has(a)) sensitive.push(label);
      lines.push(`• ${label} — ❌ تم التعطيل`);
    }
  }

  const extra = entries.length - maxPages;
  if (extra > 0) lines.push(`• وغيرها (${extra} صفحة)`);

  return { text: lines.join("\n") || "—", sensitive };
}

// Renders a full permission set (not a diff) as an Arabic list, for the
// "user created" alert — the owner needs to see exactly what the new account
// can do, not just that it exists.
function describePermissionSet(permissions, maxPages = 12) {
  const entries = Object.entries(permissions || {}).filter(
    ([, actions]) => Array.isArray(actions) && actions.length
  );
  if (!entries.length) return { text: "بدون أي صلاحيات", sensitive: [] };

  const sensitive = [];
  const lines = [];
  for (const [page, actions] of entries.slice(0, maxPages)) {
    for (const a of actions) {
      if (SENSITIVE_ACTIONS.has(a)) sensitive.push(`${pageLabel(page)}: ${actionLabel(a)}`);
    }
    lines.push(`• ${pageLabel(page)}: ${actions.map(actionLabel).join("، ")}`);
  }
  const extra = entries.length - maxPages;
  if (extra > 0) lines.push(`• وغيرها (${extra} صفحة)`);

  return { text: lines.join("\n"), sensitive };
}

module.exports = {
  PAGE_LABELS, ACTION_LABELS, SENSITIVE_ACTIONS,
  pageLabel, actionLabel, describePermissionDiff, describePermissionSet,
};
