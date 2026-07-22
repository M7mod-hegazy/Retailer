const PAYMENT_FLOW_FILTERS = {
  method: { key: "method_id", type: "lookup", label_key: "payment_method", label: "وسيلة الدفع", entity: "payment_method" },
  direction: { key: "direction", type: "select", label_key: "direction", label: "الاتجاه", options: [{ value: "in", label: "داخل" }, { value: "out", label: "خارج" }] },
  docType: { key: "doc_type", type: "select", label_key: "doc_type", label: "نوع المستند", options: [
    { value: "pos_invoice", label: "فاتورة بيع" },
    { value: "payment_allocation", label: "تسوية فاتورة" },
    { value: "customer_payment", label: "تحصيل عميل" },
    { value: "supplier_payment", label: "سداد مورد" },
    { value: "ajal_payment", label: "حركة آجل" },
    { value: "expense", label: "مصروف" },
    { value: "revenue", label: "إيراد" },
    { value: "purchase", label: "مشتريات" },
    { value: "purchase_payment", label: "دفعة مشتريات" },
    { value: "sales_return", label: "مرتجع مبيعات" },
    { value: "purchase_return", label: "مرتجع مشتريات" },
    { value: "withdrawal", label: "مسحوبات" },
  ] },
  partyType: { key: "party_type", type: "select", label_key: "party_type", label: "نوع الطرف", options: [{ value: "customer", label: "عميل" }, { value: "supplier", label: "مورد" }, { value: "general", label: "عام" }] },
  min: { key: "amount_min", type: "text", label_key: "amount_min", label: "أقل مبلغ" },
  max: { key: "amount_max", type: "text", label_key: "amount_max", label: "أكبر مبلغ" },
};
const REPORT_REGISTRY = {
  categories: [
    { id: "sales", label_key: "category_sales", label: "المبيعات" },
    { id: "purchases", label_key: "category_purchases", label: "المشتريات" },
    { id: "inventory", label_key: "category_inventory", label: "المخزون" },
    { id: "accounts", label_key: "category_accounts", label: "الحسابات" },
    { id: "treasury", label_key: "category_treasury", label: "الخزينة والبنوك" },
    { id: "tax", label_key: "category_tax", label: "الضرائب" },
    { id: "profitability", label_key: "category_profitability", label: "الأرباح" },
    { id: "individuals", label_key: "category_individuals", label: "الأفراد والرقابة" },
  ],

  sources: [
    { id: "sales", label_key: "source_sales", label: "المبيعات", cat: "sales", icon: "TrendingUp" },
    { id: "purchases", label_key: "source_purchases", label: "المشتريات", cat: "purchases", icon: "Package" },
    { id: "purchase-returns", label_key: "source_purchase_returns", label: "مرتجعات المشتريات", cat: "purchases", icon: "RotateCcw" },
    { id: "sales-returns", label_key: "source_sales_returns", label: "مرتجعات المبيعات", cat: "sales", icon: "RotateCcw" },
    { id: "suppliers", label_key: "source_suppliers", label: "الموردين", cat: "accounts", icon: "Truck" },
    { id: "customers", label_key: "source_customers", label: "العملاء", cat: "accounts", icon: "Users" },
    { id: "employees", label_key: "source_employees", label: "الموظفين", cat: "individuals", icon: "UserCheck" },
    { id: "installments", label_key: "source_installments", label: "أنظمة التقسيط", cat: "accounts", icon: "CalendarCheck" },
    { id: "items", label_key: "source_items", label: "الأصناف", cat: "inventory", icon: "Package" },
    { id: "warehouses", label_key: "source_warehouses", label: "المخازن", cat: "inventory", icon: "Layers" },
    { id: "expenses", label_key: "source_expenses", label: "المصروفات", cat: "treasury", icon: "Receipt" },
    { id: "revenues", label_key: "source_revenues", label: "الإيرادات الأخرى", cat: "treasury", icon: "TrendingUp" },
    { id: "treasury", label_key: "source_treasury", label: "الخزينة", cat: "treasury", icon: "Wallet" },
    { id: "payment-flow", label_key: "source_payment_flow", label: "سجل التدفقات المالية", cat: "treasury", icon: "Wallet" },
    { id: "profit", label_key: "source_profit", label: "الأرباح", cat: "profitability", icon: "LineChart" },
    { id: "expiry", label_key: "source_expiry", label: "انتهاء الصلاحية", cat: "inventory", icon: "Clock" },
    { id: "owner-statement", label_key: "source_owner_statement", label: "لوحة صاحب المحل", cat: "accounts", icon: "ClipboardCheck" },
    { id: "tax", label_key: "source_tax", label: "الضرائب", cat: "tax", icon: "FileText" },
    { id: "users", label_key: "source_users", label: "المستخدمين", cat: "individuals", icon: "Users" },
    { id: "physical-count", label_key: "source_physical_count", label: "سجل الجرد", cat: "inventory", icon: "ClipboardCheck" },
  ],

  // ── Filter Dimensions Pool (shared per source) ────────────────
  filterDimensions: {
    sales: [
      { key: "category_id", type: "lookup", entity: "category", label_key: "category", label: "فئة المنتجات" },
      { key: "item_id", type: "lookup", entity: "product", label_key: "product", label: "المنتج" },
      { key: "customer_id", type: "lookup", entity: "customer", label_key: "customer", label: "العميل" },
      { key: "cashier_id", type: "lookup", entity: "user", label_key: "cashier", label: "الكاشير" },
      { key: "status", type: "select", label_key: "status", label: "الحالة", options: [{ value: "paid", label_key: "paid", label: "مدفوع" }, { value: "unpaid", label_key: "unpaid", label: "غير مدفوع" }, { value: "partial", label_key: "partial", label: "مدفوع جزئياً" }, { value: "returned", label_key: "returned", label: "مرتجع بالكامل" }, { value: "partially_returned", label_key: "partially_returned", label: "مرتجع جزئي" }, { value: "cancelled", label_key: "cancelled", label: "ملغي" }] },
      { key: "payment_type", type: "select", label_key: "payment_type", label: "طريقة الدفع", dynamic: true, options: [{ value: "cash", label: "نقداً" }, { value: "credit", label: "آجل" }, { value: "card", label: "بطاقة" }, { value: "bank_transfer", label: "تحويل بنكي" }, { value: "multi", label: "متعدد" }] },
      { key: "tax_type", type: "select", label_key: "tax_type", label: "نوع الضريبة", options: [{ value: "exclusive", label_key: "exclusive", label: "خارج السعر" }, { value: "inclusive", label_key: "inclusive", label: "داخل السعر" }] },
    ],
    purchases: [
      { key: "supplier_id", type: "lookup", entity: "supplier", label_key: "supplier", label: "المورد" },
      { key: "category_id", type: "lookup", entity: "category", label_key: "category", label: "فئة المنتجات" },
      { key: "item_id", type: "lookup", entity: "product", label_key: "product", label: "المنتج" },
      { key: "status", type: "select", label_key: "status", label: "الحالة", options: [{ value: "active", label_key: "active", label: "نشط" }, { value: "cancelled", label_key: "cancelled", label: "ملغي" }, { value: "voided", label_key: "voided", label: "ملغى" }] },
      { key: "payment_type", type: "select", label_key: "payment_type", label: "طريقة الدفع", dynamic: true, options: [{ value: "cash", label: "نقداً" }, { value: "credit", label: "آجل" }, { value: "card", label: "بطاقة" }, { value: "bank_transfer", label: "تحويل بنكي" }, { value: "multi", label: "متعدد" }] },
    ],
    "purchase-returns": [
      { key: "supplier_id", type: "lookup", entity: "supplier", label_key: "supplier", label: "المورد" },
    ],
    "sales-returns": [
      { key: "customer_id", type: "lookup", entity: "customer", label_key: "customer", label: "العميل" },
    ],
    suppliers: [
      { key: "supplier_id", type: "lookup", entity: "supplier", label_key: "supplier", label: "المورد" },
      { key: "category_id", type: "lookup", entity: "category", label_key: "category", label: "فئة المنتجات" },
      { key: "item_id", type: "lookup", entity: "product", label_key: "product", label: "المنتج" },
      { key: "status", type: "select", label_key: "status", label: "الحالة", options: [{ value: "active", label_key: "active", label: "نشط" }, { value: "cancelled", label_key: "cancelled", label: "ملغي" }, { value: "voided", label_key: "voided", label: "ملغى" }] },
      { key: "payment_type", type: "select", label_key: "payment_type", label: "طريقة الدفع", dynamic: true, options: [] },
    ],
    customers: [
      { key: "customer_id", type: "lookup", entity: "customer", label_key: "customer", label: "العميل" },
    ],
    employees: [
      { key: "employee_id", type: "lookup", entity: "employee", label_key: "employee", label: "الموظف" },
      { key: "deduction_type", type: "select", label_key: "deduction_type", label: "نوع الخصم", options: [
        { value: "absence", label: "غياب" }, { value: "fine", label: "غرامة" },
        { value: "insurance", label: "تأمين" }, { value: "other", label: "أخرى" },
      ] },
      { key: "bonus_type", type: "select", label_key: "bonus_type", label: "نوع المكافأة", options: [
        { value: "performance", label: "أداء" }, { value: "holiday", label: "إجازة" },
        { value: "overtime", label: "إضافي" }, { value: "transportation", label: "مواصلات" },
        { value: "other", label: "أخرى" },
      ] },
      { key: "status", type: "select", label_key: "status", label: "الحالة", options: [
        { value: "active", label: "نشط" }, { value: "completed", label: "مكتمل" },
        { value: "cancelled", label: "ملغي" },
      ] },
      { key: "tx_type", type: "select", label_key: "tx_type", label: "نوع الحركة", options: [
        { value: "deduction", label: "خصم" }, { value: "bonus", label: "مكافأة" },
        { value: "advance", label: "سلفة" }, { value: "advance_payment", label: "دفعة سلفة" },
        { value: "settlement", label: "صرف راتب" },
      ] },
    ],
    items: [
      { key: "category_id", type: "lookup", entity: "category", label_key: "category", label: "فئة المنتجات" },
      { key: "item_id", type: "lookup", entity: "product", label_key: "product", label: "المنتج" },
      { key: "warehouse_id", type: "lookup", entity: "warehouse", label_key: "warehouse", label: "المخزن" },
      { key: "movement_type", type: "select", label_key: "movement_type", label: "نوع الحركة", options: [{ value: "purchase", label: "شراء" }, { value: "branch_receive", label: "استلام فرع" }, { value: "opening_balance", label: "رصيد افتتاحي" }] },
    ],
    warehouses: [
      { key: "movement_type", type: "select", label_key: "movement_type", label: "نوع الحركة", options: [{ value: "in", label_key: "in", label: "وارد" }, { value: "out", label_key: "out", label: "صادر" }, { value: "transfer", label_key: "transfer", label: "تحويل" }] },
      { key: "category_id", type: "lookup", entity: "category", label_key: "category", label: "فئة المنتجات" },
      { key: "item_id", type: "lookup", entity: "product", label_key: "product", label: "المنتج" },
      { key: "warehouse_id", type: "lookup", entity: "warehouse", label_key: "warehouse", label: "المخزن" },
      { key: "user_id", type: "lookup", entity: "user", label_key: "user", label: "المستخدم" },
    ],
    expenses: [
      { key: "category_id", type: "lookup", entity: "category", label_key: "category", label: "فئة المنتجات" },
      { key: "payment_type", type: "select", label_key: "payment_type", label: "طريقة الدفع", dynamic: true, options: [] },
    ],
    revenues: [
      { key: "category_id", type: "lookup", entity: "category", label_key: "category", label: "فئة المنتجات" },
      { key: "payment_type", type: "select", label_key: "payment_type", label: "طريقة الدفع", dynamic: true, options: [] },
    ],
    profit: [
      { key: "category_id", type: "lookup", entity: "category", label_key: "category", label: "فئة المنتجات" },
      { key: "item_id", type: "lookup", entity: "product", label_key: "product", label: "المنتج" },
      { key: "customer_id", type: "lookup", entity: "customer", label_key: "customer", label: "العميل" },
    ],
    treasury: [PAYMENT_FLOW_FILTERS.method, PAYMENT_FLOW_FILTERS.direction, PAYMENT_FLOW_FILTERS.docType, PAYMENT_FLOW_FILTERS.partyType, PAYMENT_FLOW_FILTERS.min, PAYMENT_FLOW_FILTERS.max],
    "payment-flow": [PAYMENT_FLOW_FILTERS.method, PAYMENT_FLOW_FILTERS.direction, PAYMENT_FLOW_FILTERS.docType, PAYMENT_FLOW_FILTERS.partyType, PAYMENT_FLOW_FILTERS.min, PAYMENT_FLOW_FILTERS.max],
    expiry: [
      { key: "item_id", type: "lookup", entity: "product", label_key: "product", label: "المنتج" },
      { key: "warehouse_id", type: "lookup", entity: "warehouse", label_key: "warehouse", label: "المخزن" },
      { key: "category_id", type: "lookup", entity: "category", label_key: "category", label: "فئة المنتجات" },
    ],
    tax: [
      { key: "customer_id", type: "lookup", entity: "customer", label_key: "customer", label: "العميل" },
      { key: "supplier_id", type: "lookup", entity: "supplier", label_key: "supplier", label: "المورد" },
      { key: "status", type: "select", label_key: "status", label: "الحالة", options: [{ value: "paid", label_key: "paid", label: "مدفوع" }, { value: "unpaid", label_key: "unpaid", label: "غير مدفوع" }, { value: "partial", label_key: "partial", label: "مدفوع جزئياً" }, { value: "returned", label_key: "returned", label: "مرتجع بالكامل" }, { value: "partially_returned", label_key: "partially_returned", label: "مرتجع جزئي" }, { value: "cancelled", label_key: "cancelled", label: "ملغي" }] },
      { key: "payment_type", type: "select", label_key: "payment_type", label: "طريقة الدفع", dynamic: true, options: [{ value: "cash", label: "نقداً" }, { value: "credit", label: "آجل" }, { value: "card", label: "بطاقة" }, { value: "bank_transfer", label: "تحويل بنكي" }, { value: "multi", label: "متعدد" }] },
      { key: "tax_type", type: "select", label_key: "tax_type", label: "نوع الضريبة", options: [{ value: "exclusive", label: "خارج السعر" }, { value: "inclusive", label: "داخل السعر" }] },
    ],
    installments: [
      { key: "customer_id", type: "lookup", entity: "customer", label_key: "customer", label: "العميل" },
      { key: "status", type: "select", label_key: "status", label: "الحالة", options: [{ value: "pending", label: "قيد السداد" }, { value: "open", label_key: "open", label: "مفتوح" }, { value: "paid", label_key: "paid", label: "مدفوع" }, { value: "overdue", label_key: "overdue", label: "متأخر" }, { value: "cancelled", label_key: "cancelled", label: "ملغي" }] },
    ],
    users: [
      { key: "user_id", type: "lookup", entity: "user", label_key: "user", label: "المستخدم" },
      { key: "role", type: "select", label_key: "role", label: "الصلاحية", options: [{ value: "admin", label_key: "admin", label: "مدير النظام" }, { value: "cashier", label_key: "cashier", label: "كاشير" }, { value: "manager", label_key: "manager", label: "مشرف" }] },
    ],
    "physical-count": [
      { key: "warehouse_id", type: "lookup", entity: "warehouse", label_key: "warehouse", label: "المخزن" },
      { key: "status", type: "select", label_key: "status", label: "الحالة", options: [{ value: "in_progress", label: "جارٍ التنفيذ" }, { value: "completed", label: "مكتمل" }, { value: "cancelled", label: "ملغي" }] },
      { key: "type", type: "select", label_key: "type", label: "النوع", options: [{ value: "standard", label: "قياسي" }, { value: "complete", label: "شامل" }] },
    ],
  },

  classifications: {
    // ── المستخدمون (Users) ──
    users: [
      { id: "user-list", label_key: "cls_users_list", label: "قائمة المستخدمين", detailedQuery: "user-list", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["role"], filters: [], multiSelectFilters: [] },
      { id: "performance", label_key: "cls_users_performance", label: "أداء المستخدمين", detailedQuery: "user-performance", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["user_id"], filters: [], multiSelectFilters: [] },
      { id: "login-history", label_key: "cls_users_login_history", label: "سجل الدخول", detailedQuery: "login-history", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["user_id"], filters: [], multiSelectFilters: [] },
    ],
    // ── مبيعات (Sales) ──
    sales: [
      { id: "daily-summary", label_key: "cls_sales_daily", label: "الملخص اليومي", detailedQuery: null, summaryQuery: "daily-sales", availableModes: ["summary"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["customer_id", "cashier_id", "category_id", "item_id", "status", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "detailed", label_key: "cls_sales_detailed", label: "المبيعات التفصيلية", detailedQuery: "detailed-sales", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["customer_id", "category_id", "item_id", "status", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "by-item", label_key: "cls_sales_by_item", label: "حسب الصنف", detailedQuery: "sales-by-item", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["category_id", "item_id", "customer_id", "cashier_id", "status", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "by-category", label_key: "cls_sales_by_category", label: "حسب الفئة", detailedQuery: "sales-by-category", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["category_id", "item_id", "customer_id", "cashier_id", "status", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "by-cashier", label_key: "cls_sales_by_cashier", label: "حسب الكاشير", detailedQuery: "sales-by-cashier", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["cashier_id", "customer_id", "category_id", "item_id", "status", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "by-payment", label_key: "cls_sales_by_payment", label: "حسب طريقة الدفع", detailedQuery: "sales-by-payment", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id", "cashier_id", "status"], filters: [], multiSelectFilters: [] },
      { id: "heatmap", label_key: "cls_sales_heatmap", label: "خريطة حرارة", detailedQuery: null, summaryQuery: "sales-heatmap", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id", "category_id"], filters: [], multiSelectFilters: [] },
      { id: "period-compare", label_key: "cls_sales_period_compare", label: "مقارنة فترتين", detailedQuery: "period-comparison", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["category_id", "customer_id"], filters: [], multiSelectFilters: [] },
      { id: "discounts", label_key: "cls_sales_discounts", label: "تحليل الخصومات", detailedQuery: "discount-analysis", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id", "customer_id"], filters: [], multiSelectFilters: [] },
      { id: "cashier-override-impact", label_key: "cls_sales_cashier_override_impact", label: "تأثير تجاوز الكاشير", detailedQuery: "cashier-override-impact", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["cashier_id"], filters: [], multiSelectFilters: [] },
    ],
    // ── مشتريات (Purchases) ──
    purchases: [
      { id: "summary", label_key: "cls_purchases_summary", label: "ملخص المشتريات", detailedQuery: null, summaryQuery: "purchase-summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id", "category_id", "item_id", "status", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "detailed", label_key: "cls_purchases_detailed", label: "المشتريات التفصيلية", detailedQuery: "detailed-purchases", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id", "category_id", "item_id", "status", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "by-supplier", label_key: "cls_purchases_by_supplier", label: "حسب المورد", detailedQuery: "purchases-by-supplier", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id", "category_id", "item_id", "status", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "by-item", label_key: "cls_purchases_by_item", label: "حسب الصنف", detailedQuery: "purchases-by-item", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id", "item_id", "supplier_id"], filters: [], multiSelectFilters: [] },
      { id: "supplier-pricing", label_key: "cls_purchases_supplier_pricing", label: "تسعير الموردين", detailedQuery: "supplier-pricing", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id","item_id"], filters: [], multiSelectFilters: [] },
    ],
    // ── مرتجعات المشتريات (Purchase Returns) ──
    "purchase-returns": [
      { id: "summary", label_key: "cls_preturn_summary", label: "ملخص المرتجعات", detailedQuery: null, summaryQuery: "purchase-returns-summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"], filters: [], multiSelectFilters: [] },
      { id: "detailed", label_key: "cls_preturn_detailed", label: "مرتجعات تفصيلية", detailedQuery: "purchase-returns", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"], filters: [], multiSelectFilters: [] },
      { id: "by-supplier", label_key: "cls_preturn_by_supplier", label: "حسب المورد", detailedQuery: "purchase-returns-by-supplier", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
    ],
    // ── مرتجعات المبيعات (Sales Returns) ──
    "sales-returns": [
      { id: "summary", label_key: "cls_sreturn_summary", label: "ملخص المرتجعات", detailedQuery: null, summaryQuery: "sales-returns-summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
      { id: "detailed", label_key: "cls_sreturn_detailed", label: "مرتجعات تفصيلية", detailedQuery: "sales-returns", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
      { id: "by-customer", label_key: "cls_sreturn_by_customer", label: "حسب العميل", detailedQuery: "sales-returns-by-customer", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
    ],
    // ── الموردين (Suppliers) ──
    suppliers: [
      { id: "balance-list", label_key: "cls_supplier_balance_list", label: "قائمة أرصدة الموردين", detailedQuery: "supplier-balance-list", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"], filters: [], multiSelectFilters: [] },
      { id: "statement", label_key: "cls_supplier_statement", label: "كشف حساب المورد", detailedQuery: "supplier-statement", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"], filters: [
        { key: "supplier_id", type: "lookup", label_key: "supplier", label: "المورد", entity: "supplier", required: true },
      ], multiSelectFilters: [] },
      { id: "aging", label_key: "cls_supplier_aging", label: "تقادم ذمم الموردين", detailedQuery: "ap-aging", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"], filters: [], multiSelectFilters: [] },
      { id: "purchases", label_key: "cls_supplier_purchases", label: "سجل المشتريات", detailedQuery: "purchases-by-supplier", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id","category_id","item_id","status","payment_type"], filters: [
        { key: "supplier_id", type: "lookup", label_key: "supplier", label: "المورد", entity: "supplier" },
      ], multiSelectFilters: [] },
      { id: "returns", label_key: "cls_supplier_returns", label: "سجل المرتجعات", detailedQuery: "purchase-returns-by-supplier", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "reliability", label_key: "cls_supplier_reliability", label: "موثوقية الموردين", detailedQuery: "supplier-reliability", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"], filters: [
        { key: "supplier_id", type: "lookup", label_key: "supplier", label: "المورد", entity: "supplier" },
      ], multiSelectFilters: [] },
    ],
    // ── العملاء (Customers) ──
    customers: [
      { id: "balance-list", label_key: "cls_customer_balance_list", label: "قائمة أرصدة العملاء", detailedQuery: "customer-balance-list", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [
        { key: "customer_id", type: "lookup", label_key: "customer", label: "العميل", entity: "customer" },
      ], multiSelectFilters: [] },
      { id: "statement", label_key: "cls_customer_statement", label: "كشف حساب العميل", detailedQuery: "customer-statement", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [
        { key: "customer_id", type: "lookup", label_key: "customer", label: "العميل", entity: "customer", required: true },
      ], multiSelectFilters: [] },
      { id: "aging", label_key: "cls_customer_aging", label: "تقادم ذمم العملاء", detailedQuery: "ar-aging", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
      { id: "top-customers", label_key: "cls_top_customers", label: "أفضل العملاء", detailedQuery: "top-customers", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
      { id: "collection-efficiency", label_key: "cls_collection_efficiency", label: "كفاءة التحصيل", detailedQuery: "collection-efficiency", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
      { id: "loyalty", label_key: "cls_customer_loyalty", label: "ولاء العملاء", detailedQuery: "customer-loyalty", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
    ],
    // ── الموظفين (Employees) ──
    employees: [
      { id: "employee-list", label_key: "cls_emp_list", label: "قائمة الموظفين", detailedQuery: "employee-list", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "employee-deductions", label_key: "cls_emp_deductions", label: "خصومات الموظفين", detailedQuery: "employee-deductions", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["employee_id", "deduction_type", "status"], filters: [], multiSelectFilters: [] },
      { id: "employee-bonuses", label_key: "cls_emp_bonuses", label: "مكافآت الموظفين", detailedQuery: "employee-bonuses", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["employee_id", "bonus_type", "status"], filters: [], multiSelectFilters: [] },
      { id: "employee-advances", label_key: "cls_emp_advances", label: "سلف الموظفين", detailedQuery: "employee-advances", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["employee_id", "status"], filters: [], multiSelectFilters: [] },
      { id: "employee-payroll", label_key: "cls_emp_payroll", label: "كشوف الرواتب", detailedQuery: "employee-payroll", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["employee_id"], filters: [], multiSelectFilters: [] },
      { id: "employee-full-history", label_key: "cls_emp_full_history", label: "السجل الكامل للموظف", detailedQuery: "employee-full-history", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["employee_id", "tx_type"], filters: [], multiSelectFilters: [] },
      { id: "user-activity", label_key: "cls_emp_user_activity", label: "نشاط المستخدمين", detailedQuery: "user-activity", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "employee-adjustments", label_key: "cls_emp_adjustments", label: "تسويات الموظفين", detailedQuery: "employee-adjustments", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
    ],
    // ── أنظمة التقسيط (Installments) ──
    installments: [
      { id: "plans", label_key: "cls_inst_plans", label: "خطط التقسيط", detailedQuery: "installment-plans", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id", "status"], filters: [], multiSelectFilters: [] },
      { id: "collections", label_key: "cls_inst_collections", label: "تحصيلات", detailedQuery: "installment-collections", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id", "status"], filters: [], multiSelectFilters: [] },
      { id: "by-customer", label_key: "cls_inst_by_customer", label: "حسب العميل", detailedQuery: "installments-by-customer", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id", "status"], filters: [], multiSelectFilters: [] },
      { id: "delinquent", label_key: "cls_inst_delinquent", label: "المتأخرات", detailedQuery: null, summaryQuery: "installment-delinquent", availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
    ],
    // ── الأصناف (Items / Inventory) ──
    items: [
      { id: "stock-levels", label_key: "cls_item_stock_levels", label: "مستويات المخزون", detailedQuery: "stock-levels", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"], filters: [], multiSelectFilters: [] },
      { id: "valuation", label_key: "cls_item_valuation", label: "تقييم المخزون", detailedQuery: "stock-valuation", summaryQuery: null, availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"], filters: [], multiSelectFilters: [] },
      { id: "count-sheet", label_key: "cls_item_count_sheet", label: "ورقة جرد", detailedQuery: "count-sheet", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: true, dimensions: ["category_id", "warehouse_id"], filters: [], multiSelectFilters: [] },
      { id: "reorder", label_key: "cls_item_reorder", label: "إعادة الطلب", detailedQuery: "reorder", summaryQuery: null, availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "expiry", label_key: "cls_item_expiry", label: "انتهاء الصلاحية", detailedQuery: "expiry", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["item_id", "warehouse_id"], filters: [], multiSelectFilters: [] },
      { id: "slow-moving", label_key: "cls_item_slow_moving", label: "الراكد", detailedQuery: "slow-moving", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"], filters: [], multiSelectFilters: [] },
      { id: "aging", label_key: "cls_item_aging", label: "تقادم المخزون", detailedQuery: "inventory-aging", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"], filters: [], multiSelectFilters: [] },
      { id: "dead-stock", label_key: "cls_item_dead_stock", label: "مخزون ميت", detailedQuery: "dead-stock", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"], filters: [], multiSelectFilters: [] },
      { id: "cost-movements", label_key: "cls_item_cost_movements", label: "حركات التكلفة", detailedQuery: "cost-movements", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["item_id","movement_type"], filters: [
        { key: "movement_type", type: "select", label_key: "movement_type", label: "نوع الحركة", options: [{ value: "purchase", label: "شراء" }, { value: "branch_receive", label: "استلام فرع" }, { value: "opening_balance", label: "رصيد افتتاحي" }] },
      ], multiSelectFilters: [] },
      { id: "cost-method-comparison", label_key: "cls_item_cost_method_comparison", label: "مقارنة طرق التكلفة", detailedQuery: "cost-method-comparison", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"], filters: [], multiSelectFilters: [] },
      { id: "item-lifecycle", label_key: "cls_item_lifecycle", label: "دورة حياة الصنف", detailedQuery: "item-lifecycle", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id","item_id"], filters: [], multiSelectFilters: [] },
      { id: "inventory-turnover", label_key: "cls_item_inventory_turnover", label: "معدل دوران المخزون", detailedQuery: "inventory-turnover", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id","item_id","warehouse_id"], filters: [], multiSelectFilters: [] },
    ],
    // ── مخازن (Warehouses) ──
    warehouses: [
      { id: "movements", label_key: "cls_wh_movements", label: "حركات المخازن", detailedQuery: "stock-movements", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["movement_type", "category_id", "item_id", "warehouse_id"], filters: [], multiSelectFilters: [] },
      { id: "transfers", label_key: "cls_wh_transfers", label: "تحويلات", detailedQuery: "branch-transfers", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "per-warehouse", label_key: "cls_wh_per_warehouse", label: "حسب المخزن", detailedQuery: "warehouse-levels", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "stock-adjustment-audit", label_key: "cls_wh_stock_adjustment_audit", label: "مراجعة تسويات المخزون", detailedQuery: "stock-adjustment-audit", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["warehouse_id","category_id","item_id","user_id"], filters: [], multiSelectFilters: [] },
    ],
    // ── مصروفات (Expenses) ──
    expenses: [
      { id: "summary", label_key: "cls_exp_summary", label: "ملخص المصروفات", detailedQuery: null, summaryQuery: "expense-summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "detailed", label_key: "cls_exp_detailed", label: "مصروفات تفصيلية", detailedQuery: "detailed-expenses", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "by-category", label_key: "cls_exp_by_category", label: "حسب الفئة", detailedQuery: "expenses-by-category", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "by-payment", label_key: "cls_exp_by_payment", label: "حسب طريقة الدفع", detailedQuery: "expenses-by-payment", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["payment_type"], filters: [], multiSelectFilters: [] },
    ],
    // ── إيرادات أخرى (Other Revenues) ──
    revenues: [
      { id: "summary", label_key: "cls_rev_summary", label: "ملخص الإيرادات", detailedQuery: null, summaryQuery: "revenue-summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "detailed", label_key: "cls_rev_detailed", label: "إيرادات تفصيلية", detailedQuery: "detailed-revenues", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "by-category", label_key: "cls_rev_by_category", label: "حسب الفئة", detailedQuery: "revenues-by-category", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "by-payment", label_key: "cls_rev_by_payment", label: "حسب طريقة الدفع", detailedQuery: "revenues-by-payment", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["payment_type"], filters: [], multiSelectFilters: [] },
    ],
    // ── الخزينة (Treasury) ──
    treasury: [
      { id: "cash-flow", label_key: "cls_trs_cash_flow", label: "التدفق النقدي", detailedQuery: "cash-flow", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "balances", label_key: "cls_trs_balances", label: "الأرصدة", detailedQuery: null, summaryQuery: "treasury", availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "reconciliation", label_key: "cls_trs_reconciliation", label: "ورديات الكاشير والتسوية النقدية", detailedQuery: "cash-consistency", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [
        { key: "variance_only", type: "select", label_key: "variance_only", label: "عرض الورديات", options: [{ value: "1", label: "اللي فيها فروقات نقدية بس" }] },
      ], multiSelectFilters: [] },
      { id: "withdrawals", label_key: "cls_trs_withdrawals", label: "السحوبات", detailedQuery: "withdrawals-report", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
    ],
    "payment-flow": [
      { id: "payment-flow-summary", label_key: "cls_trs_payment_flow_summary", label: "ملخص تدفقات وسائل الدفع", detailedQuery: null, summaryQuery: "payment-flow-summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["method_id"], filters: [PAYMENT_FLOW_FILTERS.method], multiSelectFilters: [] },
      { id: "payment-flow-ledger", label_key: "cls_trs_payment_flow_ledger", label: "سجل التدفقات التفصيلي", detailedQuery: "payment-flow-ledger", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["method_id", "direction", "doc_type", "party_type", "amount_min", "amount_max"], filters: [PAYMENT_FLOW_FILTERS.method, PAYMENT_FLOW_FILTERS.direction, PAYMENT_FLOW_FILTERS.docType, PAYMENT_FLOW_FILTERS.partyType, PAYMENT_FLOW_FILTERS.min, PAYMENT_FLOW_FILTERS.max], multiSelectFilters: [] },
      { id: "payment-flow-by-doc-type", label_key: "cls_trs_payment_flow_by_doc_type", label: "حسب نوع المستند", detailedQuery: "payment-flow-by-doc-type", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["doc_type", "method_id", "direction"], filters: [PAYMENT_FLOW_FILTERS.docType, PAYMENT_FLOW_FILTERS.method, PAYMENT_FLOW_FILTERS.direction], multiSelectFilters: [] },
      { id: "payment-flow-by-direction", label_key: "cls_trs_payment_flow_by_direction", label: "حسب الاتجاه", detailedQuery: "payment-flow-by-direction", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["direction", "method_id", "doc_type"], filters: [PAYMENT_FLOW_FILTERS.direction, PAYMENT_FLOW_FILTERS.method, PAYMENT_FLOW_FILTERS.docType], multiSelectFilters: [] },
      { id: "payment-flow-running", label_key: "cls_trs_payment_flow_running", label: "الرصيد التراكمي", detailedQuery: "payment-flow-running", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["method_id", "direction", "doc_type"], filters: [PAYMENT_FLOW_FILTERS.method, PAYMENT_FLOW_FILTERS.direction, PAYMENT_FLOW_FILTERS.docType], multiSelectFilters: [] },
    ],
    // ── الأرباح (Profit — merged gross + net) ──
    profit: [
      { id: "income-statement", label_key: "cls_net_income", label: "قائمة الدخل (أرباح وخسائر)", detailedQuery: "profit-loss", summaryQuery: null, availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "daily-owner-snapshot", label_key: "cls_net_daily_owner_snapshot", label: "لقطة اليوم السريعة", detailedQuery: "daily-owner-snapshot", summaryQuery: null, availableModes: ["summary"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "by-period", label_key: "cls_net_by_period", label: "الربح يوم بيوم", detailedQuery: "profit-by-period", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "by-item", label_key: "cls_profit_by_item", label: "ربح كل صنف", detailedQuery: "margin-by-item", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["category_id", "item_id"], filters: [], multiSelectFilters: [] },
      { id: "by-category", label_key: "cls_net_by_category", label: "ربح كل فئة", detailedQuery: "profit-by-category", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["category_id"], filters: [], multiSelectFilters: [] },
      { id: "by-customer", label_key: "cls_net_by_customer", label: "ربح كل عميل", detailedQuery: "profit-by-customer", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
      { id: "margin-drift", label_key: "cls_profit_margin_drift", label: "انحراف هامش الربح", detailedQuery: "margin-drift", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["category_id", "item_id"], filters: [], multiSelectFilters: [] },
      { id: "health", label_key: "cls_profit_health", label: "أصناف هامشها ضعيف", detailedQuery: "margin-health", summaryQuery: null, availableModes: ["summary"], supportsDates: false, hasProfit: true, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
    ],
    // ── الضرائب (Tax) ──
    tax: [
      { id: "vat", label_key: "cls_tax_vat", label: "ضريبة القيمة المضافة", detailedQuery: "vat", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id", "status", "payment_type", "tax_type"], filters: [], multiSelectFilters: [] },
      { id: "output-vat", label_key: "cls_tax_output_vat", label: "ضريبة المبيعات (خرج)", detailedQuery: "output-vat", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id", "status", "payment_type", "tax_type"], filters: [], multiSelectFilters: [] },
      { id: "input-vat", label_key: "cls_tax_input_vat", label: "ضريبة المشتريات (دخل)", detailedQuery: "input-vat", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id", "status", "payment_type", "tax_type"], filters: [], multiSelectFilters: [] },
      { id: "vat-filing-summary", label_key: "cls_tax_vat_filing", label: "ملخص إقرار الضريبة", detailedQuery: null, summaryQuery: "vat-filing-summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id", "status", "payment_type", "tax_type"], filters: [], multiSelectFilters: [] },
      { id: "returns-tax-effect", label_key: "cls_tax_returns_effect", label: "أثر المرتجعات على الضريبة", detailedQuery: "returns-tax-effect", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
    ],
    // ── سجل الجرد (Physical Count) ──
    "physical-count": [
      { id: "history", label_key: "cls_pc_history", label: "سجل جرد المخزون", detailedQuery: "physical-count-history", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["warehouse_id", "status", "type"], filters: [], multiSelectFilters: [] },
    ],
  },

  // Setup backward-compatible source -> classification -> slug resolution
  reportSlugToSource: {},
  reportSlugToClassification: {},
};

// Build backward-compat maps: each old slug maps to its source + classification
const slugSourceMap = {
  // Sales
  "daily-sales": "sales",
  "detailed-sales": "sales",
  "sales-by-item": "sales",
  "sales-by-category": "sales",
  "sales-by-cashier": "sales",
  "sales-by-payment": "sales",
  "sales-heatmap": "sales",
  "period-comparison": "sales",
  "cashier-override-impact": "sales",
  "gross-net-sales": "sales",
  "sales-returns": "sales-returns",
  "discount-analysis": "sales",
  "margin-by-item": "profit",
  "margin-by-category": "profit",
  "margin-health": "profit",
  "margin-drift": "profit",
  "profit-by-category": "profit",
  "profit-by-customer": "profit",
  "profit-by-period": "profit",
  "shift-history": "treasury",
  // Purchases
  "purchase-summary": "purchases",
  "detailed-purchases": "purchases",
  "purchases-by-supplier": "purchases",
  "purchases-by-item": "purchases",
  "purchase-returns": "purchase-returns",
  "supplier-pricing": "purchases",
  // Inventory
  "slow-moving": "items",
  "stock-levels": "items",
  "stock-movements": "warehouses",
  "stock-valuation": "items",
  "count-sheet": "items",
  "reorder": "items",
  "expiry": "items",
  "inventory-aging": "items",
  "dead-stock": "items",
  "cost-movements": "items",
  "cost-method-comparison": "items",
  "item-lifecycle": "items",
  "inventory-turnover": "items",
  "physical-count-history": "physical-count",
  "stock-adjustment-audit": "warehouses",
  // Accounts
  "profit-loss": "profit",
  "customer-statement": "customers",
  "supplier-statement": "suppliers",
  "daily-owner-snapshot": "profit",
  "ar-aging": "customers",
  "ap-aging": "suppliers",
  "top-customers": "customers",
  "collection-efficiency": "customers",
  "customer-loyalty": "customers",
  "supplier-reliability": "suppliers",
  // Treasury
  "cash-flow": "treasury",
  "treasury": "treasury",
  "cash-consistency": "treasury",
  "daily-sessions": "treasury",
  "payment-method-flow": "payment-flow",
  "payment-flow-summary": "payment-flow",
  "payment-flow-ledger": "payment-flow",
  "payment-flow-by-doc-type": "payment-flow",
  "payment-flow-by-direction": "payment-flow",
  "payment-flow-running": "payment-flow",
  "reconciliation-exceptions": "treasury",
  // Tax
  "vat": "tax",
  "output-vat": "tax",
  "input-vat": "tax",
  "vat-filing-summary": "tax",
  "returns-tax-effect": "tax",
  // Audit
  "exceptions": "treasury",
  "audit-log": "employees",
  "user-activity": "employees",
  "user-list": "users",
  "user-performance": "users",
  "login-history": "users",
};

const clsMap = {
  "daily-sales": { classification: "daily-summary", dataMode: "summary" },
  "detailed-sales": { classification: "detailed", dataMode: "detailed" },
  "sales-by-item": { classification: "by-item", dataMode: "detailed" },
  "sales-by-category": { classification: "by-category", dataMode: "detailed" },
  "sales-by-cashier": { classification: "by-cashier", dataMode: "detailed" },
  "sales-by-payment": { classification: "by-payment", dataMode: "detailed" },
  "sales-heatmap": { classification: "heatmap", dataMode: "summary" },
  "period-comparison": { classification: "period-compare", dataMode: "detailed" },
  "cashier-override-impact": { classification: "cashier-override-impact", dataMode: "detailed" },
  "discount-analysis": { classification: "discounts", dataMode: "detailed" },
  "margin-by-item": { classification: "by-item", dataMode: "detailed" },
  "margin-by-category": { classification: "by-category", dataMode: "detailed" },
  "margin-health": { classification: "health", dataMode: "summary" },
  "margin-drift": { classification: "margin-drift", dataMode: "detailed" },
  "gross-net-sales": { classification: "daily-summary", dataMode: "summary" },
  "sales-returns": { classification: "detailed", dataMode: "detailed" },
  "shift-history": { classification: "reconciliation", dataMode: "detailed" },
  "profit-by-category": { classification: "by-category", dataMode: "detailed" },
  "profit-by-customer": { classification: "by-customer", dataMode: "detailed" },
  "profit-by-period": { classification: "by-period", dataMode: "detailed" },
  "purchase-summary": { classification: "summary", dataMode: "summary" },
  "detailed-purchases": { classification: "detailed", dataMode: "detailed" },
  "purchases-by-supplier": { classification: "by-supplier", dataMode: "detailed" },
  "purchases-by-item": { classification: "by-item", dataMode: "detailed" },
  "purchase-returns": { classification: "detailed", dataMode: "detailed" },
  "supplier-pricing": { classification: "supplier-pricing", dataMode: "detailed" },
  "slow-moving": { classification: "slow-moving", dataMode: "detailed" },
  "stock-levels": { classification: "stock-levels", dataMode: "detailed" },
  "stock-movements": { classification: "movements", dataMode: "detailed" },
  "stock-valuation": { classification: "valuation", dataMode: "summary" },
  "count-sheet": { classification: "count-sheet", dataMode: "detailed" },
  "reorder": { classification: "reorder", dataMode: "summary" },
  "expiry": { classification: "expiry", dataMode: "detailed" },
  "inventory-aging": { classification: "aging", dataMode: "detailed" },
  "dead-stock": { classification: "dead-stock", dataMode: "detailed" },
  "cost-movements": { classification: "cost-movements", dataMode: "detailed" },
  "cost-method-comparison": { classification: "cost-method-comparison", dataMode: "detailed" },
  "item-lifecycle": { classification: "item-lifecycle", dataMode: "detailed" },
  "inventory-turnover": { classification: "inventory-turnover", dataMode: "detailed" },
  "stock-adjustment-audit": { classification: "stock-adjustment-audit", dataMode: "detailed" },
  "physical-count-history": { classification: "history", dataMode: "detailed" },
};

// Register backward-compat maps
for (const [slug, source] of Object.entries(slugSourceMap)) {
  REPORT_REGISTRY.reportSlugToSource[slug] = source;
  REPORT_REGISTRY.reportSlugToClassification[slug] = clsMap[slug] || null;
}

// Legacy reports array for backward compat
REPORT_REGISTRY.reports = [
  // Sales
  { id: "R01", cat: "sales", slug: "daily-sales", title_key: "r01_title", desc_key: "r01_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R02", cat: "sales", slug: "detailed-sales", title_key: "r02_title", desc_key: "r02_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "status", type: "select", label_key: "status", options: [{ value: "paid", label_key: "paid" }, { value: "unpaid", label_key: "unpaid" }, { value: "cancelled", label_key: "cancelled" }] },
    { key: "payment_type", type: "select", label_key: "payment_type", options: [{ value: "cash", label_key: "cash" }, { value: "card", label_key: "card" }, { value: "credit", label_key: "credit" }, { value: "wallet", label_key: "wallet" }] },
  ]},
  { id: "R03", cat: "sales", slug: "sales-by-item", title_key: "r03_title", desc_key: "r03_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
  ]},
  { id: "R04", cat: "sales", slug: "sales-by-category", title_key: "r04_title", desc_key: "r04_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
  ]},
  { id: "R05", cat: "sales", slug: "sales-by-cashier", title_key: "r05_title", desc_key: "r05_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "cashier_id", type: "lookup", label_key: "cashier", entity: "user" },
  ]},
  { id: "R06", cat: "sales", slug: "sales-by-payment", title_key: "r06_title", desc_key: "r06_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "payment_type", type: "select", label_key: "payment_type", options: [{ value: "cash", label_key: "cash" }, { value: "card", label_key: "card" }, { value: "credit", label_key: "credit" }, { value: "wallet", label_key: "wallet" }] },
  ]},
  { id: "R07", cat: "sales", slug: "sales-heatmap", title_key: "r07_title", desc_key: "r07_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
  ]},
  { id: "R09", cat: "sales", slug: "period-comparison", title_key: "r09_title", desc_key: "r09_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
  { id: "R27", cat: "sales", slug: "shift-history", title_key: "r27_title", desc_key: "r27_desc", supportsDates: false, exportFormats: ["pdf", "excel", "print"] },
  { id: "R29", cat: "sales", slug: "gross-net-sales", title_key: "r29_title", desc_key: "r29_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R30", cat: "sales", slug: "sales-returns", title_key: "r30_title", desc_key: "r30_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
  ]},
  { id: "R31", cat: "sales", slug: "discount-analysis", title_key: "r31_title", desc_key: "r31_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "payment_type", type: "select", label_key: "payment_type", options: [{ value: "cash", label_key: "cash" }, { value: "card", label_key: "card" }, { value: "credit", label_key: "credit" }, { value: "wallet", label_key: "wallet" }] },
  ]},
  { id: "R32", cat: "sales", slug: "margin-by-item", title_key: "r32_title", desc_key: "r32_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
  ]},
  { id: "R33", cat: "sales", slug: "margin-by-category", title_key: "r33_title", desc_key: "r33_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
  ]},
  { id: "R33A", cat: "sales", slug: "margin-health", title_key: "r60_title", desc_key: "r60_desc", supportsDates: false, hasProfit: true, exportFormats: ["pdf", "excel", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
  ]},
  // Purchases
  { id: "R34", cat: "purchases", slug: "purchase-summary", title_key: "r34_title", desc_key: "r34_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
  ]},
  { id: "R35", cat: "purchases", slug: "detailed-purchases", title_key: "r35_title", desc_key: "r35_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
    { key: "status", type: "select", label_key: "status", options: [{ value: "paid", label_key: "paid" }, { value: "unpaid", label_key: "unpaid" }, { value: "cancelled", label_key: "cancelled" }] },
    { key: "payment_type", type: "select", label_key: "payment_type", options: [{ value: "cash", label_key: "cash" }, { value: "card", label_key: "card" }, { value: "credit", label_key: "credit" }, { value: "wallet", label_key: "wallet" }] },
  ]},
  { id: "R36", cat: "purchases", slug: "purchases-by-supplier", title_key: "r36_title", desc_key: "r36_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
  ]},
  { id: "R37", cat: "purchases", slug: "purchases-by-item", title_key: "r37_title", desc_key: "r37_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
    { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
  ]},
  { id: "R38", cat: "purchases", slug: "purchase-returns", title_key: "r38_title", desc_key: "r38_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
  ]},
  { id: "R39", cat: "purchases", slug: "supplier-pricing", title_key: "r39_title", desc_key: "r39_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"], filters: [
    { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
  ]},
  // Inventory
  { id: "R10", cat: "inventory", slug: "slow-moving", title_key: "r10_title", desc_key: "r10_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
    { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
  ]},
  { id: "R11", cat: "inventory", slug: "stock-levels", title_key: "r11_title", desc_key: "r11_desc", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
    { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
  ]},
  { id: "R12", cat: "inventory", slug: "stock-movements", title_key: "r12_title", desc_key: "r12_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "movement_type", type: "select", label_key: "movement_type", options: [{ value: "in", label_key: "in" }, { value: "out", label_key: "out" }, { value: "transfer", label_key: "transfer" }] },
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
    { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
  ]},
  { id: "R13", cat: "inventory", slug: "stock-valuation", title_key: "r13_title", desc_key: "r13_desc", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
    { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
  ]},
  { id: "R14", cat: "inventory", slug: "count-sheet", title_key: "r14_title", desc_key: "r14_desc", supportsDates: false, exportFormats: ["pdf", "excel", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
  ]},
  { id: "R15", cat: "inventory", slug: "reorder", title_key: "r15_title", desc_key: "r15_desc", supportsDates: false, exportFormats: ["pdf", "excel", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
  ]},
  { id: "R16", cat: "inventory", slug: "expiry", title_key: "r16_title", desc_key: "r16_desc", supportsDates: false, exportFormats: ["pdf", "excel", "print"], filters: [
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
    { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
  ]},
  { id: "R40", cat: "inventory", slug: "inventory-aging", title_key: "r40_title", desc_key: "r40_desc", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
    { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
  ]},
  { id: "R41", cat: "inventory", slug: "dead-stock", title_key: "r41_title", desc_key: "r41_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
    { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
  ]},
  // Accounts
  { id: "R20", cat: "accounts", slug: "profit-loss", title_key: "r20_title", desc_key: "r20_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R24", cat: "accounts", slug: "customer-statement", title_key: "r24_title", desc_key: "r24_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer", required: true },
  ]},
  { id: "R43", cat: "accounts", slug: "supplier-statement", title_key: "r43_title", desc_key: "r43_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier", required: true },
  ]},
  // Treasury
  { id: "R21", cat: "treasury", slug: "cash-flow", title_key: "r21_title", desc_key: "r21_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R22", cat: "treasury", slug: "treasury", title_key: "r22_title", desc_key: "r22_desc", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R44", cat: "treasury", slug: "cash-consistency", title_key: "r44_title", desc_key: "r44_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
  { id: "R45", cat: "treasury", slug: "payment-method-flow", title_key: "r45_title", desc_key: "r45_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R66", cat: "treasury", slug: "payment-flow-summary", title_key: "r66_title", desc_key: "r66_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [PAYMENT_FLOW_FILTERS.method] },
  { id: "R67", cat: "treasury", slug: "payment-flow-ledger", title_key: "r67_title", desc_key: "r67_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [PAYMENT_FLOW_FILTERS.method, PAYMENT_FLOW_FILTERS.direction, PAYMENT_FLOW_FILTERS.docType, PAYMENT_FLOW_FILTERS.partyType, PAYMENT_FLOW_FILTERS.min, PAYMENT_FLOW_FILTERS.max] },
  { id: "R68", cat: "treasury", slug: "payment-flow-by-doc-type", title_key: "r68_title", desc_key: "r68_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [PAYMENT_FLOW_FILTERS.docType, PAYMENT_FLOW_FILTERS.method, PAYMENT_FLOW_FILTERS.direction] },
  { id: "R69", cat: "treasury", slug: "payment-flow-by-direction", title_key: "r69_title", desc_key: "r69_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [PAYMENT_FLOW_FILTERS.direction, PAYMENT_FLOW_FILTERS.method, PAYMENT_FLOW_FILTERS.docType] },
  { id: "R70", cat: "treasury", slug: "payment-flow-running", title_key: "r70_title", desc_key: "r70_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [PAYMENT_FLOW_FILTERS.method, PAYMENT_FLOW_FILTERS.direction, PAYMENT_FLOW_FILTERS.docType] },
  { id: "R47", cat: "treasury", slug: "reconciliation-exceptions", title_key: "r47_title", desc_key: "r47_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
  // Tax
  { id: "R23", cat: "tax", slug: "vat", title_key: "r23_title", desc_key: "r23_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R48", cat: "tax", slug: "output-vat", title_key: "r48_title", desc_key: "r48_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R49", cat: "tax", slug: "input-vat", title_key: "r49_title", desc_key: "r49_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R50", cat: "tax", slug: "vat-filing-summary", title_key: "r50_title", desc_key: "r50_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R51", cat: "tax", slug: "returns-tax-effect", title_key: "r51_title", desc_key: "r51_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
  // Audit
  { id: "R08", cat: "audit", slug: "exceptions", title_key: "r08_title", desc_key: "r08_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"], filters: [
    { key: "status", type: "select", label_key: "status", options: [{ value: "paid", label_key: "paid" }, { value: "unpaid", label_key: "unpaid" }, { value: "cancelled", label_key: "cancelled" }] },
  ]},
  { id: "R28", cat: "audit", slug: "audit-log", title_key: "r28_title", desc_key: "r28_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"], filters: [
    { key: "user_id", type: "lookup", label_key: "user", entity: "user" },
    { key: "action", type: "select", label_key: "action", options: [] },
    { key: "resource", type: "text", label_key: "resource" },
  ]},
  { id: "R52", cat: "audit", slug: "user-activity", title_key: "r52_title", desc_key: "r52_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"], filters: [
    { key: "user_id", type: "lookup", label_key: "user", entity: "user" },
    { key: "action", type: "select", label_key: "action", options: [] },
  ]},
  // Users
  { id: "R53", cat: "users", slug: "user-list", title_key: "r53_title", desc_key: "r53_desc", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "role", type: "select", label_key: "role", options: [{ value: "admin", label_key: "admin" }, { value: "cashier", label_key: "cashier" }, { value: "manager", label_key: "manager" }] },
  ]},
  { id: "R54", cat: "users", slug: "user-performance", title_key: "r54_title", desc_key: "r54_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "user_id", type: "lookup", label_key: "user", entity: "user" },
  ]},
  { id: "R55", cat: "users", slug: "login-history", title_key: "r55_title", desc_key: "r55_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"], filters: [
    { key: "user_id", type: "lookup", label_key: "user", entity: "user" },
  ]},
  { id: "R56", cat: "inventory", slug: "cost-movements", title_key: "r56_title", desc_key: "r56_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
    { key: "movement_type", type: "select", label_key: "movement_type", options: [{ value: "purchase", label: "شراء" }, { value: "branch_receive", label: "استلام فرع" }, { value: "opening_balance", label: "رصيد افتتاحي" }] },
  ]},
  { id: "R57", cat: "inventory", slug: "cost-method-comparison", title_key: "r57_title", desc_key: "r57_desc", supportsDates: false, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
    { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
  ]},
  { id: "R58", cat: "inventory", slug: "item-lifecycle", title_key: "r58_title", desc_key: "r58_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
  ]},
  { id: "R59", cat: "sales", slug: "margin-drift", title_key: "r59_title", desc_key: "r59_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
  ]},
  { id: "R60", cat: "inventory", slug: "inventory-turnover", title_key: "r60_inventory_title", desc_key: "r60_inventory_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
    { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
  ]},
  { id: "R61", cat: "sales", slug: "cashier-override-impact", title_key: "r61_title", desc_key: "r61_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "cashier_id", type: "lookup", label_key: "cashier", entity: "user" },
  ]},
  { id: "R64", cat: "inventory", slug: "stock-adjustment-audit", title_key: "r64_title", desc_key: "r64_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
    { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
  ]},
  { id: "R65", cat: "accounts", slug: "daily-owner-snapshot", title_key: "r65_title", desc_key: "r65_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"] },
  // ── Customer Reports ──
  { id: "R72", cat: "accounts", slug: "ar-aging", title_key: "r66_title", desc_key: "r66_desc", supportsDates: true, hasProfit: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
  ]},
  { id: "R73", cat: "accounts", slug: "top-customers", title_key: "r67_title", desc_key: "r67_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
  ]},
  { id: "R74", cat: "accounts", slug: "collection-efficiency", title_key: "r68_title", desc_key: "r68_desc", supportsDates: true, hasProfit: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
  ]},
  { id: "R75", cat: "accounts", slug: "customer-loyalty", title_key: "r69_title", desc_key: "r69_desc", supportsDates: true, hasProfit: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
  ]},
  // ── Supplier Reports ──
  { id: "R76", cat: "accounts", slug: "ap-aging", title_key: "r70_title", desc_key: "r70_desc", supportsDates: true, hasProfit: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
  ]},
  { id: "R71", cat: "accounts", slug: "supplier-reliability", title_key: "r71_title", desc_key: "r71_desc", supportsDates: true, hasProfit: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
  ]},
  // Physical Count
  { id: "R80", cat: "inventory", slug: "physical-count-history", title_key: "r80_title", desc_key: "r80_desc", supportsDates: true, hasProfit: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
    { key: "status", type: "select", label_key: "status", options: [{ value: "in_progress", label: "جارٍ التنفيذ" }, { value: "completed", label: "مكتمل" }, { value: "cancelled", label: "ملغي" }] },
    { key: "type", type: "select", label_key: "type", options: [{ value: "standard", label: "قياسي" }, { value: "complete", label: "شامل" }] },
  ]},
];

function getSource(sourceKey) {
  return REPORT_REGISTRY.sources.find(s => s.id === sourceKey) || null;
}

function getSourceClassifications(sourceKey) {
  return REPORT_REGISTRY.classifications[sourceKey] || [];
}

function getClassification(sourceKey, classificationId) {
  const classes = getSourceClassifications(sourceKey);
  return classes.find(c => c.id === classificationId) || null;
}

function getFilterDimensions(sourceKey) {
  return REPORT_REGISTRY.filterDimensions[sourceKey] || [];
}

function getEnabledFilterDimensions(sourceKey, classificationId) {
  const cls = getClassification(sourceKey, classificationId);
  if (!cls || !cls.dimensions) return [];
  const pool = getFilterDimensions(sourceKey);
  return cls.dimensions.map(key => pool.find(d => d.key === key)).filter(Boolean);
}

function resolveQuerySlug(sourceKey, classificationId, dataMode) {
  const cls = getClassification(sourceKey, classificationId);
  if (!cls) return null;
  if (dataMode === "summary" && cls.summaryQuery) return cls.summaryQuery;
  if (dataMode === "detailed" && cls.detailedQuery) return cls.detailedQuery;
  return cls.detailedQuery || cls.summaryQuery || null;
}

module.exports = {
  REPORT_REGISTRY,
  getSource,
  getSourceClassifications,
  getClassification,
  getFilterDimensions,
  getEnabledFilterDimensions,
  resolveQuerySlug,
};
