import { forwardRef, type ReactNode, type Ref } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../stores/canvasStore";
import type { TextNode } from "../../../types/canvas";
import { Canvas } from "../Canvas";
import { ZOOM_STEP } from "../core/constants";
import { InteractionState } from "../core/stateMachine";
import type { CardEditorHandle } from "../editor/CardEditor";

vi.mock("react-konva", () => ({
  Stage: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-stage">{children}</div>
  ),
  Layer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => null,
  Rect: () => null,
  Text: () => null,
}));

vi.mock("../editor/CardEditor", () => ({
  CardEditor: forwardRef(function MockCardEditor(
    { initialMarkdown }: { initialMarkdown: string },
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

vi.mock("../edges/useConnectionDrag", () => ({
  useConnectionDrag: () => ({
    connectingSource: null,
    hoveredTarget: null,
    previewLine: null,
    handleAnchorPointerDown: vi.fn(),
  }),
}));

vi.mock("../edges/useEdgeOverlay", () => ({
  useEdgeOverlay: () => ({
    clearAllEdgeOverlays: vi.fn(),
    clearEdgeTransientState: vi.fn(),
    edgeContextMenuState: null,
    edgeLabelEditorState: null,
    edgeLabelDraftState: null,
    edgeEndpointDragState: null,
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

vi.mock("../edges/EdgeLine", () => ({
  EdgeLine: () => null,
}));

vi.mock("../images/ImageCanvasNode", () => ({
  ImageCanvasNode: () => null,
}));

vi.mock("../images/useImageUpload", () => ({
  useImageUpload: () => ({
    uploadImageFile: vi.fn(),
  }),
}));

function setWindowSize(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
  });
}

function createTextNode(id: string, x: number, y: number): TextNode {
  return {
    id,
    type: "text",
    x,
    y,
    width: 280,
    height: 220,
    heightMode: "fixed",
    color: null,
    contentMarkdown: id,
  };
}

function seedCanvasState(viewport?: {
  x: number;
  y: number;
  zoom: number;
}): void {
  const visibleNode = createTextNode("text-visible", 120, 100);
  const offscreenNode = createTextNode("text-offscreen", 4800, 3600);

  useCanvasStore.getState().clearHistory();
  useCanvasStore.setState({
    viewport: viewport ?? { x: 0, y: 0, zoom: 1 },
    nodes: {
      [visibleNode.id]: visibleNode,
      [offscreenNode.id]: offscreenNode,
    },
    nodeOrder: [visibleNode.id, offscreenNode.id],
    files: {},
    edges: {},
    groups: {},
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedGroupIds: [],
    canvasMode: "select",
    interactionState: InteractionState.Idle,
    canUndo: false,
    canRedo: false,
  });
}

function getCanvasRoot(container: HTMLElement): HTMLDivElement {
  const root = container.firstElementChild as HTMLDivElement | null;
  if (!root) {
    throw new Error("canvas root not found");
  }

  return root;
}

function installPointerCaptureMocks(): void {
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => true,
  });
}

async function flushAnimationFrame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

describe("Canvas culling integration", () => {
  beforeEach(() => {
    installPointerCaptureMocks();
    setWindowSize(1280, 720);
    seedCanvasState();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("啟用 culling 後仍可拖曳可見卡片，且視口外卡片不渲染", () => {
    const view = render(<Canvas />);
    const root = getCanvasRoot(view.container);

    expect(
      root.querySelector('[data-card-node-id="text-offscreen"]'),
    ).toBeNull();

    const handle = root.querySelector(
      '[data-card-node-id="text-visible"] .card-widget__handle',
    ) as HTMLDivElement | null;
    if (!handle) {
      throw new Error("visible drag handle not found");
    }

    fireEvent.pointerDown(handle, {
      pointerType: "mouse",
      button: 0,
      pointerId: 1,
      clientX: 200,
      clientY: 180,
    });
    fireEvent.pointerMove(handle, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 260,
      clientY: 230,
    });
    fireEvent.pointerUp(handle, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 260,
      clientY: 230,
    });

    const movedNode = useCanvasStore.getState().nodes["text-visible"];
    expect(movedNode?.x).toBe(180);
    expect(movedNode?.y).toBe(150);
  });

  it("啟用 culling 後仍可用 wheel 平移畫布", async () => {
    const view = render(<Canvas />);
    const root = getCanvasRoot(view.container);

    fireEvent.wheel(root, {
      deltaX: 24,
      deltaY: -40,
      clientX: 240,
      clientY: 160,
    });

    await flushAnimationFrame();

    const viewport = useCanvasStore.getState().viewport;
    expect(viewport.x).toBe(-24);
    expect(viewport.y).toBe(40);
    expect(viewport.zoom).toBe(1);
  });

  it("啟用 culling 後 Ctrl+Wheel 仍以滑鼠位置為中心縮放", async () => {
    seedCanvasState({ x: 100, y: 80, zoom: 1 });
    const view = render(<Canvas />);
    const root = getCanvasRoot(view.container);

    fireEvent.wheel(root, {
      ctrlKey: true,
      deltaY: -120,
      clientX: 300,
      clientY: 200,
    });

    await flushAnimationFrame();

    const viewport = useCanvasStore.getState().viewport;
    const expectedZoom = 1 * ZOOM_STEP;
    expect(viewport.zoom).toBeCloseTo(expectedZoom);
    expect(viewport.x).toBeCloseTo(300 - (300 - 100) * expectedZoom);
    expect(viewport.y).toBeCloseTo(200 - (200 - 80) * expectedZoom);
  });
});
