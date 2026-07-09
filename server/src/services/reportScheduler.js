const { getDb } = require("../config/database");
const { listRows } = require("../reports/index");
const { nowSql } = require("../utils/datetime");

const CHECK_INTERVAL_MS = 60_000;
let intervalHandle = null;

function startReportScheduler() {
  if (intervalHandle) return;
  intervalHandle = setInterval(checkSchedules, CHECK_INTERVAL_MS);
  checkSchedules();
}

function stopReportScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

function cronFieldMatches(field, value) {
  if (field === "*") return true;
  if (field === String(value)) return true;
  if (field.includes(",")) return field.split(",").map(Number).includes(value);
  if (field.includes("-")) {
    const [low, high] = field.split("-").map(Number);
    return value >= low && value <= high;
  }
  if (field.includes("/")) {
    const [, step] = field.split("/");
    return value % Number(step) === 0;
  }
  return false;
}

function cronMatches(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const now = new Date();
  return (
    cronFieldMatches(parts[0], now.getMinutes()) &&
    cronFieldMatches(parts[1], now.getHours()) &&
    cronFieldMatches(parts[2], now.getDate()) &&
    cronFieldMatches(parts[3], now.getMonth() + 1) &&
    cronFieldMatches(parts[4], now.getDay() || 7)
  );
}

function checkSchedules() {
  try {
    const db = getDb();
    const schedules = db.prepare("SELECT * FROM report_schedules WHERE enabled = 1").all();
    for (const s of schedules) {
      if (cronMatches(s.cron)) {
        runSchedule(s);
      }
    }
  } catch (err) {
    console.error("[ReportScheduler]", err.message);
  }
}

function runSchedule(schedule) {
  try {
    const config = JSON.parse(schedule.config || "{}");
    const rows = listRows(schedule.slug, config.startDate, config.endDate, { ...config, pageSize: 1000 });
    const safeRows = Array.isArray(rows) ? rows.slice(0, 1000) : [];

    const db = getDb();
    db.prepare(
      "INSERT INTO report_snapshots (slug, title, config, rows, label) VALUES (?, ?, ?, ?, ?)",
    ).run(schedule.slug, `${schedule.title} (تلقائي)`, schedule.config, JSON.stringify(safeRows), `تلقائي: ${nowSql()}`);

    db.prepare("UPDATE report_schedules SET last_run_at = ? WHERE id = ?").run(nowSql(), schedule.id);

    console.log(`[ReportScheduler] Ran schedule ${schedule.id} ("${schedule.title}") - ${safeRows.length} rows`);
  } catch (err) {
    console.error(`[ReportScheduler] Schedule ${schedule.id}:`, err.message);
  }
}

module.exports = { startReportScheduler, stopReportScheduler };
