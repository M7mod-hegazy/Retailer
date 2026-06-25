import { forwardRef, useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import SearchInput from "./SearchInput";
import SearchDropdown from "./SearchDropdown";

const CategorySearchField = forwardRef(function CategorySearchField({
  categories = [],
  value,         // { id, name } | null
  onChange,      // (cat | null) => void — called on pick and on clear
  onPickDone,    // (categoryId: number) => void — called after pick with the picked id (for focus + fetch side-effects)
  query,
  onQueryChange,
}, ref) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const closeDropdown = () => setOpen(false);

  const filteredCategories = categories
    .filter(cat => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      const prefix = String(cat.sku_prefix ?? cat.id ?? "");
      return prefix.includes(q) || (cat.name || "").toLowerCase().includes(q);
    })
    .map(cat => ({
      id: cat.id,
      code: String(cat.sku_prefix ?? cat.id ?? ""),
      name: cat.name,
      _sku_prefix: cat.sku_prefix,
    }));

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) closeDropdown();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  const displayPrefix = value ? (value.sku_prefix ?? value.id ?? "") : "";
  const displayValue = open ? query : (value ? `${displayPrefix} - ${value.name}` : "");

  return (
    <div ref={wrapperRef} className="relative">
      <SearchInput
        ref={ref}
        value={displayValue}
        placeholder="كل الفئات"
        size="sm"
        onChange={(val) => { onQueryChange(val); setOpen(true); }}
        onFocus={() => { onQueryChange(""); setOpen(true); }}
        onClear={() => {
          if (!open) {
            onChange(null);
            onQueryChange("");
          } else {
            onQueryChange("");
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); closeDropdown(); }
          // No ArrowDown/Up/Enter — category is excluded from keyboard nav
        }}
        suffix={(
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
              if (open) { closeDropdown(); } else { onQueryChange(""); setOpen(true); }
            }}
            className={`search-input-suffix shrink-0 flex items-center justify-center rounded-full w-5 h-5 transition-colors ${
              open ? "bg-indigo-100 text-indigo-600" : "text-indigo-500 hover:bg-indigo-100 active:scale-95"
            }`}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
              strokeWidth={2.5}
            />
          </button>
        )}
      />
      {open && (
        <SearchDropdown
          items={filteredCategories}
          onPick={(cat) => {
            onChange({ id: cat.id, name: cat.name, sku_prefix: cat._sku_prefix });
            onQueryChange("");
            closeDropdown();
            onPickDone?.(cat.id);
          }}
          activeIndex={-1}
          query={query}
          emptyLabel="لا توجد فئات مطابقة"
        />
      )}
    </div>
  );
});

export default CategorySearchField;
