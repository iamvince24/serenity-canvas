import { useEffect, useRef } from "react";

/**
 * 指標擷取期間的回呼介面。
 * 用於拖曳、縮放等操作時，在整個 window 層級監聽指標與鍵盤事件。
 */
type PointerCaptureCallbacks = {
  onPointerMove?: (clientX: number, clientY: number) => void;
  onPointerUp?: (clientX?: number, clientY?: number) => void;
  onPointerCancel?: () => void;
  onKeyDown?: (event: KeyboardEvent) => void;
};

type UsePointerCaptureOptions = {
  /** 觸發 onKeyDown 的按鍵。未指定時，任何 keydown 都會觸發。常用於 Escape 取消操作。 */
  captureKey?: string;
};

/** 檢查 keydown 事件是否對應到指定的 captureKey。 */
function isEscapeKeyMatch(
  captureKey: string | undefined,
  event: KeyboardEvent,
) {
  if (!captureKey) {
    return true;
  }

  return event.key === captureKey;
}

/**
 * 在整個 window 層級擷取指標與鍵盤事件，供拖曳、縮放等操作使用。
 *
 * 當 isActive 為 true 時，會同時監聽 pointer、mouse、touch 三種事件來源，
 * 以確保滑鼠、觸控筆、觸控螢幕等裝置都能正確收到事件。
 *
 * @param isActive - 是否啟用擷取。為 false 時不註冊任何監聽器。
 * @param callbacks - 事件回呼。使用 ref 保存，避免 effect 依賴 callbacks 導致頻繁重綁。
 * @param options.captureKey - 觸發 onKeyDown 的按鍵（例如 "Escape"）。未指定則所有 keydown 都會觸發。
 */
export function usePointerCapture(
  isActive: boolean,
  callbacks: PointerCaptureCallbacks,
  options?: UsePointerCaptureOptions,
): void {
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      callbacksRef.current.onPointerMove?.(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      callbacksRef.current.onPointerUp?.(event.clientX, event.clientY);
    };

    const handlePointerCancel = () => {
      callbacksRef.current.onPointerCancel?.();
    };

    const handleMouseMove = (event: MouseEvent) => {
      callbacksRef.current.onPointerMove?.(event.clientX, event.clientY);
    };

    const handleMouseUp = (event: MouseEvent) => {
      callbacksRef.current.onPointerUp?.(event.clientX, event.clientY);
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      // 需 preventDefault 才能阻止觸控時的頁面捲動，故使用 passive: false。
      event.preventDefault();
      callbacksRef.current.onPointerMove?.(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      // 多指觸控時，changedTouches 可能為空；仍呼叫 onPointerUp 以結束擷取。
      if (!touch) {
        callbacksRef.current.onPointerUp?.();
        return;
      }

      callbacksRef.current.onPointerUp?.(touch.clientX, touch.clientY);
    };

    const handleTouchCancel = () => {
      callbacksRef.current.onPointerCancel?.();
    };

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (!isEscapeKeyMatch(options?.captureKey, event)) {
        return;
      }

      callbacksRef.current.onKeyDown?.(event);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchCancel);
    // 使用 capture phase，確保在輸入框等元素取得焦點時仍能收到 Escape 等按鍵。
    if (callbacks.onKeyDown) {
      window.addEventListener("keydown", handleWindowKeyDown, true);
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
      if (callbacks.onKeyDown) {
        window.removeEventListener("keydown", handleWindowKeyDown, true);
      }
    };
  }, [callbacks.onKeyDown, isActive, options?.captureKey]);
}
