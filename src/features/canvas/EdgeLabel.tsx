import { Group, Text } from "react-konva";
import {
  getEdgeStrokeColor,
  type CanvasNodeColor,
} from "../../constants/colors";
import {
  EDGE_LABEL_FONT_SIZE as LABEL_FONT_SIZE,
  EDGE_LABEL_LINE_HEIGHT as LABEL_LINE_HEIGHT,
  EDGE_LABEL_PADDING_X as LABEL_PADDING_X,
  EDGE_LABEL_PADDING_Y as LABEL_PADDING_Y,
  getEdgeLabelLayout,
} from "./edgeLabelLayout";

type EdgeLabelProps = {
  x: number;
  y: number;
  label: string;
  edgeColor: CanvasNodeColor;
  onSelect: () => void;
  onDblClick: () => void;
  onContextMenu: (clientX: number, clientY: number) => void;
};

export function EdgeLabel({
  x,
  y,
  label,
  edgeColor,
  onSelect,
  onDblClick,
  onContextMenu,
}: EdgeLabelProps) {
  const layout = getEdgeLabelLayout(label);
  if (!layout) {
    return null;
  }

  const width = layout.width;
  const textWidth = layout.textWidth;
  const height = layout.height;
  const left = x - width / 2;
  const top = y - height / 2;
  const textColor = getEdgeStrokeColor(edgeColor);

  return (
    <Group
      onMouseDown={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onTouchStart={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onDblClick={(event) => {
        event.cancelBubble = true;
        onDblClick();
      }}
      onDblTap={(event) => {
        event.cancelBubble = true;
        onDblClick();
      }}
      onContextMenu={(event) => {
        event.evt.preventDefault();
        event.cancelBubble = true;
        onContextMenu(event.evt.clientX, event.evt.clientY);
      }}
    >
      <Text
        x={left + LABEL_PADDING_X}
        y={top + LABEL_PADDING_Y - 1}
        width={textWidth}
        height={layout.textHeight}
        text={layout.text}
        align="center"
        fontSize={LABEL_FONT_SIZE}
        lineHeight={LABEL_LINE_HEIGHT}
        wrap="word"
        fill={textColor}
      />
    </Group>
  );
}
