// Integer-safe currency math to avoid floating point issues
// All money values are stored as integers (piasters/cents)

export function toMinor(amount, decimals = 2) {
  return Math.round(Number(amount) * Math.pow(10, decimals));
}

export function toMajor(minorAmount, decimals = 2) {
  return Number((minorAmount / Math.pow(10, decimals)).toFixed(decimals));
}

export function addMoney(a, b) {
  return toMinor(a) + toMinor(b);
}

export function subtractMoney(a, b) {
  return toMinor(a) - toMinor(b);
}

export function multiplyMoney(amount, qty) {
  return toMinor(amount) * qty;
}

export function formatCurrency(amount, symbol = "ر.س", decimals = 2) {
  return `${Number(amount || 0).toFixed(decimals)} ${symbol}`;
}
