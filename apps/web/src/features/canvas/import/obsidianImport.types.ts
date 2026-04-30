/** Obsidian Canvas 匯入流程的型別定義。 */

export type ImportStage =
  | "reading_file"
  | "parsing_canvas"
  | "extracting_assets"
  | "building_nodes"
  | "done";

export type ImportProgress = {
  stage: ImportStage;
  percent: number;
};

export type ImportResult = {
  nodeCount: number;
  edgeCount: number;
  groupCount: number;
  imageCount: number;
  logLines: string[];
};
