const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { authRequired } = require('../middleware/auth');
const { DOC_TYPES, LAYOUT_SCOPES } = require("../../../shared/docTypes");
const { normalizeLayout } = require("../../../shared/printLayout");

const router = express.Router();
router.use(authRequired);

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

router.get("/", requirePagePermission("print_settings", "view"), (_req, res) => {
  try {
    const db = getDb();
    ensureTable(db);
    const rows = db.prepare("SELECT * FROM print_settings_per_doc").all();
    const map = {};
    LAYOUT_SCOPES.forEach((type) => { map[type] = {}; });
    rows.forEach((row) => { map[row.doc_type] = normalizeLayout(safeParseSettings(row.settings)).settings; });
    res.json({ success: true, data: map });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:docType", requirePagePermission("print_settings", "view"), (req, res) => {
  try {
    const { docType } = req.params;
    if (!LAYOUT_SCOPES.includes(docType)) {
      return res.status(400).json({ success: false, message: "invalid doc type" });
    }
    const db = getDb();
    ensureTable(db);
    const row = db.prepare("SELECT settings FROM print_settings_per_doc WHERE doc_type = ?").get(docType);
    // Normalize on read so pre-migration rows (and stale client caches writing
    // the old shape) always come back canonical.
    res.json({ success: true, data: row ? normalizeLayout(safeParseSettings(row.settings)).settings : {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:docType", requirePagePermission("print_settings", "edit"), (req, res) => {
  try {
    const { docType } = req.params;
    if (!LAYOUT_SCOPES.includes(docType)) {
      return res.status(400).json({ success: false, message: "invalid doc type" });
    }
    const db = getDb();
    ensureTable(db);
    // Merge incoming with existing so partial patches (e.g. paper_size
    // from the settings panel) never nuke full saves (layout, show_*
    // flags, presets) written by the Print Studio.
    const existing = db.prepare("SELECT settings FROM print_settings_per_doc WHERE doc_type = ?").get(docType);
    const existingSettings = existing ? safeParseSettings(existing.settings) : {};
    const merged = { ...existingSettings, ...(req.body || {}) };
    const settings = JSON.stringify(normalizeLayout(merged).settings);
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
