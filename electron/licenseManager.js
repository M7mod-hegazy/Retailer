const { getHardwareId } = require("./hardwareId");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const LICENSE_FILE = path.join(app?.getPath?.("userData") || __dirname, "license.json");

function readLicense() {
  try {
    if (fs.existsSync(LICENSE_FILE)) {
      return JSON.parse(fs.readFileSync(LICENSE_FILE, "utf8"));
    }
  } catch {}
  return null;
}

function saveLicense(data) {
  fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2), "utf8");
}

function isLicenseValid() {
  const license = readLicense();
  if (!license) return { valid: false, reason: "no_license" };

  const hwId = getHardwareId();
  if (license.hardware_id && license.hardware_id !== hwId) {
    return { valid: false, reason: "hardware_mismatch" };
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, license };
}

async function activateLicense(licenseKey, serverUrl) {
  const hwId = getHardwareId();
  try {
    const res = await fetch(`${serverUrl}/api/settings/validate-license`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_key: licenseKey, hardware_id: hwId }),
    });
    const data = await res.json();
    if (data.success && data.data?.status === "activated") {
      saveLicense({ ...data.data, hardware_id: hwId, activated_at: new Date().toISOString() });
      return { success: true };
    }
    return { success: false, error: data.message || data.data?.message || "license_not_activated" };
  } catch (err) {
    return { success: false, error: "فشل الاتصال بخادم التفعيل" };
  }
}

module.exports = { readLicense, saveLicense, isLicenseValid, activateLicense, getHardwareId };
