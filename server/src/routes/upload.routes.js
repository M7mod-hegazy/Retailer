const express = require("express");
const path = require("path");
const fs = require("fs");
const { upload, getUploadsDir } = require("../middleware/upload");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);

// POST /api/upload  — multipart/form-data, field name: "file"
// Returns { success: true, url: "/uploads/<filename>" }
router.post("/", requirePagePermission("items", "add"), upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "لم يُرفق ملف أو نوعه غير مدعوم (JPEG/PNG/WebP/GIF فقط)." });
  }
  return res.json({ success: true, url: `/uploads/${req.file.filename}` });
});

// DELETE /api/upload  — body: { filename }
// Deletes a previously uploaded file
router.delete("/", requirePagePermission("items", "delete"), (req, res) => {
  const { filename } = req.body || {};
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return res.status(400).json({ success: false, message: "اسم الملف غير صالح." });
  }
  const filePath = path.join(getUploadsDir(), filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  return res.json({ success: true });
});

module.exports = router;
