import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ReportTableBlock } from "../blocks/ReportBlocks";

const invoice = {
  rows: [{ "0": "بند أول", "1": "100" }, { "0": "بند ثاني", "1": "50" }],
  columns: ["الوصف", "المبلغ"],
};

describe("ReportTableBlock variants (page)", () => {
  it("standard variant renders a table", () => {
    const { container } = render(
      <ReportTableBlock invoice={invoice} settings={{}} props={{ variant: "standard" }} family="page" />
    );
    expect(container.querySelector("table")).not.toBeNull();
  });

  it("cards variant renders no table and shows both column labels per row", () => {
    const { container } = render(
      <ReportTableBlock invoice={invoice} settings={{}} props={{ variant: "cards" }} family="page" />
    );
    expect(container.querySelector("table")).toBeNull();
    expect(container.textContent).toContain("بند أول");
    expect(container.textContent).toContain("الوصف");
  });

  it("minimalist-list variant renders no table", () => {
    const { container } = render(
      <ReportTableBlock invoice={invoice} settings={{}} props={{ variant: "minimalist-list" }} family="page" />
    );
    expect(container.querySelector("table")).toBeNull();
    expect(container.textContent).toContain("بند أول");
  });
});
