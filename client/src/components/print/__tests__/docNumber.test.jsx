import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DocNumberBlock, { resolveDocNo } from "../blocks/DocNumberBlock";

describe("doc number resolution across invoice types", () => {
  // Each document type stores its number under a different source field.
  const cases = [
    ["sales/POS", { invoice_no: "INV-20260620-0008" }, "INV-20260620-0008"],
    ["quotation", { invoice_number: "QTN-2026-0042" }, "QTN-2026-0042"],
    ["purchase/return", { doc_no: "PO-00012" }, "PO-00012"],
    ["branch transfer", { reference_no: "BT-S-20260620-003" }, "BT-S-20260620-003"],
  ];

  it.each(cases)("resolves %s number", (_label, invoice, expected) => {
    expect(resolveDocNo(invoice)).toBe(expected);
  });

  it("renders the branch-transfer reference (page family)", () => {
    const { container } = render(
      <DocNumberBlock invoice={{ reference_no: "BT-S-20260620-003" }} family="page" />
    );
    expect(container.textContent).toContain("BT-S-20260620-003");
  });

  it("renders nothing-but-empty when no number present", () => {
    expect(resolveDocNo({})).toBe("");
  });
});
