import { useMemo, useReducer, type ReactNode } from "react";
import { TOUR_STEPS } from "./tourSteps";
import {
  isOnboardingCompleted,
  markOnboardingCompleted,
} from "./tourLocalStorage";
import { TourContext } from "./TourContext";

export interface TourState {
  isActive: boolean;
  currentStepIndex: number;
}

export type TourAction =
  | { type: "START" }
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "SKIP" };

function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case "START":
      return { ...state, isActive: true, currentStepIndex: 0 };
    case "NEXT": {
      const nextIndex = state.currentStepIndex + 1;
      if (nextIndex >= TOUR_STEPS.length) {
        markOnboardingCompleted();
        return { ...state, isActive: false, currentStepIndex: 0 };
      }
      return { ...state, currentStepIndex: nextIndex };
    }
    case "PREV": {
      const prevIndex = Math.max(0, state.currentStepIndex - 1);
      return { ...state, currentStepIndex: prevIndex };
    }
    case "SKIP":
      markOnboardingCompleted();
      return { ...state, isActive: false, currentStepIndex: 0 };
  }
}

const initialState: TourState = {
  isActive: !isOnboardingCompleted(),
  currentStepIndex: 0,
};

export function TourProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tourReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
