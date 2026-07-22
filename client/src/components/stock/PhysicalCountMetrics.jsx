import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Package, Clock, Hash } from "lucide-react";

function Metric({ icon: Icon, label, value, sub, color = "text-text-primary", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-4 px-6 py-4"
    >
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${color === "text-success-text" ? "bg-success-bg" : color === "text-danger-text" ? "bg-danger-bg" : color === "text-warning-text" ? "bg-warning-bg" : "bg-bg-overlay"}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-widest text-text-muted">{label}</p>
        <p className={`text-2xl font-black number-fmt ${color}`}>{value}</p>
        {sub && <p className="text-[11px] font-bold text-text-muted mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

export default function PhysicalCountMetrics({ stats, lines = [] }) {
  const { total_lines = 0, counted_lines = 0, variance_count = 0, completed_lines = 0 } = stats || {};
  const matched = counted_lines - variance_count;
  const pct = total_lines > 0 ? Math.round((counted_lines / total_lines) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 bg-bg-surface rounded-3xl border border-border-normal shadow-card overflow-hidden divide-x divide-border-normal">
      <Metric icon={Hash} label="إجمالي الأصناف" value={total_lines} delay={0} />
      <Metric icon={Clock} label="تم العد" value={counted_lines} sub={`${pct}%`} color="text-primary" delay={0.05} />
      <Metric icon={CheckCircle2} label="مطابق" value={Math.max(0, matched)} color="text-success-text" delay={0.1} />
      <Metric icon={AlertTriangle} label="فروقات" value={variance_count} color={variance_count > 0 ? "text-danger-text" : "text-success-text"} delay={0.15} />
    </div>
  );
}
