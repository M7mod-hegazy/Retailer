const { getDb } = require("../config/database");
const { stockValuation } = require("../reports/queries/inventory");
const { arAging, apAging } = require("../reports/queries/accounts");
const { addDateFilter, getCostColumn, getReturnCostColumn } = require("../reports/helpers");

const COST_METHODS = new Set(["wacc", "fifo", "lifo", "last_purchase"]);

const METRICS = [
  { key: "stock", label: "قيمة المخزون", full_report: "stock-valuation" },
  { key: "cash", label: "النقدية في الخزائن والبنوك", full_report: "treasury" },
  { key: "ar", label: "ذمم العملاء", full_report: "ar-aging" },
  { key: "ap", label: "ذمم الموردين", full_report: "ap-aging" },
  { key: "expenses", label: "المصروفات", full_report: "detailed-expenses" },
  { key: "revenues", label: "الإيرادات الأخرى", full_report: "detailed-revenues" },
  { key: "withdrawals", label: "المسحوبات", full_report: "withdrawals-report" },
  { key: "net_profit", label: "صافي الربح", full_report: "profit-loss" },
];

function normalizeCostMethod(method) {
  return COST_METHODS.has(method) ? method : "wacc";
}

function valueOf(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function rowsTotal(rows, key) {
  return valueOf(rows.reduce((sum, row) => sum + Number(row[key] || 0), 0));
}

function dateWhere(column, startDate, endDate, params) {
  return addDateFilter(column, startDate, endDate, params);
}

function getStockRows(startDate, endDate, costMethod) {
  return stockValuation(startDate, endDate, { cost_method: costMethod }).map((row) => {
    const quantity = Number(row.total_quantity || 0);
    const value = Number(row.total_value || 0);
    const unitCost = quantity ? value / quantity : Number(row.selected_cost || row.wacc || row.last_purchase_cost || 0);
    return {
      item_id: row.item_id,
      item_code: row.item_code,
      item_name: row.name,
      category_name: row.category_name || "",
      warehouse_id: row.warehouse_id,
      warehouse_name: row.warehouse_name || "",
      quantity,
      unit_cost: valueOf(unitCost),
      value: valueOf(value),
    };
  });
}

function getCashRows(db) {
  const treasuries = db.prepare(`
    SELECT id, name, 'treasury' AS type, COALESCE(balance, 0) AS balance
    FROM treasuries
    WHERE is_active = 1 OR is_active IS NULL
  `).all();
  const banks = db.prepare(`
    SELECT id, name, 'bank' AS type, COALESCE(balance, 0) AS balance
    FROM banks
    WHERE is_active = 1 OR is_active IS NULL
  `).all();
  return [...treasuries, ...banks].map((row) => ({ ...row, balance: valueOf(row.balance) }));
}

function getExpenseRows(db, startDate, endDate) {
  const params = [];
  return db.prepare(`
    SELECT e.id, e.doc_no, e.created_at AS date, COALESCE(ec.name, '') AS category_name,
      COALESCE(e.payment_method, '') AS payment_method,
      COALESCE(e.description, e.notes, '') AS description,
      COALESCE(e.amount, 0) AS amount,
      COALESCE(u.username, u.full_name, '') AS user_name
    FROM expenses e
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    LEFT JOIN users u ON u.id = e.created_by
    WHERE 1=1 ${dateWhere("e.created_at", startDate, endDate, params)}
    ORDER BY e.created_at DESC, e.id DESC
  `).all(...params).map((row) => ({ ...row, amount: valueOf(row.amount) }));
}

function getRevenueRows(db, startDate, endDate) {
  const params = [];
  return db.prepare(`
    SELECT r.id, r.doc_no, r.created_at AS date, COALESCE(ec.name, '') AS category_name,
      COALESCE(r.payment_method, '') AS payment_method,
      COALESCE(r.description, r.notes, '') AS description,
      COALESCE(r.amount, 0) AS amount,
      COALESCE(u.username, u.full_name, '') AS user_name
    FROM revenues r
    LEFT JOIN revenue_categories ec ON ec.id = r.category_id
    LEFT JOIN users u ON u.id = r.created_by
    WHERE 1=1 ${dateWhere("r.created_at", startDate, endDate, params)}
    ORDER BY r.created_at DESC, r.id DESC
  `).all(...params).map((row) => ({ ...row, amount: valueOf(row.amount) }));
}

function getWithdrawalRows(db, startDate, endDate) {
  const params = [];
  return db.prepare(`
    SELECT w.id, w.doc_no, w.created_at AS date, COALESCE(wc.name, '') AS category_name,
      COALESCE(w.payment_method, '') AS payment_method,
      COALESCE(w.note, '') AS reason,
      COALESCE(w.amount, 0) AS amount,
      COALESCE(u.username, u.full_name, '') AS user_name
    FROM withdrawals w
    LEFT JOIN withdrawal_categories wc ON wc.id = w.category_id
    LEFT JOIN users u ON u.id = w.created_by
    WHERE 1=1 ${dateWhere("w.created_at", startDate, endDate, params)}
    ORDER BY w.created_at DESC, w.id DESC
  `).all(...params).map((row) => ({ ...row, amount: valueOf(row.amount) }));
}

function getProfitRows(db, startDate, endDate, costMethod, expenses, revenues, withdrawals) {
  const invoiceParams = [];
  const returnParams = [];
  const costCol = getCostColumn(costMethod);
  const returnCostCol = getReturnCostColumn(costMethod);
  const sales = db.prepare(`
    SELECT COALESCE(SUM(i.total), 0) AS gross_sales,
      COALESCE(SUM(cost_agg.cogs), 0) AS cogs,
      COUNT(DISTINCT i.id) AS invoice_count
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id, SUM(quantity * ${costCol}) AS cogs
      FROM invoice_lines
      GROUP BY invoice_id
    ) cost_agg ON cost_agg.invoice_id = i.id
    WHERE i.status != 'cancelled' ${dateWhere("i.created_at", startDate, endDate, invoiceParams)}
  `).get(...invoiceParams);
  const returns = db.prepare(`
    SELECT COALESCE(SUM(sr.total), 0) AS returns_amount,
      COALESCE(SUM(srl.quantity * ${returnCostCol}), 0) AS return_cost
    FROM sales_returns sr
    LEFT JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
    LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
    LEFT JOIN items it ON it.id = srl.item_id
    WHERE sr.status = 'active' ${dateWhere("sr.created_at", startDate, endDate, returnParams)}
  `).get(...returnParams);

  const grossSales = Number(sales.gross_sales || 0);
  const returnsAmount = Number(returns.returns_amount || 0);
  const cogs = Number(sales.cogs || 0);
  const returnCost = Number(returns.return_cost || 0);
  const netSales = grossSales - returnsAmount;
  const grossProfit = netSales - cogs + returnCost;
  const netProfit = grossProfit + Number(revenues || 0) - Number(expenses || 0) - Number(withdrawals || 0);

  return [
    { label: "المبيعات", amount: valueOf(grossSales), source: "sales", count: Number(sales.invoice_count || 0) },
    { label: "مرتجعات المبيعات", amount: valueOf(-returnsAmount), source: "returns" },
    { label: "صافي المبيعات", amount: valueOf(netSales), source: "net_sales" },
    { label: "تكلفة البضاعة المباعة", amount: valueOf(-cogs + returnCost), source: "cogs", cost_method: costMethod },
    { label: "مجمل الربح", amount: valueOf(grossProfit), source: "gross_profit" },
    { label: "الإيرادات الأخرى", amount: valueOf(revenues), source: "revenues" },
    { label: "المصروفات", amount: valueOf(-expenses), source: "expenses" },
    { label: "المسحوبات", amount: valueOf(-withdrawals), source: "withdrawals" },
    { label: "صافي الربح", amount: valueOf(netProfit), source: "net_profit" },
  ];
}

function computeOwnerStatement(startDate, endDate, costMethod = "wacc") {
  const db = getDb();
  const method = normalizeCostMethod(costMethod);
  const stockRows = getStockRows(startDate, endDate, method);
  const cashRows = getCashRows(db);
  const arRows = arAging(startDate, endDate).map((row) => ({ ...row, total_due: valueOf(row.total_due) }));
  const apRows = apAging(startDate, endDate).map((row) => ({ ...row, total_due: valueOf(row.total_due) }));
  const expenseRows = getExpenseRows(db, startDate, endDate);
  const revenueRows = getRevenueRows(db, startDate, endDate);
  const withdrawalRows = getWithdrawalRows(db, startDate, endDate);

  const expenses = rowsTotal(expenseRows, "amount");
  const revenues = rowsTotal(revenueRows, "amount");
  const withdrawals = rowsTotal(withdrawalRows, "amount");
  const profitRows = getProfitRows(db, startDate, endDate, method, expenses, revenues, withdrawals);

  const values = {
    stock: rowsTotal(stockRows, "value"),
    cash: rowsTotal(cashRows, "balance"),
    ar: rowsTotal(arRows, "total_due"),
    ap: rowsTotal(apRows, "total_due"),
    expenses,
    revenues,
    withdrawals,
    net_profit: valueOf(profitRows.find((row) => row.source === "net_profit")?.amount || 0),
  };

  return {
    period_start: startDate,
    period_end: endDate,
    cost_method: method,
    metrics: METRICS.map((metric) => ({ ...metric, value: values[metric.key] || 0 })),
    values,
    rows: {
      stock: stockRows,
      cash: cashRows,
      ar: arRows,
      ap: apRows,
      expenses: expenseRows,
      revenues: revenueRows,
      withdrawals: withdrawalRows,
      net_profit: profitRows,
    },
  };
}

function saveOwnerStatement({ id, period_start, period_end, cost_method, notes, user_id }) {
  const db = getDb();
  const payload = computeOwnerStatement(period_start, period_end, cost_method);
  const tx = db.transaction(() => {
    let statementId = Number(id || 0);
    if (statementId) {
      const existing = db.prepare("SELECT status FROM owner_statements WHERE id = ?").get(statementId);
      if (!existing) {
        const err = new Error("Statement not found");
        err.status = 404;
        throw err;
      }
      if (existing.status === "locked") {
        const err = new Error("Statement is locked");
        err.status = 409;
        throw err;
      }
      db.prepare(`
        UPDATE owner_statements
        SET period_start = ?, period_end = ?, cost_method = ?, notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(period_start, period_end, payload.cost_method, notes || null, statementId);
      db.prepare("DELETE FROM owner_statement_values WHERE statement_id = ?").run(statementId);
      db.prepare("DELETE FROM owner_statement_rows WHERE statement_id = ?").run(statementId);
    } else {
      const result = db.prepare(`
        INSERT INTO owner_statements (period_start, period_end, cost_method, status, notes, created_by)
        VALUES (?, ?, ?, 'draft', ?, ?)
      `).run(period_start, period_end, payload.cost_method, notes || null, user_id || null);
      statementId = result.lastInsertRowid;
    }

    const valueStmt = db.prepare("INSERT INTO owner_statement_values (statement_id, metric_key, value) VALUES (?, ?, ?)");
    for (const [key, value] of Object.entries(payload.values)) valueStmt.run(statementId, key, value);

    const rowStmt = db.prepare("INSERT INTO owner_statement_rows (statement_id, metric_key, row_json) VALUES (?, ?, ?)");
    for (const [key, rows] of Object.entries(payload.rows)) {
      for (const row of rows) rowStmt.run(statementId, key, JSON.stringify(row));
    }
    return statementId;
  });
  return getOwnerStatement(tx());
}

function listOwnerStatements() {
  const db = getDb();
  return db.prepare(`
    SELECT os.*, COALESCE(u.username, u.full_name, '') AS created_by_name,
      COALESCE(locker.username, locker.full_name, '') AS locked_by_name,
      (SELECT value FROM owner_statement_values WHERE statement_id = os.id AND metric_key = 'net_profit') AS net_profit
    FROM owner_statements os
    LEFT JOIN users u ON u.id = os.created_by
    LEFT JOIN users locker ON locker.id = os.locked_by
    ORDER BY os.created_at DESC, os.id DESC
  `).all();
}

function getOwnerStatement(id) {
  const db = getDb();
  const statement = db.prepare(`
    SELECT os.*, COALESCE(u.username, u.full_name, '') AS created_by_name,
      COALESCE(locker.username, locker.full_name, '') AS locked_by_name
    FROM owner_statements os
    LEFT JOIN users u ON u.id = os.created_by
    LEFT JOIN users locker ON locker.id = os.locked_by
    WHERE os.id = ?
  `).get(id);
  if (!statement) return null;
  const values = {};
  db.prepare("SELECT metric_key, value FROM owner_statement_values WHERE statement_id = ?").all(id)
    .forEach((row) => { values[row.metric_key] = row.value; });
  const rows = {};
  METRICS.forEach((metric) => { rows[metric.key] = []; });
  db.prepare("SELECT metric_key, row_json FROM owner_statement_rows WHERE statement_id = ? ORDER BY id ASC").all(id)
    .forEach((row) => {
      try {
        if (!rows[row.metric_key]) rows[row.metric_key] = [];
        rows[row.metric_key].push(JSON.parse(row.row_json));
      } catch {
        // Ignore malformed historical rows.
      }
    });
  return {
    ...statement,
    values,
    rows,
    metrics: METRICS.map((metric) => ({ ...metric, value: values[metric.key] || 0 })),
  };
}

function lockOwnerStatement(id, userId) {
  const db = getDb();
  const existing = db.prepare("SELECT id, status FROM owner_statements WHERE id = ?").get(id);
  if (!existing) {
    const err = new Error("Statement not found");
    err.status = 404;
    throw err;
  }
  if (existing.status !== "locked") {
    db.prepare("UPDATE owner_statements SET status = 'locked', locked_at = datetime('now'), locked_by = ? WHERE id = ?")
      .run(userId || null, id);
  }
  return getOwnerStatement(id);
}

function compareOwnerStatements(leftId, rightId) {
  const left = getOwnerStatement(leftId);
  const right = getOwnerStatement(rightId);
  if (!left || !right) {
    const err = new Error("Statement not found");
    err.status = 404;
    throw err;
  }
  const rows = METRICS.map((metric) => {
    const leftValue = Number(left.values?.[metric.key] || 0);
    const rightValue = Number(right.values?.[metric.key] || 0);
    const diff = valueOf(rightValue - leftValue);
    return {
      metric_key: metric.key,
      label: metric.label,
      left_value: valueOf(leftValue),
      right_value: valueOf(rightValue),
      diff,
      diff_pct: leftValue ? valueOf((diff / Math.abs(leftValue)) * 100) : null,
    };
  });
  return { left, right, rows };
}

module.exports = {
  METRICS,
  computeOwnerStatement,
  saveOwnerStatement,
  listOwnerStatements,
  getOwnerStatement,
  lockOwnerStatement,
  compareOwnerStatements,
  normalizeCostMethod,
};
