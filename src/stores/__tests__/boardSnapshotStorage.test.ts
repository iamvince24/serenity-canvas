import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { BoardCanvasSnapshot } from "../storeTypes";
import {
  getBoardSnapshotKey,
  loadBoardSnapshot,
  removeBoardSnapshot,
  saveBoardSnapshot,
} from "../boardSnapshotStorage";

function createSnapshot(): BoardCanvasSnapshot {
  return {
    nodes: {
      "node-1": {
        id: "node-1",
        type: "text",
        x: 100,
        y: 120,
        width: 320,
        height: 200,
        heightMode: "auto",
        color: null,
        contentMarkdown: "hello",
      },
    },
    nodeOrder: ["node-1"],
    edges: {},
    groups: {},
    files: {},
  };
}

describe("boardSnapshotStorage", () => {
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("save/load round-trip works", () => {
    const snapshot = createSnapshot();
    saveBoardSnapshot("board-1", snapshot);

    expect(loadBoardSnapshot("board-1")).toEqual(snapshot);
  });

  it("load returns null for malformed json", () => {
    localStorage.setItem(getBoardSnapshotKey("board-1"), "{");
    expect(loadBoardSnapshot("board-1")).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("load returns null for invalid structure", () => {
    localStorage.setItem(
      getBoardSnapshotKey("board-1"),
      JSON.stringify({ foo: "bar" }),
    );
    expect(loadBoardSnapshot("board-1")).toBeNull();
  });

  it("remove deletes snapshot key", () => {
    saveBoardSnapshot("board-1", createSnapshot());
    removeBoardSnapshot("board-1");

    expect(localStorage.getItem(getBoardSnapshotKey("board-1"))).toBeNull();
  });
});
