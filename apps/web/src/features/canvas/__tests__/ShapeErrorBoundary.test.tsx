import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShapeErrorBoundary } from "../ShapeErrorBoundary";

function MaybeCrash({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("shape crashed");
  }

  return <div>healthy-shape</div>;
}

describe("ShapeErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("單一 shape 失敗時不影響其他 shape", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <>
        <ShapeErrorBoundary shapeId="shape-broken">
          <MaybeCrash shouldThrow />
        </ShapeErrorBoundary>
        <ShapeErrorBoundary shapeId="shape-ok">
          <MaybeCrash shouldThrow={false} />
        </ShapeErrorBoundary>
      </>,
    );

    expect(screen.queryByText("shape crashed")).toBeNull();
    expect(screen.getByText("healthy-shape")).toBeTruthy();
  });
});
