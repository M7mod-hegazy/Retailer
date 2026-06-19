import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "../ErrorBoundary";

// Silence the expected React error logging from thrown test components.
beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

function Bomb() {
  throw new Error("boom");
}

// Fallback that re-throws on every reset so we can drive the loop counter.
function LoopFallback({ resetErrorBoundary, isLooping }) {
  return (
    <div>
      <span>caught</span>
      {isLooping && <span>looping</span>}
      <button onClick={resetErrorBoundary}>retry</button>
    </div>
  );
}

describe("ErrorBoundary", () => {
  it("renders the fallback when a child throws", () => {
    render(
      <ErrorBoundary FallbackComponent={LoopFallback}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("caught")).toBeInTheDocument();
    expect(screen.queryByText("looping")).not.toBeInTheDocument();
  });

  it("escalates to isLooping after repeated catches", () => {
    render(
      <ErrorBoundary FallbackComponent={LoopFallback}>
        <Bomb />
      </ErrorBoundary>,
    );
    // Each retry re-mounts the child, which throws again and bumps the counter.
    fireEvent.click(screen.getByText("retry")); // 2nd catch
    fireEvent.click(screen.getByText("retry")); // 3rd catch -> threshold
    expect(screen.getByText("looping")).toBeInTheDocument();
  });
});
