const crypto = require("crypto");
const { getDb } = require("./db");
const { normalizePem, signPayload, verifySignedPayload } = require("../../shared/licensing/crypto");

const DEFAULT_PRIVATE_KEY = `
-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIEBW7zQxn42F/Bc8SxEXE0Wyp3Io5YviP699biqDFb3d
-----END PRIVATE KEY-----
`;

const DEFAULT_PUBLIC_KEY = `
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA/ixoiBpESM282TptS2oEgKaVeXYinUuBpnWtc9k8hF0=
-----END PUBLIC KEY-----
`;

function getIssuer() {
  return String(process.env.VENDOR_ISSUER || "ElHegazi-Licensing");
}

function getRefreshHours() {
  return Number(process.env.ACTIVATION_REFRESH_HOURS || 24);
}

function getPrivateKey() {
  return normalizePem(process.env.VENDOR_PRIVATE_KEY_PEM || DEFAULT_PRIVATE_KEY);
}

function getPublicKey() {
  return normalizePem(process.env.VENDOR_PUBLIC_KEY_PEM || DEFAULT_PUBLIC_KEY);
}

function getAdminApiKey() {
  return String(process.env.VENDOR_ADMIN_API_KEY || "change_me_admin");
}

function getAppApiKey() {
  return String(process.env.VENDOR_APP_API_KEY || "change_me_app");
}

function parseDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/[^\d+]/g, "");
}

function buildCustomerId(input) {
  const explicit = String(input.customer_id || "").trim();
  if (explicit) return explicit;
  const phone = normalizePhone(input.customer_phone);
  if (phone) return `phone_${phone}`;
  return crypto.randomUUID();
}

function isExpired(isoDate) {
  if (!isoDate) return false;
  return new Date(isoDate).getTime() <= Date.now();
}

function createActivationTokenPayload(license, deviceId) {
  const now = new Date();
  const refreshAt = new Date(now.getTime() + getRefreshHours() * 60 * 60 * 1000).toISOString();
  return {
    license_id: license.id,
    customer_id: license.customer_id,
    device_id: deviceId,
    status: license.status,
    plan: license.plan,
    features: JSON.parse(license.features_json || "[]"),
    grace_days: license.grace_days,
    issued_at: now.toISOString(),
    refresh_at: refreshAt,
    expires_at: license.expires_at || null,
    issuer: license.issuer,
  };
}

function logAudit(actor, action, targetType, targetId, payload = null) {
  getDb()
    .prepare("INSERT INTO audit_logs (actor, action, target_type, target_id, payload_json) VALUES (?, ?, ?, ?, ?)")
    .run(actor, action, targetType, targetId, payload ? JSON.stringify(payload) : null);
}

function createLicense(input = {}, actor = "admin") {
  const db = getDb();
  const now = new Date().toISOString();
  const customerId = buildCustomerId(input);
  const customerName = String(input.customer_name || `Customer-${customerId.slice(0, 8)}`);
  const customerEmail = input.customer_email ? String(input.customer_email) : null;
  const customerPhone = normalizePhone(input.customer_phone) || null;

  db.prepare("INSERT OR IGNORE INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)").run(
    customerId,
    customerName,
    customerEmail,
    customerPhone,
  );
  db.prepare("UPDATE customers SET name = ?, email = ?, phone = ? WHERE id = ?").run(
    customerName,
    customerEmail,
    customerPhone,
    customerId,
  );

  const licenseId = String(input.license_id || crypto.randomUUID());
  const payload = {
    license_id: licenseId,
    customer_id: customerId,
    plan: String(input.plan || "standard"),
    issued_at: now,
    expires_at: parseDateOrNull(input.expires_at),
    max_devices: Math.max(1, Number(input.max_devices || 1)),
    features: Array.isArray(input.features) ? input.features.map(String) : [],
    grace_days: Math.max(1, Number(input.grace_days || 14)),
    issuer: getIssuer(),
  };

  const signedLicense = signPayload(payload, getPrivateKey());

  db.prepare(
    `INSERT INTO licenses (
      id, customer_id, plan, issued_at, expires_at, max_devices, features_json, grace_days, issuer, status, signed_license_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
  ).run(
    payload.license_id,
    payload.customer_id,
    payload.plan,
    payload.issued_at,
    payload.expires_at,
    payload.max_devices,
    JSON.stringify(payload.features),
    payload.grace_days,
    payload.issuer,
    JSON.stringify(signedLicense),
  );

  logAudit(actor, "license_created", "license", payload.license_id, { customer_id: payload.customer_id, plan: payload.plan });

  return {
    license_id: payload.license_id,
    customer_id: payload.customer_id,
    customer_name: customerName,
    customer_phone: customerPhone,
    status: "active",
    signed_license: signedLicense,
  };
}

function updateLicense(licenseId, input = {}, actor = "admin") {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM licenses WHERE id = ?").get(String(licenseId));
  if (!existing) {
    const err = new Error("License not found");
    err.status = 404;
    throw err;
  }

  const customerId = buildCustomerId({
    customer_id: input.customer_id || existing.customer_id,
    customer_phone: input.customer_phone,
  });
  const customerName = String(input.customer_name || `Customer-${customerId.slice(0, 8)}`);
  const customerEmail = input.customer_email ? String(input.customer_email) : null;
  const customerPhone = normalizePhone(input.customer_phone) || null;

  db.prepare("INSERT OR IGNORE INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)").run(
    customerId,
    customerName,
    customerEmail,
    customerPhone,
  );
  db.prepare("UPDATE customers SET name = ?, email = ?, phone = ? WHERE id = ?").run(
    customerName,
    customerEmail,
    customerPhone,
    customerId,
  );

  const payload = {
    license_id: existing.id,
    customer_id: customerId,
    plan: String(input.plan || existing.plan || "standard"),
    issued_at: existing.issued_at,
    expires_at: parseDateOrNull(input.expires_at ?? existing.expires_at),
    max_devices: Math.max(1, Number(input.max_devices ?? existing.max_devices ?? 1)),
    features: Array.isArray(input.features) ? input.features.map(String) : JSON.parse(existing.features_json || "[]"),
    grace_days: Math.max(1, Number(input.grace_days ?? existing.grace_days ?? 14)),
    issuer: existing.issuer || getIssuer(),
  };
  const signedLicense = signPayload(payload, getPrivateKey());

  db.prepare(
    `UPDATE licenses
     SET customer_id = ?, plan = ?, expires_at = ?, max_devices = ?, features_json = ?, grace_days = ?, signed_license_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(
    payload.customer_id,
    payload.plan,
    payload.expires_at,
    payload.max_devices,
    JSON.stringify(payload.features),
    payload.grace_days,
    JSON.stringify(signedLicense),
    existing.id,
  );

  logAudit(actor, "license_updated", "license", existing.id, {
    customer_id: payload.customer_id,
    plan: payload.plan,
    max_devices: payload.max_devices,
    grace_days: payload.grace_days,
  });

  return {
    license_id: existing.id,
    customer_id: payload.customer_id,
    customer_name: customerName,
    customer_phone: customerPhone,
    status: existing.status,
    signed_license: signedLicense,
  };
}

function getLicenseById(licenseId) {
  return getDb().prepare("SELECT * FROM licenses WHERE id = ?").get(String(licenseId));
}

function setLicenseStatus(licenseId, status, actor = "admin") {
  const db = getDb();
  const allowed = new Set(["active", "suspended", "revoked"]);
  if (!allowed.has(status)) {
    const err = new Error("Invalid license status");
    err.status = 400;
    throw err;
  }
  const info = db
    .prepare("UPDATE licenses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(status, String(licenseId));
  if (!info.changes) {
    const err = new Error("License not found");
    err.status = 404;
    throw err;
  }

  db.prepare(
    "UPDATE activations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE license_id = ? AND status != 'revoked'",
  ).run(status, String(licenseId));
  logAudit(actor, `license_${status}`, "license", String(licenseId));
}

function deleteLicense(licenseId, actor = "admin") {
  const db = getDb();
  const info = db.prepare("DELETE FROM licenses WHERE id = ?").run(String(licenseId));
  if (!info.changes) {
    const err = new Error("License not found");
    err.status = 404;
    throw err;
  }
  logAudit(actor, "license_deleted", "license", String(licenseId));
}

function parseAndValidateSignedLicense(signedLicense) {
  if (!verifySignedPayload(signedLicense, getPublicKey())) {
    const err = new Error("Invalid signed license signature");
    err.status = 401;
    throw err;
  }
  if (String(signedLicense.payload?.issuer || "") !== getIssuer()) {
    const err = new Error("Unknown license issuer");
    err.status = 401;
    throw err;
  }
  return signedLicense.payload;
}

function activateLicense(signedLicense, deviceId, actor = "app") {
  const db = getDb();
  const payload = parseAndValidateSignedLicense(signedLicense);
  const normalizedDevice = String(deviceId || "").trim();
  if (!normalizedDevice) {
    const err = new Error("device_id is required");
    err.status = 400;
    throw err;
  }

  const license = getLicenseById(payload.license_id);
  if (!license) {
    const err = new Error("License not found");
    err.status = 404;
    throw err;
  }
  if (license.status === "suspended") {
    const err = new Error("License suspended");
    err.status = 403;
    throw err;
  }
  if (license.status === "revoked") {
    const err = new Error("License revoked");
    err.status = 403;
    throw err;
  }
  if (isExpired(license.expires_at)) {
    const err = new Error("License expired");
    err.status = 403;
    throw err;
  }

  const activeActivation = db
    .prepare("SELECT id FROM activations WHERE license_id = ? AND device_id = ?")
    .get(license.id, normalizedDevice);
  if (!activeActivation) {
    const count = db
      .prepare("SELECT COUNT(1) as total FROM activations WHERE license_id = ?")
      .get(license.id)?.total;
    if (Number(count || 0) >= Number(license.max_devices || 1)) {
      const err = new Error("Maximum activated devices reached");
      err.status = 403;
      throw err;
    }
  }

  const tokenPayload = createActivationTokenPayload(license, normalizedDevice);
  const signedActivationToken = signPayload(tokenPayload, getPrivateKey());
  const activationId = activeActivation?.id || crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO activations (id, license_id, device_id, activated_at, last_refresh_at, status, activation_token_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(license_id, device_id) DO UPDATE SET
       last_refresh_at = excluded.last_refresh_at,
       status = excluded.status,
       activation_token_json = excluded.activation_token_json,
       updated_at = CURRENT_TIMESTAMP`,
  ).run(activationId, license.id, normalizedDevice, now, now, license.status, JSON.stringify(signedActivationToken));

  logAudit(actor, "license_activated", "activation", activationId, { license_id: license.id, device_id: normalizedDevice });

  return {
    activation_id: activationId,
    activation_token: signedActivationToken,
    refresh_at: tokenPayload.refresh_at,
    status: license.status,
  };
}

function refreshActivationToken(activationToken, actor = "app") {
  if (!verifySignedPayload(activationToken, getPublicKey())) {
    const err = new Error("Invalid activation token signature");
    err.status = 401;
    throw err;
  }
  const payload = activationToken.payload || {};
  const license = getLicenseById(payload.license_id);
  if (!license) {
    const err = new Error("License not found");
    err.status = 404;
    throw err;
  }
  if (license.status === "revoked") {
    const err = new Error("License revoked");
    err.status = 403;
    throw err;
  }

  return activateLicense(
    {
      payload: JSON.parse(license.signed_license_json).payload,
      signature: JSON.parse(license.signed_license_json).signature,
    },
    payload.device_id,
    actor,
  );
}

function rebindActivation(licenseId, oldDeviceId, newDeviceId, actor = "admin") {
  const db = getDb();
  const info = db
    .prepare("UPDATE activations SET device_id = ?, updated_at = CURRENT_TIMESTAMP WHERE license_id = ? AND device_id = ?")
    .run(String(newDeviceId), String(licenseId), String(oldDeviceId));
  if (!info.changes) {
    const err = new Error("Activation binding not found");
    err.status = 404;
    throw err;
  }
  logAudit(actor, "activation_rebind", "license", String(licenseId), {
    old_device_id: String(oldDeviceId),
    new_device_id: String(newDeviceId),
  });
}

function listLicenses() {
  return getDb()
    .prepare(
      `SELECT l.id,
              l.customer_id,
              c.name as customer_name,
              c.email as customer_email,
              c.phone as customer_phone,
              l.plan,
              l.issued_at,
              l.expires_at,
              l.max_devices,
              l.grace_days,
              l.issuer,
              l.status,
              l.signed_license_json,
              l.created_at
       FROM licenses l
       LEFT JOIN customers c ON c.id = l.customer_id
       ORDER BY l.created_at DESC`,
    )
    .all();
}

function getSignedLicenseById(licenseId) {
  const row = getDb()
    .prepare("SELECT signed_license_json FROM licenses WHERE id = ?")
    .get(String(licenseId));
  if (!row?.signed_license_json) {
    const err = new Error("License not found");
    err.status = 404;
    throw err;
  }
  return JSON.parse(row.signed_license_json);
}

function listActivations(licenseId) {
  return getDb()
    .prepare(
      "SELECT id, license_id, device_id, activated_at, last_refresh_at, status, created_at FROM activations WHERE license_id = ? ORDER BY created_at DESC",
    )
    .all(String(licenseId));
}

module.exports = {
  activateLicense,
  createLicense,
  deleteLicense,
  getAdminApiKey,
  getAppApiKey,
  getIssuer,
  getPublicKey,
  getSignedLicenseById,
  listActivations,
  listLicenses,
  refreshActivationToken,
  rebindActivation,
  setLicenseStatus,
  updateLicense,
};
