const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const { getDb, getDbPath } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

router.use(authRequired);

// GET /api/maintenance/db-health
router.get("/db-health", (req, res) => {
  const db = getDb();

  // SQLite integrity check
  const rows = db.pragma("integrity_check");
  const isOk = rows.length === 1 && rows[0].integrity_check === "ok";

  // DB file size
  let dbSizeKb = 0;
  try {
    dbSizeKb = Math.round(fs.statSync(getDbPath()).size / 1024);
  } catch (_) {}

  // Table count (excluding SQLite internals)
  const tableCount = db
    .prepare("SELECT COUNT(*) as n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .get().n;

  // Pending migrations (files in electron/migrations not yet in _migrations table)
  let pendingMigrations = 0;
  let totalMigrations = 0;
  try {
    const migrationsDir = path.join(__dirname, "../../../electron/migrations");
    const allFiles = fs.readdirSync(migrationsDir).filter((f) => /^\d+_.*\.js$/.test(f));
    totalMigrations = allFiles.length;
    const applied = new Set(db.prepare("SELECT id FROM _migrations").all().map((r) => r.id));
    pendingMigrations = allFiles.filter((f) => !applied.has(f.replace(/\.js$/, ""))).length;
  } catch (_) {}

  // Journal mode (should be WAL for best performance)
  const journalMode = db.pragma("journal_mode", { simple: true });

  // Page stats for fragmentation hint
  const pageCount = db.pragma("page_count", { simple: true });
  const freelistCount = db.pragma("freelist_count", { simple: true });
  const fragmentationPct = pageCount > 0 ? Math.round((freelistCount / pageCount) * 100) : 0;

  res.json({
    ok: isOk,
    integrity: isOk ? "ok" : "errors",
    integrityErrors: isOk ? [] : rows.map((r) => r.integrity_check).filter((v) => v !== "ok"),
    dbSizeKb,
    tableCount,
    totalMigrations,
    pendingMigrations,
    journalMode,
    fragmentationPct,
  });
});

// POST /api/maintenance/db-fix
router.post("/db-fix", requirePagePermission("settings", "edit"), (req, res) => {
  const db = getDb();
  const { fixType } = req.body || {};

  if (fixType === "vacuum") {
    db.exec("VACUUM");
    return res.json({ ok: true, message: "تم ضغط قاعدة البيانات وتحرير المساحة الزائدة" });
  }

  if (fixType === "wal-checkpoint") {
    db.pragma("wal_checkpoint(FULL)");
    return res.json({ ok: true, message: "تم تفريغ ملف WAL إلى قاعدة البيانات الرئيسية" });
  }

  if (fixType === "reindex") {
    db.exec("REINDEX");
    return res.json({ ok: true, message: "تم إعادة بناء جميع الفهارس" });
  }

  return res.status(400).json({ ok: false, message: "نوع الإصلاح غير معروف" });
});

module.exports = router;
