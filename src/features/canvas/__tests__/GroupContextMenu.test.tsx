import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../stores/canvasStore";
import { InteractionState } from "../core/stateMachine";
import { GroupContextMenu } from "../nodes/GroupContextMenu";

function resetStore() {
  useCanvasStore.getState().clearHistory();
  useCanvasStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: {
      "text-1": {
        id: "text-1",
        type: "text",
        x: 0,
        y: 0,
        width: 280,
        height: 240,
        heightMode: "fixed",
        color: null,
        contentMarkdown: "first",
      },
      "text-2": {
        id: "text-2",
        type: "text",
        x: 320,
        y: 40,
        width: 280,
        height: 240,
        heightMode: "fixed",
        color: null,
        contentMarkdown: "second",
      },
    },
    nodeOrder: ["text-1", "text-2"],
    files: {},
    edges: {},
    groups: {
      "group-1": {
        id: "group-1",
        label: "Group One",
        color: null,
        nodeIds: ["text-1", "text-2"],
      },
      "group-2": {
        id: "group-2",
        label: "Group Two",
        color: "orange",
        nodeIds: ["text-2"],
      },
    },
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedGroupIds: ["group-1", "group-2"],
    canvasMode: "select",
    interactionState: InteractionState.Idle,
    canUndo: false,
    canRedo: false,
  });
}

describe("GroupContextMenu", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("顯示 Rename Group 與 Ungroup 按鈕", () => {
    render(
      <GroupContextMenu
        groupId="group-1"
        clientX={140}
        clientY={180}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "重新命名群組",
      }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", {
        name: "解散群組",
      }),
    ).not.toBeNull();
  });

  it("點擊 Rename Group 後會更新群組名稱", () => {
    const onClose = vi.fn();
    vi.spyOn(window, "prompt").mockReturnValue("  Renamed Group  ");
    render(
      <GroupContextMenu
        groupId="group-1"
        clientX={140}
        clientY={180}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "重新命名群組" }));

    expect(useCanvasStore.getState().groups["group-1"]?.label).toBe(
      "Renamed Group",
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("可用 ArrowUp / ArrowDown 在選單項目間移動焦點", () => {
    render(
      <GroupContextMenu
        groupId="group-1"
        clientX={140}
        clientY={180}
        onClose={vi.fn()}
      />,
    );

    const menu = document.querySelector(
      "[data-node-context-menu='true']",
    ) as HTMLDivElement | null;
    if (!menu) {
      throw new Error("group context menu element not found");
    }

    const renameButton = screen.getByRole("button", { name: "重新命名群組" });
    const ungroupButton = screen.getByRole("button", { name: "解散群組" });

    renameButton.focus();
    expect(document.activeElement).toBe(renameButton);

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(ungroupButton);

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(renameButton);
  });

  it("點擊 Ungroup 會刪除目前選取的群組", () => {
    const onClose = vi.fn();
    render(
      <GroupContextMenu
        groupId="group-1"
        clientX={140}
        clientY={180}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "解散群組" }));

    expect(useCanvasStore.getState().groups["group-1"]).toBeUndefined();
    expect(useCanvasStore.getState().groups["group-2"]).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });

  it("點擊群組顏色會更新 primary group 顏色", () => {
    const onClose = vi.fn();
    render(
      <GroupContextMenu
        groupId="group-1"
        clientX={140}
        clientY={180}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "設定群組顏色為 Red" }));

    expect(useCanvasStore.getState().groups["group-1"]?.color).toBe("red");
    expect(onClose).toHaveBeenCalled();
  });

  it("點擊外部會關閉選單", () => {
    const onClose = vi.fn();
    render(
      <GroupContextMenu
        groupId="group-1"
        clientX={140}
        clientY={180}
        onClose={onClose}
      />,
    );

    fireEvent.pointerDown(document.body);

    expect(onClose).toHaveBeenCalled();
  });

  it("按下 Escape 會關閉選單", () => {
    const onClose = vi.fn();
    render(
      <GroupContextMenu
        groupId="group-1"
        clientX={140}
        clientY={180}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });
});
