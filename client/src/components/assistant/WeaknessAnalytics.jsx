import React, { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, XCircle, ChevronLeft, RefreshCw } from "lucide-react";
import { fetchWeaknesses, fetchAllWeaknesses } from "../../services/trainingEngine";
import { useAuthStore } from "../../stores/authStore";

export default function WeaknessAnalytics({ t }) {
  const user = useAuthStore(s => s.user);
  const isManager = user?.role === "admin" || user?.role === "manager";
  const [weaknesses, setWeaknesses] = useState([]);
  const [grouped, setGrouped] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = isManager ? await fetchAllWeaknesses() : await fetchWeaknesses();
      if (res.success) {
        if (isManager) {
          setGrouped(res.data || []);
        } else {
          setWeaknesses(res.data?.list || []);
          setGrouped(res.data?.grouped || []);
        }
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <RefreshCw className="h-4 w-4 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (grouped.length === 0 && weaknesses.length === 0) {
    return (
      <div className="rounded-2xl border p-4 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
        <TrendingUp className="mx-auto h-6 w-6 mb-1" style={{ color: "var(--success-text)" }} />
        <p className="text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>
          {t?.("weaknesses.none") || "لا توجد نقاط ضعف مسجلة — كل شيء تمام! 👍"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          <AlertTriangle className="inline h-3 w-3 ml-1" /> {t?.("weaknesses.title") || "نقاط الضعف"}
        </span>
        <button onClick={load} className="rounded-lg p-1 hover:bg-black/5" style={{ color: "var(--text-muted)" }}>
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {isManager ? (
        grouped.map((g, i) => (
          <div key={i}
            className="rounded-2xl border p-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-[11px] font-black" style={{ color: "var(--text-primary)" }}>
                {g.username} — {g.module}
              </h4>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}>
                {g.count} {t?.("weaknesses.errors") || "أخطاء"}
              </span>
            </div>
            {g.items.map((item, j) => (
              <div key={j} className="mb-1 rounded-lg border p-2"
                style={{ borderColor: "var(--danger-border)", background: "var(--danger-bg)" }}>
                <p className="text-[10px] font-bold" style={{ color: "var(--danger-text)" }}>{item.question}</p>
                <div className="flex gap-2 mt-0.5 text-[9px] font-semibold">
                  <span style={{ color: "var(--danger)" }}>✗ {item.wrong_answer}</span>
                  <span style={{ color: "var(--success-text)" }}>✓ {item.correct_answer}</span>
                </div>
              </div>
            ))}
          </div>
        ))
      ) : (
        grouped.map((g, i) => (
          <div key={i}
            className="rounded-2xl border p-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
            <h4 className="text-[11px] font-black mb-1.5" style={{ color: "var(--text-primary)" }}>
              {g.module}
            </h4>
            {g.weaknesses.map((w, j) => (
              <div key={j} className="mb-1 rounded-lg border p-2" style={{ borderColor: "var(--border-normal)" }}>
                <p className="text-[10px] font-bold" style={{ color: "var(--text-primary)" }}>{w.question}</p>
                <div className="flex gap-2 mt-0.5 text-[9px] font-semibold">
                  <span style={{ color: "var(--danger)" }}>✗ {w.wrong_answer}</span>
                  <span style={{ color: "var(--success-text)" }}>✓ {w.correct_answer}</span>
                </div>
                <span className="text-[8px] font-bold" style={{ color: "var(--text-muted)" }}>
                  {t?.("weaknesses.failedTimes") || "أخطأت"} {w.fail_count} {t?.("weaknesses.times") || "مرات"}
                </span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
