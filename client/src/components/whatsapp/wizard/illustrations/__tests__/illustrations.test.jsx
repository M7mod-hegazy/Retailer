import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PhoneFrame from "../PhoneFrame";
import ChatBubble from "../ChatBubble";
import TokenKey from "../TokenKey";
import SuccessBurst from "../SuccessBurst";
import QrTile from "../QrTile";

describe("wizard illustration primitives", () => {
  it("PhoneFrame renders its children and applies the accent border color", () => {
    const { container } = render(<PhoneFrame accent="rgb(1, 2, 3)"><span>محتوى</span></PhoneFrame>);
    expect(screen.getByText("محتوى")).toBeInTheDocument();
    const frame = container.querySelector(".phone-frame");
    expect(frame).toHaveStyle({ borderColor: "rgb(1, 2, 3)" });
  });

  it("ChatBubble aligns 'me' messages to the end and 'bot' messages to the start", () => {
    const { container, rerender } = render(<ChatBubble from="bot">رسالة البوت</ChatBubble>);
    expect(screen.getByText("رسالة البوت")).toBeInTheDocument();
    expect(container.querySelector(".justify-start")).toBeTruthy();

    rerender(<ChatBubble from="me">ردي</ChatBubble>);
    expect(screen.getByText("ردي")).toBeInTheDocument();
    expect(container.querySelector(".justify-end")).toBeTruthy();
  });

  it("TokenKey renders the label in LTR direction", () => {
    render(<TokenKey label="123:ABC-token" />);
    expect(screen.getByText("123:ABC-token")).toHaveAttribute("dir", "ltr");
  });

  it("SuccessBurst renders a check icon", () => {
    const { container } = render(<SuccessBurst accent="rgb(9, 9, 9)" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("QrTile renders the real image when src is provided", () => {
    render(<QrTile src="data:image/png;base64,abc" alt="QR كود" />);
    expect(screen.getByRole("img", { name: "QR كود" })).toHaveAttribute("src", "data:image/png;base64,abc");
  });

  it("QrTile renders a placeholder icon when no src is provided", () => {
    const { container } = render(<QrTile alt="QR كود" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
