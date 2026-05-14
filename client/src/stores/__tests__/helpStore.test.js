import { describe, it, expect, vi, beforeEach } from "vitest";
import { useHelpStore } from "../helpStore";

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../../services/api", () => ({ default: mockApi }));

describe("helpStore", () => {
  beforeEach(() => {
    useHelpStore.setState({
      touredPages: {},
      toursDisabledGlobally: false,
      tooltipsDisabledGlobally: false,
      isLoaded: false,
      activeTourPageKey: null,
      activeTourStepIndex: 0,
      isTourVisible: false,
      activeTooltipKey: null,
    });
    vi.clearAllMocks();
  });

  it("starts with default state", () => {
    const state = useHelpStore.getState();
    expect(state.isLoaded).toBe(false);
    expect(state.isTourVisible).toBe(false);
    expect(state.touredPages).toEqual({});
  });

  describe("loadHelpState", () => {
    it("sets state from API response", async () => {
      mockApi.get.mockResolvedValue({
        data: { data: { toured_pages: { pos: true }, tours_disabled_globally: false, tooltips_disabled_globally: false } },
      });
      await useHelpStore.getState().loadHelpState();
      const state = useHelpStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.touredPages).toEqual({ pos: true });
    });

    it("handles API failure gracefully", async () => {
      mockApi.get.mockRejectedValue(new Error("fail"));
      await useHelpStore.getState().loadHelpState();
      expect(useHelpStore.getState().isLoaded).toBe(true);
    });
  });

  describe("triggerPageTour", () => {
    it("shows tour for unvisited page", () => {
      useHelpStore.getState().triggerPageTour("pos");
      const state = useHelpStore.getState();
      expect(state.isTourVisible).toBe(true);
      expect(state.activeTourPageKey).toBe("pos");
      expect(state.activeTourStepIndex).toBe(0);
    });

    it("does not show tour if already visited", () => {
      useHelpStore.setState({ touredPages: { pos: true } });
      useHelpStore.getState().triggerPageTour("pos");
      expect(useHelpStore.getState().isTourVisible).toBe(false);
    });

    it("does not show tour if globally disabled", () => {
      useHelpStore.setState({ toursDisabledGlobally: true });
      useHelpStore.getState().triggerPageTour("pos");
      expect(useHelpStore.getState().isTourVisible).toBe(false);
    });
  });

  describe("nextTourStep", () => {
    it("advances step index", () => {
      useHelpStore.setState({ activeTourStepIndex: 0, isTourVisible: true });
      useHelpStore.getState().nextTourStep(3);
      expect(useHelpStore.getState().activeTourStepIndex).toBe(1);
    });

    it("completes tour on last step", () => {
      useHelpStore.setState({ activeTourStepIndex: 2, activeTourPageKey: "pos", isTourVisible: true });
      mockApi.patch.mockResolvedValue({});
      useHelpStore.getState().nextTourStep(3);
      expect(useHelpStore.getState().isTourVisible).toBe(false);
      expect(useHelpStore.getState().touredPages.pos).toBe(true);
    });
  });

  describe("prevTourStep", () => {
    it("goes back one step", () => {
      useHelpStore.setState({ activeTourStepIndex: 2 });
      useHelpStore.getState().prevTourStep();
      expect(useHelpStore.getState().activeTourStepIndex).toBe(1);
    });

    it("does not go below 0", () => {
      useHelpStore.setState({ activeTourStepIndex: 0 });
      useHelpStore.getState().prevTourStep();
      expect(useHelpStore.getState().activeTourStepIndex).toBe(0);
    });
  });

  describe("completeTour", () => {
    it("marks page as toured and hides tour", () => {
      useHelpStore.setState({ activeTourPageKey: "pos", isTourVisible: true });
      mockApi.patch.mockResolvedValue({});
      useHelpStore.getState().completeTour();
      const state = useHelpStore.getState();
      expect(state.isTourVisible).toBe(false);
      expect(state.touredPages.pos).toBe(true);
      expect(state.activeTourPageKey).toBeNull();
      expect(state.activeTourStepIndex).toBe(0);
    });

    it("does nothing if no active tour", () => {
      useHelpStore.getState().completeTour();
      expect(mockApi.patch).not.toHaveBeenCalled();
    });
  });

  describe("disableAllTours", () => {
    it("sets global disable and hides tour", () => {
      mockApi.patch.mockResolvedValue({});
      useHelpStore.getState().disableAllTours();
      expect(useHelpStore.getState().toursDisabledGlobally).toBe(true);
      expect(useHelpStore.getState().isTourVisible).toBe(false);
    });
  });

  describe("disableAllTooltips", () => {
    it("sets global disable and clears active", () => {
      mockApi.patch.mockResolvedValue({});
      useHelpStore.getState().disableAllTooltips();
      expect(useHelpStore.getState().tooltipsDisabledGlobally).toBe(true);
      expect(useHelpStore.getState().activeTooltipKey).toBeNull();
    });
  });

  describe("openTooltip / closeTooltip", () => {
    it("openTooltip sets active key", () => {
      useHelpStore.getState().openTooltip("search");
      expect(useHelpStore.getState().activeTooltipKey).toBe("search");
    });

    it("closeTooltip clears active key", () => {
      useHelpStore.setState({ activeTooltipKey: "search" });
      useHelpStore.getState().closeTooltip();
      expect(useHelpStore.getState().activeTooltipKey).toBeNull();
    });
  });
});
