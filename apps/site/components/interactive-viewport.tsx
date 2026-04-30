"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";

const ZOOM_STEP = 1.05;

type ContentBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type Props = {
  initialScale: number;
  initialOffsetX: number;
  initialOffsetY: number;
  contentBounds: ContentBounds;
  children: ReactNode;
};

type Viewport = { scale: number; offsetX: number; offsetY: number };

type PointerEntry = { id: number; x: number; y: number };

type PendingWheel = {
  panDeltaX: number;
  panDeltaY: number;
  pinchDeltaY: number;
  pinchPointer: { x: number; y: number } | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function InteractiveViewport({
  initialScale,
  initialOffsetX,
  initialOffsetY,
  contentBounds,
  children,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vpRef = useRef<Viewport>({
    scale: initialScale,
    offsetX: initialOffsetX,
    offsetY: initialOffsetY,
  });
  const [, rerender] = useReducer((c: number) => c + 1, 0);

  const viewportSizeRef = useRef({ width: 0, height: 0 });
  const activePointersRef = useRef<PointerEntry[]>([]);
  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(0);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const pendingRef = useRef<PendingWheel>({
    panDeltaX: 0,
    panDeltaY: 0,
    pinchDeltaY: 0,
    pinchPointer: null,
  });
  const frameRef = useRef<number | null>(null);

  const minScale = initialScale * 0.1;
  const maxScale = initialScale * 3.0;

  const clampOffset = useCallback(
    (vp: Viewport): Viewport => {
      const { width, height } = viewportSizeRef.current;
      if (width === 0 || height === 0) return vp;

      const midX = (contentBounds.minX + contentBounds.maxX) / 2;
      const midY = (contentBounds.minY + contentBounds.maxY) / 2;

      return {
        scale: vp.scale,
        offsetX: clamp(vp.offsetX, -midX, width / vp.scale - midX),
        offsetY: clamp(vp.offsetY, -midY, height / vp.scale - midY),
      };
    },
    [contentBounds],
  );

  const updateViewport = useCallback(
    (next: Partial<Viewport>) => {
      const raw = { ...vpRef.current, ...next };
      const clamped = clampOffset(raw);
      vpRef.current = clamped;
      rerender();
    },
    [clampOffset],
  );

  // ResizeObserver to track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      viewportSizeRef.current = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
    });
    ro.observe(el);
    viewportSizeRef.current = {
      width: el.clientWidth,
      height: el.clientHeight,
    };
    return () => ro.disconnect();
  }, []);

  // --- Pointer handlers (pan + pinch) ---

  const getPointerDist = (a: PointerEntry, b: PointerEntry) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const getPointerMid = (a: PointerEntry, b: PointerEntry) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const pointers = activePointersRef.current;
      pointers.push({ id: e.pointerId, x: e.clientX, y: e.clientY });

      if (pointers.length === 2) {
        // Enter pinch mode
        pinchStartDistRef.current = getPointerDist(pointers[0], pointers[1]);
        pinchStartScaleRef.current = vpRef.current.scale;
        draggingRef.current = false;
      } else if (pointers.length === 1) {
        draggingRef.current = true;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
        containerRef.current?.style.setProperty("cursor", "grabbing");
      }

      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const pointers = activePointersRef.current;
      const idx = pointers.findIndex((p) => p.id === e.pointerId);
      if (idx === -1) return;
      pointers[idx] = { id: e.pointerId, x: e.clientX, y: e.clientY };

      if (pointers.length === 2) {
        // Pinch zoom
        const dist = getPointerDist(pointers[0], pointers[1]);
        const ratio = dist / pinchStartDistRef.current;
        const rawNext = pinchStartScaleRef.current * ratio;
        const nextScale = clamp(rawNext, minScale, maxScale);
        const vp = vpRef.current;

        if (nextScale !== vp.scale) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          const mid = getPointerMid(pointers[0], pointers[1]);
          const pointerX = mid.x - rect.left;
          const pointerY = mid.y - rect.top;

          const cx = pointerX / vp.scale - vp.offsetX;
          const cy = pointerY / vp.scale - vp.offsetY;
          const newOffsetX = pointerX / nextScale - cx;
          const newOffsetY = pointerY / nextScale - cy;

          updateViewport({
            scale: nextScale,
            offsetX: newOffsetX,
            offsetY: newOffsetY,
          });
        }
        return;
      }

      if (!draggingRef.current) return;

      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      updateViewport({
        offsetX: vpRef.current.offsetX + dx / vpRef.current.scale,
        offsetY: vpRef.current.offsetY + dy / vpRef.current.scale,
      });
    },
    [minScale, maxScale, updateViewport],
  );

  const handlePointerEnd = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const pointers = activePointersRef.current;
      const idx = pointers.findIndex((p) => p.id === e.pointerId);
      if (idx !== -1) pointers.splice(idx, 1);

      e.currentTarget.releasePointerCapture(e.pointerId);

      if (pointers.length === 1) {
        // Transition from pinch back to pan
        draggingRef.current = true;
        lastPointerRef.current = { x: pointers[0].x, y: pointers[0].y };
      } else if (pointers.length === 0) {
        draggingRef.current = false;
        containerRef.current?.style.setProperty("cursor", "grab");
      }
    },
    [],
  );

  // --- Wheel handler (scroll pan + ctrl/pinch zoom) with RAF batching ---

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const pending = pendingRef.current;

    const flushPending = () => {
      frameRef.current = null;

      const panDX = pending.panDeltaX;
      const panDY = pending.panDeltaY;
      const pinchDY = pending.pinchDeltaY;
      const pinchPtr = pending.pinchPointer;

      pending.panDeltaX = 0;
      pending.panDeltaY = 0;
      pending.pinchDeltaY = 0;
      pending.pinchPointer = null;

      if (panDX === 0 && panDY === 0 && pinchDY === 0) return;

      const vp = vpRef.current;
      let { scale, offsetX, offsetY } = vp;

      if (panDX !== 0 || panDY !== 0) {
        offsetX -= panDX / scale;
        offsetY -= panDY / scale;
      }

      if (pinchPtr && pinchDY !== 0) {
        const direction = pinchDY > 0 ? -1 : 1;
        const rawNext = direction > 0 ? scale * ZOOM_STEP : scale / ZOOM_STEP;
        const nextScale = clamp(rawNext, minScale, maxScale);

        if (nextScale !== scale) {
          const cx = pinchPtr.x / scale - offsetX;
          const cy = pinchPtr.y / scale - offsetY;
          offsetX = pinchPtr.x / nextScale - cx;
          offsetY = pinchPtr.y / nextScale - cy;
          scale = nextScale;
        }
      }

      updateViewport({ scale, offsetX, offsetY });
    };

    const scheduleFlush = () => {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(flushPending);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const isPinch = e.ctrlKey || e.metaKey;

      if (!isPinch) {
        pending.panDeltaX += e.deltaX;
        pending.panDeltaY += e.deltaY;
        scheduleFlush();
        return;
      }

      const rect = el.getBoundingClientRect();
      pending.pinchDeltaY += e.deltaY;
      pending.pinchPointer = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      scheduleFlush();
    };

    el.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      pending.panDeltaX = 0;
      pending.panDeltaY = 0;
      pending.pinchDeltaY = 0;
      pending.pinchPointer = null;
      el.removeEventListener("wheel", handleWheel);
    };
  }, [minScale, maxScale, updateViewport]);

  const { scale, offsetX, offsetY } = vpRef.current;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        touchAction: "none",
        cursor: "grab",
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transformOrigin: "0 0",
          transform: `scale(${scale}) translate(${offsetX}px, ${offsetY}px)`,
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
