const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("signerAPI", {
  status: () => ipcRenderer.invoke("signer:status"),
  list: () => ipcRenderer.invoke("signer:list"),
  keygen: () => ipcRenderer.invoke("signer:keygen"),
  generate: (payload) => ipcRenderer.invoke("signer:generate", payload),
  openFolder: (filePath) => ipcRenderer.invoke("signer:openFolder", filePath),
  copyText: (text) => ipcRenderer.invoke("signer:copyText", text),
});
