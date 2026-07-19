import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, CalendarDays, Search, X, Package, User, List, LayoutList, BarChart3, Filter } from "lucide-react";
import { useReportsConfig, getConfig, formatReportCellValue } from "../../hooks/useReportsConfig";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import SearchInput from "../../components/ui/SearchInput";
import Highlight from "../../components/ui/Highlight";
import { fuzzyFilterRows } from "../../utils/search";
import api from "../../services/api";

import { resolveImageUrl } from "../../utils/resolveImageUrl";

const AR_LABELS = {
  cash: "نقداً", card: "بطاقة", credit: "آجل", wallet: "محفظة",
  bank_transfer: "تحويل بنكي", installments: "تقسيط", multi: "متعدد",
  paid: "مدفوع", unpaid: "غير مدفوع", cancelled: "ملغي",
  pending: "قيد التحصيل", cleared: "تم الصرف", bounced: "مرتجع", replaced: "مستبدل",
  in: "وارد", out: "صادر", transfer: "تحويل",
  admin: "مدير", cashier: "كاشير", manager: "مشرف",
  payment_type: "طريقة الدفع", status: "الحالة",
};
function arLabel(key) { return formatReportCellValue(null, key) || AR_LABELS[key] || key; }

// ─── Normalize column from either config format or server format ─────
function normalizeCol(c) {
  if (!c) return null;
  if (c.k !== undefined && c.l !== undefined) {
    return { key: c.k, label: c.l, type: c.t || c.type || "text", defaultVisible: c.defaultVisible !== false };
  }
  if (c.key !== undefined) {
    return { key: c.key, label: c.label || c.key, type: c.type || "text", defaultVisible: c.defaultVisible !== false };
  }
  return null;
}

function isColumnOn(colVisibility, col) {
  if (Object.prototype.hasOwnProperty.call(colVisibility || {}, col.key)) {
    return colVisibility[col.key] !== false;
  }
  return col.defaultVisible !== false;
}
// ─── LookupList ───────────────────────────────────────────────────────────────
function LookupList({ items, onPick, activeIndex, query, emptyLabel = "لا توجد نتائج" }) {
  if (!items.length) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[9999] rounded-[12px] border border-border bg-bg-surface p-4 text-center text-2sm font-bold text-text-secondary shadow-2xl">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[9999] rounded-[12px] border border-border bg-bg-surface shadow-2xl">
      <div className="max-h-[280px] overflow-y-auto rounded-[12px] p-1 scrollbar-thin scrollbar-thumb-zinc-300">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-start transition-all ${activeIndex === i ? "bg-primary-50 text-text-accent" : "hover:bg-bg-overlay text-text-primary"}`}
          >
            <div className="flex items-center gap-2">
              {item.primary_image_url || item.image_url || item.image ? (
                <img src={resolveImageUrl(item.primary_image_url || item.image_url || item.image)} alt={item.name} className="w-8 h-8 rounded-md object-cover border border-border" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-bg-overlay flex items-center justify-center border border-border">
                  {item.code ? <Package className="w-4 h-4 text-text-muted"/> : <User className="w-4 h-4 text-text-muted"/>}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className={`text-sm font-black ${activeIndex === i ? "text-text-accent" : "text-text-primary"}`}><Highlight text={item.name} query={query} /></span>
                {(item.item_code || item.code || item.barcode || item.phone) && (
                  <span className="font-mono text-[11px] text-text-muted font-bold"><Highlight text={item.item_code || item.code || item.barcode || item.phone || `#${item.id}`} query={query} /></span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Custom Select ────────────────────────────────────────────────────────────
export function RSelect({ value, onChange, options, placeholder = "اختر..." }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  const selected = options.find((o) => o.value === value);
  return (
    <div className={`relative w-full ${open ? "z-40" : ""}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-[8px] border border-border-normal bg-bg-surface px-3 py-2 text-2sm font-bold text-text-primary outline-none transition-all hover:border-border-strong focus:border-primary focus:ring-1 focus:ring-primary/30"
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={13} className={`text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.13 }}
            className="absolute left-0 right-0 z-[9999] rounded-[8px] border border-border bg-bg-surface p-1 shadow-2xl"
          >
            <div className="max-h-44 overflow-y-auto scrollbar-hide">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`flex w-full items-center justify-between rounded-[5px] px-2.5 py-1.5 text-2sm font-bold transition-colors ${
                    value === opt.value ? "bg-primary-50 text-text-accent" : "text-text-secondary hover:bg-bg-overlay hover:text-text-primary"
                  }`}
                >
                  {opt.label}
                  {value === opt.value && <Check size={13} />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Date Input ───────────────────────────────────────────────────────────────
export function RDate({ value, onChange }) {
  const ref = useRef(null);
  return (
    <div
      onClick={() => ref.current?.showPicker?.()}
      className="relative flex items-center justify-between rounded-[8px] border border-border-normal bg-bg-surface px-3 py-2 cursor-pointer transition-all hover:border-border-strong focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30"
    >
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-2sm font-bold text-text-primary outline-none appearance-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0"
      />
      <CalendarDays size={13} className="text-text-muted pointer-events-none shrink-0" />
    </div>
  );
}

// ─── Date Preset Chips ────────────────────────────────────────────────────────
const fmtD = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export const DATE_PRESETS = [
  { label: "النهارده",  get: () => { const t = new Date(); return { from: fmtD(t), to: fmtD(t) }; } },
  { label: "إمبارح",    get: () => { const y = new Date(); y.setDate(y.getDate() - 1); return { from: fmtD(y), to: fmtD(y) }; } },
  { label: "آخر 7 أيام", get: () => { const t = new Date(), s = new Date(t); s.setDate(t.getDate() - 6); return { from: fmtD(s), to: fmtD(t) }; } },
  { label: "الشهر ده",  get: () => { const t = new Date(); return { from: fmtD(new Date(t.getFullYear(), t.getMonth(), 1)), to: fmtD(t) }; } },
  { label: "الشهر اللي فات", get: () => { const t = new Date(); return { from: fmtD(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: fmtD(new Date(t.getFullYear(), t.getMonth(), 0)) }; } },
  { label: "آخر 3 شهور", get: () => { const t = new Date(), s = new Date(t); s.setMonth(s.getMonth() - 3); return { from: fmtD(s), to: fmtD(t) }; } },
  { label: "السنة دي",  get: () => { const t = new Date(); return { from: fmtD(new Date(t.getFullYear(), 0, 1)), to: fmtD(t) }; } },
];

export function DatePresets({ activeFrom, activeTo, onApply }) {
  const active = DATE_PRESETS.find((p) => {
    const d = p.get();
    return d.from === activeFrom && d.to === activeTo;
  });
  return (
    <div className="flex flex-wrap gap-1.5">
      {DATE_PRESETS.map((p) => {
        const isActive = active?.label === p.label;
        return (
          <button
            key={p.label}
            type="button"
            onClick={() => onApply(p.get())}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold border transition-all ${
              isActive
                ? "bg-primary text-white border-primary"
                : "border-border-normal text-text-secondary hover:border-primary hover:text-text-accent bg-bg-base"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Scope Selector ───────────────────────────────────────────────────────────
export function ScopeSelector({ scopeOptions, scope, onScopeChange }) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (scope.type === "category" && !categories.length) {
      api.get("/api/categories").then(r => setItems(r.data.data || [])).catch(()=>setCategories(["موبايلات وتابلتات", "إكسسوارات"]));
    } else if (scope.type === "product" && !items.length) {
      api.get("/api/items").then(r => setItems(r.data.data || [])).catch(()=>{});
    } else if (scope.type === "supplier" && !items.length) {
      api.get("/api/suppliers").then(r => setItems(r.data.data || [])).catch(()=>{});
    } else if (scope.type === "customer" && !items.length) {
      api.get("/api/customers").then(r => setItems(r.data.data || [])).catch(()=>{});
    } else if (scope.type === "category" && items.length > 0 && typeof items[0] === 'object') {
      setCategories(items.map(i => ({ id: i.id, name: i.name })));
    }
  }, [scope.type, categories.length, items.length]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items.slice(0, 8);
    const searchKeys = scope.type === "product" ? ["name", "code", "item_code", "barcode"] : (scope.type === "category" ? ["name"] : ["name", "phone"]);
    return fuzzyFilterRows(items, search, searchKeys).slice(0, 8);
  }, [search, items, scope.type]);

  if (!scopeOptions || scopeOptions.length <= 1) return null;

  const handlePickItem = (item) => {
    onScopeChange({ ...scope, values: [item.id], valueLabels: [item.name] });
    setSearch("");
    setLookupOpen(false);
  };

  const subControl = () => {
    if (scope.type === "all") return null;
    if (scope.type === "category") {
      const cats = items.length > 0 && typeof items[0] === 'object' ? items.map(c => ({ id: c.id, name: c.name })) : categories;
      return (
        <div className="mt-3 space-y-1.5 max-h-44 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border-strong">
          {cats.map((c) => {
            const id = c.id || c.name;
            const name = c.name || c;
            const sel = Array.isArray(scope.values) && scope.values.includes(id);
            return (
              <label key={id} className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  onClick={() => {
                    const cur = Array.isArray(scope.values) ? scope.values : [];
                    onScopeChange({ ...scope, values: sel ? cur.filter((x) => x !== id) : [...cur, id] });
                  }}
                  className={`w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-all shrink-0 ${
                    sel ? "bg-primary border-primary" : "border-border-normal group-hover:border-primary"
                  }`}
                >
                  {sel && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-2sm font-bold text-text-secondary group-hover:text-text-primary">{name}</span>
              </label>
            );
          })}
        </div>
      );
    }
    if (scope.type === "product" || scope.type === "customer" || scope.type === "supplier") {
      const label = scope.type === "product" ? "ابحث عن منتج بالاسم أو الباركود..." : scope.type === "customer" ? "ابحث عن عميل..." : "ابحث عن مورد...";
      return (
        <div className="mt-3 relative">
          <SearchInput
            value={search}
            onChange={(val) => { setSearch(val); setLookupOpen(true); }}
            onFocus={(e) => { setLookupOpen(true); e.target.select(); }}
            onBlur={() => setTimeout(() => setLookupOpen(false), 200)}
            placeholder={label}
            size="md"
            className="w-full"
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredItems.length > 0) { e.preventDefault(); handlePickItem(filteredItems[activeIndex]); }
              else if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(prev => Math.min(prev + 1, filteredItems.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(prev => Math.max(prev - 1, 0)); }
            }}
          />
          {scope.values?.[0] && (
            <div className="mt-2 flex items-center justify-between rounded-[6px] bg-primary-50 border border-border-accent/50 px-2.5 py-1.5">
              <span className="text-2sm font-bold text-primary-700">{scope.valueLabels?.[0] || scope.values[0]}</span>
              <button onClick={() => onScopeChange({ ...scope, values: [], valueLabels: [] })} className="text-text-accent hover:text-text-accent transition-colors">
                <X size={13} />
              </button>
            </div>
          )}
          {lookupOpen && <LookupList items={filteredItems} onPick={handlePickItem} activeIndex={activeIndex} query={search} />}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {scopeOptions.map((opt) => (
          <button
            key={opt.type}
            type="button"
            onClick={() => {
              if (scope.type !== opt.type) setItems([]);
              onScopeChange({ type: opt.type, values: [], valueLabels: [] });
            }}
            className={`rounded-full px-3 py-1 text-[11px] font-bold border transition-all ${
              scope.type === opt.type
                ? "bg-primary text-white border-primary shadow-sm"
                : "border-border-normal text-text-secondary hover:border-primary hover:text-text-accent bg-bg-base"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {scope.type !== "all" && (
          <motion.div
            key={scope.type}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="relative z-50"
          >
            {subControl()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Column Preview Strip (card) ──────────────────────────────────────────────
function getPreviewColumns(report, catId) {
  if (Array.isArray(report?.columns) && report.columns.length) {
    return report.columns.map(normalizeCol).filter(Boolean);
  }
  const catCols = ((getConfig() || {})?.catPreviewColumns || {})[catId];
  if (catCols) return catCols.map(normalizeCol).filter(Boolean);
  return (((getConfig() || {})?.previewColumns || {})[catId] || []).map(normalizeCol).filter(Boolean);
}

function fmtSampleDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("ar-EG-u-nu-latn");
}

function sampleValueForColumn(col, rowIndex, dateRange) {
  const key = col.key;
  const type = col.type;
  const dt = dateRange?.from || dateRange?.to;
  const sampleDate = dt ? fmtSampleDate(dt) : null;
  const sampleDate2 = dateRange?.to && dateRange?.from && dateRange.from !== dateRange.to ? fmtSampleDate(dateRange.to) : null;
  const samples = {
    date:        sampleDate ? (rowIndex === 0 ? sampleDate : (sampleDate2 || sampleDate)) : (rowIndex === 0 ? "٠٤/٠٥/٢٠٢٦" : "٠٣/٠٥/٢٠٢٦"),
    cur:         rowIndex === 0 ? "١٢٬٤٥٠" : "٨٬٣٠٠",
    num:         rowIndex === 0 ? "٢٤" : "٨",
    percent:     rowIndex === 0 ? "١٤٫٥٪" : "٨٫٢٪",
    code:        rowIndex === 0 ? "SKU-١٠٠١" : "SKU-١٠٠٢",
    text:        key === "weekday_name" ? (rowIndex === 0 ? "السبت" : "الأحد") :
                 key.includes("status") ? (rowIndex === 0 ? "مدفوع" : "غير مدفوع") :
                 key.includes("action") ? (rowIndex === 0 ? "إنشاء فاتورة" : "تعديل سعر") :
                 key.includes("reason") ? (rowIndex === 0 ? "مرتجع تالف" : "خطأ في الفاتورة") :
                 key.includes("name") || key.includes("party") ? (rowIndex === 0 ? "أحمد البرقوقي" : "شركة النور") :
                 key.includes("payment") || key.includes("refund") ? (rowIndex === 0 ? "نقداً" : "بطاقة") :
                 key.includes("bucket") || key.includes("aging") ? (rowIndex === 0 ? "0-30 يوم" : "31-60 يوم") :
                 key.includes("movement") ? (rowIndex === 0 ? "إضافة مخزون" : "تسوية") :
                 "بيان تجريبي",
  };
  return samples[type] || samples.text;
}

export function ColumnPreviewStrip({ catId, colVisibility, report }) {
  const config = getConfig() || {};
  const cols = getPreviewColumns(report, catId);
  const visible = cols.filter((c) => isColumnOn(colVisibility, c));
  if (!visible.length) return null;
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
      <AnimatePresence mode="popLayout">
        {visible.map((c) => (
          <motion.span
            key={c.key}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${(config?.colTypeStyle || {})[c.type] || (config?.colTypeStyle || {}).text || "text-text-secondary bg-bg-overlay border-border-subtle"}`}
          >
            {c.label}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Ghost Preview Rows (card) ────────────────────────────────────────────────
export function GhostPreviewRows({ catId, colVisibility, report, dateRange, scope }) {
  const config = getConfig() || {};
  const cols = getPreviewColumns(report, catId);
  const visible = cols.filter((c) => isColumnOn(colVisibility, c));
  const ghostRows = (config.catGhostRows || {})[catId] || (config.ghostRows || {})[catId] || [];

  // Reflect scope name in ghost data if available
  const scopeLabel = scope?.valueLabels?.[0];
  const scopeType = scope?.type;
  const scopeKey = scopeType === "customer" ? "customer_name"
    : scopeType === "supplier" ? "supplier_name"
    : scopeType === "product" ? "item_name"
    : scopeType === "category" ? "category_name"
    : null;

  // Generate rows: use config?.ghostRows objects if available, otherwise build from columns
  const rows = ghostRows.length
    ? [0, 1, 2].slice(0, Math.min(ghostRows.length, 3)).map((ri) => visible.map((c) => {
        if (scopeLabel && scopeKey === c.key) return scopeLabel;
        if (c.type === "date" || c.key === "date" || c.key.endsWith("_date")) return sampleValueForColumn(c, ri, dateRange);
        return ghostRows[ri]?.[c.key] ?? sampleValueForColumn(c, ri, dateRange);
      }))
    : [0, 1, 2].map((ri) => visible.map((c) => sampleValueForColumn(c, ri, dateRange)));

  if (!visible.length) return null;
  return (
    <div className="mt-2 space-y-1 opacity-40">
      <div className="flex gap-2 mb-1">
        <AnimatePresence mode="popLayout">
          {visible.slice(0, 5).map((c) => (
            <motion.span
              key={c.key}
              layout
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 text-[9px] font-black text-text-muted uppercase truncate"
            >
              {c.label}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      {rows.map((row, ri) => (
        <motion.div
          key={ri}
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="flex gap-2 rounded-[4px] bg-bg-overlay px-1.5 py-1"
        >
          {visible.slice(0, 5).map((c, ci) => (
            <span key={c.key} className={`flex-1 text-[11px] truncate font-bold ${c.type === "cur" ? "number-fmt-primary text-text-primary" : c.type === "num" ? "number-fmt text-text-primary" : "text-text-secondary"}`}>
              {row[ci] ?? "—"}
            </span>
          ))}
        </motion.div>
      ))}
      <p className="text-[9px] text-text-muted text-left mt-1">* بيانات عينة للمعاينة فقط</p>
    </div>
  );
}

// ─── Column Visibility Toggles ────────────────────────────────────────────────
export function ColumnToggleList({ catId, colVisibility, onChange, report }) {
  const cols = getPreviewColumns(report, catId);
  if (!cols.length) return null;
  return (
    <div className="space-y-1.5">
      {cols.map((c) => {
        const on = isColumnOn(colVisibility, c);
        return (
          <div key={c.key} className="flex items-center justify-between py-1 border-b border-border-subtle/50 last:border-0">
            <span className={`text-2sm font-bold ${on ? "text-text-primary" : "text-text-muted"}`}>{c.label}</span>
            <button
              type="button"
              onClick={() => onChange({ ...colVisibility, [c.key]: !on })}
              className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${on ? "bg-primary" : "bg-border-strong"}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-bg-surface shadow-sm transition-transform duration-200 ${on ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Lookup Filter (for workspace filter panel) ──────────────────────────────
export function LookupEntityFilter({ entity, value, onChange, placeholder }) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const entityApi = {
    category: "/api/categories",
    product: "/api/items",
    customer: "/api/customers",
    supplier: "/api/suppliers",
    user: "/api/users",
    warehouse: "/api/warehouses",
    payment_method: "/api/payment-methods",
    employee: "/api/employees",
  }[entity];

  useEffect(() => {
    if (entityApi && !items.length) {
      api.get(entityApi).then(r => setItems(r.data.data || [])).catch(() => {});
    }
  }, [entity, entityApi, items.length]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items.slice(0, 12);
    const keys = entity === "product" ? ["name", "code", "item_code", "barcode"] : ["name", "category", "type"];
    return fuzzyFilterRows(items, search, keys).slice(0, 12);
  }, [search, items, entity]);

  const picked = value ? items.find((i) => String(i.id) === String(value)) : null;

  return (
    <div className={`relative ${open ? "z-40" : ""}`} ref={ref}>
      {picked ? (
        <div className="flex items-center justify-between rounded-[8px] border border-border-accent/50 bg-primary-50 px-2.5 py-1.5">
          <span className="text-2sm font-bold text-primary-700">{picked.name}</span>
          <button onClick={() => { onChange(""); setSearch(""); }} className="text-text-accent hover:text-text-accent">
            <X size={13} />
          </button>
        </div>
      ) : (
        <>
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder || "بحث..."}
            size="md"
            className="w-full"
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length > 0) { e.preventDefault(); onChange(filtered[activeIndex].id); setSearch(""); setOpen(false); }
              else if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
            }}
          />
          {open && (
            <LookupList
              items={filtered}
              onPick={(item) => { onChange(item.id); setSearch(""); setOpen(false); }}
              activeIndex={activeIndex}
              query={search}
              emptyLabel="لا توجد نتائج"
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Classification Selector ────────────────────────────────────────────
export function ClassificationSelector({ classifications, value, onChange, formatLabel }) {
  const fmt = formatLabel || ((x) => x);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  const selected = classifications.find((c) => c.id === value);
  return (
    <div className={`relative w-full ${open ? "z-40" : ""}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-[10px] border border-border bg-bg-surface px-3 py-2.5 text-2sm font-bold text-text-primary outline-none transition-all hover:border-primary focus:border-primary shadow-sm"
      >
        <span className="truncate">{selected ? (selected.label || fmt(selected.label_key)) : "اختر تصنيف..."}</span>
        <ChevronDown size={14} className={`text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.13 }}
            className="absolute left-0 right-0 z-[9999] rounded-[12px] border border-border bg-bg-surface p-1 shadow-2xl"
          >
            <div className="max-h-56 overflow-y-auto scrollbar-hide">
              {classifications.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => { onChange(cls.id); setOpen(false); }}
                  className={`flex w-full items-center justify-between rounded-[6px] px-2.5 py-2 text-2sm font-bold transition-colors ${
                    value === cls.id ? "bg-primary-50 text-text-accent" : "text-text-secondary hover:bg-bg-overlay hover:text-text-primary"
                  }`}
                >
                  <span>{cls.label || fmt(cls.label_key)}</span>
                  <div className="flex items-center gap-1.5">
                    {cls.availableModes.includes("summary") && <span className="text-[9px] text-text-muted bg-bg-overlay px-1.5 py-0.5 rounded">ملخص</span>}
                    {cls.availableModes.includes("detailed") && <span className="text-[9px] text-text-muted bg-bg-overlay px-1.5 py-0.5 rounded">تفصيلي</span>}
                    {value === cls.id && <Check size={13} className="text-text-accent" />}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Data Mode Toggle ───────────────────────────────────────────────────
export function DataModeToggle({ availableModes, value, onChange }) {
  if (!availableModes || availableModes.length <= 1) return null;
  return (
    <div className="flex bg-bg-overlay rounded-[10px] p-0.5 shadow-inner">
      {availableModes.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-[11px] font-bold transition-all ${
            value === mode
              ? "bg-bg-surface text-text-primary shadow-sm border border-border"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {mode === "detailed" ? <List size={13} /> : <LayoutList size={13} />}
          {mode === "detailed" ? "تفصيلي" : "ملخص"}
        </button>
      ))}
    </div>
  );
}

// ─── Multi-Select Checkboxes ────────────────────────────────────────────
export function MultiSelectCheckboxes({ options, value = [], onChange, label, formatLabel }) {
  const fmt = formatLabel || ((x) => x);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  const selectedCount = value.length;
  return (
    <div className={`relative w-full ${open ? "z-40" : ""}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-[10px] border border-border bg-bg-surface px-3 py-2.5 text-2sm font-bold text-text-primary outline-none transition-all hover:border-primary shadow-sm"
      >
        <span className="truncate">
          {selectedCount > 0 ? `${label}: ${selectedCount} مختار` : label}
        </span>
        <Filter size={14} className="text-text-muted" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 4 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 right-0 z-[9999] rounded-[12px] border border-border bg-bg-surface p-2 shadow-2xl"
          >
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {options.map((opt) => {
                const checked = value.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2.5 cursor-pointer rounded-[6px] px-2 py-1.5 hover:bg-bg-overlay transition-colors"
                  >
                    <div
                      onClick={() => {
                        const next = checked
                          ? value.filter((v) => v !== opt.value)
                          : [...value, opt.value];
                        onChange(next);
                      }}
                      className={`w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-all shrink-0 ${
                        checked ? "bg-primary border-primary" : "border-border hover:border-primary"
                      }`}
                    >
                      {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-2sm font-bold text-text-secondary">{opt.label || fmt(opt.label_key)}</span>
                  </label>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Source Card ────────────────────────────────────────────────────────
export function SourceCard({ source, classifications, selectedClassification, selectedMode, onClassificationChange, onModeChange, onEnter }) {
  const Icon = source.icon;
  return (
    <div className="group relative flex flex-col rounded-[24px] bg-bg-surface border border-border p-6 shadow-sm hover:shadow-md hover:border-border-accent transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-bg-base border border-border-subtle" style={{ color: source.color }}>
            <Icon size={22} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[15px] font-black text-text-primary">{source.label}</h3>
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest">{source.id}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 mt-1">
        <ClassificationSelector
          classifications={classifications}
          value={selectedClassification}
          onChange={onClassificationChange}
        />
        {classifications.find((c) => c.id === selectedClassification) && (
          <DataModeToggle
            availableModes={classifications.find((c) => c.id === selectedClassification)?.availableModes || ["detailed"]}
            value={selectedMode}
            onChange={onModeChange}
          />
        )}
      </div>

      <button
        onClick={onEnter}
        disabled={!selectedClassification}
        className="mt-4 w-full flex items-center justify-center gap-2 rounded-[12px] bg-primary px-4 py-3 text-sm font-bold text-white transition-all hover:bg-primary-600 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        <BarChart3 size={15} />
        عرض التقرير
      </button>
    </div>
  );
}

function useDynamicOptions(dimension) {
  const [options, setOptions] = useState(dimension?.options || []);
  useEffect(() => {
    if (dimension?.dynamic) {
      api.get("/api/reports/payment-type-options").then((r) => {
        if (r.data?.data) setOptions(r.data.data);
      }).catch(() => {});
    }
  }, [dimension?.dynamic]);
  return options;
}

// ─── Dimension Filter — smart dispatcher ──────────────────────────
export function DimensionFilter({ dimension, value, onChange, formatLabel }) {
  const fmt = formatLabel || ((x) => x);
  const dynamicOptions = useDynamicOptions(dimension);
  if (dimension.type === "lookup") {
    const entityLabel = {
      category: "تصنيف", product: "منتج", customer: "عميل",
      supplier: "مورد", user: "مستخدم", warehouse: "مخزن",
      employee: "موظف",
    }[dimension.entity] || dimension.entity;
    return (
      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-text-secondary">{fmt(dimension.label)}</label>
        <LookupEntityFilter entity={dimension.entity} value={value || ""}
          onChange={(v) => onChange(dimension.key, v)}
          placeholder={`بحث عن ${entityLabel}...`} />
      </div>
    );
  }
  if (dimension.type === "select") {
    const opts = dimension.dynamic ? (dynamicOptions.length > 0 ? dynamicOptions : (dimension.options || [])) : (dimension.options || []);
    const rSelectOptions = [
      { value: "", label: "الكل" },
      ...opts.map(opt => ({
        value: opt.value,
        label: formatReportCellValue(dimension.key, opt.label || opt.label_key || opt.value)
      }))
    ];
    return (
      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-text-secondary">{fmt(dimension.label)}</label>
        <RSelect 
          value={value || ""} 
          onChange={(val) => onChange(dimension.key, val)}
          options={rSelectOptions}
          placeholder="اختر..."
        />
      </div>
    );
  }
  return null;
}

// ─── Filter Panel (always-visible top panel) ──────────────────────
const filterGroupVariants = {
  hidden: { opacity: 0, y: -6, height: 0 },
  visible: { opacity: 1, y: 0, height: "auto" },
};

export function FilterPanelTop({
  sourceKey, clsDef, filters, onFilterChange, dateRange, onDateChange,
  datePresets, onDatePreset, costMethod, onCostChange, scope, onScopeChange,
  hasProfit, supportsDates, supportsScope, isFetching,
}) {
  const config = getConfig() || {};
  const dimensions = useMemo(() => {
    if (!clsDef?.dimensions || !sourceKey) return [];
    const pool = (config?.filterDimensions || {})[sourceKey] || [];
    return clsDef.dimensions.map((key) => pool.find((d) => d.key === key)).filter(Boolean);
  }, [clsDef, sourceKey]);

  const [paymentTypeOptions, setPaymentTypeOptions] = useState([]);
  useEffect(() => {
    api.get("/api/reports/payment-type-options").then((r) => {
      if (r.data?.data) setPaymentTypeOptions(r.data.data);
    }).catch(() => {});
  }, []);

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.q) count++;
    dimensions.forEach((d) => { if (filters[d.key]) count++; });
    if (costMethod && costMethod !== "wacc") count++;
    if (scope?.type !== "all") count++;
    return count;
  }, [filters, dimensions, costMethod, scope]);

  const [collapsed, setCollapsed] = useState(false);
  const searchRef = useRef(null);
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const costMethodRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  return (
    <motion.div layout className="bg-bg-surface rounded-[24px] border border-border shadow-sm">
      {/* Collapse header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-6 py-2.5 text-[11px] font-bold text-text-secondary hover:bg-bg-overlay transition-colors border-b border-border-subtle"
      >
        <span className="flex items-center gap-2">
          <Filter size={14} />
          {collapsed ? "إظهار الفلاتر" : "إخفاء الفلاتر"}
          {activeCount > 0 && (
            <span className="bg-primary-100 text-primary-700 text-[11px] px-2 py-0.5 rounded-full font-black">
              {activeCount}
            </span>
          )}
        </span>
        <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="filter-body"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={filterGroupVariants}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="p-6">
              {/* Loading indicator bar */}
              <motion.div
                className="h-0.5 bg-primary/30 rounded-full mb-4 overflow-hidden"
                initial={false}
              >
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={isFetching ? { x: ["-100%", "200%"], opacity: [0.3, 1, 0.3] } : { x: "100%", opacity: 0 }}
                  transition={isFetching ? { duration: 1, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
                />
              </motion.div>

              {/* Search + Date + Dimensions grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* Search */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-text-secondary">بحث عام</label>
                  <div className="relative">
                    <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input ref={searchRef} type="text" value={filters.q || ""}
                      onChange={(e) => onFilterChange("q", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, { nextRef: dateFromRef })}
                      placeholder="ابحث..."
                      className="w-full h-10 pr-10 pl-3 rounded-xl border border-border bg-bg-base text-sm text-text-primary font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                {/* Date range */}
                {supportsDates && datePresets && (
                  <div className="space-y-1.5 lg:col-span-2 xl:col-span-2">
                    <label className="flex items-center justify-between text-[11px] font-bold text-text-secondary">
                      <span>الفترة الزمنية</span>
                      <div className="flex gap-1">
                        {datePresets.map((p) => (
                          <button key={p.label} onClick={() => onDatePreset?.(p)}
                            className="text-[11px] text-text-muted hover:text-text-primary bg-bg-overlay hover:bg-bg-surface px-2 py-0.5 rounded-md transition-colors"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </label>
                    <div className="flex items-center gap-2">
                      <input ref={dateFromRef} type="date" value={dateRange?.from || ""}
                        onChange={(e) => onDateChange?.("from", e.target.value)}
                        onKeyDown={e => handleKeyDown(e, { nextRef: dateToRef, prevRef: searchRef })}
                        className="flex-1 h-10 px-3 rounded-xl border border-border bg-bg-base text-sm font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-text-primary"
                      />
                      <span className="text-text-muted shrink-0">–</span>
                      <input ref={dateToRef} type="date" value={dateRange?.to || ""}
                        onChange={(e) => onDateChange?.("to", e.target.value)}
                        onKeyDown={e => handleKeyDown(e, { nextRef: costMethodRef, prevRef: dateFromRef })}
                        className="flex-1 h-10 px-3 rounded-xl border border-border bg-bg-base text-sm font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-text-primary"
                      />
                    </div>
                  </div>
                )}

                {/* Dimension filters */}
                {dimensions.map((dim) => {
                  const opts = dim.dynamic ? (paymentTypeOptions.length > 0 ? paymentTypeOptions : (dim.options || [])) : (dim.options || []);
                  return (
                    <motion.div
                      key={dim.key}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      {dim.type === "select" ? (
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-text-secondary">{dim.label}</label>
                          <select value={filters[dim.key] || ""}
                            onChange={(e) => onFilterChange(dim.key, e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-border bg-bg-base text-sm text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
                          >
                            <option value="">الكل</option>
                            {opts.map((opt) => (
                              <option key={opt.value} value={opt.value}>{formatReportCellValue(dim.key, opt.label || opt.label_key || opt.value)}</option>
                            ))}
                          </select>
                        </div>
                      ) : dim.type === "lookup" ? (
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-text-secondary">{dim.label}</label>
                          <LookupEntityFilter entity={dim.entity} value={filters[dim.key] || ""}
                            onChange={(v) => onFilterChange(dim.key, v)}
                            placeholder={`بحث عن ${({ category: "تصنيف", product: "منتج", customer: "عميل", supplier: "مورد", user: "مستخدم", warehouse: "مخزن", employee: "موظف" })[dim.entity] || ""}...`}
                          />
                        </div>
                      ) : null}
                    </motion.div>
                  );
                })}

                {/* Cost method */}
                {hasProfit && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-text-secondary">طريقة التكلفة</label>
                    <select ref={costMethodRef} value={costMethod || "wacc"} onChange={(e) => onCostChange?.(e.target.value)}
                      onKeyDown={e => handleKeyDown(e, { prevRef: dateToRef })}
                      className="w-full h-10 px-3 rounded-xl border border-border bg-bg-base text-sm text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
                    >
                      {[{ value: "wacc", label: "متوسط التكلفة (WACC)" }, { value: "last_purchase", label: "آخر سعر شراء" }].map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
