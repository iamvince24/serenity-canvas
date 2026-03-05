import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../stores/canvasStore";
import type { TextNode } from "../../../types/canvas";
import { Canvas } from "../Canvas";
import { InteractionState } from "../core/stateMachine";

vi.mock("react-konva", () => ({
  Stage: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-stage">{children}</div>
  ),
  Layer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => null,
  Rect: ({
    onContextMenu,
    onMouseDown,
    onTouchStart,
  }: {
    onContextMenu?: (event: unknown) => void;
    onMouseDown?: (event: unknown) => void;
    onTouchStart?: (event: unknown) => void;
  }) => (
    <div
      data-testid={onContextMenu ? "mock-group-rect" : "mock-rect"}
      onContextMenu={(event) =>
        onContextMenu?.({
          cancelBubble: false,
          evt: event.nativeEvent,
        })
      }
      onMouseDown={(event) =>
        onMouseDown?.({
          cancelBubble: false,
          evt: event.nativeEvent,
        })
      }
      onTouchStart={(event) =>
        onTouchStart?.({
          cancelBubble: false,
          evt: event.nativeEvent,
        })
      }
    />
  ),
  Text: () => null,
}));

vi.mock("../card/CardOverlay", () => ({
  CardOverlay: () => null,
}));

vi.mock("../edges/EdgeLine", () => ({
  EdgeLine: () => null,
}));

vi.mock("../images/ImageCanvasNode", () => ({
  ImageCanvasNode: () => null,
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

vi.mock("../hooks/useCanvasWheel", () => ({
  useCanvasWheel: () => {},
}));

vi.mock("../images/useImageUpload", () => ({
  useImageUpload: () => ({
    uploadImageFile: vi.fn(),
  }),
}));

function createTextNode(id: string, x = 0, y = 0): TextNode {
  return {
    id,
    type: "text",
    x,
    y,
    width: 280,
    height: 240,
    heightMode: "fixed",
    color: null,
    contentMarkdown: id,
  };
}

function seedCanvasState(options?: {
  selectedNodeIds?: string[];
  selectedGroupIds?: string[];
}) {
  const nodeA = createTextNode("text-1", 0, 0);
  const nodeB = createTextNode("text-2", 320, 0);

  useCanvasStore.getState().clearHistory();
  useCanvasStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: {
      [nodeA.id]: nodeA,
      [nodeB.id]: nodeB,
    },
    nodeOrder: [nodeA.id, nodeB.id],
    files: {},
    edges: {},
    groups: {
      "group-1": {
        id: "group-1",
        label: "Group One",
        color: null,
        nodeIds: [nodeA.id, nodeB.id],
      },
    },
    selectedNodeIds: options?.selectedNodeIds ?? [],
    selectedEdgeIds: [],
    selectedGroupIds: options?.selectedGroupIds ?? [],
    canvasMode: "select",
    interactionState: InteractionState.Idle,
    canUndo: false,
    canRedo: false,
  });
}

describe("Canvas group interactions", () => {
  beforeEach(() => {
    seedCanvasState();
  });

  afterEach(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  it("選取 group 後按 Delete 只刪 group，保留群組內節點", () => {
    seedCanvasState({ selectedGroupIds: ["group-1"] });
    render(<Canvas />);

    fireEvent.keyDown(window, { key: "Delete" });
    const state = useCanvasStore.getState();

    expect(state.groups["group-1"]).toBeUndefined();
    expect(state.nodes["text-1"]).toBeDefined();
    expect(state.nodes["text-2"]).toBeDefined();
  });

  it("node + group 同時選取時按 Delete，僅刪 node（Gate C）", () => {
    seedCanvasState({
      selectedNodeIds: ["text-1"],
      selectedGroupIds: ["group-1"],
    });
    render(<Canvas />);

    fireEvent.keyDown(window, { key: "Delete" });
    const state = useCanvasStore.getState();

    expect(state.nodes["text-1"]).toBeUndefined();
    expect(state.groups["group-1"]).toBeDefined();
    expect(state.groups["group-1"]?.nodeIds).toEqual(["text-2"]);
  });

  it("右鍵 group 框時會開啟 GroupContextMenu，而非 NodeContextMenu", () => {
    render(<Canvas />);
    fireEvent.contextMenu(screen.getByTestId("mock-group-rect"), {
      clientX: 220,
      clientY: 180,
    });

    expect(
      screen.getByRole("button", { name: "groupContext.rename" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "nodeContext.createGroup" }),
    ).toBeNull();
  });
});
