import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw, Link2, Settings2, Download, Upload,
  CheckCircle2, XCircle, AlertCircle, Clock, Loader2, Search,
  ArrowLeftRight, FileDown, FileUp, ImageIcon, Eye,
  Globe, ShoppingBag, Layers, TrendingUp, Shield,
  Zap, Scale, FileText,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Info, Truck, Undo2,
  ExternalLink, Play, Plus, Monitor, Smartphone, Filter, X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { usePermission } from "../../hooks/usePermission";
import { getSyncConfig, getSyncStatus, getSyncCheck, getSyncLogs, getSyncLog, getPendingChanges, applySync, pullProducts, previewPull, getConflicts, resolveConflict, getSnapshots, previewRollback, executeRollback, getOnlineOrders, prepareOnlineOrder, ignoreOnlineOrder, pushStoreCatalog } from "../../services/syncService";
import { useSyncStore } from "../../stores/syncStore";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { useSSEConnectionStatus, useSSE } from "../../hooks/useSSE";
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

function computeDiffs(conflict, symbol = "ج.م") {
  const pos = conflict?.pos || {};
  const ecom = conflict?.ecom || {};
  const fields = [
    { key: "name", label: "الاسم", posValue: pos.name, ecomValue: ecom.name },
    { key: "price", label: "السعر", posValue: pos.price, ecomValue: ecom.price, format: (v) => v != null ? `${Number(v).toFixed(2)} ${symbol}` : "—" },
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
  images: "الصور",
};

const FIELD_ICONS = {
  name: "📝",
  price: "💰",
  stock: "📦",
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

function ProductRow({ product, fields, onFieldToggle, onPreviewImages, imageCount }) {
  const [expanded, setExpanded] = useState(false);
  const images = useMemo(() => imgList(product), [product]);
  const rowRef = useRef(null);
  const { t } = useTranslation();
  const settings = useAppSettingsStore((s) => s.settings);
  const symbol = settings.currency_symbol || "ج.م";
  const decimals = Number(settings.decimal_places ?? 2);
  const lm = product.localMatch;

  useEffect(() => {
    if (rowRef.current) rowRef.current.classList.add("animate-fade-in");
  }, []);

  const formatPrice = (v) => (v != null ? Number(v).toFixed(decimals) + " " + symbol : "—");
  const formatStock = (v) => (v != null ? Number(v) + "" : "—");

  const isNew = lm && !lm.exists;

  /* Always show all 4 field pills; matching = disabled */
  const allFields = [
    { key: "name", label: t("sync.page.fields.name"), match: lm?.name?.match ?? null, ecom: isNew ? (product.nameAr || product.name) : (lm?.name?.ecom ?? (product.nameAr || product.name)) },
    { key: "price", label: t("sync.page.fields.price"), match: lm?.price?.match ?? null, ecom: isNew ? formatPrice(product.price) : formatPrice(lm?.price?.ecom ?? product.price) },
    { key: "stock", label: t("sync.page.fields.stock"), match: lm?.stock?.match ?? null, ecom: isNew ? formatStock(product.stock) : formatStock(lm?.stock?.ecom ?? product.stock) },
    { key: "images", label: t("sync.page.fields.images"), match: lm?.image?.match ?? null, ecom: isNew ? (imageCount > 0 ? `${imageCount} ${t("sync.page.match.imagesCount")}` : "—") : (lm?.image?.ecom ? `${imageCount} ${t("sync.page.match.imagesCount")}` : "—") },
  ];

  const anyFieldOn = fields && Object.values(fields).some(Boolean);

  return (
    <div ref={rowRef} className={`border-b border-gray-200 last:border-b-0 transition-all duration-200 ${anyFieldOn ? "bg-primary-50/10" : "hover:bg-gray-50/30"}`}>
      <div className="px-4 py-3">
        {/* ── Line 1: Thumbnail + Name line + expand ── */}
        <div className="flex items-start gap-3">
          {/* Thumbnail */}
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-50 border border-gray-200 cursor-pointer shadow-sm" onClick={() => onPreviewImages(product)}>
              {images.length > 0 ? (
                <img src={images[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted"><ImageIcon className="h-5 w-5" /></div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-text-primary truncate">{product.nameAr || product.name}</span>
              <span className="text-[11px] text-text-muted font-bold shrink-0" style={{ direction: "ltr", display: "inline-block" }}>({product.sku})</span>
              {isNew && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-info-bg text-info-text leading-none shrink-0">
                  {t("sync.page.match.new")}
                </span>
              )}
              <button
                onClick={() => setExpanded(!expanded)}
                className={`p-1 rounded-lg transition-all duration-200 shrink-0 mr-auto ${expanded ? "bg-primary-50 text-primary" : "text-text-muted hover:bg-gray-100"}`}
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Price + Stock summary line */}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-bold text-text-secondary">{t("sync.page.fields.price")}: {formatPrice(product.price)}</span>
              <span className="w-px h-3 bg-border-subtle" />
              <span className="text-xs font-bold text-text-secondary">{t("sync.page.fields.stock")}: {formatStock(product.stock)}</span>
            </div>
          </div>
        </div>

        {/* ── Line 2: All 4 field pills — matching = disabled, differing = ON/OFF ── */}
        <div className="flex items-center gap-1.5 mt-2.5 mr-0 flex-wrap">
          {allFields.map((f) => {
            const differs = f.match === false;
            const isMatched = f.match === true;
            const on = fields?.[f.key] ?? false;
            return (
              <button
                key={f.key}
                onClick={() => { if (differs || isNew) onFieldToggle(product.sku, f.key); }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                  isMatched
                    ? "bg-gray-50 border-gray-200 text-text-muted cursor-default"
                    : on
                      ? "bg-primary border-primary text-white shadow-sm"
                      : "bg-white border-gray-200 text-text-muted hover:border-gray-300"
                }`}
                title={isMatched ? `${f.label}: مطابق ✓` : `${f.label}: ${on ? "نشط" : "معطل"}`}
              >
                <span>{f.label}</span>
                {isMatched ? (
                  <span className="text-[9px] text-success-text flex items-center gap-0.5">
                    <CheckCircle2 className="h-2.5 w-2.5" /> مطابق
                  </span>
                ) : (
                  <>
                    <span className={`text-[9px] px-1 py-0.5 rounded ${on ? "bg-white/20" : "bg-gray-100"}`}>{on ? "ON" : "OFF"}</span>
                    <span className={`text-[10px] opacity-80 ${on ? "text-white/80" : "text-text-muted"}`}>{f.ecom}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Expanded: side-by-side comparison ─── */}
      {expanded && (
        <div className="px-4 pb-4 animate-slide-down border-t border-gray-100">
          {/* Existing product — show ALL fields, highlight diffs */}
          {lm?.exists && (
            <div className="pt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-text-muted mb-1">
                <span className="flex-1 px-2 py-1 rounded bg-gray-50 text-center">{t("sync.page.match.local")}</span>
                <ArrowLeftRight className="h-3 w-3 shrink-0" />
                <span className="flex-1 px-2 py-1 rounded bg-gray-50 text-center">{t("sync.page.match.ecom")}</span>
              </div>
              {allFields.map((f) => {
                const lmField = f.key === "images" ? lm.image : lm?.[f.key];
                const differs = f.match === false;
                const localVal = f.key === "price" ? formatPrice(lmField?.local) :
                  f.key === "stock" ? formatStock(lmField?.local) :
                  f.key === "images" ? (lmField?.local ? "موجودة" : "—") :
                  lmField?.local ?? "—";
                const ecomVal = f.key === "price" ? formatPrice(lmField?.ecom) :
                  f.key === "stock" ? formatStock(lmField?.ecom) :
                  f.key === "images" ? (lmField?.ecom ? `${imageCount} ${t("sync.page.match.imagesCount")}` : "—") :
                  lmField?.ecom ?? "—";
                return (
                  <div key={f.key}>
                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs ${
                      differs ? "bg-danger-bg/10 ring-1 ring-danger-border/30" : "bg-gray-50/50"
                    }`}>
                      <span className="w-16 font-bold text-text-muted shrink-0">{f.label}</span>
                      <span className={`flex-1 px-2 py-0.5 rounded text-left ${differs ? "bg-danger-bg/20 text-danger-text font-bold line-through decoration-2" : "text-text-primary"}`}>
                        {localVal}
                      </span>
                      <span className="shrink-0">
                        {differs
                          ? <ArrowLeftRight className="h-3.5 w-3.5 text-warning-text animate-pulse" />
                          : <CheckCircle2 className="h-3.5 w-3.5 text-success-text" />
                        }
                      </span>
                      <span className={`flex-1 px-2 py-0.5 rounded text-left ${differs ? "bg-warning-bg/20 text-warning-text font-bold" : "text-text-primary"}`}>
                        {ecomVal}
                      </span>
                    </div>
                    {f.key === "images" && differs && (
                      <div className="mt-1 px-3 py-1.5 rounded-lg bg-warning-bg/10 text-[10px] text-warning-text font-bold flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        التطبيق يدعم صورة واحدة — سيتم استبدالها بأول صورة من الموقع
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* New product — show all field values */}
          {isNew && (
            <div className="pt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-text-muted mb-1">
                <span className="flex-1 px-2 py-1 rounded bg-gray-50 text-center">{t("sync.page.match.ecom")}</span>
              </div>
              {allFields.map((f) => (
                <div key={f.key} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-info-bg/10 text-xs">
                  <span className="w-16 font-bold text-text-muted shrink-0">{f.label}</span>
                  <span className="flex-1 text-text-primary font-bold">{f.ecom}</span>
                </div>
              ))}
            </div>
          )}

          {/* Image gallery */}
          {images.length > 0 && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              {images.map((url, i) => (
                <button key={i} onClick={() => onPreviewImages(product)} className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-primary transition shadow-sm">
                  <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SyncLogRow({ log, index, onSelect }) {
  return (
    <tr
      className="border-b border-gray-200 text-sm animate-fade-in cursor-pointer hover:bg-bg-overlay/40 transition-colors"
      style={{ animationDelay: `${index * 30}ms` }}
      onClick={() => onSelect(log)}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${log.direction === "push" ? "bg-warning-bg/30" : "bg-info-bg/30"}`}>
            {log.direction === "push" ? (
              <Upload className="h-3.5 w-3.5 text-warning-text" />
            ) : (
              <Download className="h-3.5 w-3.5 text-info-text" />
            )}
          </div>
          <div>
            <span className="text-text-primary font-bold block">{log.direction === "push" ? "رفع" : "سحب"}</span>
            {log.direction === "resolve" && <span className="text-text-secondary text-[10px]">تسوية</span>}
            {log.direction === "rollback" && <span className="text-text-secondary text-[10px]">استرجاع</span>}
          </div>
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
        <div className="flex items-center gap-2">
          <span className="text-success-text font-bold">{log.items_succeeded || 0}</span>
          <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                log.status === "success" ? "bg-success-text" :
                log.status === "partial" ? "bg-warning-text" :
                "bg-danger-text"
              }`}
              style={{ width: `${log.items_total ? ((log.items_succeeded || 0) / log.items_total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-danger-text font-bold text-xs">{log.items_failed || 0}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-text-muted text-xs whitespace-nowrap" title={log.created_at}>
        <div className="flex flex-col items-end">
          <span>{timeAgo(log.created_at)}</span>
          {log.completed_at && (
            <span className="text-[10px] text-text-muted/60">
              {new Date(log.completed_at || log.created_at).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-text-muted">
        <ChevronLeft className="h-4 w-4" />
      </td>
    </tr>
  );
}

/* ─── Sync log detail modal ─── */
function SyncLogDetailModal({ log, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!log) return;
    setLoading(true);
    getSyncLog(log.id).then((res) => {
      if (res?.ok) setDetail(res.item);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [log?.id]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    if (log) { window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey); }
  }, [log]);

  if (!log) return null;

  const errorItems = detail?.error_details;
  const snapshot = detail?.snapshot;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-8 overflow-y-auto" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-bg-surface rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b border-border-subtle ${
          log.status === "success" ? "bg-success-bg/10" :
          log.status === "partial" ? "bg-warning-bg/10" :
          "bg-danger-bg/10"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              log.direction === "push" ? "bg-warning-bg/30" : "bg-info-bg/30"
            }`}>
              {log.direction === "push" ? <Upload className="h-5 w-5 text-warning-text" /> : <Download className="h-5 w-5 text-info-text" />}
            </div>
            <div>
              <h3 className="text-lg font-black text-text-primary">
                {log.direction === "push" ? "رفع إلى الموقع" : log.direction === "pull" ? "سحب من الموقع" : log.direction === "resolve" ? "تسوية تعارض" : "استرجاع"}
              </h3>
              <span className="text-xs text-text-muted">{new Date(log.created_at).toLocaleString("ar-EG")}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-bg-overlay flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-text-muted" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-bg-base rounded-xl p-3 text-center">
                <div className="text-2xl font-black text-text-primary">{log.items_total || 0}</div>
                <div className="text-[10px] text-text-muted font-bold mt-0.5">الإجمالي</div>
              </div>
              <div className="bg-success-bg/15 rounded-xl p-3 text-center">
                <div className="text-2xl font-black text-success-text">{log.items_succeeded || 0}</div>
                <div className="text-[10px] text-text-muted font-bold mt-0.5">ناجح</div>
              </div>
              <div className="bg-danger-bg/15 rounded-xl p-3 text-center">
                <div className="text-2xl font-black text-danger-text">{log.items_failed || 0}</div>
                <div className="text-[10px] text-text-muted font-bold mt-0.5">فاشل</div>
              </div>
              <div className={`rounded-xl p-3 text-center ${
                log.status === "success" ? "bg-success-bg/15" :
                log.status === "partial" ? "bg-warning-bg/15" :
                "bg-danger-bg/15"
              }`}>
                <div className={`text-2xl font-black ${
                  log.status === "success" ? "text-success-text" :
                  log.status === "partial" ? "text-warning-text" :
                  "text-danger-text"
                }`}>
                  <span className={`inline-flex items-center gap-1 ${
                    log.status === "success" ? "text-success-text" :
                    log.status === "partial" ? "text-warning-text" :
                    "text-danger-text"
                  }`}>
                    {log.status === "success" ? <CheckCircle2 className="h-5 w-5" /> :
                     log.status === "partial" ? <AlertCircle className="h-5 w-5" /> :
                     <XCircle className="h-5 w-5" />}
                  </span>
                </div>
                <div className="text-[10px] text-text-muted font-bold mt-0.5">
                  {log.status === "success" ? "ناجح" : log.status === "partial" ? "جزئي" : "فاشل"}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-bg-base rounded-xl p-4">
              <h4 className="text-xs font-bold text-text-muted mb-3">الخط الزمني</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-text-primary">بدء المزامنة</div>
                    <div className="text-[10px] text-text-muted">{log.started_at ? new Date(log.started_at).toLocaleString("ar-EG") : "—"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    log.status === "success" ? "bg-success-text" :
                    log.status === "partial" ? "bg-warning-text" :
                    "bg-danger-text"
                  }`} />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-text-primary">انتهاء المزامنة</div>
                    <div className="text-[10px] text-text-muted">{log.completed_at ? new Date(log.completed_at).toLocaleString("ar-EG") : log.created_at ? new Date(log.created_at).toLocaleString("ar-EG") : "—"}</div>
                  </div>
                </div>
                {detail && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-info-text" />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-text-primary">المدة</div>
                      <div className="text-[10px] text-text-muted">
                        {(() => {
                          const start = new Date(log.started_at || log.created_at);
                          const end = new Date(log.completed_at || log.created_at);
                          const diff = (end - start) / 1000;
                          if (diff < 60) return `${Math.round(diff)} ثانية`;
                          return `${Math.floor(diff / 60)} د و ${Math.round(diff % 60)} ث`;
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Imported products list (new rich format) */}
            {errorItems?.imported?.length > 0 && (
              <div className="bg-bg-base rounded-xl p-4">
                <h4 className="text-xs font-bold text-text-muted mb-3 flex items-center gap-2">
                  <Download className="h-3.5 w-3.5 text-success-text" />
                  المنتجات المزامنة ({errorItems.imported.length})
                </h4>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {errorItems.imported.slice(0, 150).map((item, i) => (
                    <div key={i} className="bg-bg-surface rounded-lg border border-border-subtle overflow-hidden">
                      {/* Header row */}
                      <div className="flex items-center justify-between px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-primary">{item.sku || `#${i + 1}`}</span>
                          {(item.fields?.length > 0) && (
                            <div className="flex gap-1">
                              {item.fields.map((f) => (
                                <span key={f} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  f === "price" ? "bg-info-bg/30 text-info-text" :
                                  f === "name" ? "bg-success-bg/30 text-success-text" :
                                  f === "stock" ? "bg-warning-bg/30 text-warning-text" :
                                  f === "images" ? "bg-primary-50 text-primary" :
                                  "bg-bg-base text-text-muted"
                                }`}>
                                  {f === "price" ? "سعر" : f === "name" ? "اسم" : f === "stock" ? "مخزون" : f === "images" ? "صور" : f}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold ${
                          item.action === "created" ? "text-success-text" : "text-info-text"
                        }`}>
                          {item.action === "created" ? "جديد" : "تحديث"}
                        </span>
                      </div>
                      {/* Changes detail */}
                      {item.changes?.length > 0 && (
                        <div className="border-t border-border-subtle divide-y divide-border-subtle">
                          {item.changes.map((ch, ci) => (
                            <div key={ci} className="flex items-center gap-3 px-3 py-1.5 text-[10px]">
                              <span className="w-12 font-bold text-text-muted flex-shrink-0">
                                {ch.field === "price" ? "السعر" :
                                 ch.field === "name" ? "الاسم" :
                                 ch.field === "name_en" ? "الاسم إنج" :
                                 ch.field === "stock" ? "المخزون" :
                                 ch.field === "description" ? "الوصف" : ch.field}
                              </span>
                              {ch.oldValue !== undefined ? (
                                <>
                                  <span className="flex-1 line-through text-danger-text/70 truncate">{String(ch.oldValue ?? "—")}</span>
                                  <ArrowLeftRight className="h-2.5 w-2.5 text-text-muted shrink-0" />
                                  <span className="flex-1 text-success-text font-bold truncate">{String(ch.newValue ?? "—")}</span>
                                </>
                              ) : (
                                <span className="flex-1 text-success-text font-bold truncate">{String(ch.newValue ?? "—")}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {errorItems.imported.length > 150 && (
                    <p className="text-[10px] text-text-muted text-center pt-1">
                      +{errorItems.imported.length - 150} منتج آخر
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Legacy: error_details as flat array (old logs) */}
            {errorItems && Array.isArray(errorItems) && errorItems.length > 0 && (
              <div className="bg-danger-bg/10 rounded-xl p-4 border border-danger-border/20">
                <h4 className="text-xs font-bold text-danger-text mb-3 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  تفاصيل الأخطاء ({errorItems.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {errorItems.map((err, i) => (
                    <div key={i} className="bg-white rounded-lg px-3 py-2 text-xs border border-danger-border/10">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text-primary">{err.sku || err.product || `#${i + 1}`}</span>
                        <span className="text-danger-text">{err.error || err.message || "خطأ غير معروف"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy: failed items in new rich format */}
            {errorItems?.failed?.length > 0 && (
              <div className="bg-danger-bg/10 rounded-xl p-4 border border-danger-border/20">
                <h4 className="text-xs font-bold text-danger-text mb-3 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  الفاشلة ({errorItems.failed.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {errorItems.failed.map((err, i) => (
                    <div key={i} className="bg-white rounded-lg px-3 py-2 text-xs border border-danger-border/10">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text-primary">{err.sku || err.product || `#${i + 1}`}</span>
                        <span className="text-danger-text">{err.error || err.message || "خطأ غير معروف"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Snapshot info */}
            {snapshot && (
              <div className="bg-info-bg/10 rounded-xl p-4 border border-info-border/20">
                <h4 className="text-xs font-bold text-info-text mb-3 flex items-center gap-2">
                  <Undo2 className="h-3.5 w-3.5" />
                  لقطة احتياطية مرفقة
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white rounded-lg px-3 py-2">
                    <span className="text-text-muted">عدد العناصر: </span>
                    <span className="font-bold text-text-primary">{snapshot.items_count || 0}</span>
                  </div>
                  {snapshot.metadata && (
                    <>
                      {snapshot.metadata.pricesChanged != null && (
                        <div className="bg-white rounded-lg px-3 py-2">
                          <span className="text-text-muted">تغيرات الأسعار: </span>
                          <span className="font-bold text-text-primary">{snapshot.metadata.pricesChanged}</span>
                        </div>
                      )}
                      {snapshot.metadata.stockChanged != null && (
                        <div className="bg-white rounded-lg px-3 py-2">
                          <span className="text-text-muted">تغيرات المخزون: </span>
                          <span className="font-bold text-text-primary">{snapshot.metadata.stockChanged}</span>
                        </div>
                      )}
                      {snapshot.metadata.namesChanged != null && (
                        <div className="bg-white rounded-lg px-3 py-2">
                          <span className="text-text-muted">تغيرات الأسماء: </span>
                          <span className="font-bold text-text-primary">{snapshot.metadata.namesChanged}</span>
                        </div>
                      )}
                    </>
                  )}
                  {snapshot.size_bytes && (
                    <div className="bg-white rounded-lg px-3 py-2">
                      <span className="text-text-muted">حجم البيانات: </span>
                      <span className="font-bold text-text-primary">{(snapshot.size_bytes / 1024).toFixed(1)} ك.ب</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
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
              <img key={i} src={url} alt="" loading="lazy" className="w-6 h-6 rounded object-cover border border-gray-200" />
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
              <img key={i} src={url} alt="" loading="lazy" className="w-6 h-6 rounded object-cover border border-gray-200" />
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
function SyncProgressBar({ active, progress, total }) {
  if (!active) return null;
  const pct = total > 0 ? Math.round((progress / total) * 100) : null;
  return (
    <div className="w-full bg-bg-base rounded-xl overflow-hidden mb-4 border border-border-subtle">
      <div className="flex items-center gap-3 px-4 py-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        <div className="flex-1 h-1.5 bg-bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: pct !== null ? `${pct}%` : "30%" }}
          />
        </div>
        <span className="text-[11px] font-bold text-text-secondary tabular-nums whitespace-nowrap">
          {pct !== null ? `${progress}/${total}` : "جارٍ..."}
        </span>
      </div>
    </div>
  );
}

/* ─── Branded Not Configured Page ─── */
// White-label: resellers set VITE_STORE_PROMO_URL to their storefront-order/landing page.
// When unset, the store-order CTAs are hidden and only the sync-setup CTA is shown.
const STORE_PROMO_URL = import.meta.env.VITE_STORE_PROMO_URL || "";
// Optional explainer video + storefront screenshots for the marketing page.
// When unset, styled placeholders are shown so the layout stays intact.
const STORE_VIDEO_URL = import.meta.env.VITE_STORE_VIDEO_URL || "";
const STORE_SHOTS = [
  import.meta.env.VITE_STORE_SHOT_1 || "",
  import.meta.env.VITE_STORE_SHOT_2 || "",
  import.meta.env.VITE_STORE_SHOT_3 || "",
];

/* ─── Marketing: video placeholder ─── */
function VideoShowcase({ t }) {
  return (
    <div className="max-w-4xl mx-auto px-6 -mt-12 relative z-20 mb-10">
      <div className="text-center mb-4">
        <h2 className="text-xl md:text-2xl font-black text-text-primary">{t("sync.market.videoTitle")}</h2>
        <p className="text-sm text-text-muted mt-1">{t("sync.market.videoSubtitle")}</p>
      </div>
      <a
        href={STORE_VIDEO_URL || undefined}
        target={STORE_VIDEO_URL ? "_blank" : undefined}
        rel="noopener noreferrer"
        className={`group block relative rounded-3xl overflow-hidden border border-gray-200 shadow-elevated bg-gradient-to-br from-primary/90 via-primary-600 to-primary/70 ${STORE_VIDEO_URL ? "cursor-pointer" : "cursor-default"}`}
        style={{ aspectRatio: "16 / 9" }}
      >
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 25% 30%, rgba(255,255,255,0.35) 0%, transparent 55%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.2) 0%, transparent 50%)" }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300 shadow-xl">
            <Play className="h-9 w-9 ltr:ml-1 rtl:mr-1 fill-white" />
          </div>
          <span className="text-lg font-black">{t("sync.market.watchVideo")}</span>
          {!STORE_VIDEO_URL && <span className="text-xs text-white/70 mt-1.5">{t("sync.market.videoHint")}</span>}
        </div>
        <span className="absolute top-3 rtl:right-3 ltr:left-3 text-[10px] font-bold bg-white/20 backdrop-blur-sm text-white px-2.5 py-1 rounded-full">{t("sync.market.videoPlaceholder")}</span>
      </a>
    </div>
  );
}

/* ─── Marketing: "about the other side" + screenshots ─── */
function StoreAbout({ t }) {
  const points = [
    t("sync.market.aboutPoint1"),
    t("sync.market.aboutPoint2"),
    t("sync.market.aboutPoint3"),
    t("sync.market.aboutPoint4"),
  ];
  const shots = [
    { url: STORE_SHOTS[0], caption: t("sync.market.shot1Caption"), icon: Globe },
    { url: STORE_SHOTS[1], caption: t("sync.market.shot2Caption"), icon: ShoppingBag },
    { url: STORE_SHOTS[2], caption: t("sync.market.shot3Caption"), icon: Monitor },
  ];
  return (
    <div className="max-w-5xl mx-auto px-6 mb-10">
      {/* Big explanation */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-7 md:p-9 mb-6">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-info-bg/50 text-info-text text-xs font-black mb-4">
          <Globe className="h-3.5 w-3.5" />
          {t("sync.market.aboutBadge")}
        </span>
        <h2 className="text-2xl md:text-3xl font-black text-text-primary leading-tight mb-4">{t("sync.market.aboutTitle")}</h2>
        <p className="text-sm md:text-base text-text-secondary leading-loose mb-6">{t("sync.market.aboutBody")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {points.map((p, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-success-text shrink-0 mt-0.5" />
              <span className="text-sm font-bold text-text-primary leading-relaxed">{p}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Screenshot showcase */}
      <div className="text-center mb-4">
        <h3 className="text-lg font-black text-text-primary">{t("sync.market.showcaseTitle")}</h3>
        <p className="text-xs text-text-muted mt-0.5">{t("sync.market.showcaseSubtitle")}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {shots.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="group">
              <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
                {/* browser chrome */}
                <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border-b border-gray-200">
                  <span className="w-2 h-2 rounded-full bg-danger-border" />
                  <span className="w-2 h-2 rounded-full bg-warning-border" />
                  <span className="w-2 h-2 rounded-full bg-success-border" />
                </div>
                {s.url ? (
                  <img src={s.url} alt={s.caption} loading="lazy" className="w-full object-cover" style={{ aspectRatio: "4 / 3" }} />
                ) : (
                  <div className="relative flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-primary-50/40" style={{ aspectRatio: "4 / 3" }}>
                    <Icon className="h-10 w-10 text-primary/40 mb-2" />
                    <span className="text-xs font-bold text-text-muted">{t("sync.market.shotPlaceholder")}</span>
                    <span className="text-[10px] text-text-muted/70 mt-1 px-4 text-center">{t("sync.market.shotHint")}</span>
                  </div>
                )}
              </div>
              <p className="text-xs font-bold text-text-secondary text-center mt-2">{s.caption}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NotConfiguredBranding({ onGoToConfig }) {
  const { t } = useTranslation();

  const websiteFeatures = [
    { icon: Globe, title: t("sync.market.web1Title"), desc: t("sync.market.web1Desc") },
    { icon: ShoppingBag, title: t("sync.market.web2Title"), desc: t("sync.market.web2Desc") },
    { icon: Layers, title: t("sync.market.web3Title"), desc: t("sync.market.web3Desc") },
    { icon: TrendingUp, title: t("sync.market.web4Title"), desc: t("sync.market.web4Desc") },
  ];

  const syncFeatures = [
    { icon: ArrowLeftRight, title: t("sync.market.sync1Title"), desc: t("sync.market.sync1Desc") },
    { icon: Zap, title: t("sync.market.sync2Title"), desc: t("sync.market.sync2Desc") },
    { icon: ShoppingBag, title: t("sync.market.sync3Title"), desc: t("sync.market.sync3Desc") },
    { icon: Undo2, title: t("sync.market.sync4Title"), desc: t("sync.market.sync4Desc") },
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
            {t("sync.market.badge")}
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3 animate-slide-up">
            {t("sync.market.heroTitle")}
            <br />
            <span className="text-white/80">{t("sync.market.heroTitleAccent")}</span>
          </h1>

          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-8 animate-fade-in" style={{ animationDelay: "150ms" }}>
            {t("sync.market.heroSubtitle")}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 animate-slide-up" style={{ animationDelay: "300ms" }}>
            <button
              onClick={onGoToConfig}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-white text-primary rounded-2xl text-sm font-black hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg shadow-primary/20"
            >
              <Settings2 className="h-4 w-4" />
              {t("sync.market.ctaSetup")}
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            {STORE_PROMO_URL && (
              <a
                href={STORE_PROMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 border-2 border-white/30 backdrop-blur-sm rounded-2xl text-sm font-black hover:bg-white/10 hover:border-white/50 active:scale-95 transition-all duration-300"
              >
                <ShoppingBag className="h-4 w-4" />
                {t("sync.market.ctaGetStore")}
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          <div className="flex items-center justify-center gap-6 text-white/50 text-xs animate-fade-in" style={{ animationDelay: "400ms" }}>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> {t("sync.branding.trust1")}</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> {t("sync.branding.trust2")}</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> {t("sync.branding.trust3")}</span>
          </div>
        </div>
      </div>

      {/* ── Explainer video (first prominent visual) ── */}
      <VideoShowcase t={t} />

      {/* ── About the online store + screenshots ── */}
      <StoreAbout t={t} />

      {/* ── Website Capabilities ── */}
      <div className="max-w-5xl mx-auto px-6 relative z-10 mb-8">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-6 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-info-bg/60 flex items-center justify-center">
              <Globe className="h-4 w-4 text-info-text" />
            </div>
            <div>
              <h2 className="text-sm font-black text-text-primary">{t("sync.market.webTitle")}</h2>
              <p className="text-xs text-text-muted">{t("sync.market.webSubtitle")}</p>
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
              <h2 className="text-sm font-black text-text-primary">{t("sync.market.syncTitle")}</h2>
              <p className="text-xs text-text-muted">{t("sync.market.syncSubtitle")}</p>
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
          <h3 className="text-lg font-black text-text-primary mb-2">{t("sync.market.bottomTitle")}</h3>
          <p className="text-sm text-text-secondary mb-6 max-w-lg mx-auto">
            {t("sync.market.bottomDesc")}
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onGoToConfig}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-black hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
              <Settings2 className="h-4 w-4" />
              {t("sync.market.ctaSetup")}
            </button>
            {STORE_PROMO_URL && (
              <a
                href={STORE_PROMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-300 rounded-xl text-sm font-black text-text-secondary hover:bg-gray-100 active:scale-95 transition-all"
              >
                <ExternalLink className="h-4 w-4" />
                {t("sync.market.ctaLearnMore")}
              </a>
            )}
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
  const canView = usePermission("sync", "view");
  const canPull = usePermission("sync", "pull");
  const canPush = usePermission("sync", "push");
  const canConfigure = usePermission("sync", "configure");
  const canRestore = usePermission("sync", "restore");
  const n_currencySymbol = useAppSettingsStore((s) => s.settings.currency_symbol) || "ج.م";
  const {
    config, configured, connected, status, checking,
    available, pendingChanges, logs,
    setConfig, setStatus, setChecking, setAvailable,
    setPendingChanges, setLogs, setError,
    fieldSelections, toggleField, toggleAllFields, setField,
    imagePreview, openImagePreview, closeImagePreview, setImagePreviewIndex,
    selectedImages, setSelectedImages,
  } = useSyncStore();

  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [pushing, setPushing] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);
  const [fieldFilter, setFieldFilter] = useState(null); // "name"|"price"|"stock"|"images"|"new"|null
  const [checkProducts, setCheckProducts] = useState([]);
  const [checkTotalProducts, setCheckTotalProducts] = useState(0);
  const [ecomCategories, setEcomCategories] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [activeTab, setActiveTab] = useState("available");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState(null);

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

  const [onlineOrders, setOnlineOrders] = useState([]);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [forwardingId, setForwardingId] = useState(null);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await getOnlineOrders("pending", 50);
      if (res?.ok) {
        setOnlineOrders(res.items || []);
        setPendingOrdersCount(res.pendingCount ?? (res.items || []).length);
      }
    } catch {
      /* silent */
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Live: a new online order arrives → refresh the queue + count.
  useSSE({ onOrderNew: () => loadOrders() });

  const forwardOrder = useCallback(async (orderId) => {
    setForwardingId(orderId);
    try {
      const res = await prepareOnlineOrder(orderId);
      if (!res?.ok) { toast.error("تعذّر تجهيز الطلب"); return; }
      if (res.unmatched?.length) {
        toast(`${res.unmatched.length} صنف غير مطابق سيتم تجاهله`, { icon: "⚠️" });
      }
      if (!res.prefill?.lines?.length) { toast.error("لا توجد أصناف مطابقة لتحويلها"); return; }
      navigate("/pos", { state: { from_online_order_id: orderId, prefill: res.prefill } });
    } catch {
      toast.error("تعذّر تجهيز الطلب");
    } finally {
      setForwardingId(null);
    }
  }, [navigate]);

  const dismissOrder = useCallback(async (orderId) => {
    try {
      await ignoreOnlineOrder(orderId);
      loadOrders();
    } catch {
      toast.error("تعذّر تجاهل الطلب");
    }
  }, [loadOrders]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, checkRes, logsRes, pendingRes, conflictsRes] = await Promise.all([
        getSyncStatus().catch(() => null),
        getSyncCheck({ page: 1 }).catch(() => null),
        getSyncLogs(50).catch(() => null),
        getPendingChanges().catch(() => null),
        getConflicts().catch(() => null),
      ]);

      if (statusRes) setStatus(statusRes);
      if (logsRes) setLogs(logsRes.items || []);
      if (pendingRes) setPendingChanges(pendingRes.items || []);
      if (conflictsRes) setConflicts(conflictsRes.conflicts || []);

      // Re-hydrate config store after page reload (Zustand resets on refresh)
      if (statusRes?.ok && !config) {
        getSyncConfig().then((res) => {
          if (res.configured && res.config) setConfig(res.config);
        }).catch(() => {});
      }
      if (statusRes?.configured === false) setConfig(null);

      if (checkRes && checkRes.products) {
        let allProducts = [...checkRes.products];
        let totalPages = checkRes.totalPages || 1;
        setCheckProducts(allProducts);
        setCheckTotalProducts(checkRes.totalProducts || 0);
        setEcomCategories(checkRes.categories || []);

        // Auto-fetch all remaining pages in background
        if (totalPages > 1) {
          for (let page = 2; page <= totalPages; page++) {
            const nextRes = await getSyncCheck({ page }).catch(() => null);
            if (nextRes?.products) {
              allProducts = [...allProducts, ...nextRes.products];
              setCheckProducts([...allProducts]);
            }
          }
        }
        setAvailable({ ...checkRes, products: allProducts });
      }
      // Push local catalog to website for admin comparison (non-blocking)
      pushStoreCatalog().catch(() => {});
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
  /* Active SKUs = any field ON */
  const activeSkus = useMemo(() => {
    return Object.entries(fieldSelections)
      .filter(([, fields]) => Object.values(fields).some(Boolean))
      .map(([sku]) => sku);
  }, [fieldSelections]);

  const activeFieldsCount = useMemo(() => {
    return Object.values(fieldSelections).reduce((sum, fields) => {
      return sum + Object.values(fields).filter(Boolean).length;
    }, 0);
  }, [fieldSelections]);

  const openReview = async () => {
    const skus = Object.entries(fieldSelections)
      .filter(([, fields]) => Object.values(fields).some(Boolean))
      .map(([sku]) => sku);

    if (skus.length === 0) {
      toast.error("فعّل حقول المنتجات التي تريد سحبها أولاً");
      return;
    }

    setReviewLoading(true);
    setReviewOpen(true);
    try {
      const fieldsToSend = {};
      for (const sku of skus) {
        fieldsToSend[sku] = fieldSelections[sku];
      }
      const res = await previewPull(skus, fieldsToSend, ecomCategories);
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
    const MIN_DURATION = 3000;
    const startTime = Date.now();
    const filteredSkus = reviewPreviews.map((p) => p.sku);

    // Validate required prices for new products
    const newProds = reviewPreviews.filter((p) => p.isNew);
    for (const np of newProds) {
      const ov = overrides[np.sku] || {};
      const hasPurchase = ov.purchase_price !== undefined ? Number(ov.purchase_price) > 0 : Number(np.incoming?.purchase_price ?? 0) > 0;
      const hasSale = ov.price !== undefined ? Number(ov.price) > 0 : Number(np.incoming?.price ?? 0) > 0;
      if (!hasPurchase || !hasSale) {
        toast.error(t("sync.review.missingPrices"));
        setPulling(false);
        return;
      }
    }

    setSyncTotal(filteredSkus.length);
    setSyncProgress(0);
    setPulling(true);
    try {
      const fieldsToSend = {};
      for (const sku of filteredSkus) {
        fieldsToSend[sku] = fieldSelections[sku];
      }
      const res = await pullProducts(filteredSkus, fieldsToSend, ecomCategories, overrides);
      if (res.ok) {
        const imported = res.imported?.length || 0;
        setSyncProgress(filteredSkus.length);
        toast.success(`تم سحب ${imported} منتج بنجاح`);
        setReviewOpen(false);
        setReviewPreviews([]);
        loadAll();
      }
    } catch {
      setSyncProgress(0);
      toast.error("فشلت عملية السحب");
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_DURATION - elapsed);
      setTimeout(() => { setPulling(false); setSyncProgress(0); setSyncTotal(0); }, remaining);
    }
  };

  /* Exclude product from review — turn all its fields OFF */
  const excludeFromReview = useCallback((sku) => {
    toggleAllFields(sku, false);
    setReviewPreviews((prev) => prev.filter((p) => p.sku !== sku));
  }, [toggleAllFields]);

  const cancelReview = () => {
    setReviewOpen(false);
    setReviewPreviews([]);
    setOverrides({});
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

  /* ── Search-only filter (all products matching search) ── */
  const filteredSearch = useMemo(() => {
    const products = checkProducts || [];
    if (!searchQ.trim()) return products;
    const q = searchQ.trim().toLowerCase();
    return products.filter(
      (p) =>
        (p.nameAr || "").toLowerCase().includes(q) ||
        (p.name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        String(p.price || "").includes(q)
    );
  }, [checkProducts, searchQ]);

  /* ── Existing (matched) products with field filter ── */
  const filteredExisting = useMemo(() => {
    let result = filteredSearch.filter((p) => p.localMatch?.exists);
    if (fieldFilter) {
      result = result.filter((p) => {
        if (!p.localMatch) return false;
        return p.localMatch[fieldFilter === "images" ? "image" : fieldFilter]?.match === false;
      });
    } else {
      // Default: only show products where at least one field still differs
      result = result.filter((p) => p.localMatch && (
        p.localMatch.name?.match === false ||
        p.localMatch.price?.match === false ||
        p.localMatch.stock?.match === false ||
        p.localMatch.image?.match === false
      ));
    }
    return result;
  }, [filteredSearch, fieldFilter]);

  /* ── New products (no local match) — separate tab ── */
  const filteredNew = useMemo(() => {
    let result = filteredSearch.filter((p) => !p.localMatch?.exists);
    if (fieldFilter) {
      result = result.filter((p) => fieldSelections[p.sku]?.[fieldFilter] === true);
    }
    return result;
  }, [filteredSearch, fieldFilter, fieldSelections]);

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
    { id: "orders", label: "طلبات الموقع", count: pendingOrdersCount, icon: ShoppingBag },
    { id: "newproducts", label: "منتجات جديدة", count: filteredNew.length, icon: Plus },
    { id: "available", label: "متاح من الموقع", count: filteredExisting.length, icon: Download },
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
        loading={reviewLoading || pulling}
        syncing={pulling}
        onConfirm={confirmPull}
        onCancel={cancelReview}
        onBack={() => { setReviewOpen(false); setReviewPreviews([]); setOverrides({}); }}
        onExclude={excludeFromReview}
        overrides={overrides}
        onOverrideChange={(sku, field, value) => setOverrides(prev => ({
          ...prev,
          [sku]: { ...prev[sku], [field]: value }
        }))}
        currencySymbol={n_currencySymbol}
        storeName={config?.ecom_url || ""}
        allProducts={checkProducts}
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
            {canConfigure && <button
              onClick={() => navigate("/sync/config")}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-text-secondary hover:bg-gray-100 hover:border-primary transition-all duration-200"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {t("sync.configShort")}
            </button>}
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

      {/* ── Live pending online-orders warning ── */}
      {pendingOrdersCount > 0 && (
        <button
          onClick={() => setActiveTab("orders")}
          className="w-full mb-6 flex items-center gap-3 p-4 rounded-2xl bg-warning-bg/30 border border-warning-border/50 hover:bg-warning-bg/50 transition-all duration-200 animate-fade-in text-right"
        >
          <div className="w-10 h-10 rounded-xl bg-warning-bg flex items-center justify-center shrink-0 relative">
            <ShoppingBag className="h-5 w-5 text-warning-text" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger-text text-white text-[9px] font-black flex items-center justify-center animate-pulse">
              {pendingOrdersCount > 9 ? "9+" : pendingOrdersCount}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-warning-text">لديك {pendingOrdersCount} طلب جديد من الموقع بانتظار المراجعة</p>
            <p className="text-xs text-text-secondary mt-0.5">اضغط لمراجعة الطلبات وتحويلها إلى فواتير بيع</p>
          </div>
          <ArrowLeftRight className="h-4 w-4 text-warning-text shrink-0" />
        </button>
      )}

      {/* ── Importance Banner ── */}
      <ImportanceBanner />

      {/* ── Sync Progress ── */}
      <SyncProgressBar active={pulling || pushing} progress={syncProgress} total={syncTotal} />

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

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-4 border-b border-border-subtle">
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
                  activeTab === tab.id ? "bg-primary-50 text-primary" : "bg-bg-base text-text-muted"
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

      {/* ── Tab: Online orders review queue ── */}
      {activeTab === "orders" && (
        <div className="animate-slide-up">
          <div className="mb-3 p-3 rounded-xl bg-info-bg/15 border border-info-border/30 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-info-bg/50 flex items-center justify-center shrink-0">
              <ShoppingBag className="h-4 w-4 text-info-text" />
            </div>
            <div className="text-xs text-text-secondary leading-relaxed">
              <span className="font-bold text-text-primary">طلبات المتجر الإلكتروني: </span>
              الطلبات الجديدة من موقعك تظهر هنا. راجع كل طلب وحوّله إلى فاتورة بيع في نقاط البيع — تُطابق الأصناف بالباركود ويُطابق العميل برقم الهاتف. لا يتأثر المخزون إلا عند حفظ الفاتورة.
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {ordersLoading && onlineOrders.length === 0 ? (
              <div className="p-10 text-center text-sm text-text-muted"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
            ) : onlineOrders.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="لا توجد طلبات جديدة"
                description="عندما يصل طلب جديد من متجرك الإلكتروني سيظهر هنا فوراً لتحويله إلى فاتورة."
              />
            ) : (
              <div className="divide-y divide-gray-100">
                {onlineOrders.map((o) => (
                  <div key={o.id} className="p-4 flex items-start gap-4 hover:bg-gray-50/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                      <ShoppingBag className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-text-primary">#{o.ecom_order_id}</span>
                        <span className="text-xs text-text-muted">•</span>
                        <span className="text-sm font-bold text-text-secondary">{o.customer_name || "عميل"}</span>
                        {o.customer_phone && <span className="text-[11px] text-text-muted" dir="ltr">{o.customer_phone}</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                        <span className="font-bold text-success-text">{Number(o.total || 0).toFixed(2)} {n_currencySymbol}</span>
                        <span>{o.items_count || (o.items?.length || 0)} صنف</span>
                        <span>{o.received_at}</span>
                      </div>
                      {Array.isArray(o.items) && o.items.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {o.items.slice(0, 6).map((it, i) => (
                            <span key={i} className="text-[10px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-text-secondary">
                              {(it.name || it.sku || "?")} ×{it.quantity || it.qty || 1}
                            </span>
                          ))}
                          {o.items.length > 6 && <span className="text-[10px] text-text-muted">+{o.items.length - 6}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => forwardOrder(o.id)}
                        disabled={forwardingId === o.id}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-black hover:opacity-90 disabled:opacity-50 active:scale-95 transition"
                      >
                        {forwardingId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                        تحويل إلى فاتورة
                      </button>
                      <button
                        onClick={() => dismissOrder(o.id)}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-text-muted hover:bg-gray-50 active:scale-95 transition"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        تجاهل
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Direction explanation: New products ── */}
      {activeTab === "newproducts" && (
        <div className="mb-3 p-3 rounded-xl bg-info-bg/15 border border-info-border/30 flex items-start gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-lg bg-info-bg/50 flex items-center justify-center shrink-0">
            <Plus className="h-4 w-4 text-info-text" />
          </div>
          <div className="text-xs text-text-secondary leading-relaxed">
            <span className="font-bold text-text-primary">سحب من الموقع ← التطبيق: </span>
            منتجات جديدة غير موجودة في نظام نقاط البيع حالياً. اختر الحقول التي تريد استيرادها لكل منتج (سيتم إنشاؤها تلقائياً).
          </div>
        </div>
      )}

      {/* ── Direction explanation: Existing products ── */}
      {activeTab === "available" && (
        <div className="mb-3 p-3 rounded-xl bg-info-bg/15 border border-info-border/30 flex items-start gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-lg bg-info-bg/50 flex items-center justify-center shrink-0">
            <Download className="h-4 w-4 text-info-text" />
          </div>
          <div className="text-xs text-text-secondary leading-relaxed">
            <span className="font-bold text-text-primary">سحب من الموقع ← التطبيق: </span>
            منتجات موجودة مسبقاً في نظام نقاط البيع ولكن بياناتها مختلفة في الموقع. اختر الحقول التي تريد تحديثها لكل منتج.
          </div>
        </div>
      )}

      {/* ── Tab: Existing products (with changes) ── */}
      {activeTab === "available" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-slide-up">
          {/* ── Search + active badge inside tab ── */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 flex-wrap">
            <div className="relative flex-[1] min-w-[180px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                className="w-full pr-10 pl-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="بحث في المنتجات المتاحة…"
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
              />
            </div>
            {activeSkus.length > 0 && (
              <div className="flex items-center gap-2 bg-primary-50 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-bold text-primary">{activeSkus.length} منتج • {activeFieldsCount} حقل نشط</span>
                <button onClick={() => { activeSkus.forEach((sku) => toggleAllFields(sku, false)); }} className="text-xs text-text-muted hover:text-text-secondary transition-colors">
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          {filteredExisting.length > 0 ? (
            <>
              {/* ── Field column bulk bar ── */}
              {(() => {
                const lmKey = (k) => k === "images" ? "image" : k;
                const isDiff = (p, key) => {
                  if (!p.localMatch || !p.localMatch.exists) return key === null ? true : false;
                  if (key === null) return false;
                  return p.localMatch[lmKey(key)]?.match === false;
                };
                const isNewProd = (p) => !p.localMatch?.exists;
                const fieldOrNew = (p, key) => isNewProd(p) || isDiff(p, key);

                const onCount = (key) => filteredExisting.filter((p) => fieldOrNew(p, key) && fieldSelections[p.sku]?.[key]).length;
                const totalEligible = (key) => filteredExisting.filter((p) => fieldOrNew(p, key)).length;

                const toggleColumn = (key) => {
                  const eligible = filteredExisting.filter((p) => fieldOrNew(p, key));
                  const allCurrentlyOn = eligible.every((p) => fieldSelections[p.sku]?.[key] === true);
                  const target = allCurrentlyOn ? false : true;
                  eligible.forEach((p) => {
                    if (fieldSelections[p.sku]?.[key] !== target) setField(p.sku, key, target);
                  });
                };

                const enableAllForAll = () => {
                  filteredExisting.forEach((p) => {
                    const hasDiff = ["name","price","stock","images"].some((k) => fieldOrNew(p, k));
                    if (hasDiff) toggleAllFields(p.sku, true);
                  });
                };

                const disableAllForAll = () => {
                  filteredExisting.forEach((p) => toggleAllFields(p.sku, false));
                };

                const toggleNewBatch = () => {
                  const newProds = filteredExisting.filter(isNewProd);
                  const countActive = newProds.filter((p) => fieldSelections[p.sku] && Object.values(fieldSelections[p.sku]).some(Boolean)).length;
                  const allOn = countActive === newProds.length;
                  newProds.forEach((p) => toggleAllFields(p.sku, !allOn));
                };

                return (
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Summary */}
                      <span className="text-sm font-bold text-text-primary whitespace-nowrap">
                        {activeSkus.length} منتج • {activeFieldsCount} حقل نشط
                      </span>
                      <span className="w-px h-4 bg-border-subtle" />
                      <button onClick={enableAllForAll} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary text-white hover:opacity-90 transition">
                        تشغيل الكل
                      </button>
                      <button onClick={disableAllForAll} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white border border-gray-200 text-text-muted hover:bg-gray-100 transition">
                        إيقاف الكل
                      </button>
                      <span className="w-px h-4 bg-border-subtle" />
                      {/* Field column toggles — ALL 4 fields + جديد */}
                      {[
                        { key: "name", label: "الاسم", icon: FileText },
                        { key: "price", label: "السعر", icon: TrendingUp },
                        { key: "stock", label: "المخزون", icon: Layers },
                        { key: "images", label: "الصور", icon: ImageIcon },
                        { key: null, label: "جديد", icon: ShoppingBag },
                      ].map((col) => {
                        const isNew = col.key === null;
                        const count = isNew
                          ? filteredExisting.filter((p) => isNewProd(p) && fieldSelections[p.sku] && Object.values(fieldSelections[p.sku]).some(Boolean)).length
                          : onCount(col.key);
                        const totalE = isNew
                          ? filteredExisting.filter(isNewProd).length
                          : totalEligible(col.key);
                        if (totalE === 0) return null;
                        const Icon = col.icon;
                        return (
                          <div key={col.label} className="flex items-center gap-0.5">
                            <button
                              onClick={isNew ? toggleNewBatch : () => toggleColumn(col.key)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                                count > 0
                                  ? "bg-white border-primary text-primary"
                                  : "bg-white border-gray-200 text-text-muted"
                              }`}
                            >
                              <Icon className="h-3 w-3" />
                              {col.label}
                              <span className={`text-[9px] px-1 py-0.5 rounded ${count > 0 ? "bg-primary-50" : "bg-gray-100"}`}>
                                {count}/{totalE}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                const ff = isNew ? "new" : col.key;
                                setFieldFilter((prev) => prev === ff ? null : ff);
                                setPage(1);
                              }}
                              className={`p-1 rounded-lg transition ${
                                fieldFilter === (isNew ? "new" : col.key)
                                  ? "bg-primary-50 text-primary"
                                  : "text-text-muted hover:bg-gray-100"
                              }`}
                              title={isNew ? "فلترة: المنتجات الجديدة فقط" : `فلترة: ${col.label} المختلفة فقط`}
                            >
                              <Filter className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200/60">
                      <span className="text-[10px] text-text-muted">فعّل/عطّل الأعمدة لكل المنتجات المؤهلة</span>
                      {canPull && <button
                        onClick={openReview}
                        disabled={pulling || activeSkus.length === 0}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
                      >
                        {pulling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
                        مراجعة وسحب ({activeSkus.length})
                      </button>}
                    </div>
                  </div>
                );
              })()}

              {/* Products with pagination — page numbers */}
              {(() => {
                const PAGE_SIZE = 25;
                const totalPages = Math.ceil(filteredExisting.length / PAGE_SIZE);
                const start = (page - 1) * PAGE_SIZE;
                const displayProducts = filteredExisting.slice(start, start + PAGE_SIZE);

                const pageRange = [];
                const maxVisible = 5;
                let lo = Math.max(1, page - Math.floor(maxVisible / 2));
                let hi = Math.min(totalPages, lo + maxVisible - 1);
                if (hi - lo + 1 < maxVisible) lo = Math.max(1, hi - maxVisible + 1);
                for (let i = lo; i <= hi; i++) pageRange.push(i);

                return (
                  <>
                    {displayProducts.map((product, i) => (
                      <div key={product.sku} style={{ animationDelay: `${i * 30}ms` }}>
                        <ProductRow
                          product={product}
                          fields={fieldSelections[product.sku]}
                          onFieldToggle={toggleField}
                          onPreviewImages={(p) => openImagePreview(p, 0)}
                          imageCount={imgList(product).length}
                        />
                      </div>
                    ))}
                    {/* Page buttons */}
                    {totalPages > 1 && (
                      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-text-muted">
                          عرض {start + 1}–{Math.min(start + PAGE_SIZE, filteredExisting.length)} من {filteredExisting.length} منتج
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1.5 rounded-lg border border-gray-200 text-text-secondary hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                          </button>
                          {pageRange.map((p) => (
                            <button
                              key={p}
                              onClick={() => setPage(p)}
                              className={`min-w-[32px] h-8 rounded-lg text-xs font-bold border transition ${
                                p === page
                                  ? "bg-primary border-primary text-white"
                                  : "border-gray-200 text-text-secondary hover:bg-gray-100"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                          <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-1.5 rounded-lg border border-gray-200 text-text-secondary hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
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

      {/* ── Tab: New products ── */}
      {activeTab === "newproducts" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-slide-up">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 flex-wrap">
            <div className="relative flex-[1] min-w-[180px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                className="w-full pr-10 pl-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="بحث في المنتجات الجديدة…"
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
              />
            </div>
            {activeSkus.length > 0 && (
              <div className="flex items-center gap-2 bg-primary-50 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-bold text-primary">{activeSkus.length} منتج • {activeFieldsCount} حقل نشط</span>
                <button onClick={() => { activeSkus.forEach((sku) => toggleAllFields(sku, false)); }} className="text-xs text-text-muted hover:text-text-secondary transition-colors">
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          {filteredNew.length > 0 ? (
            <>
              {(() => {
                const toggleColumn = (key) => {
                  const eligible = filteredNew;
                  const allCurrentlyOn = eligible.every((p) => fieldSelections[p.sku]?.[key] === true);
                  const target = allCurrentlyOn ? false : true;
                  eligible.forEach((p) => {
                    if (fieldSelections[p.sku]?.[key] !== target) setField(p.sku, key, target);
                  });
                };

                const enableAllForAll = () => {
                  filteredNew.forEach((p) => toggleAllFields(p.sku, true));
                };

                const disableAllForAll = () => {
                  filteredNew.forEach((p) => toggleAllFields(p.sku, false));
                };

                const onCount = (key) => filteredNew.filter((p) => fieldSelections[p.sku]?.[key]).length;
                const totalEligible = (key) => filteredNew.length;

                return (
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-text-primary whitespace-nowrap">
                        {activeSkus.length} منتج • {activeFieldsCount} حقل نشط
                      </span>
                      <span className="w-px h-4 bg-border-subtle" />
                      <button onClick={enableAllForAll} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary text-white hover:opacity-90 transition">
                        تشغيل الكل
                      </button>
                      <button onClick={disableAllForAll} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white border border-gray-200 text-text-muted hover:bg-gray-100 transition">
                        إيقاف الكل
                      </button>
                      <span className="w-px h-4 bg-border-subtle" />
                      {[
                        { key: "name", label: "الاسم", icon: FileText },
                        { key: "price", label: "السعر", icon: TrendingUp },
                        { key: "stock", label: "المخزون", icon: Layers },
                        { key: "images", label: "الصور", icon: ImageIcon },
                      ].map((col) => {
                        const count = onCount(col.key);
                        const totalE = totalEligible(col.key);
                        if (totalE === 0) return null;
                        const Icon = col.icon;
                        return (
                          <div key={col.label} className="flex items-center gap-0.5">
                            <button
                              onClick={() => toggleColumn(col.key)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                                count > 0
                                  ? "bg-white border-primary text-primary"
                                  : "bg-white border-gray-200 text-text-muted"
                              }`}
                            >
                              <Icon className="h-3 w-3" />
                              {col.label}
                              <span className={`text-[9px] px-1 py-0.5 rounded ${count > 0 ? "bg-primary-50" : "bg-gray-100"}`}>
                                {count}/{totalE}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setFieldFilter((prev) => prev === col.key ? null : col.key);
                                setPage(1);
                              }}
                              className={`p-1 rounded-lg transition ${
                                fieldFilter === col.key
                                  ? "bg-primary-50 text-primary"
                                  : "text-text-muted hover:bg-gray-100"
                              }`}
                              title={`فلترة: ${col.label}`}
                            >
                              <Filter className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200/60">
                      <span className="text-[10px] text-text-muted">فعّل/عطّل الأعمدة لكل المنتجات الجديدة</span>
                      {canPull && <button
                        onClick={openReview}
                        disabled={pulling || activeSkus.length === 0}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
                      >
                        {pulling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
                        مراجعة وسحب ({activeSkus.length})
                      </button>}
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const PAGE_SIZE = 25;
                const totalPages = Math.ceil(filteredNew.length / PAGE_SIZE);
                const start = (page - 1) * PAGE_SIZE;
                const displayProducts = filteredNew.slice(start, start + PAGE_SIZE);

                const pageRange = [];
                const maxVisible = 5;
                let lo = Math.max(1, page - Math.floor(maxVisible / 2));
                let hi = Math.min(totalPages, lo + maxVisible - 1);
                if (hi - lo + 1 < maxVisible) lo = Math.max(1, hi - maxVisible + 1);
                for (let i = lo; i <= hi; i++) pageRange.push(i);

                return (
                  <>
                    {displayProducts.map((product, i) => (
                      <div key={product.sku} style={{ animationDelay: `${i * 30}ms` }}>
                        <ProductRow
                          product={product}
                          fields={fieldSelections[product.sku]}
                          onFieldToggle={toggleField}
                          onPreviewImages={(p) => openImagePreview(p, 0)}
                          imageCount={imgList(product).length}
                        />
                      </div>
                    ))}
                    {totalPages > 1 && (
                      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-text-muted">
                          عرض {start + 1}–{Math.min(start + PAGE_SIZE, filteredNew.length)} من {filteredNew.length} منتج
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1.5 rounded-lg border border-gray-200 text-text-secondary hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                          </button>
                          {pageRange.map((p) => (
                            <button
                              key={p}
                              onClick={() => setPage(p)}
                              className={`min-w-[32px] h-8 rounded-lg text-xs font-bold border transition ${
                                p === page
                                  ? "bg-primary border-primary text-white"
                                  : "border-gray-200 text-text-secondary hover:bg-gray-100"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                          <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-1.5 rounded-lg border border-gray-200 text-text-secondary hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          ) : (
            <EmptyState
              icon={EmptyAvailableIcon}
              title={t("sync.page.empty.new.title")}
              description={t("sync.page.empty.new.desc")}
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
          {/* ── Search inside pending tab ── */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="relative max-w-xs">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                className="w-full pr-10 pl-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="بحث في التغييرات المعلقة…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
            </div>
          </div>
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
                    {filteredPending.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-sm text-slate-400">
                        {searchQ ? "لا توجد نتائج مطابقة" : "لا توجد تغييرات معلقة"}
                      </td></tr>
                    ) : filteredPending.map((change, i) => (
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
                {canPush && <button
                  onClick={handlePush}
                  disabled={pushing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
                >
                  {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {t("sync.pushAll")}
                </button>}
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
          {/* ── Filters inside logs tab ── */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 flex-wrap">
            <div className="relative flex-[1] min-w-[160px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                className="w-full pr-10 pl-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="بحث في سجل المزامنة…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
            </div>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
            <span className="text-xs text-text-muted">—</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
            <div className="flex items-center gap-1">
              {["all", "success", "failed", "partial"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === s ? "bg-primary text-white" : "bg-gray-50 text-text-muted hover:text-text-secondary border border-gray-200"}`}
                >
                  {s === "all" ? "الكل" : s === "success" ? "نجاح" : s === "failed" ? "فشل" : "جزئي"}
                </button>
              ))}
            </div>
            {canView && <button
              onClick={() => {
                const filtered = getFilteredLogs();
                if (filtered.length === 0) { toast.error("لا توجد سجلات للتصدير"); return; }
                const headers = "الاتجاه,الحالة,الإجمالي,ناجح,فاشل,التاريخ";
                const rows = filtered.map((l) => [l.direction === "push" ? "رفع" : "سحب", l.status === "success" ? "نجاح" : l.status === "partial" ? "جزئي" : "فشل", l.items_total || 0, l.items_succeeded || 0, l.items_failed || 0, l.created_at || ""].join(","));
                const csv = [headers, ...rows].join("\n");
                const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `sync-logs-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
                URL.revokeObjectURL(url);
                toast.success(`تم تصدير ${filtered.length} سجل`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-text-secondary hover:bg-gray-100 hover:border-primary transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              تصدير
            </button>}
          </div>
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
                      <th className="py-3 px-4 text-right text-xs font-bold text-text-muted uppercase tracking-wider">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredLogs().map((log, i) => <SyncLogRow key={log.id} log={log} index={i} onSelect={(l) => setSelectedLog(l)} />)}
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

      {/* ── Sync Log Detail Modal ── */}
      <SyncLogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
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
  const canRestore = usePermission("sync", "restore");
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
          skipped: res.skipped || 0,
          conflicts: res.conflicts || 0,
        });
      } else {
        toast.error(res.error || "فشل تحميل المعاينة");
        setPreviewOpen(false);
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
    const realTotal = Math.max(1, previewData?.itemsToRestore || previewData?.itemsToDelete || 0);
    setRollbackProgress({ current: 0, total: realTotal });
    try {
      const res = await executeRollback(snapshotId);
      if (res.ok) {
        const total = (res.restored || 0) + (res.skipped || 0) + (res.conflict || 0) + (res.failed || 0);
        setRollbackProgress({ current: res.restored || 0, total: Math.max(total, realTotal) });
        setRollbackState("done");
        const parts = [];
        if (res.restored) parts.push(`تم استرجاع ${res.restored}`);
        if (res.conflict) parts.push(`تخطي ${res.conflict} بسبب تعديلات لاحقة`);
        if (res.skipped) parts.push(`تخطي ${res.skipped} غير موجودة`);
        if (res.failed) parts.push(`فشل ${res.failed}`);
        toast.success(parts.join("، "));
        onRefresh();
      } else {
        setRollbackState("failed");
        toast.error(res.error || t("sync.rollback.failed"));
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
          <div className="relative bg-bg-surface rounded-3xl shadow-modal border border-border-normal w-full max-w-md p-8 text-center animate-slide-up">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-base font-black text-text-primary mb-2">{t("sync.rollback.inProgress")}</h3>
            <div className="w-full h-2 bg-bg-base rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, (rollbackProgress.current / Math.max(1, rollbackProgress.total)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-text-muted">
              {rollbackProgress.current > 0 ? `تم استرجاع ${rollbackProgress.current} من ${rollbackProgress.total}` : `جارٍ الاسترجاع... (${rollbackProgress.total} منتج)`}
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
                className="bg-bg-surface rounded-2xl shadow-sm border border-border-normal p-4 hover:shadow-elevated transition-all duration-200 animate-fade-in"
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
                    {canRestore && <button
                      onClick={() => handleRollback(snap.id)}
                      disabled={rollbackState === "rolling_back" || snap.direction === "rollback"}
                      className="px-3 py-1.5 bg-warning-bg text-warning-text rounded-lg text-xs font-bold hover:opacity-80 disabled:opacity-50 transition-all active:scale-95 inline-flex items-center gap-1"
                    >
                      <Undo2 className="h-3 w-3" />
                      {t("sync.rollback.rollback")}
                    </button>}
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
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") { setOpen(false); onClose(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;

  const data = previewData;
  const totalAffected = (data?.itemsToDelete || 0) + (data?.itemsToRestore || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => { setOpen(false); onClose(); }} />
      <div className="relative bg-bg-surface rounded-3xl shadow-modal border border-border-normal w-full max-w-lg animate-slide-up overflow-hidden">
        <div className="px-6 py-5 border-b border-border-subtle">
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

              {(data.skipped > 0 || data.conflicts > 0) && (
                <div className="flex flex-col gap-2">
                  {data.skipped > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-bg-base border border-border-subtle">
                      <Info className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
                      <p className="text-xs text-text-secondary">
                        {data.skipped} منتج لم يعد موجوداً في النظام وسيتم تخطيه
                      </p>
                    </div>
                  )}
                  {data.conflicts > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-warning-bg/15 border border-warning-border/40">
                      <AlertCircle className="h-4 w-4 text-warning-text shrink-0 mt-0.5" />
                      <p className="text-xs text-warning-text font-medium">
                        {data.conflicts} منتج تم تعديله بعد المزامنة وسيتم تخطيه (لن يتم استرجاعها)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {data.itemsToDelete > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-danger-bg/15 border border-danger-border/40">
                  <AlertCircle className="h-4 w-4 text-danger-text shrink-0 mt-0.5" />
                  <p className="text-xs text-danger-text font-medium">
                    {t("sync.rollback.warning", { count: data.itemsToDelete })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-border-subtle bg-bg-base/50">
              <button
                onClick={() => { setOpen(false); onClose(); }}
                className="px-4 py-2.5 border border-border-strong rounded-xl text-sm font-bold text-text-secondary hover:bg-bg-overlay transition-all active:scale-95"
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
  const canPush = usePermission("sync", "push");
  const [showDiff, setShowDiff] = useState(false);
  const [imgError, setImgError] = useState(false);
  const currencySymbol = useAppSettingsStore((s) => s.settings.currency_symbol) || "ج.م";
  const diffs = useMemo(() => computeDiffs(c, currencySymbol), [c, currencySymbol]);
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
              loading="lazy"
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
          {canPush && <>
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
          </>}
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
