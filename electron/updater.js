const { autoUpdater } = require("electron-updater");
const { dialog } = require("electron");

function setupAutoUpdater(mainWindow) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "تحديث متاح",
        message: `يتوفر إصدار جديد (${info.version}). هل تريد تنزيله الآن؟`,
        buttons: ["تنزيل", "لاحقاً"],
        defaultId: 0,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
  });

  autoUpdater.on("update-downloaded", () => {
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "تم التنزيل",
        message: "تم تنزيل التحديث. سيتم تثبيته عند إعادة التشغيل.",
        buttons: ["إعادة التشغيل الآن", "لاحقاً"],
        defaultId: 0,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on("error", (err) => {
    console.error("Auto-updater error:", err.message);
  });

  // Check for updates silently on app start
  autoUpdater.checkForUpdates().catch(() => {});
}

module.exports = { setupAutoUpdater };
