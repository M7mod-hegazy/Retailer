import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus,
  Download,
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
  pageKey
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(() => createInitialState(fields));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const canAdd = usePermission(pageKey, 'add');
  const canEdit = usePermission(pageKey, 'edit');

  useEffect(() => {
    if (searchParams.has("q")) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  async function loadRows() {
    setLoading(true);
    try {
      const response = await api.get(endpoint);
      setRows(response.data.data || []);
    } catch { toast.error("تعذر تحميل البيانات"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadRows(); }, [endpoint]);

  const columns = useMemo(() => {
    const cols = [
      {
        id: "index",
        header: "#",
        accessorFn: (_, i) => String(i + 1).padStart(2, '0'),
        cell: (info) => <span className="text-[10px] font-black text-slate-300 font-mono">{info.getValue()}</span>,
        size: 50,
      },
      ...columnDefs.map(col => ({
        accessorKey: col.key,
        header: col.label,
        cell: (info) => (
          <span className={`text-[13px] font-bold text-slate-800 ${col.key === 'code' ? 'font-mono' : ''}`}>
            {col.render
              ? col.render(info.getValue(), info.row.original)
              : <Highlight text={String(info.getValue() ?? '-')} query={query} />}
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
                    onClick={(e) => { e.stopPropagation(); startEdit(info.row.original); }}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${editingRow?.id === info.row.original.id ? 'bg-zinc-950 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 hover:text-zinc-900'}`}
                  >
                    <Edit3 className="h-4 w-4" />
                  </motion.button>
                </PermissionGate>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); startEdit(info.row.original); }}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${editingRow?.id === info.row.original.id ? 'bg-zinc-950 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 hover:text-zinc-900'}`}
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
                    onClick={(e) => { e.stopPropagation(); handleDelete(info.row.original.id); }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                </PermissionGate>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); handleDelete(info.row.original.id); }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all"
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
  }, [columnDefs, query, editingRow]);

  function startCreate() {
    setEditingRow(null);
    setForm(createInitialState(fields));
  }

  function startEdit(row) {
    setEditingRow(row);
    setForm(createInitialState(fields, row));
  }

  async function handleDelete(id) {
    if (!window.confirm("تأكيد الحذف؟")) return;
    try {
      const res = await api.delete(`${endpoint}/${id}`);
      if (res.data?.archived) {
        toast.success(res.data?.message || "تم أرشفة السجل لأنه مرتبط ببيانات أخرى");
      } else {
        toast.success("تم الحذف بنجاح");
      }
      loadRows();
      if (editingRow?.id === id) startCreate();
    } catch { toast.error("فشل الحذف - السجل مرتبط ببيانات أخرى"); }
  }

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
      loadRows();
    } catch { toast.error("فشل الحفظ"); }
    finally { setIsSubmitting(false); }
  }

  return (
    <div className="min-h-[100dvh] bg-[#fafafa] flex flex-col font-sans overflow-x-hidden w-full max-w-full relative" dir="rtl">
      <PermissionDeniedModal open={permDenied} onClose={() => setPermDenied(false)} />
      
      {/* Impeccable Animated Architectural Background */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
        {/* Base Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />
        
        {/* Cinematic Shimmer Sweep */}
        <motion.div 
          animate={{ x: ["-150%", "200%"] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 w-[40%] h-full bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-12 mix-blend-overlay"
        />
        
        {/* Center Spotlight / Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_40%,transparent_0%,rgba(250,250,250,0.95)_100%)]" />
      </div>

      {/* Cinematic Hero Header */}
      <header className="relative z-10 w-full pt-24 pb-16 px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[1400px] mx-auto flex flex-col items-start justify-center"
        >
          <div className="flex items-center gap-3 text-slate-400 mb-8">
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: 32 }} 
              transition={{ delay: 0.5, duration: 0.8 }}
              className="h-px bg-zinc-400"
            />
            <Database className="h-3 w-3" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] font-mono">نظام الإدارة الأساسي</span>
          </div>
          
          <h1 className="max-w-4xl text-5xl md:text-7xl font-black text-zinc-950 tracking-tighter leading-[1.1] mb-6">
            {title}
          </h1>
          
          {description && (
            <p className="max-w-[65ch] text-base font-medium text-slate-500 leading-relaxed border-r-2 border-zinc-900 pr-5">
              {description}
            </p>
          )}
        </motion.div>
      </header>

      {/* Bento Grid Layout */}
      <main className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-8 pb-32">
        
        {/* Top Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="relative group w-full md:w-96"
          >
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-zinc-900 transition-colors" />
            <input
              data-help="search-bar"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="البحث الفوري في السجلات..."
              className="w-full h-12 bg-white/80 backdrop-blur-md rounded-xl pr-12 pl-6 text-sm font-bold text-zinc-800 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-zinc-900/10 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white placeholder:text-slate-400"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <SmartTooltip content="تحميل البيانات بصيغة CSV">
              {pageKey ? (
                <PermissionGate page={pageKey} action="print">
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => exportToCSV(rows, columnDefs, title)}
                    className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-[12px] font-black text-slate-700 bg-white hover:bg-slate-50 transition-all shadow-sm border border-slate-200"
                  >
                    <Download className="h-4 w-4" /> تصدير السجلات
                  </motion.button>
                </PermissionGate>
              ) : (
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => exportToCSV(rows, columnDefs, title)}
                  className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-[12px] font-black text-slate-700 bg-white hover:bg-slate-50 transition-all shadow-sm border border-slate-200"
                >
                  <Download className="h-4 w-4" /> تصدير السجلات
                </motion.button>
              )}
            </SmartTooltip>
          </motion.div>
        </div>

        {/* The Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 grid-flow-dense items-start">
          
          {/* Table Container (70%) */}
          <motion.div
            data-help="main-table"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-8 bg-white/95 backdrop-blur-3xl rounded-3xl p-4 md:p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100"
          >
            <DataTable 
              columns={columns} 
              data={rows} 
              globalFilter={query}
              setGlobalFilter={setQuery}
              loading={loading}
              onRowClick={startEdit}
            />
          </motion.div>

          {/* Form Container (30%) */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className={`lg:col-span-4 sticky top-10 flex flex-col backdrop-blur-3xl rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border overflow-hidden transition-all duration-300 ${
              editingRow 
                ? 'bg-amber-50/95 border-amber-300 shadow-amber-500/10 ring-4 ring-amber-500/10' 
                : 'bg-white/95 border-slate-100'
            }`}
          >
            <div className={`p-8 pb-6 flex items-center justify-between border-b ${editingRow ? 'border-amber-200/50' : 'border-slate-50/50'}`}>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={`text-xl font-black tracking-tight ${editingRow ? 'text-amber-900' : 'text-zinc-900'}`}>
                    {editingRow ? 'وضع التعديل' : 'إضافة جديد'}
                  </h2>
                  {editingRow && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[9px] font-black tracking-widest uppercase animate-pulse">
                      نشط الآن
                    </span>
                  )}
                </div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${editingRow ? 'text-amber-700/70' : 'text-slate-400'}`}>
                  {editingRow ? `تحديث السجل ID: ${editingRow.id}` : 'إنشاء سجل جديد'}
                </p>
              </div>
              {editingRow && (
                <SmartTooltip content="إلغاء التعديل والعودة للإضافة">
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={startCreate}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-900 hover:bg-amber-200 hover:text-amber-950 transition-colors shadow-sm"
                  >
                    <X className="h-5 w-5" />
                  </motion.button>
                </SmartTooltip>
              )}
            </div>

            <form onSubmit={handleSubmit} className={`p-8 pt-6 flex flex-col gap-6 ${editingRow ? 'bg-amber-100/20' : 'bg-slate-50/30'}`}>
              <div className="space-y-5">
                {fields.map((field, idx) => (
                  <motion.div 
                    key={field.name}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + (idx * 0.1) }}
                    className="flex flex-col gap-2 relative group"
                  >
                    <label className={`text-[10px] font-black uppercase tracking-widest flex items-center justify-between ${editingRow ? 'text-amber-900/70' : 'text-slate-500'}`}>
                      {field.label}
                      {field.required && <span className={`text-[9px] font-bold ${editingRow ? 'text-amber-600' : 'text-zinc-400'}`}>مطلوب</span>}
                    </label>
                    <div className="relative">
                      {field.type === "toggle" ? (
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, [field.name]: prev[field.name] ? 0 : 1 }))}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 ${form[field.name] ? "bg-emerald-500" : "bg-slate-300"}`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form[field.name] ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      ) : (
                        <input
                          type={field.type || "text"}
                          required={field.required}
                          value={form[field.name]}
                          onChange={(e) => setForm(prev => ({ ...prev, [field.name]: e.target.value }))}
                          className={`w-full h-12 bg-white rounded-xl px-4 text-sm font-bold outline-none transition-all shadow-sm border ${
                            editingRow
                              ? 'text-amber-950 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 placeholder:text-amber-300'
                              : 'text-zinc-900 border-slate-200 focus:border-zinc-400 placeholder:text-slate-300'
                          }`}
                          placeholder={`إدخال ${field.label}...`}
                        />
                      )}
                    </div>
                    {/* Live balance preview for opening_balance field */}
                    {field.name === "opening_balance" && form[field.name] !== "" && (() => {
                      const bal = Number(form[field.name] || 0);
                      const isDebit = bal > 0;
                      const isCredit = bal < 0;
                      const isZero = bal === 0;
                      return (
                        <div className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2 border transition-all duration-200 ${
                          isDebit
                            ? "bg-rose-50/80 border-rose-200/60"
                            : isCredit
                            ? "bg-emerald-50/80 border-emerald-200/60"
                            : "bg-slate-50/80 border-slate-200/60"
                        }`}>
                          <span className={`text-[10px] font-black uppercase tracking-wider ${
                            isDebit ? "text-rose-500" : isCredit ? "text-emerald-600" : "text-slate-400"
                          }`}>
                            {isDebit ? "عليه رصيد (مديون)" : isCredit ? "له رصيد (دائن)" : "رصيد مسوّى"}
                          </span>
                          <span className={`text-[15px] font-black font-mono ${
                            isDebit ? "text-rose-600" : isCredit ? "text-emerald-600" : "text-slate-400"
                          }`}>
                            {Math.abs(bal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            <span className="text-[10px] font-bold mr-1 opacity-70">ج.م</span>
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
                  className={`w-full h-12 flex items-center justify-center gap-2 rounded-xl text-[13px] font-black text-white transition-all shadow-xl disabled:opacity-50 ${
                    editingRow
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                      : 'bg-zinc-950 hover:bg-zinc-800 shadow-zinc-950/20'
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
