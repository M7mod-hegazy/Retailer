import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Drawer from "../Drawer";

describe("Drawer", () => {
  it("does not render when open is false", () => {
    render(<Drawer open={false} title="Test">Content</Drawer>);
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("renders content when open is true", () => {
    render(<Drawer open={true} title="Test">Content</Drawer>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders title", () => {
    render(<Drawer open={true} title="الإعدادات">Content</Drawer>);
    expect(screen.getByText("الإعدادات")).toBeInTheDocument();
  });

  it("calls onClose when clicking overlay", () => {
    const onClose = vi.fn();
    render(<Drawer open={true} title="Test" onClose={onClose}>Content</Drawer>);
    const overlays = document.querySelectorAll('[class*="inset-0"]');
    const backdrop = Array.from(overlays).find(el => el.classList.contains("backdrop-blur-sm"));
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when clicking close button", () => {
    const onClose = vi.fn();
    render(<Drawer open={true} title="Test" onClose={onClose}>Content</Drawer>);
    const closeBtn = screen.getByRole("button", { name: "إغلاق" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("positions drawer on the right by default", () => {
    const { container } = render(<Drawer open={true} title="Test">Content</Drawer>);
    const panel = container.querySelector('[class*="right-0"]');
    expect(panel).toBeInTheDocument();
  });

  it("positions drawer on the left when position='left'", () => {
    const { container } = render(<Drawer open={true} title="Test" position="left">Content</Drawer>);
    const panel = container.querySelector('[class*="left-0"]');
    expect(panel).toBeInTheDocument();
  });
});
