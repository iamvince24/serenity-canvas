export * from "./node";
export * from "./edge";
export * from "./viewport";

export type CanvasMode = "select" | "connect";

// Root canvas data shape kept in Zustand.
export type CanvasState = {
  viewport: import("./viewport").ViewportState;
  nodes: Record<string, import("./node").CanvasNode>;
  nodeOrder: string[];
  files: Record<string, import("./node").FileRecord>;
  edges: Record<string, import("./edge").Edge>;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
};
