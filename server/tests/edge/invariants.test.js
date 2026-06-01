const { freshWorld } = require("./helpers");
const { newModel, addCustomer, applyCreditSale } = require("./model");
const { checkInvariants, realCustomerBalance } = require("./invariants");

describe("edge invariants", () => {
  test("realCustomerBalance reads opening balance from DB", () => {
    const world = freshWorld();
    world.db
      .prepare("INSERT INTO customers (name, opening_balance) VALUES ('C', 75)")
      .run();
    expect(realCustomerBalance(world.db, 1)).toBe(75);
  });

  test("checkInvariants throws when model and DB disagree", () => {
    const world = freshWorld();
    world.db
      .prepare("INSERT INTO customers (name, opening_balance) VALUES ('C', 0)")
      .run();
    const m = newModel();
    addCustomer(m, { id: 1, openingBalance: 0 });
    // Lie to the model: claim a 50 credit sale that never hit the DB.
    applyCreditSale(m, { customerId: 1, total: 50 });
    expect(() => checkInvariants(world.db, m)).toThrow(/balance mismatch/i);
  });
});
