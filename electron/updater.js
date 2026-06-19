const { app, shell } = require("electron");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

let autoUpdater = null;

try {
  autoUpdater = require("electron-updater").autoUpdater;
} catch {
  // electron-updater not available (e.g. dev mode)
}

let _mainWindow = null;
let _lastUpdateInfo = null;
let _manualDownloadReq = null;

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

  autoUpdater.on("update-available", (info) => {
    _lastUpdateInfo = info;
    send("update:available", info);
  });
  autoUpdater.on("update-not-available", () => send("update:not-available"));
  autoUpdater.on("download-progress", (progress) => send("update:progress", progress));
  autoUpdater.on("update-downloaded", (info) => send("update:downloaded", info));
  autoUpdater.on("error", (err) => sendError(err));

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

// ─── Auto-reopen helper (Windows 7 friendly) ──────────────────────────────
// On Win7 the NSIS installer runs with `runAfterFinish: false` (the VxKex
// compatibility shim must stay enabled on the exe, so NSIS must not launch it
// directly). electron-updater's own relaunch is unreliable under those
// constraints, so we spawn a detached VBScript that waits for the installer to
// finish (signalled by the `update-complete.flag` written at the end of
// customInstall) and then relaunches the exe. VxKex compatibility is keyed by
// the exe path, so it persists across in-place updates and the relaunch does
// not crash. The single-instance lock in main.js dedups if electron-updater
// also relaunches.
function updateCompleteFlagPath() {
  return path.join(app.getPath("appData"), "ElHegazi Retailer", "update-complete.flag");
}

function spawnRelaunchHelper() {
  if (process.platform !== "win32") return;
  try {
    const exePath = app.getPath("exe");
    const flagPath = updateCompleteFlagPath();

    // Clear any stale flag from a previous (failed) update so the helper only
    // fires on the flag written by THIS install.
    try { if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath); } catch (_) {}

    // VBScript string literals: escape embedded double-quotes by doubling them.
    const vbExe = exePath.replace(/"/g, '""');
    const vbFlag = flagPath.replace(/"/g, '""');
    const vbs = [
      'Dim fso, waited',
      'Set fso = CreateObject("Scripting.FileSystemObject")',
      'waited = 0',
      'Do While waited < 180000',
      '  If fso.FileExists("' + vbFlag + '") Then',
      '    WScript.Sleep 1500',
      '    On Error Resume Next',
      '    fso.DeleteFile "' + vbFlag + '"',
      '    On Error Goto 0',
      '    CreateObject("WScript.Shell").Run """" & "' + vbExe + '" & """", 1, False',
      '    WScript.Quit',
      '  End If',
      '  WScript.Sleep 500',
      '  waited = waited + 500',
      'Loop',
    ].join("\r\n");

    const helperPath = path.join(app.getPath("temp"), "retailer-relaunch.vbs");
    fs.writeFileSync(helperPath, vbs, "utf8");

    const child = spawn("wscript.exe", ["//B", "//Nologo", helperPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  } catch (_) {
    // Best-effort: if the helper can't be spawned, electron-updater's own
    // relaunch (isForceRunAfter) is still attempted by quitAndInstall.
  }
}

function quitAndInstall() {
  if (!autoUpdater) return;
  spawnRelaunchHelper();
  autoUpdater.quitAndInstall(true, true);
}

function sendManualError(msg) {
  send("update:manual-error", { message: msg });
}

function sendManualProgress(percent, bytesPerSecond, transferred, total) {
  send("update:manual-progress", { percent, bytesPerSecond, transferred, total });
}

// ─── Manual Download ──────────────────────────────────────────────────────

function getManualDownloadInfo() {
  if (!_lastUpdateInfo) {
    return { available: false };
  }

  const version = _lastUpdateInfo.version;
  const arch = process.arch === "x64" ? "x64" : "ia32";
  const baseUrl = `https://github.com/M7mod-hegazy/Retailer/releases/download/v${version}`;

  // Derive the real asset name from the update metadata (latest.yml) instead of
  // guessing. With a merged multi-arch latest.yml the `files` array can list
  // several installers, so pick the one matching this arch (filenames contain
  // an "x64"/"ia32" token), falling back to the first entry.
  const files = Array.isArray(_lastUpdateInfo.files) ? _lastUpdateInfo.files : [];
  const match =
    files.find((f) => f && f.url && f.url.toLowerCase().includes(arch)) ||
    files[0] ||
    null;

  // `url` in latest.yml is the asset filename relative to the release.
  const fileName =
    (match && match.url && decodeURIComponent(match.url.split("/").pop())) ||
    `ElHegazi-Retailer-${version}-${arch}.exe`;
  const downloadUrl = `${baseUrl}/${fileName}`;
  const fileSize = (match && match.size) || 0;

  return {
    available: true,
    downloadUrl,
    fileName,
    fileSize,
    version,
  };
}

function startManualDownload() {
  const info = getManualDownloadInfo();
  if (!info.available) {
    sendManualError("لا توجد معلومات تحديث متاحة.");
    return;
  }

  const downloadsDir = app.getPath("downloads");
  const fileName = info.fileName || `ElHegazi-Retailer-${info.version}.exe`;
  const filePath = path.join(downloadsDir, fileName);

  // Resume-capable: if partial file exists, we could resume.
  // For simplicity, remove partial and start fresh.
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}

  const fileStream = fs.createWriteStream(filePath);
  let transferred = 0;
  const total = info.fileSize;
  let startTime = Date.now();
  let lastChunkTime = startTime;
  let lastChunkTransferred = 0;

  sendManualProgress(0, 0, 0, total);

  const failDownload = (message) => {
    try { fileStream.close(); } catch (_) {}
    try { fs.unlinkSync(filePath); } catch (_) {}
    _manualDownloadReq = null;
    sendManualError(message);
  };

  // GitHub always 302-redirects release assets to its CDN, so we must follow
  // redirects AND re-attach the error/idle-timeout handlers to each hop
  // (otherwise a stalled CDN download would hang forever). Capped to avoid loops.
  const MAX_REDIRECTS = 5;
  const request = (url, redirectsLeft) => {
    const req = https.get(url, (response) => {
      const statusCode = response.statusCode || 0;

      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        response.resume(); // drain so the socket frees
        if (redirectsLeft <= 0) {
          failDownload("فشل التحميل: عدد كبير من عمليات إعادة التوجيه.");
          return;
        }
        request(response.headers.location, redirectsLeft - 1);
        return;
      }

      if (statusCode !== 200) {
        failDownload(`فشل التحميل. رمز الحالة: ${statusCode}`);
        return;
      }

      response.on("data", (chunk) => {
        transferred += chunk.length;
        fileStream.write(chunk);

        const now = Date.now();
        if (now - lastChunkTime >= 200) {
          const elapsed = (now - startTime) / 1000 || 1;
          const bytesPerSecond = Math.round(transferred / elapsed);
          const percent = total > 0 ? Math.min((transferred / total) * 100, 100) : 0;
          sendManualProgress(percent, bytesPerSecond, transferred, total);
          lastChunkTime = now;
        }
      });

      response.on("end", () => {
        fileStream.end();
        _manualDownloadReq = null;
        sendManualProgress(100, 0, transferred, total);
        send("update:manual-complete", { filePath });
      });
    });

    _manualDownloadReq = req;

    req.on("error", (err) => {
      failDownload(`فشل التحميل: ${err.message}`);
    });

    // Idle (per-stall) timeout: fires only after 60s with no socket activity,
    // so a large installer over a slow-but-alive link keeps downloading.
    req.setTimeout(60000, () => {
      req.destroy();
      failDownload("انتهت مهلة التحميل. تأكد من اتصال الإنترنت.");
    });
  };

  request(info.downloadUrl, MAX_REDIRECTS);
}

function cancelManualDownload() {
  if (_manualDownloadReq) {
    _manualDownloadReq.destroy();
    _manualDownloadReq = null;
  }
}

function openInstaller() {
  const info = getManualDownloadInfo();
  if (!info.available) return;
  const downloadsDir = app.getPath("downloads");
  const fileName = info.fileName || `ElHegazi-Retailer-${info.version}.exe`;
  const filePath = path.join(downloadsDir, fileName);
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
  } else {
    sendManualError("لم يتم العثور على ملف التثبيت.");
  }
}

module.exports = {
  setupAutoUpdater,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  getManualDownloadInfo,
  startManualDownload,
  cancelManualDownload,
  openInstaller,
};
