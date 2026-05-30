import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LayoutRenderer from "../LayoutRenderer";
import PrintDesigner from "../designer/PrintDesigner";

const INV = { invoice_no: "INV-1", customer_name: "ز", lines: [{ product_name: "صنف", quantity: 2, unit_price: 50 }], payments: [] };

describe("LayoutRenderer designer integration", () => {
  it("applies a perBlock style override as a wrapper", () => {
    const layout = { roll: { order: ["company_name"], perBlock: { company_name: { color: "#ff0000" } } } };
    const { container } = render(<LayoutRenderer family="roll" invoice={INV} settings={{ company_name: "ACME" }} layout={layout} />);
    expect(container.textContent).toContain("ACME");
    expect(container.innerHTML).toContain("color: rgb(255, 0, 0)");
  });

  it("renders layout.inserted custom text", () => {
    const layout = { roll: { order: ["company_name"], inserted: [{ id: "d1", type: "custom_text", after: "company_name", props: { text: "مُدرج بالمحرر" } }] } };
    const { container } = render(<LayoutRenderer family="roll" invoice={INV} settings={{ company_name: "ACME" }} layout={layout} />);
    expect(container.textContent).toContain("مُدرج بالمحرر");
  });

  it("wraps blocks with selectable chrome when an editing designer is supplied", () => {
    const onSelect = vi.fn();
    const designer = { selectedKey: "company_name", hoveredKey: null, onSelect, onHover: () => {}, onDragStart: () => {}, onDrop: () => {} };
    const layout = { roll: { order: ["company_name"] } };
    const { container } = render(<LayoutRenderer family="roll" invoice={INV} settings={{ company_name: "ACME" }} layout={layout} editing designer={designer} />);
    const wrap = container.querySelector("[data-designer-key='company_name']");
    expect(wrap).toBeTruthy();
    expect(wrap.getAttribute("style")).toMatch(/7c3aed|124, 58, 237/i); // selected outline #7c3aed
    fireEvent.click(wrap);
    expect(onSelect).toHaveBeenCalledWith("company_name");
  });

  it("does not add selectable chrome on the print path (no designer)", () => {
    const layout = { roll: { order: ["company_name"] } };
    const { container } = render(<LayoutRenderer family="roll" invoice={INV} settings={{ company_name: "ACME" }} layout={layout} />);
    expect(container.querySelector("[data-designer-key]")).toBeNull();
  });

  it("honors items_table column visibility/labels on page", () => {
    const layout = { page: { order: ["items_table"], perBlock: { items_table: { columns: [
      { key: "name", label: "البيان", visible: true, align: "right" },
      { key: "qty", label: "كمية", visible: true, align: "center" },
    ] } } } };
    const { container } = render(<LayoutRenderer family="page" size="A4" invoice={INV} settings={{ accent_color: "#0f172a" }} layout={layout} />);
    const thead = container.querySelector("thead");
    expect(thead.textContent).toContain("البيان"); // relabeled
    expect(thead.textContent).not.toContain("سعر");  // price column hidden
  });
});

describe("PrintDesigner", () => {
  const base = { docType: "sales_invoice", label: "فاتورة", globalSettings: { company_name: "ACME" }, value: {} };

  it("renders the outline with known blocks", () => {
    const { getByText, getAllByText } = render(<PrintDesigner {...base} onChange={() => {}} onSave={() => {}} onClose={() => {}} />);
    expect(getByText(/المحرر المتقدم/)).toBeTruthy();
    expect(getAllByText("اسم الشركة").length).toBeGreaterThan(0);
  });

  it("inserting a text element calls onChange with an inserted block", () => {
    const onChange = vi.fn();
    const { getByText } = render(<PrintDesigner {...base} onChange={onChange} onSave={() => {}} onClose={() => {}} />);
    fireEvent.click(getByText("نص")); // left palette insert button
    const last = onChange.mock.calls.at(-1)[0];
    expect(last.layout.page.inserted.length).toBe(1);
    expect(last.layout.page.inserted[0].type).toBe("custom_text");
  });

  it("undo reverts the last change", () => {
    const onChange = vi.fn();
    const { getByText, getByTitle } = render(<PrintDesigner {...base} onChange={onChange} onSave={() => {}} onClose={() => {}} />);
    fireEvent.click(getByText("نص")); // insert a custom_text
    expect(onChange.mock.calls.at(-1)[0].layout.page.inserted.length).toBe(1);
    fireEvent.click(getByTitle(/تراجع/)); // Undo
    expect(onChange.mock.calls.at(-1)[0].layout.page.inserted.length).toBe(0);
  });

  it("Save & close persists the draft and closes", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const { getByText } = render(<PrintDesigner {...base} onChange={() => {}} onSave={onSave} onClose={onClose} />);
    fireEvent.click(getByText(/حفظ وإغلاق/));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
