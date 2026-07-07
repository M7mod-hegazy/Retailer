function getPageParams(opts = {}) {
  const page = Math.max(1, parseInt(opts.page, 10) || 1);
  const pageSize = Math.min(50000, Math.max(1, parseInt(opts.pageSize, 10) || 200));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function paginateSql(sql, opts = {}) {
  const { pageSize, offset } = getPageParams(opts);
  const hasSelect = sql.trim().toUpperCase().startsWith("SELECT");
  if (!hasSelect) return sql;
  // UNION queries cannot be patched with COUNT(*) OVER() on the first SELECT
  // because that would change the column count on one side of the UNION.
  // Instead, wrap the entire UNION in a subquery.
  if (/\bUNION\b/i.test(sql)) {
    const wrapped = `SELECT *, COUNT(*) OVER() AS _total_rows FROM (${sql}) AS _union_paged LIMIT ? OFFSET ?`;
    return { sql: wrapped, params: [pageSize, offset] };
  }
  const countSql = sql.replace(/^SELECT\s(.+?)\sFROM\s/is, "SELECT COUNT(*) OVER() AS _total_rows, $1 FROM ");
  const paginatedSql = `${countSql} LIMIT ? OFFSET ?`;
  return { sql: paginatedSql, params: [pageSize, offset] };
}

function extractTotalRows(rows) {
  if (!rows || !rows.length) return 0;
  return rows[0]._total_rows || rows.length;
}

function stripTotalRows(rows) {
  if (!rows || !rows.length) return rows;
  return rows.map(({ _total_rows, ...rest }) => rest);
}

module.exports = { getPageParams, paginateSql, extractTotalRows, stripTotalRows };
