import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/pages/CanvasPage", () => ({
  CanvasPage: ({ boardId }: { boardId: string }) => (
    <div data-testid="canvas-page">{boardId}</div>
  ),
}));

let mockUser: { id: string; email: string; user_metadata: object } | null =
  null;
let mockLoading = false;

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (
    selector: (s: { user: typeof mockUser; loading: boolean }) => unknown,
  ) => selector({ user: mockUser, loading: mockLoading }),
}));

import { CanvasRouteGuard } from "../CanvasRouteGuard";

function renderWithRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/canvas/:id" element={<CanvasRouteGuard />} />
        <Route path="/dashboard" element={<div data-testid="dashboard" />} />
        <Route path="/" element={<div data-testid="home" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CanvasRouteGuard", () => {
  beforeEach(() => {
    mockUser = null;
    mockLoading = false;
  });

  it("local-board + loading → shows spinner", () => {
    mockLoading = true;
    renderWithRoute("/canvas/local-board");

    expect(screen.queryByTestId("canvas-page")).toBeNull();
    expect(screen.queryByTestId("dashboard")).toBeNull();
  });

  it("local-board + user exists → redirects to /dashboard", () => {
    mockUser = {
      id: "u1",
      email: "a@b.com",
      user_metadata: {},
    };
    renderWithRoute("/canvas/local-board");

    expect(screen.getByTestId("dashboard")).toBeTruthy();
  });

  it("local-board + no user → renders CanvasPage", () => {
    renderWithRoute("/canvas/local-board");

    const page = screen.getByTestId("canvas-page");
    expect(page).toBeTruthy();
    expect(page.textContent).toBe("local-board");
  });

  it("other board + no user → redirects to /", () => {
    renderWithRoute("/canvas/some-uuid");

    expect(screen.getByTestId("home")).toBeTruthy();
  });

  it("other board + user exists → renders CanvasPage", () => {
    mockUser = {
      id: "u1",
      email: "a@b.com",
      user_metadata: {},
    };
    renderWithRoute("/canvas/some-uuid");

    const page = screen.getByTestId("canvas-page");
    expect(page).toBeTruthy();
    expect(page.textContent).toBe("some-uuid");
  });
});
