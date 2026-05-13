const { getDb } = require("../config/database");

function serializeQuotation(row) {
  if (!row) return null;
  const db = getDb();
  const lines = db
    .prepare(
      `SELECT ql.*, i.name AS item_name, i.code AS item_code, i.barcode
       FROM quotation_lines ql
       LEFT JOIN items i ON i.id = ql.item_id
       WHERE ql.quotation_id = ?
       ORDER BY ql.id ASC`,
    )
    .all(row.id);

  return {
    ...row,
    lines,
  };
}

function all() {
  return getDb()
    .prepare(
      `SELECT q.*, c.name AS customer_name,
              COUNT(ql.id) AS line_count
       FROM quotations q
       LEFT JOIN customers c ON c.id = q.customer_id
       LEFT JOIN quotation_lines ql ON ql.quotation_id = q.id
       GROUP BY q.id
       ORDER BY q.id DESC`,
    )
    .all()
    .map(serializeQuotation);
}

function findById(id) {
  const row = getDb()
    .prepare(
      `SELECT q.*, c.name AS customer_name
       FROM quotations q
       LEFT JOIN customers c ON c.id = q.customer_id
       WHERE q.id = ?`,
    )
    .get(id);
  return serializeQuotation(row);
}

function create(payload = {}) {
  const db = getDb();
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const tx = db.transaction(() => {
    const result = db
      .prepare(
        "INSERT INTO quotations (customer_id, total, status, notes, expires_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        payload.customer_id || null,
        Number(payload.total || 0),
        payload.status || "draft",
        payload.notes || null,
        payload.expires_at || null,
      );

    const quotationId = result.lastInsertRowid;
    const insertLine = db.prepare(
      `INSERT INTO quotation_lines
       (quotation_id, item_id, description, quantity, unit_price, discount_amount, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    lines.forEach((line) => {
      insertLine.run(
        quotationId,
        line.item_id,
        line.description || null,
        Number(line.quantity || 0),
        Number(line.unit_price || 0),
        Number(line.discount_amount || 0),
        Number(line.line_total || 0),
      );
    });

    return quotationId;
  });

  return findById(tx());
}

function update(id, payload = {}) {
  const db = getDb();
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE quotations
       SET customer_id = ?, total = ?, status = ?, notes = ?, expires_at = ?
       WHERE id = ?`,
    ).run(
      payload.customer_id || null,
      Number(payload.total || 0),
      payload.status || "draft",
      payload.notes || null,
      payload.expires_at || null,
      id,
    );

    db.prepare("DELETE FROM quotation_lines WHERE quotation_id = ?").run(id);
    const insertLine = db.prepare(
      `INSERT INTO quotation_lines
       (quotation_id, item_id, description, quantity, unit_price, discount_amount, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    lines.forEach((line) => {
      insertLine.run(
        id,
        line.item_id,
        line.description || null,
        Number(line.quantity || 0),
        Number(line.unit_price || 0),
        Number(line.discount_amount || 0),
        Number(line.line_total || 0),
      );
    });
  });

  tx();
  return findById(id);
}

function markConverted(id) {
  getDb().prepare("UPDATE quotations SET status = 'converted' WHERE id = ?").run(id);
  return findById(id);
}

module.exports = { all, findById, create, update, markConverted };
