import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../stores/canvasStore";
import { InteractionState } from "../core/stateMachine";
import { NodeContextMenu } from "../nodes/NodeContextMenu";

describe("NodeContextMenu", () => {
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
      },
      nodeOrder: ["text-1", "img-1"],
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

  it("文字卡片右鍵選單可執行 Fit Content，且不顯示圖層按鈕", () => {
    const onClose = vi.fn();
    render(
      <NodeContextMenu
        nodeId="text-1"
        nodeType="text"
        clientX={100}
        clientY={120}
        onClose={onClose}
      />,
    );

    const fitContentButton = screen.getByRole("button", {
      name: "Fit Content",
    });
    fireEvent.click(fitContentButton);

    const node = useCanvasStore.getState().nodes["text-1"];
    if (!node || node.type !== "text") {
      throw new Error("text node not found");
    }

    expect(node.heightMode).toBe("auto");
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Bring to front" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send to back" })).toBeNull();
  });

  it("圖片卡片右鍵選單可刪除節點", () => {
    const onClose = vi.fn();
    render(
      <NodeContextMenu
        nodeId="img-1"
        nodeType="image"
        clientX={150}
        clientY={180}
        onClose={onClose}
      />,
    );

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteButton);

    expect(useCanvasStore.getState().nodes["img-1"]).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });

  it("在不支援 composedPath 時，點擊項目仍可生效", () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    const originalComposedPath = Event.prototype.composedPath;
    Object.defineProperty(Event.prototype, "composedPath", {
      value: undefined,
      configurable: true,
    });

    try {
      const onClose = vi.fn();
      render(
        <NodeContextMenu
          nodeId="text-1"
          nodeType="text"
          clientX={100}
          clientY={120}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Fit Content" }));

      const node = useCanvasStore.getState().nodes["text-1"];
      if (!node || node.type !== "text") {
        throw new Error("text node not found");
      }
      expect(node.heightMode).toBe("auto");
      expect(onClose).toHaveBeenCalled();
    } finally {
      Object.defineProperty(Event.prototype, "composedPath", {
        value: originalComposedPath,
        configurable: true,
      });
    }
  });
});
