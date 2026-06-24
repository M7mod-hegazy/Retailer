const fs = require("fs");
const path = require("path");
const { app } = require("electron");

let _statusCallback = null;

function statusFilePath() {
  return path.join(app.getPath("userData"), "install-progress.json");
}

function setInstallStatus(status, extra = {}) {
  try {
    const data = JSON.stringify({
      status,
      ...extra,
      updatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(statusFilePath(), data, "utf8");
    if (_statusCallback) {
      try {
        _statusCallback(status, extra);
      } catch (_) {}
    }
  } catch (_) {}
}

function getInstallStatus() {
  try {
    const raw = fs.readFileSync(statusFilePath(), "utf8");
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function clearInstallStatus() {
  try {
    fs.unlinkSync(statusFilePath());
  } catch (_) {}
}

function onStatusChange(fn) {
  _statusCallback = fn;
}

function removeStatusChange() {
  _statusCallback = null;
}

module.exports = {
  setInstallStatus,
  getInstallStatus,
  clearInstallStatus,
  onStatusChange,
  removeStatusChange,
};
