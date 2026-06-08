import { useEffect, useState, useRef } from "react";
import { usePerformanceStore } from "../../stores/performanceStore";

export default function FpsOverlay() {
  const fpsEnabled = usePerformanceStore((s) => s.settings.fpsCounter);
  const targetFps = usePerformanceStore((s) => s.settings.targetFps);
  const [fps, setFps] = useState(0);
  const frameRef = useRef();
  const timesRef = useRef([]);

  useEffect(() => {
    if (!fpsEnabled) return;

    const tick = () => {
      const now = performance.now();
      const times = timesRef.current;
      times.push(now);
      while (times.length > 0 && times[0] <= now - 1000) {
        times.shift();
      }
      setFps(times.length);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [fpsEnabled]);

  if (!fpsEnabled) return null;

  return (
    <div className="perf-fps-overlay fixed top-2 left-2 z-[9999] bg-black/75 text-white text-xs font-mono px-2.5 py-1.5 rounded-lg flex items-center gap-2 shadow-lg border border-white/10 pointer-events-none select-none" dir="ltr">
      <span className={fps >= 30 ? "text-emerald-400" : fps >= 15 ? "text-amber-400" : "text-red-400"}>
        {fps} FPS
      </span>
      {targetFps > 0 && (
        <span className="text-slate-500">| target: {targetFps}</span>
      )}
    </div>
  );
}
