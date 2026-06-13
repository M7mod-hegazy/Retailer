import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../services/api";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Textarea from "../../components/ui/Textarea";
import Checkbox from "../../components/ui/Checkbox";
import Button from "../../components/ui/Button";
import ItemUnitsSection from "../../components/items/ItemUnitsSection";
import VariantsSection from "../../components/items/VariantsSection";
import { useFeatureEnabled } from "../../hooks/useFeature";

export default function ItemFormModal({ editItem, onSaved }) {
  const navigate = useNavigate();
  const isEdit = Boolean(editItem);
  const multiUnitEnabled = useFeatureEnabled("feature_multi_unit");
  const variantsEnabled = useFeatureEnabled("feature_variants");
  const scaleEnabled = useFeatureEnabled("feature_scale_barcodes");
  const serialsEnabled = useFeatureEnabled("feature_serials");
  const goldEnabled = useFeatureEnabled("feature_gold");

  const [form, setForm] = useState({
    item_code: "", name: "", name_en: "", barcode: "",
    category_id: "", unit_id: "",
    sale_price: "", cost_price: "", wholesale_price: "", min_price: "",
    min_stock: "", max_stock: "",
    description: "",
    is_service: false, is_active: true,
    tax_exempt: false, track_expiry: false,
    scale_plu: "", track_serials: false,
    is_gold_item: false, gold_karat: "21", gold_weight_grams: "", gold_making_charge: "",
  });
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/api/categories").then(r => setCategories(r.data?.data || [])).catch(() => {});
    api.get("/api/units").then(r => setUnits(r.data?.data || [])).catch(() => {});
    if (editItem) {
      setForm({
        item_code: editItem.item_code || editItem.code || "",
        name: editItem.name || "",
        name_en: editItem.name_en || "",
        barcode: editItem.barcode || "",
        category_id: editItem.category_id || "",
        unit_id: editItem.unit_id || "",
        sale_price: editItem.sale_price || "",
        cost_price: editItem.cost_price || editItem.purchase_price || "",
        wholesale_price: editItem.wholesale_price || "",
        min_price: editItem.min_price || "",
        min_stock: editItem.min_stock || "",
        max_stock: editItem.max_stock || "",
        description: editItem.description || "",
        is_service: editItem.is_service || false,
        is_active: editItem.is_active !== false,
        tax_exempt: editItem.tax_exempt || false,
        track_expiry: editItem.track_expiry === 1 || editItem.track_expiry === true,
        scale_plu: editItem.scale_plu || "",
        track_serials: editItem.track_serials === 1 || editItem.track_serials === true,
        is_gold_item: editItem.is_gold_item === 1 || editItem.is_gold_item === true,
        gold_karat: String(editItem.gold_karat || "21"),
        gold_weight_grams: editItem.gold_weight_grams || "",
        gold_making_charge: editItem.gold_making_charge || "",
      });
    }
  }, [editItem]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        sale_price: Number(form.sale_price || 0),
        cost_price: Number(form.cost_price || 0),
        wholesale_price: Number(form.wholesale_price || 0),
        min_price: Number(form.min_price || 0),
        min_stock: Number(form.min_stock || 0),
        max_stock: Number(form.max_stock || 0),
        category_id: form.category_id ? Number(form.category_id) : null,
        unit_id: form.unit_id ? Number(form.unit_id) : null,
        gold_karat: form.gold_karat ? Number(form.gold_karat) : null,
        gold_weight_grams: form.gold_weight_grams ? Number(form.gold_weight_grams) : null,
        gold_making_charge: form.gold_making_charge ? Number(form.gold_making_charge) : null,
      };
      if (isEdit) {
        await api.put(`/api/items/${editItem.id}`, payload);
        toast.success("تم تحديث الصنف");
      } else {
        await api.post("/api/items", payload);
        toast.success("تم إضافة الصنف");
      }
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل حفظ الصنف");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h2 className="text-xl font-bold">{isEdit ? "تعديل صنف" : "إضافة صنف جديد"}</h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Input label="كود الصنف" value={form.item_code} onChange={e => set("item_code", e.target.value)} required />
        <Input label="اسم الصنف (عربي)" value={form.name} onChange={e => set("name", e.target.value)} required />
        <Input label="اسم الصنف (إنجليزي)" value={form.name_en} onChange={e => set("name_en", e.target.value)} />
        <Input label="الباركود" value={form.barcode} onChange={e => set("barcode", e.target.value)} />
        {scaleEnabled && (
          <Input label="كود الميزان (PLU)" value={form.scale_plu} onChange={e => set("scale_plu", e.target.value)} placeholder="رقم PLU المبرمج في الميزان" />
        )}
        <Select label="الفئة" value={form.category_id} onChange={e => set("category_id", e.target.value)}>
          <option value="">-- اختر --</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.sku_prefix ? `${c.sku_prefix} — ` : ""}{c.name}</option>)}
        </Select>
        <Select label="الوحدة" value={form.unit_id} onChange={e => set("unit_id", e.target.value)}>
          <option value="">-- اختر --</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Input label="سعر البيع" type="number" step="0.01" value={form.sale_price} onChange={e => set("sale_price", e.target.value)} required />
        <Input label="سعر التكلفة" type="number" step="0.01" value={form.cost_price} onChange={e => set("cost_price", e.target.value)} />
        <Input label="سعر الجملة" type="number" step="0.01" value={form.wholesale_price} onChange={e => set("wholesale_price", e.target.value)} />
        <Input label="أقل سعر بيع" type="number" step="0.01" value={form.min_price} onChange={e => set("min_price", e.target.value)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Input label="حد أدنى للمخزون" type="number" value={form.min_stock} onChange={e => set("min_stock", e.target.value)} />
        <Input label="حد أقصى للمخزون" type="number" value={form.max_stock} onChange={e => set("max_stock", e.target.value)} />
      </div>

      <Textarea label="وصف الصنف" value={form.description} onChange={e => set("description", e.target.value)} rows={2} />

      <div className="flex flex-wrap gap-6">
        <Checkbox label="خدمة (غير مخزنية)" checked={form.is_service} onChange={v => set("is_service", v)} />
        <Checkbox label="نشط" checked={form.is_active} onChange={v => set("is_active", v)} />
        <Checkbox label="معفى من الضريبة" checked={form.tax_exempt} onChange={v => set("tax_exempt", v)} />
        <Checkbox label="تتبع تواريخ الانتهاء (FEFO)" checked={form.track_expiry} onChange={v => set("track_expiry", v)} />
        {serialsEnabled && (
          <Checkbox label="تتبع السيريال / IMEI" checked={form.track_serials} onChange={v => set("track_serials", v)} />
        )}
        {goldEnabled && (
          <Checkbox label="صنف ذهب (تسعير بالوزن)" checked={form.is_gold_item} onChange={v => set("is_gold_item", v)} />
        )}
      </div>

      {goldEnabled && form.is_gold_item && (
        <div className="grid gap-4 md:grid-cols-3 rounded-xl border border-yellow-200 bg-yellow-50/60 p-4">
          <Select label="العيار" value={form.gold_karat} onChange={e => set("gold_karat", e.target.value)}>
            <option value="18">عيار 18</option>
            <option value="21">عيار 21</option>
            <option value="22">عيار 22</option>
            <option value="24">عيار 24</option>
          </Select>
          <Input label="الوزن (جرام)" type="number" step="0.01" min="0" value={form.gold_weight_grams} onChange={e => set("gold_weight_grams", e.target.value)} placeholder="0.00" />
          <Input label="المصنعية" type="number" step="0.01" min="0" value={form.gold_making_charge} onChange={e => set("gold_making_charge", e.target.value)} placeholder="0.00" />
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
      </div>

      {isEdit && multiUnitEnabled && <ItemUnitsSection itemId={editItem.id} />}
      {isEdit && variantsEnabled && <VariantsSection item={editItem} onRefresh={onSaved} />}
    </form>
  );
}
