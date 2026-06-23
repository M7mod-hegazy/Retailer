const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createApp } = require("../src/app");
const { initDb, setDb, getDb } = require("../src/config/database");

let app;
let token;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-cheques-"));
  initDb(path.join(dir, "cheques.db"));
  // Cheque management is a toggleable module (OFF by default) — enable it for these tests.
  getDb().prepare("UPDATE settings SET feature_cheques = 1 WHERE id = 1").run();
  app = createApp();
  token = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");
});

describe("Cheques Routes", () => {
  let chequeId;

  it("GET /api/cheques returns empty list", async () => {
    const res = await request(app).get("/api/cheques").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/cheques creates a cheque", async () => {
    const res = await request(app)
      .post("/api/cheques")
      .set("Authorization", `Bearer ${token}`)
      .send({ cheque_no: "CHQ-001", bank_name: "بنك الراجحي", due_date: "2026-05-01" });
    expect(res.status).toBe(201);
    expect(res.body.data.cheque_no).toBe("CHQ-001");
    chequeId = res.body.data.id;
  });

  it("PATCH /api/cheques/:id/status updates cheque status to cleared", async () => {
    const res = await request(app)
      .patch(`/api/cheques/${chequeId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "cleared" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("cleared");
  });

  it("GET /api/cheques returns the cheque", async () => {
    const res = await request(app).get("/api/cheques").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.some(c => c.id === chequeId)).toBe(true);
  });
});
