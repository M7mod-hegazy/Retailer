const { invoiceSchema } = require("../../shared/validations/invoiceSchemas");

describe("invoice integer validations", () => {
  test("accepts integer money values", () => {
    const result = invoiceSchema.safeParse({
      customer_id: 1,
      discount: 25,
      payment_type: "cash",
      lines: [{ item_id: 1, quantity: 2, unit_price: 150 }],
    });

    expect(result.success).toBe(true);
  });

  test("rejects non-integer quantities and prices", () => {
    const result = invoiceSchema.safeParse({
      customer_id: 1,
      discount: 12.5,
      payment_type: "cash",
      lines: [{ item_id: 1, quantity: 1.5, unit_price: 99.99 }],
    });

    expect(result.success).toBe(false);
  });
});
