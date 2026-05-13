function assertInt(value) {
  if (!Number.isInteger(value)) throw new Error("Value must be an integer");
}

function add(a, b) { assertInt(a); assertInt(b); return a + b; }
function subtract(a, b) { assertInt(a); assertInt(b); return a - b; }
function multiply(a, b) { assertInt(a); assertInt(b); return a * b; }
function percent(value, p) { assertInt(value); assertInt(p); return Math.round((value * p) / 100); }

module.exports = { add, subtract, multiply, percent };
