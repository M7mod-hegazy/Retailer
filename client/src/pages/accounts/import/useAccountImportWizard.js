import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../../../services/api";
import {
  ACCOUNT_FIELDS,
  detectColumnHeaders,
  detectHeaderRow,
  parseExcelFile,
} from "../../../utils/excelImportExport";

function normalizeNameKey(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
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

export function useAccountImportWizard({ entityType, onImported }) {
  const apiBase = entityType === "customers" ? "/api/customers" : "/api/suppliers";

  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [existingAccounts, setExistingAccounts] = useState([]);
  const [duplicateActions, setDuplicateActions] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");

  // Column mapping state
  const [rawRows, setRawRows] = useState([]);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [mapping, setMapping] = useState({});
  const fileInputRef = useRef(null);

  const loadExisting = useCallback(async () => {
    try {
      const res = await api.get(apiBase);
      setExistingAccounts(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setExistingAccounts([]);
    }
  }, [apiBase]);

  useEffect(() => { loadExisting(); }, [loadExisting]);

  const headers = rawRows[headerIndex] || [];

  function sampleValues(columnIndex) {
    return (rawRows || [])
      .slice(headerIndex + 1, headerIndex + 7)
      .map((row) => row?.[columnIndex])
      .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
      .slice(0, 4);
  }

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

  function applyNewMapping() {
    if (!rawRows.length) return;
    const dataRows = rawRows.slice(headerIndex + 1).filter(row => row.some(cell => String(cell ?? "").trim()));
    const fieldToCol = {};
    Object.entries(mapping).forEach(([colIdx, field]) => { fieldToCol[field] = Number(colIdx); });
    const mappedRows = dataRows.map((row, i) => ({
      __rowNumber: i + 1,
      name: String(row[fieldToCol.name] ?? "").trim(),
      phone: String(row[fieldToCol.phone] ?? "").trim(),
      address: String(row[fieldToCol.address] ?? "").trim(),
      opening_balance: Number(row[fieldToCol.opening_balance] ?? 0) || 0,
    }));
    const enriched = enrichRows(mappedRows, existingAccounts);
    setRows(enriched);
    setDuplicateActions({});
    setResult(null);
  }

  const enrichRows = useCallback((rawRows, existingList) => {
    const byName = new Map(existingList.map(a => [normalizeNameKey(a.name), a]));
    return rawRows.map((row) => {
      const nameKey = normalizeNameKey(row.name);
      if (!nameKey) return { ...row, status: "error", existing_id: null };
      const match = byName.get(nameKey);
      return { ...row, status: match ? "duplicate" : "new", existing_id: match?.id || null };
    });
  }, []);

  const readFile = useCallback(async (f) => {
    if (!f) return false;
    setReading(true);
    setError("");
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(f.name || "")) {
        throw new Error("استخدم ملف Excel أو CSV فقط.");
      }
      const parsed = await parseExcelFile(f);
      if (parsed.rows.length < 2) throw new Error("الملف لا يحتوي على بيانات كافية.");
      if (parsed.rows.length > 5001) throw new Error("الحد الأقصى للملف هو 5000 صف.");

      const detected = detectHeaderRow(parsed.rows, ACCOUNT_FIELDS);
      const autoMapping = detectColumnHeaders(parsed.rows[detected.index] || [], ACCOUNT_FIELDS);

      setRawRows(parsed.rows);
      setHeaderIndex(detected.index);
      setMapping(autoMapping);

      const dataRows = parsed.rows.slice(detected.index + 1).filter(row => row.some(cell => String(cell ?? "").trim()));
      const fieldToCol = {};
      Object.entries(autoMapping).forEach(([colIdx, field]) => { fieldToCol[field] = Number(colIdx); });

      const mappedRows = dataRows.map((row, i) => ({
        __rowNumber: i + 1,
        name: String(row[fieldToCol.name] ?? "").trim(),
        phone: String(row[fieldToCol.phone] ?? "").trim(),
        address: String(row[fieldToCol.address] ?? "").trim(),
        opening_balance: Number(row[fieldToCol.opening_balance] ?? 0) || 0,
      }));

      const enriched = enrichRows(mappedRows, existingAccounts);
      setRows(enriched);
      setFile(f);
      setFileName(f.name);
      setDuplicateActions({});
      setResult(null);
      setStep(2);
      return true;
    } catch (err) {
      const msg = err?.message || "تعذر قراءة الملف.";
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setReading(false);
      setDragActive(false);
    }
  }, [enrichRows, existingAccounts]);

  const handleFile = useCallback(async (e) => {
    const ok = await readFile(e.target.files?.[0]);
    e.target.value = "";
    return ok;
  }, [readFile]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    return readFile(e.dataTransfer.files?.[0]);
  }, [readFile]);

  const removeRow = useCallback((rowNumber) => {
    setRows(prev => prev.filter(r => r.__rowNumber !== rowNumber));
  }, []);

  const setDuplicateAction = useCallback((nameKey, action) => {
    setDuplicateActions(prev => ({ ...prev, [nameKey]: action }));
  }, []);

  const runImport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const submitRows = rows
        .filter(r => r.status !== "error")
        .map(r => {
          const nameKey = normalizeNameKey(r.name);
          const action = r.status === "duplicate"
            ? (duplicateActions[nameKey] || "skip")
            : "insert";
          if (action === "skip") return { action: "skip", name: r.name };
          return {
            action,
            existing_id: r.existing_id || undefined,
            name: r.name,
            phone: r.phone || null,
            address: r.address || null,
            opening_balance: r.opening_balance || 0,
          };
        });

      const fileBase64 = await fileToBase64(file);
      const res = await api.post(`${apiBase}/import`, {
        rows: submitRows,
        file_name: fileName || null,
        file_mime: file?.type || null,
        file_base64: fileBase64,
      });
      const data = res.data?.data || {};
      setResult(data);
      setStep(5);
      await onImported?.();
    } catch (err) {
      const msg = err?.response?.data?.message || "فشل تنفيذ الاستيراد.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [rows, duplicateActions, file, fileName, apiBase, onImported]);

  const proceedFromPreview = useCallback(() => {
    const hasDuplicates = rows.some(r => r.status === "duplicate");
    if (hasDuplicates) {
      setStep(4);
    } else {
      runImport();
    }
  }, [rows, runImport]);

  const proceedFromColumns = useCallback(() => {
    applyNewMapping();
    setStep(3);
  }, []);

  const reset = useCallback(() => {
    setStep(1);
    setFile(null);
    setFileName("");
    setRows([]);
    setDuplicateActions({});
    setResult(null);
    setLoading(false);
    setReading(false);
    setDragActive(false);
    setError("");
    setRawRows([]);
    setHeaderIndex(0);
    setMapping({});
  }, []);

  const counts = {
    new: rows.filter(r => r.status === "new").length,
    duplicate: rows.filter(r => r.status === "duplicate").length,
    error: rows.filter(r => r.status === "error").length,
  };

  const hasDuplicates = rows.some(r => r.status === "duplicate");
  const actionable = counts.new + (hasDuplicates ? counts.duplicate : 0);
  const canProceedFromPreview = counts.error === 0 && actionable > 0;
  const hasNameMapped = Object.values(mapping).includes("name");

  const mappedFieldsCount = Object.values(mapping).filter(Boolean).length;
  const totalColumns = headers.length || 0;
  const totalDataRows = rawRows.length > headerIndex + 1
    ? rawRows.slice(headerIndex + 1).filter(row => row.some(cell => String(cell ?? "").trim())).length
    : 0;

  return {
    step, setStep,
    file, fileName,
    rows, removeRow,
    existingAccounts,
    duplicateActions, setDuplicateAction,
    result, loading, reading, dragActive, setDragActive,
    error,
    fileInputRef,
    handleFile, handleDrop,
    proceedFromPreview,
    proceedFromColumns,
    applyNewMapping,
    runImport,
    reset,
    counts, hasDuplicates, canProceedFromPreview,
    loadExisting,

    // Column mapping state
    rawRows, headers, headerIndex,
    mapping, updateMapping,
    ACCOUNT_FIELDS,
    sampleValues,
    hasNameMapped,
    mappedFieldsCount,
    totalColumns,
    totalDataRows,
  };
}
