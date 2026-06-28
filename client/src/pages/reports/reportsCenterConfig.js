import { TrendingUp, Package, Wallet, Receipt, FileText, Shield, ClipboardList, FileImage, FileSpreadsheet, Printer, Layers, RotateCcw, Truck, Users, UserCheck, CalendarCheck, Percent, LineChart, Search, ClipboardCheck, Clock, Landmark, BadgePercent } from "lucide-react";

export const CATEGORIES = [
  { id: "sales",         label: "المبيعات",         icon: TrendingUp,  color: "var(--success-DEFAULT,#10b981)" },
  { id: "purchases",     label: "المشتريات",        icon: Package,     color: "var(--info-DEFAULT,#3b82f6)" },
  { id: "inventory",     label: "المخزون",          icon: Layers,      color: "var(--primary-DEFAULT,#8b5cf6)" },
  { id: "accounts",      label: "الحسابات",         icon: Wallet,      color: "var(--warning-DEFAULT,#f59e0b)" },
  { id: "treasury",      label: "الخزينة والبنوك",  icon: Landmark,    color: "#06b6d4" },
  { id: "tax",           label: "الضرائب",          icon: FileText,    color: "var(--error-DEFAULT,#ef4444)" },
  { id: "profitability", label: "الأرباح",          icon: BadgePercent, color: "#d946ef" },
  { id: "audit",         label: "الأفراد والرقابة", icon: Shield,      color: "var(--text-secondary,#94a3b8)" },
  { id: "users",         label: "المستخدمين",       icon: Users,       color: "#6366f1" },
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
  cheques:         [{ type:"all",label:"الكل"}],
  suppliers:       [{ type:"all",label:"الكل"}],
  customers:       [{ type:"all",label:"الكل"}],
  employees:       [{ type:"all",label:"الكل"}],
  users:           [{ type:"all",label:"الكل"}],
  installments:    [{ type:"all",label:"الكل"}],
  expenses:        [{ type:"all",label:"الكل"}],
  revenues:        [{ type:"all",label:"الكل"}],
  treasury:        [{ type:"all",label:"الكل"}],
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
  tax: [
    {k:"tax_rate",l:"النسبة",t:"num"},{k:"taxable_sales",l:"المبيعات الخاضعة",t:"cur"},
    {k:"vat_amount",l:"قيمة الضريبة",t:"cur"},{k:"invoice_count",l:"عدد الفواتير",t:"num"},
  ],
  profitability: [
    {k:"label",l:"البيان",t:"text"},{k:"amount",l:"المبلغ",t:"cur"},
    {k:"pct",l:"%",t:"percent"},
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
  "owner-statement": [
    {metric:"قيمة المخزون",value:"٤٤٬٦٥٠",period:"الشهر الحالي",cost_method:"WAC",status:"قابل للحفظ"},
    {metric:"النقدية",value:"٣٧٬٤٠٠",period:"الشهر الحالي",cost_method:"غير مؤثر",status:"حي"},
    {metric:"صافي الربح",value:"١٢٬٣٠٠",period:"الشهر الحالي",cost_method:"FIFO",status:"مسودة"},
  ],
  treasury: [
    {date:"٠١/٠٥",type:"تحصيل فاتورة",total:"٥٬٢٠٠",tx_count:"١",name:"الخزينة الرئيسية",balance:"٣٧٬٤٠٠"},
    {date:"٠٣/٠٥",type:"دفع مورد",total:"-١٢٬٠٠٠",tx_count:"٣",name:"الخزينة الرئيسية",balance:"٢٥٬٤٠٠"},
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
  suppliers:  [{k:"supplier_name",l:"المورد",t:"text"},{k:"total_due",l:"المستحق",t:"cur"},{k:"purchase_count",l:"عدد المشتريات",t:"num"},{k:"return_rate_percent",l:"% المرتجعات",t:"percent"},{k:"last_purchase_date",l:"آخر شراء",t:"date"}],
  customers:  [{k:"customer_name",l:"العميل",t:"text"},{k:"total_sales",l:"إجمالي المبيعات",t:"cur"},{k:"invoice_count",l:"عدد الفواتير",t:"num"},{k:"collection_rate",l:"% التحصيل",t:"percent"},{k:"last_invoice_date",l:"آخر فاتورة",t:"date"}],
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
    {supplier_name:"مورد النور",total_due:"٢٥٬٠٠٠",purchase_count:"١٢",return_rate_percent:"٣٫٢٪",last_purchase_date:"٠٢/٠٥"},
    {supplier_name:"تك سبلاي",total_due:"٨٬٥٠٠",purchase_count:"٥",return_rate_percent:"١٫١٪",last_purchase_date:"٢٨/٠٤"},
  ],
  customers: [
    {customer_name:"أحمد البرقوقي",total_sales:"٤٥٬٠٠٠",invoice_count:"١٢",collection_rate:"٧٥٪",last_invoice_date:"١٠/٠٤"},
    {customer_name:"شركة النور للتجارة",total_sales:"٣٢٬٥٠٠",invoice_count:"٨",collection_rate:"٨٢٪",last_invoice_date:"٢٥/٠٣"},
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
  expiry: [
    {item_code:"SKU-001",item_name:"حليب مجفف",batch_no:"B-2401",quantity:"٤٥",expiry_date:"٢٠٢٦/٠٧/١٥",days_until_expiry:"٣٤",expiry_status:"ساري"},
    {item_code:"SKU-042",item_name:"جبنة شيدر",batch_no:"B-2389",quantity:"١٢",expiry_date:"٢٠٢٦/٠٥/٠١",days_until_expiry:"-١١",expiry_status:"منتهي"},
    {item_code:"SKU-107",item_name:"عصير طازج",batch_no:"B-2408",quantity:"٨٠",expiry_date:"٢٠٢٦/٠٦/٢٠",days_until_expiry:"٩",expiry_status:"ينتهي قريباً"},
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
  ],
  treasury: [],
  installments: [],
  users: [
    { key: "user_id", type: "lookup", entity: "user", label: "المستخدم" },
    { key: "role", type: "select", label: "الصلاحية", options: [{ value: "admin", label: "مدير" }, { value: "cashier", label: "كاشير" }, { value: "manager", label: "مشرف" }] },
  ],
};

export function fmtDate(d) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }

export const CLASSIFICATIONS = {
  tax: [
    { id: "vat", label_key: "r23_title", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["customer_id", "status", "payment_type"] },
    { id: "output-vat", label_key: "r48_title", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["customer_id"] },
    { id: "input-vat", label_key: "r49_title", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id"] },
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
    { id: "detailed", label_key: "cls_sales_detailed", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id", "status", "payment_type"] },
    { id: "by-item", label_key: "cls_sales_by_item", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id", "status", "payment_type"] },
    { id: "by-category", label_key: "cls_sales_by_category", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "customer_id", "cashier_id", "status", "payment_type"] },
    { id: "by-cashier", label_key: "cls_sales_by_cashier", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["cashier_id", "customer_id", "payment_type", "status"] },
    { id: "by-payment", label_key: "cls_sales_by_payment", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["payment_type", "customer_id", "cashier_id", "status"] },
    { id: "heatmap", label_key: "cls_sales_heatmap", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "customer_id", "payment_type"] },
    { id: "period-compare", label_key: "cls_sales_period_compare", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id", "status", "payment_type"] },
    { id: "discounts", label_key: "cls_sales_discounts", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id", "payment_type", "status"] },
    { id: "margin", label_key: "cls_sales_margin", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id"] },
    { id: "tax", label_key: "cls_sales_tax", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["customer_id", "status", "payment_type"] },
  ],
  purchases: [
    { id: "summary", label_key: "cls_purchases_summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "payment_type", "status"] },
    { id: "detailed", label_key: "cls_purchases_detailed", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "category_id", "item_id", "status", "payment_type"] },
    { id: "by-supplier", label_key: "cls_purchases_by_supplier", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "category_id", "item_id", "status", "payment_type"] },
    { id: "by-item", label_key: "cls_purchases_by_item", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "category_id", "item_id", "status", "payment_type"] },
    { id: "supplier-pricing", label_key: "cls_purchases_supplier_pricing", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "category_id", "item_id"] },
  ],
  cheques: [
    { id: "cheques", label_key: "cls_cheques_listing", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["status"] },
    { id: "bank-transactions", label_key: "cls_bank_transactions", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [] },
    { id: "bank-summary", label_key: "cls_bank_summary", availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: [] },
  ],
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
    { id: "cashier-performance", label_key: "cls_emp_cashier_perf", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["cashier_id", "action"] },
    { id: "shifts", label_key: "cls_emp_shifts", availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["cashier_id"] },
    { id: "user-activity", label_key: "cls_emp_user_activity", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["user_id", "action"] },
    { id: "incentives", label_key: "cls_emp_incentives", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [] },
  ],
  installments: [
    { id: "plans", label_key: "cls_inst_plans", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
    { id: "collections", label_key: "cls_inst_collections", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
    { id: "by-customer", label_key: "cls_inst_by_customer", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"] },
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
  treasury: [
    { id: "cash-flow", label_key: "cls_trs_cash_flow", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [] },
    { id: "balances", label_key: "cls_trs_balances", availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: [] },
    { id: "reconciliation", label_key: "cls_trs_reconciliation", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [] },
    { id: "daily-sessions", label_key: "cls_trs_daily_sessions", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [] },
    { id: "withdrawals", label_key: "cls_trs_withdrawals", availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [] },
  ],
  "profit-loader": [
    { id: "by-item", label_key: "cls_profit_by_item", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id"] },
    { id: "by-category", label_key: "cls_profit_by_category", availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "customer_id"] },
    { id: "health", label_key: "cls_profit_health", availableModes: ["summary"], supportsDates: false, hasProfit: true, supportsScope: false, dimensions: ["category_id"] },
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
