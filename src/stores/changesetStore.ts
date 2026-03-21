import { create } from "zustand";
import type { CanvasNode, Edge } from "@/types/canvas";
import { supabase } from "@/lib/supabase";
import { fromDbNode, fromDbEdge } from "@/shared/serializers";

export type PendingChangeset = {
  changesetId: string;
  nodes: CanvasNode[];
  edges: Edge[];
  createdAt: string;
};

type ChangesetState = {
  pendingChangesets: Record<string, PendingChangeset>;
  isLoading: boolean;

  fetchPendingChangesets: (boardId: string) => Promise<void>;
  acceptChangeset: (boardId: string, changesetId: string) => Promise<void>;
  rejectChangeset: (boardId: string, changesetId: string) => Promise<void>;
  clearPending: () => void;
};

export const useChangesetStore = create<ChangesetState>((set) => ({
  pendingChangesets: {},
  isLoading: false,

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

      set({ pendingChangesets: grouped });
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

    set((state) => {
      const next = { ...state.pendingChangesets };
      delete next[changesetId];
      return { pendingChangesets: next };
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

    set((state) => {
      const next = { ...state.pendingChangesets };
      delete next[changesetId];
      return { pendingChangesets: next };
    });
  },

  clearPending() {
    set({ pendingChangesets: {} });
  },
}));
