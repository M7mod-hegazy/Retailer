import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";

vi.mock("../../../services/api", () => ({
  default: {
    get: vi.fn((url) => {
      if (url === "/api/settings") return Promise.resolve({ data: { data: { company_name: "شركة الاختبار" } } });
      if (url === "/api/print-settings-per-doc") return Promise.resolve({ data: { data: {} } });
      return Promise.resolve({ data: { data: {} } });
    }),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import api from "../../../services/api";
import PrintStudio from "../studio/PrintStudio";

describe("PrintStudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("loads settings and renders the block tree for the global scope", async () => {
    render(<PrintStudio open onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText("جدول الأصناف").length).toBeGreaterThan(0));
    expect(api.get).toHaveBeenCalledWith("/api/settings");
    expect(api.get).toHaveBeenCalledWith("/api/print-settings-per-doc");
    expect(screen.getByText("استوديو الطباعة")).toBeTruthy();
  });

  it("selecting the items table opens the real column editor", async () => {
    render(<PrintStudio open onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText("جدول الأصناف").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("جدول الأصناف")[0]);
    await waitFor(() => expect(screen.getByText("أعمدة الجدول")).toBeTruthy());
    // column rows expose editable label inputs (canonical perBlock columns)
    expect(screen.getByDisplayValue("المنتج")).toBeTruthy();
  });

  it("edits mark the scope dirty and حفظ persists via the per-doc API", async () => {
    render(<PrintStudio open onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText("جدول الأصناف").length).toBeGreaterThan(0));
    const saveBtn = screen.getByText("حفظ").closest("button");
    expect(saveBtn.disabled).toBe(true); // nothing dirty yet
    // hide the cashier block via its tree eye toggle
    const cashierRow = screen.getAllByText("الكاشير").find((el) => el.closest("[draggable]"));
    fireEvent.click(cashierRow.closest("[draggable]").querySelector("button[title='إخفاء']"));
    await waitFor(() => expect(screen.getByText("حفظ").closest("button").disabled).toBe(false));
    fireEvent.click(screen.getByText("حفظ").closest("button"));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, body] = api.put.mock.calls[0];
    expect(url).toBe("/api/print-settings-per-doc/_global");
    expect(body.show_cashier_name).toBe(false);
  });

  it("undo reverts the last edit", async () => {
    render(<PrintStudio open onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText("جدول الأصناف").length).toBeGreaterThan(0));
    const cashierRow = screen.getAllByText("الكاشير").find((el) => el.closest("[draggable]"));
    fireEvent.click(cashierRow.closest("[draggable]").querySelector("button[title='إخفاء']"));
    await waitFor(() => expect(screen.getByText("حفظ").closest("button").disabled).toBe(false));
    fireEvent.click(screen.getByTitle("تراجع (Ctrl+Z)"));
    await waitFor(() => expect(screen.getByText("حفظ").closest("button").disabled).toBe(true));
  });

  it("template docs get the reduced inspector instead of block editing", async () => {
    render(<PrintStudio open onClose={() => {}} initialScope="bank_statement" />);
    await waitFor(() => expect(screen.getByText("نصوص المستند")).toBeTruthy());
    // no block tree for template docs
    expect(screen.queryByText("ترتيب العناصر — اسحب للترتيب")).toBeNull();
    // flat settings still editable
    expect(screen.getByText("الورق والخط")).toBeTruthy();
  });

  it("page blocks can be pinned absolutely from the inspector", async () => {
    render(<PrintStudio open onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText("جدول الأصناف").length).toBeGreaterThan(0));
    // default scope is _global at A4 (page family) — select the company name
    fireEvent.click(screen.getAllByText("اسم الشركة")[0]);
    await waitFor(() => expect(screen.getByText(/تثبيت مطلق/)).toBeTruthy());
    const toggle = screen.getByText(/تثبيت مطلق/).closest("label").querySelector("button[role='switch']");
    fireEvent.click(toggle);
    // abs mm inputs appear (jsdom rects are 0 → fallback capture still writes abs)
    await waitFor(() => expect(screen.getAllByText(/\(مم\)/).length).toBeGreaterThan(0));
    // and the draft is dirty → save enabled
    expect(screen.getByText("حفظ").closest("button").disabled).toBe(false);
  });

  it("presets gallery opens with applyable presets for the current size", async () => {
    render(<PrintStudio open onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText("جدول الأصناف").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText("القوالب الجاهزة"));
    await waitFor(() => expect(screen.getByText(/القوالب الجاهزة — A4/)).toBeTruthy());
    // at least 20 preset cards per size (headline requirement)
    const applyTargets = screen.getAllByTitle("انقر لتطبيق القالب (يمكن التراجع بـ Ctrl+Z)");
    expect(applyTargets.length).toBeGreaterThanOrEqual(20);
  });
});
