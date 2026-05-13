const { autoUpdater } = require('electron-updater')
const { ipcMain } = require('electron')

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.verifyUpdateCodeSignature = false

let mainWindow = null

function setupUpdater(win) {
  mainWindow = win

  autoUpdater.checkForUpdates().catch(() => {})

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 4 * 60 * 60 * 1000)

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update:available', info)
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update:not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:progress', progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update:downloaded', info)
  })

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update:error', err.message)
  })
}

ipcMain.handle('update:check', () => autoUpdater.checkForUpdates().catch(() => {}))
ipcMain.handle('update:download', () => autoUpdater.downloadUpdate())
ipcMain.handle('update:install-now', () => autoUpdater.quitAndInstall())

module.exports = { setupUpdater }
