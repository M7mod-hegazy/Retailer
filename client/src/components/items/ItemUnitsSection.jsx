import React, { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import { Plus, Trash2, Star } from "lucide-react";
import toast from "react-hot-toast";
import { useFeatureEnabled } from "../../hooks/useFeature";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";

export default function ItemUnitsSection({ itemId }) {
  const enabled = useFeatureEnabled("feature_multi_unit");
  const [units, setUnits] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ unit_name: "", factor: 1, sale_price: "", wholesale_price: "", barcode: "", is_default_sale: false });
  const nameRef = useRef(null);
  const factorRef = useRef(null);
  const salePriceRef = useRef(null);
  const barcodeRef = useRef(null);
  const defaultSaleRef = useRef(null);
  const saveBtnRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  useEffect(() => {
    if (!enabled || !itemId) return;
    api.get(`/api/items/${itemId}/units`).then(r => setUnits(r.data?.data || [])).catch(() => {});
  }, [enabled, itemId]);

  if (!enabled || !itemId) return null;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/api/items/${itemId}/units`, {
        ...form,
        factor: Number(form.factor),
        sale_price: form.sale_price ? Number(form.sale_price) : null,
        wholesale_price: form.wholesale_price ? Number(form.wholesale_price) : null,
      });
      toast.success("تم إضافة الوحدة");
      setAdding(false);
      setForm({ unit_name: "", factor: 1, sale_price: "", wholesale_price: "", barcode: "", is_default_sale: false });
      const r = await api.get(`/api/items/${itemId}/units`);
      setUnits(r.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "فشل إضافة الوحدة");
    }
  };

  const handleDelete = async (unitId) => {
    if (!window.confirm("حذف هذه الوحدة؟")) return;
    try {
      await api.delete(`/api/items/${itemId}/units/${unitId}`);
      setUnits(prev => prev.filter(u => u.id !== unitId));
      toast.success("تم الحذف");
    } catch {
      toast.error("فشل الحذف");
    }
  };

  return (
    <div className="border-t border-slate-200 pt-5 mt-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">وحدات إضافية</h3>
        <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-600">
          <Plus className="h-3.5 w-3.5" /> إضافة وحدة
        </button>
      </div>

      {units.length === 0 && !adding && (
        <p className="text-[12px] font-bold text-slate-400">لا توجد وحدات إضافية. مثال: كرتونة (12 قطعة)، دستة (6 قطع).</p>
      )}

      {units.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                <th className="pb-2 text-right">الوحدة</th>
                <th className="pb-2 text-center">العامل</th>
                <th className="pb-2 text-right">سعر البيع</th>
                <th className="pb-2 text-right">الباركود</th>
                <th className="pb-2 text-center">افتراضي</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {units.map(u => (
                <tr key={u.id} className="border-b border-slate-50">
                  <td className="py-2 font-bold text-slate-800">{u.unit_name}</td>
                  <td className="py-2 text-center text-slate-600">{u.factor}×</td>
                  <td className="py-2 text-slate-600">{u.sale_price ?? "—"}</td>
                  <td className="py-2 text-slate-500 font-mono text-xs">{u.barcode || "—"}</td>
                  <td className="py-2 text-center">{u.is_default_sale ? <Star className="h-3.5 w-3.5 text-amber-500 mx-auto" /> : null}</td>
                  <td className="py-2">
                    <button type="button" onClick={() => handleDelete(u.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <form onSubmit={handleAdd} className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-lg border border-slate-200 bg-slate-50">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">اسم الوحدة</span>
            <input ref={nameRef} onKeyDown={e => handleKeyDown(e, { nextRef: factorRef })} required value={form.unit_name} onChange={e => set("unit_name", e.target.value)} placeholder="كرتونة" className="mt-1 w-full rounded border border-slate-200 px-2.5 py-1.5 text-sm font-bold outline-none focus:border-slate-800" />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">العامل (قطعة/وحدة)</span>
            <input ref={factorRef} onKeyDown={e => handleKeyDown(e, { nextRef: salePriceRef, prevRef: nameRef })} required type="number" min="1" step="1" value={form.factor} onChange={e => set("factor", e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2.5 py-1.5 text-sm font-bold outline-none focus:border-slate-800" />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">سعر البيع (اختياري)</span>
            <input ref={salePriceRef} onKeyDown={e => handleKeyDown(e, { nextRef: barcodeRef, prevRef: factorRef })} type="number" step="0.01" value={form.sale_price} onChange={e => set("sale_price", e.target.value)} placeholder="سعر الوحدة" className="mt-1 w-full rounded border border-slate-200 px-2.5 py-1.5 text-sm font-bold outline-none focus:border-slate-800" />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">الباركود (اختياري)</span>
            <input ref={barcodeRef} onKeyDown={e => handleKeyDown(e, { nextRef: defaultSaleRef, prevRef: salePriceRef })} value={form.barcode} onChange={e => set("barcode", e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2.5 py-1.5 text-sm font-mono font-bold outline-none focus:border-slate-800" />
          </label>
          <div className="flex items-center gap-2 mt-5">
            <input ref={defaultSaleRef} onKeyDown={e => handleKeyDown(e, { nextRef: saveBtnRef, prevRef: barcodeRef })} type="checkbox" id="is_default_sale" checked={form.is_default_sale} onChange={e => set("is_default_sale", e.target.checked)} />
            <label htmlFor="is_default_sale" className="text-xs font-bold text-slate-600">وحدة البيع الافتراضية</label>
          </div>
          <div className="flex items-end gap-2">
            <button ref={saveBtnRef} onKeyDown={e => handleKeyDown(e, { nextRef: cancelBtnRef, prevRef: defaultSaleRef })} type="submit" className="rounded-lg bg-primary px-4 py-1.5 text-xs font-black text-white hover:bg-primary-600">حفظ</button>
            <button ref={cancelBtnRef} onKeyDown={e => handleKeyDown(e, { prevRef: saveBtnRef })} type="button" onClick={() => setAdding(false)} className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50">إلغاء</button>
          </div>
        </form>
      )}
    </div>
  );
}
