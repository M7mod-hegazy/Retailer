const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb, getDb } = require("../src/config/database");
const jwt = require("jsonwebtoken");

let app;
let authToken;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-shifts-"));
  initDb(path.join(dir, "shifts.db"));
  app = createApp();

  const db = getDb();
  // Provide required FK references
  db.prepare("INSERT INTO users (id, username, full_name, password_hash, role) VALUES (?, ?, ?, ?, ?)").run(1, "shift_user", "User", "hash", "cashier");
  authToken = jwt.sign({ sub: 1, role: "cashier" }, process.env.JWT_SECRET || "dev-secret");
});

describe("Shifts Routes", () => {
  it("GET /api/shifts/current returns null when no open shift", async () => {
    const res = await request(app)
      .get("/api/shifts/current")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
  });

  it("POST /api/shifts/open opens a shift", async () => {
    const res = await request(app)
      .post("/api/shifts/open")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ user_id: 1, opening_cash: 500 });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("open");
    expect(res.body.data.opening_cash).toBe(500);
    expect(res.body.data.user_id).toBe(1);
  });

  it("POST /api/shifts/open rejects if shift already open", async () => {
    const res = await request(app)
      .post("/api/shifts/open")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ user_id: 1, opening_cash: 100 });
    expect(res.status).toBe(400);
  });

  it("GET /api/shifts/current returns the open shift", async () => {
    const res = await request(app)
      .get("/api/shifts/current")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("open");
  });

  it("POST /api/shifts/pay-in adds a pay-in transaction", async () => {
    const res = await request(app)
      .post("/api/shifts/pay-in")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ amount: 200, reason: "Cash deposit" });
    expect(res.status).toBe(200);
    expect(res.body.data.transaction_type).toBe("pay_in");
  });

  it("POST /api/shifts/pay-out adds a pay-out transaction", async () => {
    const res = await request(app)
      .post("/api/shifts/pay-out")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ amount: 50, reason: "Petty cash" });
    expect(res.status).toBe(200);
    expect(res.body.data.transaction_type).toBe("pay_out");
  });

  it("GET /api/shifts/:id/report returns metrics", async () => {
    const currentRes = await request(app)
      .get("/api/shifts/current")
      .set("Authorization", `Bearer ${authToken}`);
    const shiftId = currentRes.body.data.id;
    const res = await request(app)
      .get(`/api/shifts/${shiftId}/report`)
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.metrics).toBeDefined();
    expect(res.body.data.metrics.pay_ins).toBe(200);
    expect(res.body.data.metrics.pay_outs).toBe(50);
  });

  it("POST /api/shifts/close closes the shift", async () => {
    const res = await request(app)
      .post("/api/shifts/close")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ closing_cash: 650 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("closed");
  });

  it("rejects shift access without authentication", async () => {
    const res = await request(app).get("/api/shifts/current");
    expect(res.status).toBe(401);
  });
});
