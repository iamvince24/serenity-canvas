import { getColorPresetByObsidianValue } from "@/constants/colors";
import type { CanvasNodeColor } from "@/constants/colors";
import type {
  CanvasNode,
  Edge,
  Group,
  ImageNode,
  TextNode,
} from "@/types/canvas";
import type { EdgeDirection, NodeAnchor } from "@/types/edge";
import type {
  ObsidianCanvas,
  ObsidianCanvasSide,
  ObsidianEdgeEnd,
  ObsidianFileNode,
  ObsidianGroupNode,
  ObsidianTextNode,
} from "../export/obsidianExport.types";

/**
 * Reverse of the export height compensation.
 * Export: round((h - 34) * 1.3 + 40)
 * Import: round((h - 40) / 1.3 + 34)
 */
const SERENITY_CHROME = 34;
const OBSIDIAN_CHROME = 40;
const LINE_HEIGHT_SCALE = 1.3;

function reverseTextNodeHeight(obsidianHeight: number): number {
  const contentHeight = Math.max(0, obsidianHeight - OBSIDIAN_CHROME);
  return Math.round(contentHeight / LINE_HEIGHT_SCALE + SERENITY_CHROME);
}

/**
 * Reverse of collapseParaBreaks: expand `\n` → `\n\n` for paragraph separation.
 * Be careful not to expand `\n` inside code blocks or list items.
 * Simple approach: expand all single `\n` that are not already doubled.
 */
function expandParaBreaks(text: string): string {
  // Replace single newlines with double newlines, but not those already doubled.
  // First normalize any existing \n\n to a placeholder, expand \n → \n\n, restore.
  return text.replace(/\n/g, "\n\n").replace(/\n{4,}/g, "\n\n");
}

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg",
]);

function isImagePath(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

function newUUID(): string {
  return crypto.randomUUID();
}

function mapObsidianColor(color: string | undefined): CanvasNodeColor {
  if (!color) return null;
  const preset = getColorPresetByObsidianValue(color);
  return preset ? preset.id : null;
}

function mapEdgeDirection(
  fromEnd: ObsidianEdgeEnd | undefined,
  toEnd: ObsidianEdgeEnd | undefined,
): EdgeDirection {
  const hasFrom = fromEnd === "arrow";
  const hasTo = toEnd === "arrow";
  if (hasFrom && hasTo) return "both";
  if (hasTo) return "forward";
  if (hasFrom) return "both"; // fromEnd=arrow, toEnd=none → treat as both
  return "none";
}

function mapAnchor(side: ObsidianCanvasSide): NodeAnchor {
  // ObsidianCanvasSide and NodeAnchor share the same value domain
  return side as NodeAnchor;
}

/**
 * Rewrite Obsidian embed syntax `![[path]]` → `![](asset:xxx)` using the asset path map.
 */
function rewriteObsidianEmbeds(
  text: string,
  assetPathMap: Map<string, string>,
): string {
  return text.replace(/!\[\[([^\]]+)\]\]/g, (_match, path: string) => {
    const assetId = assetPathMap.get(path);
    if (assetId) {
      return `![](asset:${assetId})`;
    }
    // If no asset found, leave as plain text
    return `![${path}]()`;
  });
}

export type ParsedImportData = {
  nodes: CanvasNode[];
  edges: Edge[];
  groups: Group[];
  /** Mapping from obsidian file node path → needed for image extraction. */
  imageFilePaths: string[];
};

export type AssetPathMap = Map<string, string>;

export function parseObsidianCanvas(
  canvas: ObsidianCanvas,
  assetPathMap: AssetPathMap,
  imageNodeDataMap: Map<
    string,
    { assetId: string; width: number; height: number }
  >,
  logLines: string[],
): ParsedImportData {
  const idMap = new Map<string, string>();

  function mapId(oldId: string): string {
    const existing = idMap.get(oldId);
    if (existing) return existing;
    const newId = newUUID();
    idMap.set(oldId, newId);
    return newId;
  }

  const nodes: CanvasNode[] = [];
  const edges: Edge[] = [];
  const groups: Group[] = [];
  const imageFilePaths: string[] = [];

  // Separate nodes by type for processing
  const textNodes: ObsidianTextNode[] = [];
  const fileNodes: ObsidianFileNode[] = [];
  const groupNodes: ObsidianGroupNode[] = [];

  for (const node of canvas.nodes) {
    switch (node.type) {
      case "text":
        textNodes.push(node);
        break;
      case "file":
        fileNodes.push(node);
        break;
      case "group":
        groupNodes.push(node);
        break;
    }
  }

  // Process text nodes
  for (const obsNode of textNodes) {
    const id = mapId(obsNode.id);
    const color = mapObsidianColor(obsNode.color);
    const height = reverseTextNodeHeight(obsNode.height);

    // Rewrite obsidian embeds and expand paragraph breaks
    let content = rewriteObsidianEmbeds(obsNode.text, assetPathMap);
    content = expandParaBreaks(content);

    const textNode: TextNode = {
      id,
      type: "text",
      x: Math.round(obsNode.x),
      y: Math.round(obsNode.y),
      width: Math.round(obsNode.width),
      height,
      heightMode: "fixed",
      contentMarkdown: content,
      color,
      updatedAt: Date.now(),
    };
    nodes.push(textNode);
  }

  // Process file nodes
  for (const obsNode of fileNodes) {
    const id = mapId(obsNode.id);
    const color = mapObsidianColor(obsNode.color);

    if (isImagePath(obsNode.file)) {
      imageFilePaths.push(obsNode.file);

      const imageData = imageNodeDataMap.get(obsNode.file);
      if (imageData) {
        const imageNode: ImageNode = {
          id,
          type: "image",
          x: Math.round(obsNode.x),
          y: Math.round(obsNode.y),
          width: Math.round(obsNode.width),
          height: Math.round(obsNode.height),
          heightMode: "fixed",
          color,
          content: "新增說明文字…",
          asset_id: imageData.assetId,
          updatedAt: Date.now(),
        };
        nodes.push(imageNode);
      } else {
        // Image not found in ZIP, fallback to text node
        logLines.push(
          `Image not found: ${obsNode.file}, converted to text node`,
        );
        const textNode: TextNode = {
          id,
          type: "text",
          x: Math.round(obsNode.x),
          y: Math.round(obsNode.y),
          width: Math.round(obsNode.width),
          height: reverseTextNodeHeight(obsNode.height),
          heightMode: "fixed",
          contentMarkdown: `📎 ${obsNode.file}`,
          color,
          updatedAt: Date.now(),
        };
        nodes.push(textNode);
      }
    } else {
      // Non-image file node → TextNode placeholder
      logLines.push(
        `Non-image file node: ${obsNode.file}, converted to text node`,
      );
      const textNode: TextNode = {
        id,
        type: "text",
        x: Math.round(obsNode.x),
        y: Math.round(obsNode.y),
        width: Math.round(obsNode.width),
        height: reverseTextNodeHeight(obsNode.height),
        heightMode: "fixed",
        contentMarkdown: `📎 ${obsNode.file}`,
        color,
        updatedAt: Date.now(),
      };
      nodes.push(textNode);
    }
  }

  // Process groups: determine membership by checking which node centers fall within group bbox
  for (const obsGroup of groupNodes) {
    const groupId = mapId(obsGroup.id);
    const color = mapObsidianColor(obsGroup.color);

    const gx = obsGroup.x;
    const gy = obsGroup.y;
    const gw = obsGroup.width;
    const gh = obsGroup.height;

    // Find all non-group obsidian nodes whose center is within this group's bbox
    const memberNodeIds: string[] = [];
    for (const obsNode of canvas.nodes) {
      if (obsNode.type === "group") continue;
      const cx = obsNode.x + obsNode.width / 2;
      const cy = obsNode.y + obsNode.height / 2;
      if (cx >= gx && cx <= gx + gw && cy >= gy && cy <= gy + gh) {
        memberNodeIds.push(mapId(obsNode.id));
      }
    }

    if (memberNodeIds.length === 0) {
      logLines.push(`Empty group "${obsGroup.label ?? obsGroup.id}", skipped`);
      continue;
    }

    groups.push({
      id: groupId,
      label: obsGroup.label ?? "",
      color,
      nodeIds: memberNodeIds,
    });
  }

  // Process edges
  for (const obsEdge of canvas.edges) {
    const fromNode = idMap.get(obsEdge.fromNode);
    const toNode = idMap.get(obsEdge.toNode);

    if (!fromNode || !toNode) {
      logLines.push(
        `Edge ${obsEdge.id}: missing source or target node, skipped`,
      );
      continue;
    }

    const direction = mapEdgeDirection(obsEdge.fromEnd, obsEdge.toEnd);
    const color = mapObsidianColor(obsEdge.color);

    const edge: Edge = {
      id: newUUID(),
      fromNode,
      toNode,
      fromAnchor: mapAnchor(obsEdge.fromSide),
      toAnchor: mapAnchor(obsEdge.toSide),
      direction,
      label: obsEdge.label ?? "",
      lineStyle: "solid",
      color,
      updatedAt: Date.now(),
    };
    edges.push(edge);
  }

  return { nodes, edges, groups, imageFilePaths };
}

/**
 * Collect image file paths referenced by file nodes in the canvas.
 */
export function collectImagePaths(canvas: ObsidianCanvas): string[] {
  const paths: string[] = [];
  for (const node of canvas.nodes) {
    if (node.type === "file" && isImagePath(node.file)) {
      paths.push(node.file);
    }
  }
  // Also collect embed references from text nodes: ![[path]]
  for (const node of canvas.nodes) {
    if (node.type === "text") {
      const embedMatches = node.text.matchAll(/!\[\[([^\]]+)\]\]/g);
      for (const match of embedMatches) {
        if (isImagePath(match[1])) {
          paths.push(match[1]);
        }
      }
    }
  }
  return [...new Set(paths)];
}
