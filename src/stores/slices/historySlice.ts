import type { HistoryManager } from "../../commands/historyManager";

export type HistorySlice = {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
};

// The HistoryManager instance is created in canvasStore and passed here so that
// executeCommand and the slices share the same history stack.
export function createHistorySlice(
  history: HistoryManager,
  syncHistoryState: () => void,
): HistorySlice {
  return {
    canUndo: false,
    canRedo: false,
    undo: () => {
      if (!history.undo()) {
        return;
      }
      syncHistoryState();
    },
    redo: () => {
      if (!history.redo()) {
        return;
      }
      syncHistoryState();
    },
    clearHistory: () => {
      history.clear();
      syncHistoryState();
    },
  };
}
