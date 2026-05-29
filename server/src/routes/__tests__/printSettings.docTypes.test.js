const { DOC_TYPES } = require("../../../../shared/docTypes");

describe("shared DOC_TYPES", () => {
  it("includes previously-missing doc types", () => {
    expect(DOC_TYPES).toContain("purchase_return");
    expect(DOC_TYPES).toContain("ajal_full_statement");
  });
  it("covers all originally-supported types", () => {
    ["pos_receipt","sales_invoice","purchase_order","sales_return","quotation","branch_transfer",
     "bank_statement","ajal_statement","ajal_schedule","cheque_register","payment_receipt",
     "daily_treasury","payment_methods_report","reports_generic"].forEach(t => expect(DOC_TYPES).toContain(t));
  });
});
