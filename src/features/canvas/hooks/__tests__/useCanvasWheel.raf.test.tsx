import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../../stores/canvasStore";
import type { ViewportState } from "../../../../types/canvas";
import { useCanvasWheel } from "../useCanvasWheel";

function WheelHookHarness({
  overlayContainer,
}: {
  overlayContainer: HTMLDivElement | null;
}) {
  useCanvasWheel({ overlayContainer });
  return null;
}

async function flushRafQueue(
  queue: Map<number, FrameRequestCallback>,
): Promise<void> {
  await act(async () => {
    const callbacks = Array.from(queue.values());
    queue.clear();
    for (const callback of callbacks) {
      callback(16);
    }
  });
}

describe("useCanvasWheel RAF throttling", () => {
  const originalSetViewport = useCanvasStore.getState().setViewport;
  let rafQueue: Map<number, FrameRequestCallback>;
  let rafId = 0;

  beforeEach(() => {
    rafQueue = new Map();
    rafId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      rafId += 1;
      rafQueue.set(rafId, callback);
      return rafId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      rafQueue.delete(id);
    });
  });

  afterEach(() => {
    act(() => {
      useCanvasStore.setState({
        viewport: { x: 0, y: 0, zoom: 1 },
        setViewport: originalSetViewport,
      });
    });
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("coalesces rapid pan wheel events into one setViewport call per frame", async () => {
    const setViewportSpy = vi.fn((viewport: ViewportState) => {
      originalSetViewport(viewport);
    });
    useCanvasStore.setState({
      viewport: { x: 0, y: 0, zoom: 1 },
      setViewport: setViewportSpy,
    });

    const overlay = document.createElement("div");
    overlay.getBoundingClientRect = () => new DOMRect(0, 0, 1200, 800);
    document.body.appendChild(overlay);
    render(<WheelHookHarness overlayContainer={overlay} />);

    fireEvent.wheel(overlay, {
      deltaX: 10,
      deltaY: 5,
      clientX: 220,
      clientY: 180,
    });
    fireEvent.wheel(overlay, {
      deltaX: 14,
      deltaY: -9,
      clientX: 260,
      clientY: 200,
    });
    fireEvent.wheel(overlay, {
      deltaX: -4,
      deltaY: 20,
      clientX: 300,
      clientY: 220,
    });

    expect(setViewportSpy).toHaveBeenCalledTimes(0);

    await flushRafQueue(rafQueue);

    expect(setViewportSpy).toHaveBeenCalledTimes(1);
    expect(useCanvasStore.getState().viewport).toEqual({
      x: -20,
      y: -16,
      zoom: 1,
    });
  });

  it("coalesces pinch wheel events and uses latest pointer position", async () => {
    const setViewportSpy = vi.fn((viewport: ViewportState) => {
      originalSetViewport(viewport);
    });
    useCanvasStore.setState({
      viewport: { x: 100, y: 80, zoom: 1 },
      setViewport: setViewportSpy,
    });

    const overlay = document.createElement("div");
    overlay.getBoundingClientRect = () => new DOMRect(0, 0, 1200, 800);
    document.body.appendChild(overlay);
    render(<WheelHookHarness overlayContainer={overlay} />);

    fireEvent.wheel(overlay, {
      ctrlKey: true,
      deltaY: -120,
      clientX: 280,
      clientY: 200,
    });
    fireEvent.wheel(overlay, {
      ctrlKey: true,
      deltaY: -40,
      clientX: 320,
      clientY: 220,
    });

    expect(setViewportSpy).toHaveBeenCalledTimes(0);

    await flushRafQueue(rafQueue);

    expect(setViewportSpy).toHaveBeenCalledTimes(1);
    const viewport = useCanvasStore.getState().viewport;
    expect(viewport.zoom).toBeCloseTo(1.05);
    expect(viewport.x).toBeCloseTo(89);
    expect(viewport.y).toBeCloseTo(73);
  });
});
