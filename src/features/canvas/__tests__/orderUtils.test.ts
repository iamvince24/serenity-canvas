import { describe, expect, it } from "vitest";
import type { CanvasNode, TextNode } from "../../../types/canvas";
import {
  buildOrderedNodeEntries,
  resolveOrderedNodeIds,
} from "../nodes/orderUtils";

function createTextNode(id: string): TextNode {
  return {
    id,
    type: "text",
    x: 0,
    y: 0,
    width: 220,
    height: 160,
    heightMode: "fixed",
    color: null,
    contentMarkdown: id,
  };
}

describe("orderUtils", () => {
  it("resolveOrderedNodeIds 會依 nodeOrder 去重並補上 fallback", () => {
    const nodes: Record<string, CanvasNode> = {
      a: createTextNode("a"),
      b: createTextNode("b"),
      c: createTextNode("c"),
    };

    const orderedIds = resolveOrderedNodeIds(["b", "missing", "b"], nodes);

    expect(orderedIds).toEqual(["b", "a", "c"]);
  });

  it("resolveOrderedNodeIds 可關閉 fallback", () => {
    const nodes: Record<string, CanvasNode> = {
      a: createTextNode("a"),
      b: createTextNode("b"),
    };

    const orderedIds = resolveOrderedNodeIds(["b"], nodes, {
      includeFallback: false,
    });

    expect(orderedIds).toEqual(["b"]);
  });

  it("buildOrderedNodeEntries 會生成對應 layerIndex", () => {
    const nodes: Record<string, CanvasNode> = {
      a: createTextNode("a"),
      b: createTextNode("b"),
      c: createTextNode("c"),
    };

    const entries = buildOrderedNodeEntries(["b", "c"], nodes, {
      includeFallback: false,
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ node: { id: "b" }, layerIndex: 0 });
    expect(entries[1]).toMatchObject({ node: { id: "c" }, layerIndex: 1 });
  });
});
