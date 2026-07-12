import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BLOCK_REGISTRY } from "../blocks/registry";
import { encodeCode128B, code128Bars, START_B, STOP } from "../../../utils/code128";

const INV = { invoice_no: "INV-2026-0001" };

describe("watermark block", () => {
  const { component: Block } = BLOCK_REGISTRY.watermark;

  it("renders nothing by default (show_watermark off)", () => {
    const { container } = render(
      <Block invoice={{}} settings={{}} props={{}} family="page" />
    );
    expect(container.textContent).toBe("");
  });

  it("renders nothing on roll family even when enabled", () => {
    const { container } = render(
      <Block invoice={{}} settings={{ show_watermark: true, watermark_text: "نسخة" }} props={{}} family="roll" />
    );
    expect(container.textContent).toBe("");
  });

  it("renders the watermark text when enabled with text", () => {
    render(
      <Block invoice={{}} settings={{ show_watermark: true, watermark_text: "نسخة" }} props={{}} family="page" />
    );
    expect(screen.getByText("نسخة")).toBeTruthy();
  });

  it("renders nothing when enabled but text is empty", () => {
    const { container } = render(
      <Block invoice={{}} settings={{ show_watermark: true, watermark_text: "" }} props={{}} family="page" />
    );
    expect(container.textContent).toBe("");
  });
});

describe("signature lines block", () => {
  const { component: Block } = BLOCK_REGISTRY.signature_lines;

  it("renders nothing by default (show_signature_lines off)", () => {
    const { container } = render(
      <Block invoice={{}} settings={{}} props={{}} family="page" />
    );
    expect(container.textContent).toBe("");
  });

  it("renders 2 default signature labels when enabled", () => {
    render(<Block invoice={{}} settings={{ show_signature_lines: true }} props={{}} family="page" />);
    expect(screen.getByText("توقيع البائع")).toBeTruthy();
    expect(screen.getByText("توقيع المستلم")).toBeTruthy();
    expect(screen.queryByText("توقيع المدير")).toBeFalsy();
  });

  it("renders 3 signature labels when props.count = 3", () => {
    render(<Block invoice={{}} settings={{ show_signature_lines: true }} props={{ count: 3 }} family="page" />);
    expect(screen.getByText("توقيع البائع")).toBeTruthy();
    expect(screen.getByText("توقيع المستلم")).toBeTruthy();
    expect(screen.getByText("توقيع المدير")).toBeTruthy();
  });
});

describe("barcode block", () => {
  const { component: Block } = BLOCK_REGISTRY.barcode;

  it("renders nothing by default (show_barcode_line off)", () => {
    const { container } = render(
      <Block invoice={INV} settings={{}} props={{}} family="roll" />
    );
    expect(container.textContent).toBe("");
  });

  it("renders nothing when enabled but no document number exists", () => {
    const { container } = render(
      <Block invoice={{}} settings={{ show_barcode_line: true }} props={{}} family="roll" />
    );
    expect(container.textContent).toBe("");
  });

  it("renders an svg with bars and the number text when enabled", () => {
    const { container } = render(
      <Block invoice={INV} settings={{ show_barcode_line: true }} props={{}} family="roll" />
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    const rects = container.querySelectorAll("rect");
    // at least the white background rect + several black bar rects
    expect(rects.length).toBeGreaterThan(5);
    expect(container.textContent).toContain("INV-2026-0001");
  });
});

describe("order number block", () => {
  const { component: Block } = BLOCK_REGISTRY.order_number;

  it("renders nothing when no document number exists", () => {
    const { container } = render(<Block invoice={{}} settings={{}} props={{}} family="roll" />);
    expect(container.textContent).toBe("");
  });

  it("always renders (no settings toggle) with a large font size", () => {
    const { container } = render(<Block invoice={INV} settings={{}} props={{}} family="roll" />);
    expect(container.textContent).toContain("INV-2026-0001");
    // Default (doc) source labels itself "رقم المستند"; "رقم الطلب" is the
    // daily-sequence source label.
    expect(container.textContent).toContain("رقم المستند");
    const numberDiv = screen.getByText("INV-2026-0001");
    expect(parseInt(numberDiv.style.fontSize, 10)).toBeGreaterThanOrEqual(30);
  });

  it("honors props.fontSize and props.label overrides", () => {
    render(<Block invoice={INV} settings={{}} props={{ fontSize: 50, label: "" }} family="page" />);
    const numberDiv = screen.getByText("INV-2026-0001");
    expect(numberDiv.style.fontSize).toBe("50px");
    expect(screen.queryByText("رقم الطلب")).toBeFalsy();
  });
});

describe("image block", () => {
  const { component: Block } = BLOCK_REGISTRY.image;

  it("renders nothing without props.src", () => {
    const { container } = render(<Block invoice={{}} settings={{}} props={{}} family="roll" />);
    expect(container.querySelector("img")).toBeFalsy();
  });

  it("renders an img with the given src (thermal processing skipped)", () => {
    const src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const { container } = render(
      <Block invoice={{}} settings={{}} props={{ src, thermalProcess: false, maxHeight: 80 }} family="roll" />
    );
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe(src);
    expect(img.style.maxHeight).toBe("80px");
  });

  it("renders an img immediately on page family (no thermal processing path)", () => {
    const src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const { container } = render(
      <Block invoice={{}} settings={{}} props={{ src }} family="page" />
    );
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe(src);
  });
});

describe("registry families", () => {
  it("watermark and signature_lines are page-only", () => {
    expect(BLOCK_REGISTRY.watermark.families).toEqual(["page"]);
    expect(BLOCK_REGISTRY.signature_lines.families).toEqual(["page"]);
  });
  it("barcode, order_number, image support both families", () => {
    expect(BLOCK_REGISTRY.barcode.families).toEqual(["roll", "page"]);
    expect(BLOCK_REGISTRY.order_number.families).toEqual(["roll", "page"]);
    expect(BLOCK_REGISTRY.image.families).toEqual(["roll", "page"]);
  });
});

describe("code128 encoder", () => {
  it('encodes "INV-123" with the correct checksum and start/stop symbols', () => {
    // Hand-computed: Code128B values = charCode - 32.
    // I=41 N=46 V=54 -=13 1=17 2=18 3=19
    // checksum = START_B(104) + 1*41 + 2*46 + 3*54 + 4*13 + 5*17 + 6*18 + 7*19
    //          = 104 + 41 + 92 + 162 + 52 + 85 + 108 + 133 = 777
    //          777 mod 103 = 777 - 7*103(721) = 56
    const { values, checksum, charValues } = encodeCode128B("INV-123");
    expect(charValues).toEqual([41, 46, 54, 13, 17, 18, 19]);
    expect(checksum).toBe(56);
    expect(values[0]).toBe(START_B);
    expect(values[values.length - 1]).toBe(STOP);
    expect(values[values.length - 2]).toBe(56);
    expect(values).toEqual([104, 41, 46, 54, 13, 17, 18, 19, 56, 106]);
  });

  it("produces bar widths summing correctly and includes a quiet zone on both sides", () => {
    const { bars, totalModules } = code128Bars("INV-123", { quietZone: 10 });
    expect(bars.length).toBeGreaterThan(0);
    // No bar should start before the left quiet zone.
    expect(Math.min(...bars.map((b) => b.x))).toBeGreaterThanOrEqual(10);
    // No bar should extend past the right quiet zone.
    const maxX = Math.max(...bars.map((b) => b.x + b.width));
    expect(maxX).toBeLessThanOrEqual(totalModules - 10);
  });

  it("throws for characters outside ASCII 32-127 (subset B range)", () => {
    expect(() => encodeCode128B("فاتورة")).toThrow();
  });
});
