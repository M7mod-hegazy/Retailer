const { getDb } = require("../../config/database");

function physicalCountHistory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  let where = "WHERE 1=1";

  if (startDate) { where += " AND pcs.created_at >= ?"; params.push(startDate); }
  if (endDate) { where += " AND pcs.created_at <= ?"; params.push(endDate + " 23:59:59"); }
  if (opts.warehouse_id) { where += " AND pcs.warehouse_id = ?"; params.push(Number(opts.warehouse_id)); }
  if (opts.status) { where += " AND pcs.status = ?"; params.push(opts.status); }
  if (opts.type) { where += " AND pcs.type = ?"; params.push(opts.type); }

  const rows = db.prepare(`
    SELECT pcs.id, pcs.name, pcs.type, pcs.scope, pcs.status, pcs.notes,
           pcs.created_at, pcs.updated_at, pcs.completed_at,
           w.name AS warehouse_name, ic.name AS category_name,
           cb.full_name AS completed_by_name,
           crb.full_name AS created_by_name,
           COUNT(pcl.id) AS total_items,
           SUM(CASE WHEN pcl.touched = 1 THEN 1 ELSE 0 END) AS counted_items,
           SUM(CASE WHEN pcl.variance = 0 AND pcl.touched = 1 THEN 1 ELSE 0 END) AS matched_items,
           SUM(CASE WHEN pcl.variance > 0 THEN 1 ELSE 0 END) AS surplus_count,
           SUM(CASE WHEN pcl.variance < 0 THEN 1 ELSE 0 END) AS deficit_count,
           SUM(CASE WHEN pcl.variance > 0 THEN pcl.variance ELSE 0 END) AS total_surplus,
           SUM(CASE WHEN pcl.variance < 0 THEN ABS(pcl.variance) ELSE 0 END) AS total_deficit
    FROM physical_count_sessions pcs
    LEFT JOIN warehouses w ON w.id = pcs.warehouse_id
    LEFT JOIN item_categories ic ON ic.id = pcs.category_id
    LEFT JOIN users cb ON cb.id = pcs.completed_by
    LEFT JOIN users crb ON crb.id = (SELECT pcl2.counted_by FROM physical_count_lines pcl2 WHERE pcl2.session_id = pcs.id AND pcl2.counted_by IS NOT NULL LIMIT 1)
    LEFT JOIN physical_count_lines pcl ON pcl.session_id = pcs.id
    ${where}
    GROUP BY pcs.id
    ORDER BY pcs.created_at DESC
  `).all(...params);

  return rows;
}

module.exports = { physicalCountHistory };
