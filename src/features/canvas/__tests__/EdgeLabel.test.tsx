import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { EdgeLabel } from "../edges/EdgeLabel";

vi.mock("react-konva", () => ({
  Group: ({ children }: { children: ReactNode }) => (
    <div data-testid="edge-label-group">{children}</div>
  ),
  Text: ({ text }: { text: string }) => (
    <div data-testid="edge-label-text">{text}</div>
  ),
}));

describe("EdgeLabel", () => {
  it("renders plain text label without a box", () => {
    render(
      <EdgeLabel
        x={120}
        y={80}
        label="TEST"
        edgeColor="red"
        onSelect={vi.fn()}
        onDblClick={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );

    expect(screen.getByTestId("edge-label-text").textContent).toBe("TEST");
  });

  it("returns null when label is empty", () => {
    render(
      <EdgeLabel
        x={120}
        y={80}
        label="   "
        edgeColor={null}
        onSelect={vi.fn()}
        onDblClick={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("edge-label-text")).toBeNull();
  });
});
