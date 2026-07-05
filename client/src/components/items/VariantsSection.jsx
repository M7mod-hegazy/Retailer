import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import { Plus, Layers, ChevronDown, ChevronRight, Pencil, X, Check, Save } from "lucide-react";
import toast from "react-hot-toast";
import { useFeatureEnabled } from "../../hooks/useFeature";

export default function VariantsSection({ item, onRefresh }) {
  const enabled = useFeatureEnabled("feature_variants");
  const [attributes, setAttributes] = useState([]);
  const [children, setChildren] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [selection, setSelection] = useState({});
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchChildren = useCallback(async () => {
    if (!item?.id) return;
    try {
      const res = await api.get(`/api/items/${item.id}/variant-children`);
      setChildren(res.data?.data || []);
    } catch { setChildren([]); }
  }, [item?.id]);

  useEffect(() => {
    if (!enabled) return;
    api.get("/api/variants/attributes").then(r => setAttributes(r.data?.data || [])).catch(() => {});
    if (item?.id && item?.is_variant_parent) {
      fetchChildren();
    }
  }, [enabled, item?.id, item?.is_variant_parent, fetchChildren]);

  if (!enabled) return null;

  const handleGenerate = async (e) => {
    e.preventDefault();
    const attrMap = {};
    attributes.forEach(a => {
      if (selection[a.id]?.length) attrMap[a.name] = selection[a.id];
    });
    if (!Object.keys(attrMap).length) { toast.error("اختر خاصية واحدة على الأقل"); return; }
    setGenerating(true);
    try {
      const r = await api.post(`/api/variants/items/${item.id}/generate-variants`, { attributes: attrMap });
      toast.success(`تم إنشاء ${r.data?.data?.created ?? 0} متغير`);
      fetchChildren();
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.error || "فشل الإنشاء");
    } finally { setGenerating(false); }
  };

  const toggleValue = (attrId, value) => {
    setSelection(prev => {
      const current = prev[attrId] || [];
      return { ...prev, [attrId]: current.includes(value) ? current.filter(v => v !== value) : [...current, value] };
    });
  };

  function startEdit(child) {
    setEditingId(child.id);
    setEditForm({
      barcode: child.barcode || "",
      sale_price: child.sale_price ?? "",
      purchase_price: child.purchase_price ?? "",
      wholesale_price: child.wholesale_price ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  async function handleSave(childId) {
    try {
      await api.put(`/api/items/${childId}`, editForm);
      toast.success("تم الحفظ");
      setEditingId(null);
      fetchChildren();
    } catch (err) {
      toast.error(err.response?.data?.error || "فشل الحفظ");
    }
  }

  function parseAttrs(child) {
    try { return JSON.parse(child.variant_attributes || "{}"); } catch { return {}; }
  }

  return (
    <div className="border-t border-border-subtle pt-5 mt-5">
      <button type="button" onClick={() => setExpanded(e => !e)} className="flex items-center gap-2 text-sm font-black text-text-secondary mb-4">
        <Layers className="h-4 w-4 text-violet-600" />
        المتغيرات (مقاسات وألوان)
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-text-muted" />}
      </button>

      {expanded && (
        <div className="space-y-5">
          <p className="text-xs font-bold text-text-muted">
            اختر الخصائص والقيم لتوليد مصفوفة المتغيرات. كل تركيبة فريدة تصبح صنفاً منفصلاً بمخزون وسعر مستقل.
          </p>

          {!attributes.length && (
            <p className="text-xs text-warning-text font-bold">لا توجد خصائص محددة. أضف خصائص (مقاس، لون...) أولاً من إدارة المتغيرات.</p>
          )}

          {attributes.map(attr => (
            <div key={attr.id}>
              <h4 className="text-xs font-black uppercase tracking-widest text-text-muted mb-2">{attr.name}</h4>
              <div className="flex flex-wrap gap-2">
                {(attr.values || []).map(v => {
                  const sel = selection[attr.id]?.includes(v.value);
                  return (
                    <button key={v.id} type="button" onClick={() => toggleValue(attr.id, v.value)}
                      className={`rounded-full px-3 py-1 text-xs font-bold border transition-all ${
                        sel ? "bg-violet-600 text-white border-violet-600" : "bg-bg-surface text-text-secondary border-border-normal hover:border-violet-400"
                      }`}>
                      {v.value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {item?.id && (
            <button type="button" onClick={handleGenerate} disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-50">
              <Plus className="h-4 w-4" />
              {generating ? "جاري الإنشاء..." : "توليد المتغيرات"}
            </button>
          )}

          {children.length > 0 && (
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-text-muted mb-2">المتغيرات الحالية ({children.length})</h4>
              <div className="space-y-2">
                {children.map(child => {
                  const attrs = parseAttrs(child);
                  const isEditing = editingId === child.id;
                  return (
                    <div key={child.id} className="rounded-lg border border-border-normal bg-bg-surface p-3">
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-text-secondary">{Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(" / ")}</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="text-xs text-text-muted">الباركود</label>
                              <input value={editForm.barcode} onChange={e => setEditForm(f => ({ ...f, barcode: e.target.value }))}
                                className="w-full rounded border border-border-normal px-2 py-1 text-xs bg-bg-input text-text-primary" />
                            </div>
                            <div>
                              <label className="text-xs text-text-muted">سعر البيع</label>
                              <input type="number" value={editForm.sale_price} onChange={e => setEditForm(f => ({ ...f, sale_price: e.target.value }))}
                                className="w-full rounded border border-border-normal px-2 py-1 text-xs bg-bg-input text-text-primary" />
                            </div>
                            <div>
                              <label className="text-xs text-text-muted">سعر الشراء</label>
                              <input type="number" value={editForm.purchase_price} onChange={e => setEditForm(f => ({ ...f, purchase_price: e.target.value }))}
                                className="w-full rounded border border-border-normal px-2 py-1 text-xs bg-bg-input text-text-primary" />
                            </div>
                            <div>
                              <label className="text-xs text-text-muted">سعر الجملة</label>
                              <input type="number" value={editForm.wholesale_price} onChange={e => setEditForm(f => ({ ...f, wholesale_price: e.target.value }))}
                                className="w-full rounded border border-border-normal px-2 py-1 text-xs bg-bg-input text-text-primary" />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleSave(child.id)}
                              className="flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-bold text-white hover:bg-primary-600">
                              <Check className="h-3 w-3" /> حفظ
                            </button>
                            <button onClick={cancelEdit}
                              className="flex items-center gap-1 rounded border border-border-normal px-3 py-1 text-xs font-bold text-text-secondary hover:bg-bg-overlay">
                              <X className="h-3 w-3" /> إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-bold text-text-primary">
                              {Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(" / ")}
                            </span>
                            {child.barcode && <span className="text-xs text-text-muted font-mono">{child.barcode}</span>}
                            {child.stock_quantity !== undefined && (
                              <span className="text-xs text-text-secondary">مخزون: {child.stock_quantity || 0}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-bold text-primary">{Number(child.sale_price || 0).toLocaleString()} ج.م</span>
                            {child.purchase_price ? <span className="text-xs text-text-muted">شراء: {Number(child.purchase_price).toLocaleString()}</span> : null}
                            <button onClick={() => startEdit(child)}
                              className="flex items-center gap-1 rounded border border-border-normal px-2 py-1 text-xs text-text-muted hover:bg-bg-overlay hover:text-text-primary">
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
