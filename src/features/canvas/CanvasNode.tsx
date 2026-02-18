import type { KonvaEventObject } from "konva/lib/Node";
import { Group, Rect } from "react-konva";
import { InteractionEvent, InteractionState } from "./stateMachine";
import { useCanvasStore } from "../../stores/canvasStore";
import type { TextNode } from "../../types/canvas";

type CanvasNodeProps = {
  // Serialized node data from store.
  node: TextNode;
};

export function CanvasNode({ node }: CanvasNodeProps) {
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const updateNodePosition = useCanvasStore(
    (state) => state.updateNodePosition,
  );
  const selectNode = useCanvasStore((state) => state.selectNode);
  const startEditing = useCanvasStore((state) => state.startEditing);
  const dispatch = useCanvasStore((state) => state.dispatch);
  const interactionState = useCanvasStore((state) => state.interactionState);

  const isSelected = selectedNodeIds.includes(node.id);
  const isCanvasEditing = interactionState === InteractionState.Editing;

  // Forward pointer/drag lifecycle events to the state machine.
  const handlePointerDown = (
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    if (isCanvasEditing) {
      return;
    }

    if (event.evt instanceof MouseEvent && event.evt.detail >= 2) {
      event.cancelBubble = true;
      selectNode(node.id);
      startEditing(node.id);
      return;
    }

    selectNode(node.id);
    dispatch(InteractionEvent.NODE_POINTER_DOWN);
  };

  const handlePointerUp = () => {
    if (isCanvasEditing) {
      return;
    }
    dispatch(InteractionEvent.NODE_POINTER_UP);
  };

  const handleDragStart = () => {
    if (isCanvasEditing) {
      return;
    }
    selectNode(node.id);
    dispatch(InteractionEvent.NODE_DRAG_START);
  };

  const handleDragEnd = (event: KonvaEventObject<DragEvent>) => {
    if (isCanvasEditing) {
      return;
    }
    // Persist final position so it remains stable after rerender.
    updateNodePosition(node.id, event.target.x(), event.target.y());
    dispatch(InteractionEvent.NODE_DRAG_END);
  };

  const handleDragMove = (event: KonvaEventObject<DragEvent>) => {
    if (isCanvasEditing) {
      return;
    }

    // Keep DOM preview text locked to the node while dragging.
    updateNodePosition(node.id, event.target.x(), event.target.y());
  };

  const handleDoubleClick = (
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    event.cancelBubble = true;
    selectNode(node.id);
    startEditing(node.id);
  };

  return (
    <Group
      x={node.x}
      y={node.y}
      draggable={!isCanvasEditing}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      onMouseUp={handlePointerUp}
      onTouchEnd={handlePointerUp}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDblClick={handleDoubleClick}
      onDblTap={handleDoubleClick}
    >
      {/* Card shell */}
      <Rect
        width={node.width}
        height={node.height}
        cornerRadius={10}
        fill={node.color}
        stroke={isSelected ? "#8B9D83" : "#E5E3DF"}
        strokeWidth={isSelected ? 2 : 1}
      />
    </Group>
  );
}
