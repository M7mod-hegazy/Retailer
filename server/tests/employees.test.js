const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/app");
const { initDb, getDb, setDb } = require("../src/config/database");

let app;
let token;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-employees-"));
  initDb(path.join(dir, "employees.db"));
  const db = getDb();
  const hash = bcrypt.hashSync("test", 10);
  db.prepare("INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, ?)").run("testuser", hash, "admin", 1);
  const user = db.prepare("SELECT id FROM users WHERE username = ?").get("testuser");
  app = createApp();
  token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET || "test-secret");
});

describe("Employees Routes", () => {
  let empId;

  it("GET /api/employees returns empty list", async () => {
    const res = await request(app).get("/api/employees").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/employees creates an employee", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "خالد عبدالله", phone: "0551234567", job_title: "كاشير", salary: 2000, salary_period: "monthly" });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("خالد عبدالله");
    expect(res.body.data.salary).toBe(2000);
    expect(res.body.data.salary_period).toBe("monthly");
    empId = res.body.data.id;
  });

  it("GET /api/employees returns the new employee", async () => {
    const res = await request(app).get("/api/employees").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.some(e => e.id === empId)).toBe(true);
  });

  it("PUT /api/employees/:id updates the employee", async () => {
    const res = await request(app)
      .put(`/api/employees/${empId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "خالد عبدالله", phone: "0551234567", job_title: "مشرف", salary: 2500, salary_period: "weekly" });
    expect(res.status).toBe(200);
    expect(res.body.data.job_title).toBe("مشرف");
    expect(res.body.data.salary).toBe(2500);
    expect(res.body.data.salary_period).toBe("weekly");
  });

  it("POST /api/employees/:id/advances creates an advance", async () => {
    const res = await request(app)
      .post(`/api/employees/${empId}/advances`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 5000, installment_count: 5, notes: "سلفة عادية" });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(5000);
    expect(res.body.data.installment_count).toBe(5);
    expect(res.body.data.installment_amount).toBe(1000);
    expect(res.body.data.remaining_balance).toBe(5000);
    expect(res.body.data.status).toBe("active");
  });

  it("POST /api/employees/:id/advances/:advanceId/pay records a payment", async () => {
    const advances = await request(app)
      .get(`/api/employees/${empId}/advances`)
      .set("Authorization", `Bearer ${token}`);
    const advanceId = advances.body.data[0].id;

    const res = await request(app)
      .post(`/api/employees/${empId}/advances/${advanceId}/pay`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.remaining_balance).toBe(4000);
  });

  it("POST /api/employees/:id/deductions creates a deduction", async () => {
    const res = await request(app)
      .post(`/api/employees/${empId}/deductions`)
      .set("Authorization", `Bearer ${token}`)
      .send({ deduction_type: "insurance", amount: 200, is_recurring: true, notes: "تأمين صحي" });
    expect(res.status).toBe(201);
    expect(res.body.data.deduction_type).toBe("insurance");
  });

  it("POST /api/employees/:id/bonuses creates a bonus", async () => {
    const res = await request(app)
      .post(`/api/employees/${empId}/bonuses`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bonus_type: "performance", amount: 500, is_recurring: false, notes: "مكافأة أداء" });
    expect(res.status).toBe(201);
    expect(res.body.data.bonus_type).toBe("performance");
  });

  it("POST /api/employees/:id/settle creates a salary settlement", async () => {
    const res = await request(app)
      .post(`/api/employees/${empId}/settle`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        period_start: "2026-06-01",
        period_end: "2026-06-29",
        payment_method: "cash",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.net_salary).toBeGreaterThan(0);
    expect(res.body.data.base_salary).toBe(2500);
    expect(res.body.data.status).toBe("settled");
  });

  it("GET /api/employees/:id/settlements returns settlement history", async () => {
    const res = await request(app)
      .get(`/api/employees/${empId}/settlements`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
