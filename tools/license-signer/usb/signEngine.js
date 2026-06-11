// Shared signing engine — the single chokepoint used by BOTH the CLI
// (sign-license.js) and the GUI (signer-gui). Never ships to customers.
//
// Responsibilities:
//   - locate the seller's PRIVATE key (kept OUTSIDE the repo)
//   - sign a license token for a given machine code (via shared/licensing)
//   - allocate a sequential licenseId
//   - write license.key + a QR image
//   - append a record to the local issued-licenses registry

const fs = require("fs");
const os = require("os");
const path = require("path");

// QR is optional — only needed if qrcode package is installed.
let QRCode = null;
try { QRCode = require("qrcode"); } catch (_e) { /* QR silent fallback */ }

const { signLicense, generateKeyPair, normalizeFingerprint } = require("./shared/signLicense");
const { formatActivationCode } = require("./shared/tokenCodec");

// Portable data directory resolution (priority order):
//   1. LS_DATA_DIR  — set by the USB launcher batch file (server mode)
//   2. PORTABLE_EXECUTABLE_DIR — set by electron-builder portable exe
//   3. RETAILER_KEYS_DIR + LICENSE_SIGNER_DATA_DIR — manual env vars
//   4. %USERPROFILE%\.retailer-keys — fallback (original behavior)
const PORTABLE_BASE = (() => {
  if (process.env.LS_DATA_DIR) return path.resolve(process.env.LS_DATA_DIR);
  const dir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (dir) return path.resolve(dir, "_license-data");
  return null;
})();

const KEYS_DIR = PORTABLE_BASE || process.env.RETAILER_KEYS_DIR || path.join(os.homedir(), ".retailer-keys");
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, "license-private.pem");
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, "license-public.pem");

// Writable data directory.
// NOT __dirname — that's inside read-only app.asar when packaged as .exe.
const DATA_DIR = PORTABLE_BASE || process.env.LICENSE_SIGNER_DATA_DIR || path.join(os.homedir(), ".elhegazi-license-signer");
const REGISTRY_PATH = path.join(DATA_DIR, "registry.json");
const OUT_DIR = path.join(DATA_DIR, "out");

// The local vendored public key module, which keygen overwrites.
// Only writable in development (unpacked). Inside app.asar it's read-only.
const APP_PUBLIC_KEY_MODULE = path.join(__dirname, "shared", "publicKey.js");

function keysExist() {
  return fs.existsSync(PRIVATE_KEY_PATH);
}

function loadPrivateKey() {
  if (!keysExist()) {
    throw new Error(
      `Private key not found at ${PRIVATE_KEY_PATH}. Run "node tools/license-signer/keygen.js" first.`,
    );
  }
  return fs.readFileSync(PRIVATE_KEY_PATH, "utf8");
}

function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8")) || [];
  } catch (_e) {
    return [];
  }
}

function writeRegistry(list) {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(list, null, 2), "utf8");
}

function nextLicenseId(registry) {
  const n = registry.length + 1;
  return `L-${String(n).padStart(6, "0")}`;
}

function slugify(name) {
  return (
    String(name || "customer")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9؀-ۿ]+/g, "-")
      .replace(/^-+|-+$/g, "") || "customer"
  );
}

// Create + persist the keypair. Overwrites the app's embedded public key.
function runKeygen({ force = false } = {}) {
  if (keysExist() && !force) {
    throw new Error(
      `Keys already exist at ${PRIVATE_KEY_PATH}. Pass force:true to overwrite (this INVALIDATES every license you've issued).`,
    );
  }
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  const { publicKeyPem, privateKeyPem } = generateKeyPair();
  fs.writeFileSync(PRIVATE_KEY_PATH, privateKeyPem, { encoding: "utf8", mode: 0o600 });
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKeyPem, "utf8");
  embedPublicKey(publicKeyPem);
  return { publicKeyPem, privateKeyPath: PRIVATE_KEY_PATH, publicKeyPath: PUBLIC_KEY_PATH };
}

// Rewrite the PUBLIC_KEY_PEM constant inside shared/licensing/publicKey.js so
// the app ships with the matching verifier key.
// Silently skipped inside app.asar (standalone signer doesn't need this).
function embedPublicKey(publicKeyPem) {
  try {
    fs.accessSync(APP_PUBLIC_KEY_MODULE, fs.constants.W_OK);
  } catch (_e) {
    return;
  }
  const source = fs.readFileSync(APP_PUBLIC_KEY_MODULE, "utf8");
  const literal = "`" + publicKeyPem.trim() + "\n`";
  const replaced = source.replace(
    /const PUBLIC_KEY_PEM = `[\s\S]*?`;/,
    `const PUBLIC_KEY_PEM = ${literal};`,
  );
  fs.writeFileSync(APP_PUBLIC_KEY_MODULE, replaced, "utf8");
}

// Sign a license and write all artifacts. Returns a summary object.
async function generate({ fingerprint, name, expiresAt = null, features = "full", licenseId }) {
  const hardwareId = normalizeFingerprint(fingerprint);
  if (!hardwareId || hardwareId.length < 16) throw new Error("invalid_fingerprint");

  const privateKeyPem = loadPrivateKey();
  const registry = readRegistry();
  const id = licenseId || nextLicenseId(registry);

  const { blob, payload } = signLicense({
    fingerprint: hardwareId,
    issuedTo: name,
    licenseId: id,
    privateKeyPem,
    expiresAt,
    features,
  });

  const dir = path.join(OUT_DIR, slugify(name));
  fs.mkdirSync(dir, { recursive: true });
  const keyPath = path.join(dir, "license.key");
  const qrPath = path.join(dir, "license.png");
  fs.writeFileSync(keyPath, blob, "utf8");
  if (QRCode) {
    try {
      await QRCode.toFile(qrPath, blob, { margin: 1, width: 320 });
    } catch (_e) { /* skip */ }
  }

  registry.push({
    licenseId: id,
    issuedTo: payload.issuedTo,
    hardwareId,
    features,
    expiresAt,
    issuedAt: payload.issuedAt,
    blob,
  });
  writeRegistry(registry);

  return {
    blob,
    activationCode: formatActivationCode(blob),
    licenseId: id,
    keyPath,
    qrPath,
    payload,
  };
}

module.exports = {
  KEYS_DIR,
  PRIVATE_KEY_PATH,
  PUBLIC_KEY_PATH,
  DATA_DIR,
  REGISTRY_PATH,
  OUT_DIR,
  keysExist,
  runKeygen,
  generate,
  readRegistry,
};
