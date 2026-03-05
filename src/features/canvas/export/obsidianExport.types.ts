/** Obsidian `.canvas` JSON 格式型別與匯出輔助工具。 */

export type ObsidianCanvasColor = "1" | "2" | "3" | "4" | "5" | "6";

export type ObsidianTextNode = {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: ObsidianCanvasColor;
};

export type ObsidianFileNode = {
  id: string;
  type: "file";
  file: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: ObsidianCanvasColor;
};

export type ObsidianGroupNode = {
  id: string;
  type: "group";
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: ObsidianCanvasColor;
};

export type ObsidianNode =
  | ObsidianTextNode
  | ObsidianFileNode
  | ObsidianGroupNode;

export type ObsidianEdgeEnd = "none" | "arrow";

export type ObsidianCanvasSide = "top" | "right" | "bottom" | "left";

export type ObsidianEdge = {
  id: string;
  fromNode: string;
  fromSide: ObsidianCanvasSide;
  toNode: string;
  toSide: ObsidianCanvasSide;
  fromEnd?: ObsidianEdgeEnd;
  toEnd?: ObsidianEdgeEnd;
  color?: ObsidianCanvasColor;
  label?: string;
};

export type ObsidianCanvas = {
  nodes: ObsidianNode[];
  edges: ObsidianEdge[];
};

export type ExportStage =
  | "preparing"
  | "collecting_assets"
  | "building_zip"
  | "done";

export type ExportProgress = {
  stage: ExportStage;
  percent: number;
};

export type ExportResult = {
  blob: Blob;
  fileName: string;
  logLines: string[];
};
