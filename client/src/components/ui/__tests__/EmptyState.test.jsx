import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EmptyState from "../EmptyState";

describe("EmptyState", () => {
  it("renders default message when no props provided", () => {
    render(<EmptyState />);
    expect(screen.getByText("لا توجد بيانات")).toBeInTheDocument();
  });

  it("renders title when provided", () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="Empty" description="Add something" />);
    expect(screen.getByText("Add something")).toBeInTheDocument();
  });

  it("uses preset for invoices type", () => {
    render(<EmptyState type="invoices" />);
    expect(screen.getByText("لا توجد فواتير")).toBeInTheDocument();
    expect(screen.getByText("ابدأ بإنشاء أول فاتورة بيع")).toBeInTheDocument();
    expect(screen.getByText("🧾")).toBeInTheDocument();
  });

  it("uses preset for customers type", () => {
    render(<EmptyState type="customers" />);
    expect(screen.getByText("لا يوجد عملاء")).toBeInTheDocument();
  });

  it("uses preset for items type", () => {
    render(<EmptyState type="items" />);
    expect(screen.getByText("لا توجد أصناف")).toBeInTheDocument();
  });

  it("uses preset for search type", () => {
    render(<EmptyState type="search" />);
    expect(screen.getByText("لا نتائج للبحث")).toBeInTheDocument();
  });

  it("icon prop overrides preset icon", () => {
    render(<EmptyState type="invoices" icon="💰" />);
    expect(screen.getByText("💰")).toBeInTheDocument();
  });

  it("title prop overrides preset title", () => {
    render(<EmptyState type="invoices" title="Custom Title" />);
    expect(screen.getByText("Custom Title")).toBeInTheDocument();
  });

  it("renders action element when provided", () => {
    render(<EmptyState type="invoices" action={<button type="button">Create</button>} />);
    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("uses message as fallback title", () => {
    render(<EmptyState message="Custom message" />);
    expect(screen.getByText("Custom message")).toBeInTheDocument();
  });
});
