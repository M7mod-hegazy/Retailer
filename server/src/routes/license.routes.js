const express = require("express");
const { authRequired } = require("../middleware/auth");
const {
  activateLicense,
  exportLicenseDiagnostics,
  getHardwareFingerprint,
  getLicenseStatusSummary,
  isLicenseFeatureEnabled,
  refreshLicenseActivation,
} = require("../services/license.service");

const router = express.Router();

router.get("/status", (_req, res) => {
  res.json({ success: true, data: getLicenseStatusSummary() });
});

router.post("/activate", async (req, res, next) => {
  try {
    if (!isLicenseFeatureEnabled()) {
      const error = new Error("License activation is disabled in windows_managed mode");
      error.status = 409;
      throw error;
    }
    const result = await activateLicense(req.body?.signed_license || req.body?.license_key);
    if (!result.success) {
      const error = new Error(result.message || "License activation failed");
      error.status = result.status || 400;
      throw error;
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", authRequired, async (_req, res, next) => {
  try {
    if (!isLicenseFeatureEnabled()) {
      const error = new Error("License refresh is disabled in windows_managed mode");
      error.status = 409;
      throw error;
    }
    const data = await refreshLicenseActivation();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/hardware-id", (_req, res) => {
  res.json({ success: true, data: { hardware_id: getHardwareFingerprint() } });
});

router.get("/diagnostics", authRequired, (req, res, next) => {
  try {
    if (!isLicenseFeatureEnabled()) {
      const error = new Error("License diagnostics are disabled in windows_managed mode");
      error.status = 409;
      throw error;
    }
    if (req.user?.role !== "admin") {
      const error = new Error("Admin permission required");
      error.status = 403;
      throw error;
    }
    res.json({ success: true, data: exportLicenseDiagnostics() });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
