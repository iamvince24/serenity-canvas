import type { KonvaEventObject } from "konva/lib/Node";
import { memo, useMemo } from "react";
import { Rect, Text } from "react-konva";
import { getCardColorStyle } from "../../../constants/colors";
import { useCanvasStore } from "../../../stores/canvasStore";
import type { CanvasNode, Group as CanvasGroup } from "../../../types/canvas";
import { GROUP_LABEL_HEIGHT, getGroupBounds } from "../core/culling";

type GroupRectProps = {
  group: CanvasGroup;
  nodes: Record<string, CanvasNode>;
  isSelected: boolean;
  onOpenContextMenu: (payload: {
    groupId: string;
    clientX: number;
    clientY: number;
  }) => void;
};

function toRgba(color: string, alpha: number): string {
  if (!color.startsWith("#")) {
    return color;
  }

  const normalized = color.slice(1);
  const rgbHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;
  if (rgbHex.length !== 6) {
    return color;
  }

  const red = Number.parseInt(rgbHex.slice(0, 2), 16);
  const green = Number.parseInt(rgbHex.slice(2, 4), 16);
  const blue = Number.parseInt(rgbHex.slice(4, 6), 16);
  if (
    Number.isNaN(red) ||
    Number.isNaN(green) ||
    Number.isNaN(blue) ||
    alpha < 0 ||
    alpha > 1
  ) {
    return color;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function GroupRectComponent({
  group,
  nodes,
  isSelected,
  onOpenContextMenu,
}: GroupRectProps) {
  const selectGroup = useCanvasStore((state) => state.selectGroup);
  const bounds = useMemo(
    () => getGroupBounds(group.nodeIds, nodes),
    [group.nodeIds, nodes],
  );
  const colorStyle = useMemo(
    () => getCardColorStyle(group.color),
    [group.color],
  );

  if (!bounds) {
    return null;
  }

  const strokeColor = group.color ? colorStyle.border : "#8B9D83";
  const fillColor = group.color
    ? toRgba(colorStyle.background, isSelected ? 0.5 : 0.36)
    : isSelected
      ? "rgba(139, 157, 131, 0.24)"
      : "rgba(139, 157, 131, 0.14)";
  const labelBackgroundColor = toRgba(strokeColor, isSelected ? 0.24 : 0.16);

  const handlePointerDown = (
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    event.cancelBubble = true;
    selectGroup(group.id);
  };

  const handleContextMenu = (event: KonvaEventObject<PointerEvent>) => {
    event.cancelBubble = true;
    event.evt.preventDefault();
    selectGroup(group.id);
    onOpenContextMenu({
      groupId: group.id,
      clientX: event.evt.clientX,
      clientY: event.evt.clientY,
    });
  };

  return (
    <>
      <Rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isSelected ? 2 : 1}
        dash={[10, 6]}
        cornerRadius={14}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onContextMenu={handleContextMenu}
      />
      <Rect
        x={bounds.x + 10}
        y={bounds.y + 8}
        width={Math.max(96, Math.min(bounds.width - 20, 260))}
        height={GROUP_LABEL_HEIGHT}
        fill={labelBackgroundColor}
        cornerRadius={8}
        listening={false}
      />
      <Text
        x={bounds.x + 16}
        y={bounds.y + 14}
        width={Math.max(0, bounds.width - 32)}
        text={group.label || "Untitled Group"}
        fontSize={13}
        fontStyle={isSelected ? "bold" : "normal"}
        fill={strokeColor}
        listening={false}
      />
    </>
  );
}

function areNodeIdListsEqual(
  previousIds: string[],
  nextIds: string[],
): boolean {
  if (previousIds.length !== nextIds.length) {
    return false;
  }

  for (let index = 0; index < previousIds.length; index += 1) {
    if (previousIds[index] !== nextIds[index]) {
      return false;
    }
  }

  return true;
}

function areGroupRectPropsEqual(
  previous: Readonly<GroupRectProps>,
  next: Readonly<GroupRectProps>,
): boolean {
  if (previous.group.id !== next.group.id) {
    return false;
  }
  if (previous.group.label !== next.group.label) {
    return false;
  }
  if (previous.group.color !== next.group.color) {
    return false;
  }
  if (!areNodeIdListsEqual(previous.group.nodeIds, next.group.nodeIds)) {
    return false;
  }
  if (previous.isSelected !== next.isSelected) {
    return false;
  }
  if (previous.onOpenContextMenu !== next.onOpenContextMenu) {
    return false;
  }

  for (const nodeId of next.group.nodeIds) {
    if (previous.nodes[nodeId] !== next.nodes[nodeId]) {
      return false;
    }
  }

  return true;
}

export const GroupRect = memo(GroupRectComponent, areGroupRectPropsEqual);
GroupRect.displayName = "GroupRect";
