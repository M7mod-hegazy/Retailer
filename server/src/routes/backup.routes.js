const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const multer = require("multer");
const AdmZip = require("adm-zip");
const { closeDb, getDb, getDbPath, initDb } = require("../config/database");
const { getUploadsDir } = require("../middleware/upload");
const {
  performBackup,
  computeBackupPreview,
  listBackups,
  restoreBackup,
  exportCheckpoint,
  emptyDatabase,
  isLikelySqliteFile,
  sanitizePath,
} = require("../services/backupService");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), "tmp") });

router.use(authRequired);

const can = (action) => requirePagePermission("backup", action);

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
router.post("/restore", can("restore"), (req, res, next) => {
  try {
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
router.post("/restore-upload", can("restore"), upload.single("backupFile"), (req, res, next) => {
  const tmpExtractDir = path.join(os.tmpdir(), `retailer-import-${Date.now()}`);
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "لم يتم تحديد ملف استعادة" });
    }

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
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// --- Empty the database ----------------------------------------------------
router.post("/empty", can("empty"), (req, res, next) => {
  try {
    const result = emptyDatabase({
      mode: String(req.body?.mode || ""),
      ownerPassword: String(req.body?.ownerPassword || ""),
    });
    res.json({ success: true, message: "تم تفريغ قاعدة البيانات", data: result });
  } catch (err) {
    next(err);
  }
});

// --- Settings (auto-backup enable / daily time / root path) ----------------
router.get("/settings", can("view"), (_req, res, next) => {
  try {
    const settings = getDb()
      .prepare("SELECT auto_backup_enabled, auto_backup_path, auto_backup_time FROM settings WHERE id = 1")
      .get();
    if (settings) settings.auto_backup_path = sanitizePath(settings.auto_backup_path) || null;
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

router.put("/settings", can("create"), (req, res, next) => {
  try {
    const autoBackupEnabled = req.body?.auto_backup_enabled ? 1 : 0;
    const autoBackupPath = sanitizePath(req.body?.auto_backup_path) || null;
    let autoBackupTime = String(req.body?.auto_backup_time || "").trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(autoBackupTime)) autoBackupTime = "02:00";

    getDb()
      .prepare(
        "UPDATE settings SET auto_backup_enabled = ?, auto_backup_path = ?, auto_backup_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
      )
      .run(autoBackupEnabled, autoBackupPath, autoBackupTime);

    const settings = getDb()
      .prepare("SELECT auto_backup_enabled, auto_backup_path, auto_backup_time FROM settings WHERE id = 1")
      .get();
    if (settings) settings.auto_backup_path = sanitizePath(settings.auto_backup_path) || null;
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
