import { useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { acquireImage, releaseImage } from "./imageUrlCache";

type ImageBlockStatus =
  | { type: "loading" }
  | { type: "loaded"; objectUrl: string }
  | { type: "error"; message: string };

type ImageLoadResult =
  | { assetId: string; type: "loaded"; objectUrl: string }
  | { assetId: string; type: "error"; message: string };

function readNodeAttr(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function ImageBlockView({ node }: NodeViewProps) {
  const assetId = readNodeAttr(node.attrs.assetId);
  const alt = readNodeAttr(node.attrs.alt);
  const [result, setResult] = useState<ImageLoadResult | null>(null);

  useEffect(() => {
    if (assetId.length === 0) {
      return;
    }

    let isActive = true;
    let hasAcquired = false;

    void acquireImage(assetId)
      .then((entry) => {
        if (!isActive) {
          releaseImage(assetId);
          return;
        }

        hasAcquired = true;
        setResult({ assetId, type: "loaded", objectUrl: entry.objectUrl });
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Failed to load image.";
        setResult({ assetId, type: "error", message });
      });

    return () => {
      isActive = false;
      if (hasAcquired) {
        releaseImage(assetId);
      }
    };
  }, [assetId]);

  const status: ImageBlockStatus =
    assetId.length === 0
      ? { type: "error", message: "Missing image asset id." }
      : result === null || result.assetId !== assetId
        ? { type: "loading" }
        : result.type === "loaded"
          ? { type: "loaded", objectUrl: result.objectUrl }
          : { type: "error", message: result.message };

  return (
    <NodeViewWrapper className="card-editor__image-block">
      {status.type === "loading" ? (
        <div
          className="h-[180px] w-full animate-pulse rounded-md bg-[#ECEAE6]"
          role="status"
          aria-label="Loading image"
        />
      ) : null}

      {status.type === "loaded" ? (
        <img
          src={status.objectUrl}
          alt={alt}
          className="block w-full rounded-md object-contain"
          draggable={false}
        />
      ) : null}

      {status.type === "error" ? (
        <div className="rounded-md border border-[#E5A29B] bg-[#FFF2F0] px-3 py-2 text-xs text-[#B8635A]">
          Failed to load image: {status.message}
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}
