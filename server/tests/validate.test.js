const express = require("express");
const request = require("supertest");
const { z } = require("zod");
const { validate } = require("../src/middleware/validate");

function createTestApp(schema) {
  const app = express();
  app.use(express.json());
  app.post("/test", validate(schema), (req, res) => {
    res.json({ success: true, data: req.body });
  });
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ success: false, code: err.code, message: err.message });
  });
  return app;
}

describe("validate middleware", () => {
  const nameSchema = z.object({
    name: z.string().min(1, "Name is required"),
    age: z.number().optional(),
  });

  it("passes valid payload through", async () => {
    const app = createTestApp(nameSchema);
    const res = await request(app).post("/test").send({ name: "Test", age: 25 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ name: "Test", age: 25 });
  });

  it("rejects invalid payload with 400", async () => {
    const app = createTestApp(nameSchema);
    const res = await request(app).post("/test").send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.message).toBe("بيانات الطلب غير صحيحة");
  });

  it("rejects missing required fields", async () => {
    const app = createTestApp(nameSchema);
    const res = await request(app).post("/test").send({});
    expect(res.status).toBe(400);
  });

  it("strips unknown fields and returns parsed data", async () => {
    const app = createTestApp(nameSchema);
    const res = await request(app).post("/test").send({ name: "Test", unknownField: "should be stripped" });
    expect(res.status).toBe(200);
    expect(res.body.data.unknownField).toBeUndefined();
  });

  it("handles nested object schemas", async () => {
    const nestedSchema = z.object({
      user: z.object({ id: z.number(), name: z.string() }),
    });
    const app = createTestApp(nestedSchema);
    const res = await request(app).post("/test").send({ user: { id: 1, name: "Alice" } });
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe("Alice");
  });

  it("rejects wrong types", async () => {
    const app = createTestApp(nameSchema);
    const res = await request(app).post("/test").send({ name: 123 });
    expect(res.status).toBe(400);
  });
});
