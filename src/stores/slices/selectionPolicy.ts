export type SelectionState = {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedGroupIds: string[];
};

export type DeleteTarget = "nodes" | "edges" | "groups" | null;

export function resolveDeleteTarget(state: SelectionState): DeleteTarget {
  if (state.selectedNodeIds.length > 0) {
    return "nodes";
  }

  if (state.selectedEdgeIds.length > 0) {
    return "edges";
  }

  if (state.selectedGroupIds.length > 0) {
    return "groups";
  }

  return null;
}

export function hasAnySelection(state: SelectionState): boolean {
  return (
    state.selectedNodeIds.length > 0 ||
    state.selectedEdgeIds.length > 0 ||
    state.selectedGroupIds.length > 0
  );
}
