import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  LayoutDashboard,
  Package,
  Receipt,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useUiStore } from "../../stores/uiStore";

// ─── Type Config ─────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  page:     { Icon: LayoutDashboard, label: "شاشة",     color: "text-violet-600", bg: "bg-violet-50",  accent: "#7c3aed" },
  item:     { Icon: Package,         label: "صنف",      color: "text-blue-600",   bg: "bg-blue-50",    accent: "#2563eb" },
  customer: { Icon: Users,           label: "عميل",     color: "text-emerald-600",bg: "bg-emerald-50", accent: "#059669" },
  supplier: { Icon: Truck,           label: "مورد",     color: "text-orange-600", bg: "bg-orange-50",  accent: "#ea580c" },
  invoice:  { Icon: Receipt,         label: "فاتورة",   color: "text-indigo-600", bg: "bg-indigo-50",  accent: "#4338ca" },
  purchase: { Icon: ShoppingCart,    label: "مشتريات",  color: "text-amber-600",  bg: "bg-amber-50",   accent: "#d97706" },
  expense:  { Icon: TrendingDown,    label: "مصروف",    color: "text-rose-600",   bg: "bg-rose-50",    accent: "#e11d48" },
  revenue:  { Icon: TrendingUp,      label: "إيراد",    color: "text-teal-600",   bg: "bg-teal-50",    accent: "#0d9488" },
};

function getType(type) {
  return TYPE_CONFIG[type] || { Icon: Search, label: "نتيجة", color: "text-text-secondary", bg: "bg-bg-overlay", accent: "#64748b" };
}

// ─── Text Highlight ───────────────────────────────────────────────────────────

function Highlight({ text, query }) {
  if (!query || !text) return <>{text}</>;
  const tokens = query.trim().split(/\s+/).filter((t) => t.length >= 1);
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  if (!escaped) return <>{text}</>;
  try {
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = String(text).split(regex);
    return (
      <>
        {parts.map((part, i) =>
          part.match(regex) ? (
            <mark key={i} className="rounded-[3px] bg-amber-100 px-[1px] text-amber-900 not-italic">
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </>
    );
  } catch {
    return <>{text}</>;
  }
}

// ─── Result Group Order ───────────────────────────────────────────────────────

const GROUP_ORDER = ["page", "customer", "item", "invoice", "purchase", "supplier", "expense", "revenue"];

function buildGrouped(results) {
  const map = {};
  results.forEach((item) => {
    if (!map[item.type]) map[item.type] = [];
    map[item.type].push(item);
  });
  return Object.entries(map).sort(
    ([a], [b]) =>
      (GROUP_ORDER.indexOf(a) === -1 ? 99 : GROUP_ORDER.indexOf(a)) -
      (GROUP_ORDER.indexOf(b) === -1 ? 99 : GROUP_ORDER.indexOf(b)),
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GlobalSearchPage() {
  const navigate  = useNavigate();
  const isOpen    = useUiStore((s) => s.globalSearchOpen);
  const close     = useUiStore((s) => s.closeGlobalSearch);

  const [query,       setQuery]       = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(-1);

  const inputRef = useRef(null);

  // ── Reset on open/close ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setQuery(""); setSuggestions([]); setResults([]); setActiveIdx(-1);
      return;
    }
    const handler = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close, isOpen]);

  // ── Suggestions (fast, 80ms, shows pages always) ─────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await api.get("/api/search/suggestions", {
          params: { q: query.trim() || undefined },
          signal: controller.signal,
        });
        setSuggestions(r.data?.data || []);
      } catch { setSuggestions([]); }
    }, 150);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [isOpen, query]);

  // ── Deep search (200ms, starts at 1 char) ────────────────────────────────
  useEffect(() => {
    if (!isOpen || query.trim().length < 2) { setResults([]); setLoading(false); return; }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.get("/api/search", {
          params: { q: query.trim() },
          signal: controller.signal,
        });
        setResults(r.data?.data || []);
      } catch (err) {
        if (err?.name !== "CanceledError" && err?.code !== "ERR_CANCELED") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [isOpen, query]);

  // Flat item list for keyboard nav
  const flatItems = useMemo(() => {
    if (query.trim().length < 2) return suggestions;
    return results;
  }, [query, results, suggestions]);

  useEffect(() => setActiveIdx(-1), [flatItems]);

  // ── Keyboard nav ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, flatItems.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
      else if (e.key === "Enter" && activeIdx >= 0) {
        const item = flatItems[activeIdx];
        if (item) { close(); navigate(item.link || "/dashboard"); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, flatItems, activeIdx, close, navigate]);

  const handleSelect = useCallback((item) => { close(); navigate(item.link || "/dashboard"); }, [close, navigate]);

  if (!isOpen) return null;

  const showSearch  = query.trim().length >= 2;
  const grouped     = buildGrouped(results);

  // Build flat→grouped index map for keyboard nav highlight
  let flatCounter = -1;
  const flatToGrouped = []; // [{groupType, itemIndex}]
  if (showSearch) {
    grouped.forEach(([type, entries]) => {
      entries.forEach((_, j) => { flatToGrouped.push({ type, j }); });
    });
  } else {
    suggestions.forEach((_, i) => flatToGrouped.push({ type: null, j: i }));
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-slate-900/25 px-4 pt-[10vh] backdrop-blur-[16px]"
      onClick={close}
      dir="rtl"
    >
      <div
        className="relative flex w-full max-w-[680px] flex-col overflow-hidden rounded-[24px] bg-bg-surface shadow-[0_32px_80px_-12px_rgba(0,0,0,0.22)] ring-1 ring-slate-900/[0.05]"
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Input ───────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-3 px-5 py-4">
          {loading ? (
            <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-[2.5px] border-border-normal border-t-emerald-500" />
          ) : (
            <Search className="h-5 w-5 shrink-0 text-text-muted" strokeWidth={2} />
          )}
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث: عميل، صنف، فاتورة، رقم مرجعي، مصروف..."
            className="w-full bg-transparent text-[18px] font-medium text-text-primary outline-none placeholder:font-normal placeholder:text-text-muted"
          />
          {query.trim().length > 0 ? (
            <button
              type="button"
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="shrink-0 rounded-full p-1.5 text-text-muted transition hover:bg-rose-50 hover:text-rose-500"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="shrink-0 rounded-md border border-border-normal bg-bg-overlay px-2 py-1 text-[11px] font-black uppercase tracking-widest text-text-muted shadow-sm">
              ESC
            </kbd>
          )}
        </div>

        <div className="h-px shrink-0 bg-bg-overlay" />

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* Quick-access grid when not searching */}
          {!showSearch && (
            <div className="px-5 py-5">
              <div className="mb-3 text-[11px] font-black uppercase tracking-[0.15em] text-text-muted">
                تصفح سريع
              </div>
              <div className="grid grid-cols-2 gap-2">
                {suggestions.map((item, i) => {
                  const { Icon, color, bg } = getType(item.type);
                  const isActive = activeIdx === i;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`group flex items-center gap-3 rounded-[14px] border px-4 py-3 text-right transition-all ${
                        isActive
                          ? "border-emerald-200 bg-emerald-50/60 shadow-sm"
                          : "border-border-subtle bg-bg-surface shadow-sm hover:border-emerald-100 hover:shadow-md"
                      }`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${bg}`}>
                        <Icon className={`h-4 w-4 ${color}`} strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-text-primary">{item.title}</div>
                        <div className="truncate text-[11px] text-text-muted">{item.subtitle}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search results */}
          {showSearch && (
            <>
              {!loading && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <Search className="mb-4 h-12 w-12 text-slate-200" strokeWidth={1} />
                  <div className="text-[15px] font-bold text-text-muted">لا توجد نتائج مطابقة</div>
                  <div className="mt-1 text-2sm text-text-muted">جرّب كلمة مختلفة أو تحقق من الإملاء</div>
                </div>
              )}

              {grouped.map(([type, entries]) => {
                const { Icon, label, color, bg } = getType(type);
                return (
                  <div key={type} className="border-b border-border-subtle px-4 py-4 last:border-0">
                    {/* Section header */}
                    <div className="mb-2.5 flex items-center gap-2">
                      <div className={`flex h-5 w-5 items-center justify-center rounded-[6px] ${bg}`}>
                        <Icon className={`h-2.5 w-2.5 ${color}`} strokeWidth={2.5} />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-text-secondary">{label}</span>
                      <span className="ml-auto font-bold text-[11px] text-text-muted ltr">{entries.length}</span>
                    </div>

                    {/* Result cards */}
                    <div className="space-y-1">
                      {entries.map((item) => {
                        flatCounter++;
                        const fi = flatCounter;
                        const isActive = activeIdx === fi;
                        return (
                          <button
                            key={`${item.type}-${item.id}`}
                            type="button"
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setActiveIdx(fi)}
                            className={`group flex w-full items-center gap-3 rounded-[14px] border px-4 py-3 text-right transition-all ${
                              isActive
                                ? "border-emerald-100 bg-emerald-50/60 shadow-sm"
                                : "border-transparent hover:border-border-subtle hover:bg-bg-overlay/80"
                            }`}
                          >
                            {/* Type pip */}
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${bg}`}>
                              <Icon className={`h-3.5 w-3.5 ${color}`} strokeWidth={1.75} />
                            </div>

                            {/* Text */}
                            <div className="min-w-0 flex-1">
                              <div className={`truncate text-sm font-bold transition-colors ${isActive ? "text-emerald-800" : "text-text-primary"}`}>
                                <Highlight text={item.title} query={query} />
                              </div>
                              {item.subtitle && (
                                <div className="mt-0.5 truncate text-[11.5px] text-text-muted">
                                  <Highlight text={item.subtitle} query={query} />
                                </div>
                              )}
                            </div>

                            {/* Arrow */}
                            <ChevronLeft
                              className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-emerald-500" : "text-slate-200 group-hover:text-text-muted"}`}
                              strokeWidth={2}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* ── Footer Hints ─────────────────────────────────────────────────── */}
        {showSearch && results.length > 0 && (
          <div className="flex shrink-0 items-center gap-5 border-t border-border-subtle bg-bg-overlay/60 px-5 py-2.5">
            {[["↑↓", "تنقل"], ["↵", "فتح"]].map(([k, lbl]) => (
              <span key={k} className="flex items-center gap-1.5 text-[11px] font-bold text-text-muted">
                <kbd className="rounded border border-border-normal bg-bg-surface px-1.5 py-0.5 text-[11px] font-black shadow-sm">{k}</kbd>
                {lbl}
              </span>
            ))}
            <span className="mr-auto text-[11px] font-bold text-text-muted ltr">{results.length} نتيجة</span>
          </div>
        )}
      </div>
    </div>
  );
}
