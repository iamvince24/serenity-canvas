import type { ViewportState } from "../../types/canvas";
import type { CanvasStore } from "../storeTypes";

type SetState = (partial: Partial<CanvasStore>) => void;

const initialViewport: ViewportState = {
  x: 0,
  y: 0,
  zoom: 1,
};

export type ViewportSlice = {
  viewport: ViewportState;
  setViewport: (viewport: ViewportState) => void;
};

export function createViewportSlice(set: SetState): ViewportSlice {
  return {
    viewport: initialViewport,
    setViewport: (viewport) => {
      set({ viewport });
    },
  };
}
