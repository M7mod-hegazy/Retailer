import React, { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import PermissionGate from "../../components/ui/PermissionGate";
import { Wrench, Plus, Trash2, CheckCircle2, ArrowRight, Search } from "lucide-react";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useConfirm } from "../../hooks/useConfirm";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

const STATUS_FLOW = ["received", "diagnosing", "waiting_parts", "in_repair", "waiting_customer", "ready", "delivered"];
const STATUS_LABELS = {
  received: "استُلم", diagnosing: "تشخيص", waiting_parts: "انتظار قطع",
  in_repair: "قيد الإصلاح", waiting_customer: "انتظار العميل",
  ready: "جاهز للتسليم", delivered: "تم التسليم", cancelled: "ملغى",
};

function StatusBadge({ status }) {
  const colors = {
    received: "bg-bg-overlay text-text-primary", diagnosing: "bg-blue-100 text-blue-700",
    waiting_parts: "bg-amber-100 text-amber-700", in_repair: "bg-indigo-100 text-indigo-700",
    waiting_customer: "bg-purple-100 text-purple-700", ready: "bg-emerald-100 text-emerald-700",
    delivered: "bg-green-100 text-green-700", cancelled: "bg-red-100 text-red-600",
  };
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-[12px] font-black ${colors[status] || "bg-bg-overlay text-text-secondary"}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function RepairOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const { data, isLoading } = useQuery({
    queryKey: ["repair-order", id],
    queryFn: () => api.get(`/api/repair-orders/${id}`).then(r => r.data.data),
  });

  const [partForm, setPartForm] = useState({ part_name: "", quantity: "1", unit_cost: "", item_id: "", warehouse_id: "" });
  const [laborForm, setLaborForm] = useState({ description: "", amount: "" });
  const [itemSearch, setItemSearch] = useState("");
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [deliverLoading, setDeliverLoading] = useState(false);
  const [partDeleting, setPartDeleting] = useState(null);
  const [laborDeleting, setLaborDeleting] = useState(null);

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api.get("/api/warehouses").then(r => r.data?.data || []),
  });
  const { data: searchResults } = useQuery({
    queryKey: ["item-search", itemSearch],
    queryFn: () => itemSearch.length >= 2 ? api.get("/api/items", { params: { search: itemSearch, limit: 10 } }).then(r => r.data?.data || []) : [],
    enabled: itemSearch.length >= 2,
  });

  const partNameRef = useRef(null);
  const partQtyRef = useRef(null);
  const partCostRef = useRef(null);
  const partWarehouseRef = useRef(null);
  const laborDescRef = useRef(null);
  const laborAmountRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  if (isLoading) return (
    <div className="space-y-4 animate-pulse p-6">
      <div className="h-8 bg-border-normal rounded w-1/3"></div>
      <div className="grid grid-cols-2 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-border-normal rounded w-1/2"></div>
            <div className="h-10 bg-border-normal rounded"></div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-5 bg-border-normal rounded w-1/4"></div>
        <div className="h-24 bg-border-normal rounded"></div>
        <div className="h-24 bg-border-normal rounded"></div>
      </div>
      <div className="flex gap-3">
        <div className="h-10 bg-border-normal rounded w-32"></div>
        <div className="h-10 bg-border-normal rounded w-32"></div>
      </div>
    </div>
  );
  if (!data) return <div className="text-center py-16 text-red-500">لم يُعثر على الطلب</div>;

  const order = data;
  const partsTotal = (order.parts || []).reduce((s, p) => s + p.quantity * p.unit_cost, 0);
  const laborTotal = (order.labor || []).reduce((s, l) => s + l.amount, 0);
  const subtotal = partsTotal + laborTotal;

  async function changeStatus(newStatus) {
    setStatusLoading(true);
    try {
      await api.patch(`/api/repair-orders/${id}/status`, { status: newStatus });
      qc.invalidateQueries(["repair-order", id]);
      toast.success("تم تحديث الحالة");
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل تحديث الحالة");
    } finally { setStatusLoading(false); }
  }

  async function addPart(e) {
    e.preventDefault();
    try {
      await api.post(`/api/repair-orders/${id}/parts`, { ...partForm, quantity: Number(partForm.quantity), unit_cost: Number(partForm.unit_cost), item_id: partForm.item_id ? Number(partForm.item_id) : null, warehouse_id: partForm.warehouse_id ? Number(partForm.warehouse_id) : null });
      setPartForm({ part_name: "", quantity: "1", unit_cost: "", item_id: "", warehouse_id: "" });
      setItemSearch("");
      setShowItemPicker(false);
      qc.invalidateQueries(["repair-order", id]);
      toast.success("تمت إضافة القطعة");
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل الإضافة");
    }
  }

  async function deletePart(partId) {
    setPartDeleting(partId);
    try {
      await api.delete(`/api/repair-orders/${id}/parts/${partId}`);
      qc.invalidateQueries(["repair-order", id]);
    } finally { setPartDeleting(null); }
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
    setLaborDeleting(laborId);
    try {
      await api.delete(`/api/repair-orders/${id}/labor/${laborId}`);
      qc.invalidateQueries(["repair-order", id]);
    } finally { setLaborDeleting(null); }
  }

  async function deliver() {
    const ok = await confirm({ title: "تسليم الجهاز", message: "هل تريد تسليم الجهاز وإنشاء الفاتورة؟" });
    if (!ok) return;
    setDeliverLoading(true);
    try {
      const res = await api.post(`/api/repair-orders/${id}/deliver`, { final_cost: subtotal });
      toast.success("تم التسليم وإنشاء الفاتورة");
      qc.invalidateQueries(["repair-order", id]);
      if (res.data.data?.invoice_id) {
        navigate(`/pos/invoices/${res.data.data.invoice_id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل التسليم");
    } finally { setDeliverLoading(false); }
  }

  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

  return (
    <>
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
            {order.customer_name && <span className="text-sm text-text-secondary">العميل: <strong>{order.customer_name}</strong></span>}
            {order.customer_phone && <span className="text-sm text-text-secondary">{order.customer_phone}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <PermissionGate page="repair_orders" action="edit">
            <Link to="edit"><Button size="sm" variant="ghost">تعديل</Button></Link>
          </PermissionGate>
          {nextStatus && order.status !== "delivered" && order.status !== "cancelled" && (
            <PermissionGate page="repair_orders" action="edit">
              <Button size="sm" onClick={() => changeStatus(nextStatus)} disabled={statusLoading} loading={statusLoading}>
                <ArrowRight className="h-4 w-4 me-1" />
                {STATUS_LABELS[nextStatus]}
              </Button>
            </PermissionGate>
          )}
          {order.status === "ready" && !order.invoice_id && (
            <PermissionGate page="repair_orders" action="edit">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={deliver} disabled={deliverLoading} loading={deliverLoading}>
                <CheckCircle2 className="h-4 w-4 me-1" />
                تسليم وفاتورة
              </Button>
            </PermissionGate>
          )}
        </div>
      </div>

      {/* Device info */}
      <div className="rounded-xl border border-border-normal bg-bg-surface p-5 grid gap-3 md:grid-cols-2 text-sm">
        <div><span className="text-text-secondary">الجهاز:</span> <strong>{[order.device_brand, order.device_model, order.device_type].filter(Boolean).join(" — ") || "—"}</strong></div>
        <div><span className="text-text-secondary">السيريال:</span> <strong>{order.serial_number || "—"}</strong></div>
        <div className="md:col-span-2"><span className="text-text-secondary">العطل:</span> <span>{order.reported_issue}</span></div>
        {order.diagnosis && <div className="md:col-span-2"><span className="text-text-secondary">التشخيص:</span> <span>{order.diagnosis}</span></div>}
        {order.notes && <div className="md:col-span-2"><span className="text-text-secondary">ملاحظات:</span> <span>{order.notes}</span></div>}
      </div>

      {/* Parts */}
      <section className="space-y-3">
        <h3 className="text-sm font-black text-text-secondary uppercase tracking-widest">قطع الغيار</h3>
        {(order.parts || []).length > 0 && (
          <div className="rounded-xl border border-border-normal bg-bg-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-overlay border-b text-[11px] font-black uppercase text-text-secondary">
                <tr>
                  <th className="px-4 py-2 text-start">القطعة</th>
                  <th className="px-4 py-2 text-end">الكمية</th>
                  <th className="px-4 py-2 text-end">سعر الوحدة</th>
                  <th className="px-4 py-2 text-end">الإجمالي</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {order.parts.map(p => (
                  <tr key={p.id} className="hover:bg-bg-overlay/60 transition-colors">
                    <td className="px-4 py-2">{p.part_name}</td>
                    <td className="px-4 py-2 text-end">{p.quantity}</td>
                    <td className="px-4 py-2 text-end">{Number(p.unit_cost).toLocaleString()}</td>
                    <td className="px-4 py-2 text-end font-bold">{(p.quantity * p.unit_cost).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => deletePart(p.id)} disabled={partDeleting === p.id} className="text-text-muted hover:text-red-500 transition-colors disabled:opacity-50">
                        {partDeleting === p.id ? <span className="block h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-red-500" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {order.status !== "delivered" && order.status !== "cancelled" && (
          <form onSubmit={addPart} className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <input ref={partNameRef} className="w-full rounded-lg border border-border-normal px-3 py-2 text-sm ps-8" placeholder="اسم القطعة" value={partForm.part_name} onChange={e => { setPartForm(p => ({ ...p, part_name: e.target.value })); setItemSearch(e.target.value); setShowItemPicker(e.target.value.length >= 2); }} required onKeyDown={e => handleKeyDown(e, { nextRef: partQtyRef })} />
                <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                {showItemPicker && searchResults?.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full rounded-lg border border-border-normal bg-bg-surface shadow-elevated max-h-48 overflow-y-auto">
                    {searchResults.map(item => (
                      <button key={item.id} type="button" className="w-full px-3 py-2 text-right text-sm hover:bg-bg-overlay flex justify-between" onClick={() => { setPartForm(p => ({ ...p, part_name: item.name, item_id: String(item.id), unit_cost: item.cost_price || p.unit_cost })); setShowItemPicker(false); }}>
                        <span className="font-bold">{item.name}</span>
                        <span className="text-text-muted">{item.item_code || item.barcode}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input ref={partQtyRef} className="w-20 rounded-lg border border-border-normal px-3 py-2 text-sm" type="number" placeholder="الكمية" min="0.001" step="0.001" value={partForm.quantity} onChange={e => setPartForm(p => ({ ...p, quantity: e.target.value }))} required onKeyDown={e => handleKeyDown(e, { nextRef: partCostRef, prevRef: partNameRef })} />
              <input ref={partCostRef} className="w-28 rounded-lg border border-border-normal px-3 py-2 text-sm" type="number" placeholder="السعر" min="0" step="0.01" value={partForm.unit_cost} onChange={e => setPartForm(p => ({ ...p, unit_cost: e.target.value }))} required onKeyDown={e => handleKeyDown(e, { nextRef: partWarehouseRef, prevRef: partQtyRef })} />
              <select ref={partWarehouseRef} className="rounded-lg border border-border-normal px-3 py-2 text-sm" value={partForm.warehouse_id} onChange={e => setPartForm(p => ({ ...p, warehouse_id: e.target.value }))} onKeyDown={e => handleKeyDown(e, { prevRef: partCostRef, onEnter: () => addPart(e) })}>
                <option value="">المخزن</option>
                {(warehouses || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <Button type="submit" size="sm"><Plus className="h-4 w-4 me-1" />إضافة قطعة</Button>
            </div>
          </form>
        )}
      </section>

      {/* Labor */}
      <section className="space-y-3">
        <h3 className="text-sm font-black text-text-secondary uppercase tracking-widest">تكاليف العمالة</h3>
        {(order.labor || []).length > 0 && (
          <div className="rounded-xl border border-border-normal bg-bg-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-overlay border-b text-[11px] font-black uppercase text-text-secondary">
                <tr>
                  <th className="px-4 py-2 text-start">البيان</th>
                  <th className="px-4 py-2 text-end">المبلغ</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {order.labor.map(l => (
                  <tr key={l.id} className="hover:bg-bg-overlay/60 transition-colors">
                    <td className="px-4 py-2">{l.description}</td>
                    <td className="px-4 py-2 text-end font-bold">{Number(l.amount).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => deleteLabor(l.id)} disabled={laborDeleting === l.id} className="text-text-muted hover:text-red-500 transition-colors disabled:opacity-50">
                        {laborDeleting === l.id ? <span className="block h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-red-500" /> : <Trash2 className="h-4 w-4" />}
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
            <input ref={laborDescRef} className="flex-1 min-w-[200px] rounded-lg border border-border-normal px-3 py-2 text-sm" placeholder="وصف العمالة (أجرة تركيب، فحص...)" value={laborForm.description} onChange={e => setLaborForm(p => ({ ...p, description: e.target.value }))} required onKeyDown={e => handleKeyDown(e, { nextRef: laborAmountRef })} />
            <input ref={laborAmountRef} className="w-32 rounded-lg border border-border-normal px-3 py-2 text-sm" type="number" placeholder="المبلغ" min="0" step="0.01" value={laborForm.amount} onChange={e => setLaborForm(p => ({ ...p, amount: e.target.value }))} required onKeyDown={e => handleKeyDown(e, { prevRef: laborDescRef, onEnter: () => addLabor(e) })} />
            <Button type="submit" size="sm"><Plus className="h-4 w-4 me-1" />إضافة</Button>
          </form>
        )}
      </section>

      {/* Cost summary */}
      <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-text-secondary">قطع الغيار:</span><strong>{partsTotal.toLocaleString()}</strong></div>
        <div className="flex justify-between"><span className="text-text-secondary">عمالة:</span><strong>{laborTotal.toLocaleString()}</strong></div>
        <div className="flex justify-between border-t border-orange-200 pt-2 text-base font-black"><span>الإجمالي:</span><span className="text-orange-700">{subtotal.toLocaleString()}</span></div>
        <div className="flex justify-between text-text-secondary"><span>الإيداع المدفوع:</span><span>−{Number(order.deposit_amount || 0).toLocaleString()}</span></div>
        <div className="flex justify-between font-black text-emerald-700"><span>المتبقي:</span><span>{Math.max(0, subtotal - Number(order.deposit_amount || 0)).toLocaleString()}</span></div>
      </div>
    </div>
    <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={handleConfirm} onCancel={handleCancel} />
    </>
  );
}
