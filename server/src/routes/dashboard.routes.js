const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission, userHasPagePermission } = require("../middleware/permission");
const { addDateFilter, getCostColumn, getReturnCostColumn, stockCostJoin, itemsCostJoin } = require("../reports/helpers");
const { today } = require("../utils/datetime");

const SENSITIVE = Symbol("redacted");

// Aggregate the key KPIs for an arbitrary [start, end] window. Used by /period-compare
// so the same definitions back both sides of a comparison. Dates are inclusive (DATE()).
function periodMetrics(db, start, end, costMethod = "wacc") {
  const costCol = getCostColumn(costMethod);

  const p1 = [];
  const head = db.prepare(`
    SELECT COUNT(i.id) AS invoice_count,
      COALESCE(SUM(i.total), 0) AS gross_sales,
      COALESCE(SUM(i.discount), 0) AS total_discount
    FROM invoices i
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", start, end, p1)}
  `).get(...p1);

  const p2 = [];
  const qty = db.prepare(`
    SELECT COALESCE(SUM(il.quantity), 0) AS items_sold,
      COALESCE(SUM(il.quantity * ${costCol}), 0) AS cost
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    ${itemsCostJoin("il")}
    ${stockCostJoin("il")}
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", start, end, p2)}
  `).get(...p2);

  const p3 = [];
  const ret = db.prepare(`
    SELECT COALESCE(SUM(sr.total), 0) AS returns_total
    FROM sales_returns sr WHERE sr.status = 'active' ${addDateFilter("sr.created_at", start, end, p3)}
  `).get(...p3);

  const p4 = [];
  const retc = db.prepare(`
    SELECT COALESCE(SUM(srl.quantity * ${getReturnCostColumn(costMethod)}), 0) AS return_cost
    FROM sales_returns sr
    JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
    LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
    LEFT JOIN items it ON it.id = srl.item_id
    WHERE sr.status = 'active' ${addDateFilter("sr.created_at", start, end, p4)}
  `).get(...p4);

  const p5 = [];
  const topItem = db.prepare(`
    SELECT it.name AS name, SUM(il.line_total * i.total / NULLIF(invs.line_sum, 0)) AS value
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    JOIN items it ON it.id = il.item_id
    LEFT JOIN (SELECT invoice_id, SUM(line_total) AS line_sum FROM invoice_lines GROUP BY invoice_id) invs ON invs.invoice_id = il.invoice_id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", start, end, p5)}
    GROUP BY it.id ORDER BY value DESC LIMIT 1
  `).get(...p5);

  const p6 = [];
  const topCat = db.prepare(`
    SELECT COALESCE(c.name, 'غير مصنف') AS name, SUM(il.line_total * i.total / NULLIF(invs.line_sum, 0)) AS value
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    JOIN items it ON it.id = il.item_id
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN (SELECT invoice_id, SUM(line_total) AS line_sum FROM invoice_lines GROUP BY invoice_id) invs ON invs.invoice_id = il.invoice_id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", start, end, p6)}
    GROUP BY c.id ORDER BY value DESC LIMIT 1
  `).get(...p6);

  const grossSales = Number(head.gross_sales || 0);
  const returnsTotal = Number(ret.returns_total || 0);
  const cost = Number(qty.cost || 0);
  const returnCost = Number(retc.return_cost || 0);
  const netSales = grossSales - returnsTotal;
  const grossProfit = netSales - cost + returnCost;
  const invoiceCount = Number(head.invoice_count || 0);

  return {
    gross_sales: grossSales,
    net_sales: netSales,
    gross_profit: grossProfit,
    margin_percent: netSales > 0 ? Math.round((grossProfit / netSales) * 1000) / 10 : 0,
    invoice_count: invoiceCount,
    items_sold: Number(qty.items_sold || 0),
    avg_basket: invoiceCount > 0 ? Math.round((grossSales / invoiceCount) * 100) / 100 : 0,
    returns_total: returnsTotal,
    return_rate: grossSales > 0 ? Math.round((returnsTotal / grossSales) * 1000) / 10 : 0,
    total_discount: Number(head.total_discount || 0),
    top_item: topItem ? { name: topItem.name, value: Number(topItem.value || 0) } : null,
    top_category: topCat ? { name: topCat.name, value: Number(topCat.value || 0) } : null,
  };
}

function redactSensitive(obj, keys) {
  for (const k of keys) {
    if (k in obj) obj[k] = null;
  }
  return obj;
}

const router = express.Router();
router.use(authRequired);

router.get("/", requirePagePermission("analytics", "view"), (req, res) => {
  const db = getDb();
  const canView = userHasPagePermission(req.user, "analytics", "view_sensitive");
  const todaySales = db.prepare("SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE status != 'cancelled' AND date(created_at)=?").get(today()).total;
  const weekSales = db.prepare("SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE status != 'cancelled' AND date(created_at) >= date(?, '-7 day')").get(today()).total;
  const itemsCount = db.prepare("SELECT COUNT(*) AS c FROM items WHERE deleted_at IS NULL").get().c;
  const customersCount = db.prepare("SELECT COUNT(*) AS c FROM customers").get().c;
  const openShift = db.prepare("SELECT * FROM shifts WHERE status='open' ORDER BY id DESC LIMIT 1").get() || null;
  const schedBase = `FROM ajal_schedules sch
    JOIN ajal_debts d ON d.id = sch.debt_id
    JOIN invoices inv ON inv.id = d.invoice_id AND inv.payment_type = 'installments'
    WHERE sch.status != 'paid' AND d.status NOT IN ('paid','voided') AND COALESCE(d.party_type,'customer') = 'customer'`;
  const overdueInstallments = db.prepare(`SELECT COUNT(*) AS c ${schedBase} AND date(sch.due_date) < date(?)`).get(today()).c;
  const dueTodayInstallments = db.prepare(`SELECT COUNT(*) AS c ${schedBase} AND date(sch.due_date) = date(?)`).get(today()).c;
  const upcomingInstallments = db.prepare(`SELECT COUNT(*) AS c ${schedBase} AND date(sch.due_date) >= date(?)`).get(today()).c;
  let data = { todaySales, weekSales, itemsCount, customersCount, openShift, upcomingInstallments, overdueInstallments, dueTodayInstallments };
  if (!canView) redactSensitive(data, ["todaySales", "weekSales"]);
  res.json({ success: true, data });
});

router.get("/comparison", requirePagePermission("analytics", "view"), (req, res) => {
  const db = getDb();
  const canView = userHasPagePermission(req.user, "analytics", "view_sensitive");
  const d = today();
  const todaySales = db.prepare("SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS c FROM invoices WHERE status != 'cancelled' AND date(created_at)=?").get(d);
  const yesterdaySales = db.prepare("SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS c FROM invoices WHERE status != 'cancelled' AND date(created_at)=date(?, '-1 day')").get(d);
  const thisWeek = db.prepare("SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS c FROM invoices WHERE status != 'cancelled' AND date(created_at) >= date(?, '-7 day') AND date(created_at) <= date(?)").get(d, d);
  const lastWeek = db.prepare("SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS c FROM invoices WHERE status != 'cancelled' AND date(created_at) >= date(?, '-14 day') AND date(created_at) < date(?, '-7 day')").get(d, d);
  let data = {
    today: { sales: canView ? todaySales.total : null, count: todaySales.c },
    yesterday: { sales: canView ? yesterdaySales.total : null, count: yesterdaySales.c },
    this_week: { sales: canView ? thisWeek.total : null, count: thisWeek.c },
    last_week: { sales: canView ? lastWeek.total : null, count: lastWeek.c },
  };
  res.json({ success: true, data });
});

router.get("/cash-flow", requirePagePermission("analytics", "view"), (req, res) => {
  const db = getDb();
  const canView = userHasPagePermission(req.user, "analytics", "view_sensitive");
  const { start_date, end_date } = req.query;
  // Period-aware: when the analytics period selector passes dates, the cash-flow chart
  // follows it; otherwise it falls back to the legacy trailing 14-day window.
  const cteParams = [];
  if (start_date) {
    cteParams.push(start_date);
  } else {
    const d = new Date(); d.setDate(d.getDate() - 13);
    cteParams.push(d.toISOString().slice(0, 10));
  }
  if (end_date) {
    cteParams.push(end_date);
  } else {
    cteParams.push(today());
  }
  const startSql = "date(?)";
  const endSql = "date(?)";
  const days = db.prepare(`
    WITH RECURSIVE dates(d) AS (
      SELECT ${startSql}
      UNION ALL SELECT date(d, '+1 day') FROM dates WHERE d < ${endSql}
    )
    SELECT dates.d AS date,
      COALESCE(inv.total_sales, 0) AS sales,
      COALESCE(rev.total_revenues, 0) AS revenues,
      COALESCE(exp.total_expenses, 0) AS expenses,
      COALESCE(wd.total_withdrawals, 0) AS withdrawals
    FROM dates
    LEFT JOIN (SELECT date(created_at) AS d, COALESCE(SUM(total), 0) AS total_sales FROM invoices WHERE status != 'cancelled' GROUP BY d) inv ON inv.d = dates.d
    LEFT JOIN (SELECT date(created_at) AS d, COALESCE(SUM(amount), 0) AS total_revenues FROM revenues GROUP BY d) rev ON rev.d = dates.d
    LEFT JOIN (SELECT date(created_at) AS d, COALESCE(SUM(amount), 0) AS total_expenses FROM expenses GROUP BY d) exp ON exp.d = dates.d
    LEFT JOIN (SELECT date(created_at) AS d, COALESCE(SUM(amount), 0) AS total_withdrawals FROM withdrawals GROUP BY d) wd ON wd.d = dates.d
    ORDER BY dates.d ASC
  `).all(...cteParams);
  let enriched = days.map(r => ({
    date: r.date,
    sales: Number(r.sales),
    revenues: Number(r.revenues),
    expenses: Number(r.expenses),
    withdrawals: Number(r.withdrawals),
    net: Number(r.sales) + Number(r.revenues) - Number(r.expenses) - Number(r.withdrawals),
  }));
  if (!canView) {
    enriched = enriched.map(r => redactSensitive({ ...r }, ["sales", "revenues", "expenses", "withdrawals", "net"]));
  }
  res.json({ success: true, data: enriched });
});

// GET /api/dashboard/heatmap — sales density by calendar day x hour (used by AnalyticsPage heatmap)
// Unlike the reports-center weekday heatmap (R07), this groups by actual date so a longer
// range produces one row per day. Query params: start_date, end_date.
router.get("/heatmap", requirePagePermission("analytics", "view"), (req, res) => {
  try {
    const db = getDb();
    const canView = userHasPagePermission(req.user, "analytics", "view_sensitive");
    const { start_date, end_date } = req.query;
    const conditions = ["status != 'cancelled'"];
    const params = [];
    if (start_date) { conditions.push("DATE(created_at) >= ?"); params.push(start_date); }
    if (end_date) { conditions.push("DATE(created_at) <= ?"); params.push(end_date); }
    const rows = db.prepare(`
      SELECT
        DATE(created_at) AS day,
        strftime('%H:00', created_at) AS hour_slot,
        COUNT(*) AS invoice_count,
        SUM(total) AS total_sales,
        AVG(total) AS avg_sale
      FROM invoices
      WHERE ${conditions.join(" AND ")}
      GROUP BY day, hour_slot
      ORDER BY day, hour_slot
    `).all(...params);
    let data = rows.map(r => ({
      day: r.day,
      hour_slot: r.hour_slot,
      invoice_count: Number(r.invoice_count || 0),
      total_sales: Number(r.total_sales || 0),
      avg_sale: Number(r.avg_sale || 0),
    }));
    if (!canView) {
      data = data.map(r => redactSensitive({ ...r }, ["total_sales", "avg_sale"]));
    }
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/dashboard/export-snapshot — generate PDF snapshot of analytics overview
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const os = require("os");

router.post("/export-snapshot", requirePagePermission("analytics", "export"), async (req, res) => {
  try {
    const payload = req.body || {};
    const FONT_ARIAL = "C:\\Windows\\Fonts\\arial.ttf";
    const FONT_ARIAL_BOLD = "C:\\Windows\\Fonts\\arialbd.ttf";
    const filePath = path.join(os.tmpdir(), `analytics-snapshot-${Date.now()}.pdf`);
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.rect(0, 0, doc.page.width, 8).fill("#0f172a");
    doc.fontSize(20).font(FONT_ARIAL_BOLD).fillColor("#0f172a");
    doc.text("لمحة تحليلات", 40, 24, { align: "center" });
    doc.fontSize(9).font(FONT_ARIAL).fillColor("#64748b");
    doc.text(`تم الإنشاء: ${new Date(payload.generated_at || Date.now()).toLocaleString("ar-EG-u-nu-latn")}`, 40, 48, { align: "center" });
    doc.y = 70;

    // Summary metrics row
    const s = payload.summary || {};
    doc.rect(40, doc.y, doc.page.width - 80, 50).fill("#f8fafc");
    doc.rect(40, doc.y, doc.page.width - 80, 50).stroke("#e2e8f0");
    const metrics = [
      { label: "مبيعات اليوم", val: s.today_sales },
      { label: "مبيعات الأسبوع", val: s.week_sales },
      { label: "الأصناف", val: s.items_count },
      { label: "العملاء", val: s.customers_count },
    ];
    const mw = (doc.page.width - 80) / metrics.length;
    metrics.forEach((m, i) => {
      const x = 40 + i * mw;
      doc.fontSize(8).font(FONT_ARIAL).fillColor("#64748b").text(m.label, x + 4, doc.y + 6, { width: mw - 8, align: "center" });
      doc.fontSize(14).font(FONT_ARIAL_BOLD).fillColor("#0f172a").text(
        m.val != null ? `${Number(m.val).toLocaleString("en-US")} ج.م` : "—",
        x + 4, doc.y + 20, { width: mw - 8, align: "center" }
      );
      doc.y = 70;
    });
    doc.y = 130;

    // Revenue/Expenses
    const re = payload.revenue_expenses || {};
    doc.fontSize(8).font(FONT_ARIAL).fillColor("#64748b").text("إيرادات ومصروفات اليوم", 40, doc.y, { align: "right" });
    doc.y += 14;
    doc.rect(40, doc.y, (doc.page.width - 80) / 2, 20).fill("#f0fdf4").stroke("#d1fae5");
    doc.fontSize(10).font(FONT_ARIAL).fillColor("#065f46").text(`إيرادات: ${Number(re.revenues || 0).toLocaleString("en-US")} ج.م`, 44, doc.y + 4);
    doc.rect(40 + (doc.page.width - 80) / 2, doc.y, (doc.page.width - 80) / 2, 20).fill("#fef2f2").stroke("#fecaca");
    doc.fillColor("#991b1b").text(`مصروفات: ${Number(re.expenses || 0).toLocaleString("en-US")} ج.م`, 44 + (doc.page.width - 80) / 2, doc.y + 4);
    doc.y += 28;

    // Comparison
    const cmp = payload.comparison || {};
    if (cmp.today || cmp.this_week) {
      doc.fontSize(8).font(FONT_ARIAL).fillColor("#64748b").text("مقارنة الفترات", 40, doc.y, { align: "right" });
      doc.y += 14;
      doc.fontSize(9).font(FONT_ARIAL).fillColor("#0f172a");
      doc.text(`مبيعات اليوم: ${cmp.today?.sales != null ? `${Number(cmp.today.sales).toLocaleString("en-US")} ج.م` : "—"}`, 40, doc.y);
      doc.text(`أمس: ${cmp.yesterday?.sales != null ? `${Number(cmp.yesterday.sales).toLocaleString("en-US")} ج.م` : "—"}`, 200, doc.y);
      doc.y += 14;
      doc.text(`مبيعات الأسبوع: ${cmp.this_week?.sales != null ? `${Number(cmp.this_week.sales).toLocaleString("en-US")} ج.م` : "—"}`, 40, doc.y);
      doc.text(`الأسبوع الماضي: ${cmp.last_week?.sales != null ? `${Number(cmp.last_week.sales).toLocaleString("en-US")} ج.م` : "—"}`, 200, doc.y);
      doc.y += 14;
    }

    // Cash flow summary
    const cf = payload.cash_flow_summary || {};
    if (cf.total_in != null || cf.total_out != null) {
      doc.y += 4;
      doc.fontSize(8).font(FONT_ARIAL).fillColor("#64748b").text("التدفق النقدي (١٤ يوم)", 40, doc.y, { align: "right" });
      doc.y += 14;
      doc.fontSize(9).font(FONT_ARIAL).fillColor("#065f46").text(`داخل: ${Number(cf.total_in || 0).toLocaleString("en-US")} ج.م`, 40, doc.y);
      doc.fillColor("#991b1b").text(`خارج: ${Number(cf.total_out || 0).toLocaleString("en-US")} ج.م`, 200, doc.y);
      doc.fillColor("#0f172a").text(`صافي: ${Number(cf.net || 0).toLocaleString("en-US")} ج.م`, 360, doc.y);
      doc.y += 20;
    }

    // Top customers
    const customers = payload.top_customers || [];
    if (customers.length) {
      doc.fontSize(8).font(FONT_ARIAL).fillColor("#64748b").text("أفضل العملاء", 40, doc.y, { align: "right" });
      doc.y += 14;
      const tableY = doc.y;
      doc.rect(40, tableY, doc.page.width - 80, 18 + customers.length * 16).fill("#fafafa").stroke("#e2e8f0");
      doc.fontSize(8).font(FONT_ARIAL_BOLD).fillColor("#0f172a");
      doc.text("العميل", 44, tableY + 4, { width: 200 });
      doc.text("المبيعات", 250, tableY + 4, { width: 100, align: "center" });
      doc.text("الفواتير", 360, tableY + 4, { width: 80, align: "center" });
      customers.forEach((c, i) => {
        const ry = tableY + 18 + i * 16;
        doc.fontSize(8).font(FONT_ARIAL).fillColor("#334155");
        doc.text(c.name || "—", 44, ry, { width: 200 });
        doc.text(c.sales != null ? `${Number(c.sales).toLocaleString("en-US")} ج.م` : "—", 250, ry, { width: 100, align: "center" });
        doc.text(String(c.invoices || 0), 360, ry, { width: 80, align: "center" });
      });
      doc.y = tableY + 18 + customers.length * 16 + 8;
    }

    // Top items
    const items = payload.top_items || [];
    if (items.length) {
      doc.y += 4;
      doc.fontSize(8).font(FONT_ARIAL).fillColor("#64748b").text("الأصناف الأكثر مبيعاً", 40, doc.y, { align: "right" });
      doc.y += 14;
      const tableY = doc.y;
      doc.rect(40, tableY, doc.page.width - 80, 18 + items.length * 16).fill("#fafafa").stroke("#e2e8f0");
      doc.fontSize(8).font(FONT_ARIAL_BOLD).fillColor("#0f172a");
      doc.text("الصنف", 44, tableY + 4, { width: 180 });
      doc.text("الإيراد", 230, tableY + 4, { width: 100, align: "center" });
      doc.text("الكمية", 340, tableY + 4, { width: 60, align: "center" });
      items.forEach((item, i) => {
        const ry = tableY + 18 + i * 16;
        doc.fontSize(8).font(FONT_ARIAL).fillColor("#334155");
        doc.text(item.name || "—", 44, ry, { width: 180 });
        doc.text(item.revenue != null ? `${Number(item.revenue).toLocaleString("en-US")} ج.م` : "—", 230, ry, { width: 100, align: "center" });
        doc.text(String(item.qty || 0), 340, ry, { width: 60, align: "center" });
      });
      doc.y = tableY + 18 + items.length * 16 + 8;
    }

    // Footer
    doc.y = Math.max(doc.y + 10, doc.page.height - 60);
    doc.fontSize(7).font(FONT_ARIAL).fillColor("#94a3b8");
    doc.text("ElHegazi Retailer — لمحة تحليلات آلية", 40, doc.y, { align: "center" });

    doc.end();
    await new Promise((resolve) => stream.on("finish", resolve));

    const buffer = fs.readFileSync(filePath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="analytics-snapshot-${Date.now()}.pdf"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
    res.on("finish", () => { try { fs.unlinkSync(filePath); } catch {} });
  } catch (e) {
    console.error("[SNAPSHOT] ERROR:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/dashboard/period-summary — full KPI bundle for a single window (used by the
// return-rate card and any period-scoped KPI). Reuses the same definitions as compare.
router.get("/period-summary", requirePagePermission("analytics", "view"), (req, res) => {
  try {
    const db = getDb();
    const canView = userHasPagePermission(req.user, "analytics", "view_sensitive");
    const { start_date, end_date } = req.query;
    const m = periodMetrics(db, start_date || null, end_date || null);
    if (!canView) {
      m.gross_sales = null;
      m.net_sales = null;
      m.gross_profit = null;
      m.margin_percent = null;
      m.avg_basket = null;
      m.returns_total = null;
      m.total_discount = null;
      if (m.top_item) m.top_item.value = null;
      if (m.top_category) m.top_category.value = null;
    }
    res.json({ success: true, data: m });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/dashboard/period-compare — compare two arbitrary date windows side by side.
// Query params: a_start, a_end, b_start, b_end (all inclusive DATE() bounds).
router.get("/period-compare", requirePagePermission("analytics", "view"), (req, res) => {
  try {
    const db = getDb();
    const canView = userHasPagePermission(req.user, "analytics", "view_sensitive");
    const { a_start, a_end, b_start, b_end } = req.query;
    const a = periodMetrics(db, a_start || null, a_end || null);
    const b = periodMetrics(db, b_start || null, b_end || null);
    if (!canView) {
      for (const m of [a, b]) {
        m.gross_sales = null;
        m.net_sales = null;
        m.gross_profit = null;
        m.margin_percent = null;
        m.avg_basket = null;
        m.returns_total = null;
        m.total_discount = null;
        if (m.top_item) m.top_item.value = null;
        if (m.top_category) m.top_category.value = null;
      }
    }
    res.json({ success: true, data: { a, b } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/dashboard/inventory-health — true counts (not capped by display slices and
// not coupled to the expiry tab filter the way the old client-side sum was).
router.get("/inventory-health", requirePagePermission("analytics", "view"), (req, res) => {
  try {
    const db = getDb();
    const lowStock = db.prepare(`
      SELECT COUNT(*) AS c FROM (
        SELECT i.id
        FROM items i
        LEFT JOIN stock_levels sl ON sl.item_id = i.id
        WHERE i.is_active = 1 AND COALESCE(i.min_stock_qty, 0) > 0
        GROUP BY i.id
        HAVING COALESCE(SUM(sl.quantity), 0) <= i.min_stock_qty
      )
    `).get().c || 0;

    const belowMargin = db.prepare(`
      SELECT COUNT(*) AS c
      FROM items i
      LEFT JOIN (SELECT item_id, MAX(wacc) AS wacc FROM stock_levels GROUP BY item_id) sl ON sl.item_id = i.id
      WHERE i.is_active = 1 AND i.sale_price > 0
        AND COALESCE(sl.wacc, i.purchase_price, 0) >= i.sale_price
    `).get().c || 0;

    let expiring = 0;
    try {
      expiring = db.prepare(`
        SELECT COUNT(*) AS c FROM item_batches ib
        WHERE ib.quantity > 0 AND ib.expiry_date IS NOT NULL
          AND ib.expiry_date <= date('now', '+30 days')
      `).get().c || 0;
    } catch (_) { /* item_batches may not exist on older schemas */ }

    res.json({
      success: true,
      data: {
        low_stock: lowStock,
        below_margin: belowMargin,
        expiring_soon: expiring,
        total: lowStock + belowMargin + expiring,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
