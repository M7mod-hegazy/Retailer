const { BrowserWindow } = require("electron");
const path = require("path");

const modalStates = new Map();
let childWindows = new Set();

function getParentUrl(mainWindow) {
  const wc = mainWindow.webContents;
  const url = wc.getURL();
  if (url && url.startsWith("http")) return url;
  return null;
}

const MAX_URL_STATE_LENGTH = 3000;

function createModalWindow(mainWindow, { modalType, state, bounds }) {
  const parentUrl = getParentUrl(mainWindow);
  const x = bounds?.x ? bounds.x + 40 : undefined;
  const y = bounds?.y ? bounds.y + 40 : undefined;
  const width = bounds?.width || Math.min(800, Math.round(bounds?.width || 600));
  const height = bounds?.height || Math.min(700, Math.round(bounds?.height || 500));

  const child = new BrowserWindow({
    width,
    height,
    x,
    y,
    parent: mainWindow,
    minWidth: 400,
    minHeight: 300,
    show: false,
    title: "ElHegazi Retailer",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets", process.platform === "win32" ? "icon.ico" : "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const childId = child.id;
  modalStates.set(childId, { modalType, state });
  childWindows.add(child);

  child.once("ready-to-show", () => {
    child.show();
  });

  child.on("closed", () => {
    modalStates.delete(childId);
    childWindows.delete(child);
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("modal:action-from-child", { childId, action: "cancel" });
      }
    } catch (_) {}
  });

  console.log('[modalWindowManager] creating child window', { modalType, stateHasContent: !!state?.contentHtml, bounds });

  const serialized = JSON.stringify({ modalType, state });
  const isLarge = serialized.length > MAX_URL_STATE_LENGTH;

  const detachedState = isLarge
    ? JSON.stringify({ stateViaIPC: true })
    : serialized;
  const encodedState = encodeURIComponent(detachedState);

  const isDev = !require("electron").app.isPackaged;
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (isDev && devUrl) {
    const separator = devUrl.includes("?") ? "&" : "?";
    child.loadURL(`${devUrl}${separator}detachedModal=1&detachedState=${encodedState}`);
  } else {
    child.loadFile(
      path.join(__dirname, "..", "client", "dist", "index.html"),
      { query: { detachedModal: "1", detachedState: encodedState } }
    );
  }

  return childId;
}

function getModalState(childId) {
  return modalStates.get(childId) || null;
}

function closeChildWindows() {
  for (const win of childWindows) {
    if (!win.isDestroyed()) win.close();
  }
  childWindows.clear();
  modalStates.clear();
}

module.exports = { createModalWindow, getModalState, closeChildWindows };
