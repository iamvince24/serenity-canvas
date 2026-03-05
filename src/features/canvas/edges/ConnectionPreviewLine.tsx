import { Shape } from "react-konva";
import type { Point } from "./edgeUtils";

type ConnectionPreviewLineProps = {
  start: Point;
  end: Point;
  cp1: Point;
  cp2: Point;
};

export function ConnectionPreviewLine({
  start,
  end,
  cp1,
  cp2,
}: ConnectionPreviewLineProps) {
  return (
    <Shape
      sceneFunc={(ctx) => {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
        ctx.strokeStyle = "#8B9D83";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.lineCap = "round";
        ctx.stroke();
      }}
      listening={false}
    />
  );
}
