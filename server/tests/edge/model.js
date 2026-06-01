// Naive parallel truth-model. Pure functions, no DB access.
function newModel() {
  return { customers: {} };
}

function addCustomer(m, { id, openingBalance }) {
  m.customers[id] = { id, balance: Number(openingBalance || 0) };
}

// Credit sale increases what the customer owes.
function applyCreditSale(m, { customerId, total }) {
  m.customers[customerId].balance += Number(total || 0);
}

// Payment reduces what the customer owes.
function applyPayment(m, { customerId, amount }) {
  m.customers[customerId].balance -= Number(amount || 0);
}

module.exports = { newModel, addCustomer, applyCreditSale, applyPayment };
