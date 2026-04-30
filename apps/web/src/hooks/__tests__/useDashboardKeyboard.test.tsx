import { act, fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDashboardKeyboard } from "../useDashboardKeyboard";

describe("useDashboardKeyboard", () => {
  it("Cmd+\\ 會呼叫 onToggleSidebar", () => {
    const onToggleSidebar = vi.fn();

    renderHook(() => useDashboardKeyboard({ onToggleSidebar }));

    act(() => {
      fireEvent.keyDown(window, { key: "\\", metaKey: true });
    });

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+\\ 會呼叫 onToggleSidebar", () => {
    const onToggleSidebar = vi.fn();

    renderHook(() => useDashboardKeyboard({ onToggleSidebar }));

    act(() => {
      fireEvent.keyDown(window, { key: "\\", ctrlKey: true });
    });

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("Cmd+\\ 會 preventDefault", () => {
    const onToggleSidebar = vi.fn();

    renderHook(() => useDashboardKeyboard({ onToggleSidebar }));

    const event = new KeyboardEvent("keydown", {
      key: "\\",
      metaKey: true,
      bubbles: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    act(() => {
      window.dispatchEvent(event);
    });

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("其他按鍵不會觸發 onToggleSidebar", () => {
    const onToggleSidebar = vi.fn();

    renderHook(() => useDashboardKeyboard({ onToggleSidebar }));

    act(() => {
      fireEvent.keyDown(window, { key: "a" });
    });
    act(() => {
      fireEvent.keyDown(window, { key: "\\" });
    });
    act(() => {
      fireEvent.keyDown(window, { key: "\\", shiftKey: true });
    });

    expect(onToggleSidebar).not.toHaveBeenCalled();
  });

  it("unmount 時移除 keydown listener", () => {
    const onToggleSidebar = vi.fn();

    const { unmount } = renderHook(() =>
      useDashboardKeyboard({ onToggleSidebar }),
    );

    unmount();

    act(() => {
      fireEvent.keyDown(window, { key: "\\", metaKey: true });
    });

    expect(onToggleSidebar).not.toHaveBeenCalled();
  });
});
