import type { FileRecord } from "../../types/canvas";
import type { CanvasStore } from "../storeTypes";
import { removeFilesByIds } from "../storeHelpers";

type SetState = (
  partial:
    | Partial<CanvasStore>
    | ((state: CanvasStore) => Partial<CanvasStore>),
) => void;

export type FileSlice = {
  files: Record<string, FileRecord>;
  addFile: (record: FileRecord) => void;
  removeFile: (id: string) => void;
};

/** Look up a FileRecord by its SHA-1 asset_id (content hash). */
export function getFileByAssetId(
  files: Record<string, FileRecord>,
  assetId: string,
): FileRecord | undefined {
  return Object.values(files).find((f) => f.asset_id === assetId);
}

export function createFileSlice(set: SetState): FileSlice {
  return {
    files: {},
    addFile: (record) => {
      set((state) => ({
        files: {
          ...state.files,
          [record.id]: record,
        },
      }));
    },
    removeFile: (id) => {
      set((state) => ({
        files: removeFilesByIds(state.files, [id]),
      }));
    },
  };
}
