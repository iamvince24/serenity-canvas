import type { FileRecord, ImageNode, TextNode } from "../../../types/canvas";
import {
  DEFAULT_NODE_COLOR,
  DEFAULT_NODE_CONTENT,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  IMAGE_NODE_CAPTION_HEIGHT,
  MIN_IMAGE_CONTENT_HEIGHT,
  MIN_IMAGE_NODE_WIDTH,
} from "../core/constants";

export function createNodeId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTextNodeCenteredAt(x: number, y: number): TextNode {
  return {
    id: createNodeId(),
    type: "text",
    x: x - DEFAULT_NODE_WIDTH / 2,
    y: y - DEFAULT_NODE_HEIGHT / 2,
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
    heightMode: "auto",
    contentMarkdown: DEFAULT_NODE_CONTENT,
    color: DEFAULT_NODE_COLOR,
  };
}

export type ImageNodeUploadPayload = {
  asset_id: string;
};

function getInitialImageNodeWidth(originalWidth: number): number {
  const MIN_WIDTH = 240;
  const MAX_WIDTH = 420;

  if (Number.isNaN(originalWidth) || originalWidth <= 0) {
    return 320;
  }

  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, originalWidth));
}

export function getImageNodeHeightForWidth(
  width: number,
  originalWidth: number,
  originalHeight: number,
): number {
  const safeWidth = Math.max(MIN_IMAGE_NODE_WIDTH, width);
  const safeOriginalWidth = Math.max(1, originalWidth);
  const safeOriginalHeight = Math.max(1, originalHeight);
  const imageHeight = Math.max(
    MIN_IMAGE_CONTENT_HEIGHT,
    Math.round((safeWidth * safeOriginalHeight) / safeOriginalWidth),
  );

  return IMAGE_NODE_CAPTION_HEIGHT + imageHeight;
}

export function createImageNodeCenteredAt(
  x: number,
  y: number,
  payload: ImageNodeUploadPayload,
  file: FileRecord,
): ImageNode {
  const initialWidth = getInitialImageNodeWidth(file.original_width);
  const initialHeight = getImageNodeHeightForWidth(
    initialWidth,
    file.original_width,
    file.original_height,
  );

  return {
    id: createNodeId(),
    type: "image",
    x: x - initialWidth / 2,
    y: y - initialHeight / 2,
    width: initialWidth,
    height: initialHeight,
    heightMode: "fixed",
    color: DEFAULT_NODE_COLOR,
    content: "Add a caption...",
    asset_id: payload.asset_id,
  };
}
