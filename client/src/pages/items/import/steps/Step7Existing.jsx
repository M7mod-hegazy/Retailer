import React, { useMemo, useState } from "react";
import {
  CheckCircle2, Info, Package, Database, Eye, Search,
  ChevronLeft, ChevronRight, FileText,
  BarChart3, AlertTriangle, PlusCircle, ArrowLeftRight
} from "lucide-react";

const PAGE_SIZE = 10;

const ACTION_DETAILS = {
  update: {
    title: "تحديث بيانات الصنف",
    icon: BarChart3,
    color: "sky",
    lines: [
      "الاسم والباركود يُستبدلان بقيم الملف إذا وجدت.",
      "الأسعار تُتحكم بها في خطوة تحديث الأسعار المنفصلة.",
      "الوحدة تتغير إن وجدت واختلفت عن وحدة النظام.",
      "كمية المخزون الحالية في المخزن المختار تُستبدل بكمية الملف.",
      "حد الطلب والوصف يُحدّثان إن وجدا في الملف.",
      "الحقول الفارغة في الملف لا تؤثر على القيم الموجودة.",
    ],
    result: (existing, newProducts) => ({ inserted: newProducts, updated: existing, skipped: 0 }),
  },
  warehouse_stock: {
    title: "استلام مخزون فقط",
    icon: Package,
    color: "emerald",
    lines: [
      "جميع بيانات المنتج الأساسية تبقى كما هي دون أي تغيير.",
      "فقط كمية المخزون تتغير في المخزن المختار.",
      "الاسم، السعر، الباركود، الوحدة، الفئة لا تتأثر إطلاقا.",
      "مناسب عندما تكون بيانات المنتج صحيحة وتريد فقط ضبط المخزون.",
    ],
    result: (existing, newProducts) => ({ inserted: newProducts, updated: existing, skipped: 0 }),
  },
  skip: {
    title: "تخطي المكرر فقط",
    icon: Eye,
    color: "slate",
    lines: [
      "الأصناف المكررة تُتخطى بالكامل ولا يُكتب أي تغيير عليها.",
      "جميع الأصناف الجديدة في الملف تمر دون تأثر وتُستورد كالمعتاد.",
      "المنتج الموجود يبقى كما هو تماما بأي حال.",
      "الخيار الأكثر أمانا: تستورد الجديد وتترك القديم دون أي تغيير.",
    ],
    result: (existing, newProducts) => ({ inserted: newProducts, updated: 0, skipped: existing }),
  },
};

function numberText(value) {
  return Number(value ?? 0).toLocaleString("ar-EG");
}

function buildDiffGroups(existing, row, warehouseName) {
  if (!existing) return [];
  const v = (field) => existing[field];
  const diff = (field, formatter = (x) => x ?? "—") => {
    const current = v(field);
    const incoming = row[field];
    const changed = existing && String(current ?? "") !== String(incoming ?? "");
    return { current: formatter(current), incoming: formatter(incoming), changed };
  };
  const n = (field) => diff(field, (x) => numberText(x));

  return [
    {
      key: "stock", icon: Package, label: "المخزون",
      fields: [{ key: "stock_quantity", label: "الكمية", ...n("stock_quantity") }],
      extra: warehouseName,
    },
    {
      key: "info", icon: FileText, label: "المعلومات",
      fields: [
        { key: "name", label: "الاسم", ...diff("name") },
        { key: "barcode", label: "الباركود", ...diff("barcode") },
        { key: "unit_name", label: "الوحدة", ...diff("unit_name") },
        { key: "min_stock_qty", label: "حد الطلب", ...n("min_stock_qty") },
      ],
    },
  ];
}

function ExistingProductCard({ row, wizard }) {
  const existing = row.__existing;
  const action = wizard.rowAction(row);
  const warehouseName = wizard.warehouseNameForRow?.(row) || "المخزن المختار";
  const groups = useMemo(() => buildDiffGroups(existing, row, warehouseName), [existing, row, warehouseName]);
  const preview = wizard.changePreviewForRow(row);
  const changedCount = groups.reduce((sum, g) => sum + g.fields.filter((f) => f.changed).length, 0);

  const fileName = row.name || "";
  const dbName = existing?.name || "";
  const showNameDiff = fileName && dbName && fileName !== dbName;

  const actionMeta = {
    update: { label: "تحديث", border: "border-[var(--info-border)]", headerBg: "bg-[var(--info-bg)]", dot: "bg-[var(--info-text)]" },
    warehouse_stock: { label: "مخزون فقط", border: "border-[var(--success-border)]", headerBg: "bg-[var(--success-bg)]", dot: "bg-[var(--success-text)]" },
    skip: { label: "تخطي", border: "border-[var(--border-normal)]", headerBg: "bg-[var(--bg-overlay)]", dot: "text-[var(--text-muted)]" },
  };
  const meta = actionMeta[action] || actionMeta.update;

  return (
    <div className={`rounded-2xl border ${meta.border} bg-[var(--bg-surface)] shadow-sm overflow-hidden`}>
      <div className={`${meta.headerBg} px-4.5 py-3`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${meta.dot}`} />
            <div className="min-w-0 flex-1">
              <div className="text-base font-black text-[var(--text-primary)] leading-snug">{fileName || dbName || "—"}</div>
              {showNameDiff && (
                <div className="text-[10px] font-bold text-[var(--text-muted)] mt-0.5">
                  الاسم في النظام: {dbName}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
                <span>الكود: {row.code}</span>
                {row.barcode ? <span>باركود: {row.barcode}</span> : null}
                <span>صف {row.__rowNumber}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={action}
              onChange={(e) => wizard.setActions((prev) => ({ ...prev, [row.__rowNumber]: e.target.value }))}
              className="rounded-lg border border-[var(--border-normal)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] font-bold outline-none shadow-sm focus:border-[var(--primary)] min-w-[120px]"
            >
              <option value="update">تحديث (تمرير للخطوات التالية)</option>
              <option value="skip">تخطي</option>
              <option value="warehouse_stock">مخزون فقط</option>
            </select>
          </div>
        </div>
      </div>

      <div className="px-4.5 py-3.5 space-y-4">
        {action === "skip" ? (
          <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] p-4 text-center">
            <Eye className="h-6 w-6 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-xs font-bold text-[var(--text-secondary)]">لن يتغير هذا الصنف — سيُتخطى بالكامل</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">جميع البيانات الحالية في النظام تبقى كما هي</p>
            {changedCount > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-base)] px-3 py-1.5">
                <AlertTriangle className="h-3 w-3 text-[var(--text-muted)]" />
                <span className="text-[10px] font-bold text-[var(--text-secondary)]">{changedCount} فروق موجودة لكنها لن تُطبق</span>
              </div>
            )}
          </div>
        ) : (
          groups.map((group) => {
            const groupChanged = group.fields.filter((f) => f.changed);
            const groupUnchanged = group.fields.filter((f) => !f.changed);

            return (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-2">
                  <group.icon className={`h-4 w-4 ${group.key === "stock" ? "text-[var(--info-text)]" : group.key === "pricing" ? "text-[var(--success-text)]" : "text-[var(--text-accent)]"}`} />
                  <span className="text-[11px] font-black text-[var(--text-primary)]">{group.label}</span>
                  {group.key !== "stock" && action === "warehouse_stock" ? (
                    <span className="text-[9px] font-bold text-[var(--text-muted)]">لن تتغير</span>
                  ) : groupChanged.length > 0 ? (
                    <span className="rounded-md bg-[var(--warning-bg)] px-1.5 py-0.5 text-[9px] font-black text-[var(--warning-text)]">{groupChanged.length} تغيير</span>
                  ) : (
                    <span className="text-[9px] font-bold text-[var(--text-muted)]">✓ متطابق</span>
                  )}
                </div>

                {action === "warehouse_stock" && group.key !== "stock" ? (
                  <div className="rounded-lg bg-[var(--bg-overlay)] border border-dashed border-[var(--border-subtle)] px-3 py-2.5">
                    <p className="text-[10px] font-bold text-[var(--text-muted)] text-center">
                      جميع بيانات {group.label} في النظام تبقى كما هي — لن تتأثر
                    </p>
                    {groupChanged.length > 0 && (
                      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                        {groupChanged.map((f) => (
                          <span key={f.key} className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-0.5 text-[9px] font-semibold text-[var(--text-secondary)]">
                            {f.label}: {f.current} → {f.incoming}
                            <span className="text-[var(--warning-text)] text-[8px]">(لن يُطبق)</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : action === "update" && !wizard.overwriteBasicInfo && group.key === "info" ? (
                  <div className="rounded-lg bg-[var(--bg-overlay)] border border-dashed border-[var(--border-subtle)] px-3 py-2.5">
                    <p className="text-[10px] font-bold text-[var(--text-muted)] text-center">
                      معلومات الصنف الأساسية (الاسم، الباركود، إلخ) لن تتأثر (الخيار معطل)
                    </p>
                    {groupChanged.length > 0 && (
                      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                        {groupChanged.map((f) => (
                          <span key={f.key} className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-0.5 text-[9px] font-semibold text-[var(--text-secondary)]">
                            {f.label}: {f.current} → {f.incoming}
                            <span className="text-[var(--warning-text)] text-[8px]">(تجاهل)</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {groupChanged.map((f) => (
                      <div key={f.key} className="flex items-center justify-between rounded-lg bg-[var(--warning-bg)] px-3 py-1.5">
                        <span className="text-[10px] font-bold text-[var(--text-primary)]">{f.label}</span>
                        <span dir="ltr" className="inline-flex items-center gap-1.5 text-[11px] font-bold">
                          <span className="text-[var(--text-secondary)]">{f.current}</span>
                          <span className="text-[var(--warning-text)] text-[9px]">→</span>
                          <span className="text-[var(--text-primary)]">{f.incoming}</span>
                        </span>
                      </div>
                    ))}
                    {groupUnchanged.map((f) => (
                      <div key={f.key} className="flex items-center justify-between px-3 py-1">
                        <span className="text-[10px] font-bold text-[var(--text-muted)]">{f.label}</span>
                        <span dir="ltr" className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--text-muted)]">
                          <CheckCircle2 className="h-3 w-3" />
                          {f.current}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {group.key === "stock" && (
                  <div className="mt-1.5 text-[9px] font-bold text-[var(--text-muted)] px-1">
                    المخزن: {group.extra}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {action !== "skip" && changedCount > 0 && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-4.5 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-black text-[var(--text-secondary)] ml-1">⚡ {changedCount} تغيير{changedCount > 1 ? "ات" : ""}:</span>
            {preview.slice(0, 3).map((msg, i) => (
              <span key={i} className="rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-0.5 text-[9px] font-semibold text-[var(--text-secondary)] shadow-sm whitespace-nowrap">
                {msg}
              </span>
            ))}
            {preview.length > 3 && (
              <span className="rounded-md bg-[var(--bg-overlay)] px-2 py-0.5 text-[9px] font-black text-[var(--text-muted)]">
                +{preview.length - 3}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NewProductCard({ row, wizard }) {
  return (
    <div className="rounded-2xl border-2 border-[var(--success-border)] bg-[var(--bg-surface)] shadow-md overflow-hidden">
      <div className="bg-[var(--primary)] px-4.5 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--chip-on-primary)]">
            <PlusCircle className="h-5 w-5" style={{ color: "var(--on-feature)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-black leading-snug" style={{ color: "var(--on-feature)" }}>{row.name || "—"}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-bold mt-0.5" style={{ color: "var(--on-feature-muted)" }}>
              <span>الكود: {row.code}</span>
              {row.barcode ? <span>باركود: {row.barcode}</span> : null}
              {row.unit_name ? <span>وحدة: {row.unit_name}</span> : null}
              <span>صف {row.__rowNumber}</span>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--chip-on-primary)] px-3 py-1.5 text-[11px] font-black whitespace-nowrap" style={{ color: "var(--on-feature)" }}>
            <PlusCircle className="h-3.5 w-3.5" />
            جديد
          </span>
        </div>
      </div>

      <div className="px-4.5 py-3.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: "المخزون", value: numberText(row.stock_quantity ?? 0) },
            { label: "سعر البيع", value: numberText(row.sale_price ?? 0) },
            { label: "سعر الشراء", value: numberText(row.purchase_price ?? 0) },
            { label: "سعر الجملة", value: numberText(row.wholesale_price ?? 0) },
          ].map((f) => (
            <div key={f.label} className="rounded-lg bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-3 py-2 text-center shadow-sm">
              <div className="text-[9px] font-bold text-[var(--text-accent)]">{f.label}</div>
              <div className="text-sm font-black text-[var(--text-primary)] mt-0.5">{f.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-bold text-[var(--text-secondary)]">
          {row.barcode && <span className="rounded-md bg-[var(--bg-overlay)] px-2 py-1">باركود: {row.barcode}</span>}
          {row.unit_name && <span className="rounded-md bg-[var(--bg-overlay)] px-2 py-1">الوحدة: {row.unit_name}</span>}
          {row.min_stock_qty !== undefined && row.min_stock_qty !== "" && (
            <span className="rounded-md bg-[var(--bg-overlay)] px-2 py-1">حد الطلب: {numberText(row.min_stock_qty)}</span>
          )}
          <span className="rounded-md bg-[var(--bg-overlay)] px-2 py-1">المخزن: {wizard.warehouseNameForRow?.(row) || "المخزن المختار"}</span>
        </div>
      </div>

      <div className="border-t border-[var(--success-border)] bg-[var(--success-bg)] px-4.5 py-2.5">
        <div className="flex items-center gap-2 text-[11px] font-black text-[var(--success-text)]">
          <PlusCircle className="h-4 w-4" />
          سيُضاف كمنتج جديد في النظام بجميع البيانات أعلاه
        </div>
      </div>
    </div>
  );
}

export default function Step7Existing({ wizard }) {
  const existingCount = wizard.exactExistingRows.length;
  const totalImport = wizard.importStats?.importRows || wizard.workingRows?.length || 0;
  const newProductsCount = Math.max(0, totalImport - existingCount);

  const [selectedAction, setSelectedAction] = useState("update");
  const [viewFilter, setViewFilter] = useState("existing");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Count existing products whose file prices differ from the system — drives the
  // price-update banner. Independent of the updateExistingPrices toggle so the
  // banner can decide whether it's worth showing at all.
  const PRICE_FIELDS = ["sale_price", "purchase_price", "wholesale_price"];
  const priceChangeCount = useMemo(
    () =>
      wizard.exactExistingRows.filter((row) => {
        const ex = row.__existing;
        if (!ex) return false;
        return PRICE_FIELDS.some((f) => {
          const fileVal = String(row[f] ?? "").trim();
          return fileVal && fileVal !== String(ex[f] ?? "").trim();
        });
      }).length,
    [wizard.exactExistingRows]
  );

  const existingRowNumbers = useMemo(
    () => new Set(wizard.exactExistingRows.map((r) => r.__rowNumber)),
    [wizard.exactExistingRows]
  );
  const newRows = useMemo(
    () => (wizard.workingRows || []).filter((r) => !existingRowNumbers.has(r.__rowNumber)),
    [wizard.workingRows, existingRowNumbers]
  );

  const displayRows = useMemo(() => {
    if (viewFilter === "existing") return wizard.exactExistingRows;
    if (viewFilter === "new") return newRows;
    return [...wizard.exactExistingRows, ...newRows];
  }, [viewFilter, wizard.exactExistingRows, newRows]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return displayRows;
    const q = searchQuery.trim().toLowerCase();
    return displayRows.filter((r) => {
      const name = String(r.name || r.__existing?.name || "").toLowerCase();
      const code = String(r.code || "").toLowerCase();
      const barcode = String(r.barcode || "").toLowerCase();
      return name.includes(q) || code.includes(q) || barcode.includes(q);
    });
  }, [displayRows, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredRows, safePage]
  );

  const FILTER_TABS = [
    { key: "existing", label: "الموجودة", count: existingCount },
    { key: "new", label: "الجديدة", count: newProductsCount },
    { key: "all", label: "الكل", count: totalImport },
  ];

  const actionCounts = wizard.exactExistingRows.reduce(
    (counts, row) => {
      const a = wizard.rowAction(row);
      return { ...counts, [a]: (counts[a] || 0) + 1 };
    },
    { update: 0, warehouse_stock: 0, skip: 0 }
  );

  const bulkActions = [
    { action: "update", label: "تحديث الموجود", desc: "يحدّث بيانات المنتجات الموجودة (الاسم، الباركود، الوحدة، المخزون) ويمرّرها لمراجعة الأسعار. الأصناف الجديدة تُضاف.", icon: BarChart3, iconColor: "text-[var(--info-text)]", bg: "bg-[var(--info-bg)]", activeBg: "bg-[var(--primary-600)]", border: "border-[var(--info-border)]" },
    { action: "warehouse_stock", label: "مخزون فقط", desc: "لا يغيّر أي بيانات — فقط يضيف كمية الملف لمخزون المخزن المختار. الأصناف الجديدة تُضاف.", icon: Package, iconColor: "text-[var(--success-text)]", bg: "bg-[var(--success-bg)]", activeBg: "bg-[var(--primary-600)]", border: "border-[var(--success-border)]" },
    { action: "skip", label: "تخطي الموجود", desc: "يتجاهل المنتجات الموجودة تماماً دون أي تغيير. الأصناف الجديدة فقط هي التي تُضاف.", icon: Eye, iconColor: "text-[var(--text-muted)]", bg: "bg-[var(--bg-overlay)]", activeBg: "bg-[var(--text-primary)]", border: "border-[var(--border-normal)]" },
  ];

  function handleBulkAction(action) {
    setSelectedAction(action);
    wizard.applyExistingRowsAction(action);
  }

  const activeDetail = ACTION_DETAILS[selectedAction];
  const activeResult = activeDetail?.result(existingCount, newProductsCount);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--border-normal)] bg-[var(--bg-surface)] p-4.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-[var(--text-secondary)]" />
            <div>
              <div className="text-[10px] font-black text-[var(--text-muted)]">إجمالي الملف</div>
              <div className="text-xl font-black text-[var(--text-primary)] font-display">{numberText(totalImport)}</div>
            </div>
          </div>
          <div className="h-10 w-px bg-[var(--border-subtle)]" />
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-[var(--warning-text)]" />
            <div>
              <div className="text-[10px] font-black text-[var(--warning-text)]">موجود مسبقا</div>
              <div className="text-xl font-black text-[var(--text-primary)] font-display">{numberText(existingCount)}</div>
            </div>
          </div>
          <div className="h-10 w-px bg-[var(--border-subtle)]" />
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-[var(--success-text)]" />
            <div>
              <div className="text-[10px] font-black text-[var(--success-text)]">جديد سيُستورد</div>
              <div className="text-xl font-black text-[var(--text-primary)] font-display">{numberText(newProductsCount)}</div>
            </div>
          </div>
        </div>
      </div>

      {priceChangeCount > 0 && (
      <div className="rounded-2xl border border-[var(--border-normal)] bg-[var(--bg-surface)] p-5 shadow-sm mt-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-100)]">
            <ArrowLeftRight className="h-6 w-6 text-[var(--primary)]" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-black text-[var(--text-primary)]">
              هل ترغب بتحديث الأسعار للمنتجات الموجودة؟
              <span className="mr-2 inline-flex items-center rounded-lg bg-[var(--warning-bg)] px-2.5 py-0.5 text-xs font-black text-[var(--warning-text)] tabular-nums align-middle">
                {numberText(priceChangeCount)} منتج بفروق أسعار
              </span>
            </h3>
            <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)] leading-relaxed">
              إذا اخترت نعم، سيتم تمرير المنتجات الموجودة إلى خطوة "مراجعة الأسعار" القادمة لتحديد قواعد التحديث بدقة.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[var(--bg-overlay)] p-1 rounded-xl border border-[var(--border-subtle)] shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => wizard.setUpdateExistingPrices(true)}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${wizard.updateExistingPrices ? "bg-[var(--primary)] text-white shadow-md" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              نعم، تحديث الأسعار
            </button>
            <button
              type="button"
              onClick={() => wizard.setUpdateExistingPrices(false)}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${!wizard.updateExistingPrices ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-normal)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              لا، تجاهل الأسعار
            </button>
          </div>
        </div>
      </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-[var(--border-normal)] bg-[var(--bg-surface)] p-4.5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-[var(--text-secondary)] shrink-0" />
            <h4 className="text-xs font-black text-[var(--text-primary)]">{activeDetail.title}</h4>
          </div>
          <ul className="space-y-1.5">
            {activeDetail.lines.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-[10px] font-semibold text-[var(--text-secondary)] leading-relaxed">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
                {line}
              </li>
            ))}
          </ul>
          {activeResult && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--border-subtle)] pt-3">
              {activeResult.inserted > 0 && (
                <span className="rounded-lg bg-[var(--success-bg)] px-2.5 py-1 text-[10px] font-black text-[var(--success-text)] tabular-nums">
                  +{numberText(activeResult.inserted)} جديد
                </span>
              )}
              {activeResult.updated > 0 && (
                <span className="rounded-lg bg-[var(--info-bg)] px-2.5 py-1 text-[10px] font-black text-[var(--info-text)] tabular-nums">
                  ~{numberText(activeResult.updated)} تحديث
                </span>
              )}
              {activeResult.skipped > 0 && (
                <span className="rounded-lg bg-[var(--bg-overlay)] px-2.5 py-1 text-[10px] font-black text-[var(--text-muted)] tabular-nums">
                  —{numberText(activeResult.skipped)} تخطي
                </span>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border-normal)] bg-[var(--bg-overlay)] p-3 shadow-inner space-y-2">
          {bulkActions.map((item) => {
            const count = actionCounts[item.action];
            const isSelected = selectedAction === item.action;
            const allActive = count === existingCount && existingCount > 0;
            const itemResult = ACTION_DETAILS[item.action].result(existingCount, newProductsCount);
            return (
              <div key={item.action}>
                <button
                  type="button"
                  onClick={() => handleBulkAction(item.action)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs font-black transition-all duration-200 active:scale-[0.98] ${
                    allActive
                      ? `${item.activeBg} text-white shadow-md`
                      : isSelected
                      ? `border-2 ${item.border} bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm`
                      : `border border-[var(--border-normal)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-sm hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]`
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {allActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : <item.icon className={`h-3.5 w-3.5 ${isSelected ? item.iconColor : "text-[var(--text-muted)]"}`} />}
                    {item.label}
                  </span>
                  <span className={`rounded-lg px-2 py-0.5 text-[9px] font-black ${
                    allActive ? "bg-bg-surface/15 text-white" : "bg-[var(--bg-overlay)] text-[var(--text-muted)]"
                  }`}>
                    {count}
                  </span>
                </button>
                <p className="px-2 mt-1.5 text-[10px] font-semibold leading-relaxed text-[var(--text-secondary)]">
                  {item.desc}
                </p>
                <div className={`px-2 mt-1 flex gap-2 text-[9px] font-bold ${
                  isSelected || allActive ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
                }`}>
                  {itemResult.updated > 0 && <span>~{itemResult.updated} تحديث</span>}
                  {itemResult.skipped > 0 && <span>—{itemResult.skipped} تخطي</span>}
                  {itemResult.inserted > 0 && <span>+{itemResult.inserted} جديد</span>}
                </div>
              </div>
            );
          })}
          {wizard.lastAppliedFix && (
            <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--success-bg)] px-3 py-1.5 text-[10px] font-black text-[var(--success-text)] ring-1 ring-[var(--success-border)]">
              <CheckCircle2 className="h-3 w-3" />
              آخر تطبيق: {wizard.lastAppliedFix.label}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_TABS.map((tab) => {
            const active = viewFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setViewFilter(tab.key); setPage(1); }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-all duration-200 active:scale-[0.98] ${
                  active
                    ? "bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-md"
                    : "border border-[var(--border-normal)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-sm hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Eye className={`h-4 w-4 ${active ? "" : "text-[var(--text-muted)]"}`} />
                {tab.label}
                <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black tabular-nums ${
                  active ? "bg-bg-surface/15" : "bg-[var(--bg-overlay)] text-[var(--text-muted)]"
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="ابحث باسم أو كود أو باركود..."
              className="w-56 rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] py-2.5 pr-10 pl-4 text-sm font-bold text-[var(--text-primary)] outline-none shadow-sm transition-all focus:border-[var(--border-strong)] focus:ring-4 focus:ring-[var(--bg-overlay)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <span className="text-xs font-bold text-[var(--text-muted)] tabular-nums">
            {filteredRows.length}/{displayRows.length}
          </span>
        </div>
      </div>

      {paginatedRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-normal)] bg-[var(--bg-overlay)] p-8 text-center">
          <p className="text-sm font-bold text-[var(--text-muted)]">
            {searchQuery ? "لا توجد نتائج للبحث" : "لا توجد صفوف في هذا التصنيف"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedRows.map((row) =>
            existingRowNumbers.has(row.__rowNumber) ? (
              <ExistingProductCard key={row.__rowNumber} row={row} wizard={wizard} />
            ) : (
              <NewProductCard key={row.__rowNumber} row={row} wizard={wizard} />
            )
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-[var(--border-normal)] bg-[var(--bg-surface)] px-5 py-3 shadow-sm">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-black text-[var(--text-secondary)] shadow-sm transition hover:bg-[var(--bg-overlay)] disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="h-3.5 w-3.5" /> السابق
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const start = Math.max(1, safePage - 3);
              const pageNum = start + i;
              if (pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  className={`min-w-[32px] rounded-lg px-2 py-1.5 text-xs font-black transition ${
                    pageNum === safePage
                      ? "bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-sm"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-black text-[var(--text-secondary)] shadow-sm transition hover:bg-[var(--bg-overlay)] disabled:opacity-30 disabled:pointer-events-none"
          >
            التالي <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
