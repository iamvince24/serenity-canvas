import type { CanvasNodeColor } from "../constants/colors";

export type Group = {
  id: string;
  label: string;
  color: CanvasNodeColor;
  nodeIds: string[];
};
