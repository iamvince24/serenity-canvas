import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCanvasStore } from "../../../stores/canvasStore";
import type { ViewportState } from "../../../types/viewport";
import {
  getVisibleEdgeIdsDual,
  getVisibleGroupIdsDual,
  getVisibleNodeIdsDual,
} from "../core/culling";
import { resolveOrderedNodeIds } from "../nodes/orderUtils";

const CULLING_PAN_THRESHOLD = 50;
const CULLING_ZOOM_THRESHOLD = 0.01;

function useThrottledCullingViewport(viewport: ViewportState): ViewportState {
  const [cullingViewport, setCullingViewport] = useState(viewport);

  const shouldUpdate =
    Math.abs(viewport.x - cullingViewport.x) >= CULLING_PAN_THRESHOLD ||
    Math.abs(viewport.y - cullingViewport.y) >= CULLING_PAN_THRESHOLD ||
    Math.abs(viewport.zoom - cullingViewport.zoom) >= CULLING_ZOOM_THRESHOLD;

  if (shouldUpdate) {
    setCullingViewport(viewport);
  }

  return cullingViewport;
}

type HysteresisResult = {
  nextVisibleIds: string[];
  nextVisibleSet: Set<string>;
};

type ViewportSize = {
  width: number;
  height: number;
};

function getWindowViewportSize(): ViewportSize {
  if (typeof window === "undefined") {
    return { width: 0, height: 0 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function applyHysteresis(
  orderedIds: string[],
  enterVisibleIds: string[],
  leaveVisibleIds: string[],
  previouslyVisibleIds: Set<string>,
): HysteresisResult {
  const enterVisibleSet = new Set(enterVisibleIds);
  const leaveVisibleSet = new Set(leaveVisibleIds);
  const nextVisibleSet = new Set<string>();
  const nextVisibleIds: string[] = [];

  for (const id of orderedIds) {
    if (enterVisibleSet.has(id)) {
      nextVisibleSet.add(id);
      nextVisibleIds.push(id);
      continue;
    }

    if (previouslyVisibleIds.has(id) && leaveVisibleSet.has(id)) {
      nextVisibleSet.add(id);
      nextVisibleIds.push(id);
    }
  }

  return { nextVisibleIds, nextVisibleSet };
}

function areIdsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function useVisibleIdsWithHysteresis(
  orderedIds: string[],
  enterVisibleIds: string[],
  leaveVisibleIds: string[],
): string[] {
  const [visibleIds, setVisibleIds] = useState<string[]>(
    () =>
      applyHysteresis(orderedIds, enterVisibleIds, leaveVisibleIds, new Set())
        .nextVisibleIds,
  );
  const visibleIdsRef = useRef<Set<string>>(new Set(visibleIds));

  useLayoutEffect(() => {
    const { nextVisibleIds, nextVisibleSet } = applyHysteresis(
      orderedIds,
      enterVisibleIds,
      leaveVisibleIds,
      visibleIdsRef.current,
    );
    visibleIdsRef.current = nextVisibleSet;
    setVisibleIds((currentVisibleIds) =>
      areIdsEqual(currentVisibleIds, nextVisibleIds)
        ? currentVisibleIds
        : nextVisibleIds,
    );
  }, [enterVisibleIds, leaveVisibleIds, orderedIds]);

  return visibleIds;
}

function useWindowViewportSize(): ViewportSize {
  const [viewportSize, setViewportSize] = useState<ViewportSize>(() =>
    getWindowViewportSize(),
  );

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      const nextSize = getWindowViewportSize();
      setViewportSize((currentSize) =>
        currentSize.width === nextSize.width &&
        currentSize.height === nextSize.height
          ? currentSize
          : nextSize,
      );
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return viewportSize;
}

export function useVisibleNodeIds(): string[] {
  const viewportSize = useWindowViewportSize();
  const [nodes, nodeOrder, viewport] = useCanvasStore(
    useShallow((state) => [state.nodes, state.nodeOrder, state.viewport]),
  );
  const cullingViewport = useThrottledCullingViewport(viewport);
  const nodeIdFingerprint = useMemo(() => {
    const keys = Object.keys(nodes);
    keys.sort();
    return keys.join("\0");
  }, [nodes]);

  const orderedNodeIds = useMemo(
    () => resolveOrderedNodeIds(nodeOrder, nodes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeOrder, nodeIdFingerprint],
  );
  const { enterIds: enterVisibleIds, leaveIds: leaveVisibleIds } = useMemo(
    () => getVisibleNodeIdsDual(nodes, cullingViewport, viewportSize),
    [nodes, cullingViewport, viewportSize],
  );

  return useVisibleIdsWithHysteresis(
    orderedNodeIds,
    enterVisibleIds,
    leaveVisibleIds,
  );
}

export function useVisibleEdgeIds(): string[] {
  const viewportSize = useWindowViewportSize();
  const [edges, nodes, viewport] = useCanvasStore(
    useShallow((state) => [state.edges, state.nodes, state.viewport]),
  );
  const cullingViewport = useThrottledCullingViewport(viewport);
  const orderedEdgeIds = useMemo(() => Object.keys(edges), [edges]);
  const { enterIds: enterVisibleIds, leaveIds: leaveVisibleIds } = useMemo(
    () => getVisibleEdgeIdsDual(edges, nodes, cullingViewport, viewportSize),
    [edges, nodes, cullingViewport, viewportSize],
  );

  return useVisibleIdsWithHysteresis(
    orderedEdgeIds,
    enterVisibleIds,
    leaveVisibleIds,
  );
}

export function useVisibleGroupIds(): string[] {
  const viewportSize = useWindowViewportSize();
  const [groups, nodes, viewport] = useCanvasStore(
    useShallow((state) => [state.groups, state.nodes, state.viewport]),
  );
  const cullingViewport = useThrottledCullingViewport(viewport);
  const orderedGroupIds = useMemo(() => Object.keys(groups), [groups]);
  const { enterIds: enterVisibleIds, leaveIds: leaveVisibleIds } = useMemo(
    () => getVisibleGroupIdsDual(groups, nodes, cullingViewport, viewportSize),
    [groups, nodes, cullingViewport, viewportSize],
  );

  return useVisibleIdsWithHysteresis(
    orderedGroupIds,
    enterVisibleIds,
    leaveVisibleIds,
  );
}
