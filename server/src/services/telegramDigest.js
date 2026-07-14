// Scheduled Telegram analytics digests (weekly / monthly / yearly).
// Pure builder + period helpers — the scheduler (jobs/telegramDigestJob.js)
// decides WHEN to send and records the sent-log. Queries mirror the numbers the
// reports use (active invoices only; WACC-based profit). Each section is
// defensive so one missing table never breaks the whole digest.

function pad(n) { return String(n).padStart(2, "0"); }

function sqlDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ISO-8601 week number (Mon-based) — stable key for weekly digests.
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon = 0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
  );
  return { year: d.getUTCFullYear(), week };
}

// Deterministic period key: yearly "2026", monthly "2026-07", weekly "2026-W28".
function periodKeyFor(periodType, date) {
  const d = date instanceof Date ? date : new Date(date);
  if (periodType === "yearly") return String(d.getFullYear());
  if (periodType === "monthly") return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const { year, week } = isoWeek(d);
  return `${year}-W${pad(week)}`;
}

// Bounds of the COMPLETED period just before `now` (+ the period before it for
// deltas, + a display label + the period key).
function completedPeriodBounds(periodType, now = new Date()) {
  if (periodType === "yearly") {
    const y = now.getFullYear() - 1;
    const from = new Date(y, 0, 1);
    const to = new Date(y + 1, 0, 1);
    return { from, to, prevFrom: new Date(y - 1, 0, 1), prevTo: from, key: String(y), label: `سنة ${y}` };
  }
  if (periodType === "monthly") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const from = new Date(first.getFullYear(), first.getMonth() - 1, 1);
    const to = first;
    const prevFrom = new Date(first.getFullYear(), first.getMonth() - 2, 1);
    return { from, to, prevFrom, prevTo: from, key: periodKeyFor("monthly", from), label: `شهر ${from.getFullYear()}-${pad(from.getMonth() + 1)}` };
  }
  // weekly — the completed Mon..Sun week before the current one
  const day = (now.getDay() + 6) % 7; // Mon = 0
  const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  const from = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7);
  const prevFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 7);
  return { from, to: thisMonday, prevFrom, prevTo: from, key: periodKeyFor("weekly", from), label: `أسبوع ${periodKeyFor("weekly", from)}` };
}

function formatMoney(amount, currency = "ج") {
  return `${Number(amount || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${currency}`;
}

function deltaText(current, previous) {
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  if (prev === 0) return cur > 0 ? "🆕 جديد" : "—";
  const pct = ((cur - prev) / prev) * 100;
  const arrow = pct > 0 ? "📈" : pct < 0 ? "📉" : "➡️";
  const sign = pct > 0 ? "+" : "";
  return `${arrow} ${sign}${pct.toLocaleString("ar-EG", { maximumFractionDigits: 1 })}%`;
}

const ACTIVE = "(i.status IS NULL OR i.status NOT IN ('cancelled','voided'))";

function salesTotals(db, from, to) {
  try {
    const row = db.prepare(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(i.total),0) AS tot
       FROM invoices i WHERE i.created_at >= ? AND i.created_at < ? AND ${ACTIVE}`
    ).get(sqlDate(from), sqlDate(to));
    return { count: row?.cnt || 0, total: row?.tot || 0 };
  } catch (_) { return { count: 0, total: 0 }; }
}

function grossProfit(db, from, to) {
  try {
    const row = db.prepare(
      `SELECT COALESCE(SUM(il.line_total - COALESCE(il.cost_wacc,0) * il.quantity),0) AS profit
       FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
       WHERE i.created_at >= ? AND i.created_at < ? AND ${ACTIVE}`
    ).get(sqlDate(from), sqlDate(to));
    return row?.profit || 0;
  } catch (_) { return 0; }
}

function topProducts(db, from, to, limit = 5) {
  try {
    return db.prepare(
      `SELECT COALESCE(il.item_name_ar, it.name) AS name,
              SUM(il.quantity) AS qty, SUM(il.line_total) AS rev
       FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
       LEFT JOIN items it ON it.id = il.item_id
       WHERE i.created_at >= ? AND i.created_at < ? AND ${ACTIVE}
       GROUP BY il.item_id ORDER BY rev DESC LIMIT ?`
    ).all(sqlDate(from), sqlDate(to), limit);
  } catch (_) { return []; }
}

function topCustomers(db, from, to, limit = 5) {
  try {
    return db.prepare(
      `SELECT c.name AS name, SUM(i.total) AS spent
       FROM invoices i JOIN customers c ON c.id = i.customer_id
       WHERE i.created_at >= ? AND i.created_at < ? AND ${ACTIVE} AND i.customer_id IS NOT NULL
       GROUP BY i.customer_id ORDER BY spent DESC LIMIT ?`
    ).all(sqlDate(from), sqlDate(to), limit);
  } catch (_) { return []; }
}

function cashPosition(db) {
  let treasuries = 0, banks = 0;
  try { treasuries = db.prepare("SELECT COALESCE(SUM(balance),0) AS b FROM treasuries WHERE is_active = 1").get()?.b || 0; } catch (_) {}
  try { banks = db.prepare("SELECT COALESCE(SUM(balance),0) AS b FROM banks WHERE is_active = 1").get()?.b || 0; } catch (_) {}
  return { treasuries, banks };
}

function outstandingDebts(db) {
  try {
    return db.prepare("SELECT COALESCE(SUM(opening_balance),0) AS d FROM customers WHERE opening_balance > 0").get()?.d || 0;
  } catch (_) { return 0; }
}

function lowStockCount(db) {
  try {
    return db.prepare(
      `SELECT COUNT(*) AS c FROM (
         SELECT sl.item_id, SUM(sl.quantity) AS q FROM stock_levels sl GROUP BY sl.item_id
       ) s JOIN items it ON it.id = s.item_id
       WHERE it.min_stock_qty > 0 AND s.q <= it.min_stock_qty AND (it.deleted_at IS NULL)`
    ).get()?.c || 0;
  } catch (_) { return 0; }
}

function buildProductsTable(products, currency) {
  if (!products.length) return "لا توجد منتجات";
  return products.map((p, i) =>
    `${i + 1}. ${p.name || "—"} — ${Number(p.qty || 0).toLocaleString("ar-EG")} قطعة (${formatMoney(p.rev, currency)})`
  ).join("\n");
}

function buildCustomersTable(customers, currency) {
  if (!customers.length) return "لا يوجد عملاء";
  return customers.map((c, i) => `${i + 1}. ${c.name || "—"} — ${formatMoney(c.spent, currency)}`).join("\n");
}

function renderTemplate(body, vars) {
  if (!body) return "";
  return Object.entries(vars).reduce(
    (acc, [key, val]) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), val ?? ""),
    body
  );
}

// Build the Arabic Markdown digest for a completed period.
// If opts.templateBody is provided, it is rendered with digest variables;
// otherwise a default hardcoded format is used.
function buildDigest(db, periodType, bounds, opts = {}) {
  const currency = opts.currencySymbol || "ج";
  const branch = opts.branch ? `🏪 *${opts.branch}*\n` : "";
  const title = { weekly: "📊 الملخص الأسبوعي", monthly: "🗓️ الملخص الشهري", yearly: "📆 الملخص السنوي" }[periodType] || "📊 ملخص";

  const cur = salesTotals(db, bounds.from, bounds.to);
  const prev = salesTotals(db, bounds.prevFrom, bounds.prevTo);
  const profit = grossProfit(db, bounds.from, bounds.to);
  const avg = cur.count ? cur.total / cur.count : 0;
  const products = topProducts(db, bounds.from, bounds.to);
  const customers = topCustomers(db, bounds.from, bounds.to);
  const cash = cashPosition(db);
  const debts = outstandingDebts(db);
  const lowStock = lowStockCount(db);

  const vars = {
    period_label: bounds.label,
    title,
    sales_total: formatMoney(cur.total, currency),
    sales_count: String(cur.count),
    sales_delta: deltaText(cur.total, prev.total),
    avg_invoice: formatMoney(avg, currency),
    profit: formatMoney(profit, currency),
    products_table: buildProductsTable(products, currency),
    customers_table: buildCustomersTable(customers, currency),
    treasury_balance: formatMoney(cash.treasuries, currency),
    bank_balance: formatMoney(cash.banks, currency),
    liquidity: formatMoney(cash.treasuries + cash.banks, currency),
    debts: formatMoney(debts, currency),
    low_stock_count: String(lowStock),
    branch: opts.branch || "",
  };

  if (opts.templateBody) {
    return branch + renderTemplate(opts.templateBody, vars).trim();
  }

  const lines = [];
  lines.push(`${branch}${title} — ${bounds.label}`);
  lines.push("");
  lines.push(`💰 المبيعات: *${vars.sales_total}*  ${vars.sales_delta}`);
  lines.push(`🧾 عدد الفواتير: *${vars.sales_count}*  (متوسط ${vars.avg_invoice})`);
  lines.push(`📊 صافي الربح: *${vars.profit}*`);

  if (products.length) {
    lines.push("");
    lines.push("🏆 *أكثر المنتجات مبيعاً:*");
    lines.push(vars.products_table);
  }
  if (customers.length) {
    lines.push("");
    lines.push("⭐ *أفضل العملاء:*");
    lines.push(vars.customers_table);
  }

  lines.push("");
  lines.push(`🏦 السيولة الحالية: *${vars.liquidity}* (خزنة ${vars.treasury_balance} + بنك ${vars.bank_balance})`);
  lines.push(`📌 مديونيات العملاء: *${vars.debts}*`);
  lines.push(`⚠️ أصناف تحت الحد الأدنى: *${vars.low_stock_count}*`);

  return lines.join("\n");
}

module.exports = {
  periodKeyFor,
  completedPeriodBounds,
  buildDigest,
  // exported for tests
  _internal: { isoWeek, salesTotals, sqlDate },
};
