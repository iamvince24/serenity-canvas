import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Command } from "../types";
import { HistoryManager } from "../historyManager";

function createMockCommand(id: string): Command {
  return {
    type: `mock.${id}`,
    execute: vi.fn(),
    undo: vi.fn(),
    toJSON: () => ({ type: `mock.${id}`, payload: {}, inverse: {} }),
  };
}

describe("HistoryManager", () => {
  let manager: HistoryManager;

  beforeEach(() => {
    manager = new HistoryManager();
  });

  it("execute 推入 undoStack，清空 redoStack", () => {
    const cmd1 = createMockCommand("1");
    const cmd2 = createMockCommand("2");

    manager.execute(cmd1);
    manager.execute(cmd2);

    expect(manager.getState()).toEqual({
      undoDepth: 2,
      redoDepth: 0,
      canUndo: true,
      canRedo: false,
    });
  });

  it("undo 彈出 undoStack，推入 redoStack，回傳 true", () => {
    const cmd = createMockCommand("1");
    manager.execute(cmd);

    const result = manager.undo();

    expect(result).toBe(true);
    expect(cmd.undo).toHaveBeenCalledTimes(1);
    expect(manager.getState()).toEqual({
      undoDepth: 0,
      redoDepth: 1,
      canUndo: false,
      canRedo: true,
    });
  });

  it("空 stack 時 undo 回傳 false", () => {
    const result = manager.undo();
    expect(result).toBe(false);
    expect(manager.getState().canUndo).toBe(false);
  });

  it("空 stack 時 redo 回傳 false", () => {
    const result = manager.redo();
    expect(result).toBe(false);
    expect(manager.getState().canRedo).toBe(false);
  });

  it("getState 的 canUndo / canRedo 反映正確", () => {
    const cmd = createMockCommand("1");

    expect(manager.getState()).toEqual({
      undoDepth: 0,
      redoDepth: 0,
      canUndo: false,
      canRedo: false,
    });

    manager.execute(cmd);
    expect(manager.getState().canUndo).toBe(true);
    expect(manager.getState().canRedo).toBe(false);

    manager.undo();
    expect(manager.getState().canUndo).toBe(false);
    expect(manager.getState().canRedo).toBe(true);

    manager.redo();
    expect(manager.getState().canUndo).toBe(true);
    expect(manager.getState().canRedo).toBe(false);
  });

  it("超過 50 步時 trimUndoStack 淘汰最舊的命令", () => {
    const limit = 5;
    const limitedManager = new HistoryManager(limit);

    for (let i = 0; i < 8; i += 1) {
      limitedManager.execute(createMockCommand(String(i)));
    }

    expect(limitedManager.getState().undoDepth).toBe(limit);
  });

  it("clear 清空兩個 stack", () => {
    const cmd = createMockCommand("1");
    manager.execute(cmd);
    manager.undo();

    manager.clear();

    expect(manager.getState()).toEqual({
      undoDepth: 0,
      redoDepth: 0,
      canUndo: false,
      canRedo: false,
    });
  });

  it("execute 會呼叫 command.execute", () => {
    const cmd = createMockCommand("1");
    manager.execute(cmd);
    expect(cmd.execute).toHaveBeenCalledTimes(1);
  });

  it("redo 會呼叫 command.execute 並推回 undoStack", () => {
    const cmd = createMockCommand("1");
    manager.execute(cmd);
    manager.undo();

    manager.redo();

    expect(cmd.execute).toHaveBeenCalledTimes(2);
    expect(manager.getState().undoDepth).toBe(1);
    expect(manager.getState().redoDepth).toBe(0);
  });

  it("新 execute 會清空 redoStack", () => {
    const cmd1 = createMockCommand("1");
    const cmd2 = createMockCommand("2");
    manager.execute(cmd1);
    manager.undo();
    expect(manager.getState().redoDepth).toBe(1);

    manager.execute(cmd2);

    expect(manager.getState().redoDepth).toBe(0);
    expect(manager.getState().undoDepth).toBe(1);
  });
});
