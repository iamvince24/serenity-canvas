import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CanvasNode, Edge } from "../../../types/canvas";
import { EdgeLine } from "../EdgeLine";

vi.mock("../EdgeLabel", () => ({
  EdgeLabel: () => null,
}));

vi.mock("../edgeLabelLayout", () => ({
  getEdgeLabelLayout: (label: string) =>
    label.trim()
      ? {
          text: label.trim(),
          width: 48,
          height: 20,
          textWidth: 32,
          textHeight: 14,
        }
      : null,
}));

vi.mock("react-konva", () => ({
  Arrow: ({ children }: { children?: ReactNode }) => (
    <div data-testid="edge-arrow">{children}</div>
  ),
  Line: () => <div data-testid="edge-label-gap" />,
  Circle: ({
    onMouseDown,
    onMouseEnter,
    onMouseLeave,
  }: {
    onMouseDown?: (event: {
      evt: {
        clientX: number;
        clientY: number;
        preventDefault: () => void;
      };
      cancelBubble: boolean;
    }) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }) => (
    <button
      type="button"
      data-testid="edge-endpoint-handle"
      onMouseDown={(event) =>
        onMouseDown?.({
          evt: {
            clientX: event.clientX,
            clientY: event.clientY,
            preventDefault: () => {},
          },
          cancelBubble: false,
        })
      }
      onMouseEnter={() => onMouseEnter?.()}
      onMouseLeave={() => onMouseLeave?.()}
    />
  ),
}));

function createTextNode(id: string, x: number, y: number): CanvasNode {
  return {
    id,
    type: "text",
    x,
    y,
    width: 200,
    height: 120,
    heightMode: "auto",
    color: null,
    contentMarkdown: id,
  };
}

function createEdge(id: string): Edge {
  return {
    id,
    fromNode: "text-1",
    toNode: "text-2",
    direction: "forward",
    label: "TEST",
    lineStyle: "solid",
    color: null,
  };
}

describe("EdgeLine endpoint handles", () => {
  const nodes: Record<string, CanvasNode> = {
    "text-1": createTextNode("text-1", 0, 0),
    "text-2": createTextNode("text-2", 400, 0),
  };

  it("does not render endpoint handles when disabled", () => {
    render(
      <EdgeLine
        edge={createEdge("edge-1")}
        nodes={nodes}
        isSelected
        onSelect={vi.fn()}
        onContextMenu={vi.fn()}
        onDblClick={vi.fn()}
        showEndpointHandles={false}
        endpointPreview={null}
        onEndpointDragStart={vi.fn()}
      />,
    );

    expect(screen.queryAllByTestId("edge-endpoint-handle")).toHaveLength(0);
    expect(screen.getByTestId("edge-label-gap")).toBeTruthy();
  });

  it("renders endpoint handles and triggers drag start callbacks", () => {
    const onSelect = vi.fn();
    const onEndpointDragStart = vi.fn();
    render(
      <EdgeLine
        edge={createEdge("edge-1")}
        nodes={nodes}
        isSelected
        onSelect={onSelect}
        onContextMenu={vi.fn()}
        onDblClick={vi.fn()}
        showEndpointHandles
        endpointPreview={null}
        onEndpointDragStart={onEndpointDragStart}
      />,
    );

    const handles = screen.getAllByTestId("edge-endpoint-handle");
    expect(handles).toHaveLength(2);

    fireEvent.mouseDown(handles[0], { clientX: 120, clientY: 60 });
    fireEvent.mouseDown(handles[1], { clientX: 460, clientY: 60 });

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onEndpointDragStart).toHaveBeenNthCalledWith(
      1,
      "edge-1",
      "from",
      120,
      60,
    );
    expect(onEndpointDragStart).toHaveBeenNthCalledWith(
      2,
      "edge-1",
      "to",
      460,
      60,
    );
  });

  it("does not render label gap when label is empty", () => {
    render(
      <EdgeLine
        edge={{ ...createEdge("edge-1"), label: "" }}
        nodes={nodes}
        isSelected
        onSelect={vi.fn()}
        onContextMenu={vi.fn()}
        onDblClick={vi.fn()}
        showEndpointHandles={false}
        endpointPreview={null}
        onEndpointDragStart={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("edge-label-gap")).toBeNull();
  });

  it("renders label gap immediately when forced in editing state", () => {
    render(
      <EdgeLine
        edge={{ ...createEdge("edge-1"), label: "" }}
        nodes={nodes}
        isSelected
        onSelect={vi.fn()}
        onContextMenu={vi.fn()}
        onDblClick={vi.fn()}
        forceLabelGap
        showEndpointHandles={false}
        endpointPreview={null}
        onEndpointDragStart={vi.fn()}
      />,
    );

    expect(screen.getByTestId("edge-label-gap")).toBeTruthy();
  });
});
