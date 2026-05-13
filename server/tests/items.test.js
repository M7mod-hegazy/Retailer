const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const { initDb, getDb, setDb } = require("../src/config/database");
const { createApp } = require("../src/app");

describe("items duplicate barcode", () => {
  let app;
  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-items-"));
    initDb(path.join(dir, "items.db"));
    app = createApp();
  });

  test("rejects duplicate barcode", () => {
    const db = getDb();
    db.prepare("INSERT INTO items (name, barcode) VALUES (?, ?)").run("Item A", "123");
    expect(() => db.prepare("INSERT INTO items (name, barcode) VALUES (?, ?)").run("Item B", "123")).toThrow();
  });

  test("imports valid rows and rejects invalid rows", async () => {
    const res = await request(app)
      .post("/api/items/import")
      .send({
        rows: [
          { name: "Imported A", barcode: "B-1", price: "25" },
          { name: "", barcode: "B-2", price: "10" },
          { name: "Imported C", barcode: "B-3", price: "not-a-number" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(1);
    expect(res.body.data.failed).toBe(2);
    expect(res.body.data.errors.length).toBe(2);
  });

  test("import endpoint requires rows", async () => {
    const res = await request(app).post("/api/items/import").send({ rows: [] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
