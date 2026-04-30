import type { CanvasNodeColor } from "../constants/colors";

export type NodeHeightMode = "auto" | "fixed" | "fit";

export type BaseNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  heightMode: NodeHeightMode;
  color: CanvasNodeColor;
  updatedAt?: number;
};

export type TextNode = BaseNode & {
  type: "text";
  contentMarkdown: string;
};

export type ImageNode = BaseNode & {
  type: "image";
  content: string;
  asset_id: string;
};

export type FileRecord = {
  id: string;
  asset_id: string;
  mime_type: string;
  original_width: number;
  original_height: number;
  byte_size: number;
  image_path?: string | null;
  created_at: number;
  updatedAt?: number;
};

export type CanvasNode = TextNode | ImageNode;

export function isTextNode(node: CanvasNode): node is TextNode {
  return node.type === "text";
}

export function isImageNode(node: CanvasNode): node is ImageNode {
  return node.type === "image";
}
