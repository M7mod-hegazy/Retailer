import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Package,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import WhatsAppIcon from "../../components/ui/WhatsAppIcon";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useUiStore } from "../../stores/uiStore";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import ConsequencePreview from "../../components/ui/ConsequencePreview";
import PermissionGate from "../../components/ui/PermissionGate";
import PhysicalCountMetrics from "../../components/stock/PhysicalCountMetrics";
import PhysicalCountRow from "../../components/stock/PhysicalCountRow";
import PhysicalCountSessionPreview from "../../components/stock/PhysicalCountSessionPreview";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import PhysicalCountTemplate from "../../components/print/templates/PhysicalCountTemplate";
import WhatsAppSendModal from "../../components/whatsapp/WhatsAppSendModal";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "منذ لحظات";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

function StatusBadge({ status }) {
  const map = {
    in_progress: { label: "جارٍ", cls: "bg-primary/10 text-primary" },
    completed: { label: "مكتمل", cls: "bg-success-bg text-success-text" },
    cancelled: { label: "ملغى", cls: "bg-bg-overlay text-text-secondary" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-bg-overlay text-text-secondary" };
  return <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${cls}`}>{label}</span>;
}

function ScopeBadge({ scope, type, warehouseName, categoryName }) {
  if (type === "complete") return <span className="inline-flex items-center gap-1"><Package className="w-3.5 h-3.5" /> جرد شامل</span>;
  if (scope === "warehouse") return <span className="inline-flex items-center gap-1"><Warehouse className="w-3.5 h-3.5" /> {warehouseName || "مستودع"}</span>;
  if (scope === "category") return <span>{categoryName || "فئة"}</span>;
  return <span>أصناف مخصصة</span>;
}

const POLL_INTERVAL = 30000;
const NOOP = () => {};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PhysicalCountPage() {
  usePageTour("physical_count");
  const { setDynamicBreadcrumb, clearDynamicBreadcrumb } = useUiStore.getState();
  const handleKeyDown = useFieldNavigation();
  const formWarehouseRef = useRef(null);
  const formCategoryRef = useRef(null);
  const formItemSearchRef = useRef(null);
  const formItemCategoryRef = useRef(null);
  const formSubmitRef = useRef(null);
  const barcodeInputRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // ─── State ──────────────────────────────────────────────────────
  const [view, setView] = useState("dashboard");
  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Dashboard
  const [showForm, setShowForm] = useState(false);
  const [formScope, setFormScope] = useState("warehouse");
  const [formType, setFormType] = useState("standard");
  const [formName, setFormName] = useState("");
  const [formWarehouse, setFormWarehouse] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formItemSearch, setFormItemSearch] = useState("");
  const [formItemCategory, setFormItemCategory] = useState("");
  const [formItems, setFormItems] = useState([]);
  const [formSelectedItems, setFormSelectedItems] = useState([]);
  const [formItemsLoading, setFormItemsLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [dashboardTab, setDashboardTab] = useState("active");

  // Reference data
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);

  // Session view
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [savingLines, setSavingLines] = useState({});
  const [localCounts, setLocalCounts] = useState({});
  const [stats, setStats] = useState({ total_lines: 0, counted_lines: 0, variance_count: 0, completed_lines: 0 });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [previewSession, setPreviewSession] = useState(null);
  const [highlightItemId, setHighlightItemId] = useState(null);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [printPreview, setPrintPreview] = useState(false);
  const [waSendOpen, setWaSendOpen] = useState(false);
  const [waSendSession, setWaSendSession] = useState(null);
  const [exportingSession, setExportingSession] = useState(null);
  const [loadingSessionId, setLoadingSessionId] = useState(null);
  const [openMenuSessionId, setOpenMenuSessionId] = useState(null);

  // Live awareness
  const [lastPollTime, setLastPollTime] = useState(null);
  const [stockChanges, setStockChanges] = useState([]);
  const [showStockChangeBanner, setShowStockChangeBanner] = useState(false);
  const pollRef = useRef(null);
  const loadSessionRef = useRef(null);

  // ─── Reference Data ─────────────────────────────────────────────
  useEffect(() => {
    api.get("/api/warehouses").then((r) => setWarehouses(r.data?.data || [])).catch(() => {});
    api.get("/api/categories").then((r) => setCategories(r.data?.data || [])).catch(() => {});
  }, []);

  // ─── Persistence — keep the view in sync with the URL ───────────
  // Reacts to searchParams (not just mount) so links back to the bare
  // /stock/physical-count route (breadcrumb, sidebar nav) actually reset
  // the view instead of leaving the previously opened session on screen.
  useEffect(() => {
    const sid = searchParams.get("session");
    if (sid) {
      if (String(activeSession?.id) !== sid) loadSession(Number(sid));
    } else if (view === "session") {
      exitSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Clear the topbar breadcrumb when leaving this page entirely (e.g. via
  // sidebar nav) so a stale session name doesn't bleed into other pages.
  useEffect(() => () => clearDynamicBreadcrumb(), []);

  // ─── Sessions List ──────────────────────────────────────────────
  const loadSessions = useCallback(() => {
    setLoadingSessions(true);
    api.get("/api/stock/physical-count/sessions")
      .then((r) => setSessions(r.data?.data || []))
      .catch(() => toast.error("تعذّر تحميل قائمة الجرد"))
      .finally(() => setLoadingSessions(false));
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openMenuSessionId) return;
    const handler = () => setOpenMenuSessionId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openMenuSessionId]);

  // ─── Items for custom scope ─────────────────────────────────────
  useEffect(() => {
    if (formScope !== "custom") return;
    setFormItemsLoading(true);
    const params = { search: formItemSearch };
    if (formItemCategory) params.category_id = formItemCategory;
    api.get("/api/items", { params })
      .then((r) => setFormItems(r.data?.data || []))
      .catch(() => {})
      .finally(() => setFormItemsLoading(false));
  }, [formScope, formItemSearch, formItemCategory]);

  // ─── Live Polling ───────────────────────────────────────────────
  useEffect(() => {
    if (!activeSession || activeSession.readOnly || !lastPollTime) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await api.get(`/api/stock/physical-count/sessions/${activeSession.id}/stock-changes`, {
          params: { since: lastPollTime },
        });
        const changes = r.data?.data?.changes || [];
        setLastPollTime(r.data?.data?.last_checked || lastPollTime);
        if (changes.length > 0) {
          // Auto-apply stock changes for untouched lines
          try {
            const ar = await api.post(`/api/stock/physical-count/sessions/${activeSession.id}/apply-stock-changes`);
            const updated = ar.data?.data?.updated || 0;
            if (updated > 0) {
              toast.success(`تم تحديث ${updated} صنف من النظام`);
              loadSessionRef.current?.(activeSession.id);
            }
          } catch {
            // Fall back to banner if auto-apply fails
            setStockChanges(changes);
            setShowStockChangeBanner(true);
          }
        }
      } catch {
        // silent
      }
    }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [activeSession?.id, activeSession?.readOnly, lastPollTime]);

  // ─── Load Session ───────────────────────────────────────────────
  async function loadSession(sessionId, readOnly = false) {
    try {
      const r = await api.get(`/api/stock/physical-count/sessions/${sessionId}`);
      const session = r.data?.data;
      if (!session) return;

      const counts = {};
      const initStats = {
        total_lines: session.lines.length,
        counted_lines: 0,
        variance_count: 0,
        completed_lines: 0,
      };
      for (const line of session.lines) {
        const key = `${line.item_id}_${line.warehouse_id || "null"}`;
        counts[key] = line.counted_quantity;
        if (line.touched) initStats.counted_lines++;
        if (line.variance !== 0) initStats.variance_count++;
        if (line.status === "completed") initStats.completed_lines++;
      }
      setLocalCounts(counts);
      setStats(initStats);
      setActiveSession({ ...session, readOnly: readOnly || session.status !== "in_progress" });
      setView("session");
      setLastPollTime(new Date().toISOString());
      setShowStockChangeBanner(false);
      setStockChanges([]);
      setSearchParams({ session: String(sessionId) });
      setDynamicBreadcrumb({ label: session.name || `جرد #${session.id}`, path: `/stock/physical-count?session=${sessionId}` });
      setWaSendSession(null);
    } catch {
      toast.error("تعذّر تحميل بيانات الجرد");
    }
  }
  loadSessionRef.current = loadSession;

  function exitSession() {
    setView("dashboard");
    setActiveSession(null);
    setWaSendSession(null);
    setLocalCounts({});
    setSavingLines({});
    setStats({ total_lines: 0, counted_lines: 0, variance_count: 0, completed_lines: 0 });
    setSessionSearch("");
    setSessionFilter("all");
    setSearchParams({});
    setHighlightItemId(null);
    setBarcodeValue("");
    clearInterval(pollRef.current);
    setLastPollTime(null);
    setShowStockChangeBanner(false);
    clearDynamicBreadcrumb();
    loadSessions();
  }

  // ─── Create Session ─────────────────────────────────────────────
  // ─── Export Session ───────────────────────────────────────────────
  async function handleExportSession(sessionId, format) {
    setExportingSession(`${sessionId}-${format}`);
    try {
      const r = await api.get(`/api/stock/physical-count/sessions/${sessionId}/export`, {
        params: { format },
        responseType: "blob",
      });
      const blob = new Blob([r.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "excel" ? "xlsx" : format === "word" ? "docx" : "pdf";
      const session = sessions.find((s) => s.id === sessionId);
      a.download = `${session?.name || `جرد-${sessionId}`}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`تم التصدير كـ ${format.toUpperCase()}`);
    } catch {
      toast.error("تعذّر التصدير");
    } finally {
      setExportingSession(null);
    }
  }

  async function handleCreateSession() {
    if (!formName.trim()) return toast.error("أدخل اسماً للجرد");
    if (formType !== "complete" && formScope === "warehouse" && !formWarehouse) return toast.error("اختر المستودع");
    if (formScope === "category" && !formCategory) return toast.error("اختر الفئة");
    if (formScope === "custom" && formSelectedItems.length === 0) return toast.error("اختر صنفاً واحداً على الأقل");

    setFormSubmitting(true);
    try {
      const body = {
        name: formName.trim(),
        type: formType,
        scope: formType === "complete" ? "complete" : formScope,
        notes: formNotes.trim() || null,
        warehouse_id: formType !== "complete" && formScope === "warehouse" ? Number(formWarehouse) : null,
        category_id: formScope === "category" ? Number(formCategory) : null,
        item_ids: formScope === "custom" ? formSelectedItems.map((s) => s.id) : null,
      };
      const r = await api.post("/api/stock/physical-count/sessions", body);
      toast.success("تم إنشاء جلسة الجرد");
      setShowForm(false);
      setFormName("");
      setFormWarehouse("");
      setFormCategory("");
      setFormSelectedItems([]);
      setFormNotes("");
      setFormType("standard");
      setFormScope("warehouse");
      loadSession(r.data.data.id);
    } catch (e) {
      toast.error(e.response?.data?.message || "تعذّر إنشاء الجلسة");
    } finally {
      setFormSubmitting(false);
    }
  }

  // ─── Save Line ──────────────────────────────────────────────────
  // useCallback (keyed only on activeSession) keeps this reference stable
  // across the localOnly keystroke path — that's what lets PhysicalCountRow's
  // React.memo actually skip re-rendering the other 1000+ rows while typing.
  const saveLine = useCallback(async (itemId, warehouseId, countedQty, localOnly = false) => {
    const key = `${itemId}_${warehouseId ?? "null"}`;
    setLocalCounts((p) => ({ ...p, [key]: countedQty }));

    if (localOnly || !activeSession || activeSession.readOnly) return;

    setSavingLines((p) => ({ ...p, [key]: "saving" }));
    try {
      const r = await api.post(`/api/stock/physical-count/sessions/${activeSession.id}/lines`, {
        item_id: itemId,
        warehouse_id: warehouseId || null,
        counted_quantity: countedQty,
      });
      setSavingLines((p) => ({ ...p, [key]: "ok" }));
      const d = r.data?.data || {};
      setStats({
        total_lines: d.total_lines,
        counted_lines: d.counted_lines,
        variance_count: d.variance_count,
        completed_lines: d.completed_lines,
      });

      setActiveSession((prev) => {
        if (!prev) return prev;
        const line = prev.lines.find((l) => l.item_id === itemId && (l.warehouse_id ?? null) === (warehouseId ?? null));
        const variance = countedQty - (line?.system_quantity ?? 0);
        const lines = prev.lines.map((l) =>
          l.item_id === itemId && (l.warehouse_id ?? null) === (warehouseId ?? null)
            ? { ...l, counted_quantity: countedQty, variance, touched: 1 }
            : l,
        );
        return { ...prev, lines, updated_at: new Date().toISOString() };
      });
      setTimeout(() => setSavingLines((p) => { const n = { ...p }; delete n[key]; return n; }), 2000);
    } catch {
      setSavingLines((p) => ({ ...p, [key]: "error" }));
    }
  }, [activeSession]);

  // ─── Complete Single Line ───────────────────────────────────────
  const handleCompleteLine = useCallback(async (lineId, countedQty, notes) => {
    try {
      const r = await api.post(
        `/api/stock/physical-count/sessions/${activeSession.id}/lines/${lineId}/complete`,
        { counted_quantity: countedQty, notes: notes || null },
      );
      const d = r.data?.data || {};
      setStats({
        total_lines: d.total_lines,
        counted_lines: d.counted_lines,
        variance_count: d.variance_count,
        completed_lines: d.completed_lines,
      });
      if (d.line) {
        setActiveSession((prev) => {
          if (!prev) return prev;
          const lines = prev.lines.map((l) => (l.id === lineId ? { ...l, ...d.line } : l));
          return { ...prev, lines };
        });
      }
      toast.success("تم اعتماد هذا الصنف");
    } catch (e) {
      toast.error(e.response?.data?.message || "تعذّر اعتماد الصنف");
    }
  }, [activeSession]);

  // ─── Notes Change ───────────────────────────────────────────────
  const handleNotesChange = useCallback(async (lineId, notes) => {
    if (!activeSession || activeSession.readOnly) return;
    try {
      const line = activeSession.lines.find((l) => l.id === lineId);
      if (!line) return;
      await api.post(`/api/stock/physical-count/sessions/${activeSession.id}/lines`, {
        item_id: line.item_id,
        warehouse_id: line.warehouse_id,
        counted_quantity: line.counted_quantity,
        notes,
      });
      setActiveSession((prev) => {
        if (!prev) return prev;
        const lines = prev.lines.map((l) => (l.id === lineId ? { ...l, notes } : l));
        return { ...prev, lines };
      });
    } catch {
      // silent
    }
  }, [activeSession]);

  // ─── Confirm / Cancel ──────────────────────────────────────────
  async function handleConfirm() {
    setConfirming(true);
    try {
      await api.post(`/api/stock/physical-count/sessions/${activeSession.id}/confirm`);
      toast.success("تم اعتماد الجرد وتحديث الأرصدة");
      exitSession();
    } catch (e) {
      toast.error(e.response?.data?.message || "تعذّر اعتماد الجرد");
    } finally {
      setConfirming(false);
      setConfirmDialog(null);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.delete(`/api/stock/physical-count/sessions/${activeSession.id}`);
      toast.success("تم إلغاء الجلسة");
      exitSession();
    } catch (e) {
      toast.error(e.response?.data?.message || "تعذّر إلغاء الجرد");
    } finally {
      setCancelling(false);
      setCancelDialog(false);
    }
  }

  // ─── Apply Stock Changes ────────────────────────────────────────
  async function handleApplyStockChanges() {
    try {
      const r = await api.post(`/api/stock/physical-count/sessions/${activeSession.id}/apply-stock-changes`);
      const updated = r.data?.data?.updated || 0;
      if (updated > 0) {
        toast.success(`تم تحديث ${updated} صنف من النظام`);
        // Reload session to get fresh data
        loadSession(activeSession.id);
      } else {
        toast("لا توجد تحديثات");
      }
    } catch {
      toast.error("تعذّر تحديث الأرصدة");
    }
    setShowStockChangeBanner(false);
    setStockChanges([]);
  }

  // ─── Barcode Scan ───────────────────────────────────────────────
  function handleBarcodeScan(e) {
    if (e.key !== "Enter") return;
    const code = barcodeValue.trim();
    if (!code) return;
    setBarcodeValue("");

    if (!activeSession) return;
    const line = activeSession.lines.find(
      (l) => l.barcode === code || l.item_code === code,
    );
    if (!line) {
      toast.error("الصنف غير موجود في هذا الجرد");
      return;
    }
    setHighlightItemId(line.item_id);
    setTimeout(() => setHighlightItemId(null), 3000);
    // Scroll to the line
    const el = document.querySelector(`[data-item-id="${line.item_id}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ─── Filtered Lines ─────────────────────────────────────────────
  const filteredLines = useMemo(() => {
    if (!activeSession) return [];
    let lines = activeSession.lines;
    if (sessionSearch) {
      const q = sessionSearch.toLowerCase();
      lines = lines.filter(
        (l) =>
          l.item_name?.toLowerCase().includes(q) ||
          l.barcode?.toLowerCase().includes(q) ||
          l.item_code?.toLowerCase().includes(q),
      );
    }
    if (sessionFilter === "untouched") lines = lines.filter((l) => !l.touched);
    if (sessionFilter === "variance") lines = lines.filter((l) => l.variance !== 0);
    return lines;
  }, [activeSession, sessionSearch, sessionFilter]);

  const pendingLines = useMemo(
    () => filteredLines.filter((l) => l.status !== "completed"),
    [filteredLines],
  );
  const completedLines = useMemo(
    () => filteredLines.filter((l) => l.status === "completed"),
    [filteredLines],
  );

  // Reset page when search or filter changes
  useEffect(() => { setPage(1); }, [sessionSearch, sessionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLines.length / PAGE_SIZE));
  const paginatedLines = useMemo(
    () => {
      const start = (page - 1) * PAGE_SIZE;
      return filteredLines.slice(start, start + PAGE_SIZE);
    },
    [filteredLines, page],
  );
  const paginatedPending = useMemo(
    () => paginatedLines.filter((l) => l.status !== "completed"),
    [paginatedLines],
  );
  const paginatedCompleted = useMemo(
    () => paginatedLines.filter((l) => l.status === "completed"),
    [paginatedLines],
  );
  const hasMore = page < totalPages;

  // ─── Dashboard Tabs ─────────────────────────────────────────────
  const activeSessions = useMemo(() => sessions.filter((s) => s.status === "in_progress"), [sessions]);
  const completedSessions = useMemo(() => sessions.filter((s) => s.status === "completed"), [sessions]);
  const displaySessions = dashboardTab === "active" ? activeSessions : completedSessions;

  // ─── Group by warehouse (for complete type) ─────────────────────
  const warehouseGroups = useMemo(() => {
    if (!activeSession || activeSession.type !== "complete") return null;
    // Build full groups for header stats (total/counted across ALL lines)
    const fullGroups = {};
    for (const line of filteredLines) {
      const whId = line.warehouse_id || "none";
      if (!fullGroups[whId]) fullGroups[whId] = { name: line.warehouse_name || "غير محدد", lines: [], counted: 0, total: 0 };
      fullGroups[whId].lines.push(line);
      fullGroups[whId].total++;
      if (line.touched) fullGroups[whId].counted++;
    }
    // Build paginated groups for rendering (only lines on current page)
    const paginatedSet = new Set(paginatedLines.map((l) => `${l.item_id}_${l.warehouse_id ?? "null"}`));
    const paginatedGroups = {};
    for (const line of paginatedLines) {
      const whId = line.warehouse_id || "none";
      if (!paginatedGroups[whId]) paginatedGroups[whId] = { name: line.warehouse_name || "غير محدد", lines: [], counted: 0, total: 0 };
      paginatedGroups[whId].lines.push(line);
    }
    // Merge: use full counts for header, paginated lines for rendering
    // Skip warehouses with no lines on the current page
    return Object.keys(fullGroups)
      .filter((whId) => paginatedGroups[whId]?.lines.length > 0)
      .map((whId) => ({
        ...fullGroups[whId],
        lines: paginatedGroups[whId].lines,
      }));
  }, [activeSession, filteredLines, paginatedLines]);

  // ═══════════════════════════════════════════════════════════════════
  // ─── RENDER DASHBOARD ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════
  if (view === "dashboard") {
    return (
      <main className="min-h-[100dvh] bg-bg-base text-text-primary w-full overflow-x-hidden font-sans" dir="rtl">
        <div className="max-w-[1400px] mx-auto px-6 py-12 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
          {/* Left Sticky Header */}
          <div className="lg:col-span-5 flex flex-col items-start justify-start relative">
            <div className="lg:sticky top-24 w-full">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
                <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[1] text-text-primary mb-8 w-full max-w-[20ch]">
                  الجرد<br />المادي.
                </h1>
                <p className="text-lg text-text-secondary leading-relaxed max-w-[400px] mb-12 font-medium">
                  تسويات المخزون، مراجعات الأرصدة، وإدارة الكميات الفعلية عبر نظام عمليات عالي الكثافة والأداء.
                </p>

                <PermissionGate page="physical_count" action="add">
                  <motion.button
                    data-help="add-button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center justify-center gap-3 bg-primary text-white rounded-full px-8 py-5 text-[15px] font-black tracking-widest uppercase shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.7)] transition-shadow w-full max-w-[320px]"
                  >
                    {showForm ? "إلغاء البدء" : "جلسة جرد جديدة"}
                    <Plus className={`w-5 h-5 transition-transform duration-500 ${showForm ? "rotate-45" : ""}`} />
                  </motion.button>
                </PermissionGate>
              </motion.div>
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-7 flex flex-col gap-12">
            <AnimatePresence mode="popLayout">
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0, filter: "blur(10px)" }}
                  animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
                  exit={{ opacity: 0, height: 0, filter: "blur(10px)" }}
                  className="bg-bg-surface rounded-[2.5rem] p-10 md:p-12 shadow-card border border-border-normal/50 overflow-hidden"
                >
                  <h2 className="text-3xl font-black text-text-primary mb-10 tracking-tight">إعداد الجلسة</h2>

                  <div className="space-y-10">
                    {/* Name */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-4">اسم الجرد</label>
                      <input
                        className="w-full text-3xl font-black text-text-primary placeholder:text-text-muted/30 outline-none border-b border-border-normal focus:border-primary pb-4 transition-colors bg-transparent"
                        placeholder="جرد المستودع الرئيسي..."
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                      />
                    </div>

                    {/* Type Selection */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-4">نوع الجرد</label>
                      <div className="flex flex-wrap gap-4">
                        {[
                          { val: "standard", label: "جرد عادي" },
                          { val: "complete", label: "جرد شامل — كل المخازن" },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            onClick={() => {
                              setFormType(opt.val);
                              if (opt.val === "complete") setFormScope("warehouse");
                            }}
                            className={`px-8 py-4 rounded-full text-sm font-black uppercase tracking-widest transition-all ${
                              formType === opt.val ? "bg-primary text-white shadow-xl" : "bg-bg-overlay text-text-secondary hover:bg-border-normal"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Scope Selection (only for standard type) */}
                    {formType === "standard" && (
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-4">النطاق</label>
                        <div className="flex flex-wrap gap-4">
                          {[
                            { val: "warehouse", label: "مستودع كامل" },
                            { val: "category", label: "فئة محددة" },
                            { val: "custom", label: "أصناف مخصصة" },
                          ].map((opt) => (
                            <button
                              key={opt.val}
                              onClick={() => setFormScope(opt.val)}
                              className={`px-8 py-4 rounded-full text-sm font-black uppercase tracking-widest transition-all ${
                                formScope === opt.val ? "bg-primary text-white shadow-xl" : "bg-bg-overlay text-text-secondary hover:bg-border-normal"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dynamic Selects */}
                    {formType === "standard" && formScope === "warehouse" && (
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-4">المستودع</label>
                        <select
                          ref={formWarehouseRef}
                          className="w-full text-2xl font-bold text-text-primary outline-none border-b border-border-normal focus:border-primary pb-4 transition-colors bg-bg-surface appearance-none cursor-pointer"
                          value={formWarehouse}
                          onChange={(e) => setFormWarehouse(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, { nextRef: formSubmitRef })}
                        >
                          <option value="" disabled>اختر مستودعاً...</option>
                          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>
                    )}

                    {formType === "standard" && formScope === "category" && (
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-4">الفئة</label>
                        <select
                          ref={formCategoryRef}
                          className="w-full text-2xl font-bold text-text-primary outline-none border-b border-border-normal focus:border-primary pb-4 transition-colors bg-bg-surface appearance-none cursor-pointer"
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, { nextRef: formSubmitRef })}
                        >
                          <option value="" disabled>اختر فئة...</option>
                          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    )}

                    {formType === "standard" && formScope === "custom" && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 relative">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
                            <input
                              ref={formItemSearchRef}
                              className="w-full text-lg font-bold text-text-primary outline-none border-b border-border-normal focus:border-primary pb-4 pr-12 transition-colors bg-transparent placeholder:text-text-muted/30"
                              placeholder="ابحث بالاسم أو الكود..."
                              value={formItemSearch}
                              onChange={(e) => setFormItemSearch(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, { nextRef: formItemCategoryRef })}
                            />
                            {formItemSearch && (
                              <button type="button" onClick={() => setFormItemSearch("")} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors">
                                <X className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                          <div className="relative shrink-0">
                            <select
                              ref={formItemCategoryRef}
                              value={formItemCategory}
                              onChange={(e) => setFormItemCategory(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, { nextRef: formSubmitRef, prevRef: formItemSearchRef })}
                              className="appearance-none bg-bg-overlay text-text-secondary font-bold text-[13px] rounded-full px-6 py-3 pr-10 border-0 cursor-pointer hover:bg-border-normal transition-colors outline-none"
                            >
                              <option value="">كل الفئات</option>
                              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted">الأصناف</label>
                            <span className="text-xs font-bold text-text-muted">{formSelectedItems.length} مختار</span>
                          </div>
                          {formItemsLoading ? (
                            <div className="space-y-3">
                              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-bg-overlay rounded-2xl animate-pulse" />)}
                            </div>
                          ) : formItems.length === 0 ? (
                            <p className="text-sm text-text-muted py-8 text-center font-bold">
                              {formItemSearch || formItemCategory ? "لا توجد نتائج" : "ابدأ بالبحث لإضافة أصناف"}
                            </p>
                          ) : (
                            <div className="max-h-[300px] overflow-y-auto space-y-2 pl-1">
                              {formItems.map((item) => {
                                const selected = formSelectedItems.some((s) => s.id === item.id);
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() =>
                                      setFormSelectedItems((prev) =>
                                        selected
                                          ? prev.filter((s) => s.id !== item.id)
                                          : [...prev, { id: item.id, name: item.name, item_code: item.item_code, barcode: item.barcode }],
                                      )
                                    }
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl text-right transition-all border ${
                                      selected ? "bg-primary/5 border-primary/20 text-primary" : "bg-bg-overlay border-transparent hover:border-border-normal text-text-primary"
                                    }`}
                                  >
                                    <div
                                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
                                        selected ? "bg-primary border-primary text-white" : "border-border-strong"
                                      }`}
                                    >
                                      {selected && <Check className="w-4 h-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0 text-right">
                                      <p className="text-sm font-black text-text-primary truncate">{item.name || "—"}</p>
                                      <p className="text-[11px] font-mono text-text-muted">{item.item_code || "—"}</p>
                                    </div>
                                    {item.category_name && (
                                      <span className="text-[10px] font-bold text-text-muted bg-bg-surface px-3 py-1 rounded-full border border-border-subtle shrink-0">
                                        {item.category_name}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {formSelectedItems.length > 0 && (
                          <div>
                            <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-3">الأصناف المختارة</label>
                            <div className="flex flex-wrap gap-2">
                              {formSelectedItems.map((item) => (
                                <span key={item.id} className="inline-flex items-center gap-2 bg-primary/5 text-primary px-4 py-2 rounded-full text-sm font-bold border border-primary/10">
                                  {item.name}
                                  <button type="button" onClick={() => setFormSelectedItems((prev) => prev.filter((s) => s.id !== item.id))} className="hover:text-danger transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              ))}
                              <button
                                type="button"
                                onClick={() => setFormSelectedItems([])}
                                className="text-xs font-bold text-text-muted hover:text-danger transition-colors px-3 py-1"
                              >
                                إزالة الكل
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-4">ملاحظات (اختياري)</label>
                      <textarea
                        className="w-full text-sm font-bold text-text-primary outline-none border-b border-border-normal focus:border-primary pb-4 transition-colors bg-transparent resize-none placeholder:text-text-muted/30"
                        rows={2}
                        placeholder="ملاحظات على هذه الجلسة..."
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                      />
                    </div>

                    {/* Action */}
                    <div className="pt-6">
                      <button
                        ref={formSubmitRef}
                        onClick={handleCreateSession}
                        disabled={formSubmitting}
                        className="bg-primary text-white rounded-full px-8 h-16 text-[15px] font-black tracking-widest uppercase hover:opacity-90 transition-all shadow-xl w-full flex items-center justify-center gap-2"
                      >
                        {formSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                        {formSubmitting ? "جاري الإنشاء..." : formType === "complete" ? "بدء الجرد الشامل" : "اعتماد وبدء الجرد"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dashboard Tabs */}
            <div className="flex items-center gap-1 bg-bg-surface rounded-full p-1.5 border border-border-subtle w-fit">
              <button
                onClick={() => setDashboardTab("active")}
                className={`px-6 py-2.5 rounded-full text-sm font-black tracking-widest transition-all ${
                  dashboardTab === "active" ? "bg-primary text-white shadow-sm" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                قيد التنفيذ ({activeSessions.length})
              </button>
              <button
                onClick={() => setDashboardTab("completed")}
                className={`px-6 py-2.5 rounded-full text-sm font-black tracking-widest transition-all ${
                  dashboardTab === "completed" ? "bg-primary text-white shadow-sm" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                مكتملة ({completedSessions.length})
              </button>
            </div>

            {/* Sessions List */}
            <div className="space-y-6">
              {loadingSessions ? (
                <div className="animate-pulse space-y-6">
                  <div className="h-32 bg-border-normal/50 rounded-[2rem]" />
                  <div className="h-32 bg-border-normal/50 rounded-[2rem]" />
                </div>
              ) : displaySessions.length === 0 ? (
                <div className="py-32 text-center opacity-50">
                  <Package className="w-16 h-16 mx-auto mb-6 text-text-muted" />
                  <p className="text-text-muted font-black tracking-widest uppercase text-sm">
                    {dashboardTab === "active" ? "لا توجد جلسات جارية" : "لا توجد جلسات مكتملة"}
                  </p>
                </div>
              ) : (
                <div data-help="main-table" className="grid gap-4">
                  {displaySessions.map((s, idx) => {
                    const progress = s.total_lines > 0 ? Math.round((s.counted_lines / s.total_lines) * 100) : 0;
                    const menuOpen = openMenuSessionId === s.id;
                    return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, type: "spring", stiffness: 120, damping: 20 }}
                      className="group bg-bg-surface px-8 py-6 rounded-2xl shadow-card border border-border-subtle hover:border-primary/20 transition-all"
                    >
                      {/* Top row: name + enter */}
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <StatusBadge status={s.status} />
                          {s.type === "complete" && (
                            <span className="px-2.5 py-0.5 rounded-full bg-info-bg text-info-text text-[10px] font-black uppercase tracking-widest">شامل</span>
                          )}
                          <h4 className="text-lg font-black text-text-primary tracking-tight truncate">{s.name || `جرد #${s.id}`}</h4>
                          <span className="text-[11px] font-mono text-text-muted shrink-0">{timeAgo(s.updated_at || s.created_at)}</span>
                        </div>
                        <button
                          onClick={() => { setLoadingSessionId(s.id); loadSession(s.id, s.status !== "in_progress"); }}
                          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black bg-primary text-white hover:opacity-90 transition-all active:scale-95 shrink-0"
                          disabled={loadingSessionId === s.id}
                        >
                          {loadingSessionId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                          دخول
                        </button>
                      </div>

                      {/* Scope + progress bar */}
                      <div className="flex items-center gap-4">
                        <ScopeBadge scope={s.scope} type={s.type} warehouseName={s.warehouse_name} categoryName={s.category_name} />
                        <div className="flex-1 flex items-center gap-3">
                          <div className="flex-1 h-2 rounded-full bg-bg-overlay overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-black text-text-secondary whitespace-nowrap">
                            {s.counted_lines}<span className="text-text-muted font-bold">/{s.total_lines}</span>
                          </span>
                          {s.variance_count > 0 && (
                            <span className="text-xs font-black text-danger-text whitespace-nowrap">
                              {s.variance_count} فرق
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Preview — quick read-only overview, no need to open the full session */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setPreviewSession(s); }}
                            className="w-9 h-9 rounded-lg flex items-center justify-center bg-bg-overlay text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                            title="معاينة"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          {/* Print */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setExportingSession(`${s.id}-print`);
                              try {
                                const r = await api.get(`/api/stock/physical-count/sessions/${s.id}`);
                                const full = r.data?.data;
                                if (full) {
                                  setActiveSession({ ...full, readOnly: full.status !== "in_progress" });
                                  setPrintPreview(true);
                                }
                              } catch { toast.error("تعذّر تحميل الجلسة"); }
                              finally { setExportingSession(null); }
                            }}
                            className="w-9 h-9 rounded-lg flex items-center justify-center bg-bg-overlay text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors"
                            title="طباعة"
                          >
                            {exportingSession?.endsWith("-print") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                          </button>
                          {/* WhatsApp */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setWaSendSession(s); setWaSendOpen(true); }}
                            className="w-9 h-9 rounded-lg flex items-center justify-center bg-bg-overlay text-text-muted hover:text-success-text hover:bg-success-bg transition-colors"
                            title="إرسال واتساب"
                          >
                            <WhatsAppIcon className="w-4 h-4" />
                          </button>
                          {/* Export dropdown */}
                          <div className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); setOpenMenuSessionId(menuOpen ? null : s.id); }}
                              className="w-9 h-9 rounded-lg flex items-center justify-center bg-bg-overlay text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors"
                              title="تصدير وmore"
                            >
                              {exportingSession?.startsWith(`${s.id}-`) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="13" cy="8" r="1.5" /></svg>
                              )}
                            </button>
                            {menuOpen && (
                              <div className="absolute bottom-full mb-2 end-0 z-50 w-48 rounded-xl border border-border-normal bg-bg-surface shadow-modal overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => { setOpenMenuSessionId(null); handleExportSession(s.id, "pdf"); }}
                                  disabled={!!exportingSession}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-black text-text-primary hover:bg-bg-overlay transition-colors disabled:opacity-50"
                                >
                                  <Download className="w-3.5 h-3.5 text-danger-text" /> تصدير PDF
                                </button>
                                <button
                                  onClick={() => { setOpenMenuSessionId(null); handleExportSession(s.id, "excel"); }}
                                  disabled={!!exportingSession}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-black text-text-primary hover:bg-bg-overlay transition-colors disabled:opacity-50"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-success-text" /> تصدير Excel
                                </button>
                                <button
                                  onClick={() => { setOpenMenuSessionId(null); handleExportSession(s.id, "word"); }}
                                  disabled={!!exportingSession}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-black text-text-primary hover:bg-bg-overlay transition-colors disabled:opacity-50"
                                >
                                  <FileText className="w-3.5 h-3.5 text-info-text" /> تصدير Word
                                </button>
                                {s.status === "in_progress" && (
                                  <>
                                    <div className="h-px bg-border-subtle" />
                                    <PermissionGate page="physical_count" action="delete">
                                      <button
                                        onClick={async () => {
                                          setOpenMenuSessionId(null);
                                          if (!window.confirm("هل تريد إلغاء هذه الجلسة؟")) return;
                                          try {
                                            await api.delete(`/api/stock/physical-count/sessions/${s.id}`);
                                            toast.success("تم الإلغاء");
                                            loadSessions();
                                          } catch (err) {
                                            toast.error(err.response?.data?.message || "تعذّر الإلغاء");
                                          }
                                        }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-black text-danger-text hover:bg-danger-bg transition-colors"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" /> إلغاء الجلسة
                                      </button>
                                    </PermissionGate>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Session Preview Modal */}
        <PhysicalCountSessionPreview
          open={!!previewSession}
          session={previewSession}
          onClose={() => setPreviewSession(null)}
          onSendWhatsApp={(s) => { setPreviewSession(null); setWaSendSession(s); setWaSendOpen(true); }}
        />

        {/* WhatsApp Send Modal — PDF only for جرد */}
        <WhatsAppSendModal
          open={waSendOpen}
          onClose={() => { setWaSendOpen(false); setWaSendSession(null); }}
          invoice={waSendSession || {}}
          kind="physical_count"
          title="إرسال تقرير الجرد عبر واتساب"
          pdfEndpoint={waSendSession ? `/api/stock/physical-count/sessions/${waSendSession.id}/export?format=pdf` : undefined}
          pdfFileName={waSendSession ? `${waSendSession.name || `جرد-${waSendSession.id}`}.pdf` : undefined}
        />

        {/* Print Preview Modal */}
        {activeSession && (
          <PrintPreviewModal
            open={printPreview}
            onClose={() => setPrintPreview(false)}
            docType="physical_count_report"
            renderContent={(settings) => (
              <PhysicalCountTemplate session={activeSession} settings={settings} />
            )}
            onSendWhatsApp={() => { setPrintPreview(false); setWaSendOpen(true); }}
          />
        )}
      </main>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // ─── RENDER SESSION ───────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════
  return (
    <main className="relative min-h-[100dvh] bg-bg-base text-text-primary flex flex-col w-full overflow-hidden font-sans" dir="rtl">
      {/* Absolute Progress Line */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-bg-overlay z-50">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${stats.total_lines > 0 ? (stats.counted_lines / stats.total_lines) * 100 : 0}%` }}
          className="h-full bg-primary"
        />
      </div>

      {/* Live Stock Change Banner */}
      <AnimatePresence>
        {showStockChangeBanner && stockChanges.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-warning-bg border-b border-warning-border overflow-hidden"
          >
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-black text-warning-text">
                  ⚠️ {stockChanges.length} منتج تغيّر رصيده منذ بدء الجرد
                </p>
                <div className="mt-1 space-y-0.5">
                  {stockChanges.slice(0, 3).map((c, i) => (
                    <p key={i} className="text-xs font-bold text-warning-text/80">
                      {c.item_name}: {c.old_system_qty}→{c.new_system_qty} ({c.movement_type})
                    </p>
                  ))}
                  {stockChanges.length > 3 && (
                    <p className="text-xs font-bold text-warning-text/60">+{stockChanges.length - 3} المزيد...</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleApplyStockChanges}
                  className="px-4 py-2 rounded-xl bg-warning-text text-white text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  تحديث الأرصدة
                </button>
                <button
                  onClick={() => { setShowStockChangeBanner(false); setStockChanges([]); }}
                  className="px-4 py-2 rounded-xl bg-transparent text-warning-text text-xs font-black uppercase tracking-widest hover:bg-warning-text/10 transition-colors"
                >
                  تجاهل
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-border-subtle bg-bg-surface/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <button onClick={exitSession} className="w-12 h-12 flex items-center justify-center rounded-full bg-bg-overlay text-text-secondary hover:bg-border-normal transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-text-primary tracking-tight flex items-center gap-4">
              {activeSession?.name || `جرد #${activeSession?.id}`}
              {activeSession?.readOnly && (
                <span className="px-3 py-1 rounded-full bg-warning-bg text-warning-text text-[11px] font-black uppercase tracking-widest">قراءة فقط</span>
              )}
            </h1>
            <p className="text-sm font-bold text-text-secondary mt-1 flex items-center gap-2">
              <ScopeBadge scope={activeSession?.scope} type={activeSession?.type} warehouseName={activeSession?.warehouse_name} categoryName={activeSession?.category_name} />
              <span className="w-1 h-1 rounded-full bg-border-strong" />
              {stats.counted_lines} من {stats.total_lines}
              {stats.completed_lines > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-border-strong" />
                  <span className="text-success-text">{stats.completed_lines} مكتمل</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4">
          {/* Barcode Scan Input */}
          {!activeSession?.readOnly && (
            <div className="relative">
              <QrCode className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              <input
                ref={barcodeInputRef}
                className="w-48 text-sm font-mono font-bold text-text-primary outline-none border border-border-normal focus:border-primary rounded-xl pl-3 pr-9 py-2.5 bg-bg-overlay placeholder:text-text-muted/30 transition-colors"
                placeholder="مسح الباركود..."
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value)}
                onKeyDown={handleBarcodeScan}
              />
            </div>
          )}

          <div className="flex items-center gap-1 bg-bg-overlay p-1.5 rounded-full border border-border-normal">
            {["all", "untouched", "variance"].map((f) => (
              <button
                key={f}
                onClick={() => setSessionFilter(f)}
                className={`px-5 py-2 rounded-full text-xs font-black tracking-widest uppercase transition-all ${
                  sessionFilter === f ? "bg-bg-surface text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {f === "all" ? "الكل" : f === "untouched" ? "لم يُعد" : "فروقات"}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-border-normal" />

          <button onClick={() => setPrintPreview(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-bg-overlay text-text-secondary hover:bg-border-normal hover:text-text-primary transition-colors" title="طباعة">
            <Printer className="w-4 h-4" />
          </button>
          <button onClick={() => setWaSendOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-bg-overlay text-text-secondary hover:bg-border-normal hover:text-text-primary transition-colors" title="إرسال واتساب">
            <WhatsAppIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="max-w-6xl mx-auto px-6 pt-8 w-full">
        <PhysicalCountMetrics stats={stats} lines={activeSession?.lines} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-48">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Search */}
          <div data-help="search-bar" className="relative mb-6">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              className="w-full text-base font-bold text-text-primary outline-none border-2 border-border-normal focus:border-primary bg-bg-surface rounded-2xl py-3.5 pl-5 pr-12 transition-colors placeholder:text-text-muted/50 shadow-card"
              placeholder="ابحث عن صنف أو باركود..."
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
            />
          </div>

          {/* Column header — real table semantics so a 1000+ row list reads
              clearly, instead of repeating tiny labels inside every row */}
          <div className="hidden sm:flex items-center gap-3 px-5 py-2.5 rounded-t-2xl border border-b-0 border-border-normal bg-bg-overlay text-[10px] font-black uppercase tracking-widest text-text-muted sticky top-0 z-10">
            <div className="w-2 shrink-0" />
            <div className="flex-1">الصنف</div>
            <div className="w-20 shrink-0 text-center">النظام</div>
            <div className="w-px shrink-0" />
            <div className="w-24 shrink-0 text-center">الفعلي</div>
            <div className="w-px shrink-0" />
            <div className="w-20 shrink-0 text-center">الفرق</div>
            <div className="w-28 shrink-0 text-center">الحالة</div>
          </div>

          {/* Warehouse Groups (for complete type) */}
          {warehouseGroups ? (
            <div className="border border-border-normal rounded-b-2xl bg-bg-surface shadow-card overflow-hidden divide-y divide-border-normal">
              {warehouseGroups.map((group, gi) => (
                <motion.div
                  key={gi}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.1 }}
                >
                  <div className="flex items-center justify-between px-5 py-3 bg-bg-overlay/60 border-b border-border-normal">
                    <div className="flex items-center gap-3">
                      <Warehouse className="w-5 h-5 text-primary" />
                      <h3 className="text-base font-black text-text-primary">{group.name}</h3>
                      <span className="text-sm font-bold text-text-muted">
                        {group.counted}/{group.total}
                      </span>
                    </div>
                    <div className="w-32 h-2 bg-border-normal rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${group.total > 0 ? (group.counted / group.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    {group.lines.map((line) => (
                      <PhysicalCountRow
                        key={`${line.item_id}_${line.warehouse_id ?? "null"}`}
                        line={line}
                        localVal={localCounts[`${line.item_id}_${line.warehouse_id ?? "null"}`] ?? line.counted_quantity}
                        saveStatus={savingLines[`${line.item_id}_${line.warehouse_id ?? "null"}`]}
                        readOnly={activeSession?.readOnly}
                        onSave={saveLine}
                        onComplete={handleCompleteLine}
                        onNotesChange={handleNotesChange}
                        highlight={highlightItemId === line.item_id}
                      />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            /* Standard Layout — Pending / Completed Sections */
            <div className="border border-border-normal rounded-b-2xl bg-bg-surface shadow-card overflow-hidden">
              {/* Pending Section */}
              {paginatedPending.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 px-5 py-2 bg-warning-bg/40 border-b border-border-normal">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-warning-text">
                      قيد العد ({pendingLines.length})
                    </h3>
                  </div>
                  <div className="flex flex-col">
                    {paginatedPending.map((line) => (
                      <PhysicalCountRow
                        key={`${line.item_id}_${line.warehouse_id ?? "null"}`}
                        line={line}
                        localVal={localCounts[`${line.item_id}_${line.warehouse_id ?? "null"}`] ?? line.counted_quantity}
                        saveStatus={savingLines[`${line.item_id}_${line.warehouse_id ?? "null"}`]}
                        readOnly={activeSession?.readOnly}
                        onSave={saveLine}
                        onComplete={handleCompleteLine}
                        onNotesChange={handleNotesChange}
                        highlight={highlightItemId === line.item_id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Section */}
              {paginatedCompleted.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 px-5 py-2 bg-success-bg/40 border-b border-t border-border-normal">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-success-text">
                      مكتمل ({completedLines.length})
                    </h3>
                  </div>
                  <div className="flex flex-col opacity-90">
                    {paginatedCompleted.map((line) => (
                      <PhysicalCountRow
                        key={`${line.item_id}_${line.warehouse_id ?? "null"}`}
                        line={line}
                        localVal={localCounts[`${line.item_id}_${line.warehouse_id ?? "null"}`] ?? line.counted_quantity}
                        saveStatus={savingLines[`${line.item_id}_${line.warehouse_id ?? "null"}`]}
                        readOnly={true}
                        onSave={NOOP}
                        onComplete={handleCompleteLine}
                        onNotesChange={NOOP}
                      />
                    ))}
                  </div>
                </div>
              )}

              {paginatedPending.length === 0 && paginatedCompleted.length === 0 && (
                <div className="py-16 text-center text-text-muted font-bold text-sm">لا توجد أصناف في هذه الصفحة</div>
              )}
            </div>
          )}

          {/* Pagination — shared by both layouts */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 py-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-overlay disabled:opacity-30 transition-all active:scale-90"
              >
                ▶
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black border transition-all active:scale-90 ${
                    p === page
                      ? "bg-primary text-white border-primary"
                      : "border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-overlay hover:border-primary"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-overlay disabled:opacity-30 transition-all active:scale-90"
              >
                ◀
              </button>
            </div>
          )}

          {/* Empty State */}
          {filteredLines.length === 0 && (
            <div className="py-32 text-center text-text-muted font-bold uppercase tracking-widest text-sm">
              لا توجد أصناف مطابقة للبحث
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Island Action Bar */}
      <AnimatePresence>
        {view === "session" && activeSession && (
          <motion.div
            key="dynamic-island"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-4xl px-6"
          >
            <div
              data-help="differences-section"
              className="w-full backdrop-blur-xl bg-bg-surface border border-border-normal rounded-[2rem] p-3 shadow-modal pointer-events-auto"
            >
              <div className="flex items-center w-full">
                {/* Invisible mirror — an exact duplicate of the real button
                    group so its rendered width matches precisely. This is
                    what actually centers the stats: a plain 3-column grid
                    does NOT equalize the two side columns when one has
                    wider content (its implicit min-content size wins over
                    the equal fr split), which is why the bar drifted off
                    center once buttons were added on only one side. */}
                <div className="invisible shrink-0 flex items-center gap-2.5" aria-hidden="true">
                  {activeSession?.readOnly ? (
                    <>
                      <div className="px-5 h-12 rounded-full flex items-center gap-2 border border-border-normal">
                        <BarChart3 className="w-5 h-5" /><span className="text-sm font-black">معاينة</span>
                      </div>
                      <div className="px-6 py-3 rounded-3xl flex items-center gap-2.5 border border-success-border">
                        <CheckCircle2 className="w-5 h-5" /><span className="text-sm font-black">الجرد معتمد</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-5 h-12 rounded-full border border-border-normal">
                        <span className="text-sm font-black">حفظ ومتابعة لاحقاً</span>
                      </div>
                      <PermissionGate page="physical_count" action="delete">
                        <div className="px-5 h-12 rounded-full border border-danger-border">
                          <span className="text-sm font-black">إلغاء</span>
                        </div>
                      </PermissionGate>
                      <PermissionGate page="physical_count" action="edit">
                        <div className="px-7 h-12 rounded-full flex items-center gap-2 border border-success-border">
                          <CheckCircle2 className="w-5 h-5" /><span className="text-sm font-black">اعتماد التسوية</span>
                        </div>
                      </PermissionGate>
                    </>
                  )}
                </div>

                {/* Stats — centered in remaining space */}
                <div className="flex-1 flex items-center justify-center gap-4 px-2 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${stats.variance_count > 0 ? "bg-warning-text animate-pulse" : "bg-success-text"}`} />
                    <span className="text-sm font-black tracking-widest uppercase text-text-primary">{stats.variance_count} فروقات</span>
                  </div>
                  <div className="w-px h-5 bg-border-normal/30" />
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-black tracking-widest text-text-secondary">{stats.total_lines - stats.counted_lines} متبقي</span>
                  </div>
                  {stats.completed_lines > 0 && (
                    <>
                      <div className="w-px h-5 bg-border-normal/30" />
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-success-text" />
                        <span className="text-sm font-black tracking-widest text-success-text">{stats.completed_lines} مكتمل</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Real buttons — same side as start (right in RTL) */}
                <div className="shrink-0 flex items-center gap-2.5">
                  {activeSession?.readOnly ? (
                    <>
                      <button
                        onClick={() => setPreviewSession(activeSession)}
                        className="px-5 h-12 rounded-full bg-bg-overlay text-text-primary text-sm font-black uppercase tracking-widest hover:border-primary transition-colors flex items-center gap-2 border border-border-normal"
                      >
                        <BarChart3 className="w-5 h-5" />
                        معاينة
                      </button>
                      <div className="px-6 py-3 rounded-3xl bg-success-bg border border-success-border flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-success-text" />
                        <span className="text-sm font-black uppercase tracking-widest text-success-text">الجرد معتمد</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={exitSession}
                        title="التقدّم محفوظ تلقائياً — يمكنك المتابعة في أي وقت"
                        className="px-5 h-12 rounded-full text-sm font-black uppercase tracking-widest text-text-secondary bg-bg-overlay border border-border-normal hover:bg-border-normal/40 transition-colors"
                      >
                        حفظ ومتابعة لاحقاً
                      </button>
                      <PermissionGate page="physical_count" action="delete">
                        <button onClick={() => setCancelDialog(true)} className="px-5 h-12 rounded-full text-sm font-black uppercase tracking-widest text-danger-text bg-danger-bg border border-danger-border hover:bg-danger/10 transition-colors">
                          إلغاء
                        </button>
                      </PermissionGate>
                      <PermissionGate page="physical_count" action="edit">
                        <button data-help="apply-button" onClick={() => setConfirmDialog(true)} className="px-7 h-12 rounded-full bg-success-bg text-success-text border border-success-border hover:bg-success/10 text-sm font-black uppercase tracking-widest transition-all flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5" />
                          اعتماد التسوية
                        </button>
                      </PermissionGate>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Dialog */}
      {confirmDialog && (() => {
        const lines = activeSession?.lines || [];
        const touchedLines = lines.filter((l) => l.touched);
        const up = touchedLines.filter((l) => l.variance > 0);
        const down = touchedLines.filter((l) => l.variance < 0);
        const upQty = up.reduce((s, l) => s + l.variance, 0);
        const downQty = down.reduce((s, l) => s + Math.abs(l.variance), 0);
        const uncounted = stats.total_lines - stats.counted_lines;
        return (
          <ConsequencePreview
            open
            title="اعتماد الجرد — سيحدث الآتي:"
            consequences={[
              up.length > 0 && { tone: "success", text: `${up.length} صنف هيزيد رصيده بإجمالي +${upQty} قطعة (لقيت على الرف أكتر من الشاشة).` },
              down.length > 0 && { tone: "danger", text: `${down.length} صنف هينقص رصيده بإجمالي −${downQty} قطعة — ده عجز هيتسجل بتاريخ اليوم.` },
              uncounted > 0 && { tone: "warning", text: `${uncounted} صنف ماتعدّش — رصيده هيفضل زي ما هو ومش هيتلمس.` },
              { tone: "info", text: "بعد الاعتماد الجلسة بتتقفل للقراءة فقط، والفروقات بتظهر في حركات المخزون بنوع «جرد»." },
            ].filter(Boolean)}
            confirmLabel={confirming ? "جاري الاعتماد..." : "تأكيد واعتماد الجرد"}
            secondaryLabel="المتابعة لاحقاً"
            onSecondary={() => setConfirmDialog(null)}
            loading={confirming}
            onConfirm={handleConfirm}
            onClose={() => setConfirmDialog(null)}
          />
        );
      })()}

      {/* Cancel Dialog */}
      {cancelDialog && (
        <ConfirmDialog
          open
          title="إلغاء جلسة الجرد"
          message="سيتم حذف مسودة الجرد بالكامل ولن تتأثر أرصدة النظام الحالية."
          confirmLabel={cancelling ? "جاري الإلغاء..." : "نعم، إلغاء الجرد"}
          onConfirm={handleCancel}
          onCancel={() => setCancelDialog(false)}
          variant="danger"
        />
      )}

      {/* Session Preview Modal */}
      <PhysicalCountSessionPreview
        open={!!previewSession}
        session={previewSession}
        onClose={() => setPreviewSession(null)}
        onSendWhatsApp={(s) => { setPreviewSession(null); setWaSendOpen(true); }}
        onPrint={(s) => { setPreviewSession(null); setPrintPreview(true); }}
      />

      {/* Print Preview Modal */}
      {activeSession && (
        <PrintPreviewModal
          open={printPreview}
          onClose={() => setPrintPreview(false)}
          docType="physical_count_report"
          renderContent={(settings) => (
            <PhysicalCountTemplate session={activeSession} settings={settings} />
          )}
          onSendWhatsApp={() => { setPrintPreview(false); setWaSendOpen(true); }}
        />
      )}

      {/* WhatsApp Send Modal — PDF only for جرد */}
      <WhatsAppSendModal
        open={waSendOpen}
        onClose={() => { setWaSendOpen(false); setWaSendSession(null); }}
        invoice={waSendSession || activeSession || {}}
        kind="physical_count"
        title="إرسال تقرير الجرد عبر واتساب"
        pdfEndpoint={(waSendSession || activeSession) ? `/api/stock/physical-count/sessions/${(waSendSession || activeSession).id}/export?format=pdf` : undefined}
        pdfFileName={(waSendSession || activeSession) ? `${(waSendSession || activeSession).name || `جرد-${(waSendSession || activeSession).id}`}.pdf` : undefined}
      />
    </main>
  );
}
