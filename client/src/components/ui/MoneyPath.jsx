import React from "react";
import { ArrowLeft } from "lucide-react";

// One-glance "where does the money go" chip row + optional plain sentence.
// Renders RTL: [من: خزنة الفرع] ← [إلى: بنك CIB]
//
// props: from / to: { icon?, label }, sentence?: string, compact?: boolean
function Node({ node, compact }) {
  if (!node) return null;
  const Icon = node.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-base font-black text-text-primary ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      }`}
    >
      {Icon && <Icon className={compact ? "h-3 w-3 text-text-muted" : "h-3.5 w-3.5 text-text-muted"} />}
      {node.label}
    </span>
  );
}

export default function MoneyPath({ from, to, sentence, compact = false, className = "" }) {
  return (
    <div dir="rtl" className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Node node={from} compact={compact} />
        <ArrowLeft className={`shrink-0 text-primary ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
        <Node node={to} compact={compact} />
      </div>
      {sentence && (
        <p className="text-[11px] font-bold text-text-muted leading-relaxed">{sentence}</p>
      )}
    </div>
  );
}
