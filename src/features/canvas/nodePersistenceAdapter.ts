import { normalizeNodeColor } from "../../constants/colors";
import type {
  CanvasNode,
  FileRecord,
  ImageNode,
  TextNode,
} from "../../types/canvas";

export type PersistenceTextNode = Omit<TextNode, "contentMarkdown"> & {
  content_markdown: string;
};

export type PersistenceImageNode = ImageNode;

export type PersistenceCanvasNode = PersistenceTextNode | PersistenceImageNode;

export type PersistenceFileRecord = FileRecord;

export type LegacyMigrationResult = {
  node: CanvasNode;
  extractedFile?: FileRecord;
};

type LegacyImageNode = ImageNode & {
  mime_type: string;
  original_width: number;
  original_height: number;
  byte_size: number;
  storage_path?: string;
  runtimeImageUrl?: string;
};

function isLegacyImageNode(
  node: PersistenceImageNode | LegacyImageNode,
): node is LegacyImageNode {
  return (
    "mime_type" in node &&
    "original_width" in node &&
    "original_height" in node &&
    "byte_size" in node
  );
}

export function fromPersistenceNode(node: PersistenceCanvasNode): CanvasNode {
  if (node.type !== "text") {
    return {
      ...node,
      color: normalizeNodeColor(node.color),
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
    return node;
  }

  const { contentMarkdown, ...rest } = node;
  return {
    ...rest,
    content_markdown: contentMarkdown,
  };
}

export function toPersistenceFiles(
  files: Record<string, FileRecord>,
): Record<string, PersistenceFileRecord> {
  return Object.fromEntries(
    Object.entries(files).map(([id, file]) => [id, { ...file }]),
  );
}

export function fromPersistenceFiles(
  files: Record<string, PersistenceFileRecord>,
): Record<string, FileRecord> {
  return Object.fromEntries(
    Object.entries(files).map(([id, file]) => [id, { ...file }]),
  );
}

// Support loading old snapshots that still use content_markdown internally.
export function migrateLegacyNode(
  node: CanvasNode | PersistenceCanvasNode | LegacyImageNode,
): LegacyMigrationResult {
  if (node.type !== "text") {
    if (isLegacyImageNode(node)) {
      const {
        mime_type,
        original_width,
        original_height,
        byte_size,
        storage_path: storagePath,
        runtimeImageUrl,
        ...rest
      } = node;
      void storagePath;
      void runtimeImageUrl;

      return {
        node: {
          ...rest,
          color: normalizeNodeColor(rest.color),
        },
        extractedFile: {
          id: rest.asset_id,
          mime_type,
          original_width,
          original_height,
          byte_size,
          created_at: Date.now(),
        },
      };
    }

    return {
      node: {
        ...node,
        color: normalizeNodeColor(node.color),
      },
    };
  }

  if ("contentMarkdown" in node) {
    return {
      node: {
        ...node,
        color: normalizeNodeColor(node.color),
      },
    };
  }

  return {
    node: fromPersistenceNode(node),
  };
}
