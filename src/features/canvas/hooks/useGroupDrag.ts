import { useCallback, useRef, useState } from "react";
import { useCanvasStore } from "../../../stores/canvasStore";
import { InteractionEvent, InteractionState } from "../core/stateMachine";
import { usePointerCapture } from "./usePointerCapture";

type NodeSnapshot = {
  id: string;
  startX: number;
  startY: number;
};

type GroupDragState = {
  startClientX: number;
  startClientY: number;
  zoom: number;
  snapshots: NodeSnapshot[];
};

export function useGroupDrag() {
  const dispatch = useCanvasStore((state) => state.dispatch);
  const dragRef = useRef<GroupDragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;

    const deltaX = (clientX - drag.startClientX) / drag.zoom;
    const deltaY = (clientY - drag.startClientY) / drag.zoom;

    const { previewNodePosition } = useCanvasStore.getState();
    for (const snap of drag.snapshots) {
      previewNodePosition(snap.id, snap.startX + deltaX, snap.startY + deltaY);
    }
  }, []);

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;

    const currentState = useCanvasStore.getState();
    const moves = drag.snapshots
      .map((snap) => {
        const node = currentState.nodes[snap.id];
        if (!node) return null;
        return {
          id: snap.id,
          from: { x: snap.startX, y: snap.startY },
          to: { x: node.x, y: node.y },
        };
      })
      .filter((m): m is NonNullable<typeof m> => Boolean(m));

    currentState.commitBatchNodeMove(moves);
    dragRef.current = null;
    setIsDragging(false);
    dispatch(InteractionEvent.NODE_DRAG_END);
  }, [dispatch]);

  usePointerCapture(isDragging, {
    onPointerMove: handleMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
  });

  const startGroupDrag = useCallback(
    (nodeIds: string[], clientX: number, clientY: number) => {
      const state = useCanvasStore.getState();
      if (state.interactionState !== InteractionState.Idle) return;

      const snapshots: NodeSnapshot[] = [];
      const seen = new Set<string>();
      for (const id of nodeIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        const node = state.nodes[id];
        if (node) {
          snapshots.push({ id, startX: node.x, startY: node.y });
        }
      }
      if (snapshots.length === 0) return;

      state.setSelectedNodes(snapshots.map((s) => s.id));

      const zoom = state.viewport.zoom > 0 ? state.viewport.zoom : 1;
      dragRef.current = {
        startClientX: clientX,
        startClientY: clientY,
        zoom,
        snapshots,
      };
      setIsDragging(true);
      dispatch(InteractionEvent.NODE_DRAG_START);
    },
    [dispatch],
  );

  return { startGroupDrag };
}
