// Arabic-aware text utilities for the offline help assistant.
//
// Real-world Arabic users type without diacritics and with inconsistent
// hamza/alef/ya/ta-marbuta forms. To match a typed question against the
// (Arabic) help corpus we normalize both sides the same way before comparing.

// Tashkeel (harakat) + superscript alef + tatweel.
const TASHKEEL_RE = /[ً-ْٰـ]/g;

// Punctuation (Arabic + Latin) we treat as token separators.
const PUNCT_RE = /[!-/:-@[-`{-~،؛؟…«»“” ]/g;

/**
 * Normalize an Arabic (or mixed) string for search comparison.
 * - strips tashkeel and tatweel
 * - unifies alef variants (أ إ آ ٱ → ا), ta-marbuta (ة → ه),
 *   alef-maqsura (ى → ي), and hamza carriers (ؤ → و, ئ → ي, ء removed)
 * - lowercases Latin, collapses whitespace
 */
export function normalizeArabic(input) {
  if (!input) return "";
  return String(input)
    .replace(TASHKEEL_RE, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(PUNCT_RE, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Very common Arabic stop words — dropped so they don't dominate scoring.
const STOP_WORDS = new Set([
  "في", "من", "على", "الى", "عن", "مع", "او", "و", "ثم", "اي", "ازاي",
  "ايه", "هو", "هي", "ده", "دي", "اللي", "ان", "ان", "هل", "ما", "لو",
  "كل", "عشان", "علشان", "بتاع", "يا", "the", "a", "of", "to", "is",
]);

/**
 * Tokenize a normalized string into meaningful terms (stop words removed,
 * 1-char tokens dropped). Returns lowercase normalized tokens.
 */
export function tokenize(input) {
  const normalized = normalizeArabic(input);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}
