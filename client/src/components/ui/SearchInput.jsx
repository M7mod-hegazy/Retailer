import React, { forwardRef } from 'react';
import { Loader2, Search, X } from 'lucide-react';

/**
 * Unified SearchInput — polished, premium look.
 * Emerald ring focus, animated clear button, loading state.
 * Supports ref forwarding to the inner <input>.
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
    sm: { wrap: 'h-8',   input: 'py-1.5 text-[12px]', icon: 'h-3.5 w-3.5', clearBtn: 'h-4 w-4 left-2',   clearIcon: 'h-[9px] w-[9px]', pr: 'pr-8',  pl: 'pl-7'  },
    md: { wrap: 'h-9',   input: 'py-2   text-[13px]', icon: 'h-4 w-4',     clearBtn: 'h-5 w-5 left-2.5', clearIcon: 'h-3 w-3',         pr: 'pr-9',  pl: 'pl-8'  },
    lg: { wrap: 'h-10',  input: 'py-2.5 text-[14px]', icon: 'h-4 w-4',     clearBtn: 'h-5 w-5 left-2.5', clearIcon: 'h-3 w-3',         pr: 'pr-9',  pl: 'pl-8'  },
  }[size] || {
    wrap: 'h-9', input: 'py-2 text-[13px]', icon: 'h-4 w-4', clearBtn: 'h-5 w-5 left-2.5', clearIcon: 'h-3 w-3', pr: 'pr-9', pl: 'pl-8',
  };

  return (
    <div className={`relative flex items-center ${sz.wrap} ${className}`}>
      {/* Search / Loader icon */}
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-slate-400 transition-colors group-focus-within:text-emerald-500">
        {loading
          ? <Loader2 className={`${sz.icon} animate-spin text-emerald-500`} />
          : <Search className={`${sz.icon}`} strokeWidth={2} />
        }
      </div>

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
        className={[
          'peer w-full rounded-[12px]',
          'border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
          sz.pr,
          value ? sz.pl : 'pl-3',
          sz.input,
          'font-medium text-slate-800',
          'placeholder:text-slate-300 placeholder:font-normal',
          'outline-none transition-all duration-150',
          'hover:border-slate-300 hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)]',
          'focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-400/12 focus:shadow-[0_0_0_3px_rgba(52,211,153,0.12)]',
          inputClassName,
        ].join(' ')}
      />

      {/* Clear button — slides in when there's value */}
      {value && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => (onClear ? onClear() : onChange(''))}
          className={[
            'absolute top-1/2 -translate-y-1/2',
            sz.clearBtn,
            'flex items-center justify-center rounded-full',
            'bg-slate-100 text-slate-400',
            'transition-all duration-150',
            'hover:bg-rose-50 hover:text-rose-500 hover:scale-110',
            'active:scale-95',
          ].join(' ')}
        >
          <X className={sz.clearIcon} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
});

export default SearchInput;
