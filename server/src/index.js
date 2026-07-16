// Pin the whole process to Egypt local time so any bare `new Date()` path is
// correct regardless of the host machine's timezone. Must run before anything
// touches Date. Centralized Cairo helpers live in ./utils/datetime.js.
process.env.TZ = "Africa/Cairo";

require("dotenv").config();
const { createApp } = require("./app");
const { initDb, getDb } = require("./config/database");
const { startAutoBackupJob } = require("./jobs/autoBackup");
const { startNotificationJobs, startAuditLogCleanupJob, startOverdueDebtsJob, startBirthdayJob } = require("./jobs/notificationJobs");
const { startSyncScheduler } = require("./jobs/syncScheduler");
const { startSmsDrainer } = require("./services/smsService");
const { startEmailDrainer } = require("./services/emailService");
const { startReportScheduler } = require("./services/reportScheduler");
const { startTelegramRetryJob } = require("./services/telegramService");
const { startTelegramDigestJob } = require("./jobs/telegramDigestJob");
const { ensureSystemOwnerAccount } = require("./services/systemOwner.service");
const { nowSql } = require("./utils/datetime");
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

  db.prepare("UPDATE settings SET updated_at = ? WHERE id = 1").run(nowSql());

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
      .run("عميل نقدي", null);
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
       updated_at = ? WHERE id = 1`,
    ).run(nowSql());
  }
}

/**
 * Validate critical NOT NULL columns have DEFAULT values.
 * Any column that is NOT NULL without a DEFAULT will silently fail on INSERT
 * if the caller omits it — the order_type bug pattern.
 * This runs AFTER migrations, so it catches newly-added columns too.
 * Logs WARNINGs only — never crashes startup.
 */
function validateCriticalSchema() {
  const CRITICAL_TABLES = [
    "invoices", "purchases", "sales_returns", "purchase_returns",
    "expenses", "revenues", "payments", "withdrawals",
    "daily_sessions", "employees", "users",
  ];

  // Business-identity columns that are intentionally NOT NULL / no DEFAULT.
  // Every INSERT in the codebase always provides these — route-level validation
  // guarantees it. Listing them here suppresses false-positive warnings.
  const SCHEMA_KNOWN_REQUIRED = new Set([
    "invoices.invoice_no",
    "expenses.amount", "revenues.amount",
    "payments.party_type", "payments.party_id", "payments.amount",
    "withdrawals.amount",
    "daily_sessions.date",
    "employees.name",
    "users.username", "users.password_hash",
  ]);

  try {
    const db = getDb();
    const issues = [];
    for (const table of CRITICAL_TABLES) {
      let cols;
      try { cols = db.prepare(`PRAGMA table_info(${table})`).all(); } catch { continue; }
      for (const col of cols) {
        // notnull=1 means NOT NULL; dflt_value=null means no DEFAULT
        if (col.notnull === 1 && col.dflt_value === null && col.pk === 0) {
          const key = `${table}.${col.name}`;
          if (!SCHEMA_KNOWN_REQUIRED.has(key)) {
            issues.push(`${key} — NOT NULL but no DEFAULT`);
          }
        }
      }
    }
    if (issues.length > 0) {
      logger.warn({
        message: "Schema validation: NOT NULL columns without DEFAULT detected — INSERTs that omit these will 500",
        issues,
      });
      console.warn("[SCHEMA WARN] NOT NULL / no DEFAULT columns:");
      issues.forEach(i => console.warn("  ⚠", i));
    } else {
      logger.info({ message: "Schema validation passed — all critical NOT NULL columns have DEFAULTs or are known-required" });
    }
  } catch (err) {
    logger.warn({ message: "Schema validation failed (non-fatal)", error: err.message });
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
    validateCriticalSchema();
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
      // This is the PRIMARY transport for the packaged app, so we AWAIT it (with a
      // hard cap) before returning: otherwise the renderer can fire retailer://
      // requests in the gap before RETAILER_PIPE is set and hit a transient bridge
      // 503 ("pipe not ready") that surfaces as a false disconnect. A pipe failure
      // still never blocks startup — TCP remains as the fallback. A fresh, unique
      // pipe name per start avoids EADDRINUSE on auto-restart.
      await new Promise((resolvePipe) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolvePipe();
        };
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
            done();
          });
          pipeServer.on("error", (e) => {
            logger.error({ message: "Server pipe listen failed", error: e.message });
            done(); // fall through to TCP fallback, never strand startup
          });
          // Safety cap: never let a slow/stuck pipe bind delay the whole app.
          setTimeout(done, 3000);
        } catch (e) {
          logger.error({ message: "Server pipe setup failed", error: e.message });
          done();
        }
      });

      startAutoBackupJob();
      startNotificationJobs();
      startAuditLogCleanupJob();
      startOverdueDebtsJob();
      startBirthdayJob();
      startSyncScheduler();
      startSmsDrainer(); // no-op until settings.sms_enabled + gateway URL are configured
      startEmailDrainer(); // no-op until settings.email_enabled + provider configured
      startTelegramRetryJob(); // no-op until Telegram is configured
      startTelegramDigestJob(); // weekly/monthly/yearly digests, catch-up on launch
      startReportScheduler();

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
