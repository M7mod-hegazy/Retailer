import { useEffect, useState, useCallback } from "react";
import api from "../services/api";

const CACHE_TTL = 10_000;
let cache = { status: "loading", qr: null, error: null, phone: null, ts: 0 };
const listeners = new Set();

function notify(next) {
  cache = { ...next, ts: Date.now() };
  listeners.forEach((fn) => fn(cache));
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
      notify(r.data?.data || { status: "unavailable" });
    } catch {
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
