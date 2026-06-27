import React, { useState, useMemo } from "react";
import { Check, X as XIcon, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { getQuiz, submitQuiz } from "../../services/trainingEngine";

export default function QuizPanel({ moduleKey, track, onComplete, t }) {
  const questions = useMemo(() => getQuiz(moduleKey), [moduleKey]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!questions || questions.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>{t?.("quiz.noQuestions") || "لا يوجد أسئلة لهذه الوحدة"}</p>
      </div>
    );
  }

  const handleAnswer = (optionIndex) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [current]: optionIndex }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const formatted = questions.map((q, i) => ({
      question: q.question,
      given: answers[i] !== undefined ? q.options[answers[i]] : "",
      correct: answers[i] === q.correct,
      correctAnswer: q.options[q.correct],
    }));
    try {
      const res = await submitQuiz(track, moduleKey, formatted);
      if (res.success) setResult(res.data);
    } catch {
      const correct = formatted.filter(a => a.correct).length;
      setResult({ score: Math.round((correct / formatted.length) * 100), correct, total: formatted.length });
    }
    setSubmitted(true);
    setSubmitting(false);
    onComplete?.(true);
  };

  const handleRetry = () => {
    setAnswers({});
    setCurrent(0);
    setSubmitted(false);
    setResult(null);
  };

  if (submitted && result) {
    const passed = result.score >= 70;
    return (
      <div className="rounded-2xl border p-4 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: passed ? "var(--success-bg)" : "var(--danger-bg)" }}>
          {passed ? <Check className="h-6 w-6" style={{ color: "var(--success-text)" }} /> : <XIcon className="h-6 w-6" style={{ color: "var(--danger)" }} />}
        </div>
        <h3 className="text-[15px] font-black mb-1" style={{ color: "var(--text-primary)" }}>
          {passed ? (t?.("quiz.passed") || "أحسنت! 🎉") : (t?.("quiz.failed") || "حاول تاني 💪")}
        </h3>
        <p className="text-[12px] font-bold mb-3" style={{ color: "var(--text-secondary)" }}>
          {result.correct} / {result.total} — {result.score}%
        </p>
        <div className="mb-3 h-2 w-full rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
          <div className="h-full rounded-full transition-all" style={{
            width: `${result.score}%`,
            background: passed ? "var(--success-text)" : "var(--danger)",
          }} />
        </div>
        {result.score < 100 && (
          <button onClick={handleRetry}
            className="flex items-center gap-1 mx-auto rounded-xl px-3 py-1.5 text-[11px] font-black text-white"
            style={{ background: "var(--primary)" }}>
            <RotateCcw className="h-3 w-3" /> {t?.("quiz.retry") || "إعادة الاختبار"}
          </button>
        )}
      </div>
    );
  }

  const q = questions[current];
  const hasAnswer = answers[current] !== undefined;

  return (
    <div className="rounded-2xl border p-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
      <div className="flex gap-1 mb-3">
        {questions.map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: answers[i] !== undefined ? "var(--primary)" : "var(--border-normal)" }} />
        ))}
      </div>

      <span className="text-[10px] font-black" style={{ color: "var(--text-muted)" }}>
        {t?.("quiz.question") || "سؤال"} {current + 1} / {questions.length}
      </span>

      <h4 className="text-[13px] font-black my-2 leading-relaxed" style={{ color: "var(--text-primary)" }}>{q.question}</h4>

      <div className="space-y-1.5 mb-3">
        {q.options.map((opt, i) => {
          const selected = answers[current] === i;
          const isCorrect = submitted && i === q.correct;
          const isWrong = submitted && selected && i !== q.correct;
          return (
            <button key={i} onClick={() => handleAnswer(i)}
              className="w-full rounded-xl border px-3 py-2 text-right text-[12px] font-bold transition-all hover:shadow-sm"
              style={{
                background: isCorrect ? "var(--success-bg)" : isWrong ? "var(--danger-bg)" : selected ? "var(--bg-input)" : "var(--bg-surface)",
                borderColor: isCorrect ? "var(--success-border)" : isWrong ? "var(--danger-border)" : selected ? "var(--primary)" : "var(--border-normal)",
                color: "var(--text-primary)",
              }}>
              {opt}
              {selected && <span className="mr-2" style={{ color: "var(--primary)" }}>✓</span>}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0}
          className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold disabled:opacity-30"
          style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>
          <ChevronRight className="h-3 w-3" /> {t?.("quiz.previous") || "السابق"}
        </button>

        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent(current + 1)} disabled={!hasAnswer}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-30"
            style={{ background: "var(--primary)" }}>
            {t?.("quiz.next") || "التالي"} <ChevronLeft className="h-3 w-3" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={Object.keys(answers).length < questions.length || submitting}
            className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-30"
            style={{ background: "var(--success-text)" }}>
            {submitting ? "..." : (t?.("quiz.submit") || "إنهاء الاختبار")}
          </button>
        )}
      </div>
    </div>
  );
}
