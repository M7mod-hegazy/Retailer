import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ReceiverSignatureBlock from "../blocks/ReceiverSignatureBlock";

const settings = { show_receiver_signature: true };

describe("ReceiverSignatureBlock split variant", () => {
  it("renders a two-column grid on page", () => {
    const { container } = render(
      <ReceiverSignatureBlock settings={settings} props={{ variant: "split" }} family="page" />
    );
    expect(container.innerHTML).toContain("grid-template-columns");
  });

  it("renders a two-column grid on roll too (not the plain stacked fallback)", () => {
    const { container } = render(
      <ReceiverSignatureBlock settings={settings} props={{ variant: "split" }} family="roll" />
    );
    expect(container.innerHTML).toContain("grid-template-columns");
  });

  it("standard variant on roll has no grid", () => {
    const { container } = render(
      <ReceiverSignatureBlock settings={settings} props={{ variant: "standard" }} family="roll" />
    );
    expect(container.innerHTML).not.toContain("grid-template-columns");
  });
});
