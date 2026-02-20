import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../stores/canvasStore";
import { Canvas } from "../Canvas";
import { InteractionState } from "../core/stateMachine";

vi.mock("react-konva", () => ({
  Stage: ({
    children,
    onDblClick,
  }: {
    children: ReactNode;
    onDblClick?: (event: unknown) => void;
  }) => {
    const handleDoubleClick = () => {
      const stage = {
        getStage: () => stage,
        getType: () => "Stage",
        getPointerPosition: () => ({ x: 320, y: 240 }),
        x: () => 0,
        y: () => 0,
      };
      onDblClick?.({ target: stage });
    };

    return (
      <div data-testid="mock-stage" onDoubleClick={handleDoubleClick}>
        {children}
      </div>
    );
  },
  Layer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => null,
}));

vi.mock("../edges/useConnectionDrag", () => ({
  useConnectionDrag: () => ({
    connectingSource: null,
    hoveredTarget: null,
    previewLine: null,
    handleAnchorPointerDown: vi.fn(),
    cancelConnection: vi.fn(),
  }),
}));

vi.mock("../hooks/useCanvasKeyboard", () => ({
  useCanvasKeyboard: () => {},
}));

vi.mock("../hooks/useCanvasWheel", () => ({
  useCanvasWheel: () => {},
}));

vi.mock("../images/useImageUpload", () => ({
  useImageUpload: () => ({
    uploadImageFile: vi.fn(),
  }),
}));

vi.mock("../card/CardOverlay", () => ({
  CardOverlay: () => null,
}));

vi.mock("../edges/EdgeLine", () => ({
  EdgeLine: () => null,
}));

vi.mock("../images/ImageCanvasNode", () => ({
  ImageCanvasNode: () => null,
}));

function resetStore() {
  useCanvasStore.getState().clearHistory();
  useCanvasStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: {},
    nodeOrder: [],
    files: {},
    edges: {},
    selectedNodeIds: [],
    selectedEdgeIds: [],
    canvasMode: "select",
    interactionState: InteractionState.Idle,
    canUndo: false,
    canRedo: false,
  });
}

describe("Canvas mode behavior", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.innerHTML = "";
  });

  it("快捷鍵 C / V 可切換模式", () => {
    render(<Canvas />);

    fireEvent.keyDown(window, { key: "c" });
    expect(useCanvasStore.getState().canvasMode).toBe("connect");

    fireEvent.keyDown(window, { key: "v" });
    expect(useCanvasStore.getState().canvasMode).toBe("select");
  });

  it("editable element 內按 C 不切換模式", () => {
    render(<Canvas />);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: "c" });

    expect(useCanvasStore.getState().canvasMode).toBe("select");
  });

  it("dragging 中按 C 會忽略切換", () => {
    useCanvasStore.setState({ interactionState: InteractionState.Dragging });
    render(<Canvas />);

    fireEvent.keyDown(window, { key: "c" });

    expect(useCanvasStore.getState().canvasMode).toBe("select");
    expect(useCanvasStore.getState().interactionState).toBe(
      InteractionState.Dragging,
    );
  });

  it("connecting 中按 V 會中斷連線並切回 select", () => {
    useCanvasStore.setState({
      canvasMode: "connect",
      interactionState: InteractionState.Connecting,
    });
    render(<Canvas />);

    fireEvent.keyDown(window, { key: "v" });

    expect(useCanvasStore.getState().canvasMode).toBe("select");
    expect(useCanvasStore.getState().interactionState).toBe(
      InteractionState.Idle,
    );
  });

  it("connect 模式下 root 會使用 crosshair cursor", () => {
    useCanvasStore.setState({ canvasMode: "connect" });
    const view = render(<Canvas />);

    const root = view.container.firstElementChild as HTMLDivElement | null;
    if (!root) {
      throw new Error("canvas root not found");
    }

    expect(root.classList.contains("cursor-crosshair")).toBe(true);
  });

  it("connect 模式下雙擊空白不建立新卡片", () => {
    useCanvasStore.setState({ canvasMode: "connect" });
    render(<Canvas />);

    fireEvent.doubleClick(screen.getByTestId("mock-stage"));

    expect(Object.keys(useCanvasStore.getState().nodes)).toHaveLength(0);
  });

  it("select 模式下雙擊空白會建立新卡片", () => {
    render(<Canvas />);

    fireEvent.doubleClick(screen.getByTestId("mock-stage"));

    expect(Object.keys(useCanvasStore.getState().nodes)).toHaveLength(1);
  });

  it("點擊 edge 右鍵選單不會清除選取", () => {
    useCanvasStore.setState({
      selectedNodeIds: ["text-1"],
      nodes: {
        "text-1": {
          id: "text-1",
          type: "text",
          x: 0,
          y: 0,
          width: 280,
          height: 240,
          heightMode: "auto",
          color: null,
          contentMarkdown: "first",
        },
      },
      nodeOrder: ["text-1"],
    });
    const view = render(<Canvas />);
    const root = view.container.firstElementChild as HTMLDivElement | null;
    if (!root) {
      throw new Error("canvas root not found");
    }

    const mockEdgeMenu = document.createElement("div");
    mockEdgeMenu.setAttribute("data-edge-context-menu", "true");
    root.appendChild(mockEdgeMenu);

    fireEvent.pointerDown(mockEdgeMenu);

    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
  });

  it("canvas 頁面會停用原生右鍵選單", () => {
    const view = render(<Canvas />);
    const root = view.container.firstElementChild as HTMLDivElement | null;
    if (!root) {
      throw new Error("canvas root not found");
    }

    const event = createEvent.contextMenu(root, {
      bubbles: true,
      cancelable: true,
    });
    fireEvent(root, event);

    expect(event.defaultPrevented).toBe(true);
  });
});
