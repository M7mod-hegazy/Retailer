/**
 * Unified fuzzy search utility for both client-side filtering and backend query generation.
 *
 * Features:
 *  - Wrong-keyboard-layout detection (typed EN on AR keyboard, or AR on EN keyboard)
 *  - Multi-word token splitting (each token searched independently)
 *  - 3/4-char prefix matching (tolerance for incomplete words)
 *  - Drop-last-char typo tolerance
 */

// ─── Keyboard Layout Maps ─────────────────────────────────────────────────────
// Maps English key → Arabic char at the same physical position (QWERTY ↔ Arabic)

const EN_TO_AR = {
  q:'ض', w:'ص', e:'ث', r:'ق', t:'ف', y:'غ', u:'ع', i:'ه', o:'خ', p:'ح',
  a:'ش', s:'س', d:'ي', f:'ب', g:'ل', h:'ا', j:'ت', k:'ن', l:'م',
  z:'ئ', x:'ء', c:'ؤ', v:'ر', b:'لا', n:'ى', m:'ة',
};

// Reverse map: Arabic char → English key
const AR_TO_EN = {};
for (const [en, ar] of Object.entries(EN_TO_AR)) {
  if (!AR_TO_EN[ar]) AR_TO_EN[ar] = en;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the string has more Arabic chars than Latin chars */
function isArabicDominant(str) {
  const ar = (str.match(/[\u0600-\u06FF]/g) || []).length;
  const en = (str.match(/[a-zA-Z]/g) || []).length;
  return ar >= en;
}

/**
 * Convert a string typed with the wrong keyboard layout.
 * AR-dominant input → convert each char to EN equivalent.
 * EN-dominant input → convert each char to AR equivalent.
 */
export function convertKeyboard(str) {
  const s = String(str || '');
  if (!s.trim()) return s;
  if (isArabicDominant(s)) {
    return s.split('').map(c => AR_TO_EN[c] || c).join('');
  }
  return s.split('').map(c => EN_TO_AR[c.toLowerCase()] || c).join('');
}

/** Split query into non-empty tokens */
export function tokenize(q) {
  return String(q || '').trim().split(/\s+/).filter(t => t.length > 0);
}

/**
 * Generate all search variants for a query string:
 *  1. Original (lowercased)
 *  2. Keyboard-converted version
 *  3. Each token individually
 *  4. 3-char and 4-char prefix of each token
 *  5. Drop-last-char of each token (typo tolerance)
 *  6. Same prefix/typo variants for converted version
 */
export function searchVariants(query) {
  const q = String(query || '').trim();
  if (!q) return [];

  const all = new Set();

  function expand(str) {
    const s = str.toLowerCase();
    if (!s) return;
    all.add(s);
    const tokens = tokenize(s);
    tokens.forEach(t => {
      all.add(t);
      if (t.length >= 3) all.add(t.slice(0, 3));
      if (t.length >= 4) all.add(t.slice(0, 4));
      if (t.length >= 4) all.add(t.slice(0, -1));   // drop-last typo
      if (t.length >= 5) all.add(t.slice(0, -2));   // drop-last-2 typo
    });
  }

  expand(q);
  expand(convertKeyboard(q));

  return [...all].filter(v => v.length >= 1);
}

/**
 * Test if a haystack string fuzzy-matches the query.
 * Returns true/false.
 */
export function fuzzyMatch(haystack, query) {
  const h = String(haystack || '').toLowerCase();
  if (!query || !query.trim()) return true;

  const variants = searchVariants(query);

  // Any variant is a substring of haystack
  if (variants.some(v => h.includes(v))) return true;

  // Multi-token AND: all tokens must appear somewhere in haystack
  const tokens = tokenize(query.toLowerCase());
  if (tokens.length > 1 && tokens.every(t => h.includes(t))) return true;

  return false;
}

/**
 * Filter an array of objects using fuzzy matching across multiple keys.
 *
 * @param {Object[]} rows  - array of objects to filter
 * @param {string}   query - search query string
 * @param {string[]} keys  - object keys to search within each row
 * @returns {Object[]} filtered rows
 */
export function fuzzyFilterRows(rows, query, keys) {
  if (!query || !query.trim()) return rows;
  return rows.filter(row => {
    const haystack = keys.map(k => String(row[k] || '')).join(' ');
    return fuzzyMatch(haystack, query);
  });
}

/**
 * Score a single item by relevance to query.
 * Higher score = better match. Thresholds:
 *   1000 = exact match (code, barcode, SKU)
 *   950  = exact token match (word boundary)
 *   900  = code starts with query (e.g. "2." → "2.2")
 *   850  = code contains query at token boundary
 *   800  = code contains query anywhere
 *   750  = name starts with query
 *   700  = name contains query
 *   600  = fuzzy/keyboard variant exact match
 *   550  = fuzzy variant starts-with
 *   400  = fuzzy variant contains
 */
export function scoreItem(item, query, keys) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return 0;

  let maxScore = 0;

  // A key is a "name" field (lower weight on loose contains-matches) unless it
  // looks like an identifier such as code / sku / barcode.
  const isCodeKey = (k) => /code|sku|barcode|ref/i.test(k);

  for (const key of keys) {
    const val = String(item[key] || '').toLowerCase();
    if (!val) continue;

    // Evaluate every tier and keep the highest — the tiers are NOT in score
    // order, so an early `continue` would under-score a value that matches a
    // higher tier later (e.g. a token-exact SKU that also starts-with the query).
    const tokens = val.split(/[\s\-_./:،,]+/);
    if (val === q)                 maxScore = Math.max(maxScore, 1000);
    else if (tokens.some(t => t === q)) maxScore = Math.max(maxScore, 950);
    else if (val.startsWith(q))    maxScore = Math.max(maxScore, 900);
    else if (tokens.some(t => t.startsWith(q))) maxScore = Math.max(maxScore, isCodeKey(key) ? 850 : 760);
    else if (val.includes(q))      maxScore = Math.max(maxScore, isCodeKey(key) ? 800 : 700);
  }

  const variants = searchVariants(q);
  for (const variant of variants) {
    if (variant === q || variant.length < 2) continue;
    for (const key of keys) {
      const val = String(item[key] || '').toLowerCase();
      if (!val) continue;
      if (val === variant) { maxScore = Math.max(maxScore, 600); }
      else if (val.startsWith(variant)) { maxScore = Math.max(maxScore, 550); }
      else if (val.includes(variant)) { maxScore = Math.max(maxScore, 400); }
    }
  }

  return maxScore;
}

/**
 * Filter and sort rows by relevance score descending.
 * Exact code/barcode matches appear first, then progressively looser matches.
 */
export function scoredFilterRows(rows, query, keys) {
  if (!query || !query.trim()) return rows;

  const scored = rows
    .map(row => ({ row, score: scoreItem(row, query, keys) }))
    .filter(entry => entry.score > 0);

  scored.sort((a, b) => b.score - a.score);

  return scored.map(entry => entry.row);
}

/**
 * Return search value adapted for server-side API calls.
 * If input looks like a keyboard mismatch, returns the most likely intended value.
 * Otherwise returns the original.
 *
 * Use this to pre-process before sending `?search=` to the backend.
 */
export function adaptForServer(query) {
  const q = String(query || '').trim();
  if (!q) return q;
  const converted = convertKeyboard(q);
  // If conversion significantly changed the string, return the converted version
  // (user likely typed with wrong keyboard layout)
  const latinInOriginal = (q.match(/[a-z]/gi) || []).length;
  const totalInOriginal = [...q].filter(c => /\S/.test(c)).length;
  const latinRatio = totalInOriginal > 0 ? latinInOriginal / totalInOriginal : 0;

  // Heuristic: if input is >70% latin letters, assume wrong keyboard and convert to AR
  if (latinRatio > 0.7) return converted;
  // If input is >70% arabic chars and we have an EN equivalent, return EN
  const arInOriginal = (q.match(/[\u0600-\u06FF]/g) || []).length;
  const arRatio = totalInOriginal > 0 ? arInOriginal / totalInOriginal : 0;
  if (arRatio > 0.7) return converted;

  return q;
}
