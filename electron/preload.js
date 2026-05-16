const { contextBridge, ipcRenderer } = require("electron");

const allowedChannels = {
  backup: ["backup:create", "backup:restore"],
  print: ["print:receipt", "print:preview"],
  dialogs: ["dialog:open-file", "dialog:save-file"],
  maintenance: ["maintenance:status", "maintenance:request-uninstall"],
  updates: ["update:available", "update:not-available", "update:progress", "update:downloaded", "update:error"],
  app: ["app:set-icon"],
};

const api = {
  getVersion() {
    return ipcRenderer.invoke("system:get-version");
  },
  minimize() {
    ipcRenderer.send("window:minimize");
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
};

contextBridge.exposeInMainWorld("electronAPI", api);
contextBridge.exposeInMainWorld("retailerAPI", api);
