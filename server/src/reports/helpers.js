const { getDb } = require("../config/database");

function addDateFilter(column = "created_at", startDate, endDate, params) {
  let clause = "";
  if (startDate) {
    clause += ` AND DATE(${column}) >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    clause += ` AND DATE(${column}) <= ?`;
    params.push(endDate);
  }
  return clause;
}

function labelForKey(key) {
  const labels = {
    item_code: "كود الصنف",
    code: "الكود",
    sku: "SKU",
    barcode: "الباركود",
    item_name: "اسم الصنف",
    name: "الاسم",
    invoice_no: "رقم الفاتورة",
    customer_name: "العميل",
    supplier_name: "المورد",
    date: "التاريخ",
    total: "الإجمالي",
    total_sales: "إجمالي المبيعات",
    invoice_count: "عدد الفواتير",
    quantity: "الكمية",
    quantity_sold: "الكمية المباعة",
    stock_quantity: "رصيد المخزون",
    system_quantity: "رصيد النظام",
    category_name: "الفئة",
    payment_type: "طريقة الدفع",
    status: "الحالة",
    balance: "الرصيد",
    source: "المصدر",
    tax_rate: "نسبة الضريبة",
    taxable_sales: "المبيعات الخاضعة",
    outstanding_balance: "الرصيد المستحق",
    hour_slot: "الساعة",
    weekday: "يوم الأسبوع",
    action: "الإجراء",
    resource: "المورد",
    created_at: "تاريخ الإنشاء",
    line_total: "إجمالي السطر",
    movement_type: "نوع الحركة",
    reference_type: "نوع المرجع",
    reference_id: "رقم المرجع",
    revenue: "الإيراد",
    min_stock_qty: "حد أدنى للمخزون",
    unit_name: "الوحدة",
    total_quantity: "إجمالي الكمية",
    cost_price: "سعر التكلفة",
    total_value: "إجمالي القيمة",
    total_spent: "إجمالي الإنفاق",
    payload_json: "التفاصيل",
    user_id: "المستخدم",
    gross_sales: "إجمالي المبيعات",
    net_sales: "صافي المبيعات",
    total_discount: "إجمالي الخصم",
    avg_discount: "متوسط الخصم",
    return_total: "إجمالي المرتجع",
    reason: "السبب",
    profit_margin: "هامش الربح",
    margin_percent: "هامش الربح %",
    cost: "التكلفة",
    purchase_count: "عدد المشتريات",
    total_purchases: "إجمالي المشتريات",
    purchase_no: "رقم الشراء",
    quantity_purchased: "الكمية المشتراة",
    total_cost: "إجمالي التكلفة",
    unit_price: "سعر الوحدة",
    purchase_date: "تاريخ الشراء",
    stock_status: "حالة المخزون",
    shift_id: "رقم الوردية",
    opening_cash: "النقدية الافتتاحية",
    closing_cash: "النقدية الختامية",
    variance: "الفرق",
    transaction_count: "عدد المعاملات",
    total_amount: "إجمالي المبلغ",
    type: "النوع",
    taxable_amount: "المبلغ الخاضع",
    vat_amount: "قيمة الضريبة",
    output_vat: "ضريبة المخرجات",
    input_vat: "ضريبة المدخلات",
    return_amount: "قيمة المرتجع",
    vat_reversed: "الضريبة المستردة",
    total_invoices: "عدد الفواتير",
    total_billed: "إجمالي الفواتير",
    collected: "المحصل",
    outstanding: "المستحق",
    collection_rate: "نسبة التحصيل %",
    action_count: "عدد العمليات",
    gross_profit: "مجمل الربح",
    returns_amount: "قيمة المرتجعات",
    returns_count: "عدد المرتجعات",
    total_cost_field: "إجمالي التكلفة",
    avg_transaction: "متوسط المعاملة",
    avg_invoice_value: "متوسط الفاتورة",
    items_returned: "الأصناف المرتجعة",
    refund_method: "وسيلة الاسترداد",
    handled_by: "تم بواسطة",
    return_ref: "رقم المرتجع",
    discount_range: "نطاق الخصم",
    avg_discount_percent: "متوسط الخصم %",
    avg_unit_price: "متوسط سعر الوحدة",
    discount_total: "إجمالي الخصم",
    item_count: "عدد الأصناف",
    cashier: "الكاشير",
    cancelled_count: "الفواتير الملغاة",
    total_items_sold: "الأصناف المباعة",
    returns_handled: "المرتجعات المعالجة",
    weekday_name: "يوم الأسبوع",
    weekday_num: "رقم اليوم",
    avg_sale: "متوسط البيع",
    period: "الفترة",
    gross_sales_p1: "مبيعات الفترة الأولى",
    gross_sales_p2: "مبيعات الفترة الثانية",
    diff: "الفرق",
    diff_pct: "الفرق %",
    doc_no: "رقم المستند",
    last_purchase_date: "آخر تاريخ شراء",
    avg_order_value: "متوسط الطلب",
    distinct_suppliers: "عدد الموردين",
    created_by: "أنشئ بواسطة",
    warehouse_id: "المخزن",
    before_qty: "الرصيد قبل",
    after_qty: "الرصيد بعد",
    last_movement_date: "آخر حركة",
    days_since_last_movement: "أيام منذ آخر حركة",
    aging_bucket: "فئة العمر",
    suggested_order_qty: "كمية الطلب المقترحة",
    estimated_order_cost: "تكلفة الطلب المقدرة",
    preferred_supplier: "المورد المفضل",
    total_value_wacc: "القيمة بمتوسط التكلفة",
    total_value_last_purchase: "القيمة بآخر شراء",
    last_sale_date: "آخر بيع",
    potential_revenue: "إيراد محتمل",
    loyalty_points: "نقاط الولاء",
    loyalty_tier: "شريحة الولاء",
    phone: "الهاتف",
    days_to_collect: "أيام التحصيل",
    running_balance: "الرصيد الجاري",
    opening_balance: "الرصيد الافتتاحي",
    closing_balance: "الرصيد الختامي",
    net_vat: "صافي الضريبة",
    sales_total: "إجمالي المبيعات",
    purchases_total: "إجمالي المشتريات",
    exception_type: "نوع الاستثناء",
    full_name: "المستخدم",
  };
  return labels[key] || key;
}

function buildColumnsFromRows(rows) {
  const sample = rows?.[0] || null;
  if (!sample) return [];
  const keys = Object.keys(sample);
  const first = [];
  const used = new Set();
  for (const k of ["item_code", "code", "sku", "barcode"]) {
    if (keys.includes(k)) { first.push(k); used.add(k); }
  }
  for (const k of ["item_name", "name"]) {
    if (keys.includes(k) && !used.has(k)) { first.push(k); used.add(k); }
  }
  const ordered = [...first, ...keys.filter((k) => !used.has(k))];
  return ordered.map((k) => ({ key: k, label: labelForKey(k) }));
}

// Returns a SQL expression that resolves a per-line cost using the selected method.
// Callers may use it inside any context where invoice_lines (or sales_return_lines)
// columns are in scope — with or without a table alias. Unqualified column references
// are safe because cost_wacc/cost_fifo/cost_lifo/cost_last_purchase live only on
// invoice_lines and sales_return_lines, and queries never join both.
function getCostColumn(costMethod) {
  switch (costMethod) {
    case "last_purchase": return "COALESCE(cost_last_purchase, cost_wacc, 0)";
    case "fifo":          return "COALESCE(cost_fifo, cost_wacc, cost_last_purchase, 0)";
    case "lifo":          return "COALESCE(cost_lifo, cost_wacc, cost_last_purchase, 0)";
    default:              return "COALESCE(cost_wacc, cost_last_purchase, 0)";
  }
}

function getCostColumnForValuation(costMethod) {
  switch (costMethod) {
    case "last_purchase": return "sl.last_purchase_cost";
    default:              return "sl.wacc";
  }
}

// Returns cost column that matches selected cost method — for use in return-line subqueries
function getReturnCostColumn(costMethod) {
  switch (costMethod) {
    case "last_purchase": return "COALESCE(ref_il.cost_last_purchase, srl.cost_last_purchase, it.purchase_price, 0)";
    case "fifo":          return "COALESCE(ref_il.cost_fifo, srl.cost_fifo, ref_il.cost_wacc, srl.cost_wacc, it.purchase_price, 0)";
    case "lifo":          return "COALESCE(ref_il.cost_lifo, srl.cost_lifo, ref_il.cost_wacc, srl.cost_wacc, it.purchase_price, 0)";
    default:              return "COALESCE(ref_il.cost_wacc, srl.cost_wacc, it.purchase_price, 0)";
  }
}

// Multi-payment filter: matches direct payment_type OR multi invoices with sub-payment
function addPaymentTypeFilter(paymentType, tableAlias, params) {
  if (!paymentType) return "";
  params.push(paymentType, paymentType);
  return ` AND (${tableAlias}.payment_type = ? OR (${tableAlias}.payment_type = 'multi' AND EXISTS (SELECT 1 FROM payments WHERE invoice_id = ${tableAlias}.id AND method = ?)))`;
}

module.exports = {
  addDateFilter,
  labelForKey,
  buildColumnsFromRows,
  getCostColumn,
  getReturnCostColumn,
  getCostColumnForValuation,
  addPaymentTypeFilter,
};
