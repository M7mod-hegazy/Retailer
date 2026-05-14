const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const express = require("express");
const { upload, getUploadsDir } = require("../src/middleware/upload");

describe("getUploadsDir", () => {
  const originalEnv = process.env.UPLOADS_DIR;

  afterEach(() => {
    process.env.UPLOADS_DIR = originalEnv;
  });

  it("returns a path ending with uploads", () => {
    const dir = getUploadsDir();
    expect(dir).toContain("uploads");
    expect(path.isAbsolute(dir)).toBe(true);
  });

  it("creates the directory if it does not exist", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-upload-test-"));
    process.env.UPLOADS_DIR = tmp;
    const dir = getUploadsDir();
    expect(fs.existsSync(dir)).toBe(true);
  });

  it("honours UPLOADS_DIR env var", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-upload-custom-"));
    process.env.UPLOADS_DIR = tmp;
    const dir = getUploadsDir();
    expect(dir).toBe(path.join(tmp, "uploads"));
  });
});

describe("upload middleware", () => {
  it("is a multer instance (has .single method)", () => {
    expect(typeof upload).toBe("object");
    expect(typeof upload.single).toBe("function");
    expect(typeof upload.array).toBe("function");
  });

  it("rejects files larger than 5MB", async () => {
    const app = express();
    app.post("/upload", upload.single("file"), (req, res) => {
      res.json({ success: true, file: req.file });
    });
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ error: err.message });
    });
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
    const res = await request(app)
      .post("/upload")
      .attach("file", largeBuffer, "large.jpg");
    expect(res.status).toBe(500);
  });

  it("silently skips non-image file types (file is undefined)", async () => {
    const app = express();
    app.post("/upload", upload.single("file"), (req, res) => {
      res.json({ success: true, file: req.file });
    });
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ error: err.message });
    });
    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("not an image"), "test.txt");
    expect(res.status).toBe(200);
    expect(res.body.file).toBeUndefined();
  });

  it("accepts a valid image upload", async () => {
    const app = express();
    app.post("/upload", upload.single("file"), (req, res) => {
      res.json({ success: true, file: req.file });
    });
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ error: err.message });
    });
    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("fake-image-content"), "photo.jpg", {
        contentType: "image/jpeg",
      });
    expect(res.status).toBe(200);
    expect(res.body.file).toBeTruthy();
    expect(res.body.file.mimetype).toBe("image/jpeg");
  });

  it("generates a unique filename per upload", async () => {
    const app = express();
    app.post("/upload", upload.single("file"), (req, res) => {
      res.json({ success: true, filename: req.file.filename });
    });
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ error: err.message });
    });
    const [r1, r2] = await Promise.all([
      request(app).post("/upload").attach("file", Buffer.from("img1"), "a.jpg", { contentType: "image/jpeg" }),
      request(app).post("/upload").attach("file", Buffer.from("img2"), "a.jpg", { contentType: "image/jpeg" }),
    ]);
    expect(r1.body.filename).not.toBe(r2.body.filename);
  });
});
