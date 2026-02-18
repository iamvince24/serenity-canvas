// Viewport state for transforming the Konva Stage.
// x/y control pan offset in screen space, zoom controls scale factor.
export type ViewportState = {
  x: number;
  y: number;
  zoom: number;
};

// Single text card model rendered on the canvas.
export type TextNode = {
  id: string;
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  heightMode: "auto" | "fixed";
  content_markdown: string;
  color: string;
};

// Root canvas data shape kept in Zustand.
export type CanvasState = {
  viewport: ViewportState;
  nodes: Record<string, TextNode>;
  selectedNodeIds: string[];
};
