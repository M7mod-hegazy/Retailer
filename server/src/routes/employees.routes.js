const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);

router.get("/", requirePagePermission("employees", "view"), (req, res) => {
  const showArchived = req.query.archived === 'true';
  const query = showArchived
    ? "SELECT * FROM employees WHERE is_active = 0 ORDER BY id DESC"
    : "SELECT * FROM employees WHERE is_active = 1 OR is_active IS NULL ORDER BY id DESC";
  const rows = getDb().prepare(query).all();
  res.json({ success: true, data: rows });
});

router.post("/", requirePagePermission("employees", "add"), (req, res) => {
  const payload = req.body || {};
  const info = getDb()
    .prepare("INSERT INTO employees (name, role, phone, is_active) VALUES (?, ?, ?, ?)")
    .run(payload.name, payload.role || null, payload.phone || null, payload.is_active === false ? 0 : 1);
  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM employees WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.put("/:id", requirePagePermission("employees", "edit"), (req, res, next) => {
  try {
    const payload = req.body || {};
    const db = getDb();
    const columns = db.prepare("PRAGMA table_info(employees)").all().map((column) => column.name);
    if (!columns.includes("salary")) db.exec("ALTER TABLE employees ADD COLUMN salary INTEGER DEFAULT 0");
    if (!columns.includes("job_title")) db.exec("ALTER TABLE employees ADD COLUMN job_title TEXT");
    const refreshedColumns = db.prepare("PRAGMA table_info(employees)").all().map((column) => column.name);
    const roleColumn = refreshedColumns.includes("job_title") ? "job_title" : "role";

    db
      .prepare(`UPDATE employees SET name = ?, phone = ?, ${roleColumn} = ?, salary = ? WHERE id = ?`)
      .run(payload.name, payload.phone || null, payload.job_title || payload.role || null, Number(payload.salary || 0), req.params.id);

    res.json({
      success: true,
      data: db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id),
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requirePagePermission("employees", "delete"), (req, res) => {
  try {
    const db = getDb();
    
    // Check for related records
    const adjustmentCount = db.prepare("SELECT COUNT(*) AS c FROM employee_adjustments WHERE employee_id = ?").get(req.params.id);
    const shiftCount = db.prepare("SELECT COUNT(*) AS c FROM shifts WHERE employee_id = ?").get(req.params.id);
    
    const hasRecords = 
      Number(adjustmentCount?.c || 0) > 0 ||
      Number(shiftCount?.c || 0) > 0;
    
    if (hasRecords) {
      // Soft delete - mark as inactive
      db.prepare("UPDATE employees SET is_active = 0 WHERE id = ?").run(req.params.id);
      return res.json({ success: true, archived: true, message: "تم أرشفة الموظف لأنه مرتبط بعمليات أخرى" });
    }
    
    // Hard delete if no records
    db.prepare("DELETE FROM employees WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن حذف الموظف لأنه مرتبط ببيانات أخرى" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

router.post("/:id/adjustments", requirePagePermission("employees", "add"), (req, res) => {
  const payload = req.body || {};
  const amount = Number(payload.amount || 0);

  if (amount <= 0 || !["incentive", "penalty"].includes(payload.adjustment_type)) {
    return res.status(400).json({ success: false, message: "Invalid adjustment data" });
  }

  const info = getDb()
    .prepare(
      "INSERT INTO employee_adjustments (employee_id, adjustment_type, amount, reason, user_id) VALUES (?, ?, ?, ?, ?)"
    )
    .run(
      req.params.id,
      payload.adjustment_type,
      amount,
      payload.reason || null,
      req.user?.id || null
    );

  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM employee_adjustments WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.get("/:id/adjustments", requirePagePermission("employees", "view"), (req, res) => {
  const rows = getDb().prepare("SELECT * FROM employee_adjustments WHERE employee_id = ? ORDER BY id DESC").all(req.params.id);
  res.json({ success: true, data: rows });
});

module.exports = router;
