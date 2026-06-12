import axios from "axios";
import toast from "react-hot-toast";
import { useAuthStore } from "../stores/authStore";

let resolvedBaseUrl = null;

async function resolveBaseUrl() {
  if (resolvedBaseUrl) return resolvedBaseUrl;
  if (typeof window !== "undefined" && window.electronAPI?.getApiUrl) {
    try {
      resolvedBaseUrl = await window.electronAPI.getApiUrl();
      return resolvedBaseUrl;
    } catch (_) {}
  }
  resolvedBaseUrl = import.meta.env.VITE_API_URL || window.location.origin || "http://127.0.0.1:5000";
  return resolvedBaseUrl;
}

const api = axios.create({
  baseURL: "http://127.0.0.1:5000",
});

let isRedirectingToLogin = false;

let baseUrlResolved = false;

api.interceptors.request.use(async (config) => {
  if (!baseUrlResolved) {
    config.baseURL = await resolveBaseUrl();
    api.defaults.baseURL = config.baseURL;
    baseUrlResolved = true;
  }
  return config;
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Network error — server is unreachable (ECONNREFUSED, timeout, etc.)
    if (!error.response && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("server:unreachable"));
    }

    const status = error?.response?.status;

    // 5xx → server is up but crashing internally; show a deduped toast
    if (status >= 500 && typeof window !== "undefined") {
      toast.error("خطأ في الخادم الداخلي، يرجى المحاولة مرة أخرى", {
        id: "server-5xx",
        duration: 4000,
      });
    }
    const reqUrl = String(error?.config?.url || "");
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
