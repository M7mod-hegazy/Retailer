const PAGE_PERMISSIONS = {
  pos: { label: 'نقطة البيع', actions: ['view','add','edit','delete','void','hold','discount','print','override_price'] },
  daily_treasury: { label: 'الخزينة اليومية', actions: ['view','add','edit','delete','print'] },
  analytics: { label: 'التحليلات والمبيعات', actions: ['view','export','view_sensitive'] },
  purchases: { label: 'فواتير المشتريات', actions: ['view','add','edit','delete','print'] },
  purchase_orders: { label: 'طلبات التوريد', actions: ['view','add','edit','delete','print'] },
  purchase_returns: { label: 'مرتجع المشتريات', actions: ['view','add','edit','delete','print'] },
  sales_returns: { label: 'مرتجع المبيعات', actions: ['view','add','edit','delete','print'] },
  branch_transfer: { label: 'نقل المخزون', actions: ['view','add','edit','delete','print'] },
  quotations: { label: 'عرض سعر', actions: ['view','add','edit','delete','print'] },
  customer_accounts: { label: 'حسابات العملاء', actions: ['view','add','edit','delete','print'] },
  supplier_accounts: { label: 'حسابات الموردين', actions: ['view','add','edit','delete','print'] },
  revenues: { label: 'تسجيل الإيرادات', actions: ['view','add','edit','delete','print'] },
  expenses: { label: 'تسجيل المصروفات', actions: ['view','add','edit','delete','print'] },
  withdrawals: { label: 'تسجيل المسحوبات', actions: ['view','add','edit','delete','print'] },
  payment_methods: { label: 'وسائل الدفع', actions: ['view','add','edit','delete','print'] },
  bank_operations: { label: 'البنوك والفيزا', actions: ['view','add','edit','delete','print'] },
  cheques: { label: 'إدارة الشيكات', actions: ['view','add','edit','delete','print'] },
  items: { label: 'قاعدة الأصناف', actions: ['view','add','edit','delete','print'] },
  categories: { label: 'أقسام الأصناف', actions: ['view','add','edit','delete','print'] },
  bulk_price_update: { label: 'تحديث الأسعار', actions: ['view','add','edit','delete','print'] },
  stock_transfer: { label: 'تحويل مخزني', actions: ['view','add','edit','delete','print'] },
  physical_count: { label: 'الجرد الفعلي', actions: ['view','add','edit','delete','print'] },
  promotions: { label: 'العروض والتخفيضات', actions: ['view','add','edit','delete','print'] },
  branches: { label: 'الفروع', actions: ['view','add','edit','delete','print'] },
  customers: { label: 'العملاء', actions: ['view','add','edit','delete','print'] },
  suppliers: { label: 'الموردين', actions: ['view','add','edit','delete','print'] },
  warehouses: { label: 'المخازن', actions: ['view','add','edit','delete','print'] },
  banks: { label: 'البنوك', actions: ['view','add','edit','delete','print'] },
  units: { label: 'وحدات القياس', actions: ['view','add','edit','delete','print'] },
  financial_categories: { label: 'أقسام الحركات المالية', actions: ['view','add','edit','delete','print'] },
  reports: { label: 'مركز التقارير', actions: ['view','export'] },
  users: { label: 'المستخدمين', actions: ['view','add','edit','delete','print'] },
  employees: { label: 'الموظفين', actions: ['view','add','edit','delete','print','salary_view','salary_edit','manage_advances','manage_deductions','manage_bonuses','settle_payroll'] },
  settings: { label: 'الإعدادات العامة', actions: ['view','edit_general','edit_security'] },
  dashboard: { label: 'لوحة التحكم', actions: ['view'] },
  stock: { label: 'المخزون', actions: ['view','add','edit','delete','adjust','transfer','print'] },
  payments: { label: 'المدفوعات', actions: ['view','add','edit','delete','print'] },
  notifications: { label: 'الإشعارات', actions: ['view','edit'] },
  employee_adjustments: { label: 'مكافآت وخصومات', actions: ['view','add'] },
  backup: { label: 'النسخ الاحتياطي', actions: ['view','create','restore','export','empty'] },
};

// Default permissions for new user role (POS only)
const DEFAULT_USER_PERMISSIONS = {
  pos: ['view', 'add'],
};

// Role permission presets
const ROLE_PRESETS = {
  admin: null,
  user: DEFAULT_USER_PERMISSIONS,
};

module.exports = {
  PAGE_PERMISSIONS,
  DEFAULT_USER_PERMISSIONS,
  ROLE_PRESETS,
};
