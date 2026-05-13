import React, { useState } from "react";

export default function Accordion({ items = [] }) {
  const [openIndex, setOpenIndex] = useState(null);
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/8 bg-white/[0.04]">
      {items.map((item, i) => (
        <div key={i} className={i > 0 ? "border-t border-white/8" : ""}>
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
          >
            <span>{item.title}</span>
            <svg className={`h-4 w-4 transition-transform ${openIndex === i ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {openIndex === i ? (
            <div className="bg-black/10 px-4 py-3 text-sm text-text-secondary">{item.content}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
