/**
 * Monetary math helpers — all money math must go through these to prevent
 * floating-point drift accumulating across WACC replays and cost calculations.
 * Always rounds to 4 decimal places after every operation.
 */

function roundMoney(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 10000) / 10000;
}

function addMoney(a, b) {
  return roundMoney(Number(a) + Number(b));
}

function subtractMoney(a, b) {
  return roundMoney(Number(a) - Number(b));
}

function multiplyMoney(a, b) {
  return roundMoney(Number(a) * Number(b));
}

function divideMoney(a, b) {
  const denom = Number(b);
  return denom !== 0 ? roundMoney(Number(a) / denom) : 0;
}

module.exports = { roundMoney, addMoney, subtractMoney, multiplyMoney, divideMoney };
