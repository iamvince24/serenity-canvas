import { create } from "zustand";

type UploadNoticeState = {
  imageUploadErrorMessage: string | null;
  showImageUploadError: (message: string) => void;
  dismissImageUploadError: () => void;
};

export const useUploadNoticeStore = create<UploadNoticeState>((set) => ({
  imageUploadErrorMessage: null,
  showImageUploadError: (message) => {
    set({
      imageUploadErrorMessage: message,
    });
  },
  dismissImageUploadError: () => {
    set({
      imageUploadErrorMessage: null,
    });
  },
}));

export function notifyImageUploadError(message: string): void {
  useUploadNoticeStore.getState().showImageUploadError(message);
}
