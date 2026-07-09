import { TrendingUp, Package, Wallet, Receipt, FileText, Shield, ClipboardList, FileImage, FileSpreadsheet, Printer, Layers, RotateCcw, Truck, Users, UserCheck, CalendarCheck, Percent, LineChart, Search, ClipboardCheck, Clock, Landmark, BadgePercent } from "lucide-react";

export const CATEGORIES = [
  { id: "sales",         label: "المبيعات",         icon: TrendingUp,  color: "var(--success-DEFAULT,#10b981)" },
  { id: "purchases",     label: "المشتريات",        icon: Package,     color: "var(--info-DEFAULT,#3b82f6)" },
  { id: "inventory",     label: "المخزون",          icon: Layers,      color: "var(--primary-DEFAULT,#8b5cf6)" },
  { id: "accounts",      label: "الحسابات",         icon: Wallet,      color: "var(--warning-DEFAULT,#f59e0b)" },
  { id: "treasury",      label: "الخزينة والبنوك",  icon: Landmark,    color: "#06b6d4" },
  { id: "tax",           label: "الضرائب",          icon: FileText,    color: "var(--error-DEFAULT,#ef4444)" },
  { id: "profitability", label: "الأرباح",          icon: BadgePercent, color: "#d946ef" },
  { id: "individuals",   label: "الأفراد والرقابة", icon: Shield,      color: "var(--text-secondary,#94a3b8)" },
  { id: "users",         label: "المستخدمين",       icon: Users,       color: "#6366f1" },
];

export const SOURCES = [
  { id: "sales",           label: "المبيعات",           icon: TrendingUp,    color: "var(--success-DEFAULT,#10b981)" },
  { id: "purchases",       label: "المشتريات",          icon: Package,       color: "var(--info-DEFAULT,#3b82f6)" },
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
  { id: "payment-flow",    label: "سجل التدفقات المالية", icon: Wallet,        color: "#0f766e" },
  { id: "profit-loader",   label: "مجمل ربح المبيعات",  icon: Percent,       color: "#d946ef" },
  { id: "net-profit",      label: "صافي الربح",          icon: LineChart,     color: "#1e40af" },
  { id: "expiry",          label: "انتهاء الصلاحية",     icon: Clock,         color: "#d97706" },
  { id: "owner-statement", label: "لوحة صاحب المحل",     icon: ClipboardCheck,color: "#0f172a" },
  { id: "tax",             label: "الضرائب",             icon: Receipt,       color: "var(--error-DEFAULT,#ef4444)" },
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
  { value: "lifo",           label: "الوارد أخيراً صادر أولاً (LIFO)" },
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
  suppliers:       [{ type:"all",label:"الكل"}],
  customers:       [{ type:"all",label:"الكل"}],
  employees:       [{ type:"all",label:"الكل"}],
  users:           [{ type:"all",label:"الكل"}],
  installments:    [{ type:"all",label:"الكل"}],
  expenses:        [{ type:"all",label:"الكل"}],
  revenues:        [{ type:"all",label:"الكل"}],
  treasury:        [{ type:"all",label:"الكل"}],
  "payment-flow": [{ type:"all",label:"الكل"}],
  "owner-statement": [{ type:"all",label:"الكل"}],
  tax: [{ type:"all",label:"الكل"}],
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
  "owner-statement": [
    {k:"metric",l:"البند",t:"text"},{k:"value",l:"القيمة",t:"cur"},
    {k:"period",l:"الفترة",t:"text"},{k:"cost_method",l:"طريقة التكلفة",t:"text"},
    {k:"status",l:"الحالة",t:"text"},
  ],
  treasury: [
    {k:"date",l:"التاريخ",t:"date"},{k:"type",l:"النوع",t:"text"},
    {k:"total",l:"المبلغ",t:"cur"},{k:"tx_count",l:"الحركات",t:"num"},
    {k:"name",l:"الخزينة",t:"text"},{k:"balance",l:"الرصيد",t:"cur"},
  ],
  "payment-flow": [
    {k:"created_at",l:"تاريخ الحركة",t:"date"},{k:"doc_no",l:"المستند",t:"text"},
    {k:"doc_type_label",l:"نوع المستند",t:"text"},{k:"direction_label",l:"الاتجاه",t:"text"},
    {k:"total_in",l:"داخل",t:"cur"},{k:"total_out",l:"خارج",t:"cur"},{k:"net_amount",l:"الصافي",t:"cur"},{k:"method_name",l:"وسيلة الدفع",t:"text"},
  ],
  tax: [
    {k:"tax_rate",l:"النسبة",t:"num"},{k:"taxable_sales",l:"المبيعات الخاضعة",t:"cur"},
    {k:"vat_amount",l:"قيمة الضريبة",t:"cur"},{k:"invoice_count",l:"عدد الفواتير",t:"num"},
  ],
  profitability: [
    {k:"label",l:"البيان",t:"text"},{k:"amount",l:"المبلغ",t:"cur"},
    {k:"pct",l:"%",t:"percent"},
  ],
  individuals: [
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
  "owner-statement": [
    {metric:"قيمة المخزون",value:"٤٤٬٦٥٠",period:"الشهر الحالي",cost_method:"WAC",status:"قابل للحفظ"},
    {metric:"النقدية",value:"٣٧٬٤٠٠",period:"الشهر الحالي",cost_method:"غير مؤثر",status:"حي"},
    {metric:"صافي الربح",value:"١٢٬٣٠٠",period:"الشهر الحالي",cost_method:"FIFO",status:"مسودة"},
  ],
  treasury: [
    {date:"٠١/٠٥",type:"تحصيل فاتورة",total:"٥٬٢٠٠",tx_count:"١",name:"الخزينة الرئيسية",balance:"٣٧٬٤٠٠"},
    {date:"٠٣/٠٥",type:"دفع مورد",total:"-١٢٬٠٠٠",tx_count:"٣",name:"الخزينة الرئيسية",balance:"٢٥٬٤٠٠"},
  ],
  "payment-flow": [
    {created_at:"2026/06/29",doc_no:"INV-20260629-0002",doc_type_label:"فاتورة بيع",direction_label:"داخل",total_in:"1,000",total_out:"0",net_amount:"1,000",method_name:"نقدي"},
    {created_at:"2026/06/29",doc_no:"EXP-104",doc_type_label:"مصروف",direction_label:"خارج",total_in:"0",total_out:"890",net_amount:"-890",method_name:"الخزينة الرئيسية"},
  ],
  tax: [
    {tax_rate:"١٤٪",taxable_sales:"٥٬٢٠٠",vat_amount:"٧٢٨",invoice_count:"١٢"},
    {tax_rate:"٠٪",taxable_sales:"٣٬٨٠٠",vat_amount:"٠",invoice_count:"٥"},
  ],
  profitability: [
    {label:"إجمالي الإيرادات",amount:"١٥٠٬٠٠٠",pct:"١٠٠٪"},
    {label:"تكلفة البضاعة",amount:"٩٠٬٠٠٠",pct:"٦٠٪"},
    {label:"إجمالي الربح",amount:"٦٠٬٠٠٠",pct:"٤٠٪"},
  ],
  individuals: [
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
  "purchase-returns": [{k:"date",l:"التاريخ",t:"date"},{k:"supplier_name",l:"المورد",t:"text"},{k:"return_total",l:"قيمة المرتجع",t:"cur"},{k:"reason",l:"السبب",t:"text"},{k:"items_returned",l:"الأصناف",t:"num"}],
  "sales-returns":    [{k:"date",l:"التاريخ",t:"date"},{k:"customer_name",l:"العميل",t:"text"},{k:"return_total",l:"قيمة المرتجع",t:"cur"},{k:"reason",l:"السبب",t:"text"},{k:"refund_method",l:"طريقة الرد",t:"text"}],
  suppliers:  [{k:"supplier_name",l:"المورد",t:"text"},{k:"total_due",l:"المستحق",t:"cur"},{k:"purchase_count",l:"عدد المشتريات",t:"num"},{k:"return_rate_percent",l:"% المرتجعات",t:"percent"},{k:"last_purchase_date",l:"آخر شراء",t:"date"}],
  customers:  [{k:"customer_name",l:"العميل",t:"text"},{k:"total_sales",l:"إجمالي المبيعات",t:"cur"},{k:"invoice_count",l:"عدد الفواتير",t:"num"},{k:"collection_rate",l:"% التحصيل",t:"percent"},{k:"last_invoice_date",l:"آخر فاتورة",t:"date"}],
  employees:  [{k:"employee_name",l:"الموظف",t:"text"},{k:"job_title",l:"المسمى",t:"text"},{k:"salary",l:"الراتب",t:"cur"},{k:"amount",l:"المبلغ",t:"cur"},{k:"status",l:"الحالة",t:"text"}],
  installments: [{k:"customer_name",l:"العميل",t:"text"},{k:"total_amount",l:"إجمالي المبلغ",t:"cur"},{k:"collected",l:"المحصل",t:"cur"},{k:"outstanding",l:"المستحق",t:"cur"},{k:"status",l:"الحالة",t:"text"}],
  items:      [{k:"item_code",l:"كود الصنف",t:"text"},{k:"item_name",l:"الصنف",t:"text"},{k:"category_name",l:"الفئة",t:"text"},{k:"quantity",l:"الرصيد",t:"num"},{k:"total_value",l:"القيمة",t:"cur"},{k:"stock_status",l:"الحالة",t:"text"}],
  warehouses: [{k:"item_code",l:"كود الصنف",t:"text"},{k:"item_name",l:"الصنف",t:"text"},{k:"movement_type",l:"نوع الحركة",t:"text"},{k:"quantity",l:"الكمية",t:"num"},{k:"date",l:"التاريخ",t:"date"}],
  expenses:   [{k:"date",l:"التاريخ",t:"date"},{k:"category_name",l:"الفئة",t:"text"},{k:"amount",l:"المبلغ",t:"cur"},{k:"payment_type",l:"طريقة الدفع",t:"text"}],
  revenues:   [{k:"date",l:"التاريخ",t:"date"},{k:"category_name",l:"الفئة",t:"text"},{k:"amount",l:"المبلغ",t:"cur"},{k:"payment_type",l:"طريقة الدفع",t:"text"}],
  treasury:   [{k:"date",l:"التاريخ",t:"date"},{k:"type",l:"النوع",t:"text"},{k:"total",l:"المبلغ",t:"cur"},{k:"tx_count",l:"الحركات",t:"num"},{k:"name",l:"الخزينة",t:"text"},{k:"balance",l:"الرصيد",t:"cur"}],
  "profit-loader": [{k:"item_code",l:"كود الصنف",t:"text"},{k:"item_name",l:"الصنف",t:"text"},{k:"revenue",l:"الإيراد",t:"cur"},{k:"cost",l:"التكلفة",t:"cur"},{k:"profit_margin",l:"الربح",t:"cur"},{k:"margin_percent",l:"% الربح",t:"percent"}],
  "net-profit": [{k:"label",l:"البيان",t:"text"},{k:"amount",l:"المبلغ",t:"cur"},{k:"pct",l:"%",t:"percent"}],
  users:      [{k:"full_name",l:"المستخدم",t:"text"},{k:"role",l:"الصلاحية",t:"text"},{k:"status",l:"الحالة",t:"text"},{k:"last_login",l:"آخر دخول",t:"date"}],
  expiry:     [{k:"item_code",l:"كود الصنف",t:"text"},{k:"item_name",l:"الصنف",t:"text"},{k:"batch_no",l:"الدفعة",t:"text"},{k:"quantity",l:"الكمية",t:"num"},{k:"expiry_date",l:"تاريخ الانتهاء",t:"date"},{k:"days_until_expiry",l:"الأيام المتبقية",t:"num"},{k:"expiry_status",l:"الحالة",t:"text"}],
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
  "purchase-returns": [
    {date:"٢٩/٠٤",supplier_name:"مورد النور",return_total:"٢٬٣٠٠",reason:"تلف بالشحن",items_returned:"٣"},
    {date:"٢٥/٠٤",supplier_name:"تك سبلاي",return_total:"٩٥٠",reason:"خطأ في الصنف",items_returned:"١٠"},
  ],
  "sales-returns": [
    {date:"٣٠/٠٤",customer_name:"أحمد البرقوقي",return_total:"١٬٢٠٠",reason:"عيب تصنيع",refund_method:"نقداً"},
    {date:"٢٨/٠٤",customer_name:"شركة النور",return_total:"٣٬٥٠٠",reason:"غير مرغوب فيه",refund_method:"تحويل بنكي"},
  ],
  suppliers: [
    {supplier_name:"مورد النور",total_due:"٢٥٬٠٠٠",purchase_count:"١٢",return_rate_percent:"٣٫٢٪",last_purchase_date:"٠٢/٠٥"},
    {supplier_name:"تك سبلاي",total_due:"٨٬٥٠٠",purchase_count:"٥",return_rate_percent:"١٫١٪",last_purchase_date:"٢٨/٠٤"},
  ],
  customers: [
    {customer_name:"أحمد البرقوقي",total_sales:"٤٥٬٠٠٠",invoice_count:"١٢",collection_rate:"٧٥٪",last_invoice_date:"١٠/٠٤"},
    {customer_name:"شركة النور للتجارة",total_sales:"٣٢٬٥٠٠",invoice_count:"٨",collection_rate:"٨٢٪",last_invoice_date:"٢٥/٠٣"},
  ],
  employees: [
    {employee_name:"أحمد السيد",job_title:"مدير مبيعات",salary:"١٥٬٠٠٠",amount:"٢٬٣٠٠",status:"نشط"},
    {employee_name:"مريم حسن",job_title:"كاشير",salary:"٨٬٠٠٠",amount:"٨٠٠",status:"نشط"},
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
  expiry: [
    {item_code:"SKU-001",item_name:"حليب مجفف",batch_no:"B-2401",quantity:"٤٥",expiry_date:"٢٠٢٦/٠٧/١٥",days_until_expiry:"٣٤",expiry_status:"ساري"},
    {item_code:"SKU-042",item_name:"جبنة شيدر",batch_no:"B-2389",quantity:"١٢",expiry_date:"٢٠٢٦/٠٥/٠١",days_until_expiry:"-١١",expiry_status:"منتهي"},
    {item_code:"SKU-107",item_name:"عصير طازج",batch_no:"B-2408",quantity:"٨٠",expiry_date:"٢٠٢٦/٠٦/٢٠",days_until_expiry:"٩",expiry_status:"ينتهي قريباً"},
  ],
};

export const COL_TYPE_STYLE = {
  date: "text-info-text bg-info-bg border-info-border",
  text: "text-text-secondary bg-bg-overlay border-border-subtle",
  num:  "text-primary bg-primary-50 border-primary",
  cur:  "text-success-text bg-success-bg border-success-border",
  percent: "text-warning-text bg-warning-bg border-warning-border",
};

// ── Filter Dimensions (mirrors server registry.js filterDimensions) ──
// Each source has a shared pool of dimensions. Each classification enables a subset
// via its `dimensions[]` array. The frontend renders only enabled ones.
const PAYMENT_FLOW_FILTER_DIMENSIONS = [
  { key: "method_id", type: "lookup", entity: "payment_method", label: "وسيلة الدفع" },
  { key: "direction", type: "select", label: "الاتجاه", options: [{ value: "in", label: "داخل" }, { value: "out", label: "خارج" }] },
  { key: "doc_type", type: "select", label: "نوع المستند", options: [{ value: "pos_invoice", label: "فاتورة بيع" }, { value: "payment_allocation", label: "تسوية فاتورة" }, { value: "customer_payment", label: "تحصيل عميل" }, { value: "supplier_payment", label: "سداد مورد" }, { value: "ajal_payment", label: "حركة آجل" }, { value: "expense", label: "مصروف" }, { value: "revenue", label: "إيراد" }, { value: "purchase", label: "مشتريات" }, { value: "purchase_payment", label: "دفعة مشتريات" }, { value: "sales_return", label: "مرتجع مبيعات" }, { value: "purchase_return", label: "مرتجع مشتريات" }, { value: "withdrawal", label: "مسحوبات" }] },
  { key: "party_type", type: "select", label: "نوع الطرف", options: [{ value: "customer", label: "عميل" }, { value: "supplier", label: "مورد" }, { value: "general", label: "عام" }] },
  { key: "amount_min", type: "text", label: "أقل مبلغ" },
  { key: "amount_max", type: "text", label: "أكبر مبلغ" },
];
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
    { key: "employee_id", type: "lookup", entity: "employee", label: "الموظف" },
    { key: "deduction_type", type: "select", label: "نوع الخصم", options: [{ value: "absence", label: "غياب" }, { value: "fine", label: "غرامة" }, { value: "insurance", label: "تأمين" }, { value: "other", label: "أخرى" }] },
    { key: "bonus_type", type: "select", label: "نوع المكافأة", options: [{ value: "performance", label: "أداء" }, { value: "holiday", label: "إجازة" }, { value: "overtime", label: "إضافي" }, { value: "transportation", label: "مواصلات" }, { value: "other", label: "أخرى" }] },
    { key: "status", type: "select", label: "الحالة", options: [{ value: "active", label: "نشط" }, { value: "completed", label: "مطبق" }, { value: "cancelled", label: "ملغي" }] },
    { key: "tx_type", type: "select", label: "نوع الحركة", options: [{ value: "deduction", label: "خصم" }, { value: "bonus", label: "مكافأة" }, { value: "advance", label: "سلفة" }, { value: "advance_payment", label: "دفعة سلفة" }, { value: "settlement", label: "صرف راتب" }] },
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
  "profit-loader": [
    { key: "category_id", type: "lookup", entity: "category", label: "فئة المنتجات" },
    { key: "item_id", type: "lookup", entity: "product", label: "المنتج" },
  ],
  "net-profit": [],
  expiry: [
    { key: "item_id", type: "lookup", entity: "product", label: "المنتج" },
    { key: "warehouse_id", type: "lookup", entity: "warehouse", label: "المخزن" },
    { key: "category_id", type: "lookup", entity: "category", label: "فئة المنتجات" },
  ],
  "owner-statement": [],
  tax: [
    { key: "customer_id", type: "lookup", entity: "customer", label: "العميل" },
    { key: "supplier_id", type: "lookup", entity: "supplier", label: "المورد" },
    { key: "status", type: "select", label: "الحالة", options: [{ value: "paid", label: "مدفوع" }, { value: "unpaid", label: "غير مدفوع" }, { value: "cancelled", label: "ملغي" }] },
    { key: "payment_type", type: "select", label: "طريقة الدفع", dynamic: true, options: [{ value: "cash", label: "نقداً" }, { value: "credit", label: "آجل" }, { value: "card", label: "بطاقة" }, { value: "bank_transfer", label: "تحويل بنكي" }, { value: "multi", label: "متعدد" }] },
    { key: "tax_type", type: "select", label: "نوع الضريبة", options: [{ value: "exclusive", label: "خارج السعر" }, { value: "inclusive", label: "داخل السعر" }] },
  ],
  treasury: PAYMENT_FLOW_FILTER_DIMENSIONS,
  "payment-flow": PAYMENT_FLOW_FILTER_DIMENSIONS,
  "purchase-returns": [
    { id: "summary", label_key: "cls_preturn_summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
    { id: "detailed", label_key: "cls_preturn_detailed", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id"] },
    { id: "by-supplier", label_key: "cls_preturn_by_supplier", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
  ],
  "sales-returns": [
    { id: "summary", label_key: "cls_sreturn_summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
    { id: "detailed", label_key: "cls_sreturn_detailed", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["customer_id"] },
    { id: "by-customer", label_key: "cls_sreturn_by_customer", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
  ],
  suppliers: [
    { id: "balance-list", label_key: "cls_supplier_balance_list", availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
    { id: "statement", label_key: "cls_supplier_statement", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
    { id: "aging", label_key: "cls_supplier_aging", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
    { id: "purchases", label_key: "cls_supplier_purchases", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id"] },
    { id: "returns", label_key: "cls_supplier_returns", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
    { id: "reliability", label_key: "cls_supplier_reliability", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
  ],
  customers: [
    { id: "balance-list", label_key: "cls_customer_balance_list", availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
    { id: "statement", label_key: "cls_customer_statement", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
    { id: "aging", label_key: "cls_customer_aging", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
    { id: "top-customers", label_key: "cls_top_customers", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["customer_id"] },
    { id: "collection-efficiency", label_key: "cls_collection_efficiency", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
    { id: "loyalty", label_key: "cls_customer_loyalty", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
  ],
  employees: [
    { id: "employee-list", label_key: "cls_emp_list", availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["employee_id"] },
    { id: "employee-deductions", label_key: "cls_emp_deductions", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["employee_id", "deduction_type", "status"] },
    { id: "employee-bonuses", label_key: "cls_emp_bonuses", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["employee_id", "bonus_type", "status"] },
    { id: "employee-advances", label_key: "cls_emp_advances", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["employee_id", "status"] },
    { id: "employee-payroll", label_key: "cls_emp_payroll", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["employee_id"] },
    { id: "employee-full-history", label_key: "cls_emp_full_history", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["employee_id", "tx_type"] },
    { id: "employee-adjustments", label_key: "cls_emp_adjustments", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["employee_id"] },
  ],
  installments: [
    { key: "customer_id", type: "lookup", entity: "customer", label: "العميل" },
    { key: "status", type: "select", label: "الحالة", options: [{ value: "pending", label: "قيد السداد" }, { value: "paid", label: "مدفوع" }, { value: "cancelled", label: "ملغي" }] },
  ],
  users: [
    { key: "user_id", type: "lookup", entity: "user", label: "المستخدم" },
    { key: "role", type: "select", label: "الصلاحية", options: [{ value: "admin", label: "مدير" }, { value: "cashier", label: "كاشير" }, { value: "manager", label: "مشرف" }] },
  ],
};

export function fmtDate(d) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }

export const CLASSIFICATIONS = {
  tax: [
    { id: "vat", label_key: "r23_title", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["customer_id", "status", "payment_type", "tax_type"] },
    { id: "output-vat", label_key: "r48_title", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["customer_id", "status", "payment_type", "tax_type"] },
    { id: "input-vat", label_key: "r49_title", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "status", "payment_type", "tax_type"] },
    { id: "vat-filing-summary", label_key: "r50_title", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["customer_id", "status"] },
    { id: "returns-tax-effect", label_key: "r51_title", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [] },
  ],
  "owner-statement": [
    { id: "worksheet", label_key: "cls_owner_statement", availableModes: ["summary"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: [] },
  ],
  users: [
    { id: "user-list", label_key: "cls_users_list", availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["role"] },
    { id: "performance", label_key: "cls_users_performance", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["user_id"] },
    { id: "login-history", label_key: "cls_users_login_history", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["user_id"] },
  ],
  sales: [
    { id: "daily-summary", label_key: "cls_sales_daily", availableModes: ["summary"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["payment_type", "cashier_id"] },
    { id: "detailed", label_key: "cls_sales_detailed", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id", "status", "payment_type"] },
    { id: "by-item", label_key: "cls_sales_by_item", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id", "status", "payment_type"] },
    { id: "by-category", label_key: "cls_sales_by_category", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "customer_id", "cashier_id", "status", "payment_type"] },
    { id: "by-cashier", label_key: "cls_sales_by_cashier", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["cashier_id", "customer_id", "payment_type", "status"] },
    { id: "by-payment", label_key: "cls_sales_by_payment", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["payment_type", "customer_id", "cashier_id", "status"] },
    { id: "heatmap", label_key: "cls_sales_heatmap", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "customer_id", "payment_type"] },
    { id: "period-compare", label_key: "cls_sales_period_compare", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id", "status", "payment_type"] },
    { id: "discounts", label_key: "cls_sales_discounts", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id", "payment_type", "status"] },
    { id: "margin", label_key: "cls_sales_margin", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id"] },
    { id: "tax", label_key: "cls_sales_tax", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["customer_id", "status", "payment_type", "tax_type"] },
  ],
  purchases: [
    { id: "summary", label_key: "cls_purchases_summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "payment_type", "status"] },
    { id: "detailed", label_key: "cls_purchases_detailed", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "category_id", "item_id", "status", "payment_type"] },
    { id: "by-supplier", label_key: "cls_purchases_by_supplier", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "category_id", "item_id", "status", "payment_type"] },
    { id: "by-item", label_key: "cls_purchases_by_item", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "category_id", "item_id", "status", "payment_type"] },
    { id: "supplier-pricing", label_key: "cls_purchases_supplier_pricing", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "category_id", "item_id"] },
  ],
  "purchase-returns": [
    { id: "summary", label_key: "cls_preturn_summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
    { id: "detailed", label_key: "cls_preturn_detailed", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
    { id: "by-supplier", label_key: "cls_preturn_by_supplier", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
  ],
  "sales-returns": [
    { id: "summary", label_key: "cls_sreturn_summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
    { id: "detailed", label_key: "cls_sreturn_detailed", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
    { id: "by-customer", label_key: "cls_sreturn_by_customer", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
  ],
  suppliers: [
    { id: "balance-list", label_key: "cls_supplier_balance_list", availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
    { id: "statement", label_key: "cls_supplier_statement", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
    { id: "aging", label_key: "cls_supplier_aging", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
    { id: "purchases", label_key: "cls_supplier_purchases", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id"] },
    { id: "returns", label_key: "cls_supplier_returns", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
    { id: "reliability", label_key: "cls_supplier_reliability", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"] },
  ],
  customers: [
    { id: "balance-list", label_key: "cls_customer_balance_list", availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
    { id: "statement", label_key: "cls_customer_statement", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
    { id: "aging", label_key: "cls_customer_aging", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
    { id: "top-customers", label_key: "cls_top_customers", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["customer_id"] },
    { id: "collection-efficiency", label_key: "cls_collection_efficiency", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
    { id: "loyalty", label_key: "cls_customer_loyalty", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
  ],
  employees: [
    { id: "employee-list", label_key: "cls_emp_list", availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["employee_id"] },
    { id: "employee-deductions", label_key: "cls_emp_deductions", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["employee_id", "deduction_type", "status"] },
    { id: "employee-bonuses", label_key: "cls_emp_bonuses", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["employee_id", "bonus_type", "status"] },
    { id: "employee-advances", label_key: "cls_emp_advances", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["employee_id", "status"] },
    { id: "employee-payroll", label_key: "cls_emp_payroll", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["employee_id"] },
    { id: "employee-full-history", label_key: "cls_emp_full_history", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["employee_id", "tx_type"] },
    { id: "shifts", label_key: "cls_emp_shifts", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["employee_id"] },
    { id: "user-activity", label_key: "cls_emp_user_activity", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["employee_id"] },
    { id: "employee-adjustments", label_key: "cls_emp_adjustments", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["employee_id"] },
  ],
  installments: [
    { id: "plans", label_key: "cls_inst_plans", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id", "status"] },
    { id: "collections", label_key: "cls_inst_collections", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id", "status"] },
    { id: "by-customer", label_key: "cls_inst_by_customer", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id", "status"] },
    { id: "delinquent", label_key: "cls_inst_delinquent", availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
  ],
  items: [
    { id: "stock-levels", label_key: "cls_item_stock_levels", availableModes: ["detailed", "summary"], supportsDates: false, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"] },
    { id: "valuation", label_key: "cls_item_valuation", availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"] },
    { id: "count-sheet", label_key: "cls_item_count_sheet", availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: true, dimensions: ["category_id", "warehouse_id"] },
    { id: "reorder", label_key: "cls_item_reorder", availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["category_id", "warehouse_id"] },
    { id: "expiry", label_key: "cls_item_expiry", availableModes: ["detailed", "summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["item_id", "warehouse_id", "category_id"] },
    { id: "slow-moving", label_key: "cls_item_slow_moving", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"] },
    { id: "aging", label_key: "cls_item_aging", availableModes: ["detailed", "summary"], supportsDates: false, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"] },
    { id: "dead-stock", label_key: "cls_item_dead_stock", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"] },
  ],
  warehouses: [
    { id: "movements", label_key: "cls_wh_movements", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["movement_type", "category_id", "item_id", "warehouse_id"] },
    { id: "transfers", label_key: "cls_wh_transfers", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["warehouse_id"] },
    { id: "per-warehouse", label_key: "cls_wh_per_warehouse", availableModes: ["detailed", "summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["warehouse_id", "category_id"] },
  ],
  expenses: [
    { id: "summary", label_key: "cls_exp_summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id"] },
    { id: "detailed", label_key: "cls_exp_detailed", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id"] },
    { id: "by-category", label_key: "cls_exp_by_category", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id"] },
    { id: "by-payment", label_key: "cls_exp_by_payment", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [] },
  ],
  revenues: [
    { id: "summary", label_key: "cls_rev_summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id"] },
    { id: "detailed", label_key: "cls_rev_detailed", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id"] },
    { id: "by-category", label_key: "cls_rev_by_category", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id"] },
    { id: "by-payment", label_key: "cls_rev_by_payment", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [] },
  ],
  "payment-flow": [
    { id: "payment-flow-summary", label_key: "cls_trs_payment_flow_summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["method_id"] },
    { id: "payment-flow-ledger", label_key: "cls_trs_payment_flow_ledger", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["method_id", "direction", "doc_type", "party_type", "amount_min", "amount_max"] },
    { id: "payment-flow-by-doc-type", label_key: "cls_trs_payment_flow_by_doc_type", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["doc_type", "method_id", "direction"] },
    { id: "payment-flow-by-direction", label_key: "cls_trs_payment_flow_by_direction", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["direction", "method_id", "doc_type"] },
    { id: "payment-flow-running", label_key: "cls_trs_payment_flow_running", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["method_id", "direction", "doc_type"] },
  ],
  treasury: [
    { id: "cash-flow", label_key: "cls_trs_cash_flow", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [] },
    { id: "balances", label_key: "cls_trs_balances", availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: [] },
    { id: "reconciliation", label_key: "cls_trs_reconciliation", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [] },
    { id: "daily-sessions", label_key: "cls_trs_daily_sessions", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [] },
    { id: "withdrawals", label_key: "cls_trs_withdrawals", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [] },
  ],
  cheques: [
    { id: "cheque-listing", label_key: "cls_cheque_listing", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["bank_account_id", "cheque_status"] },
    { id: "bank-transactions", label_key: "cls_bank_transactions", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["bank_account_id", "date_range"] },
    { id: "bank-summary", label_key: "cls_bank_summary", availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["bank_account_id"] },
  ],
  "profit-loader": [
    { id: "by-item", label_key: "cls_profit_by_item", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id"] },
    { id: "by-category", label_key: "cls_profit_by_category", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id"] },
    { id: "health", label_key: "cls_profit_health", availableModes: ["summary"], supportsDates: false, hasProfit: true, supportsScope: false, dimensions: ["category_id"] },
    { id: "margin-drift", label_key: "cls_profit_margin_drift", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["category_id", "item_id"] },
  ],
  "net-profit": [
    { id: "income-statement", label_key: "cls_net_income", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [] },
    { id: "by-category", label_key: "cls_net_by_category", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id"] },
    { id: "by-customer", label_key: "cls_net_by_customer", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: [] },
    { id: "by-period", label_key: "cls_net_by_period", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: [] },
  ],
  expiry: [
    { id: "tracking", label_key: "cls_item_expiry", availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["warehouse_id", "item_id"] },
  ],
};

export const REPORT_DESCRIPTIONS = {
  // Sales
  "daily-summary": "ملخص شامل لأداء الوردية والعمليات اليومية وإجمالي المبيعات والربحية.",
  "cls_sales_daily": "ملخص شامل لأداء الوردية والعمليات اليومية وإجمالي المبيعات والربحية.",
  "detailed": "عرض تفصيلي لجميع فواتير المبيعات مع تفاصيل الأصناف وحالة السداد وطريقة الدفع.",
  "cls_sales_detailed": "عرض تفصيلي لجميع فواتير المبيعات مع تفاصيل الأصناف وحالة السداد وطريقة الدفع.",
  "by-item": "تحليل كميات وقيم المبيعات تجميعياً لكل صنف على حدة لمعرفة الأعلى مبيعاً.",
  "cls_sales_by_item": "تحليل كميات وقيم المبيعات تجميعياً لكل صنف على حدة لمعرفة الأعلى مبيعاً.",
  "by-category": "تقرير أداء ومبيعات الأقسام وفئات المنتجات المختلفة وتقييم المساهمة المالية.",
  "cls_sales_by_category": "تقرير أداء ومبيعات الأقسام وفئات المنتجات المختلفة وتقييم المساهمة المالية.",
  "by-cashier": "متابعة وتقييم مبيعات كل كاشير ومقارنة إجمالي تحصيلاتهم وأدائهم التشغيلي.",
  "cls_sales_by_cashier": "متابعة وتقييم مبيعات كل كاشير ومقارنة إجمالي تحصيلاتهم وأدائهم التشغيلي.",
  "by-payment": "توزيع حركة المبيعات حسب وسائل الدفع المختلفة (نقداً، بطاقة، آجل، تحويل بنكي).",
  "cls_sales_by_payment": "توزيع حركة المبيعات حسب وسائل الدفع المختلفة (نقداً، بطاقة، آجل، تحويل بنكي).",
  "heatmap": "خريطة حرارية تُظهر أوقات وأيام الذروة في المبيعات وتوزيع كثافة الإقبال على المحل.",
  "cls_sales_heatmap": "خريطة حرارية تُظهر أوقات وأيام الذروة في المبيعات وتوزيع كثافة الإقبال على المحل.",
  "period-compare": "مقارنة تحليلية لمعدلات النمو وحجم المبيعات بين فترتين زمنيتين مختلفين.",
  "cls_sales_period_compare": "مقارنة تحليلية لمعدلات النمو وحجم المبيعات بين فترتين زمنيتين مختلفين.",
  "discounts": "تتبع الخصومات الممنوحة على الفواتير وأثرها الإجمالي على صافي الإيرادات.",
  "cls_sales_discounts": "تتبع الخصومات الممنوحة على الفواتير وأثرها الإجمالي على صافي الإيرادات.",
  "cashier-override-impact": "رصد الخصومات والتجاوزات اليدوية للأسعار المنفذة بواسطة الكاشير وأثرها المالي.",
  "cls_sales_cashier_override_impact": "رصد الخصومات والتجاوزات اليدوية للأسعار المنفذة بواسطة الكاشير وأثرها المالي.",
  "margin": "تحليل هوامش الربح لكل صنف ونسبة الربحية مقارنة بتكلفة الشراء الفعلية.",
  "cls_sales_margin": "تحليل هوامش الربح لكل صنف ونسبة الربحية مقارنة بتكلفة الشراء الفعلية.",

  // Purchases
  "summary": "إحصائيات إجماليات أمر الشراء وفواتير توريد الموردين وسجل المدفوعات.",
  "cls_purchases_summary": "إحصائيات إجماليات أمر الشراء وفواتير توريد الموردين وسجل المدفوعات.",
  "cls_purchases_detailed": "سجل تفصيلي لجميع فواتير الشراء الواردة من الموردين وحالة تسويتها.",
  "by-supplier": "تحليل إجمالي وحجم المشتريات مقسمة حسب كل مورد على حدة.",
  "cls_purchases_by_supplier": "تحليل إجمالي وحجم المشتريات مقسمة حسب كل مورد على حدة.",
  "cls_purchases_by_item": "سجل كميات وتكاليف الأصناف المشتراة وتوزعها على الموردين.",
  "supplier-pricing": "مقارنة وتتبع أسعار توريد الأصناف بين الموردين للوصول لأفضل سعر شراء.",
  "cls_purchases_supplier_pricing": "مقارنة وتتبع أسعار توريد الأصناف بين الموردين للوصول لأفضل سعر شراء.",

  // Returns
  "cls_preturn_summary": "ملخص إجمالي مرتجعات المشتريات والمبالغ المستردة أو المخصومة من الموردين.",
  "cls_preturn_detailed": "سجل تفصيلي بالفواتير والمواد المرتجعة إلى الموردين مع تبيان أسباب الارتجاع.",
  "cls_preturn_by_supplier": "تقرير تجميعي لمرتجعات المشتريات متبوبة حسب كل مورد.",
  "cls_sreturn_summary": "ملخص إجمالي مرتجعات المبيعات والمبالغ المردودة للعملاء.",
  "cls_sreturn_detailed": "عرض تفصيلي لعمليات مرتجع المبيعات وأسباب الرد وطريقة استرداد المبلغ.",
  "cls_sreturn_by_customer": "تحليل مرتجعات المبيعات وتوزعها حسب كل عميل.",

  // Inventory & Warehouses
  "stock-levels": "متابعة الكميات الحالية المتاحة في المخازن وحدود التنبيه وإعادة الطلب.",
  "cls_item_stock_levels": "متابعة الكميات الحالية المتاحة في المخازن وحدود التنبيه وإعادة الطلب.",
  "valuation": "حساب القيمة المالية الإجمالية للمخزون القائم بناءً على طرائق التكلفة المعتمدة.",
  "cls_item_valuation": "حساب القيمة المالية الإجمالية للمخزون القائم بناءً على طرائق التكلفة المعتمدة.",
  "count-sheet": "ورقة جرد رسمية طباعية لمطابقة الرصيد الدفتري مع الجرد الفعلي للمخزن.",
  "cls_item_count_sheet": "ورقة جرد رسمية طباعية لمطابقة الرصيد الدفتري مع الجرد الفعلي للمخزن.",
  "reorder": "قائمة بالأصناف التي وصلت إلى حد إعادة الطلب أووشكت على النفاذ لتجهيز الشراء.",
  "cls_item_reorder": "قائمة بالأصناف التي وصلت إلى حد إعادة الطلب أووشكت على النفاذ لتجهيز الشراء.",
  "cls_item_expiry": "متابعة تواريخ انتهاء صلاحية الدفعات وتنبيهات المنتجات القريبة من الانتهاء.",
  "slow-moving": "تقرير الأصناف بطيئة الحركة والتي تستهلك مدة طويلة في التدوير.",
  "cls_item_slow_moving": "تقرير الأصناف بطيئة الحركة والتي تستهلك مدة طويلة في التدوير.",
  "cls_item_aging": "تحليل أعمار المخزون ومدد بقاء الأصناف في المخازن دون حركة.",
  "dead-stock": "حصر الأصناف الراكدة والميتة التي لم يتم عليها أي حركة مبيعات لفترة طويلة.",
  "cls_item_dead_stock": "حصر الأصناف الراكدة والميتة التي لم يتم عليها أي حركة مبيعات لفترة طويلة.",
  "movements": "تتبع حركات الصرف والإضافة والتحويلات الداخلية بين المخازن بالفترات.",
  "cls_wh_movements": "تتبع حركات الصرف والإضافة والتحويلات الداخلية بين المخازن بالفترات.",
  "transfers": "سجل عمليات التحويل البيني للمنتجات بين مختلف فروع ومخازن النشاط.",
  "cls_wh_transfers": "سجل عمليات التحويل البيني للمنتجات بين مختلف فروع ومخازن النشاط.",
  "per-warehouse": "توزيع وتفصيل أرصدة وقيم الأصناف المتاحة في كل مخزن على حدة.",
  "cls_wh_per_warehouse": "توزيع وتفصيل أرصدة وقيم الأصناف المتاحة في كل مخزن على حدة.",

  // Accounts (Suppliers & Customers)
  "balance-list": "قائمة بأرصدة الحسابات الإجمالية والمبالغ المستحقة له أو عليه.",
  "cls_supplier_balance_list": "قائمة كشوف أرصدة الموردين المستحقة وتصنيف المبالغ الدائنة.",
  "cls_customer_balance_list": "قائمة كشوف أرصدة العملاء والمبالغ المدينة المستحقة للتحصيل.",
  "statement": "كشف حساب تفصيلي وشامل لجميع الحركات المالية والفواتير والسدادات.",
  "cls_supplier_statement": "كشف حساب المورد التفصيلي وشامل لجميع الفواتير والمدفوعات والمرتجعات.",
  "cls_customer_statement": "كشف حساب العميل التفصيلي وشامل لجميع فواتير المبيعات والمقبوضات.",
  "aging": "تحليل أعمار الذمم والديون المتبقية وتصنيف تأخير السداد بحسب المدة.",
  "cls_supplier_aging": "تحليل أعمار ذمم الموردين ومواعيد استحقاق الفواتير الدائنة.",
  "cls_customer_aging": "تحليل أعمار ديون العملاء ومتابعة تحصيل الذمم المتأخرة.",
  "purchases": "سجل المشتريات الخاص بكل طرف وتاريخ التعاملات المالية معه.",
  "cls_supplier_purchases": "سجل وتاريخ فواتير المشتريات الواردة من المورد المحدد.",
  "returns": "سجل المرتجعات الخاص بالطرف وتفاصيل المبالغ المستردة.",
  "cls_supplier_returns": "سجل تفصيلي بمرتجعات المشتريات الخاصة بالمورد.",
  "reliability": "مؤشر موثوقية الموردين ومدى الالتزام بمواعيد التوريد وجودة الأسعار.",
  "cls_supplier_reliability": "مؤشر موثوقية الموردين ومدى الالتزام بمواعيد التوريد وجودة الأسعار.",
  "top-customers": "تصنيف أفضل العملاء وأكثرهم شراءً ومساهمة في أرباح النشاط.",
  "cls_top_customers": "تصنيف أفضل العملاء وأكثرهم شراءً ومساهمة في أرباح النشاط.",
  "collection-efficiency": "مؤشر كفاءة التحصيل وسرعة تحويل المبيعات الآجلة إلى نقدية.",
  "cls_collection_efficiency": "مؤشر كفاءة التحصيل وسرعة تحويل المبيعات الآجلة إلى نقدية.",
  "loyalty": "تقرير نقاط الولاء والمكافآت المستحقة للعملاء وسجل استبدال النقاط.",
  "cls_customer_loyalty": "تقرير نقاط الولاء والمكافآت المستحقة للعملاء وسجل استبدال النقاط.",

  // Treasury & Payment Flow
  "cash-flow": "متابعة التدفقات النقدية الواردة والصادرة وحركة المقبوضات والمدفوعات.",
  "cls_trs_cash_flow": "متابعة التدفقات النقدية الواردة والصادرة وحركة المقبوضات والمدفوعات.",
  "balances": "عرض الأرصدة الحالية الحية في جميع الخزائن والحسابات البنكية.",
  "cls_trs_balances": "عرض الأرصدة الحالية الحية في جميع الخزائن والحسابات البنكية.",
  "reconciliation": "تسوية ومطابقة النقدية بين المقبوضات الفعلية والمسجلة بالأنظمة.",
  "cls_trs_reconciliation": "تسوية ومطابقة النقدية بين المقبوضات الفعلية والمسجلة بالأنظمة.",
  "daily-sessions": "سجل جلسات الخزينة اليومية وإغلاقات ورديات الكاشير والتسليمات.",
  "cls_trs_daily_sessions": "سجل جلسات الخزينة اليومية وإغلاقات ورديات الكاشير والتسليمات.",
  "withdrawals": "تقرير المسحوبات النقدية والشخصية المسجلة من الخزينة.",
  "cls_trs_withdrawals": "تقرير المسحوبات النقدية والشخصية المسجلة من الخزينة.",
  "payment-flow-summary": "ملخص حركة ونشاط وسائل الدفع المالي بمختلف أنواعها.",
  "cls_trs_payment_flow_summary": "ملخص حركة ونشاط وسائل الدفع المالي بمختلف أنواعها.",
  "payment-flow-ledger": "سجل قيود التدفقات المالية التفصيلي لجميع المقبوضات والمدفوعات.",
  "cls_trs_payment_flow_ledger": "سجل قيود التدفقات المالية التفصيلي لجميع المقبوضات والمدفوعات.",
  "payment-flow-by-doc-type": "تحليل التدفقات المالية وتوزيعها حسب نوع المستند المالي.",
  "cls_trs_payment_flow_by_doc_type": "تحليل التدفقات المالية وتوزيعها حسب نوع المستند المالي.",
  "payment-flow-by-direction": "مقارنة إجمالي التدفقات المالية الداخلة والخارجة في النظام.",
  "cls_trs_payment_flow_by_direction": "مقارنة إجمالي التدفقات المالية الداخلة والخارجة في النظام.",
  "payment-flow-running": "الرصيد التراكمي المستمر للتدفقات النقدية حركة بحركة.",
  "cls_trs_payment_flow_running": "الرصيد التراكمي المستمر للتدفقات النقدية حركة بحركة.",

  // Cheques & Banks
  "cheque-listing": "كشف بجميع الشيكات المسجلة في النظام وتفاصيلها وحالتها.",
  "cls_cheque_listing": "كشف بجميع الشيكات المسجلة في النظام وتفاصيلها وحالتها.",
  "bank-transactions": "سجل جميع الحركات والمعاملات البنكية على الحسابات.",
  "cls_bank_transactions": "سجل جميع الحركات والمعاملات البنكية على الحسابات.",
  "bank-summary": "ملخص أرصدة الحسابات البنكية وإجمالي الإيداعات والسحوبات.",
  "cls_bank_summary": "ملخص أرصدة الحسابات البنكية وإجمالي الإيداعات والسحوبات.",

  // Expenses & Revenues
  "cls_exp_summary": "ملخص إجمالي المصروفات التشغيلية والعمومية وتوزعها الإجمالي.",
  "cls_exp_detailed": "سجل تفصيلي لجميع سندات صرف المصروفات وبيانات المستفيدين.",
  "cls_exp_by_category": "تحليل المصروفات وتوزيعها حسب بند ومجال الصرف الرئيسي.",
  "cls_exp_by_payment": "توزيع المصروفات حسب وسيلة الخصم والدفع المستعملة.",
  "cls_rev_summary": "ملخص إجمالي الإيرادات الإضافية والأنشطة غير الفرعية.",
  "cls_rev_detailed": "سجل تفصيلي لسندات قبض الإيرادات الأخرى ومصادرها.",
  "cls_rev_by_category": "تحليل الإيرادات الأخرى مقسمة حسب الفئات والتصنيفات.",
  "cls_rev_by_payment": "توزيع الإيرادات المستلمة حسب طريقة ونوع التحصيل.",

  // Profitability & Taxes
  "income-statement": "قائمة الدخل الشاملة لحساب صافي الأرباح بعد طرح التكاليف والمصروفات.",
  "cls_net_income": "قائمة الدخل الشاملة لحساب صافي الأرباح بعد طرح التكاليف والمصروفات.",
  "cls_net_by_category": "تحليل صافي الربح المحقق مقسماً حسب أقسام وفئات المنتجات.",
  "cls_net_by_customer": "تحليل صافي الربحية المحققة من التعامل مع كل عميل.",
  "cls_net_by_period": "متابعة تطور صافي الربح عبر الفترات الزمنية والأشهر.",
  "cls_profit_by_item": "تحليل مجمل الربح ونسبة هامش الربحية لكل منتج وصنف.",
  "cls_profit_by_category": "تحليل مجمل الربحية المحققة على مستوى فئات المنتجات.",
  "cls_profit_health": "مؤشرات صحة الأرباح واستدامة الهوامش الربحية للنشاط التجاري.",
  "tax": "بيان ضريبة القيمة المضافة ومستحقات الضريبة التفصيلية على العمليات.",
  "cls_sales_tax": "بيان ضريبة القيمة المضافة ومستحقات الضريبة التفصيلية على المبيعات.",
  "vat": "تقرير إقرار ضريبة القيمة المضافة ومطابقة ضريبة المبيعات والمشتريات.",

  // Employees & Installments & Users
  "cls_emp_list": "قائمة الموظفين وبيانات الوظائف والرواتب الأساسية ومواعيد الصرف.",
  "cls_emp_deductions": "سجل الخصومات والتأخيرات والغرامات المطبقة على الموظفين.",
  "cls_emp_bonuses": "سجل المكافآت والحوافز والبدلات المضافة لحساب الموظفين.",
  "cls_emp_advances": "متابعة السلف المالية الممنوحة للموظفين وأرصدة الأقساط المتبقية.",
  "cls_emp_payroll": "كشوف مسير الرواتب المستحقة للصرف بعد إدراج الاستقطاعات والإضافات.",
  "cls_emp_full_history": "السجل المالي والسلوكي الكامل والتاريخ المالي الشامل للموظف.",
  "cls_emp_adjustments": "سجل تسويات وحوافز الموظفين وتعديلات الراتب والإضافات والاستقطاعات.",
  "cls_inst_plans": "بيان خطط وعقود التقسيط النشطة ومتابعة حالات السداد.",
  "cls_inst_collections": "سجل أقساط التقسيط المحصلة وتواريخ تحصيلها من العملاء.",
  "cls_inst_by_customer": "عرض عقود وأقساط التمويل والتقسيط مقسمة حسب كل عميل.",
  "cls_inst_delinquent": "قائمة الأقساط المتأخرة عن مواعيد استحقاقها لمتابعة التحصيل.",
  "user-list": "قائمة مستخدمي النظام وصلاحيات دخولهم وحالة حساباتهم.",
  "cls_users_list": "قائمة مستخدمي النظام وصلاحيات دخولهم وحالة حساباتهم.",
  "performance": "تقرير متابعة نشاط وأداء المستخدمين وحجم العمليات المنفذة.",
  "cls_users_performance": "تقرير متابعة نشاط وأداء المستخدمين وحجم العمليات المنفذة.",
  "login-history": "سجل عمليات دخول وخروج المستخدمين وسجلات الأمن والحماية.",
  "cls_users_login_history": "سجل عمليات دخول وخروج المستخدمين وسجلات الأمن والحماية.",
  "worksheet": "لوحة ومذكرة القوائم المالية ونظرة شاملة لمالك النشاط التجاري.",
  "cls_owner_statement": "لوحة ومذكرة القوائم المالية ونظرة شاملة لمالك النشاط التجاري."
};

export function getReportDescription(sourceKey, classificationId) {
  if (!classificationId) return "تقرير تحليلي يستعرض بيانات ومؤشرات العمليات التشغيلية والمالية في النظام.";
  return REPORT_DESCRIPTIONS[classificationId] || REPORT_DESCRIPTIONS[`cls_${classificationId}`] || "تقرير تحليلي تفصيلي لمتابعة وتقييم مؤشرات أداء النشاط التجاري.";
}

export const VALUE_TRANSLATIONS = {
  // Statuses
  paid: "مدفوع",
  unpaid: "غير مدفوع",
  partially_paid: "مدفوع جزئياً",
  cancelled: "ملغي",
  active: "نشط",
  completed: "مطبق",
  pending: "قيد السداد",
  cleared: "محصّل",
  bounced: "مرتجع",
  replaced: "مستبدل",
  draft: "مسودة",
  in_stock: "متاح",
  low_stock: "منخفض",
  out_of_stock: "نفذ",
  expired: "منتهي",
  near_expiry: "ينتهي قريباً",
  valid: "ساري",
  normal: "عادي",
  overdue: "متأخر",

  // Payment methods
  cash: "نقداً",
  credit: "آجل",
  card: "بطاقة",
  bank_transfer: "تحويل بنكي",
  wallet: "محفظة",
  multi: "متعدد",
  cheque: "شيك",
  visa: "فيزا",
  mastercard: "ماستركارد",

  // Directions & Movement types
  in: "وارد",
  out: "صادر",
  transfer: "تحويل",
  branch_receive: "استلام فرع",
  branch_send: "إرسال فرع",
  adjustment: "تسوية",
  opening_balance: "رصيد افتتاحي",

  // Doc types & Transaction types
  invoice: "فاتورة",
  pos_invoice: "فاتورة بيع",
  payment: "دفع",
  payment_allocation: "تسوية فاتورة",
  customer_payment: "تحصيل عميل",
  supplier_payment: "سداد مورد",
  ajal_payment: "حركة آجل",
  expense: "مصروف",
  revenue: "إيراد",
  purchase: "مشتريات",
  purchase_payment: "دفعة مشتريات",
  sales_return: "مرتجع مبيعات",
  purchase_return: "مرتجع مشتريات",
  withdrawal: "مسحوبات",
  deduction: "خصم",
  bonus: "مكافأة",
  advance: "سلفة",
  advance_payment: "دفعة سلفة",
  settlement: "صرف راتب",
  item: "صنف",

  // Parties & Roles
  customer: "عميل",
  supplier: "مورد",
  employee: "موظف",
  general: "عام",
  admin: "مدير النظام",
  manager: "مدير",
  cashier: "كاشير",
  accountant: "محاسب",

  // Deduction / Bonus types
  absence: "غياب",
  fine: "غرامة",
  insurance: "تأمين",
  performance: "أداء",
  holiday: "إجازة",
  overtime: "إضافي",
  transportation: "مواصلات",
  other: "أخرى",

  // Tax types
  exclusive: "خارج السعر",
  inclusive: "داخل السعر",
};

export function formatReportCellValue(key, rawValue) {
  if (rawValue == null || rawValue === "") return "—";
  const str = String(rawValue).trim();
  if (VALUE_TRANSLATIONS[str]) return VALUE_TRANSLATIONS[str];
  if (VALUE_TRANSLATIONS[str.toLowerCase()]) return VALUE_TRANSLATIONS[str.toLowerCase()];
  return rawValue;
}

