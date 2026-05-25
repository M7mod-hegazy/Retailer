import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart2,
  Calendar, Filter, RefreshCcw, Search, TrendingDown,
  TrendingUp, User, X, ChevronLeft, ChevronRight, AlertTriangle,
  ShieldCheck, Loader2, CheckCircle2, XCircle, ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import SearchDropdown from "../ui/SearchDropdown";

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
  return Number(n ?? 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FIELD_LABELS = {
  sale_price:      "سعر البيع",
  purchase_price:  "سعر الشراء",
  wholesale_price: "سعر الجملة",
};

const SOURCE_LABELS = {
  item_create:      "إنشاء صنف",
  bulk_update:      "تحديث جماعي",
  purchase_locked:  "فاتورة شراء",
  manual_correction:"تصحيح يدوي",
  revert:           "استرجاع",
};

const SOURCE_COLORS = {
  item_create:      "bg-blue-100 text-blue-700",
  bulk_update:      "bg-purple-100 text-purple-700",
  purchase_locked:  "bg-emerald-100 text-emerald-700",
  manual_correction:"bg-amber-100 text-amber-700",
  revert:           "bg-slate-100 text-slate-600",
};

const DOC_TYPE_LABELS = {
  invoice:         "فاتورة بيع",
  sales_return:    "مرتجع مبيعات",
  purchase_return: "مرتجع مشتريات",
  branch_transfer: "نقل فرع",
};

// ── sub-components ────────────────────────────────────────────────────────────
function Badge({ label, colorClass }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colorClass ?? "bg-slate-100 text-slate-600"}`}>
      {label}
    </span>
  );
}

function DiffChip({ oldVal, newVal }) {
  const diff = newVal - oldVal;
  const pct  = oldVal > 0 ? ((diff / oldVal) * 100).toFixed(1) : null;
  const up   = diff >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${up ? "text-rose-600" : "text-emerald-600"}`}>
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {fmt(Math.abs(diff))}
      {pct !== null && <span className="opacity-60">({pct}%)</span>}
    </span>
  );
}

function Pagination({ page, total, limit, onPage }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-center py-3 text-sm text-slate-500">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}
        className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={16} /></button>
      <span>صفحة {page} من {pages}</span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)}
        className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
    </div>
  );
}

// ── Analytics cards ───────────────────────────────────────────────────────────
function AnalyticsCards({ analytics }) {
  if (!analytics) return null;
  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-1">
        <span className="text-[11px] text-slate-400 font-bold uppercase">تغييرات اليوم</span>
        <span className="text-2xl font-black text-slate-800">{analytics.changes_today}</span>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-1">
        <span className="text-[11px] text-slate-400 font-bold uppercase">هذا الأسبوع</span>
        <span className="text-2xl font-black text-slate-800">{analytics.changes_week}</span>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-1">
        <span className="text-[11px] text-slate-400 font-bold uppercase">هذا الشهر</span>
        <span className="text-2xl font-black text-slate-800">{analytics.changes_month}</span>
      </div>
    </div>
  );
}

// ── History table ─────────────────────────────────────────────────────────────
function HistoryTable({ rows, loading }) {
  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">جارٍ التحميل…</div>;
  if (!rows.length) return <div className="py-12 text-center text-slate-400 text-sm">لا توجد سجلات</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-right border-collapse">
        <thead>
          <tr className="bg-slate-100 text-slate-500 text-[11px] uppercase font-bold">
            <th className="px-3 py-2">الكود</th>
            <th className="px-3 py-2">الصنف</th>
            <th className="px-3 py-2">الحقل</th>
            <th className="px-3 py-2">قبل</th>
            <th className="px-3 py-2">بعد</th>
            <th className="px-3 py-2">التغيير</th>
            <th className="px-3 py-2">المصدر</th>
            <th className="px-3 py-2">المستخدم</th>
            <th className="px-3 py-2">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="px-3 py-2 font-mono text-[11px] font-black text-indigo-700 whitespace-nowrap">{r.item_code || "—"}</td>
              <td className="px-3 py-2 font-semibold text-slate-700">{r.item_name}</td>
              <td className="px-3 py-2 text-slate-500">{FIELD_LABELS[r.field] ?? r.field}</td>
              <td className="px-3 py-2 font-mono text-slate-500">{fmt(r.old_value)}</td>
              <td className="px-3 py-2 font-mono font-bold text-slate-800">{fmt(r.new_value)}</td>
              <td className="px-3 py-2"><DiffChip oldVal={r.old_value} newVal={r.new_value} /></td>
              <td className="px-3 py-2">
                <Badge label={SOURCE_LABELS[r.source] ?? r.source ?? "—"} colorClass={SOURCE_COLORS[r.source]} />
              </td>
              <td className="px-3 py-2 text-slate-400 text-xs">{r.changed_by_username ?? "—"}</td>
              <td className="px-3 py-2 text-slate-400 text-xs whitespace-nowrap">{r.changed_at?.slice(0, 16)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DOC_ROUTES = {
  invoice:         (id) => `/invoices/${id}`,
  sales_return:    (id) => `/pos/sales-returns/${id}`,
  purchase_return: (id) => `/purchases/returns/${id}`,
};

// ── Overrides table ───────────────────────────────────────────────────────────
function OverridesTable({ rows, loading }) {
  const navigate = useNavigate();
  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">جارٍ التحميل…</div>;
  if (!rows.length) return <div className="py-12 text-center text-slate-400 text-sm">لا توجد تجاوزات</div>;

  function openDoc(r) {
    const route = DOC_ROUTES[r.source_type];
    if (route && r.source_id) navigate(route(r.source_id));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-right border-collapse">
        <thead>
          <tr className="bg-slate-100 text-slate-500 text-[11px] uppercase font-bold">
            <th className="px-3 py-2">رقم المستند</th>
            <th className="px-3 py-2">نوع</th>
            <th className="px-3 py-2">الكود</th>
            <th className="px-3 py-2">الصنف</th>
            <th className="px-3 py-2">السعر المستخدم</th>
            <th className="px-3 py-2">السعر الرئيسي</th>
            <th className="px-3 py-2">الفرق</th>
            <th className="px-3 py-2">التاريخ</th>
            <th className="px-3 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-amber-50 transition-colors cursor-pointer" onClick={() => openDoc(r)}>
              <td className="px-3 py-2 font-mono text-slate-700 text-xs font-bold">{r.doc_no || "—"}</td>
              <td className="px-3 py-2">
                <Badge label={DOC_TYPE_LABELS[r.source_type] ?? r.source_type} colorClass="bg-amber-100 text-amber-700" />
              </td>
              <td className="px-3 py-2 font-mono text-[11px] font-black text-indigo-700 whitespace-nowrap">{r.item_code || "—"}</td>
              <td className="px-3 py-2 font-semibold text-slate-700">{r.item_name}</td>
              <td className="px-3 py-2 font-mono font-bold text-slate-800">{fmt(r.used_price)}</td>
              <td className="px-3 py-2 font-mono text-slate-500">{fmt(r.master_price_at_time)}</td>
              <td className="px-3 py-2">
                <DiffChip oldVal={r.master_price_at_time} newVal={r.used_price} />
              </td>
              <td className="px-3 py-2 text-slate-400 text-xs whitespace-nowrap">{r.created_at?.slice(0, 16)}</td>
              <td className="px-3 py-2 text-center">
                {DOC_ROUTES[r.source_type] && r.source_id && (
                  <button
                    onClick={e => { e.stopPropagation(); openDoc(r); }}
                    title="فتح المستند وتعديله"
                    className="p-1 rounded hover:bg-amber-200 text-amber-600 transition-colors"
                  >
                    <ExternalLink size={13} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────
function FilterBar({ filters, onChange, onClear }) {
  const [itemQuery, setItemQuery]     = useState("");
  const [itemResults, setItemResults] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!filters.item_id) setItemQuery("");
  }, [filters.item_id]);

  function handleItemQueryChange(val) {
    setItemQuery(val);
    setActiveIndex(-1);
    if (!val.trim()) {
      setItemResults([]);
      setDropdownOpen(false);
      onChange("item_id", "");
      return;
    }
    setDropdownOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(val.trim())}&limit=20`)
        .then(r => setItemResults(r.data?.data ?? r.data?.rows ?? []))
        .catch(() => setItemResults([]));
    }, 250);
  }

  function handlePickItem(item) {
    setItemQuery(`${item.code || item.item_code || ""} ${item.name}`.trim());
    setItemResults([]);
    setDropdownOpen(false);
    onChange("item_id", item.id);
  }

  function handleKeyDown(e) {
    if (!dropdownOpen || !itemResults.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(v => Math.min(v + 1, itemResults.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIndex(v => Math.max(v - 1, -1)); }
    if (e.key === "Enter" && activeIndex >= 0) { e.preventDefault(); handlePickItem(itemResults[activeIndex]); }
    if (e.key === "Escape") { setDropdownOpen(false); }
  }

  const hasFilters = filters.item_id || filters.field || filters.source || filters.from_date || filters.to_date;

  return (
    <div className="flex flex-wrap gap-2 items-center p-3 bg-slate-50 border-b border-slate-200">
      {/* Item search — POS style */}
      <div className="relative">
        <Search size={13} className="absolute right-2.5 top-2.5 text-slate-400 z-10" />
        <input
          value={itemQuery}
          onChange={e => handleItemQueryChange(e.target.value)}
          onFocus={() => { if (itemResults.length) setDropdownOpen(true); }}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="بحث بالصنف أو الكود…"
          className="pr-7 pl-3 py-1.5 border border-slate-200 rounded-lg text-sm w-52 bg-white"
        />
        {dropdownOpen && itemResults.length > 0 && (
          <SearchDropdown
            items={itemResults}
            onPick={handlePickItem}
            activeIndex={activeIndex}
            query={itemQuery}
          />
        )}
      </div>

      <select value={filters.field} onChange={e => onChange("field", e.target.value)}
        className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white">
        <option value="">كل الحقول</option>
        {Object.entries(FIELD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select value={filters.source} onChange={e => onChange("source", e.target.value)}
        className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white">
        <option value="">كل المصادر</option>
        {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input type="date" value={filters.from_date} onChange={e => onChange("from_date", e.target.value)}
        className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white" />
      <input type="date" value={filters.to_date} onChange={e => onChange("to_date", e.target.value)}
        className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white" />
      {hasFilters && (
        <button onClick={onClear}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-red-500 rounded-lg border border-slate-200 bg-white">
          <X size={12} /> مسح الفلتر
        </button>
      )}
    </div>
  );
}

// ── Integrity panel ───────────────────────────────────────────────────────────
const ISSUE_TYPE_LABELS = {
  wacc_drift:       "انحراف تكلفة المخزون",
  orphan_reference: "بيانات معلقة",
  price_coherence:  "سعر بيع أقل من التكلفة",
  zero_cost_stock:  "مخزون بدون تكلفة",
};

function renderIssueDetails(issue) {
  try {
    const d = issue.details ? JSON.parse(issue.details) : {};
    switch (issue.issue_type) {
      case "wacc_drift":
        return `التكلفة المسجلة: ${d.stored} ج.م | التكلفة المحسوبة: ${d.computed} ج.م | الفرق: ${Math.abs(d.diff)} ج.م`;
      case "orphan_reference":
        return `سجل غير مرتبط بصنف موجود (جدول: ${d.table})`;
      case "price_coherence":
        return `سعر البيع ${d.sale_price} ج.م أقل من سعر الشراء ${d.purchase_price} ج.م بفرق ${d.diff} ج.م`;
      case "zero_cost_stock":
        return `الكمية المتاحة: ${d.quantity} — لا يوجد سعر شراء مسجل لهذا الصنف`;
      default:
        return issue.details;
    }
  } catch {
    return issue.details;
  }
}

const ISSUE_COLOR = {
  wacc_drift:       "bg-amber-50 border-amber-200 text-amber-700",
  orphan_references:"bg-rose-50 border-rose-200 text-rose-700",
  price_coherence:  "bg-orange-50 border-orange-200 text-orange-700",
  zero_cost_stock:  "bg-slate-50 border-slate-200 text-slate-600",
};

function IntegrityPanel() {
  const [lastRun, setLastRun]   = useState(null);
  const [running, setRunning]   = useState(false);
  const [resolving, setResolving] = useState(null);

  const fetchLast = useCallback(async () => {
    try {
      const { data } = await api.get("/api/pricing/integrity/last");
      if (data.success) setLastRun(data.data);
    } catch (_) {}
  }, []);

  useEffect(() => { fetchLast(); }, [fetchLast]);

  async function runCheck() {
    setRunning(true);
    try {
      const { data } = await api.post("/api/pricing/integrity/run");
      if (data.success) setLastRun(data.data);
    } catch (_) {}
    setRunning(false);
  }

  async function resolve(issueId, action) {
    setResolving(issueId);
    try {
      const apiAction = action === "fix" ? "fixed" : "ignored";
      await api.post(`/api/pricing/integrity/resolve/${issueId}`, { action: apiAction });
      fetchLast();
    } catch (_) {}
    setResolving(null);
  }

  const issues = lastRun?.issues ?? [];
  const unresolved = issues.filter(i => !i.resolved_at);

  return (
    <div className="p-5 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-slate-600" />
          <span className="font-black text-slate-800 text-sm">فحص سلامة البيانات</span>
          {lastRun && (
            <span className="text-[10px] text-slate-400 font-mono">{lastRun.ran_at?.slice(0,16)}</span>
          )}
        </div>
        <button onClick={runCheck} disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 disabled:opacity-50 transition-all">
          {running ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
          تش��يل الفحص
        </button>
      </div>

      {/* Summary */}
      {lastRun && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold ${
          lastRun.unresolved_issues === 0
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-amber-50 border-amber-200 text-amber-700"
        }`}>
          {lastRun.unresolved_issues === 0
            ? <><CheckCircle2 size={14} /> لا توجد مشاكل — البيانات سليمة</>
            : <><AlertTriangle size={14} /> {lastRun.unresolved_issues} مشكلة تحتاج مراجعة</>
          }
        </div>
      )}

      {/* Issues list */}
      {unresolved.length > 0 && (
        <div className="space-y-2">
          {unresolved.map(issue => (
            <div key={issue.id} className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${ISSUE_COLOR[issue.issue_type] ?? "bg-slate-50 border-slate-200 text-slate-600"}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-black uppercase">{ISSUE_TYPE_LABELS[issue.issue_type] ?? issue.issue_type}</span>
                  {issue.item_name && <span className="text-[11px] opacity-70">— {issue.item_name}</span>}
                </div>
                {issue.details && (
                  <div className="text-[11px] opacity-80 leading-tight mt-0.5">{renderIssueDetails(issue)}</div>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                {issue.issue_type === "wacc_drift" && (
                  <button onClick={() => resolve(issue.id, "fix")} disabled={resolving === issue.id}
                    title="إعادة حساب متوسط تكلفة المخزون من سجل المشتريات"
                    className="px-2 py-1 rounded text-[10px] font-bold bg-white border border-current hover:opacity-80 disabled:opacity-40">
                    {resolving === issue.id ? <Loader2 size={10} className="animate-spin inline" /> : "إصلاح تلقائي"}
                  </button>
                )}
                <button onClick={() => resolve(issue.id, "ignore")} disabled={resolving === issue.id}
                  title="تجاهل هذه المشكلة وعدم إظهارها مرة أخرى"
                  className="px-2 py-1 rounded text-[10px] font-bold bg-white/60 border border-current hover:opacity-80 disabled:opacity-40">
                  تجاهل
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!lastRun && !running && (
        <div className="py-6 text-center space-y-2">
          <p className="text-slate-500 text-sm">يفحص هذا التقرير سلامة بيانات الأسعار والتكاليف ويكشف عن أي تناقضات.</p>
          <p className="text-slate-400 text-xs">اضغط "تشغيل الفحص" للبدء.</p>
        </div>
      )}
    </div>
  );
}

// ── Frequency panel ───────────────────────────────────────────────────────────
function FrequencyPanel() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [view, setView]       = useState("cashier"); // "cashier" | "item" | "trend"
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState("");

  const fetchFrequency = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate)   params.to_date   = toDate;
      const { data: res } = await api.get("/api/pricing/overrides/frequency", { params });
      if (res.success) setData(res.data);
    } catch (_) {}
    setLoading(false);
  }, [fromDate, toDate]);

  useEffect(() => { fetchFrequency(); }, [fetchFrequency]);

  if (loading) return <div className="py-16 text-center text-slate-400 text-sm animate-pulse">جارٍ التحميل…</div>;

  const totals = data?.totals;

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Summary cards */}
      {totals && (
        <div className="grid grid-cols-4 gap-3 p-4 border-b border-slate-100 bg-slate-50">
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">إجمالي التجاوزات</span>
            <span className="text-2xl font-black text-amber-600">{totals.total_overrides ?? 0}</span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">كاشير متورطون</span>
            <span className="text-2xl font-black text-slate-800">{totals.unique_cashiers ?? 0}</span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">أصناف متأثرة</span>
            <span className="text-2xl font-black text-slate-800">{totals.unique_items ?? 0}</span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">متوسط الفرق %</span>
            <span className="text-2xl font-black text-rose-600">{totals.avg_diff_pct ?? 0}%</span>
          </div>
        </div>
      )}

      {/* Filters + view switcher */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white">
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white" />
        <span className="text-slate-400 text-xs">—</span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white" />
        <button onClick={fetchFrequency}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50">
          <RefreshCcw size={13} /> تحديث
        </button>
        <div className="mr-auto flex gap-1">
          {[["cashier", "بالكاشير"], ["item", "بالصنف"], ["trend", "الاتجاه اليومي"]].map(([k, l]) => (
            <button key={k} onClick={() => setView(k)}
              className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${view === k ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {view === "cashier" && (
          <table className="w-full text-sm text-right border-collapse">
            <thead className="sticky top-0 bg-slate-100 text-slate-500 text-[11px] uppercase font-bold">
              <tr>
                <th className="px-4 py-2">الكاشير</th>
                <th className="px-4 py-2 text-center">عدد التجاوزات</th>
                <th className="px-4 py-2 text-center">تخفيض سعر</th>
                <th className="px-4 py-2 text-center">رفع سعر</th>
                <th className="px-4 py-2 text-center">متوسط فرق %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.by_cashier ?? []).length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">لا توجد بيانات</td></tr>
              ) : (data?.by_cashier ?? []).map((r) => (
                <tr key={r.cashier_id} className="hover:bg-amber-50 transition-colors">
                  <td className="px-4 py-2 font-semibold text-slate-700 flex items-center gap-1.5">
                    <User size={13} className="text-slate-400 shrink-0" /> {r.cashier_name}
                  </td>
                  <td className="px-4 py-2 text-center font-black text-amber-700">{r.override_count}</td>
                  <td className="px-4 py-2 text-center text-rose-600 font-bold">{r.price_downs}</td>
                  <td className="px-4 py-2 text-center text-emerald-600 font-bold">{r.price_ups}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${Number(r.avg_diff_pct) > 10 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                      {r.avg_diff_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {view === "item" && (
          <table className="w-full text-sm text-right border-collapse">
            <thead className="sticky top-0 bg-slate-100 text-slate-500 text-[11px] uppercase font-bold">
              <tr>
                <th className="px-4 py-2">الكود</th>
                <th className="px-4 py-2">الصنف</th>
                <th className="px-4 py-2">القسم</th>
                <th className="px-4 py-2 text-center">عدد التجاوزات</th>
                <th className="px-4 py-2 text-center">متوسط سعر مستخدم</th>
                <th className="px-4 py-2 text-center">متوسط سعر رئيسي</th>
                <th className="px-4 py-2 text-center">متوسط فرق %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.by_item ?? []).length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">لا توجد بيانات</td></tr>
              ) : (data?.by_item ?? []).map((r) => (
                <tr key={r.item_id} className="hover:bg-amber-50 transition-colors">
                  <td className="px-4 py-2 font-mono text-[11px] font-black text-indigo-700 whitespace-nowrap">{r.item_code || "—"}</td>
                  <td className="px-4 py-2 font-semibold text-slate-700">{r.item_name}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{r.category_name || "—"}</td>
                  <td className="px-4 py-2 text-center font-black text-amber-700">{r.override_count}</td>
                  <td className="px-4 py-2 text-center font-mono font-bold text-slate-800">{fmt(r.avg_used_price)}</td>
                  <td className="px-4 py-2 text-center font-mono text-slate-500">{fmt(r.avg_master_price)}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${Number(r.avg_diff_pct) > 10 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                      {r.avg_diff_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {view === "trend" && (
          <table className="w-full text-sm text-right border-collapse">
            <thead className="sticky top-0 bg-slate-100 text-slate-500 text-[11px] uppercase font-bold">
              <tr>
                <th className="px-4 py-2">التاريخ</th>
                <th className="px-4 py-2 text-center">عدد التجاوزات</th>
                <th className="px-4 py-2 text-center">كاشير متورطون</th>
                <th className="px-4 py-2 text-center">متوسط فرق %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.daily_trend ?? []).length === 0 ? (
                <tr><td colSpan={4} className="py-12 text-center text-slate-400">لا توجد بيانات</td></tr>
              ) : (data?.daily_trend ?? []).map((r) => (
                <tr key={r.date} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2 font-mono text-slate-600">{r.date}</td>
                  <td className="px-4 py-2 text-center font-black text-amber-700">{r.override_count}</td>
                  <td className="px-4 py-2 text-center text-slate-600">{r.cashiers_involved}</td>
                  <td className="px-4 py-2 text-center font-mono text-slate-500">{r.avg_diff_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Price sparkline ───────────────────────────────────────────────────────────
function PriceSparkline({ label, points, currentVal }) {
  if (!points || points.length < 2) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p>
        <p className="text-xl font-black text-slate-800 font-mono">{fmt(currentVal)}</p>
        <p className="text-[10px] text-slate-400 mt-1">تغيير واحد فقط</p>
      </div>
    );
  }
  const values = points.map(p => Number(p.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 200, H = 44;
  const step = W / (points.length - 1);
  const pathD = points.map((p, i) => {
    const x = i * step;
    const y = H - ((Number(p.value) - min) / range) * H * 0.85 - H * 0.075;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const isUp = values[values.length - 1] > values[0];
  const color = isUp ? "#e11d48" : "#059669";
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p>
      <p className="text-xl font-black text-slate-800 font-mono">{fmt(currentVal)}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10 mt-1" preserveAspectRatio="none">
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-0.5">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}

// ── Product detail (right panel) ──────────────────────────────────────────────
function ProductDetail({ data }) {
  const { item, history, by_field } = data;

  // history arrives ASC. For BASELINE rows, correct new_value to the old_value of
  // the first real change for that field — so the timeline is internally consistent.
  const corrected = history.map(r => {
    if (r.operation_id !== "BASELINE") return r;
    const firstReal = history.find(h => h.field === r.field && h.operation_id !== "BASELINE");
    return firstReal ? { ...r, new_value: firstReal.old_value } : r;
  });

  const sorted = [...corrected].reverse();
  return (
    <div className="p-5 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <span className="font-mono text-xs font-black text-indigo-700">{item.code || "—"}</span>
          <h2 className="text-lg font-black text-slate-800 mt-0.5">{item.name}</h2>
          <span className="text-[11px] text-slate-400">{sorted.length} سجل</span>
        </div>
        <div className="flex gap-5">
          {[["سعر البيع", item.sale_price], ["سعر الشراء", item.purchase_price], ["سعر الجملة", item.wholesale_price]].map(([label, val]) => (
            <div key={label} className="text-center">
              <p className="text-[10px] text-slate-400 font-bold">{label}</p>
              <p className="text-xl font-black text-slate-800 font-mono">{fmt(val)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sparklines — built from corrected history */}
      {corrected.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(FIELD_LABELS).map(([field]) => {
            const pts = corrected
              .filter(r => r.field === field)
              .map(r => ({ date: r.changed_at, value: r.new_value, op: r.operation_id }));
            if (!pts.length) return null;
            return (
              <PriceSparkline key={field} label={FIELD_LABELS[field]} points={pts} currentVal={item[field] ?? 0} />
            );
          }).filter(Boolean)}
        </div>
      )}

      {/* History table */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">سجل التغييرات</p>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-500 text-[11px] uppercase font-bold">
                <th className="px-3 py-2">التاريخ</th>
                <th className="px-3 py-2">الحقل</th>
                <th className="px-3 py-2">قبل</th>
                <th className="px-3 py-2">بعد</th>
                <th className="px-3 py-2">التغيير</th>
                <th className="px-3 py-2">المصدر</th>
                <th className="px-3 py-2">المستخدم</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400 text-sm">لا توجد سجلات</td></tr>
              ) : sorted.map(r => {
                const isBaseline = r.operation_id === "BASELINE";
                return (
                  <tr key={r.id} className={`border-b border-slate-100 transition-colors ${isBaseline ? "bg-slate-50/60 hover:bg-slate-100/60" : "hover:bg-slate-50"}`}>
                    <td className={`px-3 py-2 text-xs whitespace-nowrap ${isBaseline ? "text-slate-300 italic" : "text-slate-400"}`}>
                      {isBaseline ? "عند الإنشاء" : r.changed_at?.slice(0, 16)}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{FIELD_LABELS[r.field] ?? r.field}</td>
                    <td className={`px-3 py-2 font-mono ${isBaseline ? "text-slate-300" : "text-slate-500"}`}>{fmt(r.old_value)}</td>
                    <td className={`px-3 py-2 font-mono font-bold ${isBaseline ? "text-slate-500" : "text-slate-800"}`}>{fmt(r.new_value)}</td>
                    <td className="px-3 py-2">
                      {isBaseline
                        ? <span className="text-[10px] text-slate-400 italic">—</span>
                        : <DiffChip oldVal={r.old_value} newVal={r.new_value} />}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        label={isBaseline ? "إنشاء الصنف" : (SOURCE_LABELS[r.source] ?? r.source ?? "—")}
                        colorClass={isBaseline ? "bg-slate-100 text-slate-400" : SOURCE_COLORS[r.source]}
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{r.changed_by_username ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const LIST_LIMIT = 20;

// ── Product view (split panel) ────────────────────────────────────────────────
function ProductView() {
  const [search, setSearch]           = useState("");
  const [categoryId, setCategoryId]   = useState("");
  const [categories, setCategories]   = useState([]);
  const [products, setProducts]       = useState([]);
  const [total, setTotal]             = useState(0);
  const [listPage, setListPage]       = useState(1);
  const [selectedId, setSelectedId]   = useState(null);
  const [productData, setProductData] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const debounceRef = useRef(null);

  // load categories once
  useEffect(() => {
    api.get("/api/categories").then(r => setCategories(r.data.data ?? [])).catch(() => {});
  }, []);

  // reset to page 1 on filter change
  useEffect(() => { setListPage(1); }, [search, categoryId]);

  // fetch product list
  useEffect(() => {
    setLoadingList(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.get("/api/pricing/product-list", {
        params: { search: search.trim(), category_id: categoryId || undefined, page: listPage, limit: LIST_LIMIT },
      }).then(r => {
        if (r.data.success) { setProducts(r.data.data); setTotal(r.data.total ?? 0); }
      }).catch(() => {}).finally(() => setLoadingList(false));
    }, search ? 250 : 0);
  }, [search, categoryId, listPage]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingDetail(true);
    setProductData(null);
    api.get(`/api/pricing/history/${selectedId}`)
      .then(r => { if (r.data.success) setProductData(r.data.data); })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  const pages = Math.ceil(total / LIST_LIMIT);

  return (
    <div className="flex flex-1 overflow-hidden" dir="rtl">
      {/* Left: product list */}
      <div className="w-72 shrink-0 border-l border-slate-200 flex flex-col bg-slate-50">
        {/* Filters */}
        <div className="p-2.5 border-b border-slate-200 space-y-2">
          <div className="relative">
            <Search size={13} className="absolute right-2.5 top-2.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الكود…"
              className="w-full pr-7 pl-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white" />
          </div>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white text-slate-600">
            <option value="">كل الأقسام</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto">
          {loadingList ? (
            <div className="py-8 text-center text-slate-400 text-sm animate-pulse">جارٍ التحميل…</div>
          ) : products.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">لا توجد أصناف</div>
          ) : products.map(p => (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              className={`w-full text-right px-4 py-3 border-b border-slate-100 transition-colors flex items-start justify-between gap-2 ${
                selectedId === p.id ? "bg-white border-r-[3px] border-r-indigo-500" : "hover:bg-white"
              }`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 truncate leading-tight">{p.name}</p>
                <p className="text-[10px] font-mono font-black text-indigo-600">{p.code || "—"}</p>
                {p.category_name && <p className="text-[10px] text-slate-400 truncate">{p.category_name}</p>}
                <p className="text-[10px] text-slate-300 mt-0.5">{p.latest_change?.slice(0, 10)}</p>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0 mt-0.5 whitespace-nowrap">{p.change_count} تغيير</span>
            </button>
          ))}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="border-t border-slate-200 flex items-center justify-between px-3 py-2 bg-white">
            <button onClick={() => setListPage(p => Math.max(1, p - 1))} disabled={listPage <= 1}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-500">
              <ChevronRight size={14} />
            </button>
            <span className="text-[11px] text-slate-400">{listPage} / {pages}</span>
            <button onClick={() => setListPage(p => Math.min(pages, p + 1))} disabled={listPage >= pages}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-500">
              <ChevronLeft size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Right: product detail */}
      <div className="flex-1 overflow-auto">
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
            <Activity size={36} className="opacity-20" />
            <p className="text-sm font-bold">اختر صنفاً من القائمة لعرض سجل أسعاره</p>
          </div>
        ) : loadingDetail ? (
          <div className="py-16 text-center text-slate-400 text-sm animate-pulse">جارٍ التحميل…</div>
        ) : productData ? (
          <ProductDetail data={productData} />
        ) : null}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const EMPTY_FILTERS = { item_id: "", field: "", source: "", from_date: "", to_date: "" };

export default function PriceHistoryTab() {
  const [subTab, setSubTab]       = useState("product"); // "product" | "master" | "overrides" | "integrity" | "frequency"
  const [analytics, setAnalytics] = useState(null);
  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [filters, setFilters]     = useState(EMPTY_FILTERS);

  const fetchAnalytics = useCallback(async () => {
    try {
      const { data } = await api.get("/api/pricing/analytics");
      if (data.success) setAnalytics(data.data);
    } catch (_) {}
  }, []);

  const fetchRows = useCallback(async () => {
    if (subTab === "integrity" || subTab === "frequency" || subTab === "product") return;
    setLoading(true);
    try {
      const endpoint = subTab === "master" ? "/api/pricing/history" : "/api/pricing/overrides";
      const params = { ...filters, page, limit: 50 };
      const { data } = await api.get(endpoint, { params });
      if (data.success) {
        setRows(data.data ?? data.rows ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (_) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [subTab, filters, page]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);
  useEffect(() => { setPage(1); }, [subTab, filters]);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleFilterChange = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Analytics cards */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <AnalyticsCards analytics={analytics} />

        {/* Sub-tabs */}
        <div className="flex gap-1 mt-2">
          <button onClick={() => setSubTab("product")}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              subTab === "product"
                ? "bg-indigo-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50"
            }`}>
            تتبع صنف
          </button>
          <button onClick={() => setSubTab("master")}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              subTab === "master"
                ? "bg-slate-800 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}>
            كل التغييرات
          </button>
          <button onClick={() => setSubTab("overrides")}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              subTab === "overrides"
                ? "bg-amber-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-amber-50"
            }`}>
            تجاوزات الفواتير
          </button>
          <button onClick={() => setSubTab("integrity")}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              subTab === "integrity"
                ? "bg-slate-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}>
            <ShieldCheck size={13} className="inline ml-1" />
            سلامة البيانات
          </button>
          <button onClick={() => setSubTab("frequency")}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              subTab === "frequency"
                ? "bg-rose-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-rose-50"
            }`}>
            تكرار التجاوزات
          </button>
          {subTab === "master" || subTab === "overrides" ? (
            <button onClick={fetchRows}
              className="mr-auto p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-500">
              <RefreshCcw size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {subTab === "product" ? (
        <ProductView />
      ) : subTab === "integrity" ? (
        <div className="flex-1 overflow-auto">
          <IntegrityPanel />
        </div>
      ) : subTab === "frequency" ? (
        <div className="flex-1 overflow-auto">
          <FrequencyPanel />
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <FilterBar filters={filters} onChange={handleFilterChange} onClear={clearFilters} />

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {subTab === "master"
              ? <HistoryTable rows={rows} loading={loading} />
              : <OverridesTable rows={rows} loading={loading} />}
          </div>

          {/* Pagination */}
          <div className="border-t border-slate-200 bg-white">
            <Pagination page={page} total={total} limit={50} onPage={setPage} />
            <div className="px-4 py-1.5 text-[11px] text-slate-400 text-center">
              {total} سجل
            </div>
          </div>
        </>
      )}
    </div>
  );
}
