import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTelegramWizardSteps } from "../telegramSteps";

const mockConnect = vi.hoisted(() => ({
  config: { telegram_bot_token: "", telegram_chat_id: "" },
  setConfig: vi.fn(),
  qrData: null,
  generatingQr: false,
  scanConnected: false,
  generateDeepLink: vi.fn(),
  save: vi.fn(),
  saving: false,
}));
const mockUseTelegramConnect = vi.hoisted(() => vi.fn(() => mockConnect));
vi.mock("../../../../hooks/useTelegramConnect", () => ({ useTelegramConnect: mockUseTelegramConnect }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k) => k }) }));

describe("useTelegramWizardSteps", () => {
  beforeEach(() => {
    mockConnect.config = { telegram_bot_token: "", telegram_chat_id: "" };
    mockConnect.qrData = null;
    mockConnect.scanConnected = false;
    mockConnect.save.mockReset();
    mockUseTelegramConnect.mockReturnValue(mockConnect);
  });

  it("has 5 steps in order", () => {
    const { result } = renderHook(() => useTelegramWizardSteps());
    expect(result.current.steps.map((s) => s.key)).toEqual(["find-botfather", "create-bot", "paste-token", "scan-start", "success"]);
  });

  it("blocks the token step until a token is entered", () => {
    const { result, rerender } = renderHook(() => useTelegramWizardSteps());
    expect(result.current.steps[2].canGoNext).toBe(false);
    mockConnect.config = { ...mockConnect.config, telegram_bot_token: "tok" };
    rerender();
    expect(result.current.steps[2].canGoNext).toBe(true);
  });

  it("blocks the scan step until scanConnected is true", () => {
    const { result, rerender } = renderHook(() => useTelegramWizardSteps());
    expect(result.current.steps[3].canGoNext).toBe(false);
    mockConnect.scanConnected = true;
    rerender();
    expect(result.current.steps[3].canGoNext).toBe(true);
  });

  it("forces the success step once scanConnected is true", () => {
    mockConnect.scanConnected = true;
    const { result } = renderHook(() => useTelegramWizardSteps());
    expect(result.current.forceIndex).toBe(4);
  });

  it("calls save exactly once when scanConnected flips to true", () => {
    const { rerender } = renderHook(() => useTelegramWizardSteps());
    expect(mockConnect.save).not.toHaveBeenCalled();
    mockConnect.scanConnected = true;
    rerender();
    expect(mockConnect.save).toHaveBeenCalledTimes(1);
  });
});
