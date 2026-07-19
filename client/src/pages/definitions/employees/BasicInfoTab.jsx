import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, X, Plus, Minus } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../services/api";
import PermissionGate from "../../../components/ui/PermissionGate";
import { usePermission } from "../../../hooks/usePermission";
import {
  DEFAULT_MONTHLY_WORK_DAYS,
  formatMoney,
  getDailySalary,
  getDailySalaryBasis,
  normalizeMonthlyWorkDays,
} from "./salaryUtils";

const PERIOD_OPTIONS = [
  { value: "monthly", label: "شهري" },
  { value: "weekly", label: "أسبوعي" },
  { value: "daily", label: "يومي" },
];

export default function BasicInfoTab({ employee, onUpdate }) {
  const canViewSalary = usePermission("employees", "salary_view");
  const canEditSalary = usePermission("employees", "salary_edit");
  const canEdit = usePermission("employees", "edit");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    role: "",
    job_title: "",
    salary: 0,
    salary_period: "monthly",
    address: "",
    phones: [],
    working_days_per_month: DEFAULT_MONTHLY_WORK_DAYS,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employee) {
      const phones = employee.phones ? JSON.parse(employee.phones) : (employee.phone ? [employee.phone] : []);
      setForm({
        name: employee.name || "",
        phone: employee.phone || "",
        role: employee.role || "",
        job_title: employee.job_title || "",
        salary: employee.salary || 0,
        salary_period: employee.salary_period || "monthly",
        working_days_per_month: employee.working_days_per_month || DEFAULT_MONTHLY_WORK_DAYS,
        address: employee.address || "",
        phones,
      });
    }
  }, [employee]);

  if (!employee) return null;

  const periodLabel = PERIOD_OPTIONS.find(o => o.value === employee.salary_period)?.label || "شهري";
  const dailySalary = getDailySalary(form);
  const dailySalaryBasis = getDailySalaryBasis(form);

  async function handleSave(e) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        phones: (form.phones || []).filter(p => p.trim() !== ""),
        phone: (form.phones || []).find(p => p.trim() !== "") || form.phone || "",
      };
      const res = await api.put(`/api/employees/${employee.id}`, payload);
      if (res.data?.success) {
        toast.success("تم حفظ البيانات");
        onUpdate?.(res.data.data);
      }
    } catch {
      toast.error("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-8">
      {/* Info Panel */}
      {(() => {
        const dismissed = typeof window !== 'undefined' && localStorage.getItem('emp-tab-info-basic');
        if (dismissed) return null;
        return (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex items-start gap-4 relative">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-blue-800">البيانات الأساسية</p>
              <p className="text-xs font-bold text-blue-600 mt-1 leading-relaxed">
                هنا تُدخل بيانات الموظف الأساسية مثل الاسم والراتب وفترة الدفع. يتم حساب الراتب اليومي تلقائياً بناءً على عدد أيام العمل. غيّر فترة الدفع (شهري/أسبوعي/يومي) حسب عقد الموظف.
              </p>
            </div>
            <button onClick={() => { localStorage.setItem('emp-tab-info-basic', '1'); }}
              className="text-blue-400 hover:text-blue-600 text-xs font-black shrink-0">فهمت</button>
          </motion.div>
        );
      })()}

      {/* عرض البيانات الأساسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1">
          <label className="text-[11px] font-black uppercase tracking-widest text-text-secondary">الموظف</label>
          {canEdit ? (
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full h-11 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-blue-400 transition-all"
            />
          ) : (
            <p className="text-sm font-bold text-text-primary pt-1">{employee.name}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-black uppercase tracking-widest text-text-secondary">العنوان</label>
          {canEdit ? (
            <input
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full h-11 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-blue-400 transition-all"
              placeholder="العنوان (اختياري)"
            />
          ) : (
            <p className="text-sm font-bold text-text-primary pt-1">{employee.address || "-"}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-text-secondary">أرقام الهاتف</label>
          {canEdit ? (
            <>
              {(form.phones || []).map((ph, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    value={ph}
                    onChange={e => {
                      const updated = [...form.phones];
                      updated[idx] = e.target.value;
                      setForm({ ...form, phones: updated });
                    }}
                    className="flex-1 h-11 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-blue-400 transition-all"
                    placeholder={`رقم ${idx + 1}`}
                  />
                  {form.phones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, phones: form.phones.filter((_, i) => i !== idx) })}
                      className="h-11 w-11 flex items-center justify-center rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 transition-all"
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
            </>
          ) : (
            <div className="space-y-1">
              {(() => {
                const displayPhones = employee.phones ? JSON.parse(employee.phones) : (employee.phone ? [employee.phone] : []);
                return displayPhones.length > 0
                  ? displayPhones.map((p, i) => <p key={i} className="text-sm font-bold text-text-primary pt-1">{p}</p>)
                  : <p className="text-sm font-bold text-text-muted pt-1">-</p>;
              })()}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-black uppercase tracking-widest text-text-secondary">المسمى الوظيفي</label>
          {canEdit ? (
            <input
              value={form.job_title || form.role || ""}
              onChange={e => setForm({ ...form, job_title: e.target.value, role: e.target.value })}
              className="w-full h-11 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-blue-400 transition-all"
            />
          ) : (
            <p className="text-sm font-bold text-text-primary pt-1">{employee.job_title || employee.role || "-"}</p>
          )}
        </div>

        {/* الراتب - يظهر فقط لمن لديه صلاحية */}
        {canViewSalary && (
          <>
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-widest text-text-secondary">الراتب الأساسي</label>
              {canEditSalary ? (
                <input
                  type="number"
                  value={form.salary}
                  onChange={e => setForm({ ...form, salary: e.target.value })}
                  className="w-full h-11 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-blue-400 transition-all"
                />
              ) : (
                <p className="text-sm font-bold text-emerald-700 pt-1">{Number(employee.salary || 0).toLocaleString()} ج.م</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-widest text-text-secondary">فترة الدفع</label>
              {canEditSalary ? (
                <select
                  value={form.salary_period}
                  onChange={e => setForm({ ...form, salary_period: e.target.value })}
                  className="w-full h-11 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-blue-400 transition-all"
                >
                  {PERIOD_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm font-bold text-text-primary pt-1">{periodLabel}</p>
              )}
            </div>

            {form.salary_period === "monthly" && (
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-widest text-text-secondary">أيام العمل الشهرية</label>
                {canEditSalary ? (
                  <input
                    type="number" min="1" max="31"
                    value={form.working_days_per_month}
                    onChange={e => setForm({ ...form, working_days_per_month: normalizeMonthlyWorkDays(e.target.value) })}
                    className="w-full h-11 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-blue-400 transition-all"
                  />
                ) : (
                  <p className="text-sm font-bold text-text-primary pt-1">{employee.working_days_per_month || DEFAULT_MONTHLY_WORK_DAYS} يوم</p>
                )}
              </div>
            )}

            {dailySalary > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-widest text-text-secondary">الراتب اليومي</label>
                <p className="text-sm font-bold text-emerald-600 pt-1">
                  {formatMoney(Math.round(dailySalary))} ج.م / يوم
                </p>
                <p className="text-[10px] font-bold text-emerald-600 pt-0.5">{dailySalaryBasis}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* زر الحفظ */}
      {canEdit && (
        <div className="flex justify-end pt-4 border-t border-border-subtle">
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving}
            className="h-11 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black shadow-lg flex items-center gap-2 disabled:opacity-50 transition-all"
          >
            <Save className="h-4 w-4" />
            {saving ? "جاري الحفظ..." : "حفظ البيانات"}
          </motion.button>
        </div>
      )}
    </div>
  );
}
