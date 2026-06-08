const fs = require("fs");
const path = require("path");
const os = require("os");

let logDir = null;
let logFile = null;

function resolveLogDir() {
  if (logDir) return logDir;
  // Prefer ProgramData so the file is in a known, support-friendly location.
  const root = process.env.ProgramData || os.tmpdir();
  logDir = path.join(root, "ElHegaziRetailer", "logs");
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (_e) {
    // Fall back to temp if ProgramData is not writable.
    logDir = path.join(os.tmpdir(), "ElHegaziRetailer-logs");
    try { fs.mkdirSync(logDir, { recursive: true }); } catch (_e2) {}
  }
  return logDir;
}

function currentLogFile() {
  const dir = resolveLogDir();
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  logFile = path.join(dir, `app-${day}.log`);
  return logFile;
}

/**
 * Append an error (or any diagnostic line) to today's log file.
 * Never throws — logging must not crash the app.
 */
function logError(context, err) {
  try {
    const file = currentLogFile();
    const stamp = new Date().toISOString();
    const detail =
      err && err.stack
        ? err.stack
        : err && err.message
          ? err.message
          : typeof err === "object"
            ? JSON.stringify(err)
            : String(err);
    const line = `\n[${stamp}] ${context}\n${detail}\n${"-".repeat(60)}\n`;
    fs.appendFileSync(file, line, "utf8");
  } catch (_e) {
    // swallow — never let logging break the app
  }
}

function getLogPath() {
  return currentLogFile();
}

module.exports = { logError, getLogPath, resolveLogDir };
