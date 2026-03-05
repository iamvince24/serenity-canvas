import { getCanvasColorPreset } from "@/constants/colors";
import type {
  CanvasNode,
  Edge,
  FileRecord,
  Group,
  ImageNode,
  TextNode,
} from "@/types/canvas";
import { extractAssetIdsFromMarkdown } from "../editor/markdownCodec";
import { getEdgeRoute } from "../edges/edgeUtils";
import { HANDLE_BAR_HEIGHT } from "../core/constants";
import {
  canvasFileName,
  imageFileName,
  isDefaultCaption,
} from "./exportFilenaming";
import type {
  ObsidianCanvas,
  ObsidianCanvasColor,
  ObsidianEdge,
  ObsidianEdgeEnd,
  ObsidianNode,
} from "./obsidianExport.types";

const GROUP_PADDING = 20;

/**
 * Serenity 文字卡片：28px 把手 + 16px×2 內距 + 2px 邊框 = 62px 裝飾區域。
 * 內容高度 = height − 62。
 *
 * Obsidian 文字節點以「閱讀模式」渲染 markdown：
 *  - ~20px×2 內距 ≈ 40px 裝飾區域
 *  - 較大的行高（~1.5–1.6 vs 我們的 ~1.4）
 *  - 段落 <p> 的 margin 增加額外的垂直空間（每段間距約 0.75em）
 * 綜合影響需要 ~1.3× 的內容高度縮放。
 */
const SERENITY_CHROME = HANDLE_BAR_HEIGHT + 16 * 2 + 2; // 62px
const OBSIDIAN_CHROME = 40;
const LINE_HEIGHT_SCALE = 1.3;

function compensateTextNodeHeight(height: number): number {
  const contentHeight = Math.max(0, height - SERENITY_CHROME);
  return Math.round(contentHeight * LINE_HEIGHT_SCALE + OBSIDIAN_CHROME);
}

class ObsidianIdMapper {
  private idMap = new Map<string, string>();
  private usedIds = new Set<string>();
  private counter = 0;

  /**
   * 將內部 ID 轉換為 Obsidian 相容的 16 字元十六進位字串。
   * 移除 UUID 中的連字號，截斷/補齊至 16 字元。
   */
  map(internalId: string): string {
    const existing = this.idMap.get(internalId);
    if (existing) return existing;

    // 移除非十六進位字元，取前 16 個字元
    const hex = internalId.replace(/[^a-f0-9]/gi, "").toLowerCase();
    let candidate = hex.slice(0, 16).padEnd(16, "0");

    // 以計數器後綴去重
    while (this.usedIds.has(candidate)) {
      this.counter++;
      const suffix = this.counter.toString(16);
      const baseLen = 16 - suffix.length;
      candidate = hex.slice(0, baseLen).padEnd(baseLen, "0") + suffix;
    }

    this.idMap.set(internalId, candidate);
    this.usedIds.add(candidate);
    return candidate;
  }
}

export type BuilderInput = {
  nodes: Record<string, CanvasNode>;
  nodeOrder: string[];
  edges: Record<string, Edge>;
  groups: Record<string, Group>;
  files: Record<string, FileRecord>;
};

export type BuilderOutput = {
  canvasJson: ObsidianCanvas;
  assetFileNames: Map<string, string>;
  /** ZIP 內部與資產路徑使用的資料夾名稱前綴。 */
  folderName: string;
  canvasName: string;
};

/**
 * 將 markdown 中的 `![alt](asset:id)` 參照改寫為 `![[folder/assets/filename]]` Obsidian 語法。
 */
/**
 * Obsidian canvas 文字節點將每個 `\n` 視為可見換行。
 * 我們的 markdown 使用 `\n\n` 作為段落分隔，在 Obsidian 中會顯示為多餘空行。
 * 壓縮為單一 `\n` 以匹配原始的視覺間距。
 */
function collapseParaBreaks(markdown: string): string {
  return markdown.replace(/\n\n/g, "\n");
}

function rewriteAssetRefs(
  markdown: string,
  assetToFileName: Map<string, string>,
  folderName: string,
): string {
  return markdown.replace(
    /!\[([^\]]*)\]\(asset:([a-f0-9]+)\)/g,
    (_match, _alt: string, assetId: string) => {
      const fileName = assetToFileName.get(assetId);
      if (!fileName) return _match;
      return `![[${folderName}/assets/${fileName}]]`;
    },
  );
}

function toObsidianColor(
  color: CanvasNode["color"],
): ObsidianCanvasColor | undefined {
  const preset = getCanvasColorPreset(color);
  return preset ? (preset.obsidianValue as ObsidianCanvasColor) : undefined;
}

function computeGroupBoundingBox(
  group: Group,
  nodes: Record<string, CanvasNode>,
): { x: number; y: number; width: number; height: number } | null {
  const memberNodes = group.nodeIds
    .map((id) => nodes[id])
    .filter((n): n is CanvasNode => n != null);

  if (memberNodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of memberNodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  return {
    x: Math.round(minX - GROUP_PADDING),
    y: Math.round(minY - GROUP_PADDING),
    width: Math.round(maxX - minX + GROUP_PADDING * 2),
    height: Math.round(maxY - minY + GROUP_PADDING * 2),
  };
}

function mapEdgeEnds(direction: Edge["direction"]): {
  fromEnd: ObsidianEdgeEnd;
  toEnd: ObsidianEdgeEnd;
} {
  switch (direction) {
    case "none":
      return { fromEnd: "none", toEnd: "none" };
    case "forward":
      return { fromEnd: "none", toEnd: "arrow" };
    case "both":
      return { fromEnd: "arrow", toEnd: "arrow" };
  }
}

export function buildObsidianExport(
  input: BuilderInput,
  boardTitle: string,
  assetMimeTypes: Map<string, string>,
  logLines: string[],
): BuilderOutput {
  const { nodes, nodeOrder, edges, groups } = input;

  const canvasName = canvasFileName(boardTitle);
  // 資料夾名稱 = canvas 檔名去掉副檔名
  const folderName = canvasName.replace(/\.canvas$/, "");

  const assetToFileName = new Map<string, string>();

  // ID 對應：內部 UUID → 16 字元十六進位，以相容 Obsidian
  const idMapper = new ObsidianIdMapper();
  const mapId = (id: string) => idMapper.map(id);

  // --- 第 1 步：收集所有資產 ID 並分配檔名 ---
  const allAssetIds = new Set<string>();

  for (const nodeId of nodeOrder) {
    const node = nodes[nodeId];
    if (!node) continue;

    if (node.type === "text") {
      const assetIds = extractAssetIdsFromMarkdown(node.contentMarkdown);
      for (const id of assetIds) allAssetIds.add(id);
    } else if (node.type === "image") {
      allAssetIds.add(node.asset_id);
      const captionAssetIds = extractAssetIdsFromMarkdown(node.content);
      for (const id of captionAssetIds) allAssetIds.add(id);
    }
  }

  for (const assetId of allAssetIds) {
    const mimeType = assetMimeTypes.get(assetId) ?? "image/webp";
    assetToFileName.set(assetId, imageFileName(assetId, mimeType));
  }

  // --- 第 2 步：建立 nodes[] ---
  const obsidianNodes: ObsidianNode[] = [];

  // 群組優先
  for (const group of Object.values(groups)) {
    const bbox = computeGroupBoundingBox(group, nodes);
    if (!bbox) {
      logLines.push(`Skipped empty group "${group.label || group.id}"`);
      continue;
    }

    const groupNode: ObsidianNode = {
      id: mapId(group.id),
      type: "group",
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      ...(group.label ? { label: group.label } : {}),
      ...({ color: toObsidianColor(group.color) } as Record<string, unknown>),
    };
    if (!groupNode.color) delete groupNode.color;
    obsidianNodes.push(groupNode);
  }

  // 接著依 nodeOrder 處理一般節點
  for (const nodeId of nodeOrder) {
    const node = nodes[nodeId];
    if (!node) continue;

    const color = toObsidianColor(node.color);
    const base = {
      id: mapId(node.id),
      x: Math.round(node.x),
      y: Math.round(node.y),
      width: Math.round(node.width),
      height: Math.round(node.height),
      ...(color ? { color } : {}),
    };

    if (node.type === "text") {
      // TextNode → 內嵌 "text" 類型（自包含，無外部 .md 檔案）
      const rewritten = collapseParaBreaks(
        rewriteAssetRefs(
          (node as TextNode).contentMarkdown,
          assetToFileName,
          folderName,
        ),
      );
      obsidianNodes.push({
        ...base,
        height: compensateTextNodeHeight(node.height),
        type: "text",
        text: rewritten,
      });
    } else if (node.type === "image") {
      const imgNode = node as ImageNode;
      const fileName = assetToFileName.get(imgNode.asset_id);

      if (!fileName) {
        logLines.push(`Missing asset for image node ${nodeId}`);
        continue;
      }

      const assetPath = `${folderName}/assets/${fileName}`;

      if (isDefaultCaption(imgNode.content)) {
        // 無說明文字的 ImageNode → 指向資產的 file 節點
        obsidianNodes.push({ ...base, type: "file", file: assetPath });
      } else {
        // 有說明文字的 ImageNode → 內嵌文字搭配嵌入圖片
        const rewrittenCaption = collapseParaBreaks(
          rewriteAssetRefs(imgNode.content, assetToFileName, folderName),
        );
        const text = `![[${assetPath}]]\n${rewrittenCaption}`;
        obsidianNodes.push({ ...base, type: "text", text });
      }
    }
  }

  // --- 第 3 步：建立 edges[] ---
  const obsidianEdges: ObsidianEdge[] = [];

  for (const edge of Object.values(edges)) {
    const route = getEdgeRoute(edge, nodes);
    if (!route) {
      logLines.push(`Skipped edge ${edge.id}: missing source or target node`);
      continue;
    }

    const { fromEnd, toEnd } = mapEdgeEnds(edge.direction);
    const color = toObsidianColor(edge.color);
    const label = edge.label?.trim();

    const obsidianEdge: ObsidianEdge = {
      id: mapId(edge.id),
      fromNode: mapId(edge.fromNode),
      fromSide: route.fromAnchor,
      toNode: mapId(edge.toNode),
      toSide: route.toAnchor,
      fromEnd,
      toEnd,
      ...(color ? { color } : {}),
      ...(label ? { label } : {}),
    };

    obsidianEdges.push(obsidianEdge);
  }

  return {
    canvasJson: { nodes: obsidianNodes, edges: obsidianEdges },
    assetFileNames: assetToFileName,
    folderName,
    canvasName,
  };
}
