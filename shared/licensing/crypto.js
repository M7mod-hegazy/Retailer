const crypto = require("crypto");

function normalizePem(raw) {
  return String(raw || "").replace(/\\n/g, "\n").trim();
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function signPayload(payload, privateKeyPem) {
  const normalizedKey = normalizePem(privateKeyPem);
  if (!normalizedKey) {
    throw new Error("Private key is required for payload signing");
  }
  const payloadString = stableStringify(payload);
  const signature = crypto.sign(null, Buffer.from(payloadString, "utf8"), normalizedKey).toString("base64");
  return {
    payload,
    signature,
  };
}

function verifySignedPayload(signedPayload, publicKeyPem) {
  if (!signedPayload || typeof signedPayload !== "object") return false;
  const normalizedKey = normalizePem(publicKeyPem);
  if (!normalizedKey) return false;
  if (!signedPayload.signature || !signedPayload.payload) return false;

  const payloadString = stableStringify(signedPayload.payload);
  return crypto.verify(
    null,
    Buffer.from(payloadString, "utf8"),
    normalizedKey,
    Buffer.from(String(signedPayload.signature), "base64"),
  );
}

function maskIdentifier(value) {
  const raw = String(value || "");
  if (raw.length <= 8) return `${raw.slice(0, 2)}****`;
  return `${raw.slice(0, 4)}****${raw.slice(-4)}`;
}

module.exports = {
  maskIdentifier,
  normalizePem,
  signPayload,
  stableStringify,
  verifySignedPayload,
};
