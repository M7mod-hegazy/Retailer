import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Upload } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import Modal from "../../components/ui/Modal";
import {
  ITEM_FIELDS,
  detectColumnHeaders,
  detectHeaderRow,
  parseExcelFile,
  parseMappedRows,
  toApiPayload,
  normalizeKey,
} from "../../utils/excelImportExport";

const UPDATE_FIELDS = ["name", "name_en", "barcode", "category_name", "unit_name", "purchase_price", "sale_price", "wholesale_price", "min_stock_qty", "tax_rate", "description", "is_active"];

function findMatch(row, items, matchBy) {
  const key = normalizeKey(row[matchBy]);
  if (!key) return null;
  return items.find((item) => normalizeKey(item[matchBy]) === key) || null;
}

export default function ItemSmartUpdateModal({ open, onClose, items, categories, units, selectedCategoryId, onUpdated }) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState([]);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [mapping, setMapping] = useState({});
  const [matchBy, setMatchBy] = useState("barcode");
  const [selectedFields, setSelectedFields] = useState(["purchase_price", "sale_price", "wholesale_price", "min_stock_qty"]);
  const [databaseItems, setDatabaseItems] = useState(items || []);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const headers = rawRows[headerIndex] || [];
  const parsedRows = useMemo(() => parseMappedRows(rawRows, headerIndex, mapping), [headerIndex, mapping, rawRows]);
  const previewRows = useMemo(() => parsedRows.map((row) => ({ ...row, __existing: findMatch(row, databaseItems, matchBy) })), [databaseItems, matchBy, parsedRows]);
  const matchedCount = previewRows.filter((row) => row.__existing).length;

  const reset = () => {
    setStep(1);
    setFileName("");
    setRawRows([]);
    setHeaderIndex(0);
    setMapping({});
    setMatchBy("barcode");
    setSelectedFields(["purchase_price", "sale_price", "wholesale_price", "min_stock_qty"]);
    setLoading(false);
    setResult(null);
  };

  const close = () => {
    reset();
    onClose?.();
  };

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

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseExcelFile(file);
      const detected = detectHeaderRow(parsed.rows);
      setFileName(file.name);
      setRawRows(parsed.rows);
      setHeaderIndex(detected.index);
      setMapping(detectColumnHeaders(parsed.rows[detected.index] || []));
      setStep(2);
    } catch {
      toast.error("تعذر قراءة ملف التحديث.");
    } finally {
      event.target.value = "";
    }
  };

  const toggleField = (field) => {
    setSelectedFields((prev) => (prev.includes(field) ? prev.filter((key) => key !== field) : [...prev, field]));
  };

  const handleUpdate = async () => {
    const rows = previewRows
      .filter((row) => row.__existing)
      .map((row) => {
        const payload = toApiPayload(row, categories, units, selectedCategoryId);
        const picked = {};
        selectedFields.forEach((field) => {
          if (payload[field] !== undefined) picked[field] = payload[field];
        });
        return {
          action: "update",
          existing_id: row.__existing.id,
          match_field: matchBy,
          source_row: row.__rowNumber,
          payload: picked,
        };
      });

    if (!rows.length) {
      toast.error("لا توجد صفوف مطابقة للتحديث.");
      return;
    }
    if (!selectedFields.length) {
      toast.error("اختر حقلا واحدا على الأقل للتحديث.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/api/items/bulk-update", { rows, create_categories: true });
      setResult(response.data?.data || {});
      setStep(4);
      await onUpdated?.();
    } catch (error) {
      toast.error(error?.response?.data?.message || "فشل التحديث الذكي.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="تحديث ذكي من Excel" maxWidth="max-w-7xl">
      <div className="space-y-5" dir="rtl">
        {step === 1 ? (
          <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <RefreshCw className="mx-auto h-12 w-12 text-slate-700" />
            <h3 className="mt-4 text-[22px] font-black text-slate-900">ارفع ملف تحديث الأسعار أو البيانات</h3>
            <p className="mt-2 text-sm font-bold text-slate-500">لن يتم إنشاء أصناف جديدة هنا. الصفوف غير المطابقة ستظهر للمراجعة ويتم تجاهلها.</p>
            <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-sm bg-slate-900 px-6 py-3 text-sm font-black text-white shadow-lg hover:bg-slate-800">
              <Upload className="h-4 w-4" />
              اختيار ملف
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-black text-slate-900">إعداد المطابقة والحقول</h3>
                <p className="text-2sm font-bold text-slate-500">الملف: {fileName}</p>
              </div>
              <button type="button" onClick={() => setStep(3)} className="rounded-sm bg-slate-900 px-5 py-2.5 text-2sm font-black text-white">معاينة التغييرات</button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="space-y-4 rounded-sm border border-slate-200 bg-slate-50 p-4">
                <div>
                  <label className="text-[11px] font-black text-slate-500">المطابقة حسب</label>
                  <select value={matchBy} onChange={(event) => setMatchBy(event.target.value)} className="mt-2 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-2sm font-bold">
                    <option value="barcode">الباركود</option>
                    <option value="code">الكود</option>
                    <option value="name">الاسم</option>
                  </select>
                </div>
                <div>
                  <div className="text-[11px] font-black text-slate-500">الحقول التي سيتم تحديثها</div>
                  <div className="mt-2 space-y-2">
                    {UPDATE_FIELDS.map((field) => {
                      const label = ITEM_FIELDS.find((entry) => entry.key === field)?.label || field;
                      return (
                        <label key={field} className="flex items-center gap-2 text-2sm font-bold text-slate-700">
                          <input type="checkbox" checked={selectedFields.includes(field)} onChange={() => toggleField(field)} />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="overflow-auto rounded-sm border border-slate-200">
                <table className="w-full min-w-[900px] text-right text-2sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {headers.map((header, index) => (
                        <th key={`${header}-${index}`} className="border-l border-slate-100 px-3 py-3 align-top">
                          <div className="font-black text-slate-800">{header || `عمود ${index + 1}`}</div>
                          <select value={mapping[index] || ""} onChange={(event) => setMapping((prev) => ({ ...prev, [index]: event.target.value }))} className="mt-2 w-full rounded-sm border border-slate-200 bg-white px-2 py-2 text-2sm font-bold">
                            <option value="">تجاهل</option>
                            {ITEM_FIELDS.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawRows.slice(headerIndex + 1, headerIndex + 5).map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t border-slate-100">
                        {headers.map((_, index) => <td key={index} className="border-l border-slate-50 px-3 py-2 text-slate-600">{row[index]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-black text-slate-900">معاينة التحديث</h3>
                <p className="text-2sm font-bold text-slate-500">تمت مطابقة {matchedCount} من {previewRows.length} صف.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(2)} className="rounded-sm border border-slate-200 bg-white px-4 py-2 text-2sm font-black text-slate-600">رجوع</button>
                <button type="button" onClick={handleUpdate} disabled={loading} className="rounded-sm bg-emerald-600 px-5 py-2 text-2sm font-black text-white shadow-lg disabled:opacity-40">{loading ? "جاري التحديث..." : "تأكيد التحديث"}</button>
              </div>
            </div>
            <div className="max-h-[520px] overflow-auto rounded-sm border border-slate-200">
              <table className="w-full min-w-[1050px] text-right text-2sm">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-3">الصف</th>
                    <th className="px-3 py-3">المطابقة</th>
                    <th className="px-3 py-3">الصنف الحالي</th>
                    <th className="px-3 py-3">تغييرات مختصرة</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => {
                    const payload = toApiPayload(row, categories, units, selectedCategoryId);
                    return (
                      <tr key={row.__rowNumber} className={`border-t border-slate-100 ${row.__existing ? "bg-white" : "bg-amber-50"}`}>
                        <td className="px-3 py-2 font-black">{row.__rowNumber}</td>
                        <td className="px-3 py-2">{row.__existing ? "مطابق" : <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3 w-3" /> غير مطابق</span>}</td>
                        <td className="px-3 py-2 font-bold text-slate-800">{row.__existing?.name || row[matchBy] || "—"}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {row.__existing
                            ? selectedFields.map((field) => `${ITEM_FIELDS.find((entry) => entry.key === field)?.label || field}: ${row.__existing[field] ?? ""} ← ${payload[field] ?? ""}`).join(" | ")
                            : "سيتم تجاهل الصف لأنه غير موجود"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="rounded-sm border border-slate-200 bg-slate-50 px-6 py-10 text-center">
            {Number(result?.failed || 0) > 0 ? <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" /> : <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />}
            <h3 className="mt-4 text-[22px] font-black text-slate-900">انتهى التحديث الذكي</h3>
            <p className="mt-2 text-sm font-bold text-slate-500">تم تحديث {result?.updated || 0}، تخطي {result?.skipped || 0}، فشل {result?.failed || 0}.</p>
            <button type="button" onClick={close} className="mt-6 rounded-sm bg-slate-900 px-8 py-3 text-sm font-black text-white">إغلاق</button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
