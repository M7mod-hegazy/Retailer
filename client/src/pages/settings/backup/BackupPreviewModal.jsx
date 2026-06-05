import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Database, Image as ImageIcon, HardDrive, FolderTree, Tag, Loader2 } from "lucide-react";
import api from "../../../services/api";
import Overlay from "./Overlay";
import { formatBytes, countLabel } from "./helpers";

function StatChip({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-sm border border-slate-100 bg-slate-50/60 px-3 py-2">
      <span className="text-[11px] font-bold text-slate-500">{label}</span>
      <span className="text-xs font-black text-slate-800 tabular-nums">{value}</span>
    </div>
  );
}

function SectionCard({ icon, title, children }) {
  return (
    <div className="rounded-sm border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-700">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export default function BackupPreviewModal({ open, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setLabel("");
    setLoading(true);
    api
      .get("/api/backup/preview")
      .then((res) => setPreview(res.data?.data || null))
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [open]);

  const counts = Object.entries(preview?.recordCounts || {});

  return (
    <Overlay
      open={open}
      onClose={submitting ? undefined : onClose}
      title="ماذا سيتم نسخه احتياطياً؟"
      subtitle="مراجعة دقيقة قبل الحفظ — لا يتم كتابة أي شيء حتى تؤكد."
      icon={<HardDrive className="h-4 w-4" />}
      accent="emerald"
      maxWidth="max-w-2xl"
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-xs font-bold">جارٍ حساب المحتوى...</span>
        </div>
      ) : !preview ? (
        <div className="py-10 text-center text-xs font-bold text-rose-500">تعذر حساب معاينة النسخة الاحتياطية.</div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard icon={<Database className="h-3.5 w-3.5" />} title="بياناتك">
              <div className="grid grid-cols-2 gap-2">
                {counts.length === 0 && <div className="col-span-2 text-[11px] text-slate-400">لا توجد بيانات</div>}
                {counts.map(([key, val]) => (
                  <StatChip key={key} label={countLabel(key)} value={Number(val).toLocaleString("ar-EG")} />
                ))}
              </div>
              <div className="mt-3 text-[11px] font-bold text-slate-500">
                حجم قاعدة البيانات: <span className="text-slate-800">{formatBytes(preview.db?.sizeBytes)}</span>
              </div>
            </SectionCard>

            <SectionCard icon={<ImageIcon className="h-3.5 w-3.5" />} title="الصور والملفات">
              <div className="space-y-2">
                <StatChip label="إجمالي الصور" value={`${preview.images?.total ?? 0} (${formatBytes(preview.images?.totalSizeBytes)})`} />
                <StatChip
                  label="جديدة (تُضاف الآن)"
                  value={`${preview.images?.newCount ?? 0} (${formatBytes(preview.images?.newSizeBytes)})`}
                />
                <StatChip
                  label="محفوظة مسبقاً (بدون مساحة)"
                  value={`${preview.images?.reusedCount ?? 0}`}
                />
              </div>
            </SectionCard>
          </div>

          <SectionCard icon={<FolderTree className="h-3.5 w-3.5" />} title="هذه النسخة">
            <div className="space-y-2">
              <StatChip label="الحجم المتوقع على القرص" value={formatBytes(preview.estimatedSizeBytes)} />
              <div className="rounded-sm border border-slate-100 bg-slate-50/60 px-3 py-2">
                <div className="text-[11px] font-bold text-slate-500">مكان الحفظ</div>
                <div className="mt-0.5 break-all text-[11px] font-bold text-slate-700 ltr:text-left" dir="ltr">
                  {preview.targetDir}
                </div>
              </div>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[11px] font-bold text-slate-500">
                  <Tag className="h-3 w-3" /> وصف النسخة (اختياري)
                </span>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="مثال: قبل تحديث الأسعار"
                  className="w-full rounded-sm border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
                />
              </label>
            </div>
          </SectionCard>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-9 rounded-sm border border-slate-200 px-5 text-2sm font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
            >
              إلغاء
            </button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await onConfirm(label.trim());
                } finally {
                  setSubmitting(false);
                }
              }}
              className="flex h-9 items-center gap-2 rounded-sm bg-emerald-600 px-6 text-2sm font-black uppercase tracking-widest text-white shadow-md transition-all hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد والنسخ الآن
            </motion.button>
          </div>
        </div>
      )}
    </Overlay>
  );
}
