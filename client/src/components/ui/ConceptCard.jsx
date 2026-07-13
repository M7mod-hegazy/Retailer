import React, { useState } from "react";
import { Lightbulb, X } from "lucide-react";

// Dismissible concept explainer shown at the top of concept-heavy pages
// ("ما هي الوردية؟", "إيه الفرق بين مصروف ومسحوبات؟"...).
// Shows itself on the first `maxViews` visits, then disappears for good once
// dismissed. View counting is local per device (localStorage) on purpose —
// it is a gentle reminder, not user state worth syncing.
const LS_PREFIX = "retailer.concept.";

function readViews(id) {
  try { return Number(localStorage.getItem(LS_PREFIX + id) || 0); } catch { return 0; }
}
function writeViews(id, n) {
  try { localStorage.setItem(LS_PREFIX + id, String(n)); } catch { }
}

export default function ConceptCard({ id, title, icon: Icon = Lightbulb, maxViews = 3, children, className = "" }) {
  const [visible, setVisible] = useState(() => {
    const views = readViews(id);
    if (views >= maxViews) return false;
    writeViews(id, views + 1);
    return true;
  });

  if (!visible) return null;

  function dismiss() {
    writeViews(id, maxViews);
    setVisible(false);
  }

  return (
    <div dir="rtl" className={`relative rounded-2xl border border-border bg-bg-surface p-4 ${className}`}>
      <button
        onClick={dismiss}
        aria-label="إخفاء"
        title="إخفاء نهائياً"
        className="absolute top-3 left-3 flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-base transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1 pl-6">
          {title && <h3 className="text-sm font-black text-text-primary mb-1">{title}</h3>}
          <div className="text-[12px] font-bold text-text-secondary leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}
