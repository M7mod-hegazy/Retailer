const handlers = {};
let initialized = false;

function handleIpcAction({ action, data }) {
  const subs = handlers[action];
  if (subs) subs.forEach(fn => fn(data));
}

export function initGlobalIpcListener() {
  if (initialized) return;
  initialized = true;
  if (typeof window === 'undefined' || !window.electronAPI?.onModalAction) return;
  const cleanup = window.electronAPI.onModalAction(handleIpcAction);
  window.addEventListener('beforeunload', cleanup);
}

export function registerIpcHandler(action, fn) {
  if (!handlers[action]) handlers[action] = new Set();
  handlers[action].add(fn);
  return () => { handlers[action]?.delete(fn); };
}
