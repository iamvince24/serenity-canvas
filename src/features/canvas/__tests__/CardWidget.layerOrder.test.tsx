import { forwardRef, type Ref } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../stores/canvasStore";
import { InteractionState } from "../stateMachine";
import type { CardEditorHandle } from "../CardEditor";
import { CardWidget } from "../CardWidget";

vi.mock("../CardEditor", () => ({
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

vi.mock("../ResizeHandle", () => ({
  LeftWidthResizeHandle: () => null,
  WidthResizeHandle: () => null,
  HeightResizeHandle: () => null,
  CornerResizeHandle: () => null,
}));

vi.mock("../useDragHandle", () => ({
  useDragHandle: () => ({}),
}));

describe("CardWidget context menu behavior", () => {
  beforeEach(() => {
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

  it("右鍵卡片會觸發設定選單 callback", () => {
    const node = useCanvasStore.getState().nodes["text-1"];
    if (!node || node.type !== "text") {
      throw new Error("text node not found");
    }

    const onOpenContextMenu = vi.fn();
    render(
      <CardWidget
        node={node}
        zoom={1}
        layerIndex={0}
        onOpenContextMenu={onOpenContextMenu}
      />,
    );

    const card = document.querySelector(
      '[data-card-node-id="text-1"]',
    ) as HTMLDivElement | null;
    if (!card) {
      throw new Error("card element not found");
    }

    fireEvent.contextMenu(card, { clientX: 120, clientY: 180 });

    expect(onOpenContextMenu).toHaveBeenCalledWith({
      nodeId: "text-1",
      nodeType: "text",
      clientX: 120,
      clientY: 180,
    });
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
  });

  it("不再顯示卡片齒輪設定按鈕", () => {
    const node = useCanvasStore.getState().nodes["text-1"];
    if (!node || node.type !== "text") {
      throw new Error("text node not found");
    }

    render(
      <CardWidget
        node={node}
        zoom={1}
        layerIndex={0}
        onOpenContextMenu={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Open card settings" }),
    ).toBeNull();
  });

  it("選取但非拖曳/縮放時，zIndex 直接使用 layerIndex", () => {
    useCanvasStore.setState({ selectedNodeIds: ["text-1"] });
    const node = useCanvasStore.getState().nodes["text-1"];
    if (!node || node.type !== "text") {
      throw new Error("text node not found");
    }

    render(
      <CardWidget
        node={node}
        zoom={1}
        layerIndex={0}
        onOpenContextMenu={vi.fn()}
      />,
    );

    const card = document.querySelector(
      '[data-card-node-id="text-1"]',
    ) as HTMLDivElement | null;
    if (!card) {
      throw new Error("card element not found");
    }

    expect(card.style.zIndex).toBe("0");
  });
});
