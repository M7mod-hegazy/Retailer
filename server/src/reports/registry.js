const REPORT_REGISTRY = {
  categories: [
    { id: "sales", label_key: "category_sales" },
    { id: "purchases", label_key: "category_purchases" },
    { id: "inventory", label_key: "category_inventory" },
    { id: "accounts", label_key: "category_accounts" },
    { id: "treasury", label_key: "category_treasury" },
    { id: "tax", label_key: "category_tax" },
    { id: "profitability", label_key: "category_profitability" },
    { id: "audit", label_key: "category_audit" },
    { id: "users", label_key: "category_users" },
  ],

  sources: [
    { id: "sales", label_key: "source_sales", cat: "sales", icon: "TrendingUp" },
    { id: "purchases", label_key: "source_purchases", cat: "purchases", icon: "Package" },
    { id: "cheques", label_key: "source_cheques", cat: "treasury", icon: "FileText" },
    { id: "purchase-returns", label_key: "source_purchase_returns", cat: "purchases", icon: "RotateCcw" },
    { id: "sales-returns", label_key: "source_sales_returns", cat: "sales", icon: "RotateCcw" },
    { id: "suppliers", label_key: "source_suppliers", cat: "accounts", icon: "Truck" },
    { id: "customers", label_key: "source_customers", cat: "accounts", icon: "Users" },
    { id: "employees", label_key: "source_employees", cat: "audit", icon: "UserCheck" },
    { id: "installments", label_key: "source_installments", cat: "accounts", icon: "CalendarCheck" },
    { id: "items", label_key: "source_items", cat: "inventory", icon: "Package" },
    { id: "warehouses", label_key: "source_warehouses", cat: "inventory", icon: "Layers" },
    { id: "expenses", label_key: "source_expenses", cat: "treasury", icon: "Receipt" },
    { id: "revenues", label_key: "source_revenues", cat: "treasury", icon: "TrendingUp" },
    { id: "treasury", label_key: "source_treasury", cat: "treasury", icon: "Wallet" },
    { id: "profit-loader", label_key: "source_profit_loader", cat: "profitability", icon: "Percent" },
    { id: "net-profit", label_key: "source_net_profit", cat: "profitability", icon: "LineChart" },
    { id: "expiry", label_key: "source_expiry", cat: "inventory", icon: "Clock" },
    { id: "owner-statement", label_key: "source_owner_statement", cat: "accounts", icon: "ClipboardCheck" },
    { id: "tax", label_key: "source_tax", cat: "tax", icon: "FileText" },
    { id: "users", label_key: "source_users", cat: "users", icon: "Users" },
  ],

  // ── Filter Dimensions Pool (shared per source) ────────────────
  filterDimensions: {
    sales: [
      { key: "category_id", type: "lookup", entity: "category", label_key: "category" },
      { key: "item_id", type: "lookup", entity: "product", label_key: "product" },
      { key: "customer_id", type: "lookup", entity: "customer", label_key: "customer" },
      { key: "cashier_id", type: "lookup", entity: "user", label_key: "cashier" },
      { key: "status", type: "select", label_key: "status", options: [{ value: "paid", label_key: "paid" }, { value: "unpaid", label_key: "unpaid" }, { value: "cancelled", label_key: "cancelled" }] },
      { key: "payment_type", type: "select", label_key: "payment_type", dynamic: true, options: [{ value: "cash", label: "نقداً" }, { value: "credit", label: "آجل" }, { value: "card", label: "بطاقة" }, { value: "bank_transfer", label: "تحويل بنكي" }, { value: "multi", label: "متعدد" }] },
    ],
    purchases: [
      { key: "supplier_id", type: "lookup", entity: "supplier", label_key: "supplier" },
      { key: "category_id", type: "lookup", entity: "category", label_key: "category" },
      { key: "item_id", type: "lookup", entity: "product", label_key: "product" },
      { key: "status", type: "select", label_key: "status", options: [{ value: "paid", label_key: "paid" }, { value: "unpaid", label_key: "unpaid" }, { value: "cancelled", label_key: "cancelled" }] },
      { key: "payment_type", type: "select", label_key: "payment_type", dynamic: true, options: [{ value: "cash", label: "نقداً" }, { value: "credit", label: "آجل" }, { value: "card", label: "بطاقة" }, { value: "bank_transfer", label: "تحويل بنكي" }, { value: "multi", label: "متعدد" }] },
    ],
    "purchase-returns": [
      { key: "supplier_id", type: "lookup", entity: "supplier", label_key: "supplier" },
    ],
    "sales-returns": [
      { key: "customer_id", type: "lookup", entity: "customer", label_key: "customer" },
    ],
    suppliers: [
      { key: "supplier_id", type: "lookup", entity: "supplier", label_key: "supplier" },
    ],
    customers: [
      { key: "customer_id", type: "lookup", entity: "customer", label_key: "customer" },
    ],
    employees: [
      { key: "cashier_id", type: "lookup", entity: "user", label_key: "cashier" },
      { key: "user_id", type: "lookup", entity: "user", label_key: "user" },
      { key: "action", type: "select", label_key: "action", options: [] },
    ],
    items: [
      { key: "category_id", type: "lookup", entity: "category", label_key: "category" },
      { key: "item_id", type: "lookup", entity: "product", label_key: "product" },
      { key: "warehouse_id", type: "lookup", entity: "warehouse", label_key: "warehouse" },
    ],
    warehouses: [
      { key: "movement_type", type: "select", label_key: "movement_type", options: [{ value: "in", label_key: "in" }, { value: "out", label_key: "out" }, { value: "transfer", label_key: "transfer" }] },
      { key: "category_id", type: "lookup", entity: "category", label_key: "category" },
      { key: "item_id", type: "lookup", entity: "product", label_key: "product" },
      { key: "warehouse_id", type: "lookup", entity: "warehouse", label_key: "warehouse" },
    ],
    expenses: [
      { key: "category_id", type: "lookup", entity: "category", label_key: "category" },
    ],
    revenues: [
      { key: "category_id", type: "lookup", entity: "category", label_key: "category" },
    ],
    cheques: [
      { key: "status", type: "select", label_key: "status", options: [{ value: "pending", label_key: "pending" }, { value: "cleared", label_key: "cleared" }, { value: "bounced", label_key: "bounced" }, { value: "replaced", label_key: "replaced" }] },
    ],
    "profit-loader": [
      { key: "category_id", type: "lookup", entity: "category", label_key: "category" },
      { key: "item_id", type: "lookup", entity: "product", label_key: "product" },
    ],
    "net-profit": [],
    treasury: [],
    installments: [],
    users: [
      { key: "user_id", type: "lookup", entity: "user", label_key: "user" },
      { key: "role", type: "select", label_key: "role", options: [{ value: "admin", label_key: "admin" }, { value: "cashier", label_key: "cashier" }, { value: "manager", label_key: "manager" }] },
    ],
  },

  classifications: {
    // ── المستخدمون (Users) ──
    users: [
      { id: "user-list", label_key: "cls_users_list", detailedQuery: "user-list", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["role"], filters: [
        { key: "role", type: "select", label_key: "role", options: [{ value: "admin", label_key: "admin" }, { value: "cashier", label_key: "cashier" }, { value: "manager", label_key: "manager" }] },
      ], multiSelectFilters: [] },
      { id: "performance", label_key: "cls_users_performance", detailedQuery: "user-performance", summaryQuery: null, availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["user_id"], filters: [
        { key: "user_id", type: "lookup", label_key: "user", entity: "user" },
      ], multiSelectFilters: [] },
      { id: "login-history", label_key: "cls_users_login_history", detailedQuery: "login-history", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["user_id"], filters: [
        { key: "user_id", type: "lookup", label_key: "user", entity: "user" },
      ], multiSelectFilters: [] },
    ],
    // ── مبيعات (Sales) ──
    sales: [
      { id: "daily-summary", label_key: "cls_sales_daily", detailedQuery: null, summaryQuery: "daily-sales", availableModes: ["summary"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["payment_type", "cashier_id"], filters: [], multiSelectFilters: [] },
      { id: "detailed", label_key: "cls_sales_detailed", detailedQuery: "detailed-sales", summaryQuery: "daily-sales", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id", "status", "payment_type"], filters: [
        { key: "status", type: "select", label_key: "status", options: [{ value: "paid", label_key: "paid" }, { value: "unpaid", label_key: "unpaid" }, { value: "cancelled", label_key: "cancelled" }] },
        { key: "payment_type", type: "select", label_key: "payment_type", dynamic: true, options: [{ value: "cash", label: "نقداً" }, { value: "credit", label: "آجل" }, { value: "card", label: "بطاقة" }, { value: "bank_transfer", label: "تحويل بنكي" }, { value: "multi", label: "متعدد" }] },
      ], multiSelectFilters: [] },
      { id: "by-item", label_key: "cls_sales_by_item", detailedQuery: "sales-by-item", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id", "status", "payment_type"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      ], multiSelectFilters: [] },
      { id: "by-category", label_key: "cls_sales_by_category", detailedQuery: "sales-by-category", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "customer_id", "cashier_id", "status", "payment_type"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      ], multiSelectFilters: [] },
      { id: "by-cashier", label_key: "cls_sales_by_cashier", detailedQuery: "sales-by-cashier", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["cashier_id", "customer_id", "payment_type", "status"], filters: [
        { key: "cashier_id", type: "lookup", label_key: "cashier", entity: "user" },
      ], multiSelectFilters: [] },
      { id: "by-payment", label_key: "cls_sales_by_payment", detailedQuery: "sales-by-payment", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["payment_type", "customer_id", "cashier_id", "status"], filters: [
        { key: "payment_type", type: "select", label_key: "payment_type", dynamic: true, options: [{ value: "cash", label: "نقداً" }, { value: "credit", label: "آجل" }, { value: "card", label: "بطاقة" }, { value: "bank_transfer", label: "تحويل بنكي" }, { value: "multi", label: "متعدد" }] },
      ], multiSelectFilters: [] },
      { id: "heatmap", label_key: "cls_sales_heatmap", detailedQuery: null, summaryQuery: "sales-heatmap", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "customer_id", "payment_type"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      ], multiSelectFilters: [] },
      { id: "period-compare", label_key: "cls_sales_period_compare", detailedQuery: "period-comparison", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id", "status", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "discounts", label_key: "cls_sales_discounts", detailedQuery: "discount-analysis", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id", "payment_type", "status"], filters: [
        { key: "payment_type", type: "select", label_key: "payment_type", dynamic: true, options: [{ value: "cash", label: "نقداً" }, { value: "credit", label: "آجل" }, { value: "card", label: "بطاقة" }, { value: "bank_transfer", label: "تحويل بنكي" }, { value: "multi", label: "متعدد" }] },
      ], multiSelectFilters: [] },
      { id: "cashier-override-impact", label_key: "cls_sales_cashier_override_impact", detailedQuery: "cashier-override-impact", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["cashier_id"], filters: [
        { key: "cashier_id", type: "lookup", label_key: "cashier", entity: "user" },
      ], multiSelectFilters: [] },
      { id: "margin", label_key: "cls_sales_margin", detailedQuery: "margin-by-item", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id", "cashier_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      ], multiSelectFilters: [] },
      { id: "tax", label_key: "cls_sales_tax", detailedQuery: "vat", summaryQuery: "vat-filing-summary", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["customer_id", "status", "payment_type"], filters: [], multiSelectFilters: [] },
    ],
    // ── مشتريات (Purchases) ──
    purchases: [
      { id: "summary", label_key: "cls_purchases_summary", detailedQuery: null, summaryQuery: "purchase-summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "payment_type", "status"], filters: [
        { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
      ], multiSelectFilters: [] },
      { id: "detailed", label_key: "cls_purchases_detailed", detailedQuery: "detailed-purchases", summaryQuery: "purchase-summary", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "category_id", "item_id", "status", "payment_type"], filters: [
        { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
        { key: "status", type: "select", label_key: "status", options: [{ value: "paid", label_key: "paid" }, { value: "unpaid", label_key: "unpaid" }, { value: "cancelled", label_key: "cancelled" }] },
        { key: "payment_type", type: "select", label_key: "payment_type", dynamic: true, options: [{ value: "cash", label: "نقداً" }, { value: "credit", label: "آجل" }, { value: "card", label: "بطاقة" }, { value: "bank_transfer", label: "تحويل بنكي" }, { value: "multi", label: "متعدد" }] },
      ], multiSelectFilters: [] },
      { id: "by-supplier", label_key: "cls_purchases_by_supplier", detailedQuery: "purchases-by-supplier", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "category_id", "item_id", "status", "payment_type"], filters: [
        { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
      ], multiSelectFilters: [] },
      { id: "by-item", label_key: "cls_purchases_by_item", detailedQuery: "purchases-by-item", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "category_id", "item_id", "status", "payment_type"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
        { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
      ], multiSelectFilters: [] },
      { id: "supplier-pricing", label_key: "cls_purchases_supplier_pricing", detailedQuery: "supplier-pricing", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id", "category_id", "item_id"], filters: [
        { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      ], multiSelectFilters: [] },
    ],
    // ── شيكات / بنوك (Cheques / Banks) ──
    cheques: [
      { id: "cheques", label_key: "cls_cheques_listing", detailedQuery: "cheque-listing", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["status"], filters: [
        { key: "status", type: "select", label_key: "status", options: [{ value: "pending", label_key: "pending" }, { value: "cleared", label_key: "cleared" }, { value: "bounced", label_key: "bounced" }, { value: "replaced", label_key: "replaced" }] },
      ], multiSelectFilters: [] },
      { id: "bank-transactions", label_key: "cls_bank_transactions", detailedQuery: "bank-transactions", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "bank-summary", label_key: "cls_bank_summary", detailedQuery: null, summaryQuery: "bank-summary", availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
    ],
    // ── مرتجعات المشتريات (Purchase Returns) ──
    "purchase-returns": [
      { id: "summary", label_key: "cls_preturn_summary", detailedQuery: null, summaryQuery: "purchase-returns-summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"], filters: [], multiSelectFilters: [] },
      { id: "detailed", label_key: "cls_preturn_detailed", detailedQuery: "purchase-returns", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id"], filters: [
        { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
      ], multiSelectFilters: [] },
      { id: "by-supplier", label_key: "cls_preturn_by_supplier", detailedQuery: "purchase-returns-by-supplier", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"], filters: [], multiSelectFilters: [] },
    ],
    // ── مرتجعات المبيعات (Sales Returns) ──
    "sales-returns": [
      { id: "summary", label_key: "cls_sreturn_summary", detailedQuery: null, summaryQuery: "sales-returns-summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
      { id: "detailed", label_key: "cls_sreturn_detailed", detailedQuery: "sales-returns", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["customer_id"], filters: [
        { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
      ], multiSelectFilters: [] },
      { id: "by-customer", label_key: "cls_sreturn_by_customer", detailedQuery: "sales-returns-by-customer", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
    ],
    // ── الموردين (Suppliers) ──
    suppliers: [
      { id: "balance-list", label_key: "cls_supplier_balance_list", detailedQuery: "supplier-balance-list", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"], filters: [
        { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
      ], multiSelectFilters: [] },
      { id: "statement", label_key: "cls_supplier_statement", detailedQuery: "supplier-statement", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"], filters: [
        { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier", required: true },
      ], multiSelectFilters: [] },
      { id: "aging", label_key: "cls_supplier_aging", detailedQuery: "ap-aging", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"], filters: [
        { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
      ], multiSelectFilters: [] },
      { id: "purchases", label_key: "cls_supplier_purchases", detailedQuery: "purchases-by-supplier", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id"], filters: [
        { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
      ], multiSelectFilters: [] },
      { id: "returns", label_key: "cls_supplier_returns", detailedQuery: "purchase-returns-by-supplier", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"], filters: [], multiSelectFilters: [] },
      { id: "reliability", label_key: "cls_supplier_reliability", detailedQuery: "supplier-reliability", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["supplier_id"], filters: [
        { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
      ], multiSelectFilters: [] },
    ],
    // ── العملاء (Customers) ──
    customers: [
      { id: "balance-list", label_key: "cls_customer_balance_list", detailedQuery: "customer-balance-list", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [
        { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
      ], multiSelectFilters: [] },
      { id: "statement", label_key: "cls_customer_statement", detailedQuery: "customer-statement", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [
        { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer", required: true },
      ], multiSelectFilters: [] },
      { id: "aging", label_key: "cls_customer_aging", detailedQuery: "ar-aging", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [
        { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
      ], multiSelectFilters: [] },
      { id: "top-customers", label_key: "cls_top_customers", detailedQuery: "top-customers", summaryQuery: null, availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: ["customer_id"], filters: [
        { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
      ], multiSelectFilters: [] },
      { id: "collection-efficiency", label_key: "cls_collection_efficiency", detailedQuery: "collection-efficiency", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [
        { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
      ], multiSelectFilters: [] },
      { id: "loyalty", label_key: "cls_customer_loyalty", detailedQuery: "customer-loyalty", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [
        { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
      ], multiSelectFilters: [] },
    ],
    // ── الموظفين (Employees) ──
    employees: [
      { id: "cashier-performance", label_key: "cls_emp_cashier_perf", detailedQuery: "sales-by-cashier", summaryQuery: null, availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["cashier_id", "action"], filters: [
        { key: "cashier_id", type: "lookup", label_key: "cashier", entity: "user" },
      ], multiSelectFilters: [] },
      { id: "shifts", label_key: "cls_emp_shifts", detailedQuery: "shift-history", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["cashier_id"], filters: [], multiSelectFilters: [] },
      { id: "user-activity", label_key: "cls_emp_user_activity", detailedQuery: "user-activity", summaryQuery: null, availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["user_id", "action"], filters: [
        { key: "user_id", type: "lookup", label_key: "user", entity: "user" },
        { key: "action", type: "select", label_key: "action", options: [] },
      ], multiSelectFilters: [] },
      { id: "incentives", label_key: "cls_emp_incentives", detailedQuery: "employee-adjustments", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
    ],
    // ── أنظمة التقسيط (Installments) ──
    installments: [
      { id: "plans", label_key: "cls_inst_plans", detailedQuery: "installment-plans", summaryQuery: null, availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
      { id: "collections", label_key: "cls_inst_collections", detailedQuery: "installment-collections", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
      { id: "by-customer", label_key: "cls_inst_by_customer", detailedQuery: "installments-by-customer", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
      { id: "delinquent", label_key: "cls_inst_delinquent", detailedQuery: null, summaryQuery: "installment-delinquent", availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
    ],
    // ── الأصناف (Items / Inventory) ──
    items: [
      { id: "stock-levels", label_key: "cls_item_stock_levels", detailedQuery: "stock-levels", summaryQuery: null, availableModes: ["detailed", "summary"], supportsDates: false, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
        { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
      ], multiSelectFilters: [] },
      { id: "valuation", label_key: "cls_item_valuation", detailedQuery: "stock-valuation", summaryQuery: null, availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
        { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
      ], multiSelectFilters: [] },
      { id: "count-sheet", label_key: "cls_item_count_sheet", detailedQuery: "count-sheet", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: false, supportsScope: true, dimensions: ["category_id", "warehouse_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
      ], multiSelectFilters: [] },
      { id: "reorder", label_key: "cls_item_reorder", detailedQuery: "reorder", summaryQuery: null, availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["category_id", "warehouse_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
      ], multiSelectFilters: [] },
      { id: "expiry", label_key: "cls_item_expiry", detailedQuery: "expiry", summaryQuery: null, availableModes: ["detailed", "summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["item_id", "warehouse_id", "category_id"], filters: [
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
        { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
      ], multiSelectFilters: [] },
      { id: "slow-moving", label_key: "cls_item_slow_moving", detailedQuery: "slow-moving", summaryQuery: null, availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
        { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
      ], multiSelectFilters: [] },
      { id: "aging", label_key: "cls_item_aging", detailedQuery: "inventory-aging", summaryQuery: null, availableModes: ["detailed", "summary"], supportsDates: false, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
        { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
      ], multiSelectFilters: [] },
      { id: "dead-stock", label_key: "cls_item_dead_stock", detailedQuery: "dead-stock", summaryQuery: null, availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
        { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
      ], multiSelectFilters: [] },
      { id: "cost-movements", label_key: "cls_item_cost_movements", detailedQuery: "cost-movements", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["item_id", "warehouse_id"], filters: [
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
        { key: "movement_type", type: "select", label_key: "movement_type", options: [{ value: "purchase", label: "purchase" }, { value: "branch_receive", label: "branch_receive" }, { value: "opening_balance", label: "opening_balance" }] },
      ], multiSelectFilters: [] },
      { id: "cost-method-comparison", label_key: "cls_item_cost_method_comparison", detailedQuery: "cost-method-comparison", summaryQuery: null, availableModes: ["detailed"], supportsDates: false, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
        { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
      ], multiSelectFilters: [] },
      { id: "item-lifecycle", label_key: "cls_item_lifecycle", detailedQuery: "item-lifecycle", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      ], multiSelectFilters: [] },
      { id: "inventory-turnover", label_key: "cls_item_inventory_turnover", detailedQuery: "inventory-turnover", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id", "warehouse_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
        { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
      ], multiSelectFilters: [] },
    ],
    // ── مخازن (Warehouses) ──
    warehouses: [
      { id: "movements", label_key: "cls_wh_movements", detailedQuery: "stock-movements", summaryQuery: null, availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["movement_type", "category_id", "item_id", "warehouse_id"], filters: [
        { key: "movement_type", type: "select", label_key: "movement_type", options: [{ value: "in", label_key: "in" }, { value: "out", label_key: "out" }, { value: "transfer", label_key: "transfer" }] },
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
        { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
      ], multiSelectFilters: [] },
      { id: "transfers", label_key: "cls_wh_transfers", detailedQuery: "branch-transfers", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["warehouse_id"], filters: [], multiSelectFilters: [] },
      { id: "per-warehouse", label_key: "cls_wh_per_warehouse", detailedQuery: "warehouse-levels", summaryQuery: "warehouse-levels-summary", availableModes: ["detailed", "summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: ["warehouse_id", "category_id"], filters: [], multiSelectFilters: [] },
      { id: "stock-adjustment-audit", label_key: "cls_wh_stock_adjustment_audit", detailedQuery: "stock-adjustment-audit", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["warehouse_id", "category_id", "item_id"], filters: [
        { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      ], multiSelectFilters: [] },
    ],
    // ── مصروفات (Expenses) ──
    expenses: [
      { id: "summary", label_key: "cls_exp_summary", detailedQuery: null, summaryQuery: "expense-summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id"], filters: [], multiSelectFilters: [] },
      { id: "detailed", label_key: "cls_exp_detailed", detailedQuery: "detailed-expenses", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      ], multiSelectFilters: [] },
      { id: "by-category", label_key: "cls_exp_by_category", detailedQuery: "expenses-by-category", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id"], filters: [], multiSelectFilters: [] },
      { id: "by-payment", label_key: "cls_exp_by_payment", detailedQuery: "expenses-by-payment", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
    ],
    // ── إيرادات أخرى (Other Revenues) ──
    revenues: [
      { id: "summary", label_key: "cls_rev_summary", detailedQuery: null, summaryQuery: "revenue-summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id"], filters: [], multiSelectFilters: [] },
      { id: "detailed", label_key: "cls_rev_detailed", detailedQuery: "detailed-revenues", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      ], multiSelectFilters: [] },
      { id: "by-category", label_key: "cls_rev_by_category", detailedQuery: "revenues-by-category", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: ["category_id"], filters: [], multiSelectFilters: [] },
      { id: "by-payment", label_key: "cls_rev_by_payment", detailedQuery: "revenues-by-payment", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
    ],
    // ── الخزينة (Treasury) ──
    treasury: [
      { id: "cash-flow", label_key: "cls_trs_cash_flow", detailedQuery: "cash-flow", summaryQuery: null, availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "balances", label_key: "cls_trs_balances", detailedQuery: null, summaryQuery: "treasury", availableModes: ["summary"], supportsDates: false, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "reconciliation", label_key: "cls_trs_reconciliation", detailedQuery: "cash-consistency", summaryQuery: null, availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "daily-sessions", label_key: "cls_trs_daily_sessions", detailedQuery: "daily-sessions", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "withdrawals", label_key: "cls_trs_withdrawals", detailedQuery: "withdrawals-report", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
    ],
    // ── محمل ربح المبيعات (Sales Profit Loader) ──
    "profit-loader": [
      { id: "by-item", label_key: "cls_profit_by_item", detailedQuery: "margin-by-item", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id", "customer_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      ], multiSelectFilters: [] },
      { id: "by-category", label_key: "cls_profit_by_category", detailedQuery: "margin-by-category", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "customer_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      ], multiSelectFilters: [] },
      { id: "health", label_key: "cls_profit_health", detailedQuery: "margin-health", summaryQuery: null, availableModes: ["summary"], supportsDates: false, hasProfit: true, supportsScope: false, dimensions: ["category_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      ], multiSelectFilters: [] },
      { id: "margin-drift", label_key: "cls_profit_margin_drift", detailedQuery: "margin-drift", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id", "item_id"], filters: [
        { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
        { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      ], multiSelectFilters: [] },
    ],
    // ── صافي الربح (Net Profit) ──
    "net-profit": [
      { id: "income-statement", label_key: "cls_net_income", detailedQuery: "profit-loss", summaryQuery: null, availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "by-category", label_key: "cls_net_by_category", detailedQuery: "profit-by-category", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: true, dimensions: ["category_id"], filters: [], multiSelectFilters: [] },
      { id: "by-customer", label_key: "cls_net_by_customer", detailedQuery: "profit-by-customer", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "by-period", label_key: "cls_net_by_period", detailedQuery: "profit-by-period", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
      { id: "daily-owner-snapshot", label_key: "cls_net_daily_owner_snapshot", detailedQuery: "daily-owner-snapshot", summaryQuery: null, availableModes: ["summary"], supportsDates: true, hasProfit: true, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
    ],
    // ── الضرائب (Tax) ──
    tax: [
      { id: "vat", label_key: "r23_title", detailedQuery: "vat", summaryQuery: "vat-filing-summary", availableModes: ["detailed", "summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["customer_id", "status", "payment_type"], filters: [], multiSelectFilters: [] },
      { id: "output-vat", label_key: "r48_title", detailedQuery: "output-vat", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["customer_id"], filters: [], multiSelectFilters: [] },
      { id: "input-vat", label_key: "r49_title", detailedQuery: "input-vat", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["supplier_id"], filters: [], multiSelectFilters: [] },
      { id: "vat-filing-summary", label_key: "r50_title", detailedQuery: null, summaryQuery: "vat-filing-summary", availableModes: ["summary"], supportsDates: true, hasProfit: false, supportsScope: true, dimensions: ["customer_id", "status"], filters: [], multiSelectFilters: [] },
      { id: "returns-tax-effect", label_key: "r51_title", detailedQuery: "returns-tax-effect", summaryQuery: null, availableModes: ["detailed"], supportsDates: true, hasProfit: false, supportsScope: false, dimensions: [], filters: [], multiSelectFilters: [] },
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
  "margin-by-item": "profit-loader",
  "margin-by-category": "profit-loader",
  "margin-health": "profit-loader",
  "margin-drift": "profit-loader",
  "shift-history": "employees",
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
  "stock-adjustment-audit": "warehouses",
  // Accounts
  "profit-loss": "net-profit",
  "customer-statement": "customers",
  "supplier-statement": "suppliers",
  "daily-owner-snapshot": "net-profit",
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
  "payment-method-flow": "treasury",
  "bank-cash-split": "cheques",
  "reconciliation-exceptions": "treasury",
  // Tax
  "vat": "tax",
  "output-vat": "tax",
  "input-vat": "tax",
  "vat-filing-summary": "tax",
  "returns-tax-effect": "tax",
  // Audit
  "exceptions": "employees",
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
  "shift-history": { classification: "shifts", dataMode: "detailed" },
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
  "profit-loss": { classification: "income-statement", dataMode: "summary" },
  "customer-statement": { classification: "statement", dataMode: "detailed" },
  "supplier-statement": { classification: "statement", dataMode: "detailed" },
  "daily-owner-snapshot": { classification: "daily-owner-snapshot", dataMode: "summary" },
  "ar-aging": { classification: "aging", dataMode: "detailed" },
  "ap-aging": { classification: "aging", dataMode: "detailed" },
  "top-customers": { classification: "top-customers", dataMode: "detailed" },
  "collection-efficiency": { classification: "collection-efficiency", dataMode: "detailed" },
  "customer-loyalty": { classification: "loyalty", dataMode: "detailed" },
  "supplier-reliability": { classification: "reliability", dataMode: "detailed" },
  "cash-flow": { classification: "cash-flow", dataMode: "detailed" },
  "treasury": { classification: "balances", dataMode: "summary" },
  "cash-consistency": { classification: "reconciliation", dataMode: "detailed" },
  "payment-method-flow": { classification: "cash-flow", dataMode: "detailed" },
  "bank-cash-split": { classification: "bank-summary", dataMode: "summary" },
  "reconciliation-exceptions": { classification: "reconciliation", dataMode: "detailed" },
  "vat": { classification: "vat", dataMode: "detailed" },
  "output-vat": { classification: "output-vat", dataMode: "detailed" },
  "input-vat": { classification: "input-vat", dataMode: "detailed" },
  "vat-filing-summary": { classification: "vat-filing-summary", dataMode: "summary" },
  "returns-tax-effect": { classification: "returns-tax-effect", dataMode: "detailed" },
  "exceptions": { classification: "shifts", dataMode: "detailed" },
  "audit-log": { classification: "user-activity", dataMode: "detailed" },
  "user-activity": { classification: "user-activity", dataMode: "detailed" },
  "user-list": { classification: "user-list", dataMode: "detailed" },
  "user-performance": { classification: "performance", dataMode: "detailed" },
  "login-history": { classification: "login-history", dataMode: "detailed" },
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
  { id: "R46", cat: "treasury", slug: "bank-cash-split", title_key: "r46_title", desc_key: "r46_desc", supportsDates: false, exportFormats: ["pdf", "excel", "print"] },
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
    { key: "movement_type", type: "select", label_key: "movement_type", options: [{ value: "purchase", label: "purchase" }, { value: "branch_receive", label: "branch_receive" }, { value: "opening_balance", label: "opening_balance" }] },
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
  { id: "R66", cat: "accounts", slug: "ar-aging", title_key: "r66_title", desc_key: "r66_desc", supportsDates: true, hasProfit: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
  ]},
  { id: "R67", cat: "accounts", slug: "top-customers", title_key: "r67_title", desc_key: "r67_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
  ]},
  { id: "R68", cat: "accounts", slug: "collection-efficiency", title_key: "r68_title", desc_key: "r68_desc", supportsDates: true, hasProfit: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
  ]},
  { id: "R69", cat: "accounts", slug: "customer-loyalty", title_key: "r69_title", desc_key: "r69_desc", supportsDates: true, hasProfit: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
  ]},
  // ── Supplier Reports ──
  { id: "R70", cat: "accounts", slug: "ap-aging", title_key: "r70_title", desc_key: "r70_desc", supportsDates: true, hasProfit: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
  ]},
  { id: "R71", cat: "accounts", slug: "supplier-reliability", title_key: "r71_title", desc_key: "r71_desc", supportsDates: true, hasProfit: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
    { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
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
