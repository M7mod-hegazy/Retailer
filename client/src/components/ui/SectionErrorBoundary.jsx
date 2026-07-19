import React from "react";
import { AlertTriangle } from "lucide-react";

export default class SectionErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-normal bg-bg-overlay/50 p-6 text-center">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <p className="text-xs font-bold text-text-muted">حدث خطأ في هذا القسم</p>
          <button onClick={() => this.setState({ hasError: false })} className="text-xs font-bold text-blue-500 hover:underline">إعادة المحاولة</button>
        </div>
      );
    }
    return this.props.children;
  }
}
