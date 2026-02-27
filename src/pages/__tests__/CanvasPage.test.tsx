import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasPage } from "../CanvasPage";

const {
  saveBoardSnapshot,
  loadBoardSnapshot,
  exportSnapshot,
  loadSnapshot,
  resetBoardState,
  mockStoreState,
} = vi.hoisted(() => {
  const exportSnapshotMock = vi.fn();
  const loadSnapshotMock = vi.fn();
  const resetBoardStateMock = vi.fn();

  return {
    saveBoardSnapshot: vi.fn(),
    loadBoardSnapshot: vi.fn(),
    exportSnapshot: exportSnapshotMock,
    loadSnapshot: loadSnapshotMock,
    resetBoardState: resetBoardStateMock,
    mockStoreState: {
      exportSnapshot: exportSnapshotMock,
      loadSnapshot: loadSnapshotMock,
      resetBoardState: resetBoardStateMock,
    },
  };
});

vi.mock("../../features/canvas/Canvas", () => ({
  Canvas: () => <div data-testid="canvas" />,
}));

vi.mock("../../features/canvas/Toolbar", () => ({
  Toolbar: () => <div data-testid="toolbar" />,
}));

vi.mock("../../features/canvas/FpsOverlay", () => ({
  FpsOverlay: () => <div data-testid="fps-overlay" />,
}));

vi.mock("../../stores/boardSnapshotStorage", () => ({
  saveBoardSnapshot,
  loadBoardSnapshot,
}));

vi.mock("../../stores/canvasStore", () => ({
  useCanvasStore: {
    getState: () => mockStoreState,
  },
}));

describe("CanvasPage board snapshot flow", () => {
  beforeEach(() => {
    saveBoardSnapshot.mockReset();
    loadBoardSnapshot.mockReset();
    exportSnapshot.mockReset();
    loadSnapshot.mockReset();
    resetBoardState.mockReset();
    exportSnapshot.mockReturnValue({
      nodes: {},
      nodeOrder: [],
      edges: {},
      groups: {},
      files: {},
    });
  });

  it("loads board snapshot on mount when snapshot exists", () => {
    const snapshot = {
      nodes: {
        "node-1": {
          id: "node-1",
          type: "text" as const,
          x: 0,
          y: 0,
          width: 280,
          height: 200,
          heightMode: "auto" as const,
          color: null,
          contentMarkdown: "hello",
        },
      },
      nodeOrder: ["node-1"],
      edges: {},
      groups: {},
      files: {},
    };
    loadBoardSnapshot.mockReturnValue(snapshot);

    render(<CanvasPage boardId="board-1" />);

    expect(loadBoardSnapshot).toHaveBeenCalledWith("board-1");
    expect(loadSnapshot).toHaveBeenCalledWith(snapshot);
    expect(resetBoardState).not.toHaveBeenCalled();
  });

  it("resets board state on mount when no snapshot exists", () => {
    loadBoardSnapshot.mockReturnValue(null);

    render(<CanvasPage boardId="board-1" />);

    expect(loadBoardSnapshot).toHaveBeenCalledWith("board-1");
    expect(resetBoardState).toHaveBeenCalledTimes(1);
    expect(loadSnapshot).not.toHaveBeenCalled();
  });

  it("switching board saves previous snapshot then loads target board", () => {
    loadBoardSnapshot.mockImplementation((boardId: string) =>
      boardId === "board-1"
        ? {
            nodes: {},
            nodeOrder: [],
            edges: {},
            groups: {},
            files: {},
          }
        : null,
    );

    const { rerender } = render(<CanvasPage boardId="board-1" />);
    rerender(<CanvasPage boardId="board-2" />);

    expect(saveBoardSnapshot).toHaveBeenCalledWith(
      "board-1",
      expect.objectContaining({
        nodes: {},
        nodeOrder: [],
      }),
    );
    expect(loadBoardSnapshot).toHaveBeenCalledWith("board-2");
    expect(resetBoardState).toHaveBeenCalledTimes(1);
  });

  it("unmount saves current board snapshot", () => {
    loadBoardSnapshot.mockReturnValue(null);
    const view = render(<CanvasPage boardId="board-1" />);

    view.unmount();

    expect(saveBoardSnapshot).toHaveBeenCalledWith(
      "board-1",
      expect.objectContaining({
        nodes: {},
        nodeOrder: [],
      }),
    );
  });
});
