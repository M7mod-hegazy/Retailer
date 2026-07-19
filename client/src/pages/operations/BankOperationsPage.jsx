import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Landmark, Plus, Minus, RefreshCw, X, List, ArrowLeftRight, AlertCircle, Printer, 
  ArrowUpRight, ArrowDownLeft, Coins, Check, Sparkles, Activity, ArrowRight, ArrowLeft 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import toast from "react-hot-toast";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import BankStatementTemplate from "../../components/print/templates/BankStatementTemplate";
import PermissionGate from "../../components/ui/PermissionGate";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { formatNumber } from "../../utils/currency";

const fmt = (n) => formatNumber(n);

// Dynamic credit card aesthetic gradient selector based on code/index
const getCardGradient = (index) => {
  const gradients = [
    "linear-gradient(135deg, var(--primary-glow) 0%, transparent 80%)",
    "linear-gradient(135deg, var(--info-light) 0%, transparent 80%)",
    "linear-gradient(135deg, var(--accent-soft) 0%, transparent 80%)"
  ];
  return gradients[index % gradients.length];
};

const getDistributionColor = (index) => {
  const colors = [
    "var(--primary)",
    "var(--info-text)",
    "var(--primary-600)",
    "var(--text-accent)"
  ];
  return colors[index % colors.length];
};

function BankModal({ bank, mode, onClose, onDone }) {
  const handleKeyDown = useFieldNavigation();
  const amountRef = useRef(null);
  const referenceRef = useRef(null);
  const notesRef = useRef(null);
  const submitBtnRef = useRef(null);
  const [form, setForm] = useState({ amount: "", reference: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.amount) return;
    setSaving(true);
    try {
      await api.post(`/api/banks/${bank.id}/${mode}`, { 
        amount: Number(form.amount), 
        reference: form.reference, 
        notes: form.notes 
      });
      toast.success(mode === "deposit" ? "تم تسجيل الإيداع بنجاح" : "تم تسجيل السحب بنجاح");
      onDone();
    } catch (e) { 
      toast.error(e.response?.data?.message || "حدث خطأ غير متوقع"); 
    } finally { 
      setSaving(false); 
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-[400px] rounded-[24px] p-1.5 bg-border-normal border border-slate-350 shadow-modal overflow-hidden"
      >
        <div className="rounded-[calc(24px-0.375rem)] p-6 bg-bg-surface flex flex-col gap-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-black text-text-primary">
                {mode === "deposit" ? "إيداع نقدي مباشر" : "سحب نقدي مباشر"}
              </h2>
              <p className="text-[10px] text-slate-450 font-bold mt-0.5">حساب: {bank.name}</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-bg-overlay text-text-muted hover:text-text-primary transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-455 block mb-1">المبلغ المطلوب (ج.م) *</label>
              <input 
                ref={amountRef} 
                type="number" 
                value={form.amount} 
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                autoFocus 
                onKeyDown={(e) => handleKeyDown(e, { nextRef: referenceRef })} 
                className="w-full h-11 rounded-xl border border-slate-250 bg-bg-overlay px-4 text-center font-mono text-base font-black text-text-primary outline-none focus:border-indigo-650 transition-colors"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-455 block mb-1">رقم الإشعار / المستند</label>
              <input 
                ref={referenceRef} 
                value={form.reference} 
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                onKeyDown={(e) => handleKeyDown(e, { nextRef: notesRef, prevRef: amountRef })} 
                className="w-full h-10 rounded-xl border border-slate-250 bg-bg-overlay px-4 text-2sm text-text-primary outline-none focus:border-indigo-650 transition-colors" 
                placeholder="تحويل بنكي / شيك / إشعار..." 
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-455 block mb-1">ملاحظات توضيحية</label>
              <input 
                ref={notesRef} 
                value={form.notes} 
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                onKeyDown={(e) => handleKeyDown(e, { nextRef: submitBtnRef, prevRef: referenceRef })} 
                className="w-full h-10 rounded-xl border border-slate-250 bg-bg-overlay px-4 text-2sm text-text-primary outline-none focus:border-indigo-650 transition-colors"
                placeholder="بيان تفصيلي للحركة..."
              />
            </div>

            <button 
              ref={submitBtnRef} 
              onClick={submit} 
              disabled={!form.amount || saving} 
              onKeyDown={(e) => handleKeyDown(e, { nextRef: amountRef, onEnter: submit })}
              className={`w-full rounded-xl py-3 mt-2 text-2sm font-black text-white transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-40 shadow-sm ${
                mode === "deposit" 
                  ? "bg-teal-600 hover:bg-teal-700" 
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              <span>{saving ? "جاري الحفظ..." : "تأكيد وتسجيل الحركة"}</span>
              <div className="h-5 w-5 rounded-full bg-bg-surface/20 flex items-center justify-center">
                <Check className="h-3 text-white" />
              </div>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const SOURCE_LABELS = {
  pos_sale: "مبيعات",
  ajal: "تحصيل",
  purchase: "مشتريات",
  transfer: "تحويل",
  opening: "افتتاحي",
  revenue: "إيراد",
  expense: "مصروف",
  manual: "يدوي",
};

function StatementPanel({ bank, onClose }) {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const handleKeyDown = useFieldNavigation();
  const fromRef = useRef(null);
  const toRef = useRef(null);
  const searchBtnRef = useRef(null);
  const [printOpen, setPrintOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const r = await api.get(`/api/banks/${bank.id}/transactions?${params}`);
      setTxs(r.data.data || []);
    } catch { 
      setTxs([]); 
    } finally { 
      setLoading(false); 
    }
  }, [bank.id, from, to]);

  useEffect(() => { load(); }, [load]);

  async function toggleReconcile(id, reconciled) {
    try {
      await api.patch(`/api/banks/transactions/${id}/reconcile`, { reconciled: reconciled ? 0 : 1 });
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ في التسوية");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-start">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-955/40 backdrop-blur-xs" 
      />
      
      {/* Drawer */}
      <motion.div 
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative w-full max-w-[500px] h-full bg-bg-overlay border-r border-slate-205 shadow-modal flex flex-col z-10"
        dir="rtl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-normal bg-slate-150 shrink-0">
          <div>
            <h2 className="text-sm font-black text-text-primary">كشف حركات الحساب</h2>
            <p className="text-[10px] text-slate-450 mt-0.5">{bank.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPrintOpen(true)} 
              disabled={!txs.length}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[10px] font-black text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" /> طباعة
            </button>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-border-normal text-text-muted hover:text-text-secondary transition-colors">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="flex items-end gap-3 p-4 border-b border-border-normal bg-bg-overlay shrink-0">
          <div className="flex-1">
            <label className="text-[9px] font-black text-text-muted block mb-1">من تاريخ</label>
            <input 
              ref={fromRef} 
              type="date" 
              value={from} 
              onChange={e => setFrom(e.target.value)} 
              onKeyDown={(e) => handleKeyDown(e, { nextRef: toRef })} 
              className="h-9 w-full rounded-lg border border-border-strong bg-border-normal px-3 text-2sm text-text-primary outline-none focus:border-slate-450 transition-colors" 
            />
          </div>
          <div className="flex-1">
            <label className="text-[9px] font-black text-text-muted block mb-1">إلى تاريخ</label>
            <input 
              ref={toRef} 
              type="date" 
              value={to} 
              onChange={e => setTo(e.target.value)} 
              onKeyDown={(e) => handleKeyDown(e, { nextRef: searchBtnRef, prevRef: fromRef })} 
              className="h-9 w-full rounded-lg border border-border-strong bg-border-normal px-3 text-2sm text-text-primary outline-none focus:border-slate-450 transition-colors" 
            />
          </div>
          <button 
            ref={searchBtnRef} 
            onClick={load} 
            onKeyDown={(e) => handleKeyDown(e, { nextRef: fromRef, onEnter: load })} 
            className="h-9 rounded-lg bg-border-normal text-text-primary hover:bg-slate-350 px-4 text-2sm font-black border border-slate-350 transition-colors shrink-0"
          >
            بحث
          </button>
        </div>

        {/* Live Balance Summary */}
        <div className="px-5 py-3 border-b border-border-normal bg-bg-overlay/50 flex justify-between items-center shrink-0">
          <span className="text-[11px] font-black text-text-muted">الرصيد الدفتري الحالي</span>
          <span className="text-sm font-mono font-black text-indigo-650">{fmt(bank.balance)} ج.م</span>
        </div>

        {/* Activity Stream */}
        <div className="flex-1 overflow-y-auto divide-y divide-border-normal bg-bg-overlay">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-text-muted font-black animate-pulse">جاري تحميل الحركات...</div>
          ) : txs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-350 gap-2 p-6">
              <Activity className="h-8 w-8" />
              <span className="text-xs font-black">لا توجد حركات في هذا الحساب</span>
            </div>
          ) : (
            txs.map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-slate-150/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                    tx.type === "deposit" ? "bg-teal-50 text-teal-600" : "bg-rose-50 text-rose-600"
                  }`}>
                    {tx.type === "deposit" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-text-primary">
                        {tx.type === "deposit" ? "إيداع" : "سحب"}
                      </span>
                      <span className="rounded bg-border-normal px-1 py-0.2 text-[9px] font-bold text-text-secondary">
                        {SOURCE_LABELS[tx.source] || "يدوي"}
                      </span>
                    </div>
                    {tx.reference && <div className="text-[10px] text-slate-450 font-mono mt-0.5">مرجع: {tx.reference}</div>}
                    {tx.notes && <div className="text-[10px] text-text-secondary mt-0.5">{tx.notes}</div>}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-left">
                    <div className={`text-xs font-mono font-black ${
                      tx.type === "deposit" ? "text-teal-600" : "text-rose-600"
                    }`}>
                      {tx.type === "deposit" ? "+" : "-"}{fmt(tx.amount)}
                    </div>
                    <div className="text-[9px] text-text-muted mt-0.5">{tx.created_at?.slice(0, 10)}</div>
                  </div>

                  <button
                    onClick={() => toggleReconcile(tx.id, tx.reconciled)}
                    className={`h-6 w-6 rounded flex items-center justify-center text-xs transition-colors shrink-0 ${
                      tx.reconciled ? "bg-teal-100 text-teal-600 font-black" : "bg-border-normal text-text-muted hover:bg-slate-250"
                    }`}
                    title={tx.reconciled ? "تم التسوية" : "بانتظار التسوية"}
                  >
                    {tx.reconciled ? <Check className="h-3.5 w-3.5" /> : "○"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
      {printOpen && (
        <PrintPreviewModal
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          docType="bank_statement"
          renderContent={(settings) => (
            <BankStatementTemplate bank={bank} transactions={txs} from={from} to={to} settings={settings} />
          )}
        />
      )}
    </div>
  );
}

export default function BankOperationsPage() {
  usePageTour('bank_operations');
  const handleKeyDown = useFieldNavigation();
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modal, setModal] = useState(null); // { bank, mode: 'deposit'|'withdraw' }
  const [statement, setStatement] = useState(null);

  const [newBankOpen, setNewBankOpen] = useState(false);
  const [newBank, setNewBank] = useState({ name: "", code: "", balance: "", alert_threshold: "" });
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({ from_id: "", to_id: "", amount: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const bankNameRef = useRef(null);
  const bankCodeRef = useRef(null);
  const bankBalanceRef = useRef(null);
  const bankAlertRef = useRef(null);
  const bankSaveRef = useRef(null);
  const transferFromRef = useRef(null);
  const transferToRef = useRef(null);
  const transferAmountRef = useRef(null);
  const transferNotesRef = useRef(null);
  const transferSubmitRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/api/banks");
      setBanks(r.data.data || []);
    } catch { 
      setBanks([]); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createBank() {
    if (!newBank.name) return;
    setSaving(true);
    try {
      await api.post("/api/banks", { 
        name: newBank.name, 
        code: newBank.code, 
        balance: Number(newBank.balance || 0), 
        alert_threshold: Number(newBank.alert_threshold || 0) 
      });
      toast.success("تم إضافة الحساب البنكي بنجاح");
      setNewBankOpen(false); 
      setNewBank({ name: "", code: "", balance: "", alert_threshold: "" }); 
      load();
    } catch (e) { 
      toast.error(e.response?.data?.message || "خطأ أثناء الحفظ"); 
    } finally { 
      setSaving(false); 
    }
  }

  async function handleTransfer() {
    if (Number(transferForm.amount) <= 0) return toast.error("المبلغ غير صحيح");
    const fromBank = banks.find((bank) => bank.id === Number(transferForm.from_id));
    if (fromBank && Number(transferForm.amount) > Number(fromBank.balance || 0)) {
      return toast.error("رصيد الحساب المصدر غير كافٍ");
    }
    setSaving(true);
    try {
      await api.post("/api/banks/transfer", {
        from_id: Number(transferForm.from_id),
        to_id: Number(transferForm.to_id),
        amount: Number(transferForm.amount),
        notes: transferForm.notes,
      });
      toast.success("تم التحويل بنجاح");
      setTransferOpen(false);
      setTransferForm({ from_id: "", to_id: "", amount: "", notes: "" });
      load();
    } catch (e) { 
      toast.error(e.response?.data?.message || "خطأ في عملية التحويل البيني"); 
    } finally { 
      setSaving(false); 
    }
  }

  async function recompute(bank) {
    try {
      await api.post(`/api/banks/${bank.id}/recompute`);
      toast.success("تمت إعادة احتساب الرصيد وتحديث حركات الدفاتر");
      load();
    } catch (e) { 
      toast.error(e.response?.data?.message || "خطأ في إعادة التدقيق"); 
    }
  }

  // General Liquidity Statistics
  const totalBalance = banks.reduce((sum, b) => sum + Number(b.balance || 0), 0);
  const lowBalanceCount = banks.filter(
    (b) => Number(b.alert_threshold || 0) > 0 && Number(b.balance || 0) < Number(b.alert_threshold || 0)
  ).length;

  return (
    <div className="flex flex-col h-full bg-bg-overlay relative overflow-hidden" dir="rtl">
      
      {/* Decorative Top Ambient Aura */}
      <div className="absolute top-0 right-0 left-0 h-48 bg-gradient-to-b from-indigo-50/10 to-transparent pointer-events-none z-0" />

      {/* Top Header Section */}
      <header className="bg-bg-surface border-b border-border-normal px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/50 shadow-sm">
            <Landmark className="h-5.5 w-5.5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-text-primary tracking-tight">إدارة الحسابات البنكية</h1>
            <p className="text-[10px] font-bold text-text-muted mt-0.5 font-sans">مراقبة الأرصدة المصرفية، السحب والإيداع والتسويات للدفاتر</p>
          </div>
        </div>

        {/* Header command buttons */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button 
            onClick={load} 
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-overlay active:scale-95 transition-all shadow-sm shrink-0"
            title="تحديث البيانات"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          
          <PermissionGate page="bank_operations" action="edit">
            <button 
              data-help="transfer-btn" 
              onClick={() => setTransferOpen(true)}
              className="flex h-9 items-center gap-2 rounded-xl bg-border-normal border border-slate-350 px-4 text-2sm font-black text-slate-850 hover:bg-border-strong transition-colors shadow-sm active:scale-98"
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-slate-650" /> تحويل بين حسابات
            </button>
          </PermissionGate>

          <PermissionGate page="bank_operations" action="add">
            <button 
              data-help="add-button" 
              onClick={() => setNewBankOpen(true)} 
              className="flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-2sm font-black text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/5 active:scale-98"
            >
              <Plus className="h-4 w-4" /> إضافة حساب جديد
            </button>
          </PermissionGate>
        </div>
      </header>

      {/* Main Split Bento Layout Panel (Fills the blank spaces completely) */}
      <div className="flex-1 overflow-auto p-6 md:p-8 relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* RIGHT AREA (xl:col-span-8): Active Accounts Deck (Grid of double-bezel cards) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-text-muted uppercase tracking-wider font-sans">بطاقات الحسابات المصرفية المتاحة</span>
            <span className="text-[9px] font-black font-mono bg-border-normal text-text-secondary rounded px-2 py-0.5">
              COUNT: {banks.length}
            </span>
          </div>

          {loading && banks.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-text-muted font-black animate-pulse">جاري تحميل الحسابات البنكية...</div>
          ) : banks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-slate-350 gap-2 border border-dashed border-border-strong rounded-3xl bg-bg-surface/50">
              <Landmark className="h-8 w-8" />
              <span className="text-xs font-black">لا توجد حسابات بنكية مضافة بعد</span>
            </div>
          ) : (
            <div 
              className="grid grid-cols-1 md:grid-cols-2 gap-6" 
              data-help="main-table"
            >
              {banks.map((bank, index) => {
                const hasAlert = Number(bank.alert_threshold || 0) > 0 && Number(bank.balance || 0) < Number(bank.alert_threshold || 0);
                return (
                  <div 
                    key={bank.id}
                    className="rounded-[28px] p-1.5 bg-bg-overlay border border-border-normal hover:border-border-strong shadow-sm hover:shadow-md transition-all duration-300 flex flex-col"
                  >
                    {/* Inner Card (Double Bezel Concentric structure) */}
                    <div className={`rounded-[calc(28px-0.375rem)] p-5 flex flex-col justify-between h-[215px] relative overflow-hidden group ${
                      hasAlert ? "bg-amber-50/15" : "bg-bg-surface"
                    }`}>
                      {/* Visual Card Accent Gradient Overlay */}
                      <div 
                        className="absolute inset-0 opacity-10 pointer-events-none" 
                        style={{
                          background: getCardGradient(index)
                        }}
                      />

                      <div className="relative z-10 flex flex-col gap-3">
                        {/* Card Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xs font-black text-text-primary tracking-tight leading-tight">
                              {bank.name}
                            </h3>
                            {bank.code && (
                              <span className="inline-block text-[9px] font-mono font-bold tracking-wider px-1.5 py-0.2 rounded bg-border-normal text-text-secondary mt-1">
                                كود: {bank.code}
                              </span>
                            )}
                          </div>
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center border shrink-0 ${
                            hasAlert ? "bg-amber-100 border-amber-250 text-amber-700" : "bg-bg-overlay border-border-normal text-text-secondary"
                          }`}>
                            <Landmark className="h-4 w-4" />
                          </div>
                        </div>

                        {/* Card Balance */}
                        <div className="mt-1">
                          <span className="text-[9px] font-black text-text-muted block mb-0.5">الرصيد الدفتري الجاري</span>
                          <div className={`text-2xl font-mono font-black tracking-tight leading-none ${
                            Number(bank.balance) >= 0 ? "text-text-primary" : "text-rose-600"
                          }`}>
                            {fmt(bank.balance)} <span className="text-2sm font-sans font-bold text-slate-450 mr-0.5">ج.م</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom actions */}
                      <div className="mt-auto pt-4 border-t border-slate-150 flex items-center justify-between gap-3 relative z-10">
                        <div className="flex items-center gap-1.5 flex-1">
                          <PermissionGate page="bank_operations" action="edit">
                            <button 
                              data-help="deposit-btn" 
                              onClick={() => setModal({ bank, mode: "deposit" })}
                              className="flex-1 flex items-center justify-center gap-1 h-8.5 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-650 border border-teal-200/30 text-[10px] font-black transition-colors active:scale-95"
                            >
                              <Plus className="h-3 w-3" /> إيداع
                            </button>
                          </PermissionGate>
                          
                          <PermissionGate page="bank_operations" action="edit">
                            <button 
                              data-help="withdraw-btn" 
                              onClick={() => setModal({ bank, mode: "withdraw" })}
                              className="flex-1 flex items-center justify-center gap-1 h-8.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-650 border border-rose-200/30 text-[10px] font-black transition-colors active:scale-95"
                            >
                              <Minus className="h-3 w-3" /> سحب
                            </button>
                          </PermissionGate>
                        </div>

                        <div className="flex gap-1.5 shrink-0">
                          <button 
                            onClick={() => setStatement(bank)} 
                            title="كشف حركة الحساب"
                            className="h-8.5 w-8.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-650 border border-indigo-100/30 flex items-center justify-center transition-colors active:scale-90"
                          >
                            <List className="h-4 w-4" />
                          </button>
                          
                          <PermissionGate page="bank_operations" action="edit">
                            <button 
                              onClick={() => recompute(bank)} 
                              title="إعادة تدقيق وتحديث الرصيد"
                              className="h-8.5 w-8.5 rounded-full bg-border-normal hover:bg-slate-350 text-text-secondary flex items-center justify-center transition-colors active:scale-90"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                          </PermissionGate>
                        </div>
                      </div>

                      {/* Low balance text banner inside card */}
                      {hasAlert && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 text-[8.5px] font-black text-amber-700 bg-amber-100 border border-amber-250/50 rounded-full px-2 py-0.5">
                          <AlertCircle className="h-3 w-3 text-amber-600" /> رصيد منخفض
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LEFT AREA (xl:col-span-4): General Wealth, Insights & Distribution (Resolves empty screen space) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <span className="text-[11px] font-black text-text-muted uppercase tracking-wider font-sans">توزيع السيولة والتحليل المالي</span>
          
          {/* Liquidity Distribution Panel */}
          <div className="bg-bg-surface border border-border-normal rounded-[28px] p-6 shadow-sm flex flex-col gap-5">
            <div>
              <span className="text-[9px] font-black text-text-muted uppercase block mb-1">إجمالي الأرصدة البنكية المتاحة</span>
              <div className="text-3xl font-mono font-black text-text-primary tracking-tighter leading-none">
                {fmt(totalBalance)} <span className="text-xs font-sans font-bold text-slate-450 mr-0.5">ج.م</span>
              </div>
            </div>

            {/* Distribution chart bar */}
            {banks.length > 0 && totalBalance > 0 && (
              <div className="space-y-4">
                <div className="flex h-3 rounded-full overflow-hidden bg-border-normal">
                  {banks.map((b, i) => {
                    const pct = (Number(b.balance || 0) / totalBalance) * 100;
                    if (pct <= 0) return null;
                    return (
                      <div 
                        key={b.id} 
                        style={{ 
                          width: `${pct}%`, 
                          backgroundColor: getDistributionColor(i)
                        }}
                        className="h-full transition-all first:rounded-r-full last:rounded-l-full"
                        title={`${b.name}: ${pct.toFixed(1)}%`}
                      />
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2.5">
                  {banks.map((b, i) => {
                    const pct = totalBalance > 0 ? (Number(b.balance || 0) / totalBalance) * 100 : 0;
                    return (
                      <div key={b.id} className="flex items-center justify-between text-2sm">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2.5 h-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: getDistributionColor(i) }}
                          />
                          <span className="font-bold text-text-primary truncate max-w-[150px]">{b.name}</span>
                        </div>
                        <div className="text-left font-mono font-bold text-text-secondary">
                          {pct.toFixed(1)}% <span className="text-[10px] text-text-muted">({fmt(b.balance)} ج.م)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {banks.length > 0 && totalBalance === 0 && (
              <div className="text-center py-4 text-xs font-bold text-text-muted">
                لا توجد سيولة نقدية موزعة حالياً
              </div>
            )}
          </div>

          {/* Quick Info Box */}
          <div className="bg-bg-overlay border border-border-normal rounded-[28px] p-6 text-2sm text-text-secondary flex flex-col gap-3">
            <h3 className="font-black text-text-primary text-xs flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-text-secondary" /> ملخص حالة الرصيد
            </h3>
            {lowBalanceCount > 0 ? (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-250/50 p-3 rounded-xl text-amber-800 font-bold text-[11px] leading-relaxed">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-amber-600 mt-0.5" />
                <span>تنبيه: هناك {lowBalanceCount} حسابات مصرفية تعاني من عجز مالي وتجاوزت الحد الأدنى للرصيد المقبول.</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 bg-teal-50 border border-teal-150 text-teal-800 p-3 rounded-xl font-bold text-[11px]">
                <Check className="h-4.5 w-4.5 shrink-0 text-teal-650 mt-0.5" />
                <span>جميع الأرصدة المصرفية مغطاة وتعمل بشكل سليم دون أي مؤشرات عجز.</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Add Bank Account Modal */}
      <AnimatePresence>
        {newBankOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-[440px] rounded-[24px] p-1.5 bg-border-normal border border-slate-350 shadow-modal overflow-hidden animate-fade-in"
              dir="rtl"
            >
              <div className="rounded-[calc(24px-0.375rem)] p-6 bg-bg-surface flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <div className="flex items-center gap-1.5 text-indigo-650 font-black">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm">إضافة حساب بنكي جديد</span>
                  </div>
                  <button onClick={() => setNewBankOpen(false)} className="p-1 rounded-full hover:bg-bg-overlay text-text-muted hover:text-text-primary transition-colors">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="text-[10px] font-black text-slate-450 block mb-1">اسم الحساب البنكي *</label>
                    <input 
                      ref={bankNameRef} 
                      value={newBank.name} 
                      onChange={e => setNewBank(f => ({ ...f, name: e.target.value }))} 
                      autoFocus 
                      onKeyDown={(e) => handleKeyDown(e, { nextRef: bankCodeRef })} 
                      className="w-full h-10 rounded-xl border border-slate-250 bg-bg-overlay px-3 text-2sm text-text-primary outline-none focus:border-indigo-650 transition-colors"
                      placeholder="مثال: البنك الأهلي - جاري"
                    />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black text-slate-450 block mb-1">كود التعريف البنكي (اختياري)</label>
                    <input 
                      ref={bankCodeRef} 
                      value={newBank.code} 
                      onChange={e => setNewBank(f => ({ ...f, code: e.target.value }))} 
                      onKeyDown={(e) => handleKeyDown(e, { nextRef: bankBalanceRef, prevRef: bankNameRef })} 
                      className="w-full h-10 rounded-xl border border-slate-250 bg-bg-overlay px-3 text-2sm text-text-primary outline-none focus:border-indigo-650 transition-colors"
                      placeholder="مثال: NBE-JARI"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-455 block mb-1">الرصيد الافتتاحي</label>
                      <input 
                        ref={bankBalanceRef} 
                        type="number" 
                        value={newBank.balance} 
                        onChange={e => setNewBank(f => ({ ...f, balance: e.target.value }))} 
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: bankAlertRef, prevRef: bankCodeRef })} 
                        className="w-full h-10 rounded-xl border border-slate-250 bg-bg-overlay px-3 text-2sm text-center font-mono text-text-primary outline-none focus:border-indigo-650 transition-colors" 
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-455 block mb-1">حد تنبيه الرصيد</label>
                      <input 
                        ref={bankAlertRef} 
                        type="number" 
                        value={newBank.alert_threshold} 
                        onChange={e => setNewBank(f => ({ ...f, alert_threshold: e.target.value }))} 
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: bankSaveRef, prevRef: bankBalanceRef })} 
                        className="w-full h-10 rounded-xl border border-slate-250 bg-bg-overlay px-3 text-2sm text-center font-mono text-text-primary outline-none focus:border-indigo-650 transition-colors" 
                        placeholder="1000"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-border-subtle">
                    <PermissionGate page="bank_operations" action="add">
                      <button 
                        ref={bankSaveRef} 
                        onClick={createBank} 
                        disabled={!newBank.name || saving} 
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: bankNameRef, onEnter: createBank })} 
                        className="h-10 rounded-xl bg-indigo-600 text-2sm font-black text-white hover:bg-indigo-700 disabled:opacity-40 transition-all px-6 flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
                      >
                        <span>حفظ الحساب وتنشيطه</span>
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                    </PermissionGate>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transfer Between Accounts Modal */}
      <AnimatePresence>
        {transferOpen && (() => {
          const fromBank = banks.find(b => b.id === Number(transferForm.from_id));
          const toBank = banks.find(b => b.id === Number(transferForm.to_id));
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/45 backdrop-blur-xs">
              <motion.div 
                initial={{ opacity: 0, scale: 0.97, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 10 }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                className="w-full max-w-[480px] rounded-[24px] p-1.5 bg-border-normal border border-slate-350 shadow-modal overflow-hidden"
                dir="rtl"
              >
                <div className="rounded-[calc(24px-0.375rem)] p-6 bg-bg-surface flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/50 shadow-sm">
                        <ArrowLeftRight className="h-4.5 w-4.5" />
                      </div>
                      <h2 className="text-sm font-black text-text-primary">تحويل مالي بين الحسابات</h2>
                    </div>
                    <button onClick={() => setTransferOpen(false)} className="p-1 rounded-full hover:bg-bg-overlay text-text-muted hover:text-text-primary transition-colors">
                      <X className="h-4.5 w-4.5" />
                    </button>
                  </div>

                  {/* Visual Connection Diagram of money flow */}
                  <div className="flex items-center justify-between bg-bg-overlay border border-slate-250/70 rounded-2xl p-4 gap-2">
                    <div className="flex-1 flex flex-col justify-between h-20 bg-bg-overlay border border-border-normal p-3 rounded-xl min-w-0">
                      <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">من حساب (المصدر)</span>
                      <span className="text-[11px] font-black text-text-primary truncate">
                        {fromBank ? fromBank.name : "لم يتم الاختيار"}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-text-secondary">
                        {fromBank ? `${fmt(fromBank.balance)} ج.م` : "—"}
                      </span>
                    </div>

                    <div className="flex flex-col items-center shrink-0 px-2 text-indigo-650">
                      <ArrowLeft className="h-5 w-5 animate-pulse shrink-0" />
                      {transferForm.amount && (
                        <span className="text-[9px] font-mono font-black text-indigo-650 mt-1 block">
                          {fmt(transferForm.amount)}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col justify-between h-20 bg-bg-overlay border border-border-normal p-3 rounded-xl min-w-0">
                      <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block text-left">إلى حساب (الوجهة)</span>
                      <span className="text-[11px] font-black text-text-primary truncate text-left">
                        {toBank ? toBank.name : "لم يتم الاختيار"}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-text-secondary text-left">
                        {toBank ? `${fmt(toBank.balance)} ج.م` : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-455 block mb-1">الحساب المصدر (تحويل منه)</label>
                      <select 
                        ref={transferFromRef} 
                        value={transferForm.from_id} 
                        onChange={e => setTransferForm(f => ({ ...f, from_id: e.target.value }))} 
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: transferToRef })}
                        className="w-full h-10 rounded-xl border border-slate-250 bg-bg-overlay px-3 text-2sm font-bold text-text-primary outline-none focus:border-indigo-650 transition-colors"
                      >
                        <option value="">اختر حساب المصدر</option>
                        {banks.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} — ({fmt(b.balance)} ج.م)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-455 block mb-1">الحساب الوجهة (تحويل إليه)</label>
                      <select 
                        ref={transferToRef} 
                        value={transferForm.to_id} 
                        onChange={e => setTransferForm(f => ({ ...f, to_id: e.target.value }))} 
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: transferAmountRef, prevRef: transferFromRef })}
                        className="w-full h-10 rounded-xl border border-slate-250 bg-bg-overlay px-3 text-2sm font-bold text-text-primary outline-none focus:border-indigo-650 transition-colors"
                      >
                        <option value="">اختر حساب الوجهة</option>
                        {banks.filter(b => b.id !== Number(transferForm.from_id)).map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-455 block mb-1">المبلغ المراد تحويله (ج.م) *</label>
                      <input 
                        ref={transferAmountRef} 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        value={transferForm.amount}
                        onChange={e => setTransferForm(f => ({ ...f, amount: e.target.value }))} 
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: transferNotesRef, prevRef: transferToRef })}
                        className="w-full h-10 rounded-xl border border-slate-250 bg-bg-overlay px-4 text-center font-mono text-sm font-black text-text-primary outline-none focus:border-indigo-650 transition-colors" 
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-455 block mb-1">ملاحظات التحويل</label>
                      <input 
                        ref={transferNotesRef} 
                        value={transferForm.notes} 
                        onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))} 
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: transferSubmitRef, prevRef: transferAmountRef })}
                        className="w-full h-10 rounded-xl border border-slate-250 bg-bg-overlay px-4 text-2sm text-text-primary outline-none focus:border-indigo-650 transition-colors"
                        placeholder="بيان حركة التحويل..."
                      />
                    </div>

                    <div className="flex justify-end pt-3 border-t border-border-subtle">
                      <button 
                        ref={transferSubmitRef} 
                        onClick={handleTransfer} 
                        disabled={!transferForm.from_id || !transferForm.to_id || !transferForm.amount || saving} 
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: transferFromRef, onEnter: handleTransfer })}
                        className="h-10 rounded-xl bg-indigo-600 text-2sm font-black text-white hover:bg-indigo-700 disabled:opacity-40 transition-all px-6 flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
                      >
                        <span>تأكيد عملية التحويل</span>
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {modal && (
          <BankModal 
            bank={modal.bank} 
            mode={modal.mode} 
            onClose={() => setModal(null)} 
            onDone={() => { setModal(null); load(); }} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {statement && (
          <StatementPanel 
            bank={statement} 
            onClose={() => setStatement(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
