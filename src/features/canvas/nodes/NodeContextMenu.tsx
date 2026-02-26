import { FolderPlus, PenLine, Trash2, Ungroup } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  CANVAS_COLOR_PRESETS,
  type CanvasNodeColor,
} from "../../../constants/colors";
import { cn } from "../../../lib/utils";
import { useCanvasStore } from "../../../stores/canvasStore";
import { ColorPicker } from "../card/ColorPicker";

export type ContextMenuNodeType = "text" | "image";

type NodeContextMenuProps = {
  nodeId?: string;
  nodeType?: ContextMenuNodeType;
  groupId?: string;
  clientX: number;
  clientY: number;
  onClose: () => void;
};

type MenuPosition = {
  left: number;
  top: number;
};

const MENU_VIEWPORT_PADDING = 12;
const MENU_Z_INDEX = 3000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function NodeContextMenu({
  nodeId,
  nodeType,
  groupId,
  clientX,
  clientY,
  onClose,
}: NodeContextMenuProps) {
  const node = useCanvasStore((state) => (nodeId ? state.nodes[nodeId] : null));
  const nodes = useCanvasStore((state) => state.nodes);
  const groups = useCanvasStore((state) => state.groups);
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const selectedGroupIds = useCanvasStore((state) => state.selectedGroupIds);
  const setNodeHeightMode = useCanvasStore((state) => state.setNodeHeightMode);
  const createGroup = useCanvasStore((state) => state.createGroup);
  const deleteGroup = useCanvasStore((state) => state.deleteGroup);
  const updateGroup = useCanvasStore((state) => state.updateGroup);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const deleteSelected = useCanvasStore((state) => state.deleteSelected);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({
    left: clientX,
    top: clientY,
  });

  const activeSelectedNodeIds = useMemo(
    () =>
      selectedNodeIds.filter((selectedNodeId) =>
        Boolean(nodes[selectedNodeId]),
      ),
    [nodes, selectedNodeIds],
  );

  const activeSelectedGroupIds = useMemo(() => {
    const sanitized = selectedGroupIds.filter((selectedGroupId) =>
      Boolean(groups[selectedGroupId]),
    );
    if (sanitized.length > 0) {
      return sanitized;
    }

    if (groupId && groups[groupId]) {
      return [groupId];
    }

    return [];
  }, [groupId, groups, selectedGroupIds]);

  const primaryGroup =
    activeSelectedGroupIds.length > 0
      ? (groups[activeSelectedGroupIds[0]] ?? null)
      : null;

  const hasGroupSelection = activeSelectedGroupIds.length > 0;
  const canCreateGroup = activeSelectedNodeIds.length > 1;
  const showSingleNodeActions =
    !hasGroupSelection && activeSelectedNodeIds.length <= 1 && Boolean(node);

  const updateMenuPosition = useCallback(() => {
    const menuElement = menuRef.current;
    const menuWidth = menuElement?.offsetWidth ?? 0;
    const menuHeight = menuElement?.offsetHeight ?? 0;
    const maxLeft =
      window.innerWidth - MENU_VIEWPORT_PADDING - Math.max(menuWidth, 0);
    const maxTop =
      window.innerHeight - MENU_VIEWPORT_PADDING - Math.max(menuHeight, 0);

    setMenuPosition({
      left: clamp(
        clientX,
        MENU_VIEWPORT_PADDING,
        Math.max(maxLeft, MENU_VIEWPORT_PADDING),
      ),
      top: clamp(
        clientY,
        MENU_VIEWPORT_PADDING,
        Math.max(maxTop, MENU_VIEWPORT_PADDING),
      ),
    });
  }, [clientX, clientY]);

  const focusRelativeMenuItem = useCallback((delta: number) => {
    const menuElement = menuRef.current;
    if (!menuElement) {
      return;
    }

    const menuItems = Array.from(
      menuElement.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    );
    if (menuItems.length === 0) {
      return;
    }

    const activeElement =
      document.activeElement instanceof HTMLButtonElement
        ? document.activeElement
        : null;
    const activeIndex = activeElement ? menuItems.indexOf(activeElement) : -1;
    const nextIndex =
      activeIndex < 0
        ? delta >= 0
          ? 0
          : menuItems.length - 1
        : (activeIndex + delta + menuItems.length) % menuItems.length;

    menuItems[nextIndex]?.focus();
  }, []);

  useEffect(() => {
    if (nodeId && !node) {
      onClose();
      return;
    }

    if (groupId && !groups[groupId]) {
      onClose();
    }
  }, [groupId, groups, node, nodeId, onClose]);

  useEffect(() => {
    let frameId: number | null = window.requestAnimationFrame(() => {
      updateMenuPosition();
      focusRelativeMenuItem(1);
    });
    const handleWindowResize = () => {
      updateMenuPosition();
    };

    window.addEventListener("resize", handleWindowResize);
    window.addEventListener("scroll", handleWindowResize, true);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      window.removeEventListener("resize", handleWindowResize);
      window.removeEventListener("scroll", handleWindowResize, true);
    };
  }, [focusRelativeMenuItem, updateMenuPosition]);

  useEffect(() => {
    const handleWindowPointerDown = (event: PointerEvent) => {
      const menuElement = menuRef.current;
      if (!menuElement) {
        onClose();
        return;
      }

      const target = event.target;
      const isInsideTarget =
        target instanceof Node && menuElement.contains(target);
      const composedPath =
        typeof event.composedPath === "function" ? event.composedPath() : null;
      const isInsidePath =
        Array.isArray(composedPath) && composedPath.includes(menuElement);
      if (isInsideTarget || isInsidePath) {
        return;
      }

      onClose();
    };

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("pointerdown", handleWindowPointerDown, {
      capture: true,
    });
    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handleWindowPointerDown, {
        capture: true,
      });
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [onClose]);

  const handleFitContent = useCallback(() => {
    if (!nodeId || nodeType !== "text") {
      return;
    }

    const currentNode = useCanvasStore.getState().nodes[nodeId];
    if (!currentNode || currentNode.type !== "text") {
      return;
    }

    setNodeHeightMode(nodeId, "auto");
    onClose();
  }, [nodeId, nodeType, onClose, setNodeHeightMode]);

  const handleDeleteImageNode = useCallback(() => {
    if (!nodeId || nodeType !== "image") {
      return;
    }

    deleteNode(nodeId);
    onClose();
  }, [deleteNode, nodeId, nodeType, onClose]);

  const handleCreateGroup = useCallback(() => {
    if (activeSelectedNodeIds.length < 2) {
      return;
    }

    createGroup(activeSelectedNodeIds);
    onClose();
  }, [activeSelectedNodeIds, createGroup, onClose]);

  const handleDeleteSelected = useCallback(() => {
    deleteSelected();
    onClose();
  }, [deleteSelected, onClose]);

  const handleUngroup = useCallback(() => {
    if (activeSelectedGroupIds.length === 0) {
      return;
    }

    for (const selectedGroupId of activeSelectedGroupIds) {
      deleteGroup(selectedGroupId);
    }
    onClose();
  }, [activeSelectedGroupIds, deleteGroup, onClose]);

  const handleRenameGroup = useCallback(() => {
    if (!primaryGroup) {
      return;
    }

    const nextLabel = window.prompt("Group name", primaryGroup.label);
    if (nextLabel === null) {
      return;
    }

    const trimmedLabel = nextLabel.trim();
    if (trimmedLabel.length === 0) {
      return;
    }

    updateGroup(primaryGroup.id, { label: trimmedLabel });
    onClose();
  }, [onClose, primaryGroup, updateGroup]);

  const handleSelectGroupColor = useCallback(
    (color: CanvasNodeColor) => {
      if (!primaryGroup) {
        return;
      }

      updateGroup(primaryGroup.id, { color });
      onClose();
    },
    [onClose, primaryGroup, updateGroup],
  );

  const handleMenuKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        focusRelativeMenuItem(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        focusRelativeMenuItem(-1);
      }
    },
    [focusRelativeMenuItem],
  );

  const menuStyle = useMemo<CSSProperties>(
    () => ({
      position: "fixed",
      left: `${menuPosition.left}px`,
      top: `${menuPosition.top}px`,
      zIndex: MENU_Z_INDEX,
      maxHeight: `calc(100vh - ${MENU_VIEWPORT_PADDING * 2}px)`,
      overflowY: "auto",
    }),
    [menuPosition.left, menuPosition.top],
  );

  if (
    typeof document === "undefined" ||
    (!showSingleNodeActions && !canCreateGroup && !hasGroupSelection)
  ) {
    return null;
  }

  const showFitContent =
    showSingleNodeActions && nodeType === "text" && node?.type === "text";
  const showDeleteImageNode =
    showSingleNodeActions && nodeType === "image" && node?.type === "image";

  return createPortal(
    <div
      ref={menuRef}
      className="card-widget__settings-dropdown"
      style={menuStyle}
      data-node-context-menu="true"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={handleMenuKeyDown}
    >
      {canCreateGroup ? (
        <>
          <button
            type="button"
            className="card-widget__settings-item"
            onClick={handleCreateGroup}
          >
            <FolderPlus size={14} />
            Create Group
          </button>
          <button
            type="button"
            className="card-widget__settings-item"
            onClick={handleDeleteSelected}
          >
            <Trash2 size={14} />
            Delete Selected
          </button>
        </>
      ) : null}

      {hasGroupSelection ? (
        <>
          {canCreateGroup ? (
            <div className="card-widget__settings-divider" />
          ) : null}
          <button
            type="button"
            className="card-widget__settings-item"
            onClick={handleRenameGroup}
          >
            <PenLine size={14} />
            Rename Group
          </button>
          <button
            type="button"
            className="card-widget__settings-item"
            onClick={handleUngroup}
          >
            <Ungroup size={14} />
            Ungroup
          </button>
          <div className="card-widget__settings-divider" />
          <div
            className="card-color-picker px-1 pb-1 pt-0"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="card-color-picker__title">Group Color</div>
            <div className="card-color-picker__grid">
              <button
                type="button"
                className={cn("card-color-picker__option", {
                  "card-color-picker__option--active":
                    primaryGroup?.color === null,
                })}
                aria-label="Set group color to none"
                title="None"
                onClick={() => handleSelectGroupColor(null)}
              >
                <span className="card-color-picker__swatch card-color-picker__swatch--none" />
              </button>
              {CANVAS_COLOR_PRESETS.map((preset) => {
                const isActive = primaryGroup?.color === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={cn("card-color-picker__option", {
                      "card-color-picker__option--active": isActive,
                    })}
                    aria-label={`Set group color to ${preset.label}`}
                    title={preset.label}
                    onClick={() => handleSelectGroupColor(preset.id)}
                  >
                    <span
                      className="card-color-picker__swatch"
                      style={{
                        backgroundColor: preset.background,
                        borderColor: preset.border,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      {showSingleNodeActions ? (
        <>
          {canCreateGroup || hasGroupSelection ? (
            <div className="card-widget__settings-divider" />
          ) : null}

          {showFitContent ? (
            <>
              <button
                type="button"
                className="card-widget__settings-item"
                onClick={handleFitContent}
              >
                Fit Content
              </button>
              <div className="card-widget__settings-divider" />
            </>
          ) : null}

          {node ? (
            <ColorPicker
              nodeId={node.id}
              color={node.color}
              onSelectColor={() => onClose()}
            />
          ) : null}

          {showDeleteImageNode ? (
            <>
              <div className="card-widget__settings-divider" />
              <button
                type="button"
                className="card-widget__settings-item"
                onClick={handleDeleteImageNode}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </div>,
    document.body,
  );
}
