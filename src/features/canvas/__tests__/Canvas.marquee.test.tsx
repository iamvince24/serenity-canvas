import { forwardRef, type ReactNode, type Ref } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../stores/canvasStore";
import type { TextNode } from "../../../types/canvas";
import type { CardEditorHandle } from "../editor/CardEditor";
import { Canvas } from "../Canvas";
import { InteractionState } from "../core/stateMachine";

const edgeOverlayMockState = vi.hoisted(() => ({
  edgeEndpointDragState: null as {
    edgeId: string;
    endpoint: "from" | "to";
    pointer: { x: number; y: number };
    hoveredAnchor: null;
  } | null,
}));

vi.mock("react-konva", () => ({
  Stage: ({
    children,
    draggable,
    onMouseDown,
    onTouchStart,
  }: {
    children: ReactNode;
    draggable?: boolean;
    onMouseDown?: (event: unknown) => void;
    onTouchStart?: (event: unknown) => void;
  }) => {
    const stage = {
      getStage: () => stage,
      getType: () => "Stage",
      getPointerPosition: () => ({ x: 0, y: 0 }),
      x: () => 0,
      y: () => 0,
    };
    const layerTarget = {
      getStage: () => stage,
      getType: () => "Layer",
    };

    return (
      <div
        data-testid="mock-stage"
        data-draggable={String(Boolean(draggable))}
        onMouseDown={(event) =>
          onMouseDown?.({
            target: layerTarget,
            evt: event.nativeEvent,
            cancelBubble: false,
          })
        }
        onTouchStart={(event) =>
          onTouchStart?.({
            target: layerTarget,
            evt: event.nativeEvent,
            cancelBubble: false,
          })
        }
      >
        {children}
      </div>
    );
  },
  Layer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => null,
  Rect: () => <div data-testid="marquee-rect" />,
}));

vi.mock("../editor/CardEditor", () => ({
  CardEditor: forwardRef(function MockCardEditor(
    {
      initialMarkdown,
    }: {
      initialMarkdown: string;
    },
    ref: Ref<CardEditorHandle>,
  ) {
    void ref;
    return <div data-testid="mock-card-editor">{initialMarkdown}</div>;
  }),
}));

vi.mock("../card/ResizeHandle", () => ({
  LeftWidthResizeHandle: () => null,
  WidthResizeHandle: () => null,
  HeightResizeHandle: () => null,
  CornerResizeHandle: () => null,
}));

vi.mock("../card/useDragHandle", () => ({
  useDragHandle: () => ({}),
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

vi.mock("../edges/useEdgeOverlay", () => ({
  useEdgeOverlay: () => ({
    clearAllEdgeOverlays: vi.fn(),
    clearEdgeTransientState: vi.fn(),
    edgeContextMenuState: null,
    edgeLabelEditorState: null,
    edgeLabelDraftState: null,
    edgeEndpointDragState: edgeOverlayMockState.edgeEndpointDragState,
    openEdgeContextMenu: vi.fn(),
    closeEdgeContextMenu: vi.fn(),
    openEdgeLabelEditor: vi.fn(),
    closeEdgeLabelEditor: vi.fn(),
    openEdgeEndpointDrag: vi.fn(),
    cancelEdgeEndpointDrag: vi.fn(),
    setEdgeLabelDraft: vi.fn(),
    edgeEndpointPreview: null,
    canShowEdgeEndpointHandles: false,
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

vi.mock("../edges/EdgeLine", () => ({
  EdgeLine: () => null,
}));

vi.mock("../images/ImageCanvasNode", () => ({
  ImageCanvasNode: () => null,
}));

function createTextNode(id: string, x: number, y: number): TextNode {
  return {
    id,
    type: "text",
    x,
    y,
    width: 220,
    height: 160,
    heightMode: "fixed",
    color: null,
    contentMarkdown: id,
  };
}

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

function getRoot(container: HTMLElement): HTMLDivElement {
  const root = container.firstElementChild as HTMLDivElement | null;
  if (!root) {
    throw new Error("canvas root not found");
  }

  return root;
}

function dragBackground(
  root: HTMLElement,
  stage: HTMLElement,
  options: {
    start: { x: number; y: number };
    end: { x: number; y: number };
    shiftKey?: boolean;
  },
) {
  fireEvent.mouseDown(stage, {
    clientX: options.start.x,
    clientY: options.start.y,
    shiftKey: options.shiftKey,
  });
  fireEvent.pointerMove(root, {
    clientX: options.end.x,
    clientY: options.end.y,
    shiftKey: options.shiftKey,
  });
  fireEvent.pointerUp(root, {
    clientX: options.end.x,
    clientY: options.end.y,
    shiftKey: options.shiftKey,
  });
}

describe("Canvas marquee selection", () => {
  beforeEach(() => {
    edgeOverlayMockState.edgeEndpointDragState = null;
    resetStore();
  });

  afterEach(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.innerHTML = "";
  });

  it("空白拖拉時會顯示框選矩形，且 stage draggable 關閉", () => {
    const view = render(<Canvas />);
    const root = getRoot(view.container);
    const stage = screen.getByTestId("mock-stage");

    fireEvent.mouseDown(stage, { clientX: 20, clientY: 20 });
    fireEvent.pointerMove(root, { clientX: 120, clientY: 120 });

    expect(screen.getByTestId("marquee-rect")).toBeTruthy();
    expect(stage.getAttribute("data-draggable")).toBe("false");
  });

  it("框選命中採接觸即選", () => {
    useCanvasStore.setState({
      nodes: {
        "text-1": createTextNode("text-1", 100, 100),
      },
      nodeOrder: ["text-1"],
    });
    const view = render(<Canvas />);
    const root = getRoot(view.container);
    const stage = screen.getByTestId("mock-stage");

    dragBackground(root, stage, {
      start: { x: 0, y: 0 },
      end: { x: 105, y: 105 },
    });

    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
  });

  it("未收到 pointermove 時，仍可依起訖點判定為框選拖拉", () => {
    useCanvasStore.setState({
      nodes: {
        "text-1": createTextNode("text-1", 100, 100),
      },
      nodeOrder: ["text-1"],
    });
    const view = render(<Canvas />);
    const root = getRoot(view.container);
    const stage = screen.getByTestId("mock-stage");

    fireEvent.mouseDown(stage, { clientX: 0, clientY: 0 });
    fireEvent.pointerUp(root, { clientX: 140, clientY: 140 });

    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
  });

  it("無 Shift 時框選會覆蓋既有選取", () => {
    useCanvasStore.setState({
      nodes: {
        "text-1": createTextNode("text-1", 40, 40),
        "text-2": createTextNode("text-2", 400, 40),
      },
      nodeOrder: ["text-1", "text-2"],
      selectedNodeIds: ["text-2"],
    });
    const view = render(<Canvas />);
    const root = getRoot(view.container);
    const stage = screen.getByTestId("mock-stage");

    dragBackground(root, stage, {
      start: { x: 0, y: 0 },
      end: { x: 120, y: 120 },
    });

    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
  });

  it("Shift 框選會疊加既有選取", () => {
    useCanvasStore.setState({
      nodes: {
        "text-1": createTextNode("text-1", 40, 40),
        "text-2": createTextNode("text-2", 400, 40),
      },
      nodeOrder: ["text-1", "text-2"],
      selectedNodeIds: ["text-2"],
    });
    const view = render(<Canvas />);
    const root = getRoot(view.container);
    const stage = screen.getByTestId("mock-stage");

    dragBackground(root, stage, {
      start: { x: 0, y: 0 },
      end: { x: 120, y: 120 },
      shiftKey: true,
    });

    expect(useCanvasStore.getState().selectedNodeIds).toEqual([
      "text-2",
      "text-1",
    ]);
  });

  it("connect 模式下不啟動框選", () => {
    useCanvasStore.setState({
      canvasMode: "connect",
      nodes: {
        "text-1": createTextNode("text-1", 40, 40),
      },
      nodeOrder: ["text-1"],
    });
    const view = render(<Canvas />);
    const root = getRoot(view.container);
    const stage = screen.getByTestId("mock-stage");

    dragBackground(root, stage, {
      start: { x: 0, y: 0 },
      end: { x: 140, y: 140 },
    });

    expect(screen.queryByTestId("marquee-rect")).toBeNull();
    expect(useCanvasStore.getState().selectedNodeIds).toEqual([]);
  });

  it("端點拖拉進行中不啟動框選", () => {
    edgeOverlayMockState.edgeEndpointDragState = {
      edgeId: "edge-1",
      endpoint: "from",
      pointer: { x: 100, y: 100 },
      hoveredAnchor: null,
    };
    useCanvasStore.setState({
      nodes: {
        "text-1": createTextNode("text-1", 40, 40),
      },
      nodeOrder: ["text-1"],
    });

    const view = render(<Canvas />);
    const root = getRoot(view.container);
    const stage = screen.getByTestId("mock-stage");

    dragBackground(root, stage, {
      start: { x: 0, y: 0 },
      end: { x: 140, y: 140 },
    });

    expect(screen.queryByTestId("marquee-rect")).toBeNull();
    expect(useCanvasStore.getState().selectedNodeIds).toEqual([]);
  });

  it("Shift+Click 可 toggle 單一節點選取", () => {
    useCanvasStore.setState({
      nodes: {
        "text-1": createTextNode("text-1", 40, 40),
        "text-2": createTextNode("text-2", 360, 40),
      },
      nodeOrder: ["text-1", "text-2"],
      selectedNodeIds: ["text-1"],
    });
    const view = render(<Canvas />);

    const card = view.container.querySelector(
      '[data-card-node-id="text-2"]',
    ) as HTMLDivElement | null;
    if (!card) {
      throw new Error("target card not found");
    }
    const cardBody = card.querySelector(
      "[data-card-scroll-host='true']",
    ) as HTMLDivElement | null;
    if (!cardBody) {
      throw new Error("target card body not found");
    }

    fireEvent.pointerDown(cardBody, { shiftKey: true });
    expect(useCanvasStore.getState().selectedNodeIds).toEqual([
      "text-1",
      "text-2",
    ]);

    fireEvent.pointerDown(cardBody, { shiftKey: true });
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
  });
});
