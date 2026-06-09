const { BrowserWindow, dialog } = require("electron");
const { getLogPath } = require("./crashLogger");

let errorWindow = null;

function buildHtml({ title, friendly, detail, logPath }) {
  // Everything is inlined (no external files / no IPC) so it renders even when
  // the renderer pipeline or the embedded server is broken.
  const safeDetail = String(detail || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #f8fafc;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
  }
  .card {
    width: 100%;
    max-width: 720px;
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 24px 60px rgba(0,0,0,.45);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 22px 26px;
    background: rgba(239,68,68,.08);
    border-bottom: 1px solid #1f2937;
  }
  .badge {
    width: 44px; height: 44px;
    flex: 0 0 44px;
    border-radius: 12px;
    background: rgba(239,68,68,.15);
    color: #f87171;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px;
  }
  h1 { font-size: 19px; font-weight: 700; color: #fca5a5; }
  .friendly { font-size: 13px; color: #94a3b8; margin-top: 4px; }
  .body { padding: 22px 26px; }
  .label { font-size: 12px; color: #64748b; margin-bottom: 8px; }
  pre {
    direction: ltr; text-align: left;
    background: #0b1220;
    border: 1px solid #1f2937;
    border-radius: 10px;
    padding: 14px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.6;
    color: #e2e8f0;
    max-height: 220px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .path {
    margin-top: 14px;
    font-size: 12px;
    color: #94a3b8;
    direction: ltr; text-align: left;
    background: #0b1220;
    border: 1px solid #1f2937;
    border-radius: 8px;
    padding: 10px 12px;
  }
  .path b { color: #34d399; }
  .actions {
    display: flex; gap: 10px;
    padding: 18px 26px;
    border-top: 1px solid #1f2937;
    background: #0d1424;
  }
  button {
    flex: 1;
    padding: 12px 16px;
    border-radius: 10px;
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: filter .15s ease;
  }
  button:hover { filter: brightness(1.1); }
  .copy { background: #10b981; color: #04231a; }
  .quit { background: #1f2937; color: #e2e8f0; }
  .ok   { color: #34d399 !important; }
</style>
</head>
<body>
  <div class="card">
    <div class="head">
      <div class="badge">!</div>
      <div>
        <h1>${title}</h1>
        <div class="friendly">${friendly}</div>
      </div>
    </div>
    <div class="body">
      <div class="label">تفاصيل الخطأ (Error details):</div>
      <pre id="detail">${safeDetail}</pre>
      <div class="path">سِجِل الأخطاء (log file): <b>${String(logPath || "").replace(/\\/g, "\\\\")}</b></div>
    </div>
    <div class="actions">
      <button class="copy" id="copyBtn">نسخ التفاصيل</button>
      <button class="quit" id="quitBtn">إغلاق</button>
    </div>
  </div>
<script>
  const copyBtn = document.getElementById('copyBtn');
  copyBtn.addEventListener('click', async () => {
    const txt = document.getElementById('detail').innerText + "\\n\\nLog: " + ${JSON.stringify(String(logPath || ""))};
    try { await navigator.clipboard.writeText(txt); } catch (_e) {
      const r = document.createRange(); r.selectNode(document.getElementById('detail'));
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      document.execCommand('copy'); s.removeAllRanges();
    }
    copyBtn.textContent = 'تم النسخ ✓';
    copyBtn.classList.add('ok');
    setTimeout(() => { copyBtn.textContent = 'نسخ التفاصيل'; copyBtn.classList.remove('ok'); }, 1600);
  });
  document.getElementById('quitBtn').addEventListener('click', () => window.close());
</script>
</body>
</html>`;
}

/**
 * Render a visible, readable error screen instead of a blank window.
 * Reuses a single window if called repeatedly.
 *
 * @param {object} opts
 * @param {string} opts.title    - short Arabic headline
 * @param {string} opts.friendly - one supportive line
 * @param {string} opts.detail   - raw error text / stack (shown verbatim)
 */
function showErrorScreen(opts = {}) {
  const data = {
    title: opts.title || "حدث خطأ في تشغيل البرنامج",
    friendly:
      opts.friendly ||
      "يرجى تصوير هذه الشاشة وإرسالها للدعم الفني، أو إرسال ملف السجل أدناه.",
    detail: opts.detail || "Unknown error",
    logPath: getLogPath(),
  };

  // Native Win32 message box FIRST. This does not use Chromium at all, so it
  // stays readable even when the renderer can't paint (the exact Win7 case
  // where the HTML error window shows up black). This is the error text the
  // user can actually read and screenshot.
  try {
    dialog.showErrorBox(
      data.title,
      `${data.friendly}\n\n${data.detail}\n\nLog file:\n${data.logPath}`,
    );
  } catch (_e) {}

  try {
    if (errorWindow && !errorWindow.isDestroyed()) {
      errorWindow.webContents.executeJavaScript(
        `document.getElementById('detail').textContent = ${JSON.stringify(String(data.detail))};`,
      ).catch(() => {});
      errorWindow.show();
      errorWindow.focus();
      return errorWindow;
    }
  } catch (_e) {}

  errorWindow = new BrowserWindow({
    width: 780,
    height: 560,
    resizable: true,
    minimizable: true,
    maximizable: false,
    title: "ElHegazi Retailer — Error",
    autoHideMenuBar: true,
    backgroundColor: "#0f172a",
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  errorWindow.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(buildHtml(data)),
  );
  errorWindow.once("ready-to-show", () => {
    errorWindow.show();
    errorWindow.focus();
  });
  errorWindow.on("closed", () => { errorWindow = null; });
  return errorWindow;
}

module.exports = { showErrorScreen };
