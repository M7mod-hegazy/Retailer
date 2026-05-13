import { TrendingUp, Package, Wallet, Receipt, FileText, Shield, ClipboardList, FileImage, FileSpreadsheet, Printer, Layers, RotateCcw, Truck, Users, UserCheck, CalendarCheck, Percent, LineChart, Search } from "lucide-react";

export const CATEGORIES = [
  { id: "sales",     label: "المبيعات",   icon: TrendingUp, color: "var(--success-DEFAULT,#10b981)" },
  { id: "purchases", label: "المشتريات",  icon: Package,    color: "var(--info-DEFAULT,#3b82f6)" },
  { id: "inventory", label: "المخزون",    icon: Layers,     color: "var(--primary-DEFAULT,#8b5cf6)" },
  { id: "accounts",  label: "الحسابات",   icon: Wallet,     color: "var(--warning-DEFAULT,#f59e0b)" },
  { id: "treasury",  label: "الخزينة",    icon: Receipt,    color: "#06b6d4" },
  { id: "tax",       label: "الضرائب",    icon: FileText,   color: "var(--error-DEFAULT,#ef4444)" },
  { id: "audit",     label: "الأفراد",    icon: Shield,     color: "var(--text-secondary,#94a3b8)" },
  { id: "users",     label: "المستخدمين", icon: Users,      color: "#6366f1" },
];

export const SOURCES = [
  { id: "sales",           label: "المبيعات",           icon: TrendingUp,    color: "var(--success-DEFAULT,#10b981)" },
  { id: "purchases",       label: "المشتريات",          icon: Package,       color: "var(--info-DEFAULT,#3b82f6)" },
  { id: "cheques",         label: "شيكات / بنوك",       icon: FileText,      color: "#06b6d4" },
  { id: "purchase-returns",label: "مرتجعات المشتريات",  icon: RotateCcw,     color: "#f97316" },
  { id: "sales-returns",   label: "مرتجعات المبيعات",   icon: RotateCcw,     color: "#ec4899" },
  { id: "suppliers",       label: "الموردين",            icon: Truck,         color: "var(--warning-DEFAULT,#f59e0b)" },
  { id: "customers",       label: "العملاء",             icon: Users,         color: "#8b5cf6" },
  { id: "employees",       label: "الموظفين",            icon: UserCheck,     color: "var(--text-secondary,#94a3b8)" },
  { id: "users",           label: "المستخدمين",          icon: Users,         color: "#6366f1" },
  { id: "installments",    label: "أنظمة التقسيط",       icon: CalendarCheck, color: "#14b8a6" },
  { id: "items",           label: "الأصناف",             icon: Package,       color: "var(--primary-DEFAULT,#8b5cf6)" },
  { id: "warehouses",      label: "المخازن",             icon: Layers,        color: "#0ea5e9" },
  { id: "expenses",        label: "المصروفات",           icon: Receipt,       color: "#ef4444" },
  { id: "revenues",        label: "الإيرادات الأخرى",   icon: TrendingUp,    color: "#10b981" },
  { id: "treasury",        label: "الخزينة",             icon: Wallet,        color: "#06b6d4" },
  { id: "profit-loader",   label: "محمل ربح المبيعات",  icon: Percent,       color: "#d946ef" },
  { id: "net-profit",      label: "صافي الربح",          icon: LineChart,     color: "#1e40af" },
];

export const FORMAT_ICONS = {
  pdf:   { icon: FileImage,       color: "var(--error-DEFAULT,#ef4444)",   label: "PDF" },
  excel: { icon: FileSpreadsheet, color: "var(--success-DEFAULT,#10b981)", label: "Excel" },
  word:  { icon: FileText,        color: "var(--info-DEFAULT,#3b82f6)",    label: "Word" },
  print: { icon: Printer,         color: "var(--text-secondary,#94a3b8)", label: "طباعة" },
};

export const COST_METHODS = [
  { value: "wacc",           label: "متوسط التكلفة (WACC)" },
  { value: "last_purchase",  label: "آخر سعر شراء" },
  { value: "fifo",           label: "الوارد أولاً صادر أولاً (FIFO)" },
  { value: "purchase_price", label: "سعر الشراء" },
];

export const SCOPE_OPTIONS = {
  sales:           [{ type:"all",label:"الكل"},{ type:"category",label:"فئة منتجات"},{ type:"product",label:"منتج واحد"},{ type:"customer",label:"عميل"}],
  purchases:       [{ type:"all",label:"الكل"},{ type:"category",label:"فئة منتجات"},{ type:"product",label:"منتج واحد"},{ type:"supplier",label:"مورد"}],
  items:           [{ type:"all",label:"الكل"},{ type:"category",label:"فئة منتجات"},{ type:"product",label:"منتج واحد"},{ type:"warehouse",label:"مخزن"}],
  warehouses:      [{ type:"all",label:"الكل"},{ type:"warehouse",label:"مخزن"}],
  "profit-loader": [{ type:"all",label:"الكل"},{ type:"category",label:"فئة منتجات"},{ type:"product",label:"منتج واحد"}],
  "net-profit":    [{ type:"all",label:"الكل"},{ type:"category",label:"فئة منتجات"},{ type:"product",label:"منتج واحد"}],
  "purchase-returns": [{ type:"all",label:"الكل"},{ type:"supplier",label:"مورد"}],
  "sales-returns":    [{ type:"all",label:"الكل"},{ type:"customer",label:"عميل"}],
  cheques:         [{ type:"all",label:"الكل"}],
  suppliers:       [{ type:"all",label:"الكل"}],
  customers:       [{ type:"all",label:"الكل"}],
  employees:       [{ type:"all",label:"الكل"}],
  users:           [{ type:"all",label:"الكل"}],
  installments:    [{ type:"all",label:"الكل"}],
  expenses:        [{ type:"all",label:"الكل"}],
  revenues:        [{ type:"all",label:"الكل"}],
  treasury:        [{ type:"all",label:"الكل"}],
};

// Category-level preview columns (used by card previews in ReportsCenter)
export const CAT_PREVIEW_COLUMNS = {
  sales: [
    {k:"date",l:"التاريخ",t:"date"},{k:"invoice_no",l:"رقم الفاتورة",t:"text"},
    {k:"customer_name",l:"العميل",t:"text"},{k:"total",l:"الإجمالي",t:"cur"},
    {k:"discount",l:"الخصم",t:"cur"},{k:"profit_margin",l:"الربح",t:"cur"},
  ],
  purchases: [
    {k:"date",l:"التاريخ",t:"date"},{k:"supplier_name",l:"المورد",t:"text"},
    {k:"item_name",l:"الصنف",t:"text"},{k:"quantity_purchased",l:"الكمية",t:"num"},
    {k:"total_cost",l:"التكلفة",t:"cur"},{k:"purchase_no",l:"رقم المشتريات",t:"text"},
  ],
  inventory: [
    {k:"item_code",l:"كود الصنف",t:"text"},{k:"item_name",l:"الصنف",t:"text"},
    {k:"category_name",l:"الفئة",t:"text"},{k:"quantity",l:"الرصيد",t:"num"},
    {k:"total_value",l:"القيمة",t:"cur"},{k:"stock_status",l:"الحالة",t:"text"},
  ],
  accounts: [
    {k:"customer_name",l:"العميل",t:"text"},{k:"total_due",l:"المستحق",t:"cur"},
    {k:"aging_0_30",l:"0-30 يوم",t:"cur"},{k:"aging_31_60",l:"31-60 يوم",t:"cur"},
    {k:"aging_90_plus",l:"أكثر من 90",t:"cur"},{k:"last_invoice_date",l:"آخر فاتورة",t:"date"},
  ],
  treasury: [
    {k:"date",l:"التاريخ",t:"date"},{k:"type",l:"النوع",t:"text"},
    {k:"total",l:"المبلغ",t:"cur"},{k:"tx_count",l:"الحركات",t:"num"},
    {k:"name",l:"الخزينة",t:"text"},{k:"balance",l:"الرصيد",t:"cur"},
  ],
  tax: [
    {k:"tax_rate",l:"النسبة",t:"num"},{k:"taxable_sales",l:"المبيعات الخاضعة",t:"cur"},
    {k:"vat_amount",l:"قيمة الضريبة",t:"cur"},{k:"invoice_count",l:"عدد الفواتير",t:"num"},
  ],
  audit: [
    {k:"created_at",l:"التاريخ",t:"date"},{k:"full_name",l:"المستخدم",t:"text"},
    {k:"action",l:"العملية",t:"text"},{k:"resource",l:"المورد",t:"text"},
  ],
  users: [
    {k:"full_name",l:"المستخدم",t:"text"},{k:"role",l:"الصلاحية",t:"text"},
    {k:"status",l:"الحالة",t:"text"},{k:"last_login",l:"آخر دخول",t:"date"},
  ],
};

export const CAT_GHOST_ROWS = {
  sales: [
    {date:"٠٤/٠٥",invoice_no:"INV-1024",customer_name:"أحمد البرقوقي",total:"١٢٬٤٥٠",discount:"٤٠٠",profit_margin:"٢٬٣٠٠"},
    {date:"٠٣/٠٥",invoice_no:"INV-1023",customer_name:"شركة النور",total:"٨٬٣٢٠",discount:"١٥٠",profit_margin:"١٬٧٥٠"},
    {date:"٠٣/٠٥",invoice_no:"INV-1022",customer_name:"نقدي",total:"٣٬٥٥٠",discount:"٠",profit_margin:"٨٢٠"},
  ],
  purchases: [
    {date:"٢٨/٠٤",supplier_name:"مورد النور",item_name:"شاشة سامسونج ٥٥ بوصة",quantity_purchased:"١٥",total_cost:"٢٧٬٠٠٠",purchase_no:"PO-231"},
    {date:"٠١/٠٥",supplier_name:"تك سبلاي",item_name:"كابل USB-C",quantity_purchased:"٢٠٠",total_cost:"١٬٩٠٠",purchase_no:"PO-232"},
  ],
  inventory: [
    {item_code:"SKU-001",item_name:"آيفون ١٦ برو",category_name:"موبايلات",quantity:"٤٧",total_value:"٤٤٬٦٥٠",stock_status:"متاح"},
    {item_code:"SKU-042",item_name:"سامسونج A55",category_name:"موبايلات",quantity:"٨٣",total_value:"١٦٬٦٠٠",stock_status:"متاح"},
    {item_code:"SKU-107",item_name:"جراب سيليكون",category_name:"إكسسوارات",quantity:"٥",total_value:"٣٥٠",stock_status:"منخفض"},
  ],
  accounts: [
    {customer_name:"أحمد البرقوقي",total_due:"١٢٬٤٠٠",aging_0_30:"٨٬٥٠٠",aging_31_60:"٣٬٩٠٠",aging_90_plus:"٠",last_invoice_date:"١٠/٠٤"},
    {customer_name:"شركة النور للتجارة",total_due:"٧٬٨٥٠",aging_0_30:"٢٬٠٠٠",aging_31_60:"٥٬٨٥٠",aging_90_plus:"٠",last_invoice_date:"٢٥/٠٣"},
  ],
  treasury: [
    {date:"٠١/٠٥",type:"تحصيل فاتورة",total:"٥٬٢٠٠",tx_count:"١",name:"الخزينة الرئيسية",balance:"٣٧٬٤٠٠"},
    {date:"٠٣/٠٥",type:"دفع مورد",total:"-١٢٬٠٠٠",tx_count:"٣",name:"الخزينة الرئيسية",balance:"٢٥٬٤٠٠"},
  ],
  tax: [
    {tax_rate:"١٤٪",taxable_sales:"٥٬٢٠٠",vat_amount:"٧٢٨",invoice_count:"١٢"},
    {tax_rate:"٠٪",taxable_sales:"٣٬٨٠٠",vat_amount:"٠",invoice_count:"٥"},
  ],
  audit: [
    {created_at:"١٤:٢٢ ٠٤/٠٥",full_name:"محمد السيد",action:"تعديل سعر",resource:"items/٨٨٢"},
    {created_at:"١٦:٠٥ ٠٣/٠٥",full_name:"سارة الحسن",action:"إنشاء فاتورة",resource:"invoices/٩١٢"},
  ],
  users: [
    {full_name:"محمد السيد",role:"مدير",status:"نشط",last_login:"٠٤/٠٥ ٠٩:١٥"},
    {full_name:"سارة الحسن",role:"كاشير",status:"نشط",last_login:"٠٤/٠٥ ٠٨:٣٠"},
  ],
};

export const PREVIEW_COLUMNS = {
  sales:      [{k:"date",l:"التاريخ",t:"date"},{k:"invoice_no",l:"رقم الفاتورة",t:"text"},{k:"customer_name",l:"العميل",t:"text"},{k:"total",l:"الإجمالي",t:"cur"},{k:"discount",l:"الخصم",t:"cur"},{k:"profit_margin",l:"الربح",t:"cur"}],
  purchases:  [{k:"date",l:"التاريخ",t:"date"},{k:"supplier_name",l:"المورد",t:"text"},{k:"item_name",l:"الصنف",t:"text"},{k:"quantity_purchased",l:"الكمية",t:"num"},{k:"total_cost",l:"التكلفة",t:"cur"},{k:"purchase_no",l:"رقم المشتريات",t:"text"}],
  cheques:    [{k:"date",l:"التاريخ",t:"date"},{k:"bank_name",l:"البنك",t:"text"},{k:"amount",l:"المبلغ",t:"cur"},{k:"status",l:"الحالة",t:"text"},{k:"cheque_no",l:"رقم الشيك",t:"text"}],
  "purchase-returns": [{k:"date",l:"التاريخ",t:"date"},{k:"supplier_name",l:"المورد",t:"text"},{k:"return_total",l:"قيمة المرتجع",t:"cur"},{k:"reason",l:"السبب",t:"text"},{k:"items_returned",l:"الأصناف",t:"num"}],
  "sales-returns":    [{k:"date",l:"التاريخ",t:"date"},{k:"customer_name",l:"العميل",t:"text"},{k:"return_total",l:"قيمة المرتجع",t:"cur"},{k:"reason",l:"السبب",t:"text"},{k:"refund_method",l:"طريقة الرد",t:"text"}],
  suppliers:  [{k:"supplier_name",l:"المورد",t:"text"},{k:"total_due",l:"المستحق",t:"cur"},{k:"purchase_count",l:"عدد المشتريات",t:"num"},{k:"last_purchase_date",l:"آخر شراء",t:"date"}],
  customers:  [{k:"customer_name",l:"العميل",t:"text"},{k:"total_due",l:"المستحق",t:"cur"},{k:"aging_0_30",l:"0-30 يوم",t:"cur"},{k:"aging_31_60",l:"31-60 يوم",t:"cur"},{k:"aging_90_plus",l:"أكثر من 90",t:"cur"},{k:"last_invoice_date",l:"آخر فاتورة",t:"date"}],
  employees:  [{k:"full_name",l:"الموظف",t:"text"},{k:"action",l:"الإجراء",t:"text"},{k:"created_at",l:"التاريخ",t:"date"},{k:"action_count",l:"عدد العمليات",t:"num"}],
  installments: [{k:"customer_name",l:"العميل",t:"text"},{k:"total_amount",l:"إجمالي المبلغ",t:"cur"},{k:"collected",l:"المحصل",t:"cur"},{k:"outstanding",l:"المستحق",t:"cur"},{k:"status",l:"الحالة",t:"text"}],
  items:      [{k:"item_code",l:"كود الصنف",t:"text"},{k:"item_name",l:"الصنف",t:"text"},{k:"category_name",l:"الفئة",t:"text"},{k:"quantity",l:"الرصيد",t:"num"},{k:"total_value",l:"القيمة",t:"cur"},{k:"stock_status",l:"الحالة",t:"text"}],
  warehouses: [{k:"item_code",l:"كود الصنف",t:"text"},{k:"item_name",l:"الصنف",t:"text"},{k:"movement_type",l:"نوع الحركة",t:"text"},{k:"quantity",l:"الكمية",t:"num"},{k:"date",l:"التاريخ",t:"date"}],
  expenses:   [{k:"date",l:"التاريخ",t:"date"},{k:"category_name",l:"الفئة",t:"text"},{k:"amount",l:"المبلغ",t:"cur"},{k:"payment_type",l:"طريقة الدفع",t:"text"}],
  revenues:   [{k:"date",l:"التاريخ",t:"date"},{k:"category_name",l:"الفئة",t:"text"},{k:"amount",l:"المبلغ",t:"cur"},{k:"payment_type",l:"طريقة الدفع",t:"text"}],
  treasury:   [{k:"date",l:"التاريخ",t:"date"},{k:"type",l:"النوع",t:"text"},{k:"total",l:"المبلغ",t:"cur"},{k:"tx_count",l:"الحركات",t:"num"},{k:"name",l:"الخزينة",t:"text"},{k:"balance",l:"الرصيد",t:"cur"}],
  "profit-loader": [{k:"item_code",l:"كود الصنف",t:"text"},{k:"item_name",l:"الصنف",t:"text"},{k:"revenue",l:"الإيراد",t:"cur"},{k:"cost",l:"التكلفة",t:"cur"},{k:"profit_margin",l:"الربح",t:"cur"},{k:"margin_percent",l:"% الربح",t:"percent"}],
  "net-profit": [{k:"label",l:"البيان",t:"text"},{k:"amount",l:"المبلغ",t:"cur"},{k:"pct",l:"%",t:"percent"}],
  users:      [{k:"full_name",l:"المستخدم",t:"text"},{k:"role",l:"الصلاحية",t:"text"},{k:"status",l:"الحالة",t:"text"},{k:"last_login",l:"آخر دخول",t:"date"}],
};

export const GHOST_ROWS = {
  sales: [
    {date:"٠٤/٠٥",invoice_no:"INV-1024",customer_name:"أحمد البرقوقي",total:"١٢٬٤٥٠",discount:"٤٠٠",profit_margin:"٢٬٣٠٠"},
    {date:"٠٣/٠٥",invoice_no:"INV-1023",customer_name:"شركة النور",total:"٨٬٣٢٠",discount:"١٥٠",profit_margin:"١٬٧٥٠"},
  ],
  purchases: [
    {date:"٢٨/٠٤",supplier_name:"مورد النور",item_name:"شاشة سامسونج ٥٥ بوصة",quantity_purchased:"١٥",total_cost:"٢٧٬٠٠٠",purchase_no:"PO-231"},
    {date:"٠١/٠٥",supplier_name:"تك سبلاي",item_name:"كابل USB-C",quantity_purchased:"٢٠٠",total_cost:"١٬٩٠٠",purchase_no:"PO-232"},
  ],
  cheques: [
    {date:"٠٢/٠٥",bank_name:"البنك الأهلي",amount:"١٥٬٠٠٠",status:"قيد التحصيل",cheque_no:"CHK-451"},
    {date:"٠١/٠٥",bank_name:"بنك مصر",amount:"٨٬٥٠٠",status:"تم الصرف",cheque_no:"CHK-450"},
  ],
  "purchase-returns": [
    {date:"٢٩/٠٤",supplier_name:"مورد النور",return_total:"٢٬٣٠٠",reason:"تلف بالشحن",items_returned:"٣"},
    {date:"٢٥/٠٤",supplier_name:"تك سبلاي",return_total:"٩٥٠",reason:"خطأ في الصنف",items_returned:"١٠"},
  ],
  "sales-returns": [
    {date:"٣٠/٠٤",customer_name:"أحمد البرقوقي",return_total:"١٬٢٠٠",reason:"عيب تصنيع",refund_method:"نقداً"},
    {date:"٢٨/٠٤",customer_name:"شركة النور",return_total:"٣٬٥٠٠",reason:"غير مرغوب فيه",refund_method:"تحويل بنكي"},
  ],
  suppliers: [
    {supplier_name:"مورد النور",total_due:"٢٥٬٠٠٠",purchase_count:"١٢",last_purchase_date:"٠٢/٠٥"},
    {supplier_name:"تك سبلاي",total_due:"٨٬٥٠٠",purchase_count:"٥",last_purchase_date:"٢٨/٠٤"},
  ],
  customers: [
    {customer_name:"أحمد البرقوقي",total_due:"١٢٬٤٠٠",aging_0_30:"٨٬٥٠٠",aging_31_60:"٣٬٩٠٠",aging_90_plus:"٠",last_invoice_date:"١٠/٠٤"},
    {customer_name:"شركة النور للتجارة",total_due:"٧٬٨٥٠",aging_0_30:"٢٬٠٠٠",aging_31_60:"٥٬٨٥٠",aging_90_plus:"٠",last_invoice_date:"٢٥/٠٣"},
  ],
  employees: [
    {full_name:"محمد السيد",action:"تعديل سعر",created_at:"١٤:٢٢ ٠٤/٠٥",action_count:"٤٢"},
    {full_name:"سارة الحسن",action:"إنشاء فاتورة",created_at:"١٦:٠٥ ٠٣/٠٥",action_count:"١٢٧"},
  ],
  installments: [
    {customer_name:"أحمد البرقوقي",total_amount:"٣٠٬٠٠٠",collected:"١٠٬٠٠٠",outstanding:"٢٠٬٠٠٠",status:"نشط"},
    {customer_name:"شركة النور",total_amount:"٥٠٬٠٠٠",collected:"٢٥٬٠٠٠",outstanding:"٢٥٬٠٠٠",status:"نشط"},
  ],
  items: [
    {item_code:"SKU-001",item_name:"آيفون ١٦ برو",category_name:"موبايلات",quantity:"٤٧",total_value:"٤٤٬٦٥٠",stock_status:"متاح"},
    {item_code:"SKU-042",item_name:"سامسونج A55",category_name:"موبايلات",quantity:"٨٣",total_value:"١٦٬٦٠٠",stock_status:"متاح"},
  ],
  warehouses: [
    {item_code:"SKU-001",item_name:"آيفون ١٦ برو",movement_type:"تحويل وارد",quantity:"١٠",date:"٠٢/٠٥"},
    {item_code:"SKU-042",item_name:"سامسونج A55",movement_type:"تسوية",quantity:"-٢",date:"٠١/٠٥"},
  ],
  expenses: [
    {date:"٠١/٠٥",category_name:"إيجار",amount:"١٥٬٠٠٠",payment_type:"نقداً"},
    {date:"٠٣/٠٥",category_name:"فواتير كهرباء",amount:"٢٬٤٠٠",payment_type:"تحويل"},
  ],
  revenues: [
    {date:"٠١/٠٥",category_name:"إيرادات إعلانات",amount:"٥٬٠٠٠",payment_type:"تحويل"},
    {date:"٠٣/٠٥",category_name:"إيرادات خدمة",amount:"١٬٢٠٠",payment_type:"نقداً"},
  ],
  treasury: [
    {date:"٠١/٠٥",type:"تحصيل فاتورة",total:"٥٬٢٠٠",tx_count:"١",name:"الخزينة الرئيسية",balance:"٣٧٬٤٠٠"},
    {date:"٠٣/٠٥",type:"دفع مورد",total:"-١٢٬٠٠٠",tx_count:"٣",name:"الخزينة الرئيسية",balance:"٢٥٬٤٠٠"},
  ],
  "profit-loader": [
    {item_code:"SKU-001",item_name:"آيفون ١٦ برو",revenue:"١٢٬٠٠٠",cost:"٩٬٨٠٠",profit_margin:"٢٬٢٠٠",margin_percent:"١٨٫٣٪"},
    {item_code:"SKU-042",item_name:"سامسونج A55",revenue:"٨٬٥٠٠",cost:"٦٬٩٧٠",profit_margin:"١٬٥٣٠",margin_percent:"١٨٪"},
  ],
  "net-profit": [
    {label:"إجمالي الإيرادات",amount:"١٥٠٬٠٠٠",pct:"١٠٠٪"},
    {label:"تكلفة البضاعة",amount:"٩٠٬٠٠٠",pct:"٦٠٪"},
  ],
  users: [
    {full_name:"محمد السيد",role:"مدير",status:"نشط",last_login:"٠٤/٠٥ ٠٩:١٥"},
    {full_name:"سارة الحسن",role:"كاشير",status:"نشط",last_login:"٠٤/٠٥ ٠٨:٣٠"},
  ],
};

export const COL_TYPE_STYLE = {
  date: "text-blue-500  bg-blue-500/8  border-blue-200/50",
  text: "text-zinc-500  bg-zinc-500/8  border-zinc-300/50",
  num:  "text-violet-500 bg-violet-500/8 border-violet-200/50",
  cur:  "text-emerald-600 bg-emerald-500/8 border-emerald-200/50",
  percent: "text-amber-600 bg-amber-500/8 border-amber-200/50",
};

// ── Filter Dimensions (mirrors server registry.js filterDimensions) ──
// Each source has a shared pool of dimensions. Each classification enables a subset
// via its `dimensions[]` array. The frontend renders only enabled ones.
export const FILTER_DIMENSIONS = {
  sales: [
    { key: "category_id", type: "lookup", entity: "category", label: "فئة المنتجات" },
    { key: "item_id", type: "lookup", entity: "product", label: "المنتج" },
    { key: "customer_id", type: "lookup", entity: "customer", label: "العميل" },
    { key: "cashier_id", type: "lookup", entity: "user", label: "الكاشير" },
    { key: "status", type: "select", label: "الحالة", options: [{ value: "paid", label: "مدفوع" }, { value: "unpaid", label: "غير مدفوع" }, { value: "cancelled", label: "ملغي" }] },
    { key: "payment_type", type: "select", label: "طريقة الدفع", dynamic: true, options: [{ value: "cash", label: "نقداً" }, { value: "credit", label: "آجل" }, { value: "card", label: "بطاقة" }, { value: "bank_transfer", label: "تحويل بنكي" }, { value: "multi", label: "متعدد" }] },
  ],
  purchases: [
    { key: "supplier_id", type: "lookup", entity: "supplier", label: "المورد" },
    { key: "category_id", type: "lookup", entity: "category", label: "فئة المنتجات" },
    { key: "item_id", type: "lookup", entity: "product", label: "المنتج" },
    { key: "status", type: "select", label: "الحالة", options: [{ value: "paid", label: "مدفوع" }, { value: "unpaid", label: "غير مدفوع" }, { value: "cancelled", label: "ملغي" }] },
    { key: "payment_type", type: "select", label: "طريقة الدفع", dynamic: true, options: [{ value: "cash", label: "نقداً" }, { value: "credit", label: "آجل" }, { value: "card", label: "بطاقة" }, { value: "bank_transfer", label: "تحويل بنكي" }, { value: "multi", label: "متعدد" }] },
  ],
  "purchase-returns": [
    { key: "supplier_id", type: "lookup", entity: "supplier", label: "المورد" },
  ],
  "sales-returns": [
    { key: "customer_id", type: "lookup", entity: "customer", label: "العميل" },
  ],
  suppliers: [
    { key: "supplier_id", type: "lookup", entity: "supplier", label: "المورد" },
  ],
  customers: [
    { key: "customer_id", type: "lookup", entity: "customer", label: "العميل" },
  ],
  employees: [
    { key: "cashier_id", type: "lookup", entity: "user", label: "الكاشير" },
    { key: "user_id", type: "lookup", entity: "user", label: "المستخدم" },
    { key: "action", type: "select", label: "الإجراء", options: [] },
  ],
  items: [
    { key: "category_id", type: "lookup", entity: "category", label: "فئة المنتجات" },
    { key: "item_id", type: "lookup", entity: "product", label: "المنتج" },
    { key: "warehouse_id", type: "lookup", entity: "warehouse", label: "المخزن" },
  ],
  warehouses: [
    { key: "movement_type", type: "select", label: "نوع الحركة", options: [{ value: "in", label: "وارد" }, { value: "out", label: "صادر" }, { value: "transfer", label: "تحويل" }] },
    { key: "category_id", type: "lookup", entity: "category", label: "فئة المنتجات" },
    { key: "item_id", type: "lookup", entity: "product", label: "المنتج" },
    { key: "warehouse_id", type: "lookup", entity: "warehouse", label: "المخزن" },
  ],
  expenses: [
    { key: "category_id", type: "lookup", entity: "category", label: "فئة المصروفات" },
  ],
  revenues: [
    { key: "category_id", type: "lookup", entity: "category", label: "فئة الإيرادات" },
  ],
  cheques: [
    { key: "status", type: "select", label: "الحالة", options: [{ value: "pending", label: "قيد التحصيل" }, { value: "cleared", label: "تم الصرف" }, { value: "bounced", label: "مرتجع" }, { value: "replaced", label: "مستبدل" }] },
  ],
  "profit-loader": [
    { key: "category_id", type: "lookup", entity: "category", label: "فئة المنتجات" },
    { key: "item_id", type: "lookup", entity: "product", label: "المنتج" },
  ],
  "net-profit": [],
  treasury: [],
  installments: [],
  users: [
    { key: "user_id", type: "lookup", entity: "user", label: "المستخدم" },
    { key: "role", type: "select", label: "الصلاحية", options: [{ value: "admin", label: "مدير" }, { value: "cashier", label: "كاشير" }, { value: "manager", label: "مشرف" }] },
  ],
};

export function fmtDate(d) { return d.toISOString().slice(0,10); }
