import { create } from "zustand";

/**
 * 同步警告通知的全域狀態。
 * 用於在圖片上傳部分失敗等非致命情境下，向使用者顯示提示 toast。
 */
type SyncNoticeState = {
  warningMessage: string | null;
  showWarning: (message: string) => void;
  dismissWarning: () => void;
};

export const useSyncNoticeStore = create<SyncNoticeState>((set) => ({
  warningMessage: null,
  showWarning: (message) => {
    set({ warningMessage: message });
  },
  dismissWarning: () => {
    set({ warningMessage: null });
  },
}));

/** 在 React 元件外（例如 service 層）觸發同步警告的便捷函式。 */
export function notifySyncWarning(message: string): void {
  useSyncNoticeStore.getState().showWarning(message);
}
