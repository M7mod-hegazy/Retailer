const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createApp } = require("../src/app");
const { initDb, setDb } = require("../src/config/database");

let app;
let token;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-employees-"));
  initDb(path.join(dir, "employees.db"));
  app = createApp();
  token = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");
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
      .send({ name: "خالد عبدالله", phone: "0551234567", job_title: "كاشير", salary: 2000 });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("خالد عبدالله");
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
      .send({ name: "خالد عبدالله", phone: "0551234567", job_title: "مشرف", salary: 2500 });
    expect(res.status).toBe(200);
    expect(res.body.data.job_title).toBe("مشرف");
  });
});
