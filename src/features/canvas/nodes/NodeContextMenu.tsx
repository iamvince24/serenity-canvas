import { FolderPlus, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { useCanvasStore } from "../../../stores/canvasStore";
import { ColorPicker } from "../card/ColorPicker";
import { useContextMenuBase } from "./useContextMenuBase";

export type ContextMenuNodeType = "text" | "image";

type NodeContextMenuProps = {
  nodeId?: string;
  nodeType?: ContextMenuNodeType;
  clientX: number;
  clientY: number;
  onClose: () => void;
};

export function NodeContextMenu({
  nodeId,
  nodeType,
  clientX,
  clientY,
  onClose,
}: NodeContextMenuProps) {
  const { t } = useTranslation();
  const node = useCanvasStore((state) => (nodeId ? state.nodes[nodeId] : null));
  const nodes = useCanvasStore((state) => state.nodes);
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const setNodeHeightMode = useCanvasStore((state) => state.setNodeHeightMode);
  const createGroup = useCanvasStore((state) => state.createGroup);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const deleteSelected = useCanvasStore((state) => state.deleteSelected);

  const activeSelectedNodeIds = useMemo(
    () =>
      selectedNodeIds.filter((selectedNodeId) =>
        Boolean(nodes[selectedNodeId]),
      ),
    [nodes, selectedNodeIds],
  );

  const canCreateGroup = activeSelectedNodeIds.length > 1;
  const showSingleNodeActions =
    activeSelectedNodeIds.length <= 1 && Boolean(node);

  const { menuRef, menuStyle, handleMenuKeyDown } = useContextMenuBase({
    clientX,
    clientY,
    onClose,
    shouldClose: Boolean(nodeId && !node),
  });

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

  if (
    typeof document === "undefined" ||
    (!showSingleNodeActions && !canCreateGroup)
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
            {t("nodeContext.createGroup")}
          </button>
          <button
            type="button"
            className="card-widget__settings-item"
            onClick={handleDeleteSelected}
          >
            <Trash2 size={14} />
            {t("nodeContext.deleteSelected")}
          </button>
        </>
      ) : null}

      {showSingleNodeActions ? (
        <>
          {canCreateGroup ? (
            <div className="card-widget__settings-divider" />
          ) : null}

          {showFitContent ? (
            <>
              <button
                type="button"
                className="card-widget__settings-item"
                onClick={handleFitContent}
              >
                {t("nodeContext.fitContent")}
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
                {t("nodeContext.delete")}
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </div>,
    document.body,
  );
}
