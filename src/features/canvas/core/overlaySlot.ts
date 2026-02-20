import type { ContextMenuNodeType } from "../nodes/NodeContextMenu";
import type { EdgeEndpoint } from "../edges/EdgeLine";
import type { AnchorCandidate, Point } from "../edges/edgeUtils";

export type OverlaySlot =
  | { type: "idle" }
  | {
      type: "nodeContextMenu";
      nodeId: string;
      nodeType: ContextMenuNodeType;
      clientX: number;
      clientY: number;
    }
  | {
      type: "edgeContextMenu";
      edgeId: string;
      clientX: number;
      clientY: number;
    }
  | {
      type: "edgeLabelEditor";
      edgeId: string;
      canvasX: number;
      canvasY: number;
    }
  | {
      type: "edgeEndpointDrag";
      edgeId: string;
      endpoint: EdgeEndpoint;
      pointer: Point;
      hoveredAnchor: AnchorCandidate | null;
    };

export type NodeContextMenuSlot = Extract<
  OverlaySlot,
  { type: "nodeContextMenu" }
>;

export type EdgeContextMenuSlot = Extract<
  OverlaySlot,
  { type: "edgeContextMenu" }
>;

export type EdgeLabelEditorSlot = Extract<
  OverlaySlot,
  { type: "edgeLabelEditor" }
>;
