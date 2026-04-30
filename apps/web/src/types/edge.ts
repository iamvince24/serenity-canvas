import type { CanvasNodeColor } from "../constants/colors";

export type EdgeDirection = "none" | "forward" | "both";
export type EdgeLineStyle = "solid" | "dashed" | "dotted";
export type NodeAnchor = "top" | "right" | "bottom" | "left";

export type Edge = {
  id: string;
  fromNode: string;
  toNode: string;
  fromAnchor: NodeAnchor;
  toAnchor: NodeAnchor;
  direction: EdgeDirection;
  label: string;
  lineStyle: EdgeLineStyle;
  color: CanvasNodeColor;
  // Last-write-wins timestamp (unix ms).
  updatedAt?: number;
};
