const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { nowSql } = require("../utils/datetime");

const router = express.Router();
router.use(authRequired);

const MAX_SNAPSHOT_ROWS = 1000;

// --- Schedule CRUD (static paths before parameterized :id) ---

router.post("/report-snapshots/schedules", (req, res, next) => {
  try {
    const { slug, title, config, cron, format, recipients } = req.body;
    if (!slug || !title || !config || !cron) {
      return res.status(400).json({ success: false, message: "slug, title, config, and cron are required" });
    }

    const db = getDb();
    const result = db
      .prepare(
        "INSERT INTO report_schedules (slug, title, config, cron, format, recipients) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(slug, title, JSON.stringify(config), cron, format || "excel", recipients ? JSON.stringify(recipients) : null);

    const schedule = db.prepare("SELECT * FROM report_schedules WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: schedule });
  } catch (err) {
    next(err);
  }
});

router.get("/report-snapshots/schedules", (_req, res, next) => {
  try {
    const db = getDb();
    const schedules = db.prepare("SELECT * FROM report_schedules ORDER BY created_at DESC").all();
    res.json({ success: true, data: schedules });
  } catch (err) {
    next(err);
  }
});

router.put("/report-snapshots/schedules/:id", (req, res, next) => {
  try {
    const { slug, title, config, cron, format, recipients, enabled } = req.body;
    const db = getDb();
    const existing = db.prepare("SELECT id FROM report_schedules WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Schedule not found" });

    db.prepare(
      "UPDATE report_schedules SET slug = COALESCE(?, slug), title = COALESCE(?, title), config = COALESCE(?, config), cron = COALESCE(?, cron), format = COALESCE(?, format), recipients = COALESCE(?, recipients), enabled = COALESCE(?, enabled) WHERE id = ?",
    ).run(
      slug || null,
      title || null,
      config ? JSON.stringify(config) : null,
      cron || null,
      format || null,
      recipients ? JSON.stringify(recipients) : null,
      enabled != null ? (enabled ? 1 : 0) : null,
      req.params.id,
    );

    const updated = db.prepare("SELECT * FROM report_schedules WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

router.delete("/report-snapshots/schedules/:id", (req, res, next) => {
  try {
    const db = getDb();
    const existing = db.prepare("SELECT id FROM report_schedules WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Schedule not found" });

    db.prepare("DELETE FROM report_schedules WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// --- Compare (static path before :id) ---

router.post("/report-snapshots/compare", (req, res, next) => {
  try {
    const { id1, id2 } = req.body;
    if (!id1 || !id2) return res.status(400).json({ success: false, message: "id1 and id2 are required" });

    const db = getDb();
    const snap1 = db.prepare("SELECT * FROM report_snapshots WHERE id = ?").get(id1);
    const snap2 = db.prepare("SELECT * FROM report_snapshots WHERE id = ?").get(id2);
    if (!snap1 || !snap2) return res.status(404).json({ success: false, message: "One or both snapshots not found" });

    const rows1 = JSON.parse(snap1.rows || "[]");
    const rows2 = JSON.parse(snap2.rows || "[]");
    const config1 = JSON.parse(snap1.config || "{}");
    const config2 = JSON.parse(snap2.config || "{}");
    const cols1 = snap1.columns ? JSON.parse(snap1.columns) : null;
    const cols2 = snap2.columns ? JSON.parse(snap2.columns) : null;
    const totals1 = snap1.totals ? JSON.parse(snap1.totals) : null;
    const totals2 = snap2.totals ? JSON.parse(snap2.totals) : null;

    const configChanged = JSON.stringify(config1) !== JSON.stringify(config2);
    const columnsChanged = JSON.stringify(cols1) !== JSON.stringify(cols2);
    const totalsChanged = JSON.stringify(totals1) !== JSON.stringify(totals2);

    res.json({
      success: true,
      data: {
        summary: {
          snap1: { id: snap1.id, title: snap1.title, label: snap1.label, created_at: snap1.created_at, row_count: rows1.length },
          snap2: { id: snap2.id, title: snap2.title, label: snap2.label, created_at: snap2.created_at, row_count: rows2.length },
          row_count_diff: rows2.length - rows1.length,
          config_changed: configChanged,
          columns_changed: columnsChanged,
          totals_changed: totalsChanged,
        },
        config_diff: configChanged ? { snap1: config1, snap2: config2 } : null,
        columns_diff: columnsChanged ? { snap1: cols1, snap2: cols2 } : null,
        totals_diff: totalsChanged ? { snap1: totals1, snap2: totals2 } : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// --- Snapshot CRUD ---

router.post("/report-snapshots", (req, res, next) => {
  try {
    const { slug, title, config, columns, rows, totals, label } = req.body;
    if (!slug || !title || !config || !rows) {
      return res.status(400).json({ success: false, message: "slug, title, config, and rows are required" });
    }

    const safeRows = Array.isArray(rows) ? rows.slice(0, MAX_SNAPSHOT_ROWS) : [];
    const db = getDb();
    const result = db
      .prepare(
        "INSERT INTO report_snapshots (slug, title, config, columns, rows, totals, label, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        slug,
        title,
        typeof config === "string" ? config : JSON.stringify(config),
        columns ? (typeof columns === "string" ? columns : JSON.stringify(columns)) : null,
        JSON.stringify(safeRows),
        totals ? (typeof totals === "string" ? totals : JSON.stringify(totals)) : null,
        label || null,
        req.user?.id || null,
      );

    res.status(201).json({ success: true, data: { id: result.lastInsertRowid, created_at: nowSql() } });
  } catch (err) {
    next(err);
  }
});

router.get("/report-snapshots", (req, res, next) => {
  try {
    const db = getDb();
    const slug = req.query.slug || null;
    const pageNum = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (pageNum - 1) * size;

    let where = "";
    const params = [];
    if (slug) {
      where = "WHERE slug = ?";
      params.push(slug);
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM report_snapshots ${where}`).get(...params).count;
    const data = db
      .prepare(
        `SELECT id, slug, title, config, columns, label, user_id, created_at, json_array_length(rows) as row_count FROM report_snapshots ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, size, offset);

    res.json({ success: true, data, total, page: pageNum, pageSize: size });
  } catch (err) {
    next(err);
  }
});

router.get("/report-snapshots/:id", (req, res, next) => {
  try {
    const db = getDb();
    const snapshot = db.prepare("SELECT * FROM report_snapshots WHERE id = ?").get(req.params.id);
    if (!snapshot) return res.status(404).json({ success: false, message: "Snapshot not found" });

    snapshot.config = JSON.parse(snapshot.config);
    snapshot.rows = JSON.parse(snapshot.rows);
    if (snapshot.columns) snapshot.columns = JSON.parse(snapshot.columns);
    if (snapshot.totals) snapshot.totals = JSON.parse(snapshot.totals);

    res.json({ success: true, data: snapshot });
  } catch (err) {
    next(err);
  }
});

router.delete("/report-snapshots/:id", (req, res, next) => {
  try {
    const db = getDb();
    const existing = db.prepare("SELECT id FROM report_snapshots WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Snapshot not found" });

    db.prepare("DELETE FROM report_snapshots WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
