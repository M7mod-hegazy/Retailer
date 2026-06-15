import React from 'react';
import { searchVariants } from '../../utils/search';

/**
 * Highlight — wraps text that matches any variant of the query with a <mark>.
 *
 * Usage:
 *   <Highlight text="صابون حمام" query="صاب" />
 *   <Highlight text="Mohamed" query="ьщрфьуي" />  ← keyboard-converted
 *
 * Props:
 *   text   — the string to render (will be coerced to string)
 *   query  — the search query (can be in wrong keyboard layout, partial, etc.)
 *   markClass — CSS classes for the <mark> element
 */
export default function Highlight({
  text,
  query,
  markClass = 'rounded-[3px] bg-amber-200/70 text-amber-900 px-0.5 not-italic',
}) {
  const str = String(text ?? '');
  if (!query || !query.trim()) return <>{str}</>;

  // Build a merged regex from all search variants (longest first to prefer better matches)
  const variants = searchVariants(query)
    .sort((a, b) => b.length - a.length)
    .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (!variants.length) return <>{str}</>;

  const pattern = new RegExp(`(${variants.join('|')})`, 'gi');
  // Single capturing group → matched segments land at odd indices of the split
  // result. Relying on index parity avoids the stateful-lastIndex bug that a
  // global-flag `pattern.test()` would introduce when re-tested per part.
  const parts = str.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        part && i % 2 === 1 ? (
          <mark key={i} className={markClass}>
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}
