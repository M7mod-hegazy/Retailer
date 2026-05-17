import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Users, Search, Plus, X, Phone, AlertTriangle, SlidersHorizontal,
  MessageSquare, Eye, ExternalLink, RefreshCw, FileText,
  ShoppingBag, CreditCard, RotateCcw, Scale, ChevronDown, ChevronUp, Calendar,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { usePageTour } from "../../hooks/usePageTour";
import PermissionGate from "../../components/ui/PermissionGate";

const fmt = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("ar-EG") : "—";

const PAYMENT_METHOD_AR = {
  cash: "نقداً", card: "بطاقة", bank: "بنك", bank_transfer: "تحويل بنكي",
  credit: "آجل", installments: "تقسيط", wallet: "محفظة", multi: "متعدد",
};
const arMethod = (key) => PAYMENT_METHOD_AR[key] || key;

const PTYPE_COLOR = {
  cash: "text-emerald-700 bg-emerald-50 border-emerald-200",
  credit: "text-amber-700 bg-amber-50 border-amber-200",
  installments: "text-violet-700 bg-violet-50 border-violet-200",
  multi: "text-blue-700 bg-blue-50 border-blue-200",
  bank_transfer: "text-sky-700 bg-sky-50 border-sky-200",
};

function Modal({ onClose, children, width = "480px" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div style={{ width }} className="bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ── Event type config ─────────────────────────────────────
const EVENT_TYPES = {
  invoice:    { icon: ShoppingBag,  label: "فاتورة",        color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-100" },
  payment:    { icon: CreditCard,   label: "تحصيل دفعة",    color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  return:     { icon: RotateCcw,    label: "مرتجع",          color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-100" },
  adjustment: { icon: Scale,        label: "تسوية يدوية",   color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-100" },
};

// ── Installments expandable within invoice row ────────────
function InstallmentsBadge({ debtId }) {
  const [open, setOpen] = useState(false);
  const [schedules, setSchedules] = useState(null);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    if (schedules !== null) { setOpen(o => !o); return; }
    try {
      const r = await api.get(`/api/ajal-debts/${debtId}`);
      setSchedules(r.data.data?.schedule || []);
      setOpen(true);
    } catch { setSchedules([]); setOpen(true); }
  }, [debtId, schedules]);

  const pending = schedules ? schedules.filter(s => s.status !== "paid").length : null;

  return (
    <div className="mt-1.5">
      <button onClick={load}
        className="flex items-center gap-1 text-[10px] font-black text-violet-600 bg-violet-50 border border-violet-200 rounded-lg px-2 py-0.5 hover:bg-violet-100">
        <Calendar className="h-3 w-3" />
        {pending !== null ? `${pending} قسط متبقي` : "الأقساط"}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && schedules?.length > 0 && (
        <div className="mt-1.5 space-y-1 pr-2 border-r-2 border-violet-200">
          {schedules.map(s => {
            const isOverdue = s.status !== "paid" && s.due_date < today;
            const isPaid = s.status === "paid";
            return (
              <div key={s.id} className={`flex items-center justify-between rounded-lg px-2 py-1 text-[10px] font-bold ${isPaid ? "bg-emerald-50 text-emerald-700" : isOverdue ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-600"}`}>
                <span>القسط {s.installment_no} — {fmtDate(s.due_date)}</span>
                <span className="font-black font-mono">{fmt(s.amount)}</span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isPaid ? "bg-emerald-200 text-emerald-800" : isOverdue ? "bg-rose-200 text-rose-800" : "bg-slate-200 text-slate-700"}`}>
                  {isPaid ? "مسدد" : isOverdue ? "متأخر" : "معلق"}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {open && schedules?.length === 0 && (
        <div className="mt-1 text-[10px] text-slate-400 font-bold pr-2">لا توجد أقساط مجدولة</div>
      )}
    </div>
  );
}

// ── الحركات Tab ───────────────────────────────────────────
function MovementsTab({ party, partyType, onOpenInvoice, onOpenReturn }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!party?.id) return;
    setLoading(true);
    try {
      const idParam = partyType === "customer" ? `customer_id=${party.id}` : `supplier_id=${party.id}`;
      const docEndpoint = partyType === "customer" ? `/api/invoices?${idParam}&limit=200` : `/api/purchases?${idParam}&limit=200`;
      const payEndpoint = `/api/payments?party_type=${partyType}&party_id=${party.id}&limit=200`;
      const retEndpoint = partyType === "customer"
        ? `/api/invoices/returns?customer_id=${party.id}&limit=200`
        : `/api/purchases/returns?supplier_id=${party.id}&limit=200`;
      const adjEndpoint = partyType === "customer"
        ? `/api/customers/${party.id}/notes?type=adjustment`
        : `/api/suppliers/${party.id}/notes?type=adjustment`;

      const [docsR, paysR, retsR, adjR] = await Promise.allSettled([
        api.get(docEndpoint),
        api.get(payEndpoint),
        api.get(retEndpoint),
        api.get(adjEndpoint),
      ]);

      const items = [];

      (docsR.value?.data?.data || []).forEach(d => {
        items.push({
          id: `inv-${d.id}`,
          type: "invoice",
          date: new Date(d.created_at),
          ref: d.invoice_no || d.doc_no || `#${d.id}`,
          description: `فاتورة ${arMethod(d.payment_type) || ""}`,
          debit: Number(d.total || 0),
          credit: 0,
          raw: d,
          debtId: d.debt_id || null,
        });
      });

      (paysR.value?.data?.data || []).forEach(p => {
        items.push({
          id: `pay-${p.id}`,
          type: "payment",
          date: new Date(p.created_at),
          ref: p.doc_no || `PAY-${p.id}`,
          description: `تحصيل دفعة — ${p.method_name || p.method || ""}`,
          debit: 0,
          credit: Number(p.amount || 0),
          raw: p,
        });
      });

      (retsR.value?.data?.data || []).forEach(r => {
        items.push({
          id: `ret-${r.id}`,
          type: "return",
          date: new Date(r.created_at),
          ref: r.doc_no || `RET-${r.id}`,
          description: `مرتجع${r.original_invoice_no ? ` — ${r.original_invoice_no}` : ""}`,
          debit: 0,
          credit: Number(r.total || 0),
          raw: r,
        });
      });

      (adjR.value?.data?.data || []).forEach(n => {
        const amount = Number(n.amount || 0);
        items.push({
          id: `adj-${n.id}`,
          type: "adjustment",
          date: new Date(n.created_at),
          ref: `ADJ-${n.id}`,
          description: n.note || "تسوية يدوية",
          debit: amount > 0 ? amount : 0,
          credit: amount < 0 ? Math.abs(amount) : 0,
          raw: n,
        });
      });

      items.sort((a, b) => b.date - a.date);

      // Running balance (latest first so we go backwards from current balance)
      const currentBal = Number(party.opening_balance || 0);
      let running = currentBal;
      for (const item of items) {
        item.runningBalance = running;
        running = running - item.credit + item.debit;
      }

      setEvents(items);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  }, [party, partyType]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex h-32 items-center justify-center text-[12px] font-black text-slate-400 animate-pulse">جاري التحميل...</div>;
  if (events.length === 0) return (
    <div className="flex flex-col items-center justify-center h-32 text-slate-300 gap-2">
      <FileText className="h-8 w-8 opacity-40" />
      <span className="font-black text-[13px]">لا توجد حركات مسجلة</span>
    </div>
  );

  return (
    <div className="space-y-1.5">
      {events.map(ev => {
        const cfg = EVENT_TYPES[ev.type];
        const Icon = cfg.icon;
        return (
          <div key={ev.id} className={`rounded-xl border ${cfg.border} bg-white shadow-sm overflow-hidden`}>
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Icon */}
              <div className={`h-8 w-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-4 w-4 ${cfg.color}`} />
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>
                  <span className="text-[11px] font-black text-slate-600 font-mono">{ev.ref}</span>
                  {ev.type === "invoice" && ev.raw?.payment_type && (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${PTYPE_COLOR[ev.raw.payment_type] || "text-slate-600 bg-slate-100 border-slate-200"}`}>
                      {arMethod(ev.raw.payment_type)}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">{ev.description}</div>
                {/* Installments badge on ajal/installment invoices */}
                {ev.type === "invoice" && (ev.raw?.payment_type === "credit" || ev.raw?.payment_type === "installments") && ev.raw?.id && (
                  <InstallmentsBadge debtId={ev.raw.debt_id || ev.raw.id} />
                )}
              </div>

              {/* Amounts */}
              <div className="text-right shrink-0">
                {ev.debit > 0 && <div className="text-[13px] font-black font-mono text-rose-600">+{fmt(ev.debit)}</div>}
                {ev.credit > 0 && <div className="text-[13px] font-black font-mono text-emerald-600">-{fmt(ev.credit)}</div>}
                <div className={`text-[10px] font-bold font-mono mt-0.5 ${ev.runningBalance > 0 ? "text-rose-400" : ev.runningBalance < 0 ? "text-emerald-500" : "text-slate-400"}`}>
                  رصيد: {fmt(Math.abs(ev.runningBalance))}
                </div>
              </div>

              {/* Date + eye */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] text-slate-400">{fmtDate(ev.date)}</span>
                {ev.type === "invoice" && (
                  <button onClick={() => onOpenInvoice(ev.raw)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50">
                    <Eye className="h-3 w-3" />
                  </button>
                )}
                {ev.type === "return" && (
                  <button onClick={() => onOpenReturn(ev.raw)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50">
                    <Eye className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CustomerAccountsPage() {
  usePageTour('customer_accounts');
  const [searchParams, setSearchParams] = useSearchParams();

  const [customers, setCustomers] = useState([]);
  const [walkInId, setWalkInId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "movements");
  const [notesData, setNotesData] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState([]);

  // Summary
  const [netBalance, setNetBalance] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Invoice detail modal
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Return detail modal
  const [detailReturn, setDetailReturn] = useState(null);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({ name: "", phone: "", additionalPhones: [""], addresses: [""], notes: "", code: "", opening_balance: 0, credit_limit: 0 });
  const [payForm, setPayForm] = useState({ amount: "", method_id: "", notes: "" });
  const [adjForm, setAdjForm] = useState({ amount: "", direction: "subtract", reason: "" });
  const [saving, setSaving] = useState(false);

  // ── Loaders ───────────────────────────────────────────────
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
    } catch { toast.error("فشل تحميل العملاء"); }
    finally { setLoading(false); }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const r = await api.get("/api/customers/balance-summary");
      setNetBalance(r.data.data?.net_balance ?? null);
    } catch { setNetBalance(null); }
    finally { setSummaryLoading(false); }
  }, []);

  const loadNotes = useCallback(async () => {
    if (!selected) return;
    setNotesLoading(true);
    try {
      const r = await api.get(`/api/customers/${selected.id}/notes?type=note`);
      setNotesData(r.data.data || []);
    } catch { setNotesData([]); }
    finally { setNotesLoading(false); }
  }, [selected]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (activeTab === "notes") loadNotes(); }, [activeTab, loadNotes]);

  // ── URL sync ──────────────────────────────────────────────
  useEffect(() => {
    const urlId = searchParams.get("id");
    const urlTab = searchParams.get("tab");
    if (urlTab) setActiveTab(urlTab);
    if (urlId && customers.length > 0) {
      const found = customers.find(c => String(c.id) === String(urlId));
      if (found && (!selected || selected.id !== found.id)) setSelected(found);
      else if (!found) setSearchParams({});
    }
  }, [searchParams, customers, selected]);

  const selectCustomer = useCallback((c, tab = "movements") => {
    setSelected(c);
    setActiveTab(tab);
    setNotesData([]);
    setSearchParams({ id: String(c.id), tab });
  }, [setSearchParams]);

  const changeTab = useCallback((tab) => {
    setActiveTab(tab);
    if (selected) setSearchParams({ id: String(selected.id), tab });
  }, [selected, setSearchParams]);

  const refreshSelected = async () => {
    if (!selected) return;
    const r = await api.get(`/api/customers/${selected.id}`);
    setSelected(r.data.data);
    loadCustomers();
    loadSummary();
  };

  // ── Invoice detail ────────────────────────────────────────
  useEffect(() => {
    if (!detailInvoice) { setDetailData(null); return; }
    setDetailLoading(true);
    api.get(`/api/invoices/${detailInvoice.id}`)
      .then(r => setDetailData(r.data.data))
      .catch(() => setDetailData(null))
      .finally(() => setDetailLoading(false));
  }, [detailInvoice]);

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
      selectCustomer(r.data.data, "movements");
    } catch (e) { toast.error(e.response?.data?.message || "فشل الإضافة"); }
    finally { setSaving(false); }
  };

  const handlePayment = async () => {
    if (!payForm.amount || !payForm.method_id) return toast.error("أدخل المبلغ ووسيلة الدفع");
    setSaving(true);
    try {
      const totalAmount = Number(payForm.amount);
      const debtsRes = await api.get(`/api/ajal-debts?party_type=customer&customer_id=${selected.id}&status=open&limit=100`).catch(() => ({ data: { data: [] } }));
      const openDebts = (debtsRes.data.data || []).filter(d => d.remaining > 0);
      if (openDebts.length > 0) {
        openDebts.sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));
        let remaining = totalAmount;
        for (const debt of openDebts) {
          if (remaining <= 0) break;
          const payAmt = Math.min(remaining, debt.remaining);
          await api.post(`/api/ajal-debts/${debt.id}/pay`, { amount: payAmt, payment_method_id: Number(payForm.method_id), notes: payForm.notes });
          remaining -= payAmt;
        }
        if (remaining > 0) {
          await api.post("/api/payments", { party_type: "customer", party_id: selected.id, amount: remaining, method_id: Number(payForm.method_id), notes: payForm.notes });
        }
      } else {
        await api.post("/api/payments", { party_type: "customer", party_id: selected.id, amount: totalAmount, method_id: Number(payForm.method_id), notes: payForm.notes });
      }
      toast.success("تم تسجيل الدفعة");
      setShowPayment(false);
      setPayForm({ amount: "", method_id: "", notes: "" });
      await refreshSelected();
    } catch (e) { toast.error(e.response?.data?.message || "فشل تسجيل الدفعة"); }
    finally { setSaving(false); }
  };

  const handleAdjust = async () => {
    if (!adjForm.amount || Number(adjForm.amount) <= 0) return toast.error("أدخل مبلغاً صحيحاً");
    setSaving(true);
    try {
      await api.post(`/api/customers/${selected.id}/adjust`, adjForm);
      setShowAdjust(false);
      setAdjForm({ amount: "", direction: "subtract", reason: "" });
      await refreshSelected();
      toast.success("تم تسوية الرصيد وتسجيل الحركة");
    } catch (e) { toast.error(e.response?.data?.message || "فشل التسوية"); }
    finally { setSaving(false); }
  };

  const handleAddNote = async (noteText) => {
    if (!noteText?.trim()) return;
    try {
      await api.post(`/api/customers/${selected.id}/notes`, { note: noteText });
      toast.success("تم إضافة الملاحظة");
      loadNotes();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الإضافة"); }
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
            <PermissionGate page="customer_accounts" action="add">
              <button onClick={() => setShowCreate(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-black text-white hover:bg-blue-700 transition-colors shadow-md shadow-blue-200">
                <Plus className="h-3.5 w-3.5" /> عميل جديد
              </button>
            </PermissionGate>
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

        {/* ── Net Balance Summary ── */}
        <div className="mx-2 mt-2 mb-1 rounded-xl bg-blue-50 border border-blue-100 p-3">
          <div className="text-[10px] font-black text-slate-500 mb-0.5">إجمالي المديونية</div>
          <div className={`text-[20px] font-black font-mono ${netBalance > 0 ? "text-rose-600" : netBalance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
            {summaryLoading ? "..." : fmt(netBalance ?? 0)}
            <span className="text-[11px] font-bold text-slate-400 mr-1">ج.م</span>
          </div>
          {netBalance < 0 && <div className="text-[9px] font-black text-emerald-600 mt-0.5">رصيد لصالح العملاء</div>}
          {netBalance > 0 && <div className="text-[9px] font-black text-rose-500 mt-0.5">مديونية على العملاء</div>}
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
            return (
              <div key={c.id} onClick={() => selectCustomer(c, "movements")}
                className={`p-3 rounded-xl cursor-pointer border transition-all ${selected?.id === c.id ? "bg-blue-50 border-blue-300" : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"}`}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-[14px] font-black text-white shrink-0">
                    {c.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="text-[13px] font-black text-slate-900 truncate">{c.name}</div>
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

              {/* Balance Card */}
              <div className={`rounded-2xl p-4 mb-5 flex items-center justify-between border-2 ${bal > 0 ? "bg-rose-50 border-rose-200" : bal < 0 ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                <div>
                  <div className={`text-[11px] font-black uppercase tracking-widest mb-1 ${bal > 0 ? "text-rose-500" : bal < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {bal > 0 ? "عليه رصيد" : bal < 0 ? "له رصيد" : "الحساب مسوّى"}
                  </div>
                  <div className={`text-[36px] font-black font-mono leading-none ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {fmt(Math.abs(bal))}
                    <span className="text-[14px] font-bold mr-1">ج.م</span>
                  </div>
                </div>
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-[28px] shrink-0 ${bal > 0 ? "bg-rose-100" : bal < 0 ? "bg-emerald-100" : "bg-slate-100"}`}>
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

              {/* Action Buttons — 2 only */}
              <div className="grid grid-cols-2 gap-2">
                <PermissionGate page="customer_accounts" action="edit">
                  <button onClick={() => { setPayForm({ amount: bal > 0 ? String(bal) : "", method_id: "", notes: "" }); setShowPayment(true); }}
                    className="flex flex-col items-center gap-1.5 rounded-xl bg-blue-600 py-3 text-white hover:bg-blue-700 shadow-md shadow-blue-200 transition-all">
                    <Plus className="h-5 w-5" />
                    <span className="text-[11px] font-black">تحصيل دفعة</span>
                  </button>
                </PermissionGate>
                <PermissionGate page="customer_accounts" action="edit">
                  <button onClick={() => { setAdjForm({ amount: "", direction: "subtract", reason: "" }); setShowAdjust(true); }}
                    className="flex flex-col items-center gap-1.5 rounded-xl bg-white border border-slate-200 py-3 text-slate-700 hover:bg-slate-50 transition-all">
                    <SlidersHorizontal className="h-5 w-5 text-slate-500" />
                    <span className="text-[11px] font-black">تسوية رصيد</span>
                  </button>
                </PermissionGate>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-3 bg-white border-b border-slate-200 shrink-0">
              {[
                { id: "movements", label: "الحركات" },
                { id: "notes",     label: "الملاحظات" },
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
              {activeTab === "movements" ? (
                <MovementsTab
                  party={selected}
                  partyType="customer"
                  onOpenInvoice={setDetailInvoice}
                  onOpenReturn={setDetailReturn}
                />
              ) : (
                <NotesTab
                  notes={notesData}
                  loading={notesLoading}
                  onAdd={handleAddNote}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* ══ Invoice Detail Modal ══════════════════════════════ */}
      {detailInvoice && (
        <Modal onClose={() => { setDetailInvoice(null); setDetailData(null); }} width="640px">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[17px] font-black text-slate-900">تفاصيل الفاتورة</h2>
                <p className="text-[12px] text-slate-400 font-bold font-mono mt-0.5">{detailInvoice.invoice_no || `#${detailInvoice.id}`}</p>
              </div>
              <button onClick={() => { setDetailInvoice(null); setDetailData(null); }} className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:text-zinc-900">
                <X className="h-4 w-4" />
              </button>
            </div>
            {detailLoading ? (
              <div className="flex items-center justify-center h-32 text-slate-400 animate-pulse text-[12px] font-black">
                <RefreshCw className="h-5 w-5 animate-spin ml-2" /> جاري التحميل...
              </div>
            ) : detailData ? (
              <>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-4">
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div><span className="font-black text-slate-400">العميل:</span> <span className="font-bold text-slate-800">{detailData.customer_name || "—"}</span></div>
                    <div><span className="font-black text-slate-400">طريقة الدفع:</span> <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-black ${PTYPE_COLOR[detailData.payment_type] || "text-slate-600 bg-slate-100 border-slate-200"}`}>{arMethod(detailData.payment_type)}</span></div>
                    <div><span className="font-black text-slate-400">التاريخ:</span> <span className="font-bold text-slate-800">{fmtDate(detailData.created_at)}</span></div>
                    <div><span className="font-black text-slate-400">الحالة:</span> <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${detailData.status === "paid" ? "bg-emerald-100 text-emerald-700" : detailData.status === "cancelled" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{detailData.status === "paid" ? "مسدد" : detailData.status === "cancelled" ? "ملغي" : detailData.status || "مكتمل"}</span></div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 overflow-hidden mb-4">
                  <div className="bg-slate-100 grid grid-cols-12 gap-2 px-3 py-2 text-[9px] font-black text-slate-500 uppercase">
                    <div className="col-span-5">الصنف</div><div className="col-span-2 text-center">الكمية</div>
                    <div className="col-span-2 text-center">السعر</div><div className="col-span-1 text-center">خصم</div>
                    <div className="col-span-2 text-left">الإجمالي</div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {detailData.lines?.map((line, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center hover:bg-slate-50">
                        <div className="col-span-5 text-[11px] font-bold text-slate-800 truncate">{line.item_name || line.name}</div>
                        <div className="col-span-2 text-center font-mono text-[11px] text-slate-600">{line.quantity}</div>
                        <div className="col-span-2 text-center font-mono text-[11px] text-slate-600">{fmt(line.unit_price)}</div>
                        <div className="col-span-1 text-center font-mono text-[10px] text-amber-600">{line.discount || "—"}</div>
                        <div className="col-span-2 text-left font-mono text-[11px] font-black text-emerald-700">{fmt(line.line_total)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-900 text-white px-3 py-3">
                    <div className="flex justify-between text-[10px] mb-1"><span className="text-slate-400">الفرعي</span><span className="font-mono">{fmt(detailData.subtotal)}</span></div>
                    {Number(detailData.discount) > 0 && <div className="flex justify-between text-[10px] mb-1"><span className="text-slate-400">الخصم</span><span className="font-mono text-rose-300">- {fmt(detailData.discount)}</span></div>}
                    <div className="flex justify-between text-[13px] font-black border-t border-slate-700 pt-2 mt-2"><span>الإجمالي</span><span className="font-mono">{fmt(detailData.total)} ج.م</span></div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => window.open(`/invoices/${detailInvoice.id}`, "_blank")}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-[12px] font-black text-white hover:bg-blue-700">
                    <ExternalLink className="h-3.5 w-3.5" /> فتح الفاتورة الكاملة
                  </button>
                  <button onClick={() => setDetailInvoice(null)} className="px-5 rounded-xl border border-slate-200 text-[12px] font-black text-slate-600 hover:bg-slate-50">إغلاق</button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
                <FileText className="h-8 w-8 opacity-40" />
                <span className="font-black text-[13px]">لا توجد تفاصيل</span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ══ Return Detail Modal ══════════════════════════════ */}
      {detailReturn && (
        <Modal onClose={() => setDetailReturn(null)} width="480px">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[17px] font-black text-slate-900">تفاصيل المرتجع</h2>
                <p className="text-[12px] text-slate-400 font-bold font-mono mt-0.5">{detailReturn.doc_no || `#${detailReturn.id}`}</p>
              </div>
              <button onClick={() => setDetailReturn(null)} className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 text-[12px]">
              {[["الفاتورة الأصلية", detailReturn.original_invoice_no || "—"], ["المبلغ", `${fmt(detailReturn.total)} ج.م`], ["طريقة الاسترداد", detailReturn.refund_method || "—"], ["السبب", detailReturn.reason || "—"], ["التاريخ", fmtDate(detailReturn.created_at)]].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="font-black text-slate-500">{label}</span>
                  <span className="font-bold text-slate-800">{value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setDetailReturn(null)} className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-[12px] font-black text-slate-600 hover:bg-slate-50">إغلاق</button>
          </div>
        </Modal>
      )}

      {/* ══ Modals ══════════════════════════════════════════ */}

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
                  className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-blue-500 font-bold" placeholder="اسم العميل" />
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">رقم الهاتف الأساسي</label>
                <input value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-blue-500 font-bold" placeholder="01xxxxxxxxx" />
              </div>
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
                      placeholder="رقم هاتف إضافي..." className="flex-1 h-9 rounded-lg border border-slate-200 px-3 text-[12px] outline-none focus:border-blue-500" />
                    {createForm.additionalPhones.length > 1 && (
                      <button type="button" onClick={() => setCreateForm(f => ({ ...f, additionalPhones: f.additionalPhones.filter((_, idx) => idx !== i) }))} className="text-rose-500"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                ))}
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
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">كود العميل</label>
                <input value={createForm.code} onChange={e => setCreateForm(f => ({ ...f, code: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-blue-500 font-bold font-mono" placeholder="CUST-001" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 h-11 rounded-xl bg-blue-600 text-white text-[13px] font-black hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-200">
                {saving ? "جاري الحفظ..." : "حفظ العميل"}
              </button>
              <button onClick={() => setShowCreate(false)} className="h-11 px-6 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-black hover:bg-slate-200">إلغاء</button>
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
            <p className="text-[12px] text-slate-500 font-bold mb-3">العميل: <span className="text-slate-800">{selected.name}</span></p>
            {bal > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 text-[12px] font-bold text-rose-800">
                عليه رصيد <span className="font-mono font-black">{fmt(bal)} ج.م</span>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">المبلغ <span className="text-rose-500">*</span></label>
                <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[16px] font-black font-mono outline-none focus:border-blue-500" placeholder="0.00" autoFocus />
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
                  className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-blue-500" placeholder="مثال: دفعة على الحساب" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handlePayment} disabled={saving || !payForm.amount || !payForm.method_id}
                className="flex-1 h-11 rounded-xl bg-blue-600 text-white text-[13px] font-black hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-200">
                {saving ? "جاري التسجيل..." : "تأكيد التحصيل"}
              </button>
              <button onClick={() => setShowPayment(false)} className="h-11 px-6 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-black hover:bg-slate-200">إلغاء</button>
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
            <p className="text-[12px] text-slate-500 font-bold mb-5">
              العميل: <span className="text-slate-800">{selected.name}</span>
              {" — "}الرصيد الحالي:
              <span className={`font-mono font-black ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-500"}`}> {fmt(Math.abs(bal))} ج.م</span>
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
              <p className="text-[11px] font-black text-amber-800">⚠️ التسوية اليدوية تعدّل رصيد العميل مباشرة بدون تأثير على الخزنة. تُسجَّل في الحركات.</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAdjForm(f => ({ ...f, direction: "subtract" }))}
                  className={`p-3 rounded-xl border-2 text-[12px] font-black transition-all ${adjForm.direction === "subtract" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                  <div className="text-[18px] mb-1">↓</div>تخفيض مديونية العميل
                  <div className="text-[10px] font-bold mt-0.5 opacity-70">(خصم / إعفاء / تصحيح)</div>
                </button>
                <button onClick={() => setAdjForm(f => ({ ...f, direction: "add" }))}
                  className={`p-3 rounded-xl border-2 text-[12px] font-black transition-all ${adjForm.direction === "add" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                  <div className="text-[18px] mb-1">↑</div>رفع مديونية العميل
                  <div className="text-[10px] font-bold mt-0.5 opacity-70">(إضافة دين / تصحيح)</div>
                </button>
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">المبلغ <span className="text-rose-500">*</span></label>
                <input type="number" value={adjForm.amount} onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[16px] font-black font-mono outline-none focus:border-blue-500" placeholder="0.00" autoFocus />
              </div>
              {adjForm.amount > 0 && (() => {
                const newBal = adjForm.direction === "subtract" ? bal - Number(adjForm.amount) : bal + Number(adjForm.amount);
                return (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <p className="text-[11px] font-black text-slate-500 mb-1">الرصيد بعد التسوية:</p>
                    <p className={`text-[18px] font-black font-mono ${newBal > 0 ? "text-rose-600" : newBal < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                      {fmt(Math.abs(newBal))} ج.م
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
                className="flex-1 h-11 rounded-xl bg-slate-800 text-white text-[13px] font-black hover:bg-slate-900 disabled:opacity-50">
                {saving ? "جاري التسوية..." : "تأكيد التسوية وتسجيلها"}
              </button>
              <button onClick={() => setShowAdjust(false)} className="h-11 px-6 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-black hover:bg-slate-200">إلغاء</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Notes Tab (inline, keeps file self-contained) ─────────
function NotesTab({ notes, loading, onAdd }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await onAdd(text);
    setText("");
    setSaving(false);
  };

  if (loading) return <div className="flex h-32 items-center justify-center text-[12px] font-black text-slate-400 animate-pulse">جاري التحميل...</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Add note inline */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="text-[11px] font-black text-slate-500 mb-2">إضافة ملاحظة</div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          className="w-full rounded-xl border border-slate-200 p-3 text-[13px] font-bold outline-none focus:border-amber-400 resize-none"
          placeholder="اكتب ملاحظتك هنا..." />
        <button onClick={submit} disabled={saving || !text.trim()}
          className="mt-2 h-9 px-5 rounded-xl bg-amber-600 text-white text-[12px] font-black hover:bg-amber-700 disabled:opacity-40">
          {saving ? "جاري الحفظ..." : "حفظ الملاحظة"}
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-24 text-slate-300 gap-2">
          <MessageSquare className="h-8 w-8 opacity-40" />
          <span className="font-black text-[13px]">لا توجد ملاحظات</span>
        </div>
      ) : notes.map(n => (
        <div key={n.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">📝 ملاحظة</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold">{n.user_name || "النظام"}</span>
              <span className="text-[10px] text-slate-400">{n.created_at ? new Date(n.created_at).toLocaleDateString("ar-EG") : "—"}</span>
            </div>
          </div>
          <p className="text-[13px] font-bold leading-relaxed text-slate-800">{n.note}</p>
        </div>
      ))}
    </div>
  );
}
