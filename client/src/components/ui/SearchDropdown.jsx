import React, { useRef, useEffect, useState, useCallback } from "react";
import Highlight from "./Highlight";
import { Package } from "lucide-react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

const PAGE_SIZE = 8;

export default function SearchDropdown({
  items = [],
  onPick,
  activeIndex = -1,
  query = "",
  emptyLabel = "لا توجد نتائج",
  maxHeight = 280,
  pageSize = PAGE_SIZE,
  rawText = "",
  onPickRawText,
}) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items, pageSize]);

  const hasMore = visibleCount < items.length;
  const showRaw = rawText && onPickRawText;

  const handleIntersect = useCallback(() => {
    if (hasMore) {
      setVisibleCount(prev => Math.min(prev + pageSize, items.length));
    }
  }, [hasMore, pageSize, items.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) handleIntersect(); },
      { root: listRef.current, rootMargin: "80px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, handleIntersect]);

  const totalItems = items.length;
  const rawActiveIndex = activeIndex === totalItems;

  if (!items.length && !showRaw) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-[12px] border border-slate-100 bg-white/95 backdrop-blur-md p-4 text-center text-[12px] font-bold text-slate-400 shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
        {emptyLabel}
      </div>
    );
  }

  const visibleItems = items.slice(0, visibleCount);

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-[12px] border border-slate-100 bg-white/95 backdrop-blur-md shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
      <div
        ref={listRef}
        className="overflow-y-auto p-1 custom-scrollbar"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {visibleItems.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-start transition-all ${
              activeIndex === i ? "bg-indigo-50/80" : "hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {item.primary_image_url || item.image_url || item.image ? (
                <img
                  src={resolveImageUrl(item.primary_image_url || item.image_url || item.image)}
                  alt={item.name}
                  className="w-8 h-8 rounded-md object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
                  <Package className="w-4 h-4 text-slate-300"/>
                </div>
              )}
              <div className="flex flex-col gap-0 min-w-0">
                <span className="font-mono text-[11px] font-black text-indigo-700 tracking-wide leading-tight truncate">
                  <Highlight text={item.item_code || item.code || item.barcode || `#${item.id}`} query={query} />
                </span>
                <div className="h-px bg-slate-200 my-0.5" />
                <span className="text-[12px] font-black leading-tight truncate text-slate-800">
                  <Highlight text={item.name} query={query} />
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0 mr-2">
              {item.price_label && <span className="font-mono text-[12px] font-black text-slate-600 whitespace-nowrap">{item.price_label}</span>}
              {item.sub_label && <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{item.sub_label}</span>}
            </div>
          </button>
        ))}
        {hasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-2">
            <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
          </div>
        )}
        {showRaw && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPickRawText(rawText)}
            className={`flex w-full items-center gap-2 rounded-[8px] px-3 py-2.5 text-start transition-all ${
              rawActiveIndex ? "bg-emerald-50/80" : "hover:bg-emerald-50"
            }`}
          >
            <div className="w-8 h-8 rounded-md bg-emerald-100 flex items-center justify-center border border-emerald-200 shrink-0">
              <Package className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex flex-col gap-0">
              <span className="text-[11px] font-black text-emerald-700 leading-tight">
                إدخال: {rawText}
              </span>
              <span className="text-[10px] font-bold text-emerald-400 leading-tight">
                إضافة صنف غير مسجل
              </span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
