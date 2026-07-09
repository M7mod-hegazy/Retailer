import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  X, CheckCircle2, Loader2, ArrowLeftRight, ImageIcon,
  Plus, AlertTriangle, Package, Globe, ChevronDown,
  TrendingUp, TrendingDown, BarChart3, ListFilter, Search,
  ChevronLeft, ChevronRight, ExternalLink,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 25;

function isDefined(v) {
  return v !== null && v !== "" && v !== undefined;
}

/* ── Inline editable field for new products ── */
function InlineEdit({ label, value, onChange, type, currencySymbol }) {
  const [localVal, setLocalVal] = useState(value ?? "");
  const displayValue = type === "price" ? (Number(value) || 0).toFixed(2) : value ?? "";

  useEffect(() => {
    setLocalVal(value ?? "");
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value;
    setLocalVal(raw);
  };

  const handleBlur = () => {
    let finalValue = localVal;
    if (type === "price") {
      finalValue = Math.max(0, Number(localVal) || 0);
      setLocalVal(finalValue.toFixed(2));
    } else if (type === "stock") {
      finalValue = Math.max(0, parseInt(localVal) || 0);
      setLocalVal(String(finalValue));
    }
    onChange(finalValue);
  };

  return (
    <div>
      <label className="text-[10px] font-bold text-text-muted block mb-0.5">{label}</label>
      <input
        type={type === "stock" ? "number" : type === "price" ? "number" : "text"}
        value={localVal}
        onChange={handleChange}
        onBlur={handleBlur}
        step={type === "price" ? "0.01" : "1"}
        min="0"
        className="w-full px-2 py-1.5 bg-bg-input border border-border-subtle rounded-lg text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        dir={type === "price" ? "ltr" : "auto"}
      />
    </div>
  );
}

/* ── Diff Pill: shows before → after for one field ── */
function FieldDiff({ label, currentVal, newVal, type, currencySymbol }) {
  const isPrice = label === "price";
  const fmt = (v) => {
    if (!isDefined(v)) return "—";
    if (isPrice) return `${Number(v).toFixed(2)} ${currencySymbol}`;
    return String(v);
  };
  const iconMap = {
    name: "✏️",
    price: null,
    stock: "📦",
    description: "📝",
  };
  const arrow = type === "up" ? "↑" : type === "down" ? "↓" : "→";
  const arrowColor = type === "up" ? "text-success-text" : type === "down" ? "text-danger-text" : "text-text-muted";

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-gray-50 border border-gray-200/60">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-text-muted mb-0.5">{label}</div>
        <div className={`text-xs font-medium truncate ${type === "added" ? "text-text-muted line-through" : "text-text-secondary"}`}>
          {fmt(currentVal)}
        </div>
      </div>
      <div className={`flex-shrink-0 text-lg font-black ${arrowColor}`}>{arrow}</div>
      <div className="flex-1 min-w-0 text-right">
        <div className="text-[10px] font-bold text-text-muted mb-0.5">&nbsp;</div>
        <div className={`text-xs font-bold truncate ${type === "removed" ? "text-text-muted line-through" : "text-text-primary"}`}>
          {fmt(newVal)}
        </div>
      </div>
    </div>
  );
}

/* ── Image Diff: shows old vs new images ── */
function ImageDiff({ localImages, ecomImages, hasDiff }) {
  const { t } = useTranslation();
  if (!hasDiff) return null;
  return (
    <div className="py-2 px-3 rounded-xl bg-amber-50/50 border border-amber-200/60">
      <div className="flex items-center gap-1.5 mb-2">
        <ImageIcon className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-[11px] font-bold text-amber-700">{t("sync.review.imageChange")}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] font-bold text-text-muted mb-1">{t("sync.review.oldImages")}</div>
          {localImages && localImages.length > 0 ? (
            <div className="flex gap-1.5 flex-wrap">
              {localImages.slice(0, 4).map((url, i) => (
                <div key={i} className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 bg-white">
                  <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />
                </div>
              ))}
              {localImages.length > 4 && <span className="text-[10px] text-text-muted self-end">+{localImages.length - 4}</span>}
            </div>
          ) : (
            <div className="w-14 h-14 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
              <X className="h-4 w-4 text-text-muted" />
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-text-muted mb-1">{t("sync.review.newImages")}</div>
          {ecomImages && ecomImages.length > 0 ? (
            <div className="flex gap-1.5 flex-wrap justify-end">
              {ecomImages.slice(0, 4).map((url, i) => (
                <div key={i} className="w-14 h-14 rounded-lg overflow-hidden border border-amber-300 bg-white ring-1 ring-amber-200">
                  <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />
                </div>
              ))}
              {ecomImages.length > 4 && <span className="text-[10px] text-text-muted self-end">+{ecomImages.length - 4}</span>}
            </div>
          ) : (
            <div className="w-14 h-14 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center mr-auto">
              <X className="h-4 w-4 text-text-muted" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Product Change Card ── */
function ChangeCard({ change, index, defaultExpanded, onExclude, currencySymbol, overrides, onOverrideChange }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { t } = useTranslation();

  const isNew = change.isNew;
  const diff = change.diff || {};
  const current = change.current || {};
  const incoming = change.incoming || {};
  const skuFields = change.fields || { name: true, price: true, stock: true, description: true, images: true };
  const hasImages = change.hasImages && skuFields.images !== false;
  const diffFields = ["name", "price", "stock"];
  const localImages = change.localImages || [];
  const ecomImages = change.ecomImages || [];
  const ecomCategoryName = change.ecomCategoryName || null;
  const skuOverrides = overrides?.[change.sku] || {};
  const finalIncoming = { ...incoming, ...skuOverrides };

  /* Build diff rows only for changed fields */
  const diffRows = useMemo(() => {
    const rows = [];
    if (isNew) {
      for (const f of diffFields) {
        if (skuFields[f] === false) continue;
        if (isDefined(finalIncoming[f])) {
          const labels = { name: t("sync.review.name"), price: t("sync.review.price"), stock: t("sync.review.stock") };
          rows.push({ label: labels[f] || f, key: f, currentVal: null, newVal: finalIncoming[f], type: "added" });
        }
      }
      return rows;
    }
    for (const [key, changed] of Object.entries(diff)) {
      if (!changed || key === "description" || skuFields[key] === false) continue;
      const cv = current[key];
      const nv = incoming[key];
      let type = "changed";
      if (!isDefined(cv) && isDefined(nv)) type = "added";
      else if (isDefined(cv) && !isDefined(nv)) type = "removed";
      else if (key === "price") {
        type = Number(nv) > Number(cv) ? "up" : Number(nv) < Number(cv) ? "down" : "unchanged";
      }
      const labels = { name: t("sync.review.name"), price: t("sync.review.price"), stock: t("sync.review.stock") };
      rows.push({ label: labels[key] || key, key, currentVal: cv, newVal: nv, type });
    }
    return rows;
  }, [isNew, diff, current, incoming, finalIncoming, skuFields, t]);

  const hasDiffs = diffRows.length > 0 || hasImages;

  return (
    <div
      className="border border-gray-200 rounded-2xl overflow-hidden hover:shadow-sm hover:border-gray-300 transition-all duration-300 bg-white"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Thumbnail */}
        <div className={`w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden border border-gray-200 ${
          ecomImages[0] ? "" : "bg-gray-50 flex items-center justify-center"
        }`}>
          {ecomImages[0] ? (
            <img src={ecomImages[0]} alt="" className="w-full h-full object-cover" />
          ) : (
            <Package className="h-5 w-5 text-text-muted" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-text-primary truncate">{change.name || change.productName}</span>
            {isNew && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-success-bg text-success-text leading-none shrink-0">
                {t("sync.review.new")}
              </span>
            )}
            {!isNew && hasDiffs && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-info-bg text-info-text leading-none shrink-0">
                {t("sync.review.update")}
              </span>
            )}
            {hasImages && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 leading-none shrink-0">
                <ImageIcon className="h-2.5 w-2.5 inline mr-0.5" />
                {t("sync.impact.imageChange")}
              </span>
            )}
          </div>
          <div className="text-[11px] text-text-muted font-medium mt-0.5">
            {t("sync.sku")}: {change.sku}
            {ecomCategoryName && (
              <span className="mr-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-info-bg text-info-text border border-info-border leading-none">
                {ecomCategoryName}
              </span>
            )}
          </div>
        </div>

        {/* Remove button */}
        {onExclude && (
          <button
            onClick={() => onExclude(change.sku)}
            className="p-1.5 rounded-lg text-text-muted hover:bg-danger-bg/20 hover:text-danger-text transition-all active:scale-90"
            title={t("sync.review.remove")}
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Expand */}
        {hasDiffs && (
          <button onClick={() => setExpanded((v) => !v)} className={`transition-transform duration-200 flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 ${expanded ? "rotate-180" : ""}`}>
            <ChevronDown className="h-4 w-4 text-text-muted" />
          </button>
        )}
      </div>

      {/* ── Expanded Diff Section ── */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-gray-200 px-4 py-3 space-y-2">
          {diffRows.map((row) => (
            <FieldDiff
              key={row.key}
              label={row.label}
              currentVal={row.currentVal}
              newVal={row.newVal}
              type={row.type}
              currencySymbol={currencySymbol}
            />
          ))}
          {/* ── Inline editor for new products ── */}
          {isNew && onOverrideChange && (
            <div className="border border-border-subtle rounded-xl p-3 bg-bg-base mt-2">
              <div className="text-[10px] font-bold text-text-muted mb-2">{t("sync.review.editBeforeImport")}</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <InlineEdit
                  label={t("sync.review.name")}
                  value={skuOverrides.name ?? incoming.name ?? ""}
                  onChange={(v) => onOverrideChange(change.sku, "name", v)}
                  type="text"
                />
                <InlineEdit
                  label="SKU"
                  value={skuOverrides.code ?? change.sku ?? ""}
                  onChange={(v) => onOverrideChange(change.sku, "code", v)}
                  type="text"
                />
              </div>
              <div className="text-[10px] font-bold text-danger-text mb-1">{t("sync.review.requiredPrices")}</div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <InlineEdit
                  label={t("sync.review.purchasePrice")}
                  value={skuOverrides.purchase_price ?? 0}
                  onChange={(v) => onOverrideChange(change.sku, "purchase_price", Number(v))}
                  type="price"
                  currencySymbol={currencySymbol}
                />
                <InlineEdit
                  label={t("sync.review.price")}
                  value={skuOverrides.price ?? incoming.price ?? 0}
                  onChange={(v) => onOverrideChange(change.sku, "price", Number(v))}
                  type="price"
                  currencySymbol={currencySymbol}
                />
                <InlineEdit
                  label={t("sync.review.wholesalePrice")}
                  value={skuOverrides.wholesale_price ?? 0}
                  onChange={(v) => onOverrideChange(change.sku, "wholesale_price", Number(v))}
                  type="price"
                  currencySymbol={currencySymbol}
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <InlineEdit
                  label={t("sync.review.stock")}
                  value={skuOverrides.stock ?? incoming.stock ?? 0}
                  onChange={(v) => onOverrideChange(change.sku, "stock", Number(v))}
                  type="stock"
                />
              </div>
            </div>
          )}
          {hasImages && (
            <ImageDiff
              localImages={localImages}
              ecomImages={ecomImages}
              hasDiff={true}
            />
          )}
          {!hasDiffs && !isNew && (
            <div className="py-4 text-center text-text-muted text-xs">
              {t("sync.review.noChangesDetailed")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Filter config ── */
const FILTERS = [
  { key: "all", labelKey: "sync.impact.filterAll" },
  { key: "priceUp", labelKey: "sync.impact.pricesUp", icon: TrendingUp },
  { key: "priceDown", labelKey: "sync.impact.pricesDown", icon: TrendingDown },
  { key: "stockZero", labelKey: "sync.impact.stockToZero", icon: AlertTriangle },
  { key: "new", labelKey: "sync.impact.newProducts", icon: Plus },
  { key: "imageChange", labelKey: "sync.impact.imageChanges", icon: ImageIcon },
];

/* ── Main Modal ── */
export default function ReviewModal(props) {
  const { t } = useTranslation();

  const isOpen = props.isOpen ?? props.open ?? false;
  const onClose = props.onClose ?? props.onCancel ?? (() => {});
  const onConfirm = props.onConfirm ?? (() => {});
  const onBack = props.onBack ?? null;
  const onExclude = props.onExclude ?? null;
  const loading = props.loading ?? false;
  const syncing = props.syncing ?? false;
  const currencySymbol = props.currencySymbol ?? "ج.م";
  const storeName = props.storeName ?? "";

  const rawChanges = props.changes ?? props.previews ?? [];
  const allProducts = props.allProducts ?? []; // checkProducts — for image lookup

  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [sortOpen, setSortOpen] = useState(false);
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewPage, setReviewPage] = useState(1);

  /* Reset filters when modal opens */
  useEffect(() => {
    if (!isOpen) return;
    setActiveFilter("all");
    setSortBy("default");
    setReviewSearch("");
    setReviewPage(1);
  }, [isOpen]);

  /* Lock body scroll */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  /* ── Compute categories per change ── */
  const categorizeChange = useCallback((item) => {
    const cats = [];
    if (item.isNew) cats.push("new");
    if (item.hasImages) cats.push("imageChange");
    if (!item.isNew && item.current && item.incoming) {
      const oldP = Number(item.current.price) || 0;
      const newP = Number(item.incoming.price) || 0;
      if (item.diff?.price && newP > oldP) cats.push("priceUp");
      if (item.diff?.price && newP < oldP) cats.push("priceDown");
      if (item.diff?.stock && Number(item.incoming.stock) === 0) cats.push("stockZero");
    }
    return cats;
  }, []);

  /* ── Normalize changes — enrich with images from allProducts ── */
  const normalizedChanges = useMemo(() => {
    if (!rawChanges.length) return [];
    const prodMap = {};
    allProducts.forEach((p) => { prodMap[p.sku] = p; });
    return rawChanges.map((item) => {
      const full = prodMap[item.sku] || item._full || {};
      const ecomImages = full.images || (full.image ? [full.image] : []) || item.ecomImages || [];
      const localImages = item.localImages || full.localMatch?.image?.local ? [full.localMatch.image.local] : [];
      return {
        id: item.sku,
        productName: item.name,
        sku: item.sku,
        isNew: item.isNew || false,
        current: item.current || {},
        incoming: item.incoming || {},
        diff: item.diff || {},
        hasImages: item.hasImages || false,
        imageCount: item.imageCount || 0,
        fields: item.fields || {},
        categories: categorizeChange(item),
        ecomImages,
        localImages,
        _raw: item,
      };
    });
  }, [rawChanges, allProducts, categorizeChange]);

  /* ── Filter + search ── */
  const filteredChanges = useMemo(() => {
    let list = normalizedChanges;

    /* Search */
    if (reviewSearch.trim()) {
      const q = reviewSearch.trim().toLowerCase();
      list = list.filter((c) =>
        (c.productName || "").toLowerCase().includes(q) ||
        (c.sku || "").toLowerCase().includes(q)
      );
    }

    /* Filter */
    if (activeFilter !== "all") {
      list = list.filter((c) => c.categories.includes(activeFilter));
    }

    /* Sort */
    if (sortBy === "name") {
      list = [...list].sort((a, b) => (a.productName || "").localeCompare(b.productName || ""));
    } else if (sortBy === "priceChange") {
      list = [...list].sort((a, b) => {
        const aDiff = a.current?.price != null && a.incoming?.price != null
          ? Math.abs(Number(a.incoming.price) - Number(a.current.price)) : 0;
        const bDiff = b.current?.price != null && b.incoming?.price != null
          ? Math.abs(Number(b.incoming.price) - Number(b.current.price)) : 0;
        return bDiff - aDiff;
      });
    }

    return list;
  }, [normalizedChanges, reviewSearch, activeFilter, sortBy]);

  /* ── Pagination ── */
  const totalPages = Math.ceil(filteredChanges.length / PAGE_SIZE);
  const paginatedChanges = useMemo(() => {
    const start = (reviewPage - 1) * PAGE_SIZE;
    return filteredChanges.slice(start, start + PAGE_SIZE);
  }, [filteredChanges, reviewPage]);

  /* Reset page on filter/search change */
  useEffect(() => {
    setReviewPage(1);
  }, [activeFilter, reviewSearch, sortBy]);

  const pageRange = useMemo(() => {
    const maxVisible = 5;
    let lo = Math.max(1, reviewPage - Math.floor(maxVisible / 2));
    let hi = Math.min(totalPages, lo + maxVisible - 1);
    if (hi - lo + 1 < maxVisible) lo = Math.max(1, hi - maxVisible + 1);
    const pages = [];
    for (let i = lo; i <= hi; i++) pages.push(i);
    return pages;
  }, [totalPages, reviewPage]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const n = normalizedChanges;
    return {
      total: n.length,
      new: n.filter((c) => c.isNew).length,
      updated: n.filter((c) => !c.isNew).length,
      withImages: n.filter((c) => c.hasImages).length,
    };
  }, [normalizedChanges]);

  /* ── Local impact summary (computed from previews, no separate API call) ── */
  const sum = useMemo(() => {
    const changes = normalizedChanges;
    let pricesUpCount = 0, pricesUpTotal = 0;
    let pricesDownCount = 0, pricesDownTotal = 0;
    let stockZeroCount = 0;
    let imageCount = 0;
    let newCount = 0;
    for (const c of changes) {
      if (c.categories.includes("new")) newCount++;
      if (c.categories.includes("imageChange")) imageCount++;
      if (c.categories.includes("stockZero")) stockZeroCount++;
      if (c.categories.includes("priceUp")) {
        pricesUpCount++;
        pricesUpTotal += (Number(c.incoming.price) || 0) - (Number(c.current.price) || 0);
      }
      if (c.categories.includes("priceDown")) {
        pricesDownCount++;
        pricesDownTotal += (Number(c.current.price) || 0) - (Number(c.incoming.price) || 0);
      }
    }
    return {
      newProducts: newCount,
      pricesUp: { count: pricesUpCount, totalIncrease: pricesUpTotal },
      pricesDown: { count: pricesDownCount, totalDecrease: pricesDownTotal },
      stockToZero: { count: stockZeroCount },
      imageChanges: { count: imageCount },
    };
  }, [normalizedChanges]);

  if (!isOpen) return null;
  const sortOptions = [
    { key: "default", label: t("sync.impact.sortDefault") },
    { key: "priceChange", label: t("sync.impact.sortPriceDesc") },
    { key: "name", label: t("sync.impact.sortName") },
  ];

  return (
    <>
      {/* ── Dramatic Sync Overlay ── */}
      {syncing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary-900 to-indigo-950 animate-sync-gradient" />
          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="absolute w-1 h-1 bg-white/30 rounded-full animate-sync-float" style={{
                left: `${(i * 37 + 13) % 100}%`,
                top: `${(i * 53 + 7) % 100}%`,
                animationDelay: `${i * 0.4}s`,
                animationDuration: `${4 + (i % 5) * 1.5}s`,
                width: `${2 + (i % 3) * 2}px`,
                height: `${2 + (i % 3) * 2}px`,
                opacity: 0.2 + (i % 4) * 0.2,
              }} />
            ))}
          </div>
          {/* Glow orbs */}
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-primary-500/10 blur-3xl animate-sync-orb" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl animate-sync-orb" style={{ animationDelay: "2s" }} />
          {/* Center content */}
          <div className="relative flex flex-col items-center gap-8 z-10">
            {/* Animated rings + icon */}
            <div className="relative w-32 h-32">
              {/* Outer ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="58" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                <circle cx="64" cy="64" r="58" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"
                  strokeDasharray="364.4" strokeDashoffset="364.4"
                  className="animate-sync-circle" strokeLinecap="round" />
              </svg>
              {/* Middle ring */}
              <div className="absolute inset-2 rounded-full border border-white/10 animate-sync-ping" />
              <div className="absolute inset-4 rounded-full border border-white/20 animate-sync-ping" style={{ animationDelay: "0.8s" }} />
              {/* Inner icon */}
              <div className="absolute inset-6 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl shadow-primary-500/30">
                <ArrowLeftRight className="h-10 w-10 text-white animate-sync-spin" />
              </div>
            </div>
            {/* Text */}
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-white tracking-wide">جاري المزامنة</h3>
              <p className="text-sm text-white/50 font-medium">يتم سحب المنتجات وتحديث النظام...</p>
            </div>
            {/* Dots */}
            <div className="flex items-center gap-2">
              {[0,1,2,3,4].map((i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full bg-white/80 animate-sync-dot" style={{
                  animationDelay: `${i * 0.18}s`,
                  boxShadow: '0 0 6px rgba(255,255,255,0.3)',
                }} />
              ))}
            </div>
            {/* Progress bar */}
            <div className="w-72 h-1 rounded-full bg-white/10 overflow-hidden shadow-inner">
              <div className="h-full rounded-full bg-gradient-to-r from-primary-400 via-white to-primary-400 animate-sync-progress shadow-lg shadow-primary-500/30" />
            </div>
            <p className="text-[11px] text-white/30 font-medium">يجري تحضير البيانات...</p>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={handleBackdropClick} />
        <div className="relative bg-white rounded-3xl shadow-modal border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary-50 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-black text-text-primary">{t("sync.review.title")}</h2>
              <p className="text-xs text-text-muted mt-0.5">
                {storeName
                  ? t("sync.review.subtitleStore", { storeName })
                  : t("sync.review.subtitle", { count: stats.total })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 hover:text-text-primary transition-all duration-200 text-text-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── STATS ROW ── */}
        <div className="px-6 py-3 bg-gray-50/30 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-3">
            <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-white border border-gray-200">
              <span className="text-xl font-black text-text-primary">{stats.total}</span>
              <span className="text-[10px] font-bold text-text-muted">{t("sync.review.totalProducts")}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-white border border-gray-200">
              <span className="text-xl font-black text-success-text">{stats.new}</span>
              <span className="text-[10px] font-bold text-text-muted">{t("sync.review.newProducts")}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-white border border-gray-200">
              <span className="text-xl font-black text-info-text">{stats.updated}</span>
              <span className="text-[10px] font-bold text-text-muted">{t("sync.review.updatedProducts")}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-white border border-gray-200">
              <span className="text-xl font-black text-amber-600">{stats.withImages}</span>
              <span className="text-[10px] font-bold text-text-muted">{t("sync.review.withImages")}</span>
            </div>
          </div>
        </div>

        {/* ── IMPACT SUMMARY ── */}
        {sum.newProducts > 0 || sum.pricesUp.count > 0 || sum.pricesDown.count > 0 || sum.stockToZero.count > 0 || sum.imageChanges.count > 0 ? (
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50/20">
            <div className="flex items-center gap-1.5 mb-2">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-xs font-black text-text-primary">{t("sync.impact.title")}</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-success-bg text-success-text border border-success-border">
                <TrendingUp className="h-3 w-3" />
                {t("sync.impact.pricesUp")} {sum.pricesUp.count}
                <span className="text-[10px] opacity-70">+{sum.pricesUp.totalIncrease.toFixed(2)} {currencySymbol}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-danger-bg text-danger-text border border-danger-border">
                <TrendingDown className="h-3 w-3" />
                {t("sync.impact.pricesDown")} {sum.pricesDown.count}
                <span className="text-[10px] opacity-70">-{sum.pricesDown.totalDecrease.toFixed(2)} {currencySymbol}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-warning-bg text-warning-text border border-warning-border">
                <AlertTriangle className="h-3 w-3" />
                {t("sync.impact.stockToZero")} {sum.stockToZero.count}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-info-bg text-info-text border border-info-border">
                <Plus className="h-3 w-3" />
                {t("sync.impact.newProducts")} {sum.newProducts}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <ImageIcon className="h-3 w-3" />
                {t("sync.impact.imageChanges")} {sum.imageChanges.count}
              </span>
            </div>
          </div>
        ) : null}

        {/* ── CONNECTION INFO ── */}
        <div className="flex items-center gap-4 px-6 py-2 bg-gray-50/20 border-b border-gray-200 text-[11px] text-text-muted font-medium">
          <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {storeName || t("sync.review.fromStore")}</span>
        </div>

        {/* ── SEARCH + FILTER + SORT ── */}
        {normalizedChanges.length > 0 && (
          <div className="flex items-center gap-3 px-6 py-2.5 bg-gray-50/20 border-b border-gray-200 flex-wrap">
            {/* Search */}
            <div className="relative flex-[1] min-w-[160px]">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                value={reviewSearch}
                onChange={(e) => setReviewSearch(e.target.value)}
                placeholder={t("sync.review.searchPlaceholder")}
                className="w-full pr-8 pl-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {FILTERS.map((f) => {
                const count = activeFilter === f.key ? null : (f.key === "all" ? null : normalizedChanges.filter((c) => c.categories.includes(f.key)).length);
                return (
                  <button
                    key={f.key}
                    onClick={() => setActiveFilter(f.key)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all whitespace-nowrap ${
                      activeFilter === f.key
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-text-secondary border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {t(f.labelKey)}
                    {count > 0 && <span className={`mr-1 ${activeFilter === f.key ? "text-white/70" : "text-text-muted"}`}>({count})</span>}
                  </button>
                );
              })}
            </div>

            {/* Sort */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setSortOpen((v) => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border border-gray-200 bg-white text-text-secondary hover:border-gray-300 transition-colors"
              >
                <ListFilter className="h-3 w-3" />
                {sortOptions.find((o) => o.key === sortBy)?.label}
                <ChevronDown className={`h-3 w-3 transition-transform ${sortOpen ? "rotate-180" : ""}`} />
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-elevated py-1 min-w-[140px]">
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => { setSortBy(opt.key); setSortOpen(false); }}
                        className={`w-full text-right px-3 py-1.5 text-[11px] font-bold transition-colors ${
                          sortBy === opt.key ? "text-primary bg-primary-50" : "text-text-secondary hover:bg-gray-100"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── PRODUCT LIST ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-text-muted font-medium">{t("sync.review.loadingPreview")}</span>
            </div>
          ) : paginatedChanges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <CheckCircle2 className="h-10 w-10 text-success-text" />
              <span className="text-sm text-text-secondary font-bold">
                {reviewSearch || activeFilter !== "all"
                  ? t("sync.review.noMatchingChanges")
                  : t("sync.review.noChangesDetailed")}
              </span>
            </div>
          ) : (
            paginatedChanges.map((change, idx) => (
              <ChangeCard
                key={change.sku}
                change={change}
                index={idx}
                defaultExpanded={idx === 0 && paginatedChanges.length <= 3}
                onExclude={onExclude}
                currencySymbol={currencySymbol}
                overrides={props.overrides || {}}
                onOverrideChange={props.onOverrideChange}
              />
            ))
          )}
        </div>

        {/* ── PAGINATION ── */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-between px-6 py-2.5 border-t border-gray-200 bg-gray-50/20">
            <span className="text-[11px] text-text-muted">
              {t("sync.review.showing", {
                start: (reviewPage - 1) * PAGE_SIZE + 1,
                end: Math.min(reviewPage * PAGE_SIZE, filteredChanges.length),
                total: filteredChanges.length,
              })}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                disabled={reviewPage === 1}
                className="p-1 rounded-lg border border-gray-200 text-text-secondary hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </button>
              {pageRange.map((p) => (
                <button
                  key={p}
                  onClick={() => setReviewPage(p)}
                  className={`min-w-[28px] h-7 rounded-lg text-[11px] font-bold border transition ${
                    p === reviewPage
                      ? "bg-primary border-primary text-white"
                      : "border-gray-200 text-text-secondary hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setReviewPage((p) => Math.min(totalPages, p + 1))}
                disabled={reviewPage === totalPages}
                className="p-1 rounded-lg border border-gray-200 text-text-secondary hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/30 flex-shrink-0">
          <div>
            {onBack && (
              <button onClick={onBack} className="px-4 py-2.5 text-sm font-bold text-text-secondary hover:bg-gray-100 rounded-xl transition-all duration-200 active:scale-95">
                {t("sync.review.editSelection")}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-text-secondary hover:bg-gray-100 transition-all duration-200 active:scale-95">
              {t("sync.review.cancel")}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading || filteredChanges.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 shadow-sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {loading ? t("sync.review.applying") : t("sync.review.confirmSync", { count: filteredChanges.length })}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}