import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import FooterTextBlock from "../blocks/FooterTextBlock";
import ReceiptHeaderTextBlock from "../blocks/ReceiptHeaderTextBlock";
import NotesBlock from "../blocks/NotesBlock";

// The Studio canvas renders blocks with editing=true. The small text blocks
// used to show their hardcoded sample text even when the user configured a
// real value — so the design on the canvas never matched the real print.
// Real settings text must always win; the sample is only for empty state.
describe("small text blocks prefer real data over editing mocks", () => {
  it("footer block shows the configured receipt_footer while editing", () => {
    const { container } = render(
      <FooterTextBlock settings={{ receipt_footer: "يرجى الانتظار لحين مناداة رقمك" }} family="roll" editing />
    );
    expect(container.textContent).toContain("يرجى الانتظار لحين مناداة رقمك");
    expect(container.textContent).not.toContain("شكراً لتعاملكم معنا");
  });

  it("footer block still shows sample text while editing with nothing configured", () => {
    const { container } = render(<FooterTextBlock settings={{}} family="roll" editing />);
    expect(container.textContent.trim()).not.toBe("");
  });

  it("header text block shows the configured receipt_header while editing", () => {
    const { container } = render(
      <ReceiptHeaderTextBlock settings={{ receipt_header: "مرحباً بكم في متجرنا الخاص" }} family="roll" editing />
    );
    expect(container.textContent).toContain("مرحباً بكم في متجرنا الخاص");
  });

  it("notes block shows the configured receipt_notes while editing", () => {
    const { container } = render(
      <NotesBlock settings={{ receipt_notes: "صالحة خلال 14 يوم" }} family="roll" editing />
    );
    expect(container.textContent).toContain("صالحة خلال 14 يوم");
    expect(container.textContent).not.toContain("مثال:");
  });

  it("notes block falls back to invoice notes, then sample, while editing", () => {
    const real = render(
      <NotesBlock invoice={{ notes: "توصيل بعد العصر" }} settings={{}} family="roll" editing />
    );
    expect(real.container.textContent).toContain("توصيل بعد العصر");
    const empty = render(<NotesBlock settings={{}} family="roll" editing />);
    expect(empty.container.textContent).toContain("مثال");
  });
});
