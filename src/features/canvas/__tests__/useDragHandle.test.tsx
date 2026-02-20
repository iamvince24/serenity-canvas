import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "../../../stores/canvasStore";
import { InteractionState } from "../core/stateMachine";
import { useDragHandle } from "../card/useDragHandle";

function TestDragHandle() {
  const dragHandleProps = useDragHandle({ nodeId: "text-1", zoom: 1 });

  return <div data-testid="drag-handle" {...dragHandleProps} />;
}

describe("useDragHandle shift toggle", () => {
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
          heightMode: "auto",
          color: null,
          contentMarkdown: "text-1",
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

  it("Shift+PointerDown 會 toggle，不進入拖曳狀態", () => {
    render(<TestDragHandle />);
    const handle = screen.getByTestId("drag-handle");

    fireEvent.pointerDown(handle, {
      pointerType: "mouse",
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      shiftKey: true,
    });

    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
    expect(useCanvasStore.getState().interactionState).toBe(
      InteractionState.Idle,
    );

    fireEvent.pointerDown(handle, {
      pointerType: "mouse",
      button: 0,
      pointerId: 2,
      clientX: 100,
      clientY: 100,
      shiftKey: true,
    });

    expect(useCanvasStore.getState().selectedNodeIds).toEqual([]);
    expect(useCanvasStore.getState().interactionState).toBe(
      InteractionState.Idle,
    );
  });
});
