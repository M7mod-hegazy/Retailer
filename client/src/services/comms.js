// Client for the Phase 2 dev↔store communication endpoints on the vendor
// service. Inert by default: with no VITE_VENDOR_BASE_URL/VITE_VENDOR_APP_KEY
// configured, `isCommsConfigured()` is false and the UI shows a "not available"
// state instead of calling the network.

import { useAppSettingsStore } from "../stores/appSettingsStore";
import { useAuthStore } from "../stores/authStore";

function cfg(key) {
  try {
    return String(import.meta.env?.[key] || "").trim();
  } catch {
    return "";
  }
}

export function getVendorConfig() {
  return {
    baseUrl: cfg("VITE_VENDOR_BASE_URL").replace(/\/+$/, ""),
    appKey: cfg("VITE_VENDOR_APP_KEY"),
  };
}

export function isCommsConfigured() {
  const { baseUrl, appKey } = getVendorConfig();
  return Boolean(baseUrl && appKey);
}

// Best-effort store identity. ASCII-safe ids go in headers; names go in bodies.
export function getIdentity() {
  const s = useAppSettingsStore.getState().settings || {};
  let user = {};
  try {
    user = useAuthStore.getState().user || {};
  } catch {
    user = {};
  }
  return {
    licenseId: String(s.license_id || s.licenseId || "").trim(),
    appVersion: cfg("VITE_APP_VERSION") || String(s.app_version || "").trim(),
    deviceId: String(s.device_id || s.deviceId || "").trim(),
    storeName: String(s.company_name || s.store_name || "").trim(),
    senderName: String(user.name || "").trim(),
  };
}

function headers(extra = {}) {
  const { appKey } = getVendorConfig();
  const id = getIdentity();
  const h = { "Content-Type": "application/json", "x-app-key": appKey, "x-license-id": id.licenseId };
  if (id.appVersion) h["x-app-version"] = id.appVersion;
  if (id.deviceId) h["x-device-id"] = id.deviceId;
  return { ...h, ...extra };
}

async function call(path, { method = "GET", body } = {}) {
  const { baseUrl } = getVendorConfig();
  if (!isCommsConfigured()) throw new Error("comms_not_configured");
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    const err = new Error(json.message || "comms_request_failed");
    err.code = json.code || `http_${res.status}`;
    throw err;
  }
  return json.data;
}

// ── Support thread (store side) ───────────────────────────────────────
export function sendMessage({ body, channel = "support" }) {
  const id = getIdentity();
  return call("/comms/messages", {
    method: "POST",
    body: { body, channel, storeName: id.storeName, senderName: id.senderName },
  });
}
export function fetchMessages(since = 0) {
  return call(`/comms/messages?since=${Number(since) || 0}`);
}
export function reactMessage(id, emoji = "👍") {
  return call(`/comms/messages/${id}/react`, { method: "POST", body: { emoji } });
}
export function editMessage(id, body) {
  return call(`/comms/messages/${id}`, { method: "PATCH", body: { body } });
}
export function deleteMessage(id) {
  return call(`/comms/messages/${id}`, { method: "DELETE" });
}

// Fetch an attachment's bytes with auth *headers* (never the key in the URL) and
// return a blob object-URL for use in <img>/<audio>. Caller must revoke it.
export async function loadAttachment(id) {
  const { baseUrl, appKey } = getVendorConfig();
  if (!isCommsConfigured()) throw new Error("comms_not_configured");
  const ident = getIdentity();
  const res = await fetch(`${baseUrl}/comms/attachments/${id}`, {
    headers: { "x-app-key": appKey, "x-license-id": ident.licenseId },
  });
  if (!res.ok) throw new Error(`attachment_${res.status}`);
  return URL.createObjectURL(await res.blob());
}

// Send a message with file attachments (images / files / voice) via multipart.
export async function sendMessageWithFiles({ body = "", channel = "support", files = [] }) {
  const { baseUrl, appKey } = getVendorConfig();
  if (!isCommsConfigured()) throw new Error("comms_not_configured");
  const id = getIdentity();
  const fd = new FormData();
  if (body) fd.append("body", body);
  fd.append("channel", channel);
  if (id.storeName) fd.append("storeName", id.storeName);
  if (id.senderName) fd.append("senderName", id.senderName);
  for (const f of files) fd.append("files", f, f.name || "file");

  const h = { "x-app-key": appKey, "x-license-id": id.licenseId };
  if (id.appVersion) h["x-app-version"] = id.appVersion;
  if (id.deviceId) h["x-device-id"] = id.deviceId;
  // No Content-Type: the browser sets the multipart boundary.
  const res = await fetch(`${baseUrl}/comms/messages/upload`, { method: "POST", headers: h, body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    const err = new Error(json.message || "upload_failed");
    err.code = json.code || `http_${res.status}`;
    throw err;
  }
  return json.data;
}

// ── Announcements (store side) ────────────────────────────────────────
export function fetchAnnouncements(since = 0) {
  return call(`/comms/announcements?since=${Number(since) || 0}`);
}
export function markAnnouncementRead(id) {
  return call(`/comms/announcements/${id}/read`, { method: "POST" });
}
