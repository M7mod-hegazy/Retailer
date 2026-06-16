import axios from "axios";
import toast from "react-hot-toast";
import { useAuthStore } from "../stores/authStore";
import { getApiBaseUrl, getApiBaseUrlSync, resetApiBaseUrl } from "./apiBase";
import { reportClientDiag } from "./diag";

const api = axios.create({
  baseURL: getApiBaseUrlSync(),
  // Global safety net so a genuinely hung request fails cleanly instead of hanging
  // forever. Known-long calls (report exports, uploads) pass their own larger timeout.
  timeout: 60000,
});

let isRedirectingToLogin = false;

// Resolve the live base URL on every request. getApiBaseUrl() returns the cached value
// immediately once resolved, so this is cheap — but it means a resetApiBaseUrl() (on
// disconnect) is automatically picked up on the next request without a permanent cache.
api.interceptors.request.use(async (config) => {
  const base = await getApiBaseUrl();
  config.baseURL = base;
  api.defaults.baseURL = base;
  return config;
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Disconnect detection ────────────────────────────────────────────────────────────
// The full-screen "انقطع الاتصال بالبرنامج" overlay must only appear for a REAL
// disconnect, never for a busy server. better-sqlite3 is synchronous, so a heavy
// report/export blocks the event loop and makes short-timeout pings time out — that is
// "busy", not "down". We therefore (a) classify timeouts separately from connection
// failures and (b) require two consecutive connection failures before showing the
// overlay. A single transient blip no longer triggers it.

function classifyError(error) {
  if (error?.response) return "http"; // server answered (4xx/5xx) — it is up
  const code = error?.code || "";
  if (code === "ECONNABORTED" || code === "ETIMEDOUT" || /timeout/i.test(error?.message || "")) {
    return "timeout"; // request aborted by our own timeout — server is busy, not down
  }
  return "disconnect"; // ERR_NETWORK / ECONNREFUSED / ECONNRESET / ENOTFOUND ...
}

let consecutiveDisconnects = 0;
let overlayDispatched = false;

api.interceptors.response.use(
  (response) => {
    // Any successful response proves the server is reachable — reset disconnect state.
    consecutiveDisconnects = 0;
    overlayDispatched = false;
    return response;
  },
  (error) => {
    const kind = classifyError(error);
    const reqUrl = String(error?.config?.url || "");

    if (kind === "disconnect") {
      consecutiveDisconnects += 1;
      // The server may have restarted on a different port — drop the cached base URL so
      // the next request re-resolves the live port instead of retrying a dead one.
      resetApiBaseUrl();
      if (consecutiveDisconnects >= 2 && !overlayDispatched && typeof window !== "undefined") {
        overlayDispatched = true;
        window.dispatchEvent(new CustomEvent("server:unreachable"));
        reportClientDiag({ type: "disconnect", code: error?.code || null, url: reqUrl });
      }
    } else if (kind === "timeout") {
      // Busy server — log it, but do NOT show the disconnect overlay.
      reportClientDiag({ type: "timeout", code: error?.code || null, url: reqUrl });
    }

    const status = error?.response?.status;

    // 5xx → server is up but crashing internally; show a deduped toast
    if (status >= 500 && typeof window !== "undefined") {
      toast.error("خطأ في الخادم الداخلي، يرجى المحاولة مرة أخرى", {
        id: "server-5xx",
        duration: 4000,
      });
    }

    const isAuthLoginRequest = reqUrl.includes("/api/auth/login");

    if (status === 401 && !isAuthLoginRequest) {
      const { logout } = useAuthStore.getState();
      logout();

      if (!isRedirectingToLogin && typeof window !== "undefined") {
        isRedirectingToLogin = true;
        const currentPath = window.location.pathname || "";
        if (!currentPath.startsWith("/login")) {
          const loginPath =
            window.location.protocol === "file:"
              ? "#/login"
              : "/login";
          window.location.replace(loginPath);
        }
        window.setTimeout(() => {
          isRedirectingToLogin = false;
        }, 800);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
