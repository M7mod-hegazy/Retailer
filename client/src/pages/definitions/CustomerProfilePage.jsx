import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowRight, User, Phone, Mail, Star, ShoppingCart, CreditCard,
  Calendar, AlertCircle, Printer, Plus, ChevronLeft
} from "lucide-react";
import api from "../../services/api";
import { formatNumber } from "../../utils/currency";
import { useFeatureEnabled } from "../../hooks/useFeature";

const fmt = (n) => formatNumber(n);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("ar-EG-u-nu-latn") : "—";

const STATUS_AR = { open: "مفتوح", partial: "جزئي", overdue: "متأخر", paid: "مسدد" };
const STATUS_CLS = { open: "bg-blue-50 text-blue-700", partial: "bg-amber-50 text-amber-700", overdue: "bg-rose-50 text-rose-700", paid: "bg-emerald-50 text-emerald-700" };

const BASE_TABS = [
  { id: "invoices", label: "فواتير المبيعات" },
  { id: "debts", label: "الديون (أجل)" },
  { id: "payments", label: "المدفوعات" },
];
const CHEQUES_TAB = { id: "cheques", label: "الشيكات" };

export default function CustomerProfilePage() {
  const { id } = useParams();
  const chequesEnabled = useFeatureEnabled("feature_cheques");
  const TABS = chequesEnabled ? [...BASE_TABS, CHEQUES_TAB] : BASE_TABS;
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("invoices");
  const [tabData, setTabData] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [ajalSummary, setAjalSummary] = useState(null);

  useEffect(() => {
    api.get(`/api/customers/${id}`).then(r => setCustomer(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setTabLoading(true);
    const load = async () => {
      try {
        if (activeTab === "invoices") {
          const r = await api.get(`/api/invoices?customer_id=${id}&limit=100`);
          setTabData(r.data.data || []);
        } else if (activeTab === "debts") {
          const [dR, sR] = await Promise.all([
            api.get(`/api/ajal-debts/customer/${id}`),
            api.get("/api/ajal-debts/summary").catch(() => ({ data: { data: {} } })),
          ]);
          setTabData(dR.data.data || []);
          setAjalSummary(sR.data.data);
        } else if (activeTab === "payments") {
          const r = await api.get(`/api/payments?party_type=customer&party_id=${id}`);
          setTabData(r.data.data || []);
        } else if (activeTab === "cheques") {
          const r = await api.get(`/api/cheques?party_id=${id}`);
          setTabData(r.data.data || []);
        }
      } catch { setTabData([]); }
      finally { setTabLoading(false); }
    };
    load();
  }, [activeTab, id]);

  if (loading) return <div className="flex items-center justify-center h-full font-black animate-pulse" style={{ color: "var(--text-muted)" }}>جاري التحميل...</div>;
  if (!customer) return <div className="flex items-center justify-center h-full font-black" style={{ color: "var(--text-muted)" }}>العميل غير موجود</div>;

  const balance = Number(customer.opening_balance || 0);

  return (
    <div className="flex flex-col h-full" dir="rtl" data-help-root="customer_profile" style={{ backgroundColor: "var(--bg-base)" }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 text-2sm font-bold shrink-0" data-help="breadcrumb" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
        <Link to="/accounts/customers" className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" /> حسابات العملاء
        </Link>
        <span>/</span>
        <span style={{ color: "var(--text-primary)" }}>{customer.name}</span>
      </div>

      {/* Customer Card */}
      <div className="mx-4 mt-4 rounded-2xl border shadow-sm p-5 shrink-0" data-help="info-card" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-200 text-white font-black text-[22px]">
              {customer.name?.charAt(0)}
            </div>
            <div>
              <h1 className="text-[20px] font-black" style={{ color: "var(--text-primary)" }}>{customer.name}</h1>
              <div className="flex items-center gap-4 mt-1 text-2sm font-bold" style={{ color: "var(--text-secondary)" }}>
                {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {customer.phone}</span>}
                {customer.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {customer.email}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-3 text-center min-w-[120px] ${balance < 0 ? "bg-rose-50 border border-rose-200" : "bg-emerald-50 border border-emerald-200"}`}>
              <div className="text-[11px] font-black uppercase tracking-wider mb-0.5" style={{ color: "var(--text-secondary)" }}>رصيد الحساب</div>
              <div className={`text-[18px] number-fmt-primary ${balance < 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmt(balance)}</div>
              <div className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>ج.م</div>
            </div>
            <Link to={`/payments/new?customer_id=${id}`}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-2sm font-black text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> تحصيل دفعة
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mt-4 shrink-0" data-help="profile-tabs">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-xl text-2sm font-black transition-colors ${activeTab === t.id ? "bg-blue-600 text-white shadow-md" : "border hover:bg-[var(--bg-overlay)]"}`} style={activeTab === t.id ? undefined : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4" data-help="tab-content">
        <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
          {tabLoading ? (
            <div className="flex items-center justify-center h-40 font-black animate-pulse" style={{ color: "var(--text-muted)" }}>جاري التحميل...</div>
          ) : tabData.length === 0 ? (
            <div className="flex items-center justify-center h-40 font-black" style={{ color: "var(--text-muted)" }}>لا توجد بيانات</div>
          ) : activeTab === "invoices" ? (
            <table className="w-full text-2sm">
              <thead className="border-b" style={{ backgroundColor: "var(--bg-overlay)", borderBottomColor: "var(--border-normal)" }}>
                <tr>{["رقم الفاتورة", "التاريخ", "الإجمالي", "الحالة"].map(h => <th key={h} className="px-4 py-3 text-right font-black text-[11px] uppercase" style={{ color: "var(--text-secondary)" }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {tabData.map(inv => (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-[var(--bg-overlay)]">
                    <td className="px-4 py-3 font-black font-mono text-blue-700">{inv.invoice_no || inv.doc_no || `#${inv.id}`}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmtDate(inv.created_at)}</td>
                    <td className="px-4 py-3 number-fmt-primary">{fmt(inv.total)} ج.م</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">{inv.status || "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === "debts" ? (
            <table className="w-full text-2sm">
              <thead className="border-b" style={{ backgroundColor: "var(--bg-overlay)", borderBottomColor: "var(--border-normal)" }}>
                <tr>{["الفاتورة", "المبلغ", "المدفوع", "المتبقي", "الاستحقاق", "الحالة"].map(h => <th key={h} className="px-4 py-3 text-right font-black text-[11px] uppercase" style={{ color: "var(--text-secondary)" }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {tabData.map(d => (
                  <tr key={d.id} className={`border-b border-slate-50 hover:bg-[var(--bg-overlay)] ${d.status === "overdue" ? "bg-rose-50/30" : ""}`}>
                    <td className="px-4 py-3 font-mono text-[11px]">{d.invoice_no || "—"}</td>
                    <td className="px-4 py-3 number-fmt-primary">{fmt(d.original_amount)}</td>
                    <td className="px-4 py-3 number-fmt text-emerald-700">{fmt(d.paid_amount)}</td>
                    <td className="px-4 py-3 number-fmt-primary text-rose-700">{fmt(d.remaining)}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmtDate(d.due_date)}</td>
                    <td className="px-4 py-3">
                      <Link to="/accounts/customers" className={`rounded-full px-2 py-0.5 text-[11px] font-black ${STATUS_CLS[d.status] || "bg-[var(--bg-overlay)] text-[var(--text-secondary)]"}`}>
                        {STATUS_AR[d.status] || d.status}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === "payments" ? (
            <table className="w-full text-2sm">
              <thead className="border-b" style={{ backgroundColor: "var(--bg-overlay)", borderBottomColor: "var(--border-normal)" }}>
                <tr>{["الكود", "المبلغ", "الوسيلة", "التاريخ"].map(h => <th key={h} className="px-4 py-3 text-right font-black text-[11px] uppercase" style={{ color: "var(--text-secondary)" }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {tabData.map(p => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-[var(--bg-overlay)]">
                    <td className="px-4 py-3 font-mono text-[11px]">{p.doc_no || `PAY-${p.id}`}</td>
                    <td className="px-4 py-3 number-fmt-primary text-emerald-700">{fmt(p.amount)} ج.م</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{p.method_name || p.method}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-2sm">
              <thead className="border-b" style={{ backgroundColor: "var(--bg-overlay)", borderBottomColor: "var(--border-normal)" }}>
                <tr>{["رقم الشيك", "المبلغ", "البنك", "الاستحقاق", "الحالة"].map(h => <th key={h} className="px-4 py-3 text-right font-black text-[11px] uppercase" style={{ color: "var(--text-secondary)" }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {tabData.map(c => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-[var(--bg-overlay)]">
                    <td className="px-4 py-3 font-mono text-[11px]">{c.cheque_no}</td>
                    <td className="px-4 py-3 number-fmt-primary">{fmt(c.amount)} ج.م</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{c.bank_name || "—"}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmtDate(c.due_date)}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-black text-violet-700">{c.status}</span></td>
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
