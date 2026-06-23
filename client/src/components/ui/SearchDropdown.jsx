import React, { useRef, useEffect, useState, useCallback } from "react";
import Highlight from "./Highlight";
import { Package } from "lucide-react";

import { resolveImageUrl } from "../../utils/resolveImageUrl";

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
  dropUp = false,
  // Server-side infinite scroll props
  onLoadMore,
  hasMoreFromServer = false,
  isLoadingMore = false,
}) {
  const sentinelRef = useRef(null);
  const listRef = useRef(null);
  // Refs so handleIntersect never goes stale without reconnecting the observer
  const onLoadMoreRef = useRef(onLoadMore);
  const isLoadingMoreRef = useRef(isLoadingMore);
  useEffect(() => { onLoadMoreRef.current = onLoadMore; }, [onLoadMore]);
  useEffect(() => { isLoadingMoreRef.current = isLoadingMore; }, [isLoadingMore]);

  // Track whether the sentinel is currently visible in the scroll container.
  // Needed to re-trigger loading when a batch is fetched but all items are
  // filtered client-side (e.g. zero-stock filter), leaving the sentinel still
  // in view — the IntersectionObserver won't re-fire in that case.
  const [sentinelVisible, setSentinelVisible] = useState(false);

  // Client-side pagination — only used when onLoadMore is NOT provided
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const queryRef = useRef(query);
  useEffect(() => {
    // Reset client-side pagination only when query changes, not when items append
    if (query !== queryRef.current) {
      queryRef.current = query;
      setVisibleCount(pageSize);
    }
  }, [query, pageSize]);

  const serverMode = Boolean(onLoadMore);
  const hasMoreLocal = !serverMode && visibleCount < items.length;
  const showSentinel = hasMoreLocal || (serverMode && hasMoreFromServer);
  const showRaw = rawText && onPickRawText;
  const visibleItems = serverMode ? items : items.slice(0, visibleCount);
  const totalItems = items.length;
  const rawActiveIndex = activeIndex === totalItems;

  const handleIntersect = useCallback(
    ([entry]) => {
      setSentinelVisible(entry.isIntersecting);
      if (!entry.isIntersecting) return;
      if (hasMoreLocal) {
        setVisibleCount(prev => Math.min(prev + pageSize, items.length));
      } else if (serverMode && hasMoreFromServer && !isLoadingMoreRef.current) {
        onLoadMoreRef.current?.();
      }
    },
    // isLoadingMore and onLoadMore intentionally accessed via refs to keep observer stable
    [hasMoreLocal, serverMode, hasMoreFromServer, pageSize, items.length],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root || !showSentinel) return;
    const observer = new IntersectionObserver(handleIntersect, {
      root,
      rootMargin: "60px",
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [showSentinel, handleIntersect]);

  // Re-trigger load when a batch finishes but the sentinel is still visible.
  // This handles the case where all fetched items were filtered client-side
  // (zero-stock), so the list height didn't grow and the observer won't re-fire.
  useEffect(() => {
    if (!isLoadingMore && sentinelVisible && serverMode && hasMoreFromServer) {
      onLoadMoreRef.current?.();
    }
  }, [isLoadingMore, sentinelVisible, serverMode, hasMoreFromServer]);

  const posClass = dropUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]";

  if (!items.length && !showRaw) {
    return (
      <div className={`absolute left-0 right-0 ${posClass} z-50 rounded-[12px] border border-slate-100 bg-white/95 backdrop-blur-md p-4 text-center shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]`}>
        {isLoadingMore ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            <span className="text-2sm font-bold text-slate-400">جاري التحميل...</span>
          </div>
        ) : (
          <span className="text-2sm font-bold text-slate-400">{emptyLabel}</span>
        )}
      </div>
    );
  }

  return (
    <div className={`absolute left-0 right-0 ${posClass} z-50 overflow-hidden rounded-[12px] border border-slate-100 bg-white/95 backdrop-blur-md shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]`}>
      <div
        ref={listRef}
        className="overflow-y-auto p-1 custom-scrollbar"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {visibleItems.map((item, i) => (
          <button
            key={item.id ?? i}
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
                <span className="text-2sm font-black leading-tight truncate text-slate-800">
                  <Highlight text={item.name} query={query} />
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0 mr-2">
              {item.price_label && <span className="font-mono text-2sm font-black text-slate-600 whitespace-nowrap">{item.price_label}</span>}
              {item.sub_label && <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">{item.sub_label}</span>}
            </div>
          </button>
        ))}
        {showSentinel && (
          <div ref={sentinelRef} className="flex items-center justify-center py-3">
            {isLoadingMore
              ? <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              : <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
            }
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
              <span className="text-[11px] font-bold text-emerald-400 leading-tight">
                إضافة صنف غير مسجل
              </span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
