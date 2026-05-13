import axios from "axios";
import { useAuthStore } from "../stores/authStore";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:5000",
});

let isRedirectingToLogin = false;

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const reqUrl = String(error?.config?.url || "");
    const isAuthLoginRequest = reqUrl.includes("/api/auth/login");

    if (status === 401 && !isAuthLoginRequest) {
      const { logout } = useAuthStore.getState();
      logout();

      if (!isRedirectingToLogin && typeof window !== "undefined") {
        isRedirectingToLogin = true;
        const currentPath = window.location.pathname || "";
        if (!currentPath.startsWith("/login")) {
          window.location.replace("/login");
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
