import {
  LayoutDashboard, Store, Wallet, Activity,
  ShoppingCart, PackageSearch, ClipboardList, ArrowRightLeft, ReceiptText, Truck, Receipt,
  CircleDollarSign, HeartHandshake, Building, Coins, TrendingUp, TrendingDown, Banknote,
  CreditCard, Landmark,
  Boxes, Box, Tags, FileSpreadsheet, BadgePercent,
  Database, Warehouse, Scale, Briefcase,
  ShieldCheck, PieChart, Fingerprint, UsersRound, Settings, ArrowUpCircle, ClipboardCheck,
  ShoppingBag, Smartphone, Wrench, UtensilsCrossed, Gem,
} from "lucide-react";

export const PRIMARY_MENU = [
  { path: "/dashboard", label: "مساحة العمل", icon: LayoutDashboard, pageKey: "dashboard" },
  { path: "/pos", label: "نقطة البيع (POS)", icon: Store, highlight: true, pageKey: "pos" },
  { path: "/daily-treasury", label: "الخزينة اليومية", icon: Wallet, pageKey: "daily_treasury" },
  { path: "/analytics", label: "التحليلات والمبيعات", icon: Activity, pageKey: "analytics" },
];

export const NAV_MODULES = [
  {
    title: "المبيعات والمشتريات", id: "trade", icon: ShoppingCart,
    items: [
      { path: "/sales", label: "فواتير المبيعات", icon: ShoppingBag, pageKey: "sales", family: "sales" },
      { path: "/sales/returns", label: "مرتجع المبيعات", icon: ReceiptText, pageKey: "sales_returns", family: "sales" },
      { path: "/operations/quotations", label: "عرض سعر", icon: Receipt, pageKey: "quotations", family: "sales" },
      { path: "/purchases", label: "فواتير المشتريات", icon: PackageSearch, pageKey: "purchases", family: "purchases" },
      { path: "/purchases/returns", label: "مرتجع المشتريات", icon: ArrowRightLeft, pageKey: "purchase_returns", family: "purchases" },
      { path: "/purchases/orders", label: "طلبات التوريد", icon: ClipboardList, pageKey: "purchase_orders", family: "purchases" },
      { path: "/operations/branch-transfer", label: "نقل المخزون بين الفروع", icon: Truck, pageKey: "branch_transfer", family: "other" },
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
      { path: "/operations/items", label: "سجل حركة الأصناف", icon: PackageSearch, pageKey: "item_operations" },
      { path: "/definitions/categories", label: "أقسام الأصناف", icon: Tags, pageKey: "categories" },
      { path: "/operations/bulk-price-update", label: "تحديث الأسعار", icon: TrendingUp, pageKey: "bulk_price_update" },
      { path: "/stock/transfer", label: "تحويل مخزني", icon: ArrowRightLeft, pageKey: "stock_transfer" },
      { path: "/stock/physical-count", label: "الجرد الفعلي", icon: FileSpreadsheet, pageKey: "physical_count" },
      { path: "/stock/serials", label: "بحث السيريال / IMEI", icon: Smartphone, pageKey: "items", featureKey: "feature_serials" },
      { path: "/repairs", label: "أوامر الصيانة", icon: Wrench, pageKey: "repair_orders", featureKey: "feature_repair_orders" },
      { path: "/restaurant/tables", label: "طاولات المطعم", icon: UtensilsCrossed, pageKey: "pos", featureKey: "feature_restaurant" },
      { path: "/gold/rates", label: "أسعار الذهب", icon: Gem, pageKey: "settings", featureKey: "feature_gold" },
      { path: "/definitions/promotions", label: "العروض والتخفيضات", icon: BadgePercent, pageKey: "promotions", featureKey: "feature_promotions" },
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
