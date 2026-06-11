let autoUpdater = null;

try {
  autoUpdater = require("electron-updater").autoUpdater;
} catch {
  // electron-updater not available (e.g. dev mode)
}

let _mainWindow = null;

function setupAutoUpdater(mainWindow) {
  _mainWindow = mainWindow;

  if (!autoUpdater) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.send("update:available", info);
    }
  });

  autoUpdater.on("update-not-available", () => {
    if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.send("update:not-available");
    }
  });

  autoUpdater.on("download-progress", (progress) => {
    if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.send("update:progress", progress);
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.send("update:downloaded", info);
    }
  });

  autoUpdater.on("error", (err) => {
    if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.send("update:error", { message: err.message });
    }
  });

  autoUpdater.checkForUpdates().catch(() => {});
}

function checkForUpdates() {
  if (!autoUpdater || !_mainWindow) return;
  autoUpdater.checkForUpdates().catch(() => {});
}

function downloadUpdate() {
  if (!autoUpdater || !_mainWindow) return;
  autoUpdater.downloadUpdate().catch(() => {});
}

function quitAndInstall() {
  if (!autoUpdater) return;
  autoUpdater.quitAndInstall();
}

module.exports = { setupAutoUpdater, checkForUpdates, downloadUpdate, quitAndInstall };
