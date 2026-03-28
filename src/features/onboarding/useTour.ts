import { useContext, useCallback } from "react";
import { TourContext } from "./TourContext";
import { TOUR_STEPS } from "./tourSteps";

const noop = () => {};

export function useTour() {
  const context = useContext(TourContext);
  const dispatch = context?.dispatch;

  const startTour = useCallback(
    () => dispatch?.({ type: "START" }),
    [dispatch],
  );
  const next = useCallback(() => dispatch?.({ type: "NEXT" }), [dispatch]);
  const prev = useCallback(() => dispatch?.({ type: "PREV" }), [dispatch]);
  const skip = useCallback(() => dispatch?.({ type: "SKIP" }), [dispatch]);

  if (!context) {
    return {
      startTour: noop,
      next: noop,
      prev: noop,
      skip: noop,
      isActive: false,
      currentStep: TOUR_STEPS[0],
      currentStepIndex: 0,
      totalSteps: TOUR_STEPS.length,
    };
  }

  const { state } = context;

  return {
    startTour,
    next,
    prev,
    skip,
    isActive: state.isActive,
    currentStep: TOUR_STEPS[state.currentStepIndex],
    currentStepIndex: state.currentStepIndex,
    totalSteps: TOUR_STEPS.length,
  };
}
