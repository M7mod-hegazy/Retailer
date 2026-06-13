import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import Select from "../../components/ui/Select";

const PRIORITIES = ["low", "normal", "high", "urgent"];
const PRIORITY_LABELS = { low: "منخفضة", normal: "عادية", high: "عالية", urgent: "عاجلة" };

export default function RepairOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    customer_id: "", device_type: "", device_brand: "", device_model: "",
    serial_number: "", reported_issue: "", priority: "normal",
    estimated_cost: "", deposit_amount: "", notes: "",
    estimated_delivery: "", warranty_days: "0",
  });
  const [saving, setSaving] = useState(false);

  const { data: customers } = useQuery({ queryKey: ["customers-list"], queryFn: () => api.get("/api/customers?limit=500").then(r => r.data?.data || []) });

  useEffect(() => {
    if (isEdit) {
      api.get(`/api/repair-orders/${id}`).then(r => {
        const o = r.data.data;
        setForm({
          customer_id: o.customer_id || "",
          device_type: o.device_type || "",
          device_brand: o.device_brand || "",
          device_model: o.device_model || "",
          serial_number: o.serial_number || "",
          reported_issue: o.reported_issue || "",
          priority: o.priority || "normal",
          estimated_cost: o.estimated_cost || "",
          deposit_amount: o.deposit_amount || "",
          notes: o.notes || "",
          estimated_delivery: o.estimated_delivery ? o.estimated_delivery.slice(0, 10) : "",
          warranty_days: o.warranty_days || "0",
        });
      }).catch(() => toast.error("تعذر تحميل بيانات الطلب"));
    }
  }, [id, isEdit]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.reported_issue.trim()) { toast.error("يرجى وصف العطل"); return; }
    setSaving(true);
    try {
      const payload = { ...form, customer_id: form.customer_id || null, estimated_cost: Number(form.estimated_cost || 0), deposit_amount: Number(form.deposit_amount || 0), warranty_days: Number(form.warranty_days || 0) };
      if (isEdit) {
        await api.put(`/api/repair-orders/${id}`, payload);
        toast.success("تم تحديث الطلب");
      } else {
        const res = await api.post("/api/repair-orders", payload);
        toast.success("تم إنشاء طلب الصيانة");
        navigate(`../${res.data.data.id}`, { relative: "path" });
        return;
      }
      navigate(-1);
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <h2 className="text-xl font-black">{isEdit ? "تعديل طلب صيانة" : "طلب صيانة جديد"}</h2>

      <section className="space-y-4">
        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">بيانات العميل والجهاز</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="العميل" value={form.customer_id} onChange={e => set("customer_id", e.target.value)}>
            <option value="">بدون عميل</option>
            {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="نوع الجهاز" value={form.device_type} onChange={e => set("device_type", e.target.value)} placeholder="موبايل، لابتوب، ثلاجة..." />
          <Input label="الماركة" value={form.device_brand} onChange={e => set("device_brand", e.target.value)} placeholder="Samsung، LG..." />
          <Input label="الموديل" value={form.device_model} onChange={e => set("device_model", e.target.value)} placeholder="Galaxy A55..." />
          <Input label="رقم السيريال / IMEI" value={form.serial_number} onChange={e => set("serial_number", e.target.value)} />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">تفاصيل العطل</h3>
        <Textarea label="وصف العطل *" value={form.reported_issue} onChange={e => set("reported_issue", e.target.value)} rows={3} required />
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="الأولوية" value={form.priority} onChange={e => set("priority", e.target.value)}>
            {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </Select>
          <Input label="التسليم المتوقع" type="date" value={form.estimated_delivery} onChange={e => set("estimated_delivery", e.target.value)} />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">التكلفة والدفعة الأولى</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="التكلفة التقديرية" type="number" step="0.01" value={form.estimated_cost} onChange={e => set("estimated_cost", e.target.value)} />
          <Input label="الدفعة الأولى (إيداع)" type="number" step="0.01" value={form.deposit_amount} onChange={e => set("deposit_amount", e.target.value)} />
          <Input label="أيام الضمان" type="number" min="0" value={form.warranty_days} onChange={e => set("warranty_days", e.target.value)} />
        </div>
      </section>

      <Textarea label="ملاحظات" value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>إلغاء</Button>
      </div>
    </form>
  );
}
