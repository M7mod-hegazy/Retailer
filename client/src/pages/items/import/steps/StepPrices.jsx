import React, { useMemo, useState } from "react";
import { CheckCircle2, SkipForward, DollarSign, TrendingUp, TrendingDown, Minus, Pencil, X, AlertTriangle } from "lucide-react";

const PAGE_SIZE = 20;

const PRICE_META = {
  sale_price: {
    label: "سعر البيع",
    description: "سعر البيع للعميل النهائي — التغيير يؤثر مباشرة على الفواتير الجديدة.",
    updateDesc: "سيُحدَّث سعر البيع لكل منتج بقيمة الملف.",
    skipDesc: "سيبقى سعر البيع الحالي في النظام دون أي تغيير.",
  },
  purchase_price: {
    label: "سعر الشراء",
    description: "تكلفة الشراء من المورّد — يؤثر على تقارير الأرباح والهامش.",
    updateDesc: "سيُحدَّث سعر الشراء لكل منتج بقيمة الملف.",
    skipDesc: "سيبقى سعر الشراء الحالي في النظام دون أي تغيير.",
  },
  wholesale_price: {
    label: "سعر الجملة",
    description: "السعر الخاص بعملاء الجملة — مستقل عن سعر البيع العادي.",
    updateDesc: "سيُحدَّث سعر الجملة لكل منتج بقيمة الملف.",
    skipDesc: "سيبقى سعر الجملة الحالي في النظام دون أي تغيير.",
  },
};

function fmt(val) {
  const n = Number(val ?? 0);
  return isNaN(n) ? "—" : n.toLocaleString("ar-EG");
}

function PriceDelta({ oldVal, newVal }) {
  const o = Number(oldVal ?? 0);
  const n = Number(newVal ?? 0);
  if (isNaN(o) || isNaN(n) || o === n) return <Minus className="h-3 w-3" style={{ color: "var(--text-muted)" }} />;
  const up = n > o;
  return up
    ? <TrendingUp className="h-3.5 w-3.5" style={{ color: "var(--success-text)" }} />
    : <TrendingDown className="h-3.5 w-3.5" style={{ color: "var(--danger-text)" }} />;
}

function PriceCell({ field, row, policy, wizard }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const existing = row.__existing;
  const sysVal = existing?.[field] ?? "";
  const override = wizard.rowPriceOverrides?.[row.__rowNumber]?.[field];
  const fileVal = override !== undefined ? override : (row[field] ?? "");
  const effectiveNew = policy === "skip" ? sysVal : fileVal;
  const changed = policy !== "skip" && String(fileVal).trim() && String(fileVal) !== String(sysVal);

  function startEdit() {
    setDraft(String(fileVal ?? ""));
    setEditing(true);
  }

  function commitEdit() {
    const num = Number(draft);
    if (!isNaN(num) && draft.trim() !== "") {
      wizard.setRowPriceOverrides((prev) => ({
        ...prev,
        [row.__rowNumber]: { ...(prev[row.__rowNumber] || {}), [field]: num },
      }));
    }
    setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function clearOverride() {
    wizard.setRowPriceOverrides((prev) => {
      const next = { ...prev };
      if (next[row.__rowNumber]) {
        const inner = { ...next[row.__rowNumber] };
        delete inner[field];
        if (Object.keys(inner).length) next[row.__rowNumber] = inner;
        else delete next[row.__rowNumber];
      }
      return next;
    });
  }

  if (policy === "skip") {
    return (
      <div className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5" style={{ backgroundColor: "var(--bg-overlay)" }}>
        <span className="text-xs font-bold tabular-nums" style={{ color: "var(--text-muted)" }}>{fmt(sysVal)}</span>
        <SkipForward className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
          className="w-24 rounded-lg border px-2 py-1 text-xs font-bold text-center outline-none"
          style={{ borderColor: "var(--primary)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
        />
        <button type="button" onClick={commitEdit} className="rounded-lg p-1 transition hover:opacity-70" style={{ color: "var(--success-text)" }}>
          <CheckCircle2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={cancelEdit} className="rounded-lg p-1 transition hover:opacity-70" style={{ color: "var(--text-muted)" }}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="group flex items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 transition"
      style={{ backgroundColor: changed ? "var(--warning-bg)" : "var(--bg-overlay)", borderColor: changed ? "var(--warning-border)" : "transparent", border: "1px solid transparent" }}
    >
      <div className="flex items-center gap-1 text-[11px] font-bold tabular-nums" dir="ltr">
        <span style={{ color: "var(--text-muted)" }}>{fmt(sysVal)}</span>
        {changed && (
          <>
            <PriceDelta oldVal={sysVal} newVal={effectiveNew} />
            <span style={{ color: "var(--text-primary)" }}>{fmt(effectiveNew)}</span>
          </>
        )}
        {!changed && <span style={{ color: "var(--text-muted)" }}>—</span>}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
        {override !== undefined && (
          <button type="button" onClick={clearOverride} title="إلغاء التعديل اليدوي" className="rounded p-0.5 transition hover:opacity-70" style={{ color: "var(--warning-text)" }}>
            <X className="h-3 w-3" />
          </button>
        )}
        <button type="button" onClick={startEdit} title="تعديل يدوي" className="rounded p-0.5 transition hover:opacity-70" style={{ color: "var(--text-secondary)" }}>
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function BulkPanel({ field, policy, count, onUpdate, onSkip }) {
  const meta = PRICE_META[field];
  const isUpdate = policy === "update";
  const isSkip = policy === "skip";

  return (
    <div
      className="rounded-2xl border p-4 shadow-sm transition-all duration-200"
      style={{
        borderColor: isUpdate ? "var(--success-border)" : isSkip ? "var(--border-normal)" : "var(--border-subtle)",
        backgroundColor: isUpdate ? "var(--success-bg)" : "var(--bg-surface)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <DollarSign className="mt-0.5 h-4 w-4 shrink-0" style={{ color: isUpdate ? "var(--success-text)" : "var(--text-muted)" }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{meta.label}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-black"
                style={{ backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}
              >
                {count} منتج
              </span>
              {isUpdate && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
                  سيتحدث
                </span>
              )}
              {isSkip && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ backgroundColor: "var(--bg-overlay)", color: "var(--text-muted)" }}>
                  متجاهل
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-relaxed" style={{ color: "var(--text-secondary)" }}>{meta.description}</p>
            <p className="mt-0.5 text-[10px] font-bold" style={{ color: isUpdate ? "var(--success-text)" : "var(--text-muted)" }}>
              {isUpdate ? meta.updateDesc : meta.skipDesc}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onUpdate}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition-all duration-200 active:scale-[0.97]"
            style={{
              backgroundColor: isUpdate ? "var(--success-text)" : "var(--bg-overlay)",
              color: isUpdate ? "white" : "var(--text-secondary)",
              border: `1px solid ${isUpdate ? "var(--success-border)" : "var(--border-normal)"}`,
            }}
          >
            {isUpdate && <CheckCircle2 className="h-3.5 w-3.5" />}
            تحديث
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition-all duration-200 active:scale-[0.97]"
            style={{
              border: `1px solid ${isSkip ? "var(--border-strong)" : "var(--border-normal)"}`,
            }}
          >
            {isSkip && <SkipForward className="h-3.5 w-3.5" />}
            تجاهل
          </button>
        </div>
      </div>
    </div>
  );
}

function UnmappedBulkPanel({ field, policy, onSkip, onZero }) {
  const meta = PRICE_META[field];
  const isSkip = policy === "skip";
  const isZero = policy === "zero";

  return (
    <div
      className="rounded-2xl border p-4 shadow-sm transition-all duration-200"
      style={{
        borderColor: isZero ? "var(--danger-border)" : "var(--border-subtle)",
        backgroundColor: isZero ? "var(--danger-bg)" : "var(--bg-surface)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: isZero ? "var(--danger-text)" : "var(--text-muted)" }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{meta.label} (غير متوفر في الملف)</span>
              {isSkip && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ backgroundColor: "var(--bg-overlay)", color: "var(--text-muted)" }}>
                  سيتم الحفاظ على السعر الحالي
                </span>
              )}
              {isZero && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger-text)" }}>
                  سيتم تصفير السعر (0)
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              لم يتم ربط أي عمود من الملف بـ {meta.label}.
            </p>
            <p className="mt-0.5 text-[10px] font-bold" style={{ color: isZero ? "var(--danger-text)" : "var(--text-muted)" }}>
              {isZero ? "تحذير: سيتم مسح قيمة السعر وتعيينها كـ 0 لجميع المنتجات التي سيتم تحديثها." : "سيبقى السعر الحالي المخزن في النظام دون تغيير."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition-all duration-200 active:scale-[0.97]"
            style={{
              backgroundColor: isSkip ? "var(--text-primary)" : "var(--bg-overlay)",
              color: isSkip ? "var(--bg-surface)" : "var(--text-secondary)",
              border: `1px solid ${isSkip ? "var(--border-strong)" : "var(--border-normal)"}`,
            }}
          >
            {isSkip && <CheckCircle2 className="h-3.5 w-3.5" />}
            إبقاء السعر الحالي
          </button>
          <button
            type="button"
            onClick={onZero}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition-all duration-200 active:scale-[0.97]"
            style={{
              backgroundColor: isZero ? "var(--danger-text)" : "var(--bg-overlay)",
              color: isZero ? "white" : "var(--text-secondary)",
              border: `1px solid ${isZero ? "var(--danger-border)" : "var(--border-normal)"}`,
            }}
          >
            {isZero && <CheckCircle2 className="h-3.5 w-3.5" />}
            جعله 0
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StepPrices({ wizard }) {
  const [page, setPage] = useState(1);
  const [filterField, setFilterField] = useState("all");

  const { pricedRows, changedPriceFields, affectedCountByField, pricePolicies, setPricePolicies } = wizard;

  const activeFields = useMemo(
    () => ["sale_price", "purchase_price", "wholesale_price"].filter((f) => changedPriceFields.has(f)),
    [changedPriceFields]
  );

  // Narrow the comparison table to rows that changed for one price type.
  const fieldChanged = (row, field) => {
    const ex = row.__existing;
    if (!ex) return false;
    const fileVal = String(row[field] ?? "").trim();
    return fileVal && fileVal !== String(ex[field] ?? "").trim();
  };
  const filteredRows = useMemo(
    () => (filterField === "all" ? pricedRows : pricedRows.filter((r) => fieldChanged(r, filterField))),
    [pricedRows, filterField]
  );

  const unmappedFields = useMemo(() => {
    const mapped = new Set(Object.values(wizard.mapping || {}).filter(Boolean));
    return ["sale_price", "purchase_price", "wholesale_price"].filter((f) => !mapped.has(f));
  }, [wizard.mapping]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredRows, safePage]
  );

  const updateCount = activeFields.filter((f) => pricePolicies[f] === "update").length;
  const skipCount = activeFields.filter((f) => pricePolicies[f] === "skip").length;

  function setPolicy(field, value) {
    setPricePolicies((prev) => ({ ...prev, [field]: value }));
  }

  function applyAllUpdate() {
    setPricePolicies((prev) => {
      const next = { ...prev };
      activeFields.forEach((f) => { next[f] = "update"; });
      return next;
    });
  }

  function applyAllSkip() {
    setPricePolicies((prev) => {
      const next = { ...prev };
      activeFields.forEach((f) => { next[f] = "skip"; });
      return next;
    });
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header summary */}
      <div
        className="rounded-2xl border p-4 shadow-sm"
        style={{ borderColor: "var(--border-normal)", backgroundColor: "var(--bg-surface)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-5">
            <div>
              <div className="text-[10px] font-black" style={{ color: "var(--text-muted)" }}>منتجات بفروق أسعار</div>
              <div className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>{pricedRows.length}</div>
            </div>
            <div className="h-10 w-px" style={{ backgroundColor: "var(--border-subtle)" }} />
            <div>
              <div className="text-[10px] font-black" style={{ color: "var(--text-muted)" }}>أنواع الأسعار المتأثرة</div>
              <div className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>{activeFields.length}</div>
            </div>
            <div className="h-10 w-px" style={{ backgroundColor: "var(--border-subtle)" }} />
            <div>
              <div className="text-[10px] font-black" style={{ color: "var(--success-text)" }}>ستتحدث</div>
              <div className="text-2xl font-black" style={{ color: "var(--success-text)" }}>{updateCount}</div>
            </div>
            <div>
              <div className="text-[10px] font-black" style={{ color: "var(--text-muted)" }}>ستُتجاهل</div>
              <div className="text-2xl font-black" style={{ color: "var(--text-muted)" }}>{skipCount}</div>
            </div>
          </div>

          {activeFields.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={applyAllUpdate}
                className="rounded-xl px-3.5 py-2 text-xs font-black transition active:scale-[0.97]"
                style={{ backgroundColor: "var(--success-bg)", color: "var(--success-text)", border: "1px solid var(--success-border)" }}
              >
                تحديث الكل
              </button>
              <button
                type="button"
                onClick={applyAllSkip}
                className="rounded-xl px-3.5 py-2 text-xs font-black transition active:scale-[0.97]"
                style={{ backgroundColor: "var(--bg-overlay)", color: "var(--text-secondary)", border: "1px solid var(--border-normal)" }}
              >
                تجاهل الكل
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk panels — one per changed price field only */}
      <div className="space-y-3">
        {activeFields.map((field) => (
          <BulkPanel
            key={field}
            field={field}
            policy={pricePolicies[field]}
            count={affectedCountByField[field] || 0}
            onUpdate={() => setPolicy(field, "update")}
            onSkip={() => setPolicy(field, "skip")}
          />
        ))}
      </div>

      {/* Unmapped price fields warning panels */}
      {unmappedFields.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] font-black text-text-muted mt-2" style={{ color: "var(--text-muted)" }}>أسعار غير متوفرة في الملف (خيارات ذكية)</div>
          {unmappedFields.map((field) => (
            <UnmappedBulkPanel
              key={field}
              field={field}
              policy={pricePolicies[field] || "skip"}
              onSkip={() => setPolicy(field, "skip")}
              onZero={() => setPolicy(field, "zero")}
            />
          ))}
        </div>
      )}

      {/* Product table */}
      <div
        className="rounded-2xl border shadow-sm overflow-hidden"
        style={{ borderColor: "var(--border-normal)", backgroundColor: "var(--bg-surface)" }}
      >
        <div className="px-4.5 py-3 border-b" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-overlay)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
              مقارنة الأسعار ({filteredRows.length} منتج)
            </span>
            <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
              القديم ← الجديد · انقر الخلية لتعديل يدوي
            </span>
          </div>
          {activeFields.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black" style={{ color: "var(--text-muted)" }}>تصفية حسب نوع السعر:</span>
              {[{ key: "all", label: "الكل", count: pricedRows.length }, ...activeFields.map((f) => ({ key: f, label: PRICE_META[f].label, count: affectedCountByField[f] || 0 }))].map((tab) => {
                const active = filterField === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => { setFilterField(tab.key); setPage(1); }}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black transition active:scale-[0.97]"
                    style={{
                      backgroundColor: active ? "var(--text-primary)" : "var(--bg-surface)",
                      color: active ? "var(--bg-surface)" : "var(--text-secondary)",
                      border: `1px solid ${active ? "var(--border-strong)" : "var(--border-normal)"}`,
                    }}
                  >
                    {tab.label}
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-black tabular-nums" style={{ backgroundColor: active ? "rgba(255,255,255,0.15)" : "var(--bg-overlay)", color: active ? "inherit" : "var(--text-muted)" }}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-overlay)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th className="px-4 py-3 text-right text-[11px] font-black" style={{ color: "var(--text-muted)" }}>المنتج</th>
                {activeFields.map((field) => (
                  <th key={field} className="px-3 py-3 text-center text-[11px] font-black min-w-[160px]" style={{ color: "var(--text-muted)" }}>
                    <div className="flex items-center justify-center gap-1.5">
                      {PRICE_META[field].label}
                      {pricePolicies[field] === "skip" && (
                        <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black" style={{ backgroundColor: "var(--bg-overlay)", color: "var(--text-muted)" }}>
                          متجاهل
                        </span>
                      )}
                      {pricePolicies[field] === "update" && (
                        <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black" style={{ backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
                          يتحدث
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, i) => (
                <tr
                  key={row.__rowNumber}
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    backgroundColor: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-overlay)",
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="font-bold" style={{ color: "var(--text-primary)" }}>{row.name || "—"}</div>
                    <div className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{row.code}</div>
                  </td>
                  {activeFields.map((field) => (
                    <td key={field} className="px-3 py-2">
                      <PriceCell
                        field={field}
                        row={row}
                        policy={pricePolicies[field]}
                        wizard={wizard}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4.5 py-3 border-t"
            style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-overlay)" }}
          >
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border px-4 py-2 text-xs font-black transition disabled:opacity-30 disabled:pointer-events-none"
              style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)", backgroundColor: "var(--bg-surface)" }}
            >
              السابق
            </button>
            <span className="text-xs font-bold tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl border px-4 py-2 text-xs font-black transition disabled:opacity-30 disabled:pointer-events-none"
              style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)", backgroundColor: "var(--bg-surface)" }}
            >
              التالي
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
