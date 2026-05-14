const express = require("express");
const { UserModel } = require("../models/user.model");
const { getDb } = require("../config/database");
const { authRequired, requireRole } = require("../middleware/auth");
const { SYSTEM_OWNER_USERNAME } = require("../services/systemOwner.service");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();

router.use(authRequired);

router.get("/", requirePagePermission("users", "view"), (_req, res) => {
  const rows = getDb()
    .prepare(
      "SELECT id, full_name, username, role, is_active, can_view_updates, last_login_at, created_at FROM users WHERE COALESCE(is_system_account, 0) = 0 ORDER BY id DESC",
    )
    .all();
  res.json({ success: true, data: rows });
});

router.post("/", requirePagePermission("users", "add"), requireRole("admin"), (req, res, next) => {
  try {
    const payload = req.body || {};
    const username = String(payload.username || "").trim();
    const password = String(payload.password || "").trim();
    const full_name = String(payload.full_name || username).trim();
    const role = payload.role || "user";

    if (!username || !password) {
      const err = new Error("اسم المستخدم وكلمة المرور مطلوبان");
      err.status = 400;
      throw err;
    }
    if (username.toLowerCase() === String(SYSTEM_OWNER_USERNAME).toLowerCase()) {
      const err = new Error("System owner username is reserved");
      err.status = 400;
      throw err;
    }
    const conflict = getDb().prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (conflict) {
      const err = new Error("Username already taken");
      err.status = 409;
      throw err;
    }

    // Store password as plaintext (local desktop app — admin needs to view/manage)
    const can_view_updates = payload.can_view_updates ? 1 : 0;

    const db = getDb();
    const info = db.prepare(
      "INSERT INTO users (full_name, username, password_hash, role, can_view_updates) VALUES (?, ?, ?, ?, ?)"
    ).run(full_name, username, password, role, can_view_updates);

    res.status(201).json({
      success: true,
      data: db.prepare("SELECT id, full_name, username, role, is_active, can_view_updates, password_hash AS password FROM users WHERE id = ?").get(info.lastInsertRowid),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireRole("admin"), (req, res, next) => {
  try {
    const user = getDb()
      .prepare("SELECT id, full_name, username, role, is_active, can_view_updates, password_hash AS password FROM users WHERE id = ?")
      .get(req.params.id);
    if (!user) {
      const err = new Error("User not found"); err.status = 404; throw err;
    }
    res.json({ success: true, data: user });
  } catch (error) { next(error); }
});

router.put("/:id", requirePagePermission("users", "edit"), requireRole("admin"), (req, res, next) => {
  try {
    const payload = req.body || {};
    const db = getDb();
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);

    if (!existing) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    if (existing.is_system_account) {
      const err = new Error("System owner account cannot be edited");
      err.status = 403;
      throw err;
    }

    const full_name = payload.full_name !== undefined ? String(payload.full_name).trim() : existing.full_name;
    const username  = payload.username  !== undefined ? String(payload.username).trim()  : existing.username;
    const role      = payload.role      !== undefined ? payload.role : existing.role;
    const is_active = payload.is_active !== undefined
      ? (payload.is_active === false || payload.is_active === 0 ? 0 : 1)
      : existing.is_active;
    const can_view_updates = payload.can_view_updates !== undefined
      ? (payload.can_view_updates === false || payload.can_view_updates === 0 ? 0 : 1)
      : (existing.can_view_updates || 0);

    // Check username uniqueness if changed
    if (username !== existing.username) {
      if (username.toLowerCase() === String(SYSTEM_OWNER_USERNAME).toLowerCase()) {
        const err = new Error("System owner username is reserved");
        err.status = 400;
        throw err;
      }
      const conflict = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, req.params.id);
      if (conflict) {
        const err = new Error("Username already taken");
        err.status = 409;
        throw err;
      }
    }

    if (payload.password) {
      db.prepare(
        "UPDATE users SET full_name = ?, username = ?, password_hash = ?, role = ?, is_active = ?, can_view_updates = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(full_name, username, String(payload.password), role, is_active, can_view_updates, req.params.id);
    } else {
      db.prepare(
        "UPDATE users SET full_name = ?, username = ?, role = ?, is_active = ?, can_view_updates = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(full_name, username, role, is_active, can_view_updates, req.params.id);
    }

    res.json({
      success: true,
      data: db.prepare("SELECT id, full_name, username, role, is_active, can_view_updates, password_hash AS password FROM users WHERE id = ?")
        .get(req.params.id),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/permissions", (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "dev") {
      return res.status(403).json({ error: "admin_only" });
    }

    const user = getDb()
      .prepare("SELECT id, role, page_permissions FROM users WHERE id = ?")
      .get(req.params.id);

    if (!user) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    // Admin/dev users have full access — no stored permissions needed
    if (user.role === "admin" || user.role === "dev") {
      return res.json({ success: true, data: null });
    }

    let permissions;
    if (user.page_permissions) {
      permissions = JSON.parse(user.page_permissions);
    } else {
      permissions = {};
    }

    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
});

router.put("/:id/permissions", (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "dev") {
      return res.status(403).json({ error: "admin_only" });
    }

    const target = getDb()
      .prepare("SELECT id, role FROM users WHERE id = ?")
      .get(req.params.id);

    if (!target) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    if (target.role === "admin") {
      return res.status(403).json({ error: "cannot_modify_admin_permissions" });
    }

    const payload = req.body || {};
    const { permissions } = payload;

    if (permissions === undefined || permissions === null || typeof permissions !== "object" || Array.isArray(permissions)) {
      const err = new Error("Permissions payload is required");
      err.status = 400;
      throw err;
    }

    const permissionsJson = JSON.stringify(permissions);
    getDb()
      .prepare("UPDATE users SET page_permissions = ? WHERE id = ?")
      .run(permissionsJson, req.params.id);

    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
