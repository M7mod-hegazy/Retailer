import React, { useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, ImageIcon, CheckCircle, Circle } from "lucide-react";

export default function ImagePreviewModal({ product, open, onClose, onSelectImages, selectedImages: preselected }) {
  const allImages = [];
  if (product?.image) allImages.push(product.image);
  if (product?.images?.length) {
    for (const img of product.images) {
      if (img !== product.image) allImages.push(typeof img === "string" ? img : img.url || img);
    }
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState(() => {
    if (preselected) return new Set(preselected);
    return new Set(allImages);
  });

  const toggleImage = useCallback((url) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(allImages)), [allImages]);
  const selectNone = useCallback(() => setSelected(new Set()), []);

  const handleConfirm = useCallback(() => {
    onSelectImages?.(product?.sku, [...selected]);
    onClose?.();
  }, [selected, product, onSelectImages, onClose]);

  if (!open || !product) return null;

  const currentUrl = allImages[currentIndex];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-modal border border-gray-200 w-full max-w-4xl max-h-[90vh] mx-4 flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-text-primary" />
            <h2 className="text-base font-black text-text-primary">{product.nameAr || product.name}</h2>
            <span className="text-xs text-text-muted font-bold px-2 py-0.5 bg-gray-50 rounded-full">
              {product.sku}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted hover:text-text-primary transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 flex items-center justify-center bg-black/40 p-4 relative min-h-[400px]">
            {allImages.length > 0 ? (
              <>
                <img
                  src={currentUrl}
                  alt={product.sku}
                  className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-elevated"
                  key={currentUrl}
                />
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentIndex((i) => (i > 0 ? i - 1 : allImages.length - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      onClick={() => setCurrentIndex((i) => (i < allImages.length - 1 ? i + 1 : 0))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </>
                )}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {allImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      className={`w-2 h-2 rounded-full transition ${
                        i === currentIndex ? "bg-white scale-125" : "bg-white/40 hover:bg-white/70"
                      }`}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center text-text-muted">
                <ImageIcon className="h-16 w-16 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold">No images</p>
              </div>
            )}
          </div>

          <div className="w-64 border-l border-gray-200 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-bold text-text-secondary">{selected.size}/{allImages.length}</span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs font-bold text-text-link hover:underline">All</button>
                <button onClick={selectNone} className="text-xs font-bold text-text-muted hover:underline">None</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {allImages.map((url, i) => (
                <button
                  key={i}
                  onClick={() => toggleImage(url)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg border transition ${
                    selected.has(url)
                      ? "border-primary bg-primary-50"
                      : "border-gray-200 hover:border-gray-300 bg-gray-50"
                  }`}
                >
                  <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-gray-50">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs text-text-secondary flex-1 text-left truncate">
                    Image {i + 1}
                  </span>
                  {selected.has(url) ? (
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-text-muted flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-gray-200">
              <button
                onClick={handleConfirm}
                disabled={selected.size === 0}
                className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 transition"
              >
                Confirm ({selected.size})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
