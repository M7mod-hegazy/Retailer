import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Modal from "../Modal";

describe("Modal", () => {
  it("does not render when open is false", () => {
    render(<Modal open={false} title="Test">Content</Modal>);
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("renders content when open is true", () => {
    render(<Modal open={true} title="Test">Content</Modal>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders title when provided", () => {
    render(<Modal open={true} title="My Title">Content</Modal>);
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("calls onClose when clicking backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(<Modal open={true} title="Test" onClose={onClose}>Content</Modal>);
    const backdrop = container.querySelector('[class*="fixed"]');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when pressing Escape", () => {
    const onClose = vi.fn();
    render(<Modal open={true} title="Test" onClose={onClose}>Content</Modal>);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("does not call onClose when clicking inside content", () => {
    const onClose = vi.fn();
    render(<Modal open={true} title="Test" onClose={onClose}><button type="button">Inside</button></Modal>);
    const innerButton = screen.getByText("Inside");
    fireEvent.click(innerButton);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses maxWidth prop", () => {
    render(<Modal open={true} title="Test" maxWidth="max-w-2xl">Content</Modal>);
    const contentDiv = screen.getByText("Content").closest('[class*="max-w-2xl"]');
    expect(contentDiv).toBeInTheDocument();
  });

  it("renders close button when onClose is provided", () => {
    render(<Modal open={true} title="Test" onClose={() => {}}>Content</Modal>);
    const closeBtn = screen.getByRole("button", { name: "" });
    expect(closeBtn).toBeInTheDocument();
  });
});
