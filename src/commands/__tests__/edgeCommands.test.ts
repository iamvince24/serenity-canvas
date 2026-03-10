import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Edge } from "../../types/canvas";
import {
  AddEdgeCommand,
  DeleteEdgeCommand,
  UpdateEdgeCommand,
} from "../edgeCommands";
import type { EdgeCommandContext } from "../edgeCommands";

function createEdge(
  id: string,
  fromNode: string,
  toNode: string,
  overrides?: Partial<Edge>,
): Edge {
  return {
    id,
    fromNode,
    toNode,
    fromAnchor: "right",
    toAnchor: "left",
    direction: "forward",
    label: "",
    lineStyle: "solid",
    color: null,
    ...overrides,
  };
}

function createMockContext(): EdgeCommandContext {
  return {
    addEdge: vi.fn(),
    deleteEdge: vi.fn(),
    setEdge: vi.fn(),
  };
}

describe("AddEdgeCommand", () => {
  let ctx: EdgeCommandContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("execute 呼叫 addEdge", () => {
    const edge = createEdge("e1", "n1", "n2");
    const cmd = new AddEdgeCommand(ctx, edge);

    cmd.execute();

    expect(ctx.addEdge).toHaveBeenCalledTimes(1);
    expect(ctx.addEdge).toHaveBeenCalledWith(
      expect.objectContaining({ id: "e1", fromNode: "n1", toNode: "n2" }),
    );
  });

  it("undo 呼叫 deleteEdge", () => {
    const edge = createEdge("e1", "n1", "n2");
    const cmd = new AddEdgeCommand(ctx, edge);

    cmd.undo();

    expect(ctx.deleteEdge).toHaveBeenCalledWith("e1");
  });
});

describe("DeleteEdgeCommand", () => {
  let ctx: EdgeCommandContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("execute 呼叫 deleteEdge", () => {
    const edge = createEdge("e1", "n1", "n2", { label: "test" });
    const cmd = new DeleteEdgeCommand(ctx, edge);

    cmd.execute();

    expect(ctx.deleteEdge).toHaveBeenCalledWith("e1");
  });

  it("undo 呼叫 addEdge 還原完整 edge 物件", () => {
    const edge = createEdge("e1", "n1", "n2", {
      label: "my label",
      direction: "both",
      lineStyle: "dashed",
    });
    const cmd = new DeleteEdgeCommand(ctx, edge);

    cmd.undo();

    expect(ctx.addEdge).toHaveBeenCalledTimes(1);
    const restored = vi.mocked(ctx.addEdge).mock.calls[0][0];
    expect(restored).toEqual(edge);
  });
});

describe("UpdateEdgeCommand", () => {
  let ctx: EdgeCommandContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("execute 套用 next edge", () => {
    const previous = createEdge("e1", "n1", "n2", { label: "old" });
    const next = createEdge("e1", "n1", "n2", { label: "new" });
    const cmd = new UpdateEdgeCommand(ctx, previous, next);

    cmd.execute();

    expect(ctx.setEdge).toHaveBeenCalledWith(
      expect.objectContaining({ label: "new" }),
    );
  });

  it("undo 還原 previous edge", () => {
    const previous = createEdge("e1", "n1", "n2", { label: "old" });
    const next = createEdge("e1", "n1", "n2", { label: "new" });
    const cmd = new UpdateEdgeCommand(ctx, previous, next);

    cmd.undo();

    expect(ctx.setEdge).toHaveBeenCalledWith(
      expect.objectContaining({ label: "old" }),
    );
  });

  it("edge snapshot 為獨立副本：修改外部 edge 不影響 command", () => {
    const previous = createEdge("e1", "n1", "n2", { label: "old" });
    const next = createEdge("e1", "n1", "n2", { label: "new" });
    const cmd = new UpdateEdgeCommand(ctx, previous, next);
    next.label = "mutated";

    cmd.execute();

    expect(ctx.setEdge).toHaveBeenCalledWith(
      expect.objectContaining({ label: "new" }),
    );
  });
});
