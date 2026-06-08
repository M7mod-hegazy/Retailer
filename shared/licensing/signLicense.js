// Ed25519 license signing (seller side only).
//
// This module is the single crypto chokepoint used by BOTH the CLI and the GUI
// signer so there is no duplicated crypto. It never ships inside the customer
// app — it is only invoked from tools/license-signer/ on the seller's PC.

const crypto = require("crypto");
const {
  PAYLOAD_VERSION_V2,
  canonicalBytes,
  encodeTokenV2,
} = require("./tokenCodec");

// Generate a fresh Ed25519 keypair. The PRIVATE key is the seller's secret and
// must be stored outside the repo; the PUBLIC key gets embedded in the app.
// Returns PEM strings so they are easy to store/paste.
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

// Build + sign a license token.
//   fingerprint : the customer's 32-char hardware id (machine code)
//   issuedTo    : shop / customer name
//   licenseId   : your serial for this license (e.g. "L-000042")
//   privateKeyPem : the seller's Ed25519 private key (PEM)
//   expiresAt   : ISO date string or null  (null = perpetual)
//   features    : edition string (default "full"; "trial" for trials)
//   issuedAt    : ISO timestamp (defaults to now)
// Returns { blob, payload }.
function signLicense({
  fingerprint,
  issuedTo,
  licenseId,
  privateKeyPem,
  expiresAt = null,
  features = "full",
  issuedAt = new Date().toISOString(),
}) {
  const hardwareId = normalizeFingerprint(fingerprint);
  if (!hardwareId) throw new Error("invalid_fingerprint");
  if (!privateKeyPem) throw new Error("missing_private_key");

  const payload = {
    v: PAYLOAD_VERSION_V2,
    hardwareId,
    issuedTo: String(issuedTo || "").trim() || null,
    licenseId: String(licenseId || "").trim() || null,
    issuedAt,
    expiresAt: expiresAt ? String(expiresAt) : null,
    features: String(features || "full"),
  };

  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const message = canonicalBytes(payload);
  // Ed25519 requires the algorithm argument to be null.
  const signature = crypto.sign(null, message, privateKey);
  const blob = encodeTokenV2(payload, signature);

  return { blob, payload };
}

// Accept machine codes with dashes / spaces / mixed case and reduce to the raw
// lowercase hex the app actually computes.
function normalizeFingerprint(value) {
  return String(value || "").toLowerCase().replace(/[^0-9a-f]/g, "");
}

module.exports = { generateKeyPair, signLicense, normalizeFingerprint };
