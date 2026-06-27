// Client side of the optional, provider-agnostic AI help fallback.
//
// Inert by default: with no VITE_VENDOR_BASE_URL configured (and the
// `feature_ai_assistant` flag off), `isAiFallbackEnabled()` is false and the
// assistant stays 100% offline/free. Wiring exists so enabling it later is just
// config — no code change.

import { useAppSettingsStore } from "../stores/appSettingsStore";

function cfg(key) {
  // import.meta.env is statically replaced by Vite at build time.
  try {
    return String(import.meta.env?.[key] || "").trim();
  } catch {
    return "";
  }
}

export function getAiConfig() {
  return {
    baseUrl: cfg("VITE_VENDOR_BASE_URL").replace(/\/+$/, ""),
    appKey: cfg("VITE_VENDOR_APP_KEY"),
  };
}

/**
 * The fallback fires only when BOTH the feature flag is on AND the vendor
 * endpoint is configured. Either missing => offline-only.
 */
export function isAiFallbackEnabled() {
  const flagOn = Boolean(useAppSettingsStore.getState().settings?.feature_ai_assistant);
  const { baseUrl, appKey } = getAiConfig();
  return flagOn && Boolean(baseUrl && appKey);
}

// Best-effort store identity for the server-side daily cap (optional headers).
function identityHeaders() {
  const s = useAppSettingsStore.getState().settings || {};
  const headers = {};
  const licenseId = s.license_id || s.licenseId || "";
  if (licenseId) headers["x-license-id"] = String(licenseId);
  return headers;
}

/**
 * Ask the configured AI model via the vendor service. `context` is the offline
 * search's top candidates, so the model answers grounded in app help (RAG-lite).
 * @returns {Promise<{ answer: string }>}
 */
export async function askAi(question, context = [], externalSignal) {
  const { baseUrl, appKey } = getAiConfig();
  if (!baseUrl || !appKey) throw new Error("ai_not_configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  // Forward caller cancellation (e.g. the drawer closing) to the live fetch so
  // closing the assistant actually stops the request instead of leaking it.
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(`${baseUrl}/ai/help`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": appKey,
        ...identityHeaders(),
      },
      body: JSON.stringify({ question, context }),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      const err = new Error(json.message || "ai_request_failed");
      err.code = json.code || `http_${res.status}`;
      throw err;
    }
    return { answer: json.data?.answer || "" };
  } finally {
    clearTimeout(timer);
  }
}
