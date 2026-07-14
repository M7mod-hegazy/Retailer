const express = require("express");
const { getDb } = require("../config/database");
const { authRequired, requireRole } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { nowSql } = require("../utils/datetime");

const router = express.Router();
router.use(auditMutation);

function getSettings() {
  return getDb().prepare("SELECT * FROM settings WHERE id = 1").get();
}

// Ensure print-setting columns exist in the settings table.
// Called once at module load so the dynamic buildUpdate() can reference them.
function ensurePrintColumns() {
  const db = getDb();
  const existing = db.prepare("PRAGMA table_info(settings)").all().map(c => c.name);
  let added = 0;
  const add = (col, def) => {
    if (!existing.includes(col)) {
      try {
        db.exec(`ALTER TABLE settings ADD COLUMN ${col} ${def}`);
        added++;
      } catch (e) {
        console.error(`[settings] Failed to add column ${col}:`, e.message);
      }
    }
  };
  add("show_phone",         "INTEGER DEFAULT 1");
  add("show_address",       "INTEGER DEFAULT 1");
  add("show_tax_id",        "INTEGER DEFAULT 1");
  add("show_qr",            "INTEGER DEFAULT 1");
  add("show_logo",          "INTEGER DEFAULT 1");
  add("show_subtotal",      "INTEGER DEFAULT 1");
  add("show_discount_line", "INTEGER DEFAULT 1");
  add("show_payment_details", "INTEGER DEFAULT 1");
  add("show_branch",        "INTEGER DEFAULT 1");
  add("show_invoice_date",  "INTEGER DEFAULT 1");
  add("show_barcode_line",  "INTEGER DEFAULT 0");
  add("show_item_code",     "INTEGER DEFAULT 1");
  add("show_notes",         "INTEGER DEFAULT 1");
  add("header_font_size",   "INTEGER DEFAULT 16");
  add("body_font_size",     "INTEGER DEFAULT 11");
  add("footer_font_size",   "INTEGER DEFAULT 10");
  add("item_font_size",     "INTEGER DEFAULT 11");
  add("logo_max_height",    "INTEGER DEFAULT 48");
  add("margin_top",         "INTEGER DEFAULT 4");
  add("margin_side",        "INTEGER DEFAULT 4");
  add("qr_size",            "INTEGER DEFAULT 44");
  add("print_font",         "TEXT DEFAULT 'monospace'");
  add("logo_alignment",     "TEXT DEFAULT 'center'");
  add("accent_color",       "TEXT DEFAULT '#0f172a'");
  add("receipt_width",      "TEXT DEFAULT '80mm'");
  add("receipt_header",     "TEXT DEFAULT ''");
  add("return_prefix",      "TEXT DEFAULT 'RET-'");
  add("work_order_prefix",  "TEXT DEFAULT 'WO-'");
  add("receipt_prefix",     "TEXT DEFAULT 'REC-'");
  add("address_font_size",  "INTEGER DEFAULT 9");
  add("address_alignment",  "TEXT DEFAULT 'right'");
  add("tax_id_font_size",   "INTEGER DEFAULT 9");
  add("tax_id_alignment",   "TEXT DEFAULT 'right'");
  add("font_family",         "TEXT DEFAULT 'Noto Sans Arabic'");
  add("font_size",           "TEXT DEFAULT 'normal'");
  add("number_font_family",  "TEXT DEFAULT 'Outfit'");
  add("number_font_scale",   "TEXT DEFAULT 'normal'");
  add("numeral_style",       "TEXT DEFAULT 'western'");
  add("pos_voice_enabled",   "INTEGER DEFAULT 0");
  add("smart_lock_enabled", "INTEGER DEFAULT 1");
  add("smart_lock_timeout_minutes", "INTEGER DEFAULT 15");
  add("sms_enabled",        "INTEGER DEFAULT 0");
  add("sms_api_url",        "TEXT");
  add("sms_api_key",        "TEXT");
  add("sms_sender",         "TEXT");
  add("sms_body_template",  "TEXT");
  // Log summary to help debug any persistence issues
  if (added > 0) console.log(`[settings] Added ${added} missing print-setting columns`);
}

try { ensurePrintColumns(); } catch (e) { /* DB not ready yet — will be retried on first request */ }

// Also retry on every request to handle the race with DB init
function ensurePrintColumnsSafe() {
  try { ensurePrintColumns(); } catch {}
}

function normalizeBoolean(value) {
  return value ? 1 : 0;
}

// Column-type metadata: only the columns that need special coercion.
// Everything else is treated as a plain string.
const BOOLEAN_PREFIXES = ["show_", "logo_on_", "feature_", "telegram_notify_"];
const COLUMN_META = {
  decimal_places: "int", tax_rate: "int", max_discount_percent: "int",
  header_font_size: "int", body_font_size: "int", footer_font_size: "int",
  item_font_size: "int", logo_max_height: "int", margin_top: "int",
  margin_side: "int", qr_size: "int", address_font_size: "int",
  tax_id_font_size: "int",
  auto_backup_enabled: "bool",
  discount_cap_enabled: "bool",
  tax_enabled: "bool",
  pos_voice_enabled: "bool",
  smart_lock_enabled: "bool",
  sms_enabled: "bool",
  smart_lock_timeout_minutes: "int",
  logo_on_invoices: "bool", logo_on_receipts: "bool",
  logo_on_sidebar: "bool", logo_on_reports: "bool",
  serials_strict_mode: "bool",
  scale_item_code_length: "int",
  scale_value_decimals: "int",
  telegram_enabled: "bool",
};

function isBoolCol(name) {
  if (COLUMN_META[name] === "bool") return true;
  return BOOLEAN_PREFIXES.some(p => name.startsWith(p));
}

function isIntCol(name) {
  if (isBoolCol(name)) return false; // bools are also integers in SQLite but need normalizeBoolean
  return COLUMN_META[name] === "int";
}

// Coerce a single column value for binding
function coerceVal(col, raw) {
  if (raw === undefined || raw === null) return null;
  if (isBoolCol(col)) return normalizeBoolean(raw !== false && raw !== 0 && raw !== "false" && raw !== "0");
  if (isIntCol(col)) return Number(raw);
  return raw;
}

// Feature module flags. Enabling any of these is restricted to the dev account,
// and once enabled a feature cannot be turned off again (one-way).
const FEATURE_KEYS = [
  "feature_multi_unit", "feature_variants", "feature_serials",
  "feature_scale_barcodes", "feature_repair_orders", "feature_restaurant",
  "feature_gold", "feature_promotions", "feature_expiry",
  "feature_cheques",
];

// Apply feature-flag rules to an updates object in place.
// - Disabling an already-enabled feature is silently ignored (one-way).
// - Enabling a feature is dev-only; returns { status, message } to block otherwise.
function guardFeatureChanges(req, current, updates) {
  const isDev = req.user?.role === "dev";
  for (const key of FEATURE_KEYS) {
    if (!(key in updates)) continue;
    const desired = coerceVal(key, updates[key]);
    if (current[key] === 1 && !desired) {
      delete updates[key]; // already enabled — ignore attempt to disable
      continue;
    }
    if (desired && current[key] !== 1 && !isDev) {
      return { status: 403, message: "تفعيل الميزات متاح لحساب المطوّر فقط" };
    }
  }
  return null;
}

// Build a dynamic UPDATE statement + params from the current row's columns
function buildUpdate(current, updates) {
  const next = { ...current, ...updates };
  const skip = new Set(["id", "created_at", "updated_at"]);
  const SAFE_COL = /^[a-z_]+$/;
  const cols = Object.keys(current).filter(k => !skip.has(k) && SAFE_COL.test(k));
  const setClauses = cols.map(c => `${c} = ?`);
  const params = cols.map(c => coerceVal(c, next[c]));
  const sql = `UPDATE settings SET ${setClauses.join(", ")}, updated_at = ? WHERE id = 1`;
  return { sql, params: [...params, nowSql()] };
}

router.get("/", authRequired, requirePagePermission("settings", "view"), (_req, res) => {
  ensurePrintColumnsSafe();
  res.json({ success: true, data: getSettings() });
});

router.put("/", authRequired, requirePagePermission("settings", "edit"), requireRole("admin"), (req, res) => {
  try {
    ensurePrintColumnsSafe();
    const current = getSettings();
    if (!current) {
      return res.status(500).json({ success: false, message: "لا توجد إعدادات — أعد تشغيل الخادم" });
    }
    const updates = req.body || {};

    const blocked = guardFeatureChanges(req, current, updates);
    if (blocked) return res.status(blocked.status).json({ success: false, message: blocked.message });

    const { sql, params } = buildUpdate(current, updates);
    getDb().prepare(sql).run(...params);
    req.audit("edit", "settings", { keys_updated: Object.keys(updates).length }, `⚙️ تم تحديث الإعدادات`);
    res.json({ success: true, data: getSettings() });
  } catch (e) {
    console.error("[settings] PUT / failed:", e.message);
    res.status(500).json({ success: false, message: "خطأ في حفظ الإعدادات: " + e.message });
  }
});

// Bulk update settings - accepts array of { setting_key, setting_value }
router.post("/bulk", authRequired, requirePagePermission("settings", "add"), requireRole("admin"), (req, res) => {
  ensurePrintColumnsSafe();
  const { settings } = req.body || {};
  if (!Array.isArray(settings) || settings.length === 0) {
    return res.status(400).json({ success: false, message: "Settings array is required" });
  }

  const db = getDb();
  const current = getSettings();

  // Build dynamic update from provided keys
  const allowedKeys = Object.keys(current).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
  const updates = {};
  
  settings.forEach(({ setting_key, setting_value }) => {
    if (allowedKeys.includes(setting_key)) {
      // Handle boolean-like values
      if (setting_value === 'true') {
        updates[setting_key] = true;
      } else if (setting_value === 'false') {
        updates[setting_key] = false;
      } else if (!isNaN(Number(setting_value)) && setting_value !== '') {
        updates[setting_key] = Number(setting_value);
      } else {
        updates[setting_key] = setting_value;
      }
    }
  });

  const blocked = guardFeatureChanges(req, current, updates);
  if (blocked) return res.status(blocked.status).json({ success: false, message: blocked.message });

  if (Object.keys(updates).length === 0) {
    return res.json({ success: true, data: current });
  }

  // Use the same dynamic buildUpdate to generate SQL + params from actual table columns
  const { sql, params } = buildUpdate(current, updates);
  db.prepare(sql).run(...params);

  // Build a diff of only the keys that actually changed value
  // Normalize both sides to handle DB string "5235.0" vs request number 5235
  const changes = {};
  for (const key of Object.keys(updates)) {
    const newVal = coerceVal(key, updates[key]);
    const oldVal = coerceVal(key, current[key]);
    // String comparison first (fast path)
    if (String(oldVal) === String(newVal)) continue;
    // Numeric comparison: "5235.0" and 5235 are semantically equal
    const nOld = Number(oldVal), nNew = Number(newVal);
    if (!isNaN(nOld) && !isNaN(nNew) && nOld === nNew) continue;
    // Real change — store raw values for the audit trail (client will clean display)
    changes[key] = { from: current[key], to: newVal };
  }
  const changedCount = Object.keys(changes).length;
  const changedKeys = Object.keys(changes).slice(0, 5).join("، ");
  const desc = changedCount > 0
    ? `⚙️ تم تحديث ${changedCount} إعداد${changedCount > 5 ? ` (${changedKeys}، ...)` : ` (${changedKeys})`}`
    : `⚙️ تم حفظ الإعدادات (بدون تغيير)`;

  req.audit("bulk_edit", "settings", changes, desc);
  res.json({ success: true, data: getSettings() });
});

// Diagnostic endpoint: check which settings columns exist and what their values are
// Only accessible to admin, returns DB state for debugging save issues
router.get("/debug", authRequired, requireRole("admin"), (_req, res) => {
  const db = getDb();
  const cols = db.prepare("PRAGMA table_info(settings)").all().map(c => ({ name: c.name, type: c.type, dflt: c.dflt_value }));
  const row = getSettings();
  res.json({ success: true, columnCount: cols.length, columns: cols, row });
});

router.get("/default-user-permissions", authRequired, (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "dev") {
      return res.status(403).json({ error: "admin_only" });
    }

    const row = getDb()
      .prepare("SELECT value FROM settings_kv WHERE key = 'default_user_permissions'")
      .get();
    const permissions = row?.value ? JSON.parse(row.value) : {};

    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
});

router.put("/default-user-permissions", authRequired, (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "dev") {
      return res.status(403).json({ error: "admin_only" });
    }

    const payload = req.body || {};
    const permissions = payload.permissions || {};

    if (typeof permissions !== "object" || Array.isArray(permissions)) {
      const err = new Error("Permissions must be a valid object");
      err.status = 400;
      throw err;
    }

    const permissionsJson = JSON.stringify(permissions);
    getDb()
      .prepare("INSERT INTO settings_kv (key, value) VALUES ('default_user_permissions', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(permissionsJson);

    req.audit("edit", "default_user_permissions", {}, `⚙️ تم تحديث الصلاحيات الافتراضية للمستخدمين`);
    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
});

// ── Keyboard shortcut overrides ───────────────────────────────────────────────
// Stored as a JSON map { "<shortcutId>": ["Ctrl","K"], ... } of user overrides only
// (absent id = factory default). Mirrors the default_user_permissions kv pattern.
router.get("/shortcuts-config", authRequired, (req, res, next) => {
  try {
    const row = getDb()
      .prepare("SELECT value FROM settings_kv WHERE key = 'shortcuts_config'")
      .get();
    const config = row?.value ? JSON.parse(row.value) : {};
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

router.put("/shortcuts-config", authRequired, (req, res, next) => {
  try {
    const config = (req.body && req.body.config) || {};
    if (typeof config !== "object" || Array.isArray(config)) {
      const err = new Error("Shortcuts config must be a valid object");
      err.status = 400;
      throw err;
    }
    getDb()
      .prepare("INSERT INTO settings_kv (key, value) VALUES ('shortcuts_config', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(JSON.stringify(config));
    req.audit("edit", "shortcuts_config", {}, `⌨️ تم تحديث اختصارات لوحة المفاتيح`);
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

// ── Feature metadata (pricing + store-type mapping) ──────────────────────
const STORE_TYPE_FEATURES = {
  supermarket:  ["feature_multi_unit", "feature_scale_barcodes", "feature_expiry", "feature_promotions"],
  clothing:     ["feature_variants", "feature_multi_unit", "feature_promotions"],
  mobile:       ["feature_serials", "feature_repair_orders"],
  gold:         ["feature_gold"],
  restaurant:   ["feature_restaurant"],
  pharmacy:     ["feature_expiry", "feature_multi_unit"],
  wholesale:    ["feature_multi_unit", "feature_cheques", "feature_promotions"],
  general:      ["feature_promotions"],
};

const STORE_TYPE_META = {
  supermarket:  { name_ar: "سوبر ماركت",     name_en: "Supermarket",      icon: "ShoppingCart" },
  clothing:     { name_ar: "ملابس وأحذية",    name_en: "Clothing & Shoes", icon: "Shirt" },
  mobile:       { name_ar: "موبايل وإلكترونيات", name_en: "Mobile & Electronics", icon: "Smartphone" },
  gold:         { name_ar: "ذهب ومجوهرات",    name_en: "Gold & Jewelry",   icon: "Gem" },
  restaurant:   { name_ar: "مطعم وكافيه",     name_en: "Restaurant & Cafe", icon: "UtensilsCrossed" },
  pharmacy:     { name_ar: "صيدلية",          name_en: "Pharmacy",         icon: "Pill" },
  wholesale:    { name_ar: "جملة وشركات",     name_en: "Wholesale & Corporate", icon: "Building" },
  general:      { name_ar: "متجر عام",        name_en: "General Retail",   icon: "Store" },
};

router.get("/feature-metadata", authRequired, (_req, res) => {
  const db = getDb();
  const pricingRow = db.prepare("SELECT value FROM settings_kv WHERE key = 'feature_pricing'").get();
  const codesRow = db.prepare("SELECT value FROM settings_kv WHERE key = 'activation_codes'").get();
  const pricing = pricingRow ? JSON.parse(pricingRow.value) : {};
  const activationCodes = codesRow ? JSON.parse(codesRow.value) : {};
  res.json({
    success: true,
    data: {
      storeTypes: STORE_TYPE_META,
      storeTypeFeatures: STORE_TYPE_FEATURES,
      pricing,
      activationCodes: Object.keys(activationCodes).length,
    },
  });
});

router.post("/activate-feature-code", authRequired, (req, res) => {
  const { code } = req.body || {};
  if (!code || typeof code !== "string") {
    return res.status(400).json({ success: false, message: "كود التفعيل مطلوب" });
  }
  const db = getDb();
  const codesRow = db.prepare("SELECT value FROM settings_kv WHERE key = 'activation_codes'").get();
  const codes = codesRow ? JSON.parse(codesRow.value) : {};
  const entry = codes[code.trim()];
  if (!entry) {
    return res.status(404).json({ success: false, message: "كود التفعيل غير صالح" });
  }
  if (entry.expires && new Date(entry.expires) < new Date()) {
    return res.status(410).json({ success: false, message: "كود التفعيل منتهي الصلاحية" });
  }
  if (entry.max_uses && entry.used_count >= entry.max_uses) {
    return res.status(410).json({ success: false, message: "كود التفعيل استُنفذ بالكامل" });
  }
  const features = entry.features || [];
  if (features.length === 0) {
    return res.status(400).json({ success: false, message: "الكود لا يحتوي على ميزات" });
  }
  const current = getSettings();
  const updates = {};
  for (const f of features) {
    if (!(f in current)) continue;
    if (current[f] === 1) continue;
    updates[f] = 1;
  }
  if (Object.keys(updates).length > 0) {
    const { sql, params } = buildUpdate(current, updates);
    db.prepare(sql).run(...params);
  }
  entry.used_count = (entry.used_count || 0) + 1;
  codes[code.trim()] = entry;
  db.prepare("INSERT INTO settings_kv (key, value) VALUES ('activation_codes', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(codes));

  req.audit("activate_code", "settings", { code: code.trim(), features }, `🔑 تم تفعيل كود التفعيل — ${features.length} ميزة`);
  res.json({ success: true, data: { features, activated: Object.keys(updates).length } });
});

module.exports = router;
