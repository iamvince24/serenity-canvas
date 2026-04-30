import { memo, useState } from "react";
import { Circle, Group, Shape } from "react-konva";
import { getEdgeStrokeColor } from "../../../constants/colors";
import type { CanvasNode, Edge } from "../../../types/canvas";
import { EDGE_CURVATURE } from "../core/constants";
import { EdgeLabel } from "./EdgeLabel";
import { getEdgeLabelLayout } from "./edgeLabelLayout";
import {
  calculateBezierControlPoints,
  getBezierPoint,
  getBezierTangent,
  getEdgeRoute,
  getLabelGapTRange,
  getLineDash,
  splitBezier,
  type Point,
} from "./edgeUtils";

export type EdgeEndpoint = "from" | "to";

type EdgeLineProps = {
  edge: Edge;
  nodes: Record<string, CanvasNode>;
  isSelected: boolean;
  isPending?: boolean;
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
const EMPTY_LABEL_GAP_WIDTH = 80;
const EMPTY_LABEL_GAP_HEIGHT = 20;
const ARROW_LENGTH = 10;
const ARROW_WIDTH = 10;

type ArrowDrawContext = {
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  closePath: () => void;
  fill: () => void;
  fillStyle: string | CanvasGradient | CanvasPattern;
};

function drawArrowhead(
  ctx: ArrowDrawContext,
  tip: Point,
  angle: number,
  fillColor: string,
): void {
  const halfWidth = ARROW_WIDTH / 2;
  const ax =
    tip.x - ARROW_LENGTH * Math.cos(angle) + halfWidth * Math.sin(angle);
  const ay =
    tip.y - ARROW_LENGTH * Math.sin(angle) - halfWidth * Math.cos(angle);
  const bx =
    tip.x - ARROW_LENGTH * Math.cos(angle) - halfWidth * Math.sin(angle);
  const by =
    tip.y - ARROW_LENGTH * Math.sin(angle) + halfWidth * Math.cos(angle);

  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
}

function EdgeLineComponent({
  edge,
  nodes,
  isSelected,
  isPending = false,
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
  const hasEndpointPreview = Boolean(endpointPreview);
  const isDraggingFromEndpoint = endpointPreview
    ? endpointPreview.start.x !== route.start.x ||
      endpointPreview.start.y !== route.start.y
    : false;
  const nextControlPoints = hasEndpointPreview
    ? calculateBezierControlPoints(
        route.fromAnchor,
        start,
        route.toAnchor,
        end,
        EDGE_CURVATURE,
      )
    : null;
  const cp1 = hasEndpointPreview
    ? isDraggingFromEndpoint
      ? start
      : nextControlPoints!.cp1
    : route.cp1;
  const cp2 = hasEndpointPreview
    ? isDraggingFromEndpoint
      ? nextControlPoints!.cp2
      : end
    : route.cp2;
  const midpoint = hasEndpointPreview
    ? getBezierPoint(0.5, start, cp1, cp2, end)
    : route.midpoint;
  const stroke = isPending ? "#A3B29B" : getEdgeStrokeColor(edge.color);
  const strokeWidth = isSelected ? 3 : 2;
  const edgeOpacity = isPending ? 0.6 : 1;
  const hasStartArrow = edge.direction === "both";
  const hasEndArrow = edge.direction === "forward" || edge.direction === "both";
  const lineDash = getLineDash(edge.lineStyle);
  const lineDashResolved = isPending ? [8, 4] : lineDash;
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
  const labelGap = labelLayout
    ? getLabelGapTRange({ start, cp1, cp2, end }, labelLayout)
    : null;

  return (
    <Group listening={!isPending} opacity={edgeOpacity}>
      <Shape
        stroke={stroke}
        fill={stroke}
        strokeWidth={strokeWidth}
        hitStrokeWidth={20}
        sceneFunc={(ctx, shape) => {
          const strokeColor = String(shape.getAttr("stroke") ?? stroke);
          const lineWidth = Number(shape.getAttr("strokeWidth") ?? strokeWidth);
          const fillColor = String(shape.getAttr("fill") ?? strokeColor);

          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.setLineDash(lineDashResolved);

          if (labelGap) {
            const [firstHalf] = splitBezier(
              labelGap.tStart,
              start,
              cp1,
              cp2,
              end,
            );
            const [, secondHalf] = splitBezier(
              labelGap.tEnd,
              start,
              cp1,
              cp2,
              end,
            );

            ctx.beginPath();
            ctx.moveTo(firstHalf.p0.x, firstHalf.p0.y);
            ctx.bezierCurveTo(
              firstHalf.cp1.x,
              firstHalf.cp1.y,
              firstHalf.cp2.x,
              firstHalf.cp2.y,
              firstHalf.p3.x,
              firstHalf.p3.y,
            );
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(secondHalf.p0.x, secondHalf.p0.y);
            ctx.bezierCurveTo(
              secondHalf.cp1.x,
              secondHalf.cp1.y,
              secondHalf.cp2.x,
              secondHalf.cp2.y,
              secondHalf.p3.x,
              secondHalf.p3.y,
            );
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
            ctx.stroke();
          }

          ctx.setLineDash([]);

          if (hasEndArrow) {
            const tangent = getBezierTangent(1, start, cp1, cp2, end);
            const angle = Math.atan2(tangent.y, tangent.x);
            drawArrowhead(ctx, end, angle, fillColor);
          }

          if (hasStartArrow) {
            const tangent = getBezierTangent(0, start, cp1, cp2, end);
            const angle = Math.atan2(-tangent.y, -tangent.x);
            drawArrowhead(ctx, start, angle, fillColor);
          }
        }}
        hitFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
          ctx.strokeShape(shape);
        }}
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
    </Group>
  );
}

function areEdgeLinePropsEqual(
  previous: Readonly<EdgeLineProps>,
  next: Readonly<EdgeLineProps>,
): boolean {
  if (previous.edge !== next.edge) {
    return false;
  }
  if (previous.isSelected !== next.isSelected) {
    return false;
  }
  if (previous.onSelect !== next.onSelect) {
    return false;
  }
  if (previous.onContextMenu !== next.onContextMenu) {
    return false;
  }
  if (previous.onDblClick !== next.onDblClick) {
    return false;
  }
  if (previous.labelOverride !== next.labelOverride) {
    return false;
  }
  if (previous.hideLabel !== next.hideLabel) {
    return false;
  }
  if (previous.forceLabelGap !== next.forceLabelGap) {
    return false;
  }
  if (previous.showEndpointHandles !== next.showEndpointHandles) {
    return false;
  }
  if (previous.endpointPreview !== next.endpointPreview) {
    return false;
  }
  if (previous.onEndpointDragStart !== next.onEndpointDragStart) {
    return false;
  }
  if (previous.isPending !== next.isPending) {
    return false;
  }

  const previousFromNode = previous.nodes[previous.edge.fromNode];
  const nextFromNode = next.nodes[next.edge.fromNode];
  if (previousFromNode !== nextFromNode) {
    return false;
  }

  const previousToNode = previous.nodes[previous.edge.toNode];
  const nextToNode = next.nodes[next.edge.toNode];
  if (previousToNode !== nextToNode) {
    return false;
  }

  return true;
}

export const EdgeLine = memo(EdgeLineComponent, areEdgeLinePropsEqual);
EdgeLine.displayName = "EdgeLine";
