const crypto = require("crypto");
const { getDb } = require("../config/database");
const { getHardwareId } = require("../../../electron/hardwareId");
const { SYSTEM_OWNER_USERNAME } = require("./systemOwner.service");
const { maskIdentifier, normalizePem, verifySignedPayload } = require("../../../shared/licensing/crypto");

const DEVELOPER_USERNAME = String(process.env.DEVELOPER_USERNAME || SYSTEM_OWNER_USERNAME || "m7mod")
  .trim()
  .toLowerCase();

const LICENSE_VENDOR_API_URL = String(process.env.LICENSE_VENDOR_API_URL || "http://127.0.0.1:5050").replace(/\/$/, "");
const LICENSE_VENDOR_APP_KEY = String(process.env.LICENSE_VENDOR_APP_KEY || "change_me_app");
const LICENSE_VENDOR_PUBLIC_KEY = normalizePem(process.env.LICENSE_VENDOR_PUBLIC_KEY || `
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA/ixoiBpESM282TptS2oEgKaVeXYinUuBpnWtc9k8hF0=
-----END PUBLIC KEY-----
`);
const LICENSE_ISSUER = String(process.env.LICENSE_ISSUER || "ElHegazi-Licensing");
const LICENSE_CACHE_SECRET = String(process.env.LICENSE_CACHE_SECRET || process.env.JWT_SECRET || "retailer-license-cache");
const LICENSE_OFFLINE_GRACE_DAYS = Math.max(1, Number(process.env.LICENSE_OFFLINE_GRACE_DAYS || 14));
const LICENSE_REQUIRE_SIGNED_CONFIG = String(process.env.LICENSE_REQUIRE_SIGNED_CONFIG || "0") === "1";
const LICENSE_CONFIG_SIGNATURE = String(process.env.LICENSE_CONFIG_SIGNATURE || "");
const ALLOW_DEV_BYPASS =
  String(process.env.ALLOW_DEV_BYPASS || (process.env.NODE_ENV === "production" ? "false" : "true")) === "true";
const APP_PROTECTION_MODE = String(process.env.APP_PROTECTION_MODE || "hybrid_license")
  .trim()
  .toLowerCase();

function getProtectionMode() {
  return APP_PROTECTION_MODE === "windows_managed" ? "windows_managed" : "hybrid_license";
}

function isWindowsManagedMode() {
  return getProtectionMode() === "windows_managed";
}

function isLicenseFeatureEnabled() {
  return !isWindowsManagedMode();
}

function isDeveloperUser(user) {
  if (!user) return false;
  const username = String(user.username || "").trim().toLowerCase();
  return username === DEVELOPER_USERNAME || Boolean(user.is_system_account);
}

function getHardwareFingerprint() {
  return getHardwareId();
}

function getSettingsSnapshot() {
  return getDb()
    .prepare(
      "SELECT id, license_status, license_key, active_license_id, license_last_check_at, license_last_refresh_at FROM settings WHERE id = 1",
    )
    .get();
}

function deriveEncryptionKey() {
  const material = `${LICENSE_CACHE_SECRET}:${getHardwareFingerprint()}`;
  return crypto.createHash("sha256").update(material).digest();
}

function encryptJson(data) {
  const key = deriveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    tag: tag.toString("base64"),
  };
}

function decryptJson(payload) {
  const key = deriveEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

function computeIntegrityHash(serializedEncryptedPayload) {
  return crypto.createHmac("sha256", LICENSE_CACHE_SECRET).update(serializedEncryptedPayload).digest("hex");
}

function parseSignedPayloadInput(input, label) {
  if (!input) {
    const err = new Error(`${label} is required`);
    err.status = 400;
    throw err;
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("ELH1-")) {
      try {
        const raw = trimmed.slice(5);
        const decoded = Buffer.from(raw, "base64").toString("utf8");
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed === "object") return parsed;
      } catch (_error) {
        const err = new Error(`${label} key format is invalid`);
        err.status = 400;
        throw err;
      }
    }
    try {
      return JSON.parse(trimmed);
    } catch (_error) {
      const err = new Error(`${label} must be valid JSON`);
      err.status = 400;
      throw err;
    }
  }
  if (typeof input !== "object") {
    const err = new Error(`${label} must be an object`);
    err.status = 400;
    throw err;
  }
  return input;
}

function verifySignedLicense(signedLicense) {
  if (!verifySignedPayload(signedLicense, LICENSE_VENDOR_PUBLIC_KEY)) return false;
  if (String(signedLicense.payload?.issuer || "") !== LICENSE_ISSUER) return false;
  return true;
}

function verifyActivationToken(token) {
  if (!verifySignedPayload(token, LICENSE_VENDOR_PUBLIC_KEY)) return false;
  if (String(token.payload?.issuer || "") !== LICENSE_ISSUER) return false;
  return true;
}

function parseOptionalDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isExpired(value) {
  const parsed = parseOptionalDate(value);
  return parsed ? parsed.getTime() <= Date.now() : false;
}

function getConfigValidationPayload() {
  const publicKeyHash = crypto.createHash("sha256").update(LICENSE_VENDOR_PUBLIC_KEY).digest("hex");
  return {
    vendor_api_url: LICENSE_VENDOR_API_URL,
    issuer: LICENSE_ISSUER,
    public_key_hash: publicKeyHash,
  };
}

function isLicenseConfigValid() {
  if (!LICENSE_CONFIG_SIGNATURE) return !LICENSE_REQUIRE_SIGNED_CONFIG;
  return verifySignedPayload(
    {
      payload: getConfigValidationPayload(),
      signature: LICENSE_CONFIG_SIGNATURE,
    },
    LICENSE_VENDOR_PUBLIC_KEY,
  );
}

function loadLicenseRuntimeRecord() {
  return getDb()
    .prepare("SELECT encrypted_payload, integrity_hash, last_seen_client_time, last_refresh_at FROM license_runtime WHERE id = 1")
    .get();
}

function saveLicenseRuntime(cacheData) {
  const db = getDb();
  const encrypted = encryptJson(cacheData);
  const serializedEncrypted = JSON.stringify(encrypted);
  const integrityHash = computeIntegrityHash(serializedEncrypted);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE license_runtime
     SET encrypted_payload = ?, integrity_hash = ?, last_seen_client_time = ?, last_refresh_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
  ).run(serializedEncrypted, integrityHash, now, cacheData.last_refresh_at || now);

  db.prepare(
    `UPDATE settings
     SET license_status = 'activated',
         license_mode = 'hybrid_signed',
         license_key = ?,
         license_last_check_at = ?,
         license_last_refresh_at = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
  ).run(maskIdentifier(cacheData.signed_license?.payload?.license_id), now, cacheData.last_refresh_at || now);
}

function clearLicenseRuntime(reason = "unlicensed") {
  const db = getDb();
  db.prepare(
    `UPDATE license_runtime
     SET encrypted_payload = NULL, integrity_hash = NULL, last_seen_client_time = NULL, last_refresh_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
  ).run();
  db.prepare(
    `UPDATE settings
     SET license_status = ?, license_key = NULL, license_last_check_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
  ).run(reason);
}

function getDecryptedCache() {
  const record = loadLicenseRuntimeRecord();
  if (!record?.encrypted_payload || !record?.integrity_hash) return null;
  const expectedHash = computeIntegrityHash(record.encrypted_payload);
  if (expectedHash !== record.integrity_hash) {
    const err = new Error("License cache integrity check failed");
    err.status = 401;
    err.code = "LICENSE_CACHE_TAMPERED";
    throw err;
  }
  try {
    const encryptedPayload = JSON.parse(record.encrypted_payload);
    return {
      cache: decryptJson(encryptedPayload),
      record,
    };
  } catch (_error) {
    const err = new Error("Corrupted local license cache");
    err.status = 401;
    err.code = "LICENSE_CACHE_CORRUPTED";
    throw err;
  }
}

async function vendorPost(pathname, body) {
  const response = await fetch(`${LICENSE_VENDOR_API_URL}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-key": LICENSE_VENDOR_APP_KEY,
    },
    body: JSON.stringify(body || {}),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (_error) {
    payload = {};
  }
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.message || "Vendor licensing service rejected request");
    error.status = response.status || 502;
    throw error;
  }
  return payload.data;
}

async function activateLicense(input) {
  if (!isLicenseFeatureEnabled()) {
    return {
      success: false,
      status: 409,
      message: "License activation is disabled in windows_managed mode",
    };
  }
  const signedLicense = parseSignedPayloadInput(input, "signed_license");
  if (!verifySignedLicense(signedLicense)) {
    return { success: false, status: 401, message: "Invalid or tampered signed license" };
  }

  const hardwareId = getHardwareFingerprint();
  const activationData = await vendorPost("/activations", {
    signed_license: signedLicense,
    device_id: hardwareId,
  });

  const activationToken = activationData?.activation_token;
  if (!verifyActivationToken(activationToken)) {
    return { success: false, status: 401, message: "Invalid activation token signature" };
  }

  const tokenPayload = activationToken.payload || {};
  if (String(tokenPayload.device_id || "") !== hardwareId) {
    return { success: false, status: 401, message: "Activation token device mismatch" };
  }

  const cacheData = {
    signed_license: signedLicense,
    activation_token: activationToken,
    last_refresh_at: new Date().toISOString(),
    local_device_id: hardwareId,
  };
  saveLicenseRuntime(cacheData);

  return {
    success: true,
    data: {
      status: "activated",
      message: "Activated successfully",
      license_id: signedLicense.payload?.license_id || null,
      key_masked: maskIdentifier(signedLicense.payload?.license_id),
      hardware_id: hardwareId,
      refresh_at: tokenPayload.refresh_at || null,
      expires_at: signedLicense.payload?.expires_at || null,
    },
  };
}

async function refreshLicenseActivation() {
  if (!isLicenseFeatureEnabled()) {
    const err = new Error("License refresh is disabled in windows_managed mode");
    err.status = 409;
    throw err;
  }
  const runtime = getDecryptedCache();
  if (!runtime?.cache?.activation_token) {
    const err = new Error("No local activation token found");
    err.status = 404;
    throw err;
  }

  const refreshed = await vendorPost("/activations/refresh", {
    activation_token: runtime.cache.activation_token,
  });
  if (!verifyActivationToken(refreshed?.activation_token)) {
    const err = new Error("Invalid refreshed activation token");
    err.status = 401;
    throw err;
  }

  runtime.cache.activation_token = refreshed.activation_token;
  runtime.cache.last_refresh_at = new Date().toISOString();
  saveLicenseRuntime(runtime.cache);

  return {
    status: "activated",
    refreshed_at: runtime.cache.last_refresh_at,
    refresh_at: refreshed.activation_token.payload?.refresh_at || null,
  };
}

function syncSettingsLicenseState() {
  if (!isLicenseFeatureEnabled()) {
    const db = getDb();
    db.prepare(
      "UPDATE settings SET license_last_check_at = CURRENT_TIMESTAMP, license_status = 'windows_managed', updated_at = CURRENT_TIMESTAMP WHERE id = 1",
    ).run();
    return;
  }
  try {
    const state = getLicenseAccessState();
    const db = getDb();
    db.prepare(
      "UPDATE settings SET license_last_check_at = CURRENT_TIMESTAMP, license_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
    ).run(state.allowed ? "activated" : "unlicensed");
  } catch (_error) {
    clearLicenseRuntime("unlicensed");
  }
}

function getLicenseAccessState(user = null) {
  if (!isLicenseFeatureEnabled()) {
    return { allowed: true, reason: "windows_managed_mode" };
  }
  const bypassInTests = process.env.NODE_ENV === "test" && process.env.ENFORCE_LICENSE_IN_TESTS !== "1";
  if (bypassInTests) return { allowed: true, reason: "test_mode" };
  if (isDeveloperUser(user) && ALLOW_DEV_BYPASS) return { allowed: true, reason: "developer_bypass" };

  if (!isLicenseConfigValid()) {
    return { allowed: false, reason: "signed_config_invalid" };
  }

  let runtime;
  try {
    runtime = getDecryptedCache();
  } catch (_error) {
    return { allowed: false, reason: "cache_invalid" };
  }
  if (!runtime?.cache) return { allowed: false, reason: "license_required" };

  const { cache, record } = runtime;
  if (!verifySignedLicense(cache.signed_license)) return { allowed: false, reason: "license_signature_invalid" };
  if (!verifyActivationToken(cache.activation_token)) return { allowed: false, reason: "activation_signature_invalid" };

  const licensePayload = cache.signed_license.payload || {};
  const activationPayload = cache.activation_token.payload || {};
  const hardwareId = getHardwareFingerprint();

  if (String(cache.local_device_id || "") !== hardwareId) return { allowed: false, reason: "local_device_mismatch" };
  if (String(activationPayload.device_id || "") !== hardwareId) return { allowed: false, reason: "activation_device_mismatch" };
  if (String(activationPayload.license_id || "") !== String(licensePayload.license_id || "")) {
    return { allowed: false, reason: "license_token_mismatch" };
  }
  if (String(activationPayload.status || "active") !== "active") {
    return { allowed: false, reason: "license_suspended_or_revoked" };
  }
  if (isExpired(licensePayload.expires_at) || isExpired(activationPayload.expires_at)) {
    return { allowed: false, reason: "license_expired" };
  }

  const now = Date.now();
  const lastSeenTime = record?.last_seen_client_time ? new Date(record.last_seen_client_time).getTime() : null;
  if (lastSeenTime && now + 5 * 60 * 1000 < lastSeenTime) {
    return { allowed: false, reason: "clock_rollback_detected" };
  }

  const refreshAt = parseOptionalDate(activationPayload.refresh_at);
  if (refreshAt && now > refreshAt.getTime()) {
    const lastRefresh = parseOptionalDate(record?.last_refresh_at || cache.last_refresh_at);
    const graceMs = LICENSE_OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000;
    if (!lastRefresh || now - lastRefresh.getTime() > graceMs) {
      return { allowed: false, reason: "refresh_grace_expired" };
    }
  }

  getDb()
    .prepare("UPDATE license_runtime SET last_seen_client_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1")
    .run(new Date().toISOString());
  getDb()
    .prepare("UPDATE settings SET license_last_check_at = CURRENT_TIMESTAMP, license_status = 'activated' WHERE id = 1")
    .run();

  return {
    allowed: true,
    reason: "ok",
    license_id: licensePayload.license_id || null,
    customer_id: licensePayload.customer_id || null,
    refresh_at: activationPayload.refresh_at || null,
    expires_at: licensePayload.expires_at || null,
  };
}

function getLicenseStatusSummary() {
  if (!isLicenseFeatureEnabled()) {
    return {
      allowed: true,
      reason: "windows_managed_mode",
      status: "not_required",
      mode: "windows_managed",
      allow_dev_bypass: ALLOW_DEV_BYPASS,
    };
  }
  const access = getLicenseAccessState();
  if (!access.allowed) {
    return {
      ...access,
      status: "unlicensed",
      mode: "hybrid_signed",
      allow_dev_bypass: ALLOW_DEV_BYPASS,
    };
  }
  const runtime = getDecryptedCache();
  return {
    ...access,
    status: "activated",
    mode: "hybrid_signed",
    allow_dev_bypass: ALLOW_DEV_BYPASS,
    license_masked: maskIdentifier(runtime?.cache?.signed_license?.payload?.license_id),
    device_id_masked: maskIdentifier(getHardwareFingerprint()),
    last_refresh_at: runtime?.cache?.last_refresh_at || null,
  };
}

function exportLicenseDiagnostics() {
  const settings = getSettingsSnapshot();
  const runtime = loadLicenseRuntimeRecord();
  const summary = getLicenseStatusSummary();
  return {
    generated_at: new Date().toISOString(),
    settings: {
      license_status: settings?.license_status || null,
      license_last_check_at: settings?.license_last_check_at || null,
      license_last_refresh_at: settings?.license_last_refresh_at || null,
    },
    summary,
    runtime: {
      has_cache: Boolean(runtime?.encrypted_payload),
      has_integrity_hash: Boolean(runtime?.integrity_hash),
      last_seen_client_time: runtime?.last_seen_client_time || null,
      last_refresh_at: runtime?.last_refresh_at || null,
    },
    config: getConfigValidationPayload(),
  };
}

function generateLicense() {
  const error = new Error("Local license generation is disabled in hybrid signed mode");
  error.status = 404;
  throw error;
}

function listLicenses() {
  const error = new Error("Local license listing is disabled in hybrid signed mode");
  error.status = 404;
  throw error;
}

function setLicenseStatus() {
  const error = new Error("Local license status changes are disabled in hybrid signed mode");
  error.status = 404;
  throw error;
}

function deleteLicense() {
  const error = new Error("Local license deletion is disabled in hybrid signed mode");
  error.status = 404;
  throw error;
}

module.exports = {
  ALLOW_DEV_BYPASS,
  APP_PROTECTION_MODE,
  DEVELOPER_USERNAME,
  activateLicense,
  clearLicenseRuntime,
  deleteLicense,
  exportLicenseDiagnostics,
  generateLicense,
  getHardwareFingerprint,
  getLicenseAccessState,
  getProtectionMode,
  getLicenseStatusSummary,
  isLicenseFeatureEnabled,
  isDeveloperUser,
  isWindowsManagedMode,
  listLicenses,
  refreshLicenseActivation,
  setLicenseStatus,
  syncSettingsLicenseState,
};
