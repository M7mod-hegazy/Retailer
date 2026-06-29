const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");

function employeeAdjustments(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT ea.id, e.name AS employee_name,
      ea.adjustment_type, ea.amount, ea.reason,
      u.full_name AS created_by,
      DATE(ea.created_at) AS date
    FROM employee_adjustments ea
    LEFT JOIN employees e ON e.id = ea.employee_id
    LEFT JOIN users u ON u.id = ea.user_id
    WHERE 1=1 ${addDateFilter("ea.created_at", startDate, endDate, params)}
    ORDER BY ea.created_at DESC
  `).all(...params);
}

function employeeList(startDate, endDate, opts = {}) {
  const db = getDb();
  const archived = opts.status === "archived";
  const statusFilter = archived
    ? "AND (e.is_active = 0)"
    : "AND (e.is_active = 1 OR e.is_active IS NULL)";
  const sql = `
    SELECT e.id, e.name AS employee_name, e.job_title, e.salary, e.salary_period,
      e.working_days_per_month,
      CASE
        WHEN e.salary_period = 'monthly' THEN CAST(ROUND(CAST(e.salary AS REAL) / COALESCE(NULLIF(e.working_days_per_month, 0), 26)) AS INTEGER)
        WHEN e.salary_period = 'weekly' THEN CAST(ROUND(CAST(e.salary AS REAL) / 6) AS INTEGER)
        WHEN e.salary_period = 'daily' THEN CAST(e.salary AS INTEGER)
        ELSE 0
      END AS daily_salary,
      (SELECT COALESCE(SUM(amount), 0) FROM employee_deductions WHERE employee_id = e.id AND status = 'active') AS active_deductions_total,
      (SELECT COALESCE(SUM(amount), 0) FROM employee_bonuses WHERE employee_id = e.id AND status = 'active') AS active_bonuses_total,
      (SELECT COALESCE(SUM(remaining_balance), 0) FROM employee_advances WHERE employee_id = e.id AND status = 'active') AS active_advances_balance,
      (SELECT COALESCE(SUM(net_salary), 0) FROM salary_settlements WHERE employee_id = e.id) AS total_paid,
      e.created_at,
      CASE WHEN e.is_active = 1 OR e.is_active IS NULL THEN 'نشط' ELSE 'مؤرشف' END AS status
    FROM employees e
    WHERE 1=1 ${statusFilter}
    ORDER BY e.name ASC
  `;
  return db.prepare(sql).all();
}

function employeeDeductions(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const parts = [`${addDateFilter("ed.created_at", startDate, endDate, params)}`];
  if (opts.employee_id) { parts.push("AND ed.employee_id = ?"); params.push(Number(opts.employee_id)); }
  if (opts.deduction_type) { parts.push("AND ed.deduction_type = ?"); params.push(opts.deduction_type); }
  if (opts.status) { parts.push("AND ed.status = ?"); params.push(opts.status); }
  const sql = `
    SELECT ed.id, ed.created_at AS date, e.name AS employee_name,
      ed.deduction_type,
      CASE ed.deduction_type
        WHEN 'absence' THEN 'غياب' WHEN 'fine' THEN 'غرامة'
        WHEN 'insurance' THEN 'تأمين' WHEN 'other' THEN 'أخرى'
      END AS deduction_type_label,
      ed.amount,
      CASE WHEN ed.is_recurring = 1 THEN 'متكرر' ELSE 'مرة واحدة' END AS recurring_label,
      ed.is_recurring, ed.status, ed.notes, ed.created_at, ed.completed_at, ed.cancelled_at,
      ed.created_by
    FROM employee_deductions ed
    JOIN employees e ON e.id = ed.employee_id
    WHERE 1=1 ${parts.join(" ")}
    ORDER BY ed.created_at DESC
  `;
  return db.prepare(sql).all(...params);
}

function employeeBonuses(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const parts = [`${addDateFilter("eb.created_at", startDate, endDate, params)}`];
  if (opts.employee_id) { parts.push("AND eb.employee_id = ?"); params.push(Number(opts.employee_id)); }
  if (opts.bonus_type) { parts.push("AND eb.bonus_type = ?"); params.push(opts.bonus_type); }
  if (opts.status) { parts.push("AND eb.status = ?"); params.push(opts.status); }
  const sql = `
    SELECT eb.id, eb.created_at AS date, e.name AS employee_name,
      eb.bonus_type,
      CASE eb.bonus_type
        WHEN 'performance' THEN 'أداء' WHEN 'holiday' THEN 'إجازة'
        WHEN 'overtime' THEN 'إضافي' WHEN 'transportation' THEN 'مواصلات'
        WHEN 'other' THEN 'أخرى'
      END AS bonus_type_label,
      eb.amount,
      CASE WHEN eb.is_recurring = 1 THEN 'متكرر' ELSE 'مرة واحدة' END AS recurring_label,
      eb.is_recurring, eb.status, eb.notes, eb.created_at, eb.completed_at, eb.cancelled_at,
      eb.created_by
    FROM employee_bonuses eb
    JOIN employees e ON e.id = eb.employee_id
    WHERE 1=1 ${parts.join(" ")}
    ORDER BY eb.created_at DESC
  `;
  return db.prepare(sql).all(...params);
}

function employeeAdvances(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const parts = [`${addDateFilter("ea.created_at", startDate, endDate, params)}`];
  if (opts.employee_id) { parts.push("AND ea.employee_id = ?"); params.push(Number(opts.employee_id)); }
  if (opts.status) { parts.push("AND ea.status = ?"); params.push(opts.status); }
  const sql = `
    SELECT ea.id, ea.created_at AS date, e.name AS employee_name,
      ea.amount, ea.remaining_balance,
      (ea.amount - ea.remaining_balance) AS repaid_amount,
      ea.installment_count, ea.installment_amount, ea.status, ea.notes, ea.created_at,
      ea.created_by
    FROM employee_advances ea
    JOIN employees e ON e.id = ea.employee_id
    WHERE 1=1 ${parts.join(" ")}
    ORDER BY ea.created_at DESC
  `;
  return db.prepare(sql).all(...params);
}

function employeePayroll(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const parts = [`${addDateFilter("ss.settled_at", startDate, endDate, params)}`];
  if (opts.employee_id) { parts.push("AND ss.employee_id = ?"); params.push(Number(opts.employee_id)); }
  if (opts.payment_method) { parts.push("AND ss.payment_method = ?"); params.push(opts.payment_method); }
  const sql = `
    SELECT ss.id, ss.settled_at AS date, e.name AS employee_name,
      ss.period_start, ss.period_end, ss.base_salary, ss.total_bonuses,
      ss.total_deductions, ss.advance_deductions, ss.net_salary,
      ss.payment_method, ss.description, ss.settled_at, ss.settled_by, ss.expense_id
    FROM salary_settlements ss
    JOIN employees e ON e.id = ss.employee_id
    WHERE 1=1 ${parts.join(" ")}
    ORDER BY ss.settled_at DESC
  `;
  return db.prepare(sql).all(...params);
}

function employeeFullHistory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];

  const buildUnion = (table, alias, dateCol, selectMap, joins = "", employeeIdCol) => {
    const empCol = employeeIdCol || `${alias}.employee_id`;
    const pLen = params.length;
    const dateFilter = addDateFilter(`${alias}.${dateCol}`, startDate, endDate, params);
    const empFilter = opts.employee_id
      ? `AND ${empCol} = ?`
      : "";
    if (opts.employee_id) params.push(Number(opts.employee_id));
    const cols = [
      `${alias}.${dateCol} AS date`,
      `${empCol} AS employee_id`,
      `e.name AS employee_name`,
      ...Object.entries(selectMap).map(([k, v]) => `${v} AS ${k}`),
    ];
    return {
      sql: `SELECT ${cols.join(", ")} FROM ${table} ${alias} ${joins} WHERE 1=1 ${dateFilter} ${empFilter}`,
      paramsUsed: params.length - pLen,
    };
  };

  const unions = [
    buildUnion("employee_deductions", "ed", "created_at", {
      tx_type: "'deduction'", tx_type_label: "'خصم'",
      amount: "ed.amount", status: "ed.status",
      description: "ed.notes", sub_type: "ed.deduction_type", ref_id: "ed.id",
    }, "JOIN employees e ON e.id = ed.employee_id"),

    buildUnion("employee_bonuses", "eb", "created_at", {
      tx_type: "'bonus'", tx_type_label: "'مكافأة'",
      amount: "eb.amount", status: "eb.status",
      description: "eb.notes", sub_type: "eb.bonus_type", ref_id: "eb.id",
    }, "JOIN employees e ON e.id = eb.employee_id"),

    buildUnion("employee_advances", "ea", "created_at", {
      tx_type: "'advance'", tx_type_label: "'سلفة'",
      amount: "ea.amount", status: "ea.status",
      description: "ea.notes", sub_type: "CAST(ea.installment_count AS TEXT)", ref_id: "ea.id",
    }, "JOIN employees e ON e.id = ea.employee_id"),

    buildUnion("employee_advance_payments", "eap", "payment_date", {
      tx_type: "'advance_payment'", tx_type_label: "'دفعة سلفة'",
      amount: "eap.amount", status: "'completed'",
      description: "eap.notes", sub_type: "CAST(ea.id AS TEXT)", ref_id: "eap.id",
    }, "JOIN employee_advances ea ON ea.id = eap.advance_id JOIN employees e ON e.id = ea.employee_id", "ea.employee_id"),

    buildUnion("salary_settlements", "ss", "settled_at", {
      tx_type: "'settlement'", tx_type_label: "'صرف راتب'",
      amount: "ss.net_salary", status: "'settled'",
      description: "ss.description", sub_type: "ss.payment_method", ref_id: "ss.id",
    }, "JOIN employees e ON e.id = ss.employee_id"),
  ];

  let sql = unions.map(u => u.sql).join(" UNION ALL ");
  sql += " ORDER BY date DESC";

  if (opts.tx_type) {
    sql = `SELECT * FROM (${sql}) WHERE tx_type = ?`;
    params.push(opts.tx_type);
  }

  return db.prepare(sql).all(...params);
}

module.exports = {
  employeeAdjustments,
  employeeList,
  employeeDeductions,
  employeeBonuses,
  employeeAdvances,
  employeePayroll,
  employeeFullHistory,
};
