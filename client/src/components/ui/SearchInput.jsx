import React, { forwardRef } from 'react';
import { Loader2, Search, X } from 'lucide-react';

/**
 * Unified, theme-driven SearchInput.
 * Flex layout: [icon] [input] [clear] — robust in RTL/LTR, no absolute drift.
 * Forwards ref to the inner <input>.
 */
const SearchInput = forwardRef(function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'بحث...',
  size = 'md',
  loading = false,
  className = '',
  inputClassName = '',
  autoFocus = false,
  id,
  onFocus,
  onBlur,
  onKeyDown,
}, ref) {

  const sz = {
    sm: { wrap: 'h-8 px-2.5 gap-1.5', icon: 'h-3.5 w-3.5', text: 'text-2sm', clear: 'h-4 w-4',   clearIcon: 'h-[10px] w-[10px]' },
    md: { wrap: 'h-9 px-3 gap-2',     icon: 'h-4 w-4',     text: 'text-sm',  clear: 'h-5 w-5',   clearIcon: 'h-3 w-3' },
    lg: { wrap: 'h-10 px-3.5 gap-2',  icon: 'h-4 w-4',     text: 'text-sm',  clear: 'h-5 w-5',   clearIcon: 'h-3 w-3' },
  }[size] || { wrap: 'h-9 px-3 gap-2', icon: 'h-4 w-4', text: 'text-sm', clear: 'h-5 w-5', clearIcon: 'h-3 w-3' };

  return (
    <div className={`search-input flex items-center ${sz.wrap} ${className}`}>
      {/* leading icon */}
      <span className="search-input-icon shrink-0 flex items-center">
        {loading
          ? <Loader2 className={`${sz.icon} animate-spin`} style={{ color: 'var(--primary)' }} />
          : <Search className={sz.icon} strokeWidth={2} />
        }
      </span>

      <input
        ref={ref}
        id={id}
        type="text"
        dir="auto"
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={`peer flex-1 min-w-0 bg-transparent border-0 outline-none font-medium ${sz.text} ${inputClassName}`}
      />

      {/* trailing clear button */}
      {value && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => (onClear ? onClear() : onChange(''))}
          className={`search-input-clear shrink-0 flex items-center justify-center rounded-full ${sz.clear} hover:scale-110 active:scale-95`}
        >
          <X className={sz.clearIcon} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
});

export default SearchInput;
