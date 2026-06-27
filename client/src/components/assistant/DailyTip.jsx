import React, { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { fetchDailyTip } from "../../services/queryEngine";

export default function DailyTip({ t }) {
  const [tip, setTip] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetchDailyTip();
      if (res.success && res.data) setTip(res.data);
    })();
  }, []);

  if (!tip || dismissed) return null;

  return (
    <div
      className="relative rounded-2xl border p-3 transition-all hover:shadow-sm"
      style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)" }}
    >
      <button
        onClick={() => setDismissed(true)}
        className="absolute left-2 top-2 rounded-full p-0.5 hover:bg-black/5"
        style={{ color: "var(--text-muted)" }}
      >
        <X className="h-3 w-3" />
      </button>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--warning-light)" }}>
          <Lightbulb className="h-3.5 w-3.5" style={{ color: "var(--warning-text)" }} />
        </div>
        <div className="flex-1 pe-3">
          <span className="text-[10px] font-black" style={{ color: "var(--warning-text)" }}>{t?.("dailyTip.title") || "💡 نصيحة اليوم"}</span>
          <h4 className="text-[12px] font-black mt-0.5" style={{ color: "var(--text-primary)" }}>{tip.title}</h4>
          <p className="text-[11px] font-semibold mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{tip.body}</p>
        </div>
      </div>
    </div>
  );
}
