import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Star, Clock, LayoutTemplate, X, ArrowLeft, MousePointerClick } from "lucide-react";
import { useReportsStore } from "../../stores/reportsStore";
import { useReportsConfig, getReportDescription } from "../../hooks/useReportsConfig";
import { usePageTour } from "../../hooks/usePageTour";
import { useFeatureEnabled } from "../../hooks/useFeature";
import { useAuthStore } from "../../stores/authStore";

const SOURCE_CAT_MAP = {
  sales: "sales",
  purchases: "purchases",
  "purchase-returns": "purchases",
  "sales-returns": "sales",
  suppliers: "accounts",
  customers: "accounts",
  employees: "individuals",
  users: "individuals",
  installments: "accounts",
  items: "inventory",
  warehouses: "inventory",
  expenses: "treasury",
  revenues: "treasury",
  treasury: "treasury",
  "payment-flow": "treasury",
  "owner-statement": "accounts",
  profit: "profitability",
  expiry: "inventory",
  "physical-count": "inventory",
  tax: "tax",
};

// All labels come from the server registry/config (single source of truth);
// the raw label_key survives only as a last-resort fallback.
function clsLabel(cls) {
  return cls.label || cls.label_key;
}

export default function ReportsCenter() {
  usePageTour("reports");
  const expiryEnabled = useFeatureEnabled("feature_expiry");
  const taxEnabled = useFeatureEnabled("feature_tax");
  const navigate = useNavigate();
  const { data: config } = useReportsConfig();
  const store = useReportsStore();

  const classificationsBySource = config?.classifications || {};

  const currentUser = useAuthStore((s) => s.user);
  const userPermissions = useAuthStore((s) => s.permissions);
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "dev";

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [onlyFavs, setOnlyFavs] = useState(false);

  const populatedCatIds = useMemo(
    () => new Set((config?.sources || []).map((s) => SOURCE_CAT_MAP[s.id]).filter(Boolean)),
    [config?.sources]
  );

  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    let rows = config?.sources || [];
    if (!expiryEnabled) rows = rows.filter((s) => s.id !== "expiry");
    if (!taxEnabled) rows = rows.filter((s) => s.id !== "tax");
    if (activeCat !== "all") rows = rows.filter((s) => SOURCE_CAT_MAP[s.id] === activeCat);
    if (onlyFavs) rows = rows.filter((s) => store.favorites.has(s.id));
    if (q) {
      // Match the source name OR any report (classification) inside it — the
      // classifications are the actual reports, so searching "هوامش" must hit.
      rows = rows.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          (classificationsBySource[s.id] || []).some((c) =>
            String(c.label || c.label_key || "").toLowerCase().includes(q)
          )
      );
    }
    if (!isAdmin) {
      rows = rows.filter((s) => {
        const key = "report_" + s.id;
        return Array.isArray(userPermissions?.[key]) && userPermissions[key].includes("view");
      });
    }
    return rows;
  }, [config, activeCat, store.favorites, onlyFavs, q, expiryEnabled, taxEnabled, isAdmin, userPermissions, classificationsBySource]);

  // ── Direct navigation: a click opens the report immediately. ──────────────
  // All configuration (dates, filters, columns, cost method) lives inside the
  // workspace and applies live — no "configure first, then run" gate.
  function openReport(source, clsId) {
    if (source.id === "owner-statement") return navigate("/reports/owner-statement");
    if (source.id === "expiry") return navigate("/reports/expiry-report");
    const classes = classificationsBySource[source.id] || [];
    const cls = (clsId && classes.find((c) => c.id === clsId)) || classes[0];
    if (!cls) return;
    const mode = cls.availableModes?.includes("detailed") ? "detailed" : cls.availableModes?.[0] || "detailed";
    navigate(`/reports/source/${source.id}/${cls.id}/${mode}`);
  }

  function toggleFav(e, sourceId) {
    e.stopPropagation();
    store.toggleFavorite(sourceId);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-base)] text-text-primary" dir="rtl" style={{ fontFamily: "Satoshi, sans-serif" }}>
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-base)]">

        {/* TOP RAIL (Categories + Search) */}
        <div className="shrink-0 border-b border-border-normal bg-bg-surface flex items-center px-4 py-1.5 gap-1 z-20 shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1.5 border-l border-border-normal pl-2.5 ml-1.5 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white">
              <LayoutTemplate size={14} strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-black text-text-primary">التقارير</span>
          </div>
          <button
            onClick={() => setActiveCat("all")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-bold text-[11px] whitespace-nowrap shrink-0 ${
              activeCat === "all" ? "bg-bg-overlay text-text-primary shadow-sm border border-border-normal" : "text-text-muted hover:bg-bg-base hover:text-text-primary"
            }`}
          >
            الكل
          </button>
          {(config?.categories || []).filter((cat) => populatedCatIds.has(cat.id)).map((cat) => {
            const active = activeCat === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`group relative flex items-center gap-1 px-2.5 py-1 rounded-md transition-all duration-300 font-bold text-[11px] whitespace-nowrap shrink-0 ${
                  active ? "bg-bg-surface shadow-sm border border-border-normal" : "hover:bg-bg-base text-text-muted hover:text-text-primary"
                }`}
                style={active ? { color: cat.color } : {}}
              >
                <cat.icon size={13} strokeWidth={active ? 2.5 : 2} className={active ? "" : "group-hover:scale-110 transition-transform"} />
                {cat.label}
                {active && (
                  <motion.div layoutId="activeRailTop" className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t-full" style={{ backgroundColor: cat.color }} />
                )}
              </button>
            );
          })}

          <div className="mr-auto flex items-center gap-1.5 shrink-0">
            <div data-help="search-bar" className="relative group">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="دوّر على أي تقرير..."
                className="w-44 h-7 rounded-md border border-border-normal bg-bg-surface pl-2 pr-7 text-[11px] font-bold text-text-primary placeholder:text-text-muted shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
              />
              <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-primary" />
            </div>
            <button
              data-help="favorite-button"
              onClick={() => setOnlyFavs(!onlyFavs)}
              className={`flex h-7 w-7 items-center justify-center rounded-md border transition-all shadow-sm ${
                onlyFavs ? "border-warning-border bg-warning-bg text-warning-text" : "border-border-normal bg-bg-surface text-text-secondary hover:border-border-strong"
              }`}
              title="المفضلة"
            >
              <Star size={12} fill={onlyFavs ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div data-help="main-table" className="flex-1 overflow-y-auto px-8 pb-12 scrollbar-thin scrollbar-thumb-zinc-300">

          {/* Quick return: saved views + recents */}
          {(store.recents.length > 0 || store.presets.length > 0) && (
            <div className="max-w-6xl mx-auto w-full pt-5 pb-1">
              <div className="rounded-2xl border border-border-normal bg-bg-surface px-4 py-3 space-y-2.5 shadow-sm">
                {store.presets.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black text-text-muted shrink-0 flex items-center gap-1"><Star size={11} className="text-warning-text" /> عروض محفوظة:</span>
                    {store.presets.slice(0, 8).map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-bg pl-1 pr-2.5 py-1">
                        <button onClick={() => navigate(p.key)} className="text-[11px] font-bold text-warning-text hover:underline">{p.name}</button>
                        <button onClick={() => store.deletePreset(p.id)} className="text-warning-text/60 hover:text-warning-text" title="حذف"><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                )}
                {store.recents.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black text-text-muted shrink-0 flex items-center gap-1"><Clock size={11} /> آخر اللي فتحته:</span>
                    {store.recents.slice(0, 6).map((r) => {
                      const [src, cls, mode] = String(r.key).split(".");
                      const srcDef = (config?.sources || []).find((x) => x.id === src);
                      const clsDef = (classificationsBySource[src] || []).find((c) => c.id === cls);
                      if (!srcDef || !clsDef) return null;
                      return (
                        <button key={r.key} onClick={() => navigate(`/reports/source/${src}/${cls}/${mode || "detailed"}`)}
                          className="rounded-full border border-border bg-bg-surface px-2.5 py-1 text-[11px] font-bold text-text-secondary hover:border-primary hover:text-primary transition-colors">
                          {srcDef.label} — {clsLabel(clsDef)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div data-help="report-categories" className="max-w-6xl mx-auto w-full">
            {/* One-line orientation hint — the whole page works with a single click */}
            <div className="flex items-center gap-2 pt-4 pb-3 text-text-muted">
              <MousePointerClick size={14} className="shrink-0" />
              <span className="text-xs font-bold">دوس على أي تقرير وهيفتح على طول — كل الفلاتر والفترات بتتظبط من جوّه.</span>
            </div>

            {filtered.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-overlay text-text-muted mb-4"><Search size={24} /></div>
                <h3 className="text-[16px] font-black text-text-primary mb-1">مفيش تقارير بالاسم ده</h3>
                <p className="text-sm text-text-muted">جرب كلمة تانية، أو شيل فلتر الفئة وهتلاقي كل التقارير قدامك.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 auto-rows-max items-start">
                {filtered.map((source) => {
                  const cat = (config?.categories || []).find((c) => c.id === SOURCE_CAT_MAP[source.id]) || (config?.categories || [])[0] || {};
                  const fav = store.favorites.has(source.id);
                  const classifications = classificationsBySource[source.id] || [];
                  const defaultCls = classifications[0];
                  const SourceIcon = source.icon;
                  return (
                    <div
                      key={source.id}
                      onClick={() => openReport(source)}
                      className="group relative flex flex-col overflow-hidden rounded-[20px] p-5 transition-all duration-300 cursor-pointer text-right border bg-bg-surface border-border-normal shadow-sm hover:border-primary hover:shadow-md"
                    >
                      {/* Top Row: Icon + Title + Fav */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-base group-hover:bg-bg-overlay transition-colors" style={{ color: source.color }}>
                            <SourceIcon size={20} strokeWidth={2.5} />
                          </div>
                          <div>
                            <div className="text-[11px] font-black uppercase tracking-widest mb-1 text-text-muted">{cat.label}</div>
                            <h3 className="text-[15px] font-black leading-tight text-text-primary group-hover:text-primary transition-colors">
                              {source.label}
                            </h3>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => toggleFav(e, source.id)}
                          className={`shrink-0 p-1.5 rounded-full transition-colors ${fav ? "text-warning-text bg-warning-bg" : "text-text-muted hover:text-text-secondary hover:bg-bg-overlay"}`}
                          title={fav ? "شيل من المفضلة" : "حط في المفضلة"}
                        >
                          <Star size={16} fill={fav ? "currentColor" : "none"} strokeWidth={fav ? 0 : 2} />
                        </button>
                      </div>

                      <p className="text-xs font-medium text-text-secondary line-clamp-2 leading-relaxed mb-3">
                        {defaultCls?.desc || getReportDescription(defaultCls?.id)}
                      </p>

                      {/* The classifications ARE the reports — every chip opens one directly */}
                      {classifications.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-border-subtle">
                          {classifications.map((cls) => {
                            const isSearchHit = q && String(cls.label || "").toLowerCase().includes(q);
                            return (
                              <button
                                key={cls.id}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openReport(source, cls.id); }}
                                title={cls.desc || ""}
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                                  isSearchHit
                                    ? "bg-warning-bg text-warning-text border-warning-border"
                                    : "bg-bg-base text-text-secondary border-border-normal hover:border-primary hover:text-primary hover:bg-primary/5"
                                }`}
                              >
                                {clsLabel(cls)}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-auto pt-3 border-t border-border-subtle">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-primary">
                            افتح التقرير <ArrowLeft size={12} />
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
