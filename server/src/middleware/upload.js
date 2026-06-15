const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { firstWritableDir } = require("../config/paths");

function getUploadsDir() {
  // UPLOADS_DIR is set for packaged installs (per-user writable root). In dev it
  // is unset and we use the project-relative folder. firstWritableDir guarantees
  // we never crash on EPERM under a read-only install directory.
  const preferred = process.env.UPLOADS_DIR
    ? path.join(process.env.UPLOADS_DIR, "uploads")
    : path.join(__dirname, "../../../uploads");
  return firstWritableDir([preferred], "uploads");
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, getUploadsDir());
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const MAGIC_BYTES = {
  "image/jpeg": [0xff, 0xd8],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/gif": [0x47, 0x49, 0x46],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};

function isCorrupted(filePath, mimeType) {
  try {
    const magic = MAGIC_BYTES[mimeType];
    if (!magic) return false;
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(magic.length);
    fs.readSync(fd, buf, 0, magic.length, 0);
    fs.closeSync(fd);
    if (mimeType === "image/webp") {
      return buf.toString("ascii", 0, 4) !== "RIFF";
    }
    for (let i = 0; i < magic.length; i++) {
      if (buf[i] !== magic[i]) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function validateFileIntegrity(filePath, mimeType) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size === 0) return { valid: false, reason: "empty_file" };
    if (isCorrupted(filePath, mimeType)) return { valid: false, reason: "corrupted_headers" };
    return { valid: true };
  } catch {
    return { valid: false, reason: "read_error" };
  }
}

function fileFilter(_req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  cb(null, allowed.includes(file.mimetype));
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = { upload, getUploadsDir, validateFileIntegrity };
