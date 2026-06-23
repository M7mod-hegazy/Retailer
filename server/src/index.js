// Pin the whole process to Egypt local time so any bare `new Date()` path is
// correct regardless of the host machine's timezone. Must run before anything
// touches Date. Centralized Cairo helpers live in ./utils/datetime.js.
process.env.TZ = "Africa/Cairo";

require("dotenv").config();
const { createApp } = require("./app");
const { initDb, getDb } = require("./config/database");
const { startAutoBackupJob } = require("./jobs/autoBackup");
const { startNotificationJobs, startAuditLogCleanupJob, startOverdueDebtsJob, startBirthdayJob } = require("./jobs/notificationJobs");
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

  db.prepare("UPDATE settings SET wizard_completed = 1, updated_at = datetime('now', 'localtime') WHERE id = 1").run();

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
       updated_at = datetime('now', 'localtime') WHERE id = 1`,
    ).run();
  }
}

function tryListen(app, port, host) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.on("error", reject);
  });
}

async function startServer() {
  try {
    initDb(process.env.DB_PATH);
    ensureSystemOwnerAccount();
    ensureDefaultsExist();
  } catch (err) {
    throw new Error(`Database init failed: ${err.message}`);
  }

  let app;
  try {
    app = createApp();
  } catch (err) {
    throw new Error(`App creation failed: ${err.message}`);
  }

  const host = process.env.HOST || "127.0.0.1";
  const startPort = Number(process.env.PORT || 5000);
  const maxAttempts = 20;

  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort + attempt;
    try {
      const server = await tryListen(app, port, host);
      process.env.ACTUAL_PORT = String(port);
      logger.info({ message: "Server started", host, port });

      // Also listen on a local named pipe (Windows) / unix socket so the Electron
      // renderer can reach the API over the retailer:// protocol WITHOUT any TCP
      // loopback socket — making it immune to antivirus/firewall software that
      // blocks 127.0.0.1 (the persistent "connection error" some hardened PCs hit).
      // Best-effort: a failure here never blocks startup; TCP remains the fallback.
      // A fresh, unique pipe name per start avoids EADDRINUSE on auto-restart.
      try {
        const os = require("os");
        const nodePath = require("path");
        const stamp = `${process.pid}-${Date.now()}`;
        const pipePath =
          process.platform === "win32"
            ? `\\\\.\\pipe\\elhegazi-retailer-${stamp}`
            : nodePath.join(os.tmpdir(), `elhegazi-retailer-${stamp}.sock`);
        const pipeServer = app.listen(pipePath, () => {
          process.env.RETAILER_PIPE = pipePath;
          logger.info({ message: "Server pipe listening", pipe: pipePath });
        });
        pipeServer.on("error", (e) =>
          logger.error({ message: "Server pipe listen failed", error: e.message }),
        );
      } catch (e) {
        logger.error({ message: "Server pipe setup failed", error: e.message });
      }

      startAutoBackupJob();
      startNotificationJobs();
      startAuditLogCleanupJob();
      startOverdueDebtsJob();
      startBirthdayJob();

      return server;
    } catch (err) {
      if (err.code !== "EADDRINUSE") throw err;
      lastErr = err;
    }
  }

  throw lastErr || new Error(`No available port found after ${maxAttempts} attempts`);
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
