import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorState } from "../ErrorState";

describe("ErrorState", () => {
  it("renders default error message", () => {
    render(<ErrorState />);
    expect(screen.getByText("حدث خطأ أثناء التحميل")).toBeInTheDocument();
  });

  it("renders custom message", () => {
    render(<ErrorState message="فشل الاتصال" />);
    expect(screen.getByText("فشل الاتصال")).toBeInTheDocument();
  });

  it("renders empty message string", () => {
    const { container } = render(<ErrorState message="" />);
    expect(container.querySelector(".text-danger-DEFAULT")).toBeInTheDocument();
  });
});
