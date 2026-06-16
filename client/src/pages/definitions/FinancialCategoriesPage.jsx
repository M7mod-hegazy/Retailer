import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus, Download, Edit3, Trash2, CheckCircle2,
  Database, Search, X, TrendingDown, TrendingUp, Banknote, Tag
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
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
  const handleKeyDown = useFieldNavigation();
  const nameRef = useRef(null);
  const descriptionRef = useRef(null);
  const submitBtnRef = useRef(null);
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
        cell: (info) => <span className="text-[11px] number-fmt text-slate-300">{info.getValue()}</span>,
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
      
      {/* Animated Architectural Background */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(to_right,var(--border-subtle) 1px,transparent 1px),linear-gradient(to_bottom,var(--border-subtle) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
        <motion.div 
          animate={{ x: ["-150%", "200%"] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 w-[40%] h-full skew-x-12"
          style={{ background: "linear-gradient(to right,transparent,color-mix(in srgb,var(--text-primary) 8%,transparent),transparent)", mixBlendMode: "overlay" }}
        />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 70% at 50% 40%,transparent 0%,var(--bg-base) 100%)" }} />
      </div>

      {/* Cinematic Hero Header */}
      <header className="relative z-10 w-full pt-24 pb-12 px-4 md:px-8">
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
            الأقسام المالية
          </h1>
          
          <p className="max-w-[65ch] text-base font-medium leading-relaxed pr-5" style={{ color: "var(--text-secondary)", borderRight: "2px solid var(--text-primary)" }}>
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
                  className="relative px-6 py-3 text-sm font-black transition-all rounded-2xl flex items-center gap-2 overflow-hidden border"
                  style={{
                    borderColor: isActive ? "var(--text-primary)" : "var(--border-subtle)",
                    color: isActive ? "white" : "var(--text-muted)",
                    backgroundColor: isActive ? "transparent" : "var(--bg-surface)"
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="financeTabsIndicator"
                      className="absolute inset-0 -z-10"
                      style={{ backgroundColor: "var(--text-primary)" }}
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
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors" style={{ color: "var(--text-muted)" }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`البحث الفوري في سجلات ${activeTab.label}...`}
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
          >
            <SmartTooltip content="تحميل البيانات بصيغة CSV">
              <motion.button 
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => exportToCSV(rows, csvColumnDefs, activeTab.label)}
                className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-2sm font-black transition-all shadow-sm border"
                style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
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
          className="lg:col-span-8 rounded-3xl p-4 md:p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border overflow-x-auto"
          style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
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
                  {editingRow ? `تحديث السجل ID: ${editingRow.id}` : `إنشاء ${activeTab.label} جديدة`}
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

            <form onSubmit={handleSubmit} className="p-8 pt-6 flex flex-col gap-6" style={{ backgroundColor: "var(--bg-overlay)" }}>
              <div className="space-y-5">
                {activeTab.fields.map((field, idx) => (
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
                      <input
                        ref={field.name === "name" ? nameRef : field.name === "description" ? descriptionRef : undefined}
                        type={field.type || "text"}
                        required={field.required}
                        value={form[field.name]}
                        onChange={(e) => setForm(prev => ({ ...prev, [field.name]: e.target.value }))}
                        onKeyDown={e => {
                          const nextMap = { name: descriptionRef, description: submitBtnRef };
                          const prevMap = { description: nameRef };
                          handleKeyDown(e, { nextRef: nextMap[field.name], prevRef: prevMap[field.name] });
                        }}
                        className="w-full h-12 rounded-xl px-4 text-sm font-bold outline-none transition-all shadow-sm border"
                        style={{ backgroundColor: "var(--bg-input)", color: "var(--text-primary)", borderColor: editingRow ? "var(--border-accent)" : "var(--border-normal)" }}
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
                    ref={submitBtnRef}
                    data-help="add-button"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-black text-white transition-all shadow-xl disabled:opacity-50"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    {isSubmitting ? 'جاري المعالجة...' : (
                      <>
                        {editingRow ? <Edit3 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        {editingRow ? 'حفظ التعديلات' : 'تأكيد الإضافة'}
                      </>
                    )}
                  </motion.button>
                </PermissionGate>
              </motion.div>
              
              {/* Quick Add Section */}
              {!editingRow && activeTab.recommendations && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-center gap-2 mb-3" style={{ color: "var(--text-muted)" }}>
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
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all shadow-sm"
                          style={{
                            backgroundColor: exists ? "var(--bg-overlay)" : "var(--bg-surface)",
                            borderColor: exists ? "var(--border-subtle)" : "var(--border-normal)",
                            color: exists ? "var(--text-muted)" : "var(--text-secondary)"
                          }}
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
