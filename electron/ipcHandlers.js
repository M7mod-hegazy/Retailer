const fs = require("fs");
const path = require("path");
const { ipcMain, app, dialog, BrowserWindow, nativeImage, shell } = require("electron");
const { execFileSync, execSync } = require("child_process");
const { closeDb, getDbPath, initDb, getDb } = require("../server/src/config/database");
const { performBackup, isLikelySqliteFile } = require("../server/src/services/backupService");
const { createModalWindow, getModalState, closeChildWindows } = require("./modalWindowManager");
const { firstWritableDir } = require("../server/src/config/paths");
const { resolveLogDir, getLogPath } = require("./crashLogger");
const { runStartupDiagnostics, readReport } = require("./startupDiagnostics");
const { getInstallStatus, clearInstallStatus } = require("./installProgress");


function safeDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  // Never fall back to process.cwd() — it is the read-only install dir in the packaged app.
  const dir = firstWritableDir([path.join(process.cwd(), "data")], "db");
  return path.join(dir, "retailer.db");
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

  // First-run flag: written by NSIS installer, consumed once then deleted
  ipcMain.handle("app:is-first-run", () => {
    const flagPath = require("path").join(app.getPath("userData"), "first-run.flag");
    const fs = require("fs");
    if (fs.existsSync(flagPath)) {
      try { fs.unlinkSync(flagPath); } catch (_) {}
      return true;
    }
    return false;
  });

  ipcMain.handle("get:api-url", () => {
    // Packaged app reaches the embedded server over the custom retailer:// protocol
    // (no TCP loopback → immune to antivirus/firewall blocking 127.0.0.1). Dev still
    // uses TCP since it loads the UI over http from the Vite dev server.
    if (app.isPackaged) return "retailer://local";
    const port = process.env.ACTUAL_PORT || "5000";
    return `http://127.0.0.1:${port}`;
  });

  // ── Diagnostics (work even when the embedded server is down) ──────────────
  // Return the last written diagnostic-report.json plus a tail of today's crash
  // log so the UI can show a copyable, support-friendly report.
  ipcMain.handle("diag:get-report", () => {
    let logTail = "";
    try {
      const content = fs.readFileSync(getLogPath(), "utf8");
      logTail = content.split("\n").slice(-200).join("\n");
    } catch (_e) {}
    return {
      report: readReport(),
      logTail,
      logDir: resolveLogDir(),
      port: process.env.ACTUAL_PORT || null,
      dbPath: process.env.DB_PATH || null,
      appVersion: app.getVersion(),
    };
  });

  // Open the log folder in the OS file explorer.
  ipcMain.handle("diag:open-logs", async () => {
    try {
      const dir = resolveLogDir();
      const err = await shell.openPath(dir);
      return { ok: !err, dir, error: err || null };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // Re-run the full diagnostic suite and attempt safe auto-fixes:
  //   - if the server isn't listening, try to (re)start it (picks a free port);
  //   - report what was attempted so the UI can guide the user on the rest.
  ipcMain.handle("diag:run-and-fix", async () => {
    const actions = [];
    let serverUp = !!process.env.ACTUAL_PORT;

    if (!serverUp) {
      try {
        const { startEmbeddedServer } = require("./serverManager");
        await startEmbeddedServer();
        serverUp = !!process.env.ACTUAL_PORT;
        actions.push({ key: "restart-server", ok: serverUp });
      } catch (e) {
        actions.push({ key: "restart-server", ok: false, error: e.message });
      }
    }

    const report = await runStartupDiagnostics({}).catch(() => null);
    return { report, actions, serverUp, cause: report ? report.cause : null };
  });

  ipcMain.handle("app:set-icon", async () => {
    return { success: true };
  });

  ipcMain.on("window:minimize", () => window.minimize());
  ipcMain.on("window:hide", () => {
    window.hide();
    // On Windows, hide() removes the window from the taskbar but the tray
    // icon remains active so the user can restore via double-click or menu.
  });
  ipcMain.on("window:maximize", () => {
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.on("window:close", () => window.close());

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

  // List installed printers so the user can pick a per-document device in settings.
  ipcMain.handle("print:list-printers", async () => {
    try {
      const printers = await window.webContents.getPrintersAsync();
      return {
        success: true,
        printers: (printers || []).map((p) => ({
          name: p.name,
          displayName: p.displayName || p.name,
          isDefault: !!p.isDefault,
          status: p.status,
        })),
      };
    } catch (error) {
      return { success: false, error: error.message, printers: [] };
    }
  });

  // Silent print: render the provided HTML in a hidden window and send it straight
  // to the configured printer (no OS dialog). Returns { success:false } so the
  // renderer can fall back to the dialog-based iframe path when this fails.
  ipcMain.handle("print:silent", async (_event, payload = {}) => {
    const { html = "", deviceName = "", copies = 1, pageSizeStr = "" } = payload;
    if (!html) return { success: false, error: "no_html" };
    const os = require("os");
    const tmpFile = path.join(os.tmpdir(), `retailer-print-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
    let printWin = null;
    try {
      fs.writeFileSync(tmpFile, html, "utf8");
      // Lay the hidden window out at the *paper* width so the receipt — which is
      // `width:<roll>mm; margin:0 auto` — centers with ZERO offset. With the old
      // default ~800px window, the 80mm receipt was centered inside an 800px body;
      // the forced 80mm print sheet (captured from x=0) then grabbed only the left
      // slice, so every roll print came out shifted right, clipped on the left, and
      // never filled the paper. Matching the window content width to the roll width
      // makes the body == the receipt width, so it aligns to the origin and fills.
      const rollWidthMm = /^58mm/.test(pageSizeStr) ? 58 : /^80mm/.test(pageSizeStr) ? 80 : 0;
      const winWidthPx = rollWidthMm ? Math.ceil((rollWidthMm * 96) / 25.4) : 800;
      // javascript must stay enabled so we can wait for fonts and measure the
      // rendered height below. The HTML is our own trusted print document (no
      // scripts); sandbox + a local temp file keep it isolated.
      printWin = new BrowserWindow({
        show: false,
        width: winWidthPx,
        height: 1200,
        useContentSize: true,
        webPreferences: { offscreen: false, sandbox: true },
      });
      await printWin.loadFile(tmpFile);

      // Electron's silent print IGNORES the CSS `@page { size }` rule, so a thermal
      // job sent without an explicit pageSize comes out on the driver's default
      // geometry — frequently a blank page. Wait for web fonts + layout to settle,
      // then measure the real content height and pass an explicit pageSize.
      let contentHeightPx = 0;
      try {
        contentHeightPx = await printWin.webContents.executeJavaScript(`
          new Promise((resolve) => {
            const measure = () => resolve(Math.ceil(Math.max(
              document.body.scrollHeight, document.documentElement.scrollHeight, 1)));
            const ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
            ready.then(() => requestAnimationFrame(() => requestAnimationFrame(measure)));
          })
        `);
      } catch { /* fall back to default geometry below */ }

      const MM = 1000;             // microns per millimetre
      const PX = 25400 / 96;       // microns per CSS pixel @96dpi
      const printOptions = {
        silent: true,
        printBackground: true,
        deviceName: deviceName || undefined,
        copies: Math.max(1, Number(copies) || 1),
        margins: { marginType: "none" },
        headerFooter: { header: "", footer: "" },
      };
      // Thermal rolls: explicit width + measured height (auto-height paper).
      // A4/A5: a named size Electron understands. If the height couldn't be
      // measured we fall back to ~300mm continuous roll so the content doesn't
      // get clipped on a tiny default page.
      if (rollWidthMm) {
        if (contentHeightPx > 0) {
          printOptions.pageSize = {
            width: rollWidthMm * MM,
            height: Math.ceil(contentHeightPx * PX),
          };
        } else {
          printOptions.pageSize = {
            width: rollWidthMm * MM,
            height: 300 * MM,
          };
        }
      } else if (/^148mm/.test(pageSizeStr)) {
        printOptions.pageSize = "A5";
      } else if (!rollWidthMm && pageSizeStr) {
        printOptions.pageSize = "A4";
      }

      // A small extra frame so the very last paint lands before the print snapshot.
      await new Promise((resolve) => setTimeout(resolve, 80));
      const result = await new Promise((resolve) => {
        printWin.webContents.print(
          printOptions,
          (success, failureReason) => resolve({ success, failureReason }),
        );
      });
      return { success: !!result.success, error: result.success ? null : (result.failureReason || "print_failed") };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (printWin && !printWin.isDestroyed()) printWin.destroy();
      try { fs.unlinkSync(tmpFile); } catch { /* ignore temp cleanup errors */ }
    }
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

  // ─── WhatsApp IPC (lazy loaded) ──────────────────────────────────────────
  let waEngine = null;

  function getWA() {
    if (!waEngine) {
      waEngine = require("./whatsapp/engine");
      waEngine.setDbProvider(getDb);
      waEngine.onStatusChange((state) => {
        window.webContents.send("wa:status-update", state);
      });
    }
    return waEngine;
  }

  ipcMain.handle("wa:status", () => getWA().getStatus());

  ipcMain.handle("wa:link", async () => {
    try { await getWA().connect(); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle("wa:unlink", async () => {
    try { await getWA().disconnect(); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle("wa:send", async (_event, payload = {}) => {
    try {
      const { phone, text, imageBase64, caption } = payload;
      const engine = getWA();
      const jid = engine.normalizePhone(phone);
      if (!jid) return { success: false, error: "invalid phone" };
      if (imageBase64) {
        await engine.sendImage(jid, Buffer.from(imageBase64, "base64"), caption || "");
      } else {
        await engine.sendText(jid, text || "");
      }
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  });

  // ─── Offline license gate ────────────────────────────────────────────────
  const licenseGate = require("./licenseGate");

  ipcMain.handle("license:getStatus", () => {
    // `packaged` lets the renderer fail CLOSED in the installed app while staying
    // lenient in dev/web. It is reported by the main process (trusted), not the
    // renderer, so it cannot be faked from the page.
    try {
      return { ...licenseGate.getStatus(), packaged: !!app.isPackaged };
    } catch (e) {
      return { activated: false, reason: "gate_error", packaged: !!app.isPackaged, error: e.message };
    }
  });

  ipcMain.handle("license:getHardwareId", async () => {
    try {
      return await licenseGate.getActivationInfo();
    } catch (e) {
      return { configured: false, hardwareId: null, error: e.message };
    }
  });

  ipcMain.handle("license:submit", (_event, payload = {}) => {
    try {
      return licenseGate.submitActivation(payload);
    } catch (e) {
      return { ok: false, reason: "gate_error", error: e.message };
    }
  });

  // ─── Quit app (triggered from renderer's QuitOrLogoutModal) ────────────
  ipcMain.handle("app:quit", () => {
    app.quit();
  });

  // ─── Update IPC ──────────────────────────────────────────────────────────
  const updater = require("./updater");

  ipcMain.handle("update:check", () => {
    updater.checkForUpdates();
    return { success: true };
  });

  ipcMain.handle("update:download", () => {
    updater.downloadUpdate();
    return { success: true };
  });

  ipcMain.handle("update:cancel-download", () => {
    updater.cancelDownload();
    return { success: true };
  });

  ipcMain.handle("update:install-now", () => {
    updater.quitAndInstall();
    return { success: true };
  });

  // ─── Manual Update IPC ───────────────────────────────────────────────────
  ipcMain.handle("update:get-manual-info", () => {
    return updater.getManualDownloadInfo();
  });

  ipcMain.handle("update:start-manual-download", () => {
    updater.startManualDownload();
    return { success: true };
  });

  ipcMain.handle("update:cancel-manual-download", () => {
    updater.cancelManualDownload();
    return { success: true };
  });

  ipcMain.handle("update:open-installer", () => {
    updater.openInstaller();
    return { success: true };
  });

  // ─── Version rollback / install a specific release ───────────────────────
  ipcMain.handle("update:list-releases", () => {
    return updater.listReleases();
  });

  ipcMain.handle("update:download-version", (_event, payload = {}) => {
    const version = String(payload.version || "").trim();
    if (!version) return { success: false, error: "no_version" };
    updater.downloadVersion(version);
    return { success: true };
  });

  // ─── Install progress status (used by renderer to show post-update state) ─
  ipcMain.handle("install:status", () => {
    return getInstallStatus() || { status: "idle" };
  });

  ipcMain.handle("install:clear", () => {
    clearInstallStatus();
    return { success: true };
  });

  // ─── Modal detach ────────────────────────────────────────────────────────
  ipcMain.handle("modal:create-child", (event, payload) => {
    const { modalType, state, bounds } = payload || {};
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: "no_parent_window" };
    const childId = createModalWindow(win, { modalType, state, bounds });
    return { success: true, childId };
  });

  ipcMain.handle("modal:get-initial-state", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: "no_window", state: null };
    const data = getModalState(win.id);
    if (!data) return { success: false, error: "no_state", state: null };
    return { success: true, ...data };
  });

  ipcMain.handle("window:navigate-parent", (event, path) => {
    let win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false };
    let parent = win.getParentWindow();
    while (parent && !parent.isDestroyed()) {
      win = parent;
      parent = win.getParentWindow();
    }
    if (win && !win.isDestroyed()) {
      const safe = JSON.stringify(path);
      if (win.webContents.getURL().startsWith("file:")) {
        win.webContents.executeJavaScript(`window.location.hash = ${safe}`);
      } else {
        win.webContents.executeJavaScript(`window.history.pushState(null, '', ${safe}); window.dispatchEvent(new PopStateEvent('popstate'))`);
      }
    }
    return { success: true };
  });

  ipcMain.handle("modal:child-action", (event, payload) => {
    const { action, data } = payload || {};
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: "no_window" };
    let target = win.getParentWindow();
    while (target && !target.isDestroyed()) {
      const parent = target.getParentWindow();
      if (parent && !parent.isDestroyed()) {
        target = parent;
      } else {
        break;
      }
    }
    if (target && !target.isDestroyed()) {
      target.webContents.send("modal:action-from-child", { childId: win.id, action, data });
    }
    return { success: true };
  });

  ipcMain.handle("modal:close-self", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) win.close();
    return { success: true };
  });
}

module.exports = { setupIpc };
