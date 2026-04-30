import { create } from "zustand";

type ShareStore = {
  isUpdating: boolean;
  error: string | null;
  setUpdating: (updating: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
};

export const useShareStore = create<ShareStore>((set) => ({
  isUpdating: false,
  error: null,
  setUpdating: (updating) => set({ isUpdating: updating }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
