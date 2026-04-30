export * from "./node";
export * from "./edge";
export * from "./viewport";
export * from "./group";
export type { Board } from "./board";

export type CanvasMode = "select" | "connect";

// Root canvas data shape kept in Zustand.
export type CanvasState = {
  viewport: import("./viewport").ViewportState;
  nodes: Record<string, import("./node").CanvasNode>;
  nodeOrder: string[];
  files: Record<string, import("./node").FileRecord>;
  edges: Record<string, import("./edge").Edge>;
  groups: Record<string, import("./group").Group>;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedGroupIds: string[];
};
