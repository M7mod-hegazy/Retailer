const { add, subtract, multiply, percent } = require("../src/utils/currencyMath");

describe("currencyMath", () => {
  test("handles integer math safely", () => {
    expect(add(1_000_000_000, 5)).toBe(1_000_000_005);
    expect(subtract(1_000_000_000, 5)).toBe(999_999_995);
    expect(multiply(10_000, 3)).toBe(30_000);
    expect(percent(1_000_000_000, 15)).toBe(150_000_000);
  });
});
