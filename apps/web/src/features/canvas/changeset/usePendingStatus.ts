import { useChangesetStore } from "@/stores/changesetStore";

export function usePendingNodeIds(): Record<string, true> {
  return useChangesetStore((s) => s.pendingNodeIds);
}

export function usePendingEdgeIds(): Record<string, true> {
  return useChangesetStore((s) => s.pendingEdgeIds);
}
