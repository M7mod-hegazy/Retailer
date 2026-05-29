import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LayoutRenderer from "../LayoutRenderer";

// Legacy custom blocks live in settings.custom_text_blocks (see pages/settings/CustomTextBlocks).
const settings = {
  company_name: "ACME",
  custom_text_blocks: JSON.stringify([{ id: "x", position: "after_header", type: "text", text: "نص مخصص هام", paperSizes: ["80mm", "A4"] }]),
};

describe("custom blocks preserved", () => {
  it("renders legacy custom text in roll output", () => {
    const { container } = render(<LayoutRenderer family="roll" invoice={{ lines: [] }} settings={settings} />);
    expect(container.textContent).toContain("نص مخصص هام");
  });
  it("renders legacy custom text in page output", () => {
    const { container } = render(<LayoutRenderer family="page" size="A4" invoice={{ lines: [] }} settings={settings} />);
    expect(container.textContent).toContain("نص مخصص هام");
  });
});
