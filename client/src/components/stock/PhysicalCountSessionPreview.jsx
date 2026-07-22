import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Package,
  Printer,
  RefreshCw,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import WhatsAppIcon from "../ui/WhatsAppIcon";
import toast from "react-hot-toast";
import api from "../../services/api";
import Modal from "../ui/Modal";

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

function varianceColor(variance, systemQty) {
  if (variance === 0) return "text-success-text";
  const pct = systemQty > 0 ? (Math.abs(variance) / systemQty) * 100 : 100;
  if (pct <= 10) return "text-warning-text";
  return "text-danger-text";
}

export default function PhysicalCountSessionPreview({ open, session, onClose, onSendWhatsApp, onPrint }) {
  const [exporting, setExporting] = useState(null);
  const [fullSession, setFullSession] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !session?.id) { setFullSession(null); return; }
    setLoading(true);
    api.get(`/api/stock/physical-count/sessions/${session.id}`)
      .then((r) => setFullSession(r.data?.data || null))
      .catch(() => setFullSession(null))
      .finally(() => setLoading(false));
  }, [open, session?.id]);

  const data = fullSession || session;
  if (!data) return null;

  const lines = data.lines || [];
  const total = lines.length;
  const counted = lines.filter((l) => l.touched).length;
  const matched = lines.filter((l) => l.touched && l.variance === 0).length;
  const surplus = lines.filter((l) => l.variance > 0);
  const deficit = lines.filter((l) => l.variance < 0);

  const sortedLines = [...lines].sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

  async function handleExport(format) {
    setExporting(format);
    try {
      const r = await api.get(`/api/stock/physical-count/sessions/${data.id}/export`, {
        params: { format },
        responseType: "blob",
      });
      const blob = new Blob([r.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "excel" ? "xlsx" : format === "word" ? "docx" : "pdf";
      a.download = `${data.name || `جرد-${data.id}`}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`تم التصدير كـ ${format.toUpperCase()}`);
    } catch {
      toast.error("تعذّر التصدير");
    } finally {
      setExporting(null);
    }
  }

  return (
    <Modal open={open} title={`معاينة — ${data.name || `جرد #${data.id}`}`} onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-6" dir="rtl">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : (
          <>
            {/* Session Info */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest ${
                data.status === "completed" ? "bg-success-bg text-success-text" :
                data.status === "cancelled" ? "bg-bg-overlay text-text-secondary" :
                "bg-primary/10 text-primary"
              }`}>
                {data.status === "completed" ? "مكتمل" : data.status === "cancelled" ? "ملغى" : "جارٍ"}
              </span>
              {data.type === "complete" && (
                <span className="px-3 py-1 rounded-full bg-info-bg text-info-text text-[11px] font-black uppercase tracking-widest">
                  جرد شامل
                </span>
              )}
              <span className="text-text-muted font-bold">{data.scope === "warehouse" ? data.warehouse_name : data.scope === "category" ? data.category_name : "أصناف مخصصة"}</span>
              <span className="text-text-muted">•</span>
              <span className="text-text-muted font-bold">{formatDateTime(data.created_at)}</span>
              {data.completed_at && (
                <>
                  <span className="text-text-muted">←</span>
                  <span className="text-success-text font-bold">{formatDateTime(data.completed_at)}</span>
                </>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "إجمالي", value: total, color: "" },
                { label: "تم العد", value: counted, color: "text-primary" },
                { label: "مطابق", value: matched, color: "text-success-text" },
                { label: "_surplus", value: surplus.length, color: "text-warning-text" },
                { label: "عجز", value: deficit.length, color: "text-danger-text" },
              ].map((m) => (
                <div key={m.label} className="bg-bg-overlay rounded-xl p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">{m.label === "_surplus" ? "فائض" : m.label}</p>
                  <p className={`text-xl font-black number-fmt ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Item List */}
            <div className="border border-border-subtle rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-bg-overlay">
                    <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-text-muted">الصنف</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-text-muted">النظام</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-text-muted">الفعلي</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-text-muted">الفرق</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-text-muted">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLines.map((l) => (
                    <tr key={`${l.item_id}_${l.warehouse_id ?? "null"}`} className="border-t border-border-subtle">
                      <td className="px-3 py-2">
                        <p className="font-black text-text-primary">{l.item_name}</p>
                        <p className="text-[10px] font-mono text-text-muted">{l.item_code}</p>
                      </td>
                      <td className="px-3 py-2 text-center number-fmt text-text-muted font-bold">{l.system_quantity}</td>
                      <td className="px-3 py-2 text-center number-fmt font-black">{l.counted_quantity ?? "—"}</td>
                      <td className={`px-3 py-2 text-center number-fmt font-black ${varianceColor(l.variance || 0, l.system_quantity)}`}>
                        {l.touched ? (l.variance > 0 ? `+${l.variance}` : l.variance) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {l.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-success-text">
                            <CheckCircle2 className="w-3 h-3" /> مكتمل
                          </span>
                        ) : l.touched ? (
                          <span className="text-[10px] font-bold text-primary">مُعدّ</span>
                        ) : (
                          <span className="text-[10px] font-bold text-text-muted">لم يُعد</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {sortedLines.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-text-muted text-xs font-bold">لا توجد أصناف</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Notes */}
            {data.notes && (
              <div className="bg-bg-overlay rounded-xl p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-2">ملاحظات الجلسة</p>
                <p className="text-sm font-bold text-text-secondary">{data.notes}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-border-subtle">
              {/* Export group */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">تصدير:</span>
                <button
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest bg-danger-bg text-danger-text border border-danger-border hover:bg-danger/10 transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </button>
                <button
                  onClick={() => handleExport("excel")}
                  disabled={!!exporting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest bg-success-bg text-success-text border border-success-border hover:bg-success/10 transition-colors disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel
                </button>
                <button
                  onClick={() => handleExport("word")}
                  disabled={!!exporting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest bg-info-bg text-info-text border border-info-border hover:bg-info/10 transition-colors disabled:opacity-50"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Word
                </button>
              </div>

              {/* Print + WhatsApp group */}
              <div className="flex items-center gap-2">
                {onPrint && (
                  <button
                    onClick={() => onPrint(data)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    طباعة
                  </button>
                )}
                {onSendWhatsApp && (
                  <button
                    onClick={() => onSendWhatsApp(data)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest bg-success-bg text-success-text border border-success-border hover:bg-success/15 transition-colors"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                    واتساب
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
