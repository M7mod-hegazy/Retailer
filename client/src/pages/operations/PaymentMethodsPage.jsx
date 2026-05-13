import React, { useState, useEffect, useCallback } from "react";
import {
  CreditCard, Plus, Pencil, Trash2, X, Lock, ArrowUpCircle, ArrowDownCircle,
  BookOpen, RefreshCw, Search, Calendar, Printer
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import PaymentMethodsReportTemplate from "../../components/print/templates/PaymentMethodsReportTemplate";
import PermissionGate from "../../components/ui/PermissionGate";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });

const CATEGORIES = [
  { value: "cash", label: "نقدي", icon: "💵" },
  { value: "credit", label: "أجل", icon: "📋" },
  { value: "bank", label: "تحويل بنكي", icon: "🏦" },
  { value: "digital_wallet", label: "محفظة رقمية", icon: "📱" },
  { value: "other", label: "أخرى", icon: "🔄" },
];

const CAT_COLORS = {
  cash: "bg-emerald-100 text-emerald-700",
  credit: "bg-amber-100 text-amber-700",
  bank: "bg-blue-100 text-blue-700",
  digital_wallet: "bg-violet-100 text-violet-700",
  other: "bg-slate-100 text-slate-600",
};

const DEFAULT_EXTRAS = [
  { name: "InstaPay", category: "digital_wallet", icon: "📲", description: "خدمة إنستاباي", excludes_from_treasury: 1 },
  { name: "Vodafone Cash", category: "digital_wallet", icon: "📱", description: "فودافون كاش", excludes_from_treasury: 1 },
  { name: "Etisalat Cash", category: "digital_wallet", icon: "📱", description: "اتصالات كاش", excludes_from_treasury: 1 },
  { name: "WE Pay", category: "digital_wallet", icon: "📱", description: "اتصالات WE", excludes_from_treasury: 1 },
  { name: "تحويل بنكي", category: "bank", icon: "🏦", description: "حوالة بنكية", excludes_from_treasury: 1 },
];

function MethodsTab() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", category: "digital_wallet", icon: "💳", description: "", excludes_from_treasury: true });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try { setMethods((await api.get("/api/payment-methods")).data.data || []); }
    catch { } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const systemMethods = methods.filter(m => m.is_system);
  const userMethods = methods.filter(m => !m.is_system);

  function openCreate() { setEditing(null); setForm({ name: "", category: "digital_wallet", icon: "💳", description: "", excludes_from_treasury: true }); setModalOpen(true); }
  function openEdit(m) { setEditing(m); setForm({ name: m.name, category: m.category || "digital_wallet", icon: m.icon || "💳", description: m.description || "", excludes_from_treasury: Boolean(m.excludes_from_treasury) }); setModalOpen(true); }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await api.put(`/api/payment-methods/${editing.id}`, { ...form, excludes_from_treasury: form.excludes_from_treasury ? 1 : 0 });
      else await api.post("/api/payment-methods", { ...form, excludes_from_treasury: form.excludes_from_treasury ? 1 : 0 });
      setModalOpen(false); load();
    } catch (e) { toast.error(e.response?.data?.message || "خطأ"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id, name) {
    if (!confirm(`حذف "${name}"؟`)) return;
    try { await api.delete(`/api/payment-methods/${id}`); load(); }
    catch (e) { toast.error(e.response?.data?.message || "لا يمكن الحذف"); }
  }

  async function seedDefaults() {
    for (const m of DEFAULT_EXTRAS) {
      try { await api.post("/api/payment-methods", m); } catch {}
    }
    load();
  }

  const MethodCard = ({ m, isSystem }) => (
    <div className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow group relative ${isSystem ? "border-amber-300 border-2 bg-gradient-to-br from-amber-50 to-white" : "border-slate-200"}`}>
      {isSystem && (
        <div className="absolute -top-2 -left-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-white shadow-md">
          <Lock className="h-2.5 w-2.5" /> محمي
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{m.icon || "💳"}</span>
          <div>
            <h3 className="text-[14px] font-black text-slate-900">{m.name}</h3>
            <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-black ${CAT_COLORS[m.category] || CAT_COLORS.other}`}>
              {CATEGORIES.find(c => c.value === m.category)?.label || "أخرى"}
            </span>
          </div>
        </div>
        {!isSystem && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <PermissionGate page="payment_methods" action="edit">
            <button onClick={() => openEdit(m)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-3.5 w-3.5" /></button>
            </PermissionGate>
            <PermissionGate page="payment_methods" action="delete">
            <button onClick={() => handleDelete(m.id, m.name)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </PermissionGate>
          </div>
        )}
      </div>
      {m.description && <p className="text-[11px] text-slate-400 font-bold mb-2">{m.description}</p>}
      {!isSystem && m.excludes_from_treasury ? (
        <div className="flex items-center gap-1 text-[10px] font-black text-orange-600 bg-orange-50 rounded-lg px-2 py-1 w-fit">
          يُستثنى من الخزينة
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* System methods */}
      <div className="mb-4">
        <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-3">وسائل النظام الأساسية</div>
        <div className="grid grid-cols-3 gap-4">
          {systemMethods.map(m => <MethodCard key={m.id} m={m} isSystem />)}
        </div>
      </div>

      {/* User methods */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider">وسائل إضافية</div>
          <div className="flex gap-2">
            {userMethods.length === 0 && (
              <PermissionGate page="payment_methods" action="add">
              <button onClick={seedDefaults} className="text-[11px] font-black text-violet-600 hover:text-violet-800">+ إضافة الافتراضية</button>
              </PermissionGate>
            )}
            <PermissionGate page="payment_methods" action="add">
            <button onClick={openCreate} className="flex h-8 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-[11px] font-black text-white hover:bg-violet-700">
              <Plus className="h-3.5 w-3.5" /> إضافة
            </button>
            </PermissionGate>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-20 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {userMethods.map(m => <MethodCard key={m.id} m={m} isSystem={false} />)}
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-3">إحصائيات الاستخدام</div>
        <div className="grid grid-cols-3 gap-3">
          {methods.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{m.icon || "card"}</span>
                <span className="text-[12px] font-black text-slate-700">{m.name}</span>
              </div>
              <div className="text-[10px] text-slate-400 font-bold">معاملات الشهر: <span className="text-slate-700">{m.monthly_count || 0}</span></div>
              <div className="text-[10px] text-slate-400 font-bold">إجمالي: <span className="text-emerald-700 font-black">{fmt(m.monthly_total || 0)} ج.م</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[420px] rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-black text-slate-900">{editing ? "تعديل وسيلة الدفع" : "إضافة وسيلة دفع"}</h2>
              <button onClick={() => setModalOpen(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="text-[11px] font-black text-slate-600 block mb-1.5">الاسم *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
                  className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[13px] font-bold outline-none focus:border-violet-500" /></div>
              <div><label className="text-[11px] font-black text-slate-600 block mb-1.5">التصنيف</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[12px] font-bold outline-none bg-white focus:border-violet-500">
                  {CATEGORIES.filter(c => c.value !== "cash" && c.value !== "credit").map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                </select></div>
              <div><label className="text-[11px] font-black text-slate-600 block mb-1.5">الأيقونة (إيموجي)</label>
                <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[18px] outline-none focus:border-violet-500" /></div>
              <div><label className="text-[11px] font-black text-slate-600 block mb-1.5">الوصف</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[12px] outline-none" /></div>
              <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                <input type="checkbox" checked={form.excludes_from_treasury} onChange={e => setForm(f => ({ ...f, excludes_from_treasury: e.target.checked }))} className="h-4 w-4 rounded" />
                <div>
                  <div className="text-[12px] font-black text-slate-700">يُستثنى من الخزينة اليومية</div>
                  <div className="text-[10px] text-slate-400">لن تُحتسب معاملاته في تسوية الخزينة</div>
                </div>
              </label>
              <button onClick={handleSave} disabled={!form.name.trim() || saving}
                className="w-full rounded-xl bg-violet-600 py-3 text-[13px] font-black text-white hover:bg-violet-700 disabled:opacity-40">
                {saving ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionsTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState([]);
  const [filters, setFilters] = useState({ search: "", from: "", to: "", method: "", type: "" });
  const [printOpen, setPrintOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.method) params.set("method_id", filters.method);
      if (filters.type) params.set("type", filters.type);
      if (filters.search) params.set("search", filters.search);
      const [txR, mR] = await Promise.all([
        api.get(`/api/payment-methods/transactions?${params}`),
        api.get("/api/payment-methods"),
      ]);
      setRows(txR.data.data || []);
      setMethods(mR.data.data || []);
    } catch { setRows([]); } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const totalIn = rows.filter(r => r.direction !== "out").reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalOut = rows.filter(r => r.direction === "out").reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Summary footer */}
      <div className="grid grid-cols-3 gap-3 p-4 border-b border-slate-100 bg-slate-50 shrink-0">
        {[
          { label: "إجمالي الداخل", val: fmt(totalIn) + " ج.م", color: "emerald" },
          { label: "إجمالي الخارج", val: fmt(totalOut) + " ج.م", color: "rose" },
          { label: "الصافي", val: fmt(totalIn - totalOut) + " ج.م", color: "blue" },
        ].map(({ label, val, color }) => (
          <div key={label} className="text-center">
            <div className="text-[10px] font-black text-slate-400 uppercase">{label}</div>
            <div className={`text-[16px] font-black font-mono text-${color}-700`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-100 flex-wrap shrink-0">
        <div className="relative"><Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") load(); }} placeholder="بحث..."
            className="h-9 w-52 rounded-xl border border-slate-200 pr-9 pl-3 text-[12px] outline-none focus:border-violet-400" /></div>
        <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") load(); }} className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] outline-none" />
        <span className="text-slate-400 text-[12px]">إلى</span>
        <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") load(); }} className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] outline-none" />
        <select value={filters.method} onChange={e => setFilters(f => ({ ...f, method: e.target.value }))} className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] font-bold bg-white outline-none">
          <option value="">كل وسائل الدفع</option>
          {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] font-bold bg-white outline-none">
          <option value="">كل الاتجاهات</option>
          <option value="in">داخل</option>
          <option value="out">خارج</option>
        </select>
        <button onClick={load} className="flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-[11px] font-black text-white hover:bg-violet-700">
          <Search className="h-4 w-4" /> بحث
        </button>
        <PermissionGate page="payment_methods" action="print">
        <button onClick={() => setPrintOpen(true)} className="flex h-9 items-center gap-1.5 rounded-xl bg-slate-800 px-3 text-[11px] font-black text-white hover:bg-slate-900">
          <Printer className="h-4 w-4" /> طباعة
        </button>
        </PermissionGate>
        <button onClick={load} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
              <BookOpen className="h-10 w-10" /><span className="font-black">لا توجد معاملات</span>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{["الكود", "النوع", "المبلغ", "الاتجاه", "الطرف", "وسيلة الدفع", "التاريخ"].map(h => <th key={h} className="px-4 py-3 text-right font-black text-slate-500 text-[11px] uppercase tracking-wider">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-black font-mono text-slate-600 text-[11px]">{r.doc_no || `#${r.id}`}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">{r.doc_type || "—"}</span></td>
                    <td className="px-4 py-3 font-black font-mono">{fmt(r.amount)} ج.م</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 w-fit rounded-full px-2 py-0.5 text-[10px] font-black ${r.direction === "out" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {r.direction === "out" ? <ArrowDownCircle className="h-3 w-3" /> : <ArrowUpCircle className="h-3 w-3" />}
                        {r.direction === "out" ? "خارج" : "داخل"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[140px]">{r.party || r.description || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-[11px] font-bold">{r.method_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">{r.created_at ? new Date(r.created_at).toLocaleDateString("ar-EG") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {printOpen && (
        <PrintPreviewModal
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          docType="payment_methods_report"
          renderContent={(settings) => (
            <PaymentMethodsReportTemplate
              rows={rows}
              filters={filters}
              totalIn={totalIn}
              totalOut={totalOut}
              settings={settings}
            />
          )}
        />
      )}
    </div>
  );
}

export default function PaymentMethodsPage() {
  const [tab, setTab] = useState("methods");

  return (
    <div className="flex flex-col h-full bg-slate-50" dir="rtl">
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 shadow-lg shadow-violet-200">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-black text-slate-900">وسائل الدفع والمعاملات</h1>
            <p className="text-[11px] font-bold text-slate-400">إدارة وسائل الدفع وسجل المعاملات</p>
          </div>
        </div>
        <div className="flex gap-1">
          {[["methods", "وسائل الدفع", CreditCard], ["transactions", "سجل المعاملات", BookOpen]].map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-black transition-colors ${tab === k ? "bg-violet-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </header>

      {tab === "methods" ? <MethodsTab /> : <TransactionsTab />}
    </div>
  );
}
