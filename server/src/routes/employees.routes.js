const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { countSafe, hasAnyRelated, buildImpact } = require("../utils/relatedRecords");
const { generateDocNumber } = require("../utils/docNumber");
const { nowSql } = require("../utils/datetime");

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

router.delete("/:id", requirePagePermission("employees", "delete"), (req, res) => {
  try {
    const db = getDb();

    if (hasAnyRelated(employeeRelated(db, req.params.id))) {
      db.prepare("UPDATE employees SET is_active = 0 WHERE id = ?").run(req.params.id);
      req.audit("delete", "employees", { id: req.params.id }, `👤 تم أرشفة موظف`);
      return res.json({ success: true, archived: true, message: "تم أرشفة الموظف لأنه مرتبط بعمليات أخرى" });
    }

    db.prepare("DELETE FROM employees WHERE id = ?").run(req.params.id);
    req.audit("delete", "employees", { id: req.params.id }, `👤 تم حذف موظف`);
    res.json({ success: true });
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
  res.json({
    success: true,
    data: db.prepare("SELECT * FROM employee_advances WHERE id = ?").get(req.params.advanceId),
  });
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

  // جمع المكافآت النشطة
  const activeBonuses = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM employee_bonuses WHERE employee_id = ? AND status = 'active'"
  ).get(req.params.id);
  const totalBonuses = Number(activeBonuses.total || 0);

  // جمع الخصومات المتكررة النشطة
  const activeDeductions = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM employee_deductions WHERE employee_id = ? AND status = 'active' AND is_recurring = 1"
  ).get(req.params.id);
  const totalDeductions = Number(activeDeductions.total || 0);

  // الخصومات لمرة واحدة غير المطبقة بعد
  const oneTimeDeductions = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM employee_deductions WHERE employee_id = ? AND status = 'active' AND is_recurring = 0"
  ).get(req.params.id);
  const totalOneTimeDeductions = Number(oneTimeDeductions.total || 0);

  // سداد السلف — يقبل مصفوفة من المبالغ المحددة من المستخدم
  const advancePayments = Array.isArray(payload.advance_payments) ? payload.advance_payments : [];

  const result = db.transaction(() => {
    let advanceDeductions = 0;

    // معالجة مدفوعات السلف
    for (const ap of advancePayments) {
      const advanceId = Number(ap.advance_id);
      const payAmount = Number(ap.amount || 0);
      if (payAmount <= 0) continue;

      const advance = db.prepare("SELECT * FROM employee_advances WHERE id = ? AND employee_id = ? AND status = 'active'").get(advanceId, req.params.id);
      if (!advance) continue;

      const actualPay = Math.min(payAmount, advance.remaining_balance);
      advanceDeductions += actualPay;
      const newRemaining = advance.remaining_balance - actualPay;
      const newStatus = newRemaining <= 0 ? 'fully_repaid' : 'active';

      db.prepare("UPDATE employee_advances SET remaining_balance = ?, status = ? WHERE id = ?")
        .run(newRemaining, newStatus, advanceId);
      db.prepare("INSERT INTO employee_advance_payments (advance_id, amount, notes, created_by, payment_date) VALUES (?, ?, ?, ?, ?)")
        .run(advanceId, actualPay, `تسوية راتب — ${periodStart} إلى ${periodEnd}`, req.user?.id || null, nowSql());
    }

    const totalDeductionsAll = totalDeductions + totalOneTimeDeductions + advanceDeductions;
    const netSalary = Math.max(0, baseSalary + totalBonuses - totalDeductionsAll);

    // إنشاء مصروف
    const docNo = generateDocNumber('expense');
    const expenseResult = db
      .prepare(
        `INSERT INTO expenses (doc_no, amount, category_id, notes, description, payment_method, employee_id, treasury_id, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(docNo, netSalary, payload.category_id || null, null, payload.description || `راتب الموظف: ${employee.name} — عن فترة ${periodStart} إلى ${periodEnd}`, payload.payment_method || 'cash', req.params.id, nowSql(), req.user?.id || null);

    // تسوية الخصومات لمرة واحدة
    db.prepare(
      "UPDATE employee_deductions SET status = 'completed', completed_at = ? WHERE employee_id = ? AND status = 'active' AND is_recurring = 0"
    ).run(nowSql(), req.params.id);

    // تسجيل صرف الراتب
    const settleResult = db
      .prepare(
        `INSERT INTO salary_settlements
         (employee_id, period_start, period_end, base_salary, total_bonuses, total_deductions, advance_deductions, net_salary, payment_method, description, settled_by, expense_id, settled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.params.id,
        periodStart,
        periodEnd,
        baseSalary,
        totalBonuses,
        totalDeductionsAll,
        advanceDeductions,
        netSalary,
        payload.payment_method || 'cash',
        payload.description || `راتب الموظف: ${employee.name} — عن فترة ${periodStart} إلى ${periodEnd}`,
        req.user?.id || null,
        expenseResult.lastInsertRowid,
        nowSql()
      );

    return { expenseId: expenseResult.lastInsertRowid, settleId: settleResult.lastInsertRowid, netSalary };
  })();

  req.audit("create", "salary_settlements", { id: result.settleId }, `💰 تم صرف راتب للموظف ${employee.name} — صافي ${result.netSalary}`);
  res.status(201).json({
    success: true,
    data: db.prepare("SELECT * FROM salary_settlements WHERE id = ?").get(result.settleId),
  });
});

module.exports = router;
