const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();

router.use(authRequired);

router.get("/", requirePagePermission("history", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const { user_id, action, resource, from, to, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const per_page = Math.min(200, Math.max(1, parseInt(req.query.per_page) || 50));
    const offset = (page - 1) * per_page;

    const conditions = [];
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
