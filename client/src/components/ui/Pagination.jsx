import React from "react";

export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) pages.push(i);

  return (
    <div className="mt-4 flex items-center justify-center gap-1" dir="ltr">
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-text-secondary transition hover:bg-white/10 disabled:opacity-40">‹</button>
      {pages[0] > 1 ? <span className="px-2 text-text-muted">...</span> : null}
      {pages.map((p) => (
        <button key={p} onClick={() => onPageChange(p)} className={`rounded-2xl border px-3 py-1.5 text-sm transition ${p === page ? "border-primary/30 bg-primary text-white shadow-glow" : "border-white/10 bg-white/5 text-text-secondary hover:bg-white/10"}`}>{p}</button>
      ))}
      {pages[pages.length - 1] < totalPages ? <span className="px-2 text-text-muted">...</span> : null}
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-text-secondary transition hover:bg-white/10 disabled:opacity-40">›</button>
    </div>
  );
}
