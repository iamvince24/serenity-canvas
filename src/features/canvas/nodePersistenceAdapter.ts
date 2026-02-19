import { normalizeNodeColor } from "../../constants/colors";
import type { CanvasNode, ImageNode, TextNode } from "../../types/canvas";

export type PersistenceTextNode = Omit<TextNode, "contentMarkdown"> & {
  content_markdown: string;
};

export type PersistenceImageNode = Omit<ImageNode, "runtimeImageUrl">;

export type PersistenceCanvasNode = PersistenceTextNode | PersistenceImageNode;

export function fromPersistenceNode(node: PersistenceCanvasNode): CanvasNode {
  if (node.type !== "text") {
    return {
      ...node,
      color: normalizeNodeColor(node.color),
      runtimeImageUrl: undefined,
    };
  }

  const { content_markdown, ...rest } = node;
  return {
    ...rest,
    contentMarkdown: content_markdown,
    color: normalizeNodeColor(node.color),
  };
}

export function toPersistenceNode(node: CanvasNode): PersistenceCanvasNode {
  if (node.type !== "text") {
    const persistenceImageNode = { ...node } as ImageNode & {
      runtimeImageUrl?: string;
    };
    delete persistenceImageNode.runtimeImageUrl;
    return persistenceImageNode;
  }

  const { contentMarkdown, ...rest } = node;
  return {
    ...rest,
    content_markdown: contentMarkdown,
  };
}

// Support loading old snapshots that still use content_markdown internally.
export function migrateLegacyNode(
  node: CanvasNode | PersistenceCanvasNode,
): CanvasNode {
  if (node.type !== "text") {
    const runtimeImageUrl =
      "runtimeImageUrl" in node ? node.runtimeImageUrl : undefined;
    return {
      ...node,
      color: normalizeNodeColor(node.color),
      runtimeImageUrl,
    };
  }

  if ("contentMarkdown" in node) {
    return {
      ...node,
      color: normalizeNodeColor(node.color),
    };
  }

  return fromPersistenceNode(node);
}
