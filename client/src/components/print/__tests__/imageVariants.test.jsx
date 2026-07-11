import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ImageBlock from "../blocks/ImageBlock";

const props = { src: "/uploads/logo.png" };

describe("ImageBlock roll-safe card/banner variants", () => {
  it("standard variant on roll has no box-shadow and no border", () => {
    const { container } = render(<ImageBlock props={{ ...props, variant: "standard" }} family="roll" />);
    const img = container.querySelector("img");
    expect(img.style.boxShadow).toBe("none");
  });

  it("card variant on roll uses a double border instead of a shadow", () => {
    const { container } = render(<ImageBlock props={{ ...props, variant: "card" }} family="roll" />);
    const img = container.querySelector("img");
    expect(img.style.boxShadow).toBe("none");
    expect(img.style.border).toContain("double");
  });

  it("banner variant on roll uses dashed top/bottom rules instead of a shadow", () => {
    const { container } = render(<ImageBlock props={{ ...props, variant: "banner" }} family="roll" />);
    const img = container.querySelector("img");
    expect(img.style.boxShadow).toBe("none");
    expect(img.style.borderTop).toContain("dashed");
    expect(img.style.borderBottom).toContain("dashed");
  });

  it("card variant on page keeps the existing shadow", () => {
    const { container } = render(<ImageBlock props={{ ...props, variant: "card" }} family="page" />);
    const img = container.querySelector("img");
    expect(img.style.boxShadow).not.toBe("none");
  });
});
