import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus, Download, Edit3, Trash2, CheckCircle2,
  Database, Search, X, TrendingDown, TrendingUp, Banknote, Tag
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { usePageTour } from "../../hooks/usePageTour";
import DataTable from "../../components/ui/DataTable";
import SmartTooltip from "../../components/ui/SmartTooltip";
import PermissionGate from "../../components/ui/PermissionGate";

function createInitialState(fields, source = {}) {
  return fields.reduce((acc, field) => ({ ...acc, [field.name]: source[field.name] ?? field.initialValue ?? "" }), {});
}

function Highlight({ text, query }) {
  if (!query) return <span>{text}</span>;
  const parts = String(text).split(new RegExp(`(${query})`, 'gi'));
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

const TABS = [
  {
    id: "expenses",
    label: "المصروفات",
    icon: TrendingDown,
    color: "rose",
    endpoint: "/api/expenses/categories",
    description: "أقسام المصاريف التشغيلية والإيجارات والفواتير الدورية.",
    fields: [
      { name: "name", label: "اسم القسم", required: true },
      { name: "description", label: "الوصف", required: false }
    ],
    recommendations: ["إيجار", "كهرباء وغاز", "رواتب", "مواصلات", "صيانة", "مواد تشغيل", "دعاية وإعلان"],
  },
  {
    id: "revenues",
    label: "الإيرادات",
    icon: TrendingUp,
    color: "emerald",
    endpoint: "/api/revenues/categories",
    description: "إيرادات إضافية خارج نطاق المبيعات المباشرة للمنتجات.",
    fields: [
      { name: "name", label: "اسم القسم", required: true },
      { name: "description", label: "الوصف", required: false }
    ],
    recommendations: ["إيجار مساحة", "عمولات", "استرداد تأمينات", "خدمات إضافية"],
  },
  {
    id: "withdrawals",
    label: "المسحوبات",
    icon: Banknote,
    color: "amber",
    endpoint: "/api/withdrawals/categories",
    description: "المبالغ المسحوبة لأغراض شخصية أو سلفيات الموظفين.",
    fields: [
      { name: "name", label: "اسم القسم", required: true },
      { name: "description", label: "الوصف", required: false }
    ],
    recommendations: ["مسحوبات المالك", "سلف موظفين", "مصاريف شخصية"],
  },
];

export default function FinancialCategoriesPage() {
  usePageTour('financial_categories');
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTabId, setActiveTabId] = useState("expenses");
  
  const activeTab = useMemo(() => TABS.find(t => t.id === activeTabId), [activeTabId]);
  
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(() => createInitialState(activeTab.fields));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.has("q")) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(activeTab.endpoint);
      setRows(response.data.data || []);
    } catch { toast.error("تعذر تحميل البيانات"); }
    finally { setLoading(false); }
  }, [activeTab.endpoint]);

  useEffect(() => {
    loadRows();
    startCreate(); 
  }, [activeTab.id, loadRows]);

  function startCreate() {
    setEditingRow(null);
    setForm(createInitialState(activeTab.fields));
  }

  function startEdit(row) {
    setEditingRow(row);
    setForm(createInitialState(activeTab.fields, row));
  }

  async function handleDelete(id) {
    if (!window.confirm("تأكيد الحذف؟")) return;
    try {
      const res = await api.delete(`${activeTab.endpoint}/${id}`);
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
    if (e) e.preventDefault();
    if (!form.name?.trim()) return toast.error("الاسم مطلوب");
    setIsSubmitting(true);
    try {
      if (editingRow) {
        await api.put(`${activeTab.endpoint}/${editingRow.id}`, form);
        toast.success("تم التحديث بنجاح");
      } else {
        await api.post(activeTab.endpoint, form);
        toast.success("تمت الإضافة بنجاح");
      }
      startCreate();
      loadRows();
    } catch { toast.error("فشل الحفظ"); }
    finally { setIsSubmitting(false); }
  }
  
  const handleQuickAdd = async (name) => {
    const exists = rows.some((r) => r.name === name);
    if (exists) return toast.error("هذا القسم موجود بالفعل");
    
    setIsSubmitting(true);
    try {
      await api.post(activeTab.endpoint, { name, description: "" });
      toast.success(`تمت إضافة "${name}"`);
      loadRows();
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الإضافة السريعة");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = useMemo(() => {
    const cols = [
      {
        id: "index",
        header: "#",
        accessorFn: (_, i) => String(i + 1).padStart(2, '0'),
        cell: (info) => <span className="text-[11px] font-black text-slate-300 font-mono">{info.getValue()}</span>,
        size: 50,
      },
      {
        accessorKey: "name",
        header: "القسم",
        cell: (info) => (
          <span className="text-sm font-bold text-slate-800">
            <Highlight text={String(info.getValue() ?? '-')} query={query} />
          </span>
        ),
      },
      {
        accessorKey: "description",
        header: "الوصف",
        cell: (info) => {
          const val = info.getValue();
          return val ? (
            <span className="text-2sm font-medium text-slate-500">
               <Highlight text={String(val)} query={query} />
            </span>
          ) : <span className="text-2sm font-medium text-slate-300">—</span>;
        },
      },
      {
        id: "actions",
        header: "إجراءات",
        size: 100,
        cell: (info) => (
          <div className="flex items-center justify-center gap-1">
            <SmartTooltip content="تعديل هذا السجل">
              <PermissionGate page="financial_categories" action="edit">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); startEdit(info.row.original); }}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${editingRow?.id === info.row.original.id ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 hover:text-zinc-900'}`}
                >
                  <Edit3 className="h-4 w-4" />
                </motion.button>
              </PermissionGate>
            </SmartTooltip>
            <SmartTooltip content="حذف نهائي">
              <PermissionGate page="financial_categories" action="delete">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); handleDelete(info.row.original.id); }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </motion.button>
              </PermissionGate>
            </SmartTooltip>
          </div>
        ),
      }
    ];
    return cols;
  }, [query, editingRow, activeTab]);

  const csvColumnDefs = [
    { key: "id", label: "#" },
    { key: "name", label: "القسم" },
    { key: "description", label: "الوصف" }
  ];

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-base)] flex flex-col font-sans overflow-x-hidden w-full max-w-full relative" dir="rtl">
      
      {/* Impeccable Animated Architectural Background */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />
        <motion.div 
          animate={{ x: ["-150%", "200%"] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 w-[40%] h-full bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-12 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_40%,transparent_0%,color-mix(in srgb,var(--bg-surface) 95%,transparent)_100%)]" />
      </div>

      {/* Cinematic Hero Header */}
      <header className="relative z-10 w-full pt-24 pb-12 px-8">
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
            <span className="text-[11px] font-black uppercase tracking-[0.2em] font-mono">نظام الإدارة الأساسي</span>
          </div>
          
          <h1 className="max-w-4xl text-5xl md:text-7xl font-black text-zinc-950 tracking-tighter leading-[1.1] mb-6">
            الأقسام المالية
          </h1>
          
          <p className="max-w-[65ch] text-base font-medium text-slate-500 leading-relaxed border-r-2 border-zinc-900 pr-5">
            إدارة كافة الأقسام المالية لتنظيم حركاتك وتقاريرك. 
            اختر نوع القسم أدناه لإدارة البيانات الخاصة به.
          </p>

          {/* Enhanced Tabs Switcher */}
          <div className="mt-8 flex flex-wrap gap-2">
            {TABS.map((t) => {
              const isActive = t.id === activeTabId;
              const TIcon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTabId(t.id)}
                  className={`relative px-6 py-3 text-sm font-black transition-all rounded-2xl flex items-center gap-2 overflow-hidden border ${
                    isActive 
                      ? 'border-zinc-900 text-white shadow-lg' 
                      : 'border-slate-200/50 bg-white/50 text-slate-500 hover:text-zinc-900 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="financeTabsIndicator"
                      className="absolute inset-0 bg-zinc-950 -z-10"
                      transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    />
                  )}
                  <TIcon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
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
            data-help="search-bar"
          className="relative group w-full md:w-96"
          >
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-zinc-900 transition-colors" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`البحث الفوري في سجلات ${activeTab.label}...`}
              className="w-full h-12 bg-white/80 backdrop-blur-md rounded-xl pr-12 pl-6 text-sm font-bold text-zinc-800 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-zinc-900/10 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white placeholder:text-slate-400"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <SmartTooltip content="تحميل البيانات بصيغة CSV">
              <motion.button 
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => exportToCSV(rows, csvColumnDefs, activeTab.label)}
                className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-2sm font-black text-slate-700 bg-white hover:bg-slate-50 transition-all shadow-sm border border-slate-200"
              >
                <Download className="h-4 w-4" /> تصدير السجلات
              </motion.button>
            </SmartTooltip>
          </motion.div>
        </div>

        {/* The Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 grid-flow-dense items-start">
          
          {/* Table Container (70%) */}
          <motion.div 
            key={`table-${activeTab.id}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            data-help="main-table"
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
                <p className={`text-[11px] font-bold uppercase tracking-widest mt-1 ${editingRow ? 'text-amber-700/70' : 'text-slate-400'}`}>
                  {editingRow ? `تحديث السجل ID: ${editingRow.id}` : `إنشاء ${activeTab.label} جديدة`}
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
                {activeTab.fields.map((field, idx) => (
                  <motion.div 
                    key={field.name}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + (idx * 0.1) }}
                    className="flex flex-col gap-2 relative group"
                  >
                    <label className={`text-[11px] font-black uppercase tracking-widest flex items-center justify-between ${editingRow ? 'text-amber-900/70' : 'text-slate-500'}`}>
                      {field.label}
                      {field.required && <span className={`text-[9px] font-bold ${editingRow ? 'text-amber-600' : 'text-zinc-400'}`}>مطلوب</span>}
                    </label>
                    <div className="relative">
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
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="pt-4"
              >
                <PermissionGate page="financial_categories" action={editingRow ? "edit" : "add"}>
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
                </PermissionGate>
              </motion.div>
              
              {/* Quick Add Section */}
              {!editingRow && activeTab.recommendations && (
                <div className="mt-4 pt-4 border-t border-slate-200/60">
                  <div className="flex items-center gap-2 mb-3 text-slate-400">
                    <Tag className="h-3 w-3" />
                    <span className="text-[11px] font-black uppercase tracking-widest">إضافة سريعة</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeTab.recommendations.map(rec => {
                      const exists = rows.some(r => r.name === rec);
                      return (
                        <button
                          key={rec}
                          type="button"
                          disabled={exists || isSubmitting}
                          onClick={() => handleQuickAdd(rec)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                            exists 
                              ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-zinc-300 hover:text-zinc-900 shadow-sm hover:shadow active:scale-95'
                          }`}
                        >
                          {rec}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
            </form>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
