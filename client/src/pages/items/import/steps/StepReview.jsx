import React, { useState, useMemo, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, ChevronLeft, ChevronRight, Database, Loader2, FileText, Package, RefreshCw, Warehouse, SkipForward, ArrowLeftRight } from "lucide-react";

const ACTION_META = {
  insert: "إضافة جديدة",
  update: "تحديث",
  warehouse_stock: "مخزون فقط",
  skip: "تخطي",
};

const ACTION_STYLE = {
  insert: { bg: "var(--success-bg)", text: "var(--success-text)", border: "var(--success-border)" },
  update: { bg: "var(--info-bg)", text: "var(--info-text)", border: "var(--info-border)" },
  warehouse_stock: { bg: "var(--warning-bg)", text: "var(--warning-text)", border: "var(--warning-border)" },
  skip: { bg: "transparent", text: "var(--text-muted)", border: "var(--border-subtle)" },
  update_prices: { bg: "var(--info-bg)", text: "var(--info-text)", border: "var(--info-border)" },
};

const ACTION_ICON = {
  insert: Package,
  update: RefreshCw,
  warehouse_stock: Warehouse,
  skip: SkipForward,
  update_prices: ArrowLeftRight,
};

const FIX_STEP_LABELS = {
  columns: "ربط الأعمدة",
  warehouses: "المخازن",
  units: "الوحدات",
  categories: "تصنيفات الأكواد",
  "sku-conflicts": "تضارب الأكواد",
  duplicates: "تكرار المخزون",
  existing: "المنتجات الموجودة",
  review: "المراجعة النهائية",
};

export default function StepReview({ wizard, goToStepId }) {
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const rowActions = useMemo(() => {
    const map = {};
    (wizard.analyzedRows || []).forEach((row) => {
      map[row.__rowNumber] = wizard.rowAction(row);
    });
    return map;
  }, [wizard.analyzedRows, wizard.rowAction]);

  const counts = useMemo(() => {
    const c = { insert: 0, update: 0, warehouse_stock: 0, skip: 0 };
    Object.values(rowActions).forEach((action) => {
      if (c[action] !== undefined) c[action]++;
    });
    return c;
  }, [rowActions]);

  const hasPriceUpdate = (row) => {
    const action = rowActions[row.__rowNumber];
    const isExisting = !!row.__existing;
    // A row qualifies as a "price update" if:
    // - action is "update" (will update prices as part of a full update)
    // - OR action is "skip" but the product exists and user chose updateExistingPrices
    const qualifies = action === "update" || (action === "skip" && isExisting && wizard.updateExistingPrices);
    if (!qualifies) return false;
    const existing = row.__existing;
    if (!existing) return false;
    const effectiveRow = wizard.applyPricePoliciesAndOverrides(row);
    return ["sale_price", "purchase_price", "wholesale_price"].some(field => {
      const incoming = String(effectiveRow[field] ?? "").trim();
      if (!incoming && effectiveRow[field] !== 0) return false;
      return incoming !== String(existing[field] ?? "").trim();
    });
  };

  const filteredRows = useMemo(() => {
    return (wizard.analyzedRows || []).filter((row) => {
      if (actionFilter === "all") return true;
      if (actionFilter === "update_prices") return hasPriceUpdate(row);
      return rowActions[row.__rowNumber] === actionFilter;
    });
  }, [wizard.analyzedRows, rowActions, actionFilter, wizard]);

  const totalRows = wizard.analyzedRows?.length || 0;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalImport = counts.insert + counts.update + counts.warehouse_stock;

  useEffect(() => { setPage(1); }, [actionFilter]);

  const handleExecute = () => wizard.runImport({ dryRun: false });

  const matchLabels = { barcode: "الباركود", code: "الكود", name: "الاسم" };

  function decisionSteps(row) {
    const steps = [];
    const action = rowActions[row.__rowNumber];

    const wh = wizard.warehouseNameForRow(row);
    steps.push({ icon: "check", text: `المخزن: ${wh}` });

    if (row.unit_name) {
      steps.push({ icon: "check", text: `الوحدة: ${row.unit_name}` });
    }

    const catLabel = wizard.categoryLabelForRow(row);
    if (catLabel && catLabel !== "SKU غير صحيح") {
      steps.push({ icon: "check", text: `الفئة: ${catLabel}` });
    } else if (row.code) {
      steps.push({ icon: "warning", text: `SKU ${row.code} غير مرتبط بفئة` });
    }

    if (row.__skuConflictAction === "skip") {
      steps.push({ icon: "warning", text: "تم تخطي هذا الصف بسبب تضارب SKU" });
    } else if (row.__skuConflictAction === "new_code") {
      steps.push({ icon: "info", text: "تم تعيين كود SKU جديد لحل التضارب" });
    } else {
      steps.push({ icon: "check", text: "لا يوجد تضارب SKU" });
    }

    if (row.__combinedRows?.length > 1) {
      steps.push({ icon: "info", text: `دمج ${row.__combinedRows.length} صفوف مكررة — الكمية الإجمالية: ${Number(row.stock_quantity || 0).toLocaleString()}` });
    } else if (row.__warehouseDistribution?.length > 1) {
      steps.push({ icon: "info", text: `توزيع على ${row.__warehouseDistribution.length} مخازن` });
    } else {
      steps.push({ icon: "check", text: "لا يوجد تكرار داخل الملف" });
    }

    if (row.__existing) {
      steps.push({ icon: "warning", text: `موجود مسبقاً — مطابقة بـ ${matchLabels[row.__matchField] || row.__matchField}` });
    } else {
      steps.push({ icon: "check", text: "منتج جديد — لم يُسبق تسجيله" });
    }

    const actionLabels = {
      insert: "سيتم إنشاء صنف جديد في النظام",
      update: "سيتم تحديث بيانات الصنف الموجود",
      warehouse_stock: "سيتم استلام مخزون فقط — الأسعار والبيانات لن تتغير",
      skip: "لن يتأثر هذا الصنف في النظام",
    };
    steps.push({ icon: "action", text: actionLabels[action] || action });

    return steps;
  }

  function changeSummary(row) {
    const action = rowActions[row.__rowNumber];
    if (action !== "update" && action !== "warehouse_stock") return null;
    const existing = row.__existing;
    if (!existing) return null;

    const effectiveRow = action === "update" ? wizard.applyPricePoliciesAndOverrides(row) : row;

    const changes = [];
    if (action === "update") {
      [
        ["sale_price", "سعر البيع"],
        ["purchase_price", "سعر الشراء"],
        ["wholesale_price", "سعر الجملة"],
      ].forEach(([field, label]) => {
        const incoming = String(effectiveRow[field] ?? "").trim();
        if (!incoming && effectiveRow[field] !== 0) return;
        const current = String(existing[field] ?? "").trim();
        if (incoming !== current) {
          changes.push({ label, from: current || "—", to: incoming });
        }
      });
      
      if (action === "update" && wizard.overwriteBasicInfo) {
        [
          ["min_stock_qty", "حد الطلب"],
          ["name", "الاسم"],
          ["barcode", "الباركود"],
        ].forEach(([field, label]) => {
          const incoming = String(effectiveRow[field] ?? "").trim();
          if (!incoming && effectiveRow[field] !== 0) return;
          const current = String(existing[field] ?? "").trim();
          if (incoming !== current) {
            changes.push({ label, from: current || "—", to: incoming });
          }
        });
        if (row.unit_name && row.unit_name.toLowerCase().trim() !== (existing.unit_name || "").toLowerCase().trim()) {
          changes.push({ label: "الوحدة", from: existing.unit_name || "—", to: row.unit_name });
        }
      }
    }
    if (row.stock_quantity !== undefined && row.stock_quantity !== "") {
      const wh = wizard.warehouseNameForRow(row);
      changes.push({ label: `المخزون (${wh})`, from: String(wizard.currentStockForRow?.(row) ?? existing.stock_quantity ?? 0), to: String(Number(row.stock_quantity).toLocaleString()) });
    }
    return changes.length ? changes : null;
  }

  const FILTER_TABS = [
    { key: "all", label: "الكل" },
    { key: "insert", label: "إضافة" },
    { key: "update_prices", label: "تحديث أسعار" },
    { key: "update", label: "تحديث" },
    { key: "warehouse_stock", label: "مخزون" },
    { key: "skip", label: "تخطي" },
  ];

  const warningCount = (wizard.importStats?.warnings || 0);
  const stats = wizard.importStats || {};
  const priceUpdateCount = useMemo(
    () => (wizard.analyzedRows || []).filter(hasPriceUpdate).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wizard.analyzedRows, rowActions, wizard.updateExistingPrices, wizard]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3" dir="rtl">
        {[
          { key: "insert", count: counts.insert, label: "إضافة جديدة", subtitle: "صنف جديد سينشأ" },
          { key: "update_prices", count: priceUpdateCount, label: "تحديث أسعار", subtitle: "أسعار صنف موجود ستتغير" },
          { key: "update", count: counts.update, label: "تحديث", subtitle: "بيانات صنف موجود ستتغير" },
          { key: "warehouse_stock", count: counts.warehouse_stock, label: "مخزون فقط", subtitle: "استلام مخزون بدون تعديل بيانات" },
          { key: "skip", count: counts.skip, label: "تخطي", subtitle: "لن يتأثر في النظام" },
        ].map(({ key, count, label, subtitle }) => {
          const s = ACTION_STYLE[key] || { border: "var(--border-normal)", bg: "var(--bg-surface)", text: "var(--text-primary)" };
          const Icon = ACTION_ICON[key] || FileText;
          return (
            <div
              key={key}
              className="rounded-2xl border p-4.5 shadow-sm transition hover:shadow-md"
              style={{ borderColor: s.border, backgroundColor: s.bg }}
            >
              <div className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4" style={{ color: s.text }} />}
                <div className="text-[10px] font-black font-mono tracking-wider" style={{ color: s.text }}>
                  {label}
                </div>
              </div>
              <div className="mt-2 text-3xl font-black" style={{ color: s.text }}>{count}</div>
              <div className="mt-1 text-xs font-bold" style={{ color: "var(--text-secondary)" }}>{subtitle}</div>
            </div>
          );
        })}
      </div>

      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl border p-4.5 shadow-sm"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-overlay)" }}
      >
        {[
          { label: "إجمالي صفوف الملف", value: stats.totalRows || 0 },
          { label: "مطابقة في النظام", value: stats.exactExistingRows || 0 },
          { label: "مجموعات مكررة", value: stats.duplicateGroups || 0 },
          { label: "أخطاء", value: stats.errors || 0, color: "var(--danger-text)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <div className="text-[10px] font-black font-mono tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</div>
            <div className="mt-1 text-lg font-black" style={{ color: color || "var(--text-primary)" }}>{value}</div>
          </div>
        ))}
      </div>

      {wizard.hasBlockingIssues && (
        <div
          className="rounded-2xl border p-4.5 shadow-sm space-y-3"
          style={{ borderColor: "var(--danger-border)", backgroundColor: "var(--danger-bg)", color: "var(--danger-text)" }}
        >
          <div className="flex items-center gap-2 text-sm font-black">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{wizard.blockingIssues?.length || 0} خطأ محظور — أصلحها قبل الاستيراد</span>
          </div>
          {wizard.blockingIssuesByType?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(wizard.blockingIssuesByType || []).map((issue) => (
                <div
                  key={issue.stepId}
                  className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold shadow-sm"
                  style={{ borderColor: "var(--danger-border)", backgroundColor: "white", color: "var(--danger-text)" }}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black"
                    style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger-text)" }}
                  >
                    {issue.count}
                  </span>
                  <span>{FIX_STEP_LABELS[issue.stepId] || issue.sample || issue.field}</span>
                  {goToStepId && issue.stepId !== "review" && (
                    <button
                      type="button"
                      onClick={() => goToStepId(issue.stepId)}
                      className="rounded-lg px-2.5 py-1 text-[10px] font-black transition"
                      style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger-text)" }}
                    >
                      اذهب للإصلاح
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map(({ key, label }) => {
            const tabCount = key === "all" ? totalRows : key === "update_prices" ? (stats.priceUpdates || 0) : (counts[key] || 0);
            const active = actionFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActionFilter(key)}
                className="rounded-xl border px-3.5 py-2 text-xs font-black transition active:scale-95"
                style={{
                  borderColor: active ? "var(--border-strong)" : "var(--border-subtle)",
                  backgroundColor: active ? "var(--bg-overlay)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                {label} ({tabCount})
              </button>
            );
          })}
        </div>
      </div>

      {totalPages > 1 && (
        <div
          className="flex items-center justify-between gap-3 rounded-2xl border px-4.5 py-3"
          style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-overlay)" }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-black transition active:scale-95 disabled:opacity-30"
            style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)" }}
          >
            <ChevronRight className="h-4 w-4" />
            السابق
          </button>
          <span className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
            الصفحة {page} من {totalPages} ({filteredRows.length} صف)
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-black transition active:scale-95 disabled:opacity-30"
            style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)" }}
          >
            التالي
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="space-y-3">
        {paginatedRows.length === 0 ? (
          <div className="rounded-2xl border p-10 text-center" style={{ borderColor: "var(--border-subtle)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
              {actionFilter === "all" ? "لا توجد صفوف للاستيراد" : "لا توجد صفوف مطابقة لهذا الإجراء"}
            </p>
          </div>
        ) : (
          paginatedRows.map((row) => {
            const action = rowActions[row.__rowNumber];
            const s = ACTION_STYLE[action];
            const steps = decisionSteps(row);
            const changes = changeSummary(row);
            const rowIssues = wizard.issuesForRow(row.__rowNumber);

            return (
              <div
                key={row.__rowNumber}
                className="rounded-2xl border shadow-sm overflow-hidden transition hover:shadow-md"
                style={{ borderColor: s.border, backgroundColor: "var(--bg-elevated, white)" }}
              >
                <div className="p-4.5 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black"
                        style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}
                      >
                        {row.__rowNumber}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-black" style={{ color: "var(--text-primary)" }}>
                            {row.name || "بدون اسم"}
                          </span>
                          <span
                            className="shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-black"
                            style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}
                          >
                            {ACTION_META[action] || action}
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                          {row.code || "-"}
                          {row.barcode ? ` | ${row.barcode}` : ""}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {steps.map((step, i) => {
                      const iconColor = step.icon === "check" ? "var(--success-text)"
                        : step.icon === "warning" ? "var(--warning-text)"
                        : step.icon === "info" ? "var(--info-text)"
                        : "var(--text-secondary)";
                      const Icon = step.icon === "check" ? CheckCircle2
                        : step.icon === "warning" ? AlertTriangle
                        : step.icon === "info" ? Info
                        : ChevronLeft;
                      return (
                        <div key={i} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                          {step.icon === "action" ? (
                            <ChevronLeft className="h-3.5 w-3.5 shrink-0" style={{ color: iconColor }} />
                          ) : (
                            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: iconColor }} />
                          )}
                          <span>{step.text}</span>
                        </div>
                      );
                    })}
                  </div>

                  {changes && (
                    <div
                      className="rounded-xl border p-3 space-y-1.5"
                      style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-overlay)" }}
                    >
                      <div className="text-[10px] font-black font-mono tracking-wider" style={{ color: "var(--text-muted)" }}>
                        التغييرات المتوقعة
                      </div>
                      {changes.map((ch, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                          <ArrowRightIcon className="h-3 w-3 shrink-0" style={{ color: "var(--info-text)" }} />
                          <span className="shrink-0 font-black" style={{ color: "var(--text-primary)" }}>{ch.label}:</span>
                          <span style={{ color: "var(--text-muted)" }}>{ch.from}</span>
                          <ArrowRightIcon className="h-3 w-3 shrink-0" style={{ color: "var(--info-text)" }} />
                          <span style={{ color: "var(--success-text)" }}>{ch.to}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {rowIssues?.length > 0 && (
                    <div className="flex items-start gap-2 text-xs font-semibold leading-relaxed">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--warning-text)" }} />
                      <span style={{ color: "var(--warning-text)" }}>
                        {rowIssues.length} تحذير: {rowIssues[0]?.message || ""}
                        {rowIssues.length > 1 && ` (+${rowIssues.length - 1})`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && filteredRows.length > 0 && (
        <div
          className="flex items-center justify-between gap-3 rounded-2xl border px-4.5 py-3"
          style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-overlay)" }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-black transition active:scale-95 disabled:opacity-30"
            style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)" }}
          >
            <ChevronRight className="h-4 w-4" />
            السابق
          </button>
          <span className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
            الصفحة {page} من {totalPages} ({filteredRows.length} صف)
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-black transition active:scale-95 disabled:opacity-30"
            style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)" }}
          >
            التالي
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      <div
        className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-6 py-4.5 shadow-elevated backdrop-blur-md transition-all duration-300"
        style={{ borderColor: "var(--border-normal)", backgroundColor: "color-mix(in srgb, var(--bg-elevated, white) 90%, transparent)" }}
      >
        <div className="flex items-center gap-2">
          {wizard.loading && <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--primary)" }} />}
          <span className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
            {totalImport > 0
              ? `سيتم استيراد ${totalImport} صنف` +
                (counts.update > 0 ? ` (تحديث ${counts.update})` : "") +
                (counts.warehouse_stock > 0 ? ` (مخزون ${counts.warehouse_stock})` : "")
              : "لا توجد صفوف للاستيراد"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleExecute}
          disabled={wizard.loading || totalImport === 0 || wizard.hasBlockingIssues}
          className="inline-flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-sm font-black text-white shadow-md transition-all duration-200 active:scale-[0.98] disabled:opacity-40"
          style={{ backgroundImage: "var(--primary-gradient)", boxShadow: "var(--btn-top-highlight), 0 4px 14px var(--primary-glow)" }}
        >
          {wizard.loading ? (
            <>
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
              جاري التنفيذ...
            </>
          ) : (
            <>
              <Database className="h-4.5 w-4.5" />
              استيراد الآن
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ArrowRightIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
