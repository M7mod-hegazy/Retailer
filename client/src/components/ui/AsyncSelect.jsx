import React, { useEffect, useRef, useState } from "react";
import api from "../../services/api";

export default function AsyncSelect({ label, endpoint, valueKey = "id", labelKey = "name", value, onChange, placeholder = "ابحث...", required }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`${endpoint}?search=${encodeURIComponent(query)}`);
        setOptions(res.data?.data || []);
      } catch {
        setOptions([]);
      }
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, endpoint]);

  const selectedLabel = value ? (options.find((o) => o[valueKey] === value)?.[labelKey] || `#${value}`) : "";

  return (
    <div className="relative space-y-1" ref={ref}>
      {label && <label className="block text-sm font-medium text-text-primary">{label}</label>}
      <input
        type="text"
        value={open ? query : selectedLabel}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        required={required && !value}
        className="input w-full text-sm"
      />
      {open ? (
        <ul className="glass-elevated absolute top-full z-40 mt-2 max-h-56 w-full overflow-auto rounded-[20px] border border-border-normal/8 p-2">
          {loading ? <li className="px-3 py-2 text-xs text-text-secondary">جاري البحث...</li> : null}
          {!loading && options.length === 0 ? <li className="px-3 py-2 text-xs text-text-secondary">لا توجد نتائج مطابقة</li> : null}
          {options.map((opt) => (
            <li
              key={opt[valueKey]}
              onClick={() => {
                onChange?.(opt[valueKey], opt);
                setQuery("");
                setOpen(false);
              }}
              className="cursor-pointer rounded-2xl px-3 py-2 text-sm text-text-primary transition hover:bg-bg-surface/10"
            >
              {opt[labelKey]}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
