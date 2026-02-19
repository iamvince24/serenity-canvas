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

describe("CardWidget layer ordering actions", () => {
  beforeEach(() => {
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
        "img-1": {
          id: "img-1",
          type: "image",
          x: 20,
          y: 20,
          width: 320,
          height: 300,
          heightMode: "fixed",
          color: null,
          content: "image",
          asset_id: "asset-1",
        },
        "text-2": {
          id: "text-2",
          type: "text",
          x: 40,
          y: 40,
          width: 280,
          height: 240,
          heightMode: "fixed",
          color: null,
          contentMarkdown: "second",
        },
      },
      nodeOrder: ["text-1", "img-1", "text-2"],
      files: {},
      selectedNodeIds: ["text-1"],
      interactionState: InteractionState.Idle,
    });
  });

  it("點擊 Bring to Front 會只在文字子序列中重排", () => {
    const node = useCanvasStore.getState().nodes["text-1"];
    if (!node || node.type !== "text") {
      throw new Error("text node not found");
    }

    render(<CardWidget node={node} zoom={1} layerIndex={0} />);

    fireEvent.click(screen.getByRole("button", { name: "Open card settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Bring to Front" }));

    expect(useCanvasStore.getState().nodeOrder).toEqual([
      "text-2",
      "img-1",
      "text-1",
    ]);
  });

  it("文字已在最上層時，前移按鈕 disabled", () => {
    useCanvasStore.setState({
      selectedNodeIds: ["text-2"],
    });
    const node = useCanvasStore.getState().nodes["text-2"];
    if (!node || node.type !== "text") {
      throw new Error("text node not found");
    }

    render(<CardWidget node={node} zoom={1} layerIndex={2} />);

    fireEvent.click(screen.getByRole("button", { name: "Open card settings" }));

    const bringToFrontButton = screen.getByRole("button", {
      name: "Bring to Front",
    }) as HTMLButtonElement;
    const bringForwardButton = screen.getByRole("button", {
      name: "Bring Forward",
    }) as HTMLButtonElement;
    expect(bringToFrontButton.disabled).toBe(true);
    expect(bringForwardButton.disabled).toBe(true);
  });

  it("選取但非拖曳/縮放時，zIndex 直接使用 layerIndex", () => {
    const node = useCanvasStore.getState().nodes["text-1"];
    if (!node || node.type !== "text") {
      throw new Error("text node not found");
    }

    render(<CardWidget node={node} zoom={1} layerIndex={0} />);

    const card = document.querySelector(
      '[data-card-node-id="text-1"]',
    ) as HTMLDivElement | null;
    if (!card) {
      throw new Error("card element not found");
    }

    expect(card.style.zIndex).toBe("0");
  });
});
