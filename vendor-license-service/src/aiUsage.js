// Per-store daily usage cap for the AI fallback, so an enabled provider can
// never run up a surprise bill. The "store" bucket is derived from headers the
// app sends (license id, then device id); requests without either share a
// generic bucket.

const { getDb } = require("./db");

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function dailyLimit() {
  return Math.max(0, Number(process.env.AI_DAILY_LIMIT || 50));
}

/**
 * Resolve a stable per-store bucket from the request headers.
 */
function bucketFromReq(req) {
  const license = String(req.headers["x-license-id"] || "").trim();
  if (license) return `lic:${license}`;
  const device = String(req.headers["x-device-id"] || "").trim();
  if (device) return `dev:${device}`;
  return "anon";
}

/**
 * Atomically check-and-increment today's usage for a bucket.
 * @returns {{ allowed: boolean, used: number, limit: number }}
 */
function consume(bucket) {
  const db = getDb();
  const day = todayKey();
  const limit = dailyLimit();

  const row = db
    .prepare("SELECT count FROM ai_usage WHERE bucket = ? AND day = ?")
    .get(bucket, day);
  const used = Number(row?.count || 0);

  if (limit > 0 && used >= limit) {
    return { allowed: false, used, limit };
  }

  db.prepare(
    `INSERT INTO ai_usage (bucket, day, count, updated_at)
     VALUES (?, ?, 1, CURRENT_TIMESTAMP)
     ON CONFLICT(bucket, day) DO UPDATE SET count = count + 1, updated_at = CURRENT_TIMESTAMP`,
  ).run(bucket, day);

  return { allowed: true, used: used + 1, limit };
}

module.exports = { bucketFromReq, consume, dailyLimit };
