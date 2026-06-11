import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown, Calendar, Clock, HardDrive, Image as ImageIcon, Tag,
  RotateCcw, Download, Loader2, FolderOpen, AlertTriangle,
} from "lucide-react";
import api from "../../../services/api";
import { formatBytes, formatTime, formatDateTime, monthLabel, triggerMeta, countLabel } from "./helpers";

function Badge({ trigger }) {
  const meta = triggerMeta(trigger);
  return <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-black ${meta.className}`}>{meta.label}</span>;
}

function RecordChips({ counts }) {
  if (!counts) return null;
  const entries = Object.entries(counts).filter(([, v]) => Number(v) > 0).slice(0, 6);
  if (!entries.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span key={k} className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
          {countLabel(k)}: <span className="tabular-nums">{Number(v).toLocaleString("ar-EG")}</span>
        </span>
      ))}
    </div>
  );
}

function SnapshotRow({ snap, onRestore, onExport, busy, perms }) {
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-slate-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-black text-slate-800">{formatTime(snap.createdAt)}</span>
          <Badge trigger={snap.triggerType} />
          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
            <HardDrive className="h-3 w-3" /> {formatBytes(snap.sizeBytes)}
          </span>
          {snap.imageCount != null && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <ImageIcon className="h-3 w-3" /> {snap.imageCount}
            </span>
          )}
          {snap.appVersion && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <Tag className="h-3 w-3" /> v{snap.appVersion}
            </span>
          )}
        </div>
        {snap.label && <div className="mt-1 text-[11px] font-bold text-slate-600">“{snap.label}”</div>}
        {snap.legacy && (
          <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-rose-500">
            <AlertTriangle className="h-3 w-3" /> نسخة قديمة — لا تحتوي على الصور
          </div>
        )}
        <RecordChips counts={snap.recordCounts} />
      </div>
      <div className="flex shrink-0 gap-2">
        {perms.export && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            disabled={busy}
            onClick={() => onExport(snap)}
            className="flex h-8 items-center gap-1 rounded-sm border border-slate-200 px-3 text-[11px] font-black uppercase tracking-wider text-slate-600 transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> تصدير
          </motion.button>
        )}
        {perms.restore && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            disabled={busy}
            onClick={() => onRestore(snap)}
            className="flex h-8 items-center gap-1 rounded-sm bg-slate-900 px-3 text-[11px] font-black uppercase tracking-wider text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> استعادة
          </motion.button>
        )}
      </div>
    </div>
  );
}

function DayNode({ year, month, day, onRestore, onExport, busy, perms }) {
  const [open, setOpen] = useState(false);
  const latest = day.latest;
  const hasMore = day.snapshots.length > 1;

  return (
    <div className="rounded-sm border border-slate-200 bg-slate-50/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-3 text-right transition-all hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-black text-slate-800">{`${day.day} ${monthLabel(month)} ${year}`}</span>
          <span className="rounded-sm bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-black text-slate-600">
            {day.snapshots.length} نسخة
          </span>
          <Badge trigger={latest.triggerType} />
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
          <span>آخر نسخة {formatTime(latest.createdAt)}</span>
          <motion.span animate={{ rotate: open ? 180 : 0 }}>
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 p-3 pt-0">
              {day.snapshots.map((snap) => (
                <SnapshotRow key={snap.path} snap={snap} onRestore={onRestore} onExport={onExport} busy={busy} perms={perms} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!open && !hasMore && (
        <div className="px-3 pb-3">
          <SnapshotRow snap={latest} onRestore={onRestore} onExport={onExport} busy={busy} perms={perms} />
        </div>
      )}
    </div>
  );
}

function MonthNode({ year, month, onRestore, onExport, busy, perms }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500"
      >
        <motion.span animate={{ rotate: open ? 0 : -90 }}>
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.span>
        {monthLabel(month.month)} {year}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2">
              {month.days.map((day) => (
                <DayNode
                  key={day.day}
                  year={year}
                  month={month.month}
                  day={day}
                  onRestore={onRestore}
                  onExport={onExport}
                  busy={busy}
                  perms={perms}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RestoreBrowser({ onRestore, onExport, busy, refreshKey, perms = { restore: true, export: true } }) {
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get("/api/backup/list")
      .then((res) => alive && setTree(res.data?.data || null))
      .catch(() => alive && setTree(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-xs font-bold">جارٍ تحميل النسخ الاحتياطية...</span>
      </div>
    );
  }

  if (!tree?.years?.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
        <FolderOpen className="h-8 w-8" />
        <span className="text-xs font-bold">لا توجد نسخ احتياطية بعد. أنشئ أول نسخة من الأعلى.</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {tree.years.map((y) => (
        <div key={y.year} className="space-y-3">
          {y.months.map((m) => (
            <MonthNode key={m.month} year={y.year} month={m} onRestore={onRestore} onExport={onExport} busy={busy} perms={perms} />
          ))}
        </div>
      ))}
    </div>
  );
}
