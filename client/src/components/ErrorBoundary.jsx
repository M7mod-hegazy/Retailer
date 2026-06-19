import React from "react";
import { reportClientDiag } from "../services/diag";

// How many times a single boundary may catch before we treat the page as stuck
// in a re-throw loop (cached bad state that throws again on every remount). Past
// this, the fallback escalates from "try again" to a full app reload.
const LOOP_THRESHOLD = 3;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState((s) => ({ errorInfo, errorCount: s.errorCount + 1 }));
    // Surface React crashes into the same diagnostic trail as server disconnects.
    reportClientDiag({
      type: "react-error",
      message: error?.message || String(error),
      stack: error?.stack || null,
      componentStack: errorInfo?.componentStack || null,
    });
  }

  resetErrorBoundary = () => {
    // Clears the boundary's own state. The fallback should pair this with clearing
    // the data layer (e.g. queryClient.clear()) so a cached error doesn't re-throw.
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.FallbackComponent;
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            resetErrorBoundary={this.resetErrorBoundary}
            // Tell the fallback when the page keeps re-throwing, so it can offer a
            // hard reload instead of a "try again" that just re-shows the error.
            isLooping={this.state.errorCount >= LOOP_THRESHOLD}
          />
        );
      }
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
