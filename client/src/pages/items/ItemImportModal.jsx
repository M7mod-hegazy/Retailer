import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUpDown, BarChart3, CheckCircle2, Columns3, Download, FileSpreadsheet, GripVertical, ListFilter, Lock, PanelRightClose, PanelRightOpen, Trash2, Unlock, Upload, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import Modal from "../../components/ui/Modal";
import {
  ITEM_FIELDS,
  analyzeRows,
  detectColumnHeaders,
  detectHeaderRow,
  downloadImportTemplate,
  mappingConfidence,
  parseExcelFile,
  parseMappedRows,
  normalizeKey,
  toApiPayload,
} from "../../utils/excelImportExport";

const FIELD_ORDER = [
  "code",
  "name",
  "barcode",
  "store_name",
  "warehouse_id",
  "storage_plan",
  "category_name",
  "unit_name",
  "stock_quantity",
  "purchase_price",
  "sale_price",
  "wholesale_price",
  "min_stock_qty",
  "tax_rate",
  "description",
  "is_active",
  "item_type",
];

const FIELD_META = {
  code: { label: "الكود", type: "text", minWidth: 128 },
  name: { label: "اسم الصنف", type: "text", minWidth: 260 },
  barcode: { label: "الباركود", type: "text", minWidth: 150 },
  store_name: { label: "المخزن", type: "text", minWidth: 150 },
  warehouse_id: { label: "مخزن النظام", type: "warehouse", minWidth: 170 },
  storage_plan: { label: "قرار المخزون", type: "storage_plan", minWidth: 300 },
  category_name: { label: "الفئة", type: "category", minWidth: 160 },
  unit_name: { label: "الوحدة", type: "unit", minWidth: 140 },
  stock_quantity: { label: "المخزون", type: "number", minWidth: 120 },
  purchase_price: { label: "سعر الشراء", type: "number", minWidth: 126 },
  sale_price: { label: "سعر البيع", type: "number", minWidth: 126 },
  wholesale_price: { label: "سعر الجملة", type: "number", minWidth: 126 },
  min_stock_qty: { label: "حد الطلب", type: "number", minWidth: 120 },
  tax_rate: { label: "الضريبة", type: "number", minWidth: 110 },
  description: { label: "الوصف", type: "text", minWidth: 220 },
  is_active: { label: "نشط", type: "boolean", minWidth: 100 },
  item_type: { label: "النوع", type: "type", minWidth: 120 },
};

const BULK_FIELDS = ["unit_name", "warehouse_id", "purchase_price", "sale_price", "wholesale_price", "min_stock_qty", "item_type"];

function hasOption(options, value, extraKeys = []) {
  const key = normalizeKey(value);
  if (!key) return true;
  return options.some((option) => [option.name, option.symbol, ...extraKeys.map((extra) => option[extra])].some((candidate) => normalizeKey(candidate) === key));
}

function findWarehouse(warehouses, row) {
  if (row.warehouse_id) {
    const id = Number(row.warehouse_id);
    const match = warehouses.find((warehouse) => Number(warehouse.id) === id);
    if (match) return match;
  }
  const name = normalizeKey(row.store_name || row.warehouse_name);
  if (!name) return null;
  return warehouses.find((warehouse) => normalizeKey(warehouse.name) === name || normalizeKey(warehouse.code) === name) || null;
}

function defaultWarehouse(warehouses) {
  return warehouses.find((warehouse) => Number(warehouse.is_default) === 1) || warehouses[0] || null;
}

function normalizeSkuDigitText(value) {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  return String(value || "").replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabicIndex = arabicDigits.indexOf(digit);
    if (arabicIndex >= 0) return String(arabicIndex);
    return String(persianDigits.indexOf(digit));
  });
}

function parseSkuCode(code) {
  const source = normalizeSkuDigitText(code).trim();
  const match = source.match(/^(\d+)\.(\d+)$/);
  if (!match) return null;
  return { prefix: match[1], sequence: Number(match[2]), code: source };
}

function categoryBySkuPrefix(categories, prefix) {
  return categories.find((category) => String(category.sku_prefix || "").trim() === String(prefix || "").trim()) || null;
}

function categoryForSku(categories, row) {
  const sku = parseSkuCode(row.code);
  if (!sku) return null;
  return categoryBySkuPrefix(categories, sku.prefix);
}

function resolvedWarehouseId(warehouses, row) {
  return row.warehouse_id || findWarehouse(warehouses, row)?.id || defaultWarehouse(warehouses)?.id || "";
}

function explicitWarehouseId(warehouses, row) {
  return row.warehouse_id || findWarehouse(warehouses, row)?.id || "";
}

function findExactExistingProduct(items, row) {
  const code = normalizeKey(row.code);
  const name = normalizeKey(row.name);
  if (!code || !name) return null;
  return items.find((item) => normalizeKey(item.code) === code && normalizeKey(item.name) === name) || null;
}

function validateRowsForApp(rows, mapping, units, categories, warehouses, options = {}) {
  const issues = [];
  if (!Object.values(mapping).includes("name")) {
    issues.push({ scope: "global", severity: "error", message: "يجب ربط عمود اسم الصنف قبل المتابعة." });
  }
  rows.forEach((row) => {
    if (!String(row.name || "").trim()) {
      issues.push({ rowNumber: row.__rowNumber, field: "name", severity: "error", message: "اسم الصنف مطلوب." });
    }
    const sku = parseSkuCode(row.code);
    if (!String(row.code || "").trim()) {
      issues.push({ rowNumber: row.__rowNumber, field: "code", severity: "error", message: "SKU مطلوب، ويجب أن يكون مثل 5.22." });
    } else if (!sku) {
      issues.push({ rowNumber: row.__rowNumber, field: "code", severity: "error", message: "SKU يجب أن يكون رقم الفئة ثم نقطة ثم رقم الصنف، مثال 5.22." });
    }
    if (false && sku && options.existingSkuCodes?.has(normalizeKey(sku.code))) {
      issues.push({ rowNumber: row.__rowNumber, field: "code", severity: "error", message: `SKU ${sku.code} موجود بالفعل في النظام. لا يمكن استيراد SKU مكرر.` });
    }
    const existingSkuItem = sku ? options.existingSkuByCode?.get(normalizeKey(sku.code)) : null;
    if (existingSkuItem && normalizeKey(existingSkuItem.name) !== normalizeKey(row.name)) {
      issues.push({ rowNumber: row.__rowNumber, field: "code", severity: "error", message: `SKU ${sku.code} مستخدم بالفعل لصنف آخر: ${existingSkuItem.name}.` });
    }
    if (String(row.unit_name || "").trim() && !hasOption(units, row.unit_name)) {
      issues.push({ rowNumber: row.__rowNumber, field: "unit_name", severity: "error", message: `الوحدة "${row.unit_name}" غير موجودة في النظام.` });
    }
    if (sku && !categoryBySkuPrefix(categories, sku.prefix)) {
      issues.push({ rowNumber: row.__rowNumber, field: "category_name", severity: "warning", message: `سيتم إنشاء فئة برقم ${sku.prefix} قبل الاستيراد.` });
    }
    if (!warehouses.length || !resolvedWarehouseId(warehouses, row)) {
      issues.push({ rowNumber: row.__rowNumber, field: "warehouse_id", severity: "error", message: "يجب ربط كل صنف بمخزن من النظام قبل الاستيراد." });
    }
    if (options.requireExplicitWarehouse?.has(row.__rowNumber) && !explicitWarehouseId(warehouses, row)) {
      issues.push({ rowNumber: row.__rowNumber, field: "warehouse_id", severity: "error", message: "هذا الصف مفكوك لتوزيع المخزون، لذلك يجب اختيار مخزن النظام يدويا." });
    }
    if (row.__duplicatePolicy === "warehouse" && Array.isArray(row.__warehouseDistribution)) {
      row.__warehouseDistribution.forEach((item) => {
        if (!explicitWarehouseId(warehouses, item)) {
          issues.push({
            rowNumber: row.__rowNumber,
            field: "storage_plan",
            severity: "error",
            message: `اختر مخزن النظام لكمية صف ${item.__rowNumber} داخل قرار المخزون.`,
          });
        }
      });
    }
  });
  return issues;
}

function duplicateKeyForRow(row) {
  return normalizeKey(row.code) || normalizeKey(row.barcode) || normalizeKey(row.name);
}

function duplicateGroupsForRows(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = duplicateKeyForRow(row);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return [...groups.values()].filter((group) => group.length > 1);
}

function combineDuplicateRows(rows) {
  const groups = new Map();
  const output = [];
  rows.forEach((row) => {
    const key = duplicateKeyForRow(row);
    if (!key || !groups.has(key)) {
      const next = { ...row };
      if (key) groups.set(key, next);
      output.push(next);
      return;
    }
    const target = groups.get(key);
    target.stock_quantity = Number(target.stock_quantity || 0) + Number(row.stock_quantity || 0);
    target.__combinedRows = [...(target.__combinedRows || [target.__rowNumber]), row.__rowNumber];
    if (row.store_name && target.store_name && row.store_name !== target.store_name) target.store_name = "عدة مخازن";
  });
  return output;
}

function policyForDuplicateKey(key, defaultPolicy, policyByKey) {
  return policyByKey[key] || defaultPolicy;
}

function applyDuplicatePolicies(rows, defaultPolicy, policyByKey) {
  const duplicateKeys = new Set(
    duplicateGroupsForRows(rows).map((group) => duplicateKeyForRow(group[0])),
  );
  const combined = new Map();
  const distributed = new Map();
  const output = [];
  rows.forEach((row) => {
    const key = duplicateKeyForRow(row);
    const policy = duplicateKeys.has(key) ? policyForDuplicateKey(key, defaultPolicy, policyByKey) : "keep";
    if (policy === "warehouse") {
      if (!distributed.has(key)) {
        const next = {
          ...row,
          __duplicatePolicy: "warehouse",
          __warehouseDistribution: [{ ...row }],
          stock_quantity: Number(row.stock_quantity || 0),
        };
        distributed.set(key, next);
        output.push(next);
        return;
      }
      const target = distributed.get(key);
      target.__warehouseDistribution = [...(target.__warehouseDistribution || []), { ...row }];
      target.stock_quantity = Number(target.stock_quantity || 0) + Number(row.stock_quantity || 0);
      target.__combinedRows = [...(target.__combinedRows || [target.__rowNumber]), row.__rowNumber];
      if (row.store_name && target.store_name && row.store_name !== target.store_name) target.store_name = "عدة مخازن";
      return;
    }
    if (policy !== "combine") {
      output.push({ ...row, __duplicatePolicy: policy });
      return;
    }
    if (!combined.has(key)) {
      const next = { ...row, __duplicatePolicy: "combine" };
      combined.set(key, next);
      output.push(next);
      return;
    }
    const target = combined.get(key);
    target.stock_quantity = Number(target.stock_quantity || 0) + Number(row.stock_quantity || 0);
    target.__combinedRows = [...(target.__combinedRows || [target.__rowNumber]), row.__rowNumber];
    if (row.store_name && target.store_name && row.store_name !== target.store_name) target.store_name = "عدة مخازن";
  });
  return output;
}

function StepTabs({ step, stats }) {
  const steps = [
    { id: 1, label: "رفع الملف", metric: stats.fileName ? "تم الاختيار" : "بانتظار ملف" },
    { id: 2, label: "ربط الأعمدة", metric: `${stats.mappedColumns || 0}/${stats.totalColumns || 0} أعمدة` },
    { id: 3, label: "مراجعة التكرارات", metric: `${stats.totalRows || 0} صف` },
    { id: 4, label: "النتيجة", metric: stats.finished ? "مكتمل" : "غير منفذ" },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {steps.map((item) => {
        const active = step === item.id;
        const done = step > item.id;
        return (
          <div
            key={item.id}
            className={`min-w-0 rounded-sm border px-3 py-2.5 transition ${
              active
                ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                : done
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase">STEP {item.id}</span>
              {done ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : null}
            </div>
            <div className="mt-1 truncate text-2sm font-black">{item.label}</div>
            <div className={`mt-1 truncate text-[11px] font-bold ${active ? "text-white/70" : done ? "text-emerald-700/70" : "text-slate-400"}`}>{item.metric}</div>
          </div>
        );
      })}
    </div>
  );
}

async function fileToBase64(file) {
  if (!file) return null;
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default function ItemImportModal({ open, onClose, items, categories, units, selectedCategoryId, onImported, embedded = false }) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [sourceFile, setSourceFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rawRows, setRawRows] = useState([]);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [mapping, setMapping] = useState({});
  const [actions, setActions] = useState({});
  const [rowOverrides, setRowOverrides] = useState({});
  const [databaseItems, setDatabaseItems] = useState(items || []);
  const [createdCategories, setCreatedCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, dir: "asc" });
  const [colWidths, setColWidths] = useState({});
  const [bulkField, setBulkField] = useState("unit_name");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkScope, setBulkScope] = useState("selected");
  const [quickUnitValue, setQuickUnitValue] = useState("");
  const [quickWarehouseValue, setQuickWarehouseValue] = useState("");
  const [quickStorageWarehouse, setQuickStorageWarehouse] = useState("");
  const [skuCategoryNames, setSkuCategoryNames] = useState({});
  const [lastAppliedFix, setLastAppliedFix] = useState(null);
  const [duplicateMode, setDuplicateMode] = useState("combine");
  const [duplicatePolicies, setDuplicatePolicies] = useState({});
  const [selectedRows, setSelectedRows] = useState(() => new Set());
  const [removedRows, setRemovedRows] = useState(() => new Set());
  const [issueTrayOpen, setIssueTrayOpen] = useState(false);
  const [issueTab, setIssueTab] = useState("errors");
  const [columnMappingOpen, setColumnMappingOpen] = useState(false);
  const [rowFilter, setRowFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(false);
  const [categorySyncing, setCategorySyncing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const resizeRef = useRef(null);

  const headers = rawRows[headerIndex] || [];
  const systemCategories = useMemo(() => {
    const seen = new Set();
    return [...(categories || []), ...createdCategories].filter((category) => {
      const key = String(category.id || category.sku_prefix || category.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categories, createdCategories]);
  const parsedRows = useMemo(() => parseMappedRows(rawRows, headerIndex, mapping), [headerIndex, mapping, rawRows]);
  const editableRows = useMemo(
    () => parsedRows
      .filter((row) => !removedRows.has(row.__rowNumber))
      .map((row) => ({ ...row, ...(rowOverrides[row.__rowNumber] || {}) })),
    [parsedRows, removedRows, rowOverrides],
  );
  const duplicateGroups = useMemo(() => duplicateGroupsForRows(editableRows), [editableRows]);
  const duplicateRowNumbers = useMemo(
    () => new Set(duplicateGroups.flatMap((group) => group.map((row) => row.__rowNumber))),
    [duplicateGroups],
  );
  const workingRows = useMemo(
    () => applyDuplicatePolicies(editableRows, duplicateMode, duplicatePolicies),
    [duplicateMode, duplicatePolicies, editableRows],
  );
  const warehouseRequiredRows = useMemo(
    () => new Set(),
    [],
  );
  const hasSourceStores = useMemo(
    () => editableRows.some((row) => String(row.store_name || "").trim()),
    [editableRows],
  );
  const validationIssues = useMemo(
    () => validateRowsForApp(workingRows, mapping, units, systemCategories, warehouses, {
      existingSkuByCode: new Map(databaseItems.map((item) => [normalizeKey(item.code), item]).filter(([code]) => code)),
      requireWarehouses: warehouseRequiredRows,
      requireExplicitWarehouse: warehouseRequiredRows,
    }),
    [databaseItems, mapping, systemCategories, units, warehouses, warehouseRequiredRows, workingRows],
  );
  const blockingIssues = useMemo(
    () => validationIssues.filter((issue) => issue.severity === "error"),
    [validationIssues],
  );
  const analyzedRows = useMemo(() => analyzeRows(workingRows, databaseItems), [databaseItems, workingRows]);
  const exactExistingRows = useMemo(
    () => workingRows.filter((row) => findExactExistingProduct(databaseItems, row)),
    [databaseItems, workingRows],
  );
  const orderedFields = useMemo(() => {
    const visibleMappedFields = Object.values(mapping).filter((field) => {
      if (!field) return false;
      if (field === "store_name" && !hasSourceStores) return false;
      return true;
    });
    const tableHelperFields = [
      ...(workingRows.length ? ["category_name"] : []),
      ...(workingRows.length ? ["warehouse_id"] : []),
      ...(duplicateGroups.length ? ["storage_plan"] : []),
    ];
    const mapped = [...new Set([
      ...visibleMappedFields,
      ...tableHelperFields,
      ...FIELD_ORDER.filter((field) => workingRows.some((row) => row[field] !== undefined && row[field] !== "")),
    ])];
    return FIELD_ORDER.filter((field) => mapped.includes(field)).concat(mapped.filter((field) => !FIELD_ORDER.includes(field)));
  }, [duplicateGroups.length, hasSourceStores, mapping, workingRows]);
  const sortedEditableRows = useMemo(() => {
    const rows = [...workingRows];
    if (!sortConfig.key) return rows;
    rows.sort((a, b) => {
      const av = a[sortConfig.key] ?? "";
      const bv = b[sortConfig.key] ?? "";
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "ar");
      return sortConfig.dir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [sortConfig, workingRows]);
  const counts = useMemo(() => analyzedRows.reduce((acc, row) => {
    acc[row.__status] = (acc[row.__status] || 0) + 1;
    return acc;
  }, {}), [analyzedRows]);
  const importStats = useMemo(() => {
    const mappedColumns = Object.values(mapping).filter(Boolean).length;
    const totalColumns = headers.filter((header) => String(header ?? "").trim()).length;
    return {
      fileName,
      mappedColumns,
      totalColumns,
      totalRows: parsedRows.length,
      uniqueProducts: new Set(editableRows.map(duplicateKeyForRow).filter(Boolean)).size,
      importRows: workingRows.length,
      duplicateGroups: duplicateGroups.length,
      storageSplitRows: editableRows.length - workingRows.length,
      exactExistingRows: exactExistingRows.length,
      readyRows: counts.ready || 0,
      existingRows: counts.existing || 0,
      warningRows: (counts.possible_duplicate || 0) + (counts.file_duplicate || 0),
      invalidRows: counts.invalid || 0,
      confidence: Math.round(mappingConfidence(headers, mapping) * 100),
      errors: blockingIssues.length,
      warnings: validationIssues.length - blockingIssues.length,
      finished: step === 4,
    };
  }, [blockingIssues.length, counts, duplicateGroups.length, editableRows, exactExistingRows.length, fileName, headers, mapping, parsedRows.length, step, validationIssues.length, workingRows.length]);

  const reset = () => {
    setStep(1);
    setFileName("");
    setSourceFile(null);
    setPreview(null);
    setRawRows([]);
    setHeaderIndex(0);
    setMapping({});
    setActions({});
    setRowOverrides({});
    setCreatedCategories([]);
    setSortConfig({ key: null, dir: "asc" });
    setColWidths({});
    setBulkField("unit_name");
    setBulkValue("");
    setBulkScope("selected");
    setQuickUnitValue("");
    setQuickWarehouseValue("");
    setQuickStorageWarehouse("");
    setSkuCategoryNames({});
    setLastAppliedFix(null);
    setDuplicateMode("combine");
    setDuplicatePolicies({});
    setSelectedRows(new Set());
    setRemovedRows(new Set());
    setIssueTrayOpen(false);
    setIssueTab("errors");
    setColumnMappingOpen(false);
    setRowFilter("all");
    setLoading(false);
    setReading(false);
    setCategorySyncing(false);
    setDragActive(false);
    setError("");
    setResult(null);
  };

  useEffect(() => {
    if (!open) return;
    setDatabaseItems(items || []);
    api.get("/api/items")
      .then((response) => {
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        if (rows.length) setDatabaseItems(rows);
      })
      .catch(() => {});
    api.get("/api/warehouses")
      .then((response) => {
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        setWarehouses(rows);
      })
      .catch(() => setWarehouses([]));
  }, [items, open]);

  useEffect(() => {
    if (!warehouses.length || !parsedRows.length) return;
    setRowOverrides((prev) => {
      let changed = false;
      const next = { ...prev };
      const fallbackWarehouse = defaultWarehouse(warehouses);
      parsedRows.forEach((row) => {
        const current = next[row.__rowNumber] || {};
        if (current.warehouse_id) return;
        const match = findWarehouse(warehouses, { ...row, ...current }) || fallbackWarehouse;
        if (!match) return;
        next[row.__rowNumber] = { ...current, warehouse_id: match.id };
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [parsedRows, warehouses]);

  useEffect(() => {
    if (step !== 2) return;
    if (blockingIssues.length > 0) {
      setIssueTrayOpen(true);
      setIssueTab("errors");
    }
  }, [blockingIssues.length, step]);

  const close = () => {
    reset();
    onClose?.();
  };

  const readFile = async (file) => {
    if (!file) return;
    setReading(true);
    setError("");
    try {
      const parsed = await parseExcelFile(file);
      if (parsed.rows.length < 2) {
        const message = "الملف لا يحتوي على بيانات كافية.";
        setError(message);
        toast.error(message);
        return;
      }
      const detected = detectHeaderRow(parsed.rows);
      const nextMapping = detectColumnHeaders(parsed.rows[detected.index] || []);
      const parsedDataRows = parseMappedRows(parsed.rows, detected.index, nextMapping);
      if (!Object.values(nextMapping).includes("name")) {
        setError("تمت قراءة الملف لكن لم يتم التعرف على عمود اسم الصنف. اربط العمود يدويا ثم تابع.");
      } else if (!parsedDataRows.length) {
        setError("تمت قراءة الملف لكن لم يتم العثور على صفوف منتجات بعد صف العناوين.");
      }
      setFileName(file.name);
      setSourceFile(file);
      setPreview(null);
      setRawRows(parsed.rows);
      setHeaderIndex(detected.index);
      setMapping(nextMapping);
      setRowOverrides({});
      setActions({});
      setDuplicatePolicies({});
      setSelectedRows(new Set());
      setRemovedRows(new Set());
      setIssueTrayOpen(true);
      setIssueTab(Object.values(nextMapping).includes("name") ? "errors" : "columns");
      setColumnMappingOpen(!Object.values(nextMapping).includes("name"));
      setRowFilter("all");
      setSortConfig({ key: null, dir: "asc" });
      setStep(2);
    } catch (readError) {
      const message = readError?.message || "تعذر قراءة الملف. استخدم xlsx أو xls أو csv.";
      setError(message);
      toast.error(message);
    } finally {
      setReading(false);
      setDragActive(false);
    }
  };

  const handleFile = async (event) => {
    await readFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await readFile(event.dataTransfer.files?.[0]);
  };

  const updateMapping = (columnIndex, field) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (!field) delete next[columnIndex];
      else {
        Object.keys(next).forEach((key) => {
          if (next[key] === field) delete next[key];
        });
        next[columnIndex] = field;
      }
      return next;
    });
  };

  const getColumnWidth = (field) => {
    if (colWidths[field]) return colWidths[field];
    const meta = FIELD_META[field] || { minWidth: 120 };
    const longest = Math.max(
      String(meta.label || field).length,
      ...workingRows.slice(0, 25).map((row) => String(row[field] ?? "").length),
    );
    return Math.min(Math.max(meta.minWidth || 120, longest * 9 + 52), field === "name" ? 360 : 240);
  };

  const startResize = (event, field) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = { field, startX: event.clientX, startWidth: getColumnWidth(field) };
    document.body.classList.add("cursor-col-resize", "select-none");
    const onMouseMove = (moveEvent) => {
      const current = resizeRef.current;
      if (!current) return;
      const diff = current.startX - moveEvent.clientX;
      setColWidths((prev) => ({ ...prev, [current.field]: Math.max(92, current.startWidth + diff) }));
    };
    const onMouseUp = () => {
      resizeRef.current = null;
      document.body.classList.remove("cursor-col-resize", "select-none");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const toggleSort = (field) => {
    setSortConfig((prev) => (prev.key === field ? { key: field, dir: prev.dir === "asc" ? "desc" : "asc" } : { key: field, dir: "asc" }));
  };

  const issuesFor = (rowNumber, field) => validationIssues.filter((issue) => issue.rowNumber === rowNumber && issue.field === field);
  const issuesForRow = (rowNumber) => validationIssues.filter((issue) => issue.rowNumber === rowNumber);

  const rowsNeedingBulkFix = (field) => {
    const issueRows = new Set(validationIssues.filter((issue) => issue.field === field && issue.severity === "error").map((issue) => issue.rowNumber));
    return workingRows.filter((row) => issueRows.has(row.__rowNumber));
  };

  const filteredRows = useMemo(() => {
    if (rowFilter === "errors") {
      const errorRows = new Set(validationIssues.filter((issue) => issue.severity === "error").map((issue) => issue.rowNumber));
      return sortedEditableRows.filter((row) => errorRows.has(row.__rowNumber));
    }
    if (rowFilter === "duplicates") return sortedEditableRows.filter((row) => duplicateRowNumbers.has(row.__rowNumber));
    if (rowFilter === "unmapped") {
      const issueRows = new Set(validationIssues.map((issue) => issue.rowNumber).filter(Boolean));
      return sortedEditableRows.filter((row) => issueRows.has(row.__rowNumber));
    }
    if (rowFilter === "ready") return analyzedRows.filter((row) => row.__status === "ready" && !issuesForRow(row.__rowNumber).some((issue) => issue.severity === "error"));
    return sortedEditableRows;
  }, [analyzedRows, duplicateRowNumbers, rowFilter, sortedEditableRows, validationIssues]);
  const visibleRows = filteredRows;
  const selectedRowsList = workingRows.filter((row) => selectedRows.has(row.__rowNumber));
  const unitErrorCount = validationIssues.filter((issue) => issue.severity === "error" && issue.field === "unit_name").length;
  const warehouseErrorCount = validationIssues.filter((issue) => issue.severity === "error" && issue.field === "warehouse_id").length;
  const selectedQuickUnit = quickUnitValue || units[0]?.name || "";
  const selectedQuickWarehouse = quickWarehouseValue || defaultWarehouse(warehouses)?.id || warehouses[0]?.id || "";
  const missingSkuCategories = useMemo(() => {
    const byPrefix = new Map();
    workingRows.forEach((row) => {
      const sku = parseSkuCode(row.code);
      if (!sku || categoryBySkuPrefix(systemCategories, sku.prefix)) return;
      if (!byPrefix.has(sku.prefix)) {
        byPrefix.set(sku.prefix, {
          prefix: sku.prefix,
          name: String(skuCategoryNames[sku.prefix] || row.category_name || "").trim() || `قسم SKU ${sku.prefix}`,
          rows: [],
        });
      }
      byPrefix.get(sku.prefix).rows.push(row.__rowNumber);
    });
    return [...byPrefix.values()];
  }, [skuCategoryNames, systemCategories, workingRows]);
  const decorateRowWithSkuCategory = (row, categoryList = systemCategories) => {
    const category = categoryForSku(categoryList, row);
    return {
      ...row,
      category_id: category?.id || row.category_id || null,
      category_name: category?.name || row.category_name || "",
    };
  };
  async function ensureSkuCategories() {
    if (!missingSkuCategories.length) return systemCategories;
    setCategorySyncing(true);
    try {
      const created = [];
      for (const entry of missingSkuCategories) {
        try {
          const response = await api.post("/api/categories", {
            name: entry.name,
            sku_prefix: entry.prefix,
          });
          if (response.data?.data) created.push(response.data.data);
        } catch (error) {
          const existing = error.response?.data?.data;
          if (existing?.id) created.push(existing);
          else throw error;
        }
      }
      if (created.length) {
        setCreatedCategories((prev) => {
          const byPrefix = new Map(prev.map((category) => [String(category.sku_prefix || ""), category]));
          created.forEach((category) => byPrefix.set(String(category.sku_prefix || ""), category));
          return [...byPrefix.values()];
        });
        toast.success(`تم إنشاء ${created.length} فئة من SKU`);
      }
      return [...systemCategories, ...created];
    } finally {
      setCategorySyncing(false);
    }
  }
  async function proceedToReview() {
    if (blockingIssues.length) {
      setIssueTrayOpen(true);
      setIssueTab("errors");
      return;
    }
    try {
      await ensureSkuCategories();
      setStep(3);
    } catch (error) {
      toast.error(error.response?.data?.message || "تعذر إنشاء فئات SKU الناقصة.");
      setIssueTrayOpen(true);
    }
  }
  const guideStep = useMemo(() => {
    if (!Object.values(mapping).includes("name")) {
      return {
        tone: "rose",
        title: "اربط عمود اسم الصنف أولا",
        body: "بدون اسم الصنف لا يستطيع النظام معرفة المنتج. افتح الأعمدة المرتبطة واختر العمود الصحيح.",
        action: "فتح الأعمدة",
        run: () => {
          setColumnMappingOpen(true);
          setIssueTrayOpen(true);
          setIssueTab("columns");
        },
      };
    }
    if (unitErrorCount) {
      return {
        tone: "rose",
        title: `حل ${unitErrorCount} خطأ وحدة`,
        body: "الملف يحتوي وحدة غير موجودة في النظام. اختر وحدة من النظام وطبقها على صفوف أخطاء الوحدة.",
        action: "حل كل أخطاء الوحدة",
        run: () => {
          setIssueTrayOpen(true);
          setIssueTab("bulk");
          setBulkField("unit_name");
          setBulkValue("");
          setBulkScope("invalid");
          setRowFilter("errors");
        },
      };
    }
    if (warehouseErrorCount) {
      return {
        tone: "rose",
        title: `حل ${warehouseErrorCount} خطأ مخزن`,
        body: "لا يتم قبول اسم مخزن من الملف إلا إذا اخترت مخزن النظام الصحيح. عالج كل مجموعة أو طبق مخزنا على الصفوف المحددة.",
        action: "حل أخطاء المخزن",
        run: () => {
          setIssueTrayOpen(true);
          setIssueTab("bulk");
          setBulkField("warehouse_id");
          setBulkScope("invalid");
          setRowFilter("errors");
        },
      };
    }
    if (missingSkuCategories.length) {
      return {
        tone: "sky",
        title: `${missingSkuCategories.length} فئة SKU غير موجودة`,
        body: "سيتم إنشاء الفئات الناقصة تلقائيا من رقم SKU قبل المراجعة. الفئة لا يتم اختيارها يدويا.",
        action: "إنشاء الفئات والمتابعة",
        run: () => proceedToReview(),
      };
    }
    if (duplicateGroups.length) {
      return {
        tone: "sky",
        title: `${duplicateGroups.length} منتجات لها أكثر من صف مخزون`,
        body: "سيتم دمج كميات هذه المنتجات تلقائيا. التوزيع التفصيلي يظهر داخل عمود قرار المخزون في الجدول، ويفتح فقط للمنتج الذي تختاره.",
        action: "",
        run: () => {},
      };
    }
    return {
      tone: "emerald",
      title: "الملف جاهز للمراجعة النهائية",
      body: "لا توجد أخطاء تمنع المتابعة. راجع الصفوف ثم اضغط متابعة.",
      action: "متابعة",
      run: () => proceedToReview(),
    };
  }, [duplicateGroups.length, mapping, missingSkuCategories.length, unitErrorCount, warehouseErrorCount]);
  const filterCounts = useMemo(() => {
    const errorRows = new Set(validationIssues.filter((issue) => issue.severity === "error").map((issue) => issue.rowNumber));
    const issueRows = new Set(validationIssues.map((issue) => issue.rowNumber).filter(Boolean));
    return {
      all: sortedEditableRows.length,
      errors: sortedEditableRows.filter((row) => errorRows.has(row.__rowNumber)).length,
      duplicates: sortedEditableRows.filter((row) => duplicateRowNumbers.has(row.__rowNumber)).length,
      unmapped: sortedEditableRows.filter((row) => issueRows.has(row.__rowNumber)).length,
      ready: analyzedRows.filter((row) => row.__status === "ready" && !errorRows.has(row.__rowNumber)).length,
    };
  }, [analyzedRows, duplicateRowNumbers, sortedEditableRows, validationIssues]);
  const toggleRowSelection = (rowNumber) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };
  const selectRows = (rows) => {
    setSelectedRows(new Set(rows.map((row) => row.__rowNumber)));
  };
  const removeRows = (rows) => {
    if (!rows.length) return;
    setRemovedRows((prev) => {
      const next = new Set(prev);
      rows.forEach((row) => next.add(row.__rowNumber));
      return next;
    });
    setSelectedRows((prev) => {
      const next = new Set(prev);
      rows.forEach((row) => next.delete(row.__rowNumber));
      return next;
    });
    toast.success(`تم حذف ${rows.length} صف من الاستيراد`);
  };
  const restoreRemovedRows = () => {
    setRemovedRows(new Set());
    toast.success("تمت إعادة الصفوف المحذوفة إلى الاستيراد");
  };
  const bulkTargetRows = () => {
    if (bulkScope === "selected") return selectedRowsList;
    if (bulkScope === "invalid") return rowsNeedingBulkFix(bulkField);
    if (bulkScope === "duplicates") return workingRows.filter((row) => duplicateRowNumbers.has(row.__rowNumber));
    if (bulkScope === "visible") return visibleRows;
    return workingRows;
  };
  const rowsForScope = (field, scope) => {
    if (scope === "selected") return selectedRowsList;
    if (scope === "invalid") return rowsNeedingBulkFix(field);
    if (scope === "duplicates") return workingRows.filter((row) => duplicateRowNumbers.has(row.__rowNumber));
    if (scope === "visible") return visibleRows;
    return workingRows;
  };
  const applyValueToRows = (field, value, rows, messageLabel, statusKey = field) => {
    if (!field || value === "" || !rows.length) return;
    setRowOverrides((prev) => {
      const next = { ...prev };
      rows.forEach((row) => {
        next[row.__rowNumber] = { ...(next[row.__rowNumber] || {}), [field]: value };
      });
      return next;
    });
    setLastAppliedFix({ key: statusKey, label: messageLabel || "التعديل", count: rows.length, at: Date.now() });
    toast.success(`تم تطبيق ${messageLabel || "التعديل"} على ${rows.length} صف`);
  };
  const applyQuickUnitFix = () => {
    if (!selectedQuickUnit) {
      toast.error("لا توجد وحدات متاحة في النظام");
      return;
    }
    applyValueToRows("unit_name", selectedQuickUnit, rowsForScope("unit_name", "invalid"), "الوحدة", "unit-invalid");
  };
  const applyQuickWarehouseFix = () => {
    if (!selectedQuickWarehouse) {
      toast.error("لا توجد مخازن متاحة في النظام");
      return;
    }
    applyValueToRows("warehouse_id", selectedQuickWarehouse, rowsForScope("warehouse_id", "invalid"), "المخزن", "warehouse-invalid");
  };
  const applyQuickWarehouseToAll = () => {
    if (!selectedQuickWarehouse) {
      toast.error("لا توجد مخازن متاحة في النظام");
      return;
    }
    applyValueToRows("warehouse_id", selectedQuickWarehouse, workingRows, "المخزن", "warehouse-all");
  };
  const groupWarehouseValue = (group) => {
    const values = [...new Set(group.map((row) => String(resolvedWarehouseId(warehouses, row))).filter(Boolean))];
    return values.length === 1 ? values[0] : "";
  };
  const sourceRowsForProduct = (row) => {
    const key = duplicateKeyForRow(row);
    if (!key) return [row];
    const group = duplicateGroups.find((candidate) => duplicateKeyForRow(candidate[0]) === key);
    return group || [row];
  };
  const productStoragePolicy = (row) => {
    return policyForDuplicateKey(duplicateKeyForRow(row), duplicateMode, duplicatePolicies);
  };
  const unlockStorageProduct = (row) => {
    const key = duplicateKeyForRow(row);
    if (!key) return;
    setDuplicatePolicies((prev) => ({ ...prev, [key]: "warehouse" }));
    const group = sourceRowsForProduct(row);
    setRowOverrides((prev) => {
      const next = { ...prev };
      group.forEach((item) => {
        next[item.__rowNumber] = { ...(next[item.__rowNumber] || {}), warehouse_id: "" };
      });
      return next;
    });
    setRowFilter("duplicates");
  };
  const lockStorageProduct = (row) => {
    const key = duplicateKeyForRow(row);
    if (!key) return;
    setDuplicatePolicies((prev) => ({ ...prev, [key]: "combine" }));
  };

  const applyBulkEdit = () => {
    if (!bulkField || bulkValue === "") return;
    const targetRows = bulkTargetRows();
    if (!targetRows.length) return;
    applyValueToRows(bulkField, bulkValue, targetRows, "التعديل");
  };

  const applyExistingRowsAction = (action) => {
    if (!exactExistingRows.length) return;
    setActions((prev) => {
      const next = { ...prev };
      exactExistingRows.forEach((row) => {
        next[row.__rowNumber] = action;
      });
      return next;
    });
    setLastAppliedFix({
      key: `existing-${action}-${Date.now()}`,
      label: action === "update" ? "تم اختيار تحديث كل المنتجات الموجودة" : "تم اختيار تخطي كل المنتجات الموجودة",
    });
  };

  const warehouseNameForRow = (row) => {
    const id = resolvedWarehouseId(warehouses, row);
    return warehouses.find((warehouse) => String(warehouse.id) === String(id))?.name || "المخزن المختار";
  };

  const changePreviewForRow = (row) => {
    const existing = row.__existing || findExactExistingProduct(databaseItems, row);
    const action = rowAction(row);
    const messages = [];
    const sku = parseSkuCode(row.code);
    const category = sku ? categoryBySkuPrefix(systemCategories, sku.prefix) : null;

    if (action === "skip") return ["لن يتم تغيير المنتج الموجود."];
    if (action === "warehouse_stock") {
      messages.push(`سيتم إضافة/ضبط مخزون ${warehouseNameForRow(row)} بكمية ${Number(row.stock_quantity || 0)}.`);
      return messages;
    }
    if (!existing) {
      messages.push("سيتم إنشاء منتج جديد.");
      if (category) messages.push(`الفئة من SKU: ${category.name}.`);
      else if (sku) messages.push(`سيتم إنشاء أو استرجاع فئة SKU ${sku.prefix} قبل الحفظ.`);
      messages.push(`المخزن: ${warehouseNameForRow(row)}، الكمية: ${Number(row.stock_quantity || 0)}.`);
      return messages;
    }

    const compare = [
      ["name", "الاسم"],
      ["barcode", "الباركود"],
      ["purchase_price", "سعر الشراء"],
      ["sale_price", "سعر البيع"],
      ["wholesale_price", "سعر الجملة"],
      ["min_stock_qty", "حد الطلب"],
    ];
    compare.forEach(([field, label]) => {
      const incoming = String(row[field] ?? "").trim();
      if (!incoming) return;
      const current = String(existing[field] ?? "").trim();
      if (incoming !== current) messages.push(`${label}: ${current || "فارغ"} ← ${incoming}`);
    });
    if (row.unit_name && normalizeKey(row.unit_name) !== normalizeKey(existing.unit_name)) {
      messages.push(`الوحدة: ${existing.unit_name || "فارغة"} ← ${row.unit_name}`);
    }
    if (category && Number(existing.category_id || 0) !== Number(category.id || 0)) {
      messages.push(`الفئة ستصبح: [${category.sku_prefix}] ${category.name}.`);
    } else if (sku && !category) {
      messages.push(`سيتم إنشاء أو استرجاع فئة SKU ${sku.prefix} ثم ربط المنتج بها.`);
    }
    if (row.stock_quantity !== undefined && row.stock_quantity !== "") {
      messages.push(`سيتم ضبط مخزون ${warehouseNameForRow(row)} إلى ${Number(row.stock_quantity || 0)}.`);
    }
    if (!messages.length) messages.push("لا توجد فروق واضحة، وسيتم فقط تأكيد الربط الحالي.");
    return messages;
  };

  const actionLabel = (action) => ({
    insert: "إضافة منتج جديد",
    update: "تحديث المنتج الموجود",
    warehouse_stock: "استلام مخزون فقط",
    skip: "تخطي",
  }[action] || action);

  const statusLabel = (status) => ({
    ready: "جاهز",
    existing: "موجود مسبقا",
    possible_duplicate: "تشابه اسم",
    file_duplicate: "مكرر بالملف",
    invalid: "غير صالح",
  }[status] || "مراجعة");

  const categoryLabelForRow = (row) => {
    const sku = parseSkuCode(row.code);
    const category = sku ? categoryBySkuPrefix(systemCategories, sku.prefix) : null;
    if (category) return `[${category.sku_prefix}] ${category.name}`;
    if (sku) return `سيتم إنشاء/استرجاع فئة SKU ${sku.prefix}`;
    return "SKU غير صحيح";
  };

  const rowAction = (row) => {
    if (actions[row.__rowNumber]) return actions[row.__rowNumber];
    if (findExactExistingProduct(databaseItems, row)) return "update";
    const policy = row.__duplicatePolicy || policyForDuplicateKey(duplicateKeyForRow(row), duplicateMode, duplicatePolicies);
    if (policy === "skip") return "skip";
    if (policy === "warehouse" && row.__status === "file_duplicate") return "warehouse_stock";
    if (policy === "keep" && row.__status === "file_duplicate") return "insert";
    return row.__status === "ready" ? "insert" : row.__status === "existing" ? "update" : "skip";
  };

  const updateRowValue = (rowNumber, field, value) => {
    setRowOverrides((prev) => ({
      ...prev,
      [rowNumber]: {
        ...(prev[rowNumber] || {}),
        [field]: value,
      },
    }));
  };

  const buildSubmitRows = (categoryList) => analyzedRows
      .filter((row) => row.__status !== "invalid")
      .flatMap((row) => {
        if (row.__duplicatePolicy === "warehouse" && Array.isArray(row.__warehouseDistribution)) {
          return row.__warehouseDistribution.map((item) => {
            const warehouseId = explicitWarehouseId(warehouses, item);
            const payloadRow = decorateRowWithSkuCategory({ ...item, ...row, warehouse_id: warehouseId }, categoryList);
            return {
              action: "warehouse_stock",
              match_field: row.__matchField,
              existing_id: row.__existing?.id,
              payload: toApiPayload(payloadRow, categoryList, units, selectedCategoryId),
              source_row: item.__rowNumber,
            };
          });
        }
        const warehouseId = resolvedWarehouseId(warehouses, row);
        const payloadRow = decorateRowWithSkuCategory(warehouseId && !row.warehouse_id ? { ...row, warehouse_id: warehouseId } : row, categoryList);
        return [{
          action: rowAction(row),
          match_field: row.__matchField,
          existing_id: row.__existing?.id,
          payload: toApiPayload(payloadRow, categoryList, units, selectedCategoryId),
          source_row: row.__rowNumber,
        }];
      })
      .filter((row) => row.action !== "skip");

  // dryRun=true simulates the import (counts only, no writes); dryRun=false commits.
  const runImport = async ({ dryRun, confirmDuplicate = false } = {}) => {
    setError("");
    if (blockingIssues.length) {
      const message = "يوجد أخطاء في البيانات يجب إصلاحها قبل الاستيراد.";
      setError(message);
      toast.error(message);
      setStep(2);
      return;
    }

    let categoryList = systemCategories;
    try {
      categoryList = await ensureSkuCategories();
    } catch (error) {
      const message = error.response?.data?.message || "تعذر إنشاء فئات SKU الناقصة.";
      setError(message);
      toast.error(message);
      setStep(2);
      return;
    }

    const rows = buildSubmitRows(categoryList);
    if (!rows.length) {
      const message = "لا توجد صفوف جاهزة للتنفيذ.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    try {
      const fileBase64 = await fileToBase64(sourceFile);
      const response = await api.post("/api/items/import", {
        rows,
        create_categories: true,
        mode: "smart",
        dry_run: dryRun,
        confirm_duplicate: confirmDuplicate,
        file_name: fileName || null,
        file_mime: sourceFile?.type || null,
        file_base64: fileBase64,
      });
      const data = response.data?.data || {};
      if (dryRun) {
        setPreview(data);
        toast.success("تمت المعاينة بنجاح");
      } else {
        setResult(data);
        setPreview(null);
        setStep(4);
        await onImported?.();
      }
    } catch (error) {
      const status = error?.response?.status;
      const body = error?.response?.data;
      if (status === 409 && body?.requires_confirm === "duplicate_file") {
        if (window.confirm("سبق استيراد نفس الملف من قبل. هل تريد المتابعة وتكرار الاستيراد؟")) {
          setLoading(false);
          return runImport({ dryRun, confirmDuplicate: true });
        }
        setLoading(false);
        return;
      }
      if (status === 409 && body?.reason === "import_in_progress") {
        toast.error("هناك عملية استيراد جارية بالفعل. انتظر حتى تنتهي.");
      } else if (status === 400 && body?.reason === "validation") {
        const message = `يوجد ${body.needFixing} صف يحتاج إصلاح قبل الاستيراد.`;
        setError(message);
        toast.error(message);
        setStep(2);
      } else {
        const message = body?.message || "فشل تنفيذ الاستيراد.";
        setError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => runImport({ dryRun: true });
  const handleImport = () => runImport({ dryRun: false });

  const body = (
      <div className="space-y-5" dir="rtl">
        <StepTabs step={step} stats={importStats} />

        {error ? (
          <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-2sm font-bold text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {step === 1 ? (
          <div
            onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
            onDrop={handleDrop}
            className={`rounded-sm border border-dashed px-6 py-12 text-center transition ${
              dragActive ? "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100" : "border-slate-300 bg-slate-50"
            }`}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-sm bg-emerald-100 text-emerald-700">
              <FileSpreadsheet className="h-8 w-8" />
            </div>
            <h3 className="mt-5 text-[22px] font-black text-slate-900">ارفع ملف الأصناف</h3>
            <p className="mt-2 text-sm font-bold text-slate-500">اسحب ملف Excel هنا أو اختره من الجهاز. ستظهر نتيجة القراءة هنا مباشرة.</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={reading}
                className="inline-flex items-center gap-2 rounded-sm bg-slate-900 px-6 py-3 text-sm font-black text-white shadow-lg hover:bg-slate-800 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {reading ? "جاري قراءة الملف..." : "اختيار ملف"}
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              <button type="button" onClick={downloadImportTemplate} className="inline-flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">
                <Download className="h-4 w-4" />
                تحميل قالب
              </button>
            </div>
            {fileName ? (
              <div className="mx-auto mt-5 grid max-w-3xl gap-2 sm:grid-cols-3">
                <div className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-right">
                  <div className="text-[11px] font-black text-slate-400">الملف</div>
                  <div className="truncate text-2sm font-black text-slate-800">{fileName}</div>
                </div>
                <div className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-right">
                  <div className="text-[11px] font-black text-slate-400">الصفوف</div>
                  <div className="text-2sm font-black text-slate-800">{importStats.totalRows}</div>
                </div>
                <div className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-right">
                  <div className="text-[11px] font-black text-slate-400">الثقة</div>
                  <div className="text-2sm font-black text-slate-800">{importStats.confidence}%</div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-black text-slate-900">مراجعة ملف الأصناف</h3>
                <p className="text-2sm font-bold text-slate-500">الملف: {fileName}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIssueTrayOpen((prev) => !prev);
                    if (!issueTrayOpen && blockingIssues.length) setIssueTab("errors");
                  }}
                  className="inline-flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-4 py-2.5 text-2sm font-black text-slate-700 hover:bg-slate-50"
                >
                  {issueTrayOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                  {issueTrayOpen ? "إخفاء لوحة الإصلاح" : "إظهار لوحة الإصلاح"}
                </button>
                <button
                  type="button"
                  onClick={proceedToReview}
                  disabled={categorySyncing}
                  className={`rounded-sm px-5 py-2.5 text-2sm font-black text-white shadow-sm ${blockingIssues.length ? "bg-rose-600 hover:bg-rose-700" : "bg-slate-900 hover:bg-slate-800"}`}
                >
                  {categorySyncing ? "جاري إنشاء الفئات..." : blockingIssues.length ? "إصلاح المطلوب" : missingSkuCategories.length ? "إنشاء الفئات والمتابعة" : "متابعة"}
                </button>
              </div>
            </div>

            <div className={`rounded-sm border px-4 py-3 ${guideStep.tone === "rose" ? "border-rose-200 bg-rose-50" : guideStep.tone === "sky" ? "border-sky-200 bg-sky-50" : "border-emerald-200 bg-emerald-50"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className={`text-sm font-black ${guideStep.tone === "rose" ? "text-rose-800" : guideStep.tone === "sky" ? "text-sky-800" : "text-emerald-800"}`}>{guideStep.title}</div>
                  <div className={`mt-1 text-2sm font-bold ${guideStep.tone === "rose" ? "text-rose-700" : guideStep.tone === "sky" ? "text-sky-700" : "text-emerald-700"}`}>{guideStep.body}</div>
                  {!hasSourceStores && duplicateGroups.length ? (
                    <div className="mt-2 text-[11px] font-bold text-slate-600">ملاحظة المخازن: عمود المخزن في الملف فارغ، لذلك أخفيته من الجدول. إذا كانت التكرارات بسبب مخازن مختلفة اختر "توزيع على مخازن النظام" ثم حدد المخزن لكل صف.</div>
                  ) : null}
                </div>
                {guideStep.action ? (
                  <button type="button" onClick={guideStep.run} className={`rounded-sm px-4 py-2.5 text-2sm font-black text-white ${guideStep.tone === "rose" ? "bg-rose-600 hover:bg-rose-700" : guideStep.tone === "sky" ? "bg-sky-700 hover:bg-sky-800" : "bg-emerald-700 hover:bg-emerald-800"}`}>
                    {guideStep.action}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-sm border border-slate-200 bg-white p-3">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  ["صفوف الملف", importStats.totalRows],
                  ["منتجات فعلية", importStats.uniqueProducts],
                  ["بعد القرار", importStats.importRows],
                  ["صفوف مخزون مدمجة", importStats.storageSplitRows],
                  ["موجودة بالفعل", importStats.exactExistingRows],
                  ["أخطاء", importStats.errors],
                  ["ثقة الربط", `${importStats.confidence}%`],
                ].map(([label, value]) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => {
                      if (label === "أخطاء") {
                        setIssueTrayOpen(true);
                        setIssueTab("errors");
                      } else if (label === "صفوف مخزون مدمجة") {
                      } else if (label === "موجودة بالفعل") {
                        setIssueTrayOpen(true);
                        setIssueTab("existing");
                      } else if (label === "ثقة الربط") {
                        setColumnMappingOpen(true);
                        setIssueTrayOpen(true);
                        setIssueTab("columns");
                      }
                    }}
                    className={`rounded-sm border px-3 py-2 text-right transition hover:bg-slate-50 ${label === "أخطاء" && importStats.errors ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}
                  >
                    <div className="text-[11px] font-black text-slate-400">{label}</div>
                    <div className={`mt-1 text-[16px] font-black ${label === "أخطاء" && importStats.errors ? "text-rose-600" : "text-slate-900"}`}>{value}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-sm border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setColumnMappingOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right"
              >
                <span>
                  <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <Columns3 className="h-4 w-4 text-slate-500" />
                    الأعمدة المرتبطة
                  </span>
                  <span className="mt-1 block text-[11px] font-bold text-slate-500">{importStats.mappedColumns}/{importStats.totalColumns} أعمدة مرتبطة. افتحها فقط عند الحاجة لتعديل الربط.</span>
                </span>
                <span className="rounded-sm border border-slate-200 px-3 py-1.5 text-[11px] font-black text-slate-600">{columnMappingOpen ? "إخفاء" : "تعديل"}</span>
              </button>
              {columnMappingOpen ? (
                <div className="overflow-x-auto border-t border-slate-100">
                  <div className="flex min-w-max gap-2 p-3">
                    {headers.map((header, index) => {
                      const mappedField = mapping[index] || "";
                      return (
                        <div key={`${header}-${index}`} className={`w-44 shrink-0 rounded-sm border p-2 ${mappedField ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                          <div className="truncate font-mono text-[11px] font-black text-slate-500">{header || `عمود ${index + 1}`}</div>
                          <select value={mappedField} onChange={(event) => updateMapping(index, event.target.value)} className="mt-2 w-full rounded-sm border border-slate-200 bg-white px-2 py-2 text-2sm font-bold">
                            <option value="">تجاهل</option>
                            {ITEM_FIELDS.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <div className="order-2 overflow-hidden rounded-sm border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">جدول المراجعة</div>
                    <div className="text-[11px] font-bold text-slate-500">الجدول هو مساحة العمل الأساسية. صحح الخلايا مباشرة أو استخدم لوحة الإصلاح.</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => removeRows(selectedRowsList)}
                      disabled={!selectedRows.size}
                      className="inline-flex items-center gap-1 rounded-sm border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف المحدد
                    </button>
                    {removedRows.size ? (
                      <button
                        type="button"
                        onClick={restoreRemovedRows}
                        className="rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-50"
                      >
                        استرجاع المحذوف ({removedRows.size})
                      </button>
                    ) : null}
                    {[
                      ["all", "الكل", filterCounts.all],
                      ["errors", "أخطاء", filterCounts.errors],
                      ["duplicates", "صفوف مخزون", filterCounts.duplicates],
                      ["unmapped", "غير مربوط", filterCounts.unmapped],
                      ["ready", "جاهز", filterCounts.ready],
                    ].map(([key, label, count]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setRowFilter(key)}
                        className={`inline-flex items-center gap-1 rounded-sm border px-2.5 py-1.5 text-[11px] font-black ${rowFilter === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                      >
                        <ListFilter className="h-3 w-3" />
                        {label}
                        <span className={rowFilter === key ? "text-white/70" : "text-slate-400"}>{count}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="max-h-[480px] overflow-x-auto overflow-y-auto overscroll-x-contain">
                  <table style={{ minWidth: "max-content" }} className="border-separate border-spacing-0 text-right text-2sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                      <tr>
                        <th className="w-16 border-b border-l border-slate-200 bg-slate-50 px-3 py-3 text-center">#</th>
                        <th className="w-12 border-b border-l border-slate-200 bg-slate-50 px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={visibleRows.length > 0 && visibleRows.every((row) => selectedRows.has(row.__rowNumber))}
                            onChange={(event) => (event.target.checked ? selectRows(visibleRows) : setSelectedRows(new Set()))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </th>
                        <th className="w-12 border-b border-l border-slate-200 bg-slate-50 px-3 py-3 text-center">حذف</th>
                        {orderedFields.map((field) => {
                          const sourceIndex = Object.entries(mapping).find(([, mapped]) => mapped === field)?.[0];
                          const meta = FIELD_META[field] || { label: field };
                          const width = getColumnWidth(field);
                          return (
                            <th key={field} style={{ width, minWidth: width }} className="relative border-b border-l border-slate-200 bg-slate-50 px-3 py-3 align-top">
                              <button type="button" onClick={() => toggleSort(field)} className="flex w-full items-center justify-between gap-2 text-right">
                                <span className="min-w-0">
                                  <span className="block truncate text-2sm font-black text-slate-900">{meta.label}</span>
                                  <span className="mt-1 block truncate font-mono text-[11px] font-bold text-slate-400">{headers[Number(sourceIndex)] || "مشتق"}</span>
                                </span>
                                <ArrowUpDown className={`h-3.5 w-3.5 shrink-0 ${sortConfig.key === field ? "text-slate-900" : "text-slate-300"}`} />
                              </button>
                              <div onMouseDown={(event) => startResize(event, field)} className="absolute left-0 top-0 flex h-full w-2 cursor-col-resize items-center justify-center hover:bg-sky-200">
                                <GripVertical className="h-3 w-3 text-slate-300" />
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => (
                        <tr key={row.__rowNumber} className="border-t border-slate-100 hover:bg-slate-50/70">
                          <td className="border-l border-t border-slate-100 bg-white px-3 py-3 text-center font-black text-slate-400">{row.__rowNumber}</td>
                          <td className="border-l border-t border-slate-100 bg-white px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedRows.has(row.__rowNumber)}
                              onChange={() => toggleRowSelection(row.__rowNumber)}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </td>
                          <td className="border-l border-t border-slate-100 bg-white px-2 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeRows([row])}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-rose-100 text-rose-500 hover:bg-rose-50"
                              title="حذف من الاستيراد"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                          {orderedFields.map((field) => {
                            const cellIssues = issuesFor(row.__rowNumber, field);
                            const meta = FIELD_META[field] || {};
                            return (
                              <td key={field} style={{ width: getColumnWidth(field), minWidth: getColumnWidth(field) }} className={`border-l border-t border-slate-100 px-2 py-2 align-top ${cellIssues.some((issue) => issue.severity === "error") ? "bg-rose-50" : cellIssues.length ? "bg-amber-50" : ""}`}>
                                {meta.type === "storage_plan" ? (
                                  (() => {
                                    const group = sourceRowsForProduct(row);
                                    const isSplitProduct = group.length > 1;
                                    const policy = productStoragePolicy(row);
                                    const stockTotal = group.reduce((sum, item) => sum + Number(item.stock_quantity || 0), 0);
                                    if (!isSplitProduct) {
                                      return <div className="rounded-sm border border-slate-100 bg-slate-50 px-2 py-2 text-[11px] font-bold text-slate-500">صف واحد، لا يوجد تقسيم مخزون.</div>;
                                    }
                                    if (policy !== "warehouse") {
                                      return (
                                        <div className="space-y-2">
                                          <div className="rounded-sm border border-emerald-100 bg-emerald-50 px-2 py-2">
                                            <div className="flex items-center gap-1 text-[11px] font-black text-emerald-800">
                                              <Lock className="h-3.5 w-3.5" />
                                              دمج تلقائي للكمية
                                            </div>
                                            <div className="mt-1 text-[11px] font-bold text-emerald-700">{group.length} صفوف مخزون ستصبح صنفا واحدا بإجمالي {stockTotal}</div>
                                          </div>
                                          <div className="max-h-24 overflow-auto rounded-sm border border-slate-100 bg-white">
                                            {group.map((item) => (
                                              <div key={item.__rowNumber} className="grid grid-cols-[52px_1fr] gap-2 border-b border-slate-100 px-2 py-1.5 last:border-b-0">
                                                <span className="text-[11px] font-black text-slate-400">صف {item.__rowNumber}</span>
                                                <span className="truncate text-[11px] font-bold text-slate-600">كمية {item.stock_quantity || 0}</span>
                                              </div>
                                            ))}
                                          </div>
                                          <button type="button" onClick={() => unlockStorageProduct(row)} className="inline-flex w-full items-center justify-center gap-1 rounded-sm border border-sky-200 bg-white px-2 py-2 text-[11px] font-black text-sky-700 hover:bg-sky-50">
                                            <Unlock className="h-3.5 w-3.5" />
                                            فتح توزيع المخازن لهذا المنتج
                                          </button>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="space-y-2">
                                        <div className="rounded-sm border border-sky-100 bg-sky-50 px-2 py-2">
                                          <div className="flex items-center gap-1 text-[11px] font-black text-sky-800">
                                            <Unlock className="h-3.5 w-3.5" />
                                            توزيع المخزون داخل نفس المنتج
                                          </div>
                                          <div className="mt-1 text-[11px] font-bold text-sky-700">اختر المخزن لكل كمية هنا. لن تحتاج إلى استخدام عمود مخزن النظام لهذا المنتج.</div>
                                        </div>
                                        <select value={groupWarehouseValue(group)} onChange={(event) => applyValueToRows("warehouse_id", event.target.value, group, "المخزن")} className="w-full rounded-sm border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold">
                                          <option value="">تطبيق مخزن واحد على الصفوف</option>
                                          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                                        </select>
                                        <div className="space-y-1.5 rounded-sm border border-slate-100 bg-white p-2">
                                          {group.map((item) => (
                                            <div key={item.__rowNumber} className="grid grid-cols-[58px_1fr] gap-2 rounded-sm bg-slate-50 p-1.5">
                                              <div className="min-w-0 text-[11px] font-bold text-slate-500">
                                                <div className="font-black">صف {item.__rowNumber}</div>
                                                <div className="truncate">كمية {item.stock_quantity || 0}</div>
                                                {item.store_name ? <div className="truncate text-slate-400">{item.store_name}</div> : null}
                                              </div>
                                              <select
                                                value={explicitWarehouseId(warehouses, item)}
                                                onChange={(event) => updateRowValue(item.__rowNumber, "warehouse_id", event.target.value)}
                                                className={`w-full rounded-sm border bg-white px-2 py-2 text-[11px] font-bold ${explicitWarehouseId(warehouses, item) ? "border-slate-200" : "border-rose-300"}`}
                                              >
                                                <option value="">اختر مخزن</option>
                                                {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                                              </select>
                                            </div>
                                          ))}
                                        </div>
                                        <button type="button" onClick={() => lockStorageProduct(row)} className="w-full rounded-sm border border-slate-200 bg-white px-2 py-2 text-[11px] font-black text-slate-600 hover:bg-slate-50">
                                          رجوع للدمج التلقائي
                                        </button>
                                      </div>
                                    );
                                  })()
                                ) : meta.type === "unit" ? (
                                  <select value={row.unit_name || ""} onChange={(event) => updateRowValue(row.__rowNumber, "unit_name", event.target.value)} className="w-full rounded-sm border border-slate-200 bg-white px-2 py-2 text-2sm font-bold outline-none focus:border-slate-800">
                                    <option value="">بدون وحدة</option>
                                    {units.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
                                    {row.unit_name && !hasOption(units, row.unit_name) ? <option value={row.unit_name}>{row.unit_name}</option> : null}
                                  </select>
                                ) : meta.type === "category" ? (
                                  (() => {
                                    const sku = parseSkuCode(row.code);
                                    const category = sku ? categoryBySkuPrefix(systemCategories, sku.prefix) : null;
                                    return (
                                      <div className={`rounded-sm border px-2 py-2 text-2sm font-bold ${category ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                                        {category ? `[${category.sku_prefix}] ${category.name}` : sku ? `سيتم إنشاء فئة رقم ${sku.prefix}` : "لا يمكن تحديد الفئة بدون SKU صحيح"}
                                      </div>
                                    );
                                  })()
                                ) : meta.type === "warehouse" ? (
                                  <>
                                    {row.__duplicatePolicy === "warehouse" ? (
                                      <div className="rounded-sm border border-slate-100 bg-slate-50 px-2 py-2 text-[11px] font-bold text-slate-500">
                                        يتم تحديد المخازن من خلية قرار المخزون لهذا المنتج.
                                      </div>
                                    ) : (
                                      <>
                                        <select value={resolvedWarehouseId(warehouses, row)} onChange={(event) => updateRowValue(row.__rowNumber, "warehouse_id", event.target.value)} className="w-full rounded-sm border border-slate-200 bg-white px-2 py-2 text-2sm font-bold outline-none focus:border-slate-800">
                                          <option value="">اختر مخزن النظام</option>
                                          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                                        </select>
                                        <div className="mt-1 text-[11px] font-bold text-slate-400">
                                          {row.store_name ? `مصدر الملف: ${row.store_name}` : "مخزن النظام المستخدم للاستيراد"}
                                        </div>
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <input
                                    type={meta.type === "number" ? "number" : "text"}
                                    value={row[field] ?? ""}
                                    readOnly={field === "code"}
                                    onChange={(event) => updateRowValue(row.__rowNumber, field, event.target.value)}
                                    className={`w-full rounded-sm border border-slate-200 px-2 py-2 text-2sm outline-none focus:border-slate-800 ${field === "code" ? "bg-slate-100 text-slate-500" : "bg-white"} ${field === "code" || field === "barcode" ? "font-mono" : "font-bold"}`}
                                  />
                                )}
                                {row.__inferredUnitName && field === "unit_name" ? <div className="mt-1 text-[11px] font-bold text-slate-400">مستخرجة من المخزون</div> : null}
                                {cellIssues.map((issue, issueIndex) => (
                                  <div key={issueIndex} className={`mt-1 text-[11px] font-bold ${issue.severity === "error" ? "text-rose-600" : "text-amber-700"}`}>{issue.message}</div>
                                ))}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {issueTrayOpen ? (
                <aside className="order-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-4">
                    <div>
                      <div className="text-[15px] font-black text-slate-900">مركز إصلاح الاستيراد</div>
                      <div className="mt-1 text-2sm font-bold text-slate-500">ابدأ بالبطاقات الحمراء. كل بطاقة تصلح نوعا كاملا من المشاكل مرة واحدة.</div>
                    </div>
                    <button type="button" onClick={() => setIssueTrayOpen(false)} className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-2sm font-black text-slate-600 hover:bg-slate-50">إغلاق</button>
                  </div>
                  <div className="max-h-[420px] overflow-auto p-4">
                    <div className="grid gap-3 lg:grid-cols-5">
                      <div className={`rounded-md border p-3 ${blockingIssues.length ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
                        <div className={`text-[22px] font-black ${blockingIssues.length ? "text-rose-700" : "text-emerald-700"}`}>{blockingIssues.length}</div>
                        <div className="text-[11px] font-black text-slate-600">أخطاء تمنع المتابعة</div>
                      </div>
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                        <div className="text-[22px] font-black text-amber-700">{unitErrorCount}</div>
                        <div className="text-[11px] font-black text-slate-600">صفوف تحتاج وحدة صحيحة</div>
                      </div>
                      <div className="rounded-md border border-violet-200 bg-violet-50 p-3">
                        <div className="text-[22px] font-black text-violet-700">{missingSkuCategories.length}</div>
                        <div className="text-[11px] font-black text-slate-600">فئات SKU سيتم إنشاؤها</div>
                      </div>
                      <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
                        <div className="text-[22px] font-black text-sky-700">{warehouseErrorCount}</div>
                        <div className="text-[11px] font-black text-slate-600">صفوف تحتاج مخزن</div>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="text-[22px] font-black text-slate-800">{importStats.mappedColumns}/{importStats.totalColumns}</div>
                        <div className="text-[11px] font-black text-slate-600">أعمدة مرتبطة</div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-2">
                      <div className={`rounded-md border p-4 ${unitErrorCount ? "border-rose-200 bg-white" : "border-slate-200 bg-slate-50"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-900">إصلاح الوحدات</div>
                            <div className="mt-1 text-[11px] font-bold text-slate-500">{unitErrorCount ? `اختر وحدة موجودة لتطبيقها على ${unitErrorCount} صف.` : "لا توجد أخطاء وحدات."}</div>
                          </div>
                          <span className={`rounded-sm px-2 py-1 text-[11px] font-black ${unitErrorCount ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{unitErrorCount}</span>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                          <select value={selectedQuickUnit} onChange={(event) => setQuickUnitValue(event.target.value)} className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-2sm font-bold">
                            <option value="">اختر الوحدة الصحيحة</option>
                            {units.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
                          </select>
                          <button type="button" disabled={!selectedQuickUnit || !unitErrorCount} onClick={applyQuickUnitFix} className={`inline-flex items-center justify-center gap-1 rounded-sm px-4 py-2 text-2sm font-black text-white disabled:opacity-40 ${lastAppliedFix?.key === "unit-invalid" ? "bg-emerald-600" : "bg-slate-900"}`}>
                            {lastAppliedFix?.key === "unit-invalid" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                            {lastAppliedFix?.key === "unit-invalid" ? "تم" : "تطبيق"}
                          </button>
                        </div>
                        {lastAppliedFix?.key === "unit-invalid" ? <div className="mt-2 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-black text-emerald-700">تم تطبيق الوحدة على {lastAppliedFix.count} صف.</div> : null}
                      </div>

                      <div className={`rounded-md border p-4 ${warehouseErrorCount ? "border-rose-200 bg-white" : "border-slate-200 bg-slate-50"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-900">إصلاح المخازن</div>
                            <div className="mt-1 text-[11px] font-bold text-slate-500">
                              {warehouseErrorCount
                                ? `اختر مخزنا لتطبيقه على ${warehouseErrorCount} صف يحتاج مخزن، أو طبقه على كل الصفوف.`
                                : "لا توجد أخطاء مخازن. يمكنك تطبيق مخزن واحد على كل الصفوف من هنا."}
                            </div>
                          </div>
                          <span className={`rounded-sm px-2 py-1 text-[11px] font-black ${warehouseErrorCount ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{warehouseErrorCount}</span>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] xl:grid-cols-1 2xl:grid-cols-[1fr_auto_auto]">
                          <select value={selectedQuickWarehouse} onChange={(event) => setQuickWarehouseValue(event.target.value)} className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-2sm font-bold">
                            <option value="">اختر المخزن الصحيح</option>
                            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                          </select>
                          <button type="button" disabled={!selectedQuickWarehouse || !warehouseErrorCount} onClick={applyQuickWarehouseFix} className={`inline-flex items-center justify-center gap-1 rounded-sm px-4 py-2 text-2sm font-black text-white disabled:opacity-40 ${lastAppliedFix?.key === "warehouse-invalid" ? "bg-emerald-600" : "bg-slate-900"}`}>
                            {lastAppliedFix?.key === "warehouse-invalid" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                            {lastAppliedFix?.key === "warehouse-invalid" ? "تم" : "للناقص"}
                          </button>
                          <button type="button" disabled={!selectedQuickWarehouse || !workingRows.length} onClick={applyQuickWarehouseToAll} className={`inline-flex items-center justify-center gap-1 rounded-sm border px-4 py-2 text-2sm font-black disabled:opacity-40 ${lastAppliedFix?.key === "warehouse-all" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-900"}`}>
                            {lastAppliedFix?.key === "warehouse-all" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                            {lastAppliedFix?.key === "warehouse-all" ? "تم" : "للكل"}
                          </button>
                        </div>
                        {lastAppliedFix?.key?.startsWith("warehouse-") ? <div className="mt-2 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-black text-emerald-700">تم تطبيق المخزن على {lastAppliedFix.count} صف.</div> : null}
                      </div>
                    </div>

                    {missingSkuCategories.length ? (
                      <div className="mt-3 rounded-md border border-violet-200 bg-violet-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-violet-900">تسمية فئات SKU الجديدة</div>
                            <div className="mt-1 text-[11px] font-bold text-violet-700">
                              الفئة تتحدد من رقم SKU فقط. اكتب اسم الفئة الجديدة، وسيتم إنشاؤها بهذا الرقم قبل الاستيراد.
                            </div>
                          </div>
                          <span className="rounded-sm bg-white px-2 py-1 text-[11px] font-black text-violet-700">{missingSkuCategories.length}</span>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {missingSkuCategories.map((entry) => (
                            <label key={entry.prefix} className="block rounded-sm border border-violet-100 bg-white p-2">
                              <span className="text-[11px] font-black text-violet-500">فئة SKU {entry.prefix} - {entry.rows.length} صف</span>
                              <input
                                value={skuCategoryNames[entry.prefix] ?? entry.name}
                                onChange={(event) => setSkuCategoryNames((prev) => ({ ...prev, [entry.prefix]: event.target.value }))}
                                className="mt-1 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-2sm font-bold outline-none focus:border-violet-500"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-md border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-900">منتجات موجودة مسبقا</div>
                            <div className="mt-1 text-[11px] font-bold text-slate-500">{exactExistingRows.length ? "راجع هل تريد تخطيها أو تحديثها." : "لا توجد منتجات مطابقة في النظام."}</div>
                          </div>
                          <span className="rounded-sm bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">{exactExistingRows.length}</span>
                        </div>
                        {exactExistingRows.length ? (
                          <div className="mt-3">
                            <div className="mb-2 grid gap-2 sm:grid-cols-2">
                              <button type="button" onClick={() => applyExistingRowsAction("update")} className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700 hover:bg-emerald-100">
                                تحديث كل الموجود
                              </button>
                              <button type="button" onClick={() => applyExistingRowsAction("skip")} className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 hover:bg-slate-50">
                                تخطي كل الموجود
                              </button>
                            </div>
                            <div className="max-h-36 space-y-2 overflow-auto">
                            {exactExistingRows.slice(0, 4).map((row) => (
                              <div key={row.__rowNumber} className="grid gap-2 rounded-sm bg-slate-50 p-2 sm:grid-cols-[1fr_170px] sm:items-center">
                                <div className="min-w-0">
                                  <div className="truncate text-2sm font-black text-slate-800">{row.name}</div>
                                  <div className="mt-1 truncate text-[11px] font-bold text-emerald-700">{changePreviewForRow(row)[0]}</div>
                                  <div className="text-[11px] font-bold text-slate-400">صف {row.__rowNumber}</div>
                                </div>
                                <select value={rowAction(row)} onChange={(event) => setActions((prev) => ({ ...prev, [row.__rowNumber]: event.target.value }))} className="rounded-sm border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold">
                                  <option value="skip">تخطي</option>
                                  <option value="update">تحديث</option>
                                </select>
                              </div>
                            ))}
                            </div>
                            {exactExistingRows.length > 4 ? (
                              <div className="mt-2 text-[11px] font-bold text-slate-400">سيتم تطبيق القرار الجماعي على باقي المنتجات الموجودة أيضا.</div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-md border border-slate-200 bg-white p-4">
                        <div className="text-sm font-black text-slate-900">ربط الأعمدة</div>
                        <div className="mt-1 text-[11px] font-bold text-slate-500">افتحه فقط إذا كان اسم الصنف أو الوحدة أو المخزن مربوطا بعمود خطأ.</div>
                        <button type="button" onClick={() => setColumnMappingOpen(true)} className="mt-3 w-full rounded-sm border border-slate-200 bg-slate-900 px-4 py-2 text-2sm font-black text-white hover:bg-slate-800">
                          فتح ربط الأعمدة
                        </button>
                      </div>
                    </div>

                    {false && issueTab === "errors" ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              const rows = [...new Set(blockingIssues.map((issue) => issue.rowNumber).filter(Boolean))];
                              setSelectedRows(new Set(rows));
                              setRowFilter("errors");
                            }}
                            className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700"
                          >
                            تحديد كل صفوف الأخطاء
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBulkField("unit_name");
                              setBulkValue("");
                              setBulkScope("invalid");
                              setIssueTab("bulk");
                            }}
                            className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700"
                          >
                            حل كل أخطاء الوحدة
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBulkField("warehouse_id");
                              setBulkValue("");
                              setBulkScope("invalid");
                              setIssueTab("bulk");
                            }}
                            className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700"
                          >
                            حل كل أخطاء المخزن
                          </button>
                        </div>
                        {blockingIssues.length ? blockingIssues.map((issue, index) => (
                          <button
                            type="button"
                            key={`${issue.rowNumber || "global"}-${index}`}
                            onClick={() => {
                              if (issue.rowNumber) {
                                setRowFilter("errors");
                                setSelectedRows(new Set([issue.rowNumber]));
                              }
                            }}
                            className="flex w-full items-center justify-between gap-3 rounded-sm border border-rose-100 bg-rose-50 px-3 py-2 text-right text-[11px] font-bold text-rose-700"
                          >
                            <span>{issue.rowNumber ? `صف ${issue.rowNumber}: ` : ""}{issue.message}</span>
                            {issue.rowNumber ? <span className="shrink-0 rounded-sm bg-white/70 px-2 py-1 text-[11px] text-rose-600">عرض الصف</span> : null}
                          </button>
                        )) : (
                          <div className="rounded-sm border border-emerald-100 bg-emerald-50 px-3 py-3 text-2sm font-black text-emerald-700">لا توجد أخطاء تمنع المتابعة.</div>
                        )}
                        {validationIssues.filter((issue) => issue.severity !== "error").slice(0, 8).map((issue, index) => (
                          <div key={index} className="rounded-sm border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
                            {issue.rowNumber ? `صف ${issue.rowNumber}: ` : ""}{issue.message}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {false && issueTab === "duplicates" ? (
                      <div className="space-y-3">
                        <div className="rounded-sm border border-sky-100 bg-sky-50 px-4 py-3">
                          <div className="text-sm font-black text-sky-900">صفوف مخزون لنفس المنتج</div>
                          <div className="mt-1 text-2sm font-bold text-sky-800">النظام سيدمج الكميات تلقائيا. غيّر القرار فقط إذا كنت تريد توزيع الكميات على مخازن النظام.</div>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-3">
                          <button type="button" onClick={() => { setDuplicateMode("combine"); setDuplicatePolicies({}); }} className={`rounded-sm border px-3 py-3 text-right ${duplicateMode === "combine" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700"}`}>
                            <span className="block text-2sm font-black">دمج كل الكميات</span>
                            <span className="mt-1 block text-[11px] font-bold opacity-80">الأبسط، ويحول كل منتج مكرر إلى صف واحد بإجمالي الكمية.</span>
                          </button>
                          <button type="button" onClick={() => setDuplicateMode("warehouse")} className={`rounded-sm border px-3 py-3 text-right ${duplicateMode === "warehouse" ? "border-sky-300 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-700"}`}>
                            <span className="block text-2sm font-black">توزيع على مخازن</span>
                            <span className="mt-1 block text-[11px] font-bold opacity-80">استخدمها فقط لو كل صف يمثل كمية في مخزن مختلف.</span>
                          </button>
                          <button type="button" onClick={() => setDuplicateMode("skip")} className={`rounded-sm border px-3 py-3 text-right ${duplicateMode === "skip" ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-700"}`}>
                            <span className="block text-2sm font-black">تخطي صفوف المخزون</span>
                            <span className="mt-1 block text-[11px] font-bold opacity-80">لا تستورد الكمية المتكررة لهذا النوع من الصفوف.</span>
                          </button>
                        </div>
                        <div className="grid gap-2 rounded-sm border border-slate-200 bg-white p-3 md:grid-cols-[1fr_220px_140px] md:items-end">
                          <label>
                            <span className="text-[11px] font-black text-slate-400">توزيع سريع لكل صفوف المخزون على مخزن واحد</span>
                            <select value={quickStorageWarehouse} onChange={(event) => setQuickStorageWarehouse(event.target.value)} className="mt-1 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-2sm font-bold">
                              <option value="">اختر مخزن</option>
                              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                            </select>
                          </label>
                          <button
                            type="button"
                            disabled={!quickStorageWarehouse}
                            onClick={() => {
                              setDuplicateMode("warehouse");
                              applyValueToRows("warehouse_id", quickStorageWarehouse, rowsForScope("warehouse_id", "duplicates"), "المخزن");
                            }}
                            className="rounded-sm bg-slate-900 px-4 py-2.5 text-2sm font-black text-white disabled:opacity-40"
                          >
                            تطبيق على صفوف المخزون
                          </button>
                          <button type="button" onClick={() => { setQuickStorageWarehouse(""); setDuplicateMode("combine"); setDuplicatePolicies({}); }} className="rounded-sm border border-slate-200 bg-white px-4 py-2.5 text-2sm font-black text-slate-600">إرجاع للدمج</button>
                        </div>
                        {duplicateGroups.length ? duplicateGroups.map((group) => {
                          const first = group[0];
                          const key = duplicateKeyForRow(first);
                          const groupPolicy = policyForDuplicateKey(key, duplicateMode, duplicatePolicies);
                          const stockTotal = group.reduce((sum, row) => sum + Number(row.stock_quantity || 0), 0);
                          const stores = [...new Set(group.map((row) => row.store_name).filter(Boolean))];
                          return (
                            <div key={key} className="rounded-sm border border-slate-200 bg-slate-50 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-2sm font-black text-slate-900">{first.name || first.code}</div>
                                  <div className="mt-1 text-[11px] font-bold text-slate-500">{group.length} صفوف مخزون، إجمالي الكمية {stockTotal}{stores.length ? `، مخازن المصدر: ${stores.join("، ")}` : "، لا توجد أسماء مخازن في الملف"}</div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {[
                                    ["combine", "دمج"],
                                    ["warehouse", "مخازن"],
                                    ["skip", "تخطي"],
                                  ].map(([policy, label]) => (
                                    <button key={policy} type="button" onClick={() => setDuplicatePolicies((prev) => ({ ...prev, [key]: policy }))} className={`rounded-sm border px-3 py-1.5 text-[11px] font-black ${groupPolicy === policy ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{label}</button>
                                  ))}
                                </div>
                              </div>
                              {groupPolicy === "warehouse" ? (
                                <div className="mt-2 space-y-2 rounded-sm border border-sky-100 bg-sky-50 p-2">
                                  <div className="grid gap-2 md:grid-cols-[1fr_220px] md:items-center">
                                    <div className="text-[11px] font-bold text-sky-700">اختر مخزن النظام لكل صف، أو اختر مخزنا واحدا لكل صفوف هذا المنتج.</div>
                                    <select value={groupWarehouseValue(group)} onChange={(event) => applyValueToRows("warehouse_id", event.target.value, group, "المخزن")} className="w-full rounded-sm border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold">
                                      <option value="">مخزن واحد لكل الصفوف</option>
                                      {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                                    </select>
                                  </div>
                                  {group.map((row) => (
                                    <div key={row.__rowNumber} className="grid gap-2 rounded-sm bg-white p-2 sm:grid-cols-[70px_1fr_170px] sm:items-center">
                                      <div className="text-[11px] font-black text-slate-500">صف {row.__rowNumber}</div>
                                      <div className="min-w-0 text-[11px] font-bold text-slate-600">
                                        <div className="truncate">كمية: {row.stock_quantity || 0}</div>
                                        <div className="truncate text-slate-400">مصدر الملف: {row.store_name || "فارغ"}</div>
                                      </div>
                                      <select value={resolvedWarehouseId(warehouses, row)} onChange={(event) => updateRowValue(row.__rowNumber, "warehouse_id", event.target.value)} className="w-full rounded-sm border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold">
                                        <option value="">اختر مخزن</option>
                                        {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        }) : (
                          <div className="rounded-sm border border-emerald-100 bg-emerald-50 px-3 py-3 text-2sm font-black text-emerald-700">لا توجد تكرارات داخل الملف.</div>
                        )}
                      </div>
                    ) : null}
                    {false && issueTab === "existing" ? (
                      <div className="space-y-3">
                        <div className="rounded-sm border border-sky-100 bg-sky-50 px-3 py-3 text-2sm font-bold text-sky-800">
                          المنتجات الموجودة بالفعل يتم تخطيها افتراضيا إذا كان الكود واسم الصنف مطابقين للنظام. لن يتم تحديث السعر أو المخزون إلا إذا غيرت الإجراء هنا.
                        </div>
                        {exactExistingRows.length ? exactExistingRows.map((row) => {
                          const existing = findExactExistingProduct(databaseItems, row);
                          return (
                            <div key={row.__rowNumber} className="grid gap-2 rounded-sm border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_180px] md:items-center">
                              <div className="min-w-0">
                                <div className="truncate text-2sm font-black text-slate-900">{row.name}</div>
                                <div className="mt-1 text-[11px] font-bold text-slate-500">الكود: {row.code}، موجود بالنظام: {existing?.name}</div>
                              </div>
                              <select value={rowAction(row)} onChange={(event) => setActions((prev) => ({ ...prev, [row.__rowNumber]: event.target.value }))} className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-2sm font-bold">
                                <option value="skip">تخطي المنتج الموجود</option>
                                <option value="update">تحديث المنتج الموجود</option>
                              </select>
                            </div>
                          );
                        }) : (
                          <div className="rounded-sm border border-emerald-100 bg-emerald-50 px-3 py-3 text-2sm font-black text-emerald-700">لا توجد منتجات مطابقة للكود والاسم في النظام.</div>
                        )}
                      </div>
                    ) : null}
                    {false && issueTab === "bulk" ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 lg:grid-cols-2">
                          <div className="rounded-sm border border-rose-100 bg-rose-50 p-3">
                            <div className="text-2sm font-black text-rose-800">إصلاح أخطاء الوحدة</div>
                            <div className="mt-1 text-[11px] font-bold text-rose-700">{unitErrorCount} صف يحتاج وحدة موجودة في النظام.</div>
                            <select value={quickUnitValue} onChange={(event) => setQuickUnitValue(event.target.value)} className="mt-3 w-full rounded-sm border border-rose-200 bg-white px-3 py-2 text-2sm font-bold">
                              <option value="">اختر وحدة تطبق على الأخطاء</option>
                              {units.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
                            </select>
                            <button type="button" disabled={!quickUnitValue || !unitErrorCount} onClick={() => applyValueToRows("unit_name", quickUnitValue, rowsForScope("unit_name", "invalid"), "الوحدة")} className="mt-2 w-full rounded-sm bg-rose-600 px-4 py-2.5 text-2sm font-black text-white disabled:opacity-40">تطبيق الوحدة على كل أخطاء الوحدة</button>
                          </div>
                          <div className="rounded-sm border border-sky-100 bg-sky-50 p-3">
                            <div className="text-2sm font-black text-sky-800">إصلاح المخزن</div>
                            <div className="mt-1 text-[11px] font-bold text-sky-700">اختر مخزنا من النظام وطبقه على صفوف المخزون أو الأخطاء.</div>
                            <select value={quickWarehouseValue} onChange={(event) => setQuickWarehouseValue(event.target.value)} className="mt-3 w-full rounded-sm border border-sky-200 bg-white px-3 py-2 text-2sm font-bold">
                              <option value="">اختر مخزن</option>
                              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                            </select>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <button type="button" disabled={!quickWarehouseValue || !warehouseErrorCount} onClick={() => applyValueToRows("warehouse_id", quickWarehouseValue, rowsForScope("warehouse_id", "invalid"), "المخزن")} className="rounded-sm bg-sky-700 px-3 py-2 text-[11px] font-black text-white disabled:opacity-40">على أخطاء المخزن</button>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-sm border border-slate-200 bg-white p-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-2sm font-black text-slate-900">إصلاح متقدم للصفوف المحددة</div>
                              <div className="text-[11px] font-bold text-slate-500">استخدمه عندما تريد قيمة محددة لحقل معين على نطاق معين.</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => selectRows(visibleRows)} className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600">تحديد الظاهر</button>
                              <button type="button" onClick={() => setSelectedRows(new Set())} className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600">إلغاء التحديد</button>
                            </div>
                          </div>
                        <label className="block">
                          <span className="text-[11px] font-black text-slate-400">الحقل</span>
                          <select value={bulkField} onChange={(event) => { setBulkField(event.target.value); setBulkValue(""); }} className="mt-1 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-2sm font-bold">
                            {BULK_FIELDS.map((field) => <option key={field} value={field}>{FIELD_META[field]?.label || field}</option>)}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-black text-slate-400">القيمة</span>
                          {bulkField === "unit_name" ? (
                            <select value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} className="mt-1 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-2sm font-bold">
                              <option value="">اختر وحدة من النظام</option>
                              {units.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
                            </select>
                          ) : bulkField === "warehouse_id" ? (
                            <select value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} className="mt-1 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-2sm font-bold">
                              <option value="">اختر مخزن من النظام</option>
                              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                            </select>
                          ) : bulkField === "item_type" ? (
                            <select value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} className="mt-1 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-2sm font-bold">
                              <option value="">اختر النوع</option>
                              <option value="product">منتج</option>
                              <option value="service">خدمة</option>
                            </select>
                          ) : (
                            <input type="number" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} className="mt-1 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-2sm font-bold" />
                          )}
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-black text-slate-400">النطاق</span>
                          <select value={bulkScope} onChange={(event) => setBulkScope(event.target.value)} className="mt-1 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-2sm font-bold">
                            <option value="selected">الصفوف المحددة ({selectedRows.size})</option>
                            <option value="invalid">صفوف الأخطاء</option>
                            <option value="duplicates">صفوف التكرار</option>
                            <option value="visible">الصفوف الظاهرة</option>
                            <option value="all">كل الصفوف</option>
                          </select>
                        </label>
                        <button type="button" onClick={applyBulkEdit} disabled={!bulkValue || (bulkScope === "selected" && selectedRows.size === 0)} className="w-full rounded-sm bg-slate-900 px-4 py-2.5 text-2sm font-black text-white disabled:opacity-40">
                          <Wrench className="ml-2 inline h-4 w-4" />
                          تطبيق الإصلاح
                        </button>
                        </div>
                      </div>
                    ) : null}
                    {false && issueTab === "columns" ? (
                      <div className="space-y-3">
                        <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-3 text-2sm font-bold text-slate-600">افتح شريط "الأعمدة المرتبطة" أعلى الجدول لتعديل الربط. الحقول المهمة: الكود، اسم الصنف، المخزون، الوحدة، السعر، ومخزن النظام عند وجود مخازن.</div>
                        <button type="button" onClick={() => setColumnMappingOpen(true)} className="w-full rounded-sm bg-slate-900 px-4 py-2.5 text-2sm font-black text-white">فتح ربط الأعمدة</button>
                      </div>
                    ) : null}
                  </div>
                </aside>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-black text-slate-900">مراجعة الصفوف والتكرارات</h3>
                <p className="text-2sm font-bold text-slate-500">جاهز {counts.ready || 0}، موجود مسبقا {counts.existing || 0}، محتمل التكرار {counts.possible_duplicate || 0}، مكرر بالملف {counts.file_duplicate || 0}، غير صالح {counts.invalid || 0}</p>
              </div>
              <div className="flex items-center gap-2">
                {preview ? (
                  <span className="rounded-sm border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-black text-sky-800">
                    معاينة: إضافة {preview.inserted || 0}، تحديث {preview.updated || 0}، تخطي {preview.skipped || 0}
                  </span>
                ) : null}
                <button type="button" onClick={() => setStep(2)} className="rounded-sm border border-slate-200 bg-white px-4 py-2 text-2sm font-black text-slate-600">رجوع للربط</button>
                <button type="button" onClick={handlePreview} disabled={loading || blockingIssues.length > 0} className="rounded-sm border border-sky-300 bg-sky-50 px-4 py-2 text-2sm font-black text-sky-700 disabled:cursor-not-allowed disabled:opacity-40">معاينة</button>
                <button type="button" onClick={handleImport} disabled={loading || blockingIssues.length > 0} className="rounded-sm bg-emerald-600 px-5 py-2 text-2sm font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-40">{loading ? "جاري التنفيذ..." : "تنفيذ الاستيراد"}</button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["جاهز للإضافة", importStats.readyRows, "border-emerald-200 bg-emerald-50 text-emerald-800"],
                ["موجود مسبقا", importStats.existingRows, "border-sky-200 bg-sky-50 text-sky-800"],
                ["بحاجة مراجعة", importStats.warningRows, "border-amber-200 bg-amber-50 text-amber-800"],
                ["غير صالح", importStats.invalidRows, "border-rose-200 bg-rose-50 text-rose-800"],
                ["إجمالي الصفوف", importStats.totalRows, "border-slate-200 bg-white text-slate-800"],
              ].map(([label, value, cls]) => (
                <div key={label} className={`rounded-sm border px-3 py-2 ${cls}`}>
                  <div className="flex items-center gap-2 text-[11px] font-black">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <div className="mt-1 text-[18px] font-black">{value}</div>
                </div>
              ))}
            </div>
            <div className="grid max-h-[620px] gap-3 overflow-auto rounded-sm border border-slate-200 bg-slate-50 p-3">
              {analyzedRows.map((row) => {
                const rowHasError = issuesForRow(row.__rowNumber).some((issue) => issue.severity === "error") || row.__status === "invalid";
                const action = rowAction(row);
                const warehouseIssues = issuesFor(row.__rowNumber, "warehouse_id");
                const unitIssues = issuesFor(row.__rowNumber, "unit_name");
                const categoryIssues = issuesFor(row.__rowNumber, "category_name");
                const rowMessages = [...row.__errors, ...row.__warnings, ...issuesForRow(row.__rowNumber).map((issue) => issue.message)].filter(Boolean);
                return (
                  <div key={row.__rowNumber} className={`rounded-md border bg-white p-3 shadow-sm ${rowHasError ? "border-rose-200" : action === "skip" ? "border-slate-200 opacity-80" : row.__status === "existing" ? "border-sky-200" : "border-emerald-100"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-[260px] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-sm bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">صف {row.__rowNumber}</span>
                          <span className={`rounded-sm px-2 py-1 text-[11px] font-black ${rowHasError ? "bg-rose-100 text-rose-700" : row.__status === "existing" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {statusLabel(row.__status)}
                          </span>
                          <span className="rounded-sm bg-slate-900 px-2 py-1 text-[11px] font-black text-white">{actionLabel(action)}</span>
                        </div>
                        <div className="mt-2 text-sm font-black text-slate-900">{row.name || "بدون اسم"}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                          <span className="font-mono">SKU: {row.code || "-"}</span>
                          {row.barcode ? <span>باركود: {row.barcode}</span> : null}
                        </div>
                      </div>
                      <select value={action} disabled={row.__status === "invalid"} onChange={(event) => setActions((prev) => ({ ...prev, [row.__rowNumber]: event.target.value }))} className="min-w-[180px] rounded-sm border border-slate-200 bg-white px-3 py-2 text-2sm font-black text-slate-800">
                        <option value="insert">إضافة منتج جديد</option>
                        <option value="update">تحديث المنتج الموجود</option>
                        <option value="warehouse_stock">استلام مخزون فقط</option>
                        <option value="skip">تخطي</option>
                      </select>
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      <div className={`rounded-sm border px-3 py-2 ${categoryIssues.length ? "border-amber-200 bg-amber-50" : "border-emerald-100 bg-emerald-50"}`}>
                        <div className="text-[11px] font-black text-slate-500">الفئة من SKU</div>
                        <div className="mt-1 text-2sm font-black text-slate-800">{categoryLabelForRow(row)}</div>
                      </div>
                      <label className={`rounded-sm border px-3 py-2 ${unitIssues.some((issue) => issue.severity === "error") ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
                        <div className="mb-1 text-[11px] font-black text-slate-500">الوحدة</div>
                        <select value={row.unit_name || ""} onChange={(event) => updateRowValue(row.__rowNumber, "unit_name", event.target.value)} className="w-full rounded-sm border border-slate-200 bg-white px-2 py-1.5 text-2sm font-bold">
                          <option value="">اختر وحدة</option>
                          {units.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
                        </select>
                      </label>
                      <label className={`rounded-sm border px-3 py-2 ${warehouseIssues.some((issue) => issue.severity === "error") ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
                        <div className="mb-1 text-[11px] font-black text-slate-500">المخزن الذي سيستلم الكمية</div>
                        <select value={resolvedWarehouseId(warehouses, row)} onChange={(event) => updateRowValue(row.__rowNumber, "warehouse_id", event.target.value)} disabled={row.__duplicatePolicy === "warehouse"} className="w-full rounded-sm border border-slate-200 bg-white px-2 py-1.5 text-2sm font-bold disabled:bg-slate-100">
                          <option value="">اختر مخزن</option>
                          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                        </select>
                      </label>
                      <div className="rounded-sm border border-slate-200 bg-white px-3 py-2">
                        <div className="text-[11px] font-black text-slate-500">الكمية والأسعار</div>
                        <div className="mt-1 grid grid-cols-3 gap-2 text-2sm font-black text-slate-800">
                          <span>كمية: {Number(row.stock_quantity || 0)}</span>
                          <span>شراء: {Number(row.purchase_price || 0)}</span>
                          <span>بيع: {Number(row.sale_price || 0)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 lg:grid-cols-2">
                      <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-black text-slate-500">ما سيحدث عند الاستيراد</div>
                        <div className="mt-1 space-y-1">
                          {changePreviewForRow(row).slice(0, 5).map((message, index) => (
                            <div key={index} className="text-[11px] font-bold text-slate-700">{message}</div>
                          ))}
                        </div>
                      </div>
                      {rowMessages.length ? (
                        <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
                          {[...new Set(rowMessages)].join("، ")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden max-h-[560px] overflow-x-auto overflow-y-auto rounded-sm border border-slate-200">
              <table className="min-w-[1500px] text-right text-2sm">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-3">الصف</th>
                    <th className="px-3 py-3">الحالة</th>
                    <th className="px-3 py-3">الإجراء</th>
                    <th className="px-3 py-3">الكود</th>
                    <th className="px-3 py-3">الاسم</th>
                    <th className="px-3 py-3">الباركود</th>
                    <th className="px-3 py-3">الفئة</th>
                    <th className="px-3 py-3">الوحدة</th>
                    <th className="px-3 py-3">مخزن النظام</th>
                    <th className="px-3 py-3">قرار المخزون</th>
                    <th className="px-3 py-3">البيع</th>
                    <th className="px-3 py-3">الشراء</th>
                    <th className="px-3 py-3">المطابقة</th>
                  </tr>
                </thead>
                <tbody>
                  {analyzedRows.map((row) => {
                    const categoryIssues = issuesFor(row.__rowNumber, "category_name");
                    const unitIssues = issuesFor(row.__rowNumber, "unit_name");
                    const warehouseIssues = issuesFor(row.__rowNumber, "warehouse_id");
                    const storageIssues = issuesFor(row.__rowNumber, "storage_plan");
                    const rowMessages = [...row.__errors, ...row.__warnings, ...issuesForRow(row.__rowNumber).map((issue) => issue.message)].filter(Boolean);
                    return (
                      <tr key={row.__rowNumber} className={`border-t border-slate-100 ${issuesForRow(row.__rowNumber).some((issue) => issue.severity === "error") || row.__status === "invalid" ? "bg-rose-50" : row.__status === "ready" ? "bg-white" : "bg-amber-50/60"}`}>
                        <td className="px-3 py-2 font-black text-slate-500">{row.__rowNumber}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-sm px-2 py-1 text-[11px] font-black ${issuesForRow(row.__rowNumber).some((issue) => issue.severity === "error") || row.__status === "invalid" ? "bg-rose-100 text-rose-700" : row.__status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                            {row.__status === "ready" ? "جاهز" : row.__status === "existing" ? "موجود" : row.__status === "possible_duplicate" ? "تشابه اسم" : row.__status === "file_duplicate" ? "مكرر ملف" : "خطأ"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <select value={rowAction(row)} disabled={row.__status === "invalid"} onChange={(event) => setActions((prev) => ({ ...prev, [row.__rowNumber]: event.target.value }))} className="w-36 rounded-sm border border-slate-200 bg-white px-2 py-1.5 font-bold">
                            <option value="insert">إضافة جديد</option>
                            <option value="update">تحديث الموجود</option>
                            <option value="warehouse_stock">مخزون مخزن مختلف</option>
                            <option value="skip">تخطي</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input value={row.code || ""} readOnly className="w-24 rounded-sm border border-slate-200 bg-slate-100 px-2 py-1.5 font-mono text-slate-500 outline-none" />
                        </td>
                        <td className="px-3 py-2">
                          <input value={row.name || ""} onChange={(event) => updateRowValue(row.__rowNumber, "name", event.target.value)} className="w-48 rounded-sm border border-slate-200 bg-white px-2 py-1.5 font-bold text-slate-800 outline-none focus:border-slate-800" />
                        </td>
                        <td className="px-3 py-2">
                          <input value={row.barcode || ""} onChange={(event) => updateRowValue(row.__rowNumber, "barcode", event.target.value)} className="w-36 rounded-sm border border-slate-200 bg-white px-2 py-1.5 font-mono outline-none focus:border-slate-800" />
                        </td>
                        <td className="px-3 py-2 align-top">
                          {(() => {
                            const sku = parseSkuCode(row.code);
                            const category = sku ? categoryBySkuPrefix(systemCategories, sku.prefix) : null;
                            return (
                              <div className={`w-44 rounded-sm border px-2 py-1.5 font-bold ${category ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                                {category ? `[${category.sku_prefix}] ${category.name}` : sku ? `سيتم إنشاء فئة ${sku.prefix}` : "SKU غير صحيح"}
                              </div>
                            );
                          })()}
                          {categoryIssues.map((issue, index) => <div key={index} className="mt-1 text-[11px] font-bold text-rose-600">{issue.message}</div>)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <select value={row.unit_name || ""} onChange={(event) => updateRowValue(row.__rowNumber, "unit_name", event.target.value)} className={`w-32 rounded-sm border bg-white px-2 py-1.5 font-bold outline-none focus:border-slate-800 ${unitIssues.some((issue) => issue.severity === "error") ? "border-rose-300 text-rose-700" : "border-slate-200"}`}>
                            <option value="">اختر وحدة</option>
                            {units.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
                          </select>
                          {unitIssues.map((issue, index) => <div key={index} className="mt-1 text-[11px] font-bold text-rose-600">{issue.message}</div>)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {row.__duplicatePolicy === "warehouse" ? (
                            <div className="w-44 rounded-sm border border-slate-100 bg-slate-50 px-2 py-2 text-[11px] font-bold text-slate-500">يتحدد من قرار المخزون</div>
                          ) : (
                            <select value={resolvedWarehouseId(warehouses, row)} onChange={(event) => updateRowValue(row.__rowNumber, "warehouse_id", event.target.value)} className={`w-44 rounded-sm border bg-white px-2 py-1.5 font-bold outline-none focus:border-slate-800 ${warehouseIssues.some((issue) => issue.severity === "error") ? "border-rose-300 text-rose-700" : "border-slate-200"}`}>
                              <option value="">اختر مخزن</option>
                              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                            </select>
                          )}
                          {warehouseIssues.map((issue, index) => <div key={index} className="mt-1 text-[11px] font-bold text-rose-600">{issue.message}</div>)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {row.__duplicatePolicy === "warehouse" && Array.isArray(row.__warehouseDistribution) ? (
                            <div className="w-64 space-y-1">
                              {row.__warehouseDistribution.map((item) => (
                                <div key={item.__rowNumber} className="grid grid-cols-[54px_1fr] items-center gap-1">
                                  <span className="text-[11px] font-black text-slate-400">صف {item.__rowNumber}</span>
                                  <select value={explicitWarehouseId(warehouses, item)} onChange={(event) => updateRowValue(item.__rowNumber, "warehouse_id", event.target.value)} className="rounded-sm border border-slate-200 bg-white px-2 py-1.5 font-bold outline-none focus:border-slate-800">
                                    <option value="">اختر مخزن</option>
                                    {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                                  </select>
                                </div>
                              ))}
                              {storageIssues.map((issue, index) => <div key={index} className="mt-1 text-[11px] font-bold text-rose-600">{issue.message}</div>)}
                            </div>
                          ) : (
                            <span className="rounded-sm bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">{row.__duplicatePolicy === "combine" ? "دمج الكميات" : row.__duplicatePolicy === "skip" ? "تخطي" : "صف واحد"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={row.sale_price || ""} onChange={(event) => updateRowValue(row.__rowNumber, "sale_price", event.target.value)} className="w-24 rounded-sm border border-slate-200 bg-white px-2 py-1.5 outline-none focus:border-slate-800" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={row.purchase_price || ""} onChange={(event) => updateRowValue(row.__rowNumber, "purchase_price", event.target.value)} className="w-24 rounded-sm border border-slate-200 bg-white px-2 py-1.5 outline-none focus:border-slate-800" />
                        </td>
                        <td className="max-w-[360px] px-3 py-2 text-slate-500">
                          {row.__existing ? (
                            <div className="space-y-1">
                              <div className="font-black text-slate-700">{row.__matchField}: {row.__existing.name}</div>
                              {changePreviewForRow(row).slice(0, 4).map((message, index) => (
                                <div key={index} className="rounded-sm bg-white/70 px-2 py-1 text-[11px] font-bold text-slate-600">
                                  {message}
                                </div>
                              ))}
                            </div>
                          ) : (
                            [...new Set(rowMessages)].join("، ")
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="rounded-sm border border-slate-200 bg-slate-50 px-6 py-10 text-center">
            {Number(result?.failed || 0) > 0 ? <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" /> : <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />}
            <h3 className="mt-4 text-[22px] font-black text-slate-900">انتهى الاستيراد</h3>
            <p className="mt-2 text-sm font-bold text-slate-500">تمت إضافة {result?.inserted || 0}، تحديث {result?.updated || 0}، تخطي {result?.skipped || 0}، فشل {result?.failed || 0}.</p>
            <button type="button" onClick={close} className="mt-6 rounded-sm bg-slate-900 px-8 py-3 text-sm font-black text-white">إغلاق</button>
          </div>
        ) : null}
      </div>
  );

  if (embedded) return body;
  return (
    <Modal open={open} onClose={close} title="استيراد ذكي للأصناف من Excel" maxWidth="max-w-[calc(100vw-3rem)]">
      {body}
    </Modal>
  );
}
