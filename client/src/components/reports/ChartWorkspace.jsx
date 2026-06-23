import React, { useMemo, useState, useRef, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, RadarChart, Radar as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  Maximize2, Minimize2, Download, LineChart as LineIcon,
  BarChart3, PieChart as PieIcon, AreaChart as AreaIcon,
  Radar, Layers, Settings2, Check
} from "lucide-react";
import { formatNumber } from "../../utils/currency";

function buildLabelMap(columns) {
  const map = {};
  for (const col of columns) {
    const key = col.id || col.key || col;
    map[key] = col.label || col.header || key;
  }
  return map;
}

const COLOR_THEMES = [
  { id: "emerald", label: "زمردي", colors: ["#059669", "#2563EB", "#7C3AED", "#D97706", "#DC2626", "#0891B2", "#F59E0B", "#EC4899"] },
  { id: "ocean", label: "محـيط", colors: ["#0EA5E9", "#06B6D4", "#14B8A6", "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF"] },
  { id: "sunset", label: "غـروب", colors: ["#F59E0B", "#F97316", "#EF4444", "#EC4899", "#D946EF", "#A855F7", "#8B5CF6", "#6366F1"] },
  { id: "mono", label: "أحادي", colors: ["#18181B", "#3F3F46", "#52525B", "#71717A", "#A1A1AA", "#D4D4D8", "#E4E4E7", "#F4F4F5"] },
];

const CHART_TYPES = [
  { id: "bar", icon: BarChart3, label: "أعمدة" },
  { id: "line", icon: LineIcon, label: "خطي" },
  { id: "area", icon: AreaIcon, label: "مساحي" },
  { id: "pie", icon: PieIcon, label: "دائري" },
  { id: "radar", icon: Radar, label: "رادار" },
  { id: "composed", icon: Layers, label: "مركب" },
];

function smartDetectColumns(rows, columns) {
  if (!rows.length || !columns.length) return { textColumns: [], dateColumns: [], numericColumns: [], idColumns: [] };
  const textColumns = [];
  const dateColumns = [];
  const numericColumns = [];
  const idColumns = [];
  const ID_KEY_PATTERN = /^id$|_id$|^id_|^no$|^code$|^sku$|^barcode$/i;
  const DATE_SAMPLES = [/^\d{4}[-/]\d{2}[-/]\d{2}/, /^\d{2}[-/]\d{2}[-/]\d{4}/];
  const NUMERIC_TYPES = new Set(["cur", "num", "percent", "money", "number"]);
  const DATE_TYPES = new Set(["date", "datetime"]);

  function findFirstSample(key) {
    for (let i = 0; i < rows.length; i++) {
      const val = rows[i][key];
      if (val != null) return val;
    }
    return null;
  }

  for (const col of columns) {
    const key = col.id || col.key || col;
    const colType = (col.type || "").toLowerCase();

    if (DATE_TYPES.has(colType)) { dateColumns.push(key); continue; }
    if (NUMERIC_TYPES.has(colType)) { numericColumns.push(key); continue; }

    const sample = findFirstSample(key);
    if (sample == null) continue;
    const str = String(sample);
    if (ID_KEY_PATTERN.test(key) && (str.length < 10 || !isNaN(Number(sample)))) {
      idColumns.push(key);
      continue;
    }
    if (DATE_SAMPLES.some((r) => r.test(str)) || str.includes("/") || (!isNaN(Date.parse(str)) && str.length > 5)) {
      dateColumns.push(key);
      continue;
    }
    const num = Number(sample);
    if (!isNaN(num) && str.trim() !== "" && typeof sample !== "boolean") {
      numericColumns.push(key);
    } else {
      textColumns.push(key);
    }
  }
  return { textColumns, dateColumns, numericColumns, idColumns };
}

function transformForComposed(rows, xKey, yKeys) {
  if (!rows.length || !xKey || !yKeys.length) return [];
  return rows.map((row) => {
    const entry = { [xKey]: row[xKey] };
    for (const key of yKeys) {
      entry[key] = Number(row[key]) || 0;
    }
    return entry;
  });
}

function aggregateForPie(rows, xKey, yKey) {
  if (!rows.length || !xKey || !yKey) return [];
  const map = new Map();
  for (const row of rows) {
    const label = row[xKey] ?? "غير محدد";
    const val = Number(row[yKey]) || 0;
    map.set(label, (map.get(label) || 0) + val);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function aggregateForRadar(rows, textKey, numericKeys) {
  if (!rows.length || !textKey || !numericKeys.length) return [];
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const label = row[textKey] ?? "غير محدد";
    if (seen.has(label)) continue;
    seen.add(label);
    const entry = { [textKey]: label };
    for (const key of numericKeys) {
      entry[key] = Number(row[key]) || 0;
    }
    result.push(entry);
    if (result.length >= 12) break;
  }
  return result;
}

function formatChartValue(value) {
  if (value == null) return "—";
  const num = Number(value);
  if (!isNaN(num)) return formatNumber(num);
  return String(value);
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 shadow-2xl backdrop-blur-xl" style={{ direction: "rtl" }}>
      <p className="text-sm font-bold text-zinc-400 mb-2">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-3 text-sm">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="font-medium text-white">{entry.name}</span>
          <span className="font-black text-white tabular-nums" dir="ltr">{formatChartValue(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

const LegendContent = ({ payload }) => {
  if (!payload?.length) return null;
  return (
    <div className="flex flex-wrap justify-center gap-3 mt-4 px-4" style={{ direction: "rtl" }}>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs font-bold text-zinc-600 bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-100">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.value}
        </div>
      ))}
    </div>
  );
};

function useChartDimensions() {
  const ref = useRef(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const measure = useCallback(() => {
    if (ref.current) {
      const { clientWidth, clientHeight } = ref.current;
      setDims({ width: clientWidth, height: clientHeight });
    }
  }, []);
  React.useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);
  return [ref, dims];
}

export default function ChartWorkspace({ rows, columns, isLoading, title = "" }) {
  const [chartType, setChartType] = useState("bar");
  const [colorTheme, setColorTheme] = useState(COLOR_THEMES[0]);
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [smoothCurves, setSmoothCurves] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const chartContainerRef = useRef(null);

  const detected = useMemo(() => smartDetectColumns(rows, columns), [rows, columns]);
  const { textColumns, dateColumns, numericColumns } = detected;

  const [xKey, setXKey] = useState(null);
  const [yKey, setYKey] = useState(null);
  const [multiYKeys, setMultiYKeys] = useState([]);

  const autoXKey = useMemo(() => {
    if (dateColumns.length) return dateColumns[0];
    if (textColumns.length) return textColumns[0];
    return null;
  }, [dateColumns, textColumns]);

  const autoYKey = useMemo(() => {
    if (numericColumns.length) return numericColumns[0];
    return null;
  }, [numericColumns]);

  const effectiveXKey = xKey || autoXKey;
  const effectiveYKey = yKey || autoYKey;
  const effectiveMultiYKeys = multiYKeys.length ? multiYKeys : (autoYKey ? [autoYKey] : []);

  const chartData = useMemo(() => {
    if (!rows.length || !effectiveXKey) return [];
    if (chartType === "pie") {
      return aggregateForPie(rows, effectiveXKey, effectiveYKey);
    }
    if (chartType === "radar") {
      return aggregateForRadar(rows, effectiveXKey, effectiveMultiYKeys);
    }
    if (chartType === "composed") {
      return transformForComposed(rows, effectiveXKey, effectiveMultiYKeys);
    }
    if (!effectiveYKey) return [];
    return rows.map((r) => ({ ...r }));
  }, [rows, effectiveXKey, effectiveYKey, effectiveMultiYKeys, chartType]);

  const yAxisKeys = useMemo(() => {
    if (chartType === "composed" || chartType === "radar") {
      return effectiveMultiYKeys;
    }
    return effectiveYKey ? [effectiveYKey] : [];
  }, [chartType, effectiveYKey, effectiveMultiYKeys]);

  const colLabel = useMemo(() => buildLabelMap(columns), [columns]);

  const hasChartableData = Boolean(effectiveXKey && yAxisKeys.length && chartData.length > 0);
  const canChart = numericColumns.length > 0 && (dateColumns.length > 0 || textColumns.length > 0);

  function toggleMultiY(key) {
    setMultiYKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function handleExportPNG() {
    const svg = chartContainerRef.current?.querySelector("svg.recharts-surface");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const rect = svg.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    const img = new Image();
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `${title || "chart"}-${Date.now()}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  }

  const containerCls = fullscreen
    ? "fixed inset-0 z-[9999] bg-white flex flex-col"
    : "flex-1 flex flex-col";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl border-2 border-zinc-200 border-t-emerald-500 animate-spin" />
          <p className="text-sm font-bold text-zinc-400">تحميل بيانات الرسم البياني...</p>
        </div>
      </div>
    );
  }

  if (!canChart) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-24 px-8">
        <div className="h-20 w-20 rounded-3xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-300 mb-6 shadow-inner">
          <BarChart3 size={32} />
        </div>
        <h3 className="text-lg font-black text-zinc-900 mb-2">لا يمكن إنشاء رسم بياني</h3>
        <p className="text-sm font-medium text-zinc-500 max-w-md leading-relaxed">
          هذا التقرير لا يحتوي على أعمدة رقمية أو تصنيفية كافية. تأكد من وجود أعمدة تحتوي على أرقام (مثل الإجمالي، الكمية) وأعمدة تصنيف (مثل التاريخ، الاسم).
        </p>
        <div className="flex gap-4 mt-4 text-xs font-bold text-zinc-400">
          <span className="px-3 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200">
            أعمدة رقمية: {numericColumns.length || <span className="text-red-400">لا يوجد</span>}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200">
            أعمدة نصوص: {textColumns.length}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200">
            تواريخ: {dateColumns.length}
          </span>
        </div>
        <div className="flex gap-2 mt-3 text-[10px] font-mono text-zinc-400 rtl:text-left ltr:text-right" dir="ltr">
          <span>س-تلقائي: {autoXKey ? colLabel[autoXKey] || autoXKey : "—"}</span>
          <span>ص-تلقائي: {autoYKey ? colLabel[autoYKey] || autoYKey : "—"}</span>
          <span>س-فعال: {effectiveXKey ? colLabel[effectiveXKey] || effectiveXKey : "—"}</span>
          <span>ص-فعال: {effectiveYKey ? colLabel[effectiveYKey] || effectiveYKey : "—"}</span>
          <span>عدد النقاط: {chartData.length}</span>
        </div>
      </div>
    );
  }

  const renderChart = () => {
    const colors = colorTheme.colors;
    const curveType = smoothCurves ? "monotone" : "linear";
    const grid = showGrid ? <CartesianGrid strokeDasharray="4 4" stroke="#f0f0f0" vertical={false} /> : null;

    switch (chartType) {
      case "line":
        return (
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            {grid}
            <XAxis dataKey={effectiveXKey} tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} dy={8} />
            <YAxis tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} dx={-8} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#d4d4d8", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Legend content={<LegendContent />} />
            {yAxisKeys.map((key, i) => (
              <Line key={key} type={curveType} dataKey={key} stroke={colors[i % colors.length]} strokeWidth={3} dot={{ r: 4, fill: "#fff", strokeWidth: 2 }} activeDot={{ r: 6 }} name={colLabel[key] || key} animationDuration={1000} label={showDataLabels ? { position: "top", fontSize: 10, fill: "#52525b", formatter: (v) => formatNumber(v) } : undefined} />
            ))}
          </LineChart>
        );
      case "bar":
        return (
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            {grid}
            <XAxis dataKey={effectiveXKey} tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} dy={8} />
            <YAxis tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} dx={-8} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f4f4f5" }} />
            <Legend content={<LegendContent />} />
            {yAxisKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[6, 6, 0, 0]} maxBarSize={60} name={colLabel[key] || key} animationDuration={1000} label={showDataLabels ? { position: "top", fontSize: 10, fill: "#52525b", formatter: (v) => formatNumber(v) } : undefined} />
            ))}
          </BarChart>
        );
      case "area":
        return (
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            {grid}
            <XAxis dataKey={effectiveXKey} tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} dy={8} />
            <YAxis tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} dx={-8} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#d4d4d8", strokeWidth: 1 }} />
            <Legend content={<LegendContent />} />
            {yAxisKeys.map((key, i) => (
              <Area key={key} type={curveType} dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} fill={colors[i % colors.length]} fillOpacity={0.15} dot={{ r: 3, fill: "#fff", strokeWidth: 2 }} name={colLabel[key] || key} animationDuration={1000} label={showDataLabels ? { position: "top", fontSize: 10, fill: "#52525b", formatter: (v) => formatNumber(v) } : undefined} />
            ))}
          </AreaChart>
        );
      case "pie":
        return (
          <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <Tooltip content={<ChartTooltip />} />
            <Legend content={<LegendContent />} />
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={160} paddingAngle={3} label={showDataLabels ? { fontSize: 11, fill: "#52525b", formatter: (v) => formatNumber(v) } : undefined} animationDuration={1200}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        );
      case "radar":
        return (
          <RadarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <PolarGrid stroke="#e4e4e7" />
            <PolarAngleAxis dataKey={effectiveXKey} tick={{ fontSize: 11, fill: "#52525b" }} />
            <PolarRadiusAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} />
            <Tooltip content={<ChartTooltip />} />
            <Legend content={<LegendContent />} />
            {yAxisKeys.map((key, i) => (
              <RechartsRadar key={key} name={colLabel[key] || key} dataKey={key} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.15} strokeWidth={2} animationDuration={1000} />
            ))}
          </RadarChart>
        );
      case "composed":
        return (
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            {grid}
            <XAxis dataKey={effectiveXKey} tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} dy={8} />
            <YAxis tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} dx={-8} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f4f4f5" }} />
            <Legend content={<LegendContent />} />
            {yAxisKeys.map((key, i) => {
              const color = colors[i % colors.length];
              if (i === 0) return <Bar key={key} dataKey={key} fill={color} radius={[4, 4, 0, 0]} maxBarSize={50} name={colLabel[key] || key} animationDuration={1000} />;
              return <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={3} dot={{ r: 4 }} name={colLabel[key] || key} animationDuration={1000} />;
            })}
          </ComposedChart>
        );
      default:
        return null;
    }
  };

  return (
    <div className={containerCls}>
      {/* Controls Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
        <div className="flex items-center gap-2">
          {CHART_TYPES.map((ct) => {
            const Icon = ct.icon;
            const active = chartType === ct.id;
            return (
              <button key={ct.id} onClick={() => setChartType(ct.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? "bg-white text-emerald-600 shadow-sm border border-emerald-200" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 border border-transparent"}`}>
                <Icon size={14} /> {ct.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setControlsOpen(!controlsOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${controlsOpen ? "bg-zinc-100 border-zinc-300 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
            <Settings2 size={14} /> تحكم
          </button>
          <button onClick={() => setFullscreen(!fullscreen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-all">
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {fullscreen ? "تصغير" : "شاشة كاملة"}
          </button>
          {hasChartableData && (
            <button onClick={handleExportPNG}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-all">
              <Download size={14} /> PNG
            </button>
          )}
        </div>
      </div>

      {/* Controls Panel */}
      <AnimatePresence>
        {controlsOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-zinc-200 bg-white">
            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-6">
              {/* X-Axis */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-wider">المحور السيني (X)</label>
                <select value={xKey || ""} onChange={(e) => setXKey(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-900 focus:outline-none focus:border-emerald-500 transition-all">
                  {!xKey && <option value="">اختر العمود...</option>}
                  {dateColumns.map((k) => <option key={k} value={k}>{colLabel[k] || k} 📅</option>)}
                  {textColumns.map((k) => <option key={k} value={k}>{colLabel[k] || k}</option>)}
                  {numericColumns.map((k) => <option key={k} value={k}>{colLabel[k] || k} #</option>)}
                </select>
              </div>

              {/* Y-Axis */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-wider">
                  {chartType === "composed" || chartType === "radar" ? "محاور ص متعددة (Y)" : "المحور الصادي (Y)"}
                </label>
                {(chartType === "composed" || chartType === "radar") ? (
                  <div className="flex flex-wrap gap-1.5">
                    {numericColumns.map((k) => (
                      <button key={k} onClick={() => toggleMultiY(k)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${multiYKeys.includes(k) ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100"}`}>
                        {multiYKeys.includes(k) && <Check size={10} className="inline mr-1" />}
                        {colLabel[k] || k}
                      </button>
                    ))}
                  </div>
                ) : (
                  <select value={yKey || ""} onChange={(e) => setYKey(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-900 focus:outline-none focus:border-emerald-500 transition-all">
                    {!yKey && <option value="">اختر العمود...</option>}
                    {numericColumns.map((k) => <option key={k} value={k}>{colLabel[k] || k}</option>)}
                  </select>
                )}
              </div>

              {/* Color Theme */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-wider">نظام الألوان</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_THEMES.map((theme) => (
                    <button key={theme.id} onClick={() => setColorTheme(theme)}
                      className={`relative px-3 py-2 rounded-xl border-2 transition-all ${colorTheme.id === theme.id ? "border-emerald-500 bg-emerald-50" : "border-zinc-200 hover:border-zinc-300"}`}
                      title={theme.label}>
                      <div className="flex gap-0.5">
                        {theme.colors.slice(0, 5).map((c, i) => (
                          <span key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-wider">خيارات العرض</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setShowGrid(!showGrid)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${showGrid ? "bg-zinc-100 border-zinc-300 text-zinc-800" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                    شبكة
                  </button>
                  <button onClick={() => setShowDataLabels(!showDataLabels)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${showDataLabels ? "bg-zinc-100 border-zinc-300 text-zinc-800" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                    قيم
                  </button>
                  {(chartType === "line" || chartType === "area") && (
                    <button onClick={() => setSmoothCurves(!smoothCurves)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${smoothCurves ? "bg-zinc-100 border-zinc-300 text-zinc-800" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                      منحنيات
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Info Bar */}
            <div className="px-6 py-2 border-t border-zinc-100 bg-zinc-50/50 flex items-center gap-4 text-[11px] font-bold text-zinc-400">
              <span>المحور X: <span className="text-zinc-700">{effectiveXKey || "—"}</span></span>
              <span className="w-px h-3 bg-zinc-200" />
              <span>المحور Y: <span className="text-zinc-700">{yAxisKeys.map((k) => colLabel[k] || k).join(", ") || "—"}</span></span>
              <span className="w-px h-3 bg-zinc-200" />
              <span>عدد النقاط: <span className="text-zinc-700">{chartData.length}</span></span>
              <span className="w-px h-3 bg-zinc-200" />
              <span>النوع: <span className="text-zinc-700">{CHART_TYPES.find((t) => t.id === chartType)?.label}</span></span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chart Area */}
      <div ref={chartContainerRef} style={{ width: "100%", height: fullscreen ? "100%" : "420px", position: "relative" }} className="p-6 overflow-hidden">
        {hasChartableData ? (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="h-16 w-16 rounded-3xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-300 mb-4">
              <BarChart3 size={28} />
            </div>
            <h3 className="text-base font-black text-zinc-800 mb-1">اختر أعمدة للرسم البياني</h3>
            <p className="text-sm text-zinc-500 max-w-sm">اختر محور سيني (نص أو تاريخ) ومحور صادي (رقم) من لوحة التحكم.</p>
          </div>
        )}
      </div>

      {/* Fullscreen Close */}
      {fullscreen && (
        <div className="absolute top-4 left-4 z-10">
          <button onClick={() => setFullscreen(false)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-bold shadow-lg hover:bg-zinc-800 transition-all">
            <Minimize2 size={16} /> خروج
          </button>
        </div>
      )}
    </div>
  );
}
