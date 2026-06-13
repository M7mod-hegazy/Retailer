/**
 * Parse an EAN-13 scale barcode.
 *
 * Egyptian scale config:
 *   prefix 2x (e.g. "22"), item code (4-5 digits), value (5 digits), EAN check digit
 *
 * Returns { plu, qty?, price? } when the barcode matches, or null when it doesn't.
 *
 * @param {string} code  - 13-character barcode string
 * @param {object} config - { scale_prefix, scale_item_code_length, scale_value_type, scale_value_decimals }
 */
export function parseScaleBarcode(code, config) {
  if (!code || code.length !== 13) return null;

  const prefix = String(config?.scale_prefix ?? "22");
  const itemCodeLen = Number(config?.scale_item_code_length ?? 5);
  const valueType = config?.scale_value_type ?? "weight";
  const valueDecimals = Number(config?.scale_value_decimals ?? 3);

  if (!code.startsWith(prefix)) return null;
  if (itemCodeLen < 1 || itemCodeLen > 8) return null;

  // Validate EAN-13 check digit
  const digits = code.split("").map(Number);
  if (digits.some(isNaN)) return null;
  const checkSum = digits.slice(0, 12).reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 1 : 3), 0);
  const expectedCheck = (10 - (checkSum % 10)) % 10;
  if (expectedCheck !== digits[12]) return null;

  const plu = code.slice(prefix.length, prefix.length + itemCodeLen);
  const valueStr = code.slice(prefix.length + itemCodeLen, 12); // 5 digits before check

  if (valueStr.length !== 5) return null;
  const rawValue = Number(valueStr);
  if (isNaN(rawValue)) return null;

  const divisor = Math.pow(10, valueDecimals);

  if (valueType === "weight") {
    return { plu, qty: rawValue / divisor };
  } else {
    // price mode: value is total in smallest currency unit
    return { plu, price: rawValue / 100 };
  }
}
