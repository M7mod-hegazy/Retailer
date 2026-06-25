// Resolves the store identity used by the comms layer (x-license-id, device id).
// The real values come from the offline Electron license gate; in the dev
// browser (no Electron) we fall back to a stable per-install id so the feature
// is still testable. Resolved once and cached.

let cache = { resolved: false };

const FALLBACK_KEY = "retailer.comms.fallbackId";
function fallbackId() {
  try {
    let id = localStorage.getItem(FALLBACK_KEY);
    if (!id) {
      const rand = (window.crypto?.randomUUID && window.crypto.randomUUID()) || Math.random().toString(36).slice(2);
      id = `local-${rand}`;
      localStorage.setItem(FALLBACK_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/**
 * Resolve identity from the Electron license gate (idempotent, cached).
 * Safe to call repeatedly and before/without Electron.
 */
export async function resolveCommsIdentity() {
  if (cache.resolved) return cache;
  let status = null;
  try {
    const api = typeof window !== "undefined" ? window.electronAPI : null;
    if (api?.invoke) status = await api.invoke("license:getStatus");
  } catch {
    status = null;
  }
  cache = {
    resolved: true,
    licenseId: status?.licenseId || null,
    hardwareId: status?.hardwareId || status?.currentHardwareId || null,
    issuedTo: status?.issuedTo || null,
  };
  return cache;
}

/**
 * Synchronous best-known identity. Always returns a usable, stable id (falls
 * back to license → hardware → per-install uuid).
 */
export function getCommsIdentity() {
  const c = cache || {};
  return {
    licenseId: c.licenseId || c.hardwareId || fallbackId(),
    deviceId: c.hardwareId || fallbackId(),
    issuedTo: c.issuedTo || null,
  };
}
