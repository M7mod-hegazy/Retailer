const { app, BrowserWindow, dialog, powerMonitor } = require("electron");
const path = require("path");
const { createTray, destroyTray } = require("./tray");
const { buildMenu } = require("./menuBuilder");
const { setupIpc } = require("./ipcHandlers");
const { startEmbeddedServer, stopEmbeddedServer } = require("./serverManager");

const isDev = !app.isPackaged;
if (process.platform === "win32") {
  app.setAppUserModelId("com.elhegazi.retailer");
}
let splashWindow = null;
let mainWindow = null;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
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

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (isDev && devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, "..", "client", "dist", "index.html"),
    );
  }

  mainWindow.once("ready-to-show", () => {
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
    if (!process.env.DB_PATH) {
      const programDataRoot = process.env.ProgramData || app.getPath("appData");
      const appRoot = path.join(programDataRoot, "ElHegaziRetailer");
      process.env.DB_PATH = path.join(appRoot, "data", "retailer.db");
      process.env.UPLOADS_DIR = appRoot;
    }

    // Show splash immediately so the user sees feedback
    createSplashWindow();

    try {
      // Wait for the Express server to be fully ready BEFORE opening the window.
      // This prevents the blank-screen / API-not-ready race condition.
      if (!isDev) {
        await startEmbeddedServer();
      }
    } catch (err) {
      // Server failed to start — show error and quit
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.destroy();
      }
      dialog.showErrorBox(
        "خطأ في تشغيل البرنامج",
        `فشل تشغيل الخادم الداخلي:\n\n${err.message}\n\nيرجى إعادة المحاولة أو التواصل مع الدعم الفني.`,
      );
      app.quit();
      return;
    }

    // Server is ready — now open the main window
    createMainWindow();

    // If the user uploaded a custom logo, apply it as the app icon
    if (process.env.DB_PATH) {
      try {
        const Database = require("better-sqlite3");
        const db = new Database(process.env.DB_PATH, { readonly: true });
        const row = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'logo_url'").get();
        db.close();
        if (row && row.setting_value) {
          const fs = require("fs");
          const { nativeImage, BrowserWindow } = require("electron");
          const { updateTrayIcon } = require("./tray");
          const filename = require("path").basename(row.setting_value);
          const uploadsDir = process.env.UPLOADS_DIR
            ? require("path").join(process.env.UPLOADS_DIR, "uploads")
            : require("path").join(__dirname, "../uploads");
          const logoPath = require("path").join(uploadsDir, filename);
          if (fs.existsSync(logoPath)) {
            const image = nativeImage.createFromPath(logoPath);
            if (!image.isEmpty()) {
              const trayImage = image.resize({ width: 32, height: 32, quality: "best" });
              const wins = BrowserWindow.getAllWindows();
              wins.forEach((w) => { if (!w.isDestroyed()) w.setIcon(image); });
              updateTrayIcon(trayImage);
            }
          }
        }
      } catch (_e) {
        // non-critical — fall back to default icon
      }
    }

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

  app.on("before-quit", () => {
    app.isQuitting = true;
    destroyTray();
    stopEmbeddedServer().catch(() => {});
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
