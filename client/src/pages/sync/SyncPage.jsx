import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw, Link2, Settings2, Download, Upload,
  CheckCircle2, XCircle, AlertCircle, Clock, Loader2, Search,
  ArrowLeftRight, FileDown, FileUp, ImageIcon, Eye,
  Globe, ShoppingBag, Layers, TrendingUp, Shield,
  CheckSquare, Square, SlidersHorizontal, Zap, Scale,
  ChevronDown, ChevronUp, Info, Truck, Undo2,
  ExternalLink,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { getSyncStatus, getSyncCheck, getSyncLogs, getPendingChanges, applySync, pullProducts, previewPull, getConflicts, resolveConflict, getSnapshots, previewRollback, executeRollback } from "../../services/syncService";
import { useSyncStore } from "../../stores/syncStore";
import { useSSEConnectionStatus } from "../../hooks/useSSE";
import ImagePreviewModal from "../../components/sync/ImagePreviewModal";
import ReviewModal from "../../components/sync/ReviewModal";

/* ─── helpers ─── */
function imgList(product) {
  const list = [];
  if (product?.image) list.push(product.image);
  if (product?.images?.length) {
    for (const img of product.images) {
      const url = typeof img === "string" ? img : img?.url || img;
      if (url && url !== product.image) list.push(url);
    }
  }
  return list;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} ي`;
}

function computeDiffs(conflict) {
  const pos = conflict?.pos || {};
  const ecom = conflict?.ecom || {};
  const fields = [
    { key: "name", label: "الاسم", posValue: pos.name, ecomValue: ecom.name },
    { key: "price", label: "السعر", posValue: pos.price, ecomValue: ecom.price, format: (v) => v != null ? `${v} ر.س` : "—" },
    { key: "stock", label: "المخزون", posValue: pos.stock, ecomValue: ecom.stock, format: (v) => v != null ? `${v} قطعة` : "—" },
    { key: "description", label: "الوصف", posValue: pos.description, ecomValue: ecom.description },
    { key: "images", label: "الصور", posValue: pos.images, ecomValue: ecom.images, changed: JSON.stringify(pos.images || []) !== JSON.stringify(ecom.images || []) },
  ];
  return fields.map((f) => ({
    ...f,
    posValue: f.posValue,
    ecomValue: f.ecomValue,
    changed: String(f.posValue ?? "") !== String(f.ecomValue ?? ""),
  }));
}

const FIELD_LABELS = {
  name: "الاسم",
  price: "السعر",
  stock: "المخزون",
  description: "الوصف",
  images: "الصور",
};

const FIELD_ICONS = {
  name: "📝",
  price: "💰",
  stock: "📦",
  description: "📄",
  images: "🖼️",
};

/* ─── Illustrated SVG Empty State Icons ─── */
function EmptyAvailableIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="8" width="28" height="24" rx="4" />
      <path d="M6 16h28" />
      <path d="M12 20h6" />
      <path d="M12 24h4" />
      <circle cx="28" cy="26" r="6" fill="currentColor" fillOpacity="0.15" />
      <path d="M25 26l2 2 4-4" />
      <path d="M8 32l4-4" strokeDasharray="2 2" opacity="0.4" />
      <path d="M32 32l-4-4" strokeDasharray="2 2" opacity="0.4" />
    </svg>
  );
}

function EmptyPendingIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="20" cy="20" r="15" />
      <path d="M13 20l5 5 9-9" />
      <circle cx="20" cy="20" r="8" fill="currentColor" fillOpacity="0.1" />
      <path d="M8 20a12 12 0 0124 0" strokeDasharray="2 3" opacity="0.3" />
    </svg>
  );
}

function EmptyLogsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="20" cy="20" r="15" />
      <path d="M20 12v9l6 3" />
      <circle cx="20" cy="20" r="8" fill="currentColor" fillOpacity="0.1" />
      <path d="M6 20a14 14 0 0128 0" strokeDasharray="2 3" opacity="0.3" />
    </svg>
  );
}

/* ─── Sub-components ─── */

function StatusBadge({ connected, pulse }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all duration-500 ${
      connected ? "bg-success-bg text-success-text" : "bg-danger-bg text-danger-text"
    } ${pulse ? "animate-pulse" : ""}`}>
      {connected ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-text opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success-text" />
        </span>
      ) : (
        <XCircle className="h-3 w-3" />
      )}
      {connected ? "متصل" : "غير متصل"}
    </span>
  );
}

function RealtimeBadge() {
  const { subscribe } = useSSEConnectionStatus();
  const [live, setLive] = useState(false);
  useEffect(() => subscribe(setLive), [subscribe]);
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all duration-500 ${
      live ? "bg-success-bg text-success-text" : "bg-gray-50 text-text-muted"
    }`}>
      {live && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-text opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success-text" />
        </span>
      )}
      {live ? "مباشر" : "غير مباشر"}
    </span>
  );
}

function SyncSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-shimmer h-14 rounded-lg" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

function FieldCheckbox({ field, checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(field)}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold transition-all duration-200 ${
        checked
          ? "bg-primary-50 border-primary text-primary"
          : "border-gray-200 text-text-muted hover:border-gray-300"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:scale-105 active:scale-95"}`}
    >
      {checked ? <CheckSquare className="h-3 w-3" /> : <XCircle className="h-3 w-3 opacity-0" />}
      <span>{FIELD_ICONS[field]}</span>
      {FIELD_LABELS[field]}
    </button>
  );
}

function ProductRow({ product, selected, onToggle, fields, onFieldToggle, onToggleAllFields, onPreviewImages, imageCount }) {
  const [expanded, setExpanded] = useState(false);
  const images = useMemo(() => imgList(product), [product]);
  const rowRef = useRef(null);

  useEffect(() => {
    if (rowRef.current) {
      rowRef.current.classList.add("animate-fade-in");
    }
  }, []);

  const isAllSelected = fields && Object.values(fields).every(Boolean);

  return (
    <div ref={rowRef} className="border-b border-gray-200 last:border-b-0">
      {/* Main row */}
      <div className={`flex items-center gap-3 px-4 py-3 transition-all duration-200 hover:bg-gray-50/50 ${selected ? "bg-primary-50/30" : ""}`}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            checked={selected}
            onChange={onToggle}
          />
        </label>

        {/* Image thumbnails */}
        <div className="relative flex-shrink-0">
          <div
            className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50 border border-gray-200 cursor-pointer group"
            onClick={() => onPreviewImages(product)}
          >
            {images.length > 0 ? (
              <img src={images[0]} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-muted">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
            {imageCount > 1 && (
              <span className="absolute -top-1.5 -left-1.5 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-sm">
                +{imageCount - 1}
              </span>
            )}
          </div>
          {images.length > 0 && (
            <button
              onClick={() => onPreviewImages(product)}
              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Eye className="h-5 w-5 text-white" />
            </button>
          )}
        </div>

        {/* Product info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-text-primary truncate">
              {product.nameAr || product.name}
            </span>
            <span className="text-xs text-text-muted font-bold flex-shrink-0">({product.sku})</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-text-secondary font-medium">
              {product.price?.toLocaleString()} ر.س
            </span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              (product.stock || 0) > 10 ? "bg-success-bg text-success-text" :
              (product.stock || 0) > 0 ? "bg-warning-bg text-warning-text" :
              "bg-danger-bg text-danger-text"
            }`}>
              {product.stock || 0} في المخزون
            </span>
            {imageCount > 0 && (
              <span className="text-xs text-text-muted flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                {imageCount}
              </span>
            )}
          </div>
        </div>

        {/* Field toggles */}
        {fields && (
          <div className="hidden md:flex items-center gap-1.5">
            {Object.entries(fields).map(([key, val]) => (
              <FieldCheckbox
                key={key}
                field={key}
                checked={val}
                onChange={() => onFieldToggle(product.sku, key)}
              />
            ))}
          </div>
        )}

        {/* Toggle details */}
        {fields && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`p-1.5 rounded-lg transition-all duration-200 ${
              expanded ? "bg-primary-50 text-primary rotate-180" : "text-text-muted hover:bg-gray-100"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expanded field details (mobile) */}
      {expanded && fields && (
        <div className="px-4 pb-3 md:hidden animate-slide-down">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button
              onClick={() => onToggleAllFields(product.sku, !isAllSelected)}
              className="text-xs font-bold text-text-link hover:underline"
            >
              {isAllSelected ? "إلغاء الكل" : "تحديد الكل"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(fields).map(([key, val]) => (
              <FieldCheckbox
                key={key}
                field={key}
                checked={val}
                onChange={() => onFieldToggle(product.sku, key)}
              />
            ))}
          </div>
          {/* Image thumbnails in expanded view */}
          {images.length > 0 && (
            <div className="flex gap-2 mt-3">
              {images.map((url, i) => (
                <button
                  key={i}
                  onClick={() => onPreviewImages(product)}
                  className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-primary transition"
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SyncLogRow({ log, index }) {
  return (
    <tr className="border-b border-gray-200 text-sm animate-fade-in" style={{ animationDelay: `${index * 30}ms` }}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {log.direction === "push" ? (
            <Upload className="h-3.5 w-3.5 text-warning-text" />
          ) : (
            <Download className="h-3.5 w-3.5 text-info-text" />
          )}
          <span className="text-text-primary font-bold">{log.direction === "push" ? "رفع" : "سحب"}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
          log.status === "success" ? "bg-success-bg text-success-text" :
          log.status === "partial" ? "bg-warning-bg text-warning-text" :
          "bg-danger-bg text-danger-text"
        }`}>
          {log.status === "success" ? <CheckCircle2 className="h-3 w-3" /> :
           log.status === "partial" ? <AlertCircle className="h-3 w-3" /> :
           <XCircle className="h-3 w-3" />}
          {log.status === "success" ? "ناجح" : log.status === "partial" ? "جزئي" : "فاشل"}
        </span>
      </td>
      <td className="py-3 px-4 text-text-secondary font-medium">{log.items_total || 0}</td>
      <td className="py-3 px-4">
        <span className="text-success-text font-bold">{log.items_succeeded || 0}</span>
        <span className="text-text-muted mx-1">/</span>
        <span className="text-danger-text font-bold">{log.items_failed || 0}</span>
      </td>
      <td className="py-3 px-4 text-text-muted text-xs whitespace-nowrap" title={log.created_at}>
        {timeAgo(log.created_at)}
      </td>
    </tr>
  );
}

/* ─── Conflict diff row ─── */
function ConflictDiffRow({ label, posValue, ecomValue, changed, format }) {
  const displayPos = format ? format(posValue) : (posValue ?? "—");
  const displayEcom = format ? format(ecomValue) : (ecomValue ?? "—");
  return (
    <div className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs transition-all ${
      changed ? "bg-warning-bg/15 border border-warning-border/40" : "bg-gray-50 border border-gray-200"
    }`}>
      <span className="w-16 font-bold text-text-muted flex-shrink-0">{label}</span>
      <span className={`flex-1 px-2 py-1 rounded text-left ${
        changed
          ? "bg-danger-bg/20 text-danger-text font-bold"
          : "text-text-primary"
      }`}>
        {displayPos}
      </span>
      {changed && (
        <span className="flex-shrink-0">
          <ArrowLeftRight className="h-3 w-3 text-warning-text" />
        </span>
      )}
      {!changed && <span className="flex-shrink-0 w-3" />}
      <span className={`flex-1 px-2 py-1 rounded text-left ${
        changed
          ? "bg-success-bg/20 text-success-text font-bold"
          : "text-text-primary"
      }`}>
        {displayEcom}
      </span>
    </div>
  );
}

/* ─── Images Diff Row ─── */
function ImagesDiffRow({ posValue, ecomValue }) {
  const posList = (posValue || []).slice(0, 4);
  const ecomList = (ecomValue || []).slice(0, 4);
  const posCount = (posValue || []).length;
  const ecomCount = (ecomValue || []).length;
  const changed = posCount !== ecomCount || JSON.stringify(posList) !== JSON.stringify(ecomList);

  return (
    <div className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs transition-all ${
      changed ? "bg-warning-bg/15 border border-warning-border/40" : "bg-gray-50 border border-gray-200"
    }`}>
      <span className="w-16 font-bold text-text-muted flex-shrink-0">{"الصور"}</span>
      <div className={`flex-1 flex items-center gap-1 px-2 py-1 rounded min-h-[28px] ${
        changed ? "bg-danger-bg/20" : ""
      }`}>
        {posList.length > 0 ? (
          <div className="flex items-center gap-1">
            {posList.map((url, i) => (
              <img key={i} src={url} alt="" className="w-6 h-6 rounded object-cover border border-gray-200" />
            ))}
            {posCount > 4 && <span className="text-[10px] text-text-muted font-bold">+{posCount - 4}</span>}
          </div>
        ) : (
          <span className="text-danger-text font-bold">—</span>
        )}
      </div>
      {changed && (
        <span className="flex-shrink-0">
          <ArrowLeftRight className="h-3 w-3 text-warning-text" />
        </span>
      )}
      {!changed && <span className="flex-shrink-0 w-3" />}
      <div className={`flex-1 flex items-center gap-1 px-2 py-1 rounded min-h-[28px] ${
        changed ? "bg-success-bg/20" : ""
      }`}>
        {ecomList.length > 0 ? (
          <div className="flex items-center gap-1">
            {ecomList.map((url, i) => (
              <img key={i} src={url} alt="" className="w-6 h-6 rounded object-cover border border-gray-200" />
            ))}
            {ecomCount > 4 && <span className="text-[10px] text-text-muted font-bold">+{ecomCount - 4}</span>}
          </div>
        ) : (
          <span className="text-danger-text font-bold">—</span>
        )}
      </div>
    </div>
  );
}

/* ─── Importance Banner ─── */
function ImportanceBanner() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const cards = [
    {
      icon: ShoppingBag,
      title: t("sync.page.benefit1Title"),
      desc: t("sync.page.benefit1Desc"),
    },
    {
      icon: ImageIcon,
      title: t("sync.page.benefit2Title"),
      desc: t("sync.page.benefit2Desc"),
    },
    {
      icon: Truck,
      title: t("sync.page.benefit3Title"),
      desc: t("sync.page.benefit3Desc"),
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6 animate-fade-in">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/30 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-info-bg flex items-center justify-center">
            <Info className="h-4 w-4 text-info-text" />
          </div>
          <div className="text-right">
            <span className="text-sm font-black text-text-primary">{t("sync.page.whySync")}</span>
            <p className="text-xs text-text-muted mt-0.5">{t("sync.page.whySyncDesc")}</p>
          </div>
        </div>
        <div className={`p-1.5 rounded-lg transition-all duration-300 ${open ? "bg-info-bg/30" : ""}`}>
          {open ? (
            <ChevronUp className="h-4 w-4 text-info-text" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-muted" />
          )}
        </div>
      </button>

      <div
        className={`transition-all duration-400 ease-in-out overflow-hidden ${
          open ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-gray-200 px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {cards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-300"
                  style={{ transitionDelay: `${i * 50}ms` }}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <h4 className="text-xs font-black text-text-primary mb-1">{card.title}</h4>
                  <p className="text-[11px] text-text-secondary leading-relaxed">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Empty State ─── */
function EmptyState({ icon: Icon, title, description, action, actionLabel, onAction }) {
  return (
    <div className="p-16 text-center animate-fade-in">
      <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-5 group hover:bg-primary-50/50 transition-colors duration-300">
        <Icon className="h-9 w-9 text-text-muted group-hover:text-primary transition-colors duration-300" />
      </div>
      <p className="text-base font-black text-text-primary mb-2">{title}</p>
      <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed mb-6">{description}</p>
      {action && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all duration-200 active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/* ─── Sync Progress Bar ─── */
function SyncProgressBar({ active }) {
  if (!active) return null;
  return (
    <div className="w-full h-1 bg-gray-50 rounded-full overflow-hidden mb-4">
      <div className="h-full bg-primary rounded-full animate-progress-indeterminate" />
    </div>
  );
}

/* ─── Branded Not Configured Page ─── */
function NotConfiguredBranding({ onGoToConfig }) {
  const websiteUrl = "elhegazi.vercel.app";

  const websiteFeatures = [
    { icon: Globe, title: "متجر إلكتروني متكامل", desc: "اعرض منتجاتك على موقع إلكتروني احترافي — يعمل على مدار الساعة بدون خبرة تقنية" },
    { icon: ShoppingBag, title: "إدارة المنتجات عن بُعد", desc: "أضف وعدّل منتجاتك من لوحة تحكم الموقع — الأسماء، الأسعار، المخزون، والصور" },
    { icon: Layers, title: "صور متعددة لكل منتج", desc: "ارفع صور متعددة لكل منتج لعرضه بشكل احترافي وجذاب للعملاء" },
    { icon: TrendingUp, title: "تحديث آني للأسعار", desc: "عدّل الأسعار وأضف العروض والتخفيضات على موقعك الإلكتروني مباشرة" },
  ];

  const syncFeatures = [
    { icon: ArrowLeftRight, title: "مزامنة ثنائية الاتجاه", desc: "اربط متجرك الإلكتروني بنظام نقاط البيع — المنتجات، المخزون، الأسعار، والصور في كلا الاتجاهين" },
    { icon: Zap, title: "تحديث المخزون فورياً", desc: "بمجرد بيع منتج في المتجر، يتحدّث المخزون في موقعك الإلكتروني تلقائياً" },
    { icon: Shield, title: "تحكم كامل بالحقول", desc: "اختر الحقول التي تريد مزامنتها — سعر فقط؟ مخزون فقط؟ أو الكل معاً" },
    { icon: Clock, title: "سجل مزامنة واسترجاع", desc: "تتبع كل تغيير تمت مزامنته مع إمكانية الاسترجاع لأي نسخة سابقة بضغطة زر" },
  ];

  return (
    <div className="bg-gray-50">
      {/* ── Branded Hero ── */}
      <div className="relative bg-gradient-to-br from-primary via-primary-600 to-primary/80 text-white overflow-hidden">
        <div className="absolute inset-0 hero-glow-anim opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.3) 0%, transparent 60%), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.15) 0%, transparent 50%)' }} />
        <div className="absolute top-10 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-[float_12s_ease-in-out_infinite]" />
        <div className="absolute bottom-10 right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl animate-[float-reverse_10s_ease-in-out_infinite]" />

        <div className="relative max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-sm font-bold mb-6 animate-fade-in">
            <Globe className="h-4 w-4" />
            {websiteUrl}
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3 animate-slide-up">
            اربط متجرك الإلكتروني
            <br />
            <span className="text-white/80">بنظام البيع والمخزون</span>
          </h1>

          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-8 animate-fade-in" style={{ animationDelay: "150ms" }}>
            موقع {websiteUrl} هو متجرك الإلكتروني — أدر منتجاتك وأسعارك ومخزونك من لوحة التحكم، ثم زامنها مع تطبيق نقاط البيع على جهازك.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 animate-slide-up" style={{ animationDelay: "300ms" }}>
            <button
              onClick={onGoToConfig}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-white text-primary rounded-2xl text-sm font-black hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg shadow-primary/20"
            >
              <Settings2 className="h-4 w-4" />
              ابدأ إعداد المزامنة
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <a
              href="https://elhegazi.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 border-2 border-white/30 backdrop-blur-sm rounded-2xl text-sm font-black hover:bg-white/10 hover:border-white/50 active:scale-95 transition-all duration-300"
            >
              <Download className="h-4 w-4" />
              اطلب تطبيق POS
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="flex items-center justify-center gap-6 text-white/50 text-xs animate-fade-in" style={{ animationDelay: "400ms" }}>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> بدون تعقيد</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> دقيقة وموثوقة</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> متوافقة مع AR</span>
          </div>
        </div>
      </div>

      {/* ── Website Capabilities ── */}
      <div className="max-w-5xl mx-auto px-6 -mt-10 relative z-10 mb-8">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-6 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-info-bg/60 flex items-center justify-center">
              <Globe className="h-4 w-4 text-info-text" />
            </div>
            <div>
              <h2 className="text-sm font-black text-text-primary">موقع {websiteUrl} الإلكتروني</h2>
              <p className="text-xs text-text-muted">ما يوفره موقع متجرك الإلكتروني من إمكانيات</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {websiteFeatures.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 border border-gray-200 hover:border-info-border/40 hover:bg-info-bg/5 transition-all duration-300">
                  <div className="w-9 h-9 rounded-lg bg-info-bg/40 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-info-text" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-text-primary mb-0.5">{feat.title}</h3>
                    <p className="text-[11px] text-text-secondary leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sync Capabilities ── */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-black text-text-primary">مزامنة تطبيق POS مع الموقع</h2>
              <p className="text-xs text-text-muted">ميزات إضافية عند ربط التطبيق بموقعك الإلكتروني</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {syncFeatures.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 border border-gray-200 hover:border-primary/30 hover:bg-primary-50/30 transition-all duration-300">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-text-primary mb-0.5">{feat.title}</h3>
                    <p className="text-[11px] text-text-secondary leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div className="max-w-3xl mx-auto px-6 pb-16 text-center">
        <div className="bg-gradient-to-r from-primary/5 via-primary-50 to-primary/5 rounded-3xl border border-primary/20 p-8">
          <h3 className="text-lg font-black text-text-primary mb-2">ابدأ الآن — مجاناً</h3>
          <p className="text-sm text-text-secondary mb-6 max-w-lg mx-auto">
            حمل تطبيق POS واربط متجرك الإلكتروني في دقائق. فريق الدعم الفني جاهز لمساعدتك على مدار الساعة.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onGoToConfig}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-black hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
              <Settings2 className="h-4 w-4" />
              إعداد المزامنة
            </button>
            <a
              href="https://elhegazi.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-300 rounded-xl text-sm font-black text-text-secondary hover:bg-gray-100 active:scale-95 transition-all"
            >
              <Download className="h-4 w-4" />
              طلب التطبيق
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function SyncPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    config, configured, connected, status, checking,
    available, pendingChanges, logs,
    setConfig, setStatus, setChecking, setAvailable,
    setPendingChanges, setLogs, setError,
    fieldSelections, toggleField, toggleAllFields,
    imagePreview, openImagePreview, closeImagePreview, setImagePreviewIndex,
    selectedImages, setSelectedImages,
  } = useSyncStore();

  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [selectedSkus, setSelectedSkus] = useState(new Set());
  const [searchQ, setSearchQ] = useState("");
  const [activeTab, setActiveTab] = useState("available");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPreviews, setReviewPreviews] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  const [conflicts, setConflicts] = useState([]);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [resolvingSku, setResolvingSku] = useState(null);

  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsTotal, setSnapshotsTotal] = useState(0);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsPage, setSnapshotsPage] = useState(1);
  const [previewData, setPreviewData] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [rollbackState, setRollbackState] = useState("idle");
  const [rollbackProgress, setRollbackProgress] = useState({ current: 0, total: 0 });
  const [selectedSnapshotId, setSelectedSnapshotId] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, checkRes, logsRes, pendingRes, conflictsRes] = await Promise.all([
        getSyncStatus().catch(() => null),
        getSyncCheck().catch(() => null),
        getSyncLogs(50).catch(() => null),
        getPendingChanges().catch(() => null),
        getConflicts().catch(() => null),
      ]);

      if (statusRes) setStatus(statusRes);
      if (checkRes) setAvailable(checkRes);
      if (logsRes) setLogs(logsRes.items || []);
      if (pendingRes) setPendingChanges(pendingRes.items || []);
      if (conflictsRes) setConflicts(conflictsRes.conflicts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [setStatus, setAvailable, setLogs, setPendingChanges, setError]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadSnapshots = useCallback(async (page = 1) => {
    setSnapshotsLoading(true);
    try {
      const res = await getSnapshots(page, 20);
      if (res.ok) {
        setSnapshots(prev => page === 1 ? (res.items || []) : [...prev, ...(res.items || [])]);
        setSnapshotsTotal(res.total || 0);
        setSnapshotsPage(page);
      }
    } catch {
      // silently fail
    } finally {
      setSnapshotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "rollback") {
      loadSnapshots(1);
    }
  }, [activeTab, loadSnapshots]);

  /* Review selected products before pulling */
  const openReview = async () => {
    if (!selectedSkus.size) {
      toast.error("اختر منتجات على الأقل للسحب");
      return;
    }

    const filteredSkus = [...selectedSkus].filter((sku) => {
      const sel = fieldSelections[sku];
      return sel && Object.values(sel).some(Boolean);
    });

    if (filteredSkus.length === 0) {
      toast.error("جميع المنتجات المحددة ليس لديها حقول مفعلة");
      return;
    }

    setReviewLoading(true);
    setReviewOpen(true);
    try {
      const fieldsToSend = {};
      for (const sku of filteredSkus) {
        fieldsToSend[sku] = fieldSelections[sku];
      }
      const res = await previewPull(filteredSkus, fieldsToSend);
      setReviewPreviews(res.previews || []);
    } catch {
      toast.error("فشل تحميل معاينة التغييرات");
      setReviewOpen(false);
    } finally {
      setReviewLoading(false);
    }
  };

  /* Confirm pull after review */
  const confirmPull = async () => {
    setPulling(true);
    try {
      const filteredSkus = reviewPreviews.map((p) => p.sku);
      const fieldsToSend = {};
      for (const sku of filteredSkus) {
        fieldsToSend[sku] = fieldSelections[sku];
      }
      const res = await pullProducts(filteredSkus, fieldsToSend);
      if (res.ok) {
        toast.success(`تم سحب ${res.imported?.length || 0} منتج بنجاح`);
        setSelectedSkus(new Set());
        setReviewOpen(false);
        setReviewPreviews([]);
        loadAll();
      }
    } catch {
      toast.error("فشلت عملية السحب");
    } finally {
      setPulling(false);
    }
  };

  const cancelReview = () => {
    setReviewOpen(false);
    setReviewPreviews([]);
  };

  /* Conflict resolution */
  const handleResolveConflict = async (sku, resolution) => {
    setResolvingSku(sku);
    try {
      const apiResolution = resolution === "keep_both" ? "skip" : resolution;
      const res = await resolveConflict(sku, apiResolution);
      if (res.ok) {
        const actionLabel = resolution === "keep_ecom" ? "تم تطبيق نسخة الموقع" :
          resolution === "keep_pos" ? "تم تطبيق نسخة المتجر" :
          resolution === "keep_both" ? "تم الاحتفاظ بكلا الإصدارين" : "تم تخطي التعارض";
        toast.success(`تم حل التعارض للمنتج ${sku}: ${actionLabel}`);
        const conflictsRes = await getConflicts();
        if (conflictsRes) setConflicts(conflictsRes.conflicts || []);
        loadAll();
      }
    } catch {
      toast.error("فشل حل التعارض");
    } finally {
      setResolvingSku(null);
    }
  };

  /* Push with field detail */
  const handlePush = async () => {
    setPushing(true);
    try {
      const items = pendingChanges.map((ch) => ({
        sku: ch.item_code,
        fields: { [ch.field_name]: ch.new_value },
      }));
      const res = await applySync({ items });
      if (res.ok) {
        toast.success(`تم رفع ${res.succeeded?.length || 0} تغيير بنجاح`);
        loadAll();
      }
    } catch {
      toast.error("فشلت عملية الرفع");
    } finally {
      setPushing(false);
    }
  };

  const toggleSku = (sku) => {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  };

  const filteredProducts = useMemo(() => {
    const products = available.products || [];
    if (!searchQ.trim()) return products;
    const q = searchQ.trim().toLowerCase();
    return products.filter(
      (p) =>
        (p.nameAr || "").toLowerCase().includes(q) ||
        (p.name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        String(p.price || "").includes(q)
    );
  }, [available.products, searchQ]);

  const filteredPending = useMemo(() => {
    const items = pendingChanges || [];
    if (!searchQ.trim()) return items;
    const q = searchQ.trim().toLowerCase();
    return items.filter(
      (ch) =>
        (ch.item_name || "").toLowerCase().includes(q) ||
        (ch.item_code || "").toLowerCase().includes(q) ||
        (ch.field_name || "").toLowerCase().includes(q)
    );
  }, [pendingChanges, searchQ]);

  const getFilteredLogs = useCallback(() => {
    let items = logs || [];
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      items = items.filter(
        (l) =>
          (l.direction || "").toLowerCase().includes(q) ||
          (l.status || "").toLowerCase().includes(q)
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      items = items.filter((l) => l.created_at && new Date(l.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      items = items.filter((l) => l.created_at && new Date(l.created_at) <= to);
    }
    if (statusFilter !== "all") {
      items = items.filter((l) => l.status === statusFilter);
    }
    return items;
  }, [logs, searchQ, dateFrom, dateTo, statusFilter]);

  /* ─── Not configured: branded page → navigate to config wizard ─── */
  if (!configured) {
    return <NotConfiguredBranding onGoToConfig={() => navigate("/sync/config")} />;
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="animate-shimmer w-8 h-8 rounded-lg" />
            <div className="animate-shimmer w-48 h-6 rounded-lg" />
          </div>
          <div className="animate-shimmer w-32 h-8 rounded-full" />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <SyncSkeleton rows={6} />
        </div>
      </div>
    );
  }

  /* ─── Main tabs ─── */
  const tabs = [
    { id: "available", label: "متاح من الموقع", count: available.products?.length || 0, icon: Download },
    { id: "pending", label: "تغييرات محلية", count: pendingChanges?.length || 0, icon: Upload },
    { id: "logs", label: "سجل المزامنة", count: logs?.length || 0, icon: Clock },
    { id: "rollback", label: t("sync.rollback.title"), count: snapshotsTotal, icon: Undo2 },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ── Image Preview Modal ── */}
      <ImagePreviewModal
        product={imagePreview.product}
        open={imagePreview.open}
        onClose={closeImagePreview}
        onSelectImages={(sku, imgs) => setSelectedImages(sku, imgs)}
        selectedImages={selectedImages[imagePreview.product?.sku]}
      />

      {/* ── Review Modal ── */}
      <ReviewModal
        open={reviewOpen}
        previews={reviewPreviews}
        loading={reviewLoading}
        onConfirm={confirmPull}
        onCancel={cancelReview}
        onBack={() => { setReviewOpen(false); setReviewPreviews([]); }}
      />

      {/* ── Header ── */}
      <div className="relative mb-6 animate-fade-in">
        {/* Subtle gradient accent bar */}
        <div className="absolute -top-6 -left-6 -right-6 h-2 bg-gradient-to-l from-primary via-primary-600 to-primary/60 rounded-t-2xl opacity-60" />

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center relative group">
              <div className="absolute inset-0 rounded-xl bg-primary-50 animate-ping opacity-20 group-hover:opacity-30" style={{ animationDuration: "3s" }} />
              <ArrowLeftRight className="h-5 w-5 text-primary relative z-10" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-success-text rounded-full border-2 border-bg-page flex items-center justify-center">
                <RefreshCw className="h-2 w-2 text-white animate-spin" style={{ animationDuration: "4s" }} />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-text-primary">{t("sync.title")}</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary rounded-full text-[10px] font-bold leading-none">
                  <RefreshCw className="h-2.5 w-2.5" />
                  {t("sync.page.badge")}
                </span>
              </div>
              {status && (
                <p className="text-xs text-text-muted mt-0.5">
                  آخر مزامنة: {status.lastSyncAt ? timeAgo(status.lastSyncAt) : "لم تتم بعد"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RealtimeBadge />
            <StatusBadge connected={connected} pulse={loading} />
            <button
              onClick={() => navigate("/sync/config")}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-text-secondary hover:bg-gray-100 hover:border-primary transition-all duration-200"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {t("sync.configShort")}
            </button>
            <button
              onClick={loadAll}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-text-secondary hover:bg-gray-100 disabled:opacity-50 transition-all duration-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {t("sync.refresh")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Connection summary cards ── */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 animate-slide-up">
          {[
            { label: "حالة الاتصال", value: connected ? "متصل" : "غير متصل", color: connected ? "bg-success-bg text-success-text" : "bg-danger-bg text-danger-text", icon: connected ? CheckCircle2 : XCircle },
            { label: "منتجات الموقع", value: status.ecomStatus?.totalProducts ?? "-", color: "bg-info-bg text-info-text", icon: ShoppingBag },
            { label: "تغييرات معلقة", value: status.pendingChanges ?? 0, color: (status.pendingChanges || 0) > 0 ? "bg-warning-bg text-warning-text" : "bg-gray-50 text-text-secondary", icon: AlertCircle },
            { label: "آخر مزامنة", value: status.lastSyncAt ? timeAgo(status.lastSyncAt) : "—", color: "bg-gray-50 text-text-secondary", icon: Clock },
          ].map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 animate-fade-in hover:shadow-elevated transition-all duration-300" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{card.label}</span>
                  <Icon className={`h-4 w-4 ${card.color.split(" ")[1]} ${i === 0 ? "animate-pulse" : ""}`} />
                </div>
                <div className={`text-lg font-black ${card.color.split(" ").slice(1).join(" ")}`}>
                  {card.value}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Importance Banner ── */}
      <ImportanceBanner />

      {/* ── Sync Progress ── */}
      <SyncProgressBar active={pulling || pushing} />

      {/* ── Conflicts section ── */}
      {conflicts.length > 0 && (
        <div className="mb-4 animate-slide-up">
          <div className="bg-danger-bg/20 border border-danger-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-danger-bg flex items-center justify-center">
                  <Scale className="h-5 w-5 text-danger-text" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-danger-text">{conflicts.length} تعارض — تعديل نفس المنتج في المتجر والموقع</h3>
                  <p className="text-xs text-text-secondary mt-0.5">اختر أي نسخة تريد الاحتفاظ بها لكل منتج</p>
                </div>
              </div>
              <span className="text-xs text-text-muted bg-gray-50 px-2 py-1 rounded-full font-bold">{conflicts.length} منتج</span>
            </div>
            <div className="border-t border-danger-border/30 divide-y divide-danger-border/20">
              {conflicts.map((c, i) => (
                <div key={c.sku} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <ConflictCard
                    conflict={c}
                    resolvingSku={resolvingSku}
                    onResolve={handleResolveConflict}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Search + Filters + Bulk actions ── */}
      <div className="flex items-center gap-3 mb-4 animate-fade-in flex-wrap">
        <div className="relative flex-[2] min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            className="w-full pr-10 pl-4 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
            placeholder={
              activeTab === "available" ? "بحث في المنتجات المتاحة…" :
              activeTab === "pending" ? "بحث في التغييرات المعلقة…" :
              "بحث في سجل المزامنة…"
            }
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>

        {activeTab === "logs" && (
          <>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-xl text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <span className="text-xs text-text-muted">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-xl text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-1">
              {["all", "success", "failed", "partial"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === s
                      ? "bg-primary text-white"
                      : "bg-gray-50 text-text-muted hover:text-text-secondary border border-gray-200"
                  }`}
                >
                  {s === "all" ? "الكل" : s === "success" ? "نجاح" : s === "failed" ? "فشل" : "جزئي"}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const filtered = getFilteredLogs();
                if (filtered.length === 0) {
                  toast.error("لا توجد سجلات للتصدير");
                  return;
                }
                const headers = "الاتجاه,الحالة,الإجمالي,ناجح,فاشل,التاريخ";
                const rows = filtered.map((l) =>
                  [
                    l.direction === "push" ? "رفع" : "سحب",
                    l.status === "success" ? "نجاح" : l.status === "partial" ? "جزئي" : "فشل",
                    l.items_total || 0,
                    l.items_succeeded || 0,
                    l.items_failed || 0,
                    l.created_at || "",
                  ].join(",")
                );
                const csv = [headers, ...rows].join("\n");
                const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `sync-logs-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success(`تم تصدير ${filtered.length} سجل`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-text-secondary hover:bg-gray-100 hover:border-primary transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              تصدير
            </button>
          </>
        )}

        {selectedSkus.size > 0 && activeTab === "available" && (
          <div className="flex items-center gap-2 bg-primary-50 px-3 py-1.5 rounded-xl animate-slide-up">
            <span className="text-xs font-bold text-primary">{selectedSkus.size} محدد</span>
            <button
              onClick={() => setSelectedSkus(new Set())}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2.5 text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                activeTab === tab.id
                  ? "text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === tab.id ? "bg-primary-50 text-primary" : "bg-gray-50 text-text-muted"
                }`}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Direction explanation: Pull ── */}
      {activeTab === "available" && (
        <div className="mb-3 p-3 rounded-xl bg-info-bg/15 border border-info-border/30 flex items-start gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-lg bg-info-bg/50 flex items-center justify-center shrink-0">
            <Download className="h-4 w-4 text-info-text" />
          </div>
          <div className="text-xs text-text-secondary leading-relaxed">
            <span className="font-bold text-text-primary">سحب من الموقع ← التطبيق: </span>
            اختر المنتجات التي تريد استيرادها من موقعك الإلكتروني إلى نظام نقاط البيع. يمكنك التحكم بالحقول (الاسم، السعر، المخزون، الصور) لكل منتج على حدة. يستخدم عند بدء الربط لأول مرة أو عند إضافة منتجات جديدة في الموقع.
          </div>
        </div>
      )}

      {/* ── Tab: Available products ── */}
      {activeTab === "available" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-slide-up">
          {filteredProducts.length > 0 ? (
            <>
              {/* Table header */}
              <div className="hidden md:flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-text-muted uppercase tracking-wider">
                <div className="w-4" />
                <div className="w-12" />
                <div className="flex-1">المنتج</div>
                <div className="flex items-center gap-1.5">
                  <span>الحقول</span>
                  <button
                    onClick={() => {
                      const allOn = filteredProducts.every((p) => {
                        const f = fieldSelections[p.sku];
                        return f && Object.values(f).every(Boolean);
                      });
                      filteredProducts.forEach((p) => toggleAllFields(p.sku, !allOn));
                    }}
                    className="text-text-link hover:underline text-[10px]"
                  >
                    (تحديد الكل)
                  </button>
                </div>
                <div className="w-8" />
              </div>

              {/* Products */}
              {filteredProducts.map((product, i) => (
                <div key={product.sku} style={{ animationDelay: `${i * 30}ms` }}>
                  <ProductRow
                    product={product}
                    selected={selectedSkus.has(product.sku)}
                    onToggle={() => toggleSku(product.sku)}
                    fields={fieldSelections[product.sku]}
                    onFieldToggle={toggleField}
                    onToggleAllFields={toggleAllFields}
                    onPreviewImages={(p) => openImagePreview(p, 0)}
                    imageCount={imgList(product).length}
                  />
                </div>
              ))}

              {/* Pull button bar */}
              <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">
                    {selectedSkus.size} من {filteredProducts.length} منتج محدد
                  </span>
                  {selectedSkus.size > 0 && (
                    <button
                      onClick={() => setSelectedSkus(new Set(filteredProducts.map((p) => p.sku)))}
                      className="text-xs font-bold text-text-link hover:underline"
                    >
                      تحديد الكل
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const allOn = filteredProducts.every((p) => {
                        const f = fieldSelections[p.sku];
                        return f && Object.values(f).every(Boolean);
                      });
                      filteredProducts.forEach((p) => toggleAllFields(p.sku, !allOn));
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-text-secondary hover:bg-gray-100 transition"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    تفعيل/إلغاء الكل
                  </button>
                  <button
                    onClick={openReview}
                    disabled={pulling || !selectedSkus.size}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
                  >
                    {pulling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
                    {pulling ? "جاري السحب…" : "مراجعة وسحب"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={EmptyAvailableIcon}
              title={t("sync.page.empty.available.title")}
              description={t("sync.page.empty.available.desc")}
            />
          )}
        </div>
      )}

      {/* ── Direction explanation: Push ── */}
      {activeTab === "pending" && (
        <div className="mb-3 p-3 rounded-xl bg-warning-bg/15 border border-warning-border/30 flex items-start gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-lg bg-warning-bg/50 flex items-center justify-center shrink-0">
            <Upload className="h-4 w-4 text-warning-text" />
          </div>
          <div className="text-xs text-text-secondary leading-relaxed">
            <span className="font-bold text-text-primary">رفع من التطبيق ← الموقع: </span>
            التغييرات التي أجريتها في نظام نقاط البيع (تعديل أسعار، تغيير مخزون، إضافة منتجات) وتنتظر الرفع إلى موقعك الإلكتروني. راجع التغييرات ثم اضغط "رفع الكل" لمزامنتها مع المتجر.
          </div>
        </div>
      )}

      {/* ── Tab: Pending changes ── */}
      {activeTab === "pending" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-slide-up">
          {filteredPending.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="py-3 px-4 text-right text-xs font-bold text-text-muted uppercase tracking-wider">{t("sync.item")}</th>
                      <th className="py-3 px-4 text-right text-xs font-bold text-text-muted uppercase tracking-wider">{t("sync.field")}</th>
                      <th className="py-3 px-4 text-right text-xs font-bold text-text-muted uppercase tracking-wider">{t("sync.oldValue")}</th>
                      <th className="py-3 px-4 text-right text-xs font-bold text-text-muted uppercase tracking-wider">{t("sync.newValue")}</th>
                      <th className="py-3 px-4 text-right text-xs font-bold text-text-muted uppercase tracking-wider">{t("sync.date")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPending.map((change, i) => (
                      <tr key={change.id} className="border-b border-gray-200 hover:bg-gray-50/50 transition animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                        <td className="py-3 px-4">
                          <span className="text-text-primary font-bold">{change.item_name}</span>
                          <span className="text-text-muted text-xs mr-1">({change.item_code})</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 rounded-md text-xs font-bold text-text-secondary">
                            {change.field_name}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-text-muted max-w-[150px] truncate">{change.old_value || "—"}</td>
                        <td className="py-3 px-4 text-text-primary font-medium max-w-[150px] truncate">
                          <span className="bg-success-bg/50 px-1.5 py-0.5 rounded text-success-text">{change.new_value}</span>
                        </td>
                        <td className="py-3 px-4 text-text-muted text-xs whitespace-nowrap" title={change.created_at}>
                          {timeAgo(change.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-gray-200 flex justify-end bg-gray-50/50">
                <button
                  onClick={handlePush}
                  disabled={pushing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
                >
                  {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {t("sync.pushAll")}
                </button>
              </div>
            </>
          ) : (
            <EmptyState
              icon={EmptyPendingIcon}
              title={t("sync.page.empty.pending.title")}
              description={t("sync.page.empty.pending.desc")}
            />
          )}
        </div>
      )}

      {/* ── Tab: Logs ── */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-slide-up">
          {getFilteredLogs().length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="py-3 px-4 text-right text-xs font-bold text-text-muted uppercase tracking-wider">{t("sync.direction")}</th>
                      <th className="py-3 px-4 text-right text-xs font-bold text-text-muted uppercase tracking-wider">{t("sync.status")}</th>
                      <th className="py-3 px-4 text-right text-xs font-bold text-text-muted uppercase tracking-wider">{t("sync.total")}</th>
                      <th className="py-3 px-4 text-right text-xs font-bold text-text-muted uppercase tracking-wider">ناجح / فاشل</th>
                      <th className="py-3 px-4 text-right text-xs font-bold text-text-muted uppercase tracking-wider">{t("sync.date")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredLogs().map((log, i) => <SyncLogRow key={log.id} log={log} index={i} />)}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState
              icon={EmptyLogsIcon}
              title={t("sync.page.empty.logs.title")}
              description={t("sync.page.empty.logs.desc")}
            />
          )}
        </div>
      )}

      {/* ── Direction explanation: Rollback ── */}
      {activeTab === "rollback" && (
        <div className="mb-3 p-3 rounded-xl bg-danger-bg/15 border border-danger-border/30 flex items-start gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-lg bg-danger-bg/50 flex items-center justify-center shrink-0">
            <Undo2 className="h-4 w-4 text-danger-text" />
          </div>
          <div className="text-xs text-text-secondary leading-relaxed">
            <span className="font-bold text-text-primary">استرجاع المزامنات السابقة: </span>
            كل عملية مزامنة (سحب أو رفع) تنشئ "لقطة" احتياطية. يمكنك استرجاع أي لقطة سابقة لإعادة المنتجات إلى حالتها قبل المزامنة. مفيد في حال حدوث خطأ بعد المزامنة.
          </div>
        </div>
      )}

      {/* ── Tab: Rollback ── */}
      {activeTab === "rollback" && (
        <RollbackTab
          t={t}
          snapshots={snapshots}
          snapshotsTotal={snapshotsTotal}
          snapshotsLoading={snapshotsLoading}
          snapshotsPage={snapshotsPage}
          onLoadMore={() => loadSnapshots(snapshotsPage + 1)}
          onRefresh={() => loadSnapshots(1)}
          previewOpen={previewOpen}
          previewData={previewData}
          previewLoading={previewLoading}
          rollbackState={rollbackState}
          rollbackProgress={rollbackProgress}
          selectedSnapshotId={selectedSnapshotId}
          setPreviewOpen={setPreviewOpen}
          setPreviewData={setPreviewData}
          setPreviewLoading={setPreviewLoading}
          setRollbackState={setRollbackState}
          setRollbackProgress={setRollbackProgress}
          setSelectedSnapshotId={setSelectedSnapshotId}
        />
      )}
    </div>
  );
}

/* ─── Rollback Tab ─── */
function RollbackTab({
  t, snapshots, snapshotsTotal, snapshotsLoading, snapshotsPage, onLoadMore, onRefresh,
  previewOpen, previewData, previewLoading, rollbackState, rollbackProgress,
  selectedSnapshotId, setPreviewOpen, setPreviewData, setPreviewLoading,
  setRollbackState, setRollbackProgress, setSelectedSnapshotId,
}) {
  const handlePreview = async (snapshot) => {
    setSelectedSnapshotId(snapshot.id);
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const res = await previewRollback(snapshot.id);
      if (res.ok) {
        setPreviewData({
          snapshot,
          itemsToDelete: res.itemsToDelete,
          itemsToRestore: res.itemsToRestore,
          pricesToRevert: res.pricesToRevert,
          stockToRevert: res.stockToRevert,
        });
      }
    } catch {
      toast.error("فشل تحميل معاينة الاسترجاع");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRollback = async (snapshotId) => {
    setSelectedSnapshotId(snapshotId);
    setRollbackState("rolling_back");
    setRollbackProgress({ current: 0, total: 100 });
    try {
      const res = await executeRollback(snapshotId);
      if (res.ok) {
        setRollbackProgress({ current: res.restored_count, total: res.restored_count });
        setRollbackState("done");
        toast.success(t("sync.rollback.success"));
        onRefresh();
      } else {
        setRollbackState("failed");
        toast.error(t("sync.rollback.failed"));
      }
    } catch {
      setRollbackState("failed");
      toast.error(t("sync.rollback.failed"));
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewData(null);
    setSelectedSnapshotId(null);
  };

  const directionIcon = (direction) => {
    if (direction === "pull") return <Download className="h-4 w-4 text-info-text" />;
    if (direction === "push") return <Upload className="h-4 w-4 text-warning-text" />;
    return <Undo2 className="h-4 w-4 text-danger-text" />;
  };

  const parseMeta = (snap) => {
    if (!snap.metadata) return null;
    try {
      return typeof snap.metadata === "string" ? JSON.parse(snap.metadata) : snap.metadata;
    } catch {
      return null;
    }
  };

  if (snapshotsLoading && snapshots.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center animate-slide-up">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
        <p className="text-sm text-text-muted">جاري تحميل لقطات الاسترجاع...</p>
      </div>
    );
  }

  return (
    <>
      {/* Rollback Preview Modal */}
      {previewOpen && (
        <RollbackPreviewModal
          t={t}
          previewData={previewData}
          previewLoading={previewLoading}
          onClose={closePreview}
          onConfirm={() => {
            setPreviewOpen(false);
            handleRollback(selectedSnapshotId);
          }}
        />
      )}

      {/* Rollback in-progress overlay */}
      {rollbackState === "rolling_back" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />
          <div className="relative bg-white rounded-3xl shadow-modal border border-gray-200 w-full max-w-md p-8 text-center animate-slide-up">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-base font-black text-text-primary mb-2">{t("sync.rollback.inProgress")}</h3>
            <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (rollbackProgress.current / Math.max(1, rollbackProgress.total)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-text-muted">
              تم استرجاع {rollbackProgress.current} من {rollbackProgress.total}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-5 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-danger-bg flex items-center justify-center">
              <Undo2 className="h-4 w-4 text-danger-text" />
            </div>
            <h3 className="text-base font-black text-text-primary">{t("sync.rollback.title")}</h3>
            {snapshotsTotal > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-text-muted">
                {snapshotsTotal}
              </span>
            )}
          </div>
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg text-text-muted hover:bg-gray-100 hover:text-text-primary transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${snapshotsLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <p className="text-xs text-text-secondary">{t("sync.rollback.subtitle")}</p>
      </div>

      {/* Snapshots list */}
      {snapshots.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center animate-slide-up">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Undo2 className="h-7 w-7 text-text-muted" />
          </div>
          <p className="text-base font-black text-text-primary mb-2">{t("sync.rollback.noSnapshots")}</p>
          <p className="text-sm text-text-secondary max-w-md mx-auto">{t("sync.rollback.noSnapshotsDesc")}</p>
        </div>
      ) : (
        <div className="space-y-3 animate-slide-up">
          {snapshots.map((snap, i) => {
            const meta = parseMeta(snap);
            return (
              <div
                key={snap.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 hover:shadow-elevated transition-all duration-200 animate-fade-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    snap.direction === "pull" ? "bg-info-bg" :
                    snap.direction === "push" ? "bg-warning-bg" :
                    "bg-danger-bg"
                  }`}>
                    {directionIcon(snap.direction)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-text-primary">
                        {snap.direction === "pull" ? t("sync.rollback.pull") : snap.direction === "push" ? t("sync.rollback.push") : t("sync.rollback.rollback")}
                      </span>
                      <span className="text-xs text-text-muted font-bold">
                        {timeAgo(snap.created_at)}
                      </span>
                      <span className="text-xs text-text-secondary font-bold">
                        — {snap.items_count || 0} منتج
                      </span>
                    </div>
                    {meta && (
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {meta.newProducts > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success-bg/30 text-success-text rounded-full text-[10px] font-bold">
                            {meta.newProducts} {t("sync.rollback.newProducts")}
                          </span>
                        )}
                        {meta.pricesChanged > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-info-bg/30 text-info-text rounded-full text-[10px] font-bold">
                            {meta.pricesChanged} {t("sync.rollback.pricesChanged")}
                          </span>
                        )}
                        {meta.stockChanged > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warning-bg/30 text-warning-text rounded-full text-[10px] font-bold">
                            {meta.stockChanged} {t("sync.rollback.stockChanged")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedSnapshotId(snap.id);
                        handlePreview(snap);
                      }}
                      disabled={rollbackState === "rolling_back"}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-text-secondary hover:bg-gray-100 hover:border-primary transition-all disabled:opacity-50"
                    >
                      {t("sync.rollback.preview")}
                    </button>
                    <button
                      onClick={() => handleRollback(snap.id)}
                      disabled={rollbackState === "rolling_back" || snap.direction === "rollback"}
                      className="px-3 py-1.5 bg-warning-bg text-warning-text rounded-lg text-xs font-bold hover:opacity-80 disabled:opacity-50 transition-all active:scale-95 inline-flex items-center gap-1"
                    >
                      <Undo2 className="h-3 w-3" />
                      {t("sync.rollback.rollback")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {snapshotsTotal > snapshots.length && (
            <div className="text-center pt-2">
              <button
                onClick={onLoadMore}
                disabled={snapshotsLoading}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-text-secondary hover:bg-gray-100 transition-all disabled:opacity-50"
              >
                {snapshotsLoading ? <Loader2 className="h-3 w-3 animate-spin inline ml-1" /> : null}
                عرض المزيد ({snapshotsTotal - snapshots.length} متبقي)
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ─── Rollback Preview Modal ─── */
function RollbackPreviewModal({ t, previewData, previewLoading, onClose, onConfirm }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  const data = previewData;
  const totalAffected = (data?.itemsToDelete || 0) + (data?.itemsToRestore || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => { setOpen(false); onClose(); }} />
      <div className="relative bg-white rounded-3xl shadow-modal border border-gray-200 w-full max-w-lg animate-slide-up overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-danger-bg flex items-center justify-center">
              <Undo2 className="h-5 w-5 text-danger-text" />
            </div>
            <div>
              <h3 className="text-base font-black text-text-primary">{t("sync.rollback.preview")}</h3>
              {data?.snapshot?.created_at && (
                <p className="text-xs text-text-muted mt-0.5">
                  {timeAgo(data.snapshot.created_at)}
                </p>
              )}
            </div>
          </div>
        </div>

        {previewLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-text-muted">جاري تحميل المعاينة...</p>
          </div>
        ) : data ? (
          <>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-text-secondary">
                سيعيد {totalAffected} منتج إلى حالتها قبل المزامنة
              </p>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-danger-bg/20 border border-danger-border/30">
                  <span className="text-xl font-black text-danger-text">{data.itemsToDelete}</span>
                  <span className="text-[10px] font-bold text-danger-text text-center leading-tight">{t("sync.rollback.itemsToDelete")}</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-info-bg/20 border border-info-border/30">
                  <span className="text-xl font-black text-info-text">{data.itemsToRestore}</span>
                  <span className="text-[10px] font-bold text-info-text text-center leading-tight">{t("sync.rollback.itemsToRestore")}</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-warning-bg/20 border border-warning-border/30">
                  <span className="text-xl font-black text-warning-text">{data.pricesToRevert + data.stockToRevert}</span>
                  <span className="text-[10px] font-bold text-warning-text text-center leading-tight">{t("sync.rollback.pricesToRevert")}/{t("sync.rollback.stockToRevert")}</span>
                </div>
              </div>

              {data.itemsToDelete > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-danger-bg/15 border border-danger-border/40">
                  <AlertCircle className="h-4 w-4 text-danger-text shrink-0 mt-0.5" />
                  <p className="text-xs text-danger-text font-medium">
                    {t("sync.rollback.warning", { count: data.itemsToDelete })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/30">
              <button
                onClick={() => { setOpen(false); onClose(); }}
                className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-text-secondary hover:bg-gray-100 transition-all active:scale-95"
              >
                {t("sync.rollback.cancel")}
              </button>
              <button
                onClick={() => { setOpen(false); onConfirm(); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-warning-bg text-warning-text rounded-xl text-sm font-bold hover:opacity-90 transition-all active:scale-95 shadow-sm"
              >
                <Undo2 className="h-4 w-4" />
                {t("sync.rollback.confirmRollback")}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Conflict Card ─── */
function ConflictCard({ conflict: c, resolvingSku, onResolve }) {
  const { t } = useTranslation();
  const [showDiff, setShowDiff] = useState(false);
  const [imgError, setImgError] = useState(false);
  const diffs = useMemo(() => computeDiffs(c), [c]);
  const changedCount = useMemo(() => diffs.filter((d) => d.changed).length, [diffs]);

  return (
    <div className="px-4 py-3 hover:bg-danger-bg/10 transition">
      <div className="flex items-center gap-4">
        {/* Thumbnail */}
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-50 border border-gray-200 flex-shrink-0">
          {!imgError && (c.pos?.image || c.ecom?.image) ? (
            <img
              src={c.pos?.image || c.ecom?.image}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-text-primary truncate">{c.name}</span>
            <span className="text-xs text-text-muted font-bold">({c.sku})</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <span className="font-bold text-text-secondary">{t("sync.page.conflict.posVersion")}:</span>
              {c.pos?.name}
            </span>
            <ArrowLeftRight className="h-3 w-3 text-danger-text" />
            <span className="flex items-center gap-1">
              <span className="font-bold text-text-secondary">{t("sync.page.conflict.ecomVersion")}:</span>
              {c.ecom?.name}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onResolve(c.sku, "keep_pos")}
            disabled={resolvingSku === c.sku}
            className="px-2.5 py-1.5 bg-success-bg text-success-text rounded-lg text-xs font-bold hover:opacity-80 disabled:opacity-50 transition-all active:scale-95"
          >
            {resolvingSku === c.sku ? <Loader2 className="h-3 w-3 animate-spin" /> : t("sync.page.conflict.posVersion")}
          </button>
          <button
            onClick={() => onResolve(c.sku, "keep_ecom")}
            disabled={resolvingSku === c.sku}
            className="px-2.5 py-1.5 bg-info-bg text-info-text rounded-lg text-xs font-bold hover:opacity-80 disabled:opacity-50 transition-all active:scale-95"
          >
            {resolvingSku === c.sku ? <Loader2 className="h-3 w-3 animate-spin" /> : t("sync.page.conflict.ecomVersion")}
          </button>
          <button
            onClick={() => onResolve(c.sku, "keep_both")}
            disabled={resolvingSku === c.sku}
            className="px-2 py-1.5 border border-gray-200 text-text-muted rounded-lg text-xs font-bold hover:bg-gray-50 hover:text-text-secondary transition-all active:scale-95"
          >
            <Layers className="h-3 w-3 inline mr-1" />
            {t("sync.page.conflict.keepBoth")}
          </button>
        </div>

        {/* Expand diff toggle */}
        <button
          onClick={() => setShowDiff(!showDiff)}
          className={`p-1.5 rounded-lg transition-all duration-200 ${
            showDiff ? "bg-danger-bg/30 text-danger-text" : "text-text-muted hover:bg-gray-100"
          }`}
          title={showDiff ? "إخفاء المقارنة" : "عرض المقارنة"}
        >
          {showDiff ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Per-field diff comparison */}
      {showDiff && (
        <div className="mt-3 mr-14 animate-slide-down">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
              {t("sync.page.conflict.diffCount")}: {changedCount}
            </span>
            <div className="flex gap-1.5">
              <span className="px-1.5 py-0.5 bg-danger-bg/20 text-danger-text rounded text-[10px] font-bold">
                {t("sync.page.conflict.posVersion")}
              </span>
              <span className="px-1.5 py-0.5 bg-success-bg/20 text-success-text rounded text-[10px] font-bold">
                {t("sync.page.conflict.ecomVersion")}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            {diffs.map((diff) =>
              diff.key === "images" ? (
                <ImagesDiffRow
                  key={diff.key}
                  posValue={diff.posValue}
                  ecomValue={diff.ecomValue}
                />
              ) : (
                <ConflictDiffRow
                  key={diff.key}
                  label={diff.label}
                  posValue={diff.posValue}
                  ecomValue={diff.ecomValue}
                  changed={diff.changed}
                  format={diff.format}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
