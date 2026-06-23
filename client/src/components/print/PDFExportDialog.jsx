import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileImage, Loader2, Eye, EyeOff, ArrowUp, ArrowDown, Check } from "lucide-react";
import Modal from "../ui/Modal";
import { useDetach } from "../../hooks/useDetach";

const PAPER_SIZES = [
  { id: "A4", label: "A4 (210×297mm)" },
  { id: "A5", label: "A5 (148×210mm)" },
  { id: "Letter", label: "Letter (216×279mm)" },
];

const FONT_SIZES = [
  { id: "small", label: "صغير" },
  { id: "medium", label: "متوسط" },
  { id: "large", label: "كبير" },
];

export default function PDFExportDialog({
  open,
  onClose,
  columns = [],
  title = "",
  onExport,
}) {
  const { handleDetach } = useDetach("pdf-export", {
    onClose, getState: () => ({ columns, title }), actions: { export: (data) => onExport?.(data) },
  });
  const [orientation, setOrientation] = useState("portrait");
  const [paperSize, setPaperSize] = useState("A4");
  const [fontSize, setFontSize] = useState("medium");
  const [showTotals, setShowTotals] = useState(true);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [selectedColumns, setSelectedColumns] = useState(() =>
    columns.filter((c) => c.defaultVisible !== false).map((c) => c.id || c.key)
  );
  const [columnOrder, setColumnOrder] = useState(() =>
    columns.map((c) => c.id || c.key)
  );
  const [exporting, setExporting] = useState(false);

  const orderedColumns = useMemo(() => {
    const colMap = {};
    columns.forEach((c) => { colMap[c.id || c.key] = c; });
    return columnOrder.map((id) => colMap[id]).filter(Boolean);
  }, [columns, columnOrder]);

  const visibleColumns = orderedColumns.filter((c) => selectedColumns.includes(c.id || c.key));

  function toggleColumn(colId) {
    setSelectedColumns((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
    );
  }

  function moveColumn(colId, direction) {
    setColumnOrder((prev) => {
      const idx = prev.indexOf(colId);
      if (idx === -1) return prev;
      const next = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  async function handleGenerate() {
    setExporting(true);
    try {
      const exportColumns = visibleColumns.map((c) => ({
        key: c.key || c.id,
        label: c.label || c.header || c.key || c.id,
        type: c.type,
      }));
      const params = {
        orientation,
        paperSize,
        fontSize,
        showTotals,
        showPageNumbers,
      };
      await onExport(exportColumns, params);
      onClose();
    } catch (e) {
      // error handled upstream
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} onDetach={handleDetach} title="إعدادات تصدير PDF" maxWidth="max-w-3xl">
      <div className="flex flex-col md:flex-row gap-6 mt-4" style={{ minHeight: 400 }}>
        {/* Left: Column Selection */}
        <div className="w-full md:w-1/2 border-l border-zinc-200 pl-4">
          <h4 className="text-sm font-black text-zinc-800 mb-3">اختيار الأعمدة</h4>
          <div className="space-y-1 max-h-[360px] overflow-y-auto">
            {orderedColumns.map((col, idx) => {
              const colId = col.id || col.key;
              const isSelected = selectedColumns.includes(colId);
              return (
                <div
                  key={colId}
                  className="flex items-center justify-between group px-2 py-1.5 rounded-xl hover:bg-zinc-50"
                >
                  <button
                    onClick={() => toggleColumn(colId)}
                    className="flex items-center gap-2.5 flex-1 text-right"
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected ? "bg-emerald-500 border-emerald-500" : "border-zinc-300"
                      }`}
                    >
                      {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    <span
                      className={`text-2sm font-bold ${
                        isSelected ? "text-zinc-800" : "text-zinc-400 line-through"
                      }`}
                    >
                      {col.label || col.header}
                    </span>
                  </button>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => moveColumn(colId, -1)}
                      disabled={idx === 0}
                      className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 disabled:opacity-30"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      onClick={() => moveColumn(colId, 1)}
                      disabled={idx === orderedColumns.length - 1}
                      className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 disabled:opacity-30"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setSelectedColumns(columns.map((c) => c.id || c.key))}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 text-[11px] font-bold text-zinc-600 hover:bg-zinc-200"
            >
              تحديد الكل
            </button>
            <button
              onClick={() => setSelectedColumns([])}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 text-[11px] font-bold text-zinc-600 hover:bg-zinc-200"
            >
              إلغاء الكل
            </button>
          </div>
        </div>

        {/* Right: Style Options */}
        <div className="w-full md:w-1/2">
          <h4 className="text-sm font-black text-zinc-800 mb-3">خيارات التنسيق</h4>
          <div className="space-y-4">
            {/* Orientation */}
            <div>
              <label className="text-[11px] font-bold text-zinc-500 block mb-1.5">الاتجاه</label>
              <div className="flex gap-2">
                {["portrait", "landscape"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setOrientation(opt)}
                    className={`flex-1 px-3 py-2 rounded-xl text-2sm font-bold border transition-all ${
                      orientation === opt
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {opt === "portrait" ? "طولي" : "عرضي"}
                  </button>
                ))}
              </div>
            </div>

            {/* Paper Size */}
            <div>
              <label className="text-[11px] font-bold text-zinc-500 block mb-1.5">حجم الورق</label>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm font-bold focus:outline-none focus:border-emerald-500"
              >
                {PAPER_SIZES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Font Size */}
            <div>
              <label className="text-[11px] font-bold text-zinc-500 block mb-1.5">حجم الخط</label>
              <div className="flex gap-2">
                {FONT_SIZES.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFontSize(f.id)}
                    className={`flex-1 px-3 py-2 rounded-xl text-2sm font-bold border transition-all ${
                      fontSize === f.id
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-2sm font-bold text-zinc-700">إظهار صف المجاميع</span>
                <button
                  onClick={() => setShowTotals(!showTotals)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    showTotals ? "bg-emerald-500" : "bg-zinc-300"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      showTotals ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-2sm font-bold text-zinc-700">ترقيم الصفحات</span>
                <button
                  onClick={() => setShowPageNumbers(!showPageNumbers)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    showPageNumbers ? "bg-emerald-500" : "bg-zinc-300"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      showPageNumbers ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
        <div className="text-[11px] font-bold text-zinc-500">
          <span className="text-zinc-800">{visibleColumns.length}</span> عمود محدد ·{" "}
          <span className="text-zinc-800">{orientation === "portrait" ? "طولي" : "عرضي"}</span> ·{" "}
          <span className="text-zinc-800">{paperSize}</span> ·{" "}
          <span className="text-zinc-800">
            {fontSize === "small" ? "صغير" : fontSize === "medium" ? "متوسط" : "كبير"}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-zinc-100">
        <button
          onClick={onClose}
          className="btn-danger px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
        >
          إلغاء
        </button>
        <button
          onClick={handleGenerate}
          disabled={exporting || visibleColumns.length === 0}
          className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
        >
          {exporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FileImage size={16} />
          )}
          {exporting ? "جاري التصدير..." : "تصدير PDF"}
        </button>
      </div>
    </Modal>
  );
}
