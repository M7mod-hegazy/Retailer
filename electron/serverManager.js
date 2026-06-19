const path = require("path");
const { logError } = require("./crashLogger");
const { closeDb } = require("../server/src/config/database");
const { runStartupDiagnostics, classifyStartError } = require("./startupDiagnostics");

let serverRef = null;
let stopping = false;
let restartCount = 0;
// restartCount is reset to 0 after any successful (re)start, so this is the number of
// CONSECUTIVE failed restart attempts before giving up — not a lifetime cap. Kept
// generous so a transient crash (brief DB lock, slow disk) doesn't strand the user on
// the unrecoverable "fatal" screen.
const MAX_RESTARTS = 5;

function notifyRenderer(status, message = "", extra = {}) {
  // Persist every transition so a random production disconnect is explainable from the
  // crash log (%ProgramData%\ElHegaziRetailer\logs), distinguishing crash vs restart vs
  // fatal vs recovery, with the current port for spotting a port-mismatch.
  const port = process.env.ACTUAL_PORT || "?";
  logError(
    `server:status → ${status}`,
    `${message || ""} (cause=${extra.cause || "?"}, port=${port}, restartCount=${restartCount})`,
  );
  try {
    const { BrowserWindow } = require("electron");
    const payload = { status, message, port: process.env.ACTUAL_PORT || null, ...extra };
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send("server:status", payload);
    });
  } catch (_e) {
    // renderer not ready yet — ignore
  }
}

// Fire-and-forget: run the full diagnostic suite and re-notify the renderer with
// the precise cause so the overlay can show a specific, fixable message instead
// of a generic "server is down". Never throws.
function diagnoseAndNotify(status, message, startError) {
  runStartupDiagnostics({ startError })
    .then((report) => {
      notifyRenderer(status, message, { cause: report.cause, report: true });
    })
    .catch(() => {});
}

function clearServerModuleCache() {
  // Both development (absolute paths) and packaged (asar) paths contain this separator sequence.
  const mark = ["server", "src"].join(path.sep);
  Object.keys(require.cache).forEach((key) => {
    if (key.includes(mark)) delete require.cache[key];
  });
}

async function attemptRestart(lastError) {
  if (restartCount >= MAX_RESTARTS) {
    // Out of retries — run the full diagnostic so the fatal screen names the real
    // cause (DB locked, EPERM, port exhausted, loopback blocked …) instead of a
    // generic message, and write diagnostic-report.json for support.
    notifyRenderer("fatal", "فشل إعادة التشغيل بعد عدة محاولات. أعد تشغيل البرنامج.", {
      cause: classifyStartError(lastError),
    });
    diagnoseAndNotify("fatal", "فشل إعادة التشغيل بعد عدة محاولات. أعد تشغيل البرنامج.", lastError);
    return;
  }

  restartCount++;
  const delay = 2000 * restartCount; // 2s, 4s, 6s
  notifyRenderer("restarting", `محاولة ${restartCount} من ${MAX_RESTARTS}...`);

  await new Promise((r) => setTimeout(r, delay));

  // Release the old DB connection before clearing the module cache,
  // so a fresh initDb() in the restarted server opens a clean connection
  // instead of finding a stale singleton.
  try { closeDb(); } catch (_) {}

  clearServerModuleCache();
  serverRef = null;

  try {
    await startEmbeddedServer();
    restartCount = 0;
    notifyRenderer("online");
  } catch (err) {
    await attemptRestart(err);
  }
}

/**
 * Starts the embedded Express server and returns a Promise that resolves
 * only when the server is actually listening and ready to accept requests.
 * This prevents the Electron main window from opening before the API is up.
 */
function startEmbeddedServer() {
  if (serverRef) return Promise.resolve(serverRef);
  stopping = false;

  return new Promise((resolve, reject) => {
    let mod;
    try {
      mod = require("../server/src/index");
    } catch (err) {
      return reject(new Error(`Failed to load server module: ${err.message}`));
    }

    mod
      .startServer()
      .then((server) => {
        serverRef = server;

        try {
          const addr = server.address();
          logError("server:started", `listening on port ${addr && addr.port} (ACTUAL_PORT=${process.env.ACTUAL_PORT || "?"})`);
        } catch (_e) {}

        // Notify the renderer if the http.Server closes while the app is still running,
        // then attempt an automatic restart.
        let lastServerError = null;

        server.on("close", () => {
          if (!stopping) {
            serverRef = null;
            notifyRenderer("down", "توقف الخادم الداخلي بشكل غير متوقع", {
              cause: lastServerError ? classifyStartError(lastServerError) : "transient-disconnect",
            });
            attemptRestart(lastServerError);
          }
        });

        server.on("error", (err) => {
          if (!stopping) {
            lastServerError = err;
            notifyRenderer("down", err.message, { cause: classifyStartError(err) });
            // Don't restart on error events — the close event will fire next and handle it.
          }
        });

        resolve(server);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

function stopEmbeddedServer() {
  stopping = true;
  if (!serverRef) return Promise.resolve();
  return new Promise((resolve, reject) => {
    serverRef.close((err) => {
      if (err) return reject(err);
      serverRef = null;
      return resolve();
    });
  });
}

module.exports = { startEmbeddedServer, stopEmbeddedServer };
