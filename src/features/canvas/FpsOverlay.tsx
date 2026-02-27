import { useEffect, useState } from "react";

type FpsOverlayProps = {
  visible: boolean;
};

export function FpsOverlay({ visible }: FpsOverlayProps) {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let lastTime = performance.now();
    let frames = 0;
    let rafId: number;

    const measureFps = () => {
      frames++;
      const now = performance.now();
      if (now >= lastTime + 1000) {
        setFps(Math.round((frames * 1000) / (now - lastTime)));
        frames = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(measureFps);
    };

    rafId = requestAnimationFrame(measureFps);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed left-4 top-4 z-50 rounded px-2 py-1 font-mono text-xs font-medium text-foreground/90 bg-elevated/80 backdrop-blur-sm border border-border"
      aria-live="polite"
      aria-label={`FPS: ${fps}`}
    >
      {fps} FPS
    </div>
  );
}
