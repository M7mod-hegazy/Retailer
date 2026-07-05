import React, { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { UtensilsCrossed, Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronLeft, GripVertical } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import FeatureRoute from "../../components/ui/FeatureRoute";
import Modal from "../../components/ui/Modal";

function GroupModal({ group, onClose, onSaved }) {
  const [name, setName] = useState(group?.name || "");
  const [selectionType, setSelectionType] = useState(group?.selection_type || "single");
  const [required, setRequired] = useState(group?.required ? true : false);
  const [sortOrder, setSortOrder] = useState(String(group?.sort_order || "0"));
  const [selectedModifierIds, setSelectedModifierIds] = useState(group?.modifiers?.map((m) => m.id) || []);
  const saving = useState(false);

  const { data: modifiersData } = useQuery({
    queryKey: ["modifiers"],
    queryFn: () => api.get("/api/restaurant/modifiers").then((r) => r.data?.data || []),
  });
  const allModifiers = modifiersData || [];

  const toggleModifier = (mid) => {
    setSelectedModifierIds((prev) =>
      prev.includes(mid) ? prev.filter((id) => id !== mid) : [...prev, mid],
    );
  };

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) { toast.error("اسم المجموعة مطلوب"); return; }
    const payload = { name: name.trim(), selection_type: selectionType, required: required ? 1 : 0, sort_order: Number(sortOrder || 0), modifier_ids: selectedModifierIds };
    try {
      if (group?.id) {
        await api.put(`/api/restaurant/modifier-groups/${group.id}`, payload);
        toast.success("تم تحديث المجموعة");
      } else {
        await api.post("/api/restaurant/modifier-groups", payload);
        toast.success("تم إنشاء المجموعة");
      }
      onSaved?.();
    } catch { toast.error("فشل الحفظ"); }
  }

  return (
    <Modal open title={null} onClose={onClose} maxWidth="max-w-lg">
      <div dir="rtl" className="space-y-4 p-4">
        <h2 className="text-lg font-black">{group ? "تعديل مجموعة إضافات" : "مجموعة إضافات جديدة"}</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500">اسم المجموعة</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required value={name} onChange={(e) => setName(e.target.value)} placeholder="مثل: حجم المشروب" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500">نوع الاختيار</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={selectionType} onChange={(e) => setSelectionType(e.target.value)}>
                <option value="single">اختيار واحد</option>
                <option value="multi">اختيار متعدد</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500">الترتيب</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="rounded border-slate-300" />
            إجباري (مطلوب اختيار واحد على الأقل)
          </label>
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500">الإضافات في هذه المجموعة</label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-1">
              {allModifiers.length === 0 && <p className="text-xs text-slate-400">لا توجد إضافات — أضف إضافات أولاً</p>}
              {allModifiers.map((m) => (
                <label key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedModifierIds.includes(m.id)} onChange={() => toggleModifier(m.id)} className="rounded border-slate-300" />
                  <span className="font-bold text-slate-700">{m.name}</span>
                  {m.price_adjustment > 0 && <span className="text-xs text-slate-400">+{m.price_adjustment}₪</span>}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
            <Button type="submit" size="sm"><Save className="h-4 w-4 me-1" />حفظ</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function ModifierModal({ modifier, onClose, onSaved }) {
  const [name, setName] = useState(modifier?.name || "");
  const [nameEn, setNameEn] = useState(modifier?.name_en || "");
  const [priceAdjustment, setPriceAdjustment] = useState(String(modifier?.price_adjustment || "0"));

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) { toast.error("اسم الإضافة مطلوب"); return; }
    try {
      const payload = { name: name.trim(), name_en: nameEn.trim() || null, price_adjustment: Number(priceAdjustment || 0) };
      if (modifier?.id) {
        await api.put(`/api/restaurant/modifiers/${modifier.id}`, payload);
        toast.success("تم تحديث الإضافة");
      } else {
        await api.post("/api/restaurant/modifiers", payload);
        toast.success("تم إنشاء الإضافة");
      }
      onSaved?.();
    } catch { toast.error("فشل الحفظ"); }
  }

  return (
    <Modal open title={null} onClose={onClose} maxWidth="max-w-sm">
      <div dir="rtl" className="space-y-4 p-4">
        <h2 className="text-lg font-black">{modifier ? "تعديل إضافة" : "إضافة جديدة"}</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500">الاسم (عربي)</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required value={name} onChange={(e) => setName(e.target.value)} placeholder="مثل: إضافي جبنة" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500">الاسم (إنجليزي) — اختياري</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Extra Cheese" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500">تعديل السعر (₪)</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="number" step="0.01" value={priceAdjustment} onChange={(e) => setPriceAdjustment(e.target.value)} placeholder="0.00" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
            <Button type="submit" size="sm"><Save className="h-4 w-4 me-1" />حفظ</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function ModifierItemsTab() {
  const qc = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState("");
  const [search, setSearch] = useState("");

  const { data: itemsData } = useQuery({
    queryKey: ["items", "all"],
    queryFn: () => api.get("/api/items", { params: { limit: 500, exclude_parents: 1 } }).then((r) => r.data?.data || []),
  });

  const { data: itemGroups } = useQuery({
    queryKey: ["item-modifier-groups", selectedItemId],
    queryFn: () => api.get(`/api/restaurant/items/${selectedItemId}/modifier-groups`).then((r) => r.data?.data || []),
    enabled: Boolean(selectedItemId),
  });

  const { data: allGroups } = useQuery({
    queryKey: ["modifier-groups"],
    queryFn: () => api.get("/api/restaurant/modifier-groups").then((r) => r.data?.data || []),
  });

  const items = (itemsData || []).filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.name?.toLowerCase().includes(q) || item.code?.toLowerCase().includes(q) || item.barcode?.toLowerCase().includes(q);
  });

  const attachedGroupIds = (itemGroups || []).map((g) => g.id);

  async function toggleGroup(groupId, currentlyAttached) {
    try {
      if (currentlyAttached) {
        await api.delete(`/api/restaurant/items/${selectedItemId}/modifier-groups/${groupId}`);
      } else {
        await api.post(`/api/restaurant/items/${selectedItemId}/modifier-groups`, { group_id: groupId });
      }
      qc.invalidateQueries(["item-modifier-groups", selectedItemId]);
      toast.success(currentlyAttached ? "تم فصل المجموعة" : "تم ربط المجموعة");
    } catch { toast.error("فشل التعديل"); }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-black text-slate-500">اختر صنفاً لإدارة مجموعات إضافاته</label>
        <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن صنف..." />
      </div>
      {search && (
        <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white">
          {items.slice(0, 30).map((item) => (
            <button key={item.id} type="button" onClick={() => { setSelectedItemId(item.id); setSearch(item.name); }}
              className={`w-full text-right px-4 py-2.5 text-sm font-bold hover:bg-slate-50 border-b border-slate-100 last:border-b-0 ${selectedItemId === item.id ? "bg-sky-50 text-sky-700" : "text-slate-700"}`}>
              {item.name}
              <span className="mr-2 text-xs text-slate-400 font-mono">{item.code || item.item_code || ""}</span>
            </button>
          ))}
        </div>
      )}
      {selectedItemId && (
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-black text-slate-700">مجموعات الإضافات المرتبطة</h3>
          {(allGroups || []).length === 0 ? (
            <p className="text-xs text-slate-400">لا توجد مجموعات إضافات — أنشئ مجموعة أولاً</p>
          ) : (
            <div className="space-y-2">
              {(allGroups || []).map((g) => {
                const attached = attachedGroupIds.includes(g.id);
                return (
                  <label key={g.id} className={`flex items-center justify-between rounded-lg border px-4 py-2.5 cursor-pointer transition-all ${attached ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 hover:border-slate-300"}`}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={attached} onChange={() => toggleGroup(g.id, attached)} className="rounded border-slate-300" />
                      <span className="font-bold text-sm text-slate-700">{g.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${g.selection_type === "multi" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                        {g.selection_type === "multi" ? "متعدد" : "واحد"}
                      </span>
                    </div>
                    {g.modifiers?.length > 0 && (
                      <span className="text-xs text-slate-400">{g.modifiers.map((m) => m.name).join("، ")}</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
      {!selectedItemId && !search && (
        <p className="text-slate-400 py-8 text-center">ابحث عن صنف لربط مجموعات الإضافات به</p>
      )}
    </div>
  );
}

export default function ModifierGroupsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("groups");
  const [groupModal, setGroupModal] = useState(null);
  const [modifierModal, setModifierModal] = useState(null);

  const { data: groups, isLoading: loadingGroups } = useQuery({
    queryKey: ["modifier-groups"],
    queryFn: () => api.get("/api/restaurant/modifier-groups").then((r) => r.data?.data || []),
  });

  const { data: modifiers, isLoading: loadingModifiers } = useQuery({
    queryKey: ["modifiers"],
    queryFn: () => api.get("/api/restaurant/modifiers").then((r) => r.data?.data || []),
    staleTime: 30000,
  });

  const deleteGroup = useMutation({
    mutationFn: (id) => api.delete(`/api/restaurant/modifier-groups/${id}`),
    onSuccess: () => { qc.invalidateQueries(["modifier-groups"]); toast.success("تم حذف المجموعة"); },
    onError: () => toast.error("فشل الحذف"),
  });

  const deleteModifier = useMutation({
    mutationFn: (id) => api.put(`/api/restaurant/modifiers/${id}`, { is_active: 0 }),
    onSuccess: () => { qc.invalidateQueries(["modifiers"]); toast.success("تم تعطيل الإضافة"); },
    onError: () => toast.error("فشل التعطيل"),
  });

  const refresh = () => { qc.invalidateQueries(["modifier-groups"]); qc.invalidateQueries(["modifiers"]); };

  return (
    <FeatureRoute featureKey="feature_restaurant">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-black flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-emerald-500" />
            إعدادات الإضافات والمقادير
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {[
            { id: "groups", label: "مجموعات الإضافات" },
            { id: "modifiers", label: "الإضافات" },
            { id: "items", label: "ربط بالأصناف" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-black transition-all border-b-2 ${
                tab === t.id ? "border-slate-800 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Groups */}
        {tab === "groups" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setGroupModal({})}><Plus className="h-4 w-4 me-1" />مجموعة جديدة</Button>
            </div>
            {loadingGroups ? (
              <p className="text-slate-400">جاري التحميل...</p>
            ) : (groups || []).length === 0 ? (
              <p className="text-slate-400 py-8 text-center">لا توجد مجموعات إضافات — أضف أول مجموعة</p>
            ) : (
              <div className="space-y-2">
                {(groups || []).map((g) => (
                  <div key={g.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-slate-800">{g.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${g.selection_type === "multi" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                          {g.selection_type === "multi" ? "متعدد" : "واحد"}
                        </span>
                        {g.required ? <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">إجباري</span> : null}
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setGroupModal(g)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                        <button type="button" onClick={() => { if (confirm("حذف المجموعة؟")) deleteGroup.mutate(g.id); }} className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    {g.modifiers?.length > 0 && (
                      <div className="px-4 py-2 space-y-1">
                        {g.modifiers.map((m) => (
                          <div key={m.id} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">{m.name}</span>
                            {m.price_adjustment > 0 && <span className="text-xs text-slate-400">+{m.price_adjustment}₪</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {groupModal !== null && (
              <GroupModal group={groupModal.id ? groupModal : null} onClose={() => setGroupModal(null)} onSaved={() => { setGroupModal(null); refresh(); }} />
            )}
          </div>
        )}

        {/* Tab: Modifiers */}
        {tab === "modifiers" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setModifierModal({})}><Plus className="h-4 w-4 me-1" />إضافة جديدة</Button>
            </div>
            {loadingModifiers ? (
              <p className="text-slate-400">جاري التحميل...</p>
            ) : (modifiers || []).length === 0 ? (
              <p className="text-slate-400 py-8 text-center">لا توجد إضافات — أضف أول إضافة</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-black text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3 text-right">الاسم</th>
                      <th className="px-4 py-3 text-right">الاسم (إنجليزي)</th>
                      <th className="px-4 py-3 text-right">تعديل السعر</th>
                      <th className="px-4 py-3 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(modifiers || []).map((m) => (
                      <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-bold text-slate-700">{m.name}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{m.name_en || "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-sm">{m.price_adjustment > 0 ? `+${m.price_adjustment}₪` : "—"}</td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => setModifierModal(m)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                            <button type="button" onClick={() => { if (confirm("تعطيل الإضافة؟")) deleteModifier.mutate(m.id); }} className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {modifierModal !== null && (
              <ModifierModal modifier={modifierModal.id ? modifierModal : null} onClose={() => setModifierModal(null)} onSaved={() => { setModifierModal(null); refresh(); }} />
            )}
          </div>
        )}

        {/* Tab: Item-Group linking */}
        {tab === "items" && <ModifierItemsTab />}
      </div>
    </FeatureRoute>
  );
}
