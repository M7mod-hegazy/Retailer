import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  AccountStatementPartyBlock,
  AccountStatementLedgerBlock,
  AccountStatementSummaryBlock,
} from "../blocks/AccountStatementBlocks";

describe("AccountStatementPartyBlock boxed-accent variant", () => {
  const invoice = { statement_summary: { party_name: "شركة النجم", party_code: "C-001" } };
  it("differs from standard", () => {
    const standard = render(<AccountStatementPartyBlock invoice={invoice} settings={{}} props={{ variant: "standard" }} />).container.innerHTML;
    const boxed = render(<AccountStatementPartyBlock invoice={invoice} settings={{}} props={{ variant: "boxed-accent" }} />).container.innerHTML;
    expect(boxed).not.toBe(standard);
    expect(boxed).toContain("شركة النجم");
  });
});

describe("AccountStatementLedgerBlock banded variant", () => {
  const invoice = {
    statement_rows: [
      { type: "sale", date: "2026-07-01", debit: 100, credit: 0, running_balance: 100, ref_no: "1" },
      { type: "payment", date: "2026-07-02", debit: 0, credit: 50, running_balance: 50, ref_no: "2" },
    ],
    statement_summary: { opening_balance: 0, closing_balance: 50, total_debit: 100, total_credit: 50 },
  };
  it("differs from standard (alternating row background color changes)", () => {
    const standard = render(<AccountStatementLedgerBlock invoice={invoice} settings={{}} props={{ variant: "standard" }} />).container.innerHTML;
    const banded = render(<AccountStatementLedgerBlock invoice={invoice} settings={{}} props={{ variant: "banded" }} />).container.innerHTML;
    expect(banded).not.toBe(standard);
  });
});

describe("AccountStatementSummaryBlock boxed-strip variant", () => {
  const invoice = { statement_summary: { total_debit: 100, total_credit: 50, closing_balance: 50 } };
  it("differs from standard", () => {
    const standard = render(<AccountStatementSummaryBlock invoice={invoice} settings={{}} props={{ variant: "standard" }} />).container.innerHTML;
    const boxed = render(<AccountStatementSummaryBlock invoice={invoice} settings={{}} props={{ variant: "boxed-strip" }} />).container.innerHTML;
    expect(boxed).not.toBe(standard);
    expect(boxed).toContain("border");
  });
});
