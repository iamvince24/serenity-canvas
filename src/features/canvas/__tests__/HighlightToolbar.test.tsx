import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HighlightToolbar } from "../editor/HighlightToolbar";

function createMockEditor(overrides?: Partial<Record<string, unknown>>) {
  return {
    state: { selection: { empty: false } },
    isEditable: true,
    on: vi.fn(),
    off: vi.fn(),
    chain: vi.fn(() => ({
      focus: vi.fn(() => ({
        setHighlight: vi.fn(() => ({ run: vi.fn() })),
        unsetHighlight: vi.fn(() => ({ run: vi.fn() })),
      })),
    })),
    getAttributes: vi.fn(() => ({})),
    storage: { highlight: { lastUsedColor: null } },
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// Mock getSelection to return a non-collapsed range
function mockGetSelection() {
  const original = window.getSelection;
  window.getSelection = vi.fn(
    () =>
      ({
        rangeCount: 1,
        isCollapsed: false,
        getRangeAt: () => ({
          getBoundingClientRect: () => ({
            left: 100,
            top: 200,
            right: 200,
            bottom: 220,
            width: 100,
            height: 20,
          }),
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
  );
  return () => {
    window.getSelection = original;
  };
}

describe("HighlightToolbar", () => {
  it("renders 3 color dots and an eraser button", () => {
    const cleanup = mockGetSelection();
    const editor = createMockEditor();

    // Trigger the selectionUpdate callback to set visible
    editor.on.mockImplementation(
      (event: string, callback: (...args: unknown[]) => void) => {
        if (event === "selectionUpdate") {
          // Call immediately to simulate a selection
          callback();
        }
      },
    );

    render(
      <HighlightToolbar
        editor={editor}
        hlColors={["#D6E0CE", "#F2E4D4", "#DAE6ED"]}
        borderColor="#E5E3DF"
      />,
    );

    const dot1 = screen.getByLabelText("Highlight color 1");
    const dot2 = screen.getByLabelText("Highlight color 2");
    const dot3 = screen.getByLabelText("Highlight color 3");
    const eraser = screen.getByLabelText("Remove highlight");

    expect(dot1).toBeDefined();
    expect(dot2).toBeDefined();
    expect(dot3).toBeDefined();
    expect(eraser).toBeDefined();

    cleanup();
  });

  it("color dot mousedown calls preventDefault", () => {
    const cleanup = mockGetSelection();
    const editor = createMockEditor();

    editor.on.mockImplementation(
      (event: string, callback: (...args: unknown[]) => void) => {
        if (event === "selectionUpdate") {
          callback();
        }
      },
    );

    render(
      <HighlightToolbar
        editor={editor}
        hlColors={["#D6E0CE", "#F2E4D4", "#DAE6ED"]}
        borderColor="#E5E3DF"
      />,
    );

    const dot1 = screen.getByLabelText("Highlight color 1");
    const event = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    dot1.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();

    cleanup();
  });
});
