import type { KonvaEventObject } from "konva/lib/Node";
import { Group, Rect, Text } from "react-konva";
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

  const isSelected = selectedNodeIds.includes(node.id);

  const handleDragEnd = (event: KonvaEventObject<DragEvent>) => {
    // Persist final position so it remains stable after rerender.
    updateNodePosition(node.id, event.target.x(), event.target.y());
  };

  const handleSelect = () => {
    selectNode(node.id);
  };

  return (
    <Group
      x={node.x}
      y={node.y}
      draggable
      onClick={handleSelect}
      onTap={handleSelect}
      onDragStart={handleSelect}
      onDragEnd={handleDragEnd}
    >
      {/* Card shell */}
      <Rect
        width={node.width}
        height={node.height}
        cornerRadius={10}
        fill={node.color}
        stroke={isSelected ? "#5E6E58" : "#E5E3DF"}
        strokeWidth={isSelected ? 2 : 1}
      />
      {/* Card text content */}
      <Text
        x={16}
        y={16}
        width={Math.max(0, node.width - 32)}
        height={Math.max(0, node.height - 32)}
        text={node.content}
        fontFamily="Inter"
        fontSize={16}
        lineHeight={1.4}
        fill="#1C1C1A"
      />
    </Group>
  );
}
