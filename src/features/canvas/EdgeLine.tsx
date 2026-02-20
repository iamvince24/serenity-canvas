import { useState } from "react";
import { Arrow, Circle, Line } from "react-konva";
import { getEdgeStrokeColor } from "../../constants/colors";
import type { CanvasNode, Edge, EdgeLineStyle } from "../../types/canvas";
import { EdgeLabel } from "./EdgeLabel";
import { getEdgeLabelLayout } from "./edgeLabelLayout";
import { getEdgeRoute, type Point } from "./edgeUtils";

export type EdgeEndpoint = "from" | "to";

type EdgeLineProps = {
  edge: Edge;
  nodes: Record<string, CanvasNode>;
  isSelected: boolean;
  onSelect: (edgeId: string) => void;
  onContextMenu: (edgeId: string, clientX: number, clientY: number) => void;
  onDblClick: (edgeId: string) => void;
  labelOverride?: string | null;
  hideLabel?: boolean;
  forceLabelGap?: boolean;
  showEndpointHandles: boolean;
  endpointPreview: {
    start: Point;
    end: Point;
  } | null;
  onEndpointDragStart: (
    edgeId: string,
    endpoint: EdgeEndpoint,
    clientX: number,
    clientY: number,
  ) => void;
};

const EDGE_HANDLE_STROKE = "#1f77c8";
const EDGE_HANDLE_RADIUS = 5;
const EDGE_HANDLE_RADIUS_ACTIVE = 6.5;
const EDGE_LABEL_GAP_PADDING = 6;
const DEFAULT_CANVAS_BACKGROUND = "#FAFAF8";
const EMPTY_LABEL_GAP_WIDTH = 80;
const EMPTY_LABEL_GAP_HEIGHT = 20;

function getCanvasBackgroundColor(): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return DEFAULT_CANVAS_BACKGROUND;
  }

  const resolved = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue("--canvas")
    .trim();

  return resolved.length > 0 ? resolved : DEFAULT_CANVAS_BACKGROUND;
}

function getLineDash(lineStyle: EdgeLineStyle): number[] | undefined {
  if (lineStyle === "dashed") {
    return [12, 8];
  }

  if (lineStyle === "dotted") {
    return [3, 6];
  }

  return undefined;
}

export function EdgeLine({
  edge,
  nodes,
  isSelected,
  onSelect,
  onContextMenu,
  onDblClick,
  labelOverride,
  hideLabel = false,
  forceLabelGap = false,
  showEndpointHandles,
  endpointPreview,
  onEndpointDragStart,
}: EdgeLineProps) {
  const [hoveredHandle, setHoveredHandle] = useState<EdgeEndpoint | null>(null);
  const route = getEdgeRoute(edge, nodes);
  if (!route) {
    return null;
  }

  const start = endpointPreview?.start ?? route.start;
  const previewEnd = endpointPreview?.end ?? route.end;
  const end =
    start.x === previewEnd.x && start.y === previewEnd.y
      ? { x: previewEnd.x + 0.001, y: previewEnd.y }
      : previewEnd;
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const stroke = getEdgeStrokeColor(edge.color);
  const strokeWidth = isSelected ? 3 : 2;
  const hasArrow = edge.direction !== "none";
  const lineDash = getLineDash(edge.lineStyle);
  const displayLabel = labelOverride ?? edge.label;
  const labelLayout =
    getEdgeLabelLayout(displayLabel) ??
    (forceLabelGap
      ? {
          text: "",
          width: EMPTY_LABEL_GAP_WIDTH,
          height: EMPTY_LABEL_GAP_HEIGHT,
          textWidth: EMPTY_LABEL_GAP_WIDTH,
          textHeight: EMPTY_LABEL_GAP_HEIGHT,
        }
      : null);
  const canvasBackground = getCanvasBackgroundColor();

  const edgeDx = end.x - start.x;
  const edgeDy = end.y - start.y;
  const edgeLength = Math.hypot(edgeDx, edgeDy);
  let gapSegment: { start: Point; end: Point } | null = null;

  if (labelLayout && edgeLength > 1) {
    const ux = edgeDx / edgeLength;
    const uy = edgeDy / edgeLength;
    const projectedHalfLength =
      (Math.abs(ux) * labelLayout.width + Math.abs(uy) * labelLayout.height) /
      2;
    const halfGapLength = Math.min(
      projectedHalfLength + EDGE_LABEL_GAP_PADDING,
      Math.max(edgeLength / 2 - 1, 0),
    );
    if (halfGapLength > 0) {
      gapSegment = {
        start: {
          x: midpoint.x - ux * halfGapLength,
          y: midpoint.y - uy * halfGapLength,
        },
        end: {
          x: midpoint.x + ux * halfGapLength,
          y: midpoint.y + uy * halfGapLength,
        },
      };
    }
  }

  return (
    <>
      <Arrow
        points={[start.x, start.y, end.x, end.y]}
        stroke={stroke}
        fill={stroke}
        strokeWidth={strokeWidth}
        lineCap="round"
        lineJoin="round"
        pointerAtBeginning={edge.direction === "both"}
        pointerAtEnding={hasArrow}
        pointerLength={hasArrow ? 10 : 0}
        pointerWidth={hasArrow ? 10 : 0}
        dash={lineDash}
        hitStrokeWidth={20}
        onMouseDown={(event) => {
          event.cancelBubble = true;
          onSelect(edge.id);
        }}
        onTouchStart={(event) => {
          event.cancelBubble = true;
          onSelect(edge.id);
        }}
        onContextMenu={(event) => {
          event.evt.preventDefault();
          event.cancelBubble = true;
          onContextMenu(edge.id, event.evt.clientX, event.evt.clientY);
        }}
        onDblClick={(event) => {
          event.cancelBubble = true;
          onDblClick(edge.id);
        }}
        onDblTap={(event) => {
          event.cancelBubble = true;
          onDblClick(edge.id);
        }}
      />

      {gapSegment ? (
        <Line
          points={[
            gapSegment.start.x,
            gapSegment.start.y,
            gapSegment.end.x,
            gapSegment.end.y,
          ]}
          stroke={canvasBackground}
          strokeWidth={strokeWidth + 4}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      ) : null}

      {!hideLabel ? (
        <EdgeLabel
          x={midpoint.x}
          y={midpoint.y}
          label={displayLabel}
          edgeColor={edge.color}
          onSelect={() => onSelect(edge.id)}
          onDblClick={() => onDblClick(edge.id)}
          onContextMenu={(clientX, clientY) =>
            onContextMenu(edge.id, clientX, clientY)
          }
        />
      ) : null}

      {showEndpointHandles ? (
        <>
          <Circle
            x={start.x}
            y={start.y}
            radius={
              hoveredHandle === "from"
                ? EDGE_HANDLE_RADIUS_ACTIVE
                : EDGE_HANDLE_RADIUS
            }
            fill="#FFFFFF"
            stroke={EDGE_HANDLE_STROKE}
            strokeWidth={2}
            hitStrokeWidth={20}
            onMouseDown={(event) => {
              event.evt.preventDefault();
              event.cancelBubble = true;
              onSelect(edge.id);
              onEndpointDragStart(
                edge.id,
                "from",
                event.evt.clientX,
                event.evt.clientY,
              );
            }}
            onTouchStart={(event) => {
              event.evt.preventDefault();
              event.cancelBubble = true;
              const touch = event.evt.touches?.[0];
              if (!touch) {
                return;
              }

              onSelect(edge.id);
              onEndpointDragStart(
                edge.id,
                "from",
                touch.clientX,
                touch.clientY,
              );
            }}
            onMouseEnter={() => setHoveredHandle("from")}
            onMouseLeave={() =>
              setHoveredHandle((current) =>
                current === "from" ? null : current,
              )
            }
          />
          <Circle
            x={end.x}
            y={end.y}
            radius={
              hoveredHandle === "to"
                ? EDGE_HANDLE_RADIUS_ACTIVE
                : EDGE_HANDLE_RADIUS
            }
            fill="#FFFFFF"
            stroke={EDGE_HANDLE_STROKE}
            strokeWidth={2}
            hitStrokeWidth={20}
            onMouseDown={(event) => {
              event.evt.preventDefault();
              event.cancelBubble = true;
              onSelect(edge.id);
              onEndpointDragStart(
                edge.id,
                "to",
                event.evt.clientX,
                event.evt.clientY,
              );
            }}
            onTouchStart={(event) => {
              event.evt.preventDefault();
              event.cancelBubble = true;
              const touch = event.evt.touches?.[0];
              if (!touch) {
                return;
              }

              onSelect(edge.id);
              onEndpointDragStart(edge.id, "to", touch.clientX, touch.clientY);
            }}
            onMouseEnter={() => setHoveredHandle("to")}
            onMouseLeave={() =>
              setHoveredHandle((current) => (current === "to" ? null : current))
            }
          />
        </>
      ) : null}
    </>
  );
}
