// Standalone one-window GUI for signing licenses. Same engine as the CLI.
//
//   npx electron tools/license-signer/signer-gui/main.js
//   (or:  npm run sign:gui  from the repo root)
//
// Never bundled into the customer app — this is a seller-only tool.

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { generate, keysExist, runKeygen, readRegistry } = require("../signEngine");

function createWindow() {
  const win = new BrowserWindow({
    width: 560,
    height: 720,
    resizable: false,
    title: "ElHegazi License Signer",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.setMenuBarVisibility(false);

  // Surface any preload failure in the terminal so it is debuggable.
  win.webContents.on("preload-error", (_e, preloadPath, error) => {
    console.error("PRELOAD ERROR:", preloadPath, error);
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

ipcMain.handle("signer:status", () => ({ keysExist: keysExist() }));

ipcMain.handle("signer:list", () => {
  // Newest first.
  return readRegistry().slice().reverse();
});

ipcMain.handle("signer:keygen", () => {
  try {
    const { privateKeyPath } = runKeygen({ force: false });
    return { ok: true, privateKeyPath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("signer:generate", async (_event, payload = {}) => {
  try {
    const result = await generate({
      fingerprint: payload.fingerprint,
      name: payload.name,
      expiresAt: payload.expiresAt || null,
      features: payload.features || "full",
    });
    return {
      ok: true,
      licenseId: result.licenseId,
      keyPath: result.keyPath,
      qrPath: result.qrPath,
      blob: result.blob,
      expiresAt: result.payload.expiresAt,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("signer:openFolder", (_event, filePath) => {
  if (filePath) shell.showItemInFolder(filePath);
  return { ok: true };
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => app.quit());
