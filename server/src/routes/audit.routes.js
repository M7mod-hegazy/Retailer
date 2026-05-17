const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();

router.use(authRequired);

router.get("/find-page", requirePagePermission("history", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const { log_id, notif_id, per_page: perPageRaw = 20 } = req.query;
    const per_page = Math.min(200, Math.max(1, parseInt(perPageRaw) || 20));

    let targetLogId = log_id ? Number(log_id) : null;

    // If no log_id, try to find the closest audit log to the notification's created_at
    if (!targetLogId && notif_id) {
      const notif = db.prepare("SELECT created_at FROM notifications WHERE id = ?").get(Number(notif_id));
      if (notif) {
        const closest = db.prepare(`
          SELECT id FROM audit_logs
          WHERE action != 'permission_denied'
            AND ABS(julianday(created_at) - julianday(?)) * 86400 < 30
          ORDER BY ABS(julianday(created_at) - julianday(?)) ASC
          LIMIT 1
        `).get(notif.created_at, notif.created_at);
        if (closest) targetLogId = closest.id;
      }
    }

    if (!targetLogId) return res.json({ success: false, message: "not found" });

    const target = db.prepare("SELECT id, created_at FROM audit_logs WHERE id = ?").get(targetLogId);
    if (!target) return res.json({ success: false, message: "not found" });

    const newer = db
      .prepare("SELECT COUNT(*) AS cnt FROM audit_logs WHERE action != 'permission_denied' AND created_at > ?")
      .get(target.created_at).cnt;
    const page = Math.floor(newer / per_page) + 1;

    return res.json({ success: true, page, per_page, resolved_log_id: target.id });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requirePagePermission("history", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT al.*, u.username, u.full_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = ?
    `).get(Number(req.params.id));
    if (!row) return res.status(404).json({ success: false, message: "not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

router.get("/", requirePagePermission("history", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const { user_id, action, resource, from, to, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const per_page = Math.min(200, Math.max(1, parseInt(req.query.per_page) || 50));
    const offset = (page - 1) * per_page;

    const conditions = ["al.action != 'permission_denied'"];
    const params = [];

    if (user_id) {
      conditions.push("al.user_id = ?");
      params.push(user_id);
    }
    if (action) {
      conditions.push("al.action = ?");
      params.push(action);
    }
    if (resource) {
      conditions.push("al.resource = ?");
      params.push(resource);
    }
    if (from) {
      conditions.push("al.created_at >= ?");
      params.push(from);
    }
    if (to) {
      conditions.push("al.created_at <= ?");
      params.push(to);
    }
    if (search) {
      conditions.push("al.description LIKE ?");
      params.push(`%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id ${where}`
      )
      .get(...params).cnt;

    const rows = db
      .prepare(
        `SELECT al.*, u.username, u.full_name
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         ${where}
         ORDER BY al.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, per_page, offset);

    res.json({
      success: true,
      data: rows,
      meta: {
        page,
        per_page,
        total,
        pages: Math.ceil(total / per_page),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
