import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { usePageTour } from "../../hooks/usePageTour";
import { usePerformanceStore } from "../../stores/performanceStore";
import { useNavigate } from "react-router-dom";
import {
  Plus, Download, Users, Search, Edit3, Trash2, CheckCircle2, Database, Minus, MapPin, BarChart3,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import DataTable from "../../components/ui/DataTable";
import SmartTooltip from "../../components/ui/SmartTooltip";
import PermissionGate from "../../components/ui/PermissionGate";
import { usePermission } from "../../hooks/usePermission";
import PermissionDeniedModal from "../../components/ui/PermissionDeniedModal";
import DeleteImpactModal from "../../components/ui/DeleteImpactModal";
import EmployeeDetail from "./employees/EmployeeDetail";

const PERIOD_LABELS = {
  monthly: "شهري",
  weekly: "أسبوعي",
  daily: "يومي",
};

export default function EmployeesPage() {
  usePageTour('employees');
  const navigate = useNavigate();
  const reduceMotion = usePerformanceStore((s) => !s.settings.animations || s.settings.reduceMotion);
  const canAdd = usePermission("employees", "add");
  const canEdit = usePermission("employees", "edit");

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [query, setQuery] = useState("");

  // Simple add/edit form fields
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState({ name: "", role: "", phone: "", address: "", phones: [], salary: 0, salary_period: "monthly", working_days_per_month: 26 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Permissions
  const [permDenied, setPermDenied] = useState(false);
  const [deleteState, setDeleteState] = useState(null);

  useEffect(() => { loadEmployees(); }, []);

  useEffect(() => {
    if (!showForm) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setShowForm(false); setEditingRow(null); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [showForm]);

  useEffect(() => {
    if (!permDenied) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setPermDenied(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [permDenied]);

  useEffect(() => {
    if (!deleteState) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setDeleteState(null); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [deleteState]);

  async function loadEmployees() {
    setLoading(true);
    try {
      const res = await api.get("/api/employees");
      if (res.data?.success) setEmployees(res.data.data);
    } catch { toast.error("تعذر تحميل البيانات"); }
    finally { setLoading(false); }
  }

  const filteredEmployees = useMemo(() => {
    if (!query) return employees;
    const q = query.toLowerCase();
    return employees.filter(e => {
      const phonesStr = e.phones ? JSON.parse(e.phones).join(" ") : (e.phone || "");
      return (e.name || "").toLowerCase().includes(q) ||
        (e.role || "").toLowerCase().includes(q) ||
        (e.job_title || "").toLowerCase().includes(q) ||
        (e.phone || "").toLowerCase().includes(q) ||
        (e.address || "").toLowerCase().includes(q) ||
        phonesStr.toLowerCase().includes(q);
    });
  }, [employees, query]);

  function startCreate() {
    setEditingRow(null);
    setForm({ name: "", role: "", phone: "", address: "", phones: [], salary: 0, salary_period: "monthly", working_days_per_month: 26 });
    setShowForm(true);
  }

  function startEdit(row) {
    const phones = row.phones ? JSON.parse(row.phones) : (row.phone ? [row.phone] : []);
    setEditingRow(row);
    setForm({ name: row.name || "", role: row.job_title || row.role || "", phone: row.phone || "", address: row.address || "", phones, salary: row.salary || 0, salary_period: row.salary_period || "monthly", working_days_per_month: row.working_days_per_month || 26 });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name) { toast.error("اسم الموظف مطلوب"); return; }
    setIsSubmitting(true);
    const payload = {
      ...form,
      job_title: form.role,
      phones: (form.phones || []).filter(p => p.trim() !== ""),
      phone: (form.phones || []).find(p => p.trim() !== "") || form.phone || "",
    };
    try {
      if (editingRow) {
        await api.put(`/api/employees/${editingRow.id}`, payload);
        toast.success("اتحفظ بنجاح");
      } else {
        await api.post("/api/employees", payload);
        toast.success("اتضاف بنجاح");
      }
      setShowForm(false);
      setEditingRow(null);
      setForm({ name: "", role: "", phone: "", address: "", phones: [], salary: 0, salary_period: "monthly", working_days_per_month: 26 });
      loadEmployees();
    } catch { toast.error("الحفظ ما نجحش"); }
    finally { setIsSubmitting(false); }
  }

  async function handleDelete(id) {
    const row = employees.find(r => r.id === id);
    const itemName = row?.name || `#${id}`;
    setDeleteState({ id, itemName, impact: null, loading: true, confirming: false });
    try {
      const res = await api.get(`/api/employees/${id}/delete-impact`);
      setDeleteState(s => s && s.id === id ? { ...s, impact: res.data?.data || { mode: "unknown" }, loading: false } : s);
    } catch {
      setDeleteState(s => s && s.id === id ? { ...s, impact: { mode: "unknown" }, loading: false } : s);
    }
  }

  async function performDelete() {
    const ds = deleteState;
    if (!ds) return;
    setDeleteState(s => s ? { ...s, confirming: true } : s);
    try {
      const res = await api.delete(`/api/employees/${ds.id}`);
      if (res.data?.archived) toast.success(res.data?.message || "تم أرشفة الموظف");
      else toast.success("تم الحذف بنجاح");
      setDeleteState(null);
      loadEmployees();
      if (selectedEmployee?.id === ds.id) setSelectedEmployee(null);
    } catch (err) {
      setDeleteState(null);
      if (err?.response?.status >= 500) return;
      toast.error(err?.response?.data?.message || "فشل الحذف");
    }
  }

  const columns = useMemo(() => [
    {
      id: "index",
      header: "#",
      accessorFn: (_, i) => String(i + 1).padStart(2, '0'),
      cell: (info) => <span className="text-[11px] font-black text-text-muted font-mono">{info.getValue()}</span>,
      size: 50,
    },
    {
      accessorKey: "name",
      header: "الموظف",
      cell: (info) => {
        const row = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {(row.name || "?")?.charAt(0)}
            </div>
            <span className="text-sm font-bold text-text-primary">{row.name}</span>
          </div>
        );
      },
    },
    { id: "role", header: "المسمى", accessorFn: (row) => row.job_title || row.role || "-", cell: (info) => <span className="text-sm font-bold text-text-secondary">{info.getValue()}</span> },
    { accessorKey: "phone", header: "الهاتف", cell: (info) => <span className="text-sm font-bold text-text-secondary font-mono">{info.getValue() || "-"}</span> },
    {
      accessorKey: "salary",
      header: "الراتب",
      cell: (info) => {
        const val = info.getValue();
        return val > 0
          ? <span className="text-sm font-black text-emerald-700 font-mono">{Number(val).toLocaleString()}</span>
          : <span className="text-xs text-text-muted">-</span>;
      },
    },
    {
      accessorKey: "salary_period",
      header: "الدورة",
      cell: (info) => {
        const period = info.getValue() || "monthly";
        return <span className="text-xs font-bold text-text-muted bg-bg-overlay px-2 py-0.5 rounded">{PERIOD_LABELS[period] || period}</span>;
      },
    },
    {
      id: "actions",
      header: "",
      size: 80,
      cell: (info) => (
        <div className="flex items-center justify-center gap-1">
          <SmartTooltip content="تعديل">
            <PermissionGate page="employees" action="edit">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); startEdit(info.row.original); }}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-text-muted hover:bg-bg-overlay hover:text-zinc-900 transition-all"
              >
                <Edit3 className="h-4 w-4" />
              </motion.button>
            </PermissionGate>
          </SmartTooltip>
          <SmartTooltip content="حذف">
            <PermissionGate page="employees" action="delete">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); handleDelete(info.row.original.id); }}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-text-muted hover:bg-rose-50 hover:text-rose-600 transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </motion.button>
            </PermissionGate>
          </SmartTooltip>
        </div>
      ),
    },
  ], []);

  return (
    <div className="min-h-screen flex flex-col font-sans w-full max-w-full relative pb-12" style={{ background: "linear-gradient(145deg, var(--bg-base) 0%, color-mix(in srgb, var(--primary) 3.5%, var(--bg-base)) 60%, var(--bg-surface) 100%)" }} dir="rtl">
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

      {/* Premium Glassmorphic Ambient Background — theme-aware */}
      <div className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden opacity-[0.95]">
        {/* Primary brand blob — top right */}
        <div 
          className="absolute -top-[10%] -right-[15%] w-[70vw] h-[70vw] max-w-[850px] rounded-full blur-[140px]" 
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 28%, transparent) 0%, transparent 70%)" }}
        />
        {/* Info/secondary blob — bottom left */}
        <div 
          className="absolute -bottom-[15%] -left-[10%] w-[65vw] h-[65vw] max-w-[750px] rounded-full blur-[150px]" 
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 14%, transparent) 0%, transparent 70%)" }}
        />
        {/* Subtle mid blob — center */}
        <div 
          className="absolute top-[25%] left-[20%] w-[55vw] h-[55vw] max-w-[650px] rounded-full blur-[130px]" 
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--bg-overlay) 60%, transparent) 0%, transparent 70%)" }}
        />
      </div>

      {/* Modern High-End Radial Masked Gridline Pattern */}
      <div 
        className="fixed inset-0 pointer-events-none select-none z-0 opacity-[0.55]" 
        style={{ 
          backgroundImage: `linear-gradient(to right, var(--border-normal) 1px, transparent 1px), 
                            linear-gradient(to bottom, var(--border-normal) 1px, transparent 1px)`, 
          backgroundSize: "45px 45px"
        }} 
      />

      {/* Compact header with page description (Fully Transparent) */}
      <header className="relative z-10 shrink-0 px-6 md:px-8 pt-6 pb-2" style={{ backgroundColor: "transparent" }}>
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex flex-col gap-1 text-right">
            <div className="flex items-center gap-1.5 text-[9px] font-black tracking-widest text-[var(--primary)] uppercase">
              <Database className="h-3 w-3" />
              <span>نظام إدارة الموظفين</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
              الموظفون
            </h1>
            <p className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
              إدارة بيانات الموظفين والرواتب والسلفيات والخصومات والمكافآت
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SmartTooltip content="السجل الكامل للموظف">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/reports/source/employees/employee-full-history/detailed")}
                className="flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-black transition-all shadow-sm border hover:bg-[var(--accent-soft)]"
                style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
              >
                <BarChart3 className="h-4 w-4" /> السجل الكامل
              </motion.button>
            </SmartTooltip>
            <SmartTooltip content="تصدير CSV">
              <motion.button
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-black transition-all shadow-sm border hover:bg-[var(--accent-soft)]"
                style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
              >
                <Download className="h-4 w-4" /> تصدير
              </motion.button>
            </SmartTooltip>
            {canAdd && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={startCreate}
                className="h-10 px-5 bg-primary text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" /> إضافة موظف جديد
              </motion.button>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout Workspace with independent scrollings */}
      <main className="relative z-10 w-full max-w-[1600px] mx-auto px-6 md:px-8 pb-12 flex-1">
        <div className="flex flex-col lg:flex-row gap-8 w-full">
          
          {/* Right Panel — Employee Directory (List) */}
          <div className="lg:w-[380px] shrink-0 flex flex-col rounded-3xl border overflow-hidden shadow-elevated backdrop-blur-md transition-all duration-300 hover:shadow-modal"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
          >
            {/* Search */}
            <div className="p-4 border-b shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--text-muted)" }} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="بحث في الموظفين..."
                  className="w-full h-10 rounded-xl pr-10 pl-4 text-sm font-bold outline-none transition-all border"
                  style={{ backgroundColor: "var(--bg-input)", color: "var(--text-primary)", borderColor: "var(--border-normal)" }}
                />
              </div>
            </div>

            {/* Employee List Scroll Container */}
            <div className="p-2 space-y-1">
              {filteredEmployees.map(emp => {
                const isSelected = selectedEmployee?.id === emp.id;
                return (
                  <motion.button
                    key={emp.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedEmployee(isSelected ? null : emp)}
                    className={`w-full text-right p-3 rounded-2xl transition-all flex items-center gap-3 border ${
                      isSelected
                        ? "border-[var(--primary)]"
                        : "bg-transparent border-transparent hover:bg-[var(--bg-base)] hover:border-[var(--border-subtle)]"
                    }`}
                    style={{
                      backgroundColor: isSelected ? "var(--accent-soft)" : "transparent"
                    }}
                  >
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm flex-shrink-0`}
                         style={{
                           background: isSelected 
                             ? "var(--primary)" 
                             : "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 60%, black) 100%)"
                         }}>
                      {(emp.name || "?")?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black truncate" style={{ color: "var(--text-primary)" }}>{emp.name}</span>
                        {emp.salary > 0 && (
                          <span className="text-[10px] font-black font-mono" style={{ color: "var(--success-text)" }}>{Number(emp.salary).toLocaleString()}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {(emp.job_title || emp.role) && <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>{emp.job_title || emp.role}</span>}
                        {emp.phone && <span className="text-[10px] font-bold font-mono" style={{ color: "var(--text-muted)" }}>{emp.phone}</span>}
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                          {PERIOD_LABELS[emp.salary_period] || "شهري"}
                        </span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
              {!loading && filteredEmployees.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                  <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>لا يوجد موظفون</p>
                </div>
              )}
            </div>
          </div>

          {/* Left Panel — Employee Detail View */}
          <div className="flex-1 rounded-3xl border shadow-elevated backdrop-blur-md flex flex-col overflow-hidden"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
          >
            <EmployeeDetail
              employee={selectedEmployee}
              employees={employees}
              onStartCreate={startCreate}
              onClose={() => setSelectedEmployee(null)}
              onUpdate={(updated) => {
                setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
                setSelectedEmployee(updated);
              }}
            />
          </div>
        </div>
      </main>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={() => { setShowForm(false); setEditingRow(null); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-bg-surface rounded-3xl shadow-2xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-black text-text-primary mb-6">
              {editingRow ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider">اسم الموظف <span className="text-rose-500">*</span></label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full h-12 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-blue-400 transition-all"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider">المسمى الوظيفي</label>
                <input
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full h-12 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-blue-400 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider">الراتب الأساسي</label>
                  <input
                    type="number"
                    min="0"
                    value={form.salary}
                    onChange={e => setForm({ ...form, salary: Number(e.target.value) || 0 })}
                    className="w-full h-12 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-blue-400 transition-all"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider">فترة الدفع</label>
                  <select
                    value={form.salary_period}
                    onChange={e => setForm({ ...form, salary_period: e.target.value })}
                    className="w-full h-12 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-blue-400 transition-all appearance-none"
                  >
                    <option value="monthly">شهري</option>
                    <option value="weekly">أسبوعي</option>
                    <option value="daily">يومي</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider">العنوان</label>
                <input
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full h-12 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-blue-400 transition-all"
                  placeholder="العنوان (اختياري)"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider">أرقام الهاتف</label>
                {(form.phones || []).map((ph, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      value={ph}
                      onChange={e => {
                        const updated = [...form.phones];
                        updated[idx] = e.target.value;
                        setForm({ ...form, phones: updated });
                      }}
                      className="flex-1 h-12 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-blue-400 transition-all"
                      placeholder={`رقم ${idx + 1}`}
                    />
                    {form.phones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, phones: form.phones.filter((_, i) => i !== idx) })}
                        className="h-12 w-12 flex items-center justify-center rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 transition-all"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, phones: [...(form.phones || []), ""] })}
                  className="text-xs font-black text-blue-600 hover:text-blue-800 transition-all flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> إضافة رقم آخر
                </button>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingRow(null); }}
                  className="flex-1 h-12 bg-bg-surface border border-border-normal text-text-secondary rounded-xl text-sm font-black transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isSubmitting ? "بيتحفظ..." : editingRow ? "حفظ التعديلات" : "إضافة"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
