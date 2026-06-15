import React, { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { Plus, Search, Wrench } from "lucide-react";
import Button from "../../components/ui/Button";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";

const STATUS_LABELS = {
  received: { label: "استُلم", color: "bg-slate-100 text-slate-700" },
  diagnosing: { label: "تشخيص", color: "bg-blue-100 text-blue-700" },
  waiting_parts: { label: "انتظار قطع", color: "bg-amber-100 text-amber-700" },
  in_repair: { label: "قيد الإصلاح", color: "bg-indigo-100 text-indigo-700" },
  waiting_customer: { label: "انتظار العميل", color: "bg-purple-100 text-purple-700" },
  ready: { label: "جاهز للتسليم", color: "bg-emerald-100 text-emerald-700" },
  delivered: { label: "تم التسليم", color: "bg-green-100 text-green-700" },
  cancelled: { label: "ملغى", color: "bg-red-100 text-red-600" },
};

const PRIORITY_LABELS = {
  low: { label: "منخفضة", color: "text-slate-400" },
  normal: { label: "عادية", color: "text-slate-600" },
  high: { label: "عالية", color: "text-amber-600" },
  urgent: { label: "عاجلة", color: "text-red-600 font-black" },
};

export default function RepairOrdersList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const searchRef = useRef(null);
  const statusRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  const { data, isLoading } = useQuery({
    queryKey: ["repair-orders", search, status],
    queryFn: () => api.get("/api/repair-orders", { params: { search, status, limit: 100 } }).then(r => r.data),
    keepPreviousData: true,
  });

  const rows = data?.data || [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-black flex items-center gap-2">
          <Wrench className="h-5 w-5 text-orange-500" />
          أوامر الصيانة والإصلاح
        </h1>
        <Link to="new">
          <Button size="sm"><Plus className="h-4 w-4 me-1" />طلب جديد</Button>
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            ref={searchRef}
            className="w-full rounded-lg border border-slate-200 ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="بحث بالرقم أو الجهاز أو العميل..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => handleKeyDown(e, { nextRef: statusRef })}
          />
        </div>
        <select
          ref={statusRef}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          value={status}
          onChange={e => setStatus(e.target.value)}
          onKeyDown={e => handleKeyDown(e, { prevRef: searchRef })}
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="text-center text-slate-400 py-16">جاري التحميل...</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-slate-400 py-16">لا توجد أوامر صيانة</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-start">رقم الطلب</th>
                <th className="px-4 py-3 text-start">العميل</th>
                <th className="px-4 py-3 text-start">الجهاز</th>
                <th className="px-4 py-3 text-start">الحالة</th>
                <th className="px-4 py-3 text-start">الأولوية</th>
                <th className="px-4 py-3 text-end">التكلفة</th>
                <th className="px-4 py-3 text-start">تاريخ الاستلام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(row => {
                const st = STATUS_LABELS[row.status] || { label: row.status, color: "bg-slate-100 text-slate-600" };
                const pr = PRIORITY_LABELS[row.priority] || { label: row.priority, color: "text-slate-600" };
                return (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={String(row.id)} className="font-black text-orange-600 hover:underline">{row.order_number}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.customer_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{[row.device_brand, row.device_model].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-black ${st.color}`}>{st.label}</span>
                    </td>
                    <td className={`px-4 py-3 text-[12px] font-bold ${pr.color}`}>{pr.label}</td>
                    <td className="px-4 py-3 text-end font-bold">{Number(row.final_cost || row.estimated_cost || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-500">{row.received_at ? new Date(row.received_at).toLocaleDateString("ar-EG") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
