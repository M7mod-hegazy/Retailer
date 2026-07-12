import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWhatsappWizardSteps } from "../whatsappSteps";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k) => k }) }));

function baseArgs(overrides = {}) {
  return { engine: { status: "disconnected" }, linking: false, connectError: null, onLink: vi.fn(), onClearAndRetry: vi.fn(), ...overrides };
}

describe("useWhatsappWizardSteps", () => {
  it("has 3 steps: intro, scan, success", () => {
    const { result } = renderHook(() => useWhatsappWizardSteps(baseArgs()));
    expect(result.current.steps.map((s) => s.key)).toEqual(["intro", "scan", "success"]);
  });

  it("blocks leaving the intro step until the engine reaches qr or connected", () => {
    const { result, rerender } = renderHook(
      ({ status }) => useWhatsappWizardSteps(baseArgs({ engine: { status } })),
      { initialProps: { status: "disconnected" } },
    );
    expect(result.current.steps[0].canGoNext).toBe(false);
    rerender({ status: "qr" });
    expect(result.current.steps[0].canGoNext).toBe(true);
  });

  it("blocks leaving the scan step until connected", () => {
    const { result } = renderHook(() => useWhatsappWizardSteps(baseArgs({ engine: { status: "qr", qr: "data:x" } })));
    expect(result.current.steps[1].canGoNext).toBe(false);
  });

  it("forces the success step once connected", () => {
    const { result } = renderHook(() => useWhatsappWizardSteps(baseArgs({ engine: { status: "connected", phone: "201000000000" } })));
    expect(result.current.forceIndex).toBe(2);
  });

  it("leaves forceIndex undefined before connecting", () => {
    const { result } = renderHook(() => useWhatsappWizardSteps(baseArgs({ engine: { status: "qr" } })));
    expect(result.current.forceIndex).toBeUndefined();
  });
});
