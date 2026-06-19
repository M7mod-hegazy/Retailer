import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";
import { usePageTour } from "../../hooks/usePageTour";
import { formatNumber } from "../../utils/currency";
import api from "../../services/api";
import toast from "react-hot-toast";
import AccountExportModal from "../accounts/AccountExportModal";

export default function SuppliersListPage() {
  usePageTour('suppliers');
  const navigate = useNavigate();
  const [showExport, setShowExport] = useState(false);
  const [exportData, setExportData] = useState([]);

  const handleExportClick = async () => {
    try {
      const res = await api.get("/api/suppliers");
      setExportData(res.data.data || []);
      setShowExport(true);
    } catch {
      toast.error("فشل تحميل بيانات الموردين للتصدير");
    }
  };

  return (
    <>
    <SimpleCrudPage
      pageKey="suppliers"
      title="الموردون"
      description="إدارة الموردين وشروط الدفع والأرصدة. انقر على صف لعرض الملف الكامل."
      endpoint="/api/suppliers"
      importPath="/accounts/suppliers/import"
      onExport={handleExportClick}
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
              {formatNumber(v, { decimals: 2 })}
              {Number(v) < 0 && <span className="mr-1 text-[11px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">دائن</span>}
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
      <AccountExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        entityType="suppliers"
        accounts={exportData}
      />
    </>
  );
}
