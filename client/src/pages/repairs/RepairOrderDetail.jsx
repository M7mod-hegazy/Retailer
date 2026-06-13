import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { Wrench, Plus, Trash2, CheckCircle2, ArrowRight } from "lucide-react";

const STATUS_FLOW = ["received", "diagnosing", "waiting_parts", "in_repair", "waiting_customer", "ready", "delivered"];
const STATUS_LABELS = {
  received: "استُلم", diagnosing: "تشخيص", waiting_parts: "انتظار قطع",
  in_repair: "قيد الإصلاح", waiting_customer: "انتظار العميل",
  ready: "جاهز للتسليم", delivered: "تم التسليم", cancelled: "ملغى",
};

function StatusBadge({ status }) {
  const colors = {
    received: "bg-slate-100 text-slate-700", diagnosing: "bg-blue-100 text-blue-700",
    waiting_parts: "bg-amber-100 text-amber-700", in_repair: "bg-indigo-100 text-indigo-700",
    waiting_customer: "bg-purple-100 text-purple-700", ready: "bg-emerald-100 text-emerald-700",
    delivered: "bg-green-100 text-green-700", cancelled: "bg-red-100 text-red-600",
  };
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-[12px] font-black ${colors[status] || "bg-slate-100 text-slate-600"}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function RepairOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["repair-order", id],
    queryFn: () => api.get(`/api/repair-orders/${id}`).then(r => r.data.data),
  });

  const [partForm, setPartForm] = useState({ part_name: "", quantity: "1", unit_cost: "" });
  const [laborForm, setLaborForm] = useState({ description: "", amount: "" });

  if (isLoading) return <div className="text-center py-16 text-slate-400">جاري التحميل...</div>;
  if (!data) return <div className="text-center py-16 text-red-500">لم يُعثر على الطلب</div>;

  const order = data;
  const partsTotal = (order.parts || []).reduce((s, p) => s + p.quantity * p.unit_cost, 0);
  const laborTotal = (order.labor || []).reduce((s, l) => s + l.amount, 0);
  const subtotal = partsTotal + laborTotal;

  async function changeStatus(newStatus) {
    try {
      await api.patch(`/api/repair-orders/${id}/status`, { status: newStatus });
      qc.invalidateQueries(["repair-order", id]);
      toast.success("تم تحديث الحالة");
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل تحديث الحالة");
    }
  }

  async function addPart(e) {
    e.preventDefault();
    try {
      await api.post(`/api/repair-orders/${id}/parts`, { ...partForm, quantity: Number(partForm.quantity), unit_cost: Number(partForm.unit_cost) });
      setPartForm({ part_name: "", quantity: "1", unit_cost: "" });
      qc.invalidateQueries(["repair-order", id]);
      toast.success("تمت إضافة القطعة");
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل الإضافة");
    }
  }

  async function deletePart(partId) {
    await api.delete(`/api/repair-orders/${id}/parts/${partId}`);
    qc.invalidateQueries(["repair-order", id]);
  }

  async function addLabor(e) {
    e.preventDefault();
    try {
      await api.post(`/api/repair-orders/${id}/labor`, { ...laborForm, amount: Number(laborForm.amount) });
      setLaborForm({ description: "", amount: "" });
      qc.invalidateQueries(["repair-order", id]);
      toast.success("تمت إضافة العمالة");
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل الإضافة");
    }
  }

  async function deleteLabor(laborId) {
    await api.delete(`/api/repair-orders/${id}/labor/${laborId}`);
    qc.invalidateQueries(["repair-order", id]);
  }

  async function deliver() {
    if (!window.confirm("هل تريد تسليم الجهاز وإنشاء الفاتورة؟")) return;
    try {
      const res = await api.post(`/api/repair-orders/${id}/deliver`, { final_cost: subtotal });
      toast.success("تم التسليم وإنشاء الفاتورة");
      qc.invalidateQueries(["repair-order", id]);
      if (res.data.data?.invoice_id) {
        navigate(`/pos/invoices/${res.data.data.invoice_id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل التسليم");
    }
  }

  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-500" />
            {order.order_number}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusBadge status={order.status} />
            {order.customer_name && <span className="text-sm text-slate-600">العميل: <strong>{order.customer_name}</strong></span>}
            {order.customer_phone && <span className="text-sm text-slate-500">{order.customer_phone}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="edit"><Button size="sm" variant="ghost">تعديل</Button></Link>
          {nextStatus && order.status !== "delivered" && order.status !== "cancelled" && (
            <Button size="sm" onClick={() => changeStatus(nextStatus)}>
              <ArrowRight className="h-4 w-4 me-1" />
              {STATUS_LABELS[nextStatus]}
            </Button>
          )}
          {order.status === "ready" && !order.invoice_id && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={deliver}>
              <CheckCircle2 className="h-4 w-4 me-1" />
              تسليم وفاتورة
            </Button>
          )}
        </div>
      </div>

      {/* Device info */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 grid gap-3 md:grid-cols-2 text-sm">
        <div><span className="text-slate-500">الجهاز:</span> <strong>{[order.device_brand, order.device_model, order.device_type].filter(Boolean).join(" — ") || "—"}</strong></div>
        <div><span className="text-slate-500">السيريال:</span> <strong>{order.serial_number || "—"}</strong></div>
        <div className="md:col-span-2"><span className="text-slate-500">العطل:</span> <span>{order.reported_issue}</span></div>
        {order.diagnosis && <div className="md:col-span-2"><span className="text-slate-500">التشخيص:</span> <span>{order.diagnosis}</span></div>}
        {order.notes && <div className="md:col-span-2"><span className="text-slate-500">ملاحظات:</span> <span>{order.notes}</span></div>}
      </div>

      {/* Parts */}
      <section className="space-y-3">
        <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest">قطع الغيار</h3>
        {(order.parts || []).length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b text-[11px] font-black uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-start">القطعة</th>
                  <th className="px-4 py-2 text-end">الكمية</th>
                  <th className="px-4 py-2 text-end">سعر الوحدة</th>
                  <th className="px-4 py-2 text-end">الإجمالي</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {order.parts.map(p => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">{p.part_name}</td>
                    <td className="px-4 py-2 text-end">{p.quantity}</td>
                    <td className="px-4 py-2 text-end">{Number(p.unit_cost).toLocaleString()}</td>
                    <td className="px-4 py-2 text-end font-bold">{(p.quantity * p.unit_cost).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => deletePart(p.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {order.status !== "delivered" && order.status !== "cancelled" && (
          <form onSubmit={addPart} className="flex gap-2 flex-wrap">
            <input className="flex-1 min-w-[160px] rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="اسم القطعة" value={partForm.part_name} onChange={e => setPartForm(p => ({ ...p, part_name: e.target.value }))} required />
            <input className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm" type="number" placeholder="الكمية" min="0.001" step="0.001" value={partForm.quantity} onChange={e => setPartForm(p => ({ ...p, quantity: e.target.value }))} required />
            <input className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm" type="number" placeholder="السعر" min="0" step="0.01" value={partForm.unit_cost} onChange={e => setPartForm(p => ({ ...p, unit_cost: e.target.value }))} required />
            <Button type="submit" size="sm"><Plus className="h-4 w-4 me-1" />إضافة قطعة</Button>
          </form>
        )}
      </section>

      {/* Labor */}
      <section className="space-y-3">
        <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest">تكاليف العمالة</h3>
        {(order.labor || []).length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b text-[11px] font-black uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-start">البيان</th>
                  <th className="px-4 py-2 text-end">المبلغ</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {order.labor.map(l => (
                  <tr key={l.id}>
                    <td className="px-4 py-2">{l.description}</td>
                    <td className="px-4 py-2 text-end font-bold">{Number(l.amount).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => deleteLabor(l.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {order.status !== "delivered" && order.status !== "cancelled" && (
          <form onSubmit={addLabor} className="flex gap-2 flex-wrap">
            <input className="flex-1 min-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="وصف العمالة (أجرة تركيب، فحص...)" value={laborForm.description} onChange={e => setLaborForm(p => ({ ...p, description: e.target.value }))} required />
            <input className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm" type="number" placeholder="المبلغ" min="0" step="0.01" value={laborForm.amount} onChange={e => setLaborForm(p => ({ ...p, amount: e.target.value }))} required />
            <Button type="submit" size="sm"><Plus className="h-4 w-4 me-1" />إضافة</Button>
          </form>
        )}
      </section>

      {/* Cost summary */}
      <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-slate-600">قطع الغيار:</span><strong>{partsTotal.toLocaleString()}</strong></div>
        <div className="flex justify-between"><span className="text-slate-600">عمالة:</span><strong>{laborTotal.toLocaleString()}</strong></div>
        <div className="flex justify-between border-t border-orange-200 pt-2 text-base font-black"><span>الإجمالي:</span><span className="text-orange-700">{subtotal.toLocaleString()}</span></div>
        <div className="flex justify-between text-slate-500"><span>الإيداع المدفوع:</span><span>−{Number(order.deposit_amount || 0).toLocaleString()}</span></div>
        <div className="flex justify-between font-black text-emerald-700"><span>المتبقي:</span><span>{Math.max(0, subtotal - Number(order.deposit_amount || 0)).toLocaleString()}</span></div>
      </div>
    </div>
  );
}
