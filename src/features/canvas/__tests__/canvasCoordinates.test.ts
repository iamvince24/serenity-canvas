import { describe, expect, it } from "vitest";
import { toCanvasPoint } from "../canvasCoordinates";

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
    const container = document.createElement("div");
    container.getBoundingClientRect = () => createRect(100, 50);

    const point = toCanvasPoint(260, 170, container, {
      x: 20,
      y: 10,
      zoom: 2,
    });

    expect(point).toEqual({ x: 70, y: 55 });
  });

  it("zoom 非正值時會回退為 1", () => {
    const container = document.createElement("div");
    container.getBoundingClientRect = () => createRect(10, 20);

    const point = toCanvasPoint(110, 220, container, {
      x: 30,
      y: 40,
      zoom: 0,
    });

    expect(point).toEqual({ x: 70, y: 160 });
  });

  it("client 座標非有限數值時回傳 null", () => {
    const container = document.createElement("div");
    container.getBoundingClientRect = () => createRect(0, 0);

    expect(
      toCanvasPoint(Number.NaN, 120, container, { x: 0, y: 0, zoom: 1 }),
    ).toBeNull();
    expect(
      toCanvasPoint(120, Number.POSITIVE_INFINITY, container, {
        x: 0,
        y: 0,
        zoom: 1,
      }),
    ).toBeNull();
  });
});
