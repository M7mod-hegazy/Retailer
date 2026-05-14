import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmDialog from "../ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders message and buttons when open", () => {
    render(<ConfirmDialog open={true} message="هل أنت متأكد؟" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("هل أنت متأكد؟")).toBeInTheDocument();
    expect(screen.getByText("تأكيد")).toBeInTheDocument();
    expect(screen.getByText("إلغاء")).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    render(<ConfirmDialog open={false} message="هل أنت متأكد؟" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByText("هل أنت متأكد؟")).not.toBeInTheDocument();
  });

  it("renders default title", () => {
    render(<ConfirmDialog open={true} message="Test" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("تأكيد العملية")).toBeInTheDocument();
  });

  it("renders custom title", () => {
    render(<ConfirmDialog open={true} title="حذف" message="Test" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("حذف")).toBeInTheDocument();
  });

  it("calls onConfirm when تأكيد is clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open={true} message="Test" onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.click(screen.getByText("تأكيد"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onCancel when إلغاء is clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open={true} message="Test" onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("إلغاء"));
    expect(onCancel).toHaveBeenCalled();
  });
});
