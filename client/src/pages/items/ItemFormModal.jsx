import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Search, UtensilsCrossed } from "lucide-react";
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
import { useFieldNavigation } from "../../hooks/useFieldNavigation";

function RecipeSection({ itemId }) {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [newIngredient, setNewIngredient] = useState(null);
  const [newQty, setNewQty] = useState("1");
  const [newUnit, setNewUnit] = useState("");

  const fetchRecipes = useCallback(() => {
    setLoading(true);
    api.get(`/api/restaurant/recipes/${itemId}`)
      .then((r) => setRecipes(r.data?.data || []))
      .catch(() => { toast.error("فشل تحميل المكونات"); })
      .finally(() => setLoading(false));
  }, [itemId]);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  useEffect(() => {
    if (ingredientSearch.trim().length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      api.get("/api/items", { params: { limit: 15, search: ingredientSearch.trim(), exclude_parents: 1 } })
        .then((r) => setSearchResults(r.data?.data || []))
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [ingredientSearch]);

  async function addIngredient() {
    if (!newIngredient || !newQty) return;
    try {
      await api.post(`/api/restaurant/recipes/${itemId}`, { ingredient_item_id: newIngredient.id, quantity: Number(newQty), unit_name: newUnit || null });
      toast.success("تم إضافة المكون");
      setNewIngredient(null);
      setNewQty("1");
      setNewUnit("");
      setIngredientSearch("");
      setSearchResults([]);
      fetchRecipes();
    } catch { toast.error("فشل إضافة المكون"); }
  }

  async function removeIngredient(ingredientId) {
    try {
      await api.delete(`/api/restaurant/recipes/${itemId}/${ingredientId}`);
      toast.success("تم حذف المكون");
      fetchRecipes();
    } catch { toast.error("فشل حذف المكون"); }
  }

  return (
    <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex items-center gap-2 text-sm font-black text-emerald-700">
        <UtensilsCrossed className="h-4 w-4" /> المقادير والمكونات
      </div>

      {/* Existing ingredients */}
      {loading ? (
        <p className="text-xs text-slate-400">جاري التحميل...</p>
      ) : recipes.length === 0 ? (
        <p className="text-xs text-slate-500">لا توجد مكونات مضافة بعد — أضف المكونات أدناه.</p>
      ) : (
        <div className="space-y-1.5">
          {recipes.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-emerald-100">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-700">{r.ingredient_name}</span>
                <span className="text-xs font-mono font-bold text-emerald-600">x{r.quantity}</span>
                {r.unit_name && <span className="text-[11px] text-slate-400">{r.unit_name}</span>}
              </div>
              <button type="button" onClick={() => removeIngredient(r.ingredient_item_id)}
                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new ingredient */}
      <div className="space-y-2">
        <div className="relative">
          <input type="text" value={ingredientSearch} onChange={(e) => setIngredientSearch(e.target.value)}
            placeholder="ابحث عن صنف (اسم أو كود)..."
            className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 pr-9 text-sm placeholder:text-slate-300 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
          {searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-40 overflow-y-auto">
              {searchResults.map((item) => (
                <button key={item.id} type="button" onClick={() => { setNewIngredient(item); setIngredientSearch(item.name); setSearchResults([]); }}
                  className="w-full text-right px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-b-0">
                  {item.name}
                  <span className="mr-2 text-[11px] text-slate-400 font-mono">{item.code || item.item_code || ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {newIngredient && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-emerald-700 shrink-0">{newIngredient.name}</span>
            <input type="number" step="0.01" min="0.01" value={newQty} onChange={(e) => setNewQty(e.target.value)}
              placeholder="الكمية" className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-center font-bold" />
            <input type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)}
              placeholder="الوحدة" className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            <Button type="button" size="sm" onClick={addIngredient}><Plus className="h-4 w-4 me-1" />إضافة</Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ItemFormModal({ editItem, onSaved }) {
  const navigate = useNavigate();
  const [createdItem, setCreatedItem] = useState(null);
  const isEdit = Boolean(editItem || createdItem);
  const activeItem = editItem || createdItem;
  const multiUnitEnabled = useFeatureEnabled("feature_multi_unit");
  const variantsEnabled = useFeatureEnabled("feature_variants");
  const scaleEnabled = useFeatureEnabled("feature_scale_barcodes");
  const serialsEnabled = useFeatureEnabled("feature_serials");
  const goldEnabled = useFeatureEnabled("feature_gold");
  const expiryEnabled = useFeatureEnabled("feature_expiry");
  const restaurantEnabled = useFeatureEnabled("feature_restaurant");

  const handleKeyDown = useFieldNavigation();

  const itemCodeRef = useRef(null);
  const nameRef = useRef(null);
  const nameEnRef = useRef(null);
  const barcodeRef = useRef(null);
  const scalePluRef = useRef(null);
  const categoryRef = useRef(null);
  const unitRef = useRef(null);
  const salePriceRef = useRef(null);
  const costPriceRef = useRef(null);
  const wholesalePriceRef = useRef(null);
  const minPriceRef = useRef(null);
  const minStockRef = useRef(null);
  const maxStockRef = useRef(null);
  const descriptionRef = useRef(null);
  const goldKaratRef = useRef(null);
  const goldWeightRef = useRef(null);
  const goldMakingRef = useRef(null);
  const warrantyMonthsRef = useRef(null);
  const prepTimeRef = useRef(null);
  const submitBtnRef = useRef(null);

  const [form, setForm] = useState({
    item_code: "", name: "", name_en: "", barcode: "",
    category_id: "", unit_id: "",
    sale_price: "", cost_price: "", wholesale_price: "", min_price: "",
    min_stock: "", max_stock: "",
    description: "",
    is_service: false, is_active: true,
    tax_exempt: false, track_expiry: false,
    scale_plu: "", track_serials: false, default_warranty_months: "",
    is_gold_item: false, gold_karat: "21", gold_weight_grams: "", gold_making_charge: "",
    is_menu_item: false, prep_time_mins: "",
  });
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [saving, setSaving] = useState(false);

  const showGold = goldEnabled && form.is_gold_item;

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
        default_warranty_months: editItem.default_warranty_months || "",
        is_gold_item: editItem.is_gold_item === 1 || editItem.is_gold_item === true,
        gold_karat: String(editItem.gold_karat || "21"),
        gold_weight_grams: editItem.gold_weight_grams || "",
        gold_making_charge: editItem.gold_making_charge || "",
        is_menu_item: editItem.is_menu_item === 1 || editItem.is_menu_item === true,
        prep_time_mins: editItem.prep_time_mins || "",
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
        default_warranty_months: form.default_warranty_months ? Number(form.default_warranty_months) : null,
        is_menu_item: form.is_menu_item,
        prep_time_mins: form.prep_time_mins ? Number(form.prep_time_mins) : null,
      };
      if (editItem) {
        await api.put(`/api/items/${editItem.id}`, payload);
        toast.success("تم تحديث الصنف");
        onSaved?.();
      } else if (createdItem) {
        await api.put(`/api/items/${createdItem.id}`, payload);
        toast.success("تم تحديث الصنف");
      } else {
        const res = await api.post("/api/items", payload);
        const newId = res.data?.data?.id || res.data?.data?.item?.id;
        if (newId && restaurantEnabled && form.is_menu_item) {
          const detailRes = await api.get(`/api/items/${newId}`);
          const newItem = detailRes.data?.data || detailRes.data;
          setCreatedItem(newItem);
          toast.success("تم إضافة الصنف — يمكنك الآن إضافة المكونات");
        } else {
          toast.success("تم إضافة الصنف");
          onSaved?.();
        }
      }
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
        <Input ref={itemCodeRef} label="كود الصنف" value={form.item_code} onChange={e => set("item_code", e.target.value)} required onKeyDown={e => handleKeyDown(e, { nextRef: nameRef })} />
        <Input ref={nameRef} label="اسم الصنف (عربي)" value={form.name} onChange={e => set("name", e.target.value)} required onKeyDown={e => handleKeyDown(e, { nextRef: nameEnRef, prevRef: itemCodeRef })} />
        <Input ref={nameEnRef} label="اسم الصنف (إنجليزي)" value={form.name_en} onChange={e => set("name_en", e.target.value)} onKeyDown={e => handleKeyDown(e, { nextRef: barcodeRef, prevRef: nameRef })} />
        <Input ref={barcodeRef} label="الباركود" value={form.barcode} onChange={e => set("barcode", e.target.value)} onKeyDown={e => handleKeyDown(e, { nextRef: scaleEnabled ? scalePluRef : categoryRef, prevRef: nameEnRef })} />
        {scaleEnabled && (
          <Input ref={scalePluRef} label="كود الميزان (PLU)" value={form.scale_plu} onChange={e => set("scale_plu", e.target.value)} placeholder="رقم PLU المبرمج في الميزان" onKeyDown={e => handleKeyDown(e, { nextRef: categoryRef, prevRef: barcodeRef })} />
        )}
        <Select ref={categoryRef} label="الفئة" value={form.category_id} onChange={e => set("category_id", e.target.value)} onKeyDown={e => handleKeyDown(e, { nextRef: unitRef, prevRef: scaleEnabled ? scalePluRef : barcodeRef })}>
          <option value="">-- اختر --</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.sku_prefix ? `${c.sku_prefix} — ` : ""}{c.name}</option>)}
        </Select>
        <Select ref={unitRef} label="الوحدة" value={form.unit_id} onChange={e => set("unit_id", e.target.value)} onKeyDown={e => handleKeyDown(e, { nextRef: salePriceRef, prevRef: categoryRef })}>
          <option value="">-- اختر --</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Input ref={salePriceRef} label="سعر البيع" type="number" step="0.01" value={form.sale_price} onChange={e => set("sale_price", e.target.value)} required onKeyDown={e => handleKeyDown(e, { nextRef: costPriceRef, prevRef: unitRef })} />
        <Input ref={costPriceRef} label="سعر التكلفة" type="number" step="0.01" value={form.cost_price} onChange={e => set("cost_price", e.target.value)} onKeyDown={e => handleKeyDown(e, { nextRef: wholesalePriceRef, prevRef: salePriceRef })} />
        <Input ref={wholesalePriceRef} label="سعر الجملة" type="number" step="0.01" value={form.wholesale_price} onChange={e => set("wholesale_price", e.target.value)} onKeyDown={e => handleKeyDown(e, { nextRef: minPriceRef, prevRef: costPriceRef })} />
        <Input ref={minPriceRef} label="أقل سعر بيع" type="number" step="0.01" value={form.min_price} onChange={e => set("min_price", e.target.value)} onKeyDown={e => handleKeyDown(e, { nextRef: minStockRef, prevRef: wholesalePriceRef })} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Input ref={minStockRef} label="حد أدنى للمخزون" type="number" value={form.min_stock} onChange={e => set("min_stock", e.target.value)} onKeyDown={e => handleKeyDown(e, { nextRef: maxStockRef, prevRef: minPriceRef })} />
        <Input ref={maxStockRef} label="حد أقصى للمخزون" type="number" value={form.max_stock} onChange={e => set("max_stock", e.target.value)} onKeyDown={e => handleKeyDown(e, { nextRef: descriptionRef, prevRef: minStockRef })} />
      </div>

      <Textarea ref={descriptionRef} label="وصف الصنف" value={form.description} onChange={e => set("description", e.target.value)} rows={2} onKeyDown={e => handleKeyDown(e, { nextRef: showGold ? goldKaratRef : null, onEnter: showGold ? undefined : () => submitBtnRef.current?.click(), prevRef: maxStockRef })} />

      <div className="flex flex-wrap gap-6">
        <Checkbox label="خدمة (غير مخزنية)" checked={form.is_service} onChange={v => set("is_service", v)} />
        <Checkbox label="نشط" checked={form.is_active} onChange={v => set("is_active", v)} />
        <Checkbox label="معفى من الضريبة" checked={form.tax_exempt} onChange={v => set("tax_exempt", v)} />
        {expiryEnabled && (
          <Checkbox label="تتبع تواريخ الانتهاء (FEFO)" checked={form.track_expiry} onChange={v => set("track_expiry", v)} />
        )}
        {serialsEnabled && (
          <Checkbox label="تتبع السيريال / IMEI" checked={form.track_serials} onChange={v => set("track_serials", v)} />
        )}
        {goldEnabled && (
          <Checkbox label="صنف ذهب (تسعير بالوزن)" checked={form.is_gold_item} onChange={v => set("is_gold_item", v)} />
        )}
        {restaurantEnabled && (
          <Checkbox label="صنف مطعم (مكونات وإضافات)" checked={form.is_menu_item} onChange={v => set("is_menu_item", v)} />
        )}
      </div>

      {serialsEnabled && form.track_serials && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
          <Input ref={warrantyMonthsRef} label="شهر الضمان الافتراضي" type="number" min="0" value={form.default_warranty_months} onChange={e => set("default_warranty_months", e.target.value)} placeholder="مثال: 12" onKeyDown={e => handleKeyDown(e, { nextRef: showGold ? goldKaratRef : null, onEnter: showGold ? undefined : () => submitBtnRef.current?.click(), prevRef: descriptionRef })} />
        </div>
      )}

      {showGold && (
        <div className="grid gap-4 md:grid-cols-3 rounded-xl border border-yellow-200 bg-yellow-50/60 p-4">
          <Select ref={goldKaratRef} label="العيار" value={form.gold_karat} onChange={e => set("gold_karat", e.target.value)} onKeyDown={e => handleKeyDown(e, { nextRef: goldWeightRef, prevRef: descriptionRef })}>
            <option value="18">عيار 18</option>
            <option value="21">عيار 21</option>
            <option value="22">عيار 22</option>
            <option value="24">عيار 24</option>
          </Select>
          <Input ref={goldWeightRef} label="الوزن (جرام)" type="number" step="0.01" min="0" value={form.gold_weight_grams} onChange={e => set("gold_weight_grams", e.target.value)} placeholder="0.00" onKeyDown={e => handleKeyDown(e, { nextRef: goldMakingRef, prevRef: goldKaratRef })} />
          <Input ref={goldMakingRef} label="المصنعية" type="number" step="0.01" min="0" value={form.gold_making_charge} onChange={e => set("gold_making_charge", e.target.value)} placeholder="0.00" onKeyDown={e => handleKeyDown(e, { onEnter: () => submitBtnRef.current?.click(), prevRef: goldWeightRef })} />
        </div>
      )}

      {restaurantEnabled && form.is_menu_item && (
        <div className="grid gap-4 md:grid-cols-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <Input ref={prepTimeRef} label="وقت التحضير (دقائق)" type="number" min="0" value={form.prep_time_mins} onChange={e => set("prep_time_mins", e.target.value)} placeholder="مثال: 15" onKeyDown={e => handleKeyDown(e, { onEnter: () => submitBtnRef.current?.click(), prevRef: showGold ? goldMakingRef : serialsEnabled && form.track_serials ? warrantyMonthsRef : descriptionRef })} />
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button ref={submitBtnRef} type="submit" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
      </div>

      {isEdit && multiUnitEnabled && <ItemUnitsSection itemId={activeItem.id} />}
      {isEdit && variantsEnabled && <VariantsSection item={activeItem} onRefresh={onSaved} />}
      {isEdit && restaurantEnabled && form.is_menu_item && <RecipeSection itemId={activeItem.id} />}
    </form>
  );
}
