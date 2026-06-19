import React, { useEffect, useMemo, useState } from "react";
import { CheckSquare, Download, FileSpreadsheet, Square } from "lucide-react";
import Modal from "../../components/ui/Modal";
import api from "../../services/api";
import { EXPORT_FIELDS, exportItemsToExcel } from "../../utils/excelImportExport";

const DEFAULT_FIELDS = ["code", "name", "barcode", "category_name", "unit_name", "purchase_price", "sale_price", "wholesale_price", "stock_quantity", "min_stock_qty"];

export default function ItemExportModal({ open, onClose, items, filteredItems, selectedItems, selectedCategoryName }) {
  const [selectedFields, setSelectedFields] = useState(DEFAULT_FIELDS);
  const [scope, setScope] = useState("filtered");
  const [databaseItems, setDatabaseItems] = useState(items || []);

  useEffect(() => {
    if (!open) return;
    setDatabaseItems(items || []);
    api.get("/api/items")
      .then((response) => {
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        if (rows.length) setDatabaseItems(rows);
      })
      .catch(() => {});
  }, [items, open]);

  const exportRows = useMemo(() => {
    if (scope === "selected") return selectedItems;
    if (scope === "filtered") return filteredItems;
    return databaseItems;
  }, [databaseItems, filteredItems, scope, selectedItems]);

  const toggleField = (key) => {
    setSelectedFields((prev) => (prev.includes(key) ? prev.filter((field) => field !== key) : [...prev, key]));
  };

  const handleExport = () => {
    if (!exportRows.length || !selectedFields.length) return;
    const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const category = selectedCategoryName || "all";
    exportItemsToExcel(exportRows, selectedFields, `items-${category}-${stamp}.xlsx`);
    onClose?.();
  };

  return (
    <Modal open={open} onClose={onClose} title="تصدير الأصناف إلى Excel" maxWidth="max-w-5xl">
      <div className="space-y-6" dir="rtl">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { key: "filtered", label: "المعروض حاليا", count: filteredItems.length },
            { key: "selected", label: "المحدد فقط", count: selectedItems.length },
            { key: "all", label: "كل قاعدة الأصناف", count: databaseItems.length },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setScope(item.key)}
              className={`rounded-sm border px-4 py-3 text-right transition-all ${
                scope === item.key ? "border-primary bg-primary text-white shadow-lg" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="block text-sm font-black">{item.label}</span>
              <span className={`mt-1 block text-[11px] font-bold ${scope === item.key ? "text-white/70" : "text-slate-400"}`}>{item.count} صنف</span>
            </button>
          ))}
        </div>

        <div className="rounded-sm border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-black text-slate-800">حقول ملف التصدير</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFields(selectedFields.length === EXPORT_FIELDS.length ? [] : EXPORT_FIELDS.map((field) => field.key))}
              className="text-[11px] font-black text-slate-500 hover:text-slate-900"
            >
              {selectedFields.length === EXPORT_FIELDS.length ? "إلغاء الكل" : "تحديد الكل"}
            </button>
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {EXPORT_FIELDS.map((field) => {
              const checked = selectedFields.includes(field.key);
              return (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => toggleField(field.key)}
                  className={`flex items-center justify-between rounded-sm border px-3 py-2 text-2sm font-bold transition-all ${
                    checked ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{field.label}</span>
                  {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-300" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="text-2sm font-bold text-slate-500">
            سيتم تصدير {exportRows.length} صنف مع {selectedFields.length} حقل بصيغة Excel قابلة للاستيراد مرة أخرى.
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={!exportRows.length || !selectedFields.length}
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-2.5 text-sm font-black text-white shadow-lg transition hover:bg-primary-600 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            تصدير Excel
          </button>
        </div>
      </div>
    </Modal>
  );
}
