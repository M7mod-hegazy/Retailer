/**
 * Pricing system API routes
 * - GET  /api/pricing/history          — global price change history (master changes)
 * - GET  /api/pricing/history/:itemId  — per-item price change history
 * - GET  /api/pricing/overrides        — invoice-level price overrides
 * - GET  /api/pricing/analytics        — summary widgets for the history tab
 * - GET  /api/pricing/integrity/last   — last integrity check run
 * - POST /api/pricing/integrity/run    — run a new integrity check
 * - POST /api/pricing/integrity/resolve/:issueId — resolve an issue
 * - GET  /api/pricing/profit-analysis  — compute profit analysis for a list of lines
 */
const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");
const { listOverrides } = require("../services/overrideTrackingService");
const { runFullCheck, resolveIssue, getLastCheckRun } = require("../services/integrityCheckService");
const { computePurchaseProfitAnalysis } = require("../services/costingService");

const router = express.Router();
router.use(authRequired);

function requireSystemOwner(req, res, next) {
  if (["system_owner", "admin", "dev"].includes(req.user?.role)) return next();
  return res.status(403).json({ success: false, error: "permission_denied", role: "system_owner" });
}

// ── Product list (items with price history) ───────────────────────────────────
router.get("/product-list", requirePagePermission("bulk_price_update", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const { search, category_id, limit = 20, page = 1 } = req.query;
    const safeLimit  = Math.min(50, Number(limit) || 20);
    const safeOffset = (Math.max(1, Number(page)) - 1) * safeLimit;
    const params = [];
    let where = "i.deleted_at IS NULL";
    if (search) {
      where += " AND (i.name LIKE ? OR i.code LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category_id) {
      where += " AND i.category_id = ?";
      params.push(Number(category_id));
    }
    const total = db.prepare(`
      SELECT COUNT(DISTINCT i.id) as cnt
      FROM items i JOIN price_history ph ON ph.item_id = i.id
      WHERE ${where}
    `).get(...params)?.cnt || 0;
    const rows = db.prepare(`
      SELECT i.id, i.name, i.code, i.sale_price, i.purchase_price, i.wholesale_price,
             c.name AS category_name,
             COUNT(ph.id) AS change_count,
             MAX(ph.changed_at) AS latest_change
      FROM items i
      JOIN price_history ph ON ph.item_id = i.id
      LEFT JOIN item_categories c ON c.id = i.category_id
      WHERE ${where}
      GROUP BY i.id
      ORDER BY latest_change DESC
      LIMIT ? OFFSET ?
    `).all(...params, safeLimit, safeOffset);
    res.json({ success: true, data: rows, total, page: Number(page), limit: safeLimit });
  } catch (e) { next(e); }
});

// ── Global price history (master changes only) ────────────────────────────────
router.get("/history", requirePagePermission("bulk_price_update", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const {
      item_id, field, source, from_date, to_date,
      search, category_id, changed_by,
      sort = "changed_at", dir = "desc",
      page = 1, limit = 50,
    } = req.query;

    const conditions = ["ph.item_id IS NOT NULL"];
    const params = [];

    if (item_id)    { conditions.push("ph.item_id = ?");       params.push(Number(item_id)); }
    if (field)      { conditions.push("ph.field = ?");          params.push(field); }
    if (source)     { conditions.push("ph.source = ?");         params.push(source); }
    if (from_date)  { conditions.push("ph.changed_at >= ?");    params.push(from_date); }
    if (to_date)    { conditions.push("ph.changed_at <= ?");    params.push(to_date + " 23:59:59"); }
    if (changed_by) { conditions.push("ph.changed_by = ?");     params.push(changed_by); }
    if (category_id) { conditions.push("i.category_id = ?");   params.push(Number(category_id)); }
    if (search) {
      conditions.push("(i.name LIKE ? OR i.code LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    const allowedSort = ["changed_at", "item_name", "field", "old_value", "new_value"];
    const safeSort = allowedSort.includes(sort) ? sort : "changed_at";
    const safeDir  = dir === "asc" ? "ASC" : "DESC";
    const safeLimit  = Math.min(200, Number(limit) || 50);
    const safeOffset = (Math.max(1, Number(page)) - 1) * safeLimit;

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = db.prepare(`
      SELECT COUNT(*) as cnt
      FROM price_history ph
      LEFT JOIN items i ON i.id = ph.item_id
      ${where}
    `).get(...params)?.cnt || 0;

    const rows = db.prepare(`
      SELECT ph.*,
             i.name  AS item_name,
             i.code  AS item_code,
             i.category_id,
             c.name  AS category_name,
             COALESCE(u.username, u.full_name, ph.changed_by) AS changed_by_username
      FROM price_history ph
      LEFT JOIN items i          ON i.id = ph.item_id
      LEFT JOIN item_categories c ON c.id = i.category_id
      LEFT JOIN users u          ON u.id = CAST(ph.changed_by AS INTEGER)
      ${where}
      ORDER BY ${safeSort === "item_name" ? "i.name" : `ph.${safeSort}`} ${safeDir}
      LIMIT ? OFFSET ?
    `).all(...params, safeLimit, safeOffset);

    res.json({ success: true, data: rows, total, page: Number(page), limit: safeLimit });
  } catch (e) { next(e); }
});

// ── Per-item price history ────────────────────────────────────────────────────
router.get("/history/:itemId", requirePagePermission("bulk_price_update", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const itemId = Number(req.params.itemId);

    const item = db.prepare("SELECT id, name, code, sale_price, purchase_price, wholesale_price FROM items WHERE id = ?").get(itemId);
    if (!item) { const e = new Error("Item not found"); e.status = 404; throw e; }

    const history = db.prepare(`
      SELECT ph.*, COALESCE(u.username, u.full_name, ph.changed_by) AS changed_by_username
      FROM price_history ph
      LEFT JOIN users u ON u.id = CAST(ph.changed_by AS INTEGER)
      WHERE ph.item_id = ?
      ORDER BY ph.changed_at ASC, ph.id ASC
    `).all(itemId);

    // Group by field for chart data
    const byField = {};
    for (const row of history) {
      if (!byField[row.field]) byField[row.field] = [];
      byField[row.field].push({ date: row.changed_at, value: row.new_value, source: row.source, op: row.operation_id });
    }

    res.json({ success: true, data: { item, history, by_field: byField } });
  } catch (e) { next(e); }
});

// ── Invoice-level overrides ───────────────────────────────────────────────────
router.get("/overrides", requirePagePermission("bulk_price_update", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const result = listOverrides({
      item_id:   req.query.item_id   ? Number(req.query.item_id)   : undefined,
      source:    req.query.source,
      from_date: req.query.from_date,
      to_date:   req.query.to_date,
      page:      Number(req.query.page  || 1),
      limit:     Number(req.query.limit || 50),
    }, db);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
});

// ── Analytics summary ─────────────────────────────────────────────────────────
router.get("/analytics", requirePagePermission("bulk_price_update", "view"), (req, res, next) => {
  try {
    const db = getDb();

    const today   = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10);
    const monAgo  = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const countInPeriod = (from) => db.prepare(
      "SELECT COUNT(*) as cnt FROM price_history WHERE date(changed_at) >= date(?)"
    ).get(from)?.cnt || 0;

    const mostChanged = db.prepare(`
      SELECT ph.item_id, i.name AS item_name, COUNT(*) AS change_count
      FROM price_history ph
      LEFT JOIN items i ON i.id = ph.item_id
      WHERE date(ph.changed_at) >= date(?)
      GROUP BY ph.item_id ORDER BY change_count DESC LIMIT 5
    `).all(monAgo);

    const sourceBreakdown = db.prepare(`
      SELECT source, COUNT(*) AS cnt FROM price_history
      WHERE date(changed_at) >= date(?)
      GROUP BY source ORDER BY cnt DESC
    `).all(monAgo);

    // Most overridden items (invoice_lines where unit_price != master_price_at_time)
    const mostOverridden = db.prepare(`
      SELECT il.item_id, i.name AS item_name, COUNT(*) AS override_count
      FROM invoice_lines il
      JOIN items i ON i.id = il.item_id
      WHERE il.master_price_at_time IS NOT NULL
        AND ABS(il.unit_price - il.master_price_at_time) > 0.001
      GROUP BY il.item_id ORDER BY override_count DESC LIMIT 5
    `).all();

    res.json({
      success: true,
      data: {
        changes_today:  countInPeriod(today),
        changes_week:   countInPeriod(weekAgo),
        changes_month:  countInPeriod(monAgo),
        most_changed:   mostChanged,
        source_breakdown: sourceBreakdown,
        most_overridden:  mostOverridden,
      },
    });
  } catch (e) { next(e); }
});

// ── Integrity check ───────────────────────────────────────────────────────────
router.get("/integrity/last", requireSystemOwner, (req, res, next) => {
  try {
    const db = getDb();
    const result = getLastCheckRun(db);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post("/integrity/run", requireSystemOwner, (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.user?.id ? Number(req.user.id) : null;
    runFullCheck(db, userId);
    const result = getLastCheckRun(db);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post("/integrity/resolve/:issueId", requireSystemOwner, (req, res, next) => {
  try {
    const db = getDb();
    const { action } = req.body || {};
    if (!["fixed", "ignored"].includes(action)) {
      const e = new Error("action must be 'fixed' or 'ignored'"); e.status = 400; throw e;
    }
    const userId = req.user?.id ? Number(req.user.id) : null;
    const result = resolveIssue(Number(req.params.issueId), action, userId, db);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

// ── Override frequency analytics ─────────────────────────────────────────────
router.get("/overrides/frequency", requirePagePermission("bulk_price_update", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const { from_date, to_date, group_by = "cashier" } = req.query;

    const dateFilter = (alias) => {
      const parts = [];
      if (from_date) parts.push(`date(${alias}) >= date('${from_date}')`);
      if (to_date)   parts.push(`date(${alias}) <= date('${to_date}')`);
      return parts.length ? " AND " + parts.join(" AND ") : "";
    };

    // Per-cashier override stats
    const byCashier = db.prepare(`
      SELECT
        COALESCE(u.full_name, u.username, 'غير معروف') AS cashier_name,
        u.id AS cashier_id,
        COUNT(*) AS override_count,
        SUM(CASE WHEN il.unit_price < il.master_price_at_time THEN 1 ELSE 0 END) AS price_downs,
        SUM(CASE WHEN il.unit_price > il.master_price_at_time THEN 1 ELSE 0 END) AS price_ups,
        ROUND(AVG(ABS(il.unit_price - il.master_price_at_time) / NULLIF(il.master_price_at_time, 0) * 100), 2) AS avg_diff_pct
      FROM invoice_lines il
      JOIN invoices inv ON inv.id = il.invoice_id
      LEFT JOIN users u ON u.id = inv.user_id
      WHERE il.master_price_at_time IS NOT NULL
        AND ABS(il.unit_price - il.master_price_at_time) > 0.001
        AND inv.status != 'cancelled'
        ${dateFilter("inv.created_at")}
      GROUP BY inv.user_id
      ORDER BY override_count DESC
      LIMIT 50
    `).all();

    // Per-item override stats
    const byItem = db.prepare(`
      SELECT
        il.item_id,
        i.name AS item_name,
        i.code AS item_code,
        c.name AS category_name,
        COUNT(*) AS override_count,
        ROUND(AVG(il.unit_price), 2) AS avg_used_price,
        ROUND(AVG(il.master_price_at_time), 2) AS avg_master_price,
        ROUND(AVG(ABS(il.unit_price - il.master_price_at_time) / NULLIF(il.master_price_at_time, 0) * 100), 2) AS avg_diff_pct,
        SUM(CASE WHEN il.unit_price < il.master_price_at_time THEN 1 ELSE 0 END) AS price_downs,
        SUM(CASE WHEN il.unit_price > il.master_price_at_time THEN 1 ELSE 0 END) AS price_ups
      FROM invoice_lines il
      JOIN invoices inv ON inv.id = il.invoice_id
      JOIN items i ON i.id = il.item_id
      LEFT JOIN item_categories c ON c.id = i.category_id
      WHERE il.master_price_at_time IS NOT NULL
        AND ABS(il.unit_price - il.master_price_at_time) > 0.001
        AND inv.status != 'cancelled'
        ${dateFilter("inv.created_at")}
      GROUP BY il.item_id
      ORDER BY override_count DESC
      LIMIT 100
    `).all();

    // Daily trend
    const dailyTrend = db.prepare(`
      SELECT
        DATE(inv.created_at) AS date,
        COUNT(*) AS override_count,
        COUNT(DISTINCT inv.user_id) AS cashiers_involved,
        ROUND(AVG(ABS(il.unit_price - il.master_price_at_time) / NULLIF(il.master_price_at_time, 0) * 100), 2) AS avg_diff_pct
      FROM invoice_lines il
      JOIN invoices inv ON inv.id = il.invoice_id
      WHERE il.master_price_at_time IS NOT NULL
        AND ABS(il.unit_price - il.master_price_at_time) > 0.001
        AND inv.status != 'cancelled'
        ${dateFilter("inv.created_at")}
      GROUP BY DATE(inv.created_at)
      ORDER BY date DESC
      LIMIT 30
    `).all();

    // Summary totals
    const totals = db.prepare(`
      SELECT
        COUNT(*) AS total_overrides,
        COUNT(DISTINCT inv.user_id) AS unique_cashiers,
        COUNT(DISTINCT il.item_id) AS unique_items,
        ROUND(AVG(ABS(il.unit_price - il.master_price_at_time) / NULLIF(il.master_price_at_time, 0) * 100), 2) AS avg_diff_pct
      FROM invoice_lines il
      JOIN invoices inv ON inv.id = il.invoice_id
      WHERE il.master_price_at_time IS NOT NULL
        AND ABS(il.unit_price - il.master_price_at_time) > 0.001
        AND inv.status != 'cancelled'
        ${dateFilter("inv.created_at")}
    `).get();

    res.json({
      success: true,
      data: { by_cashier: byCashier, by_item: byItem, daily_trend: dailyTrend, totals },
    });
  } catch (e) { next(e); }
});

// ── Profit analysis (used by purchases modal) ─────────────────────────────────
router.post("/profit-analysis", (req, res, next) => {
  try {
    const db = getDb();
    const { lines } = req.body || {};
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.json({ success: true, data: [] });
    }
    const result = computePurchaseProfitAnalysis(lines, db);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

module.exports = router;
