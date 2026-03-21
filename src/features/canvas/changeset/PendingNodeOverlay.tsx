import { useMemo } from "react";
import { useChangesetStore } from "@/stores/changesetStore";
import type { ViewportState } from "@/types/viewport";
import { isTextNode } from "@/types/node";

type PendingNodeOverlayProps = {
  viewport: ViewportState;
};

export function PendingNodeOverlay({ viewport }: PendingNodeOverlayProps) {
  const pendingChangesets = useChangesetStore((s) => s.pendingChangesets);

  const pendingNodes = useMemo(() => {
    const nodes = [];
    for (const cs of Object.values(pendingChangesets)) {
      for (const node of cs.nodes) {
        nodes.push(node);
      }
    }
    return nodes;
  }, [pendingChangesets]);

  if (pendingNodes.length === 0) return null;

  return (
    <>
      {pendingNodes.map((node) => {
        const screenX = node.x * viewport.zoom + viewport.x;
        const screenY = node.y * viewport.zoom + viewport.y;
        const screenW = node.width * viewport.zoom;
        const screenH = node.height * viewport.zoom;

        return (
          <div
            key={node.id}
            className="pointer-events-none absolute overflow-hidden rounded-lg border-2 border-dashed border-sage-400/60 bg-sage-100/40"
            style={{
              left: screenX,
              top: screenY,
              width: screenW,
              height: screenH,
            }}
          >
            <div className="overflow-hidden p-2 text-xs text-sage-500/80">
              {isTextNode(node) ? node.contentMarkdown.slice(0, 100) : "Image"}
            </div>
          </div>
        );
      })}
    </>
  );
}
