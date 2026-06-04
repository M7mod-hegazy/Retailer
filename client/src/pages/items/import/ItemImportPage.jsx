import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, History, Upload } from "lucide-react";
import api from "../../../services/api";
import ImportHistoryTab from "./ImportHistoryTab";
import WizardShell from "./WizardShell";
import { useImportWizard } from "./useImportWizard";

// Full-page Smart Upload surface. Hosts the proven import wizard inline (so no
// feature is lost) plus an Import History tab where re-download and undo live.
export default function ItemImportPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") === "history" ? "history" : "upload");
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [items, setItems] = useState([]);

  const loadRefData = useCallback(async () => {
    // No `limit` returns the full catalog — needed so the wizard can tell new
    // rows apart from existing products (insert vs update).
    const [cats, us, its] = await Promise.allSettled([
      api.get("/api/categories"),
      api.get("/api/units"),
      api.get("/api/items"),
    ]);
    if (cats.status === "fulfilled") setCategories(Array.isArray(cats.value.data?.data) ? cats.value.data.data : []);
    if (us.status === "fulfilled") setUnits(Array.isArray(us.value.data?.data) ? us.value.data.data : []);
    if (its.status === "fulfilled") setItems(Array.isArray(its.value.data?.data) ? its.value.data.data : []);
  }, []);

  useEffect(() => { loadRefData(); }, [loadRefData]);
  useEffect(() => {
    setTab(searchParams.get("tab") === "history" ? "history" : "upload");
  }, [searchParams]);

  const wizard = useImportWizard({
    items,
    categories,
    units,
    selectedCategoryId: null,
    onImported: loadRefData,
  });

  const switchTab = (nextTab) => {
    setTab(nextTab);
    setSearchParams(nextTab === "history" ? { tab: "history" } : {});
  };

  return (
    <div className="space-y-6 p-6 w-full" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/definitions/items")}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 active:scale-95 hover:translate-x-1"
            title="رجوع للأصناف"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 font-display">الرفع الذكي للأصناف</h1>
            <p className="mt-1 text-sm font-medium text-slate-500 font-title">استيراد الأصناف من Excel/CSV مع معاينة، تحقق آمن، وسجل قابل للتراجع.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/60 bg-slate-50 p-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => switchTab("upload")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-250 ${tab === "upload" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-100" : "text-slate-500 hover:text-slate-800"}`}
          >
            <Upload className="h-4.5 w-4.5" /> رفع جديد
          </button>
          <button
            type="button"
            onClick={() => switchTab("history")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-250 ${tab === "history" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-100" : "text-slate-500 hover:text-slate-800"}`}
          >
            <History className="h-4.5 w-4.5" /> السجل
          </button>
        </div>
      </div>

      <div className="w-full">
        {tab === "upload" ? (
          <WizardShell wizard={wizard} />
        ) : (
          <ImportHistoryTab />
        )}
      </div>
    </div>
  );
}
