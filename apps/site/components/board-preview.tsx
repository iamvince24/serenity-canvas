import "@/styles/card-prose.css";
import { renderCardMarkdown } from "@/lib/markdown";
import {
  computeEdgePath,
  getLineDash,
  getBezierTangent,
} from "@serenity/shared/edgeUtils";
import {
  getCardColorStyle,
  getEdgeStrokeColor,
  getCardThemeTokens,
} from "@serenity/shared/types";
import { isTextNode, isImageNode } from "@serenity/shared/types";
import type { CanvasNode, Edge, Group } from "@serenity/shared/types";
import type { BoardRow, PublicFileRow } from "@/lib/board";

type Props = {
  board: BoardRow;
  nodes: Record<string, CanvasNode>;
  edges: Record<string, Edge>;
  groups: Record<string, Group>;
  files: PublicFileRow[];
};

const GROUP_PADDING = 24;
const GROUP_LABEL_HEIGHT = 24;
const ARROW_LENGTH = 10;
const ARROW_WIDTH = 10;
const VIEWPORT_PADDING = 60;
const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 800;

function toRgba(color: string, alpha: number): string {
  if (!color.startsWith("#")) return color;
  const normalized = color.slice(1);
  const rgbHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => `${c}${c}`)
          .join("")
      : normalized;
  if (rgbHex.length !== 6) return color;
  const r = Number.parseInt(rgbHex.slice(0, 2), 16);
  const g = Number.parseInt(rgbHex.slice(2, 4), 16);
  const b = Number.parseInt(rgbHex.slice(4, 6), 16);
  if (
    Number.isNaN(r) ||
    Number.isNaN(g) ||
    Number.isNaN(b) ||
    alpha < 0 ||
    alpha > 1
  )
    return color;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function computeBoundingBox(
  nodes: Record<string, CanvasNode>,
  groups: Record<string, Group>,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const nodeList = Object.values(nodes);
  if (nodeList.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodeList) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  for (const group of Object.values(groups)) {
    const memberNodes = group.nodeIds
      .map((id) => nodes[id])
      .filter(Boolean) as CanvasNode[];
    if (memberNodes.length === 0) continue;
    const gLeft = Math.min(...memberNodes.map((n) => n.x)) - GROUP_PADDING;
    const gTop =
      Math.min(...memberNodes.map((n) => n.y)) -
      GROUP_PADDING -
      GROUP_LABEL_HEIGHT;
    const gRight =
      Math.max(...memberNodes.map((n) => n.x + n.width)) + GROUP_PADDING;
    const gBottom =
      Math.max(...memberNodes.map((n) => n.y + n.height)) + GROUP_PADDING;
    minX = Math.min(minX, gLeft);
    minY = Math.min(minY, gTop);
    maxX = Math.max(maxX, gRight);
    maxY = Math.max(maxY, gBottom);
  }

  return { minX, minY, maxX, maxY };
}

function computeViewportTransform(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  containerW: number,
  containerH: number,
) {
  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;
  const scaleX = (containerW - VIEWPORT_PADDING * 2) / contentW;
  const scaleY = (containerH - VIEWPORT_PADDING * 2) / contentH;
  const scale = Math.min(scaleX, scaleY, 1);
  const offsetX = (containerW / scale - contentW) / 2 - bounds.minX;
  const offsetY = (containerH / scale - contentH) / 2 - bounds.minY;
  return { scale, offsetX, offsetY };
}

function getPublicImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-images/${path}`;
}

function computeArrowPoints(
  tip: { x: number; y: number },
  tangent: { x: number; y: number },
): string {
  const len = Math.hypot(tangent.x, tangent.y);
  if (len === 0) return "";
  const ux = tangent.x / len;
  const uy = tangent.y / len;
  const baseX = tip.x - ux * ARROW_LENGTH;
  const baseY = tip.y - uy * ARROW_LENGTH;
  const perpX = -uy * (ARROW_WIDTH / 2);
  const perpY = ux * (ARROW_WIDTH / 2);
  return `${tip.x},${tip.y} ${baseX + perpX},${baseY + perpY} ${baseX - perpX},${baseY - perpY}`;
}

export default function BoardPreview({
  board,
  nodes,
  edges,
  groups,
  files,
}: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const status = board.share_assets_status;

  if (status === "pending") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#fafaf8]">
        <div className="text-center px-6">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#8B9D83] border-t-transparent" />
          <p className="text-lg text-[#1C1C1A]">正在準備分享內容，請稍候</p>
          <p className="mt-2 text-sm text-[#6B6B66]">這通常只需要幾秒鐘</p>
        </div>
      </main>
    );
  }

  const nodeList = Object.values(nodes);
  if (nodeList.length === 0) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#fafaf8]">
        <div className="text-center px-6">
          <h1 className="text-2xl font-semibold text-[#1C1C1A] mb-3">
            {board.title}
          </h1>
          <p className="text-[#6B6B66] mb-6">這張白板目前是空的</p>
          <a
            href={`${appUrl}/canvas/${board.id}`}
            className="inline-block rounded-lg bg-[#8B9D83] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#7A8C73] transition-colors"
          >
            在 Serenity Canvas 中開啟
          </a>
        </div>
      </main>
    );
  }

  const bounds = computeBoundingBox(nodes, groups);
  if (!bounds) return null;

  const { scale, offsetX, offsetY } = computeViewportTransform(
    bounds,
    REFERENCE_WIDTH,
    REFERENCE_HEIGHT,
  );

  const edgeList = Object.values(edges);
  const groupList = Object.values(groups);
  const fileMap = new Map(files.map((f) => [f.asset_id, f]));

  return (
    <main className="relative w-full h-dvh overflow-hidden bg-[#fafaf8]">
      {status === "partial" && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-[#FDF9F4] border-b border-[#E5D3C5] px-4 py-2 text-center text-sm text-[#7A685A]">
          部分圖片尚未就緒，稍後重新整理即可查看
        </div>
      )}
      {status === "failed" && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-[#FDF8F7] border-b border-[#E5CACA] px-4 py-2 text-center text-sm text-[#7A5B5A]">
          分享內容準備失敗，請回到 App 重新發佈
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transformOrigin: "0 0",
          transform: `scale(${scale}) translate(${offsetX}px, ${offsetY}px)`,
        }}
      >
        {groupList.map((group) => {
          const memberNodes = group.nodeIds
            .map((id) => nodes[id])
            .filter(Boolean) as CanvasNode[];
          if (memberNodes.length === 0) return null;
          const left = Math.min(...memberNodes.map((n) => n.x)) - GROUP_PADDING;
          const top =
            Math.min(...memberNodes.map((n) => n.y)) -
            GROUP_PADDING -
            GROUP_LABEL_HEIGHT;
          const right =
            Math.max(...memberNodes.map((n) => n.x + n.width)) + GROUP_PADDING;
          const bottom =
            Math.max(...memberNodes.map((n) => n.y + n.height)) + GROUP_PADDING;
          const colorStyle = getCardColorStyle(group.color);
          const themeTokens = getCardThemeTokens(group.color);
          const strokeColor = group.color ? colorStyle.border : "#8B9D83";
          const fillColor = group.color
            ? toRgba(colorStyle.background, 0.36)
            : "rgba(139, 157, 131, 0.14)";
          return (
            <div
              key={group.id}
              style={{
                position: "absolute",
                left,
                top,
                width: right - left,
                height: bottom - top,
                border: `1px dashed ${strokeColor}`,
                borderRadius: 14,
                background: fillColor,
                boxSizing: "border-box",
              }}
            >
              {group.label && (
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 10,
                    background: toRgba(strokeColor, 0.16),
                    borderRadius: 8,
                    padding: "4px 8px",
                    fontSize: 13,
                    color: themeTokens.accent,
                    whiteSpace: "nowrap",
                  }}
                >
                  {group.label}
                </div>
              )}
            </div>
          );
        })}

        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          {edgeList.map((edge) => {
            const { d, labelPos, route } = computeEdgePath(edge, nodes);
            if (!d || !route) return null;
            const strokeColor = getEdgeStrokeColor(edge.color);
            const dashArray = getLineDash(edge.lineStyle);
            const showForwardArrow =
              edge.direction === "forward" || edge.direction === "both";
            const showBackArrow = edge.direction === "both";
            return (
              <g key={edge.id}>
                <path
                  d={d}
                  stroke={strokeColor}
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray={
                    dashArray.length > 0 ? dashArray.join(" ") : undefined
                  }
                />
                {showForwardArrow &&
                  (() => {
                    const tangent = getBezierTangent(
                      1,
                      route.start,
                      route.cp1,
                      route.cp2,
                      route.end,
                    );
                    const points = computeArrowPoints(route.end, tangent);
                    return points ? (
                      <polygon points={points} fill={strokeColor} />
                    ) : null;
                  })()}
                {showBackArrow &&
                  (() => {
                    const tangent = getBezierTangent(
                      0,
                      route.start,
                      route.cp1,
                      route.cp2,
                      route.end,
                    );
                    const points = computeArrowPoints(route.start, {
                      x: -tangent.x,
                      y: -tangent.y,
                    });
                    return points ? (
                      <polygon points={points} fill={strokeColor} />
                    ) : null;
                  })()}
                {edge.label && labelPos && (
                  <foreignObject
                    x={labelPos.x - 75}
                    y={labelPos.y - 12}
                    width={150}
                    height={30}
                    style={{ overflow: "visible" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          background: "#fafaf8",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 12,
                          color: strokeColor,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {edge.label}
                      </span>
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>

        {nodeList.map((node) => {
          const colorStyle = getCardColorStyle(node.color);
          if (isTextNode(node)) {
            return (
              <div
                key={node.id}
                style={{
                  position: "absolute",
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                  background: colorStyle.background,
                  border: `1.5px solid ${colorStyle.border}`,
                  borderRadius: 10,
                  boxSizing: "border-box",
                  overflow: "hidden",
                  padding: "12px 14px",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <div
                  className="card-prose"
                  dangerouslySetInnerHTML={{
                    __html: renderCardMarkdown(node.contentMarkdown),
                  }}
                />
              </div>
            );
          }

          if (isImageNode(node)) {
            const file = fileMap.get(node.asset_id);
            const showImage =
              file && (status === "ready" || status === "partial");
            return (
              <div
                key={node.id}
                style={{
                  position: "absolute",
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                  background: colorStyle.background,
                  border: `1.5px solid ${colorStyle.border}`,
                  borderRadius: 10,
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                {showImage ? (
                  <img
                    src={getPublicImageUrl(file.public_image_path)}
                    alt={node.content || "Image"}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#f0f0ee",
                      color: "#6B6B66",
                      fontSize: 13,
                    }}
                  >
                    圖片處理中
                  </div>
                )}
              </div>
            );
          }

          return null;
        })}
      </div>
    </main>
  );
}
