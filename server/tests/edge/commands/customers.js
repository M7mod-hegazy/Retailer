const { addCustomer } = require("../model");

let seq = 0;

class CreateCustomer {
  constructor({ openingBalance }) {
    this.openingBalance = Number(openingBalance || 0);
  }
  check() {
    return true; // always allowed
  }
  async run(model, real) {
    seq += 1;
    const res = await real.http
      .post("/api/customers")
      .set("Authorization", `Bearer ${real.token}`)
      .send({
        name: `EdgeCust-${seq}`,
        code: `EDGE-${seq}`,
        opening_balance: this.openingBalance,
        credit_limit: 1_000_000,
      });
    if (res.status !== 201) {
      throw new Error(`CreateCustomer failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    const id = res.body.data.id;
    addCustomer(model, { id, openingBalance: this.openingBalance });
    model.lastCustomerId = id;
  }
  toString() {
    return `CreateCustomer(opening=${this.openingBalance})`;
  }
}

module.exports = { CreateCustomer };
