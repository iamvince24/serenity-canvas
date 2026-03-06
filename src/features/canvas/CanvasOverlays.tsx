import type {
  EdgeContextMenuSlot,
  EdgeLabelEditorSlot,
  OverlaySlot,
} from "./core/overlaySlot";
import { EdgeContextMenu } from "./edges/EdgeContextMenu";
import { EdgeLabelEditor } from "./edges/EdgeLabelEditor";
import { GroupContextMenu } from "./nodes/GroupContextMenu";
import { NodeContextMenu } from "./nodes/NodeContextMenu";

type NodeContextMenuState = Extract<OverlaySlot, { type: "nodeContextMenu" }>;
type GroupContextMenuState = Extract<OverlaySlot, { type: "groupContextMenu" }>;

type CanvasOverlaysProps = {
  nodeContextMenuState: NodeContextMenuState | null;
  groupContextMenuState: GroupContextMenuState | null;
  edgeContextMenuState: EdgeContextMenuSlot | null;
  edgeLabelEditorState: EdgeLabelEditorSlot | null;
  labelEditorContainerRect: DOMRect | null;
  onCloseNodeContextMenu: () => void;
  onCloseEdgeContextMenu: () => void;
  onEdgeLabelDraftChange: (value: string) => void;
  onCloseEdgeLabelEditor: () => void;
};

export function CanvasOverlays({
  nodeContextMenuState,
  groupContextMenuState,
  edgeContextMenuState,
  edgeLabelEditorState,
  labelEditorContainerRect,
  onCloseNodeContextMenu,
  onCloseEdgeContextMenu,
  onEdgeLabelDraftChange,
  onCloseEdgeLabelEditor,
}: CanvasOverlaysProps) {
  return (
    <>
      {nodeContextMenuState ? (
        <NodeContextMenu
          clientX={nodeContextMenuState.clientX}
          clientY={nodeContextMenuState.clientY}
          nodeId={nodeContextMenuState.nodeId}
          nodeType={nodeContextMenuState.nodeType}
          onClose={onCloseNodeContextMenu}
        />
      ) : null}

      {groupContextMenuState ? (
        <GroupContextMenu
          groupId={groupContextMenuState.groupId}
          clientX={groupContextMenuState.clientX}
          clientY={groupContextMenuState.clientY}
          onClose={onCloseNodeContextMenu}
        />
      ) : null}

      {edgeContextMenuState ? (
        <EdgeContextMenu
          edgeId={edgeContextMenuState.edgeId}
          clientX={edgeContextMenuState.clientX}
          clientY={edgeContextMenuState.clientY}
          onClose={onCloseEdgeContextMenu}
        />
      ) : null}

      {edgeLabelEditorState && labelEditorContainerRect ? (
        <EdgeLabelEditor
          key={edgeLabelEditorState.edgeId}
          edgeId={edgeLabelEditorState.edgeId}
          canvasX={edgeLabelEditorState.canvasX}
          canvasY={edgeLabelEditorState.canvasY}
          containerRect={labelEditorContainerRect}
          onDraftChange={onEdgeLabelDraftChange}
          onClose={onCloseEdgeLabelEditor}
        />
      ) : null}
    </>
  );
}
