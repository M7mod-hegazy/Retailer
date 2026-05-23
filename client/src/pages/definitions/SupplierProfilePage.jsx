import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Truck, Phone, Mail, ChevronLeft, Plus } from "lucide-react";
import api from "../../services/api";

const fmt = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
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

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400 font-black animate-pulse">جاري التحميل...</div>;
  if (!supplier) return <div className="flex items-center justify-center h-full text-slate-400 font-black">المورد غير موجود</div>;

  const balance = Number(supplier.opening_balance || 0);

  return (
    <div className="flex flex-col h-full bg-slate-50" dir="rtl">
      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-slate-100 text-[12px] font-bold text-slate-500 shrink-0">
        <Link to="/definitions/suppliers" className="flex items-center gap-1 hover:text-slate-800"><ChevronLeft className="h-3.5 w-3.5" /> الموردين</Link>
        <span>/</span><span className="text-slate-800">{supplier.name}</span>
      </div>

      <div className="mx-4 mt-4 rounded-2xl bg-white border border-slate-200 shadow-sm p-5 shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 shadow-lg shadow-orange-200 text-white font-black text-[22px]">
              {supplier.name?.charAt(0)}
            </div>
            <div>
              <h1 className="text-[20px] font-black text-slate-900">{supplier.name}</h1>
              <div className="flex items-center gap-4 mt-1 text-[12px] text-slate-500 font-bold">
                {supplier.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {supplier.phone}</span>}
                {supplier.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {supplier.email}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-3 text-center min-w-[120px] ${balance > 0 ? "bg-rose-50 border border-rose-200" : "bg-emerald-50 border border-emerald-200"}`}>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5">مستحق للمورد</div>
              <div className={`text-[18px] font-black font-mono ${balance > 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmt(Math.abs(balance))}</div>
              <div className="text-[10px] text-slate-400 font-bold">ج.م</div>
            </div>
            <Link to={`/payments/new?party_type=supplier&party_id=${id}`}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-orange-600 px-4 text-[12px] font-black text-white hover:bg-orange-700">
              <Plus className="h-4 w-4" /> سداد دفعة
            </Link>
          </div>
        </div>
      </div>

      <div className="flex gap-1 px-4 mt-4 shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-xl text-[12px] font-black transition-colors ${activeTab === t.id ? "bg-orange-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {tabLoading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
          ) : tabData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-300 font-black">لا توجد بيانات</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {activeTab === "purchases" && ["رقم الفاتورة", "التاريخ", "الإجمالي", "الحالة"].map(h => <th key={h} className="px-4 py-3 text-right font-black text-slate-500 text-[11px] uppercase">{h}</th>)}
                  {activeTab === "payments" && ["الكود", "المبلغ", "الوسيلة", "التاريخ"].map(h => <th key={h} className="px-4 py-3 text-right font-black text-slate-500 text-[11px] uppercase">{h}</th>)}
                  {activeTab === "cheques" && ["رقم الشيك", "المبلغ", "البنك", "الاستحقاق", "الحالة"].map(h => <th key={h} className="px-4 py-3 text-right font-black text-slate-500 text-[11px] uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {tabData.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50">
                    {activeTab === "purchases" && <>
                      <td className="px-4 py-3 font-mono text-[11px] text-orange-700">{row.doc_no || `#${row.id}`}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(row.created_at)}</td>
                      <td className="px-4 py-3 font-black font-mono">{fmt(row.total)} ج.م</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black text-orange-700">{row.status || "—"}</span></td>
                    </>}
                    {activeTab === "payments" && <>
                      <td className="px-4 py-3 font-mono text-[11px]">{row.doc_no || `PAY-${row.id}`}</td>
                      <td className="px-4 py-3 font-black font-mono text-rose-700">{fmt(row.amount)} ج.م</td>
                      <td className="px-4 py-3 text-slate-500">{row.method_name || row.method}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(row.created_at)}</td>
                    </>}
                    {activeTab === "cheques" && <>
                      <td className="px-4 py-3 font-mono text-[11px]">{row.cheque_no}</td>
                      <td className="px-4 py-3 font-black font-mono">{fmt(row.amount)} ج.م</td>
                      <td className="px-4 py-3 text-slate-500">{row.bank_name || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(row.due_date)}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black text-violet-700">{row.status}</span></td>
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
