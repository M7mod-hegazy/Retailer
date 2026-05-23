import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../services/api";
import DataGrid from "../../components/ui/DataGrid";
import PageWrapper from "../../components/ui/PageWrapper";

export default function CustomerDetailPage() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    api.get("/api/customers").then((response) => {
      const found = (response.data.data || []).find((entry) => String(entry.id) === String(id));
      setCustomer(found || null);
    }).catch(() => setCustomer(null));
  }, [id]);

  if (!customer) {
    return <section className="page-surface mx-auto max-w-4xl">لا توجد بيانات للعميل</section>;
  }

  return (
    <PageWrapper className="mx-auto max-w-5xl space-y-5 px-4 py-4">
      <section className="page-surface">
        <div className="page-header mb-0">
          <div>
            <h2 className="page-title">{customer.name}</h2>
            <p className="page-subtitle">ملف العميل والبيانات المالية الأساسية.</p>
          </div>
        </div>
      </section>
      {Number(customer.opening_balance) < 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3">
          <span className="text-[13px] font-bold text-blue-700">رصيد دائن (مبلغ لصالح العميل):</span>
          <span className="font-black font-mono text-blue-900">
            {Math.abs(Number(customer.opening_balance)).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
          </span>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["الهاتف", customer.phone || "-"],
          ["الرصيد", Number(customer.opening_balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })],
          ["الحد الائتماني", customer.credit_limit || 0],
          ["الحالة", customer.is_blacklisted ? "محظور" : "نشط"],
        ].map(([label, value]) => (
          <div key={label} className={`glass-panel rounded-[18px] p-4 ${label === "الرصيد" && Number(customer.opening_balance) < 0 ? "border-blue-200 bg-blue-50" : ""}`}>
            <div className="text-xs text-text-secondary">{label}</div>
            <div className={`mt-2 text-lg font-semibold ${label === "الرصيد" && Number(customer.opening_balance) < 0 ? "text-blue-700" : "text-text-primary"}`}>{value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
        <DataGrid
          data={[
            { id: 1, field: "الهاتف", value: customer.phone || "-" },
            { id: 2, field: "الرصيد", value: customer.opening_balance || 0 },
            { id: 3, field: "الحد الائتماني", value: customer.credit_limit || 0 },
            { id: 4, field: "محظور", value: customer.is_blacklisted ? "نعم" : "لا" },
          ]}
          rowKey="id"
          className="border-0"
          columns={[
            { id: "field", header: "البيان", width: 200, sortable: true, cellClass: "font-bold text-slate-800" },
            { id: "value", header: "القيمة", width: 400, sortable: true, cellClass: "text-slate-600 font-mono" },
          ]}
        />
      </div>
    </PageWrapper>
  );
}
