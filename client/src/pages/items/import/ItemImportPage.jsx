import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, History, Upload } from "lucide-react";
import api from "../../../services/api";
import ItemImportModal from "../ItemImportModal";
import ImportHistoryTab from "./ImportHistoryTab";

// Full-page Smart Upload surface. Hosts the proven import wizard inline (so no
// feature is lost) plus an Import History tab where re-download and undo live.
export default function ItemImportPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("upload");
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

  return (
    <div className="space-y-5 p-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/definitions/items")}
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            title="رجوع للأصناف"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-[20px] font-black text-slate-900">الرفع الذكي للأصناف</h1>
            <p className="text-2sm font-bold text-slate-500">استيراد الأصناف من Excel/CSV مع معاينة، تحقق آمن، وسجل قابل للتراجع.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-sm border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`flex items-center gap-2 rounded-sm px-4 py-2 text-2sm font-black transition ${tab === "upload" ? "bg-white text-emerald-700 shadow" : "text-slate-500"}`}
          >
            <Upload className="h-4 w-4" /> رفع جديد
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`flex items-center gap-2 rounded-sm px-4 py-2 text-2sm font-black transition ${tab === "history" ? "bg-white text-emerald-700 shadow" : "text-slate-500"}`}
          >
            <History className="h-4 w-4" /> السجل
          </button>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        {tab === "upload" ? (
          <ItemImportModal
            embedded
            open
            items={items}
            categories={categories}
            units={units}
            selectedCategoryId={null}
            onImported={loadRefData}
            onClose={() => navigate("/definitions/items")}
          />
        ) : (
          <ImportHistoryTab />
        )}
      </div>
    </div>
  );
}
