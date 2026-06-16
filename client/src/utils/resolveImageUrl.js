import { getApiBaseUrl, getApiBaseUrlSync } from "../services/apiBase";

// Builds an absolute URL for a server-hosted asset. Delegates base-URL resolution to the
// shared apiBase module (single source of truth, re-resolves the live port on disconnect)
// so image URLs can never get pinned to a dead/stale port independently of API calls.

export function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:") || u.startsWith("blob:")) return u;
  const base = getApiBaseUrlSync();
  return `${base}${u.startsWith("/") ? "" : "/"}${u}`;
}

export async function resolveImageUrlAsync(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:") || u.startsWith("blob:")) return u;
  const base = await getApiBaseUrl();
  return `${base}${u.startsWith("/") ? "" : "/"}${u}`;
}
