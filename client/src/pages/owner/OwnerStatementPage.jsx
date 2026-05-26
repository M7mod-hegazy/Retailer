import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  FileLock2,
  FileText,
  GitCompare,
  Loader2,
  Printer,
  RefreshCcw,
  Save,
  Search,
  X,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

const COST_METHODS = [
  { value: "wacc", label: "WAC" },
  { value: "fifo", label: "FIFO" },
  { value: "lifo", label: "LIFO" },
  { value: "last_purchase", label: "Last" },
];

const QUICK_RANGES = [
  { key: "this_month", label: "الشهر الحالي" },
  { key: "last_month", label: "الشهر الماضي" },
  { key: "quarter", label: "ربع سنة" },
  { key: "year", label: "سنة" },
];

const ROW_COLUMNS = {
  stock: [
    ["item_code", "الكود"],
    ["item_name", "الصنف"],
    ["category_name", "القسم"],
    ["warehouse_name", "المخزن"],
    ["quantity", "الكمية", "number"],
    ["unit_cost", "التكلفة", "money"],
    ["value", "القيمة", "money"],
  ],
  cash: [["name", "الاسم"], ["type", "النوع"], ["balance", "الرصيد", "money"]],
  ar: [
    ["customer_name", "العميل"],
    ["phone", "الهاتف"],
    ["invoice_count", "الفواتير", "number"],
    ["total_due", "المستحق", "money"],
    ["aging_0_30", "0-30", "money"],
    ["aging_31_60", "31-60", "money"],
    ["aging_61_90", "61-90", "money"],
    ["aging_90_plus", "90+", "money"],
  ],
  ap: [
    ["supplier_name", "المورد"],
    ["phone", "الهاتف"],
    ["purchase_count", "الفواتير", "number"],
    ["total_due", "المستحق", "money"],
    ["aging_0_30", "0-30", "money"],
    ["aging_31_60", "31-60", "money"],
    ["aging_61_90", "61-90", "money"],
    ["aging_90_plus", "90+", "money"],
  ],
  expenses: [["date", "التاريخ"], ["category_name", "التصنيف"], ["description", "الوصف"], ["payment_method", "الدفع"], ["amount", "المبلغ", "money"], ["user_name", "المستخدم"]],
  revenues: [["date", "التاريخ"], ["category_name", "التصنيف"], ["description", "الوصف"], ["payment_method", "الدفع"], ["amount", "المبلغ", "money"], ["user_name", "المستخدم"]],
  withdrawals: [["date", "التاريخ"], ["category_name", "التصنيف"], ["reason", "السبب"], ["payment_method", "الدفع"], ["amount", "المبلغ", "money"], ["user_name", "المستخدم"]],
  net_profit: [["label", "البند"], ["amount", "القيمة", "money"], ["source", "المصدر"], ["count", "العدد", "number"], ["cost_method", "طريقة التكلفة"]],
};

const FULL_LINKS = {
  stock: "/reports/stock-valuation",
  cash: "/daily-treasury",
  ar: "/reports/ar-aging",
  ap: "/reports/ap-aging",
  expenses: "/expenses",
  revenues: "/revenues",
  withdrawals: "/withdrawals",
  net_profit: "/reports/profit-loss",
};

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function initialRange() {
  const now = new Date();
  return {
    from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: iso(now),
  };
}

function money(value) {
  return Number(value || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function applyQuickRange(key) {
  const now = new Date();
  if (key === "last_month") {
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (key === "quarter") {
    const startMonth = Math.floor(now.getMonth() / 3) * 3;
    return { from: iso(new Date(now.getFullYear(), startMonth, 1)), to: iso(now) };
  }
  if (key === "year") return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
  return initialRange();
}

function rowText(row) {
  return Object.values(row || {}).join(" ").toLowerCase();
}

function exportCsv(filename, rows, columns) {
  const header = columns.map(([, label]) => label).join(",");
  const body = rows.map((row) => columns.map(([key]) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${header}\n${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function MetricModal({ metric, rows, period, onClose }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const columns = ROW_COLUMNS[metric?.key] || [];
  const filtered = useMemo(() => {
    let next = rows.filter((row) => rowText(row).includes(search.trim().toLowerCase()));
    if (sortKey) next = [...next].sort((a, b) => String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""), "ar"));
    return next;
  }, [rows, search, sortKey]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const displayTotal = filtered.reduce((sum, row) => sum + Number(row.value ?? row.balance ?? row.total_due ?? row.amount ?? 0), 0);
  const fullTotal = rows.reduce((sum, row) => sum + Number(row.value ?? row.balance ?? row.total_due ?? row.amount ?? 0), 0);

  useEffect(() => setPage(1), [search, sortKey, pageSize]);

  if (!metric) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-[90vw] max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" dir="rtl" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">{metric.label}</h2>
            <p className="mt-1 text-xs font-bold text-slate-400">{period.from} إلى {period.to}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث داخل التفاصيل" className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2 pr-9 pl-3 text-sm outline-none focus:border-indigo-500" />
            </div>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <option value="">ترتيب</option>
              {columns.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              {[50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <button onClick={() => exportCsv(`${metric.key}-${period.from}-${period.to}.csv`, filtered, columns)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">Excel</button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"><Printer size={13} /> PDF/طباعة</button>
            <Link to={FULL_LINKS[metric.key] || "/reports/center"} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white">التقرير الكامل</Link>
            <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-right text-sm">
            <thead className="sticky top-0 bg-slate-100 text-[11px] font-black uppercase text-slate-500">
              <tr>{columns.map(([key, label]) => <th key={key} className="px-4 py-3">{label}</th>)}</tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={columns.length} className="py-12 text-center text-slate-400">لا توجد بيانات</td></tr>
              ) : visible.map((row, index) => (
                <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                  {columns.map(([key, , type]) => (
                    <td key={key} className="px-4 py-3 font-semibold text-slate-700">
                      {type === "money" ? money(row[key]) : type === "number" ? Number(row[key] || 0).toLocaleString("ar-EG") : String(row[key] ?? "—").slice(0, 120)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-500">
          <div className="flex gap-4">
            <span>إجمالي المعروض: <span className="font-mono text-slate-900">{money(displayTotal)}</span></span>
            <span>إجمالي كلي: <span className="font-mono text-slate-900">{money(fullTotal)}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 disabled:opacity-40">السابق</button>
            <span>{page} / {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 disabled:opacity-40">التالي</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparePanel({ data, onClose }) {
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-2xl" dir="rtl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">مقارنة فترتين</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-100 text-[11px] font-black text-slate-500">
            <tr><th className="px-3 py-2">البند</th><th className="px-3 py-2">الفترة الأولى</th><th className="px-3 py-2">الفترة الثانية</th><th className="px-3 py-2">الفرق</th><th className="px-3 py-2">النسبة</th></tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.metric_key} className="border-b border-slate-100">
                <td className="px-3 py-3 font-black">{row.label}</td>
                <td className="px-3 py-3 font-mono">{money(row.left_value)}</td>
                <td className="px-3 py-3 font-mono">{money(row.right_value)}</td>
                <td className={`px-3 py-3 font-mono font-black ${row.diff >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{money(row.diff)}</td>
                <td className="px-3 py-3 font-mono">{row.diff_pct == null ? "—" : `${money(row.diff_pct)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OwnerStatementPage() {
  const [range, setRange] = useState(initialRange);
  const [costMethod, setCostMethod] = useState("wacc");
  const [data, setData] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [activeSnapshot, setActiveSnapshot] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leftCompare, setLeftCompare] = useState("");
  const [rightCompare, setRightCompare] = useState("");
  const [compareData, setCompareData] = useState(null);

  const frozen = !!activeSnapshot;
  const display = activeSnapshot || data;

  async function loadSnapshots() {
    const res = await api.get("/api/owner-statements");
    setSnapshots(res.data?.data || []);
  }

  async function loadCurrent() {
    setLoading(true);
    try {
      const res = await api.get("/api/owner-statements/current", {
        params: { start_date: range.from, end_date: range.to, cost_method: costMethod },
      });
      setData(res.data?.data || null);
    } catch (error) {
      toast.error("تعذر تحميل لوحة صاحب المحل");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSnapshots().catch(() => {}); }, []);
  useEffect(() => {
    if (!activeSnapshot) loadCurrent();
  }, [range.from, range.to, costMethod, activeSnapshot]);

  function updateRange(next) {
    setActiveSnapshot(null);
    setRange(next);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.post("/api/owner-statements", {
        period_start: range.from,
        period_end: range.to,
        cost_method: costMethod,
      });
      setActiveSnapshot(res.data?.data || null);
      await loadSnapshots();
      toast.success("تم حفظ النسخة");
    } catch {
      toast.error("تعذر حفظ النسخة");
    } finally {
      setSaving(false);
    }
  }

  async function handleLock() {
    setSaving(true);
    try {
      let snapshot = activeSnapshot;
      if (!snapshot) {
        const saved = await api.post("/api/owner-statements", {
          period_start: range.from,
          period_end: range.to,
          cost_method: costMethod,
        });
        snapshot = saved.data?.data;
      }
      const locked = await api.post(`/api/owner-statements/${snapshot.id}/lock`);
      setActiveSnapshot(locked.data?.data || null);
      await loadSnapshots();
      toast.success("تم إقفال النسخة");
    } catch {
      toast.error("تعذر إقفال النسخة");
    } finally {
      setSaving(false);
    }
  }

  async function loadSnapshot(id) {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/owner-statements/${id}`);
      const snapshot = res.data?.data;
      setActiveSnapshot(snapshot);
      setRange({ from: snapshot.period_start, to: snapshot.period_end });
      setCostMethod(snapshot.cost_method);
    } catch {
      toast.error("تعذر تحميل النسخة");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompare() {
    if (!leftCompare || !rightCompare) return toast.error("اختر نسختين للمقارنة");
    const res = await api.get("/api/owner-statements/compare", { params: { left_id: leftCompare, right_id: rightCompare } });
    setCompareData(res.data?.data || null);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black text-white">
              <FileText size={13} /> لوحة صاحب المحل
            </div>
            <h1 className="text-2xl font-black">{frozen ? "نسخة محفوظة" : "الإقفال الشهري"}</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">ثمانية أرقام أساسية مع تفاصيل قابلة للفتح والحفظ والمقارنة.</p>
          </div>
          {frozen && (
            <button onClick={() => setActiveSnapshot(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
              الرجوع للقيم الحالية
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-wrap items-center gap-2">
              <Calendar size={16} className="text-slate-400" />
              <input disabled={frozen} type="date" value={range.from} onChange={(event) => updateRange({ ...range, from: event.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm disabled:opacity-60" />
              <span className="text-xs font-bold text-slate-400">إلى</span>
              <input disabled={frozen} type="date" value={range.to} onChange={(event) => updateRange({ ...range, to: event.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm disabled:opacity-60" />
              <select disabled={frozen} value={costMethod} onChange={(event) => { setActiveSnapshot(null); setCostMethod(event.target.value); }} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black disabled:opacity-60">
                {COST_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select>
              {!frozen && QUICK_RANGES.map((preset) => (
                <button key={preset.key} onClick={() => updateRange(applyQuickRange(preset.key))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={loadCurrent} disabled={frozen || loading} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-40"><RefreshCcw size={13} /> تحديث</button>
              <button onClick={handleSave} disabled={saving || frozen} className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40"><Save size={13} /> حفظ نسخة</button>
              <button onClick={handleLock} disabled={saving || activeSnapshot?.status === "locked"} className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-40"><FileLock2 size={13} /> إقفال</button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"><Printer size={13} /> طباعة</button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400"><Loader2 className="mx-auto mb-3 animate-spin" /> جاري التحميل...</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(display?.metrics || []).map((metric) => (
              <button key={metric.key} onClick={() => setSelectedMetric(metric)} className="rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="text-xs font-black text-slate-400">{metric.label}</div>
                <div className={`mt-3 font-mono text-2xl font-black ${metric.key === "net_profit" && Number(metric.value) < 0 ? "text-rose-700" : "text-slate-900"}`}>{money(metric.value)}</div>
                <div className="mt-3 text-[11px] font-bold text-indigo-600">فتح التفاصيل</div>
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-black"><FileLock2 size={15} /> النسخ المحفوظة</div>
            <div className="max-h-64 overflow-auto">
              {snapshots.length === 0 ? (
                <div className="py-8 text-center text-sm font-bold text-slate-400">لا توجد نسخ محفوظة</div>
              ) : snapshots.map((snapshot) => (
                <button key={snapshot.id} onClick={() => loadSnapshot(snapshot.id)} className="flex w-full items-center justify-between border-b border-slate-100 px-2 py-3 text-right hover:bg-slate-50">
                  <div>
                    <div className="text-sm font-black text-slate-800">{snapshot.period_start} إلى {snapshot.period_end}</div>
                    <div className="mt-1 text-[11px] font-bold text-slate-400">{snapshot.cost_method} - {snapshot.status === "locked" ? "مقفلة" : "مسودة"}</div>
                  </div>
                  <div className="font-mono text-sm font-black text-slate-900">{money(snapshot.net_profit)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-black"><GitCompare size={15} /> مقارنة فترتين</div>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <select value={leftCompare} onChange={(event) => setLeftCompare(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <option value="">الفترة الأولى</option>
                {snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>#{snapshot.id} - {snapshot.period_start}</option>)}
              </select>
              <select value={rightCompare} onChange={(event) => setRightCompare(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <option value="">الفترة الثانية</option>
                {snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>#{snapshot.id} - {snapshot.period_start}</option>)}
              </select>
              <button onClick={handleCompare} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white">قارن</button>
            </div>
          </div>
        </div>
      </div>

      <MetricModal
        metric={selectedMetric}
        rows={selectedMetric ? (display?.rows?.[selectedMetric.key] || []) : []}
        period={range}
        onClose={() => setSelectedMetric(null)}
      />
      <ComparePanel data={compareData} onClose={() => setCompareData(null)} />
    </div>
  );
}
