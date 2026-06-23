import React, { useEffect, useMemo, useState } from "react";
import { CheckSquare, Download, FileSpreadsheet, Square } from "lucide-react";
import Modal from "../../components/ui/Modal";
import { ACCOUNT_EXPORT_FIELDS, exportAccountsToExcel } from "../../utils/excelImportExport";

const DEFAULT_FIELDS = ["name", "phone", "address", "opening_balance"];

export default function AccountExportModal({ open, onClose, entityType, accounts }) {
  const [selectedFields, setSelectedFields] = useState(DEFAULT_FIELDS);

  useEffect(() => {
    if (open) setSelectedFields(DEFAULT_FIELDS);
  }, [open]);

  const toggleField = (key) => {
    setSelectedFields((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  };

  const handleExport = () => {
    if (!accounts?.length || !selectedFields.length) return;
    const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const entityLabel = entityType === "customers" ? "customers" : "suppliers";
    exportAccountsToExcel(accounts, selectedFields, `${entityLabel}-${stamp}.xlsx`);
    onClose?.();
  };

  const title = entityType === "customers" ? "تصدير العملاء إلى Excel" : "تصدير الموردين إلى Excel";

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-3xl" showDetach={false}>
      <div className="space-y-6" dir="rtl">
        <div className="rounded-sm border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-black text-slate-800">حقول ملف التصدير</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFields(selectedFields.length === ACCOUNT_EXPORT_FIELDS.length ? [] : ACCOUNT_EXPORT_FIELDS.map((f) => f.key))}
              className="text-[11px] font-black text-slate-500 hover:text-slate-900"
            >
              {selectedFields.length === ACCOUNT_EXPORT_FIELDS.length ? "إلغاء الكل" : "تحديد الكل"}
            </button>
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {ACCOUNT_EXPORT_FIELDS.map((field) => {
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
            سيتم تصدير {accounts?.length || 0} حساب مع {selectedFields.length} حقل بصيغة Excel.
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={!accounts?.length || !selectedFields.length}
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
