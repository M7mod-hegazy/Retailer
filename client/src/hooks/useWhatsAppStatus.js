import { useEffect, useState, useCallback } from "react";
import api from "../services/api";

const CACHE_TTL = 10_000;
let cache = { status: "loading", qr: null, error: null, phone: null, ts: 0 };
const listeners = new Set();
let consecutiveFailures = 0;
const MAX_RETRIES = 3;
const BASE_DELAY = 2000;

function notify(next) {
  cache = { ...next, ts: Date.now() };
  listeners.forEach((fn) => fn(cache));
}

function isNetworkError(err) {
  if (!err) return false;
  const code = err?.code || err?.response?.statusText || "";
  const msg = err?.message || "";
  return (
    code === "ERR_CONNECTION_RESET" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "Network Error" ||
    msg.includes("net::ERR_") ||
    msg.includes("connection reset")
  );
}

export function useWhatsAppStatus(pollInterval = 8000) {
  const [state, setState] = useState(cache);

  useEffect(() => {
    listeners.add(setState);
    return () => listeners.delete(setState);
  }, []);

  const fetch_ = useCallback(async () => {
    try {
      const r = await api.get("/api/whatsapp/engine-status");
      consecutiveFailures = 0;
      retryCountRef.current = 0;
      notify(r.data?.data || { status: "unavailable" });
    } catch (err) {
      if (isNetworkError(err)) {
        consecutiveFailures++;
        if (consecutiveFailures <= MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(2, consecutiveFailures - 1);
          setTimeout(() => fetch_(), delay);
        }
        return;
      }
      if (cache.status === "loading") notify({ status: "unavailable", qr: null, error: null, phone: null });
    }
  }, []);

  useEffect(() => {
    if (Date.now() - cache.ts > CACHE_TTL) fetch_();
    const id = setInterval(fetch_, pollInterval);
    return () => clearInterval(id);
  }, [fetch_, pollInterval]);

  return {
    ...state,
    isConnected: state.status === "connected",
    isReady: ["connected", "qr"].includes(state.status),
    statusLabel:
      state.status === "connected" ? "متصل" :
      state.status === "qr" ? "انتظار المسح" :
      state.status === "connecting" ? "جاري الاتصال..." :
      state.status === "error" ? "خطأ" :
      "غير متصل",
  };
}
