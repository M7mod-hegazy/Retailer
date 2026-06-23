/**
 * Sort rows for "show all / browse" mode anchored to a selected item.
 * Same category or same code-prefix → sorted by sequence-number proximity to anchor.
 * Everything else → alphabetical by name.
 */
export function sortByProximity(rows, anchor) {
  if (!anchor) {
    return [...rows].sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
  }
  const anchorCat    = anchor.category_name || "";
  const anchorCode   = anchor.code || anchor.item_code || "";
  const anchorParts  = anchorCode.split(".");
  const anchorPrefix = anchorParts[0];
  const anchorSeq    = parseInt(anchorParts[1] ?? "0", 10) || 0;

  return [...rows].sort((a, b) => {
    const aCode  = a.code || a.item_code || "";
    const bCode  = b.code || b.item_code || "";
    const aParts = aCode.split(".");
    const bParts = bCode.split(".");
    const aInner = ((a.category_name || "") === anchorCat && anchorCat) ||
                   (aParts[0] === anchorPrefix && anchorPrefix);
    const bInner = ((b.category_name || "") === anchorCat && anchorCat) ||
                   (bParts[0] === anchorPrefix && anchorPrefix);

    if (aInner && !bInner) return -1;
    if (!aInner && bInner) return  1;

    if (aInner && bInner) {
      const da = aParts[0] === anchorPrefix ? Math.abs((parseInt(aParts[1] ?? "0", 10) || 0) - anchorSeq) : Infinity;
      const db = bParts[0] === anchorPrefix ? Math.abs((parseInt(bParts[1] ?? "0", 10) || 0) - anchorSeq) : Infinity;
      if (da !== db) return da - db;
      return (a.name || "").localeCompare(b.name || "", "ar");
    }

    return (a.name || "").localeCompare(b.name || "", "ar");
  });
}
