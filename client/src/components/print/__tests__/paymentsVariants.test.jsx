import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PaymentsBlock from "../blocks/PaymentsBlock";
import { computeTotals } from "../blocks/blockUtils";

const invoice = {
  payments: [
    { method_name: "نقدي", amount: 150 },
    { method_name: "شبكة", amount: 100 },
  ],
};
const settings = { show_payment_details: true };

describe("PaymentsBlock roll variants", () => {
  it("table-row variant on roll shows a top rule per payment row", () => {
    const { container } = render(
      <PaymentsBlock invoice={invoice} settings={settings} props={{ variant: "table-row" }} family="roll" />
    );
    expect(container.innerHTML).toContain("border-top");
    expect(container.textContent).toContain("نقدي");
    expect(container.textContent).toContain("شبكة");
  });

  it("badge-pill variant on roll shows bordered pill tags", () => {
    const { container } = render(
      <PaymentsBlock invoice={invoice} settings={settings} props={{ variant: "badge-pill" }} family="roll" />
    );
    expect(container.innerHTML).toContain("border-radius");
    expect(container.textContent).toContain("نقدي");
  });

  it("table-row and badge-pill produce different markup on roll", () => {
    const a = render(
      <PaymentsBlock invoice={invoice} settings={settings} props={{ variant: "table-row" }} family="roll" />
    ).container.innerHTML;
    const b = render(
      <PaymentsBlock invoice={invoice} settings={settings} props={{ variant: "badge-pill" }} family="roll" />
    ).container.innerHTML;
    expect(a).not.toBe(b);
  });
});

// Saved invoices reloaded from the DB have payments derived ONLY from
// payment_allocations; cash POS sales create no allocation rows, so the API
// returns payments: []. The block must fall back to the header snapshot
// (payment_type + amount_received/total) or reprints silently lose the
// payment details the Studio design shows.
describe("PaymentsBlock header-snapshot fallback", () => {
  const savedCashInvoice = {
    payments: [],
    payment_type: "cash",
    amount_received: 210,
    total: 210,
    status: "paid",
  };

  it("renders from payment_type + amount_received when payments array is empty", () => {
    const { container } = render(
      <PaymentsBlock invoice={savedCashInvoice} settings={settings} props={{ variant: "badge-pill" }} family="roll" />
    );
    expect(container.textContent).toContain("نقدي");
    expect(container.textContent).toContain("210");
  });

  it("uses total when a paid invoice has no amount_received", () => {
    const { container } = render(
      <PaymentsBlock
        invoice={{ payments: [], payment_type: "cash", total: 150, status: "paid" }}
        settings={settings}
        family="roll"
      />
    );
    expect(container.textContent).toContain("150");
  });

  it("stays hidden when the snapshot has no meaningful amount (e.g. purchase docs)", () => {
    const { container } = render(
      <PaymentsBlock invoice={{ payments: [], payment_type: "cash" }} settings={settings} family="roll" />
    );
    expect(container.textContent).toBe("");
  });

  it("computeTotals counts the fallback as paid so PAID/DUE stamps are truthful", () => {
    const { paid, grandTotal } = computeTotals(savedCashInvoice, settings);
    expect(paid).toBe(210);
    expect(paid).toBeGreaterThanOrEqual(grandTotal);
  });
});
