const fs = require("fs");
const os = require("os");
const path = require("path");

// ── Writable data paths ─────────────────────────────────────────────────────
// A desktop app must NEVER write inside its own install folder. The default
// install location (e.g. C:\Program Files (x86)\ElHegazi\...) is read-only for
// normal Windows users, so any mkdir/write there fails with EPERM and takes the
// whole embedded server down ("can't connect to local server"). Every runtime
// write (uploads, backups, logs, temp) is resolved through here, with a
// guaranteed-writable temp-dir fallback so a permission error can never crash
// the server.

/**
 * Returns the first candidate directory that can actually be created AND written
 * to. Falls back to a per-user temp directory that is writable on every Windows
 * account. Never throws.
 *
 * @param {Array<string|undefined>} candidates  preferred dirs, in priority order
 * @param {string} label                        used to name the temp fallback dir
 */
function firstWritableDir(candidates, label = "data") {
  for (const dir of candidates) {
    if (!dir) continue;
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch (_e) {
      // not writable (e.g. under Program Files) — try the next candidate
    }
  }
  const fallback = path.join(os.tmpdir(), `ElHegaziRetailer-${label}`);
  try { fs.mkdirSync(fallback, { recursive: true }); } catch (_e) {}
  return fallback;
}

/** Convenience: resolve a single preferred dir with the temp-dir safety net. */
function ensureWritableDir(preferred, label) {
  return firstWritableDir([preferred], label);
}

module.exports = { firstWritableDir, ensureWritableDir };
