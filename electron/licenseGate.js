// Main-process license gate.
//
// Owns the trust boundary: it computes the machine fingerprint, stores the
// signed license, and on every launch decides whether this PC is activated.
// The renderer only DISPLAYS what this module reports — it cannot fake a valid
// status because the crypto truth lives here, in the Node main process.
//
// Storage is file-based (not the DB) on purpose, so the gate works identically
// in dev and in the packaged app and never depends on DB init ordering. The
// stored blob is self-protecting: it is Ed25519-signed (cannot be edited) and
// bound to this machine's hardware id (cannot be copied to another PC).

const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const { tryGetHardwareId } = require("./hardwareId");
const { verifyToken, REASONS } = require("../shared/licensing/verifyLicense");
const { isConfigured } = require("../shared/licensing/publicKey");
const { formatMachineCode } = require("../shared/licensing/tokenCodec");

// How long a previously-valid install keeps working if the live fingerprint
// read transiently fails (e.g. AV momentarily blocks PowerShell/WMI).
const GRACE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const LICENSE_FILE = "license.dat";
const STATE_FILE = "license-state.json";

function licenseDir() {
  // appRoot set by main.js (UPLOADS_DIR), else Electron userData, else cwd.
  if (process.env.UPLOADS_DIR) return process.env.UPLOADS_DIR;
  try {
    const { app } = require("electron");
    if (app && app.getPath) return app.getPath("userData");
  } catch (_e) {
    /* not in electron (tests) */
  }
  return process.cwd();
}

function licenseFilePath() {
  return path.join(licenseDir(), LICENSE_FILE);
}
function stateFilePath() {
  return path.join(licenseDir(), STATE_FILE);
}

function readStoredLicense() {
  try {
    const raw = fs.readFileSync(licenseFilePath(), "utf8").trim();
    return raw || null;
  } catch (_e) {
    return null;
  }
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFilePath(), "utf8")) || {};
  } catch (_e) {
    return {};
  }
}

function writeState(state) {
  try {
    fs.mkdirSync(licenseDir(), { recursive: true });
    fs.writeFileSync(stateFilePath(), JSON.stringify(state), "utf8");
  } catch (_e) {
    /* non-fatal */
  }
}

// Record a successful launch: advance the monotonic clock marker and remember
// when we last had a fully valid license (used by the grace window).
function recordGoodLaunch(now) {
  const state = readState();
  const lastSeenTime = Math.max(Number(state.lastSeenTime) || 0, now);
  writeState({ ...state, lastSeenTime, lastGoodAt: new Date(now).toISOString() });
}

// Shape a verified payload into the small object the UI consumes.
function publicInfo(payload) {
  if (!payload) return {};
  return {
    issuedTo: payload.issuedTo || null,
    licenseId: payload.licenseId || null,
    expiresAt: payload.expiresAt || null,
    features: payload.features || "full",
  };
}

// The fingerprint + machine code + QR for the activation screen.
async function getActivationInfo() {
  const { hardwareId, error } = tryGetHardwareId();
  if (error) {
    return { configured: isConfigured(), hardwareId: null, machineCode: null, qrDataUrl: null, error };
  }
  let qrDataUrl = null;
  try {
    qrDataUrl = await QRCode.toDataURL(hardwareId, { margin: 1, width: 240 });
  } catch (_e) {
    /* QR is optional */
  }
  return {
    configured: isConfigured(),
    hardwareId,
    machineCode: formatMachineCode(hardwareId),
    qrDataUrl,
  };
}

// The authoritative activation check, run on demand by the renderer.
function getStatus() {
  const now = Date.now();

  if (!isConfigured()) {
    return { activated: false, reason: REASONS.NOT_CONFIGURED };
  }

  const stored = readStoredLicense();
  const { hardwareId, error } = tryGetHardwareId();
  const machineCode = hardwareId ? formatMachineCode(hardwareId) : null;

  // No license yet -> first-run hard lock.
  if (!stored) {
    return { activated: false, reason: "no_license", hardwareId, machineCode };
  }

  // Fingerprint read failed this launch -> ride the grace window if we were
  // previously activated, otherwise surface the unreadable-hardware state.
  if (error) {
    const state = readState();
    const lastGoodMs = Date.parse(state.lastGoodAt || "");
    if (Number.isFinite(lastGoodMs) && now - lastGoodMs < GRACE_MS) {
      const result = verifyToken(stored, { currentHardwareId: undefined, now });
      if (result.valid) {
        return { activated: true, grace: true, ...publicInfo(result.payload) };
      }
    }
    return { activated: false, reason: "hardware_unreadable", hardwareId: null, machineCode: null };
  }

  const state = readState();
  const result = verifyToken(stored, {
    currentHardwareId: hardwareId,
    now,
    lastSeenTime: Number(state.lastSeenTime) || null,
  });

  if (result.valid) {
    recordGoodLaunch(now);
    return { activated: true, ...publicInfo(result.payload) };
  }

  return {
    activated: false,
    reason: result.reason,
    hardwareId,
    machineCode,
    ...publicInfo(result.payload),
  };
}

// Ingest an activation the customer received from the seller. Accepts either a
// pasted blob or a path to a license.key file. Verifies against THIS machine
// before persisting.
function submitActivation({ blob, filePath } = {}) {
  let token = String(blob || "").trim();
  if (!token && filePath) {
    try {
      token = fs.readFileSync(filePath, "utf8").trim();
    } catch (_e) {
      return { ok: false, reason: "file_unreadable" };
    }
  }
  if (!token) return { ok: false, reason: "empty" };

  const { hardwareId, error } = tryGetHardwareId();
  if (error) return { ok: false, reason: "hardware_unreadable" };

  const result = verifyToken(token, { currentHardwareId: hardwareId, now: Date.now() });
  if (!result.valid) return { ok: false, reason: result.reason };

  try {
    fs.mkdirSync(licenseDir(), { recursive: true });
    fs.writeFileSync(licenseFilePath(), token, "utf8");
  } catch (_e) {
    return { ok: false, reason: "store_failed" };
  }
  recordGoodLaunch(Date.now());

  return { ok: true, status: getStatus() };
}

module.exports = {
  getStatus,
  getActivationInfo,
  submitActivation,
  GRACE_MS,
  // exported for tests
  licenseFilePath,
  stateFilePath,
};
