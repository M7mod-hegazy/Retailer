import { useCallback, useEffect, useMemo, useRef, useState, startTransition, useDeferredValue } from "react";
import toast from "react-hot-toast";
import api from "../../../services/api";
import {
  ITEM_FIELDS,
  analyzeRows,
  detectColumnHeaders,
  detectHeaderRow,
  downloadImportTemplate,
  mappingConfidence,
  normalizeKey,
  parseExcelFile,
  parseMappedRows,
  toApiPayload,
} from "../../../utils/excelImportExport";

export const FIELD_ORDER = [
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

export const FIELD_META = {
  code: { label: "الكود", type: "text", minWidth: 128, readOnly: true },
  name: { label: "اسم الصنف", type: "text", minWidth: 260 },
  barcode: { label: "الباركود", type: "text", minWidth: 150 },
  store_name: { label: "المخزن في الملف", type: "text", minWidth: 150 },
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

export const BULK_FIELDS = ["unit_name", "warehouse_id", "purchase_price", "sale_price", "wholesale_price", "min_stock_qty", "item_type"];

function hasOption(options, value, extraKeys = []) {
  const key = normalizeKey(value);
  if (!key) return true;
  return options.some((option) => [option.name, option.symbol, ...extraKeys.map((extra) => option[extra])].some((candidate) => normalizeKey(candidate) === key));
}

export function findWarehouse(warehouses, row) {
  if (row.warehouse_id) {
    const id = Number(row.warehouse_id);
    const match = warehouses.find((warehouse) => Number(warehouse.id) === id);
    if (match) return match;
  }
  const name = normalizeKey(row.store_name || row.warehouse_name);
  if (!name) return null;
  return warehouses.find((warehouse) => normalizeKey(warehouse.name) === name || normalizeKey(warehouse.code) === name) || null;
}

export function defaultWarehouse(warehouses) {
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

export function parseSkuCode(code) {
  const source = normalizeSkuDigitText(code).trim();
  const match = source.match(/^(\d+)\.(\d+)$/);
  if (!match) return null;
  return { prefix: match[1], sequence: Number(match[2]), code: source };
}

export function categoryBySkuPrefix(categories, prefix) {
  return categories.find((category) => String(category.sku_prefix || "").trim() === String(prefix || "").trim()) || null;
}

function categoryForSku(categories, row) {
  const sku = parseSkuCode(row.code);
  if (!sku) return null;
  return categoryBySkuPrefix(categories, sku.prefix);
}

export function resolvedWarehouseId(warehouses, row) {
  return row.warehouse_id || findWarehouse(warehouses, row)?.id || defaultWarehouse(warehouses)?.id || "";
}

export function explicitWarehouseId(warehouses, row) {
  return row.warehouse_id || findWarehouse(warehouses, row)?.id || "";
}

function buildExistingIndex(items) {
  const byCode = new Map();
  const byBarcode = new Map();
  const byName = new Map();
  (items || []).forEach((item) => {
    const code = normalizeKey(item.code);
    const barcode = normalizeKey(item.barcode);
    const name = normalizeKey(item.name);
    if (code) byCode.set(code, item);
    if (barcode) byBarcode.set(barcode, item);
    if (name) byName.set(name, item);
  });
  return { byCode, byBarcode, byName };
}

function findExactExistingProductInIndex(index, row) {
  const code = normalizeKey(row.code);
  if (code) { const found = index.byCode.get(code); if (found) return found; }
  const barcode = normalizeKey(row.barcode);
  if (barcode) { const found = index.byBarcode.get(barcode); if (found) return found; }
  const name = normalizeKey(row.name);
  if (name) { const found = index.byName.get(name); if (found) return found; }
  return null;
}

function findExactExistingProduct(items, row) {
  for (const field of ["barcode", "code", "name"]) {
    const key = normalizeKey(row[field]);
    if (!key) continue;
    const found = items.find((item) => normalizeKey(item[field]) === key);
    if (found) return found;
  }
  return null;
}

function validateRowsForApp(rows, mapping, units, categories, warehouses, options = {}) {
  const issues = [];
  if (!Object.values(mapping).includes("name")) {
    issues.push({ scope: "global", severity: "error", field: "name", message: "يجب ربط عمود اسم الصنف قبل المتابعة." });
  }
  rows.forEach((row) => {
    if (!String(row.name || "").trim()) {
      issues.push({ rowNumber: row.__rowNumber, field: "name", severity: "error", message: "اسم الصنف مطلوب." });
    }
    const sku = parseSkuCode(row.code);
    if (!String(row.code || "").trim()) {
      issues.push({ rowNumber: row.__rowNumber, field: "code", severity: "warning", message: "لا يوجد SKU. يمكن تعيينه قبل المعاينة." });
    } else if (!sku) {
      issues.push({ rowNumber: row.__rowNumber, field: "code", severity: "warning", message: "صيغة SKU غير واضحة. استخدم رقم الفئة ثم نقطة ثم رقم الصنف." });
    }

    const unitName = String(row.unit_name || "").trim();
    const codeKey = normalizeKey(row.code);
    const barcodeKey = normalizeKey(row.barcode);
    const nameKey = normalizeKey(row.name);
    const exists = Boolean(
      options.databaseKeys?.has(codeKey) ||
      options.databaseKeys?.has(barcodeKey) ||
      options.databaseKeys?.has(nameKey)
    );

    if (!unitName) {
      if (!exists) {
        issues.push({ rowNumber: row.__rowNumber, field: "unit_name", severity: "error", message: "الوحدة مطلوبة للمنتجات الجديدة." });
      }
    } else if (!hasOption(units, row.unit_name)) {
      issues.push({ rowNumber: row.__rowNumber, field: "unit_name", severity: "error", message: `الوحدة "${row.unit_name}" غير موجودة في النظام.` });
    }
    if (sku && !categoryBySkuPrefix(categories, sku.prefix)) {
      issues.push({ rowNumber: row.__rowNumber, field: "category_name", severity: "warning", message: `سيتم إنشاء فئة برقم ${sku.prefix} قبل الاستيراد.` });
    }
    const sourceWarehouseName = String(row.store_name || row.warehouse_name || "").trim();
    const sourceWarehouseExists = !sourceWarehouseName || warehouses.some((warehouse) => normalizeKey(warehouse.name) === normalizeKey(sourceWarehouseName) || normalizeKey(warehouse.code) === normalizeKey(sourceWarehouseName));
    if (sourceWarehouseName && !sourceWarehouseExists && !row.warehouse_id) {
      issues.push({ rowNumber: row.__rowNumber, field: "warehouse_id", severity: "error", message: `المخزن "${sourceWarehouseName}" غير موجود في النظام. أنشئه أو اختر مخزنا بديلا.` });
    } else if (!warehouses.length || !resolvedWarehouseId(warehouses, row)) {
      issues.push({ rowNumber: row.__rowNumber, field: "warehouse_id", severity: "error", message: "اختر مخزن النظام الذي سيستلم الكمية." });
    }
    if (options.requireExplicitWarehouse?.has(row.__rowNumber) && !explicitWarehouseId(warehouses, row)) {
      issues.push({ rowNumber: row.__rowNumber, field: "warehouse_id", severity: "error", message: "هذا الصف موزع على المخازن ويحتاج مخزنا محددا." });
    }
    if (row.__duplicatePolicy === "warehouse" && Array.isArray(row.__warehouseDistribution)) {
      row.__warehouseDistribution.forEach((item) => {
        if (!explicitWarehouseId(warehouses, item)) {
          issues.push({ rowNumber: row.__rowNumber, field: "storage_plan", severity: "error", message: `اختر مخزن صف ${item.__rowNumber} داخل قرار المخزون.` });
        }
      });
    }
  });
  return issues;
}

export function duplicateKeyForRow(row) {
  return normalizeKey(row.code) || normalizeKey(row.barcode) || normalizeKey(row.name);
}

function warehouseNameExists(warehouses, name) {
  const key = normalizeKey(name);
  if (!key) return true;
  return warehouses.some((warehouse) => normalizeKey(warehouse.name) === key || normalizeKey(warehouse.code) === key);
}

export function duplicateGroupsForRows(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    if (row.__skuConflictAction === "skip") return;
    const key = duplicateKeyForRow(row);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return [...groups.values()].filter((group) => group.length > 1);
}

function skuConflictGroupsForRows(rows) {
  const byCode = new Map();
  rows.forEach((row) => {
    if (row.__skuConflictAction === "skip") return;
    const code = String(row.code || "").trim();
    const key = normalizeKey(code);
    if (!key) return;
    if (!byCode.has(key)) byCode.set(key, { code, rows: [], names: new Map() });
    const entry = byCode.get(key);
    entry.rows.push(row);
    const nameKey = normalizeKey(row.name);
    if (nameKey && !entry.names.has(nameKey)) entry.names.set(nameKey, String(row.name || "").trim());
  });
  return [...byCode.values()]
    .map((entry) => {
      const nameList = [...entry.names.values()];
      return { ...entry, nameList, fileNameConflict: nameList.length > 1 };
    })
    .filter((entry) => entry.fileNameConflict);
}

function policyForDuplicateKey(key, defaultPolicy, policyByKey) {
  return policyByKey[key] || defaultPolicy;
}

function applyDuplicatePolicies(rows, defaultPolicy, policyByKey) {
  const duplicateKeys = new Set(duplicateGroupsForRows(rows).map((group) => duplicateKeyForRow(group[0])));
  const combined = new Map();
  const distributed = new Map();
  const output = [];
  rows.forEach((row) => {
    if (row.__skuConflictAction === "skip") {
      output.push({ ...row, __duplicatePolicy: "keep" });
      return;
    }
    const key = duplicateKeyForRow(row);
    const policy = duplicateKeys.has(key) ? policyForDuplicateKey(key, defaultPolicy, policyByKey) : "keep";
    if (policy === "warehouse") {
      if (!distributed.has(key)) {
        const next = { ...row, __duplicatePolicy: "warehouse", __warehouseDistribution: [{ ...row }], stock_quantity: Number(row.stock_quantity || 0) };
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

export function useImportWizard({ items, categories, units, selectedCategoryId = null, onImported } = {}) {
  const [fileName, setFileName] = useState("");
  const [sourceFile, setSourceFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rawRows, setRawRows] = useState([]);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [mapping, setMapping] = useState({});
  const [actions, setActions] = useState({});
  const [rowOverrides, setRowOverrides] = useState({});
  const [databaseItems, setDatabaseItems] = useState(items || []);
  useEffect(() => {
    setDatabaseItems(items || []);
  }, [items]);
  const [createdCategories, setCreatedCategories] = useState([]);
  const [createdUnits, setCreatedUnits] = useState([]);
  const [createdWarehouses, setCreatedWarehouses] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, dir: "asc" });
  const [colWidths, setColWidths] = useState({});
  const [bulkField, setBulkField] = useState("unit_name");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkScope, setBulkScope] = useState("selected");
  const [quickUnitValue, setQuickUnitValue] = useState("");
  const [quickWarehouseValue, setQuickWarehouseValue] = useState("");
  const [skuCategoryNames, setSkuCategoryNames] = useState({});
  const [lastAppliedFix, setLastAppliedFix] = useState(null);
  const [duplicateMode, setDuplicateMode] = useState("combine");
  const [duplicatePolicies, setDuplicatePolicies] = useState({});
  const [duplicatesConfirmed, setDuplicatesConfirmed] = useState(false);
  const [pricePolicies, setPricePolicies] = useState({});
  const [rowPriceOverrides, setRowPriceOverrides] = useState({});
  const [selectedRows, setSelectedRows] = useState(() => new Set());
  const [removedRows, setRemovedRows] = useState(() => new Set());
  const [rowFilter, setRowFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(false);
  const [skuConflictsResolved, setSkuConflictsResolved] = useState(false);
  const [categorySyncing, setCategorySyncing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [validationReturn, setValidationReturn] = useState(null);
  const [updateExistingPrices, setUpdateExistingPrices] = useState(true);
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
  const allUnits = useMemo(() => {
    const seen = new Set();
    return [...(units || []), ...createdUnits].filter((unit) => {
      const key = normalizeKey(unit.name || unit.symbol || unit.id);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [createdUnits, units]);
  const allWarehouses = useMemo(() => {
    const seen = new Set();
    return [...warehouses, ...createdWarehouses].filter((warehouse) => {
      const key = String(warehouse.id || normalizeKey(warehouse.name || warehouse.code));
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [createdWarehouses, warehouses]);
  const parsedRows = useMemo(() => parseMappedRows(rawRows, headerIndex, mapping), [headerIndex, mapping, rawRows]);
  const editableRows = useMemo(
    () => parsedRows.filter((row) => !removedRows.has(row.__rowNumber)).map((row) => ({ ...row, ...(rowOverrides[row.__rowNumber] || {}) })),
    [parsedRows, removedRows, rowOverrides],
  );
  const duplicateGroups = useMemo(() => duplicateGroupsForRows(editableRows), [editableRows]);
  const fileSkuConflicts = useMemo(() => skuConflictGroupsForRows(editableRows), [editableRows]);
  const skuConflictIssues = useMemo(() => fileSkuConflicts.flatMap((conflict) => {
    return conflict.rows.map((row) => ({
      rowNumber: row.__rowNumber,
      field: "code",
      severity: "error",
      message: `كود ${conflict.code} يتعارض بين صفوف: ${conflict.nameList.join(" / ")}.`,
    }));
  }), [fileSkuConflicts]);
  const duplicateRowNumbers = useMemo(() => new Set(duplicateGroups.flatMap((group) => group.map((row) => row.__rowNumber))), [duplicateGroups]);
  const workingRows = useMemo(() => applyDuplicatePolicies(editableRows, duplicateMode, duplicatePolicies), [duplicateMode, duplicatePolicies, editableRows]);
  const warehouseRequiredRows = useMemo(() => new Set(), []);
  const hasSourceStores = useMemo(() => editableRows.some((row) => String(row.store_name || "").trim()), [editableRows]);
  const databaseKeys = useMemo(() => {
    const keys = new Set();
    (databaseItems || []).forEach((item) => {
      if (item.code) keys.add(normalizeKey(item.code));
      if (item.barcode) keys.add(normalizeKey(item.barcode));
      if (item.name) keys.add(normalizeKey(item.name));
    });
    return keys;
  }, [databaseItems]);

  const validationIssues = useMemo(
    () => [
      ...validateRowsForApp(workingRows, mapping, allUnits, systemCategories, allWarehouses, {
        existingSkuByCode: new Map((databaseItems || []).map((item) => [normalizeKey(item.code), item]).filter(([code]) => code)),
        requireExplicitWarehouse: warehouseRequiredRows,
        databaseKeys,
      }),
      ...skuConflictIssues,
    ],
    [allUnits, allWarehouses, databaseItems, mapping, skuConflictIssues, systemCategories, warehouseRequiredRows, workingRows, databaseKeys],
  );
  const blockingIssues = useMemo(() => validationIssues.filter((issue) => issue.severity === "error"), [validationIssues]);

  const ISSUE_TO_STEP = {
    name: "columns",
    code: "categories",
    unit_name: "units",
    warehouse_id: "warehouses",
    storage_plan: "duplicates",
    category_name: "categories",
  };

  const blockingIssuesByType = useMemo(() => {
    const byType = {};
    blockingIssues.forEach((issue) => {
      const stepId = ISSUE_TO_STEP[issue.field] || "review";
      if (!byType[stepId]) byType[stepId] = { count: 0, stepId, field: issue.field, sample: issue.message };
      byType[stepId].count += 1;
    });
    return Object.values(byType).sort((a, b) => b.count - a.count);
  }, [blockingIssues]);

  const hasBlockingIssues = blockingIssues.length > 0;
  const analyzedRows = useMemo(() => analyzeRows(workingRows, databaseItems || []), [databaseItems, workingRows]);
  const exactExistingRows = useMemo(() => analyzedRows.filter((row) => row.__existing), [analyzedRows]);

  const existingIndex = useMemo(() => buildExistingIndex(databaseItems), [databaseItems]);

  const rowAction = useCallback(function(row) {
    if (row.__skuConflictAction === "skip") return "skip";
    if (actions[row.__rowNumber]) return actions[row.__rowNumber];
    if (findExactExistingProductInIndex(existingIndex, row)) return "update";
    const policy = row.__duplicatePolicy || policyForDuplicateKey(duplicateKeyForRow(row), duplicateMode, duplicatePolicies);
    if (policy === "skip") return "skip";
    if (policy === "warehouse" && row.__status === "file_duplicate") return "warehouse_stock";
    if (policy === "keep" && row.__status === "file_duplicate") return "insert";
    return row.__status === "ready" ? "insert" : row.__status === "existing" ? "update" : "skip";
  }, [actions, existingIndex, duplicateMode, duplicatePolicies]);

  const PRICE_FIELDS = ["sale_price", "purchase_price", "wholesale_price"];
  const pricedRows = useMemo(() => exactExistingRows.filter((row) => {
    if (!updateExistingPrices) return false;
    // include skipped existing rows too — we'll send prices-only for them
    const action = rowAction(row);
    if (action !== "update" && action !== "skip") return false;
    const existing = row.__existing;
    if (!existing) return false;
    return PRICE_FIELDS.some((field) => {
      const fileVal = String(row[field] ?? "").trim();
      if (!fileVal) return false;
      return fileVal !== String(existing[field] ?? "").trim();
    });
  }), [exactExistingRows, updateExistingPrices, rowAction]);
  const changedPriceFields = useMemo(() => {
    const fields = new Set();
    pricedRows.forEach((row) => {
      const existing = row.__existing;
      if (!existing) return;
      PRICE_FIELDS.forEach((field) => {
        const fileVal = String(row[field] ?? "").trim();
        if (!fileVal) return;
        if (fileVal !== String(existing[field] ?? "").trim()) fields.add(field);
      });
    });
    return fields;
  }, [pricedRows]);
  const affectedCountByField = useMemo(() => {
    const counts = {};
    PRICE_FIELDS.forEach((field) => {
      counts[field] = pricedRows.filter((row) => {
        const existing = row.__existing;
        if (!existing) return false;
        const fileVal = String(row[field] ?? "").trim();
        if (!fileVal) return false;
        return fileVal !== String(existing[field] ?? "").trim();
      }).length;
    });
    return counts;
  }, [pricedRows]);

  const unmappedPriceFields = useMemo(() => {
    const mapped = new Set(Object.values(mapping || {}).filter(Boolean));
    return PRICE_FIELDS.filter((f) => !mapped.has(f));
  }, [mapping]);

  const codelessRows = useMemo(() => workingRows.filter((row) => !String(row.code || "").trim() || !parseSkuCode(row.code)), [workingRows]);
  const missingUnits = useMemo(() => {
    const byName = new Map();
    workingRows.forEach((row) => {
      const name = String(row.unit_name || "").trim();
      if (!name || hasOption(allUnits, name)) return;
      const key = normalizeKey(name);
      if (!byName.has(key)) byName.set(key, { name, rows: [] });
      byName.get(key).rows.push(row.__rowNumber);
    });
    return [...byName.values()];
  }, [allUnits, workingRows]);
  const fileUnitOptions = useMemo(() => {
    const byName = new Map();
    workingRows.forEach((row) => {
      const name = String(row.__inferredUnitName || row.unit_name || "").trim();
      if (!name) return;
      const key = normalizeKey(name);
      if (!byName.has(key)) {
        byName.set(key, {
          name,
          rows: [],
          sample: row.__rawStockQuantity || row.stock_quantity || "",
          exists: hasOption(allUnits, name),
          inferred: 0,
        });
      }
      const entry = byName.get(key);
      entry.rows.push(row.__rowNumber);
      if (row.__inferredUnitName) entry.inferred += 1;
      entry.exists = entry.exists || hasOption(allUnits, name);
    });
    return [...byName.values()].sort((a, b) => b.rows.length - a.rows.length);
  }, [allUnits, workingRows]);
  const missingWarehouses = useMemo(() => {
    const byName = new Map();
    parsedRows.forEach((row) => {
      const name = String(row.store_name || row.warehouse_name || "").trim();
      if (!name || warehouseNameExists(allWarehouses, name)) return;
      const key = normalizeKey(name);
      if (!byName.has(key)) byName.set(key, { name, rows: [] });
      byName.get(key).rows.push(row.__rowNumber);
    });
    return [...byName.values()];
  }, [allWarehouses, parsedRows]);
  const fileWarehouseOptions = useMemo(() => {
    const byName = new Map();
    editableRows.forEach((row) => {
      const name = String(row.store_name || row.warehouse_name || "").trim();
      if (!name) return;
      const key = normalizeKey(name);
      if (!byName.has(key)) {
        const match = findWarehouse(allWarehouses, { ...row, warehouse_id: "" });
        byName.set(key, {
          name,
          rows: [],
          quantity: 0,
          exists: Boolean(match),
          warehouseId: match?.id || "",
        });
      }
      const entry = byName.get(key);
      entry.rows.push(row.__rowNumber);
      entry.quantity += Number(row.stock_quantity || 0);
      if (!entry.exists) {
        const match = findWarehouse(allWarehouses, { ...row, warehouse_id: "" });
        entry.exists = Boolean(match);
        entry.warehouseId = match?.id || entry.warehouseId;
      }
    });
    return [...byName.values()].sort((a, b) => b.rows.length - a.rows.length);
  }, [allWarehouses, editableRows]);
  const orderedFields = useMemo(() => {
    const visibleMappedFields = Object.values(mapping).filter((field) => field && (field !== "store_name" || hasSourceStores));
    const tableHelperFields = [
      ...(workingRows.length ? ["category_name"] : []),
      ...(workingRows.length ? ["warehouse_id"] : []),
      ...(duplicateGroups.length ? ["storage_plan"] : []),
    ];
    // Build a set of fields that have values instead of O(n*m) some()
    const fieldsWithValues = new Set();
    workingRows.forEach((row) => {
      FIELD_ORDER.forEach((field) => {
        if (!fieldsWithValues.has(field) && row[field] !== undefined && row[field] !== "") {
          fieldsWithValues.add(field);
        }
      });
    });
    const mapped = [...new Set([...visibleMappedFields, ...tableHelperFields, ...FIELD_ORDER.filter((field) => fieldsWithValues.has(field))])];
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

  const priceUpdatesCount = useMemo(() => {
    let count = 0;
    (analyzedRows || []).forEach((row) => {
      const action = rowAction(row);
      if (action !== "update") return;
      const existing = row.__existing;
      if (!existing) return;
      const effectiveRow = applyPricePoliciesAndOverrides(row);
      
      const hasPriceChange = ["sale_price", "purchase_price", "wholesale_price"].some(field => {
        const incoming = String(effectiveRow[field] ?? "").trim();
        if (!incoming && effectiveRow[field] !== 0) return false;
        const current = String(existing[field] ?? "").trim();
        return incoming !== current;
      });
      if (hasPriceChange) count++;
    });
    return count;
  }, [analyzedRows, rowAction, mapping, pricePolicies, rowPriceOverrides]);

  const importStats = useMemo(() => {
    const uniqueProductsCount = new Set(editableRows.map(duplicateKeyForRow).filter(Boolean)).size;
    return {
      fileName,
      mappedColumns: Object.values(mapping).filter(Boolean).length,
      totalColumns: headers.filter((header) => String(header ?? "").trim()).length,
      totalRows: parsedRows.length,
      uniqueProducts: uniqueProductsCount,
      importRows: workingRows.length,
      duplicateGroups: duplicateGroups.length,
      skuConflicts: fileSkuConflicts.length,
      storageSplitRows: editableRows.length - workingRows.length,
      exactExistingRows: exactExistingRows.length,
      readyRows: counts.ready || 0,
      existingRows: counts.existing || 0,
      warningRows: (counts.possible_duplicate || 0) + (counts.file_duplicate || 0),
      invalidRows: counts.invalid || 0,
      confidence: Math.round(mappingConfidence(headers, mapping) * 100),
      errors: blockingIssues.length,
      warnings: validationIssues.length - blockingIssues.length,
      removedRows: removedRows.size,
      priceUpdates: priceUpdatesCount,
    };
  }, [blockingIssues.length, counts, duplicateGroups.length, editableRows, exactExistingRows.length, fileName, fileSkuConflicts.length, headers, mapping, parsedRows.length, removedRows.size, validationIssues.length, workingRows.length, priceUpdatesCount]);
  const missingSkuCategories = useMemo(() => {
    const byPrefix = new Map();
    workingRows.forEach((row) => {
      const sku = parseSkuCode(row.code);
      if (!sku || categoryBySkuPrefix(systemCategories, sku.prefix)) return;
      if (!byPrefix.has(sku.prefix)) {
        byPrefix.set(sku.prefix, {
          prefix: sku.prefix,
          name: String(skuCategoryNames[sku.prefix] || row.category_name || "").trim() || `فئة ${sku.prefix}`,
          rows: [],
          names: new Set(),
        });
      }
      byPrefix.get(sku.prefix).rows.push(row.__rowNumber);
      if (row.category_name) byPrefix.get(sku.prefix).names.add(row.category_name);
    });
    return [...byPrefix.values()].map((entry) => ({ ...entry, names: [...entry.names] }));
  }, [skuCategoryNames, systemCategories, workingRows]);
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
    if (rowFilter === "ready") return analyzedRows.filter((row) => row.__status === "ready" && !validationIssues.some((issue) => issue.rowNumber === row.__rowNumber && issue.severity === "error"));
    return sortedEditableRows;
  }, [analyzedRows, duplicateRowNumbers, rowFilter, sortedEditableRows, validationIssues]);
  const unitErrorRows = useMemo(() => rowsNeedingBulkFix("unit_name"), [validationIssues, workingRows]);
  const warehouseErrorRows = useMemo(() => rowsNeedingBulkFix("warehouse_id"), [validationIssues, workingRows]);
  const storageErrorRows = useMemo(() => rowsNeedingBulkFix("storage_plan"), [validationIssues, workingRows]);
  const selectedRowsList = useMemo(() => workingRows.filter((row) => selectedRows.has(row.__rowNumber)), [selectedRows, workingRows]);

  function issuesFor(rowNumber, field) {
    return validationIssues.filter((issue) => issue.rowNumber === rowNumber && issue.field === field);
  }

  function issuesForRow(rowNumber) {
    return validationIssues.filter((issue) => issue.rowNumber === rowNumber);
  }

  function rowsNeedingBulkFix(field) {
    const issueRows = new Set(validationIssues.filter((issue) => issue.field === field && issue.severity === "error").map((issue) => issue.rowNumber));
    return workingRows.filter((row) => issueRows.has(row.__rowNumber));
  }

  const reset = useCallback(() => {
    setFileName("");
    setSourceFile(null);
    setPreview(null);
    setRawRows([]);
    setHeaderIndex(0);
    setMapping({});
    setActions({});
    setRowOverrides({});
    setCreatedCategories([]);
    setCreatedUnits([]);
    setCreatedWarehouses([]);
    setSortConfig({ key: null, dir: "asc" });
    setColWidths({});
    setBulkField("unit_name");
    setBulkValue("");
    setBulkScope("selected");
    setQuickUnitValue("");
    setQuickWarehouseValue("");
    setSkuCategoryNames({});
    setLastAppliedFix(null);
    setDuplicateMode("combine");
    setDuplicatePolicies({});
    setPricePolicies({});
    setRowPriceOverrides({});
    setSelectedRows(new Set());
    setRemovedRows(new Set());
    setRowFilter("all");
    setLoading(false);
    setReading(false);
    setCategorySyncing(false);
    setDragActive(false);
    setSkuConflictsResolved(false);
    setError("");
    setResult(null);
    setValidationReturn(null);
  }, []);

  useEffect(() => {
    setDatabaseItems(items || []);
    api.get("/api/items")
      .then((response) => {
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        if (rows.length) setDatabaseItems(rows);
      })
      .catch(() => {});
    api.get("/api/warehouses")
      .then((response) => setWarehouses(Array.isArray(response.data?.data) ? response.data.data : []))
      .catch(() => setWarehouses([]));
  }, [items]);

  useEffect(() => {
    if (!allWarehouses.length || !parsedRows.length) return;
    setRowOverrides((prev) => {
      let changed = false;
      const next = { ...prev };
      const fallbackWarehouse = defaultWarehouse(allWarehouses);
      parsedRows.forEach((row) => {
        const current = next[row.__rowNumber] || {};
        if (current.warehouse_id) return;
        const sourceWarehouseName = String(row.store_name || row.warehouse_name || "").trim();
        const sourceMatch = sourceWarehouseName ? findWarehouse(allWarehouses, { ...row, warehouse_id: "" }) : null;
        if (sourceWarehouseName && !sourceMatch) return;
        const match = sourceMatch || fallbackWarehouse;
        if (!match) return;
        next[row.__rowNumber] = { ...current, warehouse_id: match.id };
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [allWarehouses, parsedRows]);

  const readFile = useCallback(async (file) => {
    if (!file) return false;
    setReading(true);
    setError("");
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name || "")) {
        throw new Error("استخدم ملف Excel أو CSV فقط.");
      }
      const parsed = await parseExcelFile(file);
      if (parsed.rows.length < 2) {
        throw new Error("الملف لا يحتوي على بيانات كافية.");
      }

      const detected = detectHeaderRow(parsed.rows);
      const headerRow = parsed.rows[detected.index] || [];
      const dataRows = parsed.rows.slice(detected.index + 1);
      const nextMapping = detectColumnHeaders(headerRow, ITEM_FIELDS, dataRows);
      const parsedDataRows = parseMappedRows(parsed.rows, detected.index, nextMapping);
      if (!parsedDataRows.length) {
        setError("تمت قراءة الملف، لكن لم يتم العثور على صفوف أصناف بعد العناوين.");
      } else if (!Object.values(nextMapping).includes("name")) {
        setError("تمت قراءة الملف، لكن عمود اسم الصنف يحتاج ربطا يدويا.");
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
      setPricePolicies({});
      setRowPriceOverrides({});
      setSelectedRows(new Set());
      setRemovedRows(new Set());
      setRowFilter("all");
      setSortConfig({ key: null, dir: "asc" });
      setSkuConflictsResolved(false);
      setResult(null);
      return true;
    } catch (readError) {
      const message = readError?.message || "تعذر قراءة الملف. استخدم xlsx أو xls أو csv.";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setReading(false);
      setDragActive(false);
    }
  }, []);

  const handleFile = useCallback(async (event) => {
    const ok = await readFile(event.target.files?.[0]);
    event.target.value = "";
    return ok;
  }, [readFile]);

  const handleDrop = useCallback(async (event) => {
    event.preventDefault();
    event.stopPropagation();
    return readFile(event.dataTransfer.files?.[0]);
  }, [readFile]);

  function updateMapping(columnIndex, field) {
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
  }

  function getColumnWidth(field) {
    if (colWidths[field]) return colWidths[field];
    const meta = FIELD_META[field] || { minWidth: 120 };
    const longest = Math.max(String(meta.label || field).length, ...workingRows.slice(0, 25).map((row) => String(row[field] ?? "").length));
    return Math.min(Math.max(meta.minWidth || 120, longest * 9 + 52), field === "name" ? 360 : 260);
  }

  function startResize(event, field) {
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
  }

  function toggleSort(field) {
    setSortConfig((prev) => (prev.key === field ? { key: field, dir: prev.dir === "asc" ? "desc" : "asc" } : { key: field, dir: "asc" }));
  }

  function toggleRowSelection(rowNumber) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function selectRows(rows) {
    setSelectedRows(new Set(rows.map((row) => row.__rowNumber)));
  }

  function clearSelectedRows() {
    setSelectedRows(new Set());
  }

  function removeRows(rows) {
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
  }

  function restoreRemovedRows() {
    setRemovedRows(new Set());
    toast.success("تمت إعادة الصفوف المحذوفة");
  }

  function rowsForScope(field, scope) {
    if (scope === "selected") return selectedRowsList;
    if (scope === "invalid") return rowsNeedingBulkFix(field);
    if (scope === "duplicates") return workingRows.filter((row) => duplicateRowNumbers.has(row.__rowNumber));
    if (scope === "visible") return filteredRows;
    return workingRows;
  }

  function applyValueToRows(field, value, rows, messageLabel, statusKey = field) {
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
  }

  function applyQuickUnitFix() {
    const value = quickUnitValue || allUnits?.[0]?.name || "";
    if (!value) return toast.error("لا توجد وحدات متاحة في النظام");
    applyValueToRows("unit_name", value, rowsForScope("unit_name", "invalid"), "الوحدة", "unit-invalid");
  }

  function applyFileUnitChoice(sourceName, targetUnitName = sourceName) {
    const key = normalizeKey(sourceName);
    const rows = workingRows.filter((row) => normalizeKey(row.__inferredUnitName || row.unit_name) === key);
    if (!rows.length) return;
    applyValueToRows("unit_name", targetUnitName, rows, `وحدة الملف: ${targetUnitName}`, `file-unit-${key}`);
  }

  function applyQuickWarehouseFix() {
    const value = quickWarehouseValue || defaultWarehouse(allWarehouses)?.id || allWarehouses[0]?.id || "";
    if (!value) return toast.error("لا توجد مخازن متاحة في النظام");
    applyValueToRows("warehouse_id", value, rowsForScope("warehouse_id", "invalid"), "المخزن", "warehouse-invalid");
  }

  function applyQuickWarehouseToAll() {
    const value = quickWarehouseValue || defaultWarehouse(allWarehouses)?.id || allWarehouses[0]?.id || "";
    if (!value) return toast.error("لا توجد مخازن متاحة في النظام");
    applyValueToRows("warehouse_id", value, workingRows, "المخزن", "warehouse-all");
  }

  function rowsForSourceWarehouse(sourceName) {
    const key = normalizeKey(sourceName);
    return editableRows.filter((row) => normalizeKey(row.store_name || row.warehouse_name) === key);
  }

  function applyFileWarehouseChoice(sourceName, warehouseId, label = "المخزن") {
    const rows = rowsForSourceWarehouse(sourceName);
    if (!warehouseId || !rows.length) return;
    applyValueToRows("warehouse_id", warehouseId, rows, label, `file-warehouse-${normalizeKey(sourceName)}`);
  }

  async function createMissingUnit(name) {
    const unitName = String(name || "").trim();
    if (!unitName) return null;
    const existing = allUnits.find((unit) => normalizeKey(unit.name) === normalizeKey(unitName) || normalizeKey(unit.symbol) === normalizeKey(unitName));
    if (existing) return existing;
    setCategorySyncing(true);
    try {
      const response = await api.post("/api/units", {
        name: unitName,
        symbol: unitName,
        is_active: true,
        allow_decimal: true,
      });
      const created = response.data?.data;
      if (created) {
        setCreatedUnits((prev) => [...prev.filter((unit) => normalizeKey(unit.name) !== normalizeKey(created.name)), created]);
        toast.success(`تم إنشاء وحدة: ${unitName}`);
      }
      return created;
    } catch (error) {
      toast.error(error.response?.data?.message || `تعذر إنشاء الوحدة: ${unitName}`);
      return null;
    } finally {
      setCategorySyncing(false);
    }
  }

  async function createAllMissingUnits() {
    for (const entry of missingUnits) {
      // eslint-disable-next-line no-await-in-loop
      await createMissingUnit(entry.name);
    }
  }

  async function createAndApplyUnit(sourceName, createName = sourceName) {
    const created = await createMissingUnit(createName);
    if (created?.name) {
      applyFileUnitChoice(sourceName, created.name);
    }
    return created;
  }

  async function createMissingWarehouse(name) {
    const warehouseName = String(name || "").trim();
    if (!warehouseName) return null;
    const existing = allWarehouses.find((warehouse) => normalizeKey(warehouse.name) === normalizeKey(warehouseName) || normalizeKey(warehouse.code) === normalizeKey(warehouseName));
    if (existing) return existing;
    setCategorySyncing(true);
    try {
      const response = await api.post("/api/warehouses", {
        name: warehouseName,
        code: null,
        is_default: false,
      });
      const created = response.data?.data;
      if (created) {
        setCreatedWarehouses((prev) => [...prev.filter((warehouse) => normalizeKey(warehouse.name) !== normalizeKey(created.name)), created]);
        toast.success(`تم إنشاء مخزن: ${warehouseName}`);
      }
      return created;
    } catch (error) {
      toast.error(error.response?.data?.message || `تعذر إنشاء المخزن: ${warehouseName}`);
      return null;
    } finally {
      setCategorySyncing(false);
    }
  }

  async function createAllMissingWarehouses() {
    for (const entry of missingWarehouses) {
      // eslint-disable-next-line no-await-in-loop
      await createMissingWarehouse(entry.name);
    }
  }

  async function createAndApplyWarehouse(sourceName, createName = sourceName) {
    const created = await createMissingWarehouse(createName);
    if (created?.id) {
      applyFileWarehouseChoice(sourceName, created.id, `مخزن الملف: ${createName}`);
    }
    return created;
  }

  function sourceRowsForProduct(row) {
    const key = duplicateKeyForRow(row);
    if (!key) return [row];
    return duplicateGroups.find((candidate) => duplicateKeyForRow(candidate[0]) === key) || [row];
  }

  function productStoragePolicy(row) {
    return policyForDuplicateKey(duplicateKeyForRow(row), duplicateMode, duplicatePolicies);
  }

  function unlockStorageProduct(row) {
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
  }

  function lockStorageProduct(row) {
    const key = duplicateKeyForRow(row);
    if (!key) return;
    setDuplicatePolicies((prev) => ({ ...prev, [key]: "combine" }));
  }

  function setDuplicatePolicyForGroup(row, policy) {
    const key = duplicateKeyForRow(row);
    if (!key) return;
    setDuplicatePolicies((prev) => ({ ...prev, [key]: policy }));
  }

  function applyDuplicatePolicyToAll(policy) {
    setDuplicateMode(policy);
    setDuplicatePolicies({});
    toast.success(policy === "warehouse" ? "تم اختيار التوزيع على المخازن لكل التكرارات" : "تم اختيار دمج الكميات لكل التكرارات");
  }

  function applyExistingRowsAction(action) {
    if (!exactExistingRows.length) return;
    setActions((prev) => {
      const next = { ...prev };
      exactExistingRows.forEach((row) => {
        next[row.__rowNumber] = action;
      });
      return next;
    });
    const label = action === "update" ? "تحديث كل الموجود" : action === "warehouse_stock" ? "استلام مخزون كل الموجود فقط" : "تخطي كل الموجود";
    setLastAppliedFix({ key: `existing-${action}-${Date.now()}`, label, count: exactExistingRows.length });
    toast.success(`تم تطبيق ${label} على ${exactExistingRows.length} صف`);
  }

  function currentStockForRow(row) {
    const existing = row.__existing || findExactExistingProduct(databaseItems || [], row);
    return Number(existing?.stock_quantity ?? existing?.quantity ?? 0);
  }

  function warehouseNameForRow(row) {
    const id = resolvedWarehouseId(allWarehouses, row);
    return allWarehouses.find((warehouse) => String(warehouse.id) === String(id))?.name || "المخزن المختار";
  }

  function changePreviewForRow(row) {
    const existing = row.__existing || findExactExistingProduct(databaseItems || [], row);
    const action = rowAction(row);
    const messages = [];
    const sku = parseSkuCode(row.code);
    const category = sku ? categoryBySkuPrefix(systemCategories, sku.prefix) : null;
    if (action === "skip") return ["لن يتم تغيير هذا الصنف."];
    if (action === "warehouse_stock") return [
      `المخزون الحالي للصنف في النظام: ${currentStockForRow(row)}.`,
      `كمية الملف لـ ${warehouseNameForRow(row)}: ${Number(row.stock_quantity || 0)}.`,
      `بعد التنفيذ سيتم ضبط مخزون ${warehouseNameForRow(row)} إلى ${Number(row.stock_quantity || 0)}.`,
    ];
    if (!existing) {
      messages.push("سيتم إنشاء صنف جديد.");
      if (category) messages.push(`الفئة من SKU: ${category.name}.`);
      else if (sku) messages.push(`سيتم إنشاء أو استرجاع فئة SKU ${sku.prefix}.`);
      messages.push(`المخزن: ${warehouseNameForRow(row)}، الكمية: ${Number(row.stock_quantity || 0)}.`);
      return messages;
    }
    [
      ["name", "الاسم"],
      ["barcode", "الباركود"],
      ["purchase_price", "سعر الشراء"],
      ["sale_price", "سعر البيع"],
      ["wholesale_price", "سعر الجملة"],
      ["min_stock_qty", "حد الطلب"],
    ].forEach(([field, label]) => {
      const incoming = String(row[field] ?? "").trim();
      if (!incoming) return;
      const current = String(existing[field] ?? "").trim();
      if (incoming !== current) messages.push(`${label}: ${current || "فارغ"} -> ${incoming}`);
    });
    if (row.unit_name && normalizeKey(row.unit_name) !== normalizeKey(existing.unit_name)) {
      messages.push(`الوحدة: ${existing.unit_name || "فارغة"} -> ${row.unit_name}`);
    }
    if (category && Number(existing.category_id || 0) !== Number(category.id || 0)) {
      messages.push(`الفئة ستصبح: [${category.sku_prefix}] ${category.name}.`);
    }
    if (row.stock_quantity !== undefined && row.stock_quantity !== "") {
      messages.push(`المخزون الحالي للصنف في النظام: ${currentStockForRow(row)}.`);
      messages.push(`كمية الملف لـ ${warehouseNameForRow(row)}: ${Number(row.stock_quantity || 0)}.`);
      messages.push(`بعد التنفيذ سيتم ضبط مخزون ${warehouseNameForRow(row)} إلى ${Number(row.stock_quantity || 0)}.`);
    }
    if (!messages.length) messages.push("لا توجد فروق واضحة، وسيتم فقط تأكيد الربط الحالي.");
    return messages;
  }

  function actionLabel(action) {
    return {
      insert: "إضافة منتج جديد",
      update: "تحديث المنتج الموجود",
      warehouse_stock: "استلام مخزون فقط",
      skip: "تخطي",
    }[action] || action;
  }

  function statusLabel(status) {
    return {
      ready: "جاهز",
      existing: "موجود مسبقا",
      possible_duplicate: "تشابه اسم",
      file_duplicate: "مكرر بالملف",
      invalid: "غير صالح",
    }[status] || "مراجعة";
  }

  function categoryLabelForRow(row) {
    const sku = parseSkuCode(row.code);
    const category = sku ? categoryBySkuPrefix(systemCategories, sku.prefix) : null;
    if (category) return `[${category.sku_prefix}] ${category.name}`;
    if (sku) return `سيتم إنشاء/استرجاع فئة SKU ${sku.prefix}`;
    return "SKU غير صحيح";
  }

  function updateRowValue(rowNumber, field, value) {
    setRowOverrides((prev) => ({
      ...prev,
      [rowNumber]: { ...(prev[rowNumber] || {}), [field]: value },
    }));
  }

  function autoAssignCodes(prefix) {
    const basePrefix = String(prefix || missingSkuCategories[0]?.prefix || categories?.[0]?.sku_prefix || "1");
    const used = new Set([
      ...systemCategories.flatMap(() => []),
      ...(databaseItems || []).map((item) => parseSkuCode(item.code)?.code).filter(Boolean),
      ...workingRows.map((row) => parseSkuCode(row.code)?.code).filter(Boolean),
    ]);
    let sequence = 1;
    setRowOverrides((prev) => {
      const next = { ...prev };
      codelessRows.forEach((row) => {
        let code = `${basePrefix}.${sequence}`;
        while (used.has(code)) {
          sequence += 1;
          code = `${basePrefix}.${sequence}`;
        }
        used.add(code);
        next[row.__rowNumber] = { ...(next[row.__rowNumber] || {}), code };
        sequence += 1;
      });
      return next;
    });
    toast.success(`تم تعيين أكواد ${codelessRows.length} صف`);
  }

  function applySkuConflictPlan(plans) {
    const resolutionMap = new Map(plans.map((entry) => [normalizeKey(entry.code), entry]));
    const targetConflicts = fileSkuConflicts.filter((conflict) => resolutionMap.has(normalizeKey(conflict.code)));
    const rowsToChange = targetConflicts.flatMap((conflict) => {
      const plan = resolutionMap.get(normalizeKey(conflict.code));
      return conflict.rows.filter((row) => row.__rowNumber !== plan?.keepRowNumber && (plan?.otherActions?.[row.__rowNumber] || plan?.otherAction || "new_code") === "new_code");
    });
    const rowsToChangeSet = new Set(rowsToChange.map((row) => row.__rowNumber));
    const used = new Set([
      ...(databaseItems || []).map((item) => parseSkuCode(item.code)?.code || String(item.code || "").trim()).filter(Boolean),
      ...editableRows.filter((row) => !rowsToChangeSet.has(row.__rowNumber)).map((row) => parseSkuCode(row.code)?.code || String(row.code || "").trim()).filter(Boolean),
    ]);
    const nextGeneratedCode = (basePrefix) => {
      let sequence = 1;
      let nextCode = `${basePrefix}.${sequence}`;
      while (used.has(nextCode)) {
        sequence += 1;
        nextCode = `${basePrefix}.${sequence}`;
      }
      used.add(nextCode);
      return nextCode;
    };
    setRowOverrides((prev) => {
      const next = { ...prev };
      targetConflicts.forEach((conflict) => {
        const resolution = resolutionMap.get(normalizeKey(conflict.code));
        const parsed = parseSkuCode(conflict.code);
        const basePrefix = parsed?.prefix || missingSkuCategories[0]?.prefix || categories?.[0]?.sku_prefix || "1";
        conflict.rows.forEach((row) => {
          if (row.__rowNumber === resolution.keepRowNumber) {
            return;
          }
          const otherAction = resolution.otherActions?.[row.__rowNumber] || resolution.otherAction || "new_code";
          if (otherAction === "skip") {
            next[row.__rowNumber] = { ...(next[row.__rowNumber] || {}), __skuConflictAction: "skip" };
            return;
          }
          const nextCode = nextGeneratedCode(basePrefix);
          next[row.__rowNumber] = { ...(next[row.__rowNumber] || {}), code: nextCode, __skuConflictAction: "new_code" };
        });
      });
      return next;
    });
    setSkuConflictsResolved(true);
    toast.success(`تم تعيين أكواد جديدة لـ ${rowsToChange.length} صف متعارض`);
  }

  function resolveSkuConflicts(resolutions) {
    applySkuConflictPlan(resolutions.map((entry) => ({ ...entry, otherAction: entry.otherAction || "new_code" })));
  }

  function defaultSkuConflictKeepRow(conflict) {
    return conflict.rows[0] || null;
  }

  function resolveSkuConflict(code, keepRowNumber) {
    applySkuConflictPlan([{ code, keepRowNumber, otherAction: "new_code" }]);
  }

  function resolveAllSkuConflicts() {
    resolveSkuConflicts(fileSkuConflicts.map((conflict) => {
      const keepRow = defaultSkuConflictKeepRow(conflict);
      return { code: conflict.code, keepRowNumber: keepRow?.__rowNumber };
    }).filter((entry) => entry.keepRowNumber));
  }

  function assignNewCodesForSkuConflict(code) {
    const conflict = fileSkuConflicts.find((entry) => normalizeKey(entry.code) === normalizeKey(code));
    const keepRow = conflict ? defaultSkuConflictKeepRow(conflict) : null;
    if (keepRow) resolveSkuConflict(code, keepRow.__rowNumber);
  }

  function decorateRowWithSkuCategory(row, categoryList = systemCategories) {
    const category = categoryForSku(categoryList, row);
    return {
      ...row,
      category_id: category?.id || row.category_id || null,
      category_name: category?.name || row.category_name || "",
    };
  }

  const ensureSkuCategories = useCallback(async () => {
    if (!missingSkuCategories.length) return systemCategories;
    setCategorySyncing(true);
    try {
      const created = [];
      for (const entry of missingSkuCategories) {
        try {
          const response = await api.post("/api/categories", { name: entry.name, sku_prefix: entry.prefix });
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
  }, [missingSkuCategories, systemCategories]);

  function applyPricePoliciesAndOverrides(baseRow) {
    const merged = { ...baseRow, ...(rowPriceOverrides[baseRow.__rowNumber] || {}) };
    const mappedFields = Object.values(mapping).filter(Boolean);
    PRICE_FIELDS.forEach((field) => {
      const isMapped = mappedFields.includes(field);
      if (!isMapped) {
        if (pricePolicies[field] === "zero") {
          merged[field] = 0;
        } else {
          delete merged[field];
        }
      } else {
        if (pricePolicies[field] === "skip") {
          delete merged[field];
        }
      }
    });
    return merged;
  }

  const buildSubmitRows = useCallback((categoryList) => {
    return analyzedRows
      .filter((row) => row.__status !== "invalid")
      .flatMap((row) => {
      if (row.__duplicatePolicy === "warehouse" && Array.isArray(row.__warehouseDistribution)) {
        return row.__warehouseDistribution.map((item) => {
          const warehouseId = explicitWarehouseId(allWarehouses, item);
          const payloadRow = decorateRowWithSkuCategory({ ...row, ...item, warehouse_id: warehouseId }, categoryList);
          return {
            action: "warehouse_stock",
            match_field: row.__matchField,
            existing_id: row.__existing?.id,
            payload: toApiPayload(payloadRow, categoryList, allUnits, selectedCategoryId),
            source_row: item.__rowNumber,
          };
        });
      }
      const warehouseId = resolvedWarehouseId(allWarehouses, row);
      const baseRow = warehouseId && !row.warehouse_id ? { ...row, warehouse_id: warehouseId } : row;
      const action = rowAction(row);

      // If this existing row is skipped but user wants prices updated,
      // convert to a price-only update instead of a real skip
      const isExisting = !!row.__existing;
      if (action === "skip") {
        if (!isExisting || !updateExistingPrices) return [];
        // fall through as price-only update
        const priceAdjusted = applyPricePoliciesAndOverrides(baseRow);
        const payloadRow = decorateRowWithSkuCategory(priceAdjusted, categoryList);
        const apiPayload = toApiPayload(payloadRow, categoryList, allUnits, selectedCategoryId);
        // keep existing metadata, only send prices
        const existing = row.__existing;
        apiPayload.name = existing.name;
        apiPayload.name_en = existing.name_en;
        apiPayload.barcode = existing.barcode;
        apiPayload.code = existing.code;
        apiPayload.category_id = existing.category_id;
        apiPayload.unit_id = existing.unit_id;
        apiPayload.min_stock_qty = existing.min_stock_qty;
        return [{
          action: "update",
          match_field: row.__matchField,
          existing_id: existing?.id,
          payload: apiPayload,
          source_row: row.__rowNumber,
          __priceOnly: true,
        }];
      }
      
      const priceAdjusted = action === "update" ? applyPricePoliciesAndOverrides(baseRow) : baseRow;
      const payloadRow = decorateRowWithSkuCategory(priceAdjusted, categoryList);
      
      let apiPayload = toApiPayload(payloadRow, categoryList, allUnits, selectedCategoryId);

      if (action === "update" && !updateExistingPrices) {
        delete apiPayload.sale_price;
        delete apiPayload.purchase_price;
        delete apiPayload.wholesale_price;
      }

      return [{
        action,
        match_field: row.__matchField,
        existing_id: row.__existing?.id,
        payload: apiPayload,
        source_row: row.__rowNumber,
      }];
    });
  }, [actions, allUnits, allWarehouses, analyzedRows, pricePolicies, rowAction, rowPriceOverrides, selectedCategoryId, updateExistingPrices]);

  const runImport = useCallback(async ({ dryRun, confirmDuplicate = false } = {}) => {
    setError("");
    setValidationReturn(null);
    if (blockingIssues.length) {
      const message = "يوجد أخطاء في البيانات يجب إصلاحها قبل الاستيراد.";
      setError(message);
      toast.error(message);
      return { ok: false, reason: "client_validation" };
    }
    let categoryList = systemCategories;
    try {
      categoryList = await ensureSkuCategories();
    } catch (error) {
      const message = error.response?.data?.message || "تعذر إنشاء فئات SKU الناقصة.";
      setError(message);
      toast.error(message);
      return { ok: false, reason: "categories" };
    }
    const rows = buildSubmitRows(categoryList);
    if (!rows.length) {
      const message = "لا توجد صفوف جاهزة للتنفيذ.";
      setError(message);
      toast.error(message);
      return { ok: false, reason: "empty" };
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
        await onImported?.();
      }
      return { ok: true, data };
    } catch (error) {
      const status = error?.response?.status;
      const body = error?.response?.data;
      if (status === 409 && body?.requires_confirm === "duplicate_file") {
        if (window.confirm("سبق استيراد نفس الملف من قبل. هل تريد المتابعة وتكرار الاستيراد؟")) {
          setLoading(false);
          return runImport({ dryRun, confirmDuplicate: true });
        }
        setLoading(false);
        return { ok: false, reason: "duplicate_file" };
      }
      if (status === 409 && body?.reason === "import_in_progress") {
        toast.error("هناك عملية استيراد جارية بالفعل. انتظر حتى تنتهي.");
        return { ok: false, reason: "import_in_progress" };
      }
      if (status === 400 && body?.reason === "validation") {
        const message = `يوجد ${body.needFixing} صف يحتاج إصلاح قبل الاستيراد.`;
        setValidationReturn(body);
        setError(message);
        toast.error(message);
        return { ok: false, reason: "server_validation", data: body };
      }
      const message = body?.message || "فشل تنفيذ الاستيراد.";
      setError(message);
      toast.error(message);
      return { ok: false, reason: "request" };
    } finally {
      setLoading(false);
    }
  }, [blockingIssues.length, buildSubmitRows, ensureSkuCategories, fileName, onImported, sourceFile, systemCategories]);

  return {
    ITEM_FIELDS,
    FIELD_META,
    BULK_FIELDS,
    actionLabel,
    analyzedRows,
    applySkuConflictPlan,
    assignNewCodesForSkuConflict,
    resolveAllSkuConflicts,
    resolveSkuConflict,
    applyDuplicatePolicyToAll,
    applyExistingRowsAction,
    applyFileUnitChoice,
    applyFileWarehouseChoice,
    applyQuickUnitFix,
    applyQuickWarehouseFix,
    applyQuickWarehouseToAll,
    applyValueToRows,
    autoAssignCodes,
    blockingIssues,
    blockingIssuesByType,
    hasBlockingIssues,
    bulkField,
    bulkScope,
    bulkValue,
    categories: categories || [],
    categoryLabelForRow,
    categorySyncing,
    changePreviewForRow,
    clearSelectedRows,
    codelessRows,
    currentStockForRow,
    createAllMissingUnits,
    createAllMissingWarehouses,
    createAndApplyUnit,
    createMissingUnit,
    createMissingWarehouse,
    createAndApplyWarehouse,
    defaultWarehouse,
    downloadImportTemplate,
    dragActive,
    duplicateGroups,
    duplicateMode,
    duplicatePolicies,
    duplicatesConfirmed,
    setDuplicatesConfirmed,
    duplicateRowNumbers,
    editableRows,
    error,
    exactExistingRows,
    explicitWarehouseId,
    fileInputRef,
    fileName,
    fileSkuConflicts,
    fileUnitOptions,
    fileWarehouseOptions,
    filterCounts,
    filteredRows,
    getColumnWidth,
    handleDrop,
    handleFile,
    hasSourceStores,
    headerIndex,
    headers,
    importStats,
    issuesFor,
    issuesForRow,
    lastAppliedFix,
    loading,
    lockStorageProduct,
    mapping,
    unmappedPriceFields,
    missingSkuCategories,
    missingUnits,
    missingWarehouses,
    orderedFields,
    parsedRows,
    preview,
    productStoragePolicy,
    quickUnitValue,
    quickWarehouseValue,
    rawRows,
    readFile,
    reading,
    removeRows,
    removedRows,
    reset,
    skuConflictsResolved,
    setSkuConflictsResolved,
    result,
    restoreRemovedRows,
    resolvedWarehouseId,
    rowAction,
    applyPricePoliciesAndOverrides,
    rowFilter,
    rowsForScope,
    rowsNeedingBulkFix,
    runImport,
    selectRows,
    selectedRows,
    selectedRowsList,
    setActions,
    setBulkField,
    setBulkScope,
    setBulkValue,
    setDragActive,
    setDuplicateMode,
    setDuplicatePolicies,
    setDuplicatePolicyForGroup,
    pricePolicies,
    setPricePolicies,
    rowPriceOverrides,
    setRowPriceOverrides,
    pricedRows,
    changedPriceFields,
    affectedCountByField,
    setError,
    setPreview,
    setQuickUnitValue,
    setQuickWarehouseValue,
    setRowFilter,
    setSkuCategoryNames,
    skuCategoryNames,
    sortedEditableRows,
    sortConfig,
    sourceFile,
    startResize,
    statusLabel,
    storageErrorRows,
    systemCategories,
    toggleRowSelection,
    toggleSort,
    unitErrorRows,
    units: allUnits,
    unlockStorageProduct,
    updateMapping,
    updateRowValue,
    validationIssues,
    validationReturn,
    warehouseErrorRows,
    warehouseNameForRow,
    warehouses: allWarehouses,
    workingRows,
    updateExistingPrices,
    setUpdateExistingPrices,
  };
}
