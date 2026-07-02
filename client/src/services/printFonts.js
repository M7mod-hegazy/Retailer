/**
 * printFonts.js — bundled Arabic print fonts as embeddable @font-face CSS.
 *
 * The silent-print window loads a bare temp HTML file: it has no access to the
 * app's stylesheets or the network, so any font not embedded IN the document
 * falls back to Tahoma/Arial and bold gets browser-synthesized — which renders
 * dashed/broken on 203dpi thermal heads. Every print document therefore embeds
 * the selected family (all weights) as base64 data-URI @font-face rules.
 *
 * Font files live in client/src/assets/fonts/print/ with fontFaces.json
 * describing family/weights/subset/unicode-range per file (generated from the
 * Google Fonts css2 metadata when the fonts were vendored).
 */

import fontFaces from "../assets/fonts/print/fontFaces.json";

// Vite `?inline` turns each woff2 into a data: URI string at build time.
import cairoArabic from "../assets/fonts/print/cairo-arabic-400-700.woff2?inline";
import cairoLatinExt from "../assets/fonts/print/cairo-latin-ext-400-700.woff2?inline";
import cairoLatin from "../assets/fonts/print/cairo-latin-400-700.woff2?inline";
import notoArabic from "../assets/fonts/print/noto-sans-arabic-arabic-400-700.woff2?inline";
import notoMath from "../assets/fonts/print/noto-sans-arabic-math-400-700.woff2?inline";
import notoSymbols from "../assets/fonts/print/noto-sans-arabic-symbols-400-700.woff2?inline";
import notoLatinExt from "../assets/fonts/print/noto-sans-arabic-latin-ext-400-700.woff2?inline";
import notoLatin from "../assets/fonts/print/noto-sans-arabic-latin-400-700.woff2?inline";
import tajawalArabic400 from "../assets/fonts/print/tajawal-arabic-400.woff2?inline";
import tajawalLatin400 from "../assets/fonts/print/tajawal-latin-400.woff2?inline";
import tajawalArabic700 from "../assets/fonts/print/tajawal-arabic-700.woff2?inline";
import tajawalLatin700 from "../assets/fonts/print/tajawal-latin-700.woff2?inline";

const FILE_DATA = {
  "cairo-arabic-400-700.woff2": cairoArabic,
  "cairo-latin-ext-400-700.woff2": cairoLatinExt,
  "cairo-latin-400-700.woff2": cairoLatin,
  "noto-sans-arabic-arabic-400-700.woff2": notoArabic,
  "noto-sans-arabic-math-400-700.woff2": notoMath,
  "noto-sans-arabic-symbols-400-700.woff2": notoSymbols,
  "noto-sans-arabic-latin-ext-400-700.woff2": notoLatinExt,
  "noto-sans-arabic-latin-400-700.woff2": notoLatin,
  "tajawal-arabic-400.woff2": tajawalArabic400,
  "tajawal-latin-400.woff2": tajawalLatin400,
  "tajawal-arabic-700.woff2": tajawalArabic700,
  "tajawal-latin-700.woff2": tajawalLatin700,
};

/** Families available for `print_font` (must match fontFaces.json families). */
export const PRINT_FONT_FAMILIES = ["Tajawal", "Cairo", "Noto Sans Arabic"];

const cssCache = new Map();

/**
 * @font-face rules for one family, all weights/subsets, sources embedded as
 * base64 data URIs. Returns "" for unknown families (system fonts like Tahoma
 * need no embedding). Cached — the base64 strings are built once per session.
 */
export function fontFaceCss(family) {
  if (!family || !PRINT_FONT_FAMILIES.includes(family)) return "";
  if (cssCache.has(family)) return cssCache.get(family);
  const rules = fontFaces
    .filter((f) => f.family === family && FILE_DATA[f.file])
    .map((f) => {
      const weight = f.weights.length > 1
        ? `${f.weights[0]} ${f.weights[f.weights.length - 1]}` // variable range
        : String(f.weights[0]);
      const range = f.unicodeRange ? `unicode-range:${f.unicodeRange};` : "";
      return `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${weight};font-display:block;src:url(${FILE_DATA[f.file]}) format('woff2');${range}}`;
    });
  const css = rules.join("\n");
  cssCache.set(family, css);
  return css;
}

/**
 * Resolve the print font stack + its embedded @font-face CSS for a settings
 * object. Unknown/system fonts embed nothing and rely on the OS stack.
 */
export function resolvePrintFont(printFont) {
  const family = String(printFont || "").trim();
  const embedded = fontFaceCss(family);
  const stack = embedded
    ? `'${family}', 'Tahoma', 'Segoe UI', Arial, sans-serif`
    : `${family ? `'${family}', ` : ""}'Tahoma', 'Segoe UI', Arial, sans-serif`;
  return { family, stack, fontFaceCss: embedded };
}
