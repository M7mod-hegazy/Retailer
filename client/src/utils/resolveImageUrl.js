const FALLBACK_URL = "http://127.0.0.1:5000";

let resolvedBaseUrl = null;

async function getBaseUrl() {
  if (resolvedBaseUrl) return resolvedBaseUrl;
  if (typeof window !== "undefined" && window.electronAPI?.getApiUrl) {
    try {
      resolvedBaseUrl = await window.electronAPI.getApiUrl();
      return resolvedBaseUrl;
    } catch (_) {}
  }
  resolvedBaseUrl =
    import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" ? window.location.origin : FALLBACK_URL);
  return resolvedBaseUrl;
}

getBaseUrl();

export function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:") || u.startsWith("blob:")) return u;
  const base = resolvedBaseUrl || FALLBACK_URL;
  return `${base}${u.startsWith("/") ? "" : "/"}${u}`;
}

export async function resolveImageUrlAsync(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:") || u.startsWith("blob:")) return u;
  const base = await getBaseUrl();
  return `${base}${u.startsWith("/") ? "" : "/"}${u}`;
}
