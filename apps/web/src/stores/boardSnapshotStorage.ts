import type { BoardCanvasSnapshot } from "./storeTypes";

export const BOARD_SNAPSHOT_KEY_PREFIX = "serenity-canvas:board:";

export function getBoardSnapshotKey(boardId: string): string {
  return `${BOARD_SNAPSHOT_KEY_PREFIX}${boardId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSnapshot(value: unknown): value is BoardCanvasSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRecord(value.nodes) &&
    Array.isArray(value.nodeOrder) &&
    isRecord(value.edges) &&
    isRecord(value.groups) &&
    isRecord(value.files)
  );
}

export function saveBoardSnapshot(
  boardId: string,
  snapshot: BoardCanvasSnapshot,
): void {
  try {
    localStorage.setItem(
      getBoardSnapshotKey(boardId),
      JSON.stringify(snapshot),
    );
  } catch (error) {
    console.error("Failed to save board snapshot", error);
  }
}

export function loadBoardSnapshot(boardId: string): BoardCanvasSnapshot | null {
  const raw = localStorage.getItem(getBoardSnapshotKey(boardId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isSnapshot(parsed)) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to load board snapshot", error);
    return null;
  }
}

export function removeBoardSnapshot(boardId: string): void {
  localStorage.removeItem(getBoardSnapshotKey(boardId));
}
