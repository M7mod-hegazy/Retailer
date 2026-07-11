import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import FooterTextBlock from "../blocks/FooterTextBlock";
import SignatureLinesBlock from "../blocks/SignatureLinesBlock";
import BranchBlock from "../blocks/BranchBlock";
import AddressBlock from "../blocks/AddressBlock";
import TaxIdBlock from "../blocks/TaxIdBlock";

describe("FooterTextBlock underline-accent variant", () => {
  it("differs from standard on page", () => {
    const standard = render(<FooterTextBlock settings={{}} props={{ variant: "standard" }} family="page" editing />).container.innerHTML;
    const underline = render(<FooterTextBlock settings={{}} props={{ variant: "underline-accent" }} family="page" editing />).container.innerHTML;
    expect(underline).not.toBe(standard);
    expect(underline).toContain("border-top");
  });
});

describe("SignatureLinesBlock dotted-ruled variant", () => {
  const settings = { show_signature_lines: true };
  it("differs from boxed and standard on page", () => {
    const standard = render(<SignatureLinesBlock settings={settings} props={{ variant: "standard" }} family="page" />).container.innerHTML;
    const dotted = render(<SignatureLinesBlock settings={settings} props={{ variant: "dotted-ruled" }} family="page" />).container.innerHTML;
    expect(dotted).not.toBe(standard);
    expect(dotted).toContain("dotted");
  });
  it("renders nothing on roll (page-only block)", () => {
    const { container } = render(<SignatureLinesBlock settings={settings} props={{ variant: "dotted-ruled" }} family="roll" />);
    expect(container.textContent).toBe("");
  });
});

describe("BranchBlock boxed variant", () => {
  const settings = { show_branch: true, branch_name: "الفرع الرئيسي" };
  it("differs from badge and standard on page", () => {
    const standard = render(<BranchBlock settings={settings} props={{ variant: "standard" }} family="page" />).container.innerHTML;
    const boxed = render(<BranchBlock settings={settings} props={{ variant: "boxed" }} family="page" />).container.innerHTML;
    expect(boxed).not.toBe(standard);
    expect(boxed).toContain("border");
  });
  it("renders on roll too", () => {
    const { container } = render(<BranchBlock settings={settings} props={{ variant: "boxed" }} family="roll" />);
    expect(container.textContent).toContain("الفرع الرئيسي");
  });
});

describe("AddressBlock badge variant", () => {
  const settings = { show_address: true, show_phone: true, address: "شارع الملك فهد", phone: "0114567890" };
  it("differs from boxed and inline", () => {
    const boxed = render(<AddressBlock settings={settings} props={{ variant: "boxed" }} family="page" />).container.innerHTML;
    const badge = render(<AddressBlock settings={settings} props={{ variant: "badge" }} family="page" />).container.innerHTML;
    expect(badge).not.toBe(boxed);
    expect(badge).toContain("border-radius");
  });
});

describe("TaxIdBlock badge variant", () => {
  const settings = { show_tax_id: true, tax_id: "310012345600003" };
  it("differs from boxed variant (filled pill vs outline box)", () => {
    const boxed = render(<TaxIdBlock settings={settings} props={{ variant: "boxed" }} family="page" />).container.innerHTML;
    const badge = render(<TaxIdBlock settings={settings} props={{ variant: "badge" }} family="page" />).container.innerHTML;
    expect(badge).not.toBe(boxed);
    expect(badge).toContain("310012345600003");
  });
});
