import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import { useDetach } from "../../../hooks/useDetach";

// Zoomable image preview used when a cashier opens a product's images.
export default function GalleryModal({ open, onClose, images, initialIdx = 0, initialZoom = 1 }) {
  const [idx, setIdx] = useState(initialIdx);
  const [zoom, setZoom] = useState(initialZoom);
  const { handleDetach } = useDetach("gallery", {
    onClose, getState: () => ({ images, initialIdx: idx, initialZoom: zoom }), actions: {},
  });
  if (!open || !images.length) return null;
  const current = images[idx];
  return (
    <Modal open={open} onClose={onClose} onDetach={handleDetach} title="معاينة الصورة" size="lg">
      <div className="flex flex-col items-center gap-3 p-3 bg-slate-900 rounded-lg" style={{ minHeight: 320 }}>
        <div
          className="flex items-center justify-center w-full overflow-hidden rounded-md"
          style={{ minHeight: 260, maxHeight: "60vh" }}
        >
          <img
            src={current}
            alt="product"
            style={{
              transform: `scale(${zoom})`,
              transition: "transform 0.2s ease",
              maxWidth: "100%",
              maxHeight: "60vh",
              objectFit: "contain",
            }}
            className="rounded-md"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button
            type="button"
            onClick={() => { setIdx(i => Math.max(0, i - 1)); setZoom(1); }}
            disabled={idx === 0}
            className="p-2 rounded-full bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(z => parseFloat(Math.max(0.5, z - 0.25).toFixed(2)))}
            className="px-3 py-1.5 rounded-sm bg-slate-700 text-white text-2sm font-bold hover:bg-slate-600 transition-colors"
          >
            -
          </button>
          <span className="text-white text-[11px] font-mono w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom(z => parseFloat(Math.min(4, z + 0.25).toFixed(2)))}
            className="px-3 py-1.5 rounded-sm bg-slate-700 text-white text-2sm font-bold hover:bg-slate-600 transition-colors"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="px-3 py-1.5 rounded-sm bg-slate-600 text-text-muted text-[11px] font-bold hover:bg-bg-overlay0 transition-colors"
          >
            100%
          </button>
          <button
            type="button"
            onClick={() => { setIdx(i => Math.min(images.length - 1, i + 1)); setZoom(1); }}
            disabled={idx === images.length - 1}
            className="p-2 rounded-full bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 flex-wrap justify-center">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setIdx(i); setZoom(1); }}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i === idx ? "bg-bg-surface" : "bg-slate-600 hover:bg-text-muted"
                }`}
              />
            ))}
          </div>
        )}
        {images.length > 1 && (
          <span className="text-text-muted text-[11px] font-mono">{idx + 1} / {images.length}</span>
        )}
      </div>
    </Modal>
  );
}
