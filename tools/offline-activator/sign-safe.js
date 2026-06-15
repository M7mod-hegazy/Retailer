#!/usr/bin/env node
// Dash-safe license signer.
//
// Some older installed app builds strip "-" from pasted activation codes
// (they treated "-" as a grouping separator). But "-" and "_" are valid
// base64url characters that appear inside real tokens, so stripping them
// corrupts the signature -> the app reports the license as invalid.
//
// This signer brute-forces the (otherwise cosmetic) issuedAt timestamp until
// the encoded token body contains NO "-" and NO "_". The result verifies on
// BOTH old (dash-stripping) and new app builds. Pure Node, no dependencies.
//
//   node sign-safe.js <machine-code> "<customer name>" [YYYY-MM-DD expiry]

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const TOKEN_PREFIX_V2 = "RTL2";
const PAYLOAD_VERSION_V2 = 2;
const MAX_ISSUED_TO_BYTES = 32;

function normalizeFingerprint(v) {
  return String(v || "").toLowerCase().replace(/[^0-9a-f]/g, "");
}
function parseLicenseNumber(id) {
  const m = String(id || "").match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}
function parseExpiresAt(expiresAt) {
  if (!expiresAt) return 0;
  const raw = String(expiresAt).trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const date = new Date(dateOnly ? raw + "T23:59:59.999Z" : raw);
  return isFinite(date) ? Math.floor(date.getTime() / 1000) : 0;
}
function packCompactMessage(p) {
  const hw = Buffer.from(String(p.hardwareId || "").toLowerCase(), "hex");
  if (hw.length !== 16) throw new Error("invalid_hardwareId");
  const nameBuf = Buffer.from(String(p.issuedTo || ""), "utf8").slice(0, MAX_ISSUED_TO_BYTES);
  const msg = Buffer.alloc(31 + nameBuf.length);
  msg.writeUInt8(PAYLOAD_VERSION_V2, 0);
  hw.copy(msg, 1);
  msg.writeUInt32BE(parseLicenseNumber(p.licenseId), 17);
  msg.writeUInt32BE(Math.floor(Date.parse(p.issuedAt) / 1000), 21);
  msg.writeUInt32BE(parseExpiresAt(p.expiresAt), 25);
  msg.writeUInt8(String(p.features) === "trial" ? 1 : 0, 29);
  msg.writeUInt8(nameBuf.length, 30);
  nameBuf.copy(msg, 31);
  return msg;
}
function encode(msg, sig) {
  return TOKEN_PREFIX_V2 + "." + Buffer.concat([msg, sig]).toString("base64url");
}
function isDashSafe(blob) {
  // Old app builds strip only "-" (their pattern was /[\s-]+/) — "_" is left
  // intact — so we only need the body to be free of "-".
  return !blob.slice(blob.indexOf(".") + 1).includes("-");
}

function signSafe({ fingerprint, issuedTo, licenseId, privateKeyPem, expiresAt = null, features = "full" }) {
  const hardwareId = normalizeFingerprint(fingerprint);
  if (hardwareId.length !== 32) throw new Error("invalid_fingerprint (need 32 hex chars)");
  const key = crypto.createPrivateKey(privateKeyPem);
  const baseSec = Math.floor(Date.now() / 1000);
  // Walk issuedAt backwards a second at a time; each value yields a different
  // signature, ~1.6% of which encode with no "-"/"_". Always finds one fast.
  for (let i = 0; i < 500000; i++) {
    const issuedAt = new Date((baseSec - i) * 1000).toISOString();
    const payload = { hardwareId, issuedTo: issuedTo || null, licenseId, issuedAt, expiresAt, features };
    const msg = packCompactMessage(payload);
    const sig = crypto.sign(null, msg, key);
    const blob = encode(msg, sig);
    if (isDashSafe(blob)) return { blob, payload, attempts: i + 1 };
  }
  throw new Error("could not find dash-safe token");
}

function findPrivateKey() {
  const base = typeof process.pkg !== "undefined" ? path.dirname(process.execPath) : __dirname;
  for (const p of [path.join(base, "license-private.pem"), path.join(__dirname, "license-private.pem")]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function ask(q) {
  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a); }));
}

async function main() {
  let [, , mcArg, nameArg, expiryArg] = process.argv;

  const kp = findPrivateKey();
  if (!kp) {
    console.error("\n  license-private.pem not found next to this script.\n");
    await ask("  Press Enter to exit.");
    process.exit(1);
  }
  const privateKeyPem = fs.readFileSync(kp, "utf8").trim();

  // No CLI args (double-clicked) -> ask interactively.
  if (!mcArg || !nameArg) {
    console.log("\n  ElHegazi - Dash-Safe License Signer");
    console.log("  -----------------------------------\n");
    mcArg = await ask("  Machine code (from retailer app): ");
    nameArg = await ask("  Customer / shop name: ");
    const exp = await ask("  Expiry YYYY-MM-DD (blank = perpetual): ");
    expiryArg = exp.trim() || null;
  }

  const { blob, payload, attempts } = signSafe({
    fingerprint: mcArg,
    issuedTo: nameArg,
    licenseId: "L-" + String(Date.now() % 1000000).padStart(6, "0"),
    privateKeyPem,
    expiresAt: expiryArg || null,
  });

  const outDir = path.join(path.dirname(kp), "licenses");
  fs.mkdirSync(outDir, { recursive: true });
  const slug = nameArg.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "license";
  const keyPath = path.join(outDir, slug + "-license.key");
  fs.writeFileSync(keyPath, blob, "utf8");

  console.log("\n  DASH-SAFE ACTIVATION CODE (works on old + new app):\n");
  console.log("  " + blob + "\n");
  console.log("  License ID : " + payload.licenseId);
  console.log("  Issued to  : " + payload.issuedTo);
  console.log("  Machine    : " + mcArg);
  console.log("  Saved      : " + keyPath);
  console.log("  (found after " + attempts + " attempts)\n");

  if (process.argv.length <= 2) await ask("  Press Enter to exit.");
}

main().catch((e) => { console.error("\n  Error: " + e.message + "\n"); process.exit(1); });
