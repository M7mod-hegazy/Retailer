// ZATCA (Saudi e-invoicing) simplified-invoice QR code builder.
// TLV-encoded (tag, length, value), Base64-wrapped, per the ZATCA "simplified
// tax invoice" QR spec: tag 1 = seller name, 2 = VAT registration number,
// 3 = invoice timestamp (ISO 8601), 4 = invoice total incl. VAT, 5 = VAT amount.
//
// Pure CommonJS module usable from both the Node server and the browser
// client bundle (Vite handles the CJS→ESM interop the same way it does for
// shared/docTypes.js) — no Node-only APIs. UTF-8 encoding goes through
// TextEncoder with a Buffer fallback; Base64 goes through btoa with a Buffer
// fallback, so this runs unmodified in the renderer, in Node, and in tests.

/** Encode a JS string to an array of UTF-8 bytes. */
function utf8Bytes(str) {
  if (typeof TextEncoder !== "undefined") {
    return Array.from(new TextEncoder().encode(str));
  }
  // Node fallback for runtimes without a global TextEncoder.
  return Array.from(Buffer.from(str, "utf8"));
}

/** Base64-encode an array/typed-array of bytes. */
function bytesToBase64(bytes) {
  if (typeof btoa === "function") {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  // Node fallback for runtimes without a global btoa.
  return Buffer.from(bytes).toString("base64");
}

/**
 * Truncate a UTF-8 byte array to at most `maxLen` bytes without splitting a
 * multi-byte character. Continuation bytes have the form 10xxxxxx (0x80-0xBF);
 * if the byte right at the cut point is a continuation byte, the character
 * that started before the cut is incomplete, so we back off past it too.
 */
function truncateUtf8Bytes(bytes, maxLen) {
  if (bytes.length <= maxLen) return bytes;
  let end = maxLen;
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--;
  return bytes.slice(0, end);
}

/** Build one TLV field: [tag byte][length byte][value bytes]. Value is
 *  truncated to 255 UTF-8 bytes (the length byte's max) at a char boundary. */
function tlvField(tag, value) {
  const bytes = truncateUtf8Bytes(utf8Bytes(String(value)), 255);
  return [tag, bytes.length, ...bytes];
}

/** Format a number as a fixed 2-decimal string, e.g. 10 -> "10.00". */
function formatZatcaAmount(n) {
  const num = Number(n) || 0;
  return num.toFixed(2);
}

/**
 * Build the Base64 TLV payload for a ZATCA simplified-invoice QR code.
 * @param {object} opts
 * @param {string} opts.sellerName - required
 * @param {string} opts.vatNumber - required
 * @param {string} [opts.timestamp] - ISO 8601 string; defaults to now
 * @param {number} [opts.total] - invoice total including VAT
 * @param {number} [opts.vat] - VAT amount
 * @returns {string} Base64-encoded TLV payload
 */
function buildZatcaTlv(opts) {
  const { sellerName, vatNumber, timestamp, total, vat } = opts || {};
  if (!sellerName) throw new Error("zatcaQr: sellerName is required");
  if (!vatNumber) throw new Error("zatcaQr: vatNumber is required");

  const ts = timestamp || new Date().toISOString();
  const totalStr = formatZatcaAmount(total);
  const vatStr = formatZatcaAmount(vat);

  const fields = [
    tlvField(1, sellerName),
    tlvField(2, vatNumber),
    tlvField(3, ts),
    tlvField(4, totalStr),
    tlvField(5, vatStr),
  ];
  const allBytes = fields.reduce((acc, f) => acc.concat(f), []);
  return bytesToBase64(allBytes);
}

module.exports = { buildZatcaTlv, formatZatcaAmount };
