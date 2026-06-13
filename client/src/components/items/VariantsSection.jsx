import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { Plus, Layers, ChevronDown, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { useFeatureEnabled } from "../../hooks/useFeature";

export default function VariantsSection({ item, onRefresh }) {
  const enabled = useFeatureEnabled("feature_variants");
  const [attributes, setAttributes] = useState([]);
  const [children, setChildren] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [selection, setSelection] = useState({});
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    api.get("/api/variants/attributes").then(r => setAttributes(r.data?.data || [])).catch(() => {});
    if (item?.id && item?.is_variant_parent) {
      api.get(`/api/items?parent_id=${item.id}`).then(r => setChildren(r.data?.data || [])).catch(() => {});
    }
  }, [enabled, item?.id, item?.is_variant_parent]);

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

  return (
    <div className="border-t border-slate-200 pt-5 mt-5">
      <button type="button" onClick={() => setExpanded(e => !e)} className="flex items-center gap-2 text-sm font-black text-slate-700 mb-4">
        <Layers className="h-4 w-4 text-violet-600" />
        المتغيرات (مقاسات وألوان)
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
      </button>

      {expanded && (
        <div className="space-y-5">
          <p className="text-[12px] font-bold text-slate-500">
            اختر الخصائص والقيم لتوليد مصفوفة المتغيرات. كل تركيبة فريدة تصبح صنفاً منفصلاً بمخزون وسعر مستقل.
          </p>

          {!attributes.length && (
            <p className="text-[12px] text-amber-600 font-bold">لا توجد خصائص محددة. أضف خصائص (مقاس، لون...) أولاً من إدارة المتغيرات.</p>
          )}

          {attributes.map(attr => (
            <div key={attr.id}>
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">{attr.name}</h4>
              <div className="flex flex-wrap gap-2">
                {(attr.values || []).map(v => {
                  const sel = selection[attr.id]?.includes(v.value);
                  return (
                    <button key={v.id} type="button" onClick={() => toggleValue(attr.id, v.value)}
                      className={`rounded-full px-3 py-1 text-xs font-bold border transition-all ${sel ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-200 hover:border-violet-400"}`}>
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
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">المتغيرات الحالية ({children.length})</h4>
              <div className="grid gap-2 md:grid-cols-2">
                {children.slice(0, 20).map(child => {
                  const attrs = (() => { try { return JSON.parse(child.variant_attributes || "{}"); } catch { return {}; } })();
                  return (
                    <div key={child.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                      {Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(" / ")} — {child.sale_price} ج.م
                    </div>
                  );
                })}
                {children.length > 20 && <div className="text-xs text-slate-400 font-bold">+{children.length - 20} متغير آخر</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
