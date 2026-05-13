const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb } = require("../src/config/database");
const { UserModel } = require("../src/models/user.model");
const jwt = require("jsonwebtoken");

let app;
let authToken;
let adminToken;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-auth-"));
  initDb(path.join(dir, "auth.db"));
  const admin = UserModel.create({ username: "mfa-admin", password: "Secret123!", role: "admin", full_name: "MFA Admin" });
  adminToken = jwt.sign({ sub: admin.id, role: admin.role }, process.env.JWT_SECRET || "dev-secret");
  app = createApp();
});

describe("Auth Routes", () => {
  it("rejects login when credentials are missing", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should fail to login with non-existent user", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "fakeuser", password: "wrongpassword" });
    
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/اسم المستخدم أو كلمة المرور غير صحيحة/);
  });

  it("should have rate limiting configured", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty("ratelimit-limit");
  });

  it("locks account after repeated failed attempts", async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app).post("/api/auth/login").send({ username: "lock-user", password: "bad-pass" });
    }

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "lock-user", password: "still-bad" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/الحساب مقفل/);
  });

  it("unlock endpoint clears lock for specific username when requested by admin", async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app).post("/api/auth/login").send({ username: "unlock-user", password: "bad-pass" });
    }

    const locked = await request(app).post("/api/auth/login").send({ username: "unlock-user", password: "bad-pass" });
    expect(locked.status).toBe(403);

    const unlock = await request(app)
      .post("/api/auth/unlock")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: "unlock-user", reason: "manual reset" });
    expect(unlock.status).toBe(200);
    expect(unlock.body.data.unlocked).toBe(true);

    const afterUnlock = await request(app)
      .post("/api/auth/login")
      .send({ username: "unlock-user", password: "bad-pass" });
    expect(afterUnlock.status).toBe(401);
  });

  it("rejects unlock requests without admin authentication", async () => {
    const res = await request(app).post("/api/auth/unlock").send({ username: "unlock-user" });
    expect(res.status).toBe(401);
  });

  it("allows an authenticated user to setup, verify, and disable MFA", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ username: "mfa-admin", password: "Secret123!" });

    expect(login.status).toBe(200);
    authToken = login.body.data.token;

    const setup = await request(app)
      .post("/api/auth/mfa/setup")
      .set("Authorization", `Bearer ${authToken}`)
      .send({});

    expect(setup.status).toBe(200);
    expect(setup.body.data.secret).toBeTruthy();
    expect(setup.body.data.otpauth_url).toContain("otpauth://totp/");

    const secret = setup.body.data.secret;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const cleaned = String(secret).replace(/=+$/g, "").toUpperCase();
    let bits = "";
    for (const char of cleaned) {
      const index = alphabet.indexOf(char);
      if (index >= 0) bits += index.toString(2).padStart(5, "0");
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
    }
    const counter = Math.floor(Date.now() / 30000);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuffer.writeUInt32BE(counter % 0x100000000, 4);
    const code = require("crypto")
      .createHmac("sha1", Buffer.from(bytes))
      .update(counterBuffer)
      .digest();
    const offset = code[code.length - 1] & 0xf;
    const token = ((code.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");

    const verify = await request(app)
      .post("/api/auth/mfa/verify")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ token });

    expect(verify.status).toBe(200);
    expect(verify.body.data.verified).toBe(true);

    const disable = await request(app)
      .post("/api/auth/mfa/disable")
      .set("Authorization", `Bearer ${authToken}`)
      .send({});

    expect(disable.status).toBe(200);
    expect(disable.body.data.disabled).toBe(true);
  });
});
