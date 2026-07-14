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

  // salary 2500, recurring deduction 200, one-time bonus 500 → net 2800
  it("POST /api/employees/:id/settle creates a full salary settlement", async () => {
    const res = await request(app)
      .post(`/api/employees/${empId}/settle`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        period_start: "2026-06-01",
        period_end: "2026-06-29",
        payment_method: "cash",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.base_salary).toBe(2500);
    expect(res.body.data.net_salary).toBe(2800);
    expect(res.body.data.paid_amount).toBe(2800);
    expect(res.body.data.remaining_balance).toBe(0);
    expect(res.body.data.previous_owed).toBe(0);
    expect(res.body.data.status).toBe("full");
  });

  it("one-time bonus is consumed and does not repeat on the next settlement", async () => {
    const res = await request(app)
      .post(`/api/employees/${empId}/settle`)
      .set("Authorization", `Bearer ${token}`)
      .send({ period_start: "2026-06-30", period_end: "2026-07-06", payment_method: "cash" });
    expect(res.status).toBe(201);
    // 2500 - 200 recurring; the 500 one-time bonus must NOT appear again
    expect(res.body.data.total_bonuses).toBe(0);
    expect(res.body.data.net_salary).toBe(2300);
  });

  it("partial settlement records the unpaid amount as owed to the employee", async () => {
    const res = await request(app)
      .post(`/api/employees/${empId}/settle`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        period_start: "2026-07-07",
        period_end: "2026-07-13",
        payment_method: "cash",
        paid_amount: 1000,
        carry_forward: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.net_salary).toBe(2300);
    expect(res.body.data.paid_amount).toBe(1000);
    expect(res.body.data.remaining_balance).toBe(1300);
    expect(res.body.data.status).toBe("partial");

    const bal = await request(app)
      .get(`/api/employees/${empId}/salary-balance`)
      .set("Authorization", `Bearer ${token}`);
    expect(bal.body.data.outstanding_balance).toBe(1300);
    expect(bal.body.data.carry_forward_balance).toBe(1300);
  });

  it("carried-forward balance is ADDED to the next settlement and folded in", async () => {
    const res = await request(app)
      .post(`/api/employees/${empId}/settle`)
      .set("Authorization", `Bearer ${token}`)
      .send({ period_start: "2026-07-14", period_end: "2026-07-20", payment_method: "cash" });
    expect(res.status).toBe(201);
    expect(res.body.data.net_salary).toBe(2300);
    expect(res.body.data.previous_owed).toBe(1300);
    // full payment covers period net + what was owed from before
    expect(res.body.data.paid_amount).toBe(3600);
    expect(res.body.data.status).toBe("full");

    // the old partial row is now 'carried' and no longer counted as outstanding
    const list = await request(app)
      .get(`/api/employees/${empId}/settlements`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.data.some(s => s.status === "carried")).toBe(true);

    const bal = await request(app)
      .get(`/api/employees/${empId}/salary-balance`)
      .set("Authorization", `Bearer ${token}`);
    expect(bal.body.data.outstanding_balance).toBe(0);
  });

  it("deferred one-time deduction is excluded now and applied exactly once later", async () => {
    await request(app)
      .post(`/api/employees/${empId}/deductions`)
      .set("Authorization", `Bearer ${token}`)
      .send({ deduction_type: "damage", amount: 300, is_recurring: false });

    // deferred: must NOT reduce this settlement
    const deferred = await request(app)
      .post(`/api/employees/${empId}/settle`)
      .set("Authorization", `Bearer ${token}`)
      .send({ period_start: "2026-07-21", period_end: "2026-07-27", payment_method: "cash", consume_one_time: false });
    expect(deferred.status).toBe(201);
    expect(deferred.body.data.net_salary).toBe(2300);

    const deductions = await request(app)
      .get(`/api/employees/${empId}/deductions`)
      .set("Authorization", `Bearer ${token}`);
    expect(deductions.body.data.some(d => !d.is_recurring && d.status === "active")).toBe(true);

    // next settlement applies it once and completes it
    const applied = await request(app)
      .post(`/api/employees/${empId}/settle`)
      .set("Authorization", `Bearer ${token}`)
      .send({ period_start: "2026-07-28", period_end: "2026-08-03", payment_method: "cash" });
    expect(applied.body.data.net_salary).toBe(2000);

    const after = await request(app)
      .get(`/api/employees/${empId}/deductions`)
      .set("Authorization", `Bearer ${token}`);
    expect(after.body.data.some(d => !d.is_recurring && d.status === "active")).toBe(false);
  });

  it("manually-tracked partial remainder can be paid via pay-outstanding", async () => {
    const partial = await request(app)
      .post(`/api/employees/${empId}/settle`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        period_start: "2026-08-04",
        period_end: "2026-08-10",
        payment_method: "cash",
        paid_amount: 1500,
        carry_forward: false,
      });
    expect(partial.body.data.remaining_balance).toBe(800);

    // not carried automatically...
    const bal = await request(app)
      .get(`/api/employees/${empId}/salary-balance`)
      .set("Authorization", `Bearer ${token}`);
    expect(bal.body.data.outstanding_balance).toBe(800);
    expect(bal.body.data.carry_forward_balance).toBe(0);

    // ...but payable manually
    const payoff = await request(app)
      .post(`/api/employees/${empId}/pay-outstanding`)
      .set("Authorization", `Bearer ${token}`)
      .send({ paid_amount: 800 });
    expect(payoff.status).toBe(200);
    expect(payoff.body.data.paid_off).toBe(800);

    const after = await request(app)
      .get(`/api/employees/${empId}/salary-balance`)
      .set("Authorization", `Bearer ${token}`);
    expect(after.body.data.outstanding_balance).toBe(0);
  });

  it("advance repayment is deducted from the salary and reduces the advance", async () => {
    const advances = await request(app)
      .get(`/api/employees/${empId}/advances`)
      .set("Authorization", `Bearer ${token}`);
    const advance = advances.body.data.find(a => a.status === "active");
    const before = Number(advance.remaining_balance);

    const res = await request(app)
      .post(`/api/employees/${empId}/settle`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        period_start: "2026-08-11",
        period_end: "2026-08-17",
        payment_method: "cash",
        advance_payments: [{ advance_id: advance.id, amount: 500 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.advance_deductions).toBe(500);
    expect(res.body.data.net_salary).toBe(1800);

    const after = await request(app)
      .get(`/api/employees/${empId}/advances`)
      .set("Authorization", `Bearer ${token}`);
    expect(Number(after.body.data.find(a => a.id === advance.id).remaining_balance)).toBe(before - 500);
  });

  it("rejects a settlement whose deductions and advance repayments exceed the salary", async () => {
    const advances = await request(app)
      .get(`/api/employees/${empId}/advances`)
      .set("Authorization", `Bearer ${token}`);
    const advance = advances.body.data.find(a => a.status === "active");

    const res = await request(app)
      .post(`/api/employees/${empId}/settle`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        period_start: "2026-08-18",
        period_end: "2026-08-24",
        payment_method: "cash",
        advance_payments: [{ advance_id: advance.id, amount: 999999 }],
      });
    expect(res.status).toBe(400);
  });

  it("GET /api/employees/:id/settlements returns settlement history", async () => {
    const res = await request(app)
      .get(`/api/employees/${empId}/settlements`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
