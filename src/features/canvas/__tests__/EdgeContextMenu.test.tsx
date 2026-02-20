import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../stores/canvasStore";
import { InteractionState } from "../stateMachine";
import { EdgeContextMenu } from "../EdgeContextMenu";

function resetStore() {
  useCanvasStore.getState().clearHistory();
  useCanvasStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: {
      "text-1": {
        id: "text-1",
        type: "text",
        x: 40,
        y: 40,
        width: 280,
        height: 240,
        heightMode: "auto",
        color: null,
        contentMarkdown: "first",
      },
      "text-2": {
        id: "text-2",
        type: "text",
        x: 400,
        y: 140,
        width: 280,
        height: 240,
        heightMode: "fixed",
        color: null,
        contentMarkdown: "second",
      },
    },
    nodeOrder: ["text-1", "text-2"],
    files: {},
    edges: {
      "edge-1": {
        id: "edge-1",
        fromNode: "text-1",
        toNode: "text-2",
        direction: "forward",
        label: "",
        lineStyle: "solid",
        color: null,
      },
    },
    selectedNodeIds: [],
    selectedEdgeIds: [],
    canvasMode: "select",
    interactionState: InteractionState.Idle,
    canUndo: false,
    canRedo: false,
  });
}

describe("EdgeContextMenu", () => {
  beforeEach(() => {
    resetStore();
  });

  it("可編輯線型、顏色與方向", () => {
    render(
      <EdgeContextMenu
        edgeId="edge-1"
        clientX={200}
        clientY={180}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Set line style to Dotted" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Set edge color to Red" }),
    );
    fireEvent.change(screen.getByLabelText("Direction"), {
      target: { value: "both" },
    });

    const edge = useCanvasStore.getState().edges["edge-1"];
    expect(edge?.lineStyle).toBe("dotted");
    expect(edge?.color).toBe("red");
    expect(edge?.direction).toBe("both");
  });

  it("點擊外部會關閉選單", () => {
    const onClose = vi.fn();
    render(
      <EdgeContextMenu
        edgeId="edge-1"
        clientX={200}
        clientY={180}
        onClose={onClose}
      />,
    );

    fireEvent.pointerDown(document.body);

    expect(onClose).toHaveBeenCalled();
  });

  it("edge 不存在時會自動關閉", async () => {
    const onClose = vi.fn();
    render(
      <EdgeContextMenu
        edgeId="missing-edge"
        clientX={200}
        clientY={180}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
