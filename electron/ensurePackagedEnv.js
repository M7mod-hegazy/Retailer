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
    return "super_secret_jwt_key_12345";
  }
}

/**
 * Ensures runtime env vars exist before the embedded Express server loads.
 * Packaged installs do not ship a .env file, so JWT_SECRET must be provided here.
 */
function ensurePackagedEnv() {
  const programDataRoot = process.env.ProgramData || app.getPath("appData");
  const appRoot = path.join(programDataRoot, "ElHegaziRetailer");

  if (!process.env.DB_PATH) {
    process.env.DB_PATH = path.join(appRoot, "data", "retailer.db");
    process.env.UPLOADS_DIR = appRoot;
  }

  fs.mkdirSync(path.dirname(process.env.DB_PATH), { recursive: true });

  if (!process.env.JWT_SECRET || !String(process.env.JWT_SECRET).trim()) {
    const secretFile = path.join(appRoot, "jwt.secret");
    process.env.JWT_SECRET = readOrCreateJwtSecret(secretFile, appRoot);
  }
}

module.exports = { ensurePackagedEnv };
