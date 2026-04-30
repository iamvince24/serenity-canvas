import type { Edge, FileRecord, ImageNode, TextNode } from "../types/canvas";
import type { Group } from "../types/group";
import type { ViewportState } from "../types/viewport";

let idCounter = 0;

export function resetIdCounter(): void {
  idCounter = 0;
}

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function createTextNode(
  overrides: Partial<Omit<TextNode, "type">> & { id?: string } = {},
): TextNode {
  const { id = nextId("text"), ...rest } = overrides;
  return {
    id,
    type: "text",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    heightMode: "auto",
    color: null,
    contentMarkdown: "",
    ...rest,
  };
}

export function createImageNode(
  overrides: Partial<Omit<ImageNode, "type">> & { id?: string } = {},
): ImageNode {
  const { id = nextId("image"), ...rest } = overrides;
  return {
    id,
    type: "image",
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    heightMode: "fixed",
    color: null,
    content: "",
    asset_id: rest.asset_id ?? nextId("asset"),
    ...rest,
  };
}

export function createEdge(
  overrides: Partial<Edge> & { id?: string } = {},
): Edge {
  return {
    id: overrides.id ?? nextId("edge"),
    fromNode: overrides.fromNode ?? "from",
    toNode: overrides.toNode ?? "to",
    fromAnchor: "right",
    toAnchor: "left",
    direction: "forward",
    label: "",
    lineStyle: "solid",
    color: null,
    ...overrides,
  };
}

export function createGroup(
  overrides: Partial<Group> & { id?: string } = {},
): Group {
  return {
    id: overrides.id ?? nextId("group"),
    label: "Group",
    color: null,
    nodeIds: [],
    ...overrides,
  };
}

export function createFileRecord(
  overrides: Partial<FileRecord> & { id?: string } = {},
): FileRecord {
  return {
    id: overrides.id ?? nextId("file"),
    asset_id: overrides.asset_id ?? "sha1-test-hash",
    mime_type: "image/webp",
    original_width: 100,
    original_height: 100,
    byte_size: 1024,
    created_at: 0,
    ...overrides,
  };
}

export function createViewport(
  overrides: Partial<ViewportState> = {},
): ViewportState {
  return {
    x: 0,
    y: 0,
    zoom: 1,
    ...overrides,
  };
}
