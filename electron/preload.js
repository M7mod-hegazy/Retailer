const { contextBridge, ipcRenderer } = require("electron");

const allowedChannels = {
  backup: ["backup:create", "backup:restore"],
  print: ["print:receipt", "print:preview", "print:silent", "print:list-printers"],
  dialogs: ["dialog:open-file", "dialog:save-file"],
  maintenance: ["maintenance:status", "maintenance:request-uninstall"],
  diag: ["diag:get-report", "diag:open-logs", "diag:run-and-fix"],
  updates: ["update:available", "update:not-available", "update:progress", "update:downloaded", "update:error", "update:canceled", "update:check", "update:download", "update:cancel-download", "update:install-now", "update:manual-progress", "update:manual-complete", "update:manual-error", "update:manual-canceled", "update:get-manual-info", "update:start-manual-download", "update:cancel-manual-download", "update:open-installer", "update:list-releases", "update:download-version"],
  app: ["app:set-icon", "app:show-quit-dialog", "app:quit", "get:api-url"],
  server: ["server:status"],
  wa: ["wa:status", "wa:link", "wa:unlink", "wa:send", "wa:status-update"],
  license: ["license:getStatus", "license:getHardwareId", "license:submit"],
};

const api = {
  getVersion() {
    return ipcRenderer.invoke("system:get-version");
  },
  isFirstRun() {
    return ipcRenderer.invoke("app:is-first-run");
  },
  getApiUrl() {
    return ipcRenderer.invoke("get:api-url");
  },
  minimize() {
    ipcRenderer.send("window:minimize");
  },
  hide() {
    ipcRenderer.send("window:hide");
  },
  maximize() {
    ipcRenderer.send("window:maximize");
  },
  close() {
    ipcRenderer.send("window:close");
  },
  invoke(channel, payload) {
    const allChannels = Object.values(allowedChannels).flat();
    if (!allChannels.includes(channel)) {
      throw new Error(`Channel not allowed: ${channel}`);
    }
    return ipcRenderer.invoke(channel, payload);
  },
  on(channel, listener) {
    const allChannels = Object.values(allowedChannels).flat();
    if (!allChannels.includes(channel)) {
      throw new Error(`Channel not allowed: ${channel}`);
    }
    const wrapped = (_event, data) => listener(data);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  onSystemResume(listener) {
    const wrapped = () => listener();
    ipcRenderer.on("system:resume", wrapped);
    return () => ipcRenderer.removeListener("system:resume", wrapped);
  },
  createModalWindow(payload) {
    return ipcRenderer.invoke("modal:create-child", payload);
  },
  getModalInitialState() {
    return ipcRenderer.invoke("modal:get-initial-state");
  },
  sendModalAction(payload) {
    return ipcRenderer.invoke("modal:child-action", payload);
  },
  onModalAction(listener) {
    const wrapped = (_event, data) => listener(data);
    ipcRenderer.on("modal:action-from-child", wrapped);
    return () => ipcRenderer.removeListener("modal:action-from-child", wrapped);
  },
  navigateParent(path) {
    return ipcRenderer.invoke("window:navigate-parent", path);
  },
  closeModalWindow() {
    return ipcRenderer.invoke("modal:close-self");
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);
contextBridge.exposeInMainWorld("retailerAPI", api);
