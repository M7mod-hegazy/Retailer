// Fix #3: server-side license enforcement (defense in depth).
//
// The React shell already blocks unactivated machines, but that gate lives in
// the renderer and could be patched out. This middleware makes the embedded
// Express API itself refuse to serve data unless the machine is activated, so
// deleting the UI gate is not enough to unlock the app.
//
// SAFETY:
//  - Enforces ONLY in the packaged (installed) app. Dev (`npm run dev` /
//    `npm run dev:server`), web mode, and the test suite are never blocked.
//  - Mounted on `/api` only, AFTER `/health` and the diag sink, so the SPA HTML,
//    assets, health probe, and the activation screen (which talks over IPC, not
//    the API) always load even on an unactivated machine.
//  - Caches the verdict so the costly hardware-id read does not run per request.

const { isPackagedApp } = require("../../../shared/licensing/runtime");

const TTL_OK_MS = 5 * 60 * 1000; // when activated, re-check at most every 5 minutes
const TTL_BAD_MS = 3 * 1000;     // when locked, re-check quickly so activation unlocks fast

let cache = { at: 0, activated: false, reason: "unknown" };

function refresh() {
  // licenseGate lives under electron/ and is only reachable/needed inside the
  // packaged app, so it is required lazily (never loaded by the dev server).
  const gate = require("../../../electron/licenseGate");
  const status = gate.getStatus();
  cache = {
    at: Date.now(),
    activated: !!status.activated,
    reason: status.reason || (status.activated ? "ok" : "locked"),
  };
  return cache;
}

function licenseEnforce(req, res, next) {
  if (!isPackagedApp()) return next(); // dev / web / tests: never enforce

  const now = Date.now();
  const ttl = cache.activated ? TTL_OK_MS : TTL_BAD_MS;
  if (now - cache.at > ttl) {
    try {
      refresh();
    } catch (_e) {
      // Any failure to evaluate the license fails CLOSED in the packaged app.
      cache = { at: now, activated: false, reason: "gate_error" };
    }
  }

  if (cache.activated) return next();
  return res.status(403).json({ success: false, error: "license_required", reason: cache.reason });
}

module.exports = { licenseEnforce };
