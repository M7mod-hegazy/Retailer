import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Save, Printer, Undo2, Redo2, LayoutTemplate, FileDown,
  FlaskConical, Columns2, Ruler, Wrench, Globe, FileText, ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../services/api";
import LayoutRenderer from "../LayoutRenderer";
import { BLOCK_REGISTRY } from "../blocks/registry";
import {
  ensureLayout, seedFamilyLayout, resolveEffectiveLayout, defaultColumns,
  SHOW_KEY, newInsertId,
} from "../layout/layoutModel";
import { printContent, getPrinterForPageSize, buildPrintDocument, isElectronPrint } from "../../../services/printService";
import { resolveCalibration, withCalibration } from "../../../services/printCalibration";
import CalibrationWizard from "../calibration/CalibrationWizard";
import BankStatementTemplate from "../templates/BankStatementTemplate";
import AjalStatementTemplate from "../templates/AjalStatementTemplate";
import AjalScheduleTemplate from "../templates/AjalScheduleTemplate";
import ChequeRegisterTemplate from "../templates/ChequeRegisterTemplate";
import PaymentMethodsReportTemplate from "../templates/PaymentMethodsReportTemplate";
import {
  SIZES, SHEET_W, PAGE_H_MM, BLOCK_DOCS, STUDIO_SCOPES, scopeLabel,
  SAMPLES, sampleById, TEMPLATE_MOCK, pageSizeStrFor, familyOfSize,
} from "./studioData";
import StudioBlockTree from "./StudioBlockTree";
import StudioCanvas from "./StudioCanvas";
import StudioInspector from "./StudioInspector";
import PresetsGallery from "./PresetsGallery";
import { applyPreset } from "../presets/presetEngine";

const DRAFT_STASH_KEY = "retailer_print_studio_drafts";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clone = (v) => JSON.parse(JSON.stringify(v));
const stripLayout = ({ layout, ...rest } = {}) => rest;

function readStash() {
  try {
    const v = JSON.parse(localStorage.getItem(DRAFT_STASH_KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}
function writeStash(map) {
  try {
    if (Object.keys(map).length === 0) localStorage.removeItem(DRAFT_STASH_KEY);
    else localStorage.setItem(DRAFT_STASH_KEY, JSON.stringify(map));
  } catch { /* quota — drafts are a convenience, not data */ }
}

// Template-doc canvas: real template component + mock data (reduced mode).
function TemplateDocPreview({ scope, settings }) {
  const mock = TEMPLATE_MOCK[scope] || {};
  switch (scope) {
    case "bank_statement":
      return <BankStatementTemplate bank={mock.bank} transactions={mock.transactions} from={mock.from} to={mock.to} settings={settings} />;
    case "ajal_statement":
      return <AjalStatementTemplate debt={mock.debt} settings={settings} />;
    case "ajal_schedule":
      return <AjalScheduleTemplate debt={mock.debt} settings={settings} />;
    case "cheque_register":
      return <ChequeRegisterTemplate rows={mock.rows} settings={settings} />;
    case "payment_methods_report":
      return <PaymentMethodsReportTemplate rows={mock.rows} filters={mock.filters} totalIn={mock.totalIn} totalOut={mock.totalOut} settings={settings} />;
    default:
      return null; // daily_treasury / ajal_full_statement / reports_generic → info card in canvas
  }
}
const TEMPLATE_PREVIEW_DOCS = new Set(["bank_statement", "ajal_statement", "ajal_schedule", "cheque_register", "payment_methods_report"]);

export default function PrintStudio({ open = true, onClose, initialScope = "_global", initialSize = "" }) {
  // ── server data ────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [appSettings, setAppSettings] = useState({});
  const [store, setStore] = useState({});   // saved per-scope settings (incl. _global)
  const [drafts, setDrafts] = useState({}); // unsaved edits per scope
  const [restoreBanner, setRestoreBanner] = useState(null); // stashed drafts found

  // ── editor state ───────────────────────────────────────────────────────
  const [scope, setScope] = useState(initialScope);
  const [size, setSize] = useState(initialSize || (initialScope === "pos_receipt" ? "80mm" : "A4"));
  const family = familyOfSize(size);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const [resizing, setResizing] = useState(false);
  const [zoom, setZoom] = useState(family === "roll" ? 1.1 : 0.7);
  const [sampleId, setSampleId] = useState("normal");
  const [compare, setCompare] = useState(false);
  const [showRuler, setShowRuler] = useState(false);
  const [showBand, setShowBand] = useState(true);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [calibOpen, setCalibOpen] = useState(false);
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [past, setPast] = useState([]);   // [{scope, draft}]
  const [future, setFuture] = useState([]);
  const printRef = useRef(null);
  const sheetElRef = useRef(null); // the live canvas sheet — free-move math needs its rect
  const stashTimer = useRef(null);

  const isBlockDoc = scope === "_global" || BLOCK_DOCS.has(scope);
  const invoiceData = sampleById(sampleId);

  // ── load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get("/api/settings").then((r) => r.data?.data || {}).catch(() => ({})),
      api.get("/api/print-settings-per-doc").then((r) => r.data?.data || {}).catch(() => ({})),
    ]).then(([app, perDoc]) => {
      if (cancelled) return;
      const st = { ...perDoc, _global: ensureLayout(perDoc._global || {}) };
      setAppSettings(app);
      setStore(st);
      const stash = readStash();
      const dirtyStash = Object.keys(stash).filter(
        (k) => JSON.stringify(stash[k]) !== JSON.stringify(st[k] || {})
      );
      if (dirtyStash.length) setRestoreBanner({ stash, scopes: dirtyStash });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  // reset transient state when reopened
  useEffect(() => {
    if (!open) return;
    setScope(initialScope);
    setSelected(null); setHovered(null); setEditingKey(null);
    setPast([]); setFuture([]);
    if (initialSize) setSize(initialSize);
  }, [open]);

  // ── draft accessors ────────────────────────────────────────────────────
  const draftOf = (sc) => drafts[sc] !== undefined ? drafts[sc] : (store[sc] || {});
  const cur = draftOf(scope);
  const globalDraft = draftOf("_global");
  const dirtyScopes = useMemo(
    () => Object.keys(drafts).filter((k) => JSON.stringify(drafts[k]) !== JSON.stringify(store[k] || {})),
    [drafts, store]
  );

  // merged flat settings the canvas renders with (same precedence as the
  // real pipeline: app settings → _global flat → per-doc flat)
  const merged = useMemo(() => {
    if (scope === "_global") return { ...appSettings, ...stripLayout(globalDraft) };
    return { ...appSettings, ...stripLayout(globalDraft), ...stripLayout(cur) };
  }, [appSettings, globalDraft, cur, scope]);

  // effective layout per family (what the printer will actually use)
  const effFam = (fam) => {
    if (scope === "_global") return (globalDraft.layout || {})[fam] || seedFamilyLayout(fam);
    return resolveEffectiveLayout(globalDraft, cur, fam);
  };
  const renderLayout = useMemo(
    () => ({ roll: effFam("roll"), page: effFam("page") }),
    [globalDraft, cur, scope] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const fam = renderLayout[family];
  const ownFamily = scope === "_global" ? true : !!(cur.layout && cur.layout[family]);

  // ── history-aware commit ───────────────────────────────────────────────
  const commitDraft = (sc, nextDraft) => {
    setPast((p) => [...p.slice(-79), { scope: sc, draft: draftOf(sc) }]);
    setFuture([]);
    setDrafts((d) => ({ ...d, [sc]: nextDraft }));
  };
  const undo = () => {
    if (!past.length) return;
    const last = past[past.length - 1];
    setFuture((f) => [{ scope: last.scope, draft: draftOf(last.scope) }, ...f]);
    setPast((p) => p.slice(0, -1));
    setDrafts((d) => ({ ...d, [last.scope]: last.draft }));
    if (last.scope !== scope) setScope(last.scope);
  };
  const redo = () => {
    if (!future.length) return;
    const nxt = future[0];
    setPast((p) => [...p, { scope: nxt.scope, draft: draftOf(nxt.scope) }]);
    setFuture((f) => f.slice(1));
    setDrafts((d) => ({ ...d, [nxt.scope]: nxt.draft }));
    if (nxt.scope !== scope) setScope(nxt.scope);
  };

  // stash unsaved drafts (debounced) so an accidental close never loses work
  useEffect(() => {
    if (loading) return;
    if (stashTimer.current) clearTimeout(stashTimer.current);
    stashTimer.current = setTimeout(() => {
      const stash = {};
      dirtyScopes.forEach((k) => { stash[k] = drafts[k]; });
      writeStash(stash);
    }, 400);
    return () => { if (stashTimer.current) clearTimeout(stashTimer.current); };
  }, [drafts, dirtyScopes, loading]);

  // ── layout mutations (fork-on-edit for doc scopes) ─────────────────────
  // A doc without its own family layout inherits _global. The first edit
  // materializes the inherited layout into the doc draft, then applies.
  const withFamBase = () => {
    if (scope === "_global" || (cur.layout && cur.layout[family])) return cur;
    return { ...cur, layout: { ...(cur.layout || {}), [family]: clone(effFam(family)) } };
  };
  const setFamLayout = (mut) => {
    const base = withFamBase();
    const famCur = base.layout[family];
    const nextFam = { ...famCur, ...mut(famCur) };
    commitDraft(scope, { ...base, layout: { ...base.layout, [family]: nextFam } });
  };
  const unlinkFamily = () => {
    if (scope === "_global" || !cur.layout || !cur.layout[family]) return;
    const layout = { ...cur.layout };
    delete layout[family];
    commitDraft(scope, { ...cur, layout });
    setSelected(null);
  };
  const setFlat = (key, val) => commitDraft(scope, { ...cur, [key]: val });

  // ── visibility / order / overrides / inserts (ported from designer) ────
  const isVisible = (type) => {
    const sk = SHOW_KEY[type];
    if (sk) return merged[sk] !== false;
    return fam.order.includes(type);
  };
  const toggleVisible = (type) => {
    const sk = SHOW_KEY[type];
    if (sk) { setFlat(sk, !(merged[sk] !== false)); return; }
    setFamLayout((c) => ({ order: c.order.includes(type) ? c.order.filter((t) => t !== type) : [...c.order, type] }));
  };
  const moveOrder = (from, to) => {
    if (from == null || to == null || from === to) return;
    setFamLayout((c) => { const order = [...c.order]; const [m] = order.splice(from, 1); order.splice(to, 0, m); return { order }; });
  };
  const nudge = (dir) => {
    if (!selected) return;
    setFamLayout((c) => {
      const order = [...c.order]; const i = order.indexOf(selected); const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return {};
      [order[i], order[j]] = [order[j], order[i]]; return { order };
    });
  };
  const ov = (key) => (fam.perBlock || {})[key] || {};
  const setOverride = (key, patch) =>
    setFamLayout((c) => ({ perBlock: { ...(c.perBlock || {}), [key]: { ...((c.perBlock || {})[key] || {}), ...patch } } }));

  const insert = (type) => {
    const id = newInsertId();
    const after = (selected && fam.order.includes(selected)) ? selected : fam.order[fam.order.length - 1];
    const props = type === "custom_text" ? { text: "نص جديد", align: "center" } : {};
    setFamLayout((c) => ({ inserted: [...(c.inserted || []), { id, type, after, props }] }));
    setSelected(id);
  };
  const removeInsert = (id) => {
    setFamLayout((c) => ({ inserted: (c.inserted || []).filter((b) => b.id !== id) }));
    if (selected === id) setSelected(null);
  };
  const setInsert = (id, patch) =>
    setFamLayout((c) => ({
      inserted: (c.inserted || []).map((b) => (b.id === id ? { ...b, ...patch, props: { ...b.props, ...(patch.props || {}) } } : b)),
    }));
  const duplicateSelected = () => {
    const src = (fam.inserted || []).find((b) => b.id === selected);
    if (!src) return;
    const id = newInsertId();
    setFamLayout((c) => ({ inserted: [...(c.inserted || []), { ...clone(src), id }] }));
    setSelected(id);
  };
  const deleteSelected = () => {
    if (!selected) return;
    if ((fam.inserted || []).some((b) => b.id === selected)) { removeInsert(selected); return; }
    if ((fam.overlays || []).some((o) => o.id === selected)) { removeOverlay(selected); return; }
    const sk = SHOW_KEY[selected];
    if (sk) setFlat(sk, false);
    else setFamLayout((c) => ({ order: c.order.filter((t) => t !== selected) }));
    setSelected(null);
  };

  // ── items-table columns (canonical: perBlock.items_table.columns) ──────
  const columns = ((fam.perBlock || {}).items_table || {}).columns
    || (fam.columns && fam.columns.items_table)
    || defaultColumns(family);
  const setColumns = (cols) => setFamLayout((c) => ({
    perBlock: { ...(c.perBlock || {}), items_table: { ...((c.perBlock || {}).items_table || {}), columns: cols } },
  }));

  // ── page overlays (free mm-position decorations) ───────────────────────
  const overlays = family === "page" ? (fam.overlays || []) : [];
  const addOverlay = (type) => {
    const id = newInsertId();
    const props = type === "stamp" ? { text: "مدفوع", color: "#b91c1c", fontSize: 16, angle: -12 }
      : type === "image" ? {}
      : { text: "نص حر", fontSize: 12 };
    setFamLayout((c) => ({ overlays: [...(c.overlays || []), { id, type, xMm: 20, yMm: 20, widthMm: type === "image" ? 30 : undefined, props }] }));
    setSelected(id);
  };
  const setOverlay = (id, patch) =>
    setFamLayout((c) => ({
      overlays: (c.overlays || []).map((o) => (o.id === id ? { ...o, ...patch, props: { ...o.props, ...(patch.props || {}) } } : o)),
    }));
  const removeOverlay = (id) => {
    setFamLayout((c) => ({ overlays: (c.overlays || []).filter((o) => o.id !== id) }));
    if (selected === id) setSelected(null);
  };

  // ── inline canvas text editing ─────────────────────────────────────────
  const EDIT_TOP = { company_name: "company_name", branch: "branch_name", footer_text: "receipt_footer", receipt_header_text: "receipt_header" };
  const editableOf = (key) => {
    if ((fam.inserted || []).some((b) => b.id === key && b.type === "custom_text")) return "insert";
    return EDIT_TOP[key] || null;
  };
  const commitText = (key, text) => {
    setEditingKey(null);
    const t = (text || "").trim();
    if (EDIT_TOP[key]) { if ((merged[EDIT_TOP[key]] || "") !== t) setFlat(EDIT_TOP[key], t); return; }
    const ins = (fam.inserted || []).find((b) => b.id === key);
    if (ins && (ins.props?.text || "") !== t) setInsert(key, { props: { text: t } });
  };

  // ── direct mouse interactions on the canvas ────────────────────────────
  // Dragging a block on the canvas moves it FREELY on every paper size —
  // the first drag converts the flow block to an absolute mm position
  // (perBlock[key].abs) while reserving its original slot (abs.holdMm) so the
  // rest of the document does not reflow. Ctrl+drag on roll reorders the flow
  // instead. The tree always reorders.
  const [dragSnap, setDragSnap] = useState(null); // {centerX: bool} while free-dragging
  const mmGeom = () => {
    const sheet = sheetElRef.current;
    if (!sheet) return null;
    const rect = sheet.getBoundingClientRect();
    const sheetWmm = parseFloat(SHEET_W[size]) || 210;
    return { rect, sheetWmm, mmPerPx: sheetWmm / rect.width };
  };
  const half = (v) => Math.round(v * 2) / 2;

  const writeOv = (base, famBase, key, patch) => setDrafts((d) => ({
    ...d,
    [scope]: {
      ...base,
      layout: {
        ...base.layout,
        [family]: { ...famBase, perBlock: { ...(famBase.perBlock || {}), [key]: { ...((famBase.perBlock || {})[key] || {}), ...patch } } },
      },
    },
  }));

  const startFreeMove = (key, e) => {
    const geom = mmGeom();
    const el = e.currentTarget;
    if (!geom || !el) return;
    const startX = e.clientX, startY = e.clientY;
    const base = withFamBase();
    const famBase = base.layout[family];
    const curOv = (famBase.perBlock || {})[key] || {};
    const elRect = el.getBoundingClientRect();
    const startAbs = curOv.abs && curOv.abs.xMm != null
      ? { ...curOv.abs }
      : {
          xMm: half((elRect.left - geom.rect.left) * geom.mmPerPx),
          yMm: half((elRect.top - geom.rect.top) * geom.mmPerPx),
          widthMm: half(Math.min(elRect.width * geom.mmPerPx, geom.sheetWmm)),
          // reserve the original slot so the document doesn't reflow
          holdMm: half(Math.max(2, elRect.height * geom.mmPerPx)),
        };
    let moved = false;
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
      if (!moved) { setPast((p) => [...p, { scope, draft: cur }]); setFuture([]); moved = true; }
      const dx = (ev.clientX - startX) * geom.mmPerPx;
      const dy = (ev.clientY - startY) * geom.mmPerPx;
      const w = startAbs.widthMm || 20;
      let x = clamp(startAbs.xMm + dx, 0, geom.sheetWmm - Math.min(w, geom.sheetWmm));
      // magnetic center snap (±1.5mm) with a visual guide line
      const centered = Math.abs((x + Math.min(w, geom.sheetWmm) / 2) - geom.sheetWmm / 2) < 1.5;
      if (centered) x = geom.sheetWmm / 2 - Math.min(w, geom.sheetWmm) / 2;
      setDragSnap({ centerX: centered });
      writeOv(base, famBase, key, {
        abs: { ...startAbs, xMm: half(x), yMm: half(Math.max(0, startAbs.yMm + dy)) },
      });
    };
    const up = () => {
      setDragSnap(null);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  const onMoveStart = (key, e) => {
    // free move everywhere; Ctrl+drag on roll = reorder the flow instead
    if (family === "page" || !e.ctrlKey) { startFreeMove(key, e); return; }
    const startX = e.clientX, startY = e.clientY;
    const base = withFamBase();
    const fam0 = base.layout[family];
    if (!fam0.order.includes(key)) return;
    let moved = false, snapped = false, order = [...fam0.order];
    const apply = (ord) => setDrafts((d) => ({ ...d, [scope]: { ...base, layout: { ...base.layout, [family]: { ...fam0, order: ord } } } }));
    const overAt = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const w = el && el.closest("[data-designer-key]");
      const k = w && w.getAttribute("data-designer-key");
      return k && k !== key && order.includes(k) ? k : null;
    };
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
      moved = true;
      const to = overAt(ev);
      if (!to) { setDragOverKey(null); return; }
      const ord = order.filter((t) => t !== key);
      ord.splice(ord.indexOf(to), 0, key);
      if (ord.join() === order.join()) { setDragOverKey(to); return; }
      order = ord;
      if (!snapped) { setPast((p) => [...p, { scope, draft: cur }]); setFuture([]); snapped = true; }
      apply(order); setDragOverKey(to);
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); setDragOverKey(null); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  // Toggle free positioning from the inspector: ON captures the block's
  // current rendered position (and reserves its slot); OFF returns it to
  // the flow.
  const setFreePosition = (key, on) => {
    if (!on) {
      setFamLayout((c) => {
        const pb = { ...(c.perBlock || {}) };
        if (pb[key]) { const { abs, ...rest } = pb[key]; pb[key] = rest; }
        return { perBlock: pb };
      });
      return;
    }
    const geom = mmGeom();
    const el = document.querySelector(`[data-designer-key="${CSS.escape(key)}"]`);
    let abs = { xMm: 10, yMm: 10, holdMm: 6 };
    if (geom && el) {
      const r = el.getBoundingClientRect();
      abs = {
        xMm: half((r.left - geom.rect.left) * geom.mmPerPx),
        yMm: half((r.top - geom.rect.top) * geom.mmPerPx),
        widthMm: half(Math.min(r.width * geom.mmPerPx, geom.sheetWmm)),
        holdMm: half(Math.max(2, r.height * geom.mmPerPx)),
      };
    }
    setOverride(key, { abs });
  };

  const onResizeStart = (key, dir, e) => {
    const startX = e.clientX, startY = e.clientY, z = zoom;
    const base = withFamBase();
    const famBase = base.layout[family];
    const curOv = (famBase.perBlock || {})[key] || {};
    const isDim = key === "logo" || key === "qr";
    const dimKey = key === "logo" ? "logo_max_height" : "qr_size";
    const isAbs = curOv.abs && curOv.abs.xMm != null;
    const geom = isAbs ? mmGeom() : null;
    const baseWidth = Number(curOv.width) || 100;
    const baseAbsW = isAbs ? (Number(curOv.abs.widthMm) || 40) : 0;
    const baseFont = Number(curOv.fontSize) || Number(merged.item_font_size) || 11;
    const baseDim = Number(merged[dimKey]) || (key === "logo" ? 48 : 44);
    const setOvLive = (patch) => writeOv(base, famBase, key, patch);
    const setTopLive = (k, v) => setDrafts((d) => ({ ...d, [scope]: { ...base, [k]: v } }));
    setPast((p) => [...p, { scope, draft: cur }]); setFuture([]); setResizing(true);
    const move = (ev) => {
      const dx = (ev.clientX - startX) / z, dy = (ev.clientY - startY) / z;
      if (isDim) {
        const d = dir.s ? dir.s * dy : dir.w * dx;
        setTopLive(dimKey, clamp(Math.round(baseDim + d), 16, 500));
      } else if (isAbs && dir.w) {
        // free-positioned block: horizontal handles resize the mm width
        const dMm = (ev.clientX - startX) * (geom ? geom.mmPerPx : 0.26);
        const patch = { abs: { ...curOv.abs, widthMm: half(clamp(baseAbsW + dir.w * dMm, 5, geom ? geom.sheetWmm : 210)) } };
        if (dir.s) patch.fontSize = clamp(Math.round(baseFont + dir.s * dy * 0.3), 6, 80);
        setOvLive(patch);
      } else {
        const patch = {};
        if (dir.w) patch.width = clamp(Math.round(baseWidth + dir.w * dx * 0.3), 10, 100);
        if (dir.s) patch.fontSize = clamp(Math.round(baseFont + dir.s * dy * 0.3), 6, 80);
        if (Object.keys(patch).length) setOvLive(patch);
      }
    };
    const up = () => { setResizing(false); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  // ── presets ────────────────────────────────────────────────────────────
  const applyPresetToDraft = (preset) => {
    const base = cur.layout ? cur : { ...cur, layout: {} };
    commitDraft(scope, applyPreset(base, preset));
    setSelected(null);
    toast.success(`طُبّق القالب: ${preset.name}`);
  };

  // ── reset family to default ────────────────────────────────────────────
  const resetFamily = () => {
    setFamLayout(() => clone(seedFamilyLayout(family)));
    setSelected(null);
  };

  // ── calibration / printer info for this size ───────────────────────────
  const pageSizeStr = pageSizeStrFor(size);
  const printerName = getPrinterForPageSize(pageSizeStr);
  const calibration = family === "roll" ? resolveCalibration(printerName, size) : null;
  // canvas renders with calibration applied so the band preview is truthful
  const canvasSettings = useMemo(() => {
    const s = { ...merged, receipt_width: family === "roll" ? size : merged.receipt_width };
    return family === "roll" ? withCalibration(s, printerName, size) : s;
  }, [merged, family, size, printerName]);

  // ── save ───────────────────────────────────────────────────────────────
  const saveAll = async () => {
    if (!dirtyScopes.length) { toast("لا توجد تغييرات غير محفوظة"); return; }
    setSaving(true);
    const failed = [];
    for (const sc of dirtyScopes) {
      try {
        await api.put(`/api/print-settings-per-doc/${sc}`, drafts[sc] || {});
        setStore((s) => ({ ...s, [sc]: drafts[sc] }));
      } catch { failed.push(sc); }
    }
    setSaving(false);
    if (failed.length) toast.error(`تعذّر حفظ: ${failed.map(scopeLabel).join("، ")}`);
    else { toast.success("تم حفظ التصميم"); writeStash({}); }
  };

  // ── test print / PDF export ────────────────────────────────────────────
  const testPrint = () => {
    const html = printRef.current ? printRef.current.innerHTML : "";
    if (!html) { toast.error("لا توجد معاينة للطباعة"); return; }
    printContent({
      contentHtml: html,
      pageSizeStr,
      deviceName: printerName,
      title: "طباعة تجريبية",
      docType: scope === "_global" ? "studio-test" : scope,
      docLabel: `طباعة تجريبية — ${scopeLabel(scope)}`,
      printFont: merged.print_font || "",
    });
  };
  const exportPdf = async () => {
    if (!isElectronPrint()) { toast.error("تصدير PDF متاح داخل تطبيق سطح المكتب فقط"); return; }
    const html = printRef.current ? printRef.current.innerHTML : "";
    if (!html) { toast.error("لا توجد معاينة للتصدير"); return; }
    const fullHtml = buildPrintDocument(html, pageSizeStr, "معاينة PDF", { printFont: merged.print_font || "" });
    const res = await window.electronAPI.invoke("print:debug-pdf", {
      html: fullHtml, pageSizeStr, fileName: `studio-${scope}-${size}`,
    });
    if (res?.success) toast.success(`تم حفظ PDF:\n${res.path}`, { duration: 6000 });
    else toast.error(`فشل تصدير PDF: ${res?.error || "غير معروف"}`);
  };

  // ── scope / size switching ─────────────────────────────────────────────
  const switchScope = (sc) => {
    setScope(sc); setSelected(null); setHovered(null); setEditingKey(null); setScopeMenuOpen(false);
    // pick a sensible size for the doc (its saved default, else keep current)
    const docSaved = (drafts[sc] || store[sc] || {}).paper_size;
    if (docSaved && SHEET_W[docSaved]) switchSize(docSaved);
  };
  const switchSize = (sz) => {
    setSize(sz);
    const f = familyOfSize(sz);
    if (f !== family) { setSelected(null); setHovered(null); setZoom(f === "roll" ? 1.1 : 0.7); }
  };

  // ── keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      const tag = (e.target.tagName || "").toUpperCase();
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); saveAll(); return; }
      if (typing || editingKey) return;
      if (e.key === "Escape") { setSelected(null); return; }
      if (!isBlockDoc) return;
      if (mod && e.key.toLowerCase() === "d" && selected) { e.preventDefault(); duplicateSelected(); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); nudge(-1); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); nudge(1); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) { e.preventDefault(); deleteSelected(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, selected, past, future, drafts, store, scope, family, editingKey, isBlockDoc]);

  if (!open) return null;

  // designer context handed to LayoutRenderer for canvas affordances
  const designer = {
    selectedKey: selected, hoveredKey: hovered, dragOverKey, editingKey, resizing,
    onSelect: setSelected, onHover: setHovered,
    onMoveStart, onResizeStart,
    editableOf, onStartEditText: setEditingKey, onCommitText: commitText,
  };

  // the studio API object child panels consume
  const st = {
    scope, family, size, merged, fam, columns, setColumns, ov, setOverride,
    isVisible, toggleVisible, moveOrder, nudge, insert, removeInsert, setInsert,
    duplicateSelected, deleteSelected, selected, setSelected, hovered, setHovered,
    setFlat, setFamLayout, unlinkFamily, ownFamily, isBlockDoc,
    overlays, addOverlay, setOverlay, removeOverlay,
    invoiceData, canvasSettings, renderLayout, designer,
    zoom, setZoom, showRuler, compare, sampleId, showBand, setShowBand,
    calibration, printerName, openCalibration: () => setCalibOpen(true),
    resetFamily, applyPresetToDraft, sheetElRef, setFreePosition, dragSnap,
    editingKey, startEditText: setEditingKey,
  };

  const isTemplateDoc = !isBlockDoc;
  const hasTemplatePreview = TEMPLATE_PREVIEW_DOCS.has(scope);

  return createPortal((
    <div dir="rtl" className="fixed inset-0 z-[9999] flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* hidden clean render for test print / PDF — exactly what the canvas shows */}
      <div ref={printRef} style={{ position: "fixed", left: "-9999px", top: 0, visibility: "hidden", pointerEvents: "none", width: SHEET_W[size] }}>
        {isBlockDoc
          ? <LayoutRenderer family={family} size={size} invoice={invoiceData} settings={canvasSettings} layout={renderLayout} />
          : hasTemplatePreview ? <TemplateDocPreview scope={scope} settings={{ ...canvasSettings, _previewSize: size }} /> : null}
      </div>

      {/* ── top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-normal)] bg-[var(--bg-surface)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="whitespace-nowrap text-sm font-black">استوديو الطباعة</span>

          {/* scope picker */}
          <div className="relative">
            <button type="button" onClick={() => setScopeMenuOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-black ${scope === "_global" ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border-normal)] text-[var(--text-secondary)]"} hover:bg-[var(--bg-input)]`}>
              {scope === "_global" ? <Globe size={13} /> : <FileText size={13} />}
              {scopeLabel(scope)}
              {dirtyScopes.includes(scope) && <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning-text)]" title="تغييرات غير محفوظة" />}
              <ChevronDown size={12} />
            </button>
            {scopeMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setScopeMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-[var(--border-normal)] bg-[var(--bg-elevated)] p-1.5 shadow-lg">
                  {["عام", "مبيعات", "مشتريات", "مخزون", "تقارير"].map((grp) => (
                    <div key={grp}>
                      <div className="px-2 pb-0.5 pt-2 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">{grp}</div>
                      {STUDIO_SCOPES.filter((s) => s.group === grp).map((s) => (
                        <button key={s.key} type="button" onClick={() => switchScope(s.key)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right text-[11px] font-bold ${scope === s.key ? "bg-[var(--accent-soft)] text-[var(--primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"}`}>
                          <span className="flex-1 truncate">{s.label}</span>
                          {dirtyScopes.includes(s.key) && <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning-text)]" />}
                          {!BLOCK_DOCS.has(s.key) && s.key !== "_global" && <span className="rounded bg-[var(--bg-input)] px-1 text-[8px] font-black text-[var(--text-muted)]">قالب</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* size chips */}
          <div className="flex gap-1">
            {[...SIZES.roll, ...SIZES.page].map((sz) => (
              <button key={sz} type="button" onClick={() => switchSize(sz)}
                className={`rounded-md border px-2 py-1 text-[11px] font-bold ${size === sz ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-normal)] text-[var(--text-muted)] hover:bg-[var(--bg-input)]"}`}>
                {sz}
              </button>
            ))}
          </div>

          {/* sample data switcher */}
          {isBlockDoc && (
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border-normal)] p-0.5" title="بيانات المعاينة">
              <FlaskConical size={12} className="mr-1 text-[var(--text-muted)]" />
              {SAMPLES.map((s) => (
                <button key={s.id} type="button" onClick={() => setSampleId(s.id)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${sampleId === s.id ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg-input)]"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {isBlockDoc && (
            <>
              <button type="button" onClick={() => setCompare((v) => !v)} title="مقارنة المقاسين جنباً إلى جنب"
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold ${compare ? "border-[var(--primary)] bg-[var(--accent-soft)] text-[var(--primary)]" : "border-[var(--border-normal)] text-[var(--text-muted)] hover:bg-[var(--bg-input)]"}`}>
                <Columns2 size={12} /> مقارنة
              </button>
              <button type="button" onClick={() => setShowRuler((v) => !v)} title="مسطرة مليمترية"
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold ${showRuler ? "border-[var(--primary)] bg-[var(--accent-soft)] text-[var(--primary)]" : "border-[var(--border-normal)] text-[var(--text-muted)] hover:bg-[var(--bg-input)]"}`}>
                <Ruler size={12} /> مسطرة
              </button>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" title="تراجع (Ctrl+Z)" disabled={!past.length} onClick={undo}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-normal)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] disabled:opacity-30"><Undo2 size={14} /></button>
          <button type="button" title="إعادة (Ctrl+Y)" disabled={!future.length} onClick={redo}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-normal)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] disabled:opacity-30"><Redo2 size={14} /></button>
          {isBlockDoc && (
            <button type="button" onClick={() => setPresetsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-normal)] px-3 py-1.5 text-[11px] font-black text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
              <LayoutTemplate size={13} /> القوالب الجاهزة
            </button>
          )}
          {family === "roll" && (
            <button type="button" onClick={() => setCalibOpen(true)} title="معايرة الطابعة الحرارية"
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-normal)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
              <Wrench size={13} /> معايرة
            </button>
          )}
          <button type="button" onClick={exportPdf} title="حفظ معاينة PDF بدقة الطباعة"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-normal)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
            <FileDown size={13} /> PDF
          </button>
          <button type="button" onClick={testPrint}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-normal)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
            <Printer size={13} /> طباعة تجريبية
          </button>
          <button type="button" onClick={saveAll} disabled={saving || !dirtyScopes.length}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-1.5 text-[11px] font-black text-white hover:opacity-90 disabled:opacity-40">
            <Save size={13} /> {saving ? "جارٍ الحفظ…" : dirtyScopes.length > 1 ? `حفظ (${dirtyScopes.length})` : "حفظ"}
          </button>
          <button type="button" onClick={onClose} title="إغلاق"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-input)]"><X size={16} /></button>
        </div>
      </div>

      {/* draft-restore banner */}
      {restoreBanner && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-2">
          <span className="text-[11px] font-bold text-[var(--warning-text)]">
            توجد مسودة غير محفوظة من جلسة سابقة ({restoreBanner.scopes.map(scopeLabel).join("، ")}) — هل تريد استعادتها؟
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setDrafts((d) => ({ ...d, ...restoreBanner.stash })); setRestoreBanner(null); toast.success("تمت استعادة المسودة"); }}
              className="rounded-lg bg-[var(--warning-text)] px-3 py-1 text-[11px] font-black text-white hover:opacity-90">استعادة</button>
            <button type="button" onClick={() => { writeStash({}); setRestoreBanner(null); }}
              className="rounded-lg border border-[var(--warning-border)] px-3 py-1 text-[11px] font-bold text-[var(--warning-text)] hover:bg-[var(--warning-light)]">تجاهل</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm font-bold text-[var(--text-muted)]">جارٍ التحميل…</div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {isBlockDoc
            ? <StudioBlockTree st={st} />
            : (
              <div className="flex w-[230px] shrink-0 flex-col gap-3 border-l border-[var(--border-normal)] bg-[var(--bg-surface)] p-3">
                <div className="rounded-xl border border-[var(--info-border)] bg-[var(--info-bg)] p-3 text-[11px] font-bold leading-relaxed text-[var(--info-text)]">
                  هذا المستند يُطبع بقالب جاهز ثابت التصميم. يمكنك التحكم في الخط، حجم الورق، نصوص الرأس والتذييل وخيارات الإظهار من اللوحة الجانبية — أما ترتيب العناصر فمحدد بالقالب.
                </div>
              </div>
            )}
          <StudioCanvas st={st}>
            {isTemplateDoc && (
              hasTemplatePreview
                ? <TemplateDocPreview scope={scope} settings={{ ...canvasSettings, _previewSize: size }} />
                : (
                  <div className="w-[420px] rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] p-6 text-center">
                    <div className="text-sm font-black">لا تتوفر معاينة مباشرة لهذا المستند</div>
                    <div className="mt-2 text-[11px] font-bold leading-relaxed text-[var(--text-muted)]">
                      يُطبع هذا المستند بقالب جاهز من شاشته الخاصة. الإعدادات في اللوحة الجانبية (الخط، الورق، الإظهار) تُطبَّق عليه عند الطباعة.
                    </div>
                  </div>
                )
            )}
          </StudioCanvas>
          <StudioInspector st={st} />
        </div>
      )}

      {presetsOpen && (
        <PresetsGallery
          open={presetsOpen}
          onClose={() => setPresetsOpen(false)}
          family={family}
          size={size}
          merged={merged}
          currentFamilyLayout={fam}
          onApply={applyPresetToDraft}
        />
      )}
      {calibOpen && (
        <CalibrationWizard open={calibOpen} onClose={() => setCalibOpen(false)} printerName={printerName} sizeKey={size} />
      )}
    </div>
  ), document.body);
}
