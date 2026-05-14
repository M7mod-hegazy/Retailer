const express = require("express");
const { getDb } = require("../config/database");
const { authRequired, requireRole } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();

function getSettings() {
  return getDb().prepare("SELECT * FROM settings WHERE id = 1").get();
}

function normalizeBoolean(value) {
  return value ? 1 : 0;
}

router.get("/", authRequired, requirePagePermission("settings", "view"), (_req, res) => {
  res.json({ success: true, data: getSettings() });
});

router.put("/", authRequired, requirePagePermission("settings", "edit"), requireRole("admin"), (req, res) => {
  const current = getSettings();
  const payload = req.body || {};
  const next = { ...current, ...payload };

  getDb()
    .prepare(
      `UPDATE settings
       SET company_name = ?,
           company_name_en = ?,
           branch_name = ?,
           branch_code = ?,
           address = ?,
           phone = ?,
           vat_number = ?,
           commercial_register = ?,
           currency_code = ?,
           currency_symbol = ?,
           decimal_places = ?,
           tax_rate = ?,
           tax_type = ?,
           invoice_prefix = ?,
           purchase_prefix = ?,
           fiscal_year_start = ?,
           date_format = ?,
           language = ?,
           receipt_width = ?,
           receipt_footer = ?,
           show_cashier_name = ?,
           show_customer_name = ?,
           show_tax = ?,
           show_footer = ?,
           app_name = ?,
           app_subtitle = ?,
           logo_url = ?,
           logo_on_invoices = ?,
           logo_on_receipts = ?,
           logo_on_sidebar = ?,
           logo_on_reports = ?,
           auto_backup_enabled = ?,
           auto_backup_path = ?,
            default_pos_view = ?,
            additional_addresses = ?,
            additional_phones = ?,
            address_position = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1`,
    )
    .run(
      next.company_name || null,
      next.company_name_en || null,
      next.branch_name || null,
      next.branch_code || null,
      next.address || null,
      next.phone || null,
      next.vat_number || null,
      next.commercial_register || null,
      next.currency_code || "EGP",
      next.currency_symbol || "EGP",
      Number(next.decimal_places ?? 2),
      Number(next.tax_rate || 0),
      next.tax_type || "none",
      next.invoice_prefix || "INV-",
      next.purchase_prefix || "PUR-",
      next.fiscal_year_start || "January",
      next.date_format || "dd/MM/yyyy",
      next.language || "ar",
      next.receipt_width || "80mm",
      next.receipt_footer || null,
      normalizeBoolean(next.show_cashier_name !== false),
      normalizeBoolean(next.show_customer_name !== false),
      normalizeBoolean(next.show_tax !== false),
      normalizeBoolean(next.show_footer !== false),
      next.app_name || null,
      next.app_subtitle || null,
      next.logo_url || null,
      normalizeBoolean(next.logo_on_invoices !== false),
      normalizeBoolean(next.logo_on_receipts !== false),
      normalizeBoolean(next.logo_on_sidebar !== false),
      normalizeBoolean(next.logo_on_reports !== false),
      normalizeBoolean(next.auto_backup_enabled),
      next.auto_backup_path || null,
      next.default_pos_view || "detailed",
      next.additional_addresses || "[]",
      next.additional_phones || "[]",
      next.address_position || "top",
    );

  res.json({ success: true, data: getSettings() });
});

// Bulk update settings - accepts array of { setting_key, setting_value }
router.post("/bulk", authRequired, requirePagePermission("settings", "add"), requireRole("admin"), (req, res) => {
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

  if (Object.keys(updates).length === 0) {
    return res.json({ success: true, data: current });
  }

  // Merge with current and update
  const next = { ...current, ...updates };
  
  db.prepare(
    `UPDATE settings
     SET company_name = ?,
         company_name_en = ?,
         branch_name = ?,
         branch_code = ?,
         address = ?,
         phone = ?,
         vat_number = ?,
         commercial_register = ?,
         currency_code = ?,
         currency_symbol = ?,
         decimal_places = ?,
         tax_rate = ?,
         tax_type = ?,
         invoice_prefix = ?,
         purchase_prefix = ?,
         fiscal_year_start = ?,
         date_format = ?,
         language = ?,
         receipt_width = ?,
         receipt_footer = ?,
         show_cashier_name = ?,
         show_customer_name = ?,
         show_tax = ?,
         show_footer = ?,
         app_name = ?,
         app_subtitle = ?,
         logo_url = ?,
         logo_on_invoices = ?,
         logo_on_receipts = ?,
         logo_on_sidebar = ?,
         logo_on_reports = ?,
         auto_backup_enabled = ?,
         auto_backup_path = ?,
         default_pos_view = ?,
         additional_addresses = ?,
         additional_phones = ?,
         address_position = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
  ).run(
    next.company_name || null,
    next.company_name_en || null,
    next.branch_name || null,
    next.branch_code || null,
    next.address || null,
    next.phone || null,
    next.vat_number || null,
    next.commercial_register || null,
    next.currency_code || "EGP",
    next.currency_symbol || "EGP",
    Number(next.decimal_places ?? 2),
    Number(next.tax_rate || 0),
    next.tax_type || "none",
    next.invoice_prefix || "INV-",
    next.purchase_prefix || "PUR-",
    next.fiscal_year_start || "January",
    next.date_format || "dd/MM/yyyy",
    next.language || "ar",
    next.receipt_width || "80mm",
    next.receipt_footer || null,
    normalizeBoolean(next.show_cashier_name !== false),
    normalizeBoolean(next.show_customer_name !== false),
    normalizeBoolean(next.show_tax !== false),
    normalizeBoolean(next.show_footer !== false),
    next.app_name || null,
    next.app_subtitle || null,
    next.logo_url || null,
    normalizeBoolean(next.logo_on_invoices !== false),
    normalizeBoolean(next.logo_on_receipts !== false),
    normalizeBoolean(next.logo_on_sidebar !== false),
    normalizeBoolean(next.logo_on_reports !== false),
    normalizeBoolean(next.auto_backup_enabled),
    next.auto_backup_path || null,
    next.default_pos_view || "detailed",
    next.additional_addresses || "[]",
    next.additional_phones || "[]",
    next.address_position || "top",
  );

  res.json({ success: true, data: getSettings() });
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

    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
