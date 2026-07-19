import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight,
  Filter, RefreshCcw, Search,
  X, ChevronLeft, ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import SearchDropdown from "../ui/SearchDropdown";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
  return Number(n ?? 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FIELD_LABELS = {
  sale_price:      "سعر البيع",
  purchase_price:  "سعر الشراء",
  wholesale_price: "سعر الجملة",
};

const SOURCE_LABELS = {
  item_create:            "إنشاء صنف",
  bulk_update:            "تحديث جماعي",
  purchase_locked:        "فاتورة شراء",
  branch_receive_locked:  "استلام تحويل فرع",
  manual_correction:      "تصحيح يدوي",
  revert:                 "استرجاع",
};

const SOURCE_COLORS = {
  item_create:            "bg-blue-100 text-blue-700",
  bulk_update:            "bg-purple-100 text-purple-700",
  purchase_locked:        "bg-emerald-100 text-emerald-700",
  branch_receive_locked:  "bg-teal-100 text-teal-700",
  manual_correction:      "bg-amber-100 text-amber-700",
  revert:                 "bg-bg-overlay text-text-secondary",
};

const DOC_TYPE_LABELS = {
  invoice:         "فاتورة بيع",
  sales_return:    "مرتجع مبيعات",
  purchase_return: "مرتجع مشتريات",
  branch_transfer: "نقل فرع",
};

// ── sub-components ────────────────────────────────────────────────────────────
function Badge({ label, colorClass }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${colorClass ?? "bg-bg-overlay text-text-secondary"}`}>
      {label}
    </span>
  );
}

function DiffChip({ oldVal, newVal }) {
  const diff = newVal - oldVal;
  const pct  = oldVal > 0 ? ((diff / oldVal) * 100).toFixed(1) : null;
  const up   = diff >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${up ? "text-rose-600" : "text-emerald-600"}`}>
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {fmt(Math.abs(diff))}
      {pct !== null && <span className="opacity-60">({pct}%)</span>}
    </span>
  );
}

function Pagination({ page, total, limit, onPage }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-center py-3 text-sm text-text-secondary">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}
        className="p-1 rounded hover:bg-bg-overlay disabled:opacity-30"><ChevronRight size={16} /></button>
      <span>صفحة {page} من {pages}</span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)}
        className="p-1 rounded hover:bg-bg-overlay disabled:opacity-30"><ChevronLeft size={16} /></button>
    </div>
  );
}

// ── Analytics cards ───────────────────────────────────────────────────────────
function AnalyticsCards({ analytics }) {
  if (!analytics) return null;
  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="bg-bg-surface rounded-xl border border-border-normal p-3 flex flex-col gap-1">
        <span className="text-[11px] text-text-muted font-bold uppercase">تغييرات اليوم</span>
        <span className="text-2xl font-black text-text-primary">{analytics.changes_today}</span>
      </div>
      <div className="bg-bg-surface rounded-xl border border-border-normal p-3 flex flex-col gap-1">
        <span className="text-[11px] text-text-muted font-bold uppercase">هذا الأسبوع</span>
        <span className="text-2xl font-black text-text-primary">{analytics.changes_week}</span>
      </div>
      <div className="bg-bg-surface rounded-xl border border-border-normal p-3 flex flex-col gap-1">
        <span className="text-[11px] text-text-muted font-bold uppercase">هذا الشهر</span>
        <span className="text-2xl font-black text-text-primary">{analytics.changes_month}</span>
      </div>
    </div>
  );
}

// ── History table ─────────────────────────────────────────────────────────────
function HistoryTable({ rows, loading }) {
  if (loading) return <div className="py-12 text-center text-text-muted text-sm">جارٍ التحميل…</div>;
  if (!rows.length) return <div className="py-12 text-center text-text-muted text-sm">لا توجد سجلات</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-right border-collapse">
        <thead>
          <tr className="bg-bg-overlay text-text-secondary text-[11px] uppercase font-bold">
            <th className="px-3 py-2">الكود</th>
            <th className="px-3 py-2">الصنف</th>
            <th className="px-3 py-2">الحقل</th>
            <th className="px-3 py-2">قبل</th>
            <th className="px-3 py-2">بعد</th>
            <th className="px-3 py-2">التغيير</th>
            <th className="px-3 py-2">المصدر</th>
            <th className="px-3 py-2">المستخدم</th>
            <th className="px-3 py-2">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border-subtle hover:bg-bg-overlay transition-colors">
              <td className="px-3 py-2 font-mono text-[11px] font-black text-indigo-700 whitespace-nowrap">{r.item_code || "—"}</td>
              <td className="px-3 py-2 font-semibold text-text-primary">{r.item_name}</td>
              <td className="px-3 py-2 text-text-secondary">{FIELD_LABELS[r.field] ?? r.field}</td>
              <td className="px-3 py-2 number-fmt text-text-secondary">{fmt(r.old_value)}</td>
              <td className="px-3 py-2 number-fmt text-text-primary">{fmt(r.new_value)}</td>
              <td className="px-3 py-2"><DiffChip oldVal={r.old_value} newVal={r.new_value} /></td>
              <td className="px-3 py-2">
                <Badge label={SOURCE_LABELS[r.source] ?? r.source ?? "—"} colorClass={SOURCE_COLORS[r.source]} />
              </td>
              <td className="px-3 py-2 text-text-muted text-xs">{r.changed_by_username ?? "—"}</td>
              <td className="px-3 py-2 text-text-muted text-xs whitespace-nowrap">{r.changed_at?.slice(0, 16)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DOC_ROUTES = {
  invoice:         (id) => `/invoices/${id}`,
  sales_return:    (id) => `/pos/sales-returns/${id}`,
  purchase_return: (id) => `/purchases/returns/${id}`,
};

// ── Overrides table ───────────────────────────────────────────────────────────
function OverridesTable({ rows, loading }) {
  const navigate = useNavigate();
  if (loading) return <div className="py-12 text-center text-text-muted text-sm">جارٍ التحميل…</div>;
  if (!rows.length) return <div className="py-12 text-center text-text-muted text-sm">لا توجد تجاوزات</div>;

  function openDoc(r) {
    const route = DOC_ROUTES[r.source_type];
    if (route && r.source_id) navigate(route(r.source_id));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-right border-collapse">
        <thead>
          <tr className="bg-bg-overlay text-text-secondary text-[11px] uppercase font-bold">
            <th className="px-3 py-2">رقم المستند</th>
            <th className="px-3 py-2">نوع</th>
            <th className="px-3 py-2">الكود</th>
            <th className="px-3 py-2">الصنف</th>
            <th className="px-3 py-2">السعر المستخدم</th>
            <th className="px-3 py-2">السعر الرئيسي</th>
            <th className="px-3 py-2">الفرق</th>
            <th className="px-3 py-2">التاريخ</th>
            <th className="px-3 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border-subtle hover:bg-amber-50 transition-colors cursor-pointer" onClick={() => openDoc(r)}>
              <td className="px-3 py-2 font-mono text-text-primary text-xs font-bold">{r.doc_no || "—"}</td>
              <td className="px-3 py-2">
                <Badge label={DOC_TYPE_LABELS[r.source_type] ?? r.source_type} colorClass="bg-amber-100 text-amber-700" />
              </td>
              <td className="px-3 py-2 font-mono text-[11px] font-black text-indigo-700 whitespace-nowrap">{r.item_code || "—"}</td>
              <td className="px-3 py-2 font-semibold text-text-primary">{r.item_name}</td>
              <td className="px-3 py-2 number-fmt text-text-primary">{fmt(r.used_price)}</td>
              <td className="px-3 py-2 number-fmt text-text-secondary">{fmt(r.master_price_at_time)}</td>
              <td className="px-3 py-2">
                <DiffChip oldVal={r.master_price_at_time} newVal={r.used_price} />
              </td>
              <td className="px-3 py-2 text-text-muted text-xs whitespace-nowrap">{r.created_at?.slice(0, 16)}</td>
              <td className="px-3 py-2 text-center">
                {DOC_ROUTES[r.source_type] && r.source_id && (
                  <button
                    onClick={e => { e.stopPropagation(); openDoc(r); }}
                    title="فتح المستند وتعديله"
                    className="p-1 rounded hover:bg-amber-200 text-amber-600 transition-colors"
                  >
                    <ExternalLink size={13} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────
function FilterBar({ filters, onChange, onClear }) {
  const [itemQuery, setItemQuery]     = useState("");
  const [itemResults, setItemResults] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const itemSearchRef = useRef(null);
  const fieldSelectRef = useRef(null);
  const sourceSelectRef = useRef(null);
  const fromDateRef = useRef(null);
  const toDateRef = useRef(null);
  const clearBtnRef = useRef(null);
  const handleKeyDown = useFieldNavigation();
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!filters.item_id) setItemQuery("");
  }, [filters.item_id]);

  function handleItemQueryChange(val) {
    setItemQuery(val);
    setActiveIndex(-1);
    if (!val.trim()) {
      setItemResults([]);
      setDropdownOpen(false);
      onChange("item_id", "");
      return;
    }
    setDropdownOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(val.trim())}&limit=20`)
        .then(r => setItemResults(r.data?.data ?? r.data?.rows ?? []))
        .catch(() => setItemResults([]));
    }, 250);
  }

  function handlePickItem(item) {
    setItemQuery(`${item.code || item.item_code || ""} ${item.name}`.trim());
    setItemResults([]);
    setDropdownOpen(false);
    onChange("item_id", item.id);
  }

  const hasFilters = filters.item_id || filters.field || filters.source || filters.from_date || filters.to_date;

  return (
    <div className="flex flex-wrap gap-2 items-center p-3 bg-bg-overlay border-b border-border-normal">
      {/* Item search — POS style */}
      <div className="relative">
        <Search size={13} className="absolute right-2.5 top-2.5 text-text-muted z-10" />
        <input
          ref={itemSearchRef}
          value={itemQuery}
          onChange={e => handleItemQueryChange(e.target.value)}
          onFocus={() => { if (itemResults.length) setDropdownOpen(true); }}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
          onKeyDown={e => {
            if (dropdownOpen && itemResults.length) {
              if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(v => Math.min(v + 1, itemResults.length - 1)); return; }
              if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIndex(v => Math.max(v - 1, -1)); return; }
              if (e.key === "Enter" && activeIndex >= 0) { e.preventDefault(); handlePickItem(itemResults[activeIndex]); return; }
              if (e.key === "Escape") { setDropdownOpen(false); return; }
            }
            handleKeyDown(e, { nextRef: fieldSelectRef });
          }}
          placeholder="بحث بالصنف أو الكود…"
          className="pr-7 pl-3 py-1.5 border border-border-normal rounded-lg text-sm w-52 bg-bg-surface"
        />
        {dropdownOpen && itemResults.length > 0 && (
          <SearchDropdown
            items={itemResults}
            onPick={handlePickItem}
            activeIndex={activeIndex}
            query={itemQuery}
          />
        )}
      </div>

      <select ref={fieldSelectRef} onKeyDown={e => handleKeyDown(e, { nextRef: sourceSelectRef, prevRef: itemSearchRef })} value={filters.field} onChange={e => onChange("field", e.target.value)}
        className="border border-border-normal rounded-lg px-2 py-1.5 text-sm bg-bg-surface">
        <option value="">كل الحقول</option>
        {Object.entries(FIELD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select ref={sourceSelectRef} onKeyDown={e => handleKeyDown(e, { nextRef: fromDateRef, prevRef: fieldSelectRef })} value={filters.source} onChange={e => onChange("source", e.target.value)}
        className="border border-border-normal rounded-lg px-2 py-1.5 text-sm bg-bg-surface">
        <option value="">كل المصادر</option>
        {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input ref={fromDateRef} onKeyDown={e => handleKeyDown(e, { nextRef: toDateRef, prevRef: sourceSelectRef })} type="date" value={filters.from_date} onChange={e => onChange("from_date", e.target.value)}
        className="border border-border-normal rounded-lg px-2 py-1.5 text-sm bg-bg-surface" />
      <input ref={toDateRef} onKeyDown={e => handleKeyDown(e, { nextRef: clearBtnRef, prevRef: fromDateRef })} type="date" value={filters.to_date} onChange={e => onChange("to_date", e.target.value)}
        className="border border-border-normal rounded-lg px-2 py-1.5 text-sm bg-bg-surface" />
      {hasFilters && (
        <button ref={clearBtnRef} onKeyDown={e => handleKeyDown(e, { prevRef: toDateRef })} onClick={onClear}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-text-secondary hover:text-red-500 rounded-lg border border-border-normal bg-bg-surface">
          <X size={12} /> مسح الفلتر
        </button>
      )}
    </div>
  );
}


// ── Price sparkline ───────────────────────────────────────────────────────────
function PriceSparkline({ label, points, currentVal }) {
  if (!points || points.length < 2) {
    return (
      <div className="bg-bg-surface border border-border-normal rounded-xl p-3">
        <p className="text-[11px] font-bold text-text-muted uppercase mb-1">{label}</p>
        <p className="text-xl number-fmt-primary text-text-primary">{fmt(currentVal)}</p>
        <p className="text-[11px] text-text-muted mt-1">تغيير واحد فقط</p>
      </div>
    );
  }
  const values = points.map(p => Number(p.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 200, H = 44;
  const step = W / (points.length - 1);
  const pathD = points.map((p, i) => {
    const x = i * step;
    const y = H - ((Number(p.value) - min) / range) * H * 0.85 - H * 0.075;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const isUp = values[values.length - 1] > values[0];
  const color = isUp ? "#e11d48" : "#059669";
  return (
    <div className="bg-bg-surface border border-border-normal rounded-xl p-3">
      <p className="text-[11px] font-bold text-text-muted uppercase mb-1">{label}</p>
      <p className="text-xl number-fmt-primary text-text-primary">{fmt(currentVal)}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10 mt-1" preserveAspectRatio="none">
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[9px] text-text-muted number-fmt mt-0.5">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}

// ── Product detail (right panel) ──────────────────────────────────────────────
function ProductDetail({ data }) {
  const { item, history, by_field } = data;

  // history arrives ASC. For BASELINE rows, correct new_value to the old_value of
  // the first real change for that field — so the timeline is internally consistent.
  const corrected = history.map(r => {
    if (r.operation_id !== "BASELINE") return r;
    const firstReal = history.find(h => h.field === r.field && h.operation_id !== "BASELINE");
    return firstReal ? { ...r, new_value: firstReal.old_value } : r;
  });

  const sorted = [...corrected].reverse();
  return (
    <div className="p-5 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-border-normal">
        <div>
          <span className="font-mono text-xs font-black text-indigo-700">{item.code || "—"}</span>
          <h2 className="text-lg font-black text-text-primary mt-0.5">{item.name}</h2>
          <span className="text-[11px] text-text-muted">{sorted.length} سجل</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            to={`/operations/items/${item.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-black text-indigo-700 hover:bg-indigo-100"
          >
            <ExternalLink size={13} />
            عرض كامل
          </Link>
          {[["سعر البيع", item.sale_price], ["سعر الشراء", item.purchase_price], ["سعر الجملة", item.wholesale_price]].map(([label, val]) => (
            <div key={label} className="text-center">
              <p className="text-[11px] text-text-muted font-bold">{label}</p>
              <p className="text-xl number-fmt-primary text-text-primary">{fmt(val)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sparklines — built from corrected history */}
      {corrected.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(FIELD_LABELS).map(([field]) => {
            const pts = corrected
              .filter(r => r.field === field)
              .map(r => ({ date: r.changed_at, value: r.new_value, op: r.operation_id }));
            if (!pts.length) return null;
            return (
              <PriceSparkline key={field} label={FIELD_LABELS[field]} points={pts} currentVal={item[field] ?? 0} />
            );
          }).filter(Boolean)}
        </div>
      )}

      {/* History table */}
      <div>
        <p className="text-[11px] font-bold text-text-muted uppercase mb-2">سجل التغييرات</p>
        <div className="overflow-x-auto rounded-xl border border-border-normal">
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="bg-bg-overlay text-text-secondary text-[11px] uppercase font-bold">
                <th className="px-3 py-2">التاريخ</th>
                <th className="px-3 py-2">الحقل</th>
                <th className="px-3 py-2">قبل</th>
                <th className="px-3 py-2">بعد</th>
                <th className="px-3 py-2">التغيير</th>
                <th className="px-3 py-2">المصدر</th>
                <th className="px-3 py-2">المستخدم</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-text-muted text-sm">لا توجد سجلات</td></tr>
              ) : sorted.map(r => {
                const isBaseline = r.operation_id === "BASELINE";
                return (
                  <tr key={r.id} className={`border-b border-border-subtle transition-colors ${isBaseline ? "bg-bg-overlay/60 hover:bg-bg-overlay/60" : "hover:bg-bg-overlay"}`}>
                    <td className={`px-3 py-2 text-xs whitespace-nowrap ${isBaseline ? "text-text-muted italic" : "text-text-muted"}`}>
                      {isBaseline ? "عند الإنشاء" : r.changed_at?.slice(0, 16)}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{FIELD_LABELS[r.field] ?? r.field}</td>
                    <td className={`px-3 py-2 number-fmt ${isBaseline ? "text-text-muted" : "text-text-secondary"}`}>{fmt(r.old_value)}</td>
                    <td className={`px-3 py-2 number-fmt ${isBaseline ? "text-text-secondary" : "text-text-primary"}`}>{fmt(r.new_value)}</td>
                    <td className="px-3 py-2">
                      {isBaseline
                        ? <span className="text-[11px] text-text-muted italic">—</span>
                        : <DiffChip oldVal={r.old_value} newVal={r.new_value} />}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        label={isBaseline ? "إنشاء الصنف" : (SOURCE_LABELS[r.source] ?? r.source ?? "—")}
                        colorClass={isBaseline ? "bg-bg-overlay text-text-muted" : SOURCE_COLORS[r.source]}
                      />
                    </td>
                    <td className="px-3 py-2 text-text-muted text-xs">{r.changed_by_username ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const LIST_LIMIT = 20;

// ── Product view (split panel) ────────────────────────────────────────────────
function ProductView() {
  const [search, setSearch]           = useState("");
  const [categoryId, setCategoryId]   = useState("");
  const [categories, setCategories]   = useState([]);
  const [products, setProducts]       = useState([]);
  const [total, setTotal]             = useState(0);
  const [listPage, setListPage]       = useState(1);
  const [selectedId, setSelectedId]   = useState(null);
  const [productData, setProductData] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const searchRef = useRef(null);
  const categorySelectRef = useRef(null);
  const handleKeyDown = useFieldNavigation();
  const debounceRef = useRef(null);

  // load categories once
  useEffect(() => {
    api.get("/api/categories").then(r => setCategories(r.data.data ?? [])).catch(() => {});
  }, []);

  // reset to page 1 on filter change
  useEffect(() => { setListPage(1); }, [search, categoryId]);

  // fetch product list
  useEffect(() => {
    setLoadingList(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.get("/api/pricing/product-list", {
        params: { search: search.trim(), category_id: categoryId || undefined, page: listPage, limit: LIST_LIMIT },
      }).then(r => {
        if (r.data.success) { setProducts(r.data.data); setTotal(r.data.total ?? 0); }
      }).catch(() => {}).finally(() => setLoadingList(false));
    }, search ? 250 : 0);
  }, [search, categoryId, listPage]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingDetail(true);
    setProductData(null);
    api.get(`/api/pricing/history/${selectedId}`)
      .then(r => { if (r.data.success) setProductData(r.data.data); })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  const pages = Math.ceil(total / LIST_LIMIT);

  return (
    <div className="flex flex-1 overflow-hidden" dir="rtl">
      {/* Left: product list */}
      <div className="w-72 shrink-0 border-l border-border-normal flex flex-col bg-bg-overlay">
        {/* Filters */}
        <div className="p-2.5 border-b border-border-normal space-y-2">
          <div className="relative">
            <Search size={13} className="absolute right-2.5 top-2.5 text-text-muted" />
            <input ref={searchRef} onKeyDown={e => handleKeyDown(e, { nextRef: categorySelectRef })} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الكود…"
              className="w-full pr-7 pl-3 py-1.5 border border-border-normal rounded-lg text-sm bg-bg-surface" />
          </div>
          <select ref={categorySelectRef} onKeyDown={e => handleKeyDown(e, { prevRef: searchRef })} value={categoryId} onChange={e => setCategoryId(e.target.value)}
            className="w-full border border-border-normal rounded-lg px-2 py-1.5 text-sm bg-bg-surface text-text-secondary">
            <option value="">كل الأقسام</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto">
          {loadingList ? (
            <div className="py-8 text-center text-text-muted text-sm animate-pulse">جارٍ التحميل…</div>
          ) : products.length === 0 ? (
            <div className="py-8 text-center text-text-muted text-sm">لا توجد أصناف</div>
          ) : products.map(p => (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              className={`w-full text-right px-4 py-3 border-b border-border-subtle transition-colors flex items-start justify-between gap-2 ${
                selectedId === p.id ? "bg-bg-surface border-r-[3px] border-r-indigo-500" : "hover:bg-bg-surface"
              }`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-text-primary truncate leading-tight">{p.name}</p>
                <p className="text-[11px] font-mono font-black text-indigo-600">{p.code || "—"}</p>
                {p.category_name && <p className="text-[11px] text-text-muted truncate">{p.category_name}</p>}
                <p className="text-[11px] text-text-muted mt-0.5">{p.latest_change?.slice(0, 10)}</p>
              </div>
              <span className="text-[11px] text-text-muted shrink-0 mt-0.5 whitespace-nowrap">{p.change_count} تغيير</span>
            </button>
          ))}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="border-t border-border-normal flex items-center justify-between px-3 py-2 bg-bg-surface">
            <button onClick={() => setListPage(p => Math.max(1, p - 1))} disabled={listPage <= 1}
              className="p-1 rounded hover:bg-bg-overlay disabled:opacity-30 text-text-secondary">
              <ChevronRight size={14} />
            </button>
            <span className="text-[11px] text-text-muted">{listPage} / {pages}</span>
            <button onClick={() => setListPage(p => Math.min(pages, p + 1))} disabled={listPage >= pages}
              className="p-1 rounded hover:bg-bg-overlay disabled:opacity-30 text-text-secondary">
              <ChevronLeft size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Right: product detail */}
      <div className="flex-1 overflow-auto">
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
            <Activity size={36} className="opacity-20" />
            <p className="text-sm font-bold">اختر صنفاً من القائمة لعرض سجل أسعاره</p>
          </div>
        ) : loadingDetail ? (
          <div className="py-16 text-center text-text-muted text-sm animate-pulse">جارٍ التحميل…</div>
        ) : productData ? (
          <ProductDetail data={productData} />
        ) : null}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const EMPTY_FILTERS = { item_id: "", field: "", source: "", from_date: "", to_date: "" };

export default function PriceHistoryTab() {
  const [subTab, setSubTab]       = useState("product"); // "product" | "master" | "overrides"
  const [analytics, setAnalytics] = useState(null);
  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [filters, setFilters]     = useState(EMPTY_FILTERS);

  const fetchAnalytics = useCallback(async () => {
    try {
      const { data } = await api.get("/api/pricing/analytics");
      if (data.success) setAnalytics(data.data);
    } catch (_) {}
  }, []);

  const fetchRows = useCallback(async () => {
    if (subTab === "product") return;
    setLoading(true);
    try {
      const endpoint = subTab === "master" ? "/api/pricing/history" : "/api/pricing/overrides";
      const params = { ...filters, page, limit: 50 };
      const { data } = await api.get(endpoint, { params });
      if (data.success) {
        setRows(data.data ?? data.rows ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (_) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [subTab, filters, page]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);
  useEffect(() => { setPage(1); }, [subTab, filters]);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleFilterChange = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Analytics cards */}
      <div className="p-4 border-b border-border-normal bg-bg-overlay">
        <AnalyticsCards analytics={analytics} />

        {/* Sub-tabs */}
        <div className="flex gap-1 mt-2">
          <button onClick={() => setSubTab("product")}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              subTab === "product"
                ? "bg-indigo-600 text-white"
                : "bg-bg-surface border border-border-normal text-text-secondary hover:bg-indigo-50"
            }`}>
            تتبع صنف
          </button>
          <button onClick={() => setSubTab("master")}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              subTab === "master"
                ? "bg-primary text-white"
                : "bg-bg-surface border border-border-normal text-text-secondary hover:bg-bg-overlay"
            }`}>
            كل التغييرات
          </button>
          <button onClick={() => setSubTab("overrides")}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              subTab === "overrides"
                ? "bg-amber-600 text-white"
                : "bg-bg-surface border border-border-normal text-text-secondary hover:bg-amber-50"
            }`}>
            تجاوزات الفواتير
          </button>
          {subTab === "master" || subTab === "overrides" ? (
            <button onClick={fetchRows}
              className="mr-auto p-1.5 rounded-lg border border-border-normal bg-bg-surface hover:bg-bg-overlay text-text-secondary">
              <RefreshCcw size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {subTab === "product" ? (
        <ProductView />
      ) : (
        <>
          {/* Filter bar */}
          <FilterBar filters={filters} onChange={handleFilterChange} onClear={clearFilters} />

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {subTab === "master"
              ? <HistoryTable rows={rows} loading={loading} />
              : <OverridesTable rows={rows} loading={loading} />}
          </div>

          {/* Pagination */}
          <div className="border-t border-border-normal bg-bg-surface">
            <Pagination page={page} total={total} limit={50} onPage={setPage} />
            <div className="px-4 py-1.5 text-[11px] text-text-muted text-center">
              {total} سجل
            </div>
          </div>
        </>
      )}
    </div>
  );
}
