import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  ExternalLink,
  PackageSearch,
  Pencil,
  RefreshCcw,
  Search,
  Calendar,
  TrendingUp,
  Box,
  DollarSign,
  Layers,
  Tag,
  AlertCircle,
  SlidersHorizontal,
  Sparkles,
  Award,
  TrendingDown,
  Percent,
  CheckCircle2,
  Package,
  Layers3,
  CalendarDays,
  LineChart,
  ArrowDownRight,
  ArrowUpLeft,
  User,
  Truck,
  Database,
  ArrowRight,
  HelpCircle,
  AlertTriangle,
  History,
  Boxes,
  Activity,
  Warehouse
} from "lucide-react";
import api from "../../services/api";
import DocumentPreviewModal from "../../components/operations/DocumentPreviewModal";

const TYPE_OPTIONS = [
  { key: "sales", label: "مبيعات", tone: "emerald", border: "border-emerald-200 hover:border-emerald-400 bg-emerald-50/10", text: "text-emerald-700 bg-emerald-50 border-emerald-100", dot: "bg-emerald-500", glow: "shadow-[0_0_15px_rgba(16,185,129,0.25)]" },
  { key: "purchases", label: "مشتريات", tone: "blue", border: "border-blue-200 hover:border-blue-400 bg-blue-50/10", text: "text-blue-700 bg-blue-50 border-blue-100", dot: "bg-blue-500", glow: "shadow-[0_0_15px_rgba(59,130,246,0.25)]" },
  { key: "sales_returns", label: "مرتجع مبيعات", tone: "amber", border: "border-amber-200 hover:border-amber-400 bg-amber-50/10", text: "text-amber-700 bg-amber-50 border-amber-100", dot: "bg-amber-500", glow: "shadow-[0_0_15px_rgba(245,158,11,0.25)]" },
  { key: "purchase_returns", label: "مرتجع مشتريات", tone: "rose", border: "border-rose-200 hover:border-rose-400 bg-rose-50/10", text: "text-rose-700 bg-rose-50 border-rose-100", dot: "bg-rose-500", glow: "shadow-[0_0_15px_rgba(239,68,68,0.25)]" },
  { key: "branch_transfers", label: "تحويلات", tone: "indigo", border: "border-indigo-200 hover:border-indigo-400 bg-indigo-50/10", text: "text-indigo-700 bg-indigo-50 border-indigo-100", dot: "bg-indigo-500", glow: "shadow-[0_0_15px_rgba(99,102,241,0.25)]" },
  { key: "opening_balance", label: "رصيد افتتاحي", tone: "slate", border: "border-slate-200 hover:border-slate-400 bg-slate-50/20", text: "text-slate-700 bg-slate-100 border-slate-200", dot: "bg-slate-500", glow: "shadow-[0_0_15px_rgba(100,116,139,0.2)]" },
  { key: "price_changes", label: "تغيير سعر", tone: "cyan", border: "border-cyan-200 hover:border-cyan-400 bg-cyan-50/10", text: "text-cyan-700 bg-cyan-50 border-cyan-100", dot: "bg-cyan-500", glow: "shadow-[0_0_15px_rgba(6,182,212,0.25)]" },
  { key: "stock_movements", label: "حركة مخزون", tone: "zinc", border: "border-zinc-200 hover:border-zinc-400 bg-zinc-50/20", text: "text-zinc-700 bg-zinc-100 border-slate-200", dot: "bg-slate-500", glow: "shadow-[0_0_15px_rgba(113,113,122,0.2)]" },
  { key: "cost_movements", label: "تغير تكلفة", tone: "violet", border: "border-violet-200 hover:border-violet-400 bg-violet-50/10", text: "text-violet-700 bg-violet-50 border-violet-100", dot: "bg-violet-500", glow: "shadow-[0_0_15px_rgba(139,92,246,0.25)]" },
];

const DEFAULT_TYPES = ["sales", "purchases", "sales_returns", "purchase_returns", "branch_transfers", "opening_balance"];

function money(value) {
  return Number(value || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatItemDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const day = d.getDate();
  const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${months[d.getMonth()]} · ${h}:${m}`;
}

function sourceRoute(row) {
  const id = row?.source_id;
  if (!id) return null;
  const routes = {
    sales: `/invoices/${id}`,
    purchases: `/purchases/${id}`,
    opening_balance: `/purchases/${id}`,
    sales_returns: `/pos/sales-returns/${id}`,
    purchase_returns: `/purchases/returns/${id}`,
    branch_transfers: `/operations/branch-transfer/edit/${id}`,
    price_changes: "/operations/bulk-price-update",
    stock_movements: "/stock/movements",
    cost_movements: "/reports/cost-movements",
  };
  return routes[row.type] || null;
}

function isEditable(row) {
  return ["sales", "purchases", "opening_balance", "sales_returns", "purchase_returns", "branch_transfers"].includes(row?.type);
}

function previewDocType(row) {
  const types = {
    sales: "invoice",
    purchases: "purchase",
    opening_balance: "opening_balance",
    sales_returns: "sales_return",
    purchase_returns: "purchase_return",
    branch_transfers: "branch_transfer",
  };
  return types[row?.type] || null;
}

function SpotlightCard({ children, className = "", style = {}, borderTone = "indigo" }) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const glowColors = {
    indigo: "rgba(99, 102, 241, 0.08)",
    emerald: "rgba(16, 185, 129, 0.08)",
    blue: "rgba(59, 130, 246, 0.08)",
    amber: "rgba(245, 158, 11, 0.08)",
    rose: "rgba(239, 68, 68, 0.08)",
    slate: "rgba(100, 116, 139, 0.08)",
    cyan: "rgba(6, 182, 212, 0.08)",
    zinc: "rgba(113, 113, 122, 0.08)",
    violet: "rgba(139, 92, 246, 0.08)",
  };

  const glowColor = glowColors[borderTone] || glowColors.indigo;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300 z-0"
          style={{
            background: `radial-gradient(400px circle at ${coords.x}px ${coords.y}px, ${glowColor}, transparent 80%)`,
          }}
        />
      )}
      <div className="relative z-10 h-full flex flex-col justify-between">{children}</div>
    </div>
  );
}

export default function ItemOperationsPage() {
  const { itemId } = useParams();
  const [searchParams] = useSearchParams();
  const [itemSearch, setItemSearch] = useState("");
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(itemId ? Number(itemId) : null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const initialTypes = useMemo(() => {
    const fromUrl = searchParams.get("types");
    return fromUrl ? fromUrl.split(",").filter(Boolean) : DEFAULT_TYPES;
  }, [searchParams]);
  const [types, setTypes] = useState(initialTypes);
  const [operationSearch, setOperationSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortDir, setSortDir] = useState("desc");
  const [previewTarget, setPreviewTarget] = useState(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);

  useEffect(() => {
    setSelectedId(itemId ? Number(itemId) : null);
  }, [itemId]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoadingItems(true);
      api.get("/api/items", { params: { search: itemSearch, limit: 50 } })
        .then((res) => setItems(res.data?.data || []))
        .catch(() => setItems([]))
        .finally(() => setLoadingItems(false));
    }, itemSearch ? 250 : 0);
    return () => clearTimeout(handle);
  }, [itemSearch]);

  useEffect(() => {
    if (!selectedId) {
      setRows([]);
      setSelectedItem(null);
      return;
    }
    setLoadingRows(true);
    api.get(`/api/items/${selectedId}/operations`, {
      params: { types: types.join(","), search: operationSearch, from: fromDate, to: toDate, dir: sortDir, page, limit: 10 },
    })
      .then((res) => {
        setRows(res.data?.data || []);
        setTotal(res.data?.total || 0);
        setSelectedItem(res.data?.item || null);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoadingRows(false));
  }, [selectedId, types, operationSearch, fromDate, toDate, sortDir, page]);

  useEffect(() => {
    setPage(1);
  }, [selectedId, types, operationSearch, fromDate, toDate, sortDir]);

  const pages = Math.max(1, Math.ceil(total / 10));

  function toggleType(type) {
    setPage(1);
    setTypes((current) => current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type]);
  }

  const stockPoints = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    let current = selectedItem?.current_stock || 0;
    const points = [current];
    for (const row of rows) {
      const q = Number(row.quantity || 0);
      if (row.type === "sales" || row.type === "sales_returns" || row.type === "branch_transfers") {
        current += q;
      } else {
        current -= q;
      }
      points.push(current);
    }
    return points.reverse();
  }, [rows, selectedItem]);

  const stockStats = useMemo(() => {
    if (stockPoints.length === 0) return { peak: 0, low: 0 };
    return {
      peak: Math.max(...stockPoints),
      low: Math.min(...stockPoints),
    };
  }, [stockPoints]);

  const svgWavePaths = useMemo(() => {
    if (stockPoints.length < 2) return { line: "", area: "" };
    const max = Math.max(...stockPoints, 10);
    const min = Math.min(...stockPoints, 0);
    const range = max - min || 1;
    const width = 350;
    const height = 65;
    const xStep = width / (stockPoints.length - 1);
    
    const linePath = stockPoints.map((val, index) => {
      const x = index * xStep;
      const y = height - ((val - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");

    const areaPath = `M 0 65 L 0 ${height - ((stockPoints[0] - min) / range) * height} ${stockPoints.map((val, index) => {
      const x = index * xStep;
      const y = height - ((val - min) / range) * height;
      return `L ${x} ${y}`;
    }).join(" ")} L 350 65 Z`;

    return { line: linePath, area: areaPath };
  }, [stockPoints]);

  const stockGaugeDetails = useMemo(() => {
    const stockVal = selectedItem?.current_stock || 0;
    if (stockVal <= 0) {
      return { label: "نفذ بالكامل", color: "text-rose-500 stroke-rose-500", bg: "bg-rose-50 border-rose-200/55", glow: "shadow-[0_0_15px_rgba(239,68,68,0.3)]", percent: 0 };
    }
    if (stockVal < 10) {
      return { label: "مخزون حرج", color: "text-amber-500 stroke-amber-500", bg: "bg-amber-50 border-amber-200/55", glow: "shadow-[0_0_15px_rgba(245,158,11,0.3)]", percent: 25 };
    }
    if (stockVal < 50) {
      return { label: "رصيد متوسط", color: "text-blue-500 stroke-blue-500", bg: "bg-blue-50 border-blue-200/55", glow: "shadow-[0_0_15px_rgba(59,130,246,0.3)]", percent: 60 };
    }
    return { label: "مخزون وافر", color: "text-emerald-500 stroke-emerald-500", bg: "bg-emerald-50 border-emerald-200/55", glow: "shadow-[0_0_15px_rgba(16,185,129,0.3)]", percent: 100 };
  }, [selectedItem]);

  const stockValuation = useMemo(() => {
    const stock = selectedItem?.current_stock || 0;
    const salePrice = selectedItem?.sale_price || 0;
    return stock * salePrice;
  }, [selectedItem]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [items]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 18 } }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-100/80 relative overflow-hidden" dir="rtl">
      
      {/* Animated background blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.45]">
        <div className="absolute top-[8%] right-[5%] w-[450px] h-[450px] bg-gradient-to-br from-indigo-200/30 to-violet-200/20 rounded-full blur-[110px] animate-blob" />
        <div className="absolute bottom-[10%] left-[-5%] w-[550px] h-[550px] bg-gradient-to-tr from-emerald-100/30 to-teal-100/20 rounded-full blur-[130px] animate-blob animation-delay-2000" />
        <div className="absolute top-[35%] left-[20%] w-[400px] h-[400px] bg-gradient-to-br from-blue-100/20 to-indigo-100/20 rounded-full blur-[120px] animate-blob animation-delay-4000" />
      </div>

      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          background: transparent;
          bottom: 0;
          color: transparent;
          cursor: pointer;
          height: auto;
          left: 0;
          position: absolute;
          right: 0;
          top: 0;
          width: auto;
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(45px, -70px) scale(1.15); }
          66% { transform: translate(-35px, 35px) scale(0.92); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 15s infinite alternate ease-in-out;
        }
        .animation-delay-2000 {
          animation-delay: 3s;
        }
        .animation-delay-4000 {
          animation-delay: 6s;
        }
      `}</style>

      <div className="flex h-[100dvh] overflow-hidden relative z-10">
        
        {/* Sidebar Panel */}
        <aside data-help="item-selector" className="w-80 shrink-0 border-l border-slate-200/60 bg-white/80 backdrop-blur-xl flex flex-col shadow-[0_0_30px_rgba(0,0,0,0.02)] z-10">
          <div className="p-5 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-md z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-[0_4px_15px_rgba(79,70,229,0.25)]">
                <PackageSearch size={22} className="stroke-[1.8] animate-pulse" />
              </div>
              <div>
                <h1 className="text-base font-black text-slate-800 tracking-tight leading-none">سجل الصنف</h1>
                <span className="text-[10px] font-bold text-slate-400/90 block mt-1 tracking-wider">كل اللي حصل للصنف</span>
              </div>
            </div>
            <div className="relative font-sans">
              <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                data-help="search-bar"
                value={itemSearch}
                onChange={(event) => setItemSearch(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-10 pl-3.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-400"
                placeholder="بحث بالاسم أو الكود..."
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-1 bg-slate-50/20 scrollbar-thin">
            {loadingItems ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                <RefreshCcw size={24} className="animate-spin text-indigo-500" />
                <span className="text-xs font-bold">جاري تحميل الأصناف...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-20 text-xs font-bold text-slate-400/80">
                لا توجد أصناف تطابق البحث
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1 mb-1">
                  <span>تم العثور على {items.length} صنف</span>
                </div>
                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="space-y-1.5"
                >
                  {sortedItems.map((item) => {
                    const isSelected = selectedId === item.id;
                    const stock = item.current_stock ?? item.stock_quantity ?? 0;

                    return (
                      <motion.button
                        variants={itemVariants}
                        key={item.id}
                        onClick={() => { setSelectedId(item.id); setPage(1); }}
                        className={`w-full rounded-2xl border px-4 py-3.5 text-right transition-all duration-200 relative overflow-hidden group ${
                          isSelected 
                            ? "border-indigo-400/30 bg-gradient-to-l from-indigo-50/80 to-white shadow-[0_2px_12px_rgba(79,70,229,0.06)]" 
                            : "bg-white border-slate-200/50 hover:border-slate-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
                        }`}
                        whileTap={{ scale: 0.98 }}
                      >
                        {isSelected && (
                          <motion.div 
                            layoutId="activeItemIndicator"
                            className="absolute right-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-l-full"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <span className={`font-black text-[13px] leading-snug block truncate transition-colors ${isSelected ? "text-indigo-900" : "text-slate-800 group-hover:text-slate-900"}`}>
                              {item.name}
                            </span>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border inline-flex items-center gap-1 ${
                                stock <= 0 
                                  ? "text-rose-600 bg-rose-50/80 border-rose-100" 
                                  : stock < 10 
                                  ? "text-amber-600 bg-amber-50/80 border-amber-100" 
                                  : "text-emerald-600 bg-emerald-50/80 border-emerald-100"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stock <= 0 ? "bg-rose-500" : stock < 10 ? "bg-amber-500" : "bg-emerald-500"}`} />
                                رصيد: {money(stock)}
                              </span>
                              {(item.updated_at || item.created_at) && (
                                <span className="text-[9px] font-semibold text-slate-400 truncate">
                                  {formatItemDate(item.updated_at || item.created_at)}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`font-mono text-xs font-black shrink-0 px-2.5 py-1.5 rounded-xl border transition-colors ${
                            isSelected
                              ? "text-indigo-700 bg-indigo-100/80 border-indigo-200"
                              : "text-slate-500 bg-slate-50 border-slate-200/70 group-hover:text-indigo-600 group-hover:bg-indigo-50/50 group-hover:border-indigo-100"
                          }`} dir="ltr">
                            {item.code || `#${item.id}`}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </motion.div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Panel */}
        <main className="flex-1 overflow-auto bg-transparent relative scrollbar-thin">
          <div className="p-6 max-w-6xl mx-auto space-y-6">
            
            {/* Bento Header Grid */}
            <AnimatePresence mode="wait">
              {selectedItem ? (
                <motion.div
                  data-help="item-summary"
                  key={selectedId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                  {/* Bento Cell 1: Essential Item Profile */}
                  <div className="bg-white border border-slate-200/60 rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] relative overflow-hidden flex flex-col justify-between md:col-span-2 min-h-[190px]">
                    <div className="absolute top-0 left-0 w-36 h-36 bg-indigo-500/5 rounded-full blur-3xl -translate-x-10 -translate-y-10 pointer-events-none" />
                    
                    <div className="flex flex-col gap-3 relative z-10">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-[10px] font-black text-indigo-600 uppercase tracking-wider">
                          <Sparkles size={11} className="animate-pulse" /> بطاقة صنف
                        </span>
                        <span className="inline-flex rounded-full bg-slate-100 border border-slate-200/70 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
                          {selectedItem.category_name || "بدون قسم"}
                        </span>
                      </div>
                      
                      <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight leading-snug">
                        {selectedItem.name}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-end justify-between gap-4 mt-6 border-t border-slate-100 pt-4 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                          <span className="text-[9px] text-slate-400 font-bold block mb-0.5">سعر البيع</span>
                          <span className="font-mono text-slate-800 text-sm font-black" dir="ltr">
                            {money(selectedItem.sale_price)} <span className="text-[10px] font-sans font-bold text-slate-400">ج.م</span>
                          </span>
                        </div>
                        {selectedItem.code && (
                          <div className="flex flex-col border border-dashed border-slate-200 rounded-xl px-3 py-1.5">
                            <span className="text-[9px] text-slate-400 font-bold block mb-0.5">كود الباركود</span>
                            <span className="font-mono text-indigo-600 text-xs font-black" dir="ltr">
                              {selectedItem.code}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Barcode visual decoration */}
                      <div className="flex flex-col items-center opacity-65 hover:opacity-100 transition-opacity">
                        <div className="h-6 flex items-end gap-[1.5px] px-2 overflow-hidden border-b border-slate-300">
                          {[2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 1, 3, 1].map((w, idx) => (
                            <span key={idx} className="bg-slate-800 rounded-t-sm" style={{ width: `${w}px`, height: `${12 + (idx % 3) * 4}px` }} />
                          ))}
                        </div>
                        <span className="text-[8px] font-mono font-bold text-slate-400 mt-1 uppercase tracking-widest">{selectedItem.code || "EL-HEGAZI-POS"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bento Cell 2: Live Stock Circle */}
                  <div className="bg-white border border-slate-200/60 rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] relative overflow-hidden flex flex-col items-center justify-center text-center">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl translate-x-8 -translate-y-8 pointer-events-none" />
                    
                    <span className="text-[10px] font-black text-slate-400 block mb-3 uppercase tracking-wider">سلامة المخزون المتوفر</span>
                    
                    <div className="relative flex items-center justify-center my-1">
                      <svg className="w-24 h-24 transform -rotate-90">
                        <circle cx="48" cy="48" r="38" className="text-slate-100" strokeWidth="6" stroke="currentColor" fill="transparent" />
                        <motion.circle 
                          cx="48" 
                          cy="48" 
                          r="38" 
                          className={stockGaugeDetails.color} 
                          strokeWidth="6" 
                          strokeDasharray={2 * Math.PI * 38} 
                          initial={{ strokeDashoffset: 2 * Math.PI * 38 }}
                          animate={{ strokeDashoffset: (2 * Math.PI * 38) - (stockGaugeDetails.percent / 100) * (2 * Math.PI * 38) }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          strokeLinecap="round" 
                          stroke="currentColor" 
                          fill="transparent" 
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center font-mono">
                        <span className="text-lg font-black text-slate-800">{money(selectedItem.current_stock)}</span>
                        <span className="text-[8px] font-sans font-bold text-slate-400">وحدة</span>
                      </div>
                    </div>

                    <div className={`mt-3 px-3 py-1 rounded-xl border text-[10px] font-black ${stockGaugeDetails.bg} ${stockGaugeDetails.color} flex items-center gap-1.5 ${stockGaugeDetails.glow}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${stockGaugeDetails.color.replace("text-", "bg-")} animate-ping`} />
                      {stockGaugeDetails.label}
                    </div>
                  </div>

                  {/* Bento Cell 3: Stock Valuation */}
                  <div className="bg-white border border-slate-200/60 rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                    <div className="absolute bottom-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl translate-x-8 translate-y-8 pointer-events-none" />
                    <div>
                      <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                        <DollarSign size={13} className="text-emerald-500" />
                        <span className="text-[10px] font-black uppercase tracking-wider">القيمة الإجمالية للمخزون</span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-400 block mb-1">محسوبة بسعر البيع الجاري</span>
                    </div>

                    <div className="flex items-baseline gap-1 mt-4">
                      <span className="font-mono text-2xl font-black text-slate-800 tracking-tight" dir="ltr">
                        {money(stockValuation)}
                      </span>
                      <span className="text-xs font-bold text-slate-500">ج.م</span>
                    </div>
                  </div>

                  {/* Bento Cell 4: Extended Statistics Sparkline */}
                  {stockPoints.length >= 2 && (
                    <div className="bg-white border border-slate-200/60 rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] md:col-span-2 flex flex-col justify-between overflow-hidden relative min-h-[140px]">
                      <div className="absolute top-0 left-0 w-36 h-36 bg-indigo-500/5 rounded-full blur-3xl -translate-x-12 -translate-y-12 pointer-events-none" />
                      
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp size={14} className="text-indigo-600 animate-bounce" />
                          <span className="text-[10px] font-black text-indigo-900 uppercase tracking-wider">مخطط حركة المخزون</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/50">تمثيل بياني تفاعلي</span>
                      </div>

                      <div className="h-16 relative flex items-end justify-center my-1.5">
                        <svg width="100%" height="65" viewBox="0 0 350 65" className="overflow-visible">
                          <defs>
                            <linearGradient id="sparklineMesh" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.18" />
                              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <motion.path
                            d={svgWavePaths.area}
                            fill="url(#sparklineMesh)"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8 }}
                          />
                          <motion.path
                            d={svgWavePaths.line}
                            fill="none"
                            stroke="#4f46e5"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.9, ease: "easeOut" }}
                          />
                        </svg>
                      </div>

                      <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 border-t border-slate-105 pt-2 font-mono">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          <span>أدنى رصيد: <strong className="text-slate-700">{money(stockStats.low)}</strong></span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>أعلى رصيد: <strong className="text-slate-700">{money(stockStats.peak)}</strong></span>
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {selectedId && (
              <>
                {/* Advanced Search & Control Deck */}
                <div data-help="filters-section" className="bg-white/90 backdrop-blur-md rounded-[2rem] border border-slate-200/50 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.01)] space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-105 pb-3">
                    <button 
                      onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                      className="flex items-center gap-2 text-xs font-black text-slate-700 hover:text-indigo-600 transition-colors"
                    >
                      <SlidersHorizontal size={14} className="stroke-[2.2]" /> فلترة وتصفية البحث
                    </button>
                    <div className="text-[10px] font-bold text-slate-400">
                      حدد نطاق البحث لتخصيص النتائج المرجوة
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {isFiltersOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden space-y-4"
                      >
                        <div className="flex flex-wrap gap-2 pt-1 font-sans">
                          {TYPE_OPTIONS.map((option) => {
                            const isChecked = types.includes(option.key);
                            return (
                              <label
                                key={option.key}
                                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold cursor-pointer transition-all relative overflow-hidden select-none active:scale-95 ${
                                  isChecked
                                    ? `bg-indigo-600 border-indigo-600 text-white shadow-[0_4px_12px_rgba(79,70,229,0.2)]`
                                    : `bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-50/80 hover:border-slate-300`
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleType(option.key)}
                                  className="hidden"
                                />
                                <span className={`w-2.5 h-2.5 rounded-full transition-transform ${isChecked ? "bg-white scale-110" : option.dot} ${isChecked ? "" : "scale-75 opacity-60"}`} />
                                {option.label}
                              </label>
                            );
                          })}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-4 pt-1 font-sans">
                          <div className="relative md:col-span-2">
                            <Search size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              value={operationSearch}
                              onChange={(event) => setOperationSearch(event.target.value)}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pr-10 pl-3.5 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-400"
                              placeholder="بحث برقم المستند أو الطرف المقابل..."
                            />
                          </div>

                          <div className="relative font-sans">
                            <CalendarDays size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                              type="date"
                              value={fromDate}
                              onChange={(event) => setFromDate(event.target.value)}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pr-10 pl-3.5 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all relative z-10"
                            />
                          </div>

                          <div className="relative font-sans">
                            <CalendarDays size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                              type="date"
                              value={toDate}
                              onChange={(event) => setToDate(event.target.value)}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pr-10 pl-3.5 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all relative z-10"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-105 pt-3">
                          <button
                            onClick={() => setSortDir((value) => value === "desc" ? "asc" : "desc")}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 active:scale-95 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
                          >
                            <motion.div
                              animate={{ rotate: sortDir === "desc" ? 0 : 180 }}
                              transition={{ type: "spring", stiffness: 200, damping: 15 }}
                            >
                              <ArrowUpDown size={13} className="text-slate-400" />
                            </motion.div>
                            {sortDir === "desc" ? "ترتيب: الأحدث أولاً" : "ترتيب: الأقدم أولاً"}
                          </button>

                          {(operationSearch || fromDate || toDate || types.length !== DEFAULT_TYPES.length) && (
                            <button
                              onClick={() => {
                                setOperationSearch("");
                                setFromDate("");
                                setToDate("");
                                setTypes(DEFAULT_TYPES);
                              }}
                              className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors"
                            >
                              إعادة تعيين الفلاتر
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Operations Timeline Wrapper */}
                <div data-help="main-table" className="relative font-sans">
                  {rows.length > 0 && !loadingRows && (
                    <div className="absolute right-[8.5rem] top-8 bottom-8 w-[2.5px] bg-gradient-to-b from-indigo-500 via-emerald-400 to-rose-500 opacity-50 pointer-events-none rounded-full" />
                  )}

                  {loadingRows ? (
                    <div className="space-y-4 mr-1">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white border border-slate-200/60 rounded-3xl p-6 space-y-4 animate-pulse mr-[11.5rem]">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-5 bg-slate-200 rounded-md" />
                              <div className="w-24 h-5 bg-slate-200 rounded-md" />
                            </div>
                            <div className="w-20 h-4 bg-slate-200 rounded-md" />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map((j) => (
                              <div key={j} className="space-y-2">
                                <div className="w-12 h-3 bg-slate-100 rounded" />
                                <div className="w-20 h-5 bg-slate-200 rounded-md" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="bg-white border border-slate-200/60 rounded-[2.5rem] p-16 text-center text-slate-400/80 shadow-[0_8px_30px_rgb(0,0,0,0.01)]">
                      <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                        <AlertCircle size={28} className="stroke-[1.5]" />
                      </div>
                      <h4 className="text-sm font-black text-slate-700 mb-1">لا توجد عمليات مسجلة</h4>
                      <p className="text-xs font-bold text-slate-400 max-w-[320px] mx-auto leading-relaxed">
                        جرب تعديل خيارات التصفية أو الفلاتر المحددة للبحث عن العمليات المطلوبة.
                      </p>
                    </div>
                  ) : (
                    <motion.div 
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="space-y-6"
                    >
                      {rows.map((row) => {
                        const option = TYPE_OPTIONS.find((entry) => entry.key === row.type);
                        const route = sourceRoute(row);
                        const docType = previewDocType(row);
                        
                        const parsedDate = (() => {
                          const d = new Date(row.date);
                          if (!row.date || isNaN(d.getTime())) return null;
                          const dd = String(d.getDate()).padStart(2, "0");
                          const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
                          const monthName = months[d.getMonth()];
                          const yyyy = d.getFullYear();
                          const hh = String(d.getHours()).padStart(2, "0");
                          const mi = String(d.getMinutes()).padStart(2, "0");
                          return { day: dd, month: monthName, year: yyyy, time: `${hh}:${mi}` };
                        })();
                        const beforeStock = row.context_before != null ? Number(row.context_before) : null;
                        const afterStock = row.context_after != null ? Number(row.context_after) : null;
                        const stockDelta = beforeStock != null && afterStock != null ? afterStock - beforeStock : null;
                        
                        const profitRatio = row.profit != null && Number(row.line_total) > 0 
                          ? Math.round((Number(row.profit) / Number(row.line_total)) * 100)
                          : null;

                        return (
                          <motion.article
                            variants={itemVariants}
                            key={`${row.type}-${row.source_line_id}-${row.date}`}
                            className="relative pr-[11.5rem]"
                          >
                            <div className={`absolute right-[8.5rem] translate-x-1/2 top-8 w-3.5 h-3.5 rounded-full border-[2.5px] border-white ${option?.dot || "bg-indigo-600"} ${option?.glow || "shadow-md"} z-10 transition-all hover:scale-125 duration-300`}>
                              <span className="absolute inset-0 rounded-full bg-white opacity-30 animate-ping" />
                            </div>
                            {parsedDate && (
                              <div className="absolute right-4 top-8 -translate-y-1/2 w-28 z-10 select-none group">
                                <div className="py-2.5 px-3 rounded-2xl border border-slate-200/60 bg-white/95 backdrop-blur-sm shadow-[0_4px_16px_rgba(0,0,0,0.02)] group-hover:border-slate-300 group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition-all duration-300 flex flex-col items-center justify-center">
                                  {/* Time */}
                                  <span className="text-[13px] font-black text-slate-800 font-mono tracking-tight leading-none" dir="ltr">
                                    {parsedDate.time}
                                  </span>
                                  {/* Horizontal Divider */}
                                  <div className="w-10 h-[1.5px] bg-slate-100 my-1.5 rounded-full" />
                                  {/* Date Details */}
                                  <div className="flex flex-col items-center leading-none">
                                    <span className="text-[11px] font-black text-slate-700 leading-none">
                                      {parsedDate.day} {parsedDate.month}
                                    </span>
                                    <span className="text-[8.5px] font-bold text-slate-400 mt-1 leading-none font-mono">
                                      {parsedDate.year}
                                    </span>
                                  </div>
                                </div>
                                <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-[10px] h-[1.5px] bg-slate-200/70 group-hover:bg-slate-350 transition-colors pointer-events-none" />
                              </div>
                            )}
                            
                            {row.type === "sales" && (
                              <SpotlightCard 
                                borderTone="emerald"
                                className="rounded-[2rem] border border-emerald-200 bg-white shadow-[0_4px_24px_-4px_rgba(16,185,129,0.02)] hover:shadow-[0_12px_32px_-8px_rgba(16,185,129,0.06)] transition-all duration-300 overflow-hidden flex flex-col p-0"
                              >
                                <div className="bg-emerald-600 text-white rounded-t-[1.9rem] px-5 py-2.5 font-black text-[11px] uppercase tracking-wider flex justify-between items-center select-none shadow-sm">
                                  <span className="flex items-center gap-1.5"><CheckCircle2 size={13} /> فاتورة مبيعات معتمدة للعميل</span>
                                  <span className="font-mono opacity-85">SALES TRANSACTION</span>
                                </div>
                                <div className="p-5 space-y-4">
                                  <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="space-y-1.5">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {profitRatio !== null && (
                                          <span className="inline-flex rounded-full bg-emerald-50 text-emerald-800 border border-emerald-250 px-2 py-0.5 text-[9px] font-black shadow-sm">
                                            صافي الربحية {profitRatio}%
                                          </span>
                                        )}
                                        <span className="font-mono text-[9px] font-bold text-slate-400" dir="ltr">
                                          {String(row.date || "").slice(11, 16)} • {String(row.date || "").slice(0, 10)}
                                        </span>
                                      </div>
                                      <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                                        {row.doc_no || "رقم مبيعات غير معروف"}
                                        {row.party_name && (
                                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50/50 px-2 py-0.5 rounded-lg flex items-center gap-1 font-sans">
                                            <User size={11} /> {row.party_name}
                                          </span>
                                        )}
                                      </h3>
                                    </div>

                                    <div className="flex items-center gap-2 bg-emerald-50/40 border border-emerald-100 rounded-xl px-4 py-2.5 text-xs font-bold">
                                      <div className="flex flex-col text-right">
                                        <span className="text-[8px] text-emerald-600 font-bold block mb-0.5">الكمية</span>
                                        <span className="font-mono text-emerald-700 font-black">{money(row.quantity)}</span>
                                      </div>
                                      <span className="text-emerald-400 text-[10px] font-mono select-none">×</span>
                                      <div className="flex flex-col text-right">
                                        <span className="text-[8px] text-emerald-600 font-bold block mb-0.5">سعر الوحدة</span>
                                        <span className="font-mono text-emerald-700 font-black">{money(row.unit_price)}</span>
                                      </div>
                                      <span className="text-emerald-400 text-[10px] font-mono select-none">=</span>
                                      <div className="flex flex-col text-left">
                                        <span className="text-[8px] text-emerald-500 font-bold block mb-0.5">الصافي</span>
                                        <span className="font-mono text-emerald-800 font-black" dir="ltr">{money(row.line_total)} ج.م</span>
                                      </div>
                                    </div>
                                  </div>

                                  {row.unit_price > 0 && row.unit_cost > 0 && (
                                    <div className="bg-emerald-50/20 border border-emerald-100/30 rounded-xl p-3.5 space-y-1.5">
                                      <div className="flex justify-between items-center text-[9px] font-bold text-emerald-700">
                                        <span className="flex items-center gap-1">
                                          <Percent size={11} /> تحليل التكلفة التشغيلية مقابل البيع
                                        </span>
                                        <span className="font-mono font-bold text-emerald-600">
                                          أرباح العائد تمثل {100 - Math.round((row.unit_cost / row.unit_price) * 100)}% من الفاتورة
                                        </span>
                                      </div>
                                      <div className="h-1.5 bg-emerald-100 rounded-full relative overflow-hidden flex">
                                        <div className="h-full bg-slate-300" style={{ width: `${Math.min((row.unit_cost / row.unit_price) * 100, 100)}%` }} />
                                        {row.unit_price > row.unit_cost && <div className="h-full flex-1 bg-emerald-500" />}
                                      </div>
                                    </div>
                                  )}

                                  {beforeStock != null && afterStock != null && (
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center text-[10px] font-bold text-slate-500">
                                      <span>الرصيد السابق: <strong className="font-mono text-slate-700">{money(beforeStock)}</strong></span>
                                      <span className="text-rose-500 flex items-center gap-0.5">خروج من المخزن <ArrowDownRight size={12} /> <strong className="font-mono font-black">-{money(row.quantity)}</strong></span>
                                      <span>الجديد: <strong className="font-mono text-indigo-600">{money(afterStock)}</strong></span>
                                    </div>
                                  )}

                                  <div className="flex gap-2 justify-end border-t border-slate-100 pt-3.5">
                                    <motion.button
                                      whileTap={{ scale: 0.96 }}
                                      onClick={() => setPreviewTarget({ docType: "invoice", docId: row.source_id })}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4.5 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50/50 shadow-sm"
                                    >
                                      <Eye size={13} /> معاينة الفاتورة
                                    </motion.button>
                                    <Link to={route} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
                                      <Pencil size={13} /> تعديل
                                    </Link>
                                  </div>
                                </div>
                              </SpotlightCard>
                            )}

                            {row.type === "purchases" && (
                              <SpotlightCard 
                                borderTone="blue"
                                className="rounded-[2rem] border border-blue-300 bg-white shadow-[0_4px_24px_-4px_rgba(59,130,246,0.02)] hover:shadow-[0_12px_32px_-8px_rgba(59,130,246,0.06)] transition-all duration-300 overflow-hidden flex flex-col p-0"
                              >
                                <div className="bg-blue-600 text-white rounded-t-[1.9rem] px-5 py-2.5 font-black text-[11px] uppercase tracking-wider flex justify-between items-center select-none shadow-sm">
                                  <span className="flex items-center gap-1.5"><Package size={13} /> فاتورة شراء وتوريد بضائع من المورد</span>
                                  <span className="font-mono opacity-85">PURCHASE BILL</span>
                                </div>
                                <div className="p-5 space-y-4">
                                  <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="space-y-1.5">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex rounded-full bg-blue-100 text-blue-900 border border-blue-200 px-2 py-0.5 text-[9px] font-black shadow-sm">
                                          إمداد المخزن
                                        </span>
                                        <span className="font-mono text-[9px] font-bold text-slate-400" dir="ltr">
                                          {String(row.date || "").slice(11, 16)} • {String(row.date || "").slice(0, 10)}
                                        </span>
                                      </div>
                                      <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                                        {row.doc_no || "رقم شراء غير معروف"}
                                        {row.party_name && (
                                          <span className="text-xs font-bold text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-lg flex items-center gap-1 font-sans">
                                            <Truck size={11} /> {row.party_name}
                                          </span>
                                        )}
                                      </h3>
                                    </div>

                                    <div className="flex items-center gap-2 bg-blue-50/40 border border-blue-100 rounded-xl px-4 py-2.5 text-xs font-bold">
                                      <div className="flex flex-col text-right">
                                        <span className="text-[8px] text-blue-600 font-bold block mb-0.5">الكمية</span>
                                        <span className="font-mono text-blue-700 font-black">{money(row.quantity)}</span>
                                      </div>
                                      <span className="text-blue-400 text-[10px] font-mono select-none">×</span>
                                      <div className="flex flex-col text-right">
                                        <span className="text-[8px] text-blue-600 font-bold block mb-0.5">سعر التكلفة</span>
                                        <span className="font-mono text-blue-700 font-black">{money(row.unit_price)}</span>
                                      </div>
                                      <span className="text-blue-400 text-[10px] font-mono select-none">=</span>
                                      <div className="flex flex-col text-left">
                                        <span className="text-[8px] text-blue-500 font-bold block mb-0.5">تكلفة التوريد</span>
                                        <span className="font-mono text-slate-800 font-black" dir="ltr">{money(row.line_total)} ج.م</span>
                                      </div>
                                    </div>
                                  </div>

                                  {beforeStock != null && afterStock != null && (
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center text-[10px] font-bold text-slate-500">
                                      <span>الرصيد السابق: <strong className="font-mono text-slate-700">{money(beforeStock)}</strong></span>
                                      <span className="text-emerald-500 flex items-center gap-0.5">دخول إلى المستودع <ArrowUpLeft size={12} /> <strong className="font-mono font-black">+{money(row.quantity)}</strong></span>
                                      <span>الجديد: <strong className="font-mono text-indigo-600">{money(afterStock)}</strong></span>
                                    </div>
                                  )}

                                  <div className="flex gap-2 justify-end border-t border-slate-100 pt-3.5">
                                    <motion.button
                                      whileTap={{ scale: 0.96 }}
                                      onClick={() => setPreviewTarget({ docType: "purchase", docId: row.source_id })}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-4.5 py-2 text-xs font-black text-blue-700 hover:bg-blue-50/50 shadow-sm"
                                    >
                                      <Eye size={13} /> معاينة التوريد
                                    </motion.button>
                                    <Link to={route} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
                                      <Pencil size={13} /> تعديل
                                    </Link>
                                  </div>
                                </div>
                              </SpotlightCard>
                            )}

                            {row.type === "sales_returns" && (
                              <SpotlightCard 
                                borderTone="amber"
                                className="rounded-[2rem] border border-amber-300 bg-white shadow-[0_4px_24px_-4px_rgba(245,158,11,0.02)] hover:shadow-[0_12px_32px_-8px_rgba(245,158,11,0.06)] transition-all duration-300 overflow-hidden flex flex-col p-0"
                              >
                                <div className="bg-amber-500 text-slate-900 rounded-t-[1.9rem] px-5 py-2.5 font-black text-[11px] uppercase tracking-wider flex justify-between items-center select-none shadow-sm relative">
                                  <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,#000,#000_10px,#fff_10px,#fff_20px)] pointer-events-none" />
                                  <span className="flex items-center gap-1.5 relative z-10"><AlertCircle size={13} className="animate-spin-slow relative z-10" /> مرتجع مبيعات العميل - قيد التسوية</span>
                                  <span className="font-mono opacity-85 relative z-10">SALES RETURN</span>
                                </div>
                                <div className="p-5 space-y-4">
                                  <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="space-y-1.5">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex rounded-full bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 text-[9px] font-black shadow-sm">
                                          تسوية استرداد قيمة
                                        </span>
                                        <span className="font-mono text-[9px] font-bold text-slate-400" dir="ltr">
                                          {String(row.date || "").slice(11, 16)} • {String(row.date || "").slice(0, 10)}
                                        </span>
                                      </div>
                                      <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                                        {row.doc_no || "رقم مرتجع غير معروف"}
                                        {row.party_name && (
                                          <span className="text-xs font-bold text-slate-500 font-sans">
                                            / {row.party_name}
                                          </span>
                                        )}
                                      </h3>
                                    </div>

                                    <div className="flex items-center gap-2 bg-amber-50/40 border border-amber-100 rounded-xl px-4 py-2.5 text-xs font-bold">
                                      <div className="flex flex-col text-right">
                                        <span className="text-[8px] text-amber-600 font-bold block mb-0.5">الكمية</span>
                                        <span className="font-mono text-amber-700 font-black">{money(row.quantity)}</span>
                                      </div>
                                      <span className="text-amber-400 text-[10px] font-mono select-none">×</span>
                                      <div className="flex flex-col text-right">
                                        <span className="text-[8px] text-amber-600 font-bold block mb-0.5">سعر الرد</span>
                                        <span className="font-mono text-amber-700 font-black">{money(row.unit_price)}</span>
                                      </div>
                                      <span className="text-amber-400 text-[10px] font-mono select-none">=</span>
                                      <div className="flex flex-col text-left">
                                        <span className="text-[8px] text-amber-500 font-bold block mb-0.5">المرتجع</span>
                                        <span className="font-mono text-slate-800 font-black" dir="ltr">{money(row.line_total)} ج.م</span>
                                      </div>
                                    </div>
                                  </div>

                                  {beforeStock != null && afterStock != null && (
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center text-[10px] font-bold text-slate-500">
                                      <span>الرصيد السابق: <strong className="font-mono text-slate-700">{money(beforeStock)}</strong></span>
                                      <span className="text-amber-600 flex items-center gap-0.5">إرجاع للمستودع <ArrowUpLeft size={12} /> <strong className="font-mono font-black">+{money(row.quantity)}</strong></span>
                                      <span>الجديد: <strong className="font-mono text-indigo-650">{money(afterStock)}</strong></span>
                                    </div>
                                  )}

                                  <div className="flex gap-2 justify-end border-t border-slate-100 pt-3.5">
                                    <motion.button
                                      whileTap={{ scale: 0.96 }}
                                      onClick={() => setPreviewTarget({ docType: "sales_return", docId: row.source_id })}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-4.5 py-2 text-xs font-black text-amber-700 hover:bg-amber-50/50 shadow-sm"
                                    >
                                      <Eye size={13} /> معاينة المرتجع
                                    </motion.button>
                                    <Link to={route} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
                                      <Pencil size={13} /> تعديل
                                    </Link>
                                  </div>
                                </div>
                              </SpotlightCard>
                            )}

                            {row.type === "purchase_returns" && (
                              <SpotlightCard 
                                borderTone="rose"
                                className="rounded-[2rem] border border-rose-300 bg-white shadow-[0_4px_24px_-4px_rgba(239,68,68,0.02)] hover:shadow-[0_12px_32px_-8px_rgba(239,68,68,0.06)] transition-all duration-300 overflow-hidden flex flex-col p-0"
                              >
                                <div className="bg-rose-600 text-white rounded-t-[1.9rem] px-5 py-2.5 font-black text-[11px] uppercase tracking-wider flex justify-between items-center select-none shadow-sm relative">
                                  <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,#000,#000_10px,#fff_10px,#fff_20px)] pointer-events-none" />
                                  <span className="flex items-center gap-1.5 relative z-10"><AlertTriangle size={13} className="animate-bounce" /> مرتجع مشتريات المورد - خصم وتصفية التكلفة</span>
                                  <span className="font-mono opacity-85 relative z-10">PURCHASE RETURN</span>
                                </div>
                                <div className="p-5 space-y-4">
                                  <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="space-y-1.5">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex rounded-full bg-rose-50 text-rose-900 border border-rose-200 px-2 py-0.5 text-[9px] font-black shadow-sm">
                                          مرتجع توريد بضاعة
                                        </span>
                                        <span className="font-mono text-[9px] font-bold text-slate-400" dir="ltr">
                                          {String(row.date || "").slice(11, 16)} • {String(row.date || "").slice(0, 10)}
                                        </span>
                                      </div>
                                      <h3 className="text-base font-black text-slate-805 tracking-tight flex items-center gap-1.5">
                                        {row.doc_no || "رقم مرتجع مورد غير معروف"}
                                        {row.party_name && (
                                          <span className="text-xs font-bold text-rose-600 bg-rose-50/50 px-2 py-0.5 rounded-lg flex items-center gap-1 font-sans">
                                            <Truck size={11} /> {row.party_name}
                                          </span>
                                        )}
                                      </h3>
                                    </div>

                                    <div className="flex items-center gap-2 bg-rose-50/40 border border-rose-100 rounded-xl px-4 py-2.5 text-xs font-bold">
                                      <div className="flex flex-col text-right">
                                        <span className="text-[8px] text-rose-600 font-bold block mb-0.5">الكمية</span>
                                        <span className="font-mono text-rose-700 font-black">{money(row.quantity)}</span>
                                      </div>
                                      <span className="text-rose-400 text-[10px] font-mono select-none">×</span>
                                      <div className="flex flex-col text-right">
                                        <span className="text-[8px] text-rose-600 font-bold block mb-0.5">سعر الرد</span>
                                        <span className="font-mono text-rose-700 font-black">{money(row.unit_price)}</span>
                                      </div>
                                      <span className="text-rose-400 text-[10px] font-mono select-none">=</span>
                                      <div className="flex flex-col text-left">
                                        <span className="text-[8px] text-rose-500 font-bold block mb-0.5">الإجمالي</span>
                                        <span className="font-mono text-slate-800 font-black" dir="ltr">{money(row.line_total)} ج.م</span>
                                      </div>
                                    </div>
                                  </div>

                                  {beforeStock != null && afterStock != null && (
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center text-[10px] font-bold text-slate-500">
                                      <span>الرصيد السابق: <strong className="font-mono text-slate-700">{money(beforeStock)}</strong></span>
                                      <span className="text-rose-600 flex items-center gap-0.5">خروج من المستودع <ArrowDownRight size={12} /> <strong className="font-mono font-black">-{money(row.quantity)}</strong></span>
                                      <span>الجديد: <strong className="font-mono text-indigo-650">{money(afterStock)}</strong></span>
                                    </div>
                                  )}

                                  <div className="flex gap-2 justify-end border-t border-slate-100 pt-3.5">
                                    <motion.button
                                      whileTap={{ scale: 0.96 }}
                                      onClick={() => setPreviewTarget({ docType: "purchase_return", docId: row.source_id })}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4.5 py-2 text-xs font-black text-rose-700 hover:bg-rose-50/50 shadow-sm"
                                    >
                                      <Eye size={13} /> معاينة المرتجع للمورد
                                    </motion.button>
                                    <Link to={route} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
                                      <Pencil size={13} /> تعديل
                                    </Link>
                                  </div>
                                </div>
                              </SpotlightCard>
                            )}

                            {row.type === "branch_transfers" && (
                              <SpotlightCard 
                                borderTone="indigo"
                                className="rounded-[2rem] border border-indigo-300 bg-white shadow-[0_4px_24px_-4px_rgba(99,102,241,0.02)] hover:shadow-[0_12px_32px_-8px_rgba(99,102,241,0.06)] transition-all duration-300 overflow-hidden flex flex-col p-0"
                              >
                                <div className="bg-indigo-600 text-white rounded-t-[1.9rem] px-5 py-2.5 font-black text-[11px] uppercase tracking-wider flex justify-between items-center select-none shadow-sm">
                                  <span className="flex items-center gap-1.5"><Truck size={13} className="animate-pulse" /> سند تحويل مخزني داخلي بين المستودعات</span>
                                  <span className="font-mono opacity-85">DISPATCH MANIFEST</span>
                                </div>
                                <div className="p-5 space-y-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 text-[9px] font-black">
                                        إمداد فروع داخلي
                                      </span>
                                      <span className="font-mono text-[9px] font-bold text-slate-400" dir="ltr">
                                        {String(row.date || "").slice(11, 16)} • {String(row.date || "").slice(0, 10)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="bg-[#fafaff] border border-indigo-100 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-inner relative overflow-hidden">
                                    <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#4f46e5_1.5px,transparent_1.5px)] [background-size:12px_12px] pointer-events-none" />
                                    
                                    <div className="flex flex-col text-right z-10">
                                      <span className="text-[8px] text-slate-400 font-bold block mb-0.5">مستودع الشحن</span>
                                      <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                                        <Database size={11} className="text-indigo-500" />
                                        {row.party_name || "المستودع الرئيسي"}
                                      </span>
                                    </div>

                                    <div className="flex-1 flex items-center justify-center relative px-4 z-10">
                                      <div className="h-0.5 bg-dashed bg-indigo-200 w-full relative flex items-center justify-center">
                                        <span className="absolute bg-white px-2.5 py-0.5 text-[9px] font-black text-indigo-700 border border-indigo-200 rounded-lg flex items-center gap-1 shadow-sm">
                                          {money(row.quantity)} وحدة
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex flex-col text-left z-10">
                                      <span className="text-[8px] text-slate-400 font-bold block mb-0.5">مستودع الاستلام</span>
                                      <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                                        <Database size={11} className="text-indigo-500" />
                                        {row.doc_no || "الفرع المقابل"}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex gap-2 justify-end border-t border-slate-100 pt-3.5">
                                    <motion.button
                                      whileTap={{ scale: 0.96 }}
                                      onClick={() => setPreviewTarget({ docType: "branch_transfer", docId: row.source_id })}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-4.5 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-50/50 shadow-sm"
                                    >
                                      <Eye size={13} /> تفاصيل التحويل
                                    </motion.button>
                                    <Link to={route} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
                                      <Pencil size={13} /> تعديل
                                    </Link>
                                  </div>
                                </div>
                              </SpotlightCard>
                            )}

                            {row.type === "stock_movements" && (() => {
                              const before = Number(row.context_before || 0);
                              const after = Number(row.context_after || 0);
                              const delta = after - before;
                              const isIn = delta >= 0;
                              const max = Math.max(before, after, 1);
                              const basePct = (Math.min(before, after) / max) * 100;
                              const deltaPct = (Math.abs(delta) / max) * 100;
                              return (
                                <SpotlightCard
                                  borderTone="zinc"
                                  className="rounded-[2rem] border border-zinc-200 bg-white shadow-[0_4px_24px_-4px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden flex flex-col p-0"
                                >
                                  {/* Meta strip */}
                                  <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-zinc-100/70">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className={`h-9 w-9 rounded-2xl flex items-center justify-center shrink-0 ${isIn ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                                        <Package size={16} />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">حركة مخزون · {row.type_label}</div>
                                        <h3 className="text-[13px] font-black text-slate-800 tracking-tight truncate">{row.doc_no}</h3>
                                      </div>
                                    </div>
                                    <span className="font-mono text-[9px] font-bold text-slate-400 shrink-0" dir="ltr">
                                      {String(row.date || "").slice(0, 10)} {String(row.date || "").slice(11, 16)}
                                    </span>
                                  </div>

                                  {/* Hero: horizontal level bar */}
                                  <div className="px-6 py-5">
                                    {/* Labels above bar */}
                                    <div className="flex items-baseline justify-between mb-2">
                                      <div className="flex flex-col items-start">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">قبل</span>
                                        <span className="font-mono text-base font-black text-slate-700">{money(before)}</span>
                                      </div>
                                      <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${isIn ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                                        {isIn ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                        <span className="font-mono font-black text-[11px]">{isIn ? "+" : ""}{money(delta)}</span>
                                      </div>
                                      <div className="flex flex-col items-end">
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${isIn ? "text-emerald-600" : "text-rose-600"}`}>بعد</span>
                                        <span className={`font-mono text-base font-black ${isIn ? "text-emerald-700" : "text-rose-700"}`}>{money(after)}</span>
                                      </div>
                                    </div>

                                    {/* The bar itself */}
                                    <div className="relative h-3.5 w-full rounded-full bg-zinc-100 overflow-hidden ring-1 ring-zinc-200/60">
                                      {/* Base portion = min(before, after) */}
                                      <div
                                        className="absolute inset-y-0 right-0 bg-slate-300"
                                        style={{ width: `${basePct}%` }}
                                      />
                                      {/* Delta chunk — green if added, red if removed */}
                                      <div
                                        className={`absolute inset-y-0 ${isIn ? "bg-emerald-500" : "bg-rose-500"} ${isIn ? "" : "bg-[repeating-linear-gradient(45deg,_rgba(255,255,255,0.25)_0px,_rgba(255,255,255,0.25)_4px,_transparent_4px,_transparent_8px)] bg-rose-500"}`}
                                        style={{
                                          width: `${deltaPct}%`,
                                          right: isIn ? `${basePct}%` : 0,
                                          backgroundImage: !isIn ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.3) 0 4px, transparent 4px 8px)" : undefined,
                                          backgroundColor: isIn ? undefined : "#f43f5e",
                                        }}
                                      />
                                    </div>

                                    {/* Direction caption */}
                                    <p className={`mt-2.5 text-center text-[11px] font-black ${isIn ? "text-emerald-700" : "text-rose-700"}`}>
                                      {isIn ? "إضافة للمخزن" : "خروج من المخزن"}
                                    </p>
                                  </div>

                                  {/* Footer */}
                                  {(row.party_name || row.context_source) && (
                                    <div className="px-5 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                                      {row.party_name && (
                                        <span className="flex items-center gap-1 truncate">
                                          <Warehouse size={11} /> {row.party_name}
                                        </span>
                                      )}
                                      {row.context_source && (
                                        <span className="text-slate-400 truncate">{row.context_source}</span>
                                      )}
                                    </div>
                                  )}
                                </SpotlightCard>
                              );
                            })()}

                            {row.type === "price_changes" && (() => {
                              const before = Number(row.context_before || 0);
                              const after = Number(row.context_after || 0);
                              const delta = after - before;
                              const pct = before > 0 ? Math.round((delta / before) * 1000) / 10 : null;
                              const isUp = delta > 0;
                              return (
                                <SpotlightCard
                                  borderTone="cyan"
                                  className="rounded-[2rem] border border-cyan-200 bg-white shadow-[0_4px_24px_-4px_rgba(8,145,178,0.02)] hover:shadow-[0_12px_32px_-8px_rgba(8,145,178,0.07)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden flex flex-col p-0"
                                >
                                  {/* Compact meta strip — what / when / who */}
                                  <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-cyan-100/70">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="h-9 w-9 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
                                        <Tag size={16} />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-cyan-700">{row.context_key || "تغيير سعر"}</div>
                                        <h3 className="text-[13px] font-black text-slate-800 tracking-tight truncate">{row.doc_no}</h3>
                                      </div>
                                    </div>
                                    <span className="font-mono text-[9px] font-bold text-slate-400 shrink-0" dir="ltr">
                                      {String(row.date || "").slice(0, 10)} {String(row.date || "").slice(11, 16)}
                                    </span>
                                  </div>

                                  {/* Hero: price tag — old struck-through → new huge */}
                                  <div className="relative px-6 py-7 bg-gradient-to-br from-cyan-50/60 via-white to-sky-50/40">
                                    {/* Price-tag silhouette behind the numbers */}
                                    <div className="absolute inset-y-4 right-4 w-2 h-2 rounded-full bg-cyan-300 ring-4 ring-white shadow-sm" />

                                    <div className="flex items-baseline justify-center gap-4 flex-wrap">
                                      <div className="flex flex-col items-center">
                                        <span className="text-[10px] font-black text-slate-400 mb-1">قديم</span>
                                        <span className="font-mono text-xl font-bold text-slate-400 line-through decoration-rose-400/70 decoration-2">
                                          {money(before)}
                                        </span>
                                      </div>

                                      <ArrowRight size={20} className="text-cyan-500 rtl:rotate-180 self-center mt-4" />

                                      <div className="flex flex-col items-center">
                                        <span className="text-[10px] font-black text-cyan-700 mb-1">جديد</span>
                                        <span className="font-mono text-[34px] leading-none font-black text-cyan-800 tracking-tight">
                                          {money(after)}
                                        </span>
                                        <span className="text-[9px] font-bold text-cyan-500 mt-1">ج.م</span>
                                      </div>
                                    </div>

                                    {/* Percentage pill — centered below */}
                                    {pct !== null && (
                                      <div className="flex justify-center mt-4">
                                        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 border ${isUp ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                                          {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                          <span className="font-mono font-black text-[11px]">{isUp ? "+" : ""}{pct}%</span>
                                          <span className="text-[10px] font-bold opacity-75">·</span>
                                          <span className="font-mono font-bold text-[10px]">{isUp ? "+" : ""}{money(delta)}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Footer: reason / source */}
                                  {(row.context_source || row.party_name) && (
                                    <div className="px-5 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                                      {row.party_name && (
                                        <span className="flex items-center gap-1 truncate">
                                          <User size={11} /> {row.party_name}
                                        </span>
                                      )}
                                      {row.context_source && (
                                        <span className="text-slate-400 truncate">{row.context_source}</span>
                                      )}
                                    </div>
                                  )}
                                </SpotlightCard>
                              );
                            })()}

                            {row.type === "cost_movements" && (() => {
                              const qty = Number(row.quantity || 0);
                              const unitCost = Number(row.unit_cost || 0);
                              const total = qty * unitCost;
                              const isOutflow = qty < 0;
                              return (
                                <SpotlightCard
                                  borderTone="violet"
                                  className="rounded-[2rem] border border-violet-200 bg-white shadow-[0_4px_24px_-4px_rgba(139,92,246,0.02)] hover:shadow-[0_12px_32px_-8px_rgba(139,92,246,0.07)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden flex flex-col p-0"
                                >
                                  {/* Meta strip */}
                                  <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-violet-100/70">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="h-9 w-9 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                                        <Activity size={16} />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-violet-700">حركة تكلفة · {row.type_label}</div>
                                        <h3 className="text-[13px] font-black text-slate-800 tracking-tight truncate">{row.doc_no}</h3>
                                      </div>
                                    </div>
                                    <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-black rounded-full px-2.5 py-1 border ${isOutflow ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-violet-50 border-violet-200 text-violet-700"}`}>
                                      {isOutflow ? "خروج" : "دخول"}
                                    </span>
                                  </div>

                                  {/* Hero: equation receipt */}
                                  <div className="px-6 py-5 bg-gradient-to-br from-violet-50/40 via-white to-purple-50/30">
                                    {/* Equation lines */}
                                    <div className="font-mono space-y-1.5">
                                      <div className="flex items-baseline justify-between text-[12px]">
                                        <span className="font-black text-slate-600">الكمية</span>
                                        <span className="font-black text-slate-800 tabular-nums">× {money(qty)}</span>
                                      </div>
                                      <div className="flex items-baseline justify-between text-[12px]">
                                        <span className="font-black text-slate-600">تكلفة الوحدة</span>
                                        <span className="font-black text-slate-800 tabular-nums">× {money(unitCost)}</span>
                                      </div>

                                      {/* Receipt-style dashed divider */}
                                      <div className="my-2 border-t border-dashed border-violet-300/80" />

                                      {/* Total — big and bold */}
                                      <div className="flex items-baseline justify-between pt-1">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-violet-700">الإجمالي</span>
                                        <div className="text-right">
                                          <span className={`font-black text-[28px] leading-none tabular-nums ${isOutflow ? "text-rose-700" : "text-violet-800"}`}>
                                            {isOutflow ? "" : "+"}{money(total)}
                                          </span>
                                          <span className={`block text-[9px] font-bold mt-0.5 ${isOutflow ? "text-rose-500" : "text-violet-500"}`}>ج.م</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Footer: timestamp + ledger source */}
                                  <div className="px-5 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Database size={11} /> دفتر التكلفة
                                    </span>
                                    <span className="font-mono text-[10px] text-slate-400" dir="ltr">
                                      {String(row.date || "").slice(0, 10)} {String(row.date || "").slice(11, 16)}
                                    </span>
                                  </div>
                                </SpotlightCard>
                              );
                            })()}

                          </motion.article>
                        );
                      })}
                    </motion.div>
                  )}
                </div>

                {selectedId && pages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-6 pb-2">
                    <button
                      className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                      disabled={page <= 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                      <ChevronRight size={16} />
                    </button>
                    <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200/60 px-3.5 py-2 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                      الصفحة <span className="font-mono text-slate-800 font-bold">{page}</span> من <span className="font-mono text-slate-800 font-bold">{pages}</span>
                    </span>
                    <button
                      className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                      disabled={page >= pages}
                      onClick={() => setPage((value) => Math.min(pages, value + 1))}
                    >
                      <ChevronLeft size={16} />
                    </button>
                  </div>
                )}
              </>
            )}

            {!selectedId && (
              <div className="bg-white border border-slate-200/60 rounded-[2.5rem] p-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.015)] relative overflow-hidden flex flex-col items-center justify-center min-h-[420px]">
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl translate-x-10 -translate-y-10 pointer-events-none" />
                <div className="w-24 h-24 bg-indigo-50/50 text-indigo-650 rounded-3xl flex items-center justify-center mb-6 border border-indigo-100 relative shadow-[inset_0_1px_3px_rgba(99,102,241,0.05)]">
                  <ClipboardList size={38} className="stroke-[1.3] animate-pulse" />
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-2">اختار صنف عشان نوريك كل اللي حصله</h3>
                <p className="text-xs font-bold text-slate-400 max-w-[390px] leading-relaxed mb-8">
                  دوس على أي صنف من القايمة على جنب وهتلاقي كل حاجة اتعملت عليه: مبيعات، مشتريات، مرتجعات، تحويلات، وتغيرات الأسعار والتكلفة.
                </p>
                <div className="flex gap-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-500 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
                    <Sparkles size={11} className="text-indigo-500 animate-pulse" /> فلترة سهلة
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-500 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
                    <Box size={11} className="text-emerald-500" /> متابعة المخزون مباشرة
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-start pt-2 border-t border-slate-200/55">
              <Link 
                to="/operations/bulk-price-update" 
                className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors bg-white hover:bg-indigo-50/30 border border-slate-200/60 px-4.5 py-3 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
              >
                <ExternalLink size={13} /> العودة إلى سجل تغييرات الأسعار
              </Link>
            </div>

          </div>
        </main>
      </div>

      <DocumentPreviewModal
        open={!!previewTarget}
        docType={previewTarget?.docType}
        docId={previewTarget?.docId}
        highlightItemId={selectedId}
        onClose={() => setPreviewTarget(null)}
      />
    </div>
  );
}
