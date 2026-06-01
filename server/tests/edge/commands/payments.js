const { applyPayment } = require("../model");

class Payment {
  constructor({ amount }) {
    this.amount = Number(amount);
  }
  check(model) {
    // Only pay a customer that owes something (keeps sequences meaningful).
    const id = model.lastCustomerId;
    return Boolean(id) && model.customers[id].balance > 0 && this.amount > 0;
  }
  async run(model, real) {
    const customerId = model.lastCustomerId;
    const res = await real.http
      .post("/api/payments")
      .set("Authorization", `Bearer ${real.token}`)
      .send({
        party_type: "customer",
        party_id: customerId,
        amount: this.amount,
        method: "cash",
      });
    if (res.status >= 400) {
      throw new Error(`Payment failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    applyPayment(model, { customerId, amount: this.amount });
  }
  toString() {
    return `Payment(amount=${this.amount})`;
  }
}

module.exports = { Payment };
