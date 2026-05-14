const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const { signPayload } = require("../../shared/licensing/crypto");

const TEST_PRIVATE_KEY = `
-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIEBW7zQxn42F/Bc8SxEXE0Wyp3Io5YviP699biqDFb3d
-----END PRIVATE KEY-----
`;

const TEST_PUBLIC_KEY = `
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA/ixoiBpESM282TptS2oEgKaVeXYinUuBpnWtc9k8hF0=
-----END PUBLIC KEY-----
`;

process.env.ENFORCE_LICENSE_IN_TESTS = "1";
process.env.ALLOW_DEV_BYPASS = "true";
process.env.LICENSE_VENDOR_API_URL = "http://127.0.0.1:5599";
process.env.LICENSE_VENDOR_APP_KEY = "test-app-key";
process.env.LICENSE_VENDOR_PUBLIC_KEY = TEST_PUBLIC_KEY;
process.env.LICENSE_ISSUER = "ElHegazi-Licensing";
process.env.LICENSE_CACHE_SECRET = "test-license-cache-secret";
process.env.LICENSE_OFFLINE_GRACE_DAYS = "14";

const { createApp } = require("../src/app");
const { initDb, setDb, getDb } = require("../src/config/database");
const { ensureSystemOwnerAccount, SYSTEM_OWNER_USERNAME } = require("../src/services/systemOwner.service");

let app;
let vendorServer;
let vendorLicenseStatus = "active";

function buildSignedLicense() {
  return signPayload(
    {
      license_id: "lic-test-001",
      customer_id: "cust-001",
      plan: "standard",
      issued_at: new Date().toISOString(),
      expires_at: null,
      max_devices: 1,
      features: ["pos", "reports"],
      grace_days: 14,
      issuer: "ElHegazi-Licensing",
    },
    TEST_PRIVATE_KEY,
  );
}

function buildActivationToken(deviceId) {
  return signPayload(
    {
      license_id: "lic-test-001",
      customer_id: "cust-001",
      device_id: deviceId,
      status: vendorLicenseStatus,
      plan: "standard",
      features: ["pos", "reports"],
      grace_days: 14,
      issued_at: new Date().toISOString(),
      refresh_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      expires_at: null,
      issuer: "ElHegazi-Licensing",
    },
    TEST_PRIVATE_KEY,
  );
}

beforeAll(async () => {
  const vendorApp = express();
  vendorApp.use(express.json());
  vendorApp.post("/activations", (req, res) => {
    if (req.headers["x-app-key"] !== "test-app-key") {
      return res.status(401).json({ success: false, message: "unauthorized app key" });
    }
    if (!req.body?.device_id) {
      return res.status(400).json({ success: false, message: "missing device_id" });
    }
    return res.status(201).json({
      success: true,
      data: {
        activation_id: "act-001",
        activation_token: buildActivationToken(req.body.device_id),
        status: vendorLicenseStatus,
      },
    });
  });
  vendorApp.post("/activations/refresh", (req, res) => {
    if (req.headers["x-app-key"] !== "test-app-key") {
      return res.status(401).json({ success: false, message: "unauthorized app key" });
    }
    const deviceId = req.body?.activation_token?.payload?.device_id;
    return res.json({
      success: true,
      data: {
        activation_id: "act-001",
        activation_token: buildActivationToken(deviceId),
        status: vendorLicenseStatus,
      },
    });
  });

  vendorServer = await new Promise((resolve) => {
    const server = vendorApp.listen(5599, "127.0.0.1", () => resolve(server));
  });

  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-license-"));
  initDb(path.join(dir, "license.db"));
  ensureSystemOwnerAccount();

  const db = getDb();
  const hash = bcrypt.hashSync("Cashier#123", 10);
  db.prepare("INSERT INTO users (full_name, username, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)").run(
    "Cashier One",
    "cashier-one",
    hash,
    "cashier",
  );

  app = createApp();
});

afterAll(async () => {
  if (vendorServer) {
    await new Promise((resolve) => vendorServer.close(resolve));
  }
});

describe("Hybrid signed license security", () => {
  it("allows developer login without license when dev bypass is enabled", async () => {
    const res = await request(app).post("/api/auth/login").send({
      username: SYSTEM_OWNER_USERNAME,
      password: "275757",
    });
    expect(res.status).toBe(200);
  });

  it("blocks non-developer login before activation", async () => {
    const res = await request(app).post("/api/auth/login").send({
      username: "cashier-one",
      password: "Cashier#123",
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("LICENSE_REQUIRED");
  });

  it("rejects tampered signed license", async () => {
    const tampered = buildSignedLicense();
    tampered.payload.plan = "enterprise";
    const activateRes = await request(app).post("/api/license/activate").send({ signed_license: tampered });
    expect(activateRes.status).toBe(401);
  });

  it("accepts valid signed license and allows normal login", async () => {
    const signedLicense = buildSignedLicense();
    const activateRes = await request(app).post("/api/license/activate").send({ signed_license: signedLicense });
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.status).toBe("activated");

    const loginRes = await request(app).post("/api/auth/login").send({
      username: "cashier-one",
      password: "Cashier#123",
    });
    expect(loginRes.status).toBe(200);
  });

  it("blocks users after vendor revoke on refresh", async () => {
    const developerLogin = await request(app).post("/api/auth/login").send({
      username: SYSTEM_OWNER_USERNAME,
      password: "275757",
    });
    const developerToken = developerLogin.body.data.token;

    vendorLicenseStatus = "revoked";
    const refreshRes = await request(app)
      .post("/api/license/refresh")
      .set("Authorization", `Bearer ${developerToken}`)
      .send({});
    expect(refreshRes.status).toBe(200);

    const loginRes = await request(app).post("/api/auth/login").send({
      username: "cashier-one",
      password: "Cashier#123",
    });
    expect(loginRes.status).toBe(403);
    expect(loginRes.body.code).toBe("LICENSE_REQUIRED");
  });
});
