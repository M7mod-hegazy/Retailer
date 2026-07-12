// DocPreviewModal — fullscreen preview of what ONE document currently prints,
// opened straight from the Document Settings table. Renders the doc's effective
// design (merged flat settings + effective family layout) at its default size,
// using the same real renderers as the Studio/gallery so it's truthful.
import React, { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import LayoutRenderer from "../LayoutRenderer";
import TemplateDocPreview from "./TemplateDocPreview";
import { familyOfSize, BLOCK_DOCS, SHEET_W, sampleById, BLOCK_DOC_SCOPES } from "./studioData";

const stripLayout = ({ layout, ...rest } = {}) => rest;

// All block doc scopes including _global, kitchen_ticket, owner_statement
const ALL_BLOCK_DOC_SCOPES = new Set(["_global", ...BLOCK_DOC_SCOPES, "kitchen_ticket", "owner_statement"]);

export default function DocPreviewModal({
  open, scope, size, label,
  appSettings = {}, globalSettings = {}, docSettings = {}, onClose,
}) {
  const family = familyOfSize(size);
  const isReportScope = scope !== "_global" && !BLOCK_DOC_SCOPES.has(scope);
  // Per-family inherit: check inherit_global_roll / inherit_global_page, fallback to legacy inherit_global
  const familyKey = `inherit_global_${family}`;
  const docInherit = docSettings[familyKey] ?? docSettings.inherit_global;
  const inheritGlobal = docInherit !== undefined ? docInherit : !isReportScope;

  const settings = useMemo(() => {
    // Match Studio merge: respect inherit_global
    let m;
    if (scope === "_global" || inheritGlobal) {
      m = { ...appSettings, ...stripLayout(globalSettings) };
    } else {
      m = { ...appSettings, ...stripLayout(docSettings) };
    }
    return { ...m, receipt_width: family === "roll" ? size : m.receipt_width, _previewSize: size };
  }, [appSettings, globalSettings, docSettings, family, size, scope, inheritGlobal]);

  const layout = useMemo(() => {
    // Match Studio's effFam() — raw layout, preserves perBlock variants
    const getLayout = () => {
      if (scope === "_global" || inheritGlobal) {
        return (globalSettings?.layout || {})[family] || seedFamilyLayout(family, scope);
      }
      return (docSettings?.layout || {})[family] || seedFamilyLayout(family, scope);
    };
    return { [family]: getLayout() };
  }, [globalSettings, docSettings, family, scope, inheritGlobal]);

  const invoice = useMemo(() => sampleById("normal"), []);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") { e.preventDefault(); onClose && onClose(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const isBlockDoc = ALL_BLOCK_DOC_SCOPES.has(scope);

  return (
    <div dir="rtl" className="fixed inset-0 z-[10001] flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-4 text-white">
        <div>
          <h3 className="text-base font-black">{label || "معاينة المستند"}</h3>
          <p className="mt-1 text-[10px] text-zinc-400">التصميم الحالي كما سيُطبع — مقاس {size}</p>
        </div>
        <button type="button" onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-zinc-950 p-6 flex justify-center items-start">
        <div className="relative border border-zinc-800" style={{ width: SHEET_W[size], background: "#fff", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
          {isBlockDoc
            ? <LayoutRenderer family={family} size={size} invoice={invoice} settings={settings} layout={layout} scope={scope} />
            : <TemplateDocPreview scope={scope} settings={settings} />}
        </div>
      </div>
    </div>
  );
}
