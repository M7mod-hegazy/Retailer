import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ItemsTableBlock from "../blocks/ItemsTableBlock";

const invoice = {
  lines: [
    { product_name: "قميص أبيض", quantity: 2, unit_price: 85, sku: "SH-001" },
    { product_name: "بنطلون جينز", quantity: 1, unit_price: 230, sku: "PA-042" },
  ],
};

describe("ItemsTableBlock roll variants", () => {
  it("standard variant renders a table on roll", () => {
    const { container } = render(
      <ItemsTableBlock invoice={invoice} settings={{}} props={{ variant: "standard" }} family="roll" />
    );
    expect(container.querySelector("table")).not.toBeNull();
  });

  it("cards variant renders no table on roll and shows a dashed separator between items", () => {
    const { container } = render(
      <ItemsTableBlock invoice={invoice} settings={{}} props={{ variant: "cards" }} family="roll" />
    );
    expect(container.querySelector("table")).toBeNull();
    expect(container.innerHTML).toContain("dashed");
    expect(container.textContent).toContain("قميص أبيض");
    expect(container.textContent).toContain("بنطلون جينز");
  });

  it("minimalist-list variant renders no table and no dashed separators on roll", () => {
    const { container } = render(
      <ItemsTableBlock invoice={invoice} settings={{}} props={{ variant: "minimalist-list" }} family="roll" />
    );
    expect(container.querySelector("table")).toBeNull();
    expect(container.innerHTML).not.toContain("dashed");
    expect(container.textContent).toContain("قميص أبيض");
  });

  it("cards and minimalist-list produce different markup from each other on roll", () => {
    const cards = render(
      <ItemsTableBlock invoice={invoice} settings={{}} props={{ variant: "cards" }} family="roll" />
    ).container.innerHTML;
    const minimal = render(
      <ItemsTableBlock invoice={invoice} settings={{}} props={{ variant: "minimalist-list" }} family="roll" />
    ).container.innerHTML;
    expect(cards).not.toBe(minimal);
  });
});
