import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Radar, Upload, X } from "lucide-react";
import api from "../../services/api";
import Button from "../../components/ui/Button";

export default function ItemImportWizard({ onClose }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());

    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((value) => value.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = cols[index] ?? "";
      });
      return {
        name: row.name || row.item_name || "",
        barcode: row.barcode || "",
        price: row.price || row.sale_price || "0",
        purchase_price: row.purchase_price || row.price || row.sale_price || "0",
        code: row.code || "",
      };
    });
  }

  const handleFileUpload = async (event) => {
    const uploadedFile = event.target.files[0];
    setError("");
    setResults(null);
    setPreview([]);
    setFile(uploadedFile);
    if (!uploadedFile) return;

    const extension = uploadedFile.name.split(".").pop()?.toLowerCase();
    if (extension !== "csv") {
      setError("المعالج يدعم حالياً ملفات CSV فقط.");
      return;
    }

    try {
      const text = await uploadedFile.text();
      const rows = parseCsv(text).filter((row) => row.name);
      if (!rows.length) {
        setError("لم يتم العثور على بيانات صالحة داخل الملف.");
        return;
      }
      setPreview(rows.slice(0, 100));
      setStep(2);
    } catch (_error) {
      setError("فشل قراءة الملف. تأكد من أن الصيغة CSV سليمة.");
    }
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.post("/api/items/import", {
        rows: preview,
        overwrite_existing: false,
      });
      setResults(response.data.data);
      setStep(3);
    } catch {
      setResults({ success: 0, failed: preview.length });
      setError("فشل تنفيذ الاستيراد. راجع الملف ثم أعد المحاولة.");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, label: "رفع الملف", hint: "CSV فقط" },
    { id: 2, label: "مراجعة البيانات", hint: "حتى 100 صف" },
    { id: 3, label: "تنفيذ الاستيراد", hint: "النتيجة النهائية" },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(28,22,13,0.38)] px-4 py-6 backdrop-blur-md">
      <div className="glass-elevated relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[34px]">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,rgba(15,138,95,0.14),transparent_50%),radial-gradient(circle_at_top_left,rgba(194,154,96,0.12),transparent_38%)]" />

        <header className="relative flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-5 md:px-8">
          <div>
            <div className="auth-chip">
              <Radar className="h-4 w-4" />
              استيراد منظم وسريع
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-primary/10 text-primary">
                <FileSpreadsheet className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-[-0.04em] text-text-primary">معالج استيراد الأصناف</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  ارفع الملف، راجع أول الصفوف، ثم نفّذ الاستيراد من نفس الشاشة بدون تصميم منفصل أو مربك.
                </p>
              </div>
            </div>
          </div>

          <button type="button" onClick={onClose} className="btn-icon" aria-label="إغلاق">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="relative grid gap-6 overflow-y-auto px-6 py-6 md:px-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            {steps.map((item) => {
              const active = item.id === step;
              const done = item.id < step;
              return (
                <div key={item.id} className={`wizard-step ${active ? "wizard-step--active" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className="wizard-step__index">
                      {done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : item.id}
                    </div>
                    <div>
                      <div className={`text-sm font-black ${active ? "text-text-primary" : "text-text-secondary"}`}>{item.label}</div>
                      <div className="text-xs text-text-muted">{item.hint}</div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="workspace-card workspace-card--inset p-5">
              <div className="workspace-card__title">إرشادات سريعة</div>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-text-secondary">
                <li>استخدم الأعمدة: `name`, `barcode`, `price`, `purchase_price`, `code`.</li>
                <li>المعاينة تعرض أول 100 صف لتسريع المراجعة قبل التنفيذ.</li>
                <li>لا يتم استبدال الأصناف الحالية تلقائياً في هذا المسار.</li>
              </ul>
            </div>
          </aside>

          <section className="workspace-card min-h-[480px] overflow-hidden">
            <div className="workspace-card__body h-full">
              {step === 1 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-[28px] border border-dashed border-border-normal bg-[linear-gradient(180deg,rgba(255,255,255,0.65),rgba(245,239,229,0.8))] px-6 py-12 text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-primary/10 text-primary">
                    <Upload className="h-11 w-11" />
                  </div>
                  <h3 className="mt-6 text-3xl font-black tracking-[-0.04em] text-text-primary">ارفع ملف الأصناف</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-8 text-text-secondary">
                    اسحب ملف CSV هنا أو اختره من جهازك. سيتم تحليل الأعمدة وعرض معاينة قبل تنفيذ أي تغيير داخل قاعدة
                    البيانات.
                  </p>

                  <label className="mt-7 inline-flex cursor-pointer items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 px-5 py-3 text-sm font-bold text-primary transition hover:bg-primary/15">
                    <Upload className="me-2 h-4 w-4" />
                    اختيار ملف CSV
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                  </label>

                  {file ? (
                    <div className="mt-4 rounded-[18px] border border-border-subtle bg-[var(--bg-surface)] px-4 py-3 text-sm text-text-secondary">
                      الملف المختار: <span className="font-black text-text-primary">{file.name}</span>
                    </div>
                  ) : null}

                  {error ? (
                    <div className="mt-5 inline-flex items-center gap-2 rounded-[18px] border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger-DEFAULT">
                      <AlertTriangle className="h-4 w-4" />
                      {error}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === 2 ? (
                <div className="workspace-stack">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h3 className="text-3xl font-black tracking-[-0.04em] text-text-primary">معاينة البيانات</h3>
                      <p className="mt-2 text-sm text-text-secondary">
                        تمت قراءة <span className="font-black text-text-primary">{preview.length}</span> صفاً صالحاً من الملف الحالي.
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-border-subtle bg-[var(--bg-overlay)] px-4 py-3 text-sm text-text-secondary">
                      الملف: <span className="font-black text-text-primary">{file?.name || "CSV"}</span>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[24px] border border-border-subtle bg-[var(--bg-surface)]">
                    <div className="max-h-[460px] overflow-auto">
                      <table className="w-full min-w-[700px] text-right text-sm">
                        <thead className="sticky top-0 bg-[var(--bg-overlay)] text-text-secondary">
                          <tr>
                            <th className="px-4 py-3 font-black">اسم الصنف</th>
                            <th className="px-4 py-3 font-black">الباركود</th>
                            <th className="px-4 py-3 font-black">سعر البيع</th>
                            <th className="px-4 py-3 font-black">سعر الشراء</th>
                            <th className="px-4 py-3 font-black">الكود</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.map((row, index) => (
                            <tr key={`${row.barcode || row.name}-${index}`} className="border-t border-border-subtle transition hover:bg-primary/5">
                              <td className="px-4 py-3 font-semibold text-text-primary">{row.name}</td>
                              <td className="px-4 py-3 text-text-secondary">{row.barcode || "—"}</td>
                              <td className="px-4 py-3 text-text-primary">{row.price}</td>
                              <td className="px-4 py-3 text-text-secondary">{row.purchase_price}</td>
                              <td className="px-4 py-3 text-text-muted">{row.code || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {error ? (
                    <div className="inline-flex items-center gap-2 rounded-[18px] border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger-DEFAULT">
                      <AlertTriangle className="h-4 w-4" />
                      {error}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === 3 && results ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div
                    className={`flex h-24 w-24 items-center justify-center rounded-full ${
                      results.failed === 0 ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger-DEFAULT"
                    }`}
                  >
                    {results.failed === 0 ? <CheckCircle2 className="h-12 w-12" /> : <AlertTriangle className="h-12 w-12" />}
                  </div>
                  <h3 className="mt-6 text-3xl font-black tracking-[-0.04em] text-text-primary">
                    {results.failed === 0 ? "تم الاستيراد بنجاح" : "تم رصد أخطاء أثناء التنفيذ"}
                  </h3>
                  <p className="mt-3 max-w-xl text-sm leading-8 text-text-secondary">
                    {results.failed === 0
                      ? `تمت إضافة ${results.success} أصناف جديدة إلى قاعدة البيانات بدون أخطاء.`
                      : `تعذر استيراد ${results.failed} صفاً من الملف الحالي. راجع البيانات ثم حاول مرة أخرى.`}
                  </p>
                  {error ? (
                    <div className="mt-5 inline-flex items-center gap-2 rounded-[18px] border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger-DEFAULT">
                      <AlertTriangle className="h-4 w-4" />
                      {error}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <footer className="relative flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle bg-[var(--bg-overlay)] px-6 py-5 md:px-8">
          {step === 2 ? (
            <>
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                تراجع
              </Button>
              <Button type="button" onClick={handleImport} disabled={loading}>
                {loading ? "جارٍ تنفيذ الاستيراد..." : "تأكيد الاستيراد"}
              </Button>
            </>
          ) : null}

          {step === 3 ? (
            <Button type="button" onClick={onClose}>
              إغلاق
            </Button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
