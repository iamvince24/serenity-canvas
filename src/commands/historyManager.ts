import type { Command } from "./types";

const DEFAULT_HISTORY_LIMIT = 50;

export type HistoryState = {
  undoDepth: number;
  redoDepth: number;
  canUndo: boolean;
  canRedo: boolean;
};

export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private readonly maxDepth: number;

  constructor(maxDepth = DEFAULT_HISTORY_LIMIT) {
    this.maxDepth = maxDepth;
  }

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
    this.trimUndoStack();
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) {
      return false;
    }

    command.undo();
    this.redoStack.push(command);
    return true;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) {
      return false;
    }

    command.execute();
    this.undoStack.push(command);
    this.trimUndoStack();
    return true;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getState(): HistoryState {
    return {
      undoDepth: this.undoStack.length,
      redoDepth: this.redoStack.length,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
    };
  }

  private trimUndoStack(): void {
    if (this.undoStack.length <= this.maxDepth) {
      return;
    }

    const overflow = this.undoStack.length - this.maxDepth;
    this.undoStack.splice(0, overflow);
  }
}
