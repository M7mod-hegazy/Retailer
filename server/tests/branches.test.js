const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb, getDb } = require("../src/config/database");
const { issueToken } = require("../src/middleware/auth");

describe("Branches Routes", () => {
  let app;
  let token;
  let userId;

  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-branches-"));
    initDb(path.join(dir, "branches.db"));
    app = createApp();

    const db = getDb();
    const info = db
      .prepare("INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)")
      .run("branches-user", "$2a$10$dummyhash", "admin");
    userId = Number(info.lastInsertRowid);
    token = issueToken({ id: userId, role: "admin" });
  });

  describe("GET /api/branches", () => {
    it("requires auth", async () => {
      const res = await request(app).get("/api/branches");
      expect(res.status).toBe(401);
    });

    it("returns empty list initially", async () => {
      const res = await request(app).get("/api/branches").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it("returns created branches", async () => {
      const db = getDb();
      db.prepare("INSERT INTO branches (name) VALUES (?)").run("Branch A");
      db.prepare("INSERT INTO branches (name) VALUES (?)").run("Branch B");

      const res = await request(app).get("/api/branches").set("Authorization", `Bearer ${token}`);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe("Branch A");
    });

    it("filters archived branches with archived=true", async () => {
      const db = getDb();
      db.prepare("INSERT INTO branches (name, is_active) VALUES (?, ?)").run("Active", 1);
      db.prepare("INSERT INTO branches (name, is_active) VALUES (?, ?)").run("Archived", 0);

      const active = await request(app).get("/api/branches").set("Authorization", `Bearer ${token}`);
      expect(active.body.data).toHaveLength(1);

      const archived = await request(app).get("/api/branches?archived=true").set("Authorization", `Bearer ${token}`);
      expect(archived.body.data).toHaveLength(1);
      expect(archived.body.data[0].name).toBe("Archived");
    });
  });

  describe("POST /api/branches", () => {
    it("creates a new branch", async () => {
      const res = await request(app)
        .post("/api/branches")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "الفرع الرئيسي" });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("الفرع الرئيسي");
    });

    it("rejects empty name", async () => {
      const res = await request(app)
        .post("/api/branches")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "" });
      expect(res.status).toBe(400);
    });

    it("rejects duplicate name", async () => {
      await request(app).post("/api/branches").set("Authorization", `Bearer ${token}`).send({ name: "Unique" });
      const res = await request(app).post("/api/branches").set("Authorization", `Bearer ${token}`).send({ name: "Unique" });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("موجود");
    });
  });

  describe("PUT /api/branches/:id", () => {
    it("updates branch name", async () => {
      const db = getDb();
      db.prepare("INSERT INTO branches (name) VALUES (?)").run("Old Name");
      const res = await request(app)
        .put("/api/branches/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "New Name" });
      expect(res.status).toBe(200);
      expect(db.prepare("SELECT name FROM branches WHERE id=1").get().name).toBe("New Name");
    });

    it("rejects empty name on update", async () => {
      const db = getDb();
      db.prepare("INSERT INTO branches (name) VALUES (?)").run("Name");
      const res = await request(app)
        .put("/api/branches/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/branches/:id", () => {
    it("hard deletes branch with no related records", async () => {
      const db = getDb();
      db.prepare("INSERT INTO branches (name) VALUES (?)").run("Temp Branch");
      const res = await request(app).delete("/api/branches/1").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.archived).toBeFalsy();
      expect(db.prepare("SELECT COUNT(*) AS c FROM branches WHERE id=1").get().c).toBe(0);
    });

    it("soft deletes (archives) branch with related records", async () => {
      const db = getDb();
      db.prepare("INSERT INTO branches (name) VALUES (?)").run("With Users");
      db.prepare("INSERT INTO users (username, password_hash, role, branch_id, is_active) VALUES (?, ?, ?, ?, 1)")
        .run("user1", "$2a$10$hash", "user", 1);
      const res = await request(app).delete("/api/branches/1").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.archived).toBe(true);
      expect(db.prepare("SELECT is_active FROM branches WHERE id=1").get().is_active).toBe(0);
    });
  });
});
