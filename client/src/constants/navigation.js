import {
  LayoutDashboard, Store, Wallet, Activity,
  ShoppingCart, PackageSearch, ClipboardList, ArrowRightLeft, ReceiptText, Truck, Receipt,
  CircleDollarSign, HeartHandshake, Building, Coins, TrendingUp, TrendingDown, Banknote,
  CreditCard, Landmark,
  Boxes, Box, Tags, FileSpreadsheet, BadgePercent,
  Database, Warehouse, Scale, Briefcase,
  ShieldCheck, PieChart, Fingerprint, UsersRound, Settings, ArrowUpCircle, ClipboardCheck,
  ShoppingBag,
} from "lucide-react";

export const PRIMARY_MENU = [
  { path: "/owner-statement", label: "لوحة صاحب المحل", icon: ClipboardCheck, pageKey: "owner_statement" },
  { path: "/dashboard", label: "مساحة العمل", icon: LayoutDashboard, pageKey: "dashboard" },
  { path: "/pos", label: "نقطة البيع (POS)", icon: Store, highlight: true, pageKey: "pos" },
  { path: "/daily-treasury", label: "الخزينة اليومية", icon: Wallet, pageKey: "daily_treasury" },
  { path: "/analytics", label: "التحليلات والمبيعات", icon: Activity, pageKey: "analytics" },
];

export const NAV_MODULES = [
  {
    title: "المبيعات والمشتريات", id: "trade", icon: ShoppingCart,
    items: [
      { path: "/sales", label: "سجل المبيعات", icon: ShoppingBag, pageKey: "pos" },
      { path: "/purchases", label: "فواتير المشتريات", icon: PackageSearch, pageKey: "purchases" },
      { path: "/purchases/orders", label: "أوامر الشراء", icon: ClipboardList, pageKey: "purchase_orders" },
      { path: "/purchases/returns", label: "مرتجع المشتريات", icon: ArrowRightLeft, pageKey: "purchase_returns" },
      { path: "/sales/returns", label: "مرتجع المبيعات", icon: ReceiptText, pageKey: "sales_returns" },
      { path: "/operations/branch-transfer", label: "نقل بين الفروع", icon: Truck, pageKey: "branch_transfer" },
      { path: "/operations/quotations", label: "عروض الأسعار", icon: Receipt, pageKey: "quotations" },
    ],
  },
  {
    title: "الخزينة والمالية", id: "finance", icon: CircleDollarSign,
    items: [
      { path: "/accounts/customers", label: "حسابات العملاء", icon: HeartHandshake, pageKey: "customer_accounts" },
      { path: "/accounts/suppliers", label: "حسابات الموردين", icon: Building, pageKey: "supplier_accounts" },
      { path: "/revenues", label: "تسجيل الإيرادات", icon: TrendingUp, pageKey: "revenues" },
      { path: "/expenses", label: "تسجيل المصروفات", icon: TrendingDown, pageKey: "expenses" },
      { path: "/withdrawals", label: "تسجيل المسحوبات", icon: Banknote, pageKey: "withdrawals" },
      { path: "/operations/payment-methods", label: "وسائل الدفع", icon: CreditCard, pageKey: "payment_methods" },
      { path: "/operations/bank-operations", label: "البنوك والفيزا", icon: Landmark, pageKey: "bank_operations" },
      { path: "/operations/cheques", label: "إدارة الشيكات", icon: Banknote, pageKey: "cheques" },
    ],
  },
  {
    title: "المخازن والأصناف", id: "inventory", icon: Boxes,
    items: [
      { path: "/definitions/items", label: "قاعدة الأصناف", icon: Box, pageKey: "items" },
      { path: "/definitions/categories", label: "أقسام الأصناف", icon: Tags, pageKey: "categories" },
      { path: "/operations/bulk-price-update", label: "تحديث الأسعار", icon: TrendingUp, pageKey: "bulk_price_update" },
      { path: "/stock/transfer", label: "تحويل مخزني", icon: ArrowRightLeft, pageKey: "stock_transfer" },
      { path: "/stock/physical-count", label: "الجرد الفعلي", icon: FileSpreadsheet, pageKey: "physical_count" },
      { path: "/definitions/promotions", label: "العروض والتخفيضات", icon: BadgePercent, pageKey: "promotions" },
    ],
  },
  {
    title: "تعريفات أساسية", id: "definitions", icon: Database,
    items: [
      { path: "/definitions/branches", label: "الفروع", icon: Store, pageKey: "branches" },
      { path: "/definitions/customers", label: "العملاء", icon: UsersRound, pageKey: "customers" },
      { path: "/definitions/suppliers", label: "الموردين", icon: Briefcase, pageKey: "suppliers" },
      { path: "/definitions/warehouses", label: "المخازن", icon: Warehouse, pageKey: "warehouses" },
      { path: "/definitions/banks", label: "البنوك", icon: Landmark, pageKey: "banks" },
      { path: "/definitions/units", label: "وحدات القياس", icon: Scale, pageKey: "units" },
      { path: "/definitions/financial-categories", label: "أقسام الحركات المالية", icon: Banknote, pageKey: "financial_categories" },
    ],
  },
  {
    title: "إدارة النظام", id: "system", icon: ShieldCheck,
    items: [
      { path: "/reports/center", label: "مركز التقارير", icon: PieChart, pageKey: "reports" },
      { path: "/definitions/users", label: "المستخدمين", icon: Fingerprint, pageKey: "users" },
      { path: "/definitions/employees", label: "الموظفين", icon: UsersRound, pageKey: "employees" },
      { path: "/settings", label: "الإعدادات العامة", icon: Settings, pageKey: "settings" },
      { path: "/updates", label: "التحديثات", icon: ArrowUpCircle, pageKey: "updates" },
      { path: "/history", label: "سجل النشاط", icon: ClipboardCheck, pageKey: "history" },
    ],
  },
];
