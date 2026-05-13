const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const DOC_TYPES = [
  "pos_receipt",
  "sales_invoice",
  "purchase_order",
  "sales_return",
  "quotation",
  "branch_transfer",
  "bank_statement",
  "ajal_statement",
  "ajal_schedule",
  "cheque_register",
  "payment_receipt",
  "daily_treasury",
  "payment_methods_report",
  "reports_generic",
];

function ensureTable(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS print_settings_per_doc (
      doc_type TEXT PRIMARY KEY,
      settings TEXT NOT NULL DEFAULT '{}'
    )
  `).run();
}

function safeParseSettings(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

router.get("/", requirePagePermission("settings", "view"), (_req, res) => {
  try {
    const db = getDb();
    ensureTable(db);
    const rows = db.prepare("SELECT * FROM print_settings_per_doc").all();
    const map = {};
    DOC_TYPES.forEach((type) => { map[type] = {}; });
    rows.forEach((row) => { map[row.doc_type] = safeParseSettings(row.settings); });
    res.json({ success: true, data: map });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:docType", requirePagePermission("settings", "view"), (req, res) => {
  try {
    const { docType } = req.params;
    if (!DOC_TYPES.includes(docType)) {
      return res.status(400).json({ success: false, message: "invalid doc type" });
    }
    const db = getDb();
    ensureTable(db);
    const row = db.prepare("SELECT settings FROM print_settings_per_doc WHERE doc_type = ?").get(docType);
    res.json({ success: true, data: row ? safeParseSettings(row.settings) : {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:docType", requirePagePermission("settings", "edit"), (req, res) => {
  try {
    const { docType } = req.params;
    if (!DOC_TYPES.includes(docType)) {
      return res.status(400).json({ success: false, message: "invalid doc type" });
    }
    const db = getDb();
    ensureTable(db);
    const settings = JSON.stringify(req.body || {});
    db.prepare(`
      INSERT INTO print_settings_per_doc (doc_type, settings) VALUES (?, ?)
      ON CONFLICT(doc_type) DO UPDATE SET settings = excluded.settings
    `).run(docType, settings);
    res.json({ success: true, ok: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
