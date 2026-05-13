import React, { useEffect, useState } from "react";
import { Edit, Plus, Tag, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import PageWrapper from "../../components/ui/PageWrapper";
import { Card } from "../../components/ui/Card";
import SectionHero from "../../components/ui/SectionHero";
import { Select } from "../../components/ui/Select";
import DataGrid from "../../components/ui/DataGrid";
import PermissionGate from "../../components/ui/PermissionGate";
export default function PromotionsPage() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [promotionToDelete, setPromotionToDelete] = useState(null);
  const [formData, setFormData] = useState({
    id: null,
    name: "",
    rule_type: "percentage_off_total",
    rule_value: "",
    starts_at: "",
    ends_at: "",
    is_active: true,
  });

  useEffect(() => {
    fetchPromotions();
  }, []);

  async function fetchPromotions() {
    setLoading(true);
    try {
      const res = await api.get("/api/promotions");
      if (res.data?.success) setPromotions(res.data.data);
    } catch {
      toast.error("تعذر تحميل العروض");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      id: null,
      name: "",
      rule_type: "percentage_off_total",
      rule_value: "",
      starts_at: "",
      ends_at: "",
      is_active: true,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      const payload = {
        name: formData.name,
        starts_at: formData.starts_at || null,
        ends_at: formData.ends_at || null,
        is_active: formData.is_active,
        rule_json: {
          type: formData.rule_type,
          value: Number(formData.rule_value),
        },
      };

      if (formData.id) {
        await api.put(`/api/promotions/${formData.id}`, payload);
        toast.success("تم تحديث العرض");
      } else {
        await api.post("/api/promotions", payload);
        toast.success("تمت إضافة العرض");
      }

      setOpenModal(false);
      resetForm();
      fetchPromotions();
    } catch {
      toast.error("حدث خطأ أثناء حفظ العرض");
    }
  }

  async function handleDelete() {
    if (!promotionToDelete) return;
    try {
      await api.delete(`/api/promotions/${promotionToDelete.id}`);
      toast.success("تم حذف العرض");
      setPromotionToDelete(null);
      fetchPromotions();
    } catch {
      toast.error("فشل حذف العرض");
    }
  }

  function openEdit(row) {
    let rule = {};
    try {
      rule = typeof row.rule_json === "string" ? JSON.parse(row.rule_json) : row.rule_json || {};
    } catch {
      rule = {};
    }

    setFormData({
      id: row.id,
      name: row.name,
      rule_type: rule.type || "percentage_off_total",
      rule_value: rule.value || "",
      starts_at: row.starts_at || "",
      ends_at: row.ends_at || "",
      is_active: Boolean(row.is_active),
    });
    setOpenModal(true);
  }

  return (
    <PageWrapper>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <SectionHero
          eyebrow="قواعد الخصم والعروض الزمنية"
          title="العروض الترويجية والخصومات"
          description="إدارة حملات الخصم ضمن نفس اللغة البصرية للنظام، مع وضوح في المدة والحالة والإجراءات اليومية."
          icon={Tag}
          stats={[{ label: "إجمالي العروض", value: promotions.length }]}
          action={
            <PermissionGate page="promotions" action="add">
              <Button
                onClick={() => {
                  resetForm();
                  setOpenModal(true);
                }}
                className="gap-2"
              >
                <Plus className="h-5 w-5" />
                عرض جديد
              </Button>
            </PermissionGate>
          }
        />

        <Card className="rounded-[28px] p-5">
          {loading ? (
            <div className="surface-muted rounded-[24px] px-4 py-10 text-center text-sm text-text-secondary">
              جاري تحميل العروض...
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <DataGrid
                data={promotions}
                rowKey="id"
                emptyMessage="لا يوجد عروض حالياً"
                className="border-0"
                columns={[
                  { id: "name", header: "اسم العرض", width: 250, sortable: true, cellClass: "font-bold text-slate-800" },
                  {
                    id: "starts_at", header: "يبدأ في", width: 150, sortable: true,
                    render: (row) => row.starts_at || "—",
                  },
                  {
                    id: "ends_at", header: "ينتهي في", width: 150, sortable: true,
                    render: (row) => row.ends_at || "—",
                  },
                  {
                    id: "is_active", header: "الحالة", width: 100, sortable: true,
                    render: (row) =>
                      row.is_active ? (
                        <span className="inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-black bg-emerald-50 text-emerald-700 border-emerald-200">نشط</span>
                      ) : (
                        <span className="inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-black bg-rose-50 text-rose-700 border-rose-200">متوقف</span>
                      ),
                  },
                  {
                    id: "actions", header: "إجراءات", width: 120, sortable: false,
                    render: (row) => (
                      <div className="flex items-center gap-2">
                        <PermissionGate page="promotions" action="edit">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                            aria-label="تعديل العرض"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </PermissionGate>
                        <PermissionGate page="promotions" action="delete">
                          <button
                            type="button"
                            onClick={() => setPromotionToDelete(row)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50"
                            aria-label="حذف العرض"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </PermissionGate>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </Card>
      </div>

      <Modal open={openModal} onClose={() => setOpenModal(false)} title={formData.id ? "تعديل عرض" : "إضافة عرض جديد"}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-primary">اسم العرض</label>
            <Input required type="text" value={formData.name} onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-text-primary">نوع الخصم</label>
            <Select
              value={formData.rule_type}
              onChange={(event) => setFormData((prev) => ({ ...prev, rule_type: event.target.value }))}
              options={[{ value: "percentage_off_total", label: "خصم نسبة (%) من إجمالي الفاتورة" }]}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-text-primary">النسبة (%)</label>
            <Input required type="number" min="1" max="100" value={formData.rule_value} onChange={(event) => setFormData((prev) => ({ ...prev, rule_value: event.target.value }))} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-primary">يبدأ في</label>
              <Input type="date" value={formData.starts_at} onChange={(event) => setFormData((prev) => ({ ...prev, starts_at: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-text-primary">ينتهي في</label>
              <Input type="date" value={formData.ends_at} onChange={(event) => setFormData((prev) => ({ ...prev, ends_at: event.target.value }))} />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-border-subtle px-4 py-3 text-sm text-text-primary" style={{ background: "var(--bg-input)" }}>
            <input type="checkbox" checked={formData.is_active} onChange={(event) => setFormData((prev) => ({ ...prev, is_active: event.target.checked }))} className="h-4 w-4 rounded border-border-normal bg-transparent" />
            العرض مفعل حالياً
          </label>

          <div className="flex justify-end gap-3 border-t border-border-subtle pt-4">
            <Button variant="secondary" type="button" onClick={() => setOpenModal(false)}>
              إلغاء
            </Button>
            <Button type="submit">حفظ</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(promotionToDelete)}
        title="حذف العرض"
        message={`سيتم حذف العرض "${promotionToDelete?.name || ""}" نهائياً. هل تريد المتابعة؟`}
        onCancel={() => setPromotionToDelete(null)}
        onConfirm={handleDelete}
      />
    </PageWrapper>
  );
}
