import { describe, expect, it } from "vitest";
import {
  reorderMoveDown,
  reorderMoveDownInSubset,
  reorderMoveUp,
  reorderMoveUpInSubset,
  reorderToBackInSubset,
  reorderToBack,
  reorderToFrontInSubset,
  reorderToFront,
} from "../nodes/layerOrder";

describe("layer order helpers", () => {
  it("reorderMoveUp: 與上一層交換", () => {
    expect(reorderMoveUp(["a", "b", "c"], "b")).toEqual(["a", "c", "b"]);
  });

  it("reorderMoveDown: 與下一層交換", () => {
    expect(reorderMoveDown(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
  });

  it("reorderToFront: 移到最前面", () => {
    expect(reorderToFront(["a", "b", "c"], "a")).toEqual(["b", "c", "a"]);
  });

  it("reorderToBack: 移到最後面", () => {
    expect(reorderToBack(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });

  it("邊界與不存在 id 會 no-op", () => {
    expect(reorderMoveUp(["a", "b", "c"], "c")).toEqual(["a", "b", "c"]);
    expect(reorderMoveDown(["a", "b", "c"], "a")).toEqual(["a", "b", "c"]);
    expect(reorderToFront(["a", "b", "c"], "missing")).toEqual(["a", "b", "c"]);
    expect(reorderToBack(["a", "b", "c"], "missing")).toEqual(["a", "b", "c"]);
  });

  it("subset helpers: 只重排指定子序列，其他節點位置保持", () => {
    const order = ["text-1", "img-1", "text-2", "img-2", "text-3"];
    const textIds = ["text-1", "text-2", "text-3"];

    expect(reorderMoveUpInSubset(order, "text-2", textIds)).toEqual([
      "text-1",
      "img-1",
      "text-3",
      "img-2",
      "text-2",
    ]);
    expect(reorderMoveDownInSubset(order, "text-2", textIds)).toEqual([
      "text-2",
      "img-1",
      "text-1",
      "img-2",
      "text-3",
    ]);
    expect(reorderToFrontInSubset(order, "text-1", textIds)).toEqual([
      "text-2",
      "img-1",
      "text-3",
      "img-2",
      "text-1",
    ]);
    expect(reorderToBackInSubset(order, "text-3", textIds)).toEqual([
      "text-3",
      "img-1",
      "text-1",
      "img-2",
      "text-2",
    ]);
  });

  it("subset helpers: 非 subset id 不會重排", () => {
    const order = ["text-1", "img-1", "text-2"];
    const textIds = ["text-1", "text-2"];

    expect(reorderMoveUpInSubset(order, "img-1", textIds)).toEqual(order);
    expect(reorderMoveDownInSubset(order, "img-1", textIds)).toEqual(order);
    expect(reorderToFrontInSubset(order, "img-1", textIds)).toEqual(order);
    expect(reorderToBackInSubset(order, "img-1", textIds)).toEqual(order);
  });
});
