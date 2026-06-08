// Canonical encoding/decoding of offline license tokens.
//
// A license token is a small JSON payload describing WHO is licensed and on
// WHICH machine, plus an Ed25519 signature over a *canonical* (deterministic)
// serialization of that payload. Because the serialization is deterministic,
// the same payload always produces the same bytes to sign/verify regardless of
// JS object key order — so signatures stay stable.
//
// Shared by: the signer tools, the Electron main-process gate, and tests.
// Node-only (CommonJS). The renderer never imports this.

const TOKEN_PREFIX = "RTL1"; // version marker so we can evolve the format later
const PAYLOAD_VERSION = 1;

// Deterministic JSON: keys always emitted in this fixed order so the bytes we
// sign on the seller side exactly match the bytes we verify on the client side.
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
    // Normalize undefined -> null so the shape is always identical.
    ordered[key] = payload[key] === undefined ? null : payload[key];
  }
  return JSON.stringify(ordered);
}

// The exact bytes that get signed / verified.
function canonicalBytes(payload) {
  return Buffer.from(canonicalize(payload), "utf8");
}

// Build the wire envelope: prefix + base64url({ p: payload, s: signature }).
// Used for the pasteable blob and the contents of license.key.
function encodeToken(payload, signatureB64) {
  const envelope = { p: canonicalParts(payload), s: signatureB64 };
  const json = JSON.stringify(envelope);
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  return `${TOKEN_PREFIX}.${b64}`;
}

// Keep only the recognized fields, in canonical form, when packing an envelope.
function canonicalParts(payload) {
  const out = {};
  for (const key of FIELD_ORDER) {
    out[key] = payload[key] === undefined ? null : payload[key];
  }
  return out;
}

// Parse a blob (tolerant of surrounding whitespace / accidental newlines from
// copy-paste). Returns { payload, signatureB64 } or throws on malformed input.
function decodeToken(blob) {
  const raw = String(blob || "").trim().replace(/\s+/g, "");
  if (!raw) throw new Error("empty_token");

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
  return { payload: envelope.p, signatureB64: String(envelope.s) };
}

// Present a 32-char hardware id as human-friendly groups: 7F3A-9C21-...
function formatMachineCode(hardwareId) {
  const hex = String(hardwareId || "").toUpperCase().replace(/[^0-9A-F]/g, "");
  return (hex.match(/.{1,4}/g) || []).join("-");
}

module.exports = {
  TOKEN_PREFIX,
  PAYLOAD_VERSION,
  FIELD_ORDER,
  canonicalize,
  canonicalBytes,
  canonicalParts,
  encodeToken,
  decodeToken,
  formatMachineCode,
};
