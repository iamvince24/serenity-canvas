import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import type { SidebarProps } from "../../components/layout/Sidebar";
import { DashboardPage } from "../DashboardPage";

const {
  loadBoards,
  createBoard,
  renameBoard,
  deleteBoard,
  removeBoardSnapshot,
} = vi.hoisted(() => ({
  loadBoards: vi.fn(),
  createBoard: vi.fn(),
  renameBoard: vi.fn(),
  deleteBoard: vi.fn(),
  removeBoardSnapshot: vi.fn(),
}));

let mockBoards: SidebarProps["boards"] = [];
let mockActiveBoardId: string | null = null;
const setActiveBoardId = vi.fn();
let latestSidebarProps: SidebarProps | null = null;

vi.mock("../../stores/dashboardStore", () => ({
  useDashboardStore: () => ({
    boards: mockBoards,
    activeBoardId: mockActiveBoardId,
    loadBoards,
    setActiveBoardId,
    createBoard,
    renameBoard,
    deleteBoard,
  }),
}));

vi.mock("../../components/layout/Sidebar", () => ({
  Sidebar: (props: SidebarProps) => {
    latestSidebarProps = props;
    return <div data-testid="sidebar" />;
  },
}));

vi.mock("../../stores/boardSnapshotStorage", () => ({
  removeBoardSnapshot,
}));

vi.mock("../CanvasPage", () => ({
  CanvasPage: ({ boardId }: { boardId: string }) => (
    <div data-testid="canvas-page">{boardId}</div>
  ),
}));

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    localStorage.clear();
    mockBoards = [
      {
        id: "board-1",
        title: "Board 1",
        createdAt: 1,
        updatedAt: 1,
        nodeCount: 0,
      },
      {
        id: "board-2",
        title: "Board 2",
        createdAt: 2,
        updatedAt: 2,
        nodeCount: 0,
      },
    ];
    mockActiveBoardId = "board-1";
    latestSidebarProps = null;
    loadBoards.mockReset();
    createBoard.mockReset();
    renameBoard.mockReset();
    deleteBoard.mockReset();
    removeBoardSnapshot.mockReset();
    setActiveBoardId.mockReset();
  });

  it("渲染 Sidebar 並傳入必要 props", () => {
    renderDashboard();

    expect(screen.getByTestId("sidebar")).toBeTruthy();
    expect(loadBoards).toHaveBeenCalledTimes(1);
    expect(latestSidebarProps).not.toBeNull();
    expect(latestSidebarProps?.boards).toEqual(mockBoards);
    expect(latestSidebarProps?.activeBoardId).toBe("board-1");
    expect(latestSidebarProps?.isOpen).toBe(true);
    expect(typeof latestSidebarProps?.setIsOpen).toBe("function");
    expect(latestSidebarProps?.onSelectBoard).toBe(setActiveBoardId);
    expect(latestSidebarProps?.onCreateBoard).toBe(createBoard);
    expect(latestSidebarProps?.onRenameBoard).toBe(renameBoard);
    expect(typeof latestSidebarProps?.onDeleteBoard).toBe("function");
  });

  it("activeBoardId 為 null 時不渲染 CanvasPage", () => {
    mockActiveBoardId = null;
    renderDashboard();
    expect(screen.queryByTestId("canvas-page")).toBeNull();
  });

  it("activeBoardId 存在時渲染 CanvasPage 並傳入 boardId", () => {
    mockActiveBoardId = "board-2";
    renderDashboard();
    expect(screen.getByTestId("canvas-page").textContent).toBe("board-2");
  });

  it("isOpen = false 時顯示展開按鈕，點擊後會展開", () => {
    localStorage.setItem("serenity-canvas:sidebar-open", "false");
    renderDashboard();

    const openButton = screen.getByRole("button", {
      name: "dashboard.sidebar.expand",
    });
    expect(openButton).toBeTruthy();
    expect(latestSidebarProps?.isOpen).toBe(false);

    fireEvent.click(openButton);

    expect(latestSidebarProps?.isOpen).toBe(true);
    expect(localStorage.getItem("serenity-canvas:sidebar-open")).toBe("true");
  });

  it("刪除 board 會呼叫 deleteBoard 和 removeBoardSnapshot", () => {
    renderDashboard();

    act(() => {
      latestSidebarProps?.onDeleteBoard("board-2");
    });

    expect(deleteBoard).toHaveBeenCalledWith("board-2");
    expect(removeBoardSnapshot).toHaveBeenCalledWith("board-2");
  });
});
