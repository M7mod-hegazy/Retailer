const express = require("express");
const { getDb } = require("../config/database");
const router = express.Router();

// GET /api/pos-drafts?type=active  or  ?type=held
router.get("/", (req, res) => {
  const { type } = req.query;
  const db = getDb();
  try {
    const rows = type
      ? db.prepare("SELECT * FROM pos_drafts WHERE type = ? ORDER BY held_at ASC").all(type)
      : db.prepare("SELECT * FROM pos_drafts ORDER BY held_at ASC").all();
    const parsed = rows.map((r) => ({
      ...r,
      lines: JSON.parse(r.lines_json || "[]"),
      customer: r.customer_json ? JSON.parse(r.customer_json) : null,
    }));
    res.json({ data: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pos-drafts
router.post("/", (req, res) => {
  const db = getDb();
  const { type = "held", lines, label, customer, discount, increase, payment_type, notes, tax_enabled, tax_rate } = req.body;
  try {
    if (type === "active") {
      db.prepare("DELETE FROM pos_drafts WHERE type = 'active'").run();
    }
    const cols = db.prepare("PRAGMA table_info(pos_drafts)").all().map((c) => c.name);
    const hasLabel = cols.includes("label");
    const insertSql = hasLabel
      ? `INSERT INTO pos_drafts (type, label, lines_json, customer_json, discount, increase, payment_type, held_at, notes, tax_enabled, tax_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?, ?)`
      : `INSERT INTO pos_drafts (type, lines_json, customer_json, discount, increase, payment_type, held_at, notes, tax_enabled, tax_rate)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?, ?)`;
    const values = [
      type,
      ...(hasLabel ? [label || null] : []),
      JSON.stringify(lines || []),
      customer ? JSON.stringify(customer) : null,
      Number(discount || 0),
      Number(increase || 0),
      payment_type || "cash",
      notes || null,
      // better-sqlite3 cannot bind booleans — normalize to 0/1/null (null = follow settings on resume)
      tax_enabled == null ? null : (Number(tax_enabled) ? 1 : 0),
      Number.isFinite(Number(tax_rate)) && tax_rate != null ? Number(tax_rate) : null
    ];
    const result = db.prepare(insertSql).run(...values);
    res.json({ data: { id: result.lastInsertRowid } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pos-drafts/type/active — must be before /:id
router.delete("/type/active", (req, res) => {
  const db = getDb();
  try {
    db.prepare("DELETE FROM pos_drafts WHERE type = 'active'").run();
    res.json({ data: { ok: true } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pos-drafts/:id
router.delete("/:id", (req, res) => {
  const db = getDb();
  try {
    db.prepare("DELETE FROM pos_drafts WHERE id = ?").run(Number(req.params.id));
    res.json({ data: { ok: true } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
