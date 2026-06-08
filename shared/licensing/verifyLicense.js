// Pure, offline license verification — no I/O, no side effects.
//
// Given a license blob, the embedded public key, the machine's current
// hardware id, and the current time, decide whether this app is allowed to run
// on this PC. Shared by the Electron gate and the test-suite so behavior is
// identical everywhere.

const crypto = require("crypto");
const { decodeToken, canonicalBytes } = require("./tokenCodec");
const { getPublicKeyPem } = require("./publicKey");

// Tolerate small backwards clock jitter (NTP corrections, DST) before treating
// a backwards clock as deliberate rollback.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const REASONS = {
  OK: "ok",
  NOT_CONFIGURED: "not_configured",
  MALFORMED: "malformed_token",
  BAD_SIGNATURE: "bad_signature",
  WRONG_MACHINE: "wrong_machine",
  EXPIRED: "expired",
  CLOCK_ROLLBACK: "clock_rollback",
  INVALID_PAYLOAD: "invalid_payload",
};

// verifyToken(blob, { publicKeyPem, currentHardwareId, now, lastSeenTime })
//   blob              : the license token string
//   publicKeyPem      : PEM public key (defaults to the embedded one)
//   currentHardwareId : this machine's fingerprint (32-char hex)
//   now               : ms epoch (defaults to Date.now())
//   lastSeenTime      : ms epoch of last successful launch, for rollback guard
// Returns { valid, reason, payload|null }.
function verifyToken(blob, options = {}) {
  const {
    publicKeyPem = getPublicKeyPem(),
    currentHardwareId,
    now = Date.now(),
    lastSeenTime = null,
  } = options;

  if (!publicKeyPem || !String(publicKeyPem).trim()) {
    return fail(REASONS.NOT_CONFIGURED);
  }

  let payload;
  let signatureB64;
  try {
    ({ payload, signatureB64 } = decodeToken(blob));
  } catch (_e) {
    return fail(REASONS.MALFORMED);
  }

  if (!payload || !payload.hardwareId) return fail(REASONS.INVALID_PAYLOAD);

  // 1) Signature must be valid — proves the token came from the seller.
  let signatureOk = false;
  try {
    const publicKey = crypto.createPublicKey(publicKeyPem);
    signatureOk = crypto.verify(
      null,
      canonicalBytes(payload),
      publicKey,
      Buffer.from(signatureB64, "base64"),
    );
  } catch (_e) {
    signatureOk = false;
  }
  if (!signatureOk) return fail(REASONS.BAD_SIGNATURE, payload);

  // 2) Must be bound to THIS machine.
  if (
    currentHardwareId &&
    String(payload.hardwareId).toLowerCase() !==
      String(currentHardwareId).toLowerCase()
  ) {
    return fail(REASONS.WRONG_MACHINE, payload);
  }

  // 3) Clock-rollback guard (mainly relevant for subscriptions).
  if (lastSeenTime && now < lastSeenTime - CLOCK_SKEW_MS) {
    return fail(REASONS.CLOCK_ROLLBACK, payload);
  }

  // 4) Expiry (perpetual licenses have expiresAt = null).
  if (payload.expiresAt) {
    const expiresMs = Date.parse(payload.expiresAt);
    if (Number.isFinite(expiresMs) && now > expiresMs) {
      return fail(REASONS.EXPIRED, payload);
    }
  }

  return { valid: true, reason: REASONS.OK, payload };
}

function fail(reason, payload = null) {
  return { valid: false, reason, payload };
}

module.exports = { verifyToken, REASONS, CLOCK_SKEW_MS };
