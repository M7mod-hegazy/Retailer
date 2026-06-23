import { forwardRef, useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import SearchInput from "./SearchInput";
import SearchDropdown from "./SearchDropdown";

/**
 * Unified product-select field used by every entry row (POS, purchases, sales,
 * returns, transfers, quotations). Bundles the themed search input, the clear
 * button, the results dropdown, and the selected-item chip — so the search
 * looks and behaves identically everywhere and respects the active theme.
 *
 * The dropdown open-state and the active (keyboard-highlighted) index are owned
 * internally, so host pages only provide the query, the results, and an onPick
 * handler. Arrow keys move the highlight; Enter picks; Escape closes.
 *
 * @param {string} query
 * @param {(val:string)=>void} onQueryChange
 * @param {Array} results  rows already shaped for SearchDropdown
 * @param {(item:any)=>void} onPick  select the item (host also moves focus here)
 * @param {()=>void} [onEnterNoResults]  Enter pressed while results are empty
 * @param {any} [selectedItem]  drives the selected chip
 * @param {(item:any)=>string} [chipCode]  code shown in the chip
 * @param {string} [placeholder]
 * @param {string} [emptyLabel]
 * @param {()=>void} [onLoadMore]  @param {boolean} [hasMore] @param {boolean} [isLoadingMore]
 * @param {boolean} [loading]
 * @param {React.ReactNode} [trailing]  node beside the input (e.g. advanced search)
 * @param {boolean} [showChip=true]
 */
const ProductSearchField = forwardRef(function ProductSearchField({
  query,
  onQueryChange,
  results = [],
  onPick,
  onEnterNoResults,
  selectedItem,
  chipCode,
  placeholder = "ابحث بالاسم، الباركود، أو الكود...",
  emptyLabel,
  onLoadMore,
  hasMore,
  isLoadingMore,
  loading,
  trailing = null,
  showChip = true,
  onClear,
  rawText,
  onPickRawText,
  size = "md",
  hideZeroStock = true,
  onShowAll,
  onNavigateNext,
}, ref) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [forceOpen, setForceOpen] = useState(false);
  const wrapperRef = useRef(null);

  const hasActiveQuery = Boolean(query && query.trim());
  // Browse mode (forceOpen): always filter zero-stock.
  // Search mode (typed query): bypass filter so partial matches still show.
  const displayResults = hideZeroStock && (!hasActiveQuery || forceOpen)
    ? results.filter(item => Number(item.stock_quantity || item.stock || 0) > 0)
    : results;

  const closeDropdown = () => { setOpen(false); setActiveIndex(-1); setForceOpen(false); };

  const pick = (item) => { closeDropdown(); onPick?.(item); };
  const pickRaw = (txt) => { closeDropdown(); onPickRawText?.(txt); };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  return (
    <>
      <div ref={wrapperRef} className="flex items-center gap-1">
        <div className="relative flex-1 min-w-0">
          <SearchInput
            ref={ref}
            value={query}
            size={size}
            loading={loading}
            placeholder={placeholder}
            onChange={(val) => { onQueryChange(val); setOpen(true); setActiveIndex(-1); }}
            onFocus={(e) => { setOpen(true); e.target.select?.(); }}
            onClear={onClear}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, displayResults.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter") {
                e.preventDefault();
                if (displayResults.length > 0) {
                  pick(displayResults[activeIndex >= 0 ? activeIndex : 0]);
                }
                else if (onPickRawText && (query || "").trim()) pickRaw((query || "").trim());
                else onEnterNoResults?.();
              } else if (e.key === "Escape") { closeDropdown(); }
              else if (e.key === "ArrowLeft" && !open && onNavigateNext) {
                // RTL: left = forward — navigate to next field when dropdown is closed
                e.preventDefault();
                onNavigateNext();
              }
            }}
            suffix={(
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (open) {
                    closeDropdown();
                  } else {
                    setOpen(true);
                    setActiveIndex(-1);
                    setForceOpen(true);
                    onShowAll?.();
                  }
                }}
                className={`search-input-suffix shrink-0 flex items-center justify-center rounded-full w-5 h-5 transition-colors ${
                  open
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'text-indigo-500 hover:bg-indigo-100 active:scale-95'
                }`}
                title="عرض القائمة"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} strokeWidth={2.5} />
              </button>
            )}
          />
          {open && (displayResults.length > 0 || isLoadingMore || loading || onPickRawText || forceOpen) && (
            <SearchDropdown
              items={displayResults}
              onPick={pick}
              activeIndex={activeIndex}
              query={query}
              emptyLabel={emptyLabel}
              rawText={rawText}
              onPickRawText={onPickRawText ? pickRaw : undefined}
              onLoadMore={onLoadMore}
              hasMoreFromServer={hasMore}
              isLoadingMore={isLoadingMore || (loading && displayResults.length === 0)}
            />
          )}
        </div>
        {trailing}
      </div>

      {showChip && selectedItem && (
        <div className="entry-item-chip mt-0.5">
          <span className="chip-code font-mono text-[11px] font-black shrink-0">
            {chipCode ? chipCode(selectedItem) : (selectedItem.item_code || selectedItem.code || selectedItem.barcode || `#${selectedItem.id}`)}
          </span>
          <div className="chip-sep h-3 w-px shrink-0" />
          <span className="chip-name text-[11px] font-bold truncate">{selectedItem.name}</span>
        </div>
      )}
    </>
  );
});

export default ProductSearchField;
