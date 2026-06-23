// Single source of truth for the backend base URL.
//
// In the packaged Electron app the embedded Express server may bind a port other than
// 5000 (it port-scans 5000→5019 when 5000 is taken — see server/src/index.js), so the
// real port must be read from the main process via IPC rather than hardcoded. The
// resolved value is cached, but can be reset (resetApiBaseUrl) when the server becomes
// unreachable so a restart on a different port is picked up instead of staying pinned
// to a dead port.

// Packaged Electron loads the UI from file://. There we talk to the embedded
// server over the custom `retailer://` protocol instead of a TCP loopback socket,
// so traffic never touches 127.0.0.1 and cannot be blocked by antivirus/firewall
// software (the persistent "connection error" some hardened PCs hit). The Electron
// main process bridges retailer:// to the server over a local named pipe.
const CUSTOM_PROTOCOL_BASE = "retailer://local";

function isPackagedElectron() {
  return (
    typeof window !== "undefined" &&
    window.location &&
    window.location.protocol === "file:"
  );
}

function staticFallback() {
  if (isPackagedElectron()) return CUSTOM_PROTOCOL_BASE;
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  // Dev / web mode runs over http(s) — use the page origin so the Vite proxy /
  // same-origin server is reached.
  if (typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }
  return "http://127.0.0.1:5000";
}

let resolvedBaseUrl = null;
let inflight = null;

// Async resolver — preferred for any code path that can await (API calls, image URLs).
export async function getApiBaseUrl() {
  if (resolvedBaseUrl) return resolvedBaseUrl;
  // Packaged Electron → custom protocol, no IPC round-trip / no TCP loopback.
  if (isPackagedElectron()) {
    resolvedBaseUrl = CUSTOM_PROTOCOL_BASE;
    return resolvedBaseUrl;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    if (typeof window !== "undefined" && window.electronAPI?.getApiUrl) {
      try {
        const url = await window.electronAPI.getApiUrl();
        if (url) {
          resolvedBaseUrl = url;
          return url;
        }
      } catch (_) {
        /* fall through to static fallback */
      }
    }
    resolvedBaseUrl = staticFallback();
    return resolvedBaseUrl;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

// Synchronous best-effort accessor for non-async call sites (e.g. building <img> src).
// Returns the last resolved URL, or the static fallback if not resolved yet.
export function getApiBaseUrlSync() {
  return resolvedBaseUrl || staticFallback();
}

// Drop the cached value so the next getApiBaseUrl() re-queries the live port. Called
// when the server looks unreachable, because it may have restarted on a new port.
export function resetApiBaseUrl() {
  resolvedBaseUrl = null;
  inflight = null;
}

// Warm the cache eagerly so the sync accessor is populated as soon as possible.
if (typeof window !== "undefined") {
  getApiBaseUrl();
}
