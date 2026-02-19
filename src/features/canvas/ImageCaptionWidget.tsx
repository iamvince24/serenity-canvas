import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useCanvasStore } from "../../stores/canvasStore";
import type { ImageNode } from "../../types/canvas";
import {
  IMAGE_NODE_CAPTION_HEIGHT,
  IMAGE_NODE_CAPTION_PADDING,
  IMAGE_RESIZE_EDGE_HIT,
} from "./constants";

type ImageCaptionWidgetProps = {
  node: ImageNode;
};

export function ImageCaptionWidget({ node }: ImageCaptionWidgetProps) {
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const updateNodeContent = useCanvasStore((state) => state.updateNodeContent);
  const [draftCaption, setDraftCaption] = useState(node.content);
  const [isEditing, setIsEditing] = useState(false);

  const isSelected = selectedNodeIds.includes(node.id);
  const imageHeight = Math.max(1, node.height - IMAGE_NODE_CAPTION_HEIGHT);

  const widgetStyle = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      left: `${node.x}px`,
      top: `${node.y + imageHeight}px`,
      width: `${node.width}px`,
      height: `${IMAGE_NODE_CAPTION_HEIGHT}px`,
      zIndex: isSelected ? 4 : 2,
      pointerEvents: "none",
    }),
    [imageHeight, isSelected, node.width, node.x, node.y],
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

  return (
    <div style={widgetStyle} data-card-node-id={node.id} role="presentation">
      <textarea
        value={isEditing ? draftCaption : node.content}
        placeholder="Add a caption..."
        onChange={(event) => setDraftCaption(event.target.value)}
        onFocus={() => {
          setIsEditing(true);
          setDraftCaption(node.content);
          selectNode(node.id);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
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
