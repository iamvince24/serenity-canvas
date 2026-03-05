import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../stores/canvasStore";
import { InteractionState } from "../core/stateMachine";
import { Toolbar } from "../Toolbar";

vi.mock("../images/useImageUpload", () => ({
  useImageUpload: () => ({
    uploadImageFile: vi.fn(),
  }),
}));

vi.mock("@/components/auth/AuthModal", () => ({
  AuthModal: () => null,
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (s: { user: null }) => unknown) =>
    selector({ user: null }),
}));

function resetStore() {
  useCanvasStore.getState().clearHistory();
  useCanvasStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: {},
    nodeOrder: [],
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

describe("Toolbar canvas mode toggle", () => {
  beforeEach(() => {
    resetStore();
  });

  it("aria-pressed 會反映目前 active mode", () => {
    render(
      <MemoryRouter>
        <Toolbar />
      </MemoryRouter>,
    );

    const selectButton = screen.getByRole("button", {
      name: "toolbar.mode.select",
    });
    const connectButton = screen.getByRole("button", {
      name: "toolbar.mode.connect",
    });

    expect(selectButton.getAttribute("aria-pressed")).toBe("true");
    expect(connectButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(connectButton);

    expect(useCanvasStore.getState().canvasMode).toBe("connect");
    expect(selectButton.getAttribute("aria-pressed")).toBe("false");
    expect(connectButton.getAttribute("aria-pressed")).toBe("true");
  });
});
