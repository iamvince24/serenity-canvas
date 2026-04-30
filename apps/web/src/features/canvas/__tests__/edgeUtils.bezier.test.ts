import { describe, expect, it } from "vitest";
import type { EdgeLabelLayout } from "../edges/edgeLabelLayout";
import {
  calculateBezierControlPoints,
  getBezierBounds,
  getBezierPoint,
  getBezierTangent,
  getLabelGapTRange,
  splitBezier,
  type Point,
} from "../edges/edgeUtils";

function createLabelLayout(width: number, height: number): EdgeLabelLayout {
  return {
    text: "label",
    width,
    height,
    textWidth: width - 16,
    textHeight: height - 8,
  };
}

describe("edgeUtils bezier helpers", () => {
  it("calculateBezierControlPoints：水平 right→left 會沿著 x 軸延伸", () => {
    const from: Point = { x: 100, y: 80 };
    const to: Point = { x: 300, y: 140 };

    const { cp1, cp2 } = calculateBezierControlPoints(
      "right",
      from,
      "left",
      to,
    );

    expect(cp1.x).toBeGreaterThan(from.x);
    expect(cp1.y).toBe(from.y);
    expect(cp2.x).toBeLessThan(to.x);
    expect(cp2.y).toBe(to.y);
  });

  it("calculateBezierControlPoints：垂直 bottom→top 會沿著 y 軸延伸", () => {
    const from: Point = { x: 240, y: 120 };
    const to: Point = { x: 180, y: 360 };

    const { cp1, cp2 } = calculateBezierControlPoints(
      "bottom",
      from,
      "top",
      to,
    );

    expect(cp1.y).toBeGreaterThan(from.y);
    expect(cp1.x).toBe(from.x);
    expect(cp2.y).toBeLessThan(to.y);
    expect(cp2.x).toBe(to.x);
  });

  it("calculateBezierControlPoints：反向距離會產生 S 曲線偏移", () => {
    const from: Point = { x: 320, y: 100 };
    const to: Point = { x: 120, y: 100 };

    const { cp1, cp2 } = calculateBezierControlPoints(
      "right",
      from,
      "left",
      to,
    );

    expect(cp1.x).toBeGreaterThan(from.x);
    expect(cp2.x).toBeLessThan(to.x);
  });

  it("calculateBezierControlPoints：節點很近時控制點偏移接近零", () => {
    const from: Point = { x: 100, y: 80 };
    const to: Point = { x: 104, y: 80 };

    const { cp1 } = calculateBezierControlPoints("right", from, "left", to);
    expect(cp1.x - from.x).toBeCloseTo(2);
  });

  it("getBezierPoint：t=0 與 t=1 會回傳端點", () => {
    const p0: Point = { x: 0, y: 0 };
    const cp1: Point = { x: 0, y: 50 };
    const cp2: Point = { x: 50, y: 0 };
    const p3: Point = { x: 100, y: 100 };

    expect(getBezierPoint(0, p0, cp1, cp2, p3)).toEqual(p0);
    expect(getBezierPoint(1, p0, cp1, cp2, p3)).toEqual(p3);
  });

  it("getBezierPoint：對稱曲線在 t=0.5 會落在中點", () => {
    const p0: Point = { x: 0, y: 0 };
    const cp1: Point = { x: 0, y: 10 };
    const cp2: Point = { x: 10, y: 0 };
    const p3: Point = { x: 10, y: 10 };

    const midpoint = getBezierPoint(0.5, p0, cp1, cp2, p3);
    expect(midpoint.x).toBeCloseTo(5);
    expect(midpoint.y).toBeCloseTo(5);
  });

  it("getBezierTangent：接近直線時切線方向與 start→end 一致", () => {
    const p0: Point = { x: 0, y: 0 };
    const cp1: Point = { x: 3.333, y: 0 };
    const cp2: Point = { x: 6.666, y: 0 };
    const p3: Point = { x: 10, y: 0 };

    const tangent = getBezierTangent(0.5, p0, cp1, cp2, p3);
    expect(tangent.x).toBeGreaterThan(0);
    expect(tangent.y).toBeCloseTo(0);
  });

  it("getBezierTangent：t=1 方向約等於 cp2→end", () => {
    const p0: Point = { x: 0, y: 0 };
    const cp1: Point = { x: 0, y: 8 };
    const cp2: Point = { x: 10, y: 8 };
    const p3: Point = { x: 10, y: 0 };

    const tangent = getBezierTangent(1, p0, cp1, cp2, p3);
    expect(tangent.x).toBeCloseTo(0);
    expect(tangent.y).toBeLessThan(0);
  });

  it("getBezierTangent：零向量切線時 fallback 到 p3-p0", () => {
    const p0: Point = { x: 0, y: 0 };
    const cp1: Point = { x: 0, y: 0 };
    const cp2: Point = { x: 0, y: 0 };
    const p3: Point = { x: 5, y: 5 };

    const tangent = getBezierTangent(0, p0, cp1, cp2, p3);
    expect(tangent).toEqual({ x: 5, y: 5 });
  });

  it("getBezierBounds：S 曲線 bounds 包含端點與極值", () => {
    const bounds = getBezierBounds(
      { x: 0, y: 0 },
      { x: 120, y: 160 },
      { x: -60, y: -120 },
      { x: 100, y: 20 },
    );

    expect(bounds.x).toBeLessThanOrEqual(0);
    expect(bounds.y).toBeLessThanOrEqual(0);
    expect(bounds.width).toBeGreaterThanOrEqual(100);
    expect(bounds.height).toBeGreaterThanOrEqual(20);
  });

  it("splitBezier：t=0.5 會產生首尾相接的兩段子曲線", () => {
    const [firstHalf, secondHalf] = splitBezier(
      0.5,
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 60, y: 100 },
      { x: 100, y: 100 },
    );

    expect(firstHalf.p3).toEqual(secondHalf.p0);
  });

  it("splitBezier：t=0 與 t=1 會退化成端點段", () => {
    const p0: Point = { x: 0, y: 0 };
    const cp1: Point = { x: 40, y: 0 };
    const cp2: Point = { x: 60, y: 100 };
    const p3: Point = { x: 100, y: 100 };

    const [zeroFirst, zeroSecond] = splitBezier(0, p0, cp1, cp2, p3);
    expect(zeroFirst).toEqual({ p0, cp1: p0, cp2: p0, p3: p0 });
    expect(zeroSecond).toEqual({ p0, cp1, cp2, p3 });

    const [oneFirst, oneSecond] = splitBezier(1, p0, cp1, cp2, p3);
    expect(oneFirst).toEqual({ p0, cp1, cp2, p3 });
    expect(oneSecond).toEqual({ p0: p3, cp1: p3, cp2: p3, p3 });
  });

  it("getLabelGapTRange：直線退化時會在 0.5 對稱留白", () => {
    const range = getLabelGapTRange(
      {
        start: { x: 0, y: 0 },
        cp1: { x: 33.333, y: 0 },
        cp2: { x: 66.666, y: 0 },
        end: { x: 100, y: 0 },
      },
      createLabelLayout(40, 20),
    );

    expect(range).not.toBeNull();
    if (!range) {
      return;
    }

    expect(range.tStart).toBeLessThan(0.5);
    expect(range.tEnd).toBeGreaterThan(0.5);
    expect(0.5 - range.tStart).toBeCloseTo(range.tEnd - 0.5, 5);
  });

  it("getLabelGapTRange：正常曲線可回傳有效 t 範圍", () => {
    const range = getLabelGapTRange(
      {
        start: { x: 0, y: 0 },
        cp1: { x: 50, y: 0 },
        cp2: { x: 50, y: 120 },
        end: { x: 100, y: 120 },
      },
      createLabelLayout(56, 24),
    );

    expect(range).not.toBeNull();
    if (!range) {
      return;
    }

    expect(range.tStart).toBeLessThan(0.5);
    expect(range.tEnd).toBeGreaterThan(0.5);
  });

  it("getLabelGapTRange：極短曲線 speed 接近 0 時回傳 null", () => {
    const range = getLabelGapTRange(
      {
        start: { x: 10, y: 10 },
        cp1: { x: 10, y: 10 },
        cp2: { x: 10, y: 10 },
        end: { x: 10, y: 10 },
      },
      createLabelLayout(56, 24),
    );

    expect(range).toBeNull();
  });
});
