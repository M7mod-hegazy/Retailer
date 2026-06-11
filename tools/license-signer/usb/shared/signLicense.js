const crypto = require("crypto");
const {
  PAYLOAD_VERSION_V2,
  canonicalBytes,
  encodeTokenV2,
} = require("./tokenCodec");

function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

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
  const signature = crypto.sign(null, message, privateKey);
  const blob = encodeTokenV2(payload, signature);

  return { blob, payload };
}

function normalizeFingerprint(value) {
  return String(value || "").toLowerCase().replace(/[^0-9a-f]/g, "");
}

module.exports = { generateKeyPair, signLicense, normalizeFingerprint };
