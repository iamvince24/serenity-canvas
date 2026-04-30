import { create } from "zustand";
import type { CanvasNode, Edge } from "@/types/canvas";
import { supabase } from "@/lib/supabase";
import { fromDbNode, fromDbEdge } from "@/shared/serializers";
import { useCanvasStore, setSyncGuard } from "./canvasStore";

export type PendingChangeset = {
  changesetId: string;
  nodes: CanvasNode[];
  edges: Edge[];
  createdAt: string;
};

type ChangesetState = {
  pendingChangesets: Record<string, PendingChangeset>;
  isLoading: boolean;
  pendingNodeIds: Record<string, true>;
  pendingEdgeIds: Record<string, true>;
  changesetForNode: Record<string, string>;
  changesetForEdge: Record<string, string>;

  fetchPendingChangesets: (boardId: string) => Promise<void>;
  acceptChangeset: (boardId: string, changesetId: string) => Promise<void>;
  rejectChangeset: (boardId: string, changesetId: string) => Promise<void>;
  clearPending: () => void;
};

function buildPendingLookups(grouped: Record<string, PendingChangeset>): {
  pendingNodeIds: Record<string, true>;
  pendingEdgeIds: Record<string, true>;
  changesetForNode: Record<string, string>;
  changesetForEdge: Record<string, string>;
} {
  const pendingNodeIds: Record<string, true> = {};
  const pendingEdgeIds: Record<string, true> = {};
  const changesetForNode: Record<string, string> = {};
  const changesetForEdge: Record<string, string> = {};
  for (const cs of Object.values(grouped)) {
    for (const node of cs.nodes) {
      pendingNodeIds[node.id] = true;
      changesetForNode[node.id] = cs.changesetId;
    }
    for (const edge of cs.edges) {
      pendingEdgeIds[edge.id] = true;
      changesetForEdge[edge.id] = cs.changesetId;
    }
  }
  return { pendingNodeIds, pendingEdgeIds, changesetForNode, changesetForEdge };
}

export const useChangesetStore = create<ChangesetState>((set, get) => ({
  pendingChangesets: {},
  isLoading: false,
  pendingNodeIds: {},
  pendingEdgeIds: {},
  changesetForNode: {},
  changesetForEdge: {},

  async fetchPendingChangesets(boardId: string) {
    set({ isLoading: true });
    try {
      const [nodesRes, edgesRes] = await Promise.all([
        supabase
          .from("nodes")
          .select("*")
          .eq("board_id", boardId)
          .eq("change_status", "pending")
          .is("deleted_at", null),
        supabase
          .from("edges")
          .select("*")
          .eq("board_id", boardId)
          .eq("change_status", "pending")
          .is("deleted_at", null),
      ]);

      const pendingNodes = (nodesRes.data ?? [])
        .map((row) => ({
          node: fromDbNode(row as unknown as Record<string, unknown>),
          changesetId: (row as Record<string, unknown>).changeset_id as string,
          createdAt: row.created_at,
        }))
        .filter(
          (item): item is typeof item & { node: CanvasNode } =>
            item.node !== null,
        );

      const pendingEdges = (edgesRes.data ?? []).map((row) => ({
        edge: fromDbEdge(row as unknown as Record<string, unknown>),
        changesetId: (row as Record<string, unknown>).changeset_id as string,
        createdAt: row.created_at,
      }));

      // Group by changeset_id
      const grouped: Record<string, PendingChangeset> = {};
      for (const item of pendingNodes) {
        if (!item.changesetId) continue;
        if (!grouped[item.changesetId]) {
          grouped[item.changesetId] = {
            changesetId: item.changesetId,
            nodes: [],
            edges: [],
            createdAt: item.createdAt,
          };
        }
        grouped[item.changesetId].nodes.push(item.node);
      }
      for (const item of pendingEdges) {
        if (!item.changesetId) continue;
        if (!grouped[item.changesetId]) {
          grouped[item.changesetId] = {
            changesetId: item.changesetId,
            nodes: [],
            edges: [],
            createdAt: item.createdAt,
          };
        }
        grouped[item.changesetId].edges.push(item.edge);
      }

      // Inject pending nodes/edges into canvasStore (bypasses persistMiddleware)
      setSyncGuard(true);
      useCanvasStore.setState((state) => {
        const nextNodes = { ...state.nodes };
        const nextEdges = { ...state.edges };
        const nodeOrderSet = new Set(state.nodeOrder);
        const nextNodeOrder = [...state.nodeOrder];

        for (const cs of Object.values(grouped)) {
          for (const node of cs.nodes) {
            nextNodes[node.id] = node;
            if (!nodeOrderSet.has(node.id)) {
              nextNodeOrder.push(node.id);
              nodeOrderSet.add(node.id);
            }
          }
          for (const edge of cs.edges) {
            nextEdges[edge.id] = edge;
          }
        }

        return {
          nodes: nextNodes,
          edges: nextEdges,
          nodeOrder: nextNodeOrder,
        };
      });
      setSyncGuard(false);

      set({ pendingChangesets: grouped, ...buildPendingLookups(grouped) });
    } finally {
      set({ isLoading: false });
    }
  },

  async acceptChangeset(boardId: string, changesetId: string) {
    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from("nodes")
        .update({ change_status: "accepted", updated_at: now })
        .eq("board_id", boardId)
        .eq("changeset_id", changesetId),
      supabase
        .from("edges")
        .update({ change_status: "accepted", updated_at: now })
        .eq("board_id", boardId)
        .eq("changeset_id", changesetId),
    ]);

    // Touch updatedAt on accepted nodes/edges so persistMiddleware writes them to IDB
    const changeset = get().pendingChangesets[changesetId];
    if (changeset) {
      const nowMs = Date.now();
      useCanvasStore.setState((state) => {
        const nextNodes = { ...state.nodes };
        const nextEdges = { ...state.edges };
        for (const node of changeset.nodes) {
          if (nextNodes[node.id]) {
            nextNodes[node.id] = { ...nextNodes[node.id], updatedAt: nowMs };
          }
        }
        for (const edge of changeset.edges) {
          if (nextEdges[edge.id]) {
            nextEdges[edge.id] = { ...nextEdges[edge.id], updatedAt: nowMs };
          }
        }
        return { nodes: nextNodes, edges: nextEdges };
      });
    }

    set((state) => {
      const next = { ...state.pendingChangesets };
      delete next[changesetId];
      return { pendingChangesets: next, ...buildPendingLookups(next) };
    });
  },

  async rejectChangeset(boardId: string, changesetId: string) {
    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from("nodes")
        .update({ deleted_at: now, updated_at: now })
        .eq("board_id", boardId)
        .eq("changeset_id", changesetId),
      supabase
        .from("edges")
        .update({ deleted_at: now, updated_at: now })
        .eq("board_id", boardId)
        .eq("changeset_id", changesetId),
    ]);

    // Remove rejected nodes/edges from canvasStore
    const changeset = get().pendingChangesets[changesetId];
    if (changeset) {
      const nodeIdsToRemove = new Set(changeset.nodes.map((n) => n.id));
      const edgeIdsToRemove = new Set(changeset.edges.map((e) => e.id));

      useCanvasStore.setState((state) => {
        const nextNodes = { ...state.nodes };
        const nextEdges = { ...state.edges };
        for (const nodeId of nodeIdsToRemove) {
          delete nextNodes[nodeId];
        }
        for (const edgeId of edgeIdsToRemove) {
          delete nextEdges[edgeId];
        }
        return {
          nodes: nextNodes,
          edges: nextEdges,
          nodeOrder: state.nodeOrder.filter((id) => !nodeIdsToRemove.has(id)),
          selectedNodeIds: state.selectedNodeIds.filter(
            (id) => !nodeIdsToRemove.has(id),
          ),
          selectedEdgeIds: state.selectedEdgeIds.filter(
            (id) => !edgeIdsToRemove.has(id),
          ),
        };
      });
    }

    set((state) => {
      const next = { ...state.pendingChangesets };
      delete next[changesetId];
      return { pendingChangesets: next, ...buildPendingLookups(next) };
    });
  },

  clearPending() {
    set({
      pendingChangesets: {},
      pendingNodeIds: {},
      pendingEdgeIds: {},
      changesetForNode: {},
      changesetForEdge: {},
    });
  },
}));
