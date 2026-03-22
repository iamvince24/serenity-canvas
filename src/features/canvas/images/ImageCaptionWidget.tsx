import {
  memo,
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useCanvasStore } from "../../../stores/canvasStore";
import type { ImageNode } from "../../../types/canvas";
import {
  IMAGE_NODE_CAPTION_HEIGHT,
  IMAGE_NODE_CAPTION_PADDING,
  IMAGE_RESIZE_EDGE_HIT,
} from "../core/constants";
import type { ContextMenuNodeType } from "../nodes/NodeContextMenu";

type ImageCaptionWidgetProps = {
  node: ImageNode;
  layerIndex: number;
  isSelected: boolean;
  onOpenContextMenu: (payload: {
    nodeId: string;
    nodeType: ContextMenuNodeType;
    clientX: number;
    clientY: number;
  }) => void;
};

function ImageCaptionWidgetComponent({
  node,
  layerIndex,
  isSelected,
  onOpenContextMenu,
}: ImageCaptionWidgetProps) {
  const { t } = useTranslation();
  const selectNode = useCanvasStore((state) => state.selectNode);
  const toggleNodeSelection = useCanvasStore(
    (state) => state.toggleNodeSelection,
  );
  const updateNodeContent = useCanvasStore((state) => state.updateNodeContent);
  const [draftCaption, setDraftCaption] = useState(node.content);
  const [isEditing, setIsEditing] = useState(false);

  const imageHeight = Math.max(1, node.height - IMAGE_NODE_CAPTION_HEIGHT);

  const widgetStyle = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      left: `${node.x}px`,
      top: `${node.y + imageHeight}px`,
      width: `${node.width}px`,
      height: `${IMAGE_NODE_CAPTION_HEIGHT}px`,
      zIndex: isSelected ? layerIndex + 1000 : layerIndex,
      pointerEvents: "none",
    }),
    [imageHeight, isSelected, layerIndex, node.width, node.x, node.y],
  );

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    updateNodeContent(node.id, draftCaption);
  }, [draftCaption, node.id, updateNodeContent]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setDraftCaption(node.content);
      event.currentTarget.blur();
    },
    [node.content],
  );

  const handleContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLTextAreaElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isSelected) {
        selectNode(node.id);
      }
      onOpenContextMenu({
        nodeId: node.id,
        nodeType: "image",
        clientX: event.clientX,
        clientY: event.clientY,
      });
    },
    [isSelected, node.id, onOpenContextMenu, selectNode],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLTextAreaElement>) => {
      if (!event.shiftKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      toggleNodeSelection(node.id);
    },
    [node.id, toggleNodeSelection],
  );

  return (
    <div style={widgetStyle} data-card-node-id={node.id} role="presentation">
      <textarea
        value={isEditing ? draftCaption : node.content}
        placeholder={t("image.caption.placeholder")}
        onChange={(event) => setDraftCaption(event.target.value)}
        onFocus={() => {
          setIsEditing(true);
          setDraftCaption(node.content);
          selectNode(node.id);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        className="resize-none rounded-b-[10px] border-none bg-transparent text-[14px] leading-[1.35] text-[#1C1C1A] outline-none placeholder:text-foreground-subtle"
        style={{
          position: "absolute",
          inset: `${IMAGE_RESIZE_EDGE_HIT / 2}px`,
          boxSizing: "border-box",
          width: `calc(100% - ${IMAGE_RESIZE_EDGE_HIT}px)`,
          height: `calc(100% - ${IMAGE_RESIZE_EDGE_HIT}px)`,
          paddingTop: `${IMAGE_NODE_CAPTION_PADDING}px`,
          paddingBottom: `${IMAGE_NODE_CAPTION_PADDING}px`,
          paddingLeft: `${IMAGE_NODE_CAPTION_PADDING}px`,
          paddingRight: `${IMAGE_NODE_CAPTION_PADDING}px`,
          pointerEvents: "auto",
        }}
      />
    </div>
  );
}

export const ImageCaptionWidget = memo(ImageCaptionWidgetComponent);
