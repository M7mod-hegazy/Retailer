// Developer-mode client for the vendor service. Uses bearer-token owner auth
// (the owner cookie is SameSite=Strict and unusable cross-origin from the app).
// The token is obtained via /owner/login and held in localStorage (persists across sessions).

import { getVendorConfig, isCommsConfigured } from "./comms";

const TOKEN_KEY = "retailer.dev.ownerToken";

export function getDevToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}
function setDevToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function isDevAuthed() {
  return Boolean(getDevToken());
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getDevToken()}` };
}

async function call(path, { method = "GET", body } = {}) {
  const { baseUrl } = getVendorConfig();
  if (!isCommsConfigured()) throw new Error("comms_not_configured");
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    setDevToken("");
    const err = new Error("dev_unauthorized");
    err.code = "unauthorized";
    throw err;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    const err = new Error(json.message || "dev_request_failed");
    err.code = json.code || `http_${res.status}`;
    throw err;
  }
  return json.data;
}

// ── Auth ──────────────────────────────────────────────────────────────
export async function devLogin(email, password) {
  const { baseUrl } = getVendorConfig();
  if (!isCommsConfigured()) throw new Error("comms_not_configured");
  const res = await fetch(`${baseUrl}/owner/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.data?.token) {
    const err = new Error(json.message || "login_failed");
    err.code = json.code || `http_${res.status}`;
    throw err;
  }
  setDevToken(json.data.token);
  return json.data;
}

export function devLogout() {
  setDevToken("");
}

// Fetch an attachment with the owner bearer token; returns a blob object-URL.
export async function loadAttachmentDev(id) {
  const { baseUrl } = getVendorConfig();
  if (!isCommsConfigured()) throw new Error("comms_not_configured");
  const res = await fetch(`${baseUrl}/comms/attachments/${id}`, {
    headers: { Authorization: `Bearer ${getDevToken()}` },
  });
  if (res.status === 401) {
    setDevToken("");
    throw new Error("dev_unauthorized");
  }
  if (!res.ok) throw new Error(`attachment_${res.status}`);
  return URL.createObjectURL(await res.blob());
}

// ── Dev endpoints ─────────────────────────────────────────────────────
export const devListConversations = () => call("/comms/dev/conversations");
export const devListMessages = (licenseId, since = 0) =>
  call(`/comms/dev/conversations/${encodeURIComponent(licenseId)}/messages?since=${Number(since) || 0}`);
export const devReply = (licenseId, body, senderName) =>
  call(`/comms/dev/conversations/${encodeURIComponent(licenseId)}/reply`, { method: "POST", body: { body, senderName } });
export const devSetStatus = (licenseId, status) =>
  call(`/comms/dev/conversations/${encodeURIComponent(licenseId)}/status`, { method: "POST", body: { status } });
export const devReact = (id, emoji = "👍") =>
  call(`/comms/dev/messages/${id}/react`, { method: "POST", body: { emoji } });
export const devEdit = (id, body) => call(`/comms/dev/messages/${id}`, { method: "PATCH", body: { body } });
export const devDelete = (id) => call(`/comms/dev/messages/${id}`, { method: "DELETE" });
export const devListAnnouncements = () => call("/comms/dev/announcements");
export const devCreateAnnouncement = (payload) => call("/comms/dev/announcements", { method: "POST", body: payload });
