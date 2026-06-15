#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const crypto = require("crypto");

const DIVIDER = "─".repeat(58);

const BANNER = `
  ${DIVIDER}
    ElHegazi Retailer — Offline License Activator
    Standalone tool. No internet. No dependencies.
  ${DIVIDER}
`;

// ─── vendored tokenCodec.js ──────────────────────────

const TOKEN_PREFIX_V2 = "RTL2";
const PAYLOAD_VERSION_V2 = 2;
const MAX_ISSUED_TO_BYTES = 32;

function parseLicenseNumber(licenseId) {
  const m = String(licenseId || "").match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function formatLicenseId(num) {
  return "L-" + String(num).padStart(6, "0");
}

function parseExpiresAt(expiresAt) {
  if (!expiresAt) return 0;
  const raw = String(expiresAt).trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const date = new Date(dateOnly ? raw + "T23:59:59.999Z" : raw);
  return isFinite(date) ? Math.floor(date.getTime() / 1000) : 0;
}

function formatExpiresAt(unixSeconds) {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

function packCompactMessage(payload) {
  const hw = Buffer.from(String(payload.hardwareId || "").toLowerCase(), "hex");
  if (hw.length !== 16) throw new Error("invalid_hardwareId");
  const nameBuf = Buffer.from(String(payload.issuedTo || ""), "utf8").slice(0, MAX_ISSUED_TO_BYTES);
  const licenseNum = parseLicenseNumber(payload.licenseId);
  const issuedAt = Math.floor(Date.parse(payload.issuedAt) / 1000);
  const expiresAt = parseExpiresAt(payload.expiresAt);
  const features = String(payload.features) === "trial" ? 1 : 0;
  const msg = Buffer.alloc(31 + nameBuf.length);
  msg.writeUInt8(PAYLOAD_VERSION_V2, 0);
  hw.copy(msg, 1);
  msg.writeUInt32BE(licenseNum, 17);
  msg.writeUInt32BE(issuedAt, 21);
  msg.writeUInt32BE(expiresAt, 25);
  msg.writeUInt8(features, 29);
  msg.writeUInt8(nameBuf.length, 30);
  nameBuf.copy(msg, 31);
  return msg;
}

function encodeTokenV2(payload, signature) {
  const msg = packCompactMessage(payload);
  const sig = Buffer.isBuffer(signature) ? signature : Buffer.from(signature);
  // Manual base64url (no native "base64url" flag) so this runs on Node 12,
  // which is the newest Node that supports Windows 7 32-bit.
  const b64 = Buffer.concat([msg, sig])
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return TOKEN_PREFIX_V2 + "." + b64;
}

function formatMachineCode(hardwareId) {
  const hex = String(hardwareId || "").toUpperCase().replace(/[^0-9A-F]/g, "");
  return (hex.match(/.{1,4}/g) || []).join("-");
}

function formatActivationCode(blob) {
  const raw = String(blob || "").trim();
  if (!raw) return "";
  const dot = raw.indexOf(".");
  if (dot === -1) return raw;
  const groups = raw.slice(dot + 1).match(/.{1,5}/g) || [];
  return raw.slice(0, dot + 1) + groups.join(" ");
}

// ─── vendored signLicense.js (partial) ────────────────

function normalizeFingerprint(v) {
  return String(v || "").toLowerCase().replace(/[^0-9a-f]/g, "");
}

// NOTE: A previous version tried to avoid "-" in the token body by nudging
// issuedAt, because old app builds stripped "-" from pasted codes. That loop
// is provably unsolvable for any hwid whose fixed bytes (version+hwid) produce
// a "+" in a base64 group — the hwid alone bakes in a permanent dash that no
// amount of issuedAt nudging can remove. Removed. Tokens may contain dashes;
// current app builds no longer strip them during activation code normalization.
function signLicense({
  fingerprint, issuedTo, licenseId, privateKeyPem,
  expiresAt = null, features = "full", issuedAt,
}) {
  const hardwareId = normalizeFingerprint(fingerprint);
  if (!hardwareId) throw new Error("invalid_fingerprint");
  if (!privateKeyPem) throw new Error("missing_private_key");

  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const sec = issuedAt ? Math.floor(Date.parse(issuedAt) / 1000) : Math.floor(Date.now() / 1000);
  const payload = {
    v: PAYLOAD_VERSION_V2,
    hardwareId,
    issuedTo: String(issuedTo || "").trim() || null,
    licenseId: String(licenseId || "").trim() || null,
    issuedAt: new Date(sec * 1000).toISOString(),
    expiresAt: expiresAt ? String(expiresAt) : null,
    features: String(features || "full"),
  };
  const message = packCompactMessage(payload);
  const signature = crypto.sign(null, message, privateKey);
  const blob = encodeTokenV2(payload, signature);
  return { blob, payload };
}

// ─── activator logic ─────────────────────────────────

function isStandaloneExe() {
  try {
    const sea = require("node:sea");
    if (sea && typeof sea.isSea === "function" && sea.isSea()) return true;
  } catch (_e) { /* not a SEA build */ }
  return typeof process.pkg !== "undefined";
}

// Folder the program should read keys from and write licenses to. For a
// standalone .exe on a USB stick this is the folder the .exe lives in (so it
// works no matter what the current working directory is when double-clicked).
function getBaseDir() {
  return isStandaloneExe() ? path.dirname(process.execPath) : __dirname;
}

function findPrivateKey() {
  // Try, in order: next to the .exe, the current working directory, the script
  // dir. Covers double-click-from-USB and run-from-a-shell alike.
  const candidates = [
    path.join(path.dirname(process.execPath), "license-private.pem"),
    path.join(process.cwd(), "license-private.pem"),
    path.join(__dirname, "license-private.pem"),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (_e) { /* skip */ }
  }
  return null;
}

function nextLicenseId() {
  const n = Date.now() % 1000000;
  return "L-" + String(n).padStart(6, "0");
}

// One shared readline interface for the whole session. Creating a fresh
// interface per question breaks when stdin is not a TTY (the first close()
// ends stdin), so we reuse a single one and close it once at the very end.
let _rl = null;
function getRl() {
  if (!_rl) _rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return _rl;
}
function ask(q) {
  return new Promise((r) => getRl().question(q, (a) => r(a)));
}
function closeRl() {
  if (_rl) { _rl.close(); _rl = null; }
}

async function interactive(privateKeyPem) {
  console.log(BANNER);

  const raw = await ask("  Machine code (from retailer app): ");
  const fp = normalizeFingerprint(raw);
  if (!fp || fp.length < 32) {
    console.log("\n  Invalid machine code. Must be 32 hex characters.\n");
    return false;
  }

  const name = (await ask("  Customer / shop name: ")).trim();
  if (!name) {
    console.log("\n  Name is required.\n");
    return false;
  }

  const type = (await ask("  License type (perpetual/subscription) [perpetual]: ")).trim().toLowerCase();
  let expiresAt = null;
  if (type.startsWith("s")) {
    expiresAt = (await ask("  Expiry date (YYYY-MM-DD): ")).trim();
    if (!expiresAt) {
      console.log("\n  Expiry date required for subscription.\n");
      return false;
    }
  }

  const features = (await ask("  Features (full/trial) [full]: ")).trim().toLowerCase() || "full";

  console.log("\n  Signing...\n");

  try {
    const { blob, payload } = signLicense({
      fingerprint: fp,
      issuedTo: name,
      licenseId: nextLicenseId(),
      privateKeyPem,
      expiresAt,
      features,
    });

    const code = formatActivationCode(blob);

    console.log("  " + DIVIDER);
    console.log("  ACTIVATION CODE — copy this:");
    console.log("  " + DIVIDER);
    const groups = code.match(/.{1,80}/g) || [code];
    for (const g of groups) console.log("  " + g);
    console.log("  " + DIVIDER);
    console.log("");

    const outDir = path.join(getBaseDir(), "licenses");
    fs.mkdirSync(outDir, { recursive: true });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "license";
    const keyPath = path.join(outDir, slug + "-license.key");
    fs.writeFileSync(keyPath, blob, "utf8");

    console.log("  License ID : " + payload.licenseId);
    console.log("  Issued to  : " + payload.issuedTo);
    console.log("  Machine    : " + formatMachineCode(fp));
    if (payload.expiresAt) console.log("  Expires    : " + payload.expiresAt);
    console.log("  Saved      : " + keyPath);
    console.log("");

    return true;
  } catch (e) {
    console.log("\n  Error: " + e.message + "\n");
    return false;
  }
}

async function main() {
  const kp = findPrivateKey();
  if (!kp) {
    console.error("\n  Private key not found.");
    console.error("  Place license-private.pem next to this program.\n");
    process.exit(1);
  }
  const privateKeyPem = fs.readFileSync(kp, "utf8").trim();

  if (process.argv.length > 2) {
    const fp = normalizeFingerprint(process.argv[2]);
    const name = process.argv[3] || "";
    if (!fp || fp.length < 32 || !name) {
      console.error("\n  Usage: activator.exe <machine-code> <customer-name>\n");
      process.exit(1);
    }
    const { blob } = signLicense({ fingerprint: fp, issuedTo: name, licenseId: nextLicenseId(), privateKeyPem });
    console.log(formatActivationCode(blob));
    const outDir = path.join(getBaseDir(), "licenses");
    fs.mkdirSync(outDir, { recursive: true });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "license";
    fs.writeFileSync(path.join(outDir, slug + "-license.key"), blob, "utf8");
    return;
  }

  while (await interactive(privateKeyPem)) {
    const a = await ask("  Sign another? (y/n): ");
    if (a.trim().toLowerCase() !== "y") break;
  }

  await ask("\n  Press Enter to exit.");
  closeRl();
}

main().catch((e) => { closeRl(); console.error(e); process.exit(1); });
