import React from "react";
import { useNavigate } from "react-router-dom";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";
import { usePageTour } from "../../hooks/usePageTour";

export default function CustomersListPage() {
  usePageTour('customers');
  const navigate = useNavigate();

  return (
    <SimpleCrudPage
      pageKey="customers"
      title="العملاء"
      description="عرض العملاء مع الرصيد والحد الائتماني. انقر على صف لعرض الملف الكامل."
      endpoint="/api/customers"
      fields={[
        { name: "name", label: "اسم العميل", required: true },
        { name: "phone", label: "الهاتف" },
        { name: "code", label: "الكود" },
        { name: "opening_balance", label: "الرصيد الافتتاحي", type: "number" },
        { name: "credit_limit", label: "الحد الائتماني", type: "number" },
      ]}
      columns={[
        { key: "code", label: "الكود" },
        { key: "name", label: "العميل" },
        { key: "phone", label: "الهاتف" },
        {
          key: "opening_balance",
          label: "الرصيد",
          render: (v) => (
            <span className={Number(v) < 0 ? "text-blue-600 font-black" : Number(v) > 0 ? "text-rose-600 font-black" : "text-emerald-700 font-black"}>
              {Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              {Number(v) < 0 && <span className="mr-1 text-[11px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">دائن</span>}
            </span>
          ),
        },
        { key: "credit_limit", label: "الحد" },
      ]}
      buildPayload={(form) => ({
        ...form,
        opening_balance: Number(form.opening_balance || 0),
        credit_limit: Number(form.credit_limit || 0),
      })}
      onRowClick={(row) => navigate(`/definitions/customers/${row.id}`)}
    />
  );
}
