import React, { useState, useEffect, useCallback } from "react";
import { Landmark, Plus, Minus, ArrowUpCircle, ArrowDownCircle, RefreshCw, X, List, ArrowLeftRight, AlertCircle, Printer } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import BankStatementTemplate from "../../components/print/templates/BankStatementTemplate";
import PermissionGate from "../../components/ui/PermissionGate";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });

function BankModal({ bank, mode, onClose, onDone }) {
  const [form, setForm] = useState({ amount: "", reference: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.amount) return;
    setSaving(true);
    try {
      await api.post(`/api/banks/${bank.id}/${mode}`, { amount: Number(form.amount), reference: form.reference, notes: form.notes });
      toast.success(mode === "deposit" ? "تم الإيداع" : "تم السحب");
      onDone();
    } catch (e) { toast.error(e.response?.data?.message || "خطأ"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[380px] rounded-2xl bg-white shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[15px] font-black text-slate-900">{mode === "deposit" ? "إيداع" : "سحب"}</h2>
            <p className="text-[11px] text-slate-400 font-bold">{bank.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPrintOpen(true)}
              className="flex h-8 items-center gap-1.5 rounded-xl bg-slate-800 px-3 text-[11px] font-black text-white hover:bg-slate-900">
              <Printer className="h-4 w-4" /> طباعة الكشف
            </button>
            <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-black text-slate-600 block mb-1.5">المبلغ (ج.م) *</label>
            <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              autoFocus className="w-full h-11 rounded-xl border border-slate-300 px-4 text-[14px] font-black text-center outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="text-[11px] font-black text-slate-600 block mb-1.5">رقم المرجع</label>
            <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
              className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[12px] outline-none" placeholder="رقم تحويل / مرجع..." />
          </div>
          <div>
            <label className="text-[11px] font-black text-slate-600 block mb-1.5">ملاحظات</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[12px] outline-none" />
          </div>
          <button onClick={submit} disabled={!form.amount || saving}
            className={`w-full rounded-xl py-3 text-[13px] font-black text-white transition-colors disabled:opacity-40 ${mode === "deposit" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}`}>
            {saving ? "جاري..." : mode === "deposit" ? "تأكيد الإيداع" : "تأكيد السحب"}
          </button>
        </div>
        {printOpen && (
          <PrintPreviewModal
            open={printOpen}
            onClose={() => setPrintOpen(false)}
            docType="bank_statement"
            renderContent={(settings) => (
              <BankStatementTemplate
                bank={bank}
                transactions={txs}
                from={from}
                to={to}
                settings={settings}
              />
            )}
          />
        )}
      </div>
    </div>
  );
}

function StatementPanel({ bank, onClose }) {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [printOpen, setPrintOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const r = await api.get(`/api/banks/${bank.id}/transactions?${params}`);
      setTxs(r.data.data || []);
    } catch { setTxs([]); }
    finally { setLoading(false); }
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
    <div className="fixed inset-0 z-50 flex items-end justify-start bg-black/30">
      <div className="w-[500px] h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-indigo-50">
          <div>
            <h2 className="text-[14px] font-black text-slate-900">كشف حساب — {bank.name}</h2>
            <p className="text-[11px] text-indigo-700 font-bold">الرصيد الحالي: {fmt(bank.balance)} ج.م</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <div className="flex gap-3 p-4 border-b border-slate-100 shrink-0">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 flex-1 rounded-xl border border-slate-200 px-3 text-[12px] outline-none" />
          <span className="text-slate-400 self-center text-[12px]">إلى</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 flex-1 rounded-xl border border-slate-200 px-3 text-[12px] outline-none" />
          <button onClick={load} className="h-9 rounded-xl bg-indigo-600 px-4 text-[12px] font-black text-white hover:bg-indigo-700">بحث</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
          ) : txs.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-300 font-black">لا توجد حركات</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {["التاريخ", "النوع", "المبلغ", "المرجع", "التسوية"].map(h => (
                    <th key={h} className="px-4 py-2 text-right font-black text-slate-500 text-[11px] border-b border-slate-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txs.map(tx => (
                  <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500">{tx.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`flex items-center gap-1 w-fit rounded-full px-2 py-0.5 text-[10px] font-black ${tx.type === "deposit" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {tx.type === "deposit" ? <ArrowUpCircle className="h-3 w-3" /> : <ArrowDownCircle className="h-3 w-3" />}
                        {tx.type === "deposit" ? "إيداع" : "سحب"}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 font-black font-mono ${tx.type === "deposit" ? "text-emerald-700" : "text-rose-700"}`}>
                      {tx.type === "deposit" ? "+" : "-"}{fmt(tx.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-[11px]">{tx.reference || "—"}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => toggleReconcile(tx.id, tx.reconciled)}
                        className={`h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-black ${tx.reconciled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}
                        title={tx.reconciled ? "مسوّى" : "غير مسوّى"}
                      >
                        {tx.reconciled ? "✓" : "○"}
                      </button>
                    </td>
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

export default function BankOperationsPage() {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { bank, mode: 'deposit'|'withdraw' }
  const [statement, setStatement] = useState(null);
  const [newBankOpen, setNewBankOpen] = useState(false);
  const [newBank, setNewBank] = useState({ name: "", code: "", balance: "", alert_threshold: "" });
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({ from_id: "", to_id: "", amount: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/api/banks");
      setBanks(r.data.data || []);
    } catch { setBanks([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createBank() {
    if (!newBank.name) return;
    setSaving(true);
    try {
      await api.post("/api/banks", { name: newBank.name, code: newBank.code, balance: Number(newBank.balance || 0), alert_threshold: Number(newBank.alert_threshold || 0) });
      toast.success("تم إضافة البنك");
      setNewBankOpen(false); setNewBank({ name: "", code: "", balance: "", alert_threshold: "" }); load();
    } catch (e) { toast.error(e.response?.data?.message || "خطأ"); }
    finally { setSaving(false); }
  }

  async function handleTransfer() {
    if (Number(transferForm.amount) <= 0) return toast.error("المبلغ غير صحيح");
    const fromBank = banks.find((bank) => bank.id === Number(transferForm.from_id));
    if (fromBank && Number(transferForm.amount) > Number(fromBank.balance || 0)) {
      return toast.error("رصيد الحساب غير كافٍ");
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
    } catch (e) { toast.error(e.response?.data?.message || "خطأ في التحويل"); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50" dir="rtl">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-200">
            <Landmark className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-black text-slate-900">إدارة الحسابات البنكية</h1>
            <p className="text-[11px] font-bold text-slate-400">إيداع وسحب وكشف حساب</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /></button>
          <PermissionGate page="bank_operations" action="edit">
          <button onClick={() => setTransferOpen(true)}
            className="flex h-9 items-center gap-2 rounded-xl bg-blue-600 px-4 text-[12px] font-black text-white hover:bg-blue-700">
            <ArrowLeftRight className="h-4 w-4" /> تحويل بين حسابات
          </button>
          </PermissionGate>
          <PermissionGate page="bank_operations" action="add">
          <button onClick={() => setNewBankOpen(!newBankOpen)} className="flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[12px] font-black text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200">
            <Plus className="h-4 w-4" /> إضافة حساب
          </button>
          </PermissionGate>
        </div>
      </header>

      {newBankOpen && (
        <div className="mx-4 mt-4 rounded-2xl bg-white border border-indigo-200 p-5 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-black text-slate-800">إضافة حساب بنكي جديد</h3>
            <button onClick={() => setNewBankOpen(false)}><X className="h-4 w-4 text-slate-400" /></button>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <div><label className="text-[11px] font-black text-slate-500 block mb-1">اسم البنك *</label>
              <input value={newBank.name} onChange={e => setNewBank(f => ({ ...f, name: e.target.value }))} autoFocus className="w-full h-10 rounded-xl border border-slate-300 px-3 text-[12px] outline-none focus:border-indigo-500" /></div>
            <div><label className="text-[11px] font-black text-slate-500 block mb-1">الكود</label>
              <input value={newBank.code} onChange={e => setNewBank(f => ({ ...f, code: e.target.value }))} className="w-full h-10 rounded-xl border border-slate-300 px-3 text-[12px] outline-none" /></div>
            <div><label className="text-[11px] font-black text-slate-500 block mb-1">الرصيد الافتتاحي</label>
              <input type="number" value={newBank.balance} onChange={e => setNewBank(f => ({ ...f, balance: e.target.value }))} className="w-full h-10 rounded-xl border border-slate-300 px-3 text-[12px] text-center outline-none" /></div>
            <div><label className="text-[11px] font-black text-slate-500 block mb-1">حد التنبيه</label>
              <input type="number" value={newBank.alert_threshold} onChange={e => setNewBank(f => ({ ...f, alert_threshold: e.target.value }))} className="w-full h-10 rounded-xl border border-slate-300 px-3 text-[12px] text-center outline-none" /></div>
            <div className="flex items-end">
              <PermissionGate page="bank_operations" action="add">
              <button onClick={createBank} disabled={!newBank.name || saving} className="w-full h-10 rounded-xl bg-indigo-600 text-[12px] font-black text-white hover:bg-indigo-700 disabled:opacity-40">حفظ</button>
              </PermissionGate>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
        ) : banks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
            <Landmark className="h-10 w-10" />
            <span className="font-black">لا توجد حسابات بنكية</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {banks.map(bank => (
              <div key={bank.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-[15px] font-black text-slate-900">{bank.name}</div>
                    {bank.code && <div className="text-[11px] text-slate-400 font-bold mt-0.5">{bank.code}</div>}
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                    <Landmark className="h-5 w-5 text-indigo-600" />
                  </div>
                </div>
                <div className="mb-4">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">الرصيد الحالي</div>
                  <div className={`text-[26px] font-black font-mono ${Number(bank.balance) >= 0 ? "text-slate-900" : "text-rose-600"}`}>
                    {fmt(bank.balance)} <span className="text-[12px] text-slate-400">ج.م</span>
                  </div>
                  {Number(bank.alert_threshold || 0) > 0 && Number(bank.balance || 0) < Number(bank.alert_threshold || 0) && (
                    <div className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 rounded-lg px-2 py-1 mt-2 w-fit">
                      <AlertCircle className="h-3 w-3" /> رصيد منخفض
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <PermissionGate page="bank_operations" action="edit">
                  <button onClick={() => setModal({ bank, mode: "deposit" })}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-[12px] font-black text-white hover:bg-emerald-700 transition-colors">
                    <Plus className="h-4 w-4" /> إيداع
                  </button>
                  </PermissionGate>
                  <PermissionGate page="bank_operations" action="edit">
                  <button onClick={() => setModal({ bank, mode: "withdraw" })}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2 text-[12px] font-black text-white hover:bg-rose-700 transition-colors">
                    <Minus className="h-4 w-4" /> سحب
                  </button>
                  </PermissionGate>
                  <button onClick={() => setStatement(bank)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors">
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {transferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[420px] rounded-2xl bg-white shadow-2xl p-6" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-black text-slate-900">تحويل بين حسابات بنكية</h2>
              <button onClick={() => setTransferOpen(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-600 block mb-1.5">من حساب</label>
                <select value={transferForm.from_id} onChange={e => setTransferForm(f => ({ ...f, from_id: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-300 px-3 text-[12px] font-bold bg-white outline-none focus:border-blue-500">
                  <option value="">اختر حساب المصدر</option>
                  {banks.map(b => <option key={b.id} value={b.id}>{b.name} — {fmt(b.balance)} ج.م</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-600 block mb-1.5">إلى حساب</label>
                <select value={transferForm.to_id} onChange={e => setTransferForm(f => ({ ...f, to_id: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-300 px-3 text-[12px] font-bold bg-white outline-none focus:border-blue-500">
                  <option value="">اختر الحساب الوجهة</option>
                  {banks.filter(b => b.id !== Number(transferForm.from_id)).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-600 block mb-1.5">المبلغ</label>
                <input type="number" min="0" step="0.01" value={transferForm.amount}
                  onChange={e => setTransferForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-300 px-3 text-[13px] font-black outline-none focus:border-blue-500" dir="ltr" />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-600 block mb-1.5">ملاحظات</label>
                <input value={transferForm.notes} onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-300 px-3 text-[12px] outline-none" />
              </div>
              <button onClick={handleTransfer} disabled={!transferForm.from_id || !transferForm.to_id || !transferForm.amount || saving}
                className="w-full rounded-xl bg-blue-600 py-3 text-[13px] font-black text-white hover:bg-blue-700 disabled:opacity-40">
                {saving ? "جاري التحويل..." : "تأكيد التحويل"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && <BankModal bank={modal.bank} mode={modal.mode} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {statement && <StatementPanel bank={statement} onClose={() => setStatement(null)} />}
    </div>
  );
}
