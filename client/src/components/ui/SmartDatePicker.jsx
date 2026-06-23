import React, { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function SmartDatePicker({ dateFrom, dateTo, setDateFrom, setDateTo, theme = "amber", maxToday = true }) {
  // Modes: today, single, range
  const [mode, setMode] = useState(() => {
    if (dateFrom === dateTo && dateFrom === today()) return "today";
    if (dateFrom === dateTo) return "single";
    return "range";
  });

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === "today") {
      setDateFrom(today());
      setDateTo(today());
    }
  };

  const handleSingleDate = (e) => {
    const val = e.target.value;
    setDateFrom(val);
    setDateTo(val);
  };

  const maxLimit = maxToday ? today() : undefined;

  // Map theme colors to classNames
  const colorMap = {
    amber: "text-amber-600",
    rose: "text-rose-600",
    emerald: "text-emerald-600",
  };
  const activeCls = colorMap[theme] || "text-amber-600";

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-100">
      {/* Pills */}
      <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-xl shrink-0">
        <button 
          onClick={() => handleModeChange("today")}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${mode === "today" ? `bg-white ${activeCls} shadow-sm` : "text-slate-500 hover:text-slate-700"}`}
        >
          اليوم
        </button>
        <button 
          onClick={() => handleModeChange("single")}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${mode === "single" ? `bg-white ${activeCls} shadow-sm` : "text-slate-500 hover:text-slate-700"}`}
        >
          يوم محدد
        </button>
        <button 
          onClick={() => handleModeChange("range")}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${mode === "range" ? `bg-white ${activeCls} shadow-sm` : "text-slate-500 hover:text-slate-700"}`}
        >
          فترة
        </button>
      </div>

      {/* Dynamic Inputs based on Mode */}
      <AnimatePresence mode="wait">
        {mode === "single" && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="flex items-center">
            <input 
              type="date" value={dateFrom} onChange={handleSingleDate} max={maxLimit}
              className="h-8 bg-transparent text-2sm font-bold text-zinc-700 outline-none px-2 cursor-pointer" 
            />
          </motion.div>
        )}
        {mode === "range" && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="flex items-center gap-1 overflow-hidden">
            <input 
              type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={maxLimit}
              className="h-8 bg-transparent text-2sm font-bold text-zinc-700 outline-none px-2 cursor-pointer w-[110px]" 
            />
            <ArrowLeftRight className="h-3 w-3 text-slate-300 shrink-0" />
            <input 
              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} max={maxLimit}
              className="h-8 bg-transparent text-2sm font-bold text-zinc-700 outline-none px-2 cursor-pointer w-[110px]" 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
