export const ACTION_LABELS = {
  save: "حفظ",
  lock: "إقفال",
  view: "رؤية",
  add: "إضافة",
  edit: "تعديل",
  delete: "حذف",
  print: "طباعة",
  void: "إلغاء",
  hold: "تعليق",
  discount: "خصم",
  profit: "ربح",
  manage_permissions: "إدارة الصلاحيات",
  edit_general: "تعديل الإعدادات العامة",
  edit_security: "تعديل إعدادات الأمان",
  adjust: "تسوية",
  transfer: "تحويل",
  export: "تصدير",
  create: "إنشاء",
  restore: "استعادة",
};

export const ACTION_DESCRIPTIONS = {
  save: "حفظ نسخة من بيانات الفترة الحالية",
  lock: "إقفال النسخة ومنع تعديلها لاحقا",
  view: "مشاهدة وعرض محتوى الصفحة والبيانات",
  add: "إضافة سجلات وبيانات جديدة",
  edit: "تعديل وتحديث السجلات والبيانات الموجودة",
  delete: "حذف السجلات والبيانات نهائياً",
  print: "طباعة التقارير والفواتير والمستندات",
  void: "إلغاء الفواتير والمعاملات المالية",
  hold: "تعليق الفاتورة مؤقتاً لاستكمالها لاحقاً",
  discount: "منح خصومات على فواتير البيع",
  profit: "عرض تحليل ربح الفاتورة الحالية",
  manage_permissions: "تعديل صلاحيات المستخدمين الآخرين",
  edit_general: "تعديل الإعدادات العامة للنظام",
  edit_security: "تعديل إعدادات الأمان والحماية",
  adjust: "إجراء تسويات يدوية على المخزون",
  transfer: "تحويل الأصناف بين المخازن والفروع",
  export: "تصدير البيانات والتقارير إلى ملفات خارجية",
  create: "إنشاء نسخ احتياطية جديدة",
  restore: "استعادة النظام من نسخة احتياطية",
};

export const PAGE_PERMISSIONS = {
  owner_statement: { label: 'لوحة صاحب المحل', actions: ['view', 'save', 'lock', 'print'] },
  pos: { label: 'نقطة البيع', actions: ['view', 'add', 'edit', 'delete', 'void', 'hold', 'discount', 'print', 'profit'] },
  daily_treasury: { label: 'الخزينة اليومية', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  analytics: { label: 'التحليلات والمبيعات', actions: ['view', 'export'] },
  purchases: { label: 'فواتير المشتريات', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  purchase_orders: { label: 'أوامر الشراء', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  purchase_returns: { label: 'مرتجع المشتريات', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  sales_returns: { label: 'مرتجع المبيعات', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  branch_transfer: { label: 'نقل المخزون', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  quotations: { label: 'عروض الأسعار', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  customer_accounts: { label: 'حسابات العملاء', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  supplier_accounts: { label: 'حسابات الموردين', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  revenues: { label: 'تسجيل الإيرادات', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  expenses: { label: 'تسجيل المصروفات', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  withdrawals: { label: 'تسجيل المسحوبات', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  payment_methods: { label: 'وسائل الدفع', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  bank_operations: { label: 'البنوك والفيزا', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  cheques: { label: 'إدارة الشيكات', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  items: { label: 'قاعدة الأصناف', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  categories: { label: 'أقسام الأصناف', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  bulk_price_update: { label: 'تحديث الأسعار', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  stock_transfer: { label: 'تحويل مخزني', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  physical_count: { label: 'الجرد الفعلي', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  promotions: { label: 'العروض والتخفيضات', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  branches: { label: 'الفروع', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  customers: { label: 'العملاء', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  suppliers: { label: 'الموردين', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  warehouses: { label: 'المخازن', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  banks: { label: 'البنوك', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  units: { label: 'وحدات القياس', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  financial_categories: { label: 'أقسام الحركات المالية', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  reports: { label: 'مركز التقارير', actions: ['view', 'export'] },
  users: { label: 'المستخدمين', actions: ['view', 'add', 'edit', 'delete', 'manage_permissions', 'print'] },
  employees: { label: 'الموظفين', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  settings: { label: 'الإعدادات العامة', actions: ['view', 'edit_general', 'edit_security'] },
  dashboard: { label: 'لوحة التحكم', actions: ['view'] },
  stock: { label: 'المخزون', actions: ['view', 'add', 'edit', 'delete', 'adjust', 'transfer', 'print'] },
  payments: { label: 'المدفوعات', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  notifications: { label: 'الإشعارات', actions: ['view', 'edit'] },
  employee_adjustments: { label: 'مكافآت وخصومات', actions: ['view', 'add'] },
  backup: { label: 'النسخ الاحتياطي', actions: ['view', 'create', 'restore'] },
  updates: { label: 'التحديثات', actions: ['view'] },
  history: { label: 'سجل النشاط', actions: ['view'] },
};

// Default permissions for new user role (POS only)
export const DEFAULT_USER_PERMISSIONS = {
  pos: ['view', 'add'],
};

// Role permission presets
export const ROLE_PRESETS = {
  admin: null, // null means full access (handled by role check)
  user: DEFAULT_USER_PERMISSIONS,
};

// Ordered list of all unique actions across all pages (for matrix column headers)
const ALL_UNIQUE_ACTIONS = [...new Set(Object.values(PAGE_PERMISSIONS).flatMap(p => p.actions))];
const ACTION_ORDER = ['view', 'add', 'edit', 'delete', 'print', 'void', 'hold', 'discount', 'export', 'adjust', 'transfer', 'manage_permissions', 'edit_general', 'edit_security', 'create', 'restore'];
export const ALL_ACTIONS = ACTION_ORDER.filter(a => ALL_UNIQUE_ACTIONS.includes(a));
