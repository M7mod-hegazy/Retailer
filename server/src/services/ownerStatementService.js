const { getDb } = require("../config/database");
const { arAging, apAging } = require("../reports/queries/accounts");
const { addDateFilter, getCostColumn, getReturnCostColumn } = require("../reports/helpers");
const { calculateDailySummary, localDate } = require("./dailySessionService");

const COST_METHODS = new Set(["wacc", "fifo", "lifo", "last_purchase"]);
const COST_METHOD_LABELS = {
  wacc: "المتوسط المرجح",
  fifo: "الوارد أولا صادر أولا",
  lifo: "الوارد أخيرا صادر أولا",
  last_purchase: "آخر سعر شراء",
};
const PROFIT_SOURCE_LABELS = {
  sales: "المبيعات",
  returns: "مرتجعات المبيعات",
  net_sales: "صافي المبيعات",
  cogs: "تكلفة البضاعة المباعة",
  gross_profit: "مجمل الربح",
  revenues: "الإيرادات الأخرى",
  expenses: "المصروفات",
  withdrawals: "المسحوبات",
  net_profit: "صافي الربح",
};

const METRICS = [
  { key: "stock", label: "قيمة المخزون", full_report: "stock-valuation" },
  { key: "cash", label: "المتوقع في الخزنة", full_report: "treasury" },
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

function hasTable(db, table) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
}

function getReceiptLayers(db, itemId, warehouseId, endDate) {
  if (!hasTable(db, "cost_movements")) return [];
  return db.prepare(`
    SELECT quantity, unit_cost, occurred_at, id
    FROM cost_movements
    WHERE item_id = ?
      AND COALESCE(warehouse_id, 1) = COALESCE(?, 1)
      AND COALESCE(quantity, 0) > 0
      AND COALESCE(unit_cost, 0) > 0
      AND DATE(occurred_at) <= DATE(?)
    ORDER BY occurred_at ASC, id ASC
  `).all(itemId, warehouseId || 1, endDate);
}

function valueFromLayers(layers, quantity, newestFirst) {
  let remaining = Number(quantity || 0);
  let total = 0;
  const ordered = newestFirst ? [...layers].reverse() : layers;
  for (const layer of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(layer.quantity || 0));
    total += take * Number(layer.unit_cost || 0);
    remaining -= take;
  }
  return valueOf(total);
}

function selectStockCost(row, layers, quantity, costMethod) {
  const fallback = Number(row.current_wacc || row.current_last_purchase_cost || row.purchase_price || 0);
  if (!layers.length || quantity <= 0) {
    return { unitCost: fallback, value: quantity * fallback, source: row.current_wacc ? COST_METHOD_LABELS.wacc : "سعر الشراء المسجل" };
  }

  if (costMethod === "last_purchase") {
    const last = layers[layers.length - 1];
    const unitCost = Number(last?.unit_cost || fallback || 0);
    return { unitCost, value: quantity * unitCost, source: COST_METHOD_LABELS.last_purchase };
  }

  if (costMethod === "fifo" || costMethod === "lifo") {
    const value = valueFromLayers(layers, quantity, costMethod === "fifo");
    const unitCost = quantity ? value / quantity : 0;
    return { unitCost, value, source: COST_METHOD_LABELS[costMethod] };
  }

  const totalQty = layers.reduce((sum, layer) => sum + Number(layer.quantity || 0), 0);
  const totalValue = layers.reduce((sum, layer) => sum + Number(layer.quantity || 0) * Number(layer.unit_cost || 0), 0);
  const unitCost = totalQty > 0 ? totalValue / totalQty : fallback;
  return { unitCost, value: quantity * unitCost, source: COST_METHOD_LABELS.wacc };
}

function getStockRows(startDate, endDate, costMethod) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.id AS item_id,
      it.name,
      c.name AS category_name,
      sm.warehouse_id,
      COALESCE(w.name, '') AS warehouse_name,
      COALESCE(SUM(sm.quantity), 0) AS total_quantity,
      COALESCE(MAX(sl.wacc), 0) AS current_wacc,
      COALESCE(MAX(sl.last_purchase_cost), 0) AS current_last_purchase_cost,
      COALESCE(it.purchase_price, 0) AS purchase_price
    FROM stock_movements sm
    JOIN items it ON it.id = sm.item_id
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN warehouses w ON w.id = sm.warehouse_id
    LEFT JOIN stock_levels sl ON sl.item_id = sm.item_id AND sl.warehouse_id = sm.warehouse_id
    WHERE sm.deleted_at IS NULL
      AND it.deleted_at IS NULL
      AND DATE(sm.created_at) <= DATE(?)
    GROUP BY it.id, sm.warehouse_id
    HAVING total_quantity > 0
    ORDER BY total_quantity DESC, it.name ASC
  `).all(endDate);

  return rows.map((row) => {
    const quantity = Number(row.total_quantity || 0);
    const layers = getReceiptLayers(db, row.item_id, row.warehouse_id, endDate);
    const selected = selectStockCost(row, layers, quantity, costMethod);
    return {
      item_id: row.item_id,
      item_code: row.item_code,
      item_name: row.name,
      category_name: row.category_name || "",
      warehouse_id: row.warehouse_id,
      warehouse_name: row.warehouse_name || "",
      quantity,
      unit_cost: valueOf(selected.unitCost),
      cost_source: selected.source,
      value: valueOf(selected.value),
    };
  });
}

function getCashRows(db, endDate) {
  const summary = calculateDailySummary(db, endDate, { createIfMissing: endDate === localDate() });
  if (!summary) {
    return [{
      date: endDate,
      group: "النتيجة",
      label: "لا توجد يومية لهذا التاريخ",
      source: "expected_cash",
      count: 0,
      amount: 0,
      balance: 0,
    }];
  }
  const expectedCash = valueOf(summary.expected_cash);
  const customerCollections = Number(summary.customer_cash_collections ?? (Number(summary.customer_payments || 0) + Number(summary.ajal_payments || 0)));
  const supplierPayments = Number(summary.supplier_cash_payments ?? (Number(summary.supplier_payments || 0) + Number(summary.supplier_ajal_payments || 0)));
  const rows = [
    { group: "رصيد البداية", label: "رصيد سابق", source: "opening_balance", count: 0, amount: summary.opening_balance },
    { group: "داخل نقدي", label: "نقد من مبيعات POS", source: "pos_cash_sales", count: summary.pos_cash_sales_count, amount: summary.pos_cash_sales },
    { group: "داخل نقدي", label: "نقد من أقساط", source: "pos_installment_cash", count: summary.pos_installment_count, amount: summary.pos_installment_cash },
    { group: "داخل نقدي", label: "نقد من دفع متعدد", source: "pos_multi_cash", count: summary.pos_multi_count, amount: summary.pos_multi_cash },
    { group: "داخل نقدي", label: "نقد تم تحصيله من العملاء", source: "customer_cash_collections", count: summary.customer_payments_count, amount: customerCollections },
    { group: "داخل نقدي", label: "إيرادات نقدية", source: "revenues_cash", count: summary.revenues_count, amount: summary.revenues_cash },
    { group: "داخل نقدي", label: "نقد مسترد من مرتجعات الشراء", source: "purchase_returns_cash", count: 0, amount: summary.purchase_returns_cash },
    { group: "إجمالي", label: "إجمالي الداخل النقدي", source: "cash_in", count: 0, amount: summary.cash_in },
    { group: "خارج نقدي", label: "نقد مدفوع للموردين", source: "supplier_cash_payments", count: summary.supplier_payments_count, amount: -supplierPayments },
    { group: "خارج نقدي", label: "مصروفات نقدية", source: "expenses_cash", count: summary.expenses_count, amount: -Number(summary.expenses_cash || 0) },
    { group: "خارج نقدي", label: "نقد مدفوع لمرتجعات المبيعات", source: "sales_returns_cash", count: 0, amount: -Number(summary.sales_returns_cash || 0) },
    { group: "خارج نقدي", label: "مسحوبات من الخزنة", source: "withdrawals", count: 0, amount: -Number(summary.withdrawals || 0) },
    { group: "إجمالي", label: "إجمالي الخارج النقدي", source: "cash_out", count: 0, amount: -Number(summary.cash_out || 0) },
    { group: "النتيجة", label: "المتوقع في الخزنة", source: "expected_cash", count: 0, amount: expectedCash, balance: expectedCash },
  ];
  return rows.map((row) => ({ ...row, date: endDate, amount: valueOf(row.amount), count: Number(row.count || 0) }));
}

function getExpenseRows(db, startDate, endDate) {
  const params = [];
  return db.prepare(`
    SELECT e.id, e.doc_no, e.created_at AS date, COALESCE(ec.name, '') AS category_name,
      COALESCE(e.payment_method, '') AS payment_method,
      COALESCE(e.description, e.notes, '') AS description,
      COALESCE(e.amount, 0) AS amount,
      COALESCE(u.full_name, u.username, au.full_name, au.username, 'غير محدد') AS user_name
    FROM expenses e
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    LEFT JOIN users u ON u.id = e.created_by
    LEFT JOIN audit_logs al ON al.id = (
      SELECT al2.id
      FROM audit_logs al2
      WHERE al2.resource = 'expenses'
        AND al2.action = 'create'
        AND CAST(json_extract(al2.payload_json, '$.id') AS INTEGER) = e.id
      ORDER BY al2.id DESC
      LIMIT 1
    )
    LEFT JOIN users au ON au.id = al.user_id
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
      COALESCE(u.full_name, u.username, au.full_name, au.username, 'غير محدد') AS user_name
    FROM revenues r
    LEFT JOIN revenue_categories ec ON ec.id = r.category_id
    LEFT JOIN users u ON u.id = r.created_by
    LEFT JOIN audit_logs al ON al.id = (
      SELECT al2.id
      FROM audit_logs al2
      WHERE al2.resource = 'revenues'
        AND al2.action = 'create'
        AND CAST(json_extract(al2.payload_json, '$.id') AS INTEGER) = r.id
      ORDER BY al2.id DESC
      LIMIT 1
    )
    LEFT JOIN users au ON au.id = al.user_id
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
      COALESCE(u.full_name, u.username, au.full_name, au.username, 'غير محدد') AS user_name
    FROM withdrawals w
    LEFT JOIN withdrawal_categories wc ON wc.id = w.category_id
    LEFT JOIN users u ON u.id = w.created_by
    LEFT JOIN audit_logs al ON al.id = (
      SELECT al2.id
      FROM audit_logs al2
      WHERE al2.resource = 'withdrawals'
        AND al2.action = 'create'
        AND CAST(json_extract(al2.payload_json, '$.id') AS INTEGER) = w.id
      ORDER BY al2.id DESC
      LIMIT 1
    )
    LEFT JOIN users au ON au.id = al.user_id
    WHERE 1=1 ${dateWhere("w.created_at", startDate, endDate, params)}
    ORDER BY w.created_at DESC, w.id DESC
  `).all(...params).map((row) => ({ ...row, amount: valueOf(row.amount) }));
}

function moneySummary(db, sql, params) {
  const row = db.prepare(sql).get(...params);
  return {
    amount: valueOf(row?.amount || 0),
    count: Number(row?.count || 0),
  };
}

function getProfitRows(db, startDate, endDate, costMethod) {
  const salesParams = [];
  const salesReturnsParams = [];
  const cogsParams = [];
  const returnCostParams = [];
  const costCol = getCostColumn(costMethod);
  const returnCostCol = getReturnCostColumn(costMethod);
  const cogsCostCol = `COALESCE(NULLIF(${costCol}, 0), it.purchase_price, 0)`;
  const returnCostValueCol = `COALESCE(NULLIF(${returnCostCol}, 0), it.purchase_price, 0)`;

  const sales = moneySummary(db, `
    SELECT COALESCE(SUM(total), 0) AS amount, COUNT(*) AS count
    FROM invoices
    WHERE COALESCE(status, '') != 'cancelled' ${dateWhere("created_at", startDate, endDate, salesParams)}
  `, salesParams);

  const salesReturns = moneySummary(db, `
    SELECT COALESCE(SUM(total), 0) AS amount, COUNT(*) AS count
    FROM sales_returns
    WHERE COALESCE(status, 'active') != 'cancelled' ${dateWhere("created_at", startDate, endDate, salesReturnsParams)}
  `, salesReturnsParams);

  const cogs = moneySummary(db, `
    SELECT COALESCE(SUM(il.quantity * ${cogsCostCol}), 0) AS amount, COUNT(*) AS count
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    LEFT JOIN items it ON it.id = il.item_id
    WHERE COALESCE(i.status, '') != 'cancelled' ${dateWhere("i.created_at", startDate, endDate, cogsParams)}
  `, cogsParams);

  const returnCost = moneySummary(db, `
    SELECT COALESCE(SUM(srl.quantity * ${returnCostValueCol}), 0) AS amount, COUNT(*) AS count
    FROM sales_return_lines srl
    JOIN sales_returns sr ON sr.id = srl.sales_return_id
    LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
    LEFT JOIN items it ON it.id = srl.item_id
    WHERE COALESCE(sr.status, 'active') != 'cancelled' ${dateWhere("sr.created_at", startDate, endDate, returnCostParams)}
  `, returnCostParams);

  const netSales = valueOf(sales.amount - salesReturns.amount);
  const netProfit = valueOf(netSales - cogs.amount + returnCost.amount);

  const rows = [
    { label: "إجمالي المبيعات", source: "sales", count: sales.count, amount: sales.amount },
    { label: "مرتجعات المبيعات", source: "returns", count: salesReturns.count, amount: -salesReturns.amount },
    { label: "صافي المبيعات", source: "net_sales", count: sales.count + salesReturns.count, amount: netSales },
    { label: "تكلفة البضاعة المباعة", source: "cogs", count: cogs.count, amount: -cogs.amount },
    { label: "تكلفة مرتجعات المبيعات", source: "return_cost", count: returnCost.count, amount: returnCost.amount },
    { label: "صافي الربح", source: "net_profit", count: sales.count + salesReturns.count, amount: netProfit },
  ].map((row) => ({ ...row, amount: valueOf(row.amount) }));
  return rows;
}

function computeOwnerStatement(startDate, endDate, costMethod = "wacc") {
  const db = getDb();
  const method = normalizeCostMethod(costMethod);
  const stockRows = getStockRows(startDate, endDate, method);
  const cashRows = getCashRows(db, endDate);
  const arRows = arAging(startDate, endDate).map((row) => ({ ...row, total_due: valueOf(row.total_due) }));
  const apRows = apAging(startDate, endDate).map((row) => ({ ...row, total_due: valueOf(row.total_due) }));
  const expenseRows = getExpenseRows(db, startDate, endDate);
  const revenueRows = getRevenueRows(db, startDate, endDate);
  const withdrawalRows = getWithdrawalRows(db, startDate, endDate);

  const expenses = rowsTotal(expenseRows, "amount");
  const revenues = rowsTotal(revenueRows, "amount");
  const withdrawals = rowsTotal(withdrawalRows, "amount");
  const profitRows = getProfitRows(db, startDate, endDate, method);

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
    cost_method_label: COST_METHOD_LABELS[method] || method,
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
