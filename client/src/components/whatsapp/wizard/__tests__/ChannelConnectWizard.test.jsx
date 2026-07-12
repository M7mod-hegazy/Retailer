import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChannelConnectWizard from "../ChannelConnectWizard";
import { Wifi } from "lucide-react";

const baseSteps = [
  { key: "one", illustration: <div>مشهد ١</div>, caption: "الخطوة الأولى" },
  { key: "two", illustration: <div>مشهد ٢</div>, caption: "الخطوة الثانية", canGoNext: false },
  { key: "three", illustration: <div>مشهد ٣</div>, caption: "الخطوة الثالثة" },
];

function renderWizard({ steps: stepsProp, ...rest } = {}) {
  const onClose = vi.fn();
  const utils = render(
    <ChannelConnectWizard
      icon={Wifi} title="تفعيل تجريبي" subtitle="عنوان فرعي" accent="rgb(1,2,3)"
      steps={stepsProp || baseSteps} onClose={onClose} {...rest}
    />
  );
  return { onClose, ...utils };
}

describe("ChannelConnectWizard", () => {
  it("shows the title, subtitle and first step caption", () => {
    renderWizard();
    expect(screen.getByText("تفعيل تجريبي")).toBeInTheDocument();
    expect(screen.getByText("عنوان فرعي")).toBeInTheDocument();
    expect(screen.getByText("الخطوة الأولى")).toBeInTheDocument();
  });

  it("advances to the next step when 'التالي' is clicked", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(screen.getByText("الخطوة الثانية")).toBeInTheDocument();
  });

  it("disables the next button when the current step's canGoNext is false", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(screen.getByRole("button", { name: "التالي" })).toBeDisabled();
  });

  it("goes back to the previous step with 'السابق'", () => {
    const editableSecondStep = { ...baseSteps[1], canGoNext: true };
    renderWizard({ steps: [baseSteps[0], editableSecondStep, baseSteps[2]] });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(screen.getByText("الخطوة الثانية")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "السابق" }));
    expect(screen.getByText("الخطوة الأولى")).toBeInTheDocument();
  });

  it("shows 'تم' on the last step and calls onClose when clicked", () => {
    const editableSecondStep = { ...baseSteps[1], canGoNext: true };
    const { onClose } = renderWizard({ steps: [baseSteps[0], editableSecondStep, baseSteps[2]] });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(screen.getByText("الخطوة الثالثة")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تم" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the close (X) button is clicked", () => {
    const { onClose } = renderWizard();
    fireEvent.click(screen.getByLabelText("إغلاق"));
    expect(onClose).toHaveBeenCalled();
  });

  it("jumps forward automatically when forceIndex increases", () => {
    const { rerender } = renderWizard();
    expect(screen.getByText("الخطوة الأولى")).toBeInTheDocument();
    rerender(<ChannelConnectWizard icon={Wifi} title="تفعيل تجريبي" accent="rgb(1,2,3)" steps={baseSteps} forceIndex={2} onClose={() => {}} />);
    expect(screen.getByText("الخطوة الثالثة")).toBeInTheDocument();
  });
});
