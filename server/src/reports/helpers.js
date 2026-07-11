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

// Pre-aggregated per-item stock cost. One row per item, so it is safe to LEFT JOIN
// inside aggregate (SUM/GROUP BY) queries without multiplying rows. WACC is written
// identically across every warehouse row of an item (see waccService.persistStockCost),
// so MAX() faithfully recovers the item-level cost basis.
const STOCK_COST_AGG =
  "(SELECT item_id, MAX(wacc) AS wacc, MAX(last_purchase_cost) AS last_purchase_cost " +
  "FROM stock_levels GROUP BY item_id)";

// LEFT JOIN clause exposing the `sl` alias used by getCostColumn's fallback chain.
function stockCostJoin(lineAlias = "il", stockAlias = "sl") {
  return `LEFT JOIN ${STOCK_COST_AGG} ${stockAlias} ON ${stockAlias}.item_id = ${lineAlias}.item_id`;
}

// LEFT JOIN clause exposing the `it` alias (items) used by getCostColumn's fallback chain.
function itemsCostJoin(lineAlias = "il", itemAlias = "it") {
  return `LEFT JOIN items ${itemAlias} ON ${itemAlias}.id = ${lineAlias}.item_id`;
}

// Returns a SQL expression that resolves a per-line cost using the selected method.
//
// Every snapshot reference is wrapped in NULLIF(...,0) so a *frozen-zero* snapshot
// (captured before the item had a cost basis) is treated as "missing" and falls
// through to the item's current cost. Without this, COALESCE stops at the literal 0
// and the report shows cost = 0 / a fake 100% margin.
//
// Fallback order: method snapshot → wacc snapshot → last-purchase snapshot →
// current stock WACC → current last-purchase cost → item.purchase_price → 0.
//
// Requires the `sl` (stock, via stockCostJoin) and `it` (items, via itemsCostJoin or
// an existing items join) aliases to be in scope. Snapshot columns stay unqualified —
// cost_wacc/cost_fifo/cost_lifo/cost_last_purchase live only on invoice_lines, and
// no cost query joins another table that carries them.
function getCostColumn(costMethod) {
  let primary;
  switch (costMethod) {
    case "last_purchase": primary = "NULLIF(cost_last_purchase, 0)"; break;
    case "fifo":          primary = "NULLIF(cost_fifo, 0)"; break;
    case "lifo":          primary = "NULLIF(cost_lifo, 0)"; break;
    default:              primary = "NULLIF(cost_wacc, 0)"; break;
  }
  return `COALESCE(${primary}, NULLIF(cost_wacc, 0), NULLIF(cost_last_purchase, 0), ` +
    "NULLIF(sl.wacc, 0), NULLIF(sl.last_purchase_cost, 0), NULLIF(it.purchase_price, 0), 0)";
}

function getCostColumnForValuation(costMethod) {
  switch (costMethod) {
    case "last_purchase": return "COALESCE(NULLIF(sl.last_purchase_cost, 0), NULLIF(sl.wacc, 0), NULLIF(it.purchase_price, 0), 0)";
    default:              return "COALESCE(NULLIF(sl.wacc, 0), NULLIF(sl.last_purchase_cost, 0), NULLIF(it.purchase_price, 0), 0)";
  }
}

// Returns cost column that matches selected cost method — for use in return-line subqueries.
// Snapshot refs are NULLIF(...,0)-wrapped for the same reason as getCostColumn: a frozen
// zero on the original invoice line / return line must fall through to the item's cost
// rather than booking a 0-cost return (which would understate margin). All return-line
// subqueries already LEFT JOIN items as `it`, so it.purchase_price is always in scope.
function getReturnCostColumn(costMethod) {
  let primary;
  switch (costMethod) {
    case "last_purchase": primary = "NULLIF(ref_il.cost_last_purchase, 0), NULLIF(srl.cost_last_purchase, 0)"; break;
    case "fifo":          primary = "NULLIF(ref_il.cost_fifo, 0), NULLIF(srl.cost_fifo, 0)"; break;
    case "lifo":          primary = "NULLIF(ref_il.cost_lifo, 0), NULLIF(srl.cost_lifo, 0)"; break;
    default:              primary = "NULLIF(ref_il.cost_wacc, 0), NULLIF(srl.cost_wacc, 0)"; break;
  }
  return `COALESCE(${primary}, NULLIF(ref_il.cost_wacc, 0), NULLIF(srl.cost_wacc, 0), ` +
    "NULLIF(it.purchase_price, 0), 0)";
}

// Base status guard for sales/purchase documents. Cancelled documents are
// excluded from every report by default, but explicitly selecting a cancelled
// status flips the report into a cancelled-only audit view — the caller's own
// "AND alias.status = ?" clause then does the narrowing. Without this, picking
// "ملغي" in the status filter always returned zero rows.
// `cancelledValues` covers documents whose enum differs: purchases void with
// status='voided', not 'cancelled'.
function baseStatusClause(tableAlias, status, cancelledValues = ["cancelled"]) {
  if (status && cancelledValues.includes(status)) return "1=1";
  return `${tableAlias}.status NOT IN (${cancelledValues.map((v) => `'${v}'`).join(", ")})`;
}

// Multi-payment filter: matches direct payment_type OR multi invoices with sub-payment
function addPaymentTypeFilter(paymentType, tableAlias, params) {
  if (!paymentType) return "";
  params.push(paymentType, paymentType);
  return ` AND (${tableAlias}.payment_type = ? OR (${tableAlias}.payment_type = 'multi' AND EXISTS (SELECT 1 FROM payments WHERE invoice_id = ${tableAlias}.id AND method = ?)))`;
}

// Purchases variant of the multi-payment filter. Purchases store their method in
// payment_method (NOT payment_type — filtering on it threw "no such column"),
// and split payments live in purchase_payments → payment_methods, matched by the
// method's category. Push the returned clause's two params into a DEDICATED array
// spread at the clause's exact position — pushing into the shared date-params
// array misaligns every later placeholder.
function addPurchasePaymentFilter(paymentType, tableAlias, params) {
  if (!paymentType) return "";
  params.push(paymentType, paymentType);
  return ` AND (${tableAlias}.payment_method = ? OR (${tableAlias}.payment_method = 'multi' AND EXISTS (` +
    `SELECT 1 FROM purchase_payments pp JOIN payment_methods pm ON pm.id = pp.method_id ` +
    `WHERE pp.purchase_id = ${tableAlias}.id AND pm.category = ?)))`;
}

function getCurrencyConfig() {
  try {
    const row = getDb().prepare("SELECT currency_code, currency_symbol, decimal_places FROM settings WHERE id = 1").get();
    return {
      symbol: row?.currency_symbol || "ج.م",
      code: row?.currency_code || "EGP",
      decimals: row?.decimal_places != null ? row.decimal_places : 2,
    };
  } catch {
    return { symbol: "ج.م", code: "EGP", decimals: 2 };
  }
}

function formatCurrency(amount) {
  const cfg = getCurrencyConfig();
  const val = Number(amount || 0);
  const formatted = val.toLocaleString("en-US", { minimumFractionDigits: cfg.decimals, maximumFractionDigits: cfg.decimals });
  return `${formatted} ${cfg.symbol}`;
}

module.exports = {
  addDateFilter,
  baseStatusClause,
  labelForKey,
  buildColumnsFromRows,
  getCostColumn,
  getReturnCostColumn,
  getCostColumnForValuation,
  stockCostJoin,
  itemsCostJoin,
  addPaymentTypeFilter,
  addPurchasePaymentFilter,
  getCurrencyConfig,
  formatCurrency,
};
