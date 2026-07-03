// Dependency-free Code 128 (subset B) encoder.
//
// No barcode-rendering library exists in this project (checked client/package.json)
// and the old `client/src/components/print/BarcodeLabel.jsx` never actually drew
// bars — it just printed the raw number as text. So this is a small from-scratch
// implementation of the ISO/IEC 15417 Code 128 symbology, restricted to subset B
// (ASCII 32-127), which covers every real document-number format used in this app
// (uppercase/lowercase letters, digits, dashes, slashes).
//
// Reference: the standard Code 128 symbol widths table (values 0-102 = data/start
// symbols, 103/104/105 = START A/B/C, 106 = STOP). Each pattern is 6 digits
// (bar,space,bar,space,bar,space run-lengths in modules, summing to 11), except
// STOP which is 7 digits summing to 13 (it carries the extra termination bar).
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", // 0-102
  "211412", // 103 START A
  "211214", // 104 START B
  "211232", // 105 START C
  "2331112", // 106 STOP (extra termination bar)
];

export const START_A = 103;
export const START_B = 104;
export const START_C = 105;
export const STOP = 106;

/**
 * Encode a string as Code 128 subset B. Every character must be ASCII 32-127
 * (space through DEL's neighbor "\x7f" is out of range — printable ASCII 32-126
 * in practice). Throws for out-of-range characters so callers can fall back
 * gracefully instead of drawing a corrupt/unscannable barcode.
 */
export function encodeCode128B(text) {
  const str = String(text == null ? "" : text);
  const charValues = [];
  for (const ch of str) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 127) {
      throw new Error(`code128: unsupported character for subset B: ${JSON.stringify(ch)}`);
    }
    charValues.push(code - 32);
  }
  let checksum = START_B;
  charValues.forEach((v, i) => { checksum += v * (i + 1); });
  checksum %= 103;
  const values = [START_B, ...charValues, checksum, STOP];
  return { values, checksum, charValues };
}

/**
 * Build the flat sequence of bar/space module-widths for a Code 128B encoding
 * of `text`, including a quiet zone (blank margin) on each side. Returns the
 * black-bar rectangles (in module units) ready to draw, plus the total width
 * in modules (for an SVG viewBox).
 */
export function code128Bars(text, { quietZone = 10 } = {}) {
  const { values } = encodeCode128B(text);
  const widths = values.flatMap((v) => CODE128_PATTERNS[v].split("").map(Number));
  const bars = [];
  let x = quietZone;
  let isBar = true;
  widths.forEach((w) => {
    if (isBar && w > 0) bars.push({ x, width: w });
    x += w;
    isBar = !isBar;
  });
  return { bars, totalModules: x + quietZone };
}
