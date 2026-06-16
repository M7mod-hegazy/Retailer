import { getApiBaseUrlSync } from "./apiBase";

// Best-effort diagnostic trail so a random production disconnect is explainable after
// the fact. Records WHY a disconnect/overlay happened (timeout vs connection failure vs
// crash vs port-mismatch) both to the renderer console and, fire-and-forget, to the
// server's writable log dir via POST /api/diag/client-event.
//
// Uses raw fetch (NOT the axios instance) to avoid response-interceptor recursion, and
// is wrapped so it can NEVER throw or itself trigger a disconnect.
export function reportClientDiag(payload) {
  try {
    const enriched = {
      ...payload,
      ts: new Date().toISOString(),
      ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
      baseURL: getApiBaseUrlSync(),
    };
    // eslint-disable-next-line no-console
    console.warn("[diag:client]", payload.type, enriched);
    if (typeof fetch === "function") {
      fetch(`${getApiBaseUrlSync()}/api/diag/client-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enriched),
        keepalive: true,
      }).catch(() => {});
    }
  } catch (_) {
    /* diagnostics must never break the app */
  }
}
