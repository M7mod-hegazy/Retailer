import axios from "axios";
import toast from "react-hot-toast";
import { useAuthStore } from "../stores/authStore";
import { getApiBaseUrl, getApiBaseUrlSync, resetApiBaseUrl } from "./apiBase";
import { reportClientDiag } from "./diag";
import { classifyConnectionError, buildErrorReport } from "./connection";

const api = axios.create({
  baseURL: getApiBaseUrlSync(),
  // Global safety net so a genuinely hung request fails cleanly instead of hanging
  // forever. Known-long calls (report exports, uploads) pass their own larger timeout.
  timeout: 60000,
});

// In the packaged app (file://) the base URL is the custom retailer:// protocol,
// which the Electron privileged scheme exposes via the Fetch API (supportFetchAPI).
// Force axios onto its fetch adapter there so requests are guaranteed to go through
// — XHR support for non-http schemes is not reliable. Dev/web keep the default.
if (typeof window !== "undefined" && window.location?.protocol === "file:") {
  api.defaults.adapter = "fetch";
}

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

// classifyError lives in ./connection now so api.js, the POS banner and the settings
// page all share one definition. Re-exposed here under the old name for readability.
const classifyError = classifyConnectionError;

let consecutiveDisconnects = 0;
let overlayDispatched = false;

// Last connection-level failure, kept so any "نسخ تفاصيل الخطأ" (copy error details)
// button — including the global disconnect overlay — can report the real cause even when
// it did not catch the error itself. Updated on every disconnect/timeout.
let lastConnectionError = null;
export function getLastConnectionErrorReport() {
  return lastConnectionError
    ? buildErrorReport(lastConnectionError, { context: "global" })
    : null;
}

api.interceptors.response.use(
  (response) => {
    // Any successful response proves the server is reachable — reset disconnect state.
    consecutiveDisconnects = 0;
    overlayDispatched = false;
    // Any mutation that fired an owner notification reports its outcome here —
    // GlobalTelegramStatusChip (AppShell) renders it app-wide, so no page has
    // to wire the chip individually.
    const tgStatus = response?.data?.telegramStatus;
    if (tgStatus && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("telegram:status", {
        detail: {
          status: tgStatus,
          context: { url: response.config?.url || "", method: (response.config?.method || "").toUpperCase() },
        },
      }));
    }
    return response;
  },
  (error) => {
    const kind = classifyError(error);
    const reqUrl = String(error?.config?.url || "");

    if (kind === "disconnect" || kind === "timeout") {
      lastConnectionError = error; // remember the real cause for the copy-details button
    }

    if (kind === "disconnect") {
      consecutiveDisconnects += 1;
      // The server may have restarted on a different port — drop the cached base URL so
      // the next request re-resolves the live port instead of retrying a dead one.
      resetApiBaseUrl();
      if (consecutiveDisconnects >= 2 && !overlayDispatched && typeof window !== "undefined") {
        overlayDispatched = true;
        // Carry what we know so the overlay can show a specific, fixable message
        // instead of a generic "disconnected". The authoritative cause still comes
        // from the Electron main process (server:status), this is the web fallback.
        window.dispatchEvent(
          new CustomEvent("server:unreachable", {
            detail: { kind, code: error?.code || null, url: reqUrl },
          }),
        );
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

    // 403 → show a specific, helpful Arabic message instead of silent failure.
    // The server sends { code: "permission_denied"|"feature_disabled", page, action } in the body.
    if (status === 403 && typeof window !== "undefined") {
      const data = error?.response?.data || {};
      const code = data.error || data.code || data.error_code;
      if (code === "feature_disabled") {
        toast.error("هذه الميزة غير مفعّلة — راجع إعدادات الميزات لتفعيلها.", {
          id: "403-feature",
          duration: 4000,
        });
      } else if (code === "permission_denied" || data.error === "permission_denied") {
        // Try to map the server's page key to a human label using the same PAGE_PERMISSIONS constant.
        // Import is async-safe because PAGE_PERMISSIONS is a plain object (no React deps).
        const page = data.page || data.required_page || "";
        const action = data.action || data.required_action || "";
        const ACTION_AR = { view: "عرض", add: "إضافة", edit: "تعديل", delete: "حذف", print: "طباعة" };
        const PAGE_LABEL_FALLBACK = {
          pos: "نقطة البيع", daily_treasury: "الخزينة اليومية", purchases: "المشتريات",
          expenses: "المصروفات", revenues: "الإيرادات", reports: "التقارير",
          items: "الأصناف", customers: "العملاء", suppliers: "الموردين",
          users: "المستخدمين", settings: "الإعدادات", stock: "المخزون",
          restaurant_tables: "طاولات المطعم", restaurant_modifiers: "الإضافات والمقادير",
          gold_pricing: "أسعار الذهب", repair_orders: "أوامر الصيانة",
          serial_search: "بحث السيريال", sales_returns: "مرتجعات المبيعات",
          purchase_returns: "مرتجعات المشتريات", payments: "المدفوعات",
          employees: "الموظفون", stock_transfer: "تحويل مخزني",
          withdrawals: "المسحوبات", cheques: "الشيكات",
        };
        const pageLabel = PAGE_LABEL_FALLBACK[page] || page || "هذه الصفحة";
        const actionLabel = ACTION_AR[action] || action;
        const msg = !page && data.message
          ? data.message
          : actionLabel
          ? `ليس لديك صلاحية ${actionLabel} على «${pageLabel}» — تواصل مع المدير.`
          : `ليس لديك صلاحية الوصول إلى «${pageLabel}» — تواصل مع المدير.`;
        toast.error(msg, { id: `403-perm-${page}`, duration: 5000 });
      }
    }

    if (status === 401 && !isAuthLoginRequest) {
      // Public endpoints (e.g. /api/settings) are called before login — do NOT
      // trigger logout or redirect for them; the caller handles the error itself.
      const isPublicEndpoint = reqUrl.includes("/api/settings");
      if (!isPublicEndpoint) {
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
    }

    return Promise.reject(error);
  },
);

// Tell the server the user is logging out so it can fire the Telegram
// USER_LOGOUT owner notification. Fire-and-forget — never blocks the UI and
// never fails the logout. The token is captured up-front because callers clear
// the auth store immediately after, before the request actually dispatches.
export function notifyServerLogout(reason) {
  try {
    const { token } = useAuthStore.getState();
    if (!token) return;
    api.post("/api/auth/logout", { reason: reason || "تسجيل خروج" }, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 7000,
    }).catch(() => {});
  } catch (_) { /* non-critical */ }
}

export default api;
