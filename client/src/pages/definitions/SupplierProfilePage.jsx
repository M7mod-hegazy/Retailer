import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Truck, Phone, Mail, ChevronLeft, Plus } from "lucide-react";
import api from "../../services/api";
import { formatNumber } from "../../utils/currency";

const fmt = (n) => formatNumber(n);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("ar-EG-u-nu-latn") : "—";

const TABS = [
  { id: "purchases", label: "فواتير المشتريات" },
  { id: "payments", label: "المدفوعات" },
  { id: "cheques", label: "الشيكات" },
];

export default function SupplierProfilePage() {
  const { id } = useParams();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("purchases");
  const [tabData, setTabData] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    api.get(`/api/suppliers/${id}`).then(r => setSupplier(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setTabLoading(true);
    const load = async () => {
      try {
        if (activeTab === "purchases") {
          const r = await api.get(`/api/purchases?supplier_id=${id}&limit=100`);
          setTabData(r.data.data || []);
        } else if (activeTab === "payments") {
          const r = await api.get(`/api/payments?party_type=supplier&party_id=${id}`);
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
  if (!supplier) return <div className="flex items-center justify-center h-full font-black" style={{ color: "var(--text-muted)" }}>المورد غير موجود</div>;

  const balance = Number(supplier.opening_balance || 0);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--bg-base)" }} dir="rtl" data-help-root="supplier_profile">
      <div className="flex items-center gap-2 px-4 lg:px-6 py-3 border-b text-2sm font-bold shrink-0" style={{ backgroundColor: "var(--bg-surface)", borderBottomColor: "var(--border-subtle)", color: "var(--text-secondary)" }} data-help="breadcrumb">
        <Link to="/definitions/suppliers" className="flex items-center gap-1 hover:text-slate-800"><ChevronLeft className="h-3.5 w-3.5" /> الموردين</Link>
        <span>/</span><span style={{ color: "var(--text-primary)" }}>{supplier.name}</span>
      </div>

      <div className="mx-3 lg:mx-4 mt-4 rounded-2xl border shadow-sm p-5 shrink-0" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }} data-help="info-card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 shadow-lg shadow-orange-200 text-white font-black text-[22px]">
              {supplier.name?.charAt(0)}
            </div>
            <div>
              <h1 className="text-[20px] font-black" style={{ color: "var(--text-primary)" }}>{supplier.name}</h1>
              <div className="flex items-center gap-4 mt-1 text-2sm font-bold" style={{ color: "var(--text-secondary)" }}>
                {supplier.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {supplier.phone}</span>}
                {supplier.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {supplier.email}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-3 text-center min-w-[120px] ${balance > 0 ? "bg-rose-50 border border-rose-200" : "bg-emerald-50 border border-emerald-200"}`}>
              <div className="text-[11px] font-black uppercase tracking-wider mb-0.5" style={{ color: "var(--text-secondary)" }}>مستحق للمورد</div>
              <div className={`text-[18px] number-fmt-primary ${balance > 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmt(Math.abs(balance))}</div>
              <div className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>ج.م</div>
            </div>
            <Link to={`/payments/new?party_type=supplier&party_id=${id}`}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-orange-600 px-4 text-2sm font-black text-white hover:bg-orange-700">
              <Plus className="h-4 w-4" /> سداد دفعة
            </Link>
          </div>
        </div>
      </div>

      <div className="flex gap-1 px-3 lg:px-4 mt-4 shrink-0" data-help="profile-tabs">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-xl text-2sm font-black transition-colors ${activeTab === t.id ? "bg-orange-600 text-white shadow-md" : "border hover:bg-slate-50"}`}
            style={activeTab === t.id ? {} : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3 lg:p-4" data-help="tab-content">
        <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
          {tabLoading ? (
            <div className="flex items-center justify-center h-40 font-black animate-pulse" style={{ color: "var(--text-muted)" }}>جاري التحميل...</div>
          ) : tabData.length === 0 ? (
            <div className="flex items-center justify-center h-40 font-black" style={{ color: "var(--text-muted)" }}>لا توجد بيانات</div>
          ) : (
            <table className="w-full text-2sm">
              <thead className="border-b" style={{ backgroundColor: "var(--bg-overlay)", borderBottomColor: "var(--border-normal)" }}>
                <tr>
                  {activeTab === "purchases" && ["رقم الفاتورة", "التاريخ", "الإجمالي", "الحالة"].map(h => <th key={h} className="px-4 py-3 text-right font-black text-[11px] uppercase" style={{ color: "var(--text-secondary)" }}>{h}</th>)}
                  {activeTab === "payments" && ["الكود", "المبلغ", "الوسيلة", "التاريخ"].map(h => <th key={h} className="px-4 py-3 text-right font-black text-[11px] uppercase" style={{ color: "var(--text-secondary)" }}>{h}</th>)}
                  {activeTab === "cheques" && ["رقم الشيك", "المبلغ", "البنك", "الاستحقاق", "الحالة"].map(h => <th key={h} className="px-4 py-3 text-right font-black text-[11px] uppercase" style={{ color: "var(--text-secondary)" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {tabData.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-slate-50" style={{ borderBottomColor: "var(--border-subtle)" }}>
                    {activeTab === "purchases" && <>
                      <td className="px-4 py-3 font-mono text-[11px] text-orange-700">{row.doc_no || `#${row.id}`}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmtDate(row.created_at)}</td>
                      <td className="px-4 py-3 number-fmt-primary">{fmt(row.total)} ج.م</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-black text-orange-700">{row.status || "—"}</span></td>
                    </>}
                    {activeTab === "payments" && <>
                      <td className="px-4 py-3 font-mono text-[11px]">{row.doc_no || `PAY-${row.id}`}</td>
                      <td className="px-4 py-3 number-fmt-primary text-rose-700">{fmt(row.amount)} ج.م</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{row.method_name || row.method}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmtDate(row.created_at)}</td>
                    </>}
                    {activeTab === "cheques" && <>
                      <td className="px-4 py-3 font-mono text-[11px]">{row.cheque_no}</td>
                      <td className="px-4 py-3 number-fmt-primary">{fmt(row.amount)} ج.م</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{row.bank_name || "—"}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmtDate(row.due_date)}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-black text-violet-700">{row.status}</span></td>
                    </>}
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
