// Detects whether we are running inside the packaged (installed) Electron app,
// as opposed to dev (`npm run dev`), the standalone dev server, or the test
// suite. License hardening (ignoring env-var key overrides, failing closed,
// server-side enforcement) applies ONLY in the packaged app so development and
// tests are never blocked.
//
// Safe everywhere: when Electron is not present (plain Node dev server, jest
// under ELECTRON_RUN_AS_NODE), `require("electron")` yields a path string with
// no `app`, so this returns false.
function isPackagedApp() {
  try {
    const electron = require("electron");
    return !!(electron && electron.app && electron.app.isPackaged);
  } catch (_e) {
    return false;
  }
}

module.exports = { isPackagedApp };
