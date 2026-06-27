import api from "./api";

let _queryHistory = [];

export function getQueryHistory() {
  return _queryHistory;
}

export function pushQueryHistory(entry) {
  _queryHistory = [..._queryHistory, entry].slice(-20);
}

export function clearQueryHistory() {
  _queryHistory = [];
}

export async function executeQuery(text, history = [], intentId = null) {
  const context = { lastQuery: history.filter(h => h.role === "user").pop()?.text };
  if (intentId) context.intent_id = intentId;
  const { data } = await api.post("/api/assistant/query", { text, context });
  return data;
}

export async function executeMultiTurn(text, history = []) {
  const { data } = await api.post("/api/assistant/multi-turn", { text, history: history.map(h => ({ role: h.role, text: h.text })) });
  return data;
}

export async function fetchAnomalies() {
  const { data } = await api.get("/api/assistant/anomalies");
  return data;
}

export async function fetchPinboard() {
  const { data } = await api.get("/api/assistant/pinboard");
  return data;
}

export async function saveToPinboard(label, queryText) {
  const { data } = await api.post("/api/assistant/pinboard", { label, query_text: queryText });
  return data;
}

export async function removeFromPinboard(id) {
  await api.delete(`/api/assistant/pinboard/${id}`);
}

export async function updatePinboardItem(id, fields) {
  await api.patch(`/api/assistant/pinboard/${id}`, fields);
}

export async function fetchDashboards() {
  const { data } = await api.get("/api/assistant/dashboards");
  return data;
}

export async function saveDashboard(name, queries) {
  const { data } = await api.post("/api/assistant/dashboards", { name, queries });
  return data;
}

export async function updateDashboard(id, fields) {
  await api.put(`/api/assistant/dashboards/${id}`, fields);
}

export async function deleteDashboard(id) {
  await api.delete(`/api/assistant/dashboards/${id}`);
}

export async function fetchBriefings() {
  const { data } = await api.get("/api/assistant/briefings");
  return data;
}

export async function createBriefing(queryText, schedule = "daily") {
  const { data } = await api.post("/api/assistant/briefings", { query_text: queryText, schedule });
  return data;
}

export async function deleteBriefing(id) {
  await api.delete(`/api/assistant/briefings/${id}`);
}

export async function toggleBriefing(id) {
  await api.patch(`/api/assistant/briefings/${id}/toggle`);
}

export async function fetchTodayBriefings() {
  const { data } = await api.get("/api/assistant/briefings/today");
  return data;
}

export async function exportQueryResult(type, label, data, format = "csv") {
  const res = await api.post("/api/assistant/export", { type, label, data, format }, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = `assistant-export-${Date.now()}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchDailyTip() {
  const { data } = await api.get("/api/assistant/daily-tip");
  return data;
}

// ─── Query intent definitions (client-side matching) ──────────────────────────

export const QUERY_EXAMPLES = [
  { icon: "📊", textAr: "مبيعات النهاردة", textEn: "Today's sales", intentId: "sales_today" },
  { icon: "🏆", textAr: "أفضل 10 منتجات", textEn: "Top 10 products", intentId: "top_products" },
  { icon: "📦", textAr: "الأصناف الناقصة", textEn: "Low stock items", intentId: "stock_low" },
  { icon: "💰", textAr: "الربح إجمالي", textEn: "Gross profit", intentId: "profit" },
  { icon: "👥", textAr: "أفضل العملاء", textEn: "Top customers", intentId: "top_customers" },
  { icon: "🧾", textAr: "المصروفات", textEn: "Expenses", intentId: "expenses_period" },
  { icon: "⚖️", textAr: "أرصدة العملاء", textEn: "Customer balances", intentId: "customer_balance" },
  { icon: "📅", textAr: "مقارنة الأسبوع ده vs الماضي", textEn: "This week vs last week", intentId: "sales_comparison" },
  { icon: "🏭", textAr: "مقارنة المخازن", textEn: "Warehouse comparison", intentId: "warehouse_comparison" },
  { icon: "⚠️", textAr: "الأصناف منتهية الصلاحية", textEn: "Expiring items", intentId: "expiring_items" },
  { icon: "📋", textAr: "ملخص اليوم", textEn: "Daily summary", intentId: "daily_summary" },
  { icon: "🔄", textAr: "الشهر ده vs الماضي", textEn: "This month vs last month", intentId: "sales_comparison" },
];
