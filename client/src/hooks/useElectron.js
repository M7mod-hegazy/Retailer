export function useElectron() {
  const electronBridge =
    typeof window !== "undefined" ? window.electronAPI || window.retailerAPI || null : null;
  const isElectron = Boolean(electronBridge);
  return {
    isElectron,
    api: electronBridge,
    getVersion: () => (isElectron ? electronBridge.getVersion?.() ?? "desktop" : "web"),
    minimize: () => isElectron && electronBridge.minimize?.(),
    maximize: () => isElectron && electronBridge.maximize?.(),
    close: () => isElectron && electronBridge.close?.(),
  };
}
