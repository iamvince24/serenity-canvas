import { create } from "zustand";

export type SyncProgress = {
  current: number;
  total: number;
};

export type SyncState = "idle" | "syncing" | "error" | "offline";

type SyncStatusStore = {
  state: SyncState;
  progress?: SyncProgress;
  lastSyncAt?: number;
  errorMessage?: string;
  setIdle: () => void;
  setSyncing: () => void;
  setProgress: (progress: SyncProgress) => void;
  setError: (message: string) => void;
  setOffline: () => void;
  setLastSync: () => void;
};

export const useSyncStatusStore = create<SyncStatusStore>((set) => ({
  state: "idle",
  progress: undefined,
  lastSyncAt: undefined,
  errorMessage: undefined,
  setIdle: () =>
    set({
      state: "idle",
      progress: undefined,
      errorMessage: undefined,
    }),
  setSyncing: () =>
    set((state) => ({
      state: "syncing",
      progress: state.progress,
      errorMessage: undefined,
    })),
  setProgress: (progress) => set({ state: "syncing", progress }),
  setError: (message) =>
    set({
      state: "error",
      errorMessage: message,
      progress: undefined,
    }),
  setOffline: () =>
    set({
      state: "offline",
      progress: undefined,
    }),
  setLastSync: () => set({ lastSyncAt: Date.now() }),
}));
