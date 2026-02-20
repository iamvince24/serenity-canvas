import type { CanvasNodeColor } from "../constants/colors";

export type EdgeDirection = "none" | "forward" | "both";
export type EdgeLineStyle = "solid" | "dashed" | "dotted";

export type Edge = {
  id: string;
  fromNode: string;
  toNode: string;
  direction: EdgeDirection;
  label: string;
  lineStyle: EdgeLineStyle;
  color: CanvasNodeColor;
};
