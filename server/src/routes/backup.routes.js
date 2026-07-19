const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const multer = require("multer");
const AdmZip = require("adm-zip");
const { closeDb, getDb, getDbPath, initDb } = require("../config/database");
const { getUploadsDir } = require("../middleware/upload");
const { nowSql } = require("../utils/datetime");
const {
  performBackup,
  computeBackupPreview,
  listBackups,
  restoreBackup,
  exportCheckpoint,
  emptyDatabase,
  getPurgePreview,
  isLikelySqliteFile,
  sanitizePath,
} = require("../services/backupService");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");
const { notifyOwner, EVENT_TYPES: TG } = require("../services/telegramService");

const { ensureWritableDir } = require("../config/paths");

const router = express.Router();
// Temp staging for uploaded backup archives. MUST be a per-user writable
// location — process.cwd() is the (read-only) install dir for packaged builds.
const upload = multer({ dest: ensureWritableDir(path.join(os.tmpdir(), "ElHegaziRetailer-tmp"), "tmp") });

router.use(authRequired);

const can = (action) => requirePagePermission("backup", action);

// Restore/wipe replace or delete the data the owner would audit — and can swap
// out the DB holding the Telegram config — so their alert must be sent and
// awaited BEFORE the destructive step. Bounded so a slow network can never
// block the operation itself.
async function notifyBeforeDestructive(req, eventType, data) {
  try {
    await Promise.race([
      notifyOwner(eventType, {
        ...data,
        userName: req.user?.full_name || req.user?.username,
        createdAt: new Date().toISOString(),
      }, getDb()),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
  } catch (_) { /* never block a destructive op on its own alert */ }
}

// --- Preview (dry run) -----------------------------------------------------
router.get("/preview", can("create"), (_req, res, next) => {
  try {
    res.json({ success: true, data: computeBackupPreview() });
  } catch (err) {
    next(err);
  }
});

// --- Create ----------------------------------------------------------------
router.post("/trigger", can("create"), (req, res, next) => {
  try {
    const label = String(req.body?.label || "").trim() || null;
    const result = performBackup({ triggerType: "manual", label });
    try {
      getDb()
        .prepare("UPDATE settings SET last_auto_backup_at = ?, updated_at = ? WHERE id = 1")
        .run(result.summary.createdAt, nowSql());
    } catch (e) {
      // non-fatal
    }
    // Notify owner of manual backup (automated backups fire from autoBackup.js)
    try {
      notifyOwner(TG.BACKUP_RESULT, {
        success: true,
        reason: label || "نسخة يدوية",
        filePath: result.dbPath,
        error: null,
      }, getDb());
    } catch (_) { /* non-critical */ }
    res.json({ success: true, data: { path: result.dbPath, summary: result.summary } });
  } catch (err) {
    next(err);
  }
});

// --- List as Year -> Month -> Day tree -------------------------------------
router.get("/list", can("view"), (_req, res, next) => {
  try {
    res.json({ success: true, data: listBackups() });
  } catch (err) {
    next(err);
  }
});

// --- Restore from a server-side checkpoint path ----------------------------
router.post("/restore", can("restore"), async (req, res, next) => {
  try {
    // Notify before the swap: after restoring, the DB (and its Telegram
    // settings/queue) is a different file, so a post-restore alert could
    // silently vanish. Restoring an old backup is also how recent activity
    // gets erased, which is exactly what the owner needs to hear about.
    await notifyBeforeDestructive(req, TG.BACKUP_RESTORED, {
      source: String(req.body?.path || "نسخة محفوظة"),
    });
    const result = restoreBackup({ path: String(req.body?.path || "") });
    res.json({
      success: true,
      message: result.legacy
        ? "تمت الاستعادة (نسخة قديمة بدون صور)"
        : "تمت الاستعادة بنجاح مع إنشاء نسخة أمان قبل الاستبدال",
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// --- Restore from an uploaded file (.db or .zip) — fallback path -----------
router.post("/restore-upload", can("restore"), upload.single("backupFile"), async (req, res, next) => {
  const tmpExtractDir = path.join(os.tmpdir(), `retailer-import-${Date.now()}`);
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "لم يتم تحديد ملف استعادة" });
    }

    // Fire before the swap — see the /restore handler for why.
    await notifyBeforeDestructive(req, TG.BACKUP_RESTORED, {
      source: `ملف مرفوع: ${req.file.originalname || "غير معروف"}`,
    });

    const dbPath = getDbPath();
    const rollback = performBackup({ triggerType: "pre-restore", label: "auto safety before import" });
    const staged = `${dbPath}.restore-staged`;

    const isZip = req.file.originalname?.toLowerCase().endsWith(".zip");
    let uploadEntries = null; // [{ name, buffer }]

    if (isZip) {
      const zip = new AdmZip(req.file.path);
      const dbEntry = zip.getEntry("retailer.db");
      if (!dbEntry) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, message: "ملف مضغوط غير صالح (لا يحتوي قاعدة بيانات)" });
      }
      fs.writeFileSync(staged, dbEntry.getData());
      uploadEntries = zip
        .getEntries()
        .filter((e) => !e.isDirectory && e.entryName.startsWith("uploads/"))
        .map((e) => ({ name: e.entryName.slice("uploads/".length), buffer: e.getData() }));
    } else {
      if (!isLikelySqliteFile(req.file.path)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, message: "ملف النسخة الاحتياطية غير صالح" });
      }
      fs.copyFileSync(req.file.path, staged);
    }
    fs.unlinkSync(req.file.path);

    closeDb();
    try {
      fs.copyFileSync(staged, dbPath);
      if (uploadEntries) {
        const uploadsDir = getUploadsDir();
        const safeUploadsDir = path.resolve(uploadsDir);
        const keep = new Set();
        for (const entry of uploadEntries) {
          // Guard against Zip Slip — reject archive entries that escape uploads/.
          const target = path.resolve(safeUploadsDir, entry.name);
          const rel = path.relative(safeUploadsDir, target);
          if (rel.startsWith("..") || path.isAbsolute(rel)) {
            throw new Error("مسار غير صالح داخل الملف المضغوط");
          }
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, entry.buffer);
          keep.add(target);
        }
        for (const f of fs.readdirSync(uploadsDir)) {
          const abs = path.resolve(path.join(uploadsDir, f));
          if (fs.statSync(abs).isFile() && !keep.has(abs)) fs.unlinkSync(abs);
        }
      }
      initDb(dbPath);
      if (fs.existsSync(staged)) fs.unlinkSync(staged);
    } catch (restoreError) {
      try {
        fs.copyFileSync(rollback.dbPath, dbPath);
        initDb(dbPath);
      } catch {
        /* best-effort rollback */
      }
      if (fs.existsSync(staged)) fs.unlinkSync(staged);
      throw restoreError;
    }

    res.json({
      success: true,
      message: "تمت الاستعادة بنجاح مع إنشاء نسخة أمان قبل الاستبدال",
      data: { rollback_backup: rollback.dbPath, images: Boolean(uploadEntries) },
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (fs.existsSync(tmpExtractDir)) fs.rmSync(tmpExtractDir, { recursive: true, force: true });
    next(err);
  }
});

// --- Export a checkpoint as a portable .zip --------------------------------
router.post("/export", can("export"), (req, res, next) => {
  try {
    const result = exportCheckpoint({
      path: String(req.body?.path || ""),
      destPath: String(req.body?.destPath || ""),
    });
    // Notify owner of checkpoint export (data exfiltration vector)
    try {
      notifyOwner(TG.BACKUP_EXPORTED, {
        filePath: result?.path || req.body?.destPath || "—",
        fileSize: result?.size || "—",
        userName: req.user?.full_name || req.user?.username,
        createdAt: new Date().toISOString(),
      }, getDb());
    } catch (_) { /* non-critical */ }
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// --- Purge preview (per-category live row counts) --------------------------
router.get("/purge-preview", can("empty"), (_req, res, next) => {
  try {
    res.json({ success: true, data: getPurgePreview() });
  } catch (err) {
    next(err);
  }
});

// --- Purge selected categories ---------------------------------------------
router.post("/empty", can("empty"), async (req, res, next) => {
  try {
    const categories = Array.isArray(req.body?.categories) ? req.body.categories : [];
    // Wiping data can remove the very records an owner would audit, so the
    // alert goes out before the purge runs.
    await notifyBeforeDestructive(req, TG.DATA_WIPED, {
      scope: categories.length ? categories.join("، ") : "كل البيانات المحددة",
    });
    const result = emptyDatabase({
      categories,
      ownerPassword: String(req.body?.ownerPassword || ""),
    });
    res.json({ success: true, message: "تم حذف البيانات المحددة", data: result });
  } catch (err) {
    next(err);
  }
});

// --- Settings (auto-backup enable / interval / root path) ------------------
const SETTINGS_COLS =
  "auto_backup_enabled, auto_backup_path, auto_backup_interval_hours, last_auto_backup_at";

router.get("/settings", can("view"), (_req, res, next) => {
  try {
    const settings = getDb()
      .prepare(`SELECT ${SETTINGS_COLS} FROM settings WHERE id = 1`)
      .get();
    if (settings) {
      settings.auto_backup_path = sanitizePath(settings.auto_backup_path) || null;
      try {
        const list = listBackups();
        const latestSnapshot = list.years?.[0]?.months?.[0]?.days?.[0]?.snapshots?.[0];
        if (latestSnapshot?.createdAt) {
          settings.last_auto_backup_at = latestSnapshot.createdAt;
        }
      } catch (e) {
        // fallback
      }
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

router.put("/settings", can("create"), (req, res, next) => {
  try {
    const db = getDb();
    // Read old settings before update for Telegram notification
    const oldSettings = db.prepare(`SELECT ${SETTINGS_COLS} FROM settings WHERE id = 1`).get();

    const autoBackupEnabled = req.body?.auto_backup_enabled ? 1 : 0;
    const autoBackupPath = sanitizePath(req.body?.auto_backup_path) || null;

    // Interval in hours: clamp to a sane 1h..168h (1 week) range, default 24.
    let intervalHours = Math.round(Number(req.body?.auto_backup_interval_hours));
    if (!Number.isFinite(intervalHours)) intervalHours = 24;
    intervalHours = Math.min(168, Math.max(1, intervalHours));

    db.prepare(
      "UPDATE settings SET auto_backup_enabled = ?, auto_backup_path = ?, auto_backup_interval_hours = ?, updated_at = ? WHERE id = 1"
    ).run(autoBackupEnabled, autoBackupPath, intervalHours, nowSql());

    // Notify owner of backup settings changes
    try {
      const changes = [];
      if (oldSettings && oldSettings.auto_backup_enabled !== autoBackupEnabled) {
        changes.push({ settingName: "النسخ الاحتياطي التلقائي", oldValue: oldSettings.auto_backup_enabled ? "مفعل" : "معطّل", newValue: autoBackupEnabled ? "مفعل" : "معطّل" });
      }
      if (oldSettings && oldSettings.auto_backup_interval_hours !== intervalHours) {
        changes.push({ settingName: "فترة النسخ الاحتياطي", oldValue: `${oldSettings.auto_backup_interval_hours} ساعة`, newValue: `${intervalHours} ساعة` });
      }
      if (oldSettings && (oldSettings.auto_backup_path || "") !== (autoBackupPath || "")) {
        changes.push({ settingName: "مسار النسخ الاحتياطي", oldValue: oldSettings.auto_backup_path || "—", newValue: autoBackupPath || "—" });
      }
      for (const change of changes) {
        notifyOwner(TG.BACKUP_SETTINGS_CHANGED, {
          settingName: change.settingName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          userName: req.user?.full_name || req.user?.username,
          createdAt: new Date().toISOString(),
        }, db);
      }
    } catch (_) { /* non-critical */ }

    const settings = db.prepare(`SELECT ${SETTINGS_COLS} FROM settings WHERE id = 1`).get();
    if (settings) {
      settings.auto_backup_path = sanitizePath(settings.auto_backup_path) || null;
      try {
        const list = listBackups();
        const latestSnapshot = list.years?.[0]?.months?.[0]?.days?.[0]?.snapshots?.[0];
        if (latestSnapshot?.createdAt) {
          settings.last_auto_backup_at = latestSnapshot.createdAt;
        }
      } catch (e) {
        // fallback
      }
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
