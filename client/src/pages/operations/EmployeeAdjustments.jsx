import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CircleDollarSign } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import DataGrid from "../../components/ui/DataGrid";
import PageWrapper from "../../components/ui/PageWrapper";
import Button from "../../components/ui/Button";
import PermissionGate from "../../components/ui/PermissionGate";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { usePageTour } from "../../hooks/usePageTour";

export default function EmployeeAdjustments() {
  usePageTour('employee_adjustments');
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  
  const [employees, setEmployees] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: "",
    adjustment_type: "incentive",
    amount: "",
    reason: ""
  });
  const employeeRef = useRef(null);
  const typeRef = useRef(null);
  const amountRef = useRef(null);
  const reasonRef = useRef(null);
  const formRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/api/employees");
      if (res.data?.success) {
        setEmployees(res.data.data);
      }
    } catch (err) {
      toast.error(t("الموظفين", "Failed to fetch employees"));
    }
  };

  const fetchAdjustments = async (employeeId) => {
    if (!employeeId) {
      setAdjustments([]);
      return;
    }
    try {
      const res = await api.get(`/api/employees/${employeeId}/adjustments`);
      if (res.data?.success) setAdjustments(res.data.data || []);
    } catch {
      setAdjustments([]);
    }
  };

  const handleEmployeeChange = (e) => {
    const id = e.target.value;
    setFormData(prev => ({ ...prev, employee_id: id }));
    fetchAdjustments(id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employee_id || !formData.amount) {
      toast.error(t("الحقول المطلوبة", "Please fill required fields"));
      return;
    }

    setLoading(true);
    try {
      await api.post(`/api/employees/${formData.employee_id}/adjustments`, formData);
      toast.success(t("تم الإدراج", "Adjustment Added"));
      setFormData(prev => ({ ...prev, amount: "", reason: "" }));
      fetchAdjustments(formData.employee_id);
    } catch (err) {
      toast.error(err.response?.data?.message || t("حدث خطأ", "Error adding adjustment"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper className={`mx-auto max-w-5xl px-4 py-8 ${isRTL ? "text-right" : "text-left"}`} data-help-root="employee_adjustments">
      <div className="flex items-center gap-3 mb-6" data-help="page-header">
        <CircleDollarSign className="w-8 h-8 text-primary-300" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">الحوافز والجزاءات</h1>
          <p className="mt-1 text-sm text-text-secondary">إدارة الحوافز والخصومات مع سجل واضح لكل موظف.</p>
        </div>
      </div>

      <div className="page-surface mb-8" data-help="adjustment-form">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">الموظف <span className="text-danger-DEFAULT">*</span></label>
              <select
                ref={employeeRef}
                value={formData.employee_id}
                onChange={handleEmployeeChange}
                onKeyDown={e => handleKeyDown(e, { nextRef: typeRef })}
                className="input w-full"
                required
              >
                <option value="">{t("اختر...", "Select...")}</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">النوع <span className="text-danger-DEFAULT">*</span></label>
              <select
                ref={typeRef}
                value={formData.adjustment_type}
                onChange={(e) => setFormData(prev => ({ ...prev, adjustment_type: e.target.value }))}
                onKeyDown={e => handleKeyDown(e, { nextRef: amountRef, prevRef: employeeRef })}
                className="input w-full"
              >
                <option value="incentive">حافز (مكافأة)</option>
                <option value="penalty">جزاء (خصم)</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">القيمة <span className="text-danger-DEFAULT">*</span></label>
              <input
                ref={amountRef}
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                onKeyDown={e => handleKeyDown(e, { nextRef: reasonRef, prevRef: typeRef })}
                className="input w-full"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">السبب</label>
              <input
                ref={reasonRef}
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                onKeyDown={e => handleKeyDown(e, { prevRef: amountRef, onEnter: () => formRef.current?.requestSubmit() })}
                className="input w-full"
              />
            </div>

          </div>

          <div className="flex justify-end pt-4 border-t border-border-subtle">
            <PermissionGate page="employee_adjustments" action="add">
              <Button type="submit" disabled={loading}>
                إضافة
              </Button>
            </PermissionGate>
          </div>
        </form>
      </div>

      {formData.employee_id && (
        <div className="page-surface p-0 overflow-hidden" data-help="history-table">
          <div className="p-5 border-b border-border-subtle">
            <h2 className="section-title mb-0">السجل</h2>
          </div>
          <DataGrid
            data={adjustments}
            rowKey="id"
            className="border-0"
            columns={[
              { id: "id", header: "#", width: 80, sortable: true, cellClass: "font-mono font-bold text-text-secondary" },
              { id: "created_at", header: "التاريخ", width: 150, sortable: true, render: r => new Date(r.created_at).toLocaleString("en-US") },
              { id: "adjustment_type", header: "النوع", width: 100, sortable: true, render: r => r.adjustment_type === 'incentive' ? <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-sm text-[11px]">حافز +</span> : <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-sm text-[11px]">جزاء -</span> },
              { id: "amount", header: "القيمة", width: 120, sortable: true, cellClass: "font-mono font-black" },
              { id: "reason", header: "السبب", width: 250, sortable: true }
            ]}
          />
        </div>
      )}
    </PageWrapper>
  );
}
