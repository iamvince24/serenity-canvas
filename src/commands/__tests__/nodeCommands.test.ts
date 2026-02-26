import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileRecord, Group, TextNode } from "../../types/canvas";
import {
  AddNodeCommand,
  DeleteNodeCommand,
  MoveNodeCommand,
  ReorderNodeCommand,
  ResizeNodeCommand,
  UpdateColorCommand,
  UpdateContentCommand,
  UpdateHeightModeCommand,
  toNodeGeometrySnapshot,
} from "../nodeCommands";
import type { NodeCommandContext } from "../nodeCommands";

function createTextNode(id: string, x: number, y: number): TextNode {
  return {
    id,
    type: "text",
    x,
    y,
    width: 200,
    height: 100,
    heightMode: "auto",
    color: null,
    contentMarkdown: "content",
  };
}

function createGroup(id: string, nodeIds: string[]): Group {
  return {
    id,
    label: "Group",
    color: null,
    nodeIds,
  };
}

function createFileRecord(): FileRecord {
  return {
    id: "file-1",
    mime_type: "image/webp",
    original_width: 100,
    original_height: 100,
    byte_size: 1024,
    created_at: 0,
  };
}

function createMockContext(): NodeCommandContext {
  return {
    addNode: vi.fn(),
    deleteNode: vi.fn(),
    restoreGroups: vi.fn(),
    setNodePosition: vi.fn(),
    setNodeGeometry: vi.fn(),
    setNodeContent: vi.fn(),
    setNodeColor: vi.fn(),
    setNodeHeightMode: vi.fn(),
    setNodeOrder: vi.fn(),
  };
}

describe("AddNodeCommand", () => {
  let ctx: NodeCommandContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("execute 呼叫 addNode（含 file）", () => {
    const node = createTextNode("n1", 10, 20);
    const file = createFileRecord();
    const cmd = new AddNodeCommand(ctx, node, file);

    cmd.execute();

    expect(ctx.addNode).toHaveBeenCalledTimes(1);
    expect(ctx.addNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: "n1", x: 10, y: 20 }),
      file,
    );
  });

  it("undo 呼叫 deleteNode", () => {
    const node = createTextNode("n1", 10, 20);
    const cmd = new AddNodeCommand(ctx, node);

    cmd.undo();

    expect(ctx.deleteNode).toHaveBeenCalledWith("n1");
  });

  it("snapshot 為獨立副本：修改外部 node 不影響 command", () => {
    const node = createTextNode("n1", 10, 20);
    const cmd = new AddNodeCommand(ctx, node);
    node.x = 999;

    cmd.execute();

    expect(ctx.addNode).toHaveBeenCalledWith(
      expect.objectContaining({ x: 10 }),
      undefined,
    );
  });
});

describe("DeleteNodeCommand", () => {
  let ctx: NodeCommandContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("execute 呼叫 deleteNode + setNodeOrder", () => {
    const node = createTextNode("n1", 10, 20);
    const cmd = new DeleteNodeCommand(ctx, {
      node,
      previousNodeOrder: ["n1", "n2"],
      nextNodeOrder: ["n2"],
      affectedGroupSnapshots: [],
    });

    cmd.execute();

    expect(ctx.deleteNode).toHaveBeenCalledWith("n1");
    expect(ctx.setNodeOrder).toHaveBeenCalledWith(["n2"]);
  });

  it("undo 呼叫 addNode + restoreGroups + setNodeOrder", () => {
    const node = createTextNode("n1", 10, 20);
    const groups = [createGroup("g1", ["n1"])];
    const cmd = new DeleteNodeCommand(ctx, {
      node,
      previousNodeOrder: ["n1", "n2"],
      nextNodeOrder: ["n2"],
      affectedGroupSnapshots: groups,
    });

    cmd.undo();

    expect(ctx.addNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: "n1" }),
      undefined,
    );
    expect(ctx.restoreGroups).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "g1", nodeIds: ["n1"] }),
      ]),
    );
    expect(ctx.setNodeOrder).toHaveBeenCalledWith(["n1", "n2"]);
  });

  it("undo 傳遞 affectedGroupSnapshots 正確", () => {
    const node = createTextNode("n1", 10, 20);
    const groups = [createGroup("g1", ["n1", "n2"])];
    const cmd = new DeleteNodeCommand(ctx, {
      node,
      previousNodeOrder: ["n1"],
      nextNodeOrder: [],
      affectedGroupSnapshots: groups,
    });

    cmd.undo();

    const restored = vi.mocked(ctx.restoreGroups).mock.calls[0][0];
    expect(restored).toHaveLength(1);
    expect(restored[0].nodeIds).toEqual(["n1", "n2"]);
  });
});

describe("MoveNodeCommand", () => {
  let ctx: NodeCommandContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("execute 移到新位置", () => {
    const cmd = new MoveNodeCommand(
      ctx,
      "n1",
      { x: 10, y: 20 },
      { x: 50, y: 60 },
    );

    cmd.execute();

    expect(ctx.setNodePosition).toHaveBeenCalledWith("n1", 50, 60);
  });

  it("undo 回到舊位置", () => {
    const cmd = new MoveNodeCommand(
      ctx,
      "n1",
      { x: 10, y: 20 },
      { x: 50, y: 60 },
    );

    cmd.undo();

    expect(ctx.setNodePosition).toHaveBeenCalledWith("n1", 10, 20);
  });
});

describe("ResizeNodeCommand", () => {
  let ctx: NodeCommandContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("execute / undo 正確傳遞 geometry snapshot", () => {
    const from = {
      x: 10,
      y: 20,
      width: 200,
      height: 100,
      heightMode: "auto" as const,
    };
    const to = {
      x: 10,
      y: 20,
      width: 300,
      height: 150,
      heightMode: "fixed" as const,
    };
    const cmd = new ResizeNodeCommand(ctx, "n1", from, to);

    cmd.execute();
    expect(ctx.setNodeGeometry).toHaveBeenCalledWith("n1", to);

    cmd.undo();
    expect(ctx.setNodeGeometry).toHaveBeenLastCalledWith("n1", from);
  });
});

describe("UpdateContentCommand", () => {
  let ctx: NodeCommandContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("execute 設定新內容，undo 還原舊內容", () => {
    const cmd = new UpdateContentCommand(ctx, "n1", "old", "new");

    cmd.execute();
    expect(ctx.setNodeContent).toHaveBeenCalledWith("n1", "new");

    cmd.undo();
    expect(ctx.setNodeContent).toHaveBeenLastCalledWith("n1", "old");
  });
});

describe("UpdateColorCommand", () => {
  let ctx: NodeCommandContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("execute 設定新顏色，undo 還原舊顏色", () => {
    const cmd = new UpdateColorCommand(ctx, "n1", null, "green");

    cmd.execute();
    expect(ctx.setNodeColor).toHaveBeenCalledWith("n1", "green");

    cmd.undo();
    expect(ctx.setNodeColor).toHaveBeenLastCalledWith("n1", null);
  });
});

describe("UpdateHeightModeCommand", () => {
  let ctx: NodeCommandContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("execute 設定新 mode，undo 還原舊 mode", () => {
    const cmd = new UpdateHeightModeCommand(ctx, "n1", "auto", "fixed");

    cmd.execute();
    expect(ctx.setNodeHeightMode).toHaveBeenCalledWith("n1", "fixed");

    cmd.undo();
    expect(ctx.setNodeHeightMode).toHaveBeenLastCalledWith("n1", "auto");
  });
});

describe("ReorderNodeCommand", () => {
  let ctx: NodeCommandContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("execute / undo 傳遞正確 nodeOrder 陣列", () => {
    const prev = ["a", "b", "c"];
    const next = ["c", "a", "b"];
    const cmd = new ReorderNodeCommand(ctx, prev, next);

    cmd.execute();
    expect(ctx.setNodeOrder).toHaveBeenCalledWith(next);

    cmd.undo();
    expect(ctx.setNodeOrder).toHaveBeenLastCalledWith(prev);
  });

  it("nodeOrder 為獨立副本：修改外部陣列不影響 command", () => {
    const prev = ["a", "b"];
    const next = ["b", "a"];
    const cmd = new ReorderNodeCommand(ctx, prev, next);
    prev.push("x");

    cmd.undo();

    expect(ctx.setNodeOrder).toHaveBeenCalledWith(["a", "b"]);
  });
});

describe("toNodeGeometrySnapshot", () => {
  it("從 node 產生 geometry snapshot", () => {
    const node = createTextNode("n1", 10, 20);
    const snapshot = toNodeGeometrySnapshot(node);

    expect(snapshot).toEqual({
      x: 10,
      y: 20,
      width: 200,
      height: 100,
      heightMode: "auto",
    });
  });
});
