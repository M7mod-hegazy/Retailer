const cron = require("node-cron");
const { getDb } = require("../config/database");
const logger = require("../config/logger");

function runSafely(name, fn) {
  try {
    fn();
  } catch (err) {
    logger.error({ message: `Scheduled job failed: ${name}`, error: err.message, stack: err.stack });
  }
}

function runAutoSync() {
  const db = getDb();
  const cfg = db.prepare("SELECT * FROM sync_config WHERE is_active = 1 LIMIT 1").get();
  if (!cfg || !cfg.auto_sync_enabled) return;

  const since = cfg.last_sync_at || new Date(0).toISOString();
  const apiRes = db.prepare("SELECT ecom_url, store_id, api_key FROM sync_config WHERE id = ?").get(cfg.id);
  if (!apiRes) return;

  const http = require("http");
  const url = new URL(apiRes.ecom_url);

  const body = JSON.stringify({ storeId: apiRes.store_id, apiKey: apiRes.api_key, since });
  const options = {
    hostname: url.hostname,
    port: url.port || 80,
    path: "/api/sync/pull",
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    timeout: 30000,
  };

  const req = http.request(options, (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      db.prepare("UPDATE sync_config SET last_auto_sync_at = datetime('now') WHERE id = ?").run(cfg.id);
    });
  });
  req.on("error", () => {});
  req.write(body);
  req.end();
}

function startSyncScheduler() {
  return cron.schedule("* * * * *", () => runSafely("syncScheduler", runAutoSync), { scheduled: true });
}

module.exports = { startSyncScheduler };
