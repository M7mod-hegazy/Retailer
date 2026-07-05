import { useState, useEffect, useMemo } from "react";
import api from "../services/api";

const CAIRO_TZ = "Africa/Cairo";
const DISPLAY_LOCALE = "ar-EG-u-nu-latn";
const REFETCH_MS = 5 * 60 * 1000;
const TICK_MS = 1000;

export function useServerClock() {
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    let delta = 0;
    let synced = false;
    let mounted = true;

    const sync = async () => {
      try {
        const res = await api.get("/api/time", { timeout: 5000 });
        if (!mounted) return;
        const serverNow = res.data.server_time_ms;
        delta = serverNow - Date.now();
        synced = true;
        setClock(new Date(Date.now() + delta));
      } catch {
        // keep local time if server unreachable
      }
    };

    sync();
    const refetchTimer = setInterval(sync, REFETCH_MS);
    const ticker = setInterval(() => {
      setClock(synced ? new Date(Date.now() + delta) : new Date());
    }, TICK_MS);

    return () => {
      mounted = false;
      clearInterval(refetchTimer);
      clearInterval(ticker);
    };
  }, []);

  const clockTime = useMemo(() => clock.toLocaleTimeString(DISPLAY_LOCALE, {
    timeZone: CAIRO_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  }), [clock]);

  const clockDate = useMemo(() => clock.toLocaleDateString(DISPLAY_LOCALE, {
    timeZone: CAIRO_TZ, weekday: "long", year: "numeric", month: "long", day: "numeric",
  }), [clock]);

  return { clockTime, clockDate };
}
