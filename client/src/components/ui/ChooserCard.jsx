import React from "react";
import { Link } from "react-router-dom";

// "أنا محتاج أعمل إيه؟" — small decision card for sibling concepts that get
// mixed up (مصروف vs مسحوبات، آجل vs تقسيط vs شيك، تحويل مخزني vs فرع).
//
// options: [{ icon?, label, desc, to?, onSelect?, current? }]
export default function ChooserCard({ title, options = [], className = "" }) {
  return (
    <div dir="rtl" className={`rounded-2xl border border-border bg-bg-surface p-3 ${className}`}>
      {title && <h3 className="text-[12px] font-black text-text-primary mb-2 px-1">{title}</h3>}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 3)}, minmax(0, 1fr))` }}>
        {options.map((opt, i) => {
          const Icon = opt.icon;
          const body = (
            <>
              <span className="flex items-center gap-1.5">
                {Icon && <Icon className={`h-4 w-4 shrink-0 ${opt.current ? "text-primary" : "text-text-muted"}`} />}
                <span className={`text-[12px] font-black ${opt.current ? "text-primary" : "text-text-primary"}`}>
                  {opt.label}
                </span>
                {opt.current && (
                  <span className="mr-auto rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-black text-primary">أنت هنا</span>
                )}
              </span>
              <span className="text-[10px] font-bold text-text-muted leading-relaxed">{opt.desc}</span>
            </>
          );
          const cls = `flex flex-col items-start gap-1 rounded-xl border p-2.5 text-start transition-all ${
            opt.current
              ? "border-primary/40 bg-primary/5 cursor-default"
              : "border-border bg-bg-base hover:bg-bg-surface hover:shadow-sm active:scale-[0.98]"
          }`;
          if (opt.current || (!opt.to && !opt.onSelect)) {
            return <div key={i} className={cls}>{body}</div>;
          }
          if (opt.to) {
            return <Link key={i} to={opt.to} className={cls}>{body}</Link>;
          }
          return (
            <button key={i} type="button" onClick={opt.onSelect} className={cls}>
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}
