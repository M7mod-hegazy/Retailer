import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Activity, Clock, Package,
  AlertTriangle, DollarSign, ShoppingCart, BarChart3,
  Zap, Target, ShieldAlert, HelpCircle,
} from "lucide-react";
import api from "../../services/api";

function money(n) {
  return Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const INSIGHT_CONFIG = {
  strong_seller: {
    icon: Zap, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200",
    label: "مبيع قوي", glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
  },
  no_sales: {
    icon: HelpCircle, color: "text-text-secondary", bg: "bg-bg-overlay", border: "border-border-normal",
    label: "بدون مبيعات", glow: "",
  },
  overstocked: {
    icon: Package, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200",
    label: "مخزون زائد", glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]",
  },
  understocked: {
    icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200",
    label: "مخزون ناقص", glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]",
  },
  sales_dropping: {
    icon: TrendingDown, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200",
    label: "انخفاض مبيعات", glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]",
  },
  slow_mover: {
    icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200",
    label: "بطيء الحركة", glow: "shadow-[0_0_20px_rgba(245,158,11,0.1)]",
  },
  price_volatile: {
    icon: Activity, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200",
    label: "أسعار متقلبة", glow: "shadow-[0_0_20px_rgba(139,92,246,0.1)]",
  },
  normal: {
    icon: BarChart3, color: "text-text-secondary", bg: "bg-bg-overlay", border: "border-border-normal",
    label: "منتظم", glow: "",
  },
};

function MiniSparkline({ values, color = "#4f46e5" }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 80, H = 24;
  const step = W / (values.length - 1);
  const d = values.map((v, i) => {
    const x = i * step;
    const y = H - ((v - min) / range) * H * 0.8 - H * 0.1;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InsightCard({ title, children, icon: Icon, colorClass, bgClass, borderClass, glowClass }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${borderClass} ${bgClass} ${glowClass} p-4 flex flex-col gap-2 relative overflow-hidden`}
    >
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-xl ${colorClass.replace("text-", "bg-").replace("600", "100")} ${colorClass}`}>
          {Icon && <Icon size={14} />}
        </div>
        <span className={`text-[11px] font-black ${colorClass}`}>{title}</span>
      </div>
      <div className="flex-1">
        {children}
      </div>
    </motion.div>
  );
}

export default function ItemSmartInsights({ itemId, period, customRange, selectedItem }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  const from = useMemo(() => {
    if (period === "custom" && customRange?.start) return customRange.start;
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 30;
    return new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  }, [period, customRange]);

  const to = useMemo(() => {
    if (period === "custom" && customRange?.end) return customRange.end;
    return new Date().toISOString().split("T")[0];
  }, [period, customRange]);

  const prevFrom = useMemo(() => {
    if (!from) return null;
    const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000));
    const d = new Date(from);
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  }, [from, to]);

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    api.get(`/api/items/${itemId}/analytics`, { params: { from, to } })
      .then(res => {
        if (res.data?.success) setAnalytics(res.data.data);
      })
      .catch(() => setAnalytics(null))
      .finally(() => setLoading(false));
  }, [itemId, from, to]);

  const recConfig = analytics ? INSIGHT_CONFIG[analytics.recommendation?.type] || INSIGHT_CONFIG.normal : null;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-2xl border border-border-subtle bg-bg-surface p-4 animate-pulse">
            <div className="h-4 w-20 bg-border-normal rounded mb-3" />
            <div className="h-6 w-28 bg-border-normal rounded mb-2" />
            <div className="h-3 w-32 bg-bg-overlay rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!analytics) return null;

  const { sales, stock, prices, recommendation, rank } = analytics;
  const hasPrev = sales.prev_qty > 0;
  const trendUp = sales.qty_change_pct >= 0;
  const fields = Object.keys(prices || {});

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {/* Card 1: Sales Performance */}
      <InsightCard
        title="أداء المبيعات"
        icon={TrendingUp}
        colorClass={sales.avg_daily >= 1 ? "text-emerald-600" : sales.avg_daily >= 0.3 ? "text-amber-600" : "text-text-secondary"}
        bgClass={sales.avg_daily >= 1 ? "bg-emerald-50/60" : sales.avg_daily >= 0.3 ? "bg-amber-50/60" : "bg-bg-overlay/60"}
        borderClass={sales.avg_daily >= 1 ? "border-emerald-200/70" : sales.avg_daily >= 0.3 ? "border-amber-200/70" : "border-border-normal/70"}
        glowClass={sales.avg_daily >= 1 ? "shadow-[0_0_20px_rgba(16,185,129,0.08)]" : ""}
      >
        <div className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-black ${sales.avg_daily >= 1 ? "text-emerald-700" : "text-text-primary"}`}>
            {money(sales.current_qty)}
          </span>
          <span className="text-[10px] font-bold text-text-muted">وحدة</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-text-secondary mt-1">
          <ShoppingCart size={11} className="opacity-50" />
          <span>{sales.avg_daily.toFixed(1)} وحدة/يوم</span>
          <span className="text-text-muted">·</span>
          <span>{sales.current_count} فاتورة</span>
        </div>
        {rank && (
          <div className="flex items-center gap-1 mt-1">
            <Target size={10} className="text-indigo-500" />
            <span className="text-[10px] font-bold text-indigo-600">
              {rank.items_above > 0
                ? `يتفوق على ${rank.percentile}% من الأصناف`
                : "لم يتم بيعه في الفترة"}
            </span>
          </div>
        )}
      </InsightCard>

      {/* Card 2: Period Comparison */}
      <InsightCard
        title="مقارنة الفترة"
        icon={trendUp ? TrendingUp : TrendingDown}
        colorClass={trendUp ? "text-emerald-600" : "text-rose-600"}
        bgClass={trendUp ? "bg-emerald-50/60" : "bg-rose-50/60"}
        borderClass={trendUp ? "border-emerald-200/70" : "border-rose-200/70"}
        glowClass={trendUp ? "" : "shadow-[0_0_20px_rgba(239,68,68,0.08)]"}
      >
        {hasPrev ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-black ${trendUp ? "text-emerald-700" : "text-rose-700"}`}>
                {trendUp ? "↑" : "↓"} {Math.abs(sales.qty_change_pct)}%
              </span>
              <span className="text-[10px] font-bold text-text-muted">عن الفترة السابقة</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold text-text-secondary mt-1">
              <span>السابقة: {money(sales.prev_qty)} وحدة</span>
              <span className="text-text-muted">|</span>
              <span>الحالية: {money(sales.current_qty)} وحدة</span>
            </div>
            {Math.abs(sales.qty_change_pct) >= 50 && (
              <div className="flex items-center gap-1 mt-1">
                <Zap size={10} className="text-amber-500" />
                <span className="text-[10px] font-bold text-amber-600">
                  {sales.qty_change_pct >= 50 ? "قفزة كبيرة في المبيعات" : "انخفاض حاد"}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="text-[12px] font-bold text-text-muted mt-2">
            لا توجد بيانات كافية للمقارنة
          </div>
        )}
      </InsightCard>

      {/* Card 3: Stock Health */}
      <InsightCard
        title="صحة المخزون"
        icon={stock.days_until_stockout !== null && stock.days_until_stockout < 30 ? AlertTriangle : Package}
        colorClass={stock.days_until_stockout !== null && stock.days_until_stockout < 7 ? "text-rose-600" : stock.days_until_stockout !== null && stock.days_until_stockout < 30 ? "text-amber-600" : stock.current > 50 ? "text-blue-600" : "text-text-secondary"}
        bgClass={stock.days_until_stockout !== null && stock.days_until_stockout < 7 ? "bg-rose-50/60" : stock.days_until_stockout !== null && stock.days_until_stockout < 30 ? "bg-amber-50/60" : "bg-blue-50/60"}
        borderClass={stock.days_until_stockout !== null && stock.days_until_stockout < 7 ? "border-rose-200/70" : stock.days_until_stockout !== null && stock.days_until_stockout < 30 ? "border-amber-200/70" : "border-blue-200/70"}
        glowClass=""
      >
        <div className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-black ${stock.current <= 0 ? "text-rose-700" : stock.current < 10 ? "text-amber-700" : "text-text-primary"}`}>
            {money(stock.current)}
          </span>
          <span className="text-[10px] font-bold text-text-muted">وحدة</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-text-secondary mt-1 flex-wrap">
          {stock.days_until_stockout !== null ? (
            <>
              <span className={stock.days_until_stockout < 7 ? "text-rose-600" : stock.days_until_stockout < 30 ? "text-amber-600" : "text-text-secondary"}>
                يكفي {stock.days_until_stockout} يوم
              </span>
              <span className="text-text-muted">·</span>
            </>
          ) : null}
          <span>دوران {stock.turnover_ratio}x</span>
        </div>
        {stock.current <= 0 && (
          <div className="flex items-center gap-1 mt-1">
            <ShieldAlert size={10} className="text-rose-500" />
            <span className="text-[10px] font-bold text-rose-600">المخزون نفذ بالكامل</span>
          </div>
        )}
        {stock.days_until_stockout !== null && stock.days_until_stockout < 14 && stock.current > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <AlertTriangle size={10} className="text-amber-500" />
            <span className="text-[10px] font-bold text-amber-600">يحتاج إعادة طلب قريباً</span>
          </div>
        )}
      </InsightCard>

      {/* Card 4: Price Activity */}
      <InsightCard
        title="نشاط الأسعار"
        icon={DollarSign}
        colorClass="text-violet-600"
        bgClass="bg-violet-50/60"
        borderClass="border-violet-200/70"
        glowClass=""
      >
        <div className="flex items-center gap-2 flex-wrap">
          {fields.length > 0 ? (
            <>
              <span className="text-xl font-black text-violet-700">
                {fields.reduce((sum, f) => sum + prices[f].change_count, 0)}
              </span>
              <span className="text-[10px] font-bold text-text-muted">تغيير</span>
            </>
          ) : (
            <span className="text-[12px] font-bold text-text-muted">لم يسجل تغيير</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {fields.map(f => {
            const p = prices[f];
            if (!p || p.change_count === 0) return null;
            const labels = { sale_price: "البيع", purchase_price: "الشراء", wholesale_price: "الجملة" };
            const up = p.current >= (p.avg || 0);
            return (
              <span key={f} className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold border ${up ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                {labels[f] || f}
                <span className="opacity-60">{up ? "↑" : "↓"}</span>
              </span>
            );
          })}
        </div>
        {recommendation && (
          <div className={`mt-2 rounded-xl border ${recConfig?.border || "border-border-normal"} ${recConfig?.bg || "bg-bg-overlay"} p-2`}>
            <div className={`flex items-center gap-1.5 text-[10px] font-black ${recConfig?.color || "text-text-secondary"}`}>
              {recConfig?.icon && React.createElement(recConfig.icon, { size: 12 })}
              <span>{recommendation.label}</span>
            </div>
            <p className="text-[9px] font-bold text-text-secondary mt-0.5 leading-relaxed">{recommendation.detail}</p>
          </div>
        )}
      </InsightCard>
    </div>
  );
}
