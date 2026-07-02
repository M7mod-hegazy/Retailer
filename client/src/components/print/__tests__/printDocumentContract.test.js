import { describe, it, expect } from "vitest";
import { buildPrintDocument, getPrintBaseCss } from "../../../services/printDocument";
import { resolvePrintFont, PRINT_FONT_FAMILIES, fontFaceCss } from "../../../services/printFonts";

// Pipeline contract: what every print job's document must guarantee, verified
// at the built-HTML level so preview/print/PDF paths can't silently drift.
describe("print document contract", () => {
  it("embeds the selected bundled font as data-URI @font-face with real weights", () => {
    const html = buildPrintDocument("<div>مرحبا</div>", "80mm auto", "t", { printFont: "Tajawal" });
    expect(html).toContain("@font-face");
    expect(html).toContain("font-family:'Tajawal'");
    expect(html).toContain("data:font/woff2;base64");
    expect(html).toContain("font-weight:700");
  });

  it("forbids synthesized bold (the dashed-bold thermal bug)", () => {
    const html = buildPrintDocument("<div/>", "80mm auto");
    expect(html).toContain("font-synthesis: none");
  });

  it("keeps print-color-adjust and zero @page margin", () => {
    const html = buildPrintDocument("<div/>", "58mm auto");
    expect(html).toContain("print-color-adjust: exact");
    expect(html).toContain("@page { size: 58mm auto; margin: 0; }");
  });

  it("strips stray @page rules from content", () => {
    const html = buildPrintDocument("<style>@page { size: A4; }</style><b>x</b>", "80mm auto");
    expect(html).not.toContain("size: A4");
    expect(html).toContain("<b>x</b>");
  });

  it("system fonts embed nothing and keep the OS stack", () => {
    const font = resolvePrintFont("Tahoma");
    expect(font.fontFaceCss).toBe("");
    expect(font.stack).toContain("Tahoma");
  });

  it("every advertised bundled family produces embedded rules", () => {
    PRINT_FONT_FAMILIES.forEach((family) => {
      expect(fontFaceCss(family), family).toContain("data:font/woff2;base64");
    });
  });

  it("base css leads with the resolved font stack", () => {
    const css = getPrintBaseCss({ pageSizeStr: "80mm auto", fontStack: "'Cairo', sans-serif" });
    expect(css).toContain("font-family: 'Cairo', sans-serif");
  });
});
