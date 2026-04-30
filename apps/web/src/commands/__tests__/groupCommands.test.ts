import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group } from "../../types/canvas";
import {
  CreateGroupCommand,
  DeleteGroupCommand,
  UpdateGroupCommand,
} from "../groupCommands";
import type { GroupCommandContext } from "../groupCommands";

function createGroup(
  id: string,
  nodeIds: string[],
  overrides?: Partial<Group>,
): Group {
  return {
    id,
    label: "Group",
    color: null,
    nodeIds,
    ...overrides,
  };
}

function createMockContext(): GroupCommandContext {
  return {
    setGroup: vi.fn(),
    deleteGroup: vi.fn(),
    restoreGroups: vi.fn(),
  };
}

describe("CreateGroupCommand", () => {
  let ctx: GroupCommandContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("execute 呼叫 setGroup", () => {
    const group = createGroup("g1", ["n1", "n2"]);
    const cmd = new CreateGroupCommand(ctx, group, []);

    cmd.execute();

    expect(ctx.setGroup).toHaveBeenCalledWith(
      expect.objectContaining({ id: "g1", nodeIds: ["n1", "n2"] }),
    );
  });

  it("undo 呼叫 deleteGroup + restoreGroups", () => {
    const group = createGroup("g1", ["n1", "n2"]);
    const affected = [createGroup("g0", ["n1"])];
    const cmd = new CreateGroupCommand(ctx, group, affected);

    cmd.undo();

    expect(ctx.deleteGroup).toHaveBeenCalledWith("g1");
    expect(ctx.restoreGroups).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "g0", nodeIds: ["n1"] }),
      ]),
    );
  });
});

describe("DeleteGroupCommand", () => {
  let ctx: GroupCommandContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("execute 呼叫 deleteGroup", () => {
    const group = createGroup("g1", ["n1", "n2"]);
    const cmd = new DeleteGroupCommand(ctx, group);

    cmd.execute();

    expect(ctx.deleteGroup).toHaveBeenCalledWith("g1");
  });

  it("undo 呼叫 setGroup 還原完整 group", () => {
    const group = createGroup("g1", ["n1", "n2"], { label: "My Group" });
    const cmd = new DeleteGroupCommand(ctx, group);

    cmd.undo();

    expect(ctx.setGroup).toHaveBeenCalledTimes(1);
    const restored = vi.mocked(ctx.setGroup).mock.calls[0][0];
    expect(restored).toEqual(group);
  });

  it("nodeIds 陣列為獨立副本：修改外部 group.nodeIds 不影響 command", () => {
    const group = createGroup("g1", ["n1", "n2"]);
    const cmd = new DeleteGroupCommand(ctx, group);
    group.nodeIds.push("n3");

    cmd.undo();

    const restored = vi.mocked(ctx.setGroup).mock.calls[0][0];
    expect(restored.nodeIds).toEqual(["n1", "n2"]);
  });
});

describe("UpdateGroupCommand", () => {
  let ctx: GroupCommandContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("execute 呼叫 setGroup（new）", () => {
    const previous = createGroup("g1", ["n1"], { label: "Old" });
    const next = createGroup("g1", ["n1", "n2"], { label: "New" });
    const cmd = new UpdateGroupCommand(ctx, previous, next, []);

    cmd.execute();

    expect(ctx.setGroup).toHaveBeenCalledWith(
      expect.objectContaining({ label: "New", nodeIds: ["n1", "n2"] }),
    );
  });

  it("undo 呼叫 setGroup（old）+ restoreGroups（affectedGroupSnapshots）", () => {
    const previous = createGroup("g1", ["n1"], { label: "Old" });
    const next = createGroup("g1", ["n1", "n2"], { label: "New" });
    const affected = [createGroup("g0", ["n1"])];
    const cmd = new UpdateGroupCommand(ctx, previous, next, affected);

    cmd.undo();

    expect(ctx.setGroup).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Old", nodeIds: ["n1"] }),
    );
    expect(ctx.restoreGroups).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "g0", nodeIds: ["n1"] }),
      ]),
    );
  });

  it("nodeIds 陣列為獨立副本（深拷貝驗證）", () => {
    const previous = createGroup("g1", ["n1"]);
    const next = createGroup("g1", ["n1", "n2"]);
    const cmd = new UpdateGroupCommand(ctx, previous, next, []);
    next.nodeIds.push("n3");

    cmd.execute();

    const setArg = vi.mocked(ctx.setGroup).mock.calls[0][0];
    expect(setArg.nodeIds).toEqual(["n1", "n2"]);
  });
});
