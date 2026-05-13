import React, { useState, useEffect } from "react";
import { Printer, X, FileText } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import PrintPreviewModal from "../print/PrintPreviewModal";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("ar-EG") : "—";

export default function StatementModal({ party, partyType, onClose }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [ledger, setLedger] = useState([]);
  const [totals, setTotals] = useState({ totalDebit: 0, totalCredit: 0 });
  const [printOpen, setPrintOpen] = useState(false);

  async function loadLedger() {
    if (!from || !to) {
      toast.error("يرجى تحديد فترة كشف الحساب");
      return;
    }
    setLoading(true);
    try {
      const q = `?${partyType === 'customer' ? 'customer_id' : 'supplier_id'}=${party.id}&date_from=${from}&date_to=${to}&limit=500`;
      const docsReq = api.get(partyType === 'customer' ? `/api/invoices${q}` : `/api/purchases${q}`);
      const paysReq = api.get(`/api/payments?party_type=${partyType}&party_id=${party.id}&from=${from}&to=${to}&limit=500`);
      const debtsReq = api.get(`/api/ajal-debts/${partyType}/${party.id}`).catch(() => ({ data: { data: [] } }));
      
      const [docsR, paysR, debtsR] = await Promise.all([docsReq, paysReq, debtsReq]);
      
      const docs = docsR.data.data || [];
      const pays = paysR.data.data || [];
      const debtDetails = await Promise.all((debtsR.data.data || []).map((debt) =>
        api.get(`/api/ajal-debts/${debt.id}`).then((r) => r.data.data).catch(() => null)
      ));
      
      const items = [];
      let totalD = 0;
      let totalC = 0;

      docs.forEach(d => {
        items.push({
          date: new Date(d.created_at),
          type: partyType === 'customer' ? "فاتورة مبيعات" : "فاتورة مشتريات",
          doc_no: d.invoice_no || d.doc_no || `#${d.id}`,
          debit: partyType === 'customer' ? d.total : 0,
          credit: partyType === 'supplier' ? d.total : 0,
        });
      });

      pays.forEach(p => {
        items.push({
          date: new Date(p.created_at),
          type: "سداد دفعة",
          doc_no: p.doc_no || `PAY-${p.id}`,
          debit: partyType === 'supplier' ? p.amount : 0,
          credit: partyType === 'customer' ? p.amount : 0,
        });
      });

      debtDetails.filter(Boolean).forEach((debt) => {
        (debt.payments || []).forEach((p) => {
          const dateValue = p.payment_date || p.created_at;
          if (dateValue && (dateValue.slice(0, 10) < from || dateValue.slice(0, 10) > to)) return;
          items.push({
            date: new Date(dateValue),
            type: partyType === 'customer' ? "تحصيل دين آجل" : "سداد دين آجل",
            doc_no: `AJAL-${debt.id}`,
            debit: partyType === 'supplier' ? p.amount : 0,
            credit: partyType === 'customer' ? p.amount : 0,
          });
        });
      });

      // Sort chronological
      items.sort((a, b) => a.date - b.date);

      // Calc running balance
      let currentBal = Number(party.opening_balance || 0); 
      // This is simplified. True opening balance at "from" date would require 
      // aggregating all prior history. For now we use the current base + the window.

      items.forEach(i => {
        totalD += i.debit;
        totalC += i.credit;
        if (partyType === 'customer') {
          currentBal = currentBal + i.debit - i.credit;
        } else {
          currentBal = currentBal + i.credit - i.debit;
        }
        i.balance = currentBal;
      });

      setTotals({ totalDebit: totalD, totalCredit: totalC });
      setLedger(items);
    } catch (e) {
      toast.error("فشل تحميل الكشف");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm print:bg-white print:p-0" dir="rtl">
      <div className="w-[820px] h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden print:w-full print:h-auto print:shadow-none print:rounded-none">
        
        {/* Modal Header (Hidden on print) */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[16px] font-black text-slate-900">كشف حساب — {party.name}</h2>
              <p className="text-[11px] font-bold text-slate-400">تحديد الفترة والطباعة</p>
            </div>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        {/* Filters (Hidden on print) */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-100 shrink-0 print:hidden bg-white">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] outline-none" />
          <span className="text-slate-400 text-[12px]">إلى</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] outline-none" />
          <button onClick={loadLedger} disabled={loading} className="h-9 rounded-xl bg-slate-800 px-4 text-[12px] font-black text-white hover:bg-slate-900">
            {loading ? "جاري التحميل..." : "عرض الكشف"}
          </button>
          <div className="flex-1" />
          <button onClick={() => setPrintOpen(true)} disabled={ledger.length === 0} className="flex h-9 items-center gap-2 rounded-xl bg-blue-600 px-4 text-[12px] font-black text-white hover:bg-blue-700 disabled:opacity-40">
            <Printer className="h-4 w-4" /> طباعة
          </button>
        </div>

        {/* Printable Area */}
        <div className="flex-1 overflow-auto p-8 print:p-4 bg-white print:overflow-visible">
          
          <div className="hidden print:block text-center mb-6">
            <h1 className="text-xl font-black mb-2">كشف حساب {partyType === 'customer' ? 'عميل' : 'مورد'}</h1>
            <div className="text-lg font-bold">{party.name}</div>
            <div className="text-sm text-slate-500 mt-1">الفترة: {from} إلى {to}</div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-3 border border-slate-200 rounded-xl">
              <div className="text-[10px] text-slate-400 font-bold mb-1">الرصيد الحالي المستحق</div>
              <div className="text-lg font-black font-mono">{fmt(party.opening_balance)} ج.م</div>
            </div>
            <div className="p-3 border border-slate-200 rounded-xl">
              <div className="text-[10px] text-slate-400 font-bold mb-1">صافي الحركة (مدين - دائن)</div>
              <div className="text-lg font-black font-mono">{fmt(totals.totalDebit - totals.totalCredit)} ج.م</div>
            </div>
          </div>

          {ledger.length === 0 ? (
            <div className="text-center py-10 text-slate-400 font-black print:hidden">
              لا توجد حركات في هذه الفترة
            </div>
          ) : (
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-slate-50 print:bg-slate-100">
                  <th className="border border-slate-200 p-2 text-right">التاريخ</th>
                  <th className="border border-slate-200 p-2 text-right">البيان</th>
                  <th className="border border-slate-200 p-2 text-right">المرجع</th>
                  <th className="border border-slate-200 p-2 text-right">مدين</th>
                  <th className="border border-slate-200 p-2 text-right">دائن</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((item, i) => (
                  <tr key={i}>
                    <td className="border border-slate-200 p-2">{fmtDate(item.date)}</td>
                    <td className="border border-slate-200 p-2">{item.type}</td>
                    <td className="border border-slate-200 p-2 font-mono text-[11px]">{item.doc_no}</td>
                    <td className="border border-slate-200 p-2 font-mono font-black">{item.debit > 0 ? fmt(item.debit) : ""}</td>
                    <td className="border border-slate-200 p-2 font-mono font-black">{item.credit > 0 ? fmt(item.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 print:bg-slate-100 font-black">
                  <td colSpan={3} className="border border-slate-200 p-2 text-left">الإجمالي:</td>
                  <td className="border border-slate-200 p-2 font-mono text-rose-700">{fmt(totals.totalDebit)}</td>
                  <td className="border border-slate-200 p-2 font-mono text-emerald-700">{fmt(totals.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
      {printOpen && (
        <PrintPreviewModal
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          docType={partyType === "customer" ? "sales_invoice" : "purchase_order"}
          renderContent={(settings) => (
            <div style={{ fontFamily: settings.print_font || "Cairo", direction: "rtl", padding: 24, fontSize: 12, color: "#1e293b" }}>
              <div style={{ borderBottom: `3px solid ${settings.accent_color || "#334155"}`, paddingBottom: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 20, fontWeight: 900 }}>كشف حساب {partyType === "customer" ? "عميل" : "مورد"}</div>
                <div style={{ color: "#64748b" }}>{party.name}</div>
                <div style={{ color: "#64748b", fontSize: 11 }}>الفترة: {from} إلى {to}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}><strong>الرصيد الحالي</strong><br />{fmt(party.opening_balance)} ج.م</div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}><strong>إجمالي مدين</strong><br />{fmt(totals.totalDebit)} ج.م</div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}><strong>إجمالي دائن</strong><br />{fmt(totals.totalCredit)} ج.م</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ background: settings.accent_color || "#334155", color: "white" }}>{["التاريخ", "البيان", "المرجع", "مدين", "دائن"].map((h) => <th key={h} style={{ padding: 8, textAlign: "right" }}>{h}</th>)}</tr></thead>
                <tbody>{ledger.map((item, i) => (
                  <tr key={i} style={{ background: i % 2 ? "white" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: 8 }}>{fmtDate(item.date)}</td>
                    <td style={{ padding: 8 }}>{item.type}</td>
                    <td style={{ padding: 8 }}>{item.doc_no}</td>
                    <td style={{ padding: 8 }}>{item.debit ? fmt(item.debit) : ""}</td>
                    <td style={{ padding: 8 }}>{item.credit ? fmt(item.credit) : ""}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        />
      )}
    </div>
  );
}
