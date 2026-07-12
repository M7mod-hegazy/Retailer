import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { render, screen, fireEvent } from "@testing-library/react";
import { useSmsWizardSteps } from "../smsSteps";

const mockConnect = vi.hoisted(() => ({
  sms: { sms_enabled: false, sms_api_url: "", sms_api_key: "", sms_sender: "" },
  setSms: vi.fn(),
  testPhone: "",
  setTestPhone: vi.fn(),
  save: vi.fn(),
  sendTest: vi.fn(),
  saving: false,
  testing: false,
  saved: false,
}));
const mockUseSmsConnect = vi.hoisted(() => vi.fn(() => mockConnect));
vi.mock("../../../../hooks/useSmsConnect", () => ({ useSmsConnect: mockUseSmsConnect }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k) => k }) }));

describe("useSmsWizardSteps", () => {
  beforeEach(() => {
    mockConnect.sms = { sms_enabled: false, sms_api_url: "", sms_api_key: "", sms_sender: "" };
    mockConnect.saved = false;
    mockConnect.setSms.mockReset();
    mockConnect.save.mockReset();
    mockUseSmsConnect.mockReturnValue(mockConnect);
  });

  it("has 4 steps in order", () => {
    const { result } = renderHook(() => useSmsWizardSteps());
    expect(result.current.steps.map((s) => s.key)).toEqual(["concept", "credentials", "enable-test", "success"]);
  });

  it("blocks the credentials step until an API URL is entered", () => {
    const { result, rerender } = renderHook(() => useSmsWizardSteps());
    expect(result.current.steps[1].canGoNext).toBe(false);
    mockConnect.sms = { ...mockConnect.sms, sms_api_url: "https://provider.test" };
    rerender();
    expect(result.current.steps[1].canGoNext).toBe(true);
  });

  it("blocks the enable-test step until saved is true", () => {
    const { result, rerender } = renderHook(() => useSmsWizardSteps());
    expect(result.current.steps[2].canGoNext).toBe(false);
    mockConnect.saved = true;
    rerender();
    expect(result.current.steps[2].canGoNext).toBe(true);
  });

  it("enable-test's button enables sms and saves the fresh value in one call", () => {
    mockConnect.sms = { sms_enabled: false, sms_api_url: "https://provider.test", sms_api_key: "", sms_sender: "" };
    const { result } = renderHook(() => useSmsWizardSteps());
    render(result.current.steps[2].content);
    fireEvent.click(screen.getByText("wizard.sms.step3.button"));
    expect(mockConnect.setSms).toHaveBeenCalledWith({ ...mockConnect.sms, sms_enabled: true });
    expect(mockConnect.save).toHaveBeenCalledWith({ ...mockConnect.sms, sms_enabled: true });
  });
});
