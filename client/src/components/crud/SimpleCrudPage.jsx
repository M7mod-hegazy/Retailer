import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { usePerformanceStore } from "../../stores/performanceStore";
import {
  Plus,
  Download,
  Upload,
  Edit3,
  Trash2,
  CheckCircle2,
  Database,
  Search,
  X,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import DataTable from "../ui/DataTable";
import SmartTooltip from "../ui/SmartTooltip";
import PermissionGate from "../ui/PermissionGate";
import { usePermission } from "../../hooks/usePermission";
import PermissionDeniedModal from "../ui/PermissionDeniedModal";
import DeleteImpactModal from "../ui/DeleteImpactModal";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { formatNumber } from "../../utils/currency";

function createInitialState(fields, source = {}) {
  return fields.reduce((acc, field) => ({ ...acc, [field.name]: source[field.name] ?? field.initialValue ?? "" }), {});
}

function Highlight({ text, query }) {
  if (!query) return <span>{text}</span>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = String(text).split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <mark key={i} className="bg-yellow-200 text-black px-0.5 rounded-sm">{part}</mark> 
          : part
      )}
    </span>
  );
}

// Utility for exporting data to CSV
function exportToCSV(data, columns, filename) {
  if (!data || !data.length) {
    toast.error("لا توجد بيانات للتصدير");
    return;
  }
  const headers = columns.map(c => c.label).join(",");
  const rows = data.map(row => 
    columns.map(c => `"${String(row[c.key] ?? '').replace(/"/g, '""')}"`).join(",")
  );
  const csvContent = "\uFEFF" + [headers, ...rows].join("\n"); 
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function SimpleCrudPage({
  title,
  description,
  endpoint,
  columns: columnDefs,
  fields,
  buildPayload = (f) => f,
  searchKeys,
  pageKey,
  onExport,
  importPath,
}) {
  const PAGE_SIZE = 100;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [searchTerm, setSearchTerm] = useState(() => (searchParams.get("q") || "").trim());
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(() => createInitialState(fields));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [deleteState, setDeleteState] = useState(null); // { id, itemName, impact, loading, confirming }
  const canAdd = usePermission(pageKey, 'add');
  const canEdit = usePermission(pageKey, 'edit');
  const reduceMotion = usePerformanceStore((s) => !s.settings.animations || s.settings.reduceMotion);
  const fieldRefs = useRef({});
  const formRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  // Refs let the memoized column cells read fresh values (search text, the row
  // being edited, the latest handlers) without rebuilding the column defs on
  // every keystroke — which previously re-rendered the whole table.
  const queryRef = useRef(query);
  queryRef.current = query;
  const editingRef = useRef(editingRow);
  editingRef.current = editingRow;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const startEditRef = useRef(() => {});
  const handleDeleteRef = useRef(() => {});

  useEffect(() => {
    if (searchParams.has("q")) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Debounce the search box into the value sent to the server.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const loadRows = useCallback(async (append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const offset = append ? rowsRef.current.length : 0;
      const response = await api.get(endpoint, {
        params: { limit: PAGE_SIZE, offset, search: searchTerm || undefined },
      });
      const data = response.data?.data || [];
      setMeta(response.data?.meta || null);
      setRows((prev) => (append ? [...prev, ...data] : data));
    } catch { toast.error("تعذر تحميل البيانات"); }
    finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  }, [endpoint, searchTerm]);

  useEffect(() => { loadRows(false); }, [loadRows]);

  // The endpoint is server-paginated only if it returns paging meta; otherwise
  // we fall back to the previous client-side behaviour (small definition lists).
  const serverPaginated = !!(meta && meta.total != null && meta.limit != null);
  const hasMore = serverPaginated && rows.length < meta.total;

  const columns = useMemo(() => {
    const cols = [
      {
        id: "index",
        header: "#",
        accessorFn: (_, i) => String(i + 1).padStart(2, '0'),
        cell: (info) => <span className="text-[11px] font-black text-text-muted font-mono">{info.getValue()}</span>,
        size: 50,
      },
      ...columnDefs.map(col => ({
        accessorKey: col.key,
        header: col.label,
        cell: (info) => (
          <span className={`text-sm font-bold text-text-primary ${col.key === 'code' ? 'font-mono' : ''}`}>
            {col.render
              ? col.render(info.getValue(), info.row.original)
              : <Highlight text={String(info.getValue() ?? '-')} query={queryRef.current} />}
          </span>
        ),
      })),
      {
        id: "actions",
        header: "إجراءات",
        size: 100,
        cell: (info) => (
          <div className="flex items-center justify-center gap-1">
            <SmartTooltip content="تعديل هذا السجل">
              {pageKey ? (
                <PermissionGate page={pageKey} action="edit">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { e.stopPropagation(); startEditRef.current(info.row.original); }}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${editingRef.current?.id === info.row.original.id ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:bg-bg-overlay hover:text-zinc-900'}`}
                  >
                    <Edit3 className="h-4 w-4" />
                  </motion.button>
                </PermissionGate>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); startEditRef.current(info.row.original); }}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${editingRef.current?.id === info.row.original.id ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:bg-bg-overlay hover:text-zinc-900'}`}
                >
                  <Edit3 className="h-4 w-4" />
                </motion.button>
              )}
            </SmartTooltip>
            <SmartTooltip content="حذف نهائي">
              {pageKey ? (
                <PermissionGate page={pageKey} action="delete">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { e.stopPropagation(); handleDeleteRef.current(info.row.original.id); }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-text-muted hover:bg-rose-50 hover:text-rose-600 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                </PermissionGate>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); handleDeleteRef.current(info.row.original.id); }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-text-muted hover:bg-rose-50 hover:text-rose-600 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </motion.button>
              )}
            </SmartTooltip>
          </div>
        ),
      }
    ];
    return cols;
  }, [columnDefs]);

  function startCreate() {
    setEditingRow(null);
    setForm(createInitialState(fields));
  }

  function startEdit(row) {
    setEditingRow(row);
    setForm(createInitialState(fields, row));
  }

  // Step 1: open the warning modal and fetch what this record is linked to.
  async function handleDelete(id) {
    const row = rowsRef.current.find((r) => r.id === id);
    const nameKey = columnDefs?.[0]?.key;
    const itemName = (nameKey && row?.[nameKey]) || row?.name || `#${id}`;
    setDeleteState({ id, itemName, impact: null, loading: true, confirming: false });
    try {
      const res = await api.get(`${endpoint}/${id}/delete-impact`);
      setDeleteState((s) => (s && s.id === id ? { ...s, impact: res.data?.data || { mode: "unknown" }, loading: false } : s));
    } catch {
      // No impact endpoint (or it failed) — fall back to a generic warning; delete still works.
      setDeleteState((s) => (s && s.id === id ? { ...s, impact: { mode: "unknown" }, loading: false } : s));
    }
  }

  // Step 2: user confirmed in the modal — perform the actual delete/archive.
  async function performDelete() {
    const ds = deleteState;
    if (!ds) return;
    setDeleteState((s) => (s ? { ...s, confirming: true } : s));
    try {
      const res = await api.delete(`${endpoint}/${ds.id}`);
      if (res.data?.archived) {
        toast.success(res.data?.message || "تم أرشفة السجل لأنه مرتبط ببيانات أخرى");
      } else {
        toast.success("تم الحذف بنجاح");
      }
      setDeleteState(null);
      loadRows(false);
      if (editingRow?.id === ds.id) startCreate();
    } catch (err) {
      setDeleteState(null);
      // The axios interceptor already shows a toast for 5xx errors — avoid double-toasting.
      if (err?.response?.status >= 500) return;
      toast.error(err?.response?.data?.message || "فشل الحذف - السجل مرتبط ببيانات أخرى");
    }
  }

  // Keep the refs the memoized table cells call pointed at the latest handlers.
  startEditRef.current = startEdit;
  handleDeleteRef.current = handleDelete;

  async function handleSubmit(e) {
    e.preventDefault();
    if (pageKey) {
      const allowed = editingRow ? canEdit : canAdd;
      if (!allowed) { setPermDenied(true); return; }
    }
    setIsSubmitting(true);
    try {
      const payload = buildPayload(form, editingRow);
      if (editingRow) {
        await api.put(`${endpoint}/${editingRow.id}`, payload);
        toast.success("تم التحديث");
      } else {
        await api.post(endpoint, payload);
        toast.success("تمت الإضافة");
      }
      startCreate();
      loadRows(false);
    } catch { toast.error("فشل الحفظ"); }
    finally { setIsSubmitting(false); }
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-base)] flex flex-col font-sans overflow-x-hidden w-full max-w-full relative" dir="rtl">
      <PermissionDeniedModal open={permDenied} onClose={() => setPermDenied(false)} />
      <DeleteImpactModal
        open={!!deleteState}
        itemName={deleteState?.itemName}
        impact={deleteState?.impact}
        loading={!!deleteState?.loading}
        confirming={!!deleteState?.confirming}
        onCancel={() => setDeleteState(null)}
        onConfirm={performDelete}
      />
      
      {/* Animated Architectural Background */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(to_right,var(--border-subtle) 1px,transparent 1px),linear-gradient(to_bottom,var(--border-subtle) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
        
        {!reduceMotion && (
          <motion.div
            animate={{ x: ["-150%", "200%"] }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 w-[40%] h-full skew-x-12"
            style={{ background: "linear-gradient(to right,transparent,color-mix(in srgb,var(--text-primary) 8%,transparent),transparent)", mixBlendMode: "overlay" }}
          />
        )}
        
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 70% at 50% 40%,transparent 0%,var(--bg-base) 100%)" }} />
      </div>

      {/* Cinematic Hero Header */}
      <header className="relative z-10 w-full pt-24 pb-16 px-4 md:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[1400px] mx-auto flex flex-col items-start justify-center"
        >
          <div className="flex items-center gap-3 mb-8" style={{ color: "var(--text-muted)" }}>
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: 32 }} 
              transition={{ delay: 0.5, duration: 0.8 }}
              className="h-px" style={{ backgroundColor: "var(--text-muted)" }}
            />
            <Database className="h-3 w-3" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] font-mono">نظام الإدارة الأساسي</span>
          </div>
          
          <h1 className="max-w-4xl text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter leading-[1.1] mb-6" style={{ color: "var(--text-primary)" }}>
            {title}
          </h1>
          
          {description && (
            <p className="max-w-[65ch] text-base font-medium leading-relaxed pr-5" style={{ color: "var(--text-secondary)", borderRight: "2px solid var(--text-primary)" }}>
              {description}
            </p>
          )}
        </motion.div>
      </header>

      {/* Bento Grid Layout */}
      <main className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-8 pb-32">
        
        {/* Top Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="relative group w-full md:w-96"
          >
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors" style={{ color: "var(--text-muted)" }} />
            <input
              data-help="search-bar"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="البحث الفوري في السجلات..."
              className="w-full h-12 rounded-xl pr-12 pl-6 text-sm font-bold outline-none transition-all shadow-sm border"
              style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", borderColor: "var(--border-normal)" }}
              onFocus={(e) => { e.target.style.borderColor = "var(--border-accent)"; e.target.style.boxShadow = "0 0 0 2px var(--border-accent)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border-normal)"; e.target.style.boxShadow = "none"; }}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex items-center gap-2"
          >
            {importPath && (
              <button
                onClick={() => navigate(importPath)}
                className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-2sm font-black transition-all shadow-sm border"
                style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
              >
                <Upload className="h-4 w-4" /> استيراد من Excel
              </button>
            )}
            <SmartTooltip content={onExport ? "تصدير إلى Excel" : "تحميل البيانات بصيغة CSV"}>
              {pageKey ? (
                <PermissionGate page={pageKey} action="print">
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onExport ? onExport() : exportToCSV(rows, columnDefs, title)}
                    className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-2sm font-black transition-all shadow-sm border"
                    style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
                  >
                    <Download className="h-4 w-4" /> {onExport ? "تصدير Excel" : "تصدير السجلات"}
                  </motion.button>
                </PermissionGate>
              ) : (
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onExport ? onExport() : exportToCSV(rows, columnDefs, title)}
                  className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-2sm font-black transition-all shadow-sm border"
                  style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
                >
                  <Download className="h-4 w-4" /> {onExport ? "تصدير Excel" : "تصدير السجلات"}
                </motion.button>
              )}
            </SmartTooltip>
          </motion.div>
        </div>

        {/* The Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 grid-flow-dense items-start">
          
          {/* Table Container (70%) */}
          <motion.div
            data-help="main-table"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-8 rounded-3xl p-4 md:p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border overflow-x-auto"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
          >
            <DataTable
              columns={columns}
              data={rows}
              globalFilter={serverPaginated ? "" : query}
              setGlobalFilter={setQuery}
              loading={loading}
              onRowClick={startEdit}
            />
            {hasMore && (
              <div className="flex justify-center pt-5">
                <button
                  type="button"
                  onClick={() => loadRows(true)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-black transition-all shadow-sm border disabled:opacity-50"
                  style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-overlay)", borderColor: "var(--border-normal)" }}
                >
                  {loadingMore ? "جاري التحميل..." : `تحميل المزيد — ${rows.length} من ${meta.total}`}
                </button>
              </div>
            )}
          </motion.div>

          {/* Form Container (30%) */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-4 sticky top-10 flex flex-col rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border overflow-hidden transition-all duration-300"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: editingRow ? "var(--border-accent)" : "var(--border-normal)" }}
          >
            <div className="p-8 pb-6 flex items-center justify-between border-b" style={{ borderColor: editingRow ? "var(--border-accent)" : "var(--border-subtle)" }}>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                    {editingRow ? 'وضع التعديل' : 'إضافة جديد'}
                  </h2>
                  {editingRow && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase animate-pulse" style={{ backgroundColor: "var(--accent-soft)", color: "var(--text-primary)" }}>
                      نشط الآن
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest mt-1" style={{ color: "var(--text-muted)" }}>
                  {editingRow ? `تحديث السجل ID: ${editingRow.id}` : 'إنشاء سجل جديد'}
                </p>
              </div>
              {editingRow && (
                <SmartTooltip content="إلغاء التعديل والعودة للإضافة">
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={startCreate}
                    className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors shadow-sm"
                    style={{ backgroundColor: "var(--accent-soft)", color: "var(--text-primary)" }}
                  >
                    <X className="h-5 w-5" />
                  </motion.button>
                </SmartTooltip>
              )}
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="p-8 pt-6 flex flex-col gap-6" style={{ backgroundColor: "var(--bg-overlay)" }}>
              <div className="space-y-5">
                {fields.map((field, idx) => (
                  <motion.div 
                    key={field.name}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + (idx * 0.1) }}
                    className="flex flex-col gap-2 relative group"
                  >
                    <label className="text-[11px] font-black uppercase tracking-widest flex items-center justify-between" style={{ color: "var(--text-secondary)" }}>
                      {field.label}
                      {field.required && <span className="text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>مطلوب</span>}
                    </label>
                    <div className="relative">
                      {field.type === "toggle" ? (
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, [field.name]: prev[field.name] ? 0 : 1 }))}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${form[field.name] ? "bg-emerald-500" : "bg-border-strong"}`}
                          style={{ outline: "none" }}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-bg-surface shadow transition-transform ${form[field.name] ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      ) : (
                        <input
                          type={field.type || "text"}
                          required={field.required}
                          value={form[field.name]}
                          ref={el => { fieldRefs.current[idx] = el; }}
                          onKeyDown={(e) => handleKeyDown(e, {
                            nextRef: idx < fields.length - 1 ? { current: fieldRefs.current[idx + 1] } : undefined,
                            prevRef: idx > 0 ? { current: fieldRefs.current[idx - 1] } : undefined,
                            onEnter: idx === fields.length - 1 ? () => formRef.current?.requestSubmit() : undefined,
                          })}
                          onChange={(e) => setForm(prev => ({ ...prev, [field.name]: e.target.value }))}
                          className="w-full h-12 rounded-xl px-4 text-sm font-bold outline-none shadow-sm border"
                          style={{ backgroundColor: "var(--bg-input)", color: "var(--text-primary)", borderColor: editingRow ? "var(--border-accent)" : "var(--border-normal)" }}
                          placeholder={`إدخال ${field.label}...`}
                        />
                      )}
                    </div>
                    {field.name === "opening_balance" && form[field.name] !== "" && (() => {
                      const bal = Number(form[field.name] || 0);
                      const isDebit = bal > 0;
                      const isCredit = bal < 0;
                      return (
                        <div className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2 border transition-all duration-200 ${
                          isDebit
                            ? "bg-rose-50/80 border-rose-200/60"
                            : isCredit
                            ? "bg-emerald-50/80 border-emerald-200/60"
                            : "bg-bg-overlay/80 border-border-normal/60"
                        }`}>
                          <span className={`text-[11px] font-black uppercase tracking-wider ${
                            isDebit ? "text-rose-500" : isCredit ? "text-emerald-600" : "text-text-muted"
                          }`}>
                            {isDebit ? "عليه رصيد (مديون)" : isCredit ? "له رصيد (دائن)" : "رصيد مسوّى"}
                          </span>
                          <span className={`text-[15px] font-black font-mono ${
                            isDebit ? "text-rose-600" : isCredit ? "text-emerald-600" : "text-text-muted"
                          }`}>
                            {formatNumber(Math.abs(bal))}
                            <span className="text-[11px] font-bold mr-1 opacity-70">ج.م</span>
                          </span>
                        </div>
                      );
                    })()}
                  </motion.div>
                ))}
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="pt-4"
              >
                <motion.button
                  data-help="add-button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-black text-white transition-all shadow-xl disabled:opacity-50 ${
                    editingRow
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                      : 'bg-primary hover:bg-primary-600 shadow-zinc-950/20'
                  }`}
                >
                  {isSubmitting ? 'جاري المعالجة...' : (
                    <>
                      {editingRow ? <Edit3 className="h-4 w-4 text-amber-200" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                      {editingRow ? 'حفظ التعديلات' : 'تأكيد الإضافة'}
                    </>
                  )}
                </motion.button>
              </motion.div>
            </form>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
