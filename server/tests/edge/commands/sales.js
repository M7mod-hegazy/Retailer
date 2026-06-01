const { applyCreditSale } = require("../model");

// Both sale commands need an existing customer.
function hasCustomer(model) {
  return Boolean(model.lastCustomerId);
}

class SaleCredit {
  constructor({ quantity, unitPrice }) {
    this.quantity = Number(quantity);
    this.unitPrice = Number(unitPrice);
  }
  check(model) {
    return hasCustomer(model);
  }
  async run(model, real) {
    const customerId = model.lastCustomerId;
    const res = await real.http
      .post("/api/invoices")
      .set("Authorization", `Bearer ${real.token}`)
      .send({
        customer_id: customerId,
        payment_type: "credit",
        discount: 0,
        lines: [{ item_id: real.itemId, quantity: this.quantity, unit_price: this.unitPrice }],
      });
    const body = res.body?.data || res.body;
    if (!body?.id) {
      throw new Error(`SaleCredit failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    applyCreditSale(model, { customerId, total: Number(body.total) });
  }
  toString() {
    return `SaleCredit(qty=${this.quantity}, price=${this.unitPrice})`;
  }
}

class SaleCash {
  constructor({ quantity, unitPrice }) {
    this.quantity = Number(quantity);
    this.unitPrice = Number(unitPrice);
  }
  check(model) {
    return hasCustomer(model);
  }
  async run(model, real) {
    const customerId = model.lastCustomerId;
    const res = await real.http
      .post("/api/invoices")
      .set("Authorization", `Bearer ${real.token}`)
      .send({
        customer_id: customerId,
        payment_type: "cash",
        discount: 0,
        lines: [{ item_id: real.itemId, quantity: this.quantity, unit_price: this.unitPrice }],
      });
    const body = res.body?.data || res.body;
    if (!body?.id) {
      throw new Error(`SaleCash failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    // Cash sale: paid immediately, no change to credit balance → model unchanged.
  }
  toString() {
    return `SaleCash(qty=${this.quantity}, price=${this.unitPrice})`;
  }
}

module.exports = { SaleCredit, SaleCash };
