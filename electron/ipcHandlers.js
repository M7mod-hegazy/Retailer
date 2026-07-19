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

  // The single source of truth for the renderer's API base. The packaged app reaches
  // the embedded server over the custom retailer:// protocol (no TCP loopback → immune
  // to antivirus/firewall blocking 127.0.0.1). Dev uses TCP since the UI loads over http
  // from the Vite dev server.
  const resolveApiBase = () => {
    if (app.isPackaged) return "retailer://local";
    const port = process.env.ACTUAL_PORT || "5000";
    return `http://127.0.0.1:${port}`;
  };
  ipcMain.handle("get:api-url", () => resolveApiBase());
  // SYNCHRONOUS variant consumed by preload so the renderer is *told* its transport at
  // load time and never has to guess from window.location.protocol. Guessing is exactly
  // what let a packaged build silently fall back to the AV-blockable 127.0.0.1 socket.
  ipcMain.on("get:api-url-sync", (event) => {
    try {
      event.returnValue = resolveApiBase();
    } catch (_e) {
      event.returnValue = null;
    }
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

  // Live-sync the native window background to the active theme's base colour so
  // there is never a white edge behind a dark/tinted theme (paint, resize,
  // scroll rubber-band). Also persisted for a flash-free next launch.
  ipcMain.on("window:set-bg-color", (_e, hex) => {
    const clean = typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null;
    if (!clean) return;
    try { window.setBackgroundColor(clean); } catch (_) {}
    // Persist into window-state.json so the NEXT launch paints this colour from
    // the first frame (self-contained here to avoid a circular require on main).
    try {
      const fs = require("fs");
      const stateFile = require("path").join(require("electron").app.getPath("userData"), "window-state.json");
      let state = {};
      try { state = JSON.parse(fs.readFileSync(stateFile, "utf8")) || {}; } catch (_) {}
      state.bgColor = clean;
      fs.writeFileSync(stateFile, JSON.stringify(state));
    } catch (_) {}
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

  // ---------------------------------------------------------------------
  // Silent print pipeline
  // ---------------------------------------------------------------------

  /** Roll width in mm from a CSS page-size string ("80mm auto" → 80); 0 = page size. */
  function rollWidthFromPageSize(pageSizeStr) {
    const m = /^(\d+(?:\.\d+)?)mm\s+auto/.exec(pageSizeStr || "");
    return m ? parseFloat(m[1]) : 0;
  }

  /**
   * Render HTML in a hidden window sized to the paper and measure the content
   * height AFTER web fonts are ready and every <img> has decoded — a logo that
   * loads after measurement used to reflow the receipt taller than the page we
   * asked for, cutting off the bottom. Resolves { win, contentHeightPx } — the
   * caller owns the window and must destroy it.
   */
  async function loadPrintWindow(tmpFile, rollWidthMm) {
    const winWidthPx = rollWidthMm ? Math.ceil((rollWidthMm * 96) / 25.4) : 800;
    // javascript must stay enabled so we can wait for fonts/images and measure
    // the rendered height. The HTML is our own trusted print document (no
    // scripts); sandbox + a local temp file keep it isolated.
    const win = new BrowserWindow({
      show: false,
      width: winWidthPx,
      height: 1200,
      useContentSize: true,
      webPreferences: { offscreen: false, sandbox: true },
    });
    await win.loadFile(tmpFile);
    let contentHeightPx = 0;
    try {
      contentHeightPx = await win.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const measure = () => resolve(Math.ceil(Math.max(
            document.body.scrollHeight, document.documentElement.scrollHeight, 1)));
          const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
          const imgsReady = Promise.all(Array.from(document.images).map(
            (img) => img.decode ? img.decode().catch(() => {}) : Promise.resolve()
          ));
          const timeout = new Promise((r) => setTimeout(r, 3000));
          Promise.race([Promise.all([fontsReady, imgsReady]), timeout])
            .then(() => requestAnimationFrame(() => requestAnimationFrame(measure)));
        })
      `);
    } catch { /* caller treats 0 as measurement failure */ }
    return { win, contentHeightPx };
  }

  /** Build webContents.print options from measured geometry + calibration mode. */
  function buildPrintOptions({ deviceName, copies, pageSizeStr, rollWidthMm, contentHeightPx, paperMode }) {
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
    if (rollWidthMm) {
      // "driver" paper mode: omit pageSize entirely and trust the Windows
      // driver's configured roll form. Some thermal drivers feed a large blank
      // top gap when handed a foreign custom page size; the calibration wizard
      // lets the user pick whichever mode their driver handles cleanly.
      if (paperMode !== "driver") {
        // Round height UP to whole millimetres plus a 2mm tail so driver
        // rounding and measurement drift never clip the last printed line.
        const heightMm = Math.ceil((contentHeightPx * PX) / MM) + 2;
        printOptions.pageSize = { width: rollWidthMm * MM, height: heightMm * MM };
      }
    } else if (pageSizeStr) {
      // Sheet sizes: parse "Wmm Hmm" and map dims + orientation. The old
      // /^148mm/ prefix test sent A5 LANDSCAPE ("210mm 148mm") to A4 portrait.
      const m = /^(\d+(?:\.\d+)?)mm\s+(\d+(?:\.\d+)?)mm$/.exec(pageSizeStr);
      if (m) {
        const w = parseFloat(m[1]);
        const h = parseFloat(m[2]);
        const lo = Math.min(w, h);
        const hi = Math.max(w, h);
        if (w > h) printOptions.landscape = true;
        if (lo === 148 && hi === 210) printOptions.pageSize = "A5";
        else if (lo === 210 && hi === 297) printOptions.pageSize = "A4";
        else printOptions.pageSize = { width: Math.round(lo * MM), height: Math.round(hi * MM) };
      } else {
        printOptions.pageSize = "A4";
      }
    }
    return printOptions;
  }

  // ESC/POS raw bytes, written straight to the Windows spooler with the RAW
  // datatype (bypasses the graphics driver). Used for drawer kick + paper cut
  // on printers whose drivers don't expose those switches reliably.
  const ESCPOS_OPS = {
    drawer: [0x1b, 0x70, 0x00, 0x19, 0xfa],       // ESC p 0 — kick pin 2
    cut: [0x1b, 0x64, 0x03, 0x1d, 0x56, 0x42, 0x00], // feed 3 lines + GS V B (partial cut)
  };

  const RAW_PRINTER_PS = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
  public static bool Send(string printer, byte[] bytes) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) return false;
    DOCINFOA di = new DOCINFOA(); di.pDocName = "Retailer ESC/POS"; di.pDataType = "RAW";
    bool ok = false;
    if (StartDocPrinter(h, 1, di)) {
      if (StartPagePrinter(h)) {
        int written;
        ok = WritePrinter(h, bytes, bytes.Length, out written);
        EndPagePrinter(h);
      }
      EndDocPrinter(h);
    }
    ClosePrinter(h);
    return ok;
  }
}
'@
$bytes = [Convert]::FromBase64String($env:RETAILER_ESC_BYTES)
if (-not [RawPrinter]::Send($env:RETAILER_ESC_PRINTER, $bytes)) { exit 1 }
`;

  /** Send raw ESC/POS ops ("cut" / "drawer") to a printer. Windows only. */
  function sendEscposOps(deviceName, ops) {
    return new Promise((resolve) => {
      if (process.platform !== "win32" || !deviceName) return resolve({ success: false, error: "unsupported" });
      const bytes = [];
      (ops || []).forEach((op) => { if (ESCPOS_OPS[op]) bytes.push(...ESCPOS_OPS[op]); });
      if (!bytes.length) return resolve({ success: true });
      const os = require("os");
      const { execFile } = require("child_process");
      const scriptFile = path.join(os.tmpdir(), `retailer-escpos-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`);
      try { fs.writeFileSync(scriptFile, RAW_PRINTER_PS, "utf8"); }
      catch (e) { return resolve({ success: false, error: e.message }); }
      execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptFile],
        {
          timeout: 10000,
          windowsHide: true,
          env: {
            ...process.env,
            RETAILER_ESC_PRINTER: deviceName,
            RETAILER_ESC_BYTES: Buffer.from(bytes).toString("base64"),
          },
        },
        (error) => {
          try { fs.unlinkSync(scriptFile); } catch { /* ignore */ }
          resolve(error ? { success: false, error: "escpos_failed" } : { success: true });
        },
      );
    });
  }

  // Silent print: render the provided HTML in a hidden window and send it straight
  // to the configured printer (no OS dialog). Returns { success:false } so the
  // renderer can fall back to the dialog-based iframe path when this fails.
  ipcMain.handle("print:silent", async (_event, payload = {}) => {
    const {
      html = "", deviceName = "", copies = 1, pageSizeStr = "",
      paperMode = "custom", escposCut = false, escposDrawer = false,
    } = payload;
    if (!html) return { success: false, error: "no_html" };
    const os = require("os");
    const tmpFile = path.join(os.tmpdir(), `retailer-print-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
    let printWin = null;
    try {
      fs.writeFileSync(tmpFile, html, "utf8");
      // Lay the hidden window out at the *paper* width: the print sheet is
      // captured from x=0, so window width must equal the paper for the
      // rendered band offsets to land where the head expects them.
      const rollWidthMm = rollWidthFromPageSize(pageSizeStr);
      const loaded = await loadPrintWindow(tmpFile, rollWidthMm);
      printWin = loaded.win;

      // Electron's silent print IGNORES the CSS `@page { size }` rule, so thermal
      // jobs need an explicit pageSize (unless the calibrated paperMode says the
      // driver's own form handles it better). A failed measurement used to fall
      // back to a 300mm page — printing a mostly-blank tail; now it aborts so the
      // renderer falls back to the visible dialog instead of wasting paper.
      if (rollWidthMm && paperMode !== "driver" && !(loaded.contentHeightPx > 0)) {
        return { success: false, error: "measure_failed" };
      }

      const printOptions = buildPrintOptions({
        deviceName, copies, pageSizeStr, rollWidthMm,
        contentHeightPx: loaded.contentHeightPx, paperMode,
      });

      // A small extra frame so the very last paint lands before the print snapshot.
      await new Promise((resolve) => setTimeout(resolve, 80));
      const result = await new Promise((resolve) => {
        printWin.webContents.print(
          printOptions,
          (success, failureReason) => resolve({ success, failureReason }),
        );
      });
      if (result.success && (escposCut || escposDrawer)) {
        const ops = [];
        if (escposCut) ops.push("cut");
        if (escposDrawer) ops.push("drawer");
        // Best-effort: a failed kick/cut must not fail the whole print job.
        await sendEscposOps(deviceName, ops);
      }
      return { success: !!result.success, error: result.success ? null : (result.failureReason || "print_failed") };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (printWin && !printWin.isDestroyed()) printWin.destroy();
      try { fs.unlinkSync(tmpFile); } catch { /* ignore temp cleanup errors */ }
    }
  });

  // Raw ESC/POS ops on demand (e.g. "open drawer" button, cut between the parts
  // of a multi-part receipt). Renderer opts in per printer via calibration.
  ipcMain.handle("print:escpos-raw", async (_event, payload = {}) => {
    const { deviceName = "", ops = [] } = payload;
    const wanted = (Array.isArray(ops) ? ops : []).filter((op) => op === "cut" || op === "drawer");
    if (!wanted.length) return { success: false, error: "no_ops" };
    return sendEscposOps(deviceName, wanted);
  });

  // Debug/verification harness: run the IDENTICAL hidden-window pipeline but end
  // in printToPDF instead of the printer. Lets print geometry (band width, page
  // height, image-aware measurement) be verified without hardware or paper.
  ipcMain.handle("print:debug-pdf", async (_event, payload = {}) => {
    const { html = "", pageSizeStr = "", fileName = "" } = payload;
    if (!html) return { success: false, error: "no_html" };
    const os = require("os");
    const tmpFile = path.join(os.tmpdir(), `retailer-print-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
    let printWin = null;
    try {
      fs.writeFileSync(tmpFile, html, "utf8");
      const rollWidthMm = rollWidthFromPageSize(pageSizeStr);
      const loaded = await loadPrintWindow(tmpFile, rollWidthMm);
      printWin = loaded.win;
      if (rollWidthMm && !(loaded.contentHeightPx > 0)) {
        return { success: false, error: "measure_failed" };
      }
      const MM = 1000;
      const PX = 25400 / 96;
      const pdfOptions = { printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } };
      if (rollWidthMm) {
        const heightMm = Math.ceil((loaded.contentHeightPx * PX) / MM) + 2;
        pdfOptions.pageSize = { width: rollWidthMm * MM, height: heightMm * MM };
      } else {
        // Mirror buildPrintOptions: dims + orientation, not a prefix guess.
        const m = /^(\d+(?:\.\d+)?)mm\s+(\d+(?:\.\d+)?)mm$/.exec(pageSizeStr || "");
        if (m && parseFloat(m[1]) > parseFloat(m[2])) pdfOptions.landscape = true;
        pdfOptions.pageSize = m && Math.min(parseFloat(m[1]), parseFloat(m[2])) === 148 ? "A5" : "A4";
      }
      const pdf = await printWin.webContents.printToPDF(pdfOptions);
      const outDir = path.join(app.getPath("userData"), "print-debug");
      fs.mkdirSync(outDir, { recursive: true });
      const safeName = String(fileName || "").replace(/[^\w.-]+/g, "_") || `print-${Date.now()}.pdf`;
      const outPath = path.join(outDir, safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`);
      fs.writeFileSync(outPath, pdf);
      return { success: true, path: outPath };
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
