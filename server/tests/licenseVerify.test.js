// Offline license verification tests. Uses a throwaway Ed25519 keypair (never
// touches the embedded production key) and exercises every accept/reject path.

const crypto = require("crypto");
const { signLicense, generateKeyPair } = require("../../shared/licensing/signLicense");
const { verifyToken, REASONS } = require("../../shared/licensing/verifyLicense");
const {
  canonicalize,
  decodeToken,
  encodeToken,
  encodeTokenV2,
  formatActivationCode,
} = require("../../shared/licensing/tokenCodec");

const HW = "a".repeat(32); // this machine's fingerprint
const OTHER_HW = "b".repeat(32);

let keys;
beforeAll(() => {
  keys = generateKeyPair();
});

function sign(overrides = {}) {
  return signLicense({
    fingerprint: overrides.fingerprint || HW,
    issuedTo: "Test Shop",
    licenseId: "L-000001",
    privateKeyPem: keys.privateKeyPem,
    expiresAt: overrides.expiresAt ?? null,
    features: overrides.features || "full",
    issuedAt: overrides.issuedAt,
  }).blob;
}

const opts = (extra = {}) => ({
  publicKeyPem: keys.publicKeyPem,
  currentHardwareId: HW,
  now: Date.now(),
  ...extra,
});

describe("verifyToken", () => {
  test("accepts a valid perpetual license on the right machine", () => {
    const res = verifyToken(sign(), opts());
    expect(res.valid).toBe(true);
    expect(res.reason).toBe(REASONS.OK);
    expect(res.payload.issuedTo).toBe("Test Shop");
  });

  test("rejects a license bound to a different machine", () => {
    const res = verifyToken(sign({ fingerprint: OTHER_HW }), opts());
    expect(res.valid).toBe(false);
    expect(res.reason).toBe(REASONS.WRONG_MACHINE);
  });

  test("rejects a tampered payload (signature no longer matches)", () => {
    const { payload, signatureB64 } = decodeToken(sign());
    payload.features = "enterprise"; // tamper
    const forged = encodeTokenV2(payload, Buffer.from(signatureB64, "base64"));
    const res = verifyToken(forged, opts());
    expect(res.valid).toBe(false);
    expect(res.reason).toBe(REASONS.BAD_SIGNATURE);
  });

  test("new licenses use the shorter RTL2 format", () => {
    const blob = sign();
    expect(blob.startsWith("RTL2.")).toBe(true);
    expect(blob.length).toBeLessThan(220);
  });

  test("accepts legacy RTL1 licenses", () => {
    const payload = {
      v: 1,
      hardwareId: HW,
      issuedTo: "Legacy Shop",
      licenseId: "L-000099",
      issuedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: null,
      features: "full",
    };
    const privateKey = crypto.createPrivateKey(keys.privateKeyPem);
    const signature = crypto.sign(null, Buffer.from(canonicalize(payload), "utf8"), privateKey);
    const rtl1 = encodeToken(payload, signature.toString("base64"));
    const res = verifyToken(rtl1, opts());
    expect(res.valid).toBe(true);
  });

  test("accepts activation codes with optional dash grouping", () => {
    const blob = formatActivationCode(sign());
    const res = verifyToken(blob, opts());
    expect(res.valid).toBe(true);
  });

  test("rejects a license signed by a different (attacker) key", () => {
    const attacker = generateKeyPair();
    const blob = signLicense({
      fingerprint: HW,
      issuedTo: "Pirate",
      licenseId: "X",
      privateKeyPem: attacker.privateKeyPem,
    }).blob;
    const res = verifyToken(blob, opts());
    expect(res.valid).toBe(false);
    expect(res.reason).toBe(REASONS.BAD_SIGNATURE);
  });

  test("rejects an expired subscription", () => {
    const blob = sign({ expiresAt: "2020-01-01T00:00:00.000Z" });
    const res = verifyToken(blob, opts());
    expect(res.valid).toBe(false);
    expect(res.reason).toBe(REASONS.EXPIRED);
  });

  test("accepts a subscription that has not yet expired", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const res = verifyToken(sign({ expiresAt: future }), opts());
    expect(res.valid).toBe(true);
  });

  test("rejects when the clock is rolled back before last seen", () => {
    const lastSeenTime = Date.now();
    const res = verifyToken(
      sign(),
      opts({ lastSeenTime, now: lastSeenTime - 24 * 60 * 60 * 1000 }),
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe(REASONS.CLOCK_ROLLBACK);
  });

  test("tolerates small backwards clock jitter within skew", () => {
    const lastSeenTime = Date.now();
    const res = verifyToken(sign(), opts({ lastSeenTime, now: lastSeenTime - 60 * 1000 }));
    expect(res.valid).toBe(true);
  });

  test("rejects a malformed token", () => {
    const res = verifyToken("not-a-real-token", opts());
    expect(res.valid).toBe(false);
    expect(res.reason).toBe(REASONS.MALFORMED);
  });

  test("reports not_configured when no public key is available", () => {
    const res = verifyToken(sign(), { ...opts(), publicKeyPem: "" });
    expect(res.valid).toBe(false);
    expect(res.reason).toBe(REASONS.NOT_CONFIGURED);
  });

  test("trial expiry is enforced like any other expiry", () => {
    const blob = sign({ features: "trial", expiresAt: "2020-01-01T00:00:00.000Z" });
    const res = verifyToken(blob, opts());
    expect(res.valid).toBe(false);
    expect(res.reason).toBe(REASONS.EXPIRED);
  });

  test("machine code formatting is case-insensitive on match", () => {
    const res = verifyToken(sign(), opts({ currentHardwareId: HW.toUpperCase() }));
    expect(res.valid).toBe(true);
  });
});
