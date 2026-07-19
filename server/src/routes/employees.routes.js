const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { countSafe, hasAnyRelated, buildImpact } = require("../utils/relatedRecords");
const { generateDocNumber } = require("../utils/docNumber");
const { nowSql } = require("../utils/datetime");
const { notifyOwner, EVENT_TYPES: TG } = require("../services/telegramService");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

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
  const phones = Array.isArray(payload.phones) ? payload.phones : [];
  const primaryPhone = phones[0] || payload.phone || null;
  const wd = Number(payload.working_days_per_month) || 26;
  const info = getDb()
    .prepare("INSERT INTO employees (name, role, phone, is_active, salary, salary_period, job_title, address, phones, working_days_per_month) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      payload.name,
      payload.role || null,
      primaryPhone,
      payload.is_active === false ? 0 : 1,
      Number(payload.salary || 0),
      payload.salary_period || 'monthly',
      payload.job_title || null,
      payload.address || null,
      JSON.stringify(phones),
      wd
    );
  req.audit("create", "employees", { id: info.lastInsertRowid }, `👤 تم إضافة موظف: ${payload.name || ''}`);

  // Telegram notification
  try {
    const userRow = req.user?.id ? getDb().prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
    notifyOwner(TG.EMPLOYEE_CREATED, {
      employeeName: payload.name || "غير محدد",
      jobTitle: payload.job_title || payload.role || null,
      salary: Number(payload.salary || 0),
      phone: primaryPhone,
      userName: userRow?.name || null,
      createdAt: new Date().toISOString(),
    }, getDb());
  } catch (_) { /* non-critical */ }

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
    if (!columns.includes("salary_period")) db.exec("ALTER TABLE employees ADD COLUMN salary_period TEXT DEFAULT 'monthly'");
    if (!columns.includes("address")) db.exec("ALTER TABLE employees ADD COLUMN address TEXT");
    if (!columns.includes("phones")) db.exec("ALTER TABLE employees ADD COLUMN phones TEXT");
    if (!columns.includes("working_days_per_month")) db.exec("ALTER TABLE employees ADD COLUMN working_days_per_month INTEGER DEFAULT 26");
    const refreshedColumns = db.prepare("PRAGMA table_info(employees)").all().map((column) => column.name);
    const roleColumn = refreshedColumns.includes("job_title") ? "job_title" : "role";

    const phones = Array.isArray(payload.phones) ? payload.phones : [];
    const primaryPhone = phones[0] || payload.phone || null;

    // Read old values before update for Telegram notification
    const oldRow = db.prepare(`SELECT name, salary, ${roleColumn} AS job_title, phone FROM employees WHERE id = ?`).get(req.params.id);

    const wd = Number(payload.working_days_per_month) || 26;
    db
      .prepare(`UPDATE employees SET name = ?, phone = ?, ${roleColumn} = ?, salary = ?, salary_period = ?, address = ?, phones = ?, working_days_per_month = ? WHERE id = ?`)
      .run(
        payload.name,
        primaryPhone,
        payload.job_title || payload.role || null,
        Number(payload.salary || 0),
        payload.salary_period || 'monthly',
        payload.address || null,
        JSON.stringify(phones),
        wd,
        req.params.id
      );

    req.audit("update", "employees", { id: req.params.id }, `👤 تم تعديل موظف: ${payload.name || ''}`);

    // Telegram notification for employee edit
    try {
      const userRow = req.user?.id ? db.prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
      const newSalary = Number(payload.salary || 0);
      const oldSalary = Number(oldRow?.salary || 0);
      const newJobTitle = payload.job_title || payload.role || null;
      const oldJobTitle = oldRow?.job_title || null;
      if (oldSalary !== newSalary || oldJobTitle !== newJobTitle || (oldRow?.name || "") !== (payload.name || "")) {
        notifyOwner(TG.EMPLOYEE_EDITED, {
          employeeName: payload.name || oldRow?.name || "غير محدد",
          oldSalary,
          newSalary,
          oldJobTitle,
          newJobTitle,
          phone: primaryPhone,
          userName: userRow?.name || null,
          createdAt: new Date().toISOString(),
        }, db);
      }
    } catch (_) { /* non-critical */ }

    res.json({
      success: true,
      data: db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id),
    });
  } catch (error) {
    next(error);
  }
});

function employeeRelated(db, id) {
  return [
    { label: "تسويات/سلف", count: countSafe(db, "SELECT COUNT(*) AS c FROM employee_adjustments WHERE employee_id = ?", id) },
    { label: "سلفيات", count: countSafe(db, "SELECT COUNT(*) AS c FROM employee_advances WHERE employee_id = ?", id) },
    { label: "خصومات", count: countSafe(db, "SELECT COUNT(*) AS c FROM employee_deductions WHERE employee_id = ?", id) },
    { label: "مكافئات", count: countSafe(db, "SELECT COUNT(*) AS c FROM employee_bonuses WHERE employee_id = ?", id) },
    { label: "صرف رواتب", count: countSafe(db, "SELECT COUNT(*) AS c FROM salary_settlements WHERE employee_id = ?", id) },
  ];
}

router.get("/:id/delete-impact", requirePagePermission("employees", "delete"), (req, res) => {
  res.json({ success: true, data: buildImpact(employeeRelated(getDb(), req.params.id)) });
});

router.delete("/:id", requirePagePermission("employees", "delete"), async (req, res) => {
  try {
    const db = getDb();

    const before = db.prepare("SELECT name, job_title FROM employees WHERE id = ?").get(req.params.id);
    const notifyDeleted = async () => {
      try {
        return await notifyOwner(TG.EMPLOYEE_DELETED, {
          employeeName: before?.name,
          jobTitle: before?.job_title,
          userName: req.user?.name || req.user?.username,
          createdAt: new Date().toISOString(),
        });
      } catch (_) { return null; }
    };

    if (hasAnyRelated(employeeRelated(db, req.params.id))) {
      db.prepare("UPDATE employees SET is_active = 0 WHERE id = ?").run(req.params.id);
      req.audit("delete", "employees", { id: req.params.id }, `👤 تم أرشفة موظف`);
      const _tgStatus = await notifyDeleted();
      return res.json({ success: true, archived: true, message: "تم أرشفة الموظف لأنه مرتبط بعمليات أخرى", telegramStatus: _tgStatus });
    }

    db.prepare("DELETE FROM employees WHERE id = ?").run(req.params.id);
    req.audit("delete", "employees", { id: req.params.id }, `👤 تم حذف موظف`);
    const _tgStatus = await notifyDeleted();
    res.json({ success: true, telegramStatus: _tgStatus });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن حذف الموظف لأنه مرتبط ببيانات أخرى" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

// ============================================================
// Adjustments (legacy incentives/penalties)
// ============================================================

router.post("/:id/adjustments", requirePagePermission("employees", "add"), (req, res) => {
  const payload = req.body || {};
  const amount = Number(payload.amount || 0);

  if (amount <= 0 || !["incentive", "penalty"].includes(payload.adjustment_type)) {
    return res.status(400).json({ success: false, message: "بيانات غير صالحة" });
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

  req.audit("create", "employees", { id: info.lastInsertRowid }, `👤 تم تسجيل ${payload.adjustment_type === 'incentive' ? 'حافز' : 'خصم'} للموظف`);

  // Telegram notification for adjustment
  try {
    const empRow = getDb().prepare("SELECT name FROM employees WHERE id = ?").get(req.params.id);
    const userRow = req.user?.id ? getDb().prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
    notifyOwner(TG.ADJUSTMENT_CREATED, {
      employeeName: empRow?.name || "غير محدد",
      adjustmentType: payload.adjustment_type,
      amount,
      reason: payload.reason || null,
      userName: userRow?.name || null,
      createdAt: new Date().toISOString(),
    }, getDb());
  } catch (_) { /* non-critical */ }

  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM employee_adjustments WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.get("/:id/adjustments", requirePagePermission("employees", "view"), (req, res) => {
  const rows = getDb().prepare("SELECT * FROM employee_adjustments WHERE employee_id = ? ORDER BY id DESC").all(req.params.id);
  res.json({ success: true, data: rows });
});

// ============================================================
// Advances (سلفيات)
// ============================================================

router.get("/:id/advances", requirePagePermission("employees", "manage_advances"), (req, res) => {
  const rows = getDb().prepare("SELECT * FROM employee_advances WHERE employee_id = ? ORDER BY id DESC").all(req.params.id);
  res.json({ success: true, data: rows });
});

router.post("/:id/advances", requirePagePermission("employees", "manage_advances"), (req, res) => {
  const payload = req.body || {};
  const amount = Number(payload.amount || 0);
  const installments = Math.max(0, Number(payload.installment_count || 0));

  if (amount <= 0) {
    return res.status(400).json({ success: false, message: "المبلغ يجب أن يكون أكبر من صفر" });
  }

  const installmentAmount = installments > 0 ? Math.round(amount / installments) : 0;

  const info = getDb()
    .prepare(
      `INSERT INTO employee_advances (employee_id, amount, remaining_balance, installment_count, installment_amount, notes, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.params.id, amount, amount, installments, installmentAmount, payload.notes || null, req.user?.id || null, nowSql());

  req.audit("create", "employee_advances", { id: info.lastInsertRowid }, `💰 تم إضافة سلفة للموظف بمبلغ ${amount}`);

  // Telegram notification
  try {
    const emp = getDb().prepare("SELECT name FROM employees WHERE id = ?").get(req.params.id);
    const userRow = req.user?.id ? getDb().prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
    notifyOwner(TG.ADVANCE_CREATED, {
      employeeName: emp?.name || "غير محدد",
      amount,
      installmentCount: installments,
      installmentAmount,
      notes: payload.notes || null,
      userName: userRow?.name || null,
      createdAt: new Date().toISOString(),
    }, getDb());
  } catch (_) { /* non-critical */ }

  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM employee_advances WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.get("/:id/advances/:advanceId/payments", requirePagePermission("employees", "manage_advances"), (req, res) => {
  const rows = getDb()
    .prepare("SELECT * FROM employee_advance_payments WHERE advance_id = ? ORDER BY id DESC")
    .all(req.params.advanceId);
  res.json({ success: true, data: rows });
});

router.post("/:id/advances/:advanceId/pay", requirePagePermission("employees", "manage_advances"), (req, res) => {
  const db = getDb();
  const advance = db.prepare("SELECT * FROM employee_advances WHERE id = ? AND employee_id = ?").get(req.params.advanceId, req.params.id);
  if (!advance) return res.status(404).json({ success: false, message: "السلفة غير موجودة" });
  if (advance.status !== 'active') return res.status(400).json({ success: false, message: "السلفة منتهية" });

  const amount = Number(req.body?.amount || advance.installment_amount);
  if (amount <= 0) return res.status(400).json({ success: false, message: "المبلغ يجب أن يكون أكبر من صفر" });
  if (amount > advance.remaining_balance) return res.status(400).json({ success: false, message: "المبلغ يتجاوز المتبقي" });

  const newRemaining = Math.max(0, advance.remaining_balance - amount);

  db.transaction(() => {
    db.prepare("INSERT INTO employee_advance_payments (advance_id, amount, notes, created_by, payment_date) VALUES (?, ?, ?, ?, ?)")
      .run(req.params.advanceId, amount, req.body?.notes || null, req.user?.id || null, nowSql());

    const newStatus = newRemaining <= 0 ? 'fully_repaid' : 'active';
    db.prepare("UPDATE employee_advances SET remaining_balance = ?, status = ? WHERE id = ?")
      .run(newRemaining, newStatus, req.params.advanceId);
  })();

  req.audit("update", "employee_advances", { id: req.params.advanceId }, `💰 تم تسديد قسط سلفة بقيمة ${amount}`);

  // Telegram notification — money coming back into the drawer.
  try {
    const emp = db.prepare("SELECT name FROM employees WHERE id = ?").get(req.params.id);
    const userRow = req.user?.id ? db.prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
    notifyOwner(TG.ADVANCE_PAYMENT, {
      employeeName: emp?.name || "غير محدد",
      amount,
      remaining: newRemaining,
      notes: req.body?.notes || null,
      userName: userRow?.name || null,
      createdAt: new Date().toISOString(),
    }, db);
  } catch (_) { /* non-critical */ }

  res.json({
    success: true,
    data: db.prepare("SELECT * FROM employee_advances WHERE id = ?").get(req.params.advanceId),
  });
});

// Delete/cancel an advance
router.get("/:id/advances/:advanceId/linked-expense", requirePagePermission("employees", "manage_advances"), (req, res) => {
  const db = getDb();
  const advance = db.prepare("SELECT * FROM employee_advances WHERE id = ? AND employee_id = ?").get(req.params.advanceId, req.params.id);
  if (!advance) return res.status(404).json({ success: false, message: "السلفة غير موجودة" });

  const expense = db.prepare(
    `SELECT id, doc_no, amount, description, notes, category_id, created_at
     FROM expenses
     WHERE employee_id = ? AND amount = ?
       AND (description LIKE '%سلفة%' OR notes LIKE '%سلفة%')
     ORDER BY ABS(julianday(created_at) - julianday(?)) ASC
     LIMIT 1`
  ).get(req.params.id, advance.amount, advance.created_at);

  res.json({ success: true, data: expense || null });
});

router.delete("/:id/advances/:advanceId", requirePagePermission("employees", "manage_advances"), (req, res) => {
  const db = getDb();
  const advance = db.prepare("SELECT * FROM employee_advances WHERE id = ? AND employee_id = ?").get(req.params.advanceId, req.params.id);
  if (!advance) return res.status(404).json({ success: false, message: "السلفة غير موجودة" });

  const paymentCount = db.prepare("SELECT COUNT(*) AS c FROM employee_advance_payments WHERE advance_id = ?").get(req.params.advanceId);

  let expense_deleted = false;
  if (req.query.delete_expense === "true") {
    const expense = db.prepare(
      `SELECT id FROM expenses WHERE employee_id = ? AND amount = ? AND (description LIKE '%سلفة%' OR notes LIKE '%سلفة%') ORDER BY ABS(julianday(created_at) - julianday(?)) ASC LIMIT 1`
    ).get(req.params.id, advance.amount, advance.created_at);
    if (expense) {
      try {
        db.prepare("UPDATE salary_settlements SET expense_id = NULL WHERE expense_id = ?").run(expense.id);
        db.prepare("DELETE FROM expenses WHERE id = ?").run(expense.id);
        expense_deleted = true;
      } catch (_) { /* FK constraint — skip */ }
    }
  }

  const hardDeleted = paymentCount.c === 0;
  if (!hardDeleted) {
    db.prepare("UPDATE employee_advances SET status = 'cancelled', remaining_balance = 0 WHERE id = ?").run(req.params.advanceId);
    req.audit("delete", "employee_advances", { id: req.params.advanceId }, `💰 تم إلغاء سلفة بمبلغ ${advance.amount} (تحتوي على مدفوعات)`);
  } else {
    db.prepare("DELETE FROM employee_advances WHERE id = ?").run(req.params.advanceId);
    req.audit("delete", "employee_advances", { id: req.params.advanceId }, `💰 تم حذف سلفة بمبلغ ${advance.amount}`);
  }

  // Telegram notification — deleting an advance can hide taken money.
  try {
    const emp = db.prepare("SELECT name FROM employees WHERE id = ?").get(req.params.id);
    const userRow = req.user?.id ? db.prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
    notifyOwner(TG.ADVANCE_DELETED, {
      employeeName: emp?.name || "غير محدد",
      amount: Number(advance.amount || 0),
      remaining: Number(advance.remaining_balance || 0),
      hardDeleted,
      expenseDeleted: expense_deleted,
      userName: userRow?.name || null,
      createdAt: new Date().toISOString(),
    }, db);
  } catch (_) { /* non-critical */ }

  res.json({ success: true, hard_deleted: hardDeleted, expense_deleted });
});

// ============================================================
// Deductions (خصومات)
// ============================================================

router.get("/:id/deductions", requirePagePermission("employees", "manage_deductions"), (req, res) => {
  const rows = getDb().prepare("SELECT * FROM employee_deductions WHERE employee_id = ? ORDER BY id DESC").all(req.params.id);
  res.json({ success: true, data: rows });
});

router.post("/:id/deductions", requirePagePermission("employees", "manage_deductions"), (req, res) => {
  const payload = req.body || {};
  const amount = Number(payload.amount || 0);

  if (amount <= 0) {
    return res.status(400).json({ success: false, message: "المبلغ يجب أن يكون أكبر من صفر" });
  }

  const info = getDb()
    .prepare(
      `INSERT INTO employee_deductions (employee_id, deduction_type, amount, is_recurring, notes, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.params.id,
      payload.deduction_type || 'other',
      amount,
      payload.is_recurring ? 1 : 0,
      payload.notes || null,
      req.user?.id || null,
      nowSql()
    );

  req.audit("create", "employee_deductions", { id: info.lastInsertRowid }, `💰 تم تسجيل خصم للموظف بقيمة ${amount}`);

  // Telegram notification
  try {
    const emp = getDb().prepare("SELECT name FROM employees WHERE id = ?").get(req.params.id);
    const userRow = req.user?.id ? getDb().prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
    notifyOwner(TG.DEDUCTION_CREATED, {
      employeeName: emp?.name || "غير محدد",
      amount,
      deductionType: payload.deduction_type || "other",
      isRecurring: !!payload.is_recurring,
      notes: payload.notes || null,
      userName: userRow?.name || null,
      createdAt: new Date().toISOString(),
    }, getDb());
  } catch (_) { /* non-critical */ }

  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM employee_deductions WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.delete("/:id/deductions/:deductionId", requirePagePermission("employees", "manage_deductions"), (req, res) => {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM employee_deductions WHERE id = ? AND employee_id = ?").get(req.params.deductionId, req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: "الخصم غير موجود" });

  db.prepare("UPDATE employee_deductions SET status = 'cancelled', cancelled_at = ? WHERE id = ?").run(nowSql(), req.params.deductionId);
  req.audit("delete", "employee_deductions", { id: req.params.deductionId }, `💰 تم إلغاء خصم`);

  // Telegram notification — cancelling a deduction raises the payout.
  try {
    const emp = db.prepare("SELECT name FROM employees WHERE id = ?").get(req.params.id);
    const userRow = req.user?.id ? db.prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
    notifyOwner(TG.DEDUCTION_DELETED, {
      employeeName: emp?.name || "غير محدد",
      amount: Number(existing.amount || 0),
      deductionType: existing.deduction_type || null,
      userName: userRow?.name || null,
      createdAt: new Date().toISOString(),
    }, db);
  } catch (_) { /* non-critical */ }

  res.json({ success: true });
});

// ============================================================
// Bonuses (مكافئات)
// ============================================================

router.get("/:id/bonuses", requirePagePermission("employees", "manage_bonuses"), (req, res) => {
  const rows = getDb().prepare("SELECT * FROM employee_bonuses WHERE employee_id = ? ORDER BY id DESC").all(req.params.id);
  res.json({ success: true, data: rows });
});

router.post("/:id/bonuses", requirePagePermission("employees", "manage_bonuses"), (req, res) => {
  const payload = req.body || {};
  const amount = Number(payload.amount || 0);

  if (amount <= 0) {
    return res.status(400).json({ success: false, message: "المبلغ يجب أن يكون أكبر من صفر" });
  }

  const info = getDb()
    .prepare(
      `INSERT INTO employee_bonuses (employee_id, bonus_type, amount, is_recurring, notes, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.params.id,
      payload.bonus_type || 'other',
      amount,
      payload.is_recurring ? 1 : 0,
      payload.notes || null,
      req.user?.id || null,
      nowSql()
    );

  req.audit("create", "employee_bonuses", { id: info.lastInsertRowid }, `🎁 تم تسجيل مكافأة للموظف بقيمة ${amount}`);

  // Telegram notification
  try {
    const emp = getDb().prepare("SELECT name FROM employees WHERE id = ?").get(req.params.id);
    const userRow = req.user?.id ? getDb().prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
    notifyOwner(TG.BONUS_CREATED, {
      employeeName: emp?.name || "غير محدد",
      amount,
      bonusType: payload.bonus_type || "other",
      isRecurring: !!payload.is_recurring,
      notes: payload.notes || null,
      userName: userRow?.name || null,
      createdAt: new Date().toISOString(),
    }, getDb());
  } catch (_) { /* non-critical */ }

  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM employee_bonuses WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.delete("/:id/bonuses/:bonusId", requirePagePermission("employees", "manage_bonuses"), (req, res) => {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM employee_bonuses WHERE id = ? AND employee_id = ?").get(req.params.bonusId, req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: "المكافأة غير موجودة" });

  db.prepare("UPDATE employee_bonuses SET status = 'cancelled', cancelled_at = ? WHERE id = ?").run(nowSql(), req.params.bonusId);
  req.audit("delete", "employee_bonuses", { id: req.params.bonusId }, `🎁 تم إلغاء مكافأة`);

  // Telegram notification
  try {
    const emp = db.prepare("SELECT name FROM employees WHERE id = ?").get(req.params.id);
    const userRow = req.user?.id ? db.prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
    notifyOwner(TG.BONUS_DELETED, {
      employeeName: emp?.name || "غير محدد",
      amount: Number(existing.amount || 0),
      bonusType: existing.bonus_type || null,
      userName: userRow?.name || null,
      createdAt: new Date().toISOString(),
    }, db);
  } catch (_) { /* non-critical */ }

  res.json({ success: true });
});

// ============================================================
// Salary Settlements (صرف الرواتب)
// ============================================================

router.get("/:id/settlements", requirePagePermission("employees", "settle_payroll"), (req, res) => {
  const rows = getDb().prepare("SELECT * FROM salary_settlements WHERE employee_id = ? ORDER BY id DESC").all(req.params.id);
  res.json({ success: true, data: rows });
});

router.post("/:id/settle", requirePagePermission("employees", "settle_payroll"), (req, res) => {
  const db = getDb();
  const payload = req.body || {};

  const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
  if (!employee) return res.status(404).json({ success: false, message: "الموظف غير موجود" });

  const periodStart = payload.period_start;
  const periodEnd = payload.period_end;
  if (!periodStart || !periodEnd) {
    return res.status(400).json({ success: false, message: "يجب تحديد فترة الراتب" });
  }

  const baseSalary = Number(employee.salary || 0);

  // جمع المكافآت النشطة (المتكررة + لمرة واحدة — لمرة واحدة تُستهلك بعد الصرف)
  const activeBonuses = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM employee_bonuses WHERE employee_id = ? AND status = 'active'"
  ).get(req.params.id);
  const totalBonuses = Number(activeBonuses.total || 0);

  // جمع الخصومات المتكررة النشطة
  const activeDeductions = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM employee_deductions WHERE employee_id = ? AND status = 'active' AND is_recurring = 1"
  ).get(req.params.id);
  const totalDeductions = Number(activeDeductions.total || 0);

  // الخصومات لمرة واحدة — تُخصم في هذا الصرف أو تُؤجَّل بالكامل للصرف القادم حسب اختيار المستخدم.
  // عند التأجيل لا تدخل في الحساب إطلاقاً (وإلا تُخصم مرتين).
  const applyOneTime = payload.consume_one_time === undefined ? true : !!payload.consume_one_time;
  const oneTimeDeductions = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM employee_deductions WHERE employee_id = ? AND status = 'active' AND is_recurring = 0"
  ).get(req.params.id);
  const totalOneTimeDeductions = applyOneTime ? Number(oneTimeDeductions.total || 0) : 0;

  // سداد السلف — يقبل مصفوفة من المبالغ المحددة من المستخدم (تُقرأ وتُقلَّم قبل أي تعديل)
  const advancePayments = Array.isArray(payload.advance_payments) ? payload.advance_payments : [];
  const advanceRows = [];
  let advanceDeductions = 0;
  for (const ap of advancePayments) {
    const advanceId = Number(ap.advance_id);
    const payAmount = Number(ap.amount || 0);
    if (payAmount <= 0) continue;
    const advance = db.prepare("SELECT * FROM employee_advances WHERE id = ? AND employee_id = ? AND status = 'active'").get(advanceId, req.params.id);
    if (!advance) continue;
    const actualPay = Math.min(payAmount, Number(advance.remaining_balance));
    if (actualPay <= 0) continue;
    advanceRows.push({ advance, actualPay });
    advanceDeductions += actualPay;
  }

  // صافي الفترة الحالية — يُرفض الصرف إذا تجاوزت الخصومات والسلف المستحق
  const totalDeductionsAll = totalDeductions + totalOneTimeDeductions + advanceDeductions;
  const periodNet = baseSalary + totalBonuses - totalDeductionsAll;
  if (periodNet < 0) {
    return res.status(400).json({ success: false, message: "الخصومات وسداد السلف تتجاوز الراتب المستحق — قلّل مبلغ سداد السلف أو أجّل الخصومات" });
  }

  // مستحقات سابقة للموظف (متبقي صرف جزئي مُفعَّل له الترحيل) — تُضاف للمستحق، لا تُخصم منه
  const previousOwedRow = db.prepare(
    "SELECT COALESCE(SUM(remaining_balance), 0) AS total FROM salary_settlements WHERE employee_id = ? AND status = 'partial' AND carry_forward = 1"
  ).get(req.params.id);
  const previousOwed = Number(previousOwedRow.total || 0);
  const totalDue = periodNet + previousOwed;

  // حساب المبلغ المدفوع والمتبقي
  const paidAmountRaw = payload.paid_amount;
  const isPartial = paidAmountRaw !== undefined && paidAmountRaw !== null && paidAmountRaw !== "";
  const paidAmount = isPartial ? Math.min(Math.max(Number(paidAmountRaw) || 0, 0), totalDue) : totalDue;
  if (isPartial && paidAmount <= 0 && totalDue > 0) {
    return res.status(400).json({ success: false, message: "أدخل مبلغ صرف جزئي صحيح" });
  }
  const remainingBalance = totalDue - paidAmount;
  const status = remainingBalance > 0 ? 'partial' : 'full';
  const carryForward = !!payload.carry_forward;

  const result = db.transaction(() => {
    // تطبيق مدفوعات السلف
    for (const { advance, actualPay } of advanceRows) {
      const newRemaining = Number(advance.remaining_balance) - actualPay;
      const newStatus = newRemaining <= 0 ? 'fully_repaid' : 'active';
      db.prepare("UPDATE employee_advances SET remaining_balance = ?, status = ? WHERE id = ?")
        .run(newRemaining, newStatus, advance.id);
      db.prepare("INSERT INTO employee_advance_payments (advance_id, amount, notes, created_by, payment_date) VALUES (?, ?, ?, ?, ?)")
        .run(advance.id, actualPay, `تسوية راتب — ${periodStart} إلى ${periodEnd}`, req.user?.id || null, nowSql());
    }

    // ترحيل المستحقات السابقة داخل هذا الصرف — الصفوف القديمة تصبح 'carried' ومتبقيها محسوب هنا
    if (previousOwed > 0) {
      db.prepare(
        "UPDATE salary_settlements SET status = 'carried' WHERE employee_id = ? AND status = 'partial' AND carry_forward = 1"
      ).run(req.params.id);
    }

    // إنشاء مصروف بالمبلغ المدفوع فقط — لا يُنشأ مصروف صفري
    let expenseId = null;
    if (paidAmount > 0) {
      const docNo = generateDocNumber('expense');
      const expenseResult = db
        .prepare(
          `INSERT INTO expenses (doc_no, amount, category_id, notes, description, payment_method, employee_id, treasury_id, created_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
        )
        .run(docNo, paidAmount, payload.category_id || null, null, payload.description || `راتب الموظف: ${employee.name} — عن فترة ${periodStart} إلى ${periodEnd}`, payload.payment_method || 'cash', req.params.id, nowSql(), req.user?.id || null);
      expenseId = expenseResult.lastInsertRowid;
    }

    // استهلاك الخصومات لمرة واحدة — فقط إذا دخلت في حساب هذا الصرف
    if (applyOneTime) {
      db.prepare(
        "UPDATE employee_deductions SET status = 'completed', completed_at = ? WHERE employee_id = ? AND status = 'active' AND is_recurring = 0"
      ).run(nowSql(), req.params.id);
    }

    // استهلاك المكافآت لمرة واحدة — دخلت في الحساب فلا تتكرر في الصرف القادم
    db.prepare(
      "UPDATE employee_bonuses SET status = 'completed', completed_at = ? WHERE employee_id = ? AND status = 'active' AND is_recurring = 0"
    ).run(nowSql(), req.params.id);

    // تسجيل صرف الراتب في salary_settlements
    const settleResult = db
      .prepare(
        `INSERT INTO salary_settlements
         (employee_id, period_start, period_end, base_salary, total_bonuses, total_deductions, advance_deductions, net_salary, previous_owed, paid_amount, remaining_balance, carry_forward, payment_method, description, settled_by, expense_id, settled_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.params.id,
        periodStart,
        periodEnd,
        baseSalary,
        totalBonuses,
        totalDeductionsAll,
        advanceDeductions,
        periodNet,
        previousOwed,
        paidAmount,
        remainingBalance,
        carryForward ? 1 : 0,
        payload.payment_method || 'cash',
        payload.description || `راتب الموظف: ${employee.name} — عن فترة ${periodStart} إلى ${periodEnd}`,
        req.user?.id || null,
        expenseId,
        nowSql(),
        status
      );

    return { expenseId, settleId: settleResult.lastInsertRowid, netSalary: totalDue, paidAmount, remainingBalance, status };
  })();

  const auditMsg = result.status === 'partial'
    ? `💰 تم صرف جزئي لراتب ${employee.name} — مدفوع ${result.paidAmount} / صافي ${result.netSalary}`
    : `💰 تم صرف راتب للموظف ${employee.name} — صافي ${result.netSalary}`;
  req.audit("create", "salary_settlements", { id: result.settleId }, auditMsg);

  // Telegram notification — a partial payout is its own event so the owner
  // sees the paid/remaining split and what happens to the remainder.
  try {
    const userRow = req.user?.id ? db.prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
    if (result.status === 'partial') {
      notifyOwner(TG.SALARY_PARTIAL_PAID, {
        kindLabel: "صرف جزئي للراتب",
        employeeName: employee.name,
        period: `${periodStart} → ${periodEnd}`,
        netSalary: result.netSalary,
        paidAmount: result.paidAmount,
        remaining: result.remainingBalance,
        carryForward,
        paymentMethod: payload.payment_method || 'cash',
        userName: userRow?.name || null,
        createdAt: new Date().toISOString(),
      }, db);
    } else {
      notifyOwner(TG.SALARY_SETTLED, {
        employeeName: employee.name,
        period: `${periodStart} → ${periodEnd}`,
        baseSalary,
        bonuses: totalBonuses,
        deductions: totalDeductionsAll,
        advanceDeductions,
        netSalary: result.netSalary,
        paidAmount: result.paidAmount,
        userName: userRow?.name || null,
        createdAt: new Date().toISOString(),
      }, db);
    }
  } catch (_) { /* non-critical */ }

  res.status(201).json({
    success: true,
    data: db.prepare("SELECT * FROM salary_settlements WHERE id = ?").get(result.settleId),
  });
});

// ============================================================
// Delete Salary Settlement (smart reversal)
// ============================================================

router.delete("/:id/settlements/:settlementId", requirePagePermission("employees", "settle_payroll"), (req, res) => {
  const db = getDb();
  const settlement = db.prepare("SELECT * FROM salary_settlements WHERE id = ? AND employee_id = ?").get(req.params.settlementId, req.params.id);
  if (!settlement) return res.status(404).json({ success: false, message: "سجل الصرف غير موجود" });

  const deleteExpense = req.query.delete_expense === 'true';

  const result = db.transaction(() => {
    const reversed_advances = [];
    const reversed_deductions = [];
    const reversed_bonuses = [];

    const advancePayments = db.prepare("SELECT * FROM employee_advance_payments WHERE notes LIKE ? AND payment_date >= ? AND payment_date <= ?")
      .all(`%تسوية راتب%`, settlement.period_start, settlement.settled_at);

    for (const ap of advancePayments) {
      const advance = db.prepare("SELECT * FROM employee_advances WHERE id = ?").get(ap.advance_id);
      if (advance) {
        const newRemaining = Number(advance.remaining_balance) + Number(ap.amount);
        const newStatus = newRemaining > 0 ? 'active' : advance.status;
        db.prepare("UPDATE employee_advances SET remaining_balance = ?, status = ? WHERE id = ?")
          .run(newRemaining, newStatus, advance.id);
        db.prepare("DELETE FROM employee_advance_payments WHERE id = ?").run(ap.id);
        reversed_advances.push({ advance_id: advance.id, amount: ap.amount });
      }
    }

    if (settlement.expense_id && deleteExpense) {
      db.prepare("UPDATE salary_settlements SET expense_id = NULL WHERE id = ?").run(req.params.settlementId);
      db.prepare("DELETE FROM expenses WHERE id = ?").run(settlement.expense_id);
    }

    db.prepare("DELETE FROM salary_settlements WHERE id = ?").run(req.params.settlementId);

    return { reversed_advances, reversed_deductions, reversed_bonuses, expense_deleted: deleteExpense && !!settlement.expense_id };
  })();

  req.audit("delete", "salary_settlements", { id: req.params.settlementId }, `💰 تم إلغاء صرف راتب للموظف — أُعيد ${result.reversed_advances.length} قسط سلفة`);

  // Telegram notification — reversing a payroll settlement moves real money.
  try {
    const emp = db.prepare("SELECT name FROM employees WHERE id = ?").get(req.params.id);
    const userRow = req.user?.id ? db.prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
    notifyOwner(TG.SALARY_SETTLEMENT_DELETED, {
      employeeName: emp?.name || "غير محدد",
      period: `${settlement.period_start || "—"} → ${settlement.period_end || "—"}`,
      paidAmount: Number(settlement.paid_amount ?? settlement.net_salary ?? 0),
      netSalary: Number(settlement.net_salary || 0),
      expenseDeleted: result.expense_deleted,
      reversedAdvances: result.reversed_advances.length,
      userName: userRow?.name || null,
      createdAt: new Date().toISOString(),
    }, db);
  } catch (_) { /* non-critical */ }

  res.json({ success: true, data: result });
});

router.get("/:id/salary-balance", requirePagePermission("employees", "settle_payroll"), (req, res) => {
  const db = getDb();
  const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
  if (!employee) return res.status(404).json({ success: false, message: "الموظف غير موجود" });

  // كل المتبقي المستحق للموظف (سواء مُفعَّل له الترحيل التلقائي أم لا)
  const partial = db.prepare(
    "SELECT COALESCE(SUM(remaining_balance), 0) AS total_outstanding FROM salary_settlements WHERE employee_id = ? AND status = 'partial'"
  ).get(req.params.id);

  // الجزء الذي سيُضاف تلقائياً للمستحق في الصرف القادم
  const carry = db.prepare(
    "SELECT COALESCE(SUM(remaining_balance), 0) AS total FROM salary_settlements WHERE employee_id = ? AND status = 'partial' AND carry_forward = 1"
  ).get(req.params.id);

  const totalPaid = db.prepare(
    "SELECT COALESCE(SUM(COALESCE(paid_amount, net_salary)), 0) AS total_paid FROM salary_settlements WHERE employee_id = ?"
  ).get(req.params.id);

  const totalSettled = db.prepare(
    "SELECT COUNT(*) AS count FROM salary_settlements WHERE employee_id = ?"
  ).get(req.params.id);

  res.json({
    success: true,
    data: {
      outstanding_balance: Number(partial.total_outstanding || 0),
      carry_forward_balance: Number(carry.total || 0),
      total_paid: Number(totalPaid.total_paid || 0),
      total_settlements: totalSettled.count,
      salary_period: employee.salary_period,
      base_salary: Number(employee.salary || 0),
    },
  });
});

// سداد الرصيد المتبقي من فترات سابقة
router.post("/:id/pay-outstanding", requirePagePermission("employees", "settle_payroll"), (req, res) => {
  const db = getDb();
  const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
  if (!employee) return res.status(404).json({ success: false, message: "الموظف غير موجود" });

  const payload = req.body || {};
  const paidAmount = Number(payload.paid_amount || 0);
  if (paidAmount <= 0) return res.status(400).json({ success: false, message: "أدخل المبلغ" });

  // يشمل كل الصرف الجزئي المتبقي — المتتبَّع يدوياً يُسدَّد من هنا أيضاً
  const partials = db.prepare(
    "SELECT * FROM salary_settlements WHERE employee_id = ? AND status = 'partial' ORDER BY id ASC"
  ).all(req.params.id);

  const totalOutstanding = partials.reduce((s, r) => s + Number(r.remaining_balance || 0), 0);
  if (totalOutstanding <= 0) return res.status(400).json({ success: false, message: "لا يوجد رصيد متبقي" });

  const actualPay = Math.min(paidAmount, totalOutstanding);

  const result = db.transaction(() => {
    let remaining = actualPay;

    for (const p of partials) {
      if (remaining <= 0) break;
      const rb = Number(p.remaining_balance);
      const settle = Math.min(remaining, rb);
      const newRb = rb - settle;
      const newStatus = newRb <= 0 ? 'settled' : 'partial';
      db.prepare("UPDATE salary_settlements SET remaining_balance = ?, paid_amount = COALESCE(paid_amount, 0) + ?, status = ? WHERE id = ?")
        .run(newRb, settle, newStatus, p.id);
      remaining -= settle;
    }

    const paidOff = actualPay - remaining;

    const docNo = generateDocNumber('expense');
    const categoryId = payload.category_id || null;
    const description = `سداد رصيد متبقي — ${employee.name} — ${paidOff.toLocaleString()} ج.م`;
    const expenseResult = db
      .prepare(
        `INSERT INTO expenses (doc_no, amount, category_id, notes, description, payment_method, employee_id, treasury_id, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(docNo, paidOff, categoryId, null, description, payload.payment_method || 'cash', req.params.id, nowSql(), req.user?.id || null);

    return { paidOff, expenseId: expenseResult.lastInsertRowid };
  })();

  const auditMsg = `💰 سداد رصيد متبقي لـ ${employee.name} — ${result.paidOff.toLocaleString()} ج.م`;
  req.audit("update", "salary_settlements", { employee_id: Number(req.params.id) }, auditMsg);

  // Telegram notification — settling a previously-carried salary remainder.
  try {
    const userRow = req.user?.id ? db.prepare("SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?").get(req.user.id) : null;
    notifyOwner(TG.SALARY_PARTIAL_PAID, {
      kindLabel: "سداد متبقي راتب",
      employeeName: employee.name,
      period: "مستحقات سابقة",
      netSalary: totalOutstanding,
      paidAmount: result.paidOff,
      remaining: totalOutstanding - result.paidOff,
      carryForward: null,
      paymentMethod: payload.payment_method || 'cash',
      userName: userRow?.name || null,
      createdAt: new Date().toISOString(),
    }, db);
  } catch (_) { /* non-critical */ }

  res.json({ success: true, data: { paid_off: result.paidOff } });
});

module.exports = router;
