import { createContext } from "react";
import type { TourState, TourAction } from "./TourProvider";

export const TourContext = createContext<{
  state: TourState;
  dispatch: React.Dispatch<TourAction>;
} | null>(null);
