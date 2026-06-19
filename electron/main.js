// Pin the process to Egypt local time before anything touches Date, so the
// embedded server and any bare `new Date()` path use Cairo regardless of the
// host machine's timezone.
process.env.TZ = "Africa/Cairo";

const { app, BrowserWindow, dialog, powerMonitor } = require("electron");
const path = require("path");
const fs = require("fs");
const { createTray, destroyTray } = require("./tray");
const { buildMenu } = require("./menuBuilder");
const { setupIpc } = require("./ipcHandlers");
const { startEmbeddedServer, stopEmbeddedServer } = require("./serverManager");
const { ensurePackagedEnv } = require("./ensurePackagedEnv");
const { logError, getLogPath, resolveLogDir } = require("./crashLogger");
const { showErrorScreen } = require("./errorScreen");

const isDev = !app.isPackaged;

// ── Win7 / legacy-GPU stability + NATIVE crash capture ─────────────────────
// The Windows "has stopped working" (WER) dialog comes from a *native* crash
// that happens before any JS error handler can run. Two mitigations:
//   1) Disable GPU / hardware acceleration. An instant crash on launch under a
//      Win7 compatibility shim is most often the Chromium GPU process failing
//      against old/unsupported display drivers. Forcing software rendering
//      (SwiftShader) avoids it.
//   2) Capture native minidumps + Chromium logs so even a hard crash leaves a
//      readable trace next to our normal log file.
try {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("force-swiftshader");

  const diagDir = resolveLogDir();
  try { app.setPath("crashDumps", diagDir); } catch (_e) {}
  const { crashReporter } = require("electron");
  crashReporter.start({ submitURL: "", uploadToServer: false, compress: false });

  // Chromium's own log — records GPU/ANGLE init failures that explain the crash.
  app.commandLine.appendSwitch("enable-logging");
  app.commandLine.appendSwitch("log-file", path.join(diagDir, "chrome-debug.log"));
  logError("startup", new Error(`Diagnostic build starting. Logs -> ${diagDir}`));
} catch (e) {
  logError("diagnostic/GPU setup failed", e);
}

// ── Global last-resort error capture ───────────────────────────────────────
// On older Windows (e.g. Win7 via a compatibility shim) the renderer can die
// silently. Capture everything so the user always sees *something* readable
// and we always leave a log file behind for support.
process.on("uncaughtException", (err) => {
  logError("uncaughtException (main process)", err);
  try {
    showErrorScreen({
      title: "خطأ غير متوقع في البرنامج",
      detail: (err && err.stack) || String(err),
    });
  } catch (_e) {}
});

process.on("unhandledRejection", (reason) => {
  logError("unhandledRejection (main process)", reason);
});
if (process.platform === "win32") {
  app.setAppUserModelId("com.elhegazi.retailer");
}
let splashWindow = null;
let mainWindow = null;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 340,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  // Load a proper splash from the assets folder if it exists,
  // otherwise fall back to the inline data URL
  const splashPath = path.join(__dirname, "assets", "splash.html");
  const fs = require("fs");
  if (fs.existsSync(splashPath)) {
    splashWindow.loadFile(splashPath);
  } else {
    splashWindow.loadURL(
      `data:text/html;charset=utf-8,` +
        encodeURIComponent(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    font-family: 'Segoe UI', sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #f8fafc;
    border-radius: 14px;
    gap: 16px;
    overflow: hidden;
  }
  h1 { font-size: 22px; font-weight: 700; color: #10b981; }
  p  { font-size: 13px; color: #94a3b8; }
  .bar {
    width: 180px; height: 3px;
    background: #1e293b;
    border-radius: 99px;
    overflow: hidden;
  }
  .bar-inner {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #34d399);
    border-radius: 99px;
    animation: grow 2.5s ease-out forwards;
  }
  @keyframes grow { from { width: 0% } to { width: 90% } }
</style>
</head>
<body>
  <h1>ElHegazi Retailer</h1>
  <p>جاري التحميل...</p>
  <div class="bar"><div class="bar-inner"></div></div>
</body>
</html>`),
    );
  }

  splashWindow.once("ready-to-show", () => splashWindow.show());
}

function destroySplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
    splashWindow = null;
  }
}

function loadWindowState() {
  try {
    const stateFile = path.join(app.getPath("userData"), "window-state.json");
    const fs = require("fs");
    if (fs.existsSync(stateFile)) return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch (_) {}
  return { maximized: true };
}

function saveWindowState(win) {
  try {
    const stateFile = path.join(app.getPath("userData"), "window-state.json");
    const fs = require("fs");
    const maximized = win.isMaximized();
    const state = { maximized };
    if (!maximized) {
      const b = win.getBounds();
      state.x = b.x; state.y = b.y; state.width = b.width; state.height = b.height;
    }
    fs.writeFileSync(stateFile, JSON.stringify(state));
  } catch (_) {}
}

function createMainWindow() {
  const winState = loadWindowState();

  mainWindow = new BrowserWindow({
    width:     winState.width  || 1400,
    height:    winState.height || 900,
    x:         winState.x,
    y:         winState.y,
    minWidth:  1100,
    minHeight: 700,
    show: false,
    title: "ElHegazi Retailer",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets", process.platform === "win32" ? "icon.ico" : "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // ── Renderer failure capture ─────────────────────────────────────────────
  // Any of these used to result in a silent blank window. Now they log and
  // render a visible error screen so failures are diagnosable on the customer
  // machine (especially Win7 under the compatibility shim).
  let shownReady = false;

  const wc = mainWindow.webContents;

  wc.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL) => {
    // -3 = ERR_ABORTED (e.g. an in-app navigation was cancelled) — not a crash.
    if (errorCode === -3) return;
    const detail = `did-fail-load\ncode: ${errorCode}\ndesc: ${errorDescription}\nurl: ${validatedURL}`;
    logError("Renderer did-fail-load", new Error(detail));
    destroySplash();
    showErrorScreen({
      title: "فشل تحميل واجهة البرنامج",
      friendly: "تعذّر تحميل واجهة التطبيق. قد تكون ملفات البرنامج ناقصة أو غير متوافقة مع نظام التشغيل.",
      detail,
    });
  });

  wc.on("render-process-gone", (_e, details) => {
    const detail = `render-process-gone\nreason: ${details && details.reason}\nexitCode: ${details && details.exitCode}`;
    logError("Renderer process gone", new Error(detail));
    destroySplash();
    showErrorScreen({
      title: "توقّف عرض البرنامج بشكل مفاجئ",
      friendly: "انهارت عملية عرض الواجهة. غالباً بسبب توافق نظام التشغيل (Windows 7) أو تعريف كرت الشاشة.",
      detail,
    });
  });

  // Forward renderer console errors into the log file for remote diagnosis.
  wc.on("console-message", (_e, level, message, line, sourceId) => {
    if (level >= 3) {
      logError("Renderer console error", new Error(`${message}\n  at ${sourceId}:${line}`));
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (isDev && devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, "..", "client", "dist", "index.html"),
    );
  }

  // Watchdog: if the window never becomes ready (stuck render pipeline), don't
  // leave the user staring at a frozen splash — surface a readable error.
  const readyWatchdog = setTimeout(() => {
    if (!shownReady) {
      logError(
        "ready-to-show watchdog timeout",
        new Error("Main window did not become ready within 20s — renderer likely failed to paint."),
      );
      destroySplash();
      showErrorScreen({
        title: "لم تُفتح واجهة البرنامج",
        friendly: "استغرق تحميل الواجهة وقتاً طويلاً ولم تظهر. قد يكون النظام غير متوافق أو تعريف كرت الشاشة بحاجة لتحديث.",
        detail: "Main window 'ready-to-show' did not fire within 20 seconds.",
      });
    }
  }, 20000);

  mainWindow.once("ready-to-show", () => {
    shownReady = true;
    clearTimeout(readyWatchdog);
    // Destroy splash before showing main window
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    if (winState.maximized !== false) {
      mainWindow.maximize();
    }
    mainWindow.show();
    mainWindow.focus();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  // Save window state on resize/move/close
  const persistState = () => saveWindowState(mainWindow);
  mainWindow.on("resize", persistState);
  mainWindow.on("move", persistState);
  mainWindow.on("maximize", persistState);
  mainWindow.on("unmaximize", persistState);

  // Minimize to tray instead of closing
  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  buildMenu(mainWindow);
  createTray(mainWindow);
  setupIpc(mainWindow);

  // Auto-updater (production only)
  if (!isDev) {
    try {
      const { setupAutoUpdater } = require("./updater");
      setupAutoUpdater(mainWindow);
    } catch (_err) {
      // updater not available — continue
    }
  }
}

// ── Single instance lock ──────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    if (!isDev) ensurePackagedEnv();

    // ── Downgrade warning ─────────────────────────────────────────────────
    if (!isDev) {
      const versionFile = path.join(app.getPath("userData"), "version.json");
      const current = app.getVersion();
      try {
        if (fs.existsSync(versionFile)) {
          const { version: prev } = JSON.parse(fs.readFileSync(versionFile, "utf8"));
          if (prev && prev !== current) {
            const parseSemver = (v) => v.split(".").map(Number);
            const [pa, pb, pc] = parseSemver(prev);
            const [ca, cb, cc] = parseSemver(current);
            const isDowngrade = ca < pa || (ca === pa && cb < pb) || (ca === pa && cb === pb && cc < pc);
            if (isDowngrade) {
              const choice = dialog.showMessageBoxSync(null, {
                type: "warning",
                title: "تحذير: تراجع في الإصدار",
                message: "أنت تشغّل إصداراً أقدم مما كان مُثبّتاً",
                detail: `الإصدار السابق: ${prev}\nالإصدار الحالي: ${current}\n\nالتراجع قد يُتلف قاعدة البيانات. يُنصح بالنسخ الاحتياطي أولاً.`,
                buttons: ["متابعة على مسؤوليتي", "إغلاق البرنامج"],
                defaultId: 1,
                cancelId: 1,
              });
              if (choice === 1) { app.exit(0); return; }
            }
          }
        }
        fs.mkdirSync(path.dirname(versionFile), { recursive: true });
        fs.writeFileSync(versionFile, JSON.stringify({ version: current }));
      } catch (_) {}
    }

    // Show splash immediately so the user sees feedback
    createSplashWindow();

    // ── Migration progress → splash ───────────────────────────────────────
    const { setMigrationProgress } = require("./migrationEvents");
    setMigrationProgress((msg) => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        const safe = msg.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        splashWindow.webContents
          .executeJavaScript(`typeof updateStatus==='function'&&updateStatus('${safe}')`)
          .catch(() => {});
      }
    });

    try {
      // Wait for the Express server to be fully ready BEFORE opening the window.
      // This prevents the blank-screen / API-not-ready race condition.
      if (!isDev) {
        await startEmbeddedServer();
      }
    } catch (err) {
      // Server failed to start — log it, run the self-diagnostic to identify the
      // real cause, then show a readable, cause-specific error screen and keep it
      // open (don't instantly quit) so the user can read/copy the details.
      logError("Embedded server failed to start", err);
      destroySplash();

      const { runStartupDiagnostics, describeCause } = require("./startupDiagnostics");
      let cause = null;
      let reportPathStr = null;
      try {
        const { classifyStartError, reportPath } = require("./startupDiagnostics");
        cause = classifyStartError(err);
        // Full probe suite (writes diagnostic-report.json) — best-effort.
        await runStartupDiagnostics({ startError: err }).then((r) => { cause = r.cause; }).catch(() => {});
        reportPathStr = reportPath();
      } catch (_e) {}

      const text = describeCause(cause);
      const win = showErrorScreen({
        title: text.title,
        friendly: text.friendly,
        detail:
          `[cause=${cause}]\n` +
          ((err && err.stack) || (err && err.message) || String(err)) +
          (reportPathStr ? `\n\nDiagnostic report: ${reportPathStr}` : ""),
      });
      // Quit once the user closes the error window.
      if (win) win.on("closed", () => app.quit());
      else app.quit();
      return;
    }

    // Server is ready — now open the main window
    createMainWindow();

    // Developer icon always stays — never replaced by customer upload

    // Lock the screen immediately when the system wakes from sleep
    powerMonitor.on("resume", () => {
      const wins = BrowserWindow.getAllWindows();
      wins.forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send("system:resume");
      });
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("before-quit", async () => {
    app.isQuitting = true;

    // Throttled safety backup on graceful quit — runs FIRST, while the embedded
    // server (and its open DB) are still alive. performBackup is synchronous and
    // fast (~tens of ms for a few-MB DB copy), so this completes before the
    // process tears down. Never allowed to block or fail the quit.
    try {
      const { runCloseBackup } = require("../server/src/jobs/autoBackup");
      runCloseBackup();
    } catch (_) {}

    destroyTray();
    stopEmbeddedServer().catch(() => {});
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
