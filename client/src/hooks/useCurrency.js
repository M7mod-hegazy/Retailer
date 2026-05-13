export function useCurrency(amount, symbol = "ر.س", decimals = 2) {
  const formatted = Number(amount || 0).toFixed(decimals);
  return `${formatted} ${symbol}`;
}
