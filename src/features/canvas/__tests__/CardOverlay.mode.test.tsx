import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../stores/canvasStore";
import type { TextNode } from "../../../types/canvas";
import { InteractionState } from "../core/stateMachine";
import { CardOverlay } from "../card/CardOverlay";

vi.mock("../card/CardWidget", () => ({
  CardWidget: () => null,
}));

vi.mock("../images/ImageCaptionWidget", () => ({
  ImageCaptionWidget: () => null,
}));

const textNode: TextNode = {
  id: "text-1",
  type: "text",
  x: 100,
  y: 120,
  width: 280,
  height: 240,
  heightMode: "auto",
  color: null,
  contentMarkdown: "test",
};

function resetStore(canvasMode: "select" | "connect") {
  useCanvasStore.getState().clearHistory();
  useCanvasStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: {},
    nodeOrder: [],
    files: {},
    edges: {},
    selectedNodeIds: [],
    selectedEdgeIds: [],
    canvasMode,
    interactionState: InteractionState.Idle,
    canUndo: false,
    canRedo: false,
  });
}

describe("CardOverlay anchor visibility by canvas mode", () => {
  beforeEach(() => {
    resetStore("select");
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("select 模式下不顯示 anchors", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    render(
      <CardOverlay
        container={container}
        nodes={{ [textNode.id]: textNode }}
        nodeOrder={[textNode.id]}
        viewport={{ x: 0, y: 0, zoom: 1 }}
        selectedNodeIds={[]}
        hoveredNodeId={textNode.id}
        connectingSource={null}
        hoveredTarget={null}
        onAnchorPointerDown={() => {}}
        onOpenContextMenu={() => {}}
      />,
    );

    expect(screen.queryAllByLabelText(/Connect from/)).toHaveLength(0);
  });

  it("connect 模式下 hover 會顯示 anchors", () => {
    resetStore("connect");
    const container = document.createElement("div");
    document.body.appendChild(container);

    render(
      <CardOverlay
        container={container}
        nodes={{ [textNode.id]: textNode }}
        nodeOrder={[textNode.id]}
        viewport={{ x: 0, y: 0, zoom: 1 }}
        selectedNodeIds={[]}
        hoveredNodeId={textNode.id}
        connectingSource={null}
        hoveredTarget={null}
        onAnchorPointerDown={() => {}}
        onOpenContextMenu={() => {}}
      />,
    );

    expect(screen.queryAllByLabelText(/Connect from/)).toHaveLength(4);
  });
});
