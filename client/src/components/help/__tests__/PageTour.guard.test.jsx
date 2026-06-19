/**
 * Regression guard — PageTour must never trap input focus.
 *
 * History: the auto-triggering help tour rendered a full-screen `fixed inset-0` dim layer.
 * In spotlight mode that layer is transparent, but it still captured every click/focus, so
 * once a tour was visible (it auto-triggers on ~40 pages) NO input on the page could be
 * focused. The fix made the transparent dim layer `pointer-events: none`.
 *
 * This test pins that invariant so a future edit cannot silently re-introduce the block:
 *   1. the full-screen dim layer must not capture pointer events while a tour is visible
 *   2. the spotlight cut-out must stay pointer-events:none (visual only)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { useHelpStore } from "../../../stores/helpStore";
import helpContent from "../../../help/helpContent";
import { PageTour } from "../PageTour";

// Pick any real page key that has tour content so the tour can render.
const PAGE_KEY = Object.keys(helpContent)[0];

describe("PageTour focus guard", () => {
  beforeEach(() => {
    useHelpStore.setState({
      isLoaded: true,
      toursDisabledGlobally: false,
      isPickerVisible: false,
      isTourVisible: true,
      activeTourPageKey: PAGE_KEY,
      activeTourStepIndex: 0,
    });
  });

  afterEach(() => {
    cleanup();
    useHelpStore.setState({ isTourVisible: false, activeTourPageKey: null, activeTourStepIndex: 0 });
  });

  it("does not let the full-screen dim layer block page interaction", () => {
    const { container } = render(<PageTour />);

    // The dim layer is the only full-viewport element (fixed + inset-0).
    const dim = container.querySelector(".fixed.inset-0");
    expect(dim, "tour should render a full-screen dim layer when visible").toBeTruthy();

    // It must NOT capture pointer events — otherwise every input underneath is unfocusable.
    expect(dim.style.pointerEvents).toBe("none");
  });

  it("keeps the spotlight cut-out non-interactive", () => {
    const { container } = render(<PageTour />);
    container.querySelectorAll(".fixed").forEach((el) => {
      // Any spotlight ring must stay visual-only.
      if (el.className.includes("rounded-lg")) {
        expect(el.className).toContain("pointer-events-none");
      }
    });
  });

  it("dismisses the tour on Escape as a recovery hatch", () => {
    render(<PageTour />);
    expect(useHelpStore.getState().isTourVisible).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useHelpStore.getState().isTourVisible).toBe(false);
  });
});
