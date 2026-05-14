import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Users, Search, Plus, FileText, X, Phone, AlertTriangle, SlidersHorizontal, MessageSquare, LayoutList } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import StatementModal from "../../components/accounts/StatementModal";
import PartyDebtPanel from "../../components/accounts/PartyDebtPanel";
import PermissionGate from "../../components/ui/PermissionGate";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("ar-EG") : "—";

function Modal({ onClose, children, width = "480px" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div style={{ width }} className="bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ── Status badge helper ────────────────────────────────────
function statusBadge(status) {
  if (status === "paid") return <span className="rounded-full px-2 py-0.5 text-[10px] font-black bg-emerald-100 text-emerald-700">مسدد</span>;
  if (status === "overdue") return <span className="rounded-full px-2 py-0.5 text-[10px] font-black bg-rose-100 text-rose-700">متأخر</span>;
  return <span className="rounded-full px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-700">قائم</span>;
}

// ── Urgency dot component ──────────────────────────────────
function UrgencyDot({ urgency }) {
  if (!urgency) return null;
  const colors = { overdue: "bg-red-500", soon: "bg-yellow-400", ok: "bg-green-500" };
  return (
    <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${colors[urgency] || ""}`} title={urgency === "overdue" ? "ديون متأخرة" : urgency === "soon" ? "ديون قريبة الاستحقاق" : "ديون قائمة"} />
  );
}

// ── All-Debts Drawer ───────────────────────────────────────
function AllDebtsDrawer({ open, onClose, partyType, onSelectParty }) {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const accent = partyType === "customer" ? "blue" : "orange";

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get(`/api/ajal-debts?party_type=${partyType}&status=${statusFilter === "all" ? "" : statusFilter}&limit=300`)
      .then(r => {
        const raw = r.data.data || [];
        // sort: overdue → open/partial → paid
        const order = { overdue: 0, partial: 1, open: 1, paid: 2 };
        raw.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
        setDebts(raw);
      })
      .catch(() => setDebts([]))
      .finally(() => setLoading(false));
  }, [open, partyType, statusFilter]);

  const filtered = debts.filter(d => {
    if (!search) return true;
    return d.party_name?.toLowerCase().includes(search.toLowerCase());
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose} dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`p-4 border-b border-slate-200 flex items-center justify-between ${accent === "blue" ? "bg-blue-50" : "bg-orange-50"}`}>
          <h2 className="text-[15px] font-black text-slate-900">كل الأقساط</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-slate-100 space-y-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث باسم الطرف..."
              className="w-full h-9 rounded-lg border border-slate-200 pr-8 pl-3 text-[12px] outline-none focus:border-blue-400" />
          </div>
          <div className="flex gap-1">
            {[{ id: "open", label: "قائم" }, { id: "overdue", label: "متأخر" }, { id: "all", label: "الكل" }].map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all ${statusFilter === f.id ? (accent === "blue" ? "bg-blue-600 text-white" : "bg-orange-600 text-white") : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-[12px] text-slate-400 animate-pulse">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-slate-400">لا توجد بيانات</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {["الطرف", "الأصل", "المتبقي", "الاستحقاق", "الحالة"].map(h => (
                    <th key={h} className="px-3 py-2 text-right font-black text-slate-500 text-[11px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id}
                    className={`border-t border-slate-100 cursor-pointer hover:bg-slate-50 ${d.status === "overdue" ? "bg-rose-50/40" : ""}`}
                    onClick={() => { onSelectParty(d); onClose(); }}>
                    <td className="px-3 py-2 font-black text-slate-800 truncate max-w-[120px]">{d.party_name || "—"}</td>
                    <td className="px-3 py-2 font-mono">{fmt(d.original_amount)}</td>
                    <td className="px-3 py-2 font-black font-mono text-rose-700">{fmt(d.remaining)}</td>
                    <td className="px-3 py-2 text-slate-500">{fmtDate(d.due_date)}</td>
                    <td className="px-3 py-2">{statusBadge(d.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomerAccountsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [customers, setCustomers] = useState([]);
  const [walkInId, setWalkInId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "invoices");
  const [tabData, setTabData] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState([]);

  // Summary bar
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Urgency map: partyId → "overdue" | "soon" | "ok"
  const [urgencyMap, setUrgencyMap] = useState({});

  // Drawer
  const [showDrawer, setShowDrawer] = useState(false);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showNote, setShowNote] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({ name: "", phone: "", additionalPhones: [""], addresses: [""], notes: "", code: "", opening_balance: 0, credit_limit: 0 });
  const [payForm, setPayForm] = useState({ amount: "", method_id: "", notes: "" });
  const [adjForm, setAdjForm] = useState({ amount: "", direction: "subtract", reason: "" });
  const [noteForm, setNoteForm] = useState({ note: "" });
  const [saving, setSaving] = useState(false);

  // ── Load customers + summary + urgency ──────────────────
  const loadCustomers = useCallback(async () => {
    try {
      const [res, methodsReq, settingsReq] = await Promise.all([
        api.get("/api/customers"),
        api.get("/api/payment-methods"),
        api.get("/api/settings"),
      ]);
      const wid = settingsReq.data.data?.walk_in_customer_id || null;
      setWalkInId(wid);
      setCustomers((res.data.data || []).filter(c => c.id !== wid));
      setPaymentMethods((methodsReq.data.data || []).filter(m => m.id !== 2));
    } catch {
      toast.error("فشل تحميل العملاء");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const r = await api.get("/api/ajal-debts/summary?party_type=customer");
      setSummary(r.data.data || r.data || null);
    } catch { setSummary(null); }
    finally { setSummaryLoading(false); }
  }, []);

  const loadUrgencyMap = useCallback(async () => {
    try {
      const r = await api.get("/api/ajal-debts?party_type=customer&status=open&limit=500");
      const debts = r.data.data || [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const soon = new Date(today); soon.setDate(soon.getDate() + 7);
      const map = {};
      for (const d of debts) {
        const pid = d.customer_id || d.party_id;
        if (!pid) continue;
        const due = d.due_date ? new Date(d.due_date) : null;
        const current = map[pid];
        let level = "ok";
        if (due && due < today) level = "overdue";
        else if (due && due <= soon) level = "soon";
        // escalate if already worse
        if (current === "overdue") continue;
        if (current === "soon" && level === "ok") continue;
        map[pid] = level;
      }
      setUrgencyMap(map);
    } catch { setUrgencyMap({}); }
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadUrgencyMap(); }, [loadUrgencyMap]);

  // ── Sync selection from URL params ──────────────────────
  useEffect(() => {
    const urlId = searchParams.get("id");
    const urlTab = searchParams.get("tab");
    if (urlTab) setActiveTab(urlTab);
    if (urlId && customers.length > 0) {
      const found = customers.find(c => String(c.id) === String(urlId));
      if (found && (!selected || selected.id !== found.id)) {
        setSelected(found);
        setTabData([]);
      }
    }
    if (urlId && customers.length > 0) {
      const found = customers.find(c => String(c.id) === String(urlId));
      if (!found) setSearchParams({});
    }
  }, [searchParams, customers, selected]);

  // ── Update URL when selection changes ───────────────────
  const selectCustomer = useCallback((c, tab = "invoices") => {
    setSelected(c);
    setActiveTab(tab);
    setTabData([]);
    setSearchParams({ id: String(c.id), tab });
  }, [setSearchParams]);

  const changeTab = useCallback((tab) => {
    setActiveTab(tab);
    if (selected) setSearchParams({ id: String(selected.id), tab });
  }, [selected, setSearchParams]);

  // ── Load tab data ────────────────────────────────────────
  const loadTab = useCallback(async () => {
    if (!selected) return;
    setTabLoading(true);
    try {
      if (activeTab === "invoices") {
        const r = await api.get(`/api/invoices?customer_id=${selected.id}&limit=100`);
        setTabData(r.data.data || []);
      } else if (activeTab === "payments") {
        const r = await api.get(`/api/payments?party_type=customer&party_id=${selected.id}`);
        setTabData(r.data.data || []);
      } else if (activeTab === "debts") {
        const r = await api.get(`/api/ajal-debts/customer/${selected.id}`);
        setTabData(r.data.data || []);
      } else if (activeTab === "notes") {
        const r = await api.get(`/api/customers/${selected.id}/notes`);
        setTabData(r.data.data || []);
      }
    } catch { setTabData([]); }
    finally { setTabLoading(false); }
  }, [selected, activeTab]);

  useEffect(() => { loadTab(); }, [loadTab]);

  const refreshSelected = async () => {
    if (!selected) return;
    const r = await api.get(`/api/customers/${selected.id}`);
    setSelected(r.data.data);
    loadCustomers();
    loadSummary();
    loadUrgencyMap();
  };

  // ── Handlers ──────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createForm.name.trim()) return toast.error("الاسم مطلوب");
    setSaving(true);
    try {
      const additionalPhones = createForm.additionalPhones.filter(p => p.trim()).join("|");
      const addresses = createForm.addresses.filter(a => a.trim()).join("|");
      const r = await api.post("/api/customers", { ...createForm, additional_phones: additionalPhones || null, addresses: addresses || null });
      toast.success("تم إضافة العميل");
      setShowCreate(false);
      setCreateForm({ name: "", phone: "", additionalPhones: [""], addresses: [""], notes: "", code: "", opening_balance: 0, credit_limit: 0 });
      await loadCustomers();
      selectCustomer(r.data.data, "invoices");
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الإضافة");
    } finally { setSaving(false); }
  };

  const handlePayment = async () => {
    if (!payForm.amount || !payForm.method_id) return toast.error("أدخل المبلغ ووسيلة الدفع");
    setSaving(true);
    try {
      await api.post("/api/payments", {
        party_type: "customer",
        party_id: selected.id,
        amount: Number(payForm.amount),
        method_id: Number(payForm.method_id),
        notes: payForm.notes,
      });
      toast.success("تم تسجيل الدفعة");
      setShowPayment(false);
      setPayForm({ amount: "", method_id: "", notes: "" });
      await refreshSelected();
      changeTab("payments");
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل تسجيل الدفعة");
    } finally { setSaving(false); }
  };

  const handleAdjust = async () => {
    if (!adjForm.amount || Number(adjForm.amount) <= 0) return toast.error("أدخل مبلغاً صحيحاً");
    setSaving(true);
    try {
      await api.post(`/api/customers/${selected.id}/adjust`, adjForm);
      toast.success("تم تسوية الرصيد وتسجيل الحركة");
      setShowAdjust(false);
      setAdjForm({ amount: "", direction: "subtract", reason: "" });
      await refreshSelected();
      changeTab("notes");
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل التسوية");
    } finally { setSaving(false); }
  };

  const handleAddNote = async () => {
    if (!noteForm.note.trim()) return toast.error("أدخل نص الملاحظة");
    setSaving(true);
    try {
      await api.post(`/api/customers/${selected.id}/notes`, noteForm);
      toast.success("تم إضافة الملاحظة");
      setShowNote(false);
      setNoteForm({ note: "" });
      changeTab("notes");
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الإضافة");
    } finally { setSaving(false); }
  };

  // Drawer: navigate to party's debts tab
  const handleDrawerSelectParty = (debt) => {
    const pid = debt.customer_id || debt.party_id;
    const found = customers.find(c => String(c.id) === String(pid));
    if (found) selectCustomer(found, "debts");
  };

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const matchesSearch = !q || c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.code?.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filter === "debtors") return Number(c.opening_balance) > 0;
    if (filter === "creditors") return Number(c.opening_balance) < 0;
    return true;
  });

  const bal = Number(selected?.opening_balance || 0);
  const creditLimit = Number(selected?.credit_limit || 0);
  const creditPct = creditLimit > 0 ? Math.min(100, Math.max(0, (bal / creditLimit) * 100)) : 0;

  return (
    <div className="flex flex-1 min-h-0 bg-zinc-50 overflow-hidden" dir="rtl">

      {/* ── Left Panel ── */}
      <div className="w-[360px] bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-lg">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                <Users className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-[15px] font-black text-slate-900">حسابات العملاء</h1>
            </div>
            <div className="flex items-center gap-2">
              <PermissionGate page="customer_accounts" action="add">
              <button onClick={() => setShowCreate(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-black text-white hover:bg-blue-700 transition-colors shadow-md shadow-blue-200">
                <Plus className="h-3.5 w-3.5" /> عميل جديد
              </button>
              </PermissionGate>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم، الهاتف، الكود..."
              className="w-full h-10 rounded-xl border border-slate-200 pr-9 pl-3 text-[12px] font-bold outline-none focus:border-blue-500 bg-white" />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {[{ id: "all", label: "الكل" }, { id: "debtors", label: "يدينون لنا" }, { id: "creditors", label: "ندين لهم" }].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`flex-1 py-1.5 text-[11px] font-black rounded-md transition-all ${filter === f.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Summary Bar ── */}
        <div className="mx-2 mt-2 mb-1 rounded-xl bg-blue-50 border border-blue-100 p-2.5 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 bg-white rounded-lg p-2 border border-blue-100 text-center">
              <div className="text-[10px] font-black text-slate-500 mb-0.5">إجمالي المديونية</div>
              <div className="text-[13px] font-black font-mono text-rose-600">
                {summaryLoading ? "..." : fmt(summary?.total_remaining ?? 0)}
              </div>
            </div>
            <div className="flex-1 bg-white rounded-lg p-2 border border-red-100 text-center">
              <div className="text-[10px] font-black text-slate-500 mb-0.5">متأخر</div>
              <div className="text-[13px] font-black font-mono text-red-600">
                {summaryLoading ? "..." : fmt(summary?.overdue_amount ?? summary?.total_overdue ?? 0)}
              </div>
            </div>
            <div className="flex-1 bg-white rounded-lg p-2 border border-amber-100 text-center">
              <div className="text-[10px] font-black text-slate-500 mb-0.5">مستحق اليوم</div>
              <div className="text-[13px] font-black font-mono text-amber-600">
                {summaryLoading ? "..." : (summary?.due_today_count ?? summary?.due_today ?? 0)}
              </div>
            </div>
          </div>
          <button onClick={() => setShowDrawer(true)}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg bg-blue-600 text-white text-[11px] font-black hover:bg-blue-700 transition-colors">
            <LayoutList className="h-3.5 w-3.5" /> عرض كل الأقساط
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-6 text-center text-[12px] text-slate-400 animate-pulse">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-10 w-10 text-slate-200 mx-auto mb-2" />
              <p className="text-[12px] font-black text-slate-400">لا يوجد عملاء</p>
            </div>
          ) : filtered.map(c => {
            const b = Number(c.opening_balance || 0);
            const lim = Number(c.credit_limit || 0);
            const nearLimit = lim > 0 && b >= lim * 0.9;
            const urgency = urgencyMap[c.id];
            return (
              <div key={c.id} onClick={() => selectCustomer(c, "invoices")}
                className={`p-3 rounded-xl cursor-pointer border transition-all ${selected?.id === c.id ? "bg-blue-50 border-blue-300" : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"}`}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-[14px] font-black text-white shrink-0">
                    {c.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="text-[13px] font-black text-slate-900 truncate">{c.name}</div>
                        <UrgencyDot urgency={urgency} />
                      </div>
                      {nearLimit && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 ml-1" />}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] text-slate-400 font-mono truncate">{c.phone || c.code || "—"}</div>
                      <div className="flex items-center gap-1 shrink-0">
                        {b < 0 && <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">له رصيد</span>}
                        {b > 0 && <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">عليه رصيد</span>}
                        <span className={`text-[12px] font-black font-mono ${b > 0 ? "text-rose-600" : b < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                          {fmt(Math.abs(b))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-300">
            <Users className="h-20 w-20 opacity-30" />
            <p className="text-[15px] font-black">اختر عميلاً من القائمة</p>
          </div>
        ) : (
          <>
            {/* Customer Header */}
            <div className="bg-white border-b border-slate-200 p-6 shrink-0">
              {/* Info Row */}
              <div className="flex items-start mb-5">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-[26px] font-black text-white shadow-lg shadow-blue-200">
                    {selected.name?.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-[20px] font-black text-slate-900">{selected.name}</h2>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      {selected.phone && (
                        <span className="flex items-center gap-1.5 text-[12px] text-slate-500 font-bold">
                          <Phone className="h-3.5 w-3.5" /> {selected.phone}
                        </span>
                      )}
                      {selected.code && (
                        <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">{selected.code}</span>
                      )}
                      {selected.is_blacklisted === 1 && (
                        <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">محظور</span>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Balance Card — full width, prominent */}
              <div className={`rounded-2xl p-4 mb-5 flex items-center justify-between border-2 ${
                bal > 0 ? "bg-rose-50 border-rose-200" :
                bal < 0 ? "bg-emerald-50 border-emerald-200" :
                "bg-slate-50 border-slate-200"
              }`}>
                <div>
                  <div className={`text-[11px] font-black uppercase tracking-widest mb-1 ${bal > 0 ? "text-rose-500" : bal < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {bal > 0 ? "عليه رصيد" : bal < 0 ? "له رصيد" : "الحساب مسوّى"}
                  </div>
                  <div className={`text-[36px] font-black font-mono leading-none ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {fmt(Math.abs(bal))}
                    <span className="text-[14px] font-bold mr-1">ج.م</span>
                  </div>
                </div>
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-[28px] shrink-0 ${
                  bal > 0 ? "bg-rose-100" : bal < 0 ? "bg-emerald-100" : "bg-slate-100"
                }`}>
                  {bal > 0 ? "🔴" : bal < 0 ? "🟢" : "✅"}
                </div>
              </div>

              {/* Credit Limit Bar */}
              {creditLimit > 0 && bal > 0 && (
                <div className="mb-5 bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <div className="flex justify-between text-[11px] font-black mb-1.5">
                    <span className="text-slate-500">الحد الائتماني المستهلك</span>
                    <span className="text-slate-700">{fmt(bal)} / {fmt(creditLimit)}</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${creditPct > 90 ? "bg-rose-500" : creditPct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${creditPct}%` }} />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-4 gap-2">
                <PermissionGate page="customer_accounts" action="edit">
                <button onClick={() => { setPayForm({ amount: bal > 0 ? String(bal) : "", method_id: "", notes: "" }); setShowPayment(true); }}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-blue-600 py-3 text-white hover:bg-blue-700 shadow-md shadow-blue-200 transition-all">
                  <Plus className="h-5 w-5" />
                  <span className="text-[11px] font-black">تحصيل دفعة</span>
                </button>
                </PermissionGate>
                <PermissionGate page="customer_accounts" action="print">
                <button onClick={() => setShowStatement(true)}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-white border border-slate-200 py-3 text-slate-700 hover:bg-slate-50 transition-all">
                  <FileText className="h-5 w-5 text-slate-500" />
                  <span className="text-[11px] font-black">كشف حساب</span>
                </button>
                </PermissionGate>
                <PermissionGate page="customer_accounts" action="edit">
                <button onClick={() => { setAdjForm({ amount: "", direction: "subtract", reason: "" }); setShowAdjust(true); }}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-white border border-slate-200 py-3 text-slate-700 hover:bg-slate-50 transition-all">
                  <SlidersHorizontal className="h-5 w-5 text-slate-500" />
                  <span className="text-[11px] font-black">تسوية رصيد</span>
                </button>
                </PermissionGate>
                <PermissionGate page="customer_accounts" action="edit">
                <button onClick={() => { setNoteForm({ note: "" }); setShowNote(true); }}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-white border border-slate-200 py-3 text-slate-700 hover:bg-slate-50 transition-all">
                  <MessageSquare className="h-5 w-5 text-slate-500" />
                  <span className="text-[11px] font-black">إضافة ملاحظة</span>
                </button>
                </PermissionGate>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-3 bg-white border-b border-slate-200 shrink-0">
              {[
                { id: "invoices", label: "الفواتير" },
                { id: "payments", label: "المدفوعات" },
                { id: "debts", label: "ديون أجل" },
                { id: "notes", label: "الملاحظات والتسويات" },
              ].map(t => (
                <button key={t.id} onClick={() => changeTab(t.id)}
                  className={`pb-3 px-3 text-[13px] font-black transition-colors relative ${activeTab === t.id ? "text-blue-600" : "text-slate-500 hover:text-slate-800"}`}>
                  {t.label}
                  {activeTab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50">
              {activeTab === "debts" ? (
                <PartyDebtPanel party={selected} partyType="customer" accent="blue" onChanged={refreshSelected} />
              ) : tabLoading ? (
                <div className="flex items-center justify-center h-32 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
              ) : tabData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-300 gap-2">
                  <FileText className="h-8 w-8 opacity-40" />
                  <span className="font-black text-[13px]">لا توجد بيانات</span>
                </div>
              ) : activeTab === "invoices" ? (
                <table className="w-full text-[12px] bg-white rounded-xl overflow-hidden shadow-sm">
                  <thead className="bg-slate-100">
                    <tr>{["رقم الفاتورة", "التاريخ", "الإجمالي", "الحالة"].map(h => (
                      <th key={h} className="px-4 py-3 text-right font-black text-slate-500 text-[11px]">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {tabData.map(inv => (
                      <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-black font-mono text-blue-700">{inv.invoice_no || inv.doc_no || `#${inv.id}`}</td>
                        <td className="px-4 py-3 text-slate-500">{fmtDate(inv.created_at)}</td>
                        <td className="px-4 py-3 font-black font-mono">{fmt(inv.total)} ج.م</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">{inv.status || "مكتمل"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : activeTab === "payments" ? (
                <table className="w-full text-[12px] bg-white rounded-xl overflow-hidden shadow-sm">
                  <thead className="bg-slate-100">
                    <tr>{["المرجع", "المبلغ", "الوسيلة", "ملاحظات", "التاريخ"].map(h => (
                      <th key={h} className="px-4 py-3 text-right font-black text-slate-500 text-[11px]">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {tabData.map(p => (
                      <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{p.doc_no || `PAY-${p.id}`}</td>
                        <td className="px-4 py-3 font-black font-mono text-emerald-700">{fmt(p.amount)} ج.م</td>
                        <td className="px-4 py-3 text-slate-600">{p.method_name || p.method}</td>
                        <td className="px-4 py-3 text-slate-500 text-[11px]">{p.notes || "—"}</td>
                        <td className="px-4 py-3 text-slate-500">{fmtDate(p.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="space-y-3 max-w-2xl">
                  {tabData.map(n => {
                    const isAdj = n.note?.startsWith("تسوية رصيد");
                    return (
                      <div key={n.id} className={`rounded-xl border p-4 shadow-sm ${isAdj ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            {isAdj
                              ? <span className="text-[10px] font-black bg-amber-200 text-amber-800 px-2 py-0.5 rounded-lg">⚖️ تسوية رصيد</span>
                              : <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">📝 ملاحظة</span>
                            }
                            <span className="text-[10px] text-slate-400 font-bold">{n.user_name || "النظام"}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{fmtDate(n.created_at)}</span>
                        </div>
                        <p className={`text-[13px] font-bold leading-relaxed ${isAdj ? "text-amber-900" : "text-slate-800"}`}>{n.note}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ══ All-Debts Drawer ═══════════════════════════════════ */}
      <AllDebtsDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        partyType="customer"
        onSelectParty={handleDrawerSelectParty}
      />

      {/* ══ Modals ══════════════════════════════════════════════ */}

      {/* Create Customer */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[17px] font-black text-slate-900">إضافة عميل جديد</h2>
              <button onClick={() => setShowCreate(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">الاسم <span className="text-rose-500">*</span></label>
                <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-blue-500 font-bold"
                  placeholder="اسم العميل" />
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">رقم الهاتف الأساسي</label>
                <input value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-blue-500 font-bold"
                  placeholder="01xxxxxxxxx" />
              </div>
              {/* Additional Phones */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-black text-slate-600">أرقام هواتف إضافية</label>
                  <button type="button" onClick={() => setCreateForm(f => ({ ...f, additionalPhones: [...f.additionalPhones, ""] }))}
                    className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700">
                    <Plus className="h-3 w-3" /> إضافة رقم
                  </button>
                </div>
                {createForm.additionalPhones.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5">
                    <input value={p} onChange={e => setCreateForm(f => ({ ...f, additionalPhones: f.additionalPhones.map((ph, idx) => idx === i ? e.target.value : ph) }))}
                      placeholder="رقم هاتف إضافي..."
                      className="flex-1 h-9 rounded-lg border border-slate-200 px-3 text-[12px] outline-none focus:border-blue-500" />
                    {createForm.additionalPhones.length > 1 && (
                      <button type="button" onClick={() => setCreateForm(f => ({ ...f, additionalPhones: f.additionalPhones.filter((_, idx) => idx !== i) }))}
                        className="text-rose-500 hover:text-rose-700"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                ))}
              </div>
              {/* Addresses */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-black text-slate-600">العناوين</label>
                  <button type="button" onClick={() => setCreateForm(f => ({ ...f, addresses: [...f.addresses, ""] }))}
                    className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700">
                    <Plus className="h-3 w-3" /> إضافة عنوان
                  </button>
                </div>
                {createForm.addresses.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5">
                    <input value={a} onChange={e => setCreateForm(f => ({ ...f, addresses: f.addresses.map((ad, idx) => idx === i ? e.target.value : ad) }))}
                      placeholder="العنوان..."
                      className="flex-1 h-9 rounded-lg border border-slate-200 px-3 text-[12px] outline-none focus:border-blue-500" />
                    {createForm.addresses.length > 1 && (
                      <button type="button" onClick={() => setCreateForm(f => ({ ...f, addresses: f.addresses.filter((_, idx) => idx !== i) }))}
                        className="text-rose-500 hover:text-rose-700"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">ملاحظات</label>
                <textarea value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-[13px] outline-none focus:border-blue-500 font-bold resize-none"
                  rows={2} placeholder="أي ملاحظات إضافية..." />
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">كود العميل</label>
                <input value={createForm.code} onChange={e => setCreateForm(f => ({ ...f, code: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-blue-500 font-bold font-mono"
                  placeholder="CUST-001" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-black text-slate-600 mb-1.5 block">رصيد افتتاحي</label>
                  <input type="number" value={createForm.opening_balance} onChange={e => setCreateForm(f => ({ ...f, opening_balance: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-blue-500 font-mono font-bold" />
                </div>
                <div>
                  <label className="text-[12px] font-black text-slate-600 mb-1.5 block">حد الائتمان</label>
                  <input type="number" value={createForm.credit_limit} onChange={e => setCreateForm(f => ({ ...f, credit_limit: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-blue-500 font-mono font-bold" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 h-11 rounded-xl bg-blue-600 text-white text-[13px] font-black hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-md shadow-blue-200">
                {saving ? "جاري الحفظ..." : "حفظ العميل"}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="h-11 px-6 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-black hover:bg-slate-200 transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Payment Modal */}
      {showPayment && selected && (
        <Modal onClose={() => setShowPayment(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[17px] font-black text-slate-900">{bal < 0 ? "رد مبلغ للعميل" : "تحصيل دفعة من العميل"}</h2>
              <button onClick={() => setShowPayment(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <p className="text-[12px] text-slate-500 font-bold mb-3">
              العميل: <span className="text-slate-800">{selected.name}</span>
            </p>
            {bal > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 text-[12px] font-bold text-rose-800">
                عليه رصيد <span className="font-mono font-black">{fmt(bal)} ج.م</span>
                {Number(payForm.amount) > bal && bal > 0 && <div className="mt-1 text-amber-700 font-black">⚠️ المبلغ المدخل أكبر من الرصيد — الفرق سيصبح له رصيد.</div>}
              </div>
            )}
            {bal < 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-[12px] font-bold text-emerald-800">
                له رصيد <span className="font-mono font-black">{fmt(Math.abs(bal))} ج.م</span>
              </div>
            )}
            {bal === 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-[12px] font-bold text-slate-600">
                الحساب مسوّى حالياً — أي مبلغ يُحصَّل سيجعل العميل دائناً لنا.
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">{bal < 0 ? "المبلغ المسترد للعميل" : "المبلغ المحصّل"} <span className="text-rose-500">*</span></label>
                <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[16px] font-black font-mono outline-none focus:border-blue-500"
                  placeholder="0.00" autoFocus />
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">وسيلة الدفع <span className="text-rose-500">*</span></label>
                <select value={payForm.method_id} onChange={e => setPayForm(f => ({ ...f, method_id: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[13px] font-bold bg-white outline-none focus:border-blue-500">
                  <option value="">-- اختر الوسيلة --</option>
                  {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">ملاحظات (اختياري)</label>
                <input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-blue-500"
                  placeholder="مثال: دفعة على الحساب" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handlePayment} disabled={saving || !payForm.amount || !payForm.method_id}
                className="flex-1 h-11 rounded-xl bg-blue-600 text-white text-[13px] font-black hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-md shadow-blue-200">
                {saving ? "جاري التسجيل..." : "تأكيد التحصيل"}
              </button>
              <button onClick={() => setShowPayment(false)}
                className="h-11 px-6 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-black hover:bg-slate-200 transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Adjust Modal */}
      {showAdjust && selected && (
        <Modal onClose={() => setShowAdjust(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[17px] font-black text-slate-900">تسوية رصيد يدوية</h2>
              <button onClick={() => setShowAdjust(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <p className="text-[12px] text-slate-500 font-bold mb-1">
              العميل: <span className="text-slate-800">{selected.name}</span>
            </p>
            <p className="text-[12px] text-slate-500 font-bold mb-5">
              الرصيد الحالي:
              <span className={`font-mono font-black ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                {fmt(Math.abs(bal))} ج.م
              </span>
              {bal > 0 && <span className="text-rose-500 text-[10px]"> — عليه رصيد</span>}
              {bal < 0 && <span className="text-emerald-600 text-[10px]"> — له رصيد</span>}
              {bal === 0 && <span className="text-slate-400 text-[10px]"> — مسوّى</span>}
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
              <p className="text-[11px] font-black text-amber-800">
                ⚠️ التسوية اليدوية تعدّل رصيد العميل مباشرة بدون تأثير على الخزنة. سيتم تسجيل الحركة في سجل الملاحظات.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-2 block">نوع التسوية</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setAdjForm(f => ({ ...f, direction: "subtract" }))}
                    className={`p-3 rounded-xl border-2 text-[12px] font-black transition-all ${adjForm.direction === "subtract" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <div className="text-[18px] mb-1">↓</div>
                    تخفيض مديونية العميل
                    <div className="text-[10px] font-bold mt-0.5 opacity-70">(خصم / إعفاء / تصحيح)</div>
                  </button>
                  <button onClick={() => setAdjForm(f => ({ ...f, direction: "add" }))}
                    className={`p-3 rounded-xl border-2 text-[12px] font-black transition-all ${adjForm.direction === "add" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <div className="text-[18px] mb-1">↑</div>
                    رفع مديونية العميل
                    <div className="text-[10px] font-bold mt-0.5 opacity-70">(إضافة دين / تصحيح)</div>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">المبلغ <span className="text-rose-500">*</span></label>
                <input type="number" value={adjForm.amount} onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[16px] font-black font-mono outline-none focus:border-blue-500"
                  placeholder="0.00" autoFocus />
              </div>
              {adjForm.amount > 0 && (() => {
                const newBal = adjForm.direction === "subtract" ? bal - Number(adjForm.amount) : bal + Number(adjForm.amount);
                return (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-[11px] font-black text-slate-500 mb-1">الرصيد بعد التسوية:</p>
                  <p className={`text-[18px] font-black font-mono ${newBal > 0 ? "text-rose-600" : newBal < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                    {fmt(Math.abs(newBal))} ج.م
                  </p>
                  <p className={`text-[10px] font-black mt-0.5 ${newBal > 0 ? "text-rose-400" : newBal < 0 ? "text-emerald-500" : "text-slate-400"}`}>
                    {newBal > 0 ? "عليه رصيد" : newBal < 0 ? "له رصيد" : "✓ مسوّى"}
                  </p>
                </div>
                );
              })()}
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">سبب التسوية (مطلوب للتسجيل)</label>
                <input value={adjForm.reason} onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-blue-500"
                  placeholder="مثال: خصم متفق عليه / تصحيح خطأ" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleAdjust} disabled={saving || !adjForm.amount}
                className="flex-1 h-11 rounded-xl bg-slate-800 text-white text-[13px] font-black hover:bg-slate-900 disabled:opacity-50 transition-colors">
                {saving ? "جاري التسوية..." : "تأكيد التسوية وتسجيلها"}
              </button>
              <button onClick={() => setShowAdjust(false)}
                className="h-11 px-6 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-black hover:bg-slate-200 transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Note Modal */}
      {showNote && selected && (
        <Modal onClose={() => setShowNote(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[17px] font-black text-slate-900">إضافة ملاحظة</h2>
              <button onClick={() => setShowNote(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <p className="text-[12px] text-slate-500 font-bold mb-5">
              العميل: <span className="text-slate-800">{selected.name}</span>
            </p>
            <div>
              <label className="text-[12px] font-black text-slate-600 mb-1.5 block">نص الملاحظة <span className="text-rose-500">*</span></label>
              <textarea value={noteForm.note} onChange={e => setNoteForm(f => ({ ...f, note: e.target.value }))}
                rows={4} autoFocus
                className="w-full rounded-xl border border-slate-200 p-4 text-[13px] font-bold outline-none focus:border-amber-400 resize-none"
                placeholder="اكتب ملاحظتك هنا..." />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAddNote} disabled={saving || !noteForm.note.trim()}
                className="flex-1 h-11 rounded-xl bg-amber-600 text-white text-[13px] font-black hover:bg-amber-700 disabled:opacity-50 transition-colors">
                {saving ? "جاري الحفظ..." : "حفظ الملاحظة"}
              </button>
              <button onClick={() => setShowNote(false)}
                className="h-11 px-6 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-black hover:bg-slate-200 transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Statement Modal */}
      {showStatement && selected && (
        <StatementModal party={selected} partyType="customer" onClose={() => setShowStatement(false)} />
      )}
    </div>
  );
}
