// Fix #1: the RETAILER_LICENSE_PUBKEY env override must work in dev/tests but be
// IGNORED in the packaged app, so an attacker cannot swap the trust root with an
// environment variable.

jest.mock("../../shared/licensing/runtime", () => ({ isPackagedApp: jest.fn() }));
const { isPackagedApp } = require("../../shared/licensing/runtime");
const { getPublicKeyPem, PUBLIC_KEY_PEM } = require("../../shared/licensing/publicKey");

const ATTACKER_PEM =
  "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAATTACKERKEYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=\n-----END PUBLIC KEY-----";

describe("getPublicKeyPem env override", () => {
  const saved = process.env.RETAILER_LICENSE_PUBKEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.RETAILER_LICENSE_PUBKEY;
    else process.env.RETAILER_LICENSE_PUBKEY = saved;
  });

  test("dev/tests: env override is honored", () => {
    isPackagedApp.mockReturnValue(false);
    process.env.RETAILER_LICENSE_PUBKEY = ATTACKER_PEM;
    expect(getPublicKeyPem()).toBe(ATTACKER_PEM);
  });

  test("packaged app: env override is ignored, embedded key wins", () => {
    isPackagedApp.mockReturnValue(true);
    process.env.RETAILER_LICENSE_PUBKEY = ATTACKER_PEM;
    expect(getPublicKeyPem()).toBe(PUBLIC_KEY_PEM);
  });
});
