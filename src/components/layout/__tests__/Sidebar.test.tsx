import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Board } from "../../../types/board";
import { Sidebar, type SidebarProps } from "../Sidebar";

const boards: Board[] = [
  { id: "board-1", title: "Board 1", createdAt: 1, updatedAt: 1 },
  { id: "board-2", title: "Board 2", createdAt: 2, updatedAt: 2 },
];

function renderSidebar(overrides: Partial<SidebarProps> = {}) {
  const setIsOpen = vi.fn();
  const onSelectBoard = vi.fn();
  const onCreateBoard = vi.fn();
  const onRenameBoard = vi.fn();
  const onDeleteBoard = vi.fn();

  const props: SidebarProps = {
    isOpen: true,
    setIsOpen,
    boards,
    activeBoardId: "board-1",
    onSelectBoard,
    onCreateBoard,
    onRenameBoard,
    onDeleteBoard,
    ...overrides,
  };

  render(<Sidebar {...props} />);

  return {
    setIsOpen,
    onSelectBoard,
    onCreateBoard,
    onRenameBoard,
    onDeleteBoard,
  };
}

describe("Sidebar", () => {
  it("isOpen 會切換 aside 寬度 class", () => {
    const { rerender } = render(
      <Sidebar
        isOpen
        setIsOpen={vi.fn()}
        boards={boards}
        activeBoardId="board-1"
        onSelectBoard={vi.fn()}
        onCreateBoard={vi.fn()}
        onRenameBoard={vi.fn()}
        onDeleteBoard={vi.fn()}
      />,
    );

    let aside = screen.getByLabelText("Collapse sidebar").closest("aside");
    if (!aside) {
      throw new Error("aside not found");
    }
    expect(aside.className.includes("w-64")).toBe(true);

    rerender(
      <Sidebar
        isOpen={false}
        setIsOpen={vi.fn()}
        boards={boards}
        activeBoardId="board-1"
        onSelectBoard={vi.fn()}
        onCreateBoard={vi.fn()}
        onRenameBoard={vi.fn()}
        onDeleteBoard={vi.fn()}
      />,
    );

    aside = screen.getByLabelText("Collapse sidebar").closest("aside");
    if (!aside) {
      throw new Error("aside not found");
    }
    expect(aside.className.includes("w-0")).toBe(true);
  });

  it("點擊收合按鈕會呼叫 setIsOpen(false)", () => {
    const { setIsOpen } = renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(setIsOpen).toHaveBeenCalledWith(false);
  });

  it("會渲染所有 boards", () => {
    renderSidebar();
    expect(screen.getByText("Board 1")).toBeTruthy();
    expect(screen.getByText("Board 2")).toBeTruthy();
  });

  it("active board 套用 active 樣式 class", () => {
    renderSidebar({ activeBoardId: "board-2" });
    const row = screen.getByText("Board 2").closest('[role="button"]');
    if (!row) {
      throw new Error("row not found");
    }

    expect(row.className.includes("bg-[#FFFFFF]")).toBe(true);
    expect(row.className.includes("border-[#E5E3DF]")).toBe(true);
  });

  it("hover board 時顯示 MoreHorizontal 按鈕", () => {
    renderSidebar();
    const row = screen.getByText("Board 1").closest('[role="button"]');
    if (!row) {
      throw new Error("row not found");
    }

    const actionButton = screen.getByRole("button", {
      name: "Board actions for Board 1",
    });
    expect(actionButton.className.includes("opacity-0")).toBe(true);

    fireEvent.mouseEnter(row);
    expect(actionButton.className.includes("opacity-100")).toBe(true);
  });

  it("點擊 board item 會呼叫 onSelectBoard", () => {
    const { onSelectBoard } = renderSidebar();
    fireEvent.click(screen.getByText("Board 2"));
    expect(onSelectBoard).toHaveBeenCalledWith("board-2");
  });

  it("點擊 Plus 會建立 Untitled Board", () => {
    const { onCreateBoard } = renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Create board" }));
    expect(onCreateBoard).toHaveBeenCalledWith("Untitled Board");
  });

  it("點擊 MoreHorizontal 會開啟 DropdownMenu", () => {
    renderSidebar();
    const row = screen.getByText("Board 1").closest('[role="button"]');
    if (!row) {
      throw new Error("row not found");
    }

    fireEvent.mouseEnter(row);
    const trigger = screen.getByRole("button", {
      name: "Board actions for Board 1",
    });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    expect(screen.getByText("Rename")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("右鍵 board item 會開啟 DropdownMenu", () => {
    renderSidebar();
    const row = screen.getByText("Board 1").closest('[role="button"]');
    if (!row) {
      throw new Error("row not found");
    }

    fireEvent.contextMenu(row);
    expect(screen.getByText("Rename")).toBeTruthy();
  });

  it("DropdownMenu 開啟後點擊外部會關閉", async () => {
    renderSidebar();
    const row = screen.getByText("Board 1").closest('[role="button"]');
    if (!row) {
      throw new Error("row not found");
    }

    fireEvent.contextMenu(row);
    expect(screen.getByText("Rename")).toBeTruthy();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Create board" }));
    await waitFor(() => {
      expect(screen.queryByText("Rename")).toBeNull();
    });
  });

  it("僅剩一個 board 時 Delete item 為 disabled", () => {
    renderSidebar({
      boards: [{ id: "board-1", title: "Only", createdAt: 1, updatedAt: 1 }],
      activeBoardId: "board-1",
    });
    const row = screen.getByText("Only").closest('[role="button"]');
    if (!row) {
      throw new Error("row not found");
    }

    fireEvent.contextMenu(row);
    const deleteItem = screen.getByText("Delete");
    expect(deleteItem.getAttribute("data-disabled")).not.toBeNull();
  });

  it("inline rename: Enter 與 blur 會呼叫 onRenameBoard", () => {
    const { onRenameBoard } = renderSidebar();

    const row = screen.getByText("Board 1").closest('[role="button"]');
    if (!row) {
      throw new Error("row not found");
    }

    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByText("Rename"));

    const input = screen.getByLabelText("Rename Board 1");
    fireEvent.change(input, { target: { value: "Board One" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRenameBoard).toHaveBeenCalledWith("board-1", "Board One");

    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByText("Rename"));
    const inputForBlur = screen.getByLabelText("Rename Board 1");
    fireEvent.change(inputForBlur, { target: { value: "Board Uno" } });
    fireEvent.blur(inputForBlur);
    expect(onRenameBoard).toHaveBeenCalledWith("board-1", "Board Uno");
  });

  it("inline rename: 空白 title 不會呼叫 onRenameBoard", () => {
    const { onRenameBoard } = renderSidebar();
    const row = screen.getByText("Board 1").closest('[role="button"]');
    if (!row) {
      throw new Error("row not found");
    }

    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByText("Rename"));

    const input = screen.getByLabelText("Rename Board 1");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRenameBoard).not.toHaveBeenCalled();
  });

  it("確認 AlertDialog 刪除後會呼叫 onDeleteBoard", () => {
    const { onDeleteBoard } = renderSidebar();
    const row = screen.getByText("Board 1").closest('[role="button"]');
    if (!row) {
      throw new Error("row not found");
    }

    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByText("Delete"));
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    expect(onDeleteBoard).toHaveBeenCalledWith("board-1");
  });
});
