const express = require("express");
const { UserModel } = require("../models/user.model");
const { getDb } = require("../config/database");
const { authRequired, requireRole } = require("../middleware/auth");
const { SYSTEM_OWNER_USERNAME } = require("../services/systemOwner.service");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const NotificationModel = require("../models/notification.model");
const { nowSql } = require("../utils/datetime");
const { notifyOwner, EVENT_TYPES: TG } = require("../services/telegramService");

const router = express.Router();

router.use(authRequired);
router.use(auditMutation);

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

    const newUser = db.prepare("SELECT id, full_name, username, role, is_active, can_view_updates, password_hash AS password FROM users WHERE id = ?").get(info.lastInsertRowid);
    req.audit("create", "user", { id: newUser.id, username: newUser.username }, `👤 تم إنشاء مستخدم: ${username}`);
    try {
      NotificationModel.create({
        title: "👤 مستخدم جديد",
        body: `تم إنشاء المستخدم: ${username}`,
        type: "info",
        link: `/definitions/users`,
      });
    } catch (_) {}
    res.status(201).json({ success: true, data: newUser });
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
        "UPDATE users SET full_name = ?, username = ?, password_hash = ?, role = ?, is_active = ?, can_view_updates = ?, updated_at = ? WHERE id = ?"
      ).run(full_name, username, String(payload.password), role, is_active, can_view_updates, nowSql(), req.params.id);
    } else {
      db.prepare(
        "UPDATE users SET full_name = ?, username = ?, role = ?, is_active = ?, can_view_updates = ?, updated_at = ? WHERE id = ?"
      ).run(full_name, username, role, is_active, can_view_updates, nowSql(), req.params.id);
    }

    const updatedUser = db.prepare("SELECT id, full_name, username, role, is_active, can_view_updates, password_hash AS password FROM users WHERE id = ?").get(req.params.id);
    req.audit("edit", "user", { id: Number(req.params.id), username: updatedUser.username }, `👤 تم تعديل مستخدم: ${updatedUser.username}`);
    try {
      if (payload.password) {
        notifyOwner(TG.PASSWORD_CHANGED, {
          userName: updatedUser.full_name || updatedUser.username,
          ipAddress: req.ip,
          createdAt: nowSql(),
        });
      }
      if (role !== existing.role) {
        notifyOwner(TG.PERMISSION_CHANGED, {
          targetUser: updatedUser.full_name || updatedUser.username,
          adminUser: req.user?.full_name || req.user?.username,
          changes: `تغيير الدور من "${existing.role}" إلى "${role}"`,
          createdAt: nowSql(),
        });
      }
    } catch (_) {}
    res.json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
});

// Friendly Arabic labels for tables that may reference a user. Unknown tables
// fall back to their raw name so the block message is still informative.
const USER_REF_LABELS = {
  invoices: "فواتير المبيعات",
  shifts: "ورديات نقاط البيع",
  shift_transactions: "حركات الوردية",
  purchases: "فواتير الشراء",
  payments: "سندات الدفع والتحصيل",
  sales_returns: "مرتجعات المبيعات",
  purchase_returns: "مرتجعات الشراء",
  expenses: "المصروفات",
  revenues: "الإيرادات",
  withdrawals: "السحوبات",
  daily_withdrawals: "سحوبات اليومية",
  stock_movements: "حركات المخزون",
  bank_transactions: "حركات البنوك",
  branch_transfers: "تحويلات الفروع",
  customer_notes: "ملاحظات العملاء",
  supplier_notes: "ملاحظات الموردين",
  owner_statements: "كشوف المالك",
  ajal_payments: "تحصيلات الآجل",
  employee_adjustments: "تسويات الموظفين",
  daily_sessions: "جلسات اليومية",
  account_import_batches: "دفعات استيراد الحسابات",
};

// Log / disposable per-user state. These have FKs to users but are NOT business
// activity — we detach (null) or delete them on user removal instead of blocking.
const USER_DETACH_TABLES = new Set(["audit_logs", "notifications", "user_help_state"]);

// Discover every foreign key that points at users.id at runtime, so the delete
// guard stays correct even as new tables are added (no hardcoded list to drift).
function getUserForeignKeys(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const fks = [];
  for (const { name } of tables) {
    let list = [];
    try { list = db.prepare(`PRAGMA foreign_key_list(${name})`).all(); } catch (_e) { continue; }
    for (const fk of list) {
      if (fk.table === "users") {
        fks.push({ table: name, from: fk.from, onDelete: String(fk.on_delete || "").toUpperCase() });
      }
    }
  }
  return fks;
}

// Count business references that would block a hard-delete. FKs handled by the
// DB (SET NULL/CASCADE) and detach tables never block. Counts are aggregated
// per table so multiple FK columns on one table report a single figure.
function collectUserReferences(db, userId, fks) {
  const counts = new Map();
  for (const fk of fks) {
    if (["SET NULL", "CASCADE", "SET DEFAULT"].includes(fk.onDelete)) continue;
    if (USER_DETACH_TABLES.has(fk.table)) continue;
    let c = 0;
    try {
      c = Number(db.prepare(`SELECT COUNT(*) AS c FROM ${fk.table} WHERE ${fk.from} = ?`).get(userId)?.c || 0);
    } catch (_e) {
      continue;
    }
    if (c > 0) {
      const label = USER_REF_LABELS[fk.table] || fk.table;
      counts.set(label, (counts.get(label) || 0) + c);
    }
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

// Preserve audit history but detach the user (its FK is NO ACTION → must null),
// and drop disposable per-user rows before removing the account.
function detachUserLogs(db, userId) {
  try { db.prepare("UPDATE audit_logs SET user_id = NULL WHERE user_id = ?").run(userId); } catch (_e) {}
  try { db.prepare("DELETE FROM notifications WHERE user_id = ?").run(userId); } catch (_e) {}
  try { db.prepare("DELETE FROM user_help_state WHERE user_id = ?").run(userId); } catch (_e) {}
}

router.delete("/:id", requirePagePermission("users", "delete"), requireRole("admin"), (req, res, next) => {
  try {
    const db = getDb();
    const id = req.params.id;
    const existing = db
      .prepare("SELECT id, username, role, is_system_account FROM users WHERE id = ?")
      .get(id);

    if (!existing) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    if (existing.is_system_account) {
      const err = new Error("System owner account cannot be deleted");
      err.status = 403;
      throw err;
    }

    // Cannot delete the account you are currently logged in with.
    if (String(req.user?.id) === String(id)) {
      const err = new Error("Cannot delete your own account");
      err.code = "cannot_delete_self";
      err.status = 400;
      throw err;
    }

    // Never allow removing the last remaining admin (would lock out management).
    if (existing.role === "admin") {
      const otherAdmins = db
        .prepare(
          "SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?",
        )
        .get(id);
      if (Number(otherAdmins?.c || 0) === 0) {
        const err = new Error("Cannot delete the last administrator");
        err.code = "last_admin";
        err.status = 409;
        throw err;
      }
    }

    // Block hard-delete when the user owns business activity; suggest deactivate.
    const fks = getUserForeignKeys(db);
    const references = collectUserReferences(db, id, fks);
    if (references.length > 0) {
      return res.status(409).json({
        success: false,
        code: "has_references",
        references,
        message: "لا يمكن حذف المستخدم لارتباطه بسجلات. يمكنك تعطيله بدلاً من حذفه.",
      });
    }

    // Detach logs / disposable state, then remove the account.
    detachUserLogs(db, id);
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    req.audit("delete", "user", { id: Number(id), username: existing.username }, `👤 تم حذف مستخدم: ${existing.username}`);
    res.json({ success: true, data: { deleted: true } });
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

    const db = getDb();
    const target = db
      .prepare("SELECT id, role, page_permissions FROM users WHERE id = ?")
      .get(req.params.id);

    if (!target) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    const payload = req.body || {};
    const { permissions } = payload;

    if (permissions === undefined || permissions === null || typeof permissions !== "object" || Array.isArray(permissions)) {
      const err = new Error("Permissions payload is required");
      err.status = 400;
      throw err;
    }

    // Snapshot before-state for the audit diff
    const before = target.page_permissions ? JSON.parse(target.page_permissions) : {};

    const permissionsJson = JSON.stringify(permissions);
    db.prepare("UPDATE users SET page_permissions = ? WHERE id = ?")
      .run(permissionsJson, req.params.id);

    // Compute page-level diff: only pages whose action lists actually changed
    const allKeys = new Set([...Object.keys(before), ...Object.keys(permissions)]);
    const diff = {};
    for (const k of allKeys) {
      const b = (before[k] || []).slice().sort().join(",");
      const a = (permissions[k] || []).slice().sort().join(",");
      if (b !== a) diff[k] = { before: before[k] || [], after: permissions[k] || [] };
    }
    const changedCount = Object.keys(diff).length;

    req.audit(
      "edit_permissions", "user",
      { target_user_id: Number(req.params.id), changed_pages: changedCount, diff },
      `👤 تم تعديل صلاحيات المستخدم #${req.params.id} (${changedCount} صفحة متأثرة)`
    );
    try {
      if (changedCount > 0) {
        const targetRow = db.prepare("SELECT full_name, username FROM users WHERE id = ?").get(req.params.id);
        const pages = Object.keys(diff).slice(0, 5).join("، ");
        const suffix = changedCount > 5 ? ` وغيرها (${changedCount} صفحة)` : "";
        notifyOwner(TG.PERMISSION_CHANGED, {
          targetUser: targetRow?.full_name || targetRow?.username || `#${req.params.id}`,
          adminUser: req.user?.full_name || req.user?.username,
          changes: `تعديل صلاحيات ${changedCount} صفحة: ${pages}${suffix}`,
          createdAt: nowSql(),
        });
      }
    } catch (_) {}
    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
});


module.exports = router;
