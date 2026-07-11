import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  BankStatementMetricsBlock,
  DailyTreasuryMetricsBlock,
  DailyTreasurySummariesBlock,
  PaymentMethodsByMethodBlock,
  AjalPartyBlock,
} from "../blocks/ReportBlocks";

describe("MetricCard variants (shared by all metric-strip blocks)", () => {
  const invoice = { grand_in: 1000, grand_out: 400, grand_closing: 600 };
  it("accent-band variant differs from standard", () => {
    const standard = render(<DailyTreasuryMetricsBlock invoice={invoice} settings={{}} props={{ variant: "standard" }} />).container.innerHTML;
    const band = render(<DailyTreasuryMetricsBlock invoice={invoice} settings={{}} props={{ variant: "accent-band" }} />).container.innerHTML;
    expect(band).not.toBe(standard);
  });
  it("minimal-rule variant differs from standard and accent-band", () => {
    const band = render(<DailyTreasuryMetricsBlock invoice={invoice} settings={{}} props={{ variant: "accent-band" }} />).container.innerHTML;
    const minimal = render(<DailyTreasuryMetricsBlock invoice={invoice} settings={{}} props={{ variant: "minimal-rule" }} />).container.innerHTML;
    expect(minimal).not.toBe(band);
    expect(minimal).toContain("border-bottom");
  });
  it("cascades to a second metric-strip block (bank statement)", () => {
    const bankInvoice = { bank: { balance: 500 }, transactions: [] };
    const standard = render(<BankStatementMetricsBlock invoice={bankInvoice} settings={{}} props={{ variant: "standard" }} />).container.innerHTML;
    const band = render(<BankStatementMetricsBlock invoice={bankInvoice} settings={{}} props={{ variant: "accent-band" }} />).container.innerHTML;
    expect(band).not.toBe(standard);
  });
});

describe("DailyTreasurySummariesBlock striped-compact variant", () => {
  const invoice = { treasuries: [{ name: "الخزينة الرئيسية", opening: 100, total_in: 50, total_out: 20, closing: 130 }] };
  it("differs from standard", () => {
    const standard = render(<DailyTreasurySummariesBlock invoice={invoice} settings={{}} props={{ variant: "standard" }} />).container.innerHTML;
    const striped = render(<DailyTreasurySummariesBlock invoice={invoice} settings={{}} props={{ variant: "striped-compact" }} />).container.innerHTML;
    expect(striped).not.toBe(standard);
  });
});

describe("PaymentMethodsByMethodBlock striped-compact variant", () => {
  const invoice = { byMethod: [{ method_name: "نقدي", transaction_count: 3, total_in: 100, total_out: 0, net_amount: 100 }] };
  it("differs from standard", () => {
    const standard = render(<PaymentMethodsByMethodBlock invoice={invoice} settings={{}} props={{ variant: "standard" }} />).container.innerHTML;
    const striped = render(<PaymentMethodsByMethodBlock invoice={invoice} settings={{}} props={{ variant: "striped-compact" }} />).container.innerHTML;
    expect(striped).not.toBe(standard);
  });
});

describe("AjalPartyBlock boxed-accent variant", () => {
  const invoice = { customer_name: "أحمد محمد", customer_phone: "0501234567" };
  it("differs from standard", () => {
    const standard = render(<AjalPartyBlock invoice={invoice} settings={{}} props={{ variant: "standard" }} />).container.innerHTML;
    const boxed = render(<AjalPartyBlock invoice={invoice} settings={{}} props={{ variant: "boxed-accent" }} />).container.innerHTML;
    expect(boxed).not.toBe(standard);
    expect(boxed).toContain("أحمد محمد");
  });
});
