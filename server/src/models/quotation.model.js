const { getDb } = require("../config/database");
const { assertNotVariantParent } = require("../routes/variants.routes");

let _columnsEnsured = false;
function ensureExtraColumns() {
  if (_columnsEnsured) return;
  _columnsEnsured = true;
  try {
    const db = getDb();
    const cols = db.prepare("PRAGMA table_info(quotations)").all().map(c => c.name);
    if (!cols.includes("increase")) {
      db.prepare("ALTER TABLE quotations ADD COLUMN increase REAL NOT NULL DEFAULT 0").run();
    }
    if (!cols.includes("decrease")) {
      db.prepare("ALTER TABLE quotations ADD COLUMN decrease REAL NOT NULL DEFAULT 0").run();
    }
    if (!cols.includes("payment_type")) {
      db.prepare("ALTER TABLE quotations ADD COLUMN payment_type TEXT DEFAULT 'cash'").run();
    }
    if (!cols.includes("payment_note")) {
      db.prepare("ALTER TABLE quotations ADD COLUMN payment_note TEXT").run();
    }
  } catch (e) {
    // DB not yet initialized — will retry on first real call
    _columnsEnsured = false;
  }
}

function attachLines(rows) {
  if (!rows.length) return rows;
  const db = getDb();
  const ids = rows.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const lines = db.prepare(`
    SELECT ql.*, i.name AS item_name, i.code AS item_code, i.barcode,
           u.name AS unit_name, i.sale_price, i.purchase_price
    FROM quotation_lines ql
    LEFT JOIN items i ON i.id = ql.item_id
    LEFT JOIN units u ON u.id = i.unit_id
    WHERE ql.quotation_id IN (${placeholders})
    ORDER BY ql.id ASC
  `).all(...ids);

  const byId = {};
  lines.forEach(line => {
    if (!byId[line.quotation_id]) byId[line.quotation_id] = [];
    byId[line.quotation_id].push(line);
  });
  rows.forEach(row => {
    row.lines = byId[row.id] || [];
  });
  return rows;
}

function all({ search = '', status = '', sort = 'q.id', order = 'DESC', page = 1, limit = 20, dateFrom = '', dateTo = '' } = {}) {
  ensureExtraColumns();
  const db = getDb();
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push("(c.name LIKE ? OR CAST(q.id AS TEXT) LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    conditions.push("q.status = ?");
    params.push(status);
  }
  if (dateFrom) {
    conditions.push("q.created_at >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("q.created_at <= ?");
    params.push(dateTo + " 23:59:59");
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const allowedSorts = { 'q.id': 1, 'q.total': 1, 'q.created_at': 1, 'q.status': 1, 'q.expires_at': 1 };
  const sortCol = allowedSorts[sort] ? sort : 'q.id';
  const sortDir = order === 'ASC' ? 'ASC' : 'DESC';

  const countResult = db.prepare(`
    SELECT COUNT(DISTINCT q.id) as total
    FROM quotations q
    LEFT JOIN customers c ON c.id = q.customer_id
    ${where}
  `).get(...params);
  const total = countResult.total;
  const offset = (page - 1) * limit;

  const rows = db.prepare(`
    SELECT q.*, c.name AS customer_name,
           u.full_name AS created_by_name,
           (SELECT COUNT(*) FROM quotation_lines ql WHERE ql.quotation_id = q.id) AS line_count
    FROM quotations q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN users u ON u.id = q.created_by
    ${where}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return {
    data: attachLines(rows),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

function allRaw() {
  ensureExtraColumns();
  const db = getDb();
  const rows = db.prepare(`
    SELECT q.*, c.name AS customer_name,
           u.full_name AS created_by_name,
           (SELECT COUNT(*) FROM quotation_lines ql WHERE ql.quotation_id = q.id) AS line_count
    FROM quotations q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN users u ON u.id = q.created_by
    ORDER BY q.id DESC
  `).all();
  return attachLines(rows);
}

function findById(id) {
  ensureExtraColumns();
  const db = getDb();
  const row = db.prepare(`
    SELECT q.*, c.name AS customer_name,
           u.full_name AS created_by_name
    FROM quotations q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN users u ON u.id = q.created_by
    WHERE q.id = ?
  `).get(id);
  if (!row) return null;
  const rows = attachLines([row]);
  return rows[0];
}

function create(payload = {}) {
  ensureExtraColumns();
  const db = getDb();
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const increaseNum = Math.max(0, Number(payload.increase || 0));
  const decreaseNum = Math.max(0, Number(payload.decrease || 0));
  const tx = db.transaction(() => {
    const { resolveTax } = require('../utils/salesTax');
    const linesTotal = lines.reduce((sum, l) => sum + Number(l.line_total || 0), 0);
    const base = linesTotal + increaseNum - decreaseNum;
    const taxResult = resolveTax(db, {
      requestedEnabled: payload.tax_enabled,
      requestedRate: payload.tax_rate,
      base,
      user: payload._user,
      existing: payload._existingTax,
    });
    const createdBy = payload._user?.id || null;
    let docNo = payload.doc_no || null;
    if (!docNo) {
      const { generateDocNumber } = require('../utils/docNumber');
      try { docNo = generateDocNumber('quotation'); } catch { docNo = `QTN-${String(Date.now()).slice(-6)}`; }
    }
    const result = db.prepare(
      "INSERT INTO quotations (customer_id, total, status, notes, expires_at, tax_enabled, tax_rate, tax_amount, tax_type, increase, decrease, payment_type, payment_note, created_by, doc_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      payload.customer_id || null,
      taxResult.total,
      payload.status || "draft",
      payload.notes || null,
      payload.expires_at || null,
      taxResult.tax_enabled,
      taxResult.tax_rate,
      taxResult.tax_amount,
      taxResult.tax_type,
      increaseNum,
      decreaseNum,
      payload.payment_type || 'cash',
      payload.payment_note || null,
      createdBy,
      docNo,
    );

    const quotationId = result.lastInsertRowid;
    const insertLine = db.prepare(
      `INSERT INTO quotation_lines
       (quotation_id, item_id, description, quantity, unit_price, discount_amount, line_total, warehouse_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    lines.forEach((line) => {
      assertNotVariantParent(db, line.item_id);
      insertLine.run(
        quotationId,
        line.item_id,
        line.description || null,
        Number(line.quantity || 0),
        Number(line.unit_price || 0),
        Number(line.discount_amount || 0),
        Number(line.line_total || 0),
        line.warehouse_id || null,
      );
    });
    return quotationId;
  });

  return findById(tx());
}

function update(id, payload = {}) {
  ensureExtraColumns();
  const db = getDb();
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const increaseNum = Math.max(0, Number(payload.increase || 0));
  const decreaseNum = Math.max(0, Number(payload.decrease || 0));
  const tx = db.transaction(() => {
    const { resolveTax } = require('../utils/salesTax');
    const existing = db.prepare("SELECT tax_enabled, tax_rate, tax_type FROM quotations WHERE id = ?").get(id);
    const linesTotal = lines.reduce((sum, l) => sum + Number(l.line_total || 0), 0);
    const base = linesTotal + increaseNum - decreaseNum;
    const taxResult = resolveTax(db, {
      requestedEnabled: payload.tax_enabled,
      requestedRate: payload.tax_rate,
      base,
      user: payload._user,
      existing,
    });
    db.prepare(
      `UPDATE quotations
       SET customer_id = ?, total = ?, status = ?, notes = ?, expires_at = ?,
           tax_enabled = ?, tax_rate = ?, tax_amount = ?, tax_type = ?,
           increase = ?, decrease = ?, payment_type = ?, payment_note = ?
       WHERE id = ?`,
    ).run(
      payload.customer_id || null,
      taxResult.total,
      payload.status || "draft",
      payload.notes || null,
      payload.expires_at || null,
      taxResult.tax_enabled,
      taxResult.tax_rate,
      taxResult.tax_amount,
      taxResult.tax_type,
      increaseNum,
      decreaseNum,
      payload.payment_type || 'cash',
      payload.payment_note || null,
      id,
    );

    db.prepare("DELETE FROM quotation_lines WHERE quotation_id = ?").run(id);
    const insertLine = db.prepare(
      `INSERT INTO quotation_lines
       (quotation_id, item_id, description, quantity, unit_price, discount_amount, line_total, warehouse_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    lines.forEach((line) => {
      assertNotVariantParent(db, line.item_id);
      insertLine.run(
        id,
        line.item_id,
        line.description || null,
        Number(line.quantity || 0),
        Number(line.unit_price || 0),
        Number(line.discount_amount || 0),
        Number(line.line_total || 0),
        line.warehouse_id || null,
      );
    });
  });

  tx();
  return findById(id);
}

function markConverted(id) {
  ensureExtraColumns();
  getDb().prepare("UPDATE quotations SET status = 'converted' WHERE id = ?").run(id);
  return findById(id);
}

module.exports = { all, allRaw, findById, create, update, markConverted };
