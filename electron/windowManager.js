const { BrowserWindow, screen } = require("electron");
const path = require("path");

let mainWindow = null;

function createMainWindow(options = {}) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: "ElHegazi Retailer",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    ...options,
  });

  return mainWindow;
}

function getMainWindow() {
  return mainWindow;
}

function minimizeWindow() {
  if (mainWindow) mainWindow.minimize();
}

function maximizeWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
}

function closeWindow() {
  if (mainWindow) mainWindow.close();
}

function setFullscreen(flag) {
  if (mainWindow) mainWindow.setFullScreen(flag);
}

module.exports = { createMainWindow, getMainWindow, minimizeWindow, maximizeWindow, closeWindow, setFullscreen };
