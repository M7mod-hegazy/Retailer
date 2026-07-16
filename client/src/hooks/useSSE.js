import { useEffect, useState } from "react";
import { useNotificationStore } from "../stores/notificationStore";
import { useAuthStore } from "../stores/authStore";

const SHARED = {
  es: null,
  connected: false,
  listeners: new Set(),
  reconnectTimer: null,
};

function reconnect() {
  if (SHARED.es) SHARED.es.close();
  // EventSource cannot send an Authorization header, so the JWT goes in the
  // query string; the server's SSE route accepts it from there.
  const token = useAuthStore.getState().token;
  if (!token) {
    // Not logged in yet — retry once a session exists instead of spamming 401s.
    if (SHARED.reconnectTimer) clearTimeout(SHARED.reconnectTimer);
    SHARED.reconnectTimer = setTimeout(reconnect, 5000);
    return;
  }
  SHARED.es = new EventSource(`${window.location.origin}/api/sse/events?token=${encodeURIComponent(token)}`);

  SHARED.es.onopen = () => {
    SHARED.connected = true;
    SHARED.listeners.forEach((fn) => fn(true));
  };

  SHARED.es.addEventListener("connected", () => {
    SHARED.connected = true;
    SHARED.listeners.forEach((fn) => fn(true));
  });

  SHARED.es.onerror = () => {
    SHARED.connected = false;
    SHARED.listeners.forEach((fn) => fn(false));
    if (SHARED.reconnectTimer) clearTimeout(SHARED.reconnectTimer);
    SHARED.reconnectTimer = setTimeout(reconnect, 5000);
  };
}

export function useSSE({ onOrderNew, onSyncCompleted, onSyncFailed } = {}) {
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);

  useEffect(() => {
    if (!SHARED.es) reconnect();

    const onOrder = (event) => {
      try {
        const { notification, order } = JSON.parse(event.data);
        fetchNotifications();
        if (onOrderNew) onOrderNew(notification, order);
      } catch {}
    };

    const onSyncOk = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onSyncCompleted) onSyncCompleted(data);
      } catch {}
    };

    const onSyncFail = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onSyncFailed) onSyncFailed(data);
      } catch {}
    };

    if (SHARED.es) {
      SHARED.es.addEventListener("order:new", onOrder);
      SHARED.es.addEventListener("sync:completed", onSyncOk);
      SHARED.es.addEventListener("sync:failed", onSyncFail);
    }

    return () => {
      if (SHARED.es) {
        SHARED.es.removeEventListener("order:new", onOrder);
        SHARED.es.removeEventListener("sync:completed", onSyncOk);
        SHARED.es.removeEventListener("sync:failed", onSyncFail);
      }
    };
  }, [fetchNotifications, onOrderNew, onSyncCompleted, onSyncFailed]);

  return { reconnect: reconnect };
}

export function useSSEConnectionStatus() {
  const [connected, setConnected] = useState(() => SHARED.connected);

  useEffect(() => {
    if (!SHARED.es) reconnect();
    SHARED.listeners.add(setConnected);
    setConnected(SHARED.connected);
    return () => {
      SHARED.listeners.delete(setConnected);
    };
  }, []);

  return {
    subscribe: (fn) => {
      SHARED.listeners.add(fn);
      fn(SHARED.connected);
      return () => SHARED.listeners.delete(fn);
    },
    isConnected: () => SHARED.connected,
    connected,
  };
}
