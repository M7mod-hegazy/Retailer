const express = require("express");
const request = require("supertest");
const { errorHandler } = require("../src/middleware/errorHandler");

function createTestApp() {
  const app = express();
  app.get("/error", (_req, _res, next) => {
    const err = new Error("Test error");
    err.status = 400;
    err.code = "TEST_ERROR";
    next(err);
  });
  app.get("/server-error", (_req, _res, next) => {
    next(new Error("Unexpected"));
  });
  app.use(errorHandler);
  return app;
}

describe("errorHandler middleware", () => {
  it("returns 400 with custom code and message", async () => {
    const app = createTestApp();
    const res = await request(app).get("/error");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("TEST_ERROR");
    expect(res.body.message).toBe("Test error");
  });

  it("returns 500 with default code for unhandled errors", async () => {
    const app = createTestApp();
    const res = await request(app).get("/server-error");
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("INTERNAL_ERROR");
  });

  it("returns default Arabic message for 500", async () => {
    const app = createTestApp();
    const res = await request(app).get("/server-error");
    expect(res.body.message).toBe("حدث خطأ غير متوقع");
  });

  it("preserves custom status code", async () => {
    const app = express();
    app.get("/custom", (_req, _res, next) => {
      const err = new Error("Not found");
      err.status = 404;
      next(err);
    });
    app.use(errorHandler);
    const res = await request(app).get("/custom");
    expect(res.status).toBe(404);
  });
});
