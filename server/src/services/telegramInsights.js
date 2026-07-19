// Smart, action-oriented Telegram insights (تقرير القرارات الذكية).
//
// Unlike the plain digest (totals + top lists), every section here answers ONE
// owner question with a concrete recommended action:
//   1. اقتراحات شراء     — fast movers about to run out (buy NOW, suggested qty)
//   2. بضاعة راكدة        — stock with no sales for a month (promo / stop reordering)
//   3. هوامش ضعيفة/خاسرة  — products selling below or barely above cost (reprice)
//   4. منتجات صاعدة       — demand accelerating (stock more / feature them)
//
// Same conventions as telegramDigest.js: pure builders, synchronous
// better-sqlite3, WACC-based costs, every section defensive so one missing
// table never kills the whole message.

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n) { return String(n).padStart(2, "0"); }
function sqlDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function formatMoney(amount, currency = "ج") {
  return `${Number(amount || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${currency}`;
}
function formatQty(q) {
  return Number(q || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 });
}
function itemLabel(row) {
  const name = row.name || "—";
  return row.sku ? `[${row.sku}] ${name}` : name;
}

const ACTIVE = "(i.status IS NULL OR i.status NOT IN ('cancelled','voided'))";
const SELLABLE_ITEM = "(it.deleted_at IS NULL AND COALESCE(it.is_active,1) = 1 AND COALESCE(it.is_variant_parent,0) = 0)";

// Defaults — kept in one place so a future settings UI can override them.
const DEFAULTS = {
  windowDays: 30,        // sales window all sections analyse
  coverDays: 7,          // reorder alarm: stock covers fewer days than this
  restockTargetDays: 14, // suggested purchase tops stock up to this many days
  lowMarginPct: 10,      // margin below this % is "weak"
  risingMinQty: 5,       // rising items need at least this qty in the recent half
  risingGrowthPct: 50,   // ...and at least this % growth vs the prior half
  sectionLimit: 8,
};

// ── 1. Reorder suggestions ────────────────────────────────────────────────
// Items WITH recent sales whose current stock covers < coverDays of demand.
// Includes items already at 0 (most urgent). Suggested qty tops the item up to
// restockTargetDays of demand at the observed velocity.
function reorderSuggestions(db, now, opts) {
  try {
    const from = sqlDate(new Date(now.getTime() - opts.windowDays * DAY_MS));
    const rows = db.prepare(
      `SELECT it.id, COALESCE(NULLIF(it.name,''), it.name_en) AS name, it.code AS sku,
              SUM(il.quantity) AS sold_qty,
              COALESCE((SELECT SUM(sl.quantity) FROM stock_levels sl WHERE sl.item_id = it.id), 0) AS stock
       FROM invoice_lines il
       JOIN invoices i ON i.id = il.invoice_id
       JOIN items it ON it.id = il.item_id
       WHERE i.created_at >= ? AND ${ACTIVE} AND ${SELLABLE_ITEM}
       GROUP BY il.item_id
       HAVING sold_qty > 0`
    ).all(from);

    return rows
      .map((r) => {
        const velocity = r.sold_qty / opts.windowDays; // units/day
        const cover = velocity > 0 ? r.stock / velocity : Infinity;
        const suggested = Math.max(0, Math.ceil(velocity * opts.restockTargetDays - r.stock));
        return { ...r, velocity, cover, suggested };
      })
      .filter((r) => r.cover < opts.coverDays && r.suggested > 0)
      .sort((a, b) => a.cover - b.cover)
      .slice(0, opts.sectionLimit);
  } catch (_) { return []; }
}

// ── 2. Dead stock ─────────────────────────────────────────────────────────
// Stock on hand with ZERO sales in the window, ranked by tied-up capital
// (qty × WACC) so the owner attacks the biggest frozen money first.
function deadStock(db, now, opts) {
  try {
    const from = sqlDate(new Date(now.getTime() - opts.windowDays * DAY_MS));
    return db.prepare(
      `SELECT it.id, COALESCE(NULLIF(it.name,''), it.name_en) AS name, it.code AS sku,
              SUM(sl.quantity) AS stock,
              SUM(sl.quantity * COALESCE(sl.wacc, sl.last_purchase_cost, 0)) AS capital
       FROM stock_levels sl
       JOIN items it ON it.id = sl.item_id
       WHERE ${SELLABLE_ITEM}
       GROUP BY sl.item_id
       HAVING stock > 0
          AND NOT EXISTS (
            SELECT 1 FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
            WHERE il.item_id = sl.item_id AND i.created_at >= ? AND ${ACTIVE}
          )
       ORDER BY capital DESC
       LIMIT ?`
    ).all(from, opts.sectionLimit);
  } catch (_) { return []; }
}

// Total capital frozen in ALL dead items (not just the displayed top N).
function deadStockTotals(db, now, opts) {
  try {
    const from = sqlDate(new Date(now.getTime() - opts.windowDays * DAY_MS));
    const row = db.prepare(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(capital),0) AS capital FROM (
         SELECT SUM(sl.quantity * COALESCE(sl.wacc, sl.last_purchase_cost, 0)) AS capital
         FROM stock_levels sl JOIN items it ON it.id = sl.item_id
         WHERE ${SELLABLE_ITEM}
         GROUP BY sl.item_id
         HAVING SUM(sl.quantity) > 0
            AND NOT EXISTS (
              SELECT 1 FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
              WHERE il.item_id = sl.item_id AND i.created_at >= ? AND ${ACTIVE}
            )
       )`
    ).get(from);
    return { count: row?.cnt || 0, capital: row?.capital || 0 };
  } catch (_) { return { count: 0, capital: 0 }; }
}

// ── 3. Weak / losing margins ──────────────────────────────────────────────
// Realized margin per item over the window (WACC at time of sale). Negative
// margin = sold below cost. Ranked worst-first, losers before weak ones.
function weakMargins(db, now, opts) {
  try {
    const from = sqlDate(new Date(now.getTime() - opts.windowDays * DAY_MS));
    const rows = db.prepare(
      `SELECT it.id, COALESCE(NULLIF(it.name,''), it.name_en) AS name, it.code AS sku,
              SUM(il.line_total) AS revenue,
              SUM(COALESCE(il.cost_wacc,0) * il.quantity) AS cost,
              SUM(il.quantity) AS qty
       FROM invoice_lines il
       JOIN invoices i ON i.id = il.invoice_id
       JOIN items it ON it.id = il.item_id
       WHERE i.created_at >= ? AND ${ACTIVE} AND ${SELLABLE_ITEM}
       GROUP BY il.item_id
       HAVING revenue > 0 AND cost > 0`
    ).all(from);

    return rows
      .map((r) => ({ ...r, marginPct: ((r.revenue - r.cost) / r.revenue) * 100 }))
      .filter((r) => r.marginPct < opts.lowMarginPct)
      .sort((a, b) => a.marginPct - b.marginPct)
      .slice(0, opts.sectionLimit);
  } catch (_) { return []; }
}

// ── 4. Rising products ────────────────────────────────────────────────────
// Split the window in half; items whose recent-half qty grew ≥ risingGrowthPct
// over the prior half (with a minimum volume so noise doesn't qualify).
function risingProducts(db, now, opts) {
  try {
    const half = Math.max(7, Math.floor(opts.windowDays / 2));
    const mid = sqlDate(new Date(now.getTime() - half * DAY_MS));
    const from = sqlDate(new Date(now.getTime() - 2 * half * DAY_MS));
    const rows = db.prepare(
      `SELECT it.id, COALESCE(NULLIF(it.name,''), it.name_en) AS name, it.code AS sku,
              SUM(CASE WHEN i.created_at >= ? THEN il.quantity ELSE 0 END) AS recent_qty,
              SUM(CASE WHEN i.created_at < ? THEN il.quantity ELSE 0 END) AS prior_qty,
              COALESCE((SELECT SUM(sl.quantity) FROM stock_levels sl WHERE sl.item_id = it.id), 0) AS stock
       FROM invoice_lines il
       JOIN invoices i ON i.id = il.invoice_id
       JOIN items it ON it.id = il.item_id
       WHERE i.created_at >= ? AND ${ACTIVE} AND ${SELLABLE_ITEM}
       GROUP BY il.item_id`
    ).all(mid, mid, from);

    return rows
      .filter((r) => r.recent_qty >= opts.risingMinQty)
      .map((r) => ({
        ...r,
        growthPct: r.prior_qty > 0 ? ((r.recent_qty - r.prior_qty) / r.prior_qty) * 100 : null,
      }))
      .filter((r) => r.growthPct === null || r.growthPct >= opts.risingGrowthPct)
      .sort((a, b) => (b.growthPct ?? Infinity) - (a.growthPct ?? Infinity))
      .slice(0, 5);
  } catch (_) { return []; }
}

// ── Message builder ───────────────────────────────────────────────────────
function buildInsightsMessage(db, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const currency = o.currencySymbol || "ج";
  const now = o.now instanceof Date ? o.now : new Date();

  const reorder = reorderSuggestions(db, now, o);
  const dead = deadStock(db, now, o);
  const deadTotals = deadStockTotals(db, now, o);
  const margins = weakMargins(db, now, o);
  const rising = risingProducts(db, now, o);

  if (!reorder.length && !dead.length && !margins.length && !rising.length) {
    return null; // nothing actionable — don't send an empty message
  }

  const lines = [];
  if (o.branch) lines.push(`🏪 *${o.branch}*`);
  lines.push(`🧠 *تقرير القرارات الذكية* — آخر ${o.windowDays} يوم`);

  if (reorder.length) {
    lines.push("");
    lines.push("🛒 *اشترِ الآن قبل النفاد:*");
    for (const r of reorder) {
      const coverTxt = r.stock <= 0
        ? "نفد بالفعل ❗"
        : `يكفي ~${formatQty(Math.max(0, Math.floor(r.cover)))} يوم`;
      lines.push(`• ${itemLabel(r)} — المتبقي ${formatQty(r.stock)} (${coverTxt}) ← اقترح شراء *${formatQty(r.suggested)}*`);
    }
    lines.push("💡 هذه أصناف سريعة البيع ومخزونها لا يغطي أسبوعاً — اطلبها من المورد اليوم.");
  }

  if (margins.length) {
    lines.push("");
    lines.push("📉 *هوامش ضعيفة أو خاسرة:*");
    for (const m of margins) {
      const flag = m.marginPct < 0 ? "❌ خسارة" : "⚠️ ضعيف";
      lines.push(`• ${itemLabel(m)} — هامش ${m.marginPct.toLocaleString("ar-EG", { maximumFractionDigits: 1 })}% على مبيعات ${formatMoney(m.revenue, currency)} ${flag}`);
    }
    lines.push("💡 راجع سعر البيع أو تكلفة الشراء — البيع تحت التكلفة يأكل ربح باقي المنتجات.");
  }

  if (dead.length) {
    lines.push("");
    lines.push(`🐌 *بضاعة راكدة (لم تُبع منذ ${o.windowDays} يوم):*`);
    for (const d of dead) {
      lines.push(`• ${itemLabel(d)} — ${formatQty(d.stock)} قطعة (رأس مال مجمد ${formatMoney(d.capital, currency)})`);
    }
    if (deadTotals.count > dead.length) {
      lines.push(`… و ${deadTotals.count - dead.length} صنف راكد آخر.`);
    }
    lines.push(`💰 إجمالي رأس المال المجمد: *${formatMoney(deadTotals.capital, currency)}*`);
    lines.push("💡 فكر في عرض/خصم لتصريفها، وأوقف إعادة شرائها مؤقتاً.");
  }

  if (rising.length) {
    lines.push("");
    lines.push("🚀 *منتجات صاعدة (الطلب يتسارع):*");
    for (const r of rising) {
      const growth = r.growthPct === null ? "🆕 جديد" : `+${r.growthPct.toLocaleString("ar-EG", { maximumFractionDigits: 0 })}%`;
      lines.push(`• ${itemLabel(r)} — ${formatQty(r.recent_qty)} قطعة مؤخراً (${growth})، المتبقي ${formatQty(r.stock)}`);
    }
    lines.push("💡 وفّر مخزوناً كافياً وضعها في مكان بارز — لا تخسر موجة الطلب.");
  }

  return lines.join("\n");
}

module.exports = {
  buildInsightsMessage,
  INSIGHTS_DEFAULTS: DEFAULTS,
  // exported for tests
  _internal: { reorderSuggestions, deadStock, weakMargins, risingProducts, deadStockTotals },
};
