import api from "./api";

export async function getSyncConfig() {
  const res = await api.get("/api/sync/config");
  return res.data;
}

export async function saveSyncConfig(data) {
  const res = await api.put("/api/sync/config", data);
  return res.data;
}

export async function getSyncStatus() {
  const res = await api.get("/api/sync/status");
  return res.data;
}

export async function getSyncCheck(params = {}) {
  const res = await api.get("/api/sync/check", { params });
  return res.data;
}

// Pass entered overrides ({ ecom_url, store_id, api_key }) to test values before saving.
// Call with no argument to verify the already-saved config.
export async function verifySyncConnection(overrides) {
  const res = await api.post("/api/sync/verify", overrides || {});
  return res.data;
}

export async function searchEcom(q, page = 1) {
  const res = await api.get("/api/sync/search", { params: { q, page } });
  return res.data;
}

export async function applySync(data) {
  const res = await api.post("/api/sync/apply", data);
  return res.data;
}

export async function pullProducts(skus, fields = {}) {
  const res = await api.post("/api/sync/pull", { skus, fields });
  return res.data;
}

export async function previewPull(skus, fields = {}) {
  const res = await api.post("/api/sync/preview-pull", { skus, fields });
  return res.data;
}

export async function getSyncImages(sku) {
  const res = await api.get(`/api/sync/images/${encodeURIComponent(sku)}`);
  return res.data;
}

export async function uploadSyncImage(sku, imageUrl) {
  const res = await api.post(`/api/sync/images/upload/${encodeURIComponent(sku)}`, { image_url: imageUrl });
  return res.data;
}

export async function getSyncLogs(limit = 20, extra = {}) {
  const res = await api.get("/api/sync/logs", { params: { limit, ...extra } });
  return res.data;
}

export async function getPendingChanges(search = "") {
  const res = await api.get("/api/sync/pending", { params: { search } });
  return res.data;
}

export async function getConflicts() {
  const res = await api.get("/api/sync/conflicts");
  return res.data;
}

export async function resolveConflict(sku, resolution) {
  const res = await api.post("/api/sync/resolve-conflict", { sku, resolution });
  return res.data;
}

export async function getSyncImpactSummary(skus) {
  const params = skus?.length ? { skus: skus.join(",") } : {};
  const res = await api.get("/api/sync/impact-summary", { params });
  return res.data;
}

export async function updateWebhookConfig(data) {
  const res = await api.put("/api/webhooks/config", data);
  return res.data;
}

export async function getWebhookStatus() {
  const res = await api.get("/api/webhooks/status");
  return res.data;
}

export async function registerWebhook() {
  const res = await api.post("/api/sync/register-webhook");
  return res.data;
}

export async function getWebhookLogs(limit = 50) {
  const res = await api.get("/api/webhooks/logs", { params: { limit } });
  return res.data;
}

export async function testWebhook() {
  const res = await api.post("/api/webhooks/test");
  return res.data;
}

export async function getSnapshots(page = 1, limit = 20) {
  const res = await api.get("/api/sync/snapshots", { params: { page, limit } });
  return res.data;
}

export async function getSnapshot(id) {
  const res = await api.get(`/api/sync/snapshots/${id}`);
  return res.data;
}

export async function previewRollback(id) {
  const res = await api.post(`/api/sync/snapshots/${id}/rollback-preview`);
  return res.data;
}

export async function executeRollback(id) {
  const res = await api.post(`/api/sync/snapshots/${id}/rollback`);
  return res.data;
}

// ── Online order review queue ──
export async function getOnlineOrders(status = "pending", limit = 50) {
  const res = await api.get("/api/webhooks/orders", { params: { status, limit } });
  return res.data;
}

export async function getOnlineOrder(id) {
  const res = await api.get(`/api/webhooks/orders/${id}`);
  return res.data;
}

export async function prepareOnlineOrder(id) {
  const res = await api.get(`/api/webhooks/orders/${id}/prepare`);
  return res.data;
}

export async function forwardOnlineOrder(id, invoiceId) {
  const res = await api.post(`/api/webhooks/orders/${id}/forward`, { invoice_id: invoiceId });
  return res.data;
}

export async function ignoreOnlineOrder(id) {
  const res = await api.post(`/api/webhooks/orders/${id}/ignore`);
  return res.data;
}
