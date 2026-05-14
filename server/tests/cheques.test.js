const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb } = require("../src/config/database");

let app;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-cheques-"));
  initDb(path.join(dir, "cheques.db"));
  app = createApp();
});

describe("Cheques Routes", () => {
  let chequeId;

  it("GET /api/cheques returns empty list", async () => {
    const res = await request(app).get("/api/cheques");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/cheques creates a cheque", async () => {
    const res = await request(app)
      .post("/api/cheques")
      .send({ cheque_no: "CHQ-001", bank_name: "بنك الراجحي", due_date: "2026-05-01" });
    expect(res.status).toBe(201);
    expect(res.body.data.cheque_no).toBe("CHQ-001");
    chequeId = res.body.data.id;
  });

  it("PATCH /api/cheques/:id/status updates cheque status to cleared", async () => {
    const res = await request(app)
      .patch(`/api/cheques/${chequeId}/status`)
      .send({ status: "cleared" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("cleared");
  });

  it("GET /api/cheques returns the cheque", async () => {
    const res = await request(app).get("/api/cheques");
    expect(res.body.data.some(c => c.id === chequeId)).toBe(true);
  });
});
