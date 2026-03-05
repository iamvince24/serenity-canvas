import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasPage } from "../CanvasPage";

const { initFromDB, flushCanvasPersistence, mockCanvasState } = vi.hoisted(
  () => {
    const initFromDBMock = vi.fn();
    const flushCanvasPersistenceMock = vi.fn();
    const canvasState = {
      isLoading: false,
      initFromDB: initFromDBMock,
    };

    return {
      initFromDB: initFromDBMock,
      flushCanvasPersistence: flushCanvasPersistenceMock,
      mockCanvasState: canvasState,
    };
  },
);

vi.mock("../../features/canvas/Canvas", () => ({
  Canvas: () => <div data-testid="canvas" />,
}));

vi.mock("../../features/canvas/Toolbar", () => ({
  Toolbar: () => <div data-testid="toolbar" />,
}));

vi.mock("../../features/canvas/FpsOverlay", () => ({
  FpsOverlay: () => <div data-testid="fps-overlay" />,
}));

vi.mock("../../stores/canvasStore", () => ({
  flushCanvasPersistence,
  useCanvasStore: Object.assign(
    (selector: (state: typeof mockCanvasState) => unknown) =>
      selector(mockCanvasState),
    {
      getState: () => mockCanvasState,
    },
  ),
}));

describe("CanvasPage IndexedDB init flow", () => {
  beforeEach(() => {
    initFromDB.mockReset();
    initFromDB.mockResolvedValue(undefined);
    flushCanvasPersistence.mockReset();
    flushCanvasPersistence.mockResolvedValue(undefined);
    mockCanvasState.isLoading = false;
  });

  it("mount 時會呼叫 initFromDB", () => {
    render(<CanvasPage boardId="board-1" />);

    expect(initFromDB).toHaveBeenCalledWith("board-1");
  });

  it("board 切換時會重新呼叫 initFromDB", () => {
    const { rerender } = render(<CanvasPage boardId="board-1" />);
    rerender(<CanvasPage boardId="board-2" />);

    expect(initFromDB).toHaveBeenNthCalledWith(1, "board-1");
    expect(initFromDB).toHaveBeenNthCalledWith(2, "board-2");
  });

  it("loading 狀態顯示 spinner 並暫不渲染 Canvas", () => {
    mockCanvasState.isLoading = true;
    render(<CanvasPage boardId="board-1" />);

    expect(screen.getByRole("status", { name: "載入白板中" })).toBeTruthy();
    expect(screen.queryByTestId("canvas")).toBeNull();
    expect(screen.queryByTestId("toolbar")).toBeNull();
  });

  it("loading 結束後渲染 Canvas 與 Toolbar", () => {
    mockCanvasState.isLoading = false;
    render(<CanvasPage boardId="board-1" />);

    expect(screen.queryByRole("status", { name: "載入白板中" })).toBeNull();
    expect(screen.getByTestId("canvas")).toBeTruthy();
    expect(screen.getByTestId("toolbar")).toBeTruthy();
  });

  it("unmount 會觸發 flushCanvasPersistence", () => {
    const view = render(<CanvasPage boardId="board-1" />);
    view.unmount();

    expect(flushCanvasPersistence).toHaveBeenCalled();
  });
});
