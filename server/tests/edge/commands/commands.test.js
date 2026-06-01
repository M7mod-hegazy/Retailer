const request = require("supertest");
const { freshWorld } = require("../helpers");
const { newModel } = require("../model");
const { checkInvariants } = require("../invariants");
const { CreateCustomer } = require("./customers");
const { SaleCredit, SaleCash } = require("./sales");
const { Payment } = require("./payments");

function realFrom(world) {
  return { ...world, http: request(world.app) };
}

describe("edge commands", () => {
  test("a hand-built sequence keeps invariants intact", async () => {
    const world = freshWorld();
    const real = realFrom(world);
    const model = newModel();

    await new CreateCustomer({ openingBalance: 100 }).run(model, real);
    await new SaleCredit({ quantity: 2, unitPrice: 50 }).run(model, real); // +100 credit
    await new SaleCash({ quantity: 1, unitPrice: 30 }).run(model, real); // no balance change
    await new Payment({ amount: 40 }).run(model, real); // -40

    // expected model balance: 100 + 100 - 40 = 160
    expect(model.customers[1].balance).toBe(160);
    expect(() => checkInvariants(world.db, model)).not.toThrow();
  });
});
