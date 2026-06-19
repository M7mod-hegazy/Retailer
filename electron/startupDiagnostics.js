// Startup self-diagnostic for the embedded server.
//
// Runs in the Electron MAIN process (plain Node) so it works even when the
// embedded Express server is down — that is exactly the state we need to explain
// when a customer reports a persistent "connection error" on a purely local app.
//
// It probes the handful of things that actually break a local server on a real
// Windows PC, classifies the most likely root cause, and writes a structured
// diagnostic-report.json next to the crash log. The cause code it returns drives
// the cause-aware UI (ServerDownOverlay) and the native error screen.

const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const http = require("http");
const { resolveLogDir } = require("./crashLogger");

// Cause codes — kept in sync with the renderer (ServerDownOverlay MESSAGES).
const CAUSE = {
  OK: "ok",
  DB_EPERM: "db-eperm",
  DB_LOCKED: "db-locked",
  DB_CORRUPT: "db-corrupt",
  PORT_EXHAUSTED: "port-exhausted",
  LOOPBACK_BLOCKED: "loopback-blocked",
  NATIVE_MODULE: "native-module",
  SERVER_NEVER_STARTED: "server-never-started",
  UNKNOWN: "unknown",
};

const PORT_RANGE_START = Number(process.env.PORT || 5000);
const PORT_RANGE_COUNT = 20; // 5000..5019, matches server/src/index.js

function safe(fn, fallback) {
  try {
    return fn();
  } catch (err) {
    return typeof fallback === "function" ? fallback(err) : fallback;
  }
}

// Can we create + actually write a file in this directory?
function probeWritableDir(dir) {
  const result = { dir, exists: false, writable: false, error: null };
  if (!dir) {
    result.error = "no path";
    return result;
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
    result.exists = true;
    const probeFile = path.join(dir, `.write-probe-${process.pid}`);
    fs.writeFileSync(probeFile, "ok");
    fs.unlinkSync(probeFile);
    result.writable = true;
  } catch (err) {
    result.error = `${err.code || ""} ${err.message}`.trim();
  }
  return result;
}

// Is the given TCP port free to bind on the loopback host?
function probePort(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", (err) => {
        resolve({ port, free: false, code: err.code || null });
      })
      .once("listening", () => {
        tester.close(() => resolve({ port, free: true, code: null }));
      })
      .listen(port, host);
  });
}

async function probePortRange() {
  const ports = [];
  for (let i = 0; i < PORT_RANGE_COUNT; i++) {
    // eslint-disable-next-line no-await-in-loop
    ports.push(await probePort(PORT_RANGE_START + i));
  }
  const free = ports.filter((p) => p.free).map((p) => p.port);
  return { range: `${PORT_RANGE_START}-${PORT_RANGE_START + PORT_RANGE_COUNT - 1}`, free, ports };
}

// One-shot HTTP GET with a hard timeout. Used to confirm whether the loopback
// interface itself is usable (a security suite / proxy can break 127.0.0.1 even
// when the server is listening).
function httpGet(host, port, reqPath = "/api/health", timeout = 3000) {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path: reqPath, timeout }, (res) => {
      res.resume();
      resolve({ host, ok: res.statusCode >= 200 && res.statusCode < 500, status: res.statusCode, error: null });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ host, ok: false, status: null, error: "timeout" });
    });
    req.on("error", (err) => {
      resolve({ host, ok: false, status: null, error: err.code || err.message });
    });
  });
}

// Probe loopback reachability over both 127.0.0.1 and localhost (the latter can
// resolve to ::1 and fail when the server binds IPv4 only).
async function probeLoopback(port) {
  if (!port) return { tested: false };
  const [v4, named] = await Promise.all([
    httpGet("127.0.0.1", port),
    httpGet("localhost", port),
  ]);
  return { tested: true, "127.0.0.1": v4, localhost: named, anyOk: v4.ok || named.ok };
}

// Load better-sqlite3 (the native module) and open the DB read-only to capture
// integrity / lock / corruption state without disturbing the live connection.
function probeDatabase(dbPath) {
  const result = {
    dbPath: dbPath || null,
    exists: false,
    sizeKb: 0,
    walPresent: false,
    nativeModule: { loaded: false, version: null, error: null },
    open: { ok: false, error: null },
    integrity: null,
  };

  let Database;
  try {
    Database = require("better-sqlite3");
    result.nativeModule.loaded = true;
    result.nativeModule.version = safe(() => require("better-sqlite3/package.json").version, null);
  } catch (err) {
    result.nativeModule.error = err.message;
    return result; // can't probe further without the driver
  }

  if (dbPath) {
    result.exists = safe(() => fs.existsSync(dbPath), false);
    if (result.exists) {
      result.sizeKb = safe(() => Math.round(fs.statSync(dbPath).size / 1024), 0);
      result.walPresent = safe(() => fs.existsSync(`${dbPath}-wal`), false);
    }
  }

  if (!result.exists) return result;

  let db = null;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true, timeout: 2000 });
    result.open.ok = true;
    const rows = db.pragma("integrity_check");
    result.integrity = rows.length === 1 && rows[0].integrity_check === "ok" ? "ok" : "errors";
  } catch (err) {
    result.open.ok = false;
    result.open.error = `${err.code || ""} ${err.message}`.trim();
  } finally {
    safe(() => db && db.close());
  }
  return result;
}

// Decide the single most likely root cause from the collected probes (+ the
// error thrown by the failed server start, when there is one).
function classify({ writable, ports, loopback, database }, startError) {
  const errStr = `${(startError && (startError.code || startError.message)) || ""}`;

  // 1. Native module missing/broken — nothing can work.
  if (database && database.nativeModule && !database.nativeModule.loaded) {
    return CAUSE.NATIVE_MODULE;
  }

  // 2. Cannot write where the DB / data must live → EPERM (install dir / locked-down PC).
  const dbDirNotWritable = writable && writable.dbDir && writable.dbDir.exists && !writable.dbDir.writable;
  if (/EPERM|EACCES/i.test(errStr) || dbDirNotWritable) {
    return CAUSE.DB_EPERM;
  }

  // 3. DB present but cannot be opened.
  if (database && database.exists && database.open && !database.open.ok) {
    if (/SQLITE_BUSY|locked/i.test(database.open.error || "")) return CAUSE.DB_LOCKED;
    return CAUSE.DB_CORRUPT;
  }
  if (database && database.integrity === "errors") return CAUSE.DB_CORRUPT;

  // 4. No free port in the whole range.
  if (/EADDRINUSE/i.test(errStr) || (ports && Array.isArray(ports.free) && ports.free.length === 0)) {
    return CAUSE.PORT_EXHAUSTED;
  }

  // 5. Server is listening but loopback can't be reached → AV/proxy blocking 127.0.0.1.
  if (loopback && loopback.tested && !loopback.anyOk) {
    return CAUSE.LOOPBACK_BLOCKED;
  }

  if (startError) return CAUSE.SERVER_NEVER_STARTED;
  return CAUSE.OK;
}

/**
 * Run all probes and (optionally) classify against a server start error.
 *
 * @param {object} opts
 * @param {string} [opts.dbPath]   resolved DB file path (process.env.DB_PATH)
 * @param {number} [opts.port]     port the server is/should be on (process.env.ACTUAL_PORT)
 * @param {Error}  [opts.startError] the error that failed startEmbeddedServer, if any
 * @param {boolean} [opts.write=true] write diagnostic-report.json to the log dir
 * @returns {Promise<object>} the diagnostic report (never throws)
 */
async function runStartupDiagnostics(opts = {}) {
  const dbPath = opts.dbPath || process.env.DB_PATH || null;
  const port = Number(opts.port || process.env.ACTUAL_PORT || 0) || null;
  const startError = opts.startError || null;

  const logDir = safe(() => resolveLogDir(), null);
  const dataDir = process.env.RETAILER_DATA_DIR || (process.env.ProgramData && path.join(process.env.ProgramData, "ElHegaziRetailer"));

  const writable = {
    dbDir: probeWritableDir(dbPath ? path.dirname(dbPath) : null),
    dataDir: probeWritableDir(dataDir),
    logDir: probeWritableDir(logDir),
  };

  const [ports, database] = await Promise.all([
    probePortRange(),
    Promise.resolve(probeDatabase(dbPath)),
  ]);

  // Only meaningful when a server is supposedly up — skip when start failed outright.
  const loopback = startError ? { tested: false } : await probeLoopback(port);

  const probes = { writable, ports, loopback, database };
  const cause = classify(probes, startError);

  const report = {
    ts: new Date().toISOString(),
    cause,
    port,
    dbPath,
    appVersion: safe(() => require("../package.json").version, null),
    os: { platform: process.platform, release: os.release(), arch: process.arch },
    startError: startError ? { code: startError.code || null, message: startError.message || String(startError) } : null,
    probes,
  };

  if (opts.write !== false) writeReport(report);
  return report;
}

function reportPath() {
  return path.join(safe(() => resolveLogDir(), os.tmpdir()), "diagnostic-report.json");
}

function writeReport(report) {
  safe(() => fs.writeFileSync(reportPath(), JSON.stringify(report, null, 2), "utf8"));
}

function readReport() {
  return safe(() => JSON.parse(fs.readFileSync(reportPath(), "utf8")), null);
}

// Map a raw thrown server-start error to a cause WITHOUT running the full probe
// suite — used for the fast path where we just need a label immediately.
function classifyStartError(err) {
  const s = `${(err && (err.code || err.message)) || ""}`;
  if (/EPERM|EACCES/i.test(s)) return CAUSE.DB_EPERM;
  if (/EADDRINUSE/i.test(s)) return CAUSE.PORT_EXHAUSTED;
  if (/better-sqlite3|native|MODULE_NOT_FOUND/i.test(s)) return CAUSE.NATIVE_MODULE;
  if (/SQLITE_BUSY|locked/i.test(s)) return CAUSE.DB_LOCKED;
  if (/تلف في قاعدة البيانات|integrity|corrupt|malformed/i.test(s)) return CAUSE.DB_CORRUPT;
  if (s) return CAUSE.SERVER_NEVER_STARTED;
  return CAUSE.UNKNOWN;
}

// Arabic title + guidance per cause, for the native (no-renderer) error screen.
// The React overlay uses its own i18n locale keys; this is the main-process copy.
const CAUSE_TEXT = {
  [CAUSE.DB_EPERM]: {
    title: "تعذّر الوصول لملفات البرنامج",
    friendly:
      "ليس لدى البرنامج صلاحية الكتابة في مجلد البيانات. شغّل البرنامج كمسؤول (Run as administrator)، أو انقله خارج مجلد Program Files.",
  },
  [CAUSE.DB_LOCKED]: {
    title: "قاعدة البيانات مشغولة",
    friendly:
      "ملف قاعدة البيانات مفتوح من نسخة أخرى للبرنامج أو من برنامج آخر. أغلق أي نسخة أخرى مفتوحة ثم أعد التشغيل.",
  },
  [CAUSE.DB_CORRUPT]: {
    title: "تلف في قاعدة البيانات",
    friendly: "تعذّر فتح قاعدة البيانات سليمة. استخدم النسخ الاحتياطي لاستعادة نسخة سليمة.",
  },
  [CAUSE.PORT_EXHAUSTED]: {
    title: "المنافذ مشغولة",
    friendly:
      "كل المنافذ المتاحة للبرنامج مشغولة ببرامج أخرى. أغلق البرامج التي تستخدم نفس المنافذ ثم أعد التشغيل.",
  },
  [CAUSE.LOOPBACK_BLOCKED]: {
    title: "الاتصال المحلي محجوب",
    friendly:
      "يبدو أن برنامج الحماية (Antivirus) أو إعداد البروكسي يمنع الاتصال المحلي (127.0.0.1). أضف البرنامج لقائمة الاستثناءات في برنامج الحماية.",
  },
  [CAUSE.NATIVE_MODULE]: {
    title: "مكوّن داخلي مفقود",
    friendly:
      "تعذّر تحميل مكوّن قاعدة البيانات. قد تحتاج لتثبيت حزمة Microsoft Visual C++ Redistributable، أو إعادة تثبيت البرنامج.",
  },
  [CAUSE.SERVER_NEVER_STARTED]: {
    title: "فشل تشغيل الخادم الداخلي",
    friendly: "تعذّر بدء تشغيل قاعدة البيانات أو الخادم الداخلي للبرنامج.",
  },
};

function describeCause(cause) {
  return (
    CAUSE_TEXT[cause] || {
      title: "فشل تشغيل الخادم الداخلي",
      friendly: "تعذّر بدء تشغيل قاعدة البيانات أو الخادم الداخلي للبرنامج.",
    }
  );
}

module.exports = {
  CAUSE,
  runStartupDiagnostics,
  classifyStartError,
  describeCause,
  readReport,
  reportPath,
};
