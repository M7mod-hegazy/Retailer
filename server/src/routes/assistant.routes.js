const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { addDateFilter, getCostColumn, stockCostJoin, itemsCostJoin } = require("../reports/helpers");
const { nowSql, today } = require("../utils/datetime");

const router = express.Router();
router.use(authRequired);

// ─── Intent Registry ─────────────────────────────────────────────────────────
// Maps natural-language patterns to parameterized SQL queries.
// Each intent knows its display type (number, table, chart, list)
// and which filters it supports.

const QUERY_INTENTS = [
  {
    id: "sales_today",
    patterns: ["مبيعات النهارده", "مبيعات اليوم", "دخل النهارده", "today sales", "sales today"],
    display: "number",
    label: "مبيعات اليوم",
    labelEn: "Today's Sales",
    sql: (p) => ({
      sql: `SELECT COALESCE(SUM(total), 0) AS value, COUNT(*) AS count FROM invoices WHERE status != 'cancelled' AND date(created_at) = date(?)`,
      params: [today()],
    }),
  },
  {
    id: "sales_period",
    patterns: ["مبيعات", "sales", "total sales", "اجمالي المبيعات"],
    display: "number",
    label: "إجمالي المبيعات",
    labelEn: "Total Sales",
    hasDateRange: true,
    sql: (p) => {
      const binds = [];
      return {
        sql: `SELECT COALESCE(SUM(total), 0) AS value, COUNT(*) AS count FROM invoices WHERE status != 'cancelled' ${addDateFilter("created_at", p.start_date, p.end_date, binds)}`,
        params: binds,
      };
    },
  },
  {
    id: "top_products",
    patterns: ["أفضل المنتجات", "اكثر مبيعا", "top products", "best selling", "أفضل الأصناف"],
    display: "table",
    label: "أفضل المنتجات مبيعاً",
    labelEn: "Top Selling Products",
    hasDateRange: true,
    sql: (p) => {
      const binds = [];
      return {
        sql: `SELECT it.name AS name, SUM(il.quantity) AS qty, SUM(il.line_total * i.total / NULLIF(invs.line_sum, 0)) AS revenue
          FROM invoice_lines il
          JOIN invoices i ON i.id = il.invoice_id
          JOIN items it ON it.id = il.item_id
          LEFT JOIN (SELECT invoice_id, SUM(line_total) AS line_sum FROM invoice_lines GROUP BY invoice_id) invs ON invs.invoice_id = il.invoice_id
          WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", p.start_date, p.end_date, binds)}
          GROUP BY it.id ORDER BY revenue DESC LIMIT 10`,
        params: binds,
      };
    },
  },
  {
    id: "stock_low",
    patterns: ["نواقص", "اقل من الحد", "low stock", "shortage", "اصناف ناقصة"],
    display: "table",
    label: "الأصناف الناقصة",
    labelEn: "Low Stock Items",
    sql: () => ({
      sql: `SELECT i.name AS name, COALESCE(SUM(sl.quantity), 0) AS qty, i.min_stock_qty AS min_qty,
          w.name AS warehouse FROM items i
        LEFT JOIN stock_levels sl ON sl.item_id = i.id
        LEFT JOIN warehouses w ON w.id = sl.warehouse_id
        WHERE i.is_active = 1 AND i.min_stock_qty > 0
        GROUP BY i.id, w.id
        HAVING qty <= i.min_stock_qty
        ORDER BY (qty * 1.0 / i.min_stock_qty) ASC LIMIT 20`,
      params: [],
    }),
  },
  {
    id: "stock_item",
    patterns: ["رصيد", "stock of", "كمية", "مخزون"],
    display: "number",
    label: "رصيد الصنف",
    labelEn: "Item Stock",
    needsItemName: true,
    sql: (p) => {
      const binds = [`%${p.item_name}%`];
      return {
        sql: `SELECT i.name AS name, COALESCE(SUM(sl.quantity), 0) AS qty, w.name AS warehouse
          FROM items i
          LEFT JOIN stock_levels sl ON sl.item_id = i.id
          LEFT JOIN warehouses w ON w.id = sl.warehouse_id
          WHERE i.is_active = 1 AND (i.name LIKE ? OR i.barcode LIKE ?)
          GROUP BY i.id, w.id ORDER BY w.name ASC`,
        params: [binds[0], binds[0]],
      };
    },
  },
  {
    id: "sales_by_category",
    patterns: ["مبيعات حسب القسم", "by category", "category sales", "مبيعات التصنيفات"],
    display: "chart",
    label: "المبيعات حسب القسم",
    labelEn: "Sales by Category",
    hasDateRange: true,
    sql: (p) => {
      const binds = [];
      return {
        sql: `SELECT COALESCE(c.name, 'غير مصنف') AS label, SUM(il.line_total * i.total / NULLIF(invs.line_sum, 0)) AS value
          FROM invoice_lines il
          JOIN invoices i ON i.id = il.invoice_id
          JOIN items it ON it.id = il.item_id
          LEFT JOIN item_categories c ON c.id = it.category_id
          LEFT JOIN (SELECT invoice_id, SUM(line_total) AS line_sum FROM invoice_lines GROUP BY invoice_id) invs ON invs.invoice_id = il.invoice_id
          WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", p.start_date, p.end_date, binds)}
          GROUP BY c.id ORDER BY value DESC LIMIT 10`,
        params: binds,
      };
    },
  },
  {
    id: "sales_by_payment",
    patterns: ["حسب طريقة الدفع", "by payment", "payment method sales"],
    display: "chart",
    label: "المبيعات حسب طريقة الدفع",
    labelEn: "Sales by Payment Method",
    hasDateRange: true,
    sql: (p) => {
      const binds = [];
      return {
        sql: `SELECT COALESCE(pm.name, 'نقدي') AS label, SUM(ip.amount) AS value
          FROM invoice_payments ip
          JOIN invoices i ON i.id = ip.invoice_id
          LEFT JOIN payment_methods pm ON pm.id = ip.payment_method_id
          WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", p.start_date, p.end_date, binds)}
          GROUP BY pm.id ORDER BY value DESC`,
        params: binds,
      };
    },
  },
  {
    id: "profit",
    patterns: ["الربح", "profit", "ارباح", "gross profit", "صافي الربح"],
    display: "number",
    label: "إجمالي الربح",
    labelEn: "Gross Profit",
    hasDateRange: true,
    sql: (p) => {
      const binds = [];
      const costCol = "COALESCE(sl.wacc, i.purchase_price, 0)";
      return {
        sql: `SELECT COALESCE(SUM(i.total), 0) - COALESCE(SUM(il.quantity * ${costCol} * i.total / NULLIF(invs.line_sum, 0)), 0) AS value
          FROM invoices i
          JOIN invoice_lines il ON il.invoice_id = i.id
          JOIN items it ON it.id = il.item_id
          LEFT JOIN stock_levels sl ON sl.item_id = il.item_id AND sl.warehouse_id = il.warehouse_id
          LEFT JOIN (SELECT invoice_id, SUM(line_total) AS line_sum FROM invoice_lines GROUP BY invoice_id) invs ON invs.invoice_id = il.invoice_id
          WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", p.start_date, p.end_date, binds)}`,
        params: binds,
      };
    },
  },
  {
    id: "top_customers",
    patterns: ["أفضل العملاء", "top customers", "اكثر عميل"],
    display: "table",
    label: "أفضل العملاء",
    labelEn: "Top Customers",
    hasDateRange: true,
    sql: (p) => {
      const binds = [];
      return {
        sql: `SELECT c.name AS name, COUNT(i.id) AS invoices, COALESCE(SUM(i.total), 0) AS sales
          FROM invoices i JOIN customers c ON c.id = i.customer_id
          WHERE i.status != 'cancelled' AND c.id != (SELECT walk_in_customer_id FROM settings LIMIT 1)
          ${addDateFilter("i.created_at", p.start_date, p.end_date, binds)}
          GROUP BY c.id ORDER BY sales DESC LIMIT 10`,
        params: binds,
      };
    },
  },
  {
    id: "expenses_period",
    patterns: ["مصروفات", "expenses", "مصاريف"],
    display: "number",
    label: "إجمالي المصروفات",
    labelEn: "Total Expenses",
    hasDateRange: true,
    sql: (p) => {
      const binds = [];
      return {
        sql: `SELECT COALESCE(SUM(amount), 0) AS value, COUNT(*) AS count FROM expenses ${addDateFilter("created_at", p.start_date, p.end_date, binds)}`,
        params: binds,
      };
    },
  },
  {
    id: "customer_balance",
    patterns: ["حساب عميل", "customer balance", "رصيد عميل", "مديونية"],
    display: "table",
    label: "أرصدة العملاء",
    labelEn: "Customer Balances",
    sql: () => ({
      sql: `SELECT c.name AS name, COALESCE(c.opening_balance, 0) + COALESCE(aj.total_debt, 0) - COALESCE(aj.total_paid, 0) AS balance
        FROM customers c
        LEFT JOIN (
          SELECT d.party_id, COALESCE(SUM(d.amount), 0) AS total_debt, COALESCE(SUM(d.paid), 0) AS total_paid
          FROM ajal_debts d WHERE d.status != 'voided' AND COALESCE(d.party_type, 'customer') = 'customer' GROUP BY d.party_id
        ) aj ON aj.party_id = c.id
        WHERE c.is_active = 1 ORDER BY balance DESC LIMIT 15`,
      params: [],
    }),
  },
  {
    id: "supplier_balance",
    patterns: ["حساب مورد", "supplier balance", "رصيد مورد", "مستحق"],
    display: "table",
    label: "أرصدة الموردين",
    labelEn: "Supplier Balances",
    sql: () => ({
      sql: `SELECT s.name AS name, COALESCE(s.opening_balance, 0) + COALESCE(aj.total_debt, 0) - COALESCE(aj.total_paid, 0) AS balance
        FROM suppliers s
        LEFT JOIN (
          SELECT d.party_id, COALESCE(SUM(d.amount), 0) AS total_debt, COALESCE(SUM(d.paid), 0) AS total_paid
          FROM ajal_debts d WHERE d.status != 'voided' AND COALESCE(d.party_type, 'supplier') = 'supplier' GROUP BY d.party_id
        ) aj ON aj.party_id = s.id
        WHERE s.is_active = 1 ORDER BY balance DESC LIMIT 15`,
      params: [],
    }),
  },
  {
    id: "sales_comparison",
    patterns: ["مقارنة", "comparison", "قارن", "compare"],
    display: "comparison",
    label: "مقارنة المبيعات",
    labelEn: "Sales Comparison",
    sql: (p) => {
      const d = today();
      const a_start = p.start_date || d;
      const a_end = p.end_date || d;
      const b_start = p.compare_start || a_start;
      const b_end = p.compare_end || a_start;
      return {
        isComparison: true,
        queries: [
          { label: "أ", sql: `SELECT COALESCE(SUM(total), 0) AS value, COUNT(*) AS count FROM invoices WHERE status != 'cancelled' AND date(created_at) >= date(?) AND date(created_at) <= date(?)`, params: [a_start, a_end] },
          { label: "ب", sql: `SELECT COALESCE(SUM(total), 0) AS value, COUNT(*) AS count FROM invoices WHERE status != 'cancelled' AND date(created_at) >= date(?) AND date(created_at) < date(?)`, params: [b_start, b_end] },
        ],
      };
    },
  },
  {
    id: "expiring_items",
    patterns: ["منتهي الصلاحية", "expiring", "انتهاء صلاحية", "صلاحية"],
    display: "table",
    label: "الأصناف منتهية الصلاحية",
    labelEn: "Expiring Items",
    sql: () => ({
      sql: `SELECT i.name AS name, ib.batch_no, ib.expiry_date, ib.quantity, w.name AS warehouse
        FROM item_batches ib JOIN items i ON i.id = ib.item_id
        LEFT JOIN warehouses w ON w.id = ib.warehouse_id
        WHERE ib.quantity > 0 AND ib.expiry_date IS NOT NULL
          AND ib.expiry_date <= date('now', '+30 days')
        ORDER BY ib.expiry_date ASC LIMIT 20`,
      params: [],
    }),
  },
  {
    id: "daily_summary",
    patterns: ["ملخص اليوم", "daily summary", "summary اليوم", "تقرير اليوم"],
    display: "summary",
    label: "ملخص اليوم",
    labelEn: "Daily Summary",
    sql: () => ({
      isComposite: true,
      queries: [
        { id: "sales", sql: (d) => ({ sql: `SELECT COALESCE(SUM(total), 0) AS v, COUNT(*) AS c FROM invoices WHERE status != 'cancelled' AND date(created_at) = date(?)`, params: [d] }) },
        { id: "expenses", sql: (d) => ({ sql: `SELECT COALESCE(SUM(amount), 0) AS v, COUNT(*) AS c FROM expenses WHERE date(created_at) = date(?)`, params: [d] }) },
        { id: "returns", sql: (d) => ({ sql: `SELECT COALESCE(SUM(total), 0) AS v, COUNT(*) AS c FROM sales_returns WHERE status = 'active' AND date(created_at) = date(?)`, params: [d] }) },
        { id: "customers", sql: (d) => ({ sql: `SELECT COUNT(*) AS c FROM customers WHERE date(created_at) = date(?)`, params: [d] }) },
        { id: "invoices_count", sql: (d) => ({ sql: `SELECT COUNT(*) AS c FROM invoices WHERE status != 'cancelled' AND date(created_at) = date(?)`, params: [d] }) },
      ],
    }),
  },
  {
    id: "warehouse_comparison",
    patterns: ["مقارنة المخازن", "warehouse comparison", "قارن المخازن", "مخازن"],
    display: "table",
    label: "مقارنة المخازن",
    labelEn: "Warehouse Comparison",
    sql: () => ({
      sql: `SELECT w.name AS warehouse, COUNT(DISTINCT sl.item_id) AS items, COALESCE(SUM(sl.quantity), 0) AS total_qty,
          COALESCE(SUM(sl.quantity * COALESCE(sl.wacc, 0)), 0) AS total_value
        FROM warehouses w
        LEFT JOIN stock_levels sl ON sl.warehouse_id = w.id
        GROUP BY w.id ORDER BY total_value DESC`,
      params: [],
    }),
  },
];

// ─── Date range extraction ──────────────────────────────────────────────────

function extractDateRange(text) {
  const now = new Date();
  const todayStr = today();

  if (/(النهارده|today|اليوم)/i.test(text)) {
    return { start_date: todayStr, end_date: todayStr };
  }
  if (/(امبارح|yesterday|البارح)/i.test(text)) {
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    return { start_date: today(yest), end_date: today(yest) };
  }
  if (/(الاسبوع ده|هذا الاسبوع|this week)/i.test(text)) {
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return { start_date: today(weekStart), end_date: todayStr };
  }
  if (/(الاسبوع الماضي|last week)/i.test(text)) {
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay() - 7);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
    return { start_date: today(weekStart), end_date: today(weekEnd) };
  }
  if (/(الشهر ده|هذا الشهر|this month)/i.test(text)) {
    return { start_date: today(new Date(now.getFullYear(), now.getMonth(), 1)), end_date: todayStr };
  }
  if (/(الشهر الماضي|last month)/i.test(text)) {
    const lm = new Date(now.getFullYear(), now.getMonth(), 1);
    lm.setDate(lm.getDate() - 1);
    const lmStart = new Date(lm.getFullYear(), lm.getMonth(), 1);
    return { start_date: today(lmStart), end_date: today(lm) };
  }
  return {};
}

// ─── Extract item name ──────────────────────────────────────────────────────

function extractItemName(text) {
  const patterns = [
    /(?:رصيد|stock of|كمية|مخزون) (\S+)/i,
    /(\S+) (?:رصيد|stock)/i,
    /صنف (\S+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

// ─── Arabic text normalisation ──────────────────────────────────────────────

function normalizeArabic(text) {
  return text
    .replace(/[؟?]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F]/g, "") // remove tashkeel
    .trim()
    .toLowerCase();
}

// ─── Match query intent ─────────────────────────────────────────────────────

function matchQuery(text) {
  const normalized = normalizeArabic(text);
  for (const intent of QUERY_INTENTS) {
    for (const pattern of intent.patterns) {
      if (normalized.includes(normalizeArabic(pattern))) return intent;
    }
  }
  // fallback: check for partial keyword match
  for (const intent of QUERY_INTENTS) {
    for (const pattern of intent.patterns) {
      const normPattern = normalizeArabic(pattern);
      const words = normPattern.split(/\s+/);
      const matchCount = words.filter(w => normalized.includes(w)).length;
      if (matchCount >= Math.min(2, words.length)) return intent;
    }
  }
  return null;
}

// ─── Execute a single SQL query ─────────────────────────────────────────────

function execQuery(db, intent, params) {
  const result = intent.sql(params || {});
  if (result.isComparison) {
    const aResult = db.prepare(result.queries[0].sql).get(...result.queries[0].params);
    const bResult = db.prepare(result.queries[1].sql).get(...result.queries[1].params);
    return {
      type: "comparison",
      label: intent.label,
      labelEn: intent.labelEn,
      periodA: { label: result.queries[0].label, value: Number(aResult?.value || 0), count: Number(aResult?.count || 0) },
      periodB: { label: result.queries[1].label, value: Number(bResult?.value || 0), count: Number(bResult?.count || 0) },
    };
  }
  if (result.isComposite) {
    const parts = {};
    const d = today();
    for (const q of result.queries) {
      const def = q.sql ? q.sql(d) : q;
      const r = db.prepare(def.sql).get(...(def.params || []));
      parts[q.id] = { value: Number(r?.v || 0), count: Number(r?.c || 0) };
    }
    return { type: "summary", label: intent.label, labelEn: intent.labelEn, parts };
  }
  const rows = db.prepare(result.sql).all(...result.params);
  if (intent.display === "number") {
    return { type: "number", label: intent.label, labelEn: intent.labelEn, value: Number(rows[0]?.value || 0), count: Number(rows[0]?.count || 0), data: rows };
  }
  if (intent.display === "chart") {
    return { type: "chart", label: intent.label, labelEn: intent.labelEn, data: rows.map(r => ({ label: r.label || r.name, value: Number(r.value || r.revenue || 0) })) };
  }
  return { type: "table", label: intent.label, labelEn: intent.labelEn, rows };
}

// ─── Anomaly detection ──────────────────────────────────────────────────────

function detectAnomalies(db) {
  const anomalies = [];
  // Check if today's sales dropped > 40% vs yesterday
  const d = today();
  const todaySales = db.prepare("SELECT COALESCE(SUM(total), 0) AS v FROM invoices WHERE status != 'cancelled' AND date(created_at) = date(?)").get(d).v;
  const yesterdaySales = db.prepare("SELECT COALESCE(SUM(total), 0) AS v FROM invoices WHERE status != 'cancelled' AND date(created_at) = date(?, '-1 day')").get(d).v;
  if (Number(yesterdaySales) > 0) {
    const drop = (Number(yesterdaySales) - Number(todaySales)) / Number(yesterdaySales) * 100;
    if (drop > 40) {
      anomalies.push({ type: "sales_drop", severity: "warning", message: `انخفاض المبيعات اليوم ${Math.round(drop)}% مقارنة بأمس`, messageEn: `Sales dropped ${Math.round(drop)}% compared to yesterday` });
    }
  }
  // Check for abnormal expense spike
  const todayExp = db.prepare("SELECT COALESCE(SUM(amount), 0) AS v FROM expenses WHERE date(created_at) = date(?)").get(d).v;
  const weekAvg = db.prepare("SELECT COALESCE(AVG(daily), 0) AS avg FROM (SELECT SUM(amount) AS daily FROM expenses WHERE date(created_at) >= date(?, '-7 day') AND date(created_at) <= date(?) GROUP BY date(created_at))").get(d, d).avg;
  if (Number(weekAvg) > 0 && Number(todayExp) > Number(weekAvg) * 2) {
    anomalies.push({ type: "expense_spike", severity: "info", message: `مصروفات اليوم أعلى من متوسط الأسبوع`, messageEn: "Today's expenses are higher than weekly average" });
  }
  // Check for low stock items
  const lowStockCount = db.prepare("SELECT COUNT(*) AS c FROM (SELECT i.id FROM items i LEFT JOIN stock_levels sl ON sl.item_id = i.id WHERE i.is_active = 1 AND i.min_stock_qty > 0 GROUP BY i.id HAVING COALESCE(SUM(sl.quantity), 0) <= i.min_stock_qty)").get().c;
  if (lowStockCount > 5) {
    anomalies.push({ type: "low_stock", severity: "warning", message: `فيه ${lowStockCount} صنف تحت الحد الأدنى`, messageEn: `${lowStockCount} items below minimum stock` });
  }
  return anomalies;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// POST /api/assistant/query — execute a natural language query
router.post("/query", (req, res, next) => {
  try {
    const db = getDb();
    const { text, context } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ success: false, message: "Query text required" });

    let intent;
    if (context?.intent_id) {
      intent = QUERY_INTENTS.find(i => i.id === context.intent_id);
    }
    if (!intent) {
      intent = matchQuery(text);
    }
    if (!intent) return res.json({ success: false, data: null, message: "لم أفهم السؤال. حاول بصياغة مختلفة." });

    const dateRange = extractDateRange(text);
    const itemName = extractItemName(text);
    const params = { ...dateRange, item_name: itemName };

    let result;
    try {
      result = execQuery(db, intent, params);
    } catch (sqlErr) {
      return res.json({ success: false, message: "عذرا، حدث خطأ أثناء جلب البيانات. تأكد من اتصال قاعدة البيانات.", error: sqlErr.message });
    }

    // If table result has too many rows, summarize
    if (result.type === "table" && result.rows.length > 20) {
      result.summary = `إجمالي ${result.rows.length} نتيجة — اعرض أول 20`;
      result.rows = result.rows.slice(0, 20);
    }

    // Log query history
    try {
      db.prepare("INSERT INTO assistant_query_history (user_id, query_text, result_summary) VALUES (?, ?, ?)")
        .run(req.user.id, text, JSON.stringify({ type: result.type, label: result.label }));
    } catch (_) {}

    const anomalies = /(النهارده|today|اليوم|مبيعات|sales)/i.test(text) ? detectAnomalies(db) : [];

    res.json({ success: true, data: { ...result, anomalies, intent: intent.id } });
  } catch (e) {
    next(e);
  }
});

// POST /api/assistant/multi-turn — execute query with conversation history
router.post("/multi-turn", (req, res, next) => {
  try {
    const db = getDb();
    const { text, history } = req.body || {};
    // history is array of { role, text, result }
    const lastUserQuery = history?.filter(h => h.role === "user").slice(-1)[0]?.text;
    const context = lastUserQuery ? { lastQuery: lastUserQuery } : {};
    // Forward to standard query with context
    const intent = matchQuery(text);
    if (!intent) return res.json({ success: false, data: null, message: "لم أفهم السؤال. حاول بصياغة مختلفة." });

    const dateRange = extractDateRange(text);
    const itemName = extractItemName(text);
    const params = { ...dateRange, item_name: itemName };

    // Inherit date range if not specified and previous had one
    if (!dateRange.start_date && lastUserQuery) {
      const prevRange = extractDateRange(lastUserQuery);
      if (prevRange.start_date) Object.assign(params, prevRange);
    }

    const result = execQuery(db, intent, params);
    const anomalies = detectAnomalies(db);

    try {
      db.prepare("INSERT INTO assistant_query_history (user_id, query_text, result_summary) VALUES (?, ?, ?)")
        .run(req.user.id, text, JSON.stringify({ type: result.type, label: result.label }));
    } catch (_) {}

    res.json({ success: true, data: { ...result, anomalies } });
  } catch (e) {
    next(e);
  }
});

// GET /api/assistant/anomalies — check for latest anomalies
router.get("/anomalies", (req, res, next) => {
  try {
    res.json({ success: true, data: detectAnomalies(getDb()) });
  } catch (e) {
    next(e);
  }
});

// ─── Pinboard (Saved Queries) ───────────────────────────────────────────────

router.get("/pinboard", (req, res, next) => {
  try {
    const items = getDb().prepare("SELECT * FROM assistant_saved_queries WHERE user_id = ? ORDER BY sort_order ASC, created_at DESC").all(req.user.id);
    res.json({ success: true, data: items });
  } catch (e) { next(e); }
});

router.post("/pinboard", (req, res, next) => {
  try {
    const { label, query_text } = req.body || {};
    if (!label || !query_text) return res.status(400).json({ success: false, message: "Label and query required" });
    const r = getDb().prepare("INSERT INTO assistant_saved_queries (user_id, label, query_text) VALUES (?, ?, ?)").run(req.user.id, label, query_text);
    res.json({ success: true, data: { id: r.lastInsertRowid, label, query_text } });
  } catch (e) { next(e); }
});

router.delete("/pinboard/:id", (req, res, next) => {
  try {
    getDb().prepare("DELETE FROM assistant_saved_queries WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.patch("/pinboard/:id", (req, res, next) => {
  try {
    const { label, sort_order, pinned } = req.body || {};
    const sets = []; const binds = [];
    if (label !== undefined) { sets.push("label = ?"); binds.push(label); }
    if (sort_order !== undefined) { sets.push("sort_order = ?"); binds.push(sort_order); }
    if (pinned !== undefined) { sets.push("pinned = ?"); binds.push(pinned ? 1 : 0); }
    if (!sets.length) return res.status(400).json({ success: false, message: "No fields to update" });
    binds.push(req.params.id, req.user.id);
    getDb().prepare(`UPDATE assistant_saved_queries SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`).run(...binds);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ─── Dashboards ─────────────────────────────────────────────────────────────

router.get("/dashboards", (req, res, next) => {
  try {
    const list = getDb().prepare("SELECT * FROM assistant_dashboards WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
    res.json({ success: true, data: list });
  } catch (e) { next(e); }
});

router.post("/dashboards", (req, res, next) => {
  try {
    const { name, queries } = req.body || {};
    if (!name) return res.status(400).json({ success: false, message: "Name required" });
    const r = getDb().prepare("INSERT INTO assistant_dashboards (user_id, name, queries_json) VALUES (?, ?, ?)").run(req.user.id, name, JSON.stringify(queries || []));
    res.json({ success: true, data: { id: r.lastInsertRowid, name } });
  } catch (e) { next(e); }
});

router.put("/dashboards/:id", (req, res, next) => {
  try {
    const { name, queries } = req.body || {};
    const sets = []; const binds = [];
    if (name) { sets.push("name = ?"); binds.push(name); }
    if (queries) { sets.push("queries_json = ?"); binds.push(JSON.stringify(queries)); }
    if (!sets.length) return res.status(400).json({ success: false, message: "No fields" });
    binds.push(req.params.id, req.user.id);
    getDb().prepare(`UPDATE assistant_dashboards SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`).run(...binds);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.delete("/dashboards/:id", (req, res, next) => {
  try {
    getDb().prepare("DELETE FROM assistant_dashboards WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ─── Scheduled Briefings ────────────────────────────────────────────────────

router.get("/briefings", (req, res, next) => {
  try {
    const list = getDb().prepare("SELECT * FROM assistant_scheduled_briefings WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
    res.json({ success: true, data: list });
  } catch (e) { next(e); }
});

router.post("/briefings", (req, res, next) => {
  try {
    const { query_text, schedule } = req.body || {};
    if (!query_text) return res.status(400).json({ success: false, message: "Query required" });
    const r = getDb().prepare("INSERT INTO assistant_scheduled_briefings (user_id, query_text, schedule) VALUES (?, ?, ?)").run(req.user.id, query_text, schedule || "daily");
    res.json({ success: true, data: { id: r.lastInsertRowid } });
  } catch (e) { next(e); }
});

router.delete("/briefings/:id", (req, res, next) => {
  try {
    getDb().prepare("DELETE FROM assistant_scheduled_briefings WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.patch("/briefings/:id/toggle", (req, res, next) => {
  try {
    const row = getDb().prepare("SELECT active FROM assistant_scheduled_briefings WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    getDb().prepare("UPDATE assistant_scheduled_briefings SET active = ? WHERE id = ?").run(row.active ? 0 : 1, req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// GET /api/assistant/briefings/today — fetch scheduled briefings that should run today
router.get("/briefings/today", (req, res, next) => {
  try {
    const db = getDb();
    const briefings = db.prepare("SELECT * FROM assistant_scheduled_briefings WHERE user_id = ? AND active = 1 AND (last_sent_at IS NULL OR date(last_sent_at) < date(?))").all(req.user.id, today());
    const results = [];
    for (const b of briefings) {
      const intent = matchQuery(b.query_text);
      if (intent) {
        const dateRange = extractDateRange(b.query_text);
        const result = execQuery(db, intent, dateRange);
        results.push({ briefing: b, result });
        db.prepare("UPDATE assistant_scheduled_briefings SET last_sent_at = ? WHERE id = ?").run(nowSql(), b.id);
      }
    }
    res.json({ success: true, data: results });
  } catch (e) { next(e); }
});

// ─── Training Progress ──────────────────────────────────────────────────────

router.get("/training/progress", (req, res, next) => {
  try {
    const rows = getDb().prepare("SELECT * FROM training_progress WHERE user_id = ? ORDER BY module_key ASC").all(req.user.id);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/training/progress", (req, res, next) => {
  try {
    const { track, module_key, completed, score, quiz_answers } = req.body || {};
    if (!track || !module_key) return res.status(400).json({ success: false, message: "track and module_key required" });
    const db = getDb();
    const existing = db.prepare("SELECT id FROM training_progress WHERE user_id = ? AND track = ? AND module_key = ?").get(req.user.id, track, module_key);
    if (existing) {
      const sets = []; const binds = [];
      if (completed !== undefined) { sets.push("completed = ?"); binds.push(completed ? 1 : 0); }
      if (score !== undefined) { sets.push("score = ?"); binds.push(score); }
      if (quiz_answers) { sets.push("quiz_answers_json = ?"); binds.push(JSON.stringify(quiz_answers)); }
      if (completed) { sets.push("completed_at = ?"); binds.push(nowSql()); }
      if (sets.length) {
        binds.push(existing.id);
        db.prepare(`UPDATE training_progress SET ${sets.join(", ")} WHERE id = ?`).run(...binds);
      }
    } else {
      db.prepare("INSERT INTO training_progress (user_id, track, module_key, completed, score, quiz_answers_json) VALUES (?, ?, ?, ?, ?, ?)")
        .run(req.user.id, track, module_key, completed ? 1 : 0, score || null, quiz_answers ? JSON.stringify(quiz_answers) : null);
    }
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ─── Quiz Submission + Weakness Tracking ─────────────────────────────────────

router.post("/training/quiz", (req, res, next) => {
  try {
    const { track, module_key, answers } = req.body || {};
    if (!track || !module_key || !answers) return res.status(400).json({ success: false, message: "track, module_key, answers required" });
    const db = getDb();
    let correctCount = 0;
    const weaknesses = [];
    for (const a of answers) {
      if (a.correct) correctCount++;
      else if (a.question) {
        weaknesses.push({ user_id: req.user.id, module_key, question: a.question, wrong_answer: a.given, correct_answer: a.correctAnswer });
      }
    }
    const total = answers.length;
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    // Save progress
    const existing = db.prepare("SELECT id FROM training_progress WHERE user_id = ? AND track = ? AND module_key = ?").get(req.user.id, track, module_key);
    if (existing) {
      db.prepare("UPDATE training_progress SET completed = 1, score = ?, quiz_answers_json = ?, completed_at = ? WHERE id = ?")
        .run(score, JSON.stringify(answers), nowSql(), existing.id);
    } else {
      db.prepare("INSERT INTO training_progress (user_id, track, module_key, completed, score, quiz_answers_json, completed_at) VALUES (?, ?, ?, 1, ?, ?, ?)")
        .run(req.user.id, track, module_key, score, JSON.stringify(answers), nowSql());
    }

    // Log weaknesses
    const insertW = db.prepare("INSERT INTO training_weaknesses (user_id, module_key, question, wrong_answer, correct_answer) VALUES (?, ?, ?, ?, ?)");
    for (const w of weaknesses) insertW.run(w.user_id, w.module_key, w.question, w.wrong_answer, w.correct_answer);

    // Update weakness analytics based on this quiz
    const weakCount = db.prepare("SELECT COUNT(*) AS c FROM training_weaknesses WHERE user_id = ? AND module_key = ?").get(req.user.id, module_key).c;

    res.json({ success: true, data: { score, correct: correctCount, total, weakCount } });
  } catch (e) { next(e); }
});

// GET /api/assistant/training/weaknesses — weakness analytics
router.get("/training/weaknesses", (req, res, next) => {
  try {
    const rows = getDb().prepare(`
      SELECT module_key, question, COUNT(*) AS fail_count, wrong_answer, correct_answer
      FROM training_weaknesses WHERE user_id = ?
      GROUP BY module_key, question ORDER BY fail_count DESC LIMIT 20
    `).all(req.user.id);
    // Group by module for easier rendering
    const grouped = {};
    for (const r of rows) {
      if (!grouped[r.module_key]) grouped[r.module_key] = { module: r.module_key, weaknesses: [] };
      grouped[r.module_key].weaknesses.push(r);
    }
    res.json({ success: true, data: { list: rows, grouped: Object.values(grouped) } });
  } catch (e) { next(e); }
});

// GET /api/assistant/training/assignments — manager view of all assignments
router.get("/training/assignments", (req, res, next) => {
  try {
    const rows = getDb().prepare(`
      SELECT ta.*, assigned_by_user.username AS assigned_by_name, assigned_to_user.username AS assigned_to_name
      FROM training_assignments ta
      JOIN users assigned_by_user ON assigned_by_user.id = ta.assigned_by
      JOIN users assigned_to_user ON assigned_to_user.id = ta.assigned_to
      ORDER BY ta.created_at DESC
    `).all();
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// Get assignments for current user
router.get("/training/assignments/mine", (req, res, next) => {
  try {
    const rows = getDb().prepare(`
      SELECT ta.*, u.username AS assigned_by_name
      FROM training_assignments ta
      JOIN users u ON u.id = ta.assigned_by
      WHERE ta.assigned_to = ?
      ORDER BY ta.created_at DESC
    `).all(req.user.id);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/training/assignments", (req, res, next) => {
  try {
    const { assigned_to, track, deadline } = req.body || {};
    if (!assigned_to || !track) return res.status(400).json({ success: false, message: "assigned_to and track required" });
    const r = getDb().prepare("INSERT INTO training_assignments (assigned_by, assigned_to, track, deadline, status) VALUES (?, ?, ?, ?, 'pending')")
      .run(req.user.id, assigned_to, track, deadline || null);
    res.json({ success: true, data: { id: r.lastInsertRowid } });
  } catch (e) { next(e); }
});

router.patch("/training/assignments/:id/status", (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ success: false, message: "Status required" });
    getDb().prepare("UPDATE training_assignments SET status = ? WHERE id = ? AND assigned_to = ?").run(status, req.params.id, req.user.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// GET /api/assistant/training/users — list users for manager assignment (exclude current user)
router.get("/training/users", (req, res, next) => {
  try {
    const rows = getDb().prepare("SELECT id, username, full_name, role FROM users WHERE is_active = 1 AND id != ? ORDER BY username ASC").all(req.user.id);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// GET /api/assistant/training/weaknesses/all — manager view of all weaknesses
router.get("/training/weaknesses/all", (req, res, next) => {
  try {
    const rows = getDb().prepare(`
      SELECT tw.*, u.username
      FROM training_weaknesses tw
      JOIN users u ON u.id = tw.user_id
      ORDER BY tw.failed_at DESC LIMIT 50
    `).all();
    const grouped = {};
    for (const r of rows) {
      const key = `${r.username}_${r.module_key}`;
      if (!grouped[key]) grouped[key] = { username: r.username, module: r.module_key, count: 0, items: [] };
      grouped[key].count++;
      if (grouped[key].items.length < 5) grouped[key].items.push(r);
    }
    res.json({ success: true, data: Object.values(grouped) });
  } catch (e) { next(e); }
});

// ─── Daily Tip ──────────────────────────────────────────────────────────────

// GET /api/assistant/daily-tip — get a tip for today (rotates by day of year)
router.get("/daily-tip", (req, res, next) => {
  try {
    const db = getDb();
    const now = new Date();
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    const allTips = db.prepare("SELECT * FROM assistant_daily_tips WHERE active = 1").all();
    if (!allTips.length) return res.json({ success: true, data: null });
    // Filter by role if user has one
    const user = db.prepare("SELECT role FROM users WHERE id = ?").get(req.user.id);
    let filtered = allTips;
    if (user?.role) {
      const roleTips = allTips.filter(t => !t.role_filter || t.role_filter === user.role);
      if (roleTips.length > 0) filtered = roleTips;
    }
    const tipIndex = dayOfYear % filtered.length;
    // Check if user already saw today's tip
    res.json({ success: true, data: filtered[tipIndex] });
  } catch (e) { next(e); }
});

// ─── Export query results ───────────────────────────────────────────────────

router.post("/export", (req, res, next) => {
  try {
    const { type, label, data, format } = req.body || {};
    if (!data) return res.status(400).json({ success: false, message: "No data to export" });
    if (format === "csv") {
      let csv = "";
      if (type === "table" && Array.isArray(data.rows)) {
        const headers = Object.keys(data.rows[0] || {});
        csv = headers.join(",") + "\n";
        for (const row of data.rows) {
          csv += headers.map(h => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(",") + "\n";
        }
      } else if (type === "number") {
        csv = `${label},${data.value}\n`;
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="assistant-export-${Date.now()}.csv"`);
      // Add BOM for Arabic Excel support
      res.send("\uFEFF" + csv);
    } else {
      // JSON export
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="assistant-export-${Date.now()}.json"`);
      res.json(data);
    }
  } catch (e) { next(e); }
});

module.exports = router;
