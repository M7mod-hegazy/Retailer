require("dotenv").config();
const cron = require("node-cron");
const { createApp } = require("./app");
const { initDb, getDb } = require("./config/database");
const { performBackup } = require("./services/backupService");
const { ensureSystemOwnerAccount } = require("./services/systemOwner.service");
const logger = require("./config/logger");

/**
 * Starts the Express server.
 * Returns a Promise that resolves with the http.Server instance
 * only after the server is successfully bound and listening.
 * This is required by the Electron main process to avoid opening
 * the browser window before the API is ready.
 */
function startServer() {
  return new Promise((resolve, reject) => {
    try {
      initDb(process.env.DB_PATH);
      ensureSystemOwnerAccount();
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

      // Auto-backup cron: every day at 11:59 PM
      cron.schedule("59 23 * * *", () => {
        try {
          const settings = getDb()
            .prepare("SELECT auto_backup_enabled FROM settings WHERE id = 1")
            .get();
          if (settings?.auto_backup_enabled) {
            logger.info("Running auto-backup...");
            performBackup();
          }
        } catch (e) {
          logger.error("Auto-backup failed:", e);
        }
      });

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
