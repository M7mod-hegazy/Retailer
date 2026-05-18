import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building, Search, Plus, X, Phone, SlidersHorizontal,
  MessageSquare, Eye, ExternalLink, RefreshCw, FileText,
  ShoppingBag, CreditCard, RotateCcw, Scale, ChevronDown, ChevronUp, Calendar,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { usePageTour } from "../../hooks/usePageTour";
import PermissionGate from "../../components/ui/PermissionGate";
import AddSupplierModal from "../../components/modals/AddSupplierModal";
import SupplierInfoModal from "../../components/modals/SupplierInfoModal";

const fmt = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

const EVENT_TYPES = {
  purchase:   { icon: ShoppingBag, label: "فاتورة شراء",   color: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-100" },
  payment:    { icon: CreditCard,  label: "سداد دفعة",     color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  return:     { icon: RotateCcw,   label: "مرتجع شراء",    color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-100" },
  adjustment: { icon: Scale,       label: "تسوية يدوية",   color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-100" },
};

function parsePaymentSplits(splits) {
  if (!splits) return [];
  return splits.split("|||").map(s => {
    const idx = s.indexOf(":");
    if (idx === -1) return null;
    const method = s.slice(0, idx).trim();
    const amount = Number(s.slice(idx + 1));
    return { method, amount };
  }).filter(Boolean).filter(s => s.method !== "credit" && s.amount > 0.005);
}

const PMETHOD_LABEL = { cash: "نقداً", credit: "آجل", bank_transfer: "تحويل بنكي", multi: "متعدد", future_due: "استحقاق لاحق" };

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
    </div>
  );
}

function MovementsTab({ party, onOpenPurchase, onOpenReturn }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const arMethod = (key) => PMETHOD_LABEL[key] || key;

  const load = useCallback(async () => {
    if (!party?.id) return;
    setLoading(true);
    try {
      const [docsR, paysR, retsR, adjR] = await Promise.allSettled([
        api.get(`/api/purchases?supplier_id=${party.id}&limit=200`),
        api.get(`/api/payments?party_type=supplier&party_id=${party.id}&limit=200`),
        api.get(`/api/purchases/returns?supplier_id=${party.id}&limit=200`),
        api.get(`/api/suppliers/${party.id}/notes?type=adjustment`),
      ]);

      const items = [];

      (docsR.value?.data?.data || []).forEach(d => {
        const total = Number(d.total || 0);
        const received = Number(d.amount_received || 0);
        const ajalAmount = Math.max(0, total - received);
        let chips = parsePaymentSplits(d.payment_splits);
        if (chips.length === 0 && d.payment_type !== "credit" && received > 0) {
          chips = [{ method: d.payment_type, amount: received }];
        }
        items.push({
          id: `pur-${d.id}`,
          type: "purchase",
          date: new Date(d.created_at),
          ref: d.doc_no || `#${d.id}`,
          chips,
          impactAmount: ajalAmount,
          impactDir: ajalAmount > 0.005 ? "add" : null,
          raw: d,
        });
      });

      // Only standalone payments (not at purchase creation)
      (paysR.value?.data?.data || []).filter(p => !p.invoice_id).forEach(p => {
        items.push({
          id: `pay-${p.id}`,
          type: "payment",
          date: new Date(p.created_at),
          ref: p.doc_no || `PAY-${p.id}`,
          methodLabel: arMethod(p.method || ""),
          description: p.notes || null,
          impactAmount: Number(p.amount || 0),
          impactDir: "subtract",
          raw: p,
        });
      });

      (retsR.value?.data?.data || []).forEach(r => {
        items.push({
          id: `ret-${r.id}`,
          type: "return",
          date: new Date(r.created_at),
          ref: r.doc_no || `RET-${r.id}`,
          description: r.purchase_id ? `مرتجع فاتورة #${r.purchase_id}` : "مرتجع شراء",
          impactAmount: Number(r.total || 0),
          impactDir: "subtract",
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
          impactAmount: Math.abs(amount),
          impactDir: amount > 0 ? "add" : "subtract",
          raw: n,
        });
      });

      items.sort((a, b) => b.date - a.date);

      const currentBal = Number(party.opening_balance || 0);
      let running = currentBal;
      for (const item of items) {
        if (item.impactDir === "add") running -= (item.impactAmount || 0);
        else if (item.impactDir === "subtract") running += (item.impactAmount || 0);
      }
      if (Math.abs(running) > 0.005) {
        items.push({
          id: "opening",
          type: "opening",
          date: null,
          impactAmount: Math.abs(running),
          impactDir: running > 0 ? "add" : "subtract",
        });
      }

      setEvents(items);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  }, [party]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex h-32 items-center justify-center text-[12px] font-black text-slate-400 animate-pulse">جاري التحميل...</div>;
  if (events.length === 0) return (
    <div className="flex flex-col items-center justify-center h-32 text-slate-300 gap-2">
      <FileText className="h-8 w-8 opacity-40" />
      <span className="font-black text-[13px]">لا توجد حركات مسجلة</span>
    </div>
  );

  return (
    <div className="space-y-2">
      {events.map(ev => {
        if (ev.type === "opening") {
          return (
            <div key="opening" className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-slate-200 flex items-center justify-center">
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <span className="text-[11px] font-black text-slate-500">رصيد افتتاحي</span>
              </div>
              <span className={`text-[13px] font-black font-mono ${ev.impactDir === "add" ? "text-rose-500" : "text-emerald-600"}`}>
                {ev.impactDir === "add" ? "+" : "−"} {fmt(ev.impactAmount)} <span className="text-[10px] opacity-60">ج.م</span>
              </span>
            </div>
          );
        }

        const cfg = EVENT_TYPES[ev.type];
        const Icon = cfg.icon;
        const hasImpact = ev.impactDir && ev.impactAmount > 0.005;

        return (
          <div key={ev.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3">
              <div className={`h-9 w-9 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-4 w-4 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>
                  <span className="text-[11px] font-black text-slate-700 font-mono">{ev.ref}</span>
                </div>
                {ev.methodLabel && <div className="text-[10px] text-slate-500 font-bold mt-0.5">{ev.methodLabel}</div>}
                {ev.description && <div className="text-[10px] text-slate-400 mt-0.5 truncate">{ev.description}</div>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-slate-400 font-bold">{fmtDate(ev.date)}</span>
                {ev.type === "purchase" && (
                  <button onClick={() => onOpenPurchase(ev.raw)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors">
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                )}
                {ev.type === "return" && (
                  <button onClick={() => onOpenReturn(ev.raw)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {ev.type === "purchase" && ev.chips?.length > 0 && (
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {ev.chips.map((chip, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                    {arMethod(chip.method)}
                    <span className="font-mono text-slate-500">{fmt(chip.amount)}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Purchase total + cash paid — for آجل purchases */}
            {ev.type === "purchase" && ev.raw?.payment_type === "credit" && (
              <div className="px-4 pb-2 flex items-center gap-4 text-[10px] font-bold text-slate-500">
                <span>إجمالي الفاتورة: <span className="font-mono font-black text-slate-700">{fmt(ev.raw.total)} ج.م</span></span>
                {Number(ev.raw.amount_received) > 0 && (
                  <span>دفع نقداً: <span className="font-mono font-black text-emerald-600">{fmt(ev.raw.amount_received)} ج.م</span></span>
                )}
              </div>
            )}

            {ev.type === "purchase" && ev.raw?.payment_type === "credit" && ev.raw?.id && (
              <div className="px-4 pb-3">
                <InstallmentsBadge debtId={ev.raw.debt_id || ev.raw.id} />
              </div>
            )}

            {hasImpact && (
              <div className={`mx-3 mb-3 rounded-xl px-4 py-2.5 flex items-center justify-between ${ev.impactDir === "add" ? "bg-rose-50 border border-rose-100" : "bg-emerald-50 border border-emerald-100"}`}>
                <span className={`text-[10px] font-black tracking-wide ${ev.impactDir === "add" ? "text-rose-400" : "text-emerald-500"}`}>
                  {ev.impactDir === "add" ? "أُضيف للرصيد" : "خُصم من الرصيد"}
                </span>
                <span className={`text-[18px] font-black font-mono leading-none ${ev.impactDir === "add" ? "text-rose-600" : "text-emerald-600"}`}>
                  {ev.impactDir === "add" ? "+" : "−"}{fmt(ev.impactAmount)}
                  <span className="text-[11px] font-bold mr-1 opacity-60">ج.م</span>
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SupplierAccountsPage() {
  usePageTour('supplier_accounts');
  const [searchParams, setSearchParams] = useSearchParams();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "movements");
  const [notesData, setNotesData] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [netBalance, setNetBalance] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [detailPurchase, setDetailPurchase] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailReturn, setDetailReturn] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);

  const [payForm, setPayForm] = useState({ amount: "", method_id: "", notes: "" });
  const [adjForm, setAdjForm] = useState({ amount: "", direction: "subtract", reason: "" });
  const [saving, setSaving] = useState(false);

  const loadSuppliers = useCallback(async () => {
    try {
      const [res, methodsReq] = await Promise.all([
        api.get("/api/suppliers"),
        api.get("/api/payment-methods"),
      ]);
      setSuppliers(res.data.data || []);
      setPaymentMethods((methodsReq.data.data || []).filter(m => m.id !== 2));
    } catch { toast.error("فشل تحميل الموردين"); }
    finally { setLoading(false); }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const r = await api.get("/api/suppliers/balance-summary");
      setNetBalance(r.data.data?.net_balance ?? null);
    } catch { setNetBalance(null); }
    finally { setSummaryLoading(false); }
  }, []);

  const loadNotes = useCallback(async () => {
    if (!selected) return;
    setNotesLoading(true);
    try {
      const r = await api.get(`/api/suppliers/${selected.id}/notes?type=note`);
      setNotesData(r.data.data || []);
    } catch { setNotesData([]); }
    finally { setNotesLoading(false); }
  }, [selected]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (activeTab === "notes") loadNotes(); }, [activeTab, loadNotes]);

  useEffect(() => {
    const urlId = searchParams.get("id");
    const urlTab = searchParams.get("tab");
    if (urlTab) setActiveTab(urlTab);
    if (urlId && suppliers.length > 0) {
      const found = suppliers.find(s => String(s.id) === String(urlId));
      if (found && (!selected || selected.id !== found.id)) setSelected(found);
      else if (!found) setSearchParams({});
    }
  }, [searchParams, suppliers, selected]);

  const selectSupplier = useCallback((s, tab = "movements") => {
    setSelected(s);
    setActiveTab(tab);
    setNotesData([]);
    setSearchParams({ id: String(s.id), tab });
  }, [setSearchParams]);

  const changeTab = useCallback((tab) => {
    setActiveTab(tab);
    if (selected) setSearchParams({ id: String(selected.id), tab });
  }, [selected, setSearchParams]);

  const refreshSelected = async () => {
    if (!selected) return;
    const r = await api.get(`/api/suppliers/${selected.id}`);
    setSelected(r.data.data);
    loadSuppliers();
    loadSummary();
  };

  useEffect(() => {
    if (!detailPurchase) { setDetailData(null); return; }
    setDetailLoading(true);
    api.get(`/api/purchases/${detailPurchase.id}`)
      .then(r => setDetailData(r.data.data))
      .catch(() => setDetailData(null))
      .finally(() => setDetailLoading(false));
  }, [detailPurchase]);

  const handleSupplierCreated = (supplier) => {
    toast.success("تم إضافة المورد");
    loadSuppliers();
    selectSupplier(supplier, "movements");
  };

  const handlePayment = async () => {
    if (!payForm.amount || !payForm.method_id) return toast.error("أدخل المبلغ ووسيلة الدفع");
    setSaving(true);
    try {
      await api.post("/api/payments", {
        party_type: "supplier",
        party_id: selected.id,
        amount: Number(payForm.amount),
        method_id: Number(payForm.method_id),
        notes: payForm.notes || null,
      });
      toast.success("تم تسجيل السداد");
      setShowPayment(false);
      setPayForm({ amount: "", method_id: "", notes: "" });
      await refreshSelected();
    } catch (e) { toast.error(e.response?.data?.message || "فشل تسجيل السداد"); }
    finally { setSaving(false); }
  };

  const handleAdjust = async () => {
    if (!adjForm.amount || Number(adjForm.amount) <= 0) return toast.error("أدخل مبلغاً صحيحاً");
    setSaving(true);
    try {
      await api.post(`/api/suppliers/${selected.id}/adjust`, adjForm);
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
      await api.post(`/api/suppliers/${selected.id}/notes`, { note: noteText });
      toast.success("تم إضافة الملاحظة");
      loadNotes();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الإضافة"); }
  };

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    const matchesSearch = !q || s.name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.code?.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filter === "creditors") return Number(s.opening_balance) > 0;
    if (filter === "debtors") return Number(s.opening_balance) < 0;
    return true;
  });

  const bal = Number(selected?.opening_balance || 0);

  return (
    <div className="flex flex-1 min-h-0 bg-zinc-50 overflow-hidden" dir="rtl">

      {/* ── Left Panel ── */}
      <div className="w-[360px] bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-lg">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-200">
                <Building className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-[15px] font-black text-slate-900">حسابات الموردين</h1>
            </div>
            <PermissionGate page="supplier_accounts" action="add">
              <button onClick={() => setShowCreate(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-orange-600 px-3 text-[11px] font-black text-white hover:bg-orange-700 transition-colors shadow-md shadow-orange-200">
                <Plus className="h-3.5 w-3.5" /> مورد جديد
              </button>
            </PermissionGate>
          </div>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم، الهاتف، الكود..."
              className="w-full h-10 rounded-xl border border-slate-200 pr-9 pl-3 text-[12px] font-bold outline-none focus:border-orange-500 bg-white" />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {[{ id: "all", label: "الكل" }, { id: "creditors", label: "ندين لهم" }, { id: "debtors", label: "يدينون لنا" }].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`flex-1 py-1.5 text-[11px] font-black rounded-md transition-all ${filter === f.id ? "bg-white text-orange-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Net Balance Summary ── */}
        <div className="mx-2 mt-2 mb-1 rounded-xl bg-orange-50 border border-orange-100 p-3">
          <div className="text-[10px] font-black text-slate-500 mb-0.5">إجمالي المديونية</div>
          <div className={`text-[20px] font-black font-mono ${netBalance > 0 ? "text-rose-600" : netBalance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
            {summaryLoading ? "..." : fmt(netBalance ?? 0)}
            <span className="text-[11px] font-bold text-slate-400 mr-1">ج.م</span>
          </div>
          {netBalance > 0 && <div className="text-[9px] font-black text-rose-500 mt-0.5">مستحقات للموردين</div>}
          {netBalance < 0 && <div className="text-[9px] font-black text-emerald-600 mt-0.5">رصيد لصالحنا</div>}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-6 text-center text-[12px] text-slate-400 animate-pulse">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Building className="h-10 w-10 text-slate-200 mx-auto mb-2" />
              <p className="text-[12px] font-black text-slate-400">لا يوجد موردين</p>
            </div>
          ) : filtered.map(s => {
            const b = Number(s.opening_balance || 0);
            return (
              <div key={s.id} onClick={() => selectSupplier(s, "movements")}
                className={`p-3 rounded-xl cursor-pointer border transition-all ${selected?.id === s.id ? "bg-orange-50 border-orange-300" : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"}`}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[14px] font-black text-white shrink-0">
                    {s.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-black text-slate-900 truncate mb-0.5">{s.name}</div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] text-slate-400 font-mono truncate">{s.phone || s.code || "—"}</div>
                      <div className="flex items-center gap-1 shrink-0">
                        {b > 0 && <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">له مستحق</span>}
                        {b < 0 && <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">عليه مستحق</span>}
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
            <Building className="h-20 w-20 opacity-30" />
            <p className="text-[15px] font-black">اختر مورداً من القائمة</p>
          </div>
        ) : (
          <>
            <div className="bg-white border-b border-slate-200 p-6 shrink-0">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-[26px] font-black text-white shadow-lg shadow-orange-200">
                    {selected.name?.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-[20px] font-black text-slate-900">{selected.name}</h2>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      {selected.phone && <span className="flex items-center gap-1.5 text-[12px] text-slate-500 font-bold"><Phone className="h-3.5 w-3.5" /> {selected.phone}</span>}
                      {(() => { try { return JSON.parse(selected.additional_phones || "[]"); } catch { return []; } })().map((p, i) => (
                        <span key={i} className="flex items-center gap-1.5 text-[12px] text-slate-400 font-mono"><Phone className="h-3 w-3" /> {p}</span>
                      ))}
                      {selected.code && <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">{selected.code}</span>}
                    </div>
                    {(() => { try { return JSON.parse(selected.addresses || "[]"); } catch { return []; } })().map((a, i) => (
                      <p key={i} className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-1"><Eye className="h-3 w-3 shrink-0" /> {a}</p>
                    ))}
                    {selected.notes && (
                      <p className="text-[11px] text-slate-500 font-medium mt-2 leading-relaxed">{selected.notes}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg px-3 py-1.5 transition-colors shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> تعديل
                </button>
              </div>

              <div className={`rounded-2xl p-4 mb-5 flex items-center justify-between border-2 ${bal > 0 ? "bg-rose-50 border-rose-200" : bal < 0 ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                <div>
                  <div className={`text-[11px] font-black uppercase tracking-widest mb-1 ${bal > 0 ? "text-rose-500" : bal < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {bal > 0 ? "له مستحق" : bal < 0 ? "عليه مستحق" : "الحساب مسوّى"}
                  </div>
                  <div className={`text-[36px] font-black font-mono leading-none ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {fmt(Math.abs(bal))}<span className="text-[14px] font-bold mr-1">ج.م</span>
                  </div>
                </div>
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-[28px] shrink-0 ${bal > 0 ? "bg-rose-100" : bal < 0 ? "bg-emerald-100" : "bg-slate-100"}`}>
                  {bal > 0 ? "🔴" : bal < 0 ? "🟢" : "✅"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <PermissionGate page="supplier_accounts" action="edit">
                  <button onClick={() => { setPayForm({ amount: bal > 0 ? String(bal) : "", method_id: "", notes: "" }); setShowPayment(true); }}
                    className="flex flex-col items-center gap-1.5 rounded-xl bg-orange-600 py-3 text-white hover:bg-orange-700 shadow-md shadow-orange-200 transition-all">
                    <Plus className="h-5 w-5" />
                    <span className="text-[11px] font-black">سداد دفعة</span>
                  </button>
                </PermissionGate>
                <PermissionGate page="supplier_accounts" action="edit">
                  <button onClick={() => { setAdjForm({ amount: "", direction: "subtract", reason: "" }); setShowAdjust(true); }}
                    className="flex flex-col items-center gap-1.5 rounded-xl bg-white border border-slate-200 py-3 text-slate-700 hover:bg-slate-50 transition-all">
                    <SlidersHorizontal className="h-5 w-5 text-slate-500" />
                    <span className="text-[11px] font-black">تسوية رصيد</span>
                  </button>
                </PermissionGate>
              </div>
            </div>

            <div className="flex gap-1 px-6 pt-3 bg-white border-b border-slate-200 shrink-0">
              {[{ id: "movements", label: "الحركات" }, { id: "notes", label: "الملاحظات" }].map(t => (
                <button key={t.id} onClick={() => changeTab(t.id)}
                  className={`pb-3 px-3 text-[13px] font-black transition-colors relative ${activeTab === t.id ? "text-orange-600" : "text-slate-500 hover:text-slate-800"}`}>
                  {t.label}
                  {activeTab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 rounded-t-full" />}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-6 bg-slate-50">
              {activeTab === "movements" ? (
                <MovementsTab
                  party={selected}
                  onOpenPurchase={setDetailPurchase}
                  onOpenReturn={setDetailReturn}
                />
              ) : (
                <NotesTab notes={notesData} loading={notesLoading} onAdd={handleAddNote} />
              )}
            </div>
          </>
        )}
      </div>

      {/* ══ Purchase Detail Modal ══════════════════════════════ */}
      {detailPurchase && (
        <Modal onClose={() => { setDetailPurchase(null); setDetailData(null); }} width="640px">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[17px] font-black text-slate-900">تفاصيل فاتورة الشراء</h2>
                <p className="text-[12px] text-slate-400 font-bold font-mono mt-0.5">{detailPurchase.doc_no || `#${detailPurchase.id}`}</p>
              </div>
              <button onClick={() => { setDetailPurchase(null); setDetailData(null); }} className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            {detailLoading ? (
              <div className="flex items-center justify-center h-32 text-slate-400 animate-pulse text-[12px] font-black">
                <RefreshCw className="h-5 w-5 animate-spin ml-2" /> جاري التحميل...
              </div>
            ) : detailData ? (
              <>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-4">
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div><span className="font-black text-slate-400">المورد:</span> <span className="font-bold text-slate-800">{detailData.supplier_name || "—"}</span></div>
                    <div><span className="font-black text-slate-400">التاريخ:</span> <span className="font-bold text-slate-800">{fmtDate(detailData.created_at)}</span></div>
                    <div><span className="font-black text-slate-400">الإجمالي:</span> <span className="font-black font-mono text-slate-900">{fmt(detailData.total)} ج.م</span></div>
                    <div><span className="font-black text-slate-400">الحالة:</span> <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${detailData.status === "received" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{detailData.status || "—"}</span></div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => window.open(`/purchases/${detailPurchase.id}`, "_blank")}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 text-[12px] font-black text-white hover:bg-orange-700">
                    <ExternalLink className="h-3.5 w-3.5" /> فتح فاتورة الشراء
                  </button>
                  <button onClick={() => setDetailPurchase(null)} className="px-5 rounded-xl border border-slate-200 text-[12px] font-black text-slate-600 hover:bg-slate-50">إغلاق</button>
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
              {[["المبلغ", `${fmt(detailReturn.total)} ج.م`], ["طريقة التسوية", detailReturn.settlement_type || "—"], ["السبب", detailReturn.reason || "—"], ["التاريخ", fmtDate(detailReturn.created_at)]].map(([label, value]) => (
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

      <AddSupplierModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleSupplierCreated}
      />

      <SupplierInfoModal
        open={showEdit}
        supplierId={selected?.id}
        onClose={() => setShowEdit(false)}
        onUpdated={(updated) => {
          setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s));
          setSelected(updated);
        }}
      />

      {/* Payment Modal */}
      {showPayment && selected && (
        <Modal onClose={() => setShowPayment(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[17px] font-black text-slate-900">سداد دفعة للمورد</h2>
              <button onClick={() => setShowPayment(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <p className="text-[12px] text-slate-500 font-bold mb-3">المورد: <span className="text-slate-800">{selected.name}</span></p>
            {bal > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 text-[12px] font-bold text-rose-800">
                له مستحق <span className="font-mono font-black">{fmt(bal)} ج.م</span>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">المبلغ <span className="text-rose-500">*</span></label>
                <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[16px] font-black font-mono outline-none focus:border-orange-500" placeholder="0.00" autoFocus />
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">وسيلة الدفع <span className="text-rose-500">*</span></label>
                <select value={payForm.method_id} onChange={e => setPayForm(f => ({ ...f, method_id: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[13px] font-bold bg-white outline-none focus:border-orange-500">
                  <option value="">-- اختر الوسيلة --</option>
                  {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">ملاحظات (اختياري)</label>
                <input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-orange-500" placeholder="مثال: سداد فاتورة" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handlePayment} disabled={saving || !payForm.amount || !payForm.method_id}
                className="flex-1 h-11 rounded-xl bg-orange-600 text-white text-[13px] font-black hover:bg-orange-700 disabled:opacity-50 shadow-md shadow-orange-200">
                {saving ? "جاري التسجيل..." : "تأكيد السداد"}
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
              المورد: <span className="text-slate-800">{selected.name}</span>
              {" — "}الرصيد الحالي:
              <span className={`font-mono font-black ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-500"}`}> {fmt(Math.abs(bal))} ج.م</span>
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
              <p className="text-[11px] font-black text-amber-800">⚠️ التسوية اليدوية تعدّل رصيد المورد مباشرة بدون تأثير على الخزنة. تُسجَّل في الحركات.</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAdjForm(f => ({ ...f, direction: "subtract" }))}
                  className={`p-3 rounded-xl border-2 text-[12px] font-black transition-all ${adjForm.direction === "subtract" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>
                  <div className="text-[18px] mb-1">↓</div>تخفيض المستحق للمورد
                  <div className="text-[10px] font-bold mt-0.5 opacity-70">(خصم / تصحيح)</div>
                </button>
                <button onClick={() => setAdjForm(f => ({ ...f, direction: "add" }))}
                  className={`p-3 rounded-xl border-2 text-[12px] font-black transition-all ${adjForm.direction === "add" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-500"}`}>
                  <div className="text-[18px] mb-1">↑</div>رفع المستحق للمورد
                  <div className="text-[10px] font-bold mt-0.5 opacity-70">(إضافة مستحق / تصحيح)</div>
                </button>
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">المبلغ <span className="text-rose-500">*</span></label>
                <input type="number" value={adjForm.amount} onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[16px] font-black font-mono outline-none focus:border-orange-500" placeholder="0.00" autoFocus />
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">سبب التسوية</label>
                <input value={adjForm.reason} onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-orange-500"
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
