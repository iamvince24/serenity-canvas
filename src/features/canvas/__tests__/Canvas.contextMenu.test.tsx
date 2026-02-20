import { forwardRef, type ReactNode, type Ref } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../stores/canvasStore";
import type { CardEditorHandle } from "../editor/CardEditor";
import { Canvas } from "../Canvas";
import { InteractionState } from "../core/stateMachine";

vi.mock("react-konva", () => ({
  Stage: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-stage">{children}</div>
  ),
  Layer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => null,
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

describe("Canvas node context menu actions", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );

    useCanvasStore.getState().clearHistory();
    useCanvasStore.setState({
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: {
        "text-1": {
          id: "text-1",
          type: "text",
          x: 0,
          y: 0,
          width: 280,
          height: 240,
          heightMode: "fixed",
          color: null,
          contentMarkdown: "first",
        },
      },
      nodeOrder: ["text-1"],
      files: {},
      edges: {},
      selectedNodeIds: [],
      selectedEdgeIds: [],
      canvasMode: "select",
      interactionState: InteractionState.Idle,
      canUndo: false,
      canRedo: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("文字卡片右鍵選單可執行 Fit Content 與改色", () => {
    const view = render(<Canvas />);
    const card = view.container.querySelector(
      '[data-card-node-id="text-1"]',
    ) as HTMLDivElement | null;
    if (!card) {
      throw new Error("card element not found");
    }

    fireEvent.contextMenu(card, { clientX: 180, clientY: 160 });
    fireEvent.click(screen.getByRole("button", { name: "Fit Content" }));

    const fittedNode = useCanvasStore.getState().nodes["text-1"];
    if (!fittedNode || fittedNode.type !== "text") {
      throw new Error("text node not found");
    }
    expect(fittedNode.heightMode).toBe("auto");

    fireEvent.contextMenu(card, { clientX: 200, clientY: 200 });
    fireEvent.click(
      screen.getByRole("button", { name: "Set card color to Red" }),
    );

    const coloredNode = useCanvasStore.getState().nodes["text-1"];
    if (!coloredNode || coloredNode.type !== "text") {
      throw new Error("text node not found");
    }
    expect(coloredNode.color).toBe("red");
  });
});
