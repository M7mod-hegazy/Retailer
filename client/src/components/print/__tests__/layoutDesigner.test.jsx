import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LayoutRenderer from "../LayoutRenderer";
import PrintDesigner from "../designer/PrintDesigner";

const INV = { invoice_no: "INV-1", customer_name: "ز", lines: [{ product_name: "صنف", quantity: 2, unit_price: 50 }], payments: [] };

describe("LayoutRenderer designer integration", () => {
  it("applies a perBlock style override via scoped !important CSS", () => {
    const layout = { roll: { order: ["company_name"], perBlock: { company_name: { color: "#ff0000", fontSize: 22 } } } };
    const { container } = render(<LayoutRenderer family="roll" invoice={INV} settings={{ company_name: "ACME" }} layout={layout} />);
    expect(container.textContent).toContain("ACME");
    const wrap = container.querySelector('[data-ov="company_name"]');
    expect(wrap).toBeTruthy();
    expect(wrap.querySelector("style").textContent).toContain("color:#ff0000 !important");
    expect(wrap.querySelector("style").textContent).toContain("font-size:22px !important");
  });

  it("applies a width override on the wrapper element", () => {
    const layout = { roll: { order: ["company_name"], perBlock: { company_name: { width: 60 } } } };
    const { container } = render(<LayoutRenderer family="roll" invoice={INV} settings={{ company_name: "ACME" }} layout={layout} />);
    const wrap = container.querySelector('[data-ov="company_name"]');
    expect(wrap.getAttribute("style")).toContain("width: 60%");
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

  it("renders 8 resize handles on the selected block and fires onResizeStart", () => {
    const onResizeStart = vi.fn();
    const designer = { selectedKey: "company_name", hoveredKey: null, onSelect: () => {}, onHover: () => {}, onMoveStart: () => {}, onResizeStart };
    const layout = { roll: { order: ["company_name"] } };
    const { container } = render(<LayoutRenderer family="roll" invoice={INV} settings={{ company_name: "ACME" }} layout={layout} editing designer={designer} />);
    const handles = container.querySelectorAll('[title="تغيير الحجم"]');
    expect(handles.length).toBe(8);
    fireEvent.pointerDown(handles[4]); // a corner
    expect(onResizeStart).toHaveBeenCalledTimes(1);
    expect(onResizeStart.mock.calls[0][1]).toHaveProperty("w"); // dir object
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

  it("double-click on the canvas edits the bound text field", () => {
    const onChange = vi.fn();
    render(<PrintDesigner {...base} value={{ company_name: "ACME" }} onChange={onChange} onSave={() => {}} onClose={() => {}} />);
    fireEvent.doubleClick(document.querySelector('[data-designer-key="company_name"]'));
    const ed = document.querySelector('[data-designer-key="company_name"]');
    ed.textContent = "الحجازي";
    fireEvent.blur(ed);
    expect(onChange.mock.calls.at(-1)[0].company_name).toBe("الحجازي");
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
