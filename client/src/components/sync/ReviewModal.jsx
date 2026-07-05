import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  X, CheckCircle2, Loader2, ArrowLeftRight, ImageIcon,
  Plus, AlertTriangle, Package, Shield, Clock,
  Globe, ChevronDown, GitCompare, Minus,
  TrendingUp, TrendingDown, BarChart3, ListFilter,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getSyncImpactSummary } from "../../services/syncService";

function isDefined(v) {
  return v !== undefined && v !== null && v !== "";
}

function resolveChangeType(item) {
  if (item.changeType) return item.changeType;
  if (item.isNew) return "new";
  const diffEntries = Object.entries(item.diff || {}).filter(([, v]) => v === true);
  if (diffEntries.length > 1) return "conflict";
  return "update";
}

function computeImpactCategories(item) {
  const cats = [];
  const raw = item._raw || item;
  if (raw.isNew || item.changeType === "new") {
    cats.push("new");
  }
  if (raw.current && raw.incoming) {
    const oldPrice = Number(raw.current.price) || 0;
    const newPrice = Number(raw.incoming.price) || 0;
    if (raw.diff?.price && newPrice > oldPrice) cats.push("priceUp");
    if (raw.diff?.price && newPrice < oldPrice) cats.push("priceDown");
    if (raw.diff?.stock && Number(raw.incoming.stock) === 0) cats.push("stockZero");
  }
  if (raw.hasImages) cats.push("imageChange");
  return cats;
}

const FILTER_CONFIG = {
  all: {},
  priceUp: { icon: TrendingUp, bg: "bg-success-bg", text: "text-success-text", border: "border-success-border" },
  priceDown: { icon: TrendingDown, bg: "bg-danger-bg", text: "text-danger-text", border: "border-danger-border" },
  stockZero: { icon: AlertTriangle, bg: "bg-warning-bg", text: "text-warning-text", border: "border-warning-border" },
  new: { icon: Plus, bg: "bg-info-bg", text: "text-info-text", border: "border-info-border" },
  imageChange: { icon: ImageIcon, bg: "bg-primary-50", text: "text-primary", border: "border-primary/10" },
};

function ChangeTypeBadge({ type }) {
  const { t } = useTranslation();
  const config = {
    new: { label: t("sync.review.new"), bg: "bg-success-bg", text: "text-success-text", border: "border-success-border", icon: Plus },
    update: { label: t("sync.review.update"), bg: "bg-info-bg", text: "text-info-text", border: "border-info-border", icon: ArrowLeftRight },
    conflict: { label: t("sync.review.conflict"), bg: "bg-danger-bg", text: "text-danger-text", border: "border-danger-border", icon: AlertTriangle },
  };
  const c = config[type] || config.update;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${c.bg} ${c.text} ${c.border}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

function ImpactBadge({ category }) {
  const { t } = useTranslation();
  const cfg = FILTER_CONFIG[category];
  if (!cfg || !cfg.icon) return null;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <Icon className="h-3 w-3" />
      {t(`sync.impact.${category}`)}
    </span>
  );
}

function DiffRow({ fieldLabel, currentValue, newValue, type }) {
  return (
    <div className={`grid grid-cols-[1fr_auto_1fr] gap-2 py-2 px-3 rounded-lg items-start ${
      type === "added" ? "bg-success-bg/20" :
      type === "removed" ? "bg-danger-bg/20" :
      type === "changed" ? "bg-warning-bg/20" :
      ""
    }`}>
      <div className="min-w-0">
        {isDefined(currentValue) ? (
          <span className={`text-xs font-medium truncate block ${
            type === "added" ? "text-text-muted line-through" : "text-text-primary"
          }`}>
            {String(currentValue)}
          </span>
        ) : (
          <span className="text-xs text-text-muted/50">—</span>
        )}
        {type === "added" && (
          <span className="text-[10px] font-bold text-success-text mt-0.5 block">+ {fieldLabel}</span>
        )}
      </div>

      <div className="flex items-center pt-0.5 px-1">
        {type === "unchanged" ? (
          <span className="text-text-muted/20 text-xs font-bold">=</span>
        ) : (
          <ArrowLeftRight className={`h-3.5 w-3.5 flex-shrink-0 ${
            type === "changed" ? "text-warning-text" :
            type === "added" ? "text-success-text" :
            "text-danger-text"
          }`} />
        )}
      </div>

      <div className="min-w-0 text-left ltr:text-left rtl:text-right">
        {isDefined(newValue) ? (
          <span className={`text-xs font-semibold truncate block ${
            type === "removed" ? "text-text-muted line-through" :
            type === "unchanged" ? "text-text-secondary" :
            "text-text-primary"
          }`}>
            {String(newValue)}
          </span>
        ) : (
          <span className="text-xs text-text-muted/50">—</span>
        )}
        {type === "removed" && (
          <span className="text-[10px] font-bold text-danger-text mt-0.5 block">- {fieldLabel}</span>
        )}
      </div>
    </div>
  );
}

function ChangeCard({ change, index, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { t } = useTranslation();

  const changeType = resolveChangeType(change);
  const hasFields = change.fields && change.fields.length > 0;
  const hasOldFields = change.current && change.incoming && change.diff;
  const impactCats = computeImpactCategories(change);

  return (
    <div
      className="border border-gray-200 rounded-2xl overflow-hidden hover:shadow-sm hover:border-gray-300 transition-all duration-300 animate-fade-in bg-white"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-gray-100"
      >
        <div className={`w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden border border-gray-200 ${
          change.imageUrl ? "" : "bg-gray-50 flex items-center justify-center"
        }`}>
          {change.imageUrl ? (
            <img src={change.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Package className="h-5 w-5 text-text-muted" />
          )}
        </div>

        <div className="flex-1 min-w-0 text-right">
          <div className="text-sm font-bold text-text-primary truncate">
            {change.productName || change.name}
          </div>
          <div className="text-[11px] text-text-muted font-medium mt-0.5">
            {t("sync.sku")}: {change.sku}
          </div>
          {impactCats.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {impactCats.map((cat) => (
                <ImpactBadge key={cat} category={cat} />
              ))}
            </div>
          )}
        </div>

        <ChangeTypeBadge type={changeType} />

        <div className={`transition-transform duration-200 flex-shrink-0 ${expanded ? "rotate-180" : ""}`}>
          <ChevronDown className="h-4 w-4 text-text-muted" />
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-gray-200">
          {hasFields && (
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-4 py-2 bg-gray-50/50 border-b border-gray-200">
              <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                {t("sync.review.currentValue")}
              </div>
              <div />
              <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider text-left ltr:text-left rtl:text-right">
                {t("sync.review.newValue")}
              </div>
            </div>
          )}

          <div className="px-4 py-2 space-y-1">
            {hasFields ? (
              change.fields.map((f, i) => (
                <DiffRow
                  key={f.name || i}
                  fieldLabel={f.label || f.name}
                  currentValue={f.currentValue}
                  newValue={f.newValue}
                  type={f.type}
                />
              ))
            ) : hasOldFields ? (
              Object.entries(change.diff).map(([field, changed]) => {
                if (change.fields && change.fields[field] === false) return null;
                const currentVal = change.current?.[field];
                const incomingVal = change.incoming?.[field];
                let type = "unchanged";
                if (changed && !isDefined(currentVal) && isDefined(incomingVal)) type = "added";
                else if (changed && isDefined(currentVal) && !isDefined(incomingVal)) type = "removed";
                else if (changed) type = "changed";
                return (
                  <DiffRow
                    key={field}
                    fieldLabel={field}
                    currentValue={currentVal}
                    newValue={incomingVal}
                    type={type}
                  />
                );
              })
            ) : (
              <div className="py-4 text-center text-text-muted text-xs">
                {t("sync.review.noChangesDetailed")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatHeroCard({ icon: Icon, value, label, bgClass, delay }) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl bg-primary-50 border border-primary/10 shadow-sm animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bgClass}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <span className="text-lg font-black text-text-primary font-number">{value}</span>
      <span className="text-[10px] font-bold text-text-muted text-center leading-tight">{label}</span>
    </div>
  );
}

function ImpactCard({ icon: Icon, value, label, detail, detailClass, bgClass, iconBgClass, borderClass, delay }) {
  return (
    <div
      className={`flex flex-col gap-1 p-3 rounded-2xl border ${bgClass} ${borderClass} animate-fade-in`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBgClass}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <span className="text-lg font-black text-text-primary font-number">{value}</span>
      <span className="text-[10px] font-bold text-text-muted leading-tight">{label}</span>
      {detail && <span className={`text-[10px] font-bold ${detailClass || "text-text-secondary"}`}>{detail}</span>}
    </div>
  );
}

export default function ReviewModal(props) {
  const { t } = useTranslation();

  const isOpen = props.isOpen ?? props.open ?? false;
  const onClose = props.onClose ?? props.onCancel ?? (() => {});
  const onConfirm = props.onConfirm ?? (() => {});
  const onBack = props.onBack ?? null;
  const loading = props.loading ?? false;
  const storeName = props.storeName ?? "";
  const lastSyncAt = props.lastSyncAt ?? "";

  const rawChanges = props.changes ?? props.previews ?? [];

  const [impactSummary, setImpactSummary] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setImpactSummary(null);
    setImpactLoading(true);
    setActiveFilter("all");
    setSortBy("default");
    const skus = rawChanges.map(c => c.sku).filter(Boolean);
    getSyncImpactSummary(skus)
      .then((res) => {
        if (res?.ok && res?.summary) setImpactSummary(res.summary);
      })
      .catch(() => {})
      .finally(() => setImpactLoading(false));
  }, [isOpen]);

  const normalizedChanges = useMemo(() => {
    if (!rawChanges.length) return [];
    return rawChanges.map((item) => {
      if (item.changeType) return item;
      const changeType = resolveChangeType(item);
      const fields = Object.entries(item.diff || {}).map(([fieldName, changed]) => {
        if (item.fields && item.fields[fieldName] === false) return null;
        const currentValue = item.current?.[fieldName];
        const newValue = item.incoming?.[fieldName];
        let type = "unchanged";
        if (changed && !isDefined(currentValue) && isDefined(newValue)) type = "added";
        else if (changed && isDefined(currentValue) && !isDefined(newValue)) type = "removed";
        else if (changed) type = "changed";
        return { name: fieldName, currentValue, newValue, type };
      }).filter(Boolean);
      return {
        id: item.sku,
        productName: item.name,
        sku: item.sku,
        imageUrl: item.imageUrl || null,
        changeType,
        fields,
        _raw: item,
        impactCategories: computeImpactCategories({ _raw: item, changeType }),
      };
    });
  }, [rawChanges]);

  const filteredChanges = useMemo(() => {
    let list = normalizedChanges;
    if (activeFilter !== "all") {
      list = list.filter((c) => (c.impactCategories || []).includes(activeFilter));
    }
    if (sortBy === "name") {
      list = [...list].sort((a, b) => (a.productName || "").localeCompare(b.productName || ""));
    } else if (sortBy === "priceChange") {
      list = [...list].sort((a, b) => {
        const aRaw = a._raw;
        const bRaw = b._raw;
        const aDiff = aRaw?.current?.price != null && aRaw?.incoming?.price != null
          ? Math.abs(Number(aRaw.incoming.price) - Number(aRaw.current.price)) : 0;
        const bDiff = bRaw?.current?.price != null && bRaw?.incoming?.price != null
          ? Math.abs(Number(bRaw.incoming.price) - Number(bRaw.current.price)) : 0;
        return bDiff - aDiff;
      });
    }
    return list;
  }, [normalizedChanges, activeFilter, sortBy]);

  const stats = useMemo(() => {
    const total = normalizedChanges.length;
    const newCount = normalizedChanges.filter((c) => c.changeType === "new").length;
    const updatedCount = normalizedChanges.filter((c) => c.changeType === "update").length;
    const conflictCount = normalizedChanges.filter((c) => c.changeType === "conflict").length;
    const rawImageCount = rawChanges.filter((r) => r.hasImages).length;
    return {
      total,
      new: newCount,
      updated: updatedCount,
      conflicts: conflictCount,
      withImages: rawImageCount,
    };
  }, [normalizedChanges, rawChanges]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const sortOptions = [
    { key: "default", label: t("sync.impact.sortDefault") },
    { key: "priceChange", label: t("sync.impact.sortPriceDesc") },
    { key: "name", label: t("sync.impact.sortName") },
  ];

  const filters = [
    { key: "all", label: t("sync.impact.filterAll") },
    { key: "priceUp", label: t("sync.impact.pricesUp") },
    { key: "priceDown", label: t("sync.impact.pricesDown") },
    { key: "stockZero", label: t("sync.impact.stockToZero") },
    { key: "new", label: t("sync.impact.newProducts") },
    { key: "imageChange", label: t("sync.impact.imageChanges") },
  ];

  if (!isOpen) return null;

  const sum = impactSummary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={handleBackdropClick}
      />

      <div className="relative bg-white rounded-3xl shadow-modal border border-gray-200 w-full max-w-3xl max-h-[90vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary-50 flex items-center justify-center">
              <GitCompare className="h-5 w-5 text-primary" />
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
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 hover:text-text-primary transition-all duration-200 text-text-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 bg-gray-50/30 border-b border-gray-200">
          <div className="grid grid-cols-5 gap-2">
            <StatHeroCard
              icon={GitCompare}
              value={stats.total}
              label={t("sync.review.totalProducts")}
              bgClass="bg-primary"
              delay={80}
            />
            <StatHeroCard
              icon={Plus}
              value={stats.new}
              label={t("sync.review.newProducts")}
              bgClass="bg-success-text"
              delay={140}
            />
            <StatHeroCard
              icon={ArrowLeftRight}
              value={stats.updated}
              label={t("sync.review.updatedProducts")}
              bgClass="bg-info-text"
              delay={200}
            />
            <StatHeroCard
              icon={ImageIcon}
              value={stats.withImages}
              label={t("sync.review.withImages")}
              bgClass="bg-primary"
              delay={260}
            />
            <StatHeroCard
              icon={AlertTriangle}
              value={stats.conflicts}
              label={t("sync.review.conflicts")}
              bgClass="bg-danger-text"
              delay={320}
            />
          </div>
        </div>

        {impactLoading ? (
          <div className="flex items-center justify-center px-6 py-4 border-b border-gray-200 bg-gray-50/20 gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
            <span className="text-xs text-text-muted font-medium">{t("sync.impact.loading")}</span>
          </div>
        ) : sum ? (
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/20">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-black text-text-primary">{t("sync.impact.title")}</h3>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <ImpactCard
                icon={TrendingUp}
                value={sum.pricesUp.count}
                label={t("sync.impact.pricesUp")}
                detail={`+${sum.pricesUp.totalIncrease.toFixed(2)} ر.س`}
                detailClass="text-success-text"
                bgClass="bg-success-bg"
                iconBgClass="bg-success-text"
                borderClass="border-success-border"
                delay={80}
              />
              <ImpactCard
                icon={TrendingDown}
                value={sum.pricesDown.count}
                label={t("sync.impact.pricesDown")}
                detail={`-${sum.pricesDown.totalDecrease.toFixed(2)} ر.س`}
                detailClass="text-danger-text"
                bgClass="bg-danger-bg"
                iconBgClass="bg-danger-text"
                borderClass="border-danger-border"
                delay={130}
              />
              <ImpactCard
                icon={AlertTriangle}
                value={sum.stockToZero.count}
                label={t("sync.impact.stockToZero")}
                bgClass="bg-warning-bg"
                iconBgClass="bg-warning-text"
                borderClass="border-warning-border"
                delay={180}
              />
              <ImpactCard
                icon={Plus}
                value={sum.newProducts}
                label={t("sync.impact.newProducts")}
                bgClass="bg-info-bg"
                iconBgClass="bg-info-text"
                borderClass="border-info-border"
                delay={230}
              />
              <ImpactCard
                icon={ImageIcon}
                value={sum.imageChanges.count}
                label={t("sync.impact.imageChanges")}
                bgClass="bg-primary-50"
                iconBgClass="bg-primary"
                borderClass="border-primary/10"
                delay={280}
              />
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-4 px-6 py-2.5 bg-gray-50/20 border-b border-gray-200">
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-medium">
            <Shield className="h-3.5 w-3.5 text-success-text" />
            {t("sync.review.encrypted")}
          </div>
          <span className="w-px h-3 bg-border-subtle" />
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-medium">
            <Clock className="h-3.5 w-3.5" />
            {lastSyncAt
              ? t("sync.review.lastSync", { time: lastSyncAt })
              : t("sync.never")}
          </div>
          <span className="w-px h-3 bg-border-subtle" />
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-medium">
            <Globe className="h-3.5 w-3.5" />
            {t("sync.review.fromStore")}
          </div>
        </div>

        {filteredChanges.length > 0 && (
          <div className="flex items-center justify-between px-6 py-2.5 bg-gray-50/20 border-b border-gray-200">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all duration-200 whitespace-nowrap ${
                    activeFilter === f.key
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-text-secondary border-gray-200 hover:border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {f.label}
                  {f.key !== "all" && normalizedChanges.filter((c) => (c.impactCategories || []).includes(f.key)).length > 0 && (
                    <span className={`mr-1 ${activeFilter === f.key ? "text-white/70" : "text-text-muted"}`}>
                      ({normalizedChanges.filter((c) => (c.impactCategories || []).includes(f.key)).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="relative flex-shrink-0">
              <button
                onClick={() => setSortOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-gray-200 bg-white text-text-secondary hover:border-gray-300 transition-colors"
              >
                <ListFilter className="h-3 w-3" />
                {sortOptions.find((o) => o.key === sortBy)?.label}
                <ChevronDown className={`h-3 w-3 transition-transform ${sortOpen ? "rotate-180" : ""}`} />
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-elevated py-1 min-w-[160px]">
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => { setSortBy(opt.key); setSortOpen(false); }}
                        className={`w-full text-right px-3 py-2 text-xs font-bold transition-colors ${
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

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-text-muted font-medium">{t("sync.review.loadingPreview")}</span>
            </div>
          ) : filteredChanges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <CheckCircle2 className="h-10 w-10 text-success-text" />
              <span className="text-sm text-text-secondary font-bold">{t("sync.review.noChangesDetailed")}</span>
            </div>
          ) : (
            filteredChanges.map((change, idx) => (
              <ChangeCard
                key={change.id ?? change.sku ?? idx}
                change={change}
                index={idx}
                defaultExpanded={idx === 0 && filteredChanges.length <= 3}
              />
            ))
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2.5 text-sm font-bold text-text-secondary hover:bg-gray-100 rounded-xl transition-all duration-200 active:scale-95"
              >
                {t("sync.review.editSelection")}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-text-secondary hover:bg-gray-100 transition-all duration-200 active:scale-95"
            >
              {t("sync.review.cancel")}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading || filteredChanges.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 shadow-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {loading
                ? t("sync.review.applying")
                : t("sync.review.confirmSync", { count: filteredChanges.length })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
