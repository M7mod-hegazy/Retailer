import React from "react";
import { Plus, Minus, Trash2, ShoppingCart, Check, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { useSandboxStore } from "../../services/sandboxStore";

export default function SandboxPanel({ scenario, t }) {
  const {
    scenarioStep, invoiceLines, searchQuery, searchResults, completed,
    searchItems, addToInvoice, removeFromInvoice, updateQty,
    nextScenarioStep, prevScenarioStep, resetScenario,
  } = useSandboxStore();

  if (!scenario) return null;

  const currentStep = scenario.steps[scenarioStep];
  const total = invoiceLines.reduce((s, l) => s + l.item.price * l.qty, 0);

  if (completed) {
    return (
      <div className="rounded-2xl border p-4 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--success-bg)" }}>
          <Check className="h-6 w-6" style={{ color: "var(--success-text)" }} />
        </div>
        <h3 className="text-[14px] font-black mb-1" style={{ color: "var(--text-primary)" }}>
          {t?.("sandbox.completed") || "تم التدريب بنجاح 🎉"}
        </h3>
        <p className="text-[11px] font-bold mb-3" style={{ color: "var(--text-secondary)" }}>
          {t?.("sandbox.completedDesc") || "أنهيت المحاكاة بنجاح! تقدر تعيدها لو عايز."}
        </p>
        <button onClick={resetScenario}
          className="flex items-center gap-1 mx-auto rounded-xl px-3 py-1.5 text-[11px] font-black text-white"
          style={{ background: "var(--primary)" }}>
          <RotateCcw className="h-3 w-3" /> {t?.("sandbox.retry") || "إعادة التدريب"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {scenario.steps.map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full"
            style={{ background: i <= scenarioStep ? "var(--primary)" : "var(--border-normal)" }} />
        ))}
      </div>

      <div
        className="rounded-2xl border-2 p-3 transition-all"
        style={{ background: "var(--bg-surface)", borderColor: "var(--primary)", borderStyle: "dashed" }}
      >
        <div className="flex items-start gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
            style={{ background: "var(--primary)" }}>
            {scenarioStep + 1}
          </div>
          <p className="text-[13px] font-black leading-relaxed pt-0.5" style={{ color: "var(--text-primary)" }}>
            {currentStep.instructionAr}
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl border p-3"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <ShoppingCart className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            {t?.("sandbox.posSimulator") || "محاكي البيع"}
          </span>
        </div>

        <input
          value={searchQuery}
          onChange={e => searchItems(e.target.value)}
          placeholder={t?.("sandbox.searchPlaceholder") || "ابحث عن صنف (جرب: مياه أو تيشيرت)..."}
          className="w-full rounded-xl border bg-transparent px-3 py-1.5 text-[12px] font-bold outline-none mb-2"
          style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)" }}
        />

        {searchResults.length > 0 && (
          <div className="mb-2 rounded-xl border p-1.5 space-y-0.5" style={{ borderColor: "var(--border-normal)" }}>
            {searchResults.map(item => (
              <button key={item.id} onClick={() => addToInvoice(item)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-primary/5 text-[11px] font-bold"
                style={{ color: "var(--text-primary)" }}>
                <span>{item.name}</span>
                <span style={{ color: "var(--primary)" }}>{item.price} ج.م</span>
              </button>
            ))}
          </div>
        )}

        {invoiceLines.length > 0 && (
          <div className="space-y-1 mb-2 max-h-32 overflow-y-auto">
            {invoiceLines.map(line => (
              <div key={line.item.id}
                className="flex items-center justify-between rounded-lg border px-2 py-1.5"
                style={{ borderColor: "var(--border-normal)" }}>
                <span className="text-[11px] font-bold" style={{ color: "var(--text-primary)" }}>{line.item.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(line.item.id, line.qty - 1)}
                    className="rounded-md border p-0.5 hover:bg-black/5" style={{ borderColor: "var(--border-normal)" }}>
                    <Minus className="h-2.5 w-2.5" />
                  </button>
                  <span className="text-[11px] font-black w-5 text-center" style={{ color: "var(--text-primary)" }}>{line.qty}</span>
                  <button onClick={() => updateQty(line.item.id, line.qty + 1)}
                    className="rounded-md border p-0.5 hover:bg-black/5" style={{ borderColor: "var(--border-normal)" }}>
                    <Plus className="h-2.5 w-2.5" />
                  </button>
                  <span className="text-[11px] font-black w-12 text-left" style={{ color: "var(--text-primary)" }}>{line.item.price * line.qty} ج.م</span>
                  <button onClick={() => removeFromInvoice(line.item.id)}
                    className="rounded-md p-0.5 hover:bg-danger/10" style={{ color: "var(--text-muted)" }}>
                    <Trash2 className="h-2.5 w-2.5" style={{ color: "var(--danger)" }} />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex justify-between border-t pt-1.5 mt-1 text-[12px] font-black" style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)" }}>
              <span>{t?.("sandbox.total") || "الإجمالي"}</span>
              <span>{total} ج.م</span>
            </div>
          </div>
        )}

        {invoiceLines.length === 0 && (
          <p className="text-[10px] font-bold text-center py-2" style={{ color: "var(--text-muted)" }}>
            {t?.("sandbox.emptyInvoice") || "ضيف أصناف للفاتورة من البحث"}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={prevScenarioStep} disabled={scenarioStep === 0}
          className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-30"
          style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>
          <ChevronRight className="h-3 w-3" /> {t?.("sandbox.previous") || "السابق"}
        </button>
        <button onClick={nextScenarioStep}
          className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold text-white"
          style={{ background: "var(--primary)" }}>
          {scenarioStep === scenario.steps.length - 1
            ? (t?.("sandbox.finish") || "إنهاء")
            : (t?.("sandbox.next") || "التالي")}
          <ChevronLeft className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
