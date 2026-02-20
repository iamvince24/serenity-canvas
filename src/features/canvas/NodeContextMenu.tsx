import { Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useCanvasStore } from "../../stores/canvasStore";
import { ColorPicker } from "./ColorPicker";

export type ContextMenuNodeType = "text" | "image";

type NodeContextMenuProps = {
  nodeId: string;
  nodeType: ContextMenuNodeType;
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
  clientX,
  clientY,
  onClose,
}: NodeContextMenuProps) {
  const node = useCanvasStore((state) => state.nodes[nodeId]);
  const setNodeHeightMode = useCanvasStore((state) => state.setNodeHeightMode);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({
    left: clientX,
    top: clientY,
  });

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

  useEffect(() => {
    if (node) {
      return;
    }

    onClose();
  }, [node, onClose]);

  useEffect(() => {
    let frameId: number | null =
      window.requestAnimationFrame(updateMenuPosition);
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
  }, [updateMenuPosition]);

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
    if (nodeType !== "text") {
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
    if (nodeType !== "image") {
      return;
    }

    deleteNode(nodeId);
    onClose();
  }, [deleteNode, nodeId, nodeType, onClose]);

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

  if (!node || typeof document === "undefined") {
    return null;
  }

  const showFitContent = nodeType === "text" && node.type === "text";
  const showDelete = nodeType === "image" && node.type === "image";

  return createPortal(
    <div
      ref={menuRef}
      className="card-widget__settings-dropdown"
      style={menuStyle}
      data-node-context-menu="true"
      onPointerDown={(event) => event.stopPropagation()}
    >
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

      <ColorPicker
        nodeId={node.id}
        color={node.color}
        onSelectColor={() => onClose()}
      />

      {/* Temporarily disabled layer-order actions:
          Bring to Front / Bring Forward / Send Backward / Send to Back. */}
      {showDelete ? (
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
    </div>,
    document.body,
  );
}
