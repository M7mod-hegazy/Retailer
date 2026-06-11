import * as XLSX from "xlsx";
import { cptable, utils as codepageUtils } from "xlsx/dist/cpexcel.full.mjs";

if (typeof XLSX.set_cptable === "function") {
  XLSX.set_cptable({ ...cptable, utils: codepageUtils });
}

const NUMBER_FIELDS = new Set([
  "sale_price",
  "wholesale_price",
  "purchase_price",
  "tax_rate",
  "min_stock_qty",
  "stock_quantity",
]);

const UNIT_SUFFIX_PATTERN = /^\s*([-+]?\d+(?:[.,]\d+)?)\s*([^\d.,+-].*?)?\s*$/;

export const ITEM_FIELDS = [
  { key: "code", label: "الكود", aliases: ["code", "sku", "item code", "codenumberofmode", "كود", "الكود", "رقم الصنف"] },
  { key: "name", label: "اسم الصنف", required: true, aliases: ["name", "text64", "product name", "item name", "اسم", "الاسم", "اسم الصنف", "اسم المنتج", "الصنف"] },
  { key: "name_en", label: "الاسم الإنجليزي", aliases: ["english name", "name en", "name_en", "الاسم الانجليزي", "الاسم الإنجليزي"] },
  { key: "barcode", label: "الباركود", aliases: ["barcode", "bar code", "باركود", "الباركود"] },
  { key: "store_name", label: "المخزن", aliases: ["nameofstore", "store", "store name", "warehouse", "warehouse name", "المخزن", "اسم المخزن"] },
  { key: "warehouse_id", label: "مخزن النظام", aliases: ["warehouse id", "store id", "warehouse_id", "store_id", "كود المخزن", "مخزن النظام"] },
  { key: "category_name", label: "الفئة", aliases: ["category", "category name", "department", "فئة", "الفئة", "القسم", "تصنيف"] },
  { key: "unit_name", label: "الوحدة", aliases: ["unit", "unit name", "وحدة", "الوحدة"] },
  { key: "purchase_price", label: "سعر الشراء", aliases: ["purchase price", "avgpriceofbuying", "cost", "cost price", "سعر الشراء", "التكلفة", "سعر التكلفة"] },
  { key: "sale_price", label: "سعر البيع", aliases: ["sale price", "retail price", "price", "سعر البيع", "بيع المستهلك", "سعر المستهلك"] },
  { key: "wholesale_price", label: "سعر الجملة", aliases: ["wholesale price", "wholesale", "سعر الجملة", "بيع الجملة"] },
  { key: "stock_quantity", label: "المخزون", aliases: ["stock", "finalstock", "quantity", "qty", "balance", "المخزون", "الكمية", "رصيد"] },
  { key: "min_stock_qty", label: "حد إعادة الطلب", aliases: ["min stock", "minimum stock", "reorder point", "الحد الادنى", "الحد الأدنى"] },
  { key: "tax_rate", label: "الضريبة", aliases: ["tax", "vat", "tax rate", "ضريبة", "الضريبة"] },
  { key: "item_type", label: "النوع", aliases: ["type", "item type", "نوع", "النوع"] },
  { key: "description", label: "الوصف", aliases: ["description", "notes", "وصف", "الوصف", "ملاحظات"] },
  { key: "is_active", label: "نشط", aliases: ["active", "enabled", "is active", "نشط", "فعال"] },
  { key: "image_urls", label: "الصور", aliases: ["images", "image urls", "image", "صور", "الصور"] },
];

export const ACCOUNT_FIELDS = [
  { key: 'name', label: 'الاسم', required: true, aliases: ['name', 'resources', 'اسم', 'الاسم', 'اسم العميل', 'اسم المورد'] },
  { key: 'phone', label: 'الهاتف', aliases: ['phone', 'mobile', 'هاتف', 'جوال', 'موبايل'] },
  { key: 'address', label: 'العنوان', aliases: ['address', 'عنوان', 'العنوان'] },
  { key: 'opening_balance', label: 'الرصيد الافتتاحي', aliases: ['raseed', 'balance', 'رصيد', 'الرصيد', 'رصيد افتتاحي', 'الرصيد الافتتاحي', 'opening balance'] },
];

export const EXPORT_FIELDS = ITEM_FIELDS.filter((field) => field.key !== "image_urls").concat([
  { key: "primary_image_url", label: "الصورة الرئيسية" },
]);

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ـ/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/[ة]/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fixMojibake(value) {
  if (typeof value !== "string") return value;
  if (!/[ØÙ]/.test(value)) return value.trim();
  try {
    const bytes = Uint8Array.from([...value].map((char) => char.charCodeAt(0) & 255));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
  } catch {
    return value.trim();
  }
}

export async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false, raw: false, codepage: 1256 });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows: [], sheetName: "" };
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    blankrows: false,
  });
  return {
    sheetName,
    rows: rows
      .map((row) => row.map((cell) => fixMojibake(cell)))
      .filter((row) => row.some((cell) => String(cell ?? "").trim())),
  };
}

export function detectHeaderRow(rows, fields = ITEM_FIELDS) {
  const max = Math.min(rows.length, 8);
  let best = { index: 0, score: 0 };
  for (let index = 0; index < max; index += 1) {
    const mapping = detectColumnHeaders(rows[index] || [], fields);
    const score = Object.values(mapping).filter(Boolean).length;
    if (score > best.score) best = { index, score };
  }
  return best;
}

export function detectColumnHeaders(headers, fields = ITEM_FIELDS) {
  const mapping = {};
  headers.forEach((header, index) => {
    const normalizedHeader = normalizeText(header);
    if (!normalizedHeader) return;
    const match = fields.find((field) => field.aliases.some((alias) => {
      const normalizedAlias = normalizeText(alias);
      if (!normalizedAlias) return false;
      if (normalizedAlias === normalizedHeader) return true;
      if (normalizedAlias.length < 5) return false;
      return normalizedHeader.includes(normalizedAlias);
    }));
    if (match && !Object.values(mapping).includes(match.key)) {
      mapping[index] = match.key;
    }
  });
  return mapping;
}

export function mappingConfidence(headers, mapping) {
  const usefulHeaders = headers.filter((header) => String(header ?? "").trim()).length || 1;
  const mapped = Object.values(mapping).filter(Boolean).length;
  const hasName = Object.values(mapping).includes("name");
  return Math.min(1, mapped / usefulHeaders + (hasName ? 0.2 : 0));
}

export function parseMappedRows(rows, headerIndex, mapping) {
  const stockColumnIndex = Number(Object.entries(mapping).find(([, field]) => field === "stock_quantity")?.[0] ?? -1);
  return rows.slice(headerIndex + 1).map((row, rowIndex) => {
    const parsed = { __rowNumber: headerIndex + rowIndex + 2 };
    Object.entries(mapping).forEach(([columnIndex, field]) => {
      if (!field) return;
      const value = fixMojibake(row[Number(columnIndex)] ?? "");
      const rawText = String(value ?? "").trim();
      if (!rawText) return;
      if (field === "stock_quantity") {
        const quantity = parseQuantityWithUnit(value);
        parsed.stock_quantity = quantity.quantity;
        const unitName = quantity.unitName || inferUnitNearStock(row, Number(columnIndex), mapping);
        if (unitName && !parsed.unit_name) {
          parsed.unit_name = unitName;
          parsed.__inferredUnitName = unitName;
        }
        parsed.__rawStockQuantity = String(value ?? "").trim();
        return;
      }
      parsed[field] = NUMBER_FIELDS.has(field) ? parseNumber(value) : String(value ?? "").trim();
    });
    if (!parsed.unit_name && stockColumnIndex >= 0) {
      const unitName = inferUnitNearStock(row, stockColumnIndex, mapping);
      if (unitName) {
        parsed.unit_name = unitName;
        parsed.__inferredUnitName = unitName;
      }
    }
    const hasName = String(parsed.name || "").trim();
    const hasCode = String(parsed.code || "").trim();
    const hasBarcode = String(parsed.barcode || "").trim();
    const hasBusinessValue = hasName || hasCode || hasBarcode;
    return hasBusinessValue ? parsed : null;
  }).filter(Boolean);
}

export function parseQuantityWithUnit(value) {
  const text = String(value ?? "").trim();
  const match = text.match(UNIT_SUFFIX_PATTERN);
  if (!match) return { quantity: parseNumber(text), unitName: "" };
  return {
    quantity: parseNumber(match[1]),
    unitName: String(match[2] || "").trim(),
  };
}

function inferUnitNearStock(row, stockColumnIndex, mapping) {
  const mappedIndexes = new Set(Object.keys(mapping).map((index) => Number(index)));
  const candidates = [stockColumnIndex + 1, stockColumnIndex - 1];
  for (const index of candidates) {
    if (index < 0 || mappedIndexes.has(index)) continue;
    const text = String(fixMojibake(row?.[index] ?? "")).trim();
    if (looksLikeUnitText(text)) return text;
  }
  return "";
}

function looksLikeUnitText(value) {
  const text = String(value ?? "").trim();
  if (!text || text.length > 28) return false;
  if (/[-+]?\d/.test(text)) return false;
  return /[\p{L}]/u.test(text);
}

export function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const normalized = String(value).replace(/[,،]/g, ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeKey(value) {
  return normalizeText(value);
}

function indexExisting(items, key) {
  const map = new Map();
  items.forEach((item) => {
    const value = normalizeKey(item[key]);
    if (value && !map.has(value)) map.set(value, item);
  });
  return map;
}

export function analyzeRows(rows, existingItems = [], options = {}) {
  const matchBy = options.matchBy || ["barcode", "code", "name"];
  const byBarcode = indexExisting(existingItems, "barcode");
  const byCode = indexExisting(existingItems, "code");
  const byName = indexExisting(existingItems, "name");
  const seen = new Map();

  return rows.map((row) => {
    const errors = [];
    const warnings = [];
    if (!String(row.name || "").trim()) errors.push("اسم الصنف مطلوب");

    let existing = null;
    let matchField = null;
    for (const field of matchBy) {
      const key = normalizeKey(row[field]);
      if (!key) continue;
      const source = field === "barcode" ? byBarcode : field === "code" ? byCode : byName;
      const hit = source.get(key);
      if (hit) {
        existing = hit;
        matchField = field;
        break;
      }
    }

    const duplicateKey = normalizeKey(row.barcode) || normalizeKey(row.code) || normalizeKey(row.name);
    if (duplicateKey) {
      if (seen.has(duplicateKey)) warnings.push(`مكرر داخل الملف مع صف ${seen.get(duplicateKey)}`);
      else seen.set(duplicateKey, row.__rowNumber);
    }

    let status = "ready";
    if (errors.length) status = "invalid";
    else if (existing) status = matchField === "name" ? "possible_duplicate" : "existing";
    else if (warnings.length) status = "file_duplicate";

    return { ...row, __status: status, __errors: errors, __warnings: warnings, __existing: existing, __matchField: matchField };
  });
}

export function toApiPayload(row, categories = [], units = [], fallbackCategoryId = null) {
  const category = categories.find((cat) => normalizeKey(cat.name) === normalizeKey(row.category_name));
  const unit = units.find((entry) => normalizeKey(entry.name) === normalizeKey(row.unit_name) || normalizeKey(entry.symbol) === normalizeKey(row.unit_name));
  return {
    code: row.code || "",
    name: row.name || "",
    name_en: row.name_en || null,
    barcode: row.barcode || null,
    store_name: row.store_name || "",
    warehouse_id: row.warehouse_id || null,
    warehouse_name: row.store_name || row.warehouse_name || "",
    stock_quantity: row.stock_quantity === undefined || row.stock_quantity === "" ? undefined : parseNumber(row.stock_quantity),
    category_id: row.category_id || category?.id || fallbackCategoryId || null,
    category_name: row.category_name || "",
    unit_id: unit?.id || null,
    unit_name: row.unit_name || "",
    sale_price: parseNumber(row.sale_price),
    wholesale_price: parseNumber(row.wholesale_price),
    purchase_price: parseNumber(row.purchase_price),
    tax_rate: parseNumber(row.tax_rate),
    item_type: row.item_type || "product",
    description: row.description || null,
    is_active: row.is_active === undefined || row.is_active === "" ? true : !["0", "false", "لا", "no"].includes(normalizeKey(row.is_active)),
    min_stock_qty: parseNumber(row.min_stock_qty),
    image_urls: String(row.image_urls || "").split(/[\n,]+/).map((url) => url.trim()).filter(Boolean),
  };
}

export function downloadWorkbook(filename, sheets) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
  });
  XLSX.writeFile(workbook, filename);
}

export function exportItemsToExcel(items, selectedFields, filename) {
  const rows = items.map((item) => {
    const row = {};
    selectedFields.forEach((fieldKey) => {
      const field = EXPORT_FIELDS.find((entry) => entry.key === fieldKey);
      if (!field) return;
      row[field.label] = Array.isArray(item[fieldKey]) ? item[fieldKey].join(", ") : item[fieldKey] ?? "";
    });
    return row;
  });
  downloadWorkbook(filename, [{ name: "Items", rows }]);
}

export function downloadImportTemplate() {
  const row = {};
  ITEM_FIELDS.forEach((field) => {
    row[field.label] = "";
  });
  downloadWorkbook("items-import-template.xlsx", [{ name: "Template", rows: [row] }]);
}
