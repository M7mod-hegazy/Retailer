const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const {
  keysExist, runKeygen, generate, readRegistry,
  KEYS_DIR, PRIVATE_KEY_PATH, DATA_DIR, OUT_DIR,
} = require("./signEngine");

const BASE_PORT = 3456;
const MAX_PORT_ATTEMPTS = 10;
const GUI_FILE = path.join(__dirname, "gui.html");

// ---- MIME types for static file serving ----
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".key": "text/plain; charset=utf-8",
};

// ---- Minimal router ----
async function route(req, res) {
  const url = new URL(req.url, `http://localhost:${BASE_PORT}`);
  const method = req.method;
  const pathname = url.pathname;

  // CORS headers (allow browser to call localhost)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // ---- API: status ----
    if (method === "GET" && pathname === "/api/status") {
      json(res, { ok: true, keysExist: keysExist(), keysDir: KEYS_DIR, dataDir: DATA_DIR });
      return;
    }

    // ---- API: keygen ----
    if (method === "POST" && pathname === "/api/keygen") {
      try {
        const result = runKeygen({ force: false });
        json(res, { ok: true, privateKeyPath: result.privateKeyPath });
      } catch (e) {
        json(res, { ok: false, error: e.message });
      }
      return;
    }

    // ---- API: generate (sign a license) ----
    if (method === "POST" && pathname === "/api/generate") {
      const body = await readBody(req);
      const { fingerprint, name, expiresAt, features } = body;
      if (!fingerprint) {
        json(res, { ok: false, error: "missing_fingerprint" });
        return;
      }
      try {
        const result = await generate({ fingerprint, name, expiresAt: expiresAt || null, features: features || "full" });
        json(res, {
          ok: true,
          licenseId: result.licenseId,
          keyPath: result.keyPath,
          qrPath: result.qrPath,
          blob: result.blob,
          activationCode: result.activationCode,
          expiresAt: result.payload.expiresAt,
        });
      } catch (e) {
        json(res, { ok: false, error: e.message });
      }
      return;
    }

    // ---- API: list (registry) ----
    if (method === "GET" && pathname === "/api/list") {
      json(res, { ok: true, entries: readRegistry().slice().reverse() });
      return;
    }

    // ---- API: download a file ----
    if (method === "GET" && pathname === "/api/download") {
      const filePath = url.searchParams.get("path");
      if (!filePath || !fs.existsSync(filePath)) {
        json(res, { ok: false, error: "file_not_found" }, 404);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${path.basename(filePath)}"`,
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // ---- Serve GUI (everything else) ----
    if (fs.existsSync(GUI_FILE)) {
      const html = fs.readFileSync(GUI_FILE, "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } else {
      json(res, { ok: false, error: "gui.html not found" }, 404);
    }
  } catch (err) {
    console.error("Route error:", err);
    json(res, { ok: false, error: err.message }, 500);
  }
}

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

// ---- Ensure data directories exist ----
fs.mkdirSync(KEYS_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---- Start (port-adaptive) ----
function tryListen(port, attempt = 0) {
  const server = http.createServer(route);
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && attempt < MAX_PORT_ATTEMPTS) {
      console.log(`  Port ${port} in use, trying ${port + 1}...`);
      tryListen(port + 1, attempt + 1);
    } else {
      console.error(`\n  [!!] Cannot bind to any port (tried ${BASE_PORT}–${BASE_PORT + MAX_PORT_ATTEMPTS - 1})`);
      console.error(`       Close other programs and try again.\n`);
      process.exit(1);
    }
  });
  server.listen(port, () => {
    console.log(`  License Signer ready → http://localhost:${port}`);
    console.log(`  Keys:  ${KEYS_DIR}`);
    console.log(`  Data:  ${DATA_DIR}`);

    // Open browser automatically (Windows)
    try { exec(`start http://localhost:${port}`); } catch (_e) { /* skip */ }
  });

  // Graceful shutdown on Ctrl+C
  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    server.close(() => process.exit(0));
  });
}

tryListen(BASE_PORT);
