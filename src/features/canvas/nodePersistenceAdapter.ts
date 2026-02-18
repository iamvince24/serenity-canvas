import type { CanvasNode, ImageNode, TextNode } from "../../types/canvas";

export type PersistenceTextNode = Omit<TextNode, "contentMarkdown"> & {
  content_markdown: string;
};

export type PersistenceImageNode = ImageNode;

export type PersistenceCanvasNode = PersistenceTextNode | PersistenceImageNode;

export function fromPersistenceNode(node: PersistenceCanvasNode): CanvasNode {
  if (node.type !== "text") {
    return node;
  }

  const { content_markdown, ...rest } = node;
  return {
    ...rest,
    contentMarkdown: content_markdown,
  };
}

export function toPersistenceNode(node: CanvasNode): PersistenceCanvasNode {
  if (node.type !== "text") {
    return node;
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
    return node;
  }

  if ("contentMarkdown" in node) {
    return node;
  }

  return fromPersistenceNode(node);
}
