import { describe, expect, it } from "vitest";
import {
  centerViewportOnNodes,
  toCanvasPoint,
} from "../core/canvasCoordinates";
import type { CanvasNode } from "../../../types/canvas";

function createRect(left: number, top: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left,
    bottom: top,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("canvasCoordinates", () => {
  it("toCanvasPoint 會依容器偏移與 viewport 轉換座標", () => {
    const rect = createRect(100, 50);

    const point = toCanvasPoint(260, 170, rect, {
      x: 20,
      y: 10,
      zoom: 2,
    });

    expect(point).toEqual({ x: 70, y: 55 });
  });

  it("zoom 非正值時會回退為 1", () => {
    const rect = createRect(10, 20);

    const point = toCanvasPoint(110, 220, rect, {
      x: 30,
      y: 40,
      zoom: 0,
    });

    expect(point).toEqual({ x: 70, y: 160 });
  });

  it("client 座標非有限數值時回傳 null", () => {
    const rect = createRect(0, 0);

    expect(
      toCanvasPoint(Number.NaN, 120, rect, { x: 0, y: 0, zoom: 1 }),
    ).toBeNull();
    expect(
      toCanvasPoint(120, Number.POSITIVE_INFINITY, rect, {
        x: 0,
        y: 0,
        zoom: 1,
      }),
    ).toBeNull();
  });
});

function makeNode(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): CanvasNode {
  return {
    id,
    type: "text",
    x,
    y,
    width,
    height,
    heightMode: "fixed",
    color: null,
    contentMarkdown: "",
  };
}

describe("centerViewportOnNodes", () => {
  it("空 canvas 回傳預設 viewport", () => {
    expect(centerViewportOnNodes({}, 1920, 1080)).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    });
  });

  it("單一 node 會將其中心對齊視窗中心", () => {
    const nodes: Record<string, CanvasNode> = {
      a: makeNode("a", 100, 200, 300, 100),
    };
    // node center: (100+300/2, 200+100/2) = (250, 250)
    // viewport: (960-250, 540-250) = (710, 290)
    const vp = centerViewportOnNodes(nodes, 1920, 1080);
    expect(vp).toEqual({ x: 710, y: 290, zoom: 1 });
  });

  it("多個 node 會將 bounding box 中心對齊視窗中心", () => {
    const nodes: Record<string, CanvasNode> = {
      a: makeNode("a", 0, 0, 100, 100),
      b: makeNode("b", 400, 400, 100, 100),
    };
    // bounding box: (0,0)-(500,500), center: (250, 250)
    // viewport: (960-250, 540-250) = (710, 290)
    const vp = centerViewportOnNodes(nodes, 1920, 1080);
    expect(vp).toEqual({ x: 710, y: 290, zoom: 1 });
  });
});
