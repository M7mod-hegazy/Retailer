import { useState, useEffect, useMemo } from "react";
import api from "../services/api";

const CAIRO_TZ = "Africa/Cairo";
const DISPLAY_LOCALE = "ar-EG-u-nu-latn";
const REFETCH_MS = 5 * 60 * 1000;
const TICK_MS = 1000;
const INITIAL_TIMEOUT_MS = 10000;

// Format an absolute instant as Egypt wall-clock. When the server reports the
// applied offset (it does — OS override on a stale-DST Win7 box, else ICU), we
// shift the instant by that offset and read it as UTC, so the displayed clock
// matches the server AND the Windows taskbar even where ICU disagrees with the
// OS about Egypt DST. Before the first /api/time reply, fall back to pinning
// Africa/Cairo (the previous behaviour).
function formatWall(instantMs, offsetMinutes, opts) {
  if (offsetMinutes == null) {
    return new Intl.DateTimeFormat(DISPLAY_LOCALE, { timeZone: CAIRO_TZ, ...opts }).format(new Date(instantMs));
  }
  const shifted = new Date(instantMs + offsetMinutes * 60000);
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, { timeZone: "UTC", ...opts }).format(shifted);
}

export function useServerClock() {
  const [clockMs, setClockMs] = useState(() => Date.now());
  const [offset, setOffset] = useState(null);

  useEffect(() => {
    let delta = 0;
    let synced = false;
    let mounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const sync = async () => {
      try {
        const timeout = retryCount === 0 ? INITIAL_TIMEOUT_MS : 5000;
        const res = await api.get("/api/time", { timeout });
        if (!mounted) return;
        const serverNow = res.data.server_time_ms;
        delta = serverNow - Date.now();
        synced = true;
        retryCount = 0; // reset on success
        if (typeof res.data.wall_offset_minutes === "number") setOffset(res.data.wall_offset_minutes);
        setClockMs(Date.now() + delta);
      } catch {
        // keep local time if server unreachable; retry with backoff on next interval
        if (mounted && retryCount < MAX_RETRIES) retryCount++;
      }
    };

    sync();
    const refetchTimer = setInterval(sync, REFETCH_MS);
    const ticker = setInterval(() => {
      setClockMs(synced ? Date.now() + delta : Date.now());
    }, TICK_MS);

    return () => {
      mounted = false;
      clearInterval(refetchTimer);
      clearInterval(ticker);
    };
  }, []);

  const clockTime = useMemo(
    () => formatWall(clockMs, offset, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
    [clockMs, offset],
  );

  const clockDate = useMemo(
    () => formatWall(clockMs, offset, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    [clockMs, offset],
  );

  return { clockTime, clockDate };
}
