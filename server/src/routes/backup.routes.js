const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { closeDb, getDb, getDbPath, initDb } = require("../config/database");
const { performBackup, isLikelySqliteFile } = require("../services/backupService");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), "tmp") });
router.use(authRequired, requireRole("admin"));

router.post("/trigger", (_req, res, next) => {
  try {
    const dest = performBackup();
    res.json({ success: true, data: { path: dest } });
  } catch (err) {
    next(err);
  }
});

router.post("/restore", upload.single("backupFile"), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "لم يتم تحديد ملف استعادة" });
    }
    if (!isLikelySqliteFile(req.file.path)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: "ملف النسخة الاحتياطية غير صالح" });
    }

    const dbPath = getDbPath();
    const rollbackBackup = performBackup();
    const stagedPath = `${dbPath}.restore-staged`;

    fs.copyFileSync(req.file.path, stagedPath);
    fs.unlinkSync(req.file.path);

    closeDb();
    try {
      fs.copyFileSync(stagedPath, dbPath);
      initDb(dbPath);
      fs.unlinkSync(stagedPath);
    } catch (restoreError) {
      try {
        fs.copyFileSync(rollbackBackup, dbPath);
        initDb(dbPath);
      } catch (_rollbackError) {}
      throw restoreError;
    }

    res.json({
      success: true,
      message: "تمت الاستعادة بنجاح مع إنشاء نسخة أمان قبل الاستبدال",
      data: { rollback_backup: rollbackBackup },
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(err);
  }
});

router.get("/settings", (_req, res, next) => {
  try {
    const settings = getDb().prepare("SELECT auto_backup_enabled, auto_backup_path FROM settings WHERE id = 1").get();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

router.put("/settings", (req, res, next) => {
  try {
    const autoBackupEnabled = req.body?.auto_backup_enabled ? 1 : 0;
    const autoBackupPath = String(req.body?.auto_backup_path || "").trim() || null;
    getDb()
      .prepare("UPDATE settings SET auto_backup_enabled = ?, auto_backup_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1")
      .run(autoBackupEnabled, autoBackupPath);

    const settings = getDb().prepare("SELECT auto_backup_enabled, auto_backup_path FROM settings WHERE id = 1").get();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
