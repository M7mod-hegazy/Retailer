const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function readOrCreateJwtSecret(secretFile, appRoot) {
  try {
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, "utf8").trim();
      if (existing) return existing;
    }

    const secret = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(appRoot, { recursive: true });
    fs.writeFileSync(secretFile, secret, { mode: 0o600 });
    return secret;
  } catch (_err) {
    // Secret file unreadable/unwritable: use an ephemeral random secret for
    // this launch (sessions won't survive a restart) rather than a known
    // constant an attacker could use to forge admin tokens offline.
    return crypto.randomBytes(32).toString("hex");
  }
}

/**
 * Ensures runtime env vars exist before the embedded Express server loads.
 * Packaged installs do not ship a .env file, so JWT_SECRET must be provided here.
 */
function ensurePackagedEnv() {
  const programDataRoot = process.env.ProgramData || app.getPath("appData");
  const appRoot = path.join(programDataRoot, "ElHegaziRetailer");

  // Point EVERY runtime-writable path at the per-user writable root. The install
  // dir (C:\Program Files\...) is read-only for normal Windows users, so writing
  // there fails with EPERM and the embedded server can't start. These must all be
  // set — not just DB_PATH — otherwise uploads/backups/logs silently fall back to
  // the (read-only) install directory.
  process.env.RETAILER_DATA_DIR = appRoot;
  if (!process.env.DB_PATH) process.env.DB_PATH = path.join(appRoot, "data", "retailer.db");
  process.env.UPLOADS_DIR = appRoot;                       // upload.js appends /uploads
  if (!process.env.BACKUP_DIR) process.env.BACKUP_DIR = path.join(appRoot, "backups");
  if (!process.env.LOG_DIR) process.env.LOG_DIR = path.join(appRoot, "logs");

  try {
    fs.mkdirSync(path.dirname(process.env.DB_PATH), { recursive: true });
  } catch (_e) {
    // Non-fatal: the server's writable-path resolver has a temp-dir safety net.
  }

  // ALWAYS use the per-install secret file in the packaged app — never honor a
  // pre-set JWT_SECRET env var, which anyone with local access could set to a
  // known value before launching the .exe and then forge admin tokens with.
  const secretFile = path.join(appRoot, "jwt.secret");
  process.env.JWT_SECRET = readOrCreateJwtSecret(secretFile, appRoot);
}

module.exports = { ensurePackagedEnv };
