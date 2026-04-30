import { useCallback, useEffect, useRef, useState } from "react";
import { useTour } from "./useTour";
import { TourTooltip } from "./TourTooltip";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function useTargetRect(selector: string, isActive: boolean): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- subscribing to external DOM rect changes */
  useEffect(() => {
    if (!isActive) {
      setRect(null);
      return;
    }

    const el = document.querySelector(`[data-tour="${selector}"]`);
    if (!el) {
      setRect(null);
      return;
    }

    const update = () => {
      const r = el.getBoundingClientRect();
      setRect((prev) => {
        if (
          prev &&
          prev.top === r.top &&
          prev.left === r.left &&
          prev.width === r.width &&
          prev.height === r.height
        ) {
          return prev;
        }
        return { top: r.top, left: r.left, width: r.width, height: r.height };
      });
    };

    update();

    observerRef.current = new ResizeObserver(update);
    observerRef.current.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      observerRef.current?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [selector, isActive]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return rect;
}

const TOOLTIP_GAP = 12;

function computeTooltipStyle(
  placement: string,
  targetRect: TargetRect | null,
  isMobile: boolean,
): React.CSSProperties {
  // Center placement — no target spotlight
  if (placement === "center" || !targetRect) {
    return {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  const effectivePlacement = isMobile ? "top" : placement;

  switch (effectivePlacement) {
    case "right":
      return {
        position: "fixed",
        top: targetRect.top + targetRect.height / 2,
        left: targetRect.left + targetRect.width + TOOLTIP_GAP,
        transform: "translateY(-50%)",
      };
    case "top":
      return {
        position: "fixed",
        top: targetRect.top - TOOLTIP_GAP,
        left: isMobile ? "50%" : targetRect.left + targetRect.width / 2,
        transform: "translate(-50%, -100%)",
      };
    case "bottom":
      return {
        position: "fixed",
        top: targetRect.top + targetRect.height + TOOLTIP_GAP,
        left: targetRect.left + targetRect.width / 2,
        transform: "translateX(-50%)",
      };
    case "left":
      return {
        position: "fixed",
        top: targetRect.top + targetRect.height / 2,
        left: targetRect.left - TOOLTIP_GAP,
        transform: "translate(-100%, -50%)",
      };
    default:
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
  }
}

const SPOTLIGHT_PADDING = 8;

export function TourOverlay() {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    next,
    prev,
    skip,
  } = useTour();

  const targetRect = useTargetRect(currentStep?.target ?? "", isActive);

  const isMobile = useMediaQuery("(max-width: 768px)");

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if clicking the overlay itself, not the tooltip
      if (e.target === e.currentTarget) {
        skip();
      }
    },
    [skip],
  );

  if (!isActive || !currentStep) return null;

  const isCanvasStep = currentStep.placement === "center";
  const hasSpotlight = !isCanvasStep && targetRect;

  const effectivePlacement = isMobile
    ? currentStep.mobilePlacement
    : currentStep.placement;

  const tooltipStyle = computeTooltipStyle(
    effectivePlacement,
    targetRect,
    isMobile,
  );

  return (
    <div
      className="fixed inset-0 z-[3100]"
      onClick={handleOverlayClick}
      role="presentation"
    >
      {/* Overlay background */}
      {hasSpotlight ? (
        <div
          className="absolute rounded-lg"
          style={{
            top: targetRect.top - SPOTLIGHT_PADDING,
            left: targetRect.left - SPOTLIGHT_PADDING,
            width: targetRect.width + SPOTLIGHT_PADDING * 2,
            height: targetRect.height + SPOTLIGHT_PADDING * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/50" />
      )}

      {/* Tooltip */}
      <TourTooltip
        step={currentStep}
        currentIndex={currentStepIndex}
        totalSteps={totalSteps}
        onNext={next}
        onPrev={prev}
        onSkip={skip}
        style={tooltipStyle}
      />
    </div>
  );
}
