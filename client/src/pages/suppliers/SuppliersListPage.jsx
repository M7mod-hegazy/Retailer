import React from "react";
import { useNavigate } from "react-router-dom";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";
import { usePageTour } from "../../hooks/usePageTour";

export default function SuppliersListPage() {
  usePageTour('suppliers');
  const navigate = useNavigate();

  return (
    <SimpleCrudPage
      pageKey="suppliers"
      title="الموردون"
      description="إدارة الموردين وشروط الدفع والأرصدة. انقر على صف لعرض الملف الكامل."
      endpoint="/api/suppliers"
      fields={[
        { name: "name", label: "اسم المورد", required: true },
        { name: "phone", label: "الهاتف" },
        { name: "code", label: "الكود" },
        { name: "opening_balance", label: "الرصيد الافتتاحي", type: "number" },
        { name: "payment_terms", label: "شروط الدفع" },
      ]}
      columns={[
        { key: "code", label: "الكود" },
        { key: "name", label: "المورد" },
        { key: "phone", label: "الهاتف" },
        {
          key: "opening_balance",
          label: "الرصيد",
          render: (v) => (
            <span className={Number(v) < 0 ? "text-blue-600 font-black" : Number(v) > 0 ? "text-rose-600 font-black" : "text-emerald-700 font-black"}>
              {Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 })}
              {Number(v) < 0 && <span className="mr-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">دائن</span>}
            </span>
          ),
        },
        { key: "payment_terms", label: "شروط الدفع" },
      ]}
      buildPayload={(form) => ({
        ...form,
        opening_balance: Number(form.opening_balance || 0),
      })}
      onRowClick={(row) => navigate(`/definitions/suppliers/${row.id}`)}
    />
  );
}
