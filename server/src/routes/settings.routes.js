const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb } = require("../config/database");
const { authRequired, requireRole } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");
const {
  ALLOW_DEV_BYPASS,
  APP_PROTECTION_MODE,
  DEVELOPER_USERNAME,
  activateLicense,
  getHardwareFingerprint,
  isLicenseFeatureEnabled,
  getLicenseStatusSummary,
  syncSettingsLicenseState,
} = require("../services/license.service");

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

router.get("/setup-status", (_req, res) => {
  syncSettingsLicenseState();
  const settings = getSettings();
  res.json({
    success: true,
    data: {
      is_setup_complete: Boolean(settings?.wizard_completed),
      step: settings?.setup_step || 1,
      settings,
      draft: settings?.setup_payload_json ? JSON.parse(settings.setup_payload_json) : null,
      developer_username: DEVELOPER_USERNAME,
      allow_dev_bypass: ALLOW_DEV_BYPASS,
      protection_mode: APP_PROTECTION_MODE,
      license_required: isLicenseFeatureEnabled(),
      license_summary: getLicenseStatusSummary(),
    },
  });
});

router.post("/validate-license", (req, res, next) => {
  if (!isLicenseFeatureEnabled()) {
    const error = new Error("License validation is disabled in windows_managed mode");
    error.status = 409;
    return next(error);
  }
  activateLicense(req.body?.signed_license || req.body?.license_key)
    .then((result) => {
      if (!result.success) {
        const error = new Error(result.message || "License activation failed");
        error.status = result.status || 400;
        throw error;
      }
      res.json({ success: true, data: result.data });
    })
    .catch((error) => next(error));
});

router.get("/hardware-id", (_req, res) => {
  res.json({ success: true, data: { hardware_id: getHardwareFingerprint() } });
});

router.post("/setup-progress", (req, res) => {
  const payload = req.body || {};
  const step = Number(payload.step || 1);
  const current = getSettings();
  const mergedDraft = {
    ...(current?.setup_payload_json ? JSON.parse(current.setup_payload_json) : {}),
    ...payload.draft,
  };

  getDb()
    .prepare(
      `UPDATE settings
       SET setup_step = ?, setup_payload_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
    )
    .run(step, JSON.stringify(mergedDraft));

  res.json({ success: true, data: { step, draft: mergedDraft } });
});

router.post("/setup-complete", (req, res, next) => {
  const db = getDb();
  const payload = req.body || {};

  try {
    const result = db.transaction(() => {
      const settingsPayload = payload.settings || {};
      const defaults = payload.defaults || {};
      const admin = payload.admin || {};

      if (!settingsPayload.company_name || !settingsPayload.branch_name || !settingsPayload.branch_code) {
        const err = new Error("Company name, branch name, and branch code are required");
        err.status = 400;
        throw err;
      }

      if (!admin.username || !admin.password || admin.password.length < 8) {
        const err = new Error("Admin account is incomplete");
        err.status = 400;
        throw err;
      }

      const isDeveloperSetup = String(admin.username || "").trim().toLowerCase() === DEVELOPER_USERNAME;
      if (isLicenseFeatureEnabled() && !isDeveloperSetup && payload.license?.status !== "activated") {
        const err = new Error("License activation is required before completing setup");
        err.status = 403;
        throw err;
      }

      const warehouse = defaults.default_warehouse_name
        ? db
            .prepare("INSERT INTO warehouses (name, code, is_default) VALUES (?, ?, 1)")
            .run(defaults.default_warehouse_name, defaults.default_warehouse_code || defaults.default_warehouse_name.slice(0, 5).toUpperCase())
        : null;

      if (warehouse) {
        db.prepare("UPDATE warehouses SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END").run(
          warehouse.lastInsertRowid,
        );
      }

      const treasury = defaults.default_treasury_name
        ? db
            .prepare("INSERT INTO treasuries (name, code, balance) VALUES (?, ?, ?)")
            .run(
              defaults.default_treasury_name,
              defaults.default_treasury_code || defaults.default_treasury_name.slice(0, 5).toUpperCase(),
              Number(defaults.default_treasury_balance || 0),
            )
        : null;

      const customer = defaults.walk_in_customer_name
        ? db
            .prepare("INSERT INTO customers (name, phone, opening_balance, is_active) VALUES (?, ?, 0, 1)")
            .run(defaults.walk_in_customer_name, null)
        : null;

      const existingAdmin = db.prepare("SELECT id FROM users WHERE username = ?").get(admin.username);
      if (existingAdmin) {
        const err = new Error("Admin username already exists");
        err.status = 409;
        throw err;
      }

      const passwordHash = bcrypt.hashSync(admin.password, 10);
      db.prepare(
        "INSERT INTO users (full_name, username, password_hash, role, is_active) VALUES (?, ?, ?, 'admin', 1)",
      ).run(admin.full_name || admin.username, admin.username, passwordHash);

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
             auto_backup_enabled = ?,
             auto_backup_path = ?,
             walk_in_customer_id = ?,
             default_warehouse_id = ?,
             default_treasury_id = ?,
             license_key = ?,
             license_status = ?,
             setup_step = 5,
             setup_payload_json = NULL,
             wizard_completed = 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = 1`,
      ).run(
        settingsPayload.company_name,
        settingsPayload.company_name_en || null,
        settingsPayload.branch_name,
        String(settingsPayload.branch_code || "").toUpperCase(),
        settingsPayload.address || null,
        settingsPayload.phone || null,
        settingsPayload.tax_id || null,
        settingsPayload.commercial_register || null,
        settingsPayload.currency_code || "EGP",
        settingsPayload.currency_symbol || "EGP",
        Number(settingsPayload.decimal_places ?? 2),
        Number(settingsPayload.tax_rate || 0),
        settingsPayload.tax_type || "none",
        settingsPayload.invoice_prefix || "INV-",
        settingsPayload.purchase_prefix || "PUR-",
        settingsPayload.fiscal_year_start || "January",
        settingsPayload.date_format || "dd/MM/yyyy",
        settingsPayload.language || "ar",
        defaults.receipt_width || "80mm",
        normalizeBoolean(defaults.auto_backup_enabled),
        defaults.auto_backup_path || null,
        customer?.lastInsertRowid || null,
        warehouse?.lastInsertRowid || null,
        treasury?.lastInsertRowid || null,
        isLicenseFeatureEnabled() && payload.license?.status === "activated" ? "SIGNED_LICENSE" : null,
        isLicenseFeatureEnabled() ? payload.license?.status || "unlicensed" : "windows_managed",
      );

      return getSettings();
    })();

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
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
