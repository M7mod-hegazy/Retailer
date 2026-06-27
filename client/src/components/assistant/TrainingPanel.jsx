import React, { useState, useEffect, useMemo } from "react";
import { GraduationCap, CheckCircle, Circle, Play, BookOpen, BarChart3, ChevronLeft, Target } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { getTrainingTracks, fetchTrainingProgress, getAllScenarios } from "../../services/trainingEngine";
import QuizPanel from "./QuizPanel";
import SandboxPanel from "./SandboxPanel";
import { useSandboxStore } from "../../services/sandboxStore";

const MODE_OVERVIEW = "overview";
const MODE_MODULE = "module";
const MODE_QUIZ = "quiz";
const MODE_SCENARIO = "scenario";

export default function TrainingPanel({ onNavigate, t }) {
  const user = useAuthStore(s => s.user);
  const role = user?.role || "cashier";
  const tracks = useMemo(() => getTrainingTracks(role), [role]);
  const [mode, setMode] = useState(MODE_OVERVIEW);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [progress, setProgress] = useState({});
  const [selectedScenario, setSelectedScenario] = useState(null);
  const startScenario = useSandboxStore(s => s.startScenario);
  const sandboxActive = useSandboxStore(s => s.active);

  const loadProgress = async () => {
    const res = await fetchTrainingProgress();
    if (res.success) {
      const map = {};
      (res.data || []).forEach(p => { map[`${p.track}_${p.module_key}`] = p; });
      setProgress(map);
    }
  };

  useEffect(() => { loadProgress(); }, []);

  const completedCount = (trackId) => {
    return tracks.find(t => t.id === trackId)?.modules.filter(m => progress[`${trackId}_${m.key}`]?.completed).length || 0;
  };

  const totalCount = (trackId) => {
    return tracks.find(t => t.id === trackId)?.modules.length || 0;
  };

  const trackScore = (trackId) => {
    const modules = tracks.find(t => t.id === trackId)?.modules || [];
    const scores = modules.map(m => progress[`${trackId}_${m.key}`]?.score).filter(Boolean);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  if (sandboxActive) {
    return <SandboxPanel scenario={selectedScenario} t={t} />;
  }

  if (mode === MODE_SCENARIO && selectedScenario) {
    return <SandboxPanel scenario={selectedScenario} t={t} />;
  }

  if (mode === MODE_QUIZ && selectedModule && selectedTrack) {
    return (
      <div>
        <button onClick={() => setMode(MODE_MODULE)}
          className="flex items-center gap-1 text-[11px] font-bold mb-2 hover:text-primary transition-colors"
          style={{ color: "var(--text-muted)" }}>
          <ChevronLeft className="h-3.5 w-3.5" /> {t?.("training.back") || "رجوع"}
        </button>
        <QuizPanel moduleKey={selectedModule.key} track={selectedTrack.id} onComplete={() => { loadProgress(); }} t={t} />
      </div>
    );
  }

  if (mode === MODE_MODULE && selectedModule && selectedTrack) {
    const modProgress = progress[`${selectedTrack.id}_${selectedModule.key}`];
    const scenarios = getAllScenarios().filter(s => s.track === selectedTrack.id);
    const moduleScenarios = scenarios.filter(s =>
      s.steps.some(st => st.instructionAr.includes(selectedModule.nameAr?.slice(0, 4)))
    );

    return (
      <div>
        <button onClick={() => setMode(MODE_OVERVIEW)}
          className="flex items-center gap-1 text-[11px] font-bold mb-2 hover:text-primary transition-colors"
          style={{ color: "var(--text-muted)" }}>
          <ChevronLeft className="h-3.5 w-3.5" /> {t?.("training.back") || "رجوع للمسار"}
        </button>

        <div className="rounded-2xl border p-3 mb-2" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{selectedModule.icon}</span>
            <div>
              <h3 className="text-[13px] font-black" style={{ color: "var(--text-primary)" }}>{selectedModule.nameAr}</h3>
              {modProgress?.score != null && (
                <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                  {t?.("training.score") || "النتيجة"}: {modProgress.score}%
                </span>
              )}
            </div>
          </div>
          {modProgress?.completed ? (
            <div className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--success-text)" }}>
              <CheckCircle className="h-3.5 w-3.5" /> {t?.("training.completed") || "مكتمل ✓"}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
              <Circle className="h-3.5 w-3.5" /> {t?.("training.notStarted") || "لم يبدأ بعد"}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <button onClick={() => setMode(MODE_QUIZ)}
            className="flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] font-bold transition-all hover:shadow-sm"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)", color: "var(--text-primary)" }}>
            <BookOpen className="h-4 w-4" style={{ color: "var(--primary)" }} />
            {t?.("training.startQuiz") || "ابدأ الاختبار"}
          </button>

          {moduleScenarios.map(s => (
            <button key={s.id} onClick={() => { setSelectedScenario(s); setMode(MODE_SCENARIO); }}
              className="flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] font-bold transition-all hover:shadow-sm"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)", color: "var(--text-primary)" }}>
              <Play className="h-4 w-4" style={{ color: "var(--success-text)" }} />
              {s.titleAr}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <GraduationCap className="h-4 w-4" style={{ color: "var(--primary)" }} />
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          {t?.("training.title") || "التدريب"}
        </span>
      </div>

      {tracks.map(track => {
        const c = completedCount(track.id);
        const total = totalCount(track.id);
        const pct = total > 0 ? Math.round((c / total) * 100) : 0;
        const score = trackScore(track.id);

        return (
          <div key={track.id}
            className="rounded-2xl border p-3 transition-all hover:shadow-sm cursor-pointer"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
            onClick={() => { setSelectedTrack(track); setMode(MODE_OVERVIEW); }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-black" style={{ color: "var(--text-primary)" }}>
                {track.nameAr}
              </h3>
              <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>{c}/{total}</span>
            </div>

            <div className="h-2 w-full rounded-full overflow-hidden mb-2" style={{ background: "var(--bg-input)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--primary)" }} />
            </div>

            {score != null && (
              <div className="flex items-center gap-1 text-[10px] font-bold mb-2" style={{ color: "var(--text-muted)" }}>
                <Target className="h-3 w-3" /> {t?.("training.avgScore") || "متوسط النتيجة"}: {score}%
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {track.modules.map(mod => {
                const done = progress[`${track.id}_${mod.key}`]?.completed;
                return (
                  <div key={mod.key}
                    onClick={e => { e.stopPropagation(); setSelectedTrack(track); setSelectedModule(mod); setMode(MODE_MODULE); }}
                    className="flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold transition-all hover:shadow-sm"
                    style={{
                      background: done ? "var(--success-bg)" : "var(--bg-surface)",
                      borderColor: done ? "var(--success-border)" : "var(--border-normal)",
                      color: done ? "var(--success-text)" : "var(--text-secondary)",
                    }}>
                    {done ? <CheckCircle className="h-2.5 w-2.5" /> : <Circle className="h-2.5 w-2.5" />}
                    {mod.icon} {mod.nameAr}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
