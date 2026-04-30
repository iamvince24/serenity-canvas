import { syncService } from "@/services/syncService";
import {
  BoardRepository,
  EdgeRepository,
  FileRepository,
  GroupRepository,
  NodeRepository,
  type BoardRow,
} from "@/db/repositories";
import { imageSyncService } from "@/services/imageSyncService";
import { LOCAL_BOARD_ID } from "@/features/canvas/core/constants";
import {
  ACTIVE_BOARD_STORAGE_KEY,
  BOARDS_STORAGE_KEY,
  DEFAULT_BOARD_TITLE,
} from "@/stores/dashboardStore";
import type { Board } from "@/types/board";
import type { CanvasNode, Edge, FileRecord, Group } from "@/types/canvas";

const MIGRATION_STATE_KEY = "local-data-migration";

/**
 * 本地資料遷移的狀態機，持久化於 localStorage。
 *
 * 狀態轉換流程：
 *   none → pending（偵測到本地白板有資料）
 *   pending → in_progress（使用者確認合併，或自動重試）
 *   in_progress → completed（遠端推送成功且本地清理完畢）
 *   pending → deferred（使用者選擇「稍後決定」）
 *   deferred → pending（下次登入時重新提示）
 *
 * 其中 in_progress 會記錄 targetBoardId，以便中斷後能恢復到同一個遠端白板。
 */
export type MigrationState =
  | { status: "none" }
  | { status: "pending" }
  | { status: "in_progress"; targetBoardId: string }
  | { status: "deferred"; deferredAt: number }
  | { status: "completed" };

/** prepareMigrationOnLogin 的回傳值，決定 App 層該如何反應。 */
export type LoginMigrationAction = "none" | "show_dialog" | "auto_retry";

function createBoardId(): string {
  return crypto.randomUUID();
}

/** 防禦性解析 localStorage 中的 JSON，避免損壞資料導致 crash。 */
function isMigrationState(value: unknown): value is MigrationState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const status = (value as { status?: unknown }).status;
  if (status === "none" || status === "pending" || status === "completed") {
    return true;
  }

  if (
    status === "deferred" &&
    typeof (value as { deferredAt?: unknown }).deferredAt === "number"
  ) {
    return true;
  }

  return (
    status === "in_progress" &&
    typeof (value as { targetBoardId?: unknown }).targetBoardId === "string"
  );
}

/**
 * 從 localStorage 的 boards 清單中讀取 local-board 的標題。
 * dashboardStore 用 localStorage 儲存 board 清單；這裡直接解析以避免
 * 在 service 層引入 Zustand store 的 hydration 依賴。
 */
function readLocalBoardTitle(): string {
  const raw = localStorage.getItem(BOARDS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_BOARD_TITLE;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_BOARD_TITLE;
    }

    const localBoard = parsed.find((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }
      return (item as { id?: unknown }).id === LOCAL_BOARD_ID;
    });

    if (!localBoard || typeof localBoard !== "object") {
      return DEFAULT_BOARD_TITLE;
    }

    const title = (localBoard as { title?: unknown }).title;
    if (typeof title !== "string" || title.trim().length === 0) {
      return DEFAULT_BOARD_TITLE;
    }

    return title.trim();
  } catch {
    return DEFAULT_BOARD_TITLE;
  }
}

function clearLocalBoardMetadata(): void {
  localStorage.removeItem(BOARDS_STORAGE_KEY);
  localStorage.removeItem(ACTIVE_BOARD_STORAGE_KEY);
}

export function getMigrationState(): MigrationState {
  const raw = localStorage.getItem(MIGRATION_STATE_KEY);
  if (!raw) {
    return { status: "none" };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isMigrationState(parsed)) {
      return { status: "none" };
    }
    return parsed;
  } catch {
    return { status: "none" };
  }
}

export function setMigrationState(state: MigrationState): void {
  localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify(state));
}

/** 使用 count 查詢快速判斷 local-board 是否有任何實體，不需反序列化整份資料。 */
async function hasLocalBoardData(): Promise<boolean> {
  const [nodeCount, edgeCount, groupCount, fileCount] = await Promise.all([
    NodeRepository.countForBoard(LOCAL_BOARD_ID),
    EdgeRepository.countForBoard(LOCAL_BOARD_ID),
    GroupRepository.countForBoard(LOCAL_BOARD_ID),
    FileRepository.countForBoard(LOCAL_BOARD_ID),
  ]);
  return nodeCount > 0 || edgeCount > 0 || groupCount > 0 || fileCount > 0;
}

/**
 * 登入後決定本地資料遷移的下一步動作。
 * - "none"：local-board 沒有資料，不需遷移。
 * - "show_dialog"：有本地資料，需讓使用者選擇合併或捨棄。
 * - "auto_retry"：上次遷移中斷（in_progress），自動恢復。
 */
export async function prepareMigrationOnLogin(): Promise<LoginMigrationAction> {
  const state = getMigrationState();

  if (state.status === "in_progress") {
    return "auto_retry";
  }

  const hasData = await hasLocalBoardData();
  if (!hasData) {
    setMigrationState({ status: "none" });
    return "none";
  }

  if (state.status === "none" || state.status === "completed") {
    setMigrationState({ status: "pending" });
  }

  return "show_dialog";
}

async function clearLocalBoardData(): Promise<void> {
  await Promise.all([
    NodeRepository.deleteAllForBoard(LOCAL_BOARD_ID),
    EdgeRepository.deleteAllForBoard(LOCAL_BOARD_ID),
    GroupRepository.deleteAllForBoard(LOCAL_BOARD_ID),
    FileRepository.deleteAllForBoard(LOCAL_BOARD_ID),
    BoardRepository.delete(LOCAL_BOARD_ID),
  ]);
}

/**
 * 將已取得的本地白板資料以新的 boardId 寫入 IndexedDB。
 * 接受預先讀取的資料，避免與 migrateLocalBoardToRemote 重複查詢。
 */
async function copyLocalBoardToIdb(
  targetBoardId: string,
  data: {
    nodes: CanvasNode[];
    edges: Edge[];
    groups: Group[];
    files: FileRecord[];
    board: BoardRow | null;
  },
): Promise<void> {
  const { nodes, edges, groups, files, board } = data;

  await BoardRepository.put({
    id: targetBoardId,
    nodeOrder: board?.nodeOrder ?? nodes.map((node) => node.id),
    nodeCount: nodes.length,
    updatedAt: Date.now(),
  });
  await NodeRepository.bulkPut(targetBoardId, nodes);
  await EdgeRepository.bulkPut(targetBoardId, edges);
  await GroupRepository.bulkPut(targetBoardId, groups);
  await FileRepository.bulkPut(targetBoardId, files);
}

/**
 * 核心遷移流程：將 local-board 的所有實體推送至 Supabase，
 * 同時在 IndexedDB 建立一份副本（以 targetBoardId 為 key），
 * 最後上傳圖片至 Storage 並清除原始 local-board 資料。
 *
 * 若傳入 targetBoardId 則使用該 ID；若已存在 in_progress 狀態則恢復先前的 ID；
 * 否則產生新的 UUID。
 */
export async function migrateLocalBoardToRemote(
  targetBoardId?: string,
): Promise<string | null> {
  const existingState = getMigrationState();
  const resolvedTargetBoardId =
    targetBoardId ??
    (existingState.status === "in_progress"
      ? existingState.targetBoardId
      : createBoardId());

  setMigrationState({
    status: "in_progress",
    targetBoardId: resolvedTargetBoardId,
  });

  const [nodes, edges, groups, files, board] = await Promise.all([
    NodeRepository.getAllForBoard(LOCAL_BOARD_ID),
    EdgeRepository.getAllForBoard(LOCAL_BOARD_ID),
    GroupRepository.getAllForBoard(LOCAL_BOARD_ID),
    FileRepository.getAllForBoard(LOCAL_BOARD_ID),
    BoardRepository.getById(LOCAL_BOARD_ID),
  ]);

  if (
    nodes.length === 0 &&
    edges.length === 0 &&
    groups.length === 0 &&
    files.length === 0
  ) {
    setMigrationState({ status: "none" });
    return null;
  }

  const now = Date.now();
  const remoteBoard: Board = {
    id: resolvedTargetBoardId,
    title: readLocalBoardTitle(),
    createdAt: now,
    updatedAt: now,
    nodeCount: nodes.length,
  };

  await syncService.pushBoard(remoteBoard, board?.nodeOrder ?? []);
  await syncService.pushNodes(resolvedTargetBoardId, nodes);
  await syncService.pushEdges(resolvedTargetBoardId, edges);
  await syncService.pushGroups(resolvedTargetBoardId, groups);
  await syncService.pushFiles(resolvedTargetBoardId, files);

  await copyLocalBoardToIdb(resolvedTargetBoardId, {
    nodes,
    edges,
    groups,
    files,
    board,
  });
  await imageSyncService.syncImages(resolvedTargetBoardId);
  await clearLocalBoardData();
  clearLocalBoardMetadata();

  setMigrationState({ status: "completed" });
  return resolvedTargetBoardId;
}

export async function discardLocalBoard(): Promise<void> {
  await clearLocalBoardData();
  clearLocalBoardMetadata();
  setMigrationState({ status: "completed" });
}

export function deferLocalBoardMigration(): void {
  setMigrationState({
    status: "deferred",
    deferredAt: Date.now(),
  });
}
