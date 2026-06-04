function getNumeralLocale() {
  const style = document.documentElement.dataset.numeralStyle || "western";
  return style === "arabic" ? "ar-SA" : "en-US";
}

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

export function formatNumber(amount, options = {}) {
  const { decimals = 2, showSymbol = false, symbol = "ر.س" } = options;
  const locale = getNumeralLocale();
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(amount || 0));
  return showSymbol ? `${formatted} ${symbol}` : formatted;
}

export function formatCurrency(amount, symbol = "ر.س", decimals = 2) {
  return formatNumber(amount, { decimals, showSymbol: true, symbol });
}
