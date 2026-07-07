import { useState, useEffect } from "react";
import api from "../services/api";
import {
  TrendingUp, Package, Wallet, Receipt, FileText, Shield, ClipboardList,
  FileImage, FileSpreadsheet, Printer, Layers, RotateCcw, Truck, Users,
  UserCheck, CalendarCheck, Percent, LineChart, Search, ClipboardCheck,
  Clock, Landmark, BadgePercent, ShoppingCart
} from "lucide-react";

const ICON_MAP = {
  TrendingUp, Package, Wallet, Receipt, FileText, Shield, ClipboardList,
  FileImage, FileSpreadsheet, Printer, Layers, RotateCcw, Truck, Users,
  UserCheck, CalendarCheck, Percent, LineChart, Search, ClipboardCheck,
  Clock, Landmark, BadgePercent, ShoppingCart
};

const CATEGORY_META = {
  sales: { label: "المبيعات", icon: TrendingUp, color: "var(--success-DEFAULT,#10b981)" },
  purchases: { label: "المشتريات", icon: Package, color: "var(--info-DEFAULT,#3b82f6)" },
  inventory: { label: "المخزون", icon: Layers, color: "var(--primary-DEFAULT,#8b5cf6)" },
  accounts: { label: "الحسابات", icon: Wallet, color: "var(--warning-DEFAULT,#f59e0b)" },
  treasury: { label: "الخزينة والبنوك", icon: Landmark, color: "#06b6d4" },
  tax: { label: "الضرائب", icon: FileText, color: "var(--error-DEFAULT,#ef4444)" },
  profitability: { label: "الأرباح", icon: BadgePercent, color: "#d946ef" },
  individuals: { label: "الأفراد والرقابة", icon: Shield, color: "var(--text-secondary,#94a3b8)" },
  users: { label: "المستخدمين", icon: Users, color: "#6366f1" },
};

const SOURCE_META = {
  sales: { label: "المبيعات", color: "var(--success-DEFAULT,#10b981)" },
  purchases: { label: "المشتريات", color: "var(--info-DEFAULT,#3b82f6)" },
  "purchase-returns": { label: "مرتجعات المشتريات", color: "#f97316" },
  "sales-returns": { label: "مرتجعات المبيعات", color: "#ec4899" },
  suppliers: { label: "الموردين", color: "var(--warning-DEFAULT,#f59e0b)" },
  customers: { label: "العملاء", color: "#8b5cf6" },
  employees: { label: "الموظفين", color: "var(--text-secondary,#94a3b8)" },
  users: { label: "المستخدمين", color: "#6366f1" },
  installments: { label: "أنظمة التقسيط", color: "#14b8a6" },
  items: { label: "الأصناف", color: "var(--primary-DEFAULT,#8b5cf6)" },
  warehouses: { label: "المخازن", color: "#0ea5e9" },
  expenses: { label: "المصروفات", color: "#ef4444" },
  revenues: { label: "الإيرادات الأخرى", color: "#10b981" },
  treasury: { label: "الخزينة", color: "#06b6d4" },
  "payment-flow": { label: "سجل التدفقات المالية", color: "#0f766e" },
  "profit-loader": { label: "مجمل ربح المبيعات", color: "#d946ef" },
  "net-profit": { label: "صافي الربح", color: "#1e40af" },
  expiry: { label: "انتهاء الصلاحية", color: "#d97706" },
  "owner-statement": { label: "لوحة صاحب المحل", color: "#0f172a" },
  tax: { label: "الضرائب", color: "var(--error-DEFAULT,#ef4444)" },
};

const DEFAULT_COST_METHODS = [
  { value: "wacc", label: "متوسط التكلفة (WACC)" },
  { value: "last_purchase", label: "آخر سعر شراء" },
  { value: "fifo", label: "الوارد أولا يصرف أولا (FIFO)" },
  { value: "lifo", label: "الوارد أخيرا يصرف أولا (LIFO)" },
];

let _configCache = null;

export function getConfig() { return _configCache; }

function resolveIcon(name) {
  if (!name) return null;
  if (typeof name === "function") return name;
  return ICON_MAP[name] || null;
}

export function useReportsConfig() {
  const [state, setState] = useState({ isLoading: true, data: null, error: null });

  useEffect(() => {
    console.log("[useReportsConfig] mounting, fetching config...");
    let cancelled = false;
    api.get("/api/reports/config")
      .then(res => {
        console.log("[useReportsConfig] API response status:", res.status);
        if (cancelled) return;
        const data = res.data?.data;
        if (!data) throw new Error("No reports config data");
        const sources = (data.sources || []).map(s => {
          const meta = SOURCE_META[s.id] || {};
          return { ...s, label: s.label || meta.label || s.label_key || s.id, color: s.color || meta.color || "var(--text-secondary,#94a3b8)", icon: resolveIcon(s.icon) || meta.icon || FileText };
        });
        const categories = (data.categories || []).map(c => {
          const meta = CATEGORY_META[c.id] || {};
          return { ...c, label: c.label || meta.label || c.label_key || c.id, color: c.color || meta.color || "var(--text-secondary,#94a3b8)", icon: resolveIcon(c.icon) || meta.icon || FileText };
        });
        const formatIcons = {};
        if (data.formatIcons) {
          Object.entries(data.formatIcons).forEach(([key, cfg]) => {
            formatIcons[key] = { ...cfg, icon: resolveIcon(cfg.icon) };
          });
        }
        const enriched = {
          ...data, sources, categories, formatIcons,
          classifications: data.classifications || {},
          filterDimensions: data.filterDimensions || {},
          ghostRows: data.ghostRows || {},
          catGhostRows: data.catGhostRows || {},
          catPreviewColumns: data.catPreviewColumns || {},
          classificationColumns: data.classificationColumns || {},
          costMethods: Array.isArray(data.costMethods) && data.costMethods.length ? data.costMethods : DEFAULT_COST_METHODS,
          reportDescriptions: data.reportDescriptions || {},
          valueTranslations: data.valueTranslations || {},
          colTypeStyle: data.colTypeStyle || {},
        };
        _configCache = enriched;
        setState({ isLoading: false, data: enriched, error: null });
      })
      .catch(err => {
        console.error("[useReportsConfig] API error:", err?.response?.status, err?.response?.data || err?.message || err);
        if (!cancelled) setState({ isLoading: false, data: null, error: err });
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}

/** Format date to YYYY-MM-DD (Egypt timezone) */
export function fmtDate(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Get report description by classification ID */
export function getReportDescription(classificationId) {
  if (!classificationId) return "تقرير تحليلي يستعرض بيانات ومؤشرات العمليات التشغيلية والمالية في النظام.";
  const descs = _configCache?.reportDescriptions || {};
  return descs[classificationId] || descs["cls_" + classificationId] || "تقرير تحليلي تفصيلي لمتابعة وتقييم مؤشرات أداء النشاط التجاري.";
}

/** Format/translate a cell value for display */
export function formatReportCellValue(key, rawValue) {
  if (rawValue == null || rawValue === "") return "—";
  const str = String(rawValue).trim();
  const translations = _configCache?.valueTranslations || {};
  if (translations[str]) return translations[str];
  if (translations[str.toLowerCase()]) return translations[str.toLowerCase()];
  return rawValue;
}

/** Get classification config for a given source */
export function getClassificationsForSource(sourceKey) {
  return _configCache?.classifications?.[sourceKey] || [];
}

/** Get filter dimensions for a given source */
export function getFilterDimensions(sourceKey) {
  return _configCache?.filterDimensions?.[sourceKey] || [];
}