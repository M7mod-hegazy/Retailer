const { app, shell } = require("electron");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { closeDb } = require("../server/src/config/database");
const { setInstallStatus } = require("./installProgress");

let autoUpdater = null;
let CancellationToken = null;

try {
  const eu = require("electron-updater");
  autoUpdater = eu.autoUpdater;
  CancellationToken = eu.CancellationToken;
} catch {
  // electron-updater not available (e.g. dev mode)
}

let _mainWindow = null;
let _lastUpdateInfo = null;
let _manualDownloadReq = null;
let _manualCanceled = false;
let _downloadCancellationToken = null;
let _lastDownloadedFilePath = null;

const GH_OWNER = "M7mod-hegazy";
const GH_REPO = "Retailer";
const GH_RELEASE_BASE = `https://github.com/${GH_OWNER}/${GH_REPO}/releases/download`;

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
  // A CancellationToken lets the user stop an in-progress auto download at any
  // time (electron-updater has no other cancel mechanism). A user cancel rejects
  // the promise with a cancellation error — surface a clean reset, not an error.
  _downloadCancellationToken = CancellationToken ? new CancellationToken() : undefined;
  autoUpdater.downloadUpdate(_downloadCancellationToken).catch((err) => {
    if (err && (err.code === "ERR_UPDATER_CANCELLED" || /cancel/i.test(err.message || ""))) {
      send("update:canceled");
    } else {
      sendError(err);
    }
  }).finally(() => { _downloadCancellationToken = null; });
}

function cancelDownload() {
  if (_downloadCancellationToken) {
    _downloadCancellationToken.cancel();
    _downloadCancellationToken = null;
    send("update:canceled");
  }
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
  const version = _lastUpdateInfo?.version || app.getVersion();

  // Close DB cleanly FIRST so the WAL is checkpointed before the process exits.
  // Even though app.quit() triggers before-quit, the async stopEmbeddedServer
  // there is fire-and-forget — this guarantees a clean DB close.
  try { closeDb(); } catch (_) {}

  setInstallStatus("closing-db", { version });
  app.isQuittingForUpdate = true;
  spawnRelaunchHelper();
  setInstallStatus("installing", { version });
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
  // sha512 (base64) from latest.yml — used to verify the manually downloaded
  // installer's integrity before launching it (the auto path verifies natively).
  const sha512 = (match && match.sha512) || null;

  return {
    available: true,
    downloadUrl,
    fileName,
    fileSize,
    sha512,
    version,
  };
}

// Shared downloader used by both the "update to latest" manual path and the
// "install a specific version" rollback path. `info` = { available, downloadUrl,
// fileName, fileSize, sha512, version }.
function runDownload(info) {
  if (!info || !info.available) {
    sendManualError("لا توجد معلومات تحديث متاحة لهذا الإصدار.");
    return;
  }

  const downloadsDir = app.getPath("downloads");
  const fileName = info.fileName || `ElHegazi-Retailer-${info.version}.exe`;
  const filePath = path.join(downloadsDir, fileName);

  // Resume-capable: if partial file exists, we could resume.
  // For simplicity, remove partial and start fresh.
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}

  _manualCanceled = false;

  const fileStream = fs.createWriteStream(filePath);
  let transferred = 0;
  const total = info.fileSize;
  let lastEmitTime = Date.now();
  let lastEmitTransferred = 0;
  let speedEma = 0; // smoothed bytes/sec
  let finished = false;
  const hash = crypto.createHash("sha512");

  sendManualProgress(0, 0, 0, total);

  const failDownload = (message) => {
    if (finished) return;
    finished = true;
    try { fileStream.destroy(); } catch (_) {}
    try { fs.unlinkSync(filePath); } catch (_) {}
    _manualDownloadReq = null;
    // A user-initiated stop is not a failure — emit a clean canceled signal so
    // the UI resets instead of showing a red error.
    if (_manualCanceled) {
      _manualCanceled = false;
      send("update:manual-canceled");
    } else {
      sendManualError(message);
    }
  };

  // Disk-level failures (disk full, antivirus lock) surface here — without this
  // handler a half-written installer would be left behind and later launched.
  fileStream.on("error", (err) => failDownload(`تعذر حفظ الملف: ${err.message}`));

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
        response.resume();
        failDownload(`فشل التحميل. رمز الحالة: ${statusCode}`);
        return;
      }

      // Pipe with backpressure so a slow disk (Win7 HDD) doesn't balloon memory.
      response.pipe(fileStream);

      response.on("data", (chunk) => {
        transferred += chunk.length;
        hash.update(chunk);

        const now = Date.now();
        if (now - lastEmitTime >= 200) {
          // Instantaneous speed over the last interval (responsive + accurate),
          // smoothed with an EMA so the number doesn't jitter between samples.
          const intervalSec = (now - lastEmitTime) / 1000;
          const inst = (transferred - lastEmitTransferred) / (intervalSec || 0.2);
          speedEma = speedEma ? speedEma * 0.6 + inst * 0.4 : inst;
          const percent = total > 0 ? Math.min((transferred / total) * 100, 100) : 0;
          sendManualProgress(percent, Math.round(speedEma), transferred, total);
          lastEmitTime = now;
          lastEmitTransferred = transferred;
        }
      });

      // Finalize only once the file stream has flushed everything to disk.
      fileStream.on("finish", () => {
        if (finished) return;

        // Integrity check: a truncated/corrupt installer is the #1 cause of a
        // "buggy" manual install — reject it instead of launching it.
        if (info.sha512) {
          const actual = hash.digest("base64");
          if (actual !== info.sha512) {
            failDownload("فشل التحقق من سلامة الملف — يرجى إعادة المحاولة.");
            return;
          }
        }

        finished = true;
        _manualDownloadReq = null;
        _lastDownloadedFilePath = filePath; // openInstaller launches THIS file
        sendManualProgress(100, 0, transferred, total);
        send("update:manual-complete", { filePath, version: info.version });
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

function startManualDownload() {
  runDownload(getManualDownloadInfo());
}

// ─── Version rollback / install a specific release ─────────────────────────

// Minimal HTTPS GET → string, following redirects, with a GitHub User-Agent
// (the API rejects requests without one). Used for the releases list + per-
// version latest.yml.
function httpGetText(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "ElHegazi-Retailer", Accept: "application/vnd.github+json" } }, (res) => {
      const code = res.statusCode || 0;
      if (code >= 300 && code < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) return reject(new Error("too many redirects"));
        return httpGetText(res.headers.location, redirectsLeft - 1).then(resolve, reject);
      }
      if (code !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${code}`));
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { body += c; });
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(new Error("timeout")); });
  });
}

// Tiny latest.yml reader — extracts the primary installer file (url/sha512/size)
// from electron-builder's metadata. Avoids a YAML dependency; the format is fixed.
function parseLatestYml(text) {
  const lines = text.split(/\r?\n/);
  const files = [];
  let cur = null;
  for (const line of lines) {
    const urlM = line.match(/^\s*-?\s*url:\s*(.+?)\s*$/);
    const shaM = line.match(/^\s*sha512:\s*(.+?)\s*$/);
    const sizeM = line.match(/^\s*size:\s*(\d+)\s*$/);
    if (urlM) { cur = { url: urlM[1].replace(/^['"]|['"]$/g, "") }; files.push(cur); }
    else if (shaM && cur && !cur.sha512) cur.sha512 = shaM[1].replace(/^['"]|['"]$/g, "");
    else if (sizeM && cur && cur.size == null) cur.size = parseInt(sizeM[1], 10);
  }
  return files.filter((f) => f.url && /\.exe$/i.test(f.url));
}

// Build download info for an arbitrary published version from its own latest.yml
// (every release reliably has one). Same shape as getManualDownloadInfo so it
// flows through the shared downloader + integrity check.
async function getVersionDownloadInfo(version) {
  const v = String(version).replace(/^v/i, "");
  const ymlUrl = `${GH_RELEASE_BASE}/v${v}/latest.yml`;
  const text = await httpGetText(ymlUrl);
  const files = parseLatestYml(text);
  if (!files.length) throw new Error("no installer in release metadata");

  // Prefer an asset matching this machine's arch; otherwise take the first
  // (current releases ship a single ia32 installer that runs on x64 too).
  const arch = process.arch === "x64" ? "x64" : "ia32";
  const match = files.find((f) => f.url.toLowerCase().includes(arch)) || files[0];
  const fileName = decodeURIComponent(match.url.split("/").pop());
  return {
    available: true,
    downloadUrl: `${GH_RELEASE_BASE}/v${v}/${encodeURIComponent(fileName)}`,
    fileName,
    fileSize: match.size || 0,
    sha512: match.sha512 || null,
    version: v,
  };
}

function downloadVersion(version) {
  getVersionDownloadInfo(version)
    .then((info) => runDownload(info))
    .catch((err) => sendManualError(`تعذّر تجهيز الإصدار ${version}: ${err.message}`));
}

// List published releases for the version picker (newest first). Best-effort —
// returns [] on network/API failure so the UI can show an empty state.
async function listReleases() {
  try {
    const text = await httpGetText(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases?per_page=30`);
    const arr = JSON.parse(text);
    return (Array.isArray(arr) ? arr : [])
      .filter((r) => r && r.tag_name && !r.draft)
      .map((r) => ({
        version: String(r.tag_name).replace(/^v/i, ""),
        name: r.name || r.tag_name,
        publishedAt: r.published_at || null,
        prerelease: !!r.prerelease,
      }));
  } catch (_) {
    return [];
  }
}

function cancelManualDownload() {
  if (_manualDownloadReq) {
    _manualCanceled = true; // tells failDownload to emit a clean cancel, not an error
    _manualDownloadReq.destroy();
    _manualDownloadReq = null;
  }
}

function openInstaller() {
  // Launch the exact file that was last downloaded (works for both "update to
  // latest" and a rollback to a specific older version). Fall back to deriving
  // the latest installer's path if nothing was tracked this session.
  let filePath = _lastDownloadedFilePath;
  let version = "latest";
  if (!filePath) {
    const info = getManualDownloadInfo();
    if (!info.available) return;
    version = info.version;
    filePath = path.join(app.getPath("downloads"), info.fileName || `ElHegazi-Retailer-${info.version}.exe`);
  }
  if (fs.existsSync(filePath)) {
    // CRITICAL: Close the DB BEFORE launching the installer. The NSIS
    // customInit macro runs `taskkill /F` immediately — it force-kills the
    // Electron process without giving better-sqlite3 a chance to checkpoint
    // the WAL. If we close the DB first, the WAL is clean even when the
    // process is later terminated abruptly. This is the #1 cause of the
    // "تلف في قاعدة البيانات" error on manual install.
    setInstallStatus("closing-db", { version });
    try { closeDb(); } catch (_) {}

    // The manual installer runs with NSIS runAfterFinish:false on Win7 (VxKex
    // shim constraint), so it won't relaunch the app on its own. Arm the same
    // detached relaunch helper the auto path uses: it polls update-complete.flag
    // (written by customInstall) and reopens the exe once install finishes.
    spawnRelaunchHelper();
    setInstallStatus("installing", { version });

    // Launch the installer. The NSIS customInit will still force-kill this
    // process, but that's safe now — the DB was already closed cleanly above.
    shell.openPath(filePath).then(() => {
      app.isQuittingForUpdate = true;
      setTimeout(() => { try { app.quit(); } catch (_) {} }, 800);
    });
  } else {
    sendManualError("لم يتم العثور على ملف التثبيت.");
  }
}

module.exports = {
  setupAutoUpdater,
  checkForUpdates,
  downloadUpdate,
  cancelDownload,
  quitAndInstall,
  getManualDownloadInfo,
  startManualDownload,
  cancelManualDownload,
  openInstaller,
  listReleases,
  downloadVersion,
};
