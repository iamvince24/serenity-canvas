import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Command } from "../types";
import { CompositeCommand } from "../types";

function createMockCommand(id: string): Command {
  return {
    type: `mock.${id}`,
    execute: vi.fn(),
    undo: vi.fn(),
    toJSON: () => ({ type: `mock.${id}`, payload: { id }, inverse: {} }),
  };
}

describe("CompositeCommand", () => {
  let cmd1: Command;
  let cmd2: Command;
  let cmd3: Command;

  beforeEach(() => {
    cmd1 = createMockCommand("1");
    cmd2 = createMockCommand("2");
    cmd3 = createMockCommand("3");
  });

  it("execute 依序呼叫所有子命令", () => {
    const callOrder: string[] = [];
    const c1 = createMockCommand("1");
    const c2 = createMockCommand("2");
    const c3 = createMockCommand("3");
    vi.mocked(c1.execute).mockImplementation(() => callOrder.push("1"));
    vi.mocked(c2.execute).mockImplementation(() => callOrder.push("2"));
    vi.mocked(c3.execute).mockImplementation(() => callOrder.push("3"));

    const composite = new CompositeCommand([c1, c2, c3], "batch");
    composite.execute();

    expect(callOrder).toEqual(["1", "2", "3"]);
  });

  it("undo 以反向順序呼叫（最後加入的先 undo）", () => {
    const callOrder: string[] = [];
    const c1 = createMockCommand("1");
    const c2 = createMockCommand("2");
    const c3 = createMockCommand("3");
    vi.mocked(c1.undo).mockImplementation(() => callOrder.push("1"));
    vi.mocked(c2.undo).mockImplementation(() => callOrder.push("2"));
    vi.mocked(c3.undo).mockImplementation(() => callOrder.push("3"));

    const composite = new CompositeCommand([c1, c2, c3], "batch");
    composite.undo();

    expect(callOrder).toEqual(["3", "2", "1"]);
  });

  it("單一子命令也能正常運作", () => {
    const composite = new CompositeCommand([cmd1], "single");

    composite.execute();
    expect(cmd1.execute).toHaveBeenCalledTimes(1);

    composite.undo();
    expect(cmd1.undo).toHaveBeenCalledTimes(1);
  });

  it("toJSON 結構包含所有子命令序列化結果", () => {
    const composite = new CompositeCommand([cmd1, cmd2], "batch");
    const json = composite.toJSON();

    expect(json.type).toBe("batch");
    expect(json.payload).toHaveProperty("commands");
    expect((json.payload as { commands: unknown[] }).commands).toHaveLength(2);
    expect(
      (json.payload as { commands: { type: string }[] }).commands[0].type,
    ).toBe("mock.1");
    expect(
      (json.payload as { commands: { type: string }[] }).commands[1].type,
    ).toBe("mock.2");
    expect(json.inverse).toHaveProperty("commands");
    expect((json.inverse as { commands: unknown[] }).commands).toHaveLength(2);
  });

  it("execute 後 undo 可完整還原", () => {
    const composite = new CompositeCommand([cmd1, cmd2, cmd3], "batch");

    composite.execute();
    composite.undo();

    expect(cmd1.execute).toHaveBeenCalledTimes(1);
    expect(cmd1.undo).toHaveBeenCalledTimes(1);
    expect(cmd2.execute).toHaveBeenCalledTimes(1);
    expect(cmd2.undo).toHaveBeenCalledTimes(1);
    expect(cmd3.execute).toHaveBeenCalledTimes(1);
    expect(cmd3.undo).toHaveBeenCalledTimes(1);
  });
});
