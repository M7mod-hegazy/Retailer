const fs = require("fs");
const path = require("path");
const { ipcMain, app, dialog, BrowserWindow, nativeImage } = require("electron");
const { execFileSync, execSync } = require("child_process");
const { closeDb, getDbPath, initDb } = require("../server/src/config/database");
const { performBackup, isLikelySqliteFile } = require("../server/src/services/backupService");
const { activateLicense, isLicenseValid } = require("./licenseManager");

function safeDbPath() {
  return process.env.DB_PATH || path.join(process.cwd(), "data", "retailer.db");
}

function verifyOwnerMaintenancePassword(password) {
  const configured = String(process.env.OWNER_MAINTENANCE_PASSWORD || "275757");
  const actual = String(password || "");
  const expectedBuf = Buffer.from(configured, "utf8");
  const actualBuf = Buffer.from(actual, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return require("crypto").timingSafeEqual(expectedBuf, actualBuf);
}

function isWindowsAdmin() {
  if (process.platform !== "win32") return false;
  try {
    execSync("net session", { stdio: "ignore" });
    return true;
  } catch (_error) {
    return false;
  }
}

function resolveUninstallerPath() {
  const installDir = path.dirname(process.execPath);
  const candidates = fs
    .readdirSync(installDir)
    .filter((name) => /^Uninstall .*\.exe$/i.test(name))
    .map((name) => path.join(installDir, name));
  return candidates[0] || null;
}

let handlersRegistered = false;

function setupIpc(window) {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle("system:get-version", () => app.getVersion());

  ipcMain.handle("app:set-icon", async (_event, payload = {}) => {
    const logoUrl = String(payload.logo_url || "").trim();
    try {
      const { updateTrayIcon } = require("./tray");
      if (!logoUrl) {
        const defaultIcon = path.join(__dirname, "assets", process.platform === "win32" ? "icon.ico" : "icon.png");
        const defaultTray = path.join(__dirname, "assets", "tray-icon.png");
        const defaultImage = nativeImage.createFromPath(defaultIcon);
        const trayImage = nativeImage.createFromPath(defaultTray);
        const wins = BrowserWindow.getAllWindows();
        wins.forEach((w) => { if (!w.isDestroyed()) w.setIcon(defaultImage); });
        updateTrayIcon(trayImage);
        return { success: true, reset: true };
      }
      const filename = path.basename(logoUrl);
      const uploadsDir = process.env.UPLOADS_DIR
        ? path.join(process.env.UPLOADS_DIR, "uploads")
        : path.join(__dirname, "../../uploads");
      const logoPath = path.join(uploadsDir, filename);
      if (!fs.existsSync(logoPath)) return { success: false, error: "file_not_found" };
      const image = nativeImage.createFromPath(logoPath);
      if (image.isEmpty()) return { success: false, error: "invalid_image" };
      const trayImage = image.resize({ width: 32, height: 32, quality: "best" });
      const wins = BrowserWindow.getAllWindows();
      wins.forEach((w) => { if (!w.isDestroyed()) w.setIcon(image); });
      updateTrayIcon(trayImage);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.on("window:minimize", () => window.minimize());
  ipcMain.on("window:maximize", () => {
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.on("window:close", () => window.close());

  ipcMain.handle("license:status", () => isLicenseValid());
  ipcMain.handle("license:activate", async (_event, payload = {}) => {
    const serverUrl = String(payload.server_url || "").trim();
    const licenseKey = String(payload.license_key || "").trim();
    if (!serverUrl || !licenseKey) {
      return { success: false, error: "missing_params" };
    }
    return activateLicense(licenseKey, serverUrl);
  });

  ipcMain.handle("backup:create", async () => {
    const filePath = performBackup();
    return { success: true, file_path: filePath };
  });

  ipcMain.handle("backup:restore", async (_event, payload = {}) => {
    const sourcePath = String(payload.file_path || "").trim();
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return { success: false, error: "backup_not_found" };
    }

    if (!isLikelySqliteFile(sourcePath)) {
      return { success: false, error: "invalid_backup_file" };
    }

    const rollbackBackup = performBackup();
    const destinationPath = getDbPath() || safeDbPath();
    const stagedPath = `${destinationPath}.restore-staged`;
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, stagedPath);

    closeDb();
    try {
      fs.copyFileSync(stagedPath, destinationPath);
      initDb(destinationPath);
      fs.unlinkSync(stagedPath);
      return { success: true, rollback_backup: rollbackBackup };
    } catch (_error) {
      try {
        fs.copyFileSync(rollbackBackup, destinationPath);
        initDb(destinationPath);
      } catch {}
      return { success: false, error: "restore_failed" };
    }
  });

  ipcMain.handle("print:receipt", async () => {
    const success = await window.webContents.print({ silent: false, printBackground: true });
    return { success };
  });
  ipcMain.handle("print:preview", async () => {
    const success = await window.webContents.print({ silent: false, printBackground: true });
    return { success };
  });

  ipcMain.handle("maintenance:status", async () => {
    const uninstallerPath = resolveUninstallerPath();
    return {
      success: true,
      data: {
        is_windows_admin: isWindowsAdmin(),
        has_uninstaller: Boolean(uninstallerPath),
        uninstaller_path: uninstallerPath,
      },
    };
  });

  ipcMain.handle("maintenance:request-uninstall", async (_event, payload = {}) => {
    const password = String(payload.password || "");
    if (!verifyOwnerMaintenancePassword(password)) {
      return { success: false, error: "invalid_owner_password" };
    }

    const uninstallerPath = resolveUninstallerPath();
    if (!uninstallerPath) {
      return { success: false, error: "uninstaller_not_found" };
    }

    if (process.platform !== "win32") {
      return { success: false, error: "windows_only_action" };
    }

    try {
      execFileSync("powershell", [
        "-NoProfile",
        "-Command",
        `Start-Process -FilePath '${uninstallerPath.replace(/'/g, "''")}' -Verb RunAs`,
      ]);
      return { success: true, data: { launched: true } };
    } catch (_error) {
      return { success: false, error: "uninstall_launch_failed" };
    }
  });

  ipcMain.handle("dialog:open-file", async (_event, payload = {}) => {
    const result = await dialog.showOpenDialog(window, {
      title: payload.title || "Select file",
      properties: payload.properties || ["openFile"],
      filters: payload.filters || [],
    });
    return result;
  });
  ipcMain.handle("dialog:save-file", async (_event, payload = {}) => {
    const result = await dialog.showSaveDialog(window, {
      title: payload.title || "Save file",
      defaultPath: payload.defaultPath,
      filters: payload.filters || [],
    });
    return result;
  });
}

module.exports = { setupIpc };
