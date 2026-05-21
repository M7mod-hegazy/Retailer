const path = require("path");

let serverRef = null;
let stopping = false;
let restartCount = 0;
const MAX_RESTARTS = 3;

function notifyRenderer(status, message = "") {
  try {
    const { BrowserWindow } = require("electron");
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send("server:status", { status, message });
    });
  } catch (_e) {
    // renderer not ready yet — ignore
  }
}

function clearServerModuleCache() {
  // Both development (absolute paths) and packaged (asar) paths contain this separator sequence.
  const mark = ["server", "src"].join(path.sep);
  Object.keys(require.cache).forEach((key) => {
    if (key.includes(mark)) delete require.cache[key];
  });
}

async function attemptRestart() {
  if (restartCount >= MAX_RESTARTS) {
    notifyRenderer("fatal", "فشل إعادة التشغيل بعد عدة محاولات. أعد تشغيل البرنامج.");
    return;
  }

  restartCount++;
  const delay = 2000 * restartCount; // 2s, 4s, 6s
  notifyRenderer("restarting", `محاولة ${restartCount} من ${MAX_RESTARTS}...`);

  await new Promise((r) => setTimeout(r, delay));

  clearServerModuleCache();
  serverRef = null;

  try {
    await startEmbeddedServer();
    restartCount = 0;
    notifyRenderer("online");
  } catch (_err) {
    await attemptRestart();
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

        // Notify the renderer if the http.Server closes while the app is still running,
        // then attempt an automatic restart.
        server.on("close", () => {
          if (!stopping) {
            serverRef = null;
            notifyRenderer("down", "توقف الخادم الداخلي بشكل غير متوقع");
            attemptRestart();
          }
        });

        server.on("error", (err) => {
          if (!stopping) {
            notifyRenderer("down", err.message);
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
