const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

router.get("/", requirePagePermission("branches", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const showArchived = req.query.archived === 'true';
    const query = showArchived
      ? "SELECT * FROM branches WHERE is_active = 0 ORDER BY name"
      : "SELECT * FROM branches WHERE is_active = 1 OR is_active IS NULL ORDER BY name";
    const data = db.prepare(query).all();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/", requirePagePermission("branches", "add"), (req, res, next) => {
  try {
    const db = getDb();
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "اسم الفرع مطلوب" });

    const stmt = db.prepare("INSERT INTO branches (name) VALUES (?)");
    const result = stmt.run(name);
    req.audit("create", "branches", { id: result.lastInsertRowid }, `⚙️ تم إضافة فرع: ${name}`);
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid, name } });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint")) {
      return res.status(400).json({ success: false, message: "اسم الفرع موجود مسبقاً" });
    }
    next(err);
  }
});

router.put("/:id", requirePagePermission("branches", "edit"), (req, res, next) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "اسم الفرع مطلوب" });

    const stmt = db.prepare("UPDATE branches SET name = ? WHERE id = ?");
    stmt.run(name, id);
    req.audit("update", "branches", { id }, `⚙️ تم تعديل فرع: ${name}`);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint")) {
      return res.status(400).json({ success: false, message: "اسم الفرع موجود مسبقاً" });
    }
    next(err);
  }
});

router.delete("/:id", requirePagePermission("branches", "delete"), (req, res, next) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    
    // Check for related records
    const transferCount = db.prepare("SELECT COUNT(*) AS c FROM branch_transfers WHERE from_branch_id = ? OR to_branch_id = ?").get(id, id);
    const userCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE branch_id = ?").get(id);
    
    const hasRecords = 
      Number(transferCount?.c || 0) > 0 ||
      Number(userCount?.c || 0) > 0;
    
    if (hasRecords) {
      // Soft delete - mark as inactive
      db.prepare("UPDATE branches SET is_active = 0 WHERE id = ?").run(id);
      req.audit("delete", "branches", { id }, `⚙️ تم أرشفة فرع`);
      return res.json({ success: true, archived: true, message: "تم أرشفة الفرع لأنه مرتبط بعمليات أخرى" });
    }

    // Hard delete if no records
    db.prepare("DELETE FROM branches WHERE id = ?").run(id);
    req.audit("delete", "branches", { id }, `⚙️ تم حذف فرع`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
