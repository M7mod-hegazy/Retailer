const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();
router.use(authRequired);

// ─── Page Index ───────────────────────────────────────────────────────────────
const PAGE_INDEX = [
  { id: "pg-dashboard", type: "page", title: "لوحة التحكم",           subtitle: "مؤشرات الأداء اليومية",          link: "/dashboard",             keywords: ["dashboard","مؤشرات","تحكم","رئيسية","إحصاء"] },
  { id: "pg-pos",       type: "page", title: "نقطة البيع",            subtitle: "إصدار فواتير البيع الفوري",       link: "/pos",                   keywords: ["pos","بيع","فاتورة","كاشير","مبيعات"] },
  { id: "pg-items",     type: "page", title: "الأصناف",               subtitle: "تعريف الأصناف والأسعار",         link: "/definitions/items",     keywords: ["items","صنف","منتج","بضاعة","مخزون","كود"] },
  { id: "pg-customers", type: "page", title: "العملاء",               subtitle: "قاعدة بيانات العملاء",           link: "/definitions/customers", keywords: ["customers","عميل","مشتري","مشترين"] },
  { id: "pg-suppliers", type: "page", title: "الموردون",              subtitle: "قاعدة بيانات الموردين",          link: "/definitions/suppliers", keywords: ["suppliers","مورد","موردون"] },
  { id: "pg-purchases", type: "page", title: "المشتريات",             subtitle: "سجل فواتير الشراء",              link: "/purchases",             keywords: ["purchases","شراء","توريد","فاتورة شراء"] },
  { id: "pg-payments",  type: "page", title: "المدفوعات والتحصيل",    subtitle: "سندات القبض والدفع",             link: "/payments",              keywords: ["payments","دفع","قبض","سند","تحصيل","سداد"] },
  { id: "pg-expenses",  type: "page", title: "المصروفات",             subtitle: "سجل المصروفات وإضافة مصروف",    link: "/expenses",              keywords: ["expenses","مصروف","تكلفة","انفاق"] },
  { id: "pg-revenues",  type: "page", title: "الإيرادات",             subtitle: "الإيرادات الإضافية",             link: "/revenues",              keywords: ["revenues","إيراد","دخل","ايراد"] },
  { id: "pg-reports",   type: "page", title: "مركز التقارير",         subtitle: "تقارير تحليلية وتشغيلية",        link: "/reports/center",        keywords: ["reports","تقارير","إحصائيات","تحليل","ملخص"] },
  { id: "pg-stock",     type: "page", title: "أرصدة المخزون",         subtitle: "المتابعة والجرد",                link: "/stock/levels",          keywords: ["stock","مخزون","رصيد","جرد","كميات"] },
  { id: "pg-settings",  type: "page", title: "إعدادات النظام",        subtitle: "الهوية والعملات والطباعة",       link: "/settings",              keywords: ["settings","إعدادات","ضبط","اعداد"] },
  { id: "pg-categories",type: "page", title: "التصنيفات",             subtitle: "فئات وتصنيفات المنتجات",         link: "/definitions/categories",keywords: ["categories","تصنيف","فئة","قسم"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Keyboard Layout Conversion (server-side) ────────────────────────────────

const EN_TO_AR_SERVER = {
  q:'ض', w:'ص', e:'ث', r:'ق', t:'ف', y:'غ', u:'ع', i:'ه', o:'خ', p:'ح',
  a:'ش', s:'س', d:'ي', f:'ب', g:'ل', h:'ا', j:'ت', k:'ن', l:'م',
  z:'ئ', x:'ء', c:'ؤ', v:'ر', b:'لا', n:'ى', m:'ة',
};
const AR_TO_EN_SERVER = {};
for (const [en, ar] of Object.entries(EN_TO_AR_SERVER)) {
  if (!AR_TO_EN_SERVER[ar]) AR_TO_EN_SERVER[ar] = en;
}

function isArabicDominantServer(str) {
  const ar = (str.match(/[\u0600-\u06FF]/g) || []).length;
  const en = (str.match(/[a-zA-Z]/g) || []).length;
  return ar >= en;
}

function convertKeyboardServer(str) {
  const s = String(str || '');
  if (!s.trim()) return s;
  if (isArabicDominantServer(s)) {
    return s.split('').map(c => AR_TO_EN_SERVER[c] || c).join('');
  }
  return s.split('').map(c => EN_TO_AR_SERVER[c.toLowerCase()] || c).join('');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Split query into cleaned, non-empty tokens */
function tokenize(q) {
  return String(q || "")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 1);
}

/** Generate fuzzy LIKE patterns from a raw query (including keyboard-converted variant) */
function getFuzzyPatterns(rawQ) {
  const q = String(rawQ || "").trim();
  if (!q) return [];

  const patterns = new Set();

  function expandPatterns(str) {
    if (!str) return;
    const tokens = tokenize(str);

    // Full query exact
    patterns.add(`%${str}%`);

    tokens.forEach((t) => {
      // Each token substring
      patterns.add(`%${t}%`);
      // 3/4-char prefix
      if (t.length >= 3) patterns.add(`%${t.slice(0, 3)}%`);
      if (t.length >= 4) patterns.add(`%${t.slice(0, 4)}%`);
      // Prefix tolerance (drop last 1, 2 chars for typos)
      if (t.length >= 4) patterns.add(`%${t.slice(0, -1)}%`);
      if (t.length >= 5) patterns.add(`%${t.slice(0, -2)}%`);
      // Suffix tolerance (drop first char)
      if (t.length >= 4) patterns.add(`%${t.slice(1)}%`);
    });
  }

  // Expand original + keyboard-converted variant
  expandPatterns(q);
  expandPatterns(convertKeyboardServer(q));

  return [...patterns];
}

/** Check if a page suggestion matches using fuzzy logic */
function pageMatches(item, rawQ) {
  const q = String(rawQ || "").toLowerCase().trim();
  if (!q) return true;

  const converted = convertKeyboardServer(q).toLowerCase();
  const tokens = tokenize(q);
  const hay = [item.title, item.subtitle, ...(item.keywords || [])]
    .join(" ")
    .toLowerCase();

  if (hay.includes(q)) return true;
  if (hay.includes(converted)) return true;
  if (tokens.length > 1 && tokens.every((t) => hay.includes(t))) return true;
  if (tokens.some((t) => t.length >= 2 && hay.includes(t))) return true;
  if (q.length >= 3 && hay.includes(q.slice(0, -1))) return true;

  return false;
}

/** Run a parameterized SELECT with many LIKE patterns, union deduplicated */
function multiLikeQuery(db, sql1Field, sqlTemplate, patterns, limit = 10) {
  const seen = new Map(); // id → row
  for (const p of patterns) {
    if (seen.size >= limit * 2) break;
    try {
      const rows = db.prepare(sqlTemplate).all(...Array(sql1Field).fill(p));
      rows.forEach((r) => {
        if (!seen.has(r.id)) seen.set(r.id, r);
      });
    } catch (_) {}
  }
  return [...seen.values()].slice(0, limit);
}

function normalizeQuery(value) {
  return String(value || "").trim();
}

// ─── Suggestions endpoint ─────────────────────────────────────────────────────
router.get("/suggestions", requirePagePermission("reports", "view"), (req, res) => {
  const rawQ = normalizeQuery(req.query.q);
  if (!rawQ) {
    return res.json({ success: true, data: PAGE_INDEX.slice(0, 10) });
  }
  const filtered = PAGE_INDEX.filter((p) => pageMatches(p, rawQ)).slice(0, 12);
  return res.json({ success: true, data: filtered });
});

// ─── Global search endpoint ───────────────────────────────────────────────────
router.get("/", requirePagePermission("reports", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const query = normalizeQuery(req.query.q);

    if (!query) return res.json({ success: true, data: [] });

    const patterns = getFuzzyPatterns(query);
    const results = [];
    const seen = new Set();

    const push = (rows, mapper) => {
      (rows || []).forEach((row) => {
        const mapped = mapper(row);
        const key = `${mapped.type}:${mapped.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(mapped);
        }
      });
    };

    // 1. Pages
    const matchingPages = PAGE_INDEX.filter((p) => pageMatches(p, query)).slice(0, 5);
    push(matchingPages, (r) => r);

    // 2. Items — search name, code, barcode
    {
      const rows = multiLikeQuery(
        db, 3,
        `SELECT id, name, code, barcode, sale_price FROM items WHERE COALESCE(is_active,1)=1 AND (name LIKE ? OR code LIKE ? OR barcode LIKE ?) ORDER BY id DESC LIMIT 12`,
        patterns, 10
      );
      push(rows, (r) => ({
        id: `item-${r.id}`,
        type: "item",
        title: r.name,
        subtitle: [
          r.code    && `كود: ${r.code}`,
          r.barcode && `باركود: ${r.barcode}`,
          r.sale_price != null && `السعر: ${Number(r.sale_price).toFixed(2)}`,
        ].filter(Boolean).join("  ·  "),
        link: `/definitions/items?q=${encodeURIComponent(r.name)}`,
      }));
    }

    // 3. Customers — name, phone, email
    {
      const rows = multiLikeQuery(
        db, 3,
        `SELECT id, name, phone, COALESCE(email,'') as email, COALESCE(balance,0) as balance FROM customers WHERE COALESCE(is_active,1)=1 AND (name LIKE ? OR phone LIKE ? OR COALESCE(email,'') LIKE ?) ORDER BY id DESC LIMIT 12`,
        patterns, 10
      );
      push(rows, (r) => ({
        id: `customer-${r.id}`,
        type: "customer",
        title: r.name,
        subtitle: [
          r.phone   && `هاتف: ${r.phone}`,
          r.email   && `بريد: ${r.email}`,
          `الرصيد: ${Number(r.balance).toFixed(2)}`,
        ].filter(Boolean).join("  ·  "),
        link: `/definitions/customers?q=${encodeURIComponent(r.name)}`,
      }));
    }

    // 4. Suppliers — name, phone, email
    {
      const rows = multiLikeQuery(
        db, 3,
        `SELECT id, name, phone, COALESCE(email,'') as email FROM suppliers WHERE COALESCE(is_active,1)=1 AND (name LIKE ? OR phone LIKE ? OR COALESCE(email,'') LIKE ?) ORDER BY id DESC LIMIT 10`,
        patterns, 8
      );
      push(rows, (r) => ({
        id: `supplier-${r.id}`,
        type: "supplier",
        title: r.name,
        subtitle: [r.phone && `هاتف: ${r.phone}`, r.email && `بريد: ${r.email}`].filter(Boolean).join("  ·  ") || "مورد",
        link: `/definitions/suppliers?q=${encodeURIComponent(r.name)}`,
      }));
    }

    // 5. Invoices — invoice_no + customer name JOIN
    {
      const invMap = new Map();
      for (const p of patterns) {
        if (invMap.size >= 20) break;
        try {
          db.prepare(
            `SELECT i.id, i.invoice_no, i.total, i.payment_type, i.created_at,
                    COALESCE(c.name,'') AS customer_name
             FROM invoices i
             LEFT JOIN customers c ON c.id = i.customer_id
             WHERE i.invoice_no LIKE ? OR COALESCE(c.name,'') LIKE ?
             ORDER BY i.id DESC LIMIT 10`
          ).all(p, p).forEach((r) => { if (!invMap.has(r.id)) invMap.set(r.id, r); });
        } catch (_) {
          // Fallback without JOIN
          try {
            db.prepare(
              `SELECT id, invoice_no, total, payment_type, created_at, '' AS customer_name FROM invoices WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 8`
            ).all(p).forEach((r) => { if (!invMap.has(r.id)) invMap.set(r.id, r); });
          } catch (__) {}
        }
      }
      push([...invMap.values()].slice(0, 8), (r) => ({
        id: `invoice-${r.id}`,
        type: "invoice",
        title: r.invoice_no || `INV-${r.id}`,
        subtitle: [
          r.customer_name && `العميل: ${r.customer_name}`,
          `الإجمالي: ${Number(r.total || 0).toFixed(2)}`,
          r.payment_type  && `الدفع: ${r.payment_type}`,
          r.created_at    && new Date(r.created_at).toLocaleDateString("ar-SA"),
        ].filter(Boolean).join("  ·  "),
        link: `/pos?q=${encodeURIComponent(r.invoice_no || r.id)}`,
      }));
    }

    // 6. Purchases — reference_no + supplier name JOIN
    {
      const purMap = new Map();
      for (const p of patterns) {
        if (purMap.size >= 16) break;
        try {
          db.prepare(
            `SELECT p.id, p.reference_no, p.total, p.created_at,
                    COALESCE(s.name,'') AS supplier_name
             FROM purchases p
             LEFT JOIN suppliers s ON s.id = p.supplier_id
             WHERE COALESCE(p.reference_no,'') LIKE ? OR COALESCE(s.name,'') LIKE ?
             ORDER BY p.id DESC LIMIT 8`
          ).all(p, p).forEach((r) => { if (!purMap.has(r.id)) purMap.set(r.id, r); });
        } catch (_) {
          try {
            db.prepare(
              `SELECT id, reference_no, total, created_at, '' AS supplier_name FROM purchases WHERE COALESCE(reference_no,'') LIKE ? ORDER BY id DESC LIMIT 8`
            ).all(p).forEach((r) => { if (!purMap.has(r.id)) purMap.set(r.id, r); });
          } catch (__) {}
        }
      }
      push([...purMap.values()].slice(0, 6), (r) => ({
        id: `purchase-${r.id}`,
        type: "purchase",
        title: r.reference_no || `PUR-${r.id}`,
        subtitle: [
          r.supplier_name && `المورد: ${r.supplier_name}`,
          `إجمالي: ${Number(r.total || 0).toFixed(2)}`,
          r.created_at && new Date(r.created_at).toLocaleDateString("ar-SA"),
        ].filter(Boolean).join("  ·  "),
        link: `/purchases?q=${encodeURIComponent(r.reference_no || r.supplier_name || "")}`,
      }));
    }

    // 7. Expenses — notes, description
    {
      const rows = multiLikeQuery(
        db, 2,
        `SELECT id, amount, notes, description, created_at FROM expenses WHERE COALESCE(notes,'') LIKE ? OR COALESCE(description,'') LIKE ? ORDER BY id DESC LIMIT 10`,
        patterns, 6
      );
      push(rows, (r) => ({
        id: `expense-${r.id}`,
        type: "expense",
        title: r.notes || r.description || `مصروف #${r.id}`,
        subtitle: [
          `المبلغ: ${Number(r.amount || 0).toFixed(2)}`,
          r.created_at && new Date(r.created_at).toLocaleDateString("ar-SA"),
        ].filter(Boolean).join("  ·  "),
        link: `/expenses?q=${encodeURIComponent(r.notes || r.description || "")}`,
      }));
    }

    // 8. Revenues — notes, description
    {
      const rows = multiLikeQuery(
        db, 2,
        `SELECT id, amount, notes, description, created_at FROM revenues WHERE COALESCE(notes,'') LIKE ? OR COALESCE(description,'') LIKE ? ORDER BY id DESC LIMIT 10`,
        patterns, 6
      );
      push(rows, (r) => ({
        id: `revenue-${r.id}`,
        type: "revenue",
        title: r.notes || r.description || `إيراد #${r.id}`,
        subtitle: [
          `المبلغ: ${Number(r.amount || 0).toFixed(2)}`,
          r.created_at && new Date(r.created_at).toLocaleDateString("ar-SA"),
        ].filter(Boolean).join("  ·  "),
        link: `/revenues?q=${encodeURIComponent(r.notes || r.description || "")}`,
      }));
    }

    return res.json({ success: true, data: results.slice(0, 60) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
