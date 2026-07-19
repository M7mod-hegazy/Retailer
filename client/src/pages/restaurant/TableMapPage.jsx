import React, { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { usePageTour } from "../../hooks/usePageTour";
import { UtensilsCrossed, Plus } from "lucide-react";
import Button from "../../components/ui/Button";
import FeatureRoute from "../../components/ui/FeatureRoute";

const STATUS_CONFIG = {
  available: { label: "متاحة", bg: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-400" },
  occupied:  { label: "مشغولة", bg: "bg-red-50 border-red-200 hover:bg-red-100",       text: "text-red-700",     dot: "bg-red-400" },
  reserved:  { label: "محجوزة", bg: "bg-amber-50 border-amber-200 hover:bg-amber-100", text: "text-amber-700",   dot: "bg-amber-400" },
  cleaning:  { label: "تنظيف",  bg: "bg-bg-overlay border-border-normal",                   text: "text-text-secondary",   dot: "bg-border-strong" },
};

export default function TableMapPage() {
  usePageTour('table_map');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newTable, setNewTable] = useState({ name: "", section: "", capacity: "4" });
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef(null);
  const sectionRef = useRef(null);
  const capacityRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  const { data } = useQuery({
    queryKey: ["dining-tables"],
    queryFn: () => api.get("/api/restaurant/tables").then(r => r.data.data || []),
    refetchInterval: 20000,
  });

  const tables = data || [];
  const sections = [...new Set(tables.map(t => t.section || "عام"))];

  async function openTable(table) {
    if (table.status === "occupied" && table.current_order_id) {
      navigate(`/pos?table=${table.id}&order=${table.current_order_id}`);
    } else if (table.status === "available") {
      navigate(`/pos?table=${table.id}`);
    }
  }

  async function addTable(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/restaurant/tables", { ...newTable, capacity: Number(newTable.capacity) });
      qc.invalidateQueries(["dining-tables"]);
      setShowAdd(false);
      setNewTable({ name: "", section: "", capacity: "4" });
    } catch {} finally { setSubmitting(false); }
  }

  return (
    <FeatureRoute featureKey="feature_restaurant">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-black flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-emerald-500" />
            خريطة الطاولات
          </h1>
          <Button size="sm" onClick={() => setShowAdd(p => !p)}>
            <Plus className="h-4 w-4 me-1" />طاولة جديدة
          </Button>
        </div>

        {showAdd && (
          <form onSubmit={addTable} className="flex gap-3 flex-wrap items-end rounded-xl border border-border-normal bg-bg-surface p-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-text-secondary">اسم الطاولة</label>
              <input ref={nameRef} className="rounded-lg border border-border-normal px-3 py-2 text-sm" required value={newTable.name} onChange={e => setNewTable(p => ({ ...p, name: e.target.value }))} onKeyDown={e => handleKeyDown(e, { nextRef: sectionRef, prevRef: null })} placeholder="طاولة 1" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-text-secondary">القسم</label>
              <input ref={sectionRef} className="rounded-lg border border-border-normal px-3 py-2 text-sm" value={newTable.section} onChange={e => setNewTable(p => ({ ...p, section: e.target.value }))} onKeyDown={e => handleKeyDown(e, { nextRef: capacityRef, prevRef: nameRef })} placeholder="قسم A" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-text-secondary">السعة</label>
              <input ref={capacityRef} className="w-20 rounded-lg border border-border-normal px-3 py-2 text-sm" type="number" min="1" value={newTable.capacity} onChange={e => setNewTable(p => ({ ...p, capacity: e.target.value }))} onKeyDown={e => handleKeyDown(e, { prevRef: sectionRef, onEnter: () => addTable({ preventDefault: () => {} }) })} />
            </div>
            <Button type="submit" size="sm" disabled={submitting} className="flex items-center gap-1.5">
              {submitting && <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-normal/30 border-t-white" />}
              حفظ
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)}>إلغاء</Button>
          </form>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs font-bold text-text-secondary">
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${v.dot}`} />
              {v.label}
            </div>
          ))}
        </div>

        {sections.map(section => (
          <div key={section} className="space-y-3">
            <h3 className="text-[12px] font-black text-text-secondary uppercase tracking-widest">{section}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {tables.filter(t => (t.section || "عام") === section).map(table => {
                const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available;
                return (
                  <button
                    key={table.id}
                    onClick={() => openTable(table)}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 p-4 transition-all ${cfg.bg} ${table.status === "cleaning" ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  >
                    <span className={`text-lg font-black ${cfg.text}`}>{table.name}</span>
                    <span className={`mt-1 flex items-center gap-1 text-[11px] font-bold ${cfg.text}`}>
                      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    {table.customer_name && <span className="mt-1 text-[10px] text-text-secondary truncate max-w-full">{table.customer_name}</span>}
                    <span className="mt-1 text-[10px] text-text-muted">{table.capacity} أشخاص</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {tables.length === 0 && (
          <div className="text-center text-text-muted py-16">لا توجد طاولات — أضف أول طاولة للبدء</div>
        )}
      </div>
    </FeatureRoute>
  );
}
