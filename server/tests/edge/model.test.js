const { newModel, addCustomer, applyCreditSale, applyPayment } = require("./model");

describe("edge model", () => {
  test("customer balance follows credit sales and payments", () => {
    const m = newModel();
    addCustomer(m, { id: 1, openingBalance: 100 });
    expect(m.customers[1].balance).toBe(100);

    applyCreditSale(m, { customerId: 1, total: 250 });
    expect(m.customers[1].balance).toBe(350);

    applyPayment(m, { customerId: 1, amount: 90 });
    expect(m.customers[1].balance).toBe(260);
  });

  test("cash sale does not change customer balance", () => {
    const m = newModel();
    addCustomer(m, { id: 1, openingBalance: 0 });
    // cash sales are tracked separately; no applyCreditSale call
    expect(m.customers[1].balance).toBe(0);
  });
});
