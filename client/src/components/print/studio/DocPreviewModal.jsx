// DocPreviewModal — fullscreen preview of what ONE document currently prints,
// opened straight from the Document Settings table. Renders the doc's effective
// design (merged flat settings + effective family layout) at its default size,
// using the same real renderers as the Studio/gallery so it's truthful.
import React, { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import LayoutRenderer from "../LayoutRenderer";
import TemplateDocPreview from "./TemplateDocPreview";
import { familyOfSize, BLOCK_DOCS, SHEET_W, sampleById } from "./studioData";
import { seedFamilyLayout, resolveEffectiveLayout } from "../layout/layoutModel";

const stripLayout = ({ layout, ...rest } = {}) => rest;

export default function DocPreviewModal({
  open, scope, size, label,
  appSettings = {}, globalSettings = {}, docSettings = {}, onClose,
}) {
  const family = familyOfSize(size);
  const isBlockDoc = scope === "_global" || BLOCK_DOCS.has(scope);

  const settings = useMemo(() => {
    const m = { ...appSettings, ...stripLayout(globalSettings), ...stripLayout(docSettings) };
    return { ...m, receipt_width: family === "roll" ? size : m.receipt_width, _previewSize: size };
  }, [appSettings, globalSettings, docSettings, family, size]);

  const layout = useMemo(() => ({
    [family]: resolveEffectiveLayout(globalSettings, docSettings, family, scope) || seedFamilyLayout(family, scope),
  }), [globalSettings, docSettings, family, scope]);

  const invoice = useMemo(() => sampleById("normal"), []);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") { e.preventDefault(); onClose && onClose(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

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
