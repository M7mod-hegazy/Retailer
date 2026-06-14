// Canonical encoding/decoding of offline license tokens.
//
// RTL2 (current): compact binary payload + Ed25519 signature — shorter for
// offline transfer. RTL1 (legacy): JSON envelope — still accepted on import.

const TOKEN_PREFIX = "RTL1";
const TOKEN_PREFIX_V2 = "RTL2";
const PAYLOAD_VERSION = 1;
const PAYLOAD_VERSION_V2 = 2;
const MAX_ISSUED_TO_BYTES = 32;

// RTL1 field order (legacy JSON canonicalization).
const FIELD_ORDER = [
  "v",
  "hardwareId",
  "issuedTo",
  "licenseId",
  "issuedAt",
  "expiresAt",
  "features",
];

function canonicalize(payload) {
  const ordered = {};
  for (const key of FIELD_ORDER) {
    ordered[key] = payload[key] === undefined ? null : payload[key];
  }
  return JSON.stringify(ordered);
}

function canonicalBytes(payload) {
  if (Number(payload?.v) === PAYLOAD_VERSION_V2) {
    return packCompactMessage(payload);
  }
  return Buffer.from(canonicalize(payload), "utf8");
}

function canonicalParts(payload) {
  const out = {};
  for (const key of FIELD_ORDER) {
    out[key] = payload[key] === undefined ? null : payload[key];
  }
  return out;
}

function parseLicenseNumber(licenseId) {
  const match = String(licenseId || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function formatLicenseId(num) {
  return `L-${String(num).padStart(6, "0")}`;
}

function parseExpiresAt(expiresAt) {
  if (!expiresAt) return 0;
  const raw = String(expiresAt).trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const date = new Date(dateOnly ? `${raw}T23:59:59.999Z` : raw);
  if (!Number.isFinite(date.getTime())) return 0;
  return Math.floor(date.getTime() / 1000);
}

function formatExpiresAt(unixSeconds) {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

function featuresToCode(features) {
  return String(features) === "trial" ? 1 : 0;
}

function codeToFeatures(code) {
  return code === 1 ? "trial" : "full";
}

function packCompactMessage(payload) {
  const hardwareId = String(payload.hardwareId || "").toLowerCase();
  const hw = Buffer.from(hardwareId, "hex");
  if (hw.length !== 16) throw new Error("invalid_hardwareId");

  const nameBuf = Buffer.from(String(payload.issuedTo || ""), "utf8").slice(0, MAX_ISSUED_TO_BYTES);
  const licenseNum = parseLicenseNumber(payload.licenseId);
  const issuedAt = Math.floor(Date.parse(payload.issuedAt) / 1000);
  const expiresAt = parseExpiresAt(payload.expiresAt);
  const features = featuresToCode(payload.features);

  const message = Buffer.alloc(31 + nameBuf.length);
  message.writeUInt8(PAYLOAD_VERSION_V2, 0);
  hw.copy(message, 1);
  message.writeUInt32BE(licenseNum, 17);
  message.writeUInt32BE(issuedAt, 21);
  message.writeUInt32BE(expiresAt, 25);
  message.writeUInt8(features, 29);
  message.writeUInt8(nameBuf.length, 30);
  nameBuf.copy(message, 31);
  return message;
}

function unpackCompactMessage(message) {
  if (message.length < 31) throw new Error("malformed_token");
  if (message.readUInt8(0) !== PAYLOAD_VERSION_V2) throw new Error("unknown_token_version");

  const hardwareId = message.subarray(1, 17).toString("hex");
  const licenseNum = message.readUInt32BE(17);
  const issuedAt = message.readUInt32BE(21);
  const expiresAt = message.readUInt32BE(25);
  const features = message.readUInt8(29);
  const nameLen = message.readUInt8(30);
  if (message.length < 31 + nameLen) throw new Error("malformed_token");

  const issuedTo = message.subarray(31, 31 + nameLen).toString("utf8") || null;
  return {
    v: PAYLOAD_VERSION_V2,
    hardwareId,
    issuedTo,
    licenseId: formatLicenseId(licenseNum),
    issuedAt: new Date(issuedAt * 1000).toISOString(),
    expiresAt: formatExpiresAt(expiresAt),
    features: codeToFeatures(features),
  };
}

// RTL1 legacy wire format.
function encodeToken(payload, signatureB64) {
  const envelope = { p: canonicalParts(payload), s: signatureB64 };
  const json = JSON.stringify(envelope);
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  return `${TOKEN_PREFIX}.${b64}`;
}

// RTL2 compact wire format: prefix + base64url(message || signature).
function encodeTokenV2(payload, signature) {
  const message = packCompactMessage(payload);
  const sig = Buffer.isBuffer(signature) ? signature : Buffer.from(signature);
  const wire = Buffer.concat([message, sig]);
  return `${TOKEN_PREFIX_V2}.${wire.toString("base64url")}`;
}

function normalizeTokenInput(blob) {
  const trimmed = String(blob || "").trim();
  if (!trimmed) throw new Error("empty_token");
  // Strip only whitespace (newlines, tabs, spaces).
  // Do NOT strip dashes: they are valid base64url characters (position 62).
  // Buffer.from(s, "base64url") already ignores whitespace characters.
  return trimmed.replace(/\s+/g, "");
}

function decodeToken(blob) {
  const raw = normalizeTokenInput(blob);

  if (raw.startsWith(`${TOKEN_PREFIX_V2}.`)) {
    return decodeTokenV2(raw);
  }

  let b64 = raw;
  if (raw.includes(".")) {
    const [prefix, rest] = raw.split(".");
    if (prefix !== TOKEN_PREFIX) throw new Error("unknown_token_version");
    b64 = rest;
  }

  let envelope;
  try {
    const json = Buffer.from(b64, "base64url").toString("utf8");
    envelope = JSON.parse(json);
  } catch (_e) {
    throw new Error("malformed_token");
  }

  if (!envelope || typeof envelope !== "object" || !envelope.p || !envelope.s) {
    throw new Error("malformed_token");
  }

  const payload = envelope.p;
  return {
    payload,
    signatureB64: String(envelope.s),
    signedBytes: canonicalBytes(payload),
  };
}

function decodeTokenV2(raw) {
  const b64 = raw.slice(TOKEN_PREFIX_V2.length + 1);
  let wire;
  try {
    wire = Buffer.from(b64, "base64url");
  } catch (_e) {
    throw new Error("malformed_token");
  }
  if (wire.length < 31 + 64) throw new Error("malformed_token");

  const message = wire.subarray(0, wire.length - 64);
  const signature = wire.subarray(wire.length - 64);
  const payload = unpackCompactMessage(message);

  return {
    payload,
    signatureB64: signature.toString("base64"),
    signedBytes: message,
  };
}

function formatMachineCode(hardwareId) {
  const hex = String(hardwareId || "").toUpperCase().replace(/[^0-9A-F]/g, "");
  return (hex.match(/.{1,4}/g) || []).join("-");
}

// Group the activation code for easier reading/copying.
// Spaces are safe: Buffer.from(s, "base64url") ignores whitespace characters,
// and normalizeTokenInput only strips whitespace (not valid base64url chars).
function formatActivationCode(blob) {
  const raw = String(blob || "").trim();
  if (!raw) return "";
  const dot = raw.indexOf(".");
  if (dot === -1) return raw;
  const prefix = raw.slice(0, dot + 1);
  const body = raw.slice(dot + 1);
  const groups = body.match(/.{1,5}/g) || [];
  return `${prefix}${groups.join(" ")}`;
}

module.exports = {
  TOKEN_PREFIX,
  TOKEN_PREFIX_V2,
  PAYLOAD_VERSION,
  PAYLOAD_VERSION_V2,
  FIELD_ORDER,
  canonicalize,
  canonicalBytes,
  canonicalParts,
  encodeToken,
  encodeTokenV2,
  decodeToken,
  formatMachineCode,
  formatActivationCode,
};
