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

module.exports = {
  employeeAdjustments,
};
