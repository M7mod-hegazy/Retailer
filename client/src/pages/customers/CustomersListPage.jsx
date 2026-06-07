import React from "react";
import { useNavigate } from "react-router-dom";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";
import { usePageTour } from "../../hooks/usePageTour";

export default function CustomersListPage() {
  usePageTour('customers');
  const navigate = useNavigate();

  return (
    <>
      {/* WA walk-in contacts redirect banner */}
      <div className="mx-4 mt-4 mb-0 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3">
        <span className="text-xl shrink-0">📱</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-green-800">جهات الاتصال المسجلة عبر واتساب (تسجيل سريع من نقطة البيع)</p>
          <p className="text-[11px] font-bold text-green-600 mt-0.5">هذه الجهات لا تظهر في القائمة أدناه — يمكن عرضها من تبويب واتساب في الإعدادات</p>
        </div>
        <button
          onClick={() => navigate("/settings?tab=whatsapp")}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-[12px] font-black text-white hover:bg-green-700 transition-all active:scale-95"
        >
          عرض جهات واتساب ←
        </button>
      </div>
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
    </>
  );
}
