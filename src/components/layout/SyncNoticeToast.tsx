import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSyncNoticeStore } from "@/stores/syncNoticeStore";

/** 若有新訊息進來會重設計時器，確保最新訊息至少顯示完整的 5 秒。 */
const AUTO_DISMISS_MS = 5000;

/**
 * 全域同步警告 Toast。
 * 浮動於畫面頂部，顯示 syncNoticeStore 中的警告訊息，5 秒後自動消失。
 */
export function SyncNoticeToast() {
  const { t } = useTranslation();
  const warningMessage = useSyncNoticeStore((state) => state.warningMessage);
  const dismissWarning = useSyncNoticeStore((state) => state.dismissWarning);

  useEffect(() => {
    if (!warningMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      dismissWarning();
    }, AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [dismissWarning, warningMessage]);

  if (!warningMessage) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-lg border border-amber-300 bg-amber-50 shadow-lg">
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {t("syncNotice.title")}
            </p>
            <p className="mt-1 text-sm leading-[1.4] text-amber-900">
              {warningMessage}
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost h-7 shrink-0 px-2 text-xs"
            onClick={dismissWarning}
            aria-label={t("syncNotice.dismissLabel")}
          >
            {t("syncNotice.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
