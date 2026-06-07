// Web-mode entry point.
//
// Unlike main.js (which opens the app inside its own Electron window), this entry
// starts the embedded Express server and opens the app in the user's default
// browser, then stays alive in the system tray. Used for the "Web" installer.
//
// For a single PC the server binds to 127.0.0.1 (localhost) — exactly what the
// user wants: the same PC runs it and opens it in the browser.

const { app, Tray, Menu, shell, dialog, nativeImage } = require("electron");
const path = require("path");
const { startEmbeddedServer, stopEmbeddedServer } = require("./serverManager");

const PORT = Number(process.env.PORT || 5000);
const URL = `http://127.0.0.1:${PORT}`;

let tray = null;

if (process.platform === "win32") {
  app.setAppUserModelId("com.elhegazi.retailer.web");
}

function createTray() {
  const iconPath = path.join(__dirname, "assets", "icon.ico");
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip("ElHegazi Retailer (Web)");
  const menu = Menu.buildFromTemplate([
    { label: "فتح في المتصفح / Open in Browser", click: () => shell.openExternal(URL) },
    { type: "separator" },
    { label: "خروج / Quit", click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on("double-click", () => shell.openExternal(URL));
}

// Single-instance: if it's already running, just reopen the browser and exit.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  shell.openExternal(URL);
  app.quit();
} else {
  app.on("second-instance", () => shell.openExternal(URL));

  app.whenReady().then(async () => {
    if (!process.env.DB_PATH) {
      const programDataRoot = process.env.ProgramData || app.getPath("appData");
      const appRoot = path.join(programDataRoot, "ElHegaziRetailer");
      process.env.DB_PATH = path.join(appRoot, "data", "retailer.db");
      process.env.UPLOADS_DIR = appRoot;
    }

    try {
      await startEmbeddedServer();
    } catch (err) {
      dialog.showErrorBox(
        "خطأ في تشغيل البرنامج",
        `فشل تشغيل الخادم الداخلي:\n\n${err.message}\n\nيرجى إعادة المحاولة أو التواصل مع الدعم الفني.`,
      );
      app.quit();
      return;
    }

    createTray();
    shell.openExternal(URL);
  });

  app.on("before-quit", () => {
    app.isQuitting = true;
    stopEmbeddedServer().catch(() => {});
    if (tray) { tray.destroy(); tray = null; }
  });

  // No windows in web mode — stay alive in the tray, do not quit.
  app.on("window-all-closed", () => {});
}
