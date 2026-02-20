import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../stores/canvasStore";
import { InteractionState } from "../stateMachine";
import { Toolbar } from "../Toolbar";

vi.mock("../useImageUpload", () => ({
  useImageUpload: () => ({
    uploadImageFile: vi.fn(),
  }),
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

describe("Toolbar canvas mode toggle", () => {
  beforeEach(() => {
    resetStore();
  });

  it("aria-pressed 會反映目前 active mode", () => {
    render(<Toolbar />);

    const selectButton = screen.getByRole("button", { name: "Select mode" });
    const connectButton = screen.getByRole("button", { name: "Connect mode" });

    expect(selectButton.getAttribute("aria-pressed")).toBe("true");
    expect(connectButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(connectButton);

    expect(useCanvasStore.getState().canvasMode).toBe("connect");
    expect(selectButton.getAttribute("aria-pressed")).toBe("false");
    expect(connectButton.getAttribute("aria-pressed")).toBe("true");
  });
});
