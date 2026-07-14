// Shared local-server connection logic.
//
// The app is local-first (Express + SQLite over a named-pipe bridge in the packaged
// app). The local server is occasionally unavailable for a second or two for entirely
// benign reasons — none of which mean "the database is down":
//   • startup / restart race: the protocol bridge returns 503 "pipe not ready" or 502
//     "bridge error" until the embedded server finishes (re)binding its pipe;
//   • event-loop blocking: better-sqlite3 is synchronous, so a heavy report/export/sync
//     blocks the loop and a short-timeout health ping times out — busy, not down;
//   • a brief pipe hiccup.
//
// Reacting to a SINGLE such blip with a scary "تعذّر الاتصال" banner is a false positive.
// This module is the single source of truth that (a) classifies an error and (b) tracks
// consecutive *real* failures so a banner only appears for a sustained genuine outage.

/**
 * Classify an axios error from the local server.
 * @returns {"http"|"timeout"|"canceled"|"disconnect"}
 *   - "http":       the server answered (any 4xx/5xx) → it is reachable/up.
 *   - "timeout":    our own request timed out / was aborted → server busy, not down.
 *   - "canceled":   WE aborted the request (debounced search typing, unmount) → says
 *                   nothing about the server at all.
 *   - "disconnect": a genuine connection failure (ERR_NETWORK / ECONNREFUSED / …).
 */
export function classifyConnectionError(error) {
  if (error?.response) return "http"; // server answered (4xx/5xx) — it is up
  const code = error?.code || "";
  if (code === "ERR_CANCELED" || error?.name === "CanceledError") {
    return "canceled"; // AbortController abort — deliberate, not a failure
  }
  if (code === "ECONNABORTED" || code === "ETIMEDOUT" || /timeout/i.test(error?.message || "")) {
    return "timeout"; // request aborted by our own timeout — server is busy, not down
  }
  return "disconnect"; // ERR_NETWORK / ECONNREFUSED / ECONNRESET / ENOTFOUND ...
}

/**
 * A small consecutive-failure state machine. `record()` it on every failed request and
 * `success()` it on every successful one; it reports whether the server should be
 * considered offline.
 *
 * Rules:
 *   - "timeout" failures NEVER count toward offline (busy ≠ down) and never clear it.
 *   - "canceled" (we aborted our own request) is likewise ignored entirely.
 *   - "http" (bridge 5xx) and "disconnect" failures increment a counter.
 *   - offline becomes true only once `threshold` consecutive counting-failures occur.
 *   - a single success clears offline and resets the counter.
 *
 * @param {{ threshold?: number }} [opts]
 */
export function createDisconnectTracker({ threshold = 3 } = {}) {
  let count = 0;
  let offline = false;
  return {
    record(error) {
      const kind = classifyConnectionError(error);
      if (kind === "timeout" || kind === "canceled") {
        // Busy server / self-inflicted abort: leave the counter and offline state untouched.
        return { offline, kind, count };
      }
      count += 1;
      if (count >= threshold) offline = true;
      return { offline, kind, count };
    },
    success() {
      count = 0;
      offline = false;
      return { offline, kind: "ok", count };
    },
    get offline() {
      return offline;
    },
    get count() {
      return count;
    },
  };
}

/**
 * Build a complete, human-readable diagnostic report for a failed local-server request,
 * suitable for copying to the clipboard and sending for support. Captures everything a
 * developer needs to pinpoint which layer failed (bridge 502/503 body, axios code,
 * status, url, baseURL) without leaking auth headers.
 *
 * @param {*} error  the axios error (or any Error)
 * @param {{ context?: string, extra?: Record<string, any> }} [meta]
 * @returns {string}
 */
export function buildErrorReport(error, meta = {}) {
  const cfg = error?.config || {};
  const res = error?.response;
  let body = res?.data;
  if (body && typeof body === "object") {
    try {
      body = JSON.stringify(body);
    } catch (_e) {
      body = String(body);
    }
  }
  const baseURL =
    cfg.baseURL ||
    (typeof window !== "undefined" && window.__retailerApiBase) ||
    "";
  const lines = [
    "── تفاصيل الخطأ (Error details) ─────────────",
    `الوقت / time:    ${new Date().toISOString()}`,
    meta.context ? `الموضع / where:  ${meta.context}` : null,
    `النوع / kind:    ${classifyConnectionError(error)}`,
    `الحالة / status: ${res?.status ?? "—"}`,
    `code:            ${error?.code || "—"}`,
    `message:         ${error?.message || "—"}`,
    `method:          ${(cfg.method || "—").toUpperCase()}`,
    `url:             ${cfg.url || "—"}`,
    `baseURL:         ${baseURL || "—"}`,
    body ? `response body:   ${String(body).slice(0, 500)}` : null,
  ];
  if (meta.extra && typeof meta.extra === "object") {
    for (const [k, v] of Object.entries(meta.extra)) {
      lines.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
    }
  }
  if (typeof navigator !== "undefined") {
    lines.push(`userAgent:       ${navigator.userAgent}`);
  }
  return lines.filter(Boolean).join("\n");
}

/**
 * Pull the main process's authoritative startup diagnostics (cause = db-corrupt /
 * db-eperm / port-exhausted / loopback-blocked / …) plus a recent crash-log tail. These
 * are written even when the embedded server is down, so they explain the "app never
 * works on this one PC" case that a renderer-side axios error alone cannot. Never throws;
 * returns null when not running inside Electron.
 */
export async function collectMainProcessDiagnostics() {
  try {
    const epi =
      typeof window !== "undefined" && (window.electronAPI || window.retailerAPI);
    if (!epi || typeof epi.invoke !== "function") return null;
    return await epi.invoke("diag:get-report");
  } catch (_e) {
    return null;
  }
}

/**
 * Build the COMPLETE support report: the renderer-side error details plus the main
 * process's server diagnostics and the resolved transport. This is what the
 * "نسخ تفاصيل الخطأ" buttons copy. Async + never throws.
 */
export async function buildSupportReport(error, meta = {}) {
  let out = buildErrorReport(error, meta);

  if (typeof window !== "undefined" && window.__API_BASE__) {
    out += `\ninjectedApiBase: ${window.__API_BASE__}`;
  }

  const diag = await collectMainProcessDiagnostics();
  if (diag) {
    const r = diag.report || {};
    const lines = [
      "",
      "── تشخيص الخادم (Server diagnostics) ─────────",
      `cause:           ${r.cause || "—"}`,
      `appVersion:      ${diag.appVersion || "—"}`,
      `port:            ${diag.port || "—"}`,
      `dbPath:          ${diag.dbPath || "—"}`,
      r.startError
        ? `startError:      ${`${r.startError.code || ""} ${r.startError.message || ""}`.trim()}`
        : null,
      r.os ? `os:              ${r.os.platform} ${r.os.release} ${r.os.arch}` : null,
      diag.logDir ? `logDir:          ${diag.logDir}` : null,
    ].filter(Boolean);
    out += `\n${lines.join("\n")}`;
    if (diag.logTail) {
      out += `\n\n── آخر سجل (recent log tail) ─────────\n${String(diag.logTail)
        .split("\n")
        .slice(-40)
        .join("\n")}`;
    }
  }
  return out;
}

/**
 * Copy text to the clipboard with a non-secure-context fallback. Resolves to true on
 * success. Never throws.
 */
export async function copyToClipboard(text) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_e) {
    /* fall through to legacy path */
  }
  try {
    if (typeof document !== "undefined") {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    }
  } catch (_e) {
    /* give up */
  }
  return false;
}
