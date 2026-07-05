import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { CalendarDays, Eye, EyeOff, TrendingUp, Activity } from "lucide-react";
import api from "../../services/api";
import { mergePriceTimeline, filterByPeriod, computePriceStats } from "../../utils/priceChartHelpers";

function money(n) {
  return Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FIELD_META = {
  sale_price: { label: "سعر البيع", color: "#4f46e5", gradientId: "gradSale", lightBg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  purchase_price: { label: "سعر الشراء", color: "#059669", gradientId: "gradPurchase", lightBg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  wholesale_price: { label: "سعر الجملة", color: "#d97706", gradientId: "gradWholesale", lightBg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

function ChartTooltip({ active, payload, label, visibleLines }) {
  if (!active || !payload || !payload.length) return null;
  const visible = payload.filter(p => visibleLines[p.dataKey] && p.value != null);
  if (!visible.length) return null;
  return (
    <div className="rounded-2xl border border-white/40 bg-white/85 backdrop-blur-2xl px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.08)] min-w-[180px]">
      <div className="text-[11px] font-black text-slate-400 mb-2">{label}</div>
      {visible.map((entry, i) => {
        const meta = FIELD_META[entry.dataKey];
        return (
          <div key={i} className="flex items-center justify-between gap-4 py-1 border-b border-slate-100 last:border-0">
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-slate-600">
              <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
              {meta?.label || entry.name}
            </span>
            <span className="text-[14px] font-black text-slate-900" style={{ color: entry.color }}>
              {money(entry.value)} ج.م
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CustomLegend({ fields, visibleLines, onToggle }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {fields.map(field => {
        const meta = FIELD_META[field];
        const isVisible = visibleLines[field];
        return (
          <button
            key={field}
            onClick={() => onToggle(field)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-all active:scale-95 ${
              isVisible
                ? `${meta.lightBg} ${meta.text} ${meta.border} shadow-sm`
                : "border-slate-200 text-slate-400 bg-white hover:bg-slate-50"
            }`}
          >
            {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

export default function PriceTimelineChart({ itemId, currentPrices }) {
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("30d");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [visibleLines, setVisibleLines] = useState({
    sale_price: true,
    purchase_price: true,
    wholesale_price: false,
  });
  const [chartType, setChartType] = useState("line");

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    api.get(`/api/pricing/history/${itemId}`)
      .then(res => {
        if (res.data?.success) setRawData(res.data.data);
      })
      .catch(() => setRawData(null))
      .finally(() => setLoading(false));
  }, [itemId]);

  const mergedTimeline = useMemo(() => {
    if (!rawData?.by_field) return [];
    return mergePriceTimeline(rawData.by_field, currentPrices || rawData?.item);
  }, [rawData, currentPrices]);

  const filteredData = useMemo(() => {
    return filterByPeriod(mergedTimeline, period, customRange);
  }, [mergedTimeline, period, customRange]);

  const fields = Object.keys(FIELD_META);

  const statsByField = useMemo(() => {
    const result = {};
    for (const field of fields) {
      result[field] = computePriceStats(filteredData, field);
    }
    return result;
  }, [filteredData, fields]);

  const toggleLine = (field) => {
    setVisibleLines(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const anyVisible = Object.values(visibleLines).some(Boolean);

  const periodOptions = [
    { key: "7d", label: "٧ أيام" },
    { key: "30d", label: "٣٠ يوم" },
    { key: "90d", label: "٩٠ يوم" },
    { key: "all", label: "الكل" },
    { key: "custom", label: "مخصص" },
  ];

  return (
    <div className="bg-white border border-slate-200/60 rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl">
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800">اتجاه الأسعار</h3>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">تغيرات سعر البيع والشراء عبر الزمن</p>
          </div>
        </div>

        {/* Chart type toggle */}
        <div className="flex p-0.5 bg-slate-100 rounded-lg">
          <button onClick={() => setChartType("line")}
            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${chartType === "line" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>خطي</button>
          <button onClick={() => setChartType("area")}
            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${chartType === "area" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>مساحة</button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {periodOptions.map(opt => (
          opt.key === "custom" ? (
            <div key="custom" className="flex items-center gap-1">
              <button
                onClick={() => setPeriod("custom")}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                  period === "custom"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                <CalendarDays size={12} className="inline ml-1" />
                مخصص
              </button>
              {period === "custom" && (
                <div className="flex items-center gap-1">
                  <input type="date" value={customRange.start}
                    onChange={e => setCustomRange(c => ({ ...c, start: e.target.value }))}
                    className="text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 outline-none w-[130px] font-mono" />
                  <span className="text-[10px] text-slate-400">—</span>
                  <input type="date" value={customRange.end}
                    onChange={e => setCustomRange(c => ({ ...c, end: e.target.value }))}
                    className="text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 outline-none w-[130px] font-mono" />
                </div>
              )}
            </div>
          ) : (
            <button key={opt.key} onClick={() => setPeriod(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                period === opt.key
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >{opt.label}</button>
          )
        ))}
      </div>

      {/* Chart */}
      <div className="h-[300px] min-h-[300px] relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Activity size={24} className="animate-pulse text-indigo-500" />
              <span className="text-[11px] font-bold">تحميل البيانات...</span>
            </div>
          </div>
        ) : filteredData.length < 2 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Activity size={24} className="opacity-40" />
              <span className="text-[11px] font-bold">بيانات غير كافية للرسم البياني</span>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredData} margin={{ top: 15, right: 10, left: -10, bottom: 5 }}>
              <defs>
                {Object.entries(FIELD_META).map(([field, meta]) => (
                  <linearGradient key={field} id={meta.gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={meta.color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={meta.color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                dy={10}
                tickFormatter={val => {
                  const d = new Date(val);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={val => money(val)}
              />
              <Tooltip content={<ChartTooltip visibleLines={visibleLines} />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Legend content={<CustomLegend fields={fields} visibleLines={visibleLines} onToggle={toggleLine} />} verticalAlign="bottom" />
              {fields.map(field => {
                const meta = FIELD_META[field];
                if (!visibleLines[field]) return null;
                const commonProps = {
                  key: field,
                  type: "stepBefore",
                  dataKey: field,
                  name: meta.label,
                  stroke: meta.color,
                  strokeWidth: 2.5,
                  dot: { r: 3, fill: "#fff", stroke: meta.color, strokeWidth: 2 },
                  activeDot: { r: 5, fill: meta.color, stroke: "#fff", strokeWidth: 2 },
                  connectNulls: false,
                  isAnimationActive: true,
                };
                if (chartType === "area") {
                  return <Area key={field} {...commonProps} fill={`url(#${meta.gradientId})`} type="monotone" />;
                }
                return <Line key={field} {...commonProps} type="stepAfter" />;
              })}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Price Stats Strip */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
        {fields.map(field => {
          const meta = FIELD_META[field];
          const stats = statsByField[field];
          const isVisible = visibleLines[field];
          const trend = stats.change_pct > 0 ? "up" : stats.change_pct < 0 ? "down" : "flat";
          const trendColor = trend === "up" ? "text-rose-600" : trend === "down" ? "text-emerald-600" : "text-slate-400";

          return (
            <div key={field} className={`rounded-xl p-3 transition-all ${isVisible ? `${meta.lightBg} border ${meta.border}` : "bg-slate-50 border border-slate-100 opacity-60"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-500">{meta.label}</span>
                <span className={`text-[10px] font-black ${trendColor}`}>
                  {trend === "up" ? "↑" : trend === "down" ? "↓" : "–"} {Math.abs(stats.change_pct)}%
                </span>
              </div>
              <span className="text-lg font-black text-slate-800 block" style={isVisible ? { color: meta.color } : {}}>
                {money(stats.last)}
              </span>
              <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mt-1">
                <span>متوسط {money(stats.avg)}</span>
                <span>أعلى {money(stats.max)}</span>
                <span>أدنى {money(stats.min)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-bold text-slate-400">{stats.change_count} تغيير</span>
                {stats.volatility > 0 && (
                  <span className={`text-[9px] font-black ${stats.volatility > 0.1 ? "text-amber-600" : "text-slate-400"}`}>
                    تقلب {Math.round(stats.volatility * 100)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
