import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useShortcut } from "../../shortcuts/useShortcut";
import ShortcutKbd, { shortcutLabel } from "../../shortcuts/ShortcutKbd";
import {
  ArrowUpDown, 
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  GripVertical, 
  Layers, 
  Plus, 
  Save, 
  Search, 
  Shapes, 
  Trash2, 
  Upload,
  X,
  Package,
  Activity,
  Archive,
  AlertTriangle,
  Monitor,
  Eye,
  Filter,
  RefreshCw,
  Box,
  Tags,
  BadgeDollarSign,
  TrendingDown,
  TrendingUp,
  Columns,
  RotateCcw,
  Pencil
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import ImageUpload from "../../components/ui/ImageUpload";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import Highlight from "../../components/ui/Highlight";
import PermissionGate from "../../components/ui/PermissionGate";
import { useFeatureEnabled } from "../../hooks/useFeature";
import ItemUnitsSection from "../../components/items/ItemUnitsSection";
import VariantsSection from "../../components/items/VariantsSection";
import { formatNumber } from "../../utils/currency";

const ItemExportModal = React.lazy(() => import("./ItemExportModal"));
const ItemQuickAddModal = React.lazy(() => import("./ItemFormModal"));

// ─── pure helpers ─────────────────────────────────────────────────────────────

function parseImageUrls(text) {
  return String(text || "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
}

function marginInfo(purchase, sale, threshold = 15) {
  const p = Number(purchase || 0);
  const s = Number(sale || 0);
  if (!p || !s) return null;
  const pct = ((s - p) / p) * 100;
  const belowThreshold = pct < threshold;
  return {
    pct,
    label: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
    cls: !belowThreshold ? "text-emerald-500 bg-emerald-50" : pct >= 5 ? "text-amber-500 bg-amber-50" : "text-rose-500 bg-rose-50",
    belowThreshold,
  };
}

function stockBadge(qty, minQty) {
  const q = Number(qty ?? 0);
  const m = Number(minQty ?? 0);
  if (q === 0)        return { label: "نفد",  cls: "bg-rose-500 text-white shadow-rose-200" };
  if (m > 0 && q < m) return { label: q,     cls: "bg-amber-500 text-white shadow-amber-200" };
  return               { label: q,           cls: "bg-primary text-white shadow-slate-200" };
}

function formatMoney(v) {
  return formatNumber(v);
}

function exportCsv(items, categoryName) {
  const header = ["الكود","الاسم","الباركود","الوحدة","سعر الشراء","بيع المستهلك","بيع الجملة","المخزون"];
  const rows = items.map((i) => [
    i.code || "", i.name || "", i.barcode || "", i.unit_name || "",
    i.purchase_price ?? 0, i.sale_price ?? 0, i.wholesale_price ?? 0, i.stock_quantity ?? 0,
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `أصناف-${categoryName || "فئة"}.csv`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}


const EMPTY_DRAFT = {
  code: "", name: "", barcode: "", purchase_price: "", sale_price: "",
  wholesale_price: "", unit_id: "", min_stock_qty: "", image_urls_text: "",
  track_expiry: false,
};

const DENSITY_CLS = { compact: "py-1.5", normal: "py-2.5", spacious: "py-4" };
const ITEM_PAGE_SIZE = 100;
// Sentinel for the "show all products across every category" filter mode.
// In this mode the catalog is read-only — new items cannot be created because
// they have no category to belong to.
const ALL_CATEGORIES = "all";

// ─── Cell input ───────────────────────────────────────────────────────────────
const Cell = React.forwardRef(function Cell(
  { value, onChange, onBlur, onFocus, onKeyDown, type = "text", placeholder = "", disabled = false, className = "", dirty = false },
  ref,
) {
  return (
    <input ref={ref} type={type} value={value} onChange={onChange} onBlur={onBlur} onFocus={onFocus} onKeyDown={onKeyDown}
      placeholder={placeholder} disabled={disabled}
      min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined}
      className={`w-full bg-transparent px-2 py-1.5 text-sm font-bold outline-none border border-transparent transition-all
        focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 hover:border-slate-300
        disabled:cursor-not-allowed disabled:text-slate-400 rounded-sm
        ${dirty ? "bg-amber-50/50" : ""}
        ${className}`}
    />
  );
});

const UnitSelect = React.forwardRef(function UnitSelect({ value, onChange, onBlur, units, disabled = false, dirty = false, onKeyDown }, ref) {
  return (
    <select ref={ref} value={value} onChange={onChange} onBlur={onBlur} disabled={disabled} onKeyDown={onKeyDown}
      className={`w-full bg-transparent px-1.5 py-1.5 text-sm font-black outline-none border border-transparent transition-all rounded-sm
        focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 hover:border-slate-300
        disabled:cursor-not-allowed
        ${dirty ? "bg-amber-50/50" : ""}`}>
      <option value="">— وحدة —</option>
      {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  );
});

function SkeletonRows({ cols }) {
  return Array.from({ length: 10 }).map((_, i) => (
    <tr key={i} className="border-b border-slate-50">
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j} className="px-2 py-3">
          <div className="h-6 animate-pulse rounded-sm bg-slate-100" />
        </td>
      ))}
    </tr>
  ));
}

function ActiveToggle({ active, onToggle }) {
  return (
    <button type="button" onClick={onToggle} title={active ? "نشط" : "موقف"}
      className={`relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors shadow-sm
        ${active ? "bg-emerald-500 hover:bg-emerald-600" : "bg-slate-300 hover:bg-slate-400"}`} dir="ltr">
      <span className={`inline-block h-[14px] w-[14px] transform rounded-full bg-white shadow-md transition-transform ${active ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function SaveAllBar({ count, onSaveAll, onDiscard }) {
  if (!count) return null;
  return (
    <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 flex items-center gap-6 rounded-sm border border-amber-200 bg-amber-50 px-6 py-4 shadow-2xl animate-in slide-in-from-bottom-8">
      <div className="flex flex-col">
         <span className="text-sm font-black text-amber-900">{count} تعديلات معلقة</span>
         <span className="text-[11px] font-bold text-amber-600 uppercase tracking-widest">تأكد من الحفظ قبل مغادرة الصفحة</span>
      </div>
      <div className="flex gap-2">
         <button onClick={onSaveAll}
           className="flex items-center gap-2 rounded-sm bg-amber-600 px-6 py-2 text-2sm font-black text-white hover:bg-amber-700 shadow-md transition-all active:scale-95">
           <Check className="h-4 w-4" /> حفظ الكل
         </button>
         <button onClick={onDiscard}
           className="flex items-center gap-2 rounded-sm border border-amber-200 bg-white px-4 py-2 text-2sm font-bold text-amber-700 hover:bg-amber-100 transition-all">
           <X className="h-3.5 w-3.5" /> تجاهل
         </button>
      </div>
    </div>
  );
}

function BulkBar({ count, categories, units, onDelete, onMove, onPriceChange, onUnitChange, onClear }) {
  const [moveCat, setMoveCat] = useState("");
  const [showMove, setShowMove] = useState(false);
  const [showPrice, setShowPrice] = useState(false);
  const [showUnit, setShowUnit] = useState(false);
  const [priceField, setPriceField] = useState("sale_price");
  const [priceType, setPriceType] = useState("pct"); // pct | fixed
  const [priceVal, setPriceVal] = useState("");
  const [unitVal, setUnitVal] = useState("");

  if (!count) return null;

  return (
    <div className="fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 flex flex-wrap items-center gap-4 rounded-sm border border-slate-800 bg-slate-900 px-6 py-4 shadow-2xl animate-in zoom-in-95" dir="rtl">
      <div className="flex flex-col border-l border-white/10 pl-6 shrink-0">
         <span className="text-sm font-black text-white">تم تحديد {count} صنف</span>
         <span className="text-[11px] font-bold text-slate-400 tracking-tighter uppercase">عمليات على مجموعة مختارة</span>
      </div>

      <div className="flex items-center gap-2">
         <button onClick={onDelete}
           className="flex items-center gap-2 rounded-sm bg-rose-600 px-4 py-2 text-2sm font-black text-white hover:bg-rose-700 transition-all">
           <Trash2 className="h-4 w-4" /> حذف المجلد
         </button>

         <div className="relative">
           <button onClick={() => { setShowMove((p) => !p); setShowPrice(false); }}
             className="flex items-center gap-2 rounded-sm border border-white/20 bg-white/5 px-4 py-2 text-2sm font-black text-white hover:bg-white/10 transition-all">
             <Layers className="h-4 w-4" /> نقل لفئة
           </button>
           {showMove && (
             <div className="absolute bottom-12 right-0 z-[70] flex flex-col gap-2 rounded-sm border border-slate-200 bg-white p-3 shadow-xl min-w-[220px]">
               <span className="text-[11px] font-black uppercase text-slate-400">نقل إلى المجلد الرئيسي</span>
               <select value={moveCat} onChange={(e) => setMoveCat(e.target.value)}
                 className="w-full rounded-sm border border-slate-200 px-2 py-2 text-2sm font-bold">
                 <option value="">اختر فئة...</option>
                 {categories.map((c) => <option key={c.id} value={c.id}>{c.sku_prefix ? `${c.sku_prefix} — ` : ""}{c.name}</option>)}
               </select>
               <button onClick={() => { if (moveCat) { onMove(Number(moveCat)); setShowMove(false); setMoveCat(""); } }}
                 disabled={!moveCat}
                 className="w-full rounded-sm bg-primary px-3 py-2 text-2sm font-black text-white disabled:opacity-40 hover:bg-primary-600">
                 نقل الآن
               </button>
             </div>
           )}
         </div>

         <div className="relative">
           <button onClick={() => { setShowPrice((p) => !p); setShowMove(false); setShowUnit(false); }}
             className="flex items-center gap-2 rounded-sm border border-white/20 bg-white/5 px-4 py-2 text-2sm font-black text-white hover:bg-white/10 transition-all">
             <ArrowUpDown className="h-4 w-4" /> تعديل الأسعار
           </button>
           {showPrice && (
             <div className="absolute bottom-12 right-0 z-[70] flex flex-col gap-3 rounded-sm border border-slate-200 bg-white p-4 shadow-xl min-w-[300px]">
               <div className="space-y-1">
                  <span className="text-[11px] font-black uppercase text-slate-400">تعديل الحقل المالي</span>
                  <select value={priceField} onChange={(e) => setPriceField(e.target.value)}
                    className="w-full rounded-sm border border-slate-200 px-2 py-2 text-2sm font-bold">
                    <option value="sale_price">سعر بيع المستهلك</option>
                    <option value="wholesale_price">سعر بيع الجملة</option>
                    <option value="purchase_price">سعر الشراء</option>
                  </select>
               </div>
               <div className="flex gap-2">
                 <select value={priceType} onChange={(e) => setPriceType(e.target.value)}
                   className="w-24 rounded-sm border border-slate-200 px-2 py-2 text-2sm font-bold">
                   <option value="pct">نسبة %</option>
                   <option value="fixed">مبلغ ثابت</option>
                 </select>
                 <input type="number" step="0.01" value={priceVal} onChange={(e) => setPriceVal(e.target.value)}
                   placeholder={priceType === "pct" ? "مثال: 10" : "0.00"}
                   className="flex-1 rounded-sm border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-slate-800" />
               </div>
               <button onClick={() => { if (priceVal) { onPriceChange(priceField, priceType, Number(priceVal)); setShowPrice(false); setPriceVal(""); } }}
                 disabled={!priceVal}
                 className="w-full rounded-sm bg-primary px-3 py-2.5 text-2sm font-black text-white disabled:opacity-40 hover:bg-primary-600 transition-all shadow-md">
                 تطبيق الحسبة المالية
               </button>
             </div>
           )}
         </div>

         <div className="relative">
           <button onClick={() => { setShowUnit((p) => !p); setShowMove(false); setShowPrice(false); }}
             className="flex items-center gap-2 rounded-sm border border-white/20 bg-white/5 px-4 py-2 text-2sm font-black text-white hover:bg-white/10 transition-all">
             <Layers className="h-4 w-4" /> تغيير الوحدة
           </button>
           {showUnit && (
             <div className="absolute bottom-12 right-0 z-[70] flex flex-col gap-2 rounded-sm border border-slate-200 bg-white p-3 shadow-xl min-w-[220px]">
               <span className="text-[11px] font-black uppercase text-slate-400">تغيير وحدة القياس</span>
               <select value={unitVal} onChange={(e) => setUnitVal(e.target.value)}
                 className="w-full rounded-sm border border-slate-200 px-2 py-2 text-2sm font-bold">
                 <option value="">اختر وحدة...</option>
                 {(units || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
               </select>
               <button onClick={() => { if (unitVal) { onUnitChange(Number(unitVal)); setShowUnit(false); setUnitVal(""); } }}
                 disabled={!unitVal}
                 className="w-full rounded-sm bg-primary px-3 py-2 text-2sm font-black text-white disabled:opacity-40 hover:bg-primary-600">
                 تطبيق
               </button>
             </div>
           )}
         </div>
      </div>

      <button onClick={onClear}
        className="flex h-9 w-9 items-center justify-center rounded-sm bg-white/10 text-white hover:bg-white/20 transition-all"
        title="إغلاق وإلغاء التحديد">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function CalcPopover({ purchasePrice, onApply }) {
  const [margin, setMargin] = useState("");
  const computed = useMemo(() => {
    const p = Number(purchasePrice || 0);
    const m = Number(margin || 0);
    if (!p || !m) return null;
    return (p * (1 + m / 100)).toFixed(2);
  }, [purchasePrice, margin]);

  return (
    <div className="w-[260px] rounded-lg border border-slate-200 bg-white p-4 shadow-[0_10px_40px_rgba(0,0,0,0.15)] animate-in zoom-in-95 origin-top" dir="rtl">
      <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
         <span className="text-[11px] font-black uppercase text-slate-400">احتساب الربحية</span>
         <BadgeDollarSign className="h-3.5 w-3.5 text-emerald-500" />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-2sm font-bold text-slate-500">هامش الربح</span>
        <div className="relative flex-1">
           <input type="number" value={margin} onChange={(e) => setMargin(e.target.value)} placeholder="0"
             className="w-full rounded-sm border border-slate-200 py-1.5 pl-2 pr-6 text-sm font-black text-slate-800 outline-none focus:border-emerald-600" autoFocus />
           <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2sm font-bold text-slate-400">%</span>
        </div>
      </div>
      {computed && (
        <div className="mt-4 flex items-center justify-between gap-3 bg-emerald-50/50 p-2 rounded-sm border border-emerald-100/50">
          <div className="flex flex-col">
             <span className="text-[9px] font-black text-emerald-600 uppercase">سعر البيع المقترح</span>
             <span className="text-[15px] font-black text-emerald-800">{computed}</span>
          </div>
          <button onClick={() => onApply(computed)}
            className="flex h-8 items-center gap-1.5 rounded-sm bg-emerald-600 px-3 text-[11px] font-black text-white hover:bg-emerald-700 shadow-md">
            تطبيق
          </button>
        </div>
      )}
    </div>
  );
}

function SortTh({ label, sortKey, sortConfig, onSort, width, onResizeStart, resizableKey, className = "" }) {
  const active = sortConfig.key === sortKey;
  return (
    <th 
      className={`relative select-none px-4 py-3 text-right text-[11px] font-black uppercase text-slate-500 hover:text-slate-900 transition-colors ${className}`}
      style={{ width: width ? `${width}px` : undefined, minWidth: width ? `${width}px` : undefined, maxWidth: width ? `${width}px` : undefined }}
    >
      <div className="inline-flex items-center gap-1 cursor-pointer" onClick={() => onSort(sortKey)}>
        {label}
        {active
          ? sortConfig.dir === "asc" ? <ChevronUp className="h-3 w-3 text-slate-900" /> : <ChevronDown className="h-3 w-3 text-slate-900" />
          : <ArrowUpDown className="h-3 w-3 opacity-20 group-hover:opacity-100" />}
      </div>
      {resizableKey && onResizeStart && (
        <div 
          onMouseDown={(e) => onResizeStart(e, resizableKey)}
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-400 z-10 transition-colors"
        />
      )}
    </th>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ItemsListPage() {
  usePageTour("items");

  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkQuery = searchParams.get("q") || "";

  const [globalMinMargin, setGlobalMinMargin] = useState(15);
  const [categories, setCategories]   = useState([]);
  const [units, setUnits]             = useState([]);
  const [items, setItems]             = useState([]);
  const [itemsMeta, setItemsMeta]     = useState({ total: 0, offset: 0, hasMore: false });
  const [page, setPage]               = useState(1);
  const pageRef                       = useRef(1);
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [search, setSearch]           = useState(deepLinkQuery);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingRowId, setSavingRowId] = useState(null);
  const [draftById, setDraftById]     = useState({});
  const [dirtyRows, setDirtyRows]     = useState(new Set());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [newRow, setNewRow]           = useState(EMPTY_DRAFT);
  const [showDeleted, setShowDeleted]     = useState(false);
  const [showSkuGaps, setShowSkuGaps]     = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  // Feature-driven per-item managers (shown on the catalog only when the flag is on)
  const multiUnitEnabled = useFeatureEnabled("feature_multi_unit");
  const variantsEnabled = useFeatureEnabled("feature_variants");
  const serialsEnabled = useFeatureEnabled("feature_serials");
  const goldEnabled = useFeatureEnabled("feature_gold");
  const scaleEnabled = useFeatureEnabled("feature_scale_barcodes");
  const expiryEnabled = useFeatureEnabled("feature_expiry");
  const anyItemFeature = multiUnitEnabled || variantsEnabled || serialsEnabled || goldEnabled || scaleEnabled;
  const [unitsItem, setUnitsItem] = useState(null);
  const [variantsItem, setVariantsItem] = useState(null);
  const [editFullItem, setEditFullItem] = useState(null);
  const navigate = useNavigate();
  const [exportOpen, setExportOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  // sort
  const [sortConfig, setSortConfig]   = useState({ key: null, dir: "asc" });
  // density
  const [density, setDensity]         = useState(() => localStorage.getItem("items_density") || "normal");
  // calc popover: { itemId, field } | null
  const [calcAnchor, setCalcAnchor]   = useState(null);
  const focusedPriceCellRef = useRef(null);
  // drag
  const [dragOverId, setDragOverId]   = useState(null);
  const dragItemId                    = useRef(null);
  // profit display mode: "number" or "percentage"
  const [profitMode, setProfitMode]   = useState(() => localStorage.getItem("items_profit_mode") || "percentage");

  // Column resizing state & handlers
  const [colWidths, setColWidths] = useState({
    code: 90,
    name: 240,
    unit: 100,
    barcode: 130,
    purchase_price: 100,
    sale_price: 110,
    wholesale_price: 110,
    min_stock_qty: 80,
    margin: 70,
    stock_quantity: 80,
  });

  const resizingCol = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onResizeStart = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = key;
    startX.current = e.clientX;
    startWidth.current = colWidths[key] || 100;
    
    document.body.classList.add("cursor-col-resize", "select-none");

    const onMouseMove = (moveEvent) => {
      if (!resizingCol.current) return;
      // Right to left layout means moving left (smaller X) increases width.
      const diff = startX.current - moveEvent.clientX; 
      const newWidth = Math.max(startWidth.current + diff, 60); 
      setColWidths(prev => ({ ...prev, [resizingCol.current]: newWidth }));
    };

    const onMouseUp = () => {
      resizingCol.current = null;
      document.body.classList.remove("cursor-col-resize", "select-none");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleKeyDown = useFieldNavigation();
  const searchRef = useRef(null);
  const catSelectRef = useRef(null);
  const nameInputRef = useRef(null);
  const unitSelectRef = useRef(null);
  const barcodeRef = useRef(null);
  const purchasePriceRef = useRef(null);
  const salePriceRef = useRef(null);
  const wholesalePriceRef = useRef(null);
  const minStockQtyRef = useRef(null);
  const addItemBtnRef = useRef(null);
  const catNameRef = useRef(null);
  const catSubmitRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const bottomScrollRef = useRef(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  // ── loaders ──────────────────────────────────────────────────────────────

  const loadCategories = useCallback(async () => {
    const res = await api.get("/api/categories");
    const rows = Array.isArray(res.data?.data) ? res.data.data : [];
    setCategories(rows);
    return rows;
  }, []);

  const loadUnits = useCallback(async () => {
    try {
      const res = await api.get("/api/units");
      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      setUnits(rows);
      return rows;
    } catch { return []; }
  }, []);

  const loadItems = useCallback(async (categoryId, searchText = "", inclDeleted = false, opts = {}) => {
    const trimmedSearch = searchText.trim();
    // Default to the current page's offset so post-mutation reloads keep the
    // user on the same page; navigation/reset callers pass an explicit offset.
    const offset = opts.offset != null ? Number(opts.offset) : (pageRef.current - 1) * ITEM_PAGE_SIZE;
    const append = Boolean(opts.append);
    const isAllCategories = categoryId === ALL_CATEGORIES;
    if (!categoryId && !trimmedSearch) {
      setItems([]);
      setItemsMeta({ total: 0, offset: 0, hasMore: false });
      return;
    }
    const params = { limit: ITEM_PAGE_SIZE, offset };
    if (categoryId && !isAllCategories) params.category_id = categoryId;
    if (trimmedSearch) params.search = trimmedSearch;
    if (inclDeleted) params.include_deleted = "1";
    const res = await api.get("/api/items", { params });
    const rows = Array.isArray(res.data?.data) ? res.data.data : [];
    const meta = res.data?.meta || {};
    setItems((prev) => append ? [...prev, ...rows.filter((row) => !prev.some((item) => item.id === row.id))] : rows);
    setItemsMeta({
      total: Number(meta.total ?? rows.length),
      offset: offset + rows.length,
      hasMore: Boolean(meta.has_more),
    });
    setDraftById((prev) => {
      const next = append ? { ...prev } : {};
      rows.forEach((row) => {
        next[row.id] = {
          name: row.name || "",
          barcode: row.barcode || "",
          purchase_price: String(row.purchase_price ?? ""),
          sale_price: String(row.sale_price ?? ""),
          wholesale_price: String(row.wholesale_price ?? ""),
          unit_id: String(row.unit_id ?? ""),
          min_stock_qty: String(row.min_stock_qty ?? ""),
          image_urls_text: Array.isArray(row.image_urls) ? row.image_urls.join(", ") : "",
          is_active: row.is_active !== 0,
          track_expiry: row.track_expiry === 1 || row.track_expiry === true,
        };
      });
      return next;
    });
    if (!append) {
      setDirtyRows(new Set());
      setSelectedIds(new Set());
      setSortConfig({ key: null, dir: "asc" });
    }
  }, []);

  useEffect(() => {
    api.get("/api/settings").then(r => {
      const v = r.data?.data?.min_margin_percent;
      if (v != null) setGlobalMinMargin(Number(v));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadCategories(), loadUnits()])
      .then(([cats, unitRows]) => {
        const firstId = cats[0]?.id ?? null;
        setSelectedCatId(firstId);
        if (unitRows[0]?.id) setNewRow((prev) => ({ ...prev, unit_id: String(unitRows[0].id) }));
        // If arriving from global search with a ?q= param, search across ALL categories
        if (deepLinkQuery) {
          return loadItems(null, deepLinkQuery, showDeleted)
            .then(() => setSearchParams({}, { replace: true }));
        }
        return loadItems(firstId);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCategories, loadUnits, loadItems]);

  useEffect(() => {
    if (!loading) { setSearch(""); setPage(1); pageRef.current = 1; loadItems(selectedCatId, "", showDeleted, { offset: 0 }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCatId, showDeleted]);

  useShortcut("items.new", () => { if (selectedCatId) setQuickAddOpen(true); });
  useShortcut("items.search", () => { searchRef.current?.focus(); searchRef.current?.select(); });
  useShortcut("items.refresh", () => loadItems(selectedCatId, search, showDeleted));
  useShortcut("items.calculator", () => {
    const target = focusedPriceCellRef.current;
    if (target) setCalcAnchor(target);
    else toast("ضع المؤشر في خانة سعر البيع ثم اضغط الاختصار");
  });

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCatId) ?? null,
    [categories, selectedCatId],
  );

  // "Show all products" view: read-only — creating items is disabled here.
  const isAllCats = selectedCatId === ALL_CATEGORIES;

  // ── sort ──────────────────────────────────────────────────────────────────

  const displayItems = useMemo(() => {
    let list = [...items];
    if (sortConfig.key) {
      list.sort((a, b) => {
        const av = a[sortConfig.key] ?? "";
        const bv = b[sortConfig.key] ?? "";
        const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv), "ar");
        return sortConfig.dir === "asc" ? cmp : -cmp;
      });
    }
    return { rows: list, total: itemsMeta.total || list.length, loaded: list.length };
  }, [items, itemsMeta.total, sortConfig]);

  const skuGapRows = useMemo(() => {
    if (!selectedCategory?.sku_prefix) return [];
    const prefix = String(selectedCategory.sku_prefix);
    const used = new Set();
    let max = 0;
    items.forEach((item) => {
      const match = String(item.code || "").match(/^(\d+)\.(\d+)$/);
      if (!match || match[1] !== prefix) return;
      const sequence = Number(match[2]);
      if (!Number.isInteger(sequence) || sequence <= 0) return;
      used.add(sequence);
      if (sequence > max) max = sequence;
    });
    const gaps = [];
    for (let sequence = 1; sequence < max; sequence += 1) {
      if (!used.has(sequence)) gaps.push({ __gap: true, id: `gap-${prefix}.${sequence}`, code: `${prefix}.${sequence}` });
    }
    return gaps;
  }, [items, selectedCategory]);

  const tableRows = useMemo(() => {
    if (!showSkuGaps || !skuGapRows.length) return displayItems.rows;
    return [...displayItems.rows, ...skuGapRows].sort((a, b) => String(a.code || "").localeCompare(String(b.code || ""), "ar", { numeric: true }));
  }, [displayItems.rows, showSkuGaps, skuGapRows]);

  // Measure table scrollable width for bottom scrollbar sync
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const measure = () => setTableScrollWidth(el.scrollWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tableRows]);

  const selectedItemsForExport = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  function toggleSort(key) {
    setSortConfig((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  const totalPages = Math.max(1, Math.ceil((itemsMeta.total || 0) / ITEM_PAGE_SIZE));

  async function goToPage(target) {
    const next = Math.min(Math.max(1, target), totalPages);
    if (next === page || loadingMore) return;
    setPage(next);
    pageRef.current = next;
    setLoadingMore(true);
    try {
      await loadItems(selectedCatId, search, showDeleted, { offset: (next - 1) * ITEM_PAGE_SIZE });
      scrollContainerRef.current?.scrollTo({ top: 0 });
    } finally {
      setLoadingMore(false);
    }
  }

  const stats = useMemo(() => {
     const active = items.filter(i => i.is_active !== 0).length;
     const lowStock = items.filter(i => i.stock_quantity < (i.min_stock_qty || 0) && i.stock_quantity > 0).length;
     const outOfStock = items.filter(i => (i.stock_quantity || 0) <= 0).length;
     return { active, lowStock, outOfStock, total: items.length };
  }, [items]);

  // ── density ───────────────────────────────────────────────────────────────

  function cycleDensity() {
    const order = ["compact", "normal", "spacious"];
    const next = order[(order.indexOf(density) + 1) % order.length];
    setDensity(next);
    localStorage.setItem("items_density", next);
  }

  function toggleProfitMode() {
    const next = profitMode === "percentage" ? "number" : "percentage";
    setProfitMode(next);
    localStorage.setItem("items_profit_mode", next);
  }

  function profitInfo(purchase, sale) {
    const p = Number(purchase || 0);
    const s = Number(sale || 0);
    if (!p || !s) return null;
    const profitAmount = s - p;
    const profitPct = (profitAmount / p) * 100;
    if (profitMode === "number") {
      return {
        value: profitAmount,
        label: formatMoney(profitAmount),
        cls: profitAmount >= 0 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50",
      };
    }
    return {
      value: profitPct,
      label: `${profitPct >= 0 ? "+" : ""}${profitPct.toFixed(1)}%`,
      cls: profitPct >= 15 ? "text-emerald-600 bg-emerald-50" : profitPct >= 5 ? "text-amber-600 bg-amber-50" : profitPct >= 0 ? "text-slate-600 bg-slate-50" : "text-rose-600 bg-rose-50",
    };
  }

  const densityIcon = { compact: Monitor, normal: Monitor, spacious: Monitor };

  // ── next-code preview ─────────────────────────────────────────────────────

  const nextCodePreview = useMemo(
    () => newRow.code || (selectedCategory ? `${selectedCategory.sku_prefix}.${items.length + 1}` : "—"),
    [newRow.code, selectedCategory, items.length],
  );

  // ── draft / dirty ─────────────────────────────────────────────────────────

  function updateDraft(itemId, field, value) {
    setDraftById((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
    setDirtyRows((prev) => new Set(prev).add(itemId));
  }

  function discardAll() {
    setDraftById(() => {
      const next = {};
      items.forEach((row) => {
        next[row.id] = {
          name: row.name || "",
          barcode: row.barcode || "",
          purchase_price: String(row.purchase_price ?? ""),
          sale_price: String(row.sale_price ?? ""),
          wholesale_price: String(row.wholesale_price ?? ""),
          unit_id: String(row.unit_id ?? ""),
          min_stock_qty: String(row.min_stock_qty ?? ""),
          image_urls_text: Array.isArray(row.image_urls) ? row.image_urls.join(", ") : "",
          is_active: row.is_active !== 0,
          track_expiry: row.track_expiry === 1 || row.track_expiry === true,
        };
      });
      return next;
    });
    setDirtyRows(new Set());
  }

  // ── selection ─────────────────────────────────────────────────────────────

  const allSelected = displayItems.rows.length > 0 && displayItems.rows.every((i) => selectedIds.has(i.id));

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayItems.rows.map((i) => i.id)));
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  // ── category CRUD ─────────────────────────────────────────────────────────

  async function createCategory(e) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const res = await api.post("/api/categories", { name: newCategoryName.trim() });
      const newCat = res.data?.data;
      toast.success("تم إنشاء الفئة");
      setNewCategoryOpen(false);
      setNewCategoryName("");
      const cats = await loadCategories();
      if (newCat?.id) setSelectedCatId(newCat.id);
      else if (cats.length === 1) setSelectedCatId(cats[0].id);
    } catch (err) {
      toast.error(err.response?.data?.message || "تعذر إنشاء الفئة");
    }
  }

  // ── item CRUD ─────────────────────────────────────────────────────────────

  function buildPayload(d, item) {
    return {
      code: item?.code || "",
      category_id: item?.category_id ?? selectedCatId,
      name: String(d.name || "").trim(),
      barcode: String(d.barcode || "").trim() || null,
      purchase_price: Number(d.purchase_price || 0),
      sale_price: Number(d.sale_price || 0),
      wholesale_price: Number(d.wholesale_price || 0),
      min_stock_qty: Number(d.min_stock_qty || 0),
      unit_id: d.unit_id ? Number(d.unit_id) : null,
      image_urls: parseImageUrls(d.image_urls_text),
      is_active: d.is_active !== false,
      track_expiry: d.track_expiry ? 1 : 0,
    };
  }

  async function createFromNewRow() {
    if (!newRow.name.trim() || !selectedCatId || isAllCats) return;
    setSavingRowId("new");
    try {
      await api.post("/api/items", { ...buildPayload(newRow, null), code: newRow.code || "" });
      setNewRow((prev) => ({ ...EMPTY_DRAFT, unit_id: prev.unit_id }));
      nameInputRef.current?.focus();
      await loadItems(selectedCatId, search, showDeleted);
    } catch (err) {
      toast.error(err.response?.data?.message || "تعذر إضافة الصنف");
    } finally {
      setSavingRowId(null);
    }
  }

  async function saveRow(itemId) {
    const item = items.find((i) => i.id === itemId);
    const d = draftById[itemId] || {};
    if (!item || !String(d.name || "").trim()) return;
    setSavingRowId(itemId);
    try {
      await api.put(`/api/items/${itemId}`, buildPayload(d, item));
      setDirtyRows((prev) => { const s = new Set(prev); s.delete(itemId); return s; });
      await loadItems(selectedCatId, search, showDeleted);
    } catch (err) {
      toast.error(err.response?.data?.message || "تعذر حفظ التعديلات");
    } finally {
      setSavingRowId(null);
    }
  }

  async function saveAll() {
    await Promise.all([...dirtyRows].map((id) => saveRow(id)));
    toast.success("تم حفظ جميع التعديلات");
  }

  async function toggleActive(item) {
    try {
      await api.put(`/api/items/${item.id}`, {
        code: item.code || "",
        category_id: item.category_id,
        name: item.name,
        is_active: item.is_active === 0,
      });
      await loadItems(selectedCatId, search, showDeleted);
    } catch { toast.error("تعذر تغيير الحالة"); }
  }

  async function duplicateItem(item) {
    try {
      await api.post("/api/items", {
        code: "", category_id: item.category_id,
        name: `${item.name} (نسخة)`, barcode: null,
        purchase_price: item.purchase_price, sale_price: item.sale_price,
        wholesale_price: item.wholesale_price ?? 0,
        unit_id: item.unit_id, image_urls: [], is_active: true,
      });
      await loadItems(selectedCatId, search, showDeleted);
      toast.success("تم نسخ الصنف");
    } catch { toast.error("تعذر نسخ الصنف"); }
  }

  async function deleteRow(item) {
    if (!window.confirm(`إخفاء الصنف "${item.name}"؟ يمكن استعادته لاحقاً من خلال تفعيل "عرض المحذوفة".`)) return;
    try {
      await api.delete(`/api/items/${item.id}`);
      await loadItems(selectedCatId, search, showDeleted);
      toast.success("تم إخفاء الصنف");
    } catch (err) { toast.error(err.response?.data?.message || "تعذر حذف الصنف"); }
  }

  async function restoreRow(item) {
    try {
      await api.post(`/api/items/${item.id}/restore`);
      await loadItems(selectedCatId, search, showDeleted);
      toast.success("تم استعادة الصنف");
    } catch (err) { toast.error(err.response?.data?.message || "تعذر الاستعادة"); }
  }

  // ── bulk actions ──────────────────────────────────────────────────────────

  async function bulkDelete() {
    if (!window.confirm(`إخفاء ${selectedIds.size} صنف؟ يمكن استعادتهم لاحقاً.`)) return;
    try {
      await Promise.all([...selectedIds].map((id) => api.delete(`/api/items/${id}`)));
      toast.success("تم الإخفاء");
      await loadItems(selectedCatId, search, showDeleted);
    } catch { toast.error("تعذر الحذف"); }
  }

  async function bulkUnitChange(unitId) {
    try {
      await Promise.all([...selectedIds].map((id) => {
        const item = items.find((i) => i.id === id);
        if (!item) return Promise.resolve();
        return api.put(`/api/items/${id}`, {
          code: item.code || "",
          category_id: item.category_id,
          name: item.name,
          purchase_price: item.purchase_price,
          sale_price: item.sale_price,
          wholesale_price: item.wholesale_price ?? 0,
          unit_id: unitId ? Number(unitId) : null,
          is_active: item.is_active !== 0,
        });
      }));
      toast.success("تم تحديث الوحدة");
      await loadItems(selectedCatId, search, showDeleted);
    } catch { toast.error("تعذر تحديث الوحدة"); }
  }

  async function bulkMove(targetCatId) {
    try {
      await Promise.all([...selectedIds].map((id) => {
        const item = items.find((i) => i.id === id);
        if (!item) return Promise.resolve();
        return api.put(`/api/items/${id}`, {
          code: "", // server will auto-generate for new category
          category_id: targetCatId,
          name: item.name,
          purchase_price: item.purchase_price,
          sale_price: item.sale_price,
          wholesale_price: item.wholesale_price ?? 0,
          unit_id: item.unit_id,
          is_active: item.is_active !== 0,
        });
      }));
      toast.success("تم النقل");
      await loadItems(selectedCatId, search, showDeleted);
    } catch { toast.error("تعذر النقل"); }
  }

  async function bulkPriceChange(field, type, value) {
    try {
      await Promise.all([...selectedIds].map((id) => {
        const item = items.find((i) => i.id === id);
        if (!item) return Promise.resolve();
        const current = Number(item[field] || 0);
        const newVal = type === "pct" ? current * (1 + value / 100) : current + value;
        return api.put(`/api/items/${id}`, {
          code: item.code || "",
          category_id: item.category_id,
          name: item.name,
          purchase_price: field === "purchase_price" ? newVal : item.purchase_price,
          sale_price: field === "sale_price" ? newVal : item.sale_price,
          wholesale_price: field === "wholesale_price" ? newVal : (item.wholesale_price ?? 0),
          unit_id: item.unit_id,
          is_active: item.is_active !== 0,
        });
      }));
      toast.success("تم تحديث الأسعار");
      await loadItems(selectedCatId, search, showDeleted);
    } catch { toast.error("تعذر تحديث الأسعار"); }
  }

  // ── drag & drop reorder ───────────────────────────────────────────────────

  function onDragStart(e, itemId) {
    dragItemId.current = itemId;
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e, itemId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(itemId);
  }

  async function onDrop(e, targetId) {
    e.preventDefault();
    setDragOverId(null);
    const srcId = dragItemId.current;
    dragItemId.current = null;
    if (!srcId || srcId === targetId || isAllCats) return;

    // Build new ordered_ids by moving src to target's position
    const oldOrder = [...items].map((i) => i.id);
    const srcIdx = oldOrder.indexOf(srcId);
    const tgtIdx = oldOrder.indexOf(targetId);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const newOrder = [...oldOrder];
    newOrder.splice(srcIdx, 1);
    newOrder.splice(tgtIdx, 0, srcId);

    // Optimistic UI
    setItems((prev) => {
      const map = new Map(prev.map((i) => [i.id, i]));
      return newOrder.map((id) => map.get(id)).filter(Boolean);
    });

    try {
      await api.post("/api/items/reorder", { category_id: selectedCatId, ordered_ids: newOrder });
      await loadItems(selectedCatId, search, showDeleted);
    } catch {
      toast.error("تعذر إعادة الترتيب");
      await loadItems(selectedCatId, search, showDeleted);
    }
  }

  // ── empty state ───────────────────────────────────────────────────────────

  if (!loading && categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 rounded-md border-2 border-dashed border-slate-200 bg-white/50 text-center mx-8 my-8" dir="rtl">
        <div className="flex h-20 w-20 items-center justify-center rounded-sm bg-primary text-white shadow-xl"><Shapes className="h-10 w-10 shrink-0" /></div>
        <div className="flex flex-col gap-1">
          <h2 className="text-[20px] font-black text-slate-900">لم يتم تعريف أقسام الأصناف</h2>
          <p className="text-sm font-bold text-slate-500 max-w-[300px]">يجب إنشاء فئة رئيسية واحدة على الأقل قبل البدء بتعريف الأصناف الفردية</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
             onClick={() => setNewCategoryOpen(true)}
             className="flex items-center gap-2 rounded-sm bg-primary px-8 py-3 text-sm font-black text-white hover:bg-primary-600 transition-all active:scale-95"
          >
             <Plus className="h-4 w-4" /> إنشاء فئة جديدة الآن
          </button>
          <button
             onClick={() => navigate("/definitions/items/import")}
             className="flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-8 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-100 transition-all active:scale-95"
          >
             <Upload className="h-4 w-4" /> استيراد من Excel
          </button>
        </div>
        <Modal open={newCategoryOpen} title="إضافة فئة جديدة" onClose={() => setNewCategoryOpen(false)} maxWidth="max-w-md" showDetach={false}>
          <form onSubmit={createCategory} className="space-y-4 p-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">اسم الفئة الرئيسية</label>
              <input autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="مثلاً: بويات، أدوات صحية، زيوت..."
                className="w-full rounded-sm border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-800" required />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setNewCategoryOpen(false)} className="px-6 py-2 text-2sm font-black text-slate-500 hover:bg-slate-50">إلغاء</button>
              <button type="submit" className="rounded-sm bg-slate-900 px-8 py-2 text-2sm font-black text-white shadow-lg">تأكيد الحفظ</button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  const COLS = 15;

  return (
    <div className="standard-page-container font-sans flex flex-col gap-6 pb-32" dir="rtl">
      
      {/* Header & Stats Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4">
         <div className="flex flex-col gap-1">
            <h1 className="text-[24px] font-black text-slate-900">قاعدة بيانات الأصناف</h1>
            <p className="text-sm font-bold text-slate-400">إدارة المخزون، الأسعار، وحركات الربحية للأقسام التشغيلية</p>
         </div>
         <div className="flex items-center gap-2">
            <div className="flex h-[42px] items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 shadow-sm">
               <Activity className="h-4 w-4 text-emerald-500" />
               <div className="flex flex-col text-right">
                  <span className="text-[11px] font-black text-slate-400 uppercase leading-none">نشط حالياً</span>
                  <span className="text-sm font-black text-slate-800 leading-none">{stats.active}</span>
               </div>
            </div>
            <div className="flex h-[42px] items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 shadow-sm">
               <AlertTriangle className="h-4 w-4 text-rose-500" />
               <div className="flex flex-col text-right">
                  <span className="text-[11px] font-black text-slate-400 uppercase leading-none">هوامش حرجة</span>
                  <span className="text-sm font-black text-slate-800 leading-none">{stats.outOfStock}</span>
               </div>
            </div>

            <PermissionGate page="items" action="add">
            <button
               onClick={() => setNewCategoryOpen(true)}
               className="flex h-[42px] items-center gap-2 rounded-sm bg-slate-100 border border-slate-200 px-4 text-sm font-black text-slate-600 hover:bg-slate-200 transition-all active:scale-95 shadow-sm"
            >
               <Shapes className="h-3.5 w-3.5" /> فئة جديدة
            </button>
            </PermissionGate>
            <PermissionGate page="items" action="add">
            <button
               data-help="import-button"
               onClick={() => navigate("/definitions/items/import")}
               className="flex h-[42px] items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-4 text-2sm font-black text-emerald-700 hover:bg-emerald-100 transition-all shadow-sm"
               title="استيراد من Excel"
            >
               <Upload className="h-4 w-4" /> استيراد
            </button>
            </PermissionGate>
            <PermissionGate page="items" action="print">
            <button
               onClick={() => setExportOpen(true)}
               className="flex h-[42px] items-center gap-2 rounded-sm border border-sky-200 bg-sky-50 px-4 text-2sm font-black text-sky-700 hover:bg-sky-100 transition-all shadow-sm"
               title="تصدير Excel"
            >
               <Download className="h-4 w-4" /> تصدير
            </button>
            </PermissionGate>
         </div>
      </div>

      {/* Toolbar & Filters */}
      <div data-help="main-table" className="flex flex-col rounded-sm border border-slate-200 bg-white shadow-sm overflow-hidden">
         <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <div className="flex items-center gap-4 flex-1 min-w-[300px]">
               <div data-help="search-bar" className="relative flex-1 group">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
                     onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); pageRef.current = 1; loadItems(selectedCatId, search, showDeleted, { offset: 0 }); } handleKeyDown(e, { nextRef: catSelectRef }); }}
                     placeholder="بحث سريع (الاسم، الباركود، الكود الداخلي)..."
                     className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-10 text-sm font-bold outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all shadow-sm" />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {search && (
                      <button onClick={() => { setSearch(""); setPage(1); pageRef.current = 1; loadItems(selectedCatId, "", showDeleted, { offset: 0 }); }} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-sans text-[11px] font-medium text-slate-400">
                      Enter
                    </kbd>
                    <ShortcutKbd id="items.search" className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-sans text-[11px] font-medium text-slate-400" />
                  </div>
               </div>
               <div data-help="category-filter" className="relative w-72 group">
                  <Filter className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <select ref={catSelectRef} value={selectedCatId ?? ""}
                     onChange={(e) => { const v = e.target.value; setSelectedCatId(v === ALL_CATEGORIES ? ALL_CATEGORIES : Number(v)); }}
                     onKeyDown={(e) => handleKeyDown(e, { nextRef: nameInputRef, prevRef: searchRef })}
                     className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm font-black text-slate-700 outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-900/5 transition-all shadow-sm">
                    <option value={ALL_CATEGORIES}>كل الأصناف — عرض فقط</option>
                    {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.sku_prefix ? `${cat.sku_prefix} — ` : ""}{cat.name}</option>)}
                  </select>
                  <ChevronDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:rotate-180 transition-transform" />
               </div>
            </div>
            
            <div className="flex items-center gap-3">
               <button onClick={() => setShowSkuGaps((prev) => !prev)}
                  disabled={isAllCats}
                  title={isAllCats ? "غير متاح في وضع عرض كل الأصناف — اختر فئة محددة" : undefined}
                  className={`flex items-center gap-2 rounded-sm border px-4 py-2.5 text-[11px] font-black transition-all shadow-sm uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed ${showSkuGaps ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}>
                  <Box className="h-3.5 w-3.5" /> {showSkuGaps ? "إخفاء الفراغات" : "عرض فراغات SKU"}
               </button>
               <button onClick={() => setShowDeleted((p) => !p)}
                  disabled={isAllCats}
                  title={isAllCats ? "غير متاح في وضع عرض كل الأصناف — اختر فئة محددة" : undefined}
                  className={`flex items-center gap-2 rounded-sm border px-4 py-2.5 text-[11px] font-black transition-all shadow-sm uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed ${
                    showDeleted
                      ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      : "border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}>
                  <Eye className="h-3.5 w-3.5" /> {showDeleted ? "إخفاء المحذوفة" : "عرض المحذوفة"}
               </button>
                <button data-help="add-button" onClick={() => loadItems(selectedCatId, search, showDeleted)}
                   className="flex items-center gap-2 rounded-sm bg-primary px-6 py-2.5 text-sm font-black text-white hover:bg-primary-600 transition-all shadow-lg active:scale-95">
                   <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> تحديث القائمة <ShortcutKbd id="items.refresh" className="rounded bg-white/20 px-1.5 text-[9px] font-mono text-white/80" />
                </button>
            </div>
         </div>

          {/* Items Table Workspace */}
          <div className="flex flex-col" style={{ maxHeight: '70vh' }}>
            <div ref={scrollContainerRef}
              onScroll={() => { if (bottomScrollRef.current) bottomScrollRef.current.scrollLeft = scrollContainerRef.current?.scrollLeft || 0; }}
              className="overflow-auto scrollbar-thin flex-1">
            <table className="w-max border-collapse table-fixed text-right min-w-full">
             <thead className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-sm">
                <tr className="border-b border-slate-200 shadow-sm">
                   {/* drag + checkbox merged */}
                   <th className="w-10 px-1 py-3 text-center">
                     <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                       className="h-3.5 w-3.5 cursor-pointer rounded-sm accent-slate-800" />
                   </th>
                   <th className="w-9 px-1 py-3 text-center text-[11px] font-black text-slate-400">صورة</th>
                   <th className="w-9 px-1 py-3 text-center text-[11px] font-black text-slate-400">نشط</th>
                    {expiryEnabled && (
                    <th className="w-16 px-1 py-3 text-center" title="تتبع تواريخ الانتهاء — فعّل لكل صنف حساس">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest leading-none">FEFO</span>
                        <span className="text-[9px] font-bold text-slate-400 leading-none">انتهاء</span>
                      </div>
                    </th>
                    )}
                   <SortTh label="الكود" sortKey="code" sortConfig={sortConfig} onSort={toggleSort} resizableKey="code" width={colWidths.code} onResizeStart={onResizeStart} />
                   <SortTh label="الاسم / المواصفات" sortKey="name" sortConfig={sortConfig} onSort={toggleSort} resizableKey="name" width={colWidths.name} onResizeStart={onResizeStart} />
                   <th className="relative px-2 py-3 text-right text-[11px] font-black uppercase text-slate-500" style={{width: colWidths.unit, minWidth: colWidths.unit}}>
                     الوحدة
                     <div onMouseDown={(e) => onResizeStart(e, "unit")} className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-400 z-10 transition-colors opacity-0 hover:opacity-100" />
                   </th>
                   <SortTh label="الباركود" sortKey="barcode" sortConfig={sortConfig} onSort={toggleSort} resizableKey="barcode" width={colWidths.barcode} onResizeStart={onResizeStart} />
                   <SortTh label="شراء" sortKey="purchase_price" sortConfig={sortConfig} onSort={toggleSort} resizableKey="purchase_price" width={colWidths.purchase_price} onResizeStart={onResizeStart} />
                   <th className="relative px-2 py-3 text-right text-[11px] font-black uppercase text-slate-500" style={{width: colWidths.sale_price, minWidth: colWidths.sale_price}}>
                     <div className="flex items-center justify-between gap-2">
                       <span>مستهلك</span>
                       <button onClick={toggleProfitMode} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors" title="تبديل عرض الربح">
                         {profitMode === "percentage" ? "%" : "ج.م"}
                       </button>
                     </div>
                     <div onMouseDown={(e) => onResizeStart(e, "sale_price")} className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-400 z-10 transition-colors opacity-0 hover:opacity-100" />
                   </th>
                   <th className="relative px-2 py-3 text-right text-[11px] font-black uppercase text-slate-500" style={{width: colWidths.wholesale_price, minWidth: colWidths.wholesale_price}}>
                     <div className="flex items-center justify-between gap-2">
                       <span>جملة</span>
                       <button onClick={toggleProfitMode} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors" title="تبديل عرض الربح">
                         {profitMode === "percentage" ? "%" : "ج.م"}
                       </button>
                     </div>
                     <div onMouseDown={(e) => onResizeStart(e, "wholesale_price")} className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-400 z-10 transition-colors opacity-0 hover:opacity-100" />
                   </th>
                   <th className="relative px-2 py-3 text-center text-[11px] font-black uppercase text-slate-500" style={{width: colWidths.min_stock_qty, minWidth: colWidths.min_stock_qty}}>
                     الحد الأدنى
                     <div onMouseDown={(e) => onResizeStart(e, "min_stock_qty")} className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-400 z-10 transition-colors opacity-0 hover:opacity-100" />
                   </th>
                   <th className="relative px-1 py-3 text-center text-[11px] font-black uppercase text-slate-500" style={{width: colWidths.margin, minWidth: colWidths.margin}}>
                     هامش
                     <div onMouseDown={(e) => onResizeStart(e, "margin")} className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-400 z-10 transition-colors opacity-0 hover:opacity-100" />
                   </th>
                   <SortTh label="مخزون" sortKey="stock_quantity" sortConfig={sortConfig} onSort={toggleSort} resizableKey="stock_quantity" width={colWidths.stock_quantity} onResizeStart={onResizeStart} className="text-center" />
                   <th className="w-20 px-2 py-3 text-center text-[11px] font-black uppercase text-slate-500">إجراءات</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
               {loading ? (
                 <SkeletonRows cols={COLS} />
              ) : tableRows.length === 0 ? (
                 <tr><td colSpan={COLS} className="py-24 text-center text-sm font-black text-slate-300 uppercase tracking-widest animate-pulse">لا يوجد بيانات لعرضها في هذه الفئة</td></tr>
               ) : (
                 tableRows.map((item) => {
                   if (item.__gap) {
                     return (
                       <tr key={item.id} className="bg-violet-50/60">
                         <td colSpan={4} className="px-3 py-2 text-center text-[11px] font-black text-violet-500">فراغ SKU</td>
                         <td className="px-4 py-2 border-l border-violet-100">
                           <span className="font-mono text-2sm font-black text-violet-700">{item.code}</span>
                         </td>
                         <td colSpan={9} className="px-4 py-2 text-[11px] font-bold text-violet-700">
                           هذا الرقم فارغ. لا يتم إنشاء صنف هنا إلا بعد اختيار الرقم وكتابة بيانات الصف ثم الضغط على إضافة.
                         </td>
                         <td className="px-4 py-2 text-center">
                           <button
                             type="button"
                             onClick={() => {
                               setNewRow((prev) => ({ ...prev, code: item.code }));
                               nameInputRef.current?.focus();
                             }}
                             className="rounded-sm bg-violet-700 px-3 py-2 text-[11px] font-black text-white"
                           >
                             استخدام هذا الرقم
                           </button>
                         </td>
                       </tr>
                     );
                   }
                   const d = draftById[item.id] || {};
                   const isDirty = dirtyRows.has(item.id);
                   const isSelected = selectedIds.has(item.id);
                   const isDeleted = !!item.deleted_at;
                   const itemThreshold = item.min_margin_percent != null ? item.min_margin_percent : globalMinMargin;
                   const margin = marginInfo(d.purchase_price, d.sale_price, itemThreshold);
                   const stock = stockBadge(item.stock_quantity, d.min_stock_qty);
                   const isDragTarget = dragOverId === item.id;

                   return (
                     <tr key={item.id}
                       draggable={!isDeleted && !isAllCats}
                       onDragStart={(e) => !isDeleted && !isAllCats && onDragStart(e, item.id)}
                       onDragOver={(e) => !isDeleted && !isAllCats && onDragOver(e, item.id)}
                       onDragLeave={() => setDragOverId(null)}
                       onDrop={(e) => !isDeleted && !isAllCats && onDrop(e, item.id)}
                       onDragEnd={() => setDragOverId(null)}
                       className={`group transition-all duration-200
                         ${isDeleted ? "bg-rose-50/60 border-r-4 border-rose-300" : isSelected ? "bg-sky-50/40" : "hover:bg-slate-50/50"}
                         ${isDragTarget ? "border-t-2 border-slate-900 bg-slate-100" : ""}
                         ${!isDeleted && (d.is_active === false || d.is_active === 0) ? "opacity-50" : ""}`}
                     >
                       {/* drag+checkbox merged cell */}
                       <td className="px-1 py-1">
                          <div className="flex items-center gap-0.5">
                            {!isDeleted && <GripVertical className="h-3.5 w-3.5 cursor-grab text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.id)} disabled={isDeleted}
                              className="h-3.5 w-3.5 cursor-pointer rounded-sm accent-slate-800 disabled:opacity-30" />
                          </div>
                       </td>
                       <td className="px-1 py-1 text-center border-l border-slate-100">
                          {isDeleted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black text-rose-600 bg-rose-100">محذوف</span>
                          ) : (
                            <ImageUpload size="sm"
                              url={item.primary_image_url}
                              onUpload={async (url) => {
                                await api.put(`/api/items/${item.id}`, { ...buildPayload(d, item), image_urls: [url] });
                                await loadItems(selectedCatId, search, showDeleted);
                              }}
                              onRemove={async () => {
                                await api.put(`/api/items/${item.id}`, { ...buildPayload(d, item), image_urls: [] });
                                await loadItems(selectedCatId, search, showDeleted);
                              }}
                            />
                          )}
                       </td>
                       <td className="px-1 py-1 text-center border-l border-slate-100">
                          {!isDeleted && <ActiveToggle active={d.is_active !== false && d.is_active !== 0} onToggle={() => toggleActive(item)} />}
                       </td>
                       {expiryEnabled && (
                       <td className="px-1 py-1 text-center border-l border-slate-100">
                          {!isDeleted && (
                            <button type="button"
                              title={d.track_expiry ? "تتبع انتهاء الصلاحية مفعّل — اضغط لإيقافه" : "تتبع انتهاء الصلاحية موقف — اضغط لتفعيله"}
                              onClick={() => { updateDraft(item.id, "track_expiry", !d.track_expiry); }}
                              className={`flex flex-col items-center gap-0.5 px-1 py-0.5 rounded-md transition-colors cursor-pointer border
                                ${d.track_expiry
                                  ? "bg-orange-50 border-orange-200 hover:bg-orange-100"
                                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"}`}>
                              <div className={`relative inline-flex h-[18px] w-[34px] shrink-0 items-center rounded-full border-2 border-transparent transition-colors shadow-sm
                                ${d.track_expiry ? "bg-orange-400" : "bg-slate-300"}`} dir="ltr">
                                <span className={`inline-block h-[11px] w-[11px] transform rounded-full bg-white shadow-md transition-transform ${d.track_expiry ? "translate-x-[15px]" : "translate-x-0.5"}`} />
                              </div>
                              <span className={`text-[8px] font-black leading-none ${d.track_expiry ? "text-orange-600" : "text-slate-400"}`}>
                                {d.track_expiry ? "مفعّل" : "موقف"}
                              </span>
                            </button>
                          )}
                       </td>
                       )}
                       <td className="px-4 py-1 border-l border-slate-100">
                          <span className="font-mono text-2sm font-black text-slate-400 tracking-tighter">{item.code || "—"}</span>
                       </td>
                       <td className={`${DENSITY_CLS[density]} px-4 border-l border-slate-100`}>
                          <Cell value={d.name} onChange={(e) => updateDraft(item.id, "name", e.target.value)} disabled={isDeleted} dirty={isDirty} className={`font-black ${isDeleted ? "line-through text-slate-400" : "text-slate-800"}`} />
                       </td>
                       <td className="px-3 py-1 border-l border-slate-100">
                          <UnitSelect value={d.unit_id} units={units} onChange={(e) => updateDraft(item.id, "unit_id", e.target.value)} dirty={isDirty} disabled={isDeleted} />
                       </td>
                       <td className="px-3 py-1 border-l border-slate-100">
                          <Cell value={d.barcode} onChange={(e) => updateDraft(item.id, "barcode", e.target.value)} dirty={isDirty} className="font-mono" />
                       </td>
                       <td className="px-3 py-1 border-l border-slate-100">
                          <Cell type="number" value={d.purchase_price} onChange={(e) => updateDraft(item.id, "purchase_price", e.target.value)} dirty={isDirty} className="text-left font-black" />
                       </td>
                       <td className="px-3 py-1 relative border-l border-slate-100 xl:overflow-visible">
                          <div className="relative flex items-center">
                            <Cell type="number" value={d.sale_price} onChange={(e) => updateDraft(item.id, "sale_price", e.target.value)} dirty={isDirty} className="text-left font-black text-emerald-800 pr-8 w-full"
                              onFocus={() => { focusedPriceCellRef.current = { itemId: item.id, field: "sale_price" }; }}
                              onBlur={() => { setTimeout(() => { if (focusedPriceCellRef.current?.itemId === item.id) focusedPriceCellRef.current = null; }, 50); }} />
                            <button onClick={() => setCalcAnchor(calcAnchor?.itemId === item.id ? null : { itemId: item.id, field: "sale_price" })}
                              className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-md hover:bg-emerald-100 text-emerald-600 opacity-60 hover:opacity-100 transition-all font-black text-2sm bg-white shadow-sm border border-emerald-100" title={` ${shortcutLabel("items.calculator")} لفتح الحاسبة `}>
                               %
                            </button>
                          </div>
                          {calcAnchor?.itemId === item.id && calcAnchor.field === "sale_price" && (
                             <div className="absolute right-0 top-[calc(100%+8px)] z-[100]">
                               <CalcPopover purchasePrice={d.purchase_price} onApply={(val) => { updateDraft(item.id, "sale_price", val); setCalcAnchor(null); }} />
                             </div>
                          )}
                          {(() => {
                            const profit = profitInfo(d.purchase_price, d.sale_price);
                            return profit && <div className={`text-center mt-0.5 text-[9px] font-black ${profit.cls} rounded px-1`}>{profit.label}</div>;
                          })()}
                       </td>
                       <td className="px-3 py-1 border-l border-slate-100">
                          <Cell type="number" value={d.wholesale_price} onChange={(e) => updateDraft(item.id, "wholesale_price", e.target.value)} dirty={isDirty} className="text-left font-black text-blue-800" />
                          {(() => {
                            const profit = profitInfo(d.purchase_price, d.wholesale_price);
                            return profit && <div className={`text-center mt-0.5 text-[9px] font-black ${profit.cls} rounded px-1`}>{profit.label}</div>;
                          })()}
                       </td>
                       <td className="px-3 py-1 border-l border-slate-100">
                          <Cell type="number" value={d.min_stock_qty} onChange={(e) => updateDraft(item.id, "min_stock_qty", e.target.value)} dirty={isDirty} className="text-left" />
                       </td>
                       <td className="px-2 py-1 text-center border-l border-slate-100">
                          {margin && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black ${margin.cls} border border-transparent`}>
                              {margin.belowThreshold && <AlertTriangle className="h-3 w-3" />}{margin.label}
                            </span>
                          )}
                       </td>
                       <td className="px-2 py-1 text-center border-l border-slate-100">
                          <span className={`inline-block min-w-[36px] px-2 py-1 rounded-md text-[11px] font-black shadow-sm ${stock.cls}`}>{stock.label}</span>
                       </td>
                       <td className="px-4 py-1 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                             {isDeleted ? (
                               <PermissionGate page="items" action="edit">
                               <button
                                 onClick={() => restoreRow(item)}
                                 className="flex h-8 items-center gap-1.5 rounded-sm bg-emerald-600 px-3 text-[11px] font-black text-white shadow-md hover:bg-emerald-700 active:scale-95 transition-all"
                                 title="استعادة الصنف"
                               >
                                 <RotateCcw className="h-3 w-3" /> استعادة
                               </button>
                               </PermissionGate>
                             ) : (
                               <>
                                 {isDirty ? (
                                   <PermissionGate page="items" action="edit">
                                   <button
                                     onClick={() => saveRow(item.id)}
                                     className="flex h-8 items-center gap-2 rounded-sm bg-slate-800 px-3 text-[11px] font-black text-white shadow-md active:scale-95"
                                   >
                                     <Save className="h-3 w-3" />
                                   </button>
                                   </PermissionGate>
                                 ) : (
                                   <PermissionGate page="items" action="add">
                                   <button
                                     onClick={() => duplicateItem(item)}
                                     className="flex h-8 w-8 items-center justify-center rounded-sm bg-slate-100 text-slate-400 hover:bg-primary-600 hover:text-white transition-all shadow-sm"
                                     title="تكرار الصنف"
                                   >
                                     <Copy className="h-3.5 w-3.5" />
                                   </button>
                                   </PermissionGate>
                                 )}
                                 {anyItemFeature && (
                                   <PermissionGate page="items" action="edit">
                                   <button
                                     onClick={() => setEditFullItem(item)}
                                     title="تعديل كامل (السيريال/الذهب/الميزان/الوحدات/المتغيرات)"
                                     className="flex h-8 w-8 items-center justify-center rounded-sm bg-slate-100 text-slate-500 hover:bg-primary-600 hover:text-white transition-all shadow-sm"
                                   >
                                     <Pencil className="h-3.5 w-3.5" />
                                   </button>
                                   </PermissionGate>
                                 )}
                                 {multiUnitEnabled && (
                                   <button
                                     onClick={() => setUnitsItem(item)}
                                     title="وحدات إضافية"
                                     className="flex h-8 w-8 items-center justify-center rounded-sm bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white transition-all shadow-sm"
                                   >
                                     <Package className="h-3.5 w-3.5" />
                                   </button>
                                 )}
                                 {variantsEnabled && (
                                   <button
                                     onClick={() => setVariantsItem(item)}
                                     title="المتغيرات"
                                     className="flex h-8 w-8 items-center justify-center rounded-sm bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white transition-all shadow-sm"
                                   >
                                     <Layers className="h-3.5 w-3.5" />
                                   </button>
                                 )}
                                 <PermissionGate page="items" action="delete">
                                 <button
                                   onClick={() => deleteRow(item)}
                                   className="flex h-8 w-8 items-center justify-center rounded-sm text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all opacity-0 group-hover:opacity-100"
                                 >
                                   <Trash2 className="h-3.5 w-3.5" />
                                 </button>
                                 </PermissionGate>
                               </>
                             )}
                          </div>
                       </td>
                     </tr>
                   );
                 })
               )}
             </tbody>
             
             {/* New Item Creation Row */}
             {!loading && (
               <tfoot className="sticky bottom-0 z-20 bg-slate-100 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] border-t border-slate-200">
                  {isAllCats ? (
                  <tr className="bg-amber-50">
                     <td colSpan={COLS} className="px-6 py-4">
                       <div className="flex items-center justify-center gap-3 text-amber-800" dir="rtl">
                         <AlertTriangle className="h-5 w-5 shrink-0" />
                         <span className="text-2sm font-black">
                           أنت في وضع عرض كل الأصناف — لا يمكن إضافة صنف جديد هنا. اختر فئة محددة من القائمة بالأعلى لإضافة الأصناف.
                         </span>
                       </div>
                     </td>
                  </tr>
                  ) : (
                  <tr className="bg-white">
                      <td colSpan="3" className="px-2 text-[11px] font-black text-slate-400 uppercase text-center border-l border-slate-100">+ جديد <ShortcutKbd id="items.new" className="inline-flex items-center justify-center rounded bg-slate-200 px-1 py-0.5 text-[9px] font-mono text-slate-500" /></td>
                     {expiryEnabled && (
                     <td className="px-1 py-1 text-center border-l border-slate-100">
                       <button type="button"
                         title={newRow.track_expiry ? "تتبع انتهاء الصلاحية مفعّل — اضغط لإيقافه" : "تتبع انتهاء الصلاحية موقف — اضغط لتفعيله"}
                         onClick={() => setNewRow((prev) => ({ ...prev, track_expiry: !prev.track_expiry }))}
                         className={`flex flex-col items-center gap-0.5 px-1 py-0.5 rounded-md transition-colors cursor-pointer border
                           ${newRow.track_expiry ? "bg-orange-50 border-orange-200 hover:bg-orange-100" : "bg-slate-50 border-slate-200 hover:bg-slate-100"}`}>
                         <div className={`relative inline-flex h-[18px] w-[34px] shrink-0 items-center rounded-full border-2 border-transparent transition-colors shadow-sm ${newRow.track_expiry ? "bg-orange-400" : "bg-slate-300"}`} dir="ltr">
                           <span className={`inline-block h-[11px] w-[11px] transform rounded-full bg-white shadow-md transition-transform ${newRow.track_expiry ? "translate-x-[15px]" : "translate-x-0.5"}`} />
                         </div>
                         <span className={`text-[8px] font-black leading-none ${newRow.track_expiry ? "text-orange-600" : "text-slate-400"}`}>
                           {newRow.track_expiry ? "مفعّل" : "موقف"}
                         </span>
                       </button>
                     </td>
                     )}
                     <td className="px-2">
                        <div className="flex items-center justify-center gap-1">
                          <span className={`font-mono text-[11px] font-black tracking-tighter ${newRow.code ? "text-violet-700" : "text-slate-400 opacity-60"}`}>{nextCodePreview}</span>
                          {newRow.code ? (
                            <button type="button" onClick={() => setNewRow((prev) => ({ ...prev, code: "" }))} className="rounded bg-violet-100 px-1 text-[11px] font-black text-violet-700">آخر</button>
                          ) : null}
                        </div>
                     </td>
                     <td className="px-4 py-3">
                        <Cell value={newRow.name} onChange={(e) => setNewRow({ ...newRow, name: e.target.value })} 
                          ref={nameInputRef} placeholder="اكتب اسم الصنف الجديد هنا..." className="border-emerald-200/50 bg-emerald-50/30 font-black" />
                     </td>
                     <td className="px-3 py-2">
                         <UnitSelect ref={unitSelectRef} value={newRow.unit_id} units={units} onChange={(e) => setNewRow({ ...newRow, unit_id: e.target.value })} onKeyDown={(e) => handleKeyDown(e, { nextRef: barcodeRef, prevRef: nameInputRef })} />
                     </td>
                     <td className="px-3 py-2">
                         <Cell ref={barcodeRef} value={newRow.barcode} onChange={(e) => setNewRow({ ...newRow, barcode: e.target.value })} onKeyDown={(e) => handleKeyDown(e, { nextRef: purchasePriceRef, prevRef: unitSelectRef })} placeholder="الباركود..." className="font-mono" />
                     </td>
                     <td className="px-3 py-2">
                         <Cell ref={purchasePriceRef} type="number" value={newRow.purchase_price} onChange={(e) => setNewRow({ ...newRow, purchase_price: e.target.value })} onKeyDown={(e) => handleKeyDown(e, { nextRef: salePriceRef, prevRef: barcodeRef })} placeholder="الشراء" />
                     </td>
                     <td className="px-3 py-2">
                         <Cell ref={salePriceRef} type="number" value={newRow.sale_price} onChange={(e) => setNewRow({ ...newRow, sale_price: e.target.value })} onKeyDown={(e) => handleKeyDown(e, { nextRef: wholesalePriceRef, prevRef: purchasePriceRef })} placeholder="المستهلك" className="text-emerald-700" />
                        {(() => {
                          const profit = profitInfo(newRow.purchase_price, newRow.sale_price);
                          return profit && <div className={`text-center mt-0.5 text-[9px] font-black ${profit.cls} rounded px-1`}>{profit.label}</div>;
                        })()}
                     </td>
                     <td className="px-3 py-2">
                         <Cell ref={wholesalePriceRef} type="number" value={newRow.wholesale_price} onChange={(e) => setNewRow({ ...newRow, wholesale_price: e.target.value })} onKeyDown={(e) => handleKeyDown(e, { nextRef: minStockQtyRef, prevRef: salePriceRef })} placeholder="الجملة" className="text-blue-700" />
                        {(() => {
                          const profit = profitInfo(newRow.purchase_price, newRow.wholesale_price);
                          return profit && <div className={`text-center mt-0.5 text-[9px] font-black ${profit.cls} rounded px-1`}>{profit.label}</div>;
                        })()}
                     </td>
                     <td className="px-3 py-2">
                         <Cell ref={minStockQtyRef} type="number" value={newRow.min_stock_qty} onChange={(e) => setNewRow({ ...newRow, min_stock_qty: e.target.value })} onKeyDown={(e) => handleKeyDown(e, { nextRef: addItemBtnRef, prevRef: wholesalePriceRef })} placeholder="الحد" />
                     </td>
                     <td colSpan="2" className="px-4 text-center opacity-40">
                        <Shapes className="mx-auto h-4 w-4 text-slate-400" />
                     </td>
                     <td className="px-4 py-3 text-center">
                        <PermissionGate page="items" action="add">
                        <button ref={addItemBtnRef}
                            onClick={createFromNewRow}
                            onKeyDown={(e) => handleKeyDown(e, { nextRef: searchRef, onEnter: createFromNewRow })}
                            disabled={!newRow.name.trim() || savingRowId === "new" || (!selectedCatId && !newRow.category_id)}
                            className="flex w-full items-center justify-center gap-2 rounded-sm bg-emerald-600 px-4 py-2.5 text-2sm font-black text-white shadow-lg transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-30 disabled:grayscale"
                        >
                           {savingRowId === "new" ? "جاري..." : <><Plus className="h-4 w-4" /> إضافة</>}
                        </button>
                        </PermissionGate>
                     </td>
                  </tr>
                  )}
               </tfoot>
             )}
            </table>
            </div>
            <div ref={bottomScrollRef}
              onScroll={() => { if (scrollContainerRef.current) scrollContainerRef.current.scrollLeft = bottomScrollRef.current?.scrollLeft || 0; }}
              className="overflow-x-auto overflow-y-hidden h-3 bg-slate-50 border-t border-slate-200 scrollbar-thin cursor-pointer"
            >
              <div style={{ width: Math.max(tableScrollWidth, 1), height: 1 }} />
            </div>
          </div>

          {/* Pagination */}
          {!loading && itemsMeta.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-6 py-3" dir="rtl">
              <span className="text-[11px] font-bold text-slate-500">
                عرض {(page - 1) * ITEM_PAGE_SIZE + 1}–{Math.min(page * ITEM_PAGE_SIZE, itemsMeta.total)} من {itemsMeta.total} صنف
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => goToPage(1)} disabled={page <= 1 || loadingMore}
                    className="rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">الأولى</button>
                  <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1 || loadingMore}
                    className="flex items-center rounded-sm border border-slate-200 bg-white px-2 py-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="h-4 w-4" /></button>
                  {(() => {
                    const span = 2;
                    const start = Math.max(1, page - span);
                    const end = Math.min(totalPages, page + span);
                    const nums = [];
                    for (let p = start; p <= end; p += 1) nums.push(p);
                    return nums.map((p) => (
                      <button key={p} type="button" onClick={() => goToPage(p)} disabled={loadingMore}
                        className={`min-w-[32px] rounded-sm border px-2 py-1.5 text-[11px] font-black transition-colors ${p === page ? "border-primary bg-primary text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>{p}</button>
                    ));
                  })()}
                  <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages || loadingMore}
                    className="flex items-center rounded-sm border border-slate-200 bg-white px-2 py-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" onClick={() => goToPage(totalPages)} disabled={page >= totalPages || loadingMore}
                    className="rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">الأخيرة</button>
                </div>
              )}
            </div>
          )}
       </div>

      {/* Floating UI Elements */}
      <SaveAllBar count={dirtyRows.size} onSaveAll={saveAll} onDiscard={discardAll} />
      <BulkBar count={selectedIds.size} categories={categories} units={units} onDelete={bulkDelete} onMove={bulkMove} onPriceChange={bulkPriceChange} onUnitChange={bulkUnitChange} onClear={() => setSelectedIds(new Set())} />

      <Modal open={newCategoryOpen} title="إضافة فئة جديدة" onClose={() => setNewCategoryOpen(false)} maxWidth="max-w-md" showDetach={false}>
        <form onSubmit={createCategory} className="space-y-4 p-6">
           <div className="flex flex-col gap-1 mb-4">
              <h3 className="text-[16px] font-black text-slate-900">إنشاء تصنيف رئيسي</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">Catalog Management System</p>
           </div>
           <div className="space-y-4">
              <div className="space-y-1.5">
                 <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest">اسم الفئة (مثلاً: بويات، زيوت)</label>
                 <input ref={catNameRef} autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, { nextRef: catSubmitRef })}
                    className="w-full rounded-sm border border-slate-200 py-3 px-4 text-sm font-bold outline-none focus:border-slate-800" required />
               </div>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-50 mt-6">
               <button type="button" onClick={() => setNewCategoryOpen(false)} className="px-6 py-2 text-2sm font-black text-slate-400 hover:bg-slate-50">تجاهل</button>
               <button ref={catSubmitRef} type="submit" className="rounded-sm bg-slate-900 px-10 py-2.5 text-sm font-black text-white shadow-xl active:scale-95 transition-all">إنشاء الفئة الآن</button>
           </div>
        </form>
      </Modal>
      {exportOpen && (
        <React.Suspense fallback={null}>
          <ItemExportModal
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            items={items}
            filteredItems={displayItems.rows}
            selectedItems={selectedItemsForExport}
            selectedCategoryName={selectedCategory?.name}
          />
        </React.Suspense>
      )}
      {quickAddOpen && (
        <React.Suspense fallback={null}>
          <ItemQuickAddModal
            onSaved={() => {
              setQuickAddOpen(false);
              loadItems(selectedCatId, search, showDeleted);
            }}
          />
        </React.Suspense>
      )}

      {unitsItem && (
        <Modal open title={`وحدات إضافية — ${unitsItem.name}`} onClose={() => setUnitsItem(null)} maxWidth="max-w-lg" showDetach={false}>
          <div className="p-4">
            <ItemUnitsSection itemId={unitsItem.id} />
          </div>
        </Modal>
      )}

      {variantsItem && (
        <Modal open title={`المتغيرات — ${variantsItem.name}`} onClose={() => setVariantsItem(null)} maxWidth="max-w-2xl" showDetach={false}>
          <div className="p-4">
            <VariantsSection item={variantsItem} onRefresh={() => loadItems(selectedCatId, search, showDeleted)} />
          </div>
        </Modal>
      )}

      {editFullItem && (
        <Modal open title={`تعديل صنف — ${editFullItem.name}`} onClose={() => setEditFullItem(null)} maxWidth="max-w-4xl" showDetach={false}>
          <div className="p-4 max-h-[80vh] overflow-y-auto">
            <React.Suspense fallback={null}>
              <ItemQuickAddModal
                editItem={editFullItem}
                onSaved={() => {
                  setEditFullItem(null);
                  loadItems(selectedCatId, search, showDeleted);
                }}
              />
            </React.Suspense>
          </div>
        </Modal>
      )}
    </div>
  );
}
