import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let matchMediaMatches = false;

beforeEach(() => {
  matchMediaMatches = false;
  localStorage.clear();

  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: matchMediaMatches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function renderDialog() {
  const { MobileWarningDialog } = await import("../MobileWarningDialog");
  return render(<MobileWarningDialog />);
}

describe("MobileWarningDialog", () => {
  it("does not show on desktop", async () => {
    matchMediaMatches = false;
    await renderDialog();

    expect(screen.queryByText("canvas.mobileWarning.title")).toBeNull();
  });

  it("shows on mobile device", async () => {
    matchMediaMatches = true;
    await renderDialog();

    expect(screen.queryByText("canvas.mobileWarning.title")).not.toBeNull();
  });

  it("does not show when previously dismissed", async () => {
    matchMediaMatches = true;
    localStorage.setItem("serenity-canvas:mobile-warning-dismissed", "true");
    await renderDialog();

    expect(screen.queryByText("canvas.mobileWarning.title")).toBeNull();
  });

  it("does not persist dismiss when checkbox is unchecked", async () => {
    matchMediaMatches = true;
    await renderDialog();

    fireEvent.click(screen.getByText("canvas.mobileWarning.confirm"));

    expect(
      localStorage.getItem("serenity-canvas:mobile-warning-dismissed"),
    ).toBeNull();
  });

  it("persists dismiss when checkbox is checked and confirmed", async () => {
    matchMediaMatches = true;
    await renderDialog();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("canvas.mobileWarning.confirm"));

    expect(
      localStorage.getItem("serenity-canvas:mobile-warning-dismissed"),
    ).toBe("true");
  });
});
