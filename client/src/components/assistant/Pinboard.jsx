import React, { useState, useEffect } from "react";
import { Pin, Trash2, Plus, X, ExternalLink, Save } from "lucide-react";
import { fetchPinboard, saveToPinboard, removeFromPinboard } from "../../services/queryEngine";

export default function Pinboard({ onSelectQuery, t }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [queryText, setQueryText] = useState("");

  const load = async () => {
    const res = await fetchPinboard();
    if (res.success) setItems(res.data || []);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!label.trim() || !queryText.trim()) return;
    await saveToPinboard(label, queryText);
    setLabel(""); setQueryText(""); setShowAdd(false);
    load();
  };

  const handleRemove = async (id) => {
    await removeFromPinboard(id);
    load();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          <Pin className="inline h-3 w-3 ml-1" /> {t?.("pinboard.title") || "المثبت"}
        </span>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black"
          style={{ background: "var(--bg-input)", color: "var(--primary)" }}>
          <Plus className="h-3 w-3" /> {t?.("pinboard.add") || "إضافة"}
        </button>
      </div>

      {showAdd && (
        <div className="rounded-2xl border p-3 space-y-2" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder={t?.("pinboard.labelPlaceholder") || "اسم المختصر"}
            className="w-full rounded-xl border bg-transparent px-3 py-1.5 text-[12px] font-bold outline-none"
            style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)" }} />
          <input value={queryText} onChange={e => setQueryText(e.target.value)} placeholder={t?.("pinboard.queryPlaceholder") || "مثال: مبيعات النهاردة"}
            className="w-full rounded-xl border bg-transparent px-3 py-1.5 text-[12px] font-bold outline-none"
            style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)" }} />
          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-black text-white"
              style={{ background: "var(--primary)" }}>
              <Save className="h-3 w-3" /> {t?.("pinboard.save") || "حفظ"}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="rounded-xl border px-3 py-1.5 text-[11px] font-bold"
              style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>
              {t?.("pinboard.cancel") || "إلغاء"}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !showAdd && (
        <p className="px-1 text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
          {t?.("pinboard.empty") || "لا يوجد استعلامات محفوظة. احفظ استعلاماتك المهمة عشان ترجعلها بسرعة."}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {items.filter(i => i.pinned).map(item => (
          <div key={item.id}
            className="group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all hover:shadow-sm cursor-pointer"
            style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}
            onClick={() => onSelectQuery(item.query_text)}>
            <Pin className="h-2.5 w-2.5" style={{ color: "var(--primary)" }} />
            {item.label}
            <button onClick={e => { e.stopPropagation(); handleRemove(item.id); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-0.5"
              style={{ background: "var(--danger-bg)" }}>
              <Trash2 className="h-2.5 w-2.5" style={{ color: "var(--danger)" }} />
            </button>
          </div>
        ))}
      </div>

      {items.filter(i => !i.pinned).length > 0 && (
        <>
          <span className="px-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            {t?.("pinboard.pinned") || "غير مثبت"}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {items.filter(i => !i.pinned).map(item => (
              <div key={item.id}
                className="group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold cursor-pointer hover:shadow-sm"
                style={{ borderColor: "var(--border-normal)", color: "var(--text-muted)" }}
                onClick={() => onSelectQuery(item.query_text)}>
                {item.label}
                <button onClick={e => { e.stopPropagation(); handleRemove(item.id); }}
                  className="opacity-0 group-hover:opacity-100 rounded-full p-0.5"
                  style={{ background: "var(--danger-bg)" }}>
                  <X className="h-2.5 w-2.5" style={{ color: "var(--danger)" }} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
