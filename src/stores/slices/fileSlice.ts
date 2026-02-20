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
