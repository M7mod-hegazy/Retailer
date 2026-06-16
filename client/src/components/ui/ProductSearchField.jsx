import { forwardRef, useState } from "react";
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
}, ref) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const pick = (item) => { setOpen(false); setActiveIndex(-1); onPick?.(item); };
  const pickRaw = (txt) => { setOpen(false); setActiveIndex(-1); onPickRawText?.(txt); };

  return (
    <>
      <div className="flex items-center gap-1">
        <div className="relative flex-1 min-w-0">
          <SearchInput
            ref={ref}
            value={query}
            size={size}
            loading={loading}
            placeholder={placeholder}
            onChange={(val) => { onQueryChange(val); setOpen(true); setActiveIndex(-1); }}
            onFocus={(e) => { setOpen(true); e.target.select?.(); }}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            onClear={onClear}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter") {
                e.preventDefault();
                if (results.length > 0) pick(results[activeIndex >= 0 ? activeIndex : 0]);
                else if (onPickRawText && (query || "").trim()) pickRaw((query || "").trim());
                else onEnterNoResults?.();
              } else if (e.key === "Escape") { setOpen(false); setActiveIndex(-1); }
            }}
          />
          {open && (results.length > 0 || onPickRawText) && (query || "").length > 0 && (
            <SearchDropdown
              items={results}
              onPick={pick}
              activeIndex={activeIndex}
              query={query}
              emptyLabel={emptyLabel}
              rawText={rawText}
              onPickRawText={onPickRawText ? pickRaw : undefined}
              onLoadMore={onLoadMore}
              hasMoreFromServer={hasMore}
              isLoadingMore={isLoadingMore}
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
