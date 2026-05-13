import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { 
  ArrowRightLeft, 
  Plus, 
  Calendar, 
  User, 
  DollarSign, 
  Filter, 
  Download,
  ChevronRight,
  Eye,
  MoreVertical,
  Banknote,
  Search,
  ArrowUpRight,
  CreditCard,
  Briefcase
} from "lucide-react";
import { Link } from "react-router-dom";
import TodayInvoicesButton from "../../components/pos/TodayInvoicesButton";
import PermissionGate from "../../components/ui/PermissionGate";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}

function StatCard({ label, value, icon: Icon, colorClass = "text-slate-600", bgClass = "bg-slate-50" }) {
  return (
    <div className="flex items-center gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className={`flex h-12 w-12 items-center justify-center rounded-sm ${bgClass}`}>
        <Icon className={`h-6 w-6 ${colorClass}`} />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-[20px] font-black text-slate-800">{value}</span>
      </div>
    </div>
  );
}

export default function PaymentsListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function loadRows() {
    setLoading(true);
    try {
      const response = await api.get("/api/payments");
      setRows(response.data.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  const stats = useMemo(() => {
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const count = rows.length;
    const collections = rows.filter(r => r.party_type === 'customer').reduce((sum, r) => sum + Number(r.amount), 0);
    const expenditures = rows.filter(r => r.party_type === 'supplier').reduce((sum, r) => sum + Number(r.amount), 0);
    
    return { 
      total: formatMoney(total), 
      count,
      collections: formatMoney(collections),
      expenditures: formatMoney(expenditures)
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => 
      (r.id?.toString() || "").includes(query) ||
      (r.party_id?.toString() || "").includes(query) ||
      (r.method_name || "").includes(query)
    );
  }, [rows, query]);

  return (
    <div className="standard-page-container font-sans flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-black text-slate-800">سجل المقبوضات والمدفوعات</h1>
          <p className="text-[13px] font-bold text-slate-400">متابعة كافة الحركات المالية الصادرة والواردة وتوزيعاتها</p>
        </div>
        <div className="flex items-center gap-2">
          <TodayInvoicesButton variant="ghost" />
          <PermissionGate page="payments" action="add">
            <Link
              to="/payments/new"
              className="flex items-center gap-2 rounded-sm bg-slate-800 px-6 py-2.5 text-[14px] font-black text-white shadow-lg transition-all hover:bg-slate-700 hover:shadow-xl active:scale-95"
            >
              <Plus className="h-4 w-4" /> إضافة حركة مالية
            </Link>
          </PermissionGate>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm border-r-4 border-r-emerald-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-emerald-50 text-emerald-600">
            <ArrowUpRight className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">إجمالي المقبوضات (تحصيل)</span>
            <div className="flex items-baseline gap-1">
               <span className="text-[20px] font-black text-slate-800">{stats.collections}</span>
               <span className="text-[10px] font-bold text-slate-400">ج.م</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm border-r-4 border-r-rose-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-rose-50 text-rose-600">
            <DollarSign className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">إجمالي المدفوعات (سداد)</span>
            <div className="flex items-baseline gap-1">
               <span className="text-[20px] font-black text-slate-800">{stats.expenditures}</span>
               <span className="text-[10px] font-bold text-slate-400">ج.م</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm border-r-4 border-r-blue-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-blue-50 text-blue-600">
            <ArrowRightLeft className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">عدد الحركات</span>
            <span className="text-[20px] font-black text-slate-800">{stats.count} معاملة</span>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex flex-col rounded-md border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Table Header/Filter Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="بحث في الحركات..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="rounded-sm border border-slate-200 bg-white py-1.5 pl-4 pr-10 text-[12px] font-bold text-slate-600 outline-none hover:border-slate-300 focus:border-slate-800" 
              />
            </div>
            <PermissionGate page="payments" action="export">
              <button className="flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                <Download className="h-3.5 w-3.5" /> تصدير PDF
              </button>
            </PermissionGate>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
             <Filter className="h-3 w-3" />
             تصفية حسب التاريخ
          </div>
        </div>

        {/* The Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase text-slate-500">
                <th className="px-6 py-4">رقم الحركة</th>
                <th className="px-6 py-4">نوع الطرف</th>
                <th className="px-6 py-4">الطرف</th>
                <th className="px-6 py-4">الوسيلة</th>
                <th className="px-6 py-4">التاريخ</th>
                <th className="px-6 py-4 text-left">المبلغ</th>
                <th className="px-6 py-4 text-center">أدوات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-20 text-center text-[13px] font-bold text-slate-400 animate-pulse">جاري تحميل السجلات...</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-20 text-center text-[13px] font-bold text-slate-400">لا توجد حركات مالية مطابقة</td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="group hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${row.party_type === 'customer' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        <span className="font-mono text-[13px] font-black text-slate-800">PAY-{String(row.id).padStart(5, '0')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`rounded-sm px-2 py-0.5 text-[10px] font-black uppercase ${row.party_type === 'customer' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                          {row.party_type === 'customer' ? 'تحصيل عميل' : 'سداد مورد'}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {row.party_type === 'customer' ? <User className="h-3.5 w-3.5" /> : <Briefcase className="h-3.5 w-3.5" />}
                        </div>
                        <span className="text-[13px] font-bold text-slate-700">{row.party_name || `طرف #${row.party_id}`}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2 text-slate-500 font-bold text-[12px]">
                          {row.method_type === 'bank' ? <CreditCard className="h-3.5 w-3.5 opacity-50" /> : <Banknote className="h-3.5 w-3.5 opacity-50" />}
                          {row.method_name || row.method}
                       </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar className="h-3.5 w-3.5 opacity-50" />
                        <span className="text-[12px] font-medium">{new Date(row.created_at).toLocaleDateString("ar-EG")}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-left">
                      <span className={`font-mono text-[14px] font-black ${row.party_type === 'customer' ? 'text-emerald-700' : 'text-rose-700'}`}>
                         {formatMoney(row.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button className="flex h-8 w-8 items-center justify-center rounded-sm bg-slate-800 text-white hover:bg-slate-700 transition-colors shadow-md">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="flex h-8 w-8 items-center justify-center rounded-sm text-slate-300 hover:bg-slate-100 hover:text-slate-800 transition-colors">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
