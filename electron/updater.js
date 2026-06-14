let autoUpdater = null;

try {
  autoUpdater = require("electron-updater").autoUpdater;
} catch {
  // electron-updater not available (e.g. dev mode)
}

let _mainWindow = null;

function send(channel, payload) {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send(channel, payload);
  }
}

function sendError(err) {
  const message =
    (err && err.message) ||
    (typeof err === "string" ? err : "") ||
    "تعذر التحقق من التحديثات. يرجى التأكد من اتصال الإنترنت.";
  send("update:error", { message });
}

function setupAutoUpdater(mainWindow) {
  _mainWindow = mainWindow;

  if (!autoUpdater) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => send("update:available", info));
  autoUpdater.on("update-not-available", () => send("update:not-available"));
  autoUpdater.on("download-progress", (progress) => send("update:progress", progress));
  autoUpdater.on("update-downloaded", (info) => send("update:downloaded", info));
  autoUpdater.on("error", (err) => sendError(err));

  // Initial check on launch — surface failures instead of swallowing them.
  autoUpdater.checkForUpdates().catch(sendError);
}

function checkForUpdates() {
  if (!autoUpdater || !_mainWindow) {
    sendError("خدمة التحديث غير متاحة في هذه النسخة.");
    return;
  }
  autoUpdater.checkForUpdates().catch(sendError);
}

function downloadUpdate() {
  if (!autoUpdater || !_mainWindow) {
    sendError("خدمة التحديث غير متاحة في هذه النسخة.");
    return;
  }
  autoUpdater.downloadUpdate().catch(sendError);
}

function quitAndInstall() {
  if (!autoUpdater) return;
  autoUpdater.quitAndInstall();
}

module.exports = { setupAutoUpdater, checkForUpdates, downloadUpdate, quitAndInstall };
