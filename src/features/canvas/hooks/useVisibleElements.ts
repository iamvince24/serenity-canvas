import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCanvasStore } from "../../../stores/canvasStore";
import {
  ENTER_PADDING,
  LEAVE_PADDING,
  getVisibleEdgeIds,
  getVisibleGroupIds,
  getVisibleNodeIds,
} from "../core/culling";

type HysteresisResult = {
  nextVisibleIds: string[];
  nextVisibleSet: Set<string>;
};

function buildOrderedNodeIds(nodeOrder: string[], nodeIds: string[]): string[] {
  const orderedNodeIds: string[] = [];
  const nodeIdSet = new Set(nodeIds);
  const seenNodeIds = new Set<string>();

  for (const nodeId of nodeOrder) {
    if (!nodeIdSet.has(nodeId) || seenNodeIds.has(nodeId)) {
      continue;
    }

    orderedNodeIds.push(nodeId);
    seenNodeIds.add(nodeId);
  }

  for (const nodeId of nodeIds) {
    if (seenNodeIds.has(nodeId)) {
      continue;
    }

    orderedNodeIds.push(nodeId);
    seenNodeIds.add(nodeId);
  }

  return orderedNodeIds;
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

export function useVisibleNodeIds(): string[] {
  const [nodes, nodeOrder, viewport] = useCanvasStore(
    useShallow((state) => [state.nodes, state.nodeOrder, state.viewport]),
  );
  const orderedNodeIds = useMemo(
    () => buildOrderedNodeIds(nodeOrder, Object.keys(nodes)),
    [nodeOrder, nodes],
  );
  const enterVisibleIds = useMemo(
    () => getVisibleNodeIds(nodes, viewport, ENTER_PADDING),
    [nodes, viewport],
  );
  const leaveVisibleIds = useMemo(
    () => getVisibleNodeIds(nodes, viewport, LEAVE_PADDING),
    [nodes, viewport],
  );

  return useVisibleIdsWithHysteresis(
    orderedNodeIds,
    enterVisibleIds,
    leaveVisibleIds,
  );
}

export function useVisibleEdgeIds(): string[] {
  const [edges, nodes, viewport] = useCanvasStore(
    useShallow((state) => [state.edges, state.nodes, state.viewport]),
  );
  const orderedEdgeIds = useMemo(() => Object.keys(edges), [edges]);
  const enterVisibleIds = useMemo(
    () => getVisibleEdgeIds(edges, nodes, viewport, ENTER_PADDING),
    [edges, nodes, viewport],
  );
  const leaveVisibleIds = useMemo(
    () => getVisibleEdgeIds(edges, nodes, viewport, LEAVE_PADDING),
    [edges, nodes, viewport],
  );

  return useVisibleIdsWithHysteresis(
    orderedEdgeIds,
    enterVisibleIds,
    leaveVisibleIds,
  );
}

export function useVisibleGroupIds(): string[] {
  const [groups, nodes, viewport] = useCanvasStore(
    useShallow((state) => [state.groups, state.nodes, state.viewport]),
  );
  const orderedGroupIds = useMemo(() => Object.keys(groups), [groups]);
  const enterVisibleIds = useMemo(
    () => getVisibleGroupIds(groups, nodes, viewport, ENTER_PADDING),
    [groups, nodes, viewport],
  );
  const leaveVisibleIds = useMemo(
    () => getVisibleGroupIds(groups, nodes, viewport, LEAVE_PADDING),
    [groups, nodes, viewport],
  );

  return useVisibleIdsWithHysteresis(
    orderedGroupIds,
    enterVisibleIds,
    leaveVisibleIds,
  );
}
