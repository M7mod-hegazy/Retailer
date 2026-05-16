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
  const { type = "held", lines, customer, discount, increase, payment_type } = req.body;
  try {
    if (type === "active") {
      db.prepare("DELETE FROM pos_drafts WHERE type = 'active'").run();
    }
    const result = db.prepare(`
      INSERT INTO pos_drafts (type, lines_json, customer_json, discount, increase, payment_type, held_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      type,
      JSON.stringify(lines || []),
      customer ? JSON.stringify(customer) : null,
      Number(discount || 0),
      Number(increase || 0),
      payment_type || "cash"
    );
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
