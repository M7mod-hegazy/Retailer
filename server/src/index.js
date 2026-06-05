require("dotenv").config();
const { createApp } = require("./app");
const { initDb, getDb } = require("./config/database");
const { startAutoBackupJob } = require("./jobs/autoBackup");
const { startNotificationJobs, startAuditLogCleanupJob, startOverdueDebtsJob } = require("./jobs/notificationJobs");
const { ensureSystemOwnerAccount } = require("./services/systemOwner.service");
const logger = require("./config/logger");

/**
 * Starts the Express server.
 * Returns a Promise that resolves with the http.Server instance
 * only after the server is successfully bound and listening.
 * This is required by the Electron main process to avoid opening
 * the browser window before the API is ready.
 */
function ensureDefaultsExist() {
  const db = getDb();

  db.prepare("UPDATE settings SET wizard_completed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1").run();

  const warehouse = db.prepare("SELECT id FROM warehouses LIMIT 1").get();
  if (!warehouse) {
    const result = db
      .prepare("INSERT INTO warehouses (name, code, is_default) VALUES (?, ?, 1)")
      .run("المخزن الرئيسي", "MAIN");
    db.prepare("UPDATE settings SET default_warehouse_id = ? WHERE id = 1").run(result.lastInsertRowid);
  }

  const treasury = db.prepare("SELECT id FROM treasuries LIMIT 1").get();
  if (!treasury) {
    const result = db
      .prepare("INSERT INTO treasuries (name, code, balance) VALUES (?, ?, ?)")
      .run("الخزنة الرئيسية", "CASH", 0);
    db.prepare("UPDATE settings SET default_treasury_id = ? WHERE id = 1").run(result.lastInsertRowid);
  }

  const customer = db.prepare("SELECT id FROM customers LIMIT 1").get();
  if (!customer) {
    const result = db
      .prepare("INSERT INTO customers (name, phone, opening_balance, is_active) VALUES (?, ?, 0, 1)")
      .run("زبون نقدي", null);
    db.prepare("UPDATE settings SET walk_in_customer_id = ? WHERE id = 1").run(result.lastInsertRowid);
  }

  const current = db.prepare("SELECT * FROM settings WHERE id = 1").get();
  if (!current?.currency_code) {
    db.prepare(
      `UPDATE settings SET
       currency_code = 'EGP', currency_symbol = 'ج.م',
       decimal_places = 2, tax_type = 'none', tax_rate = 0,
       invoice_prefix = 'INV-', purchase_prefix = 'PUR-',
       fiscal_year_start = 'January', date_format = 'dd/MM/yyyy',
       language = 'ar', receipt_width = '80mm',
       updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
    ).run();
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    try {
      initDb(process.env.DB_PATH);
      ensureSystemOwnerAccount();
      ensureDefaultsExist();
    } catch (err) {
      return reject(new Error(`Database init failed: ${err.message}`));
    }

    let app;
    try {
      app = createApp();
    } catch (err) {
      return reject(new Error(`App creation failed: ${err.message}`));
    }

    const host = process.env.HOST || "127.0.0.1";
    const port = Number(process.env.PORT || 5000);

    const server = app.listen(port, host, () => {
      logger.info({ message: "Server started", host, port });

      // Auto-backup: runs daily at the configured time (settings.auto_backup_time),
      // skips while a shift is open. See jobs/autoBackup.js.
      startAutoBackupJob();

      startNotificationJobs();
      startAuditLogCleanupJob();
      startOverdueDebtsJob();

      // Server is ready — resolve the promise
      resolve(server);
    });

    server.on("error", (err) => {
      logger.error("Server failed to start:", err);
      reject(err);
    });
  });
}

// Allow running directly: node server/src/index.js
if (require.main === module) {
  startServer()
    .then(() => {
      // running standalone — keep alive
    })
    .catch((err) => {
      console.error("Failed to start server:", err);
      process.exit(1);
    });
}

module.exports = { startServer };
