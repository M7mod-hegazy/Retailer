const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("signerAPI", {
  status: () => ipcRenderer.invoke("signer:status"),
  keygen: () => ipcRenderer.invoke("signer:keygen"),
  generate: (payload) => ipcRenderer.invoke("signer:generate", payload),
  openFolder: (filePath) => ipcRenderer.invoke("signer:openFolder", filePath),
});
