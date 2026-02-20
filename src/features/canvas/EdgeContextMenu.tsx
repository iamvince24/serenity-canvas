import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  CANVAS_COLOR_PRESETS,
  getEdgeStrokeColor,
  type CanvasNodeColor,
} from "../../constants/colors";
import { cn } from "../../lib/utils";
import { useCanvasStore } from "../../stores/canvasStore";
import type { EdgeDirection, EdgeLineStyle } from "../../types/canvas";

type EdgeContextMenuProps = {
  edgeId: string;
  clientX: number;
  clientY: number;
  onClose: () => void;
};

type MenuPosition = {
  left: number;
  top: number;
};

const MENU_VIEWPORT_PADDING = 12;
const MENU_Z_INDEX = 3000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const LINE_STYLE_OPTIONS: readonly {
  id: EdgeLineStyle;
  label: string;
  borderTopStyle: "solid" | "dashed" | "dotted";
}[] = [
  { id: "solid", label: "Solid", borderTopStyle: "solid" },
  { id: "dashed", label: "Dashed", borderTopStyle: "dashed" },
  { id: "dotted", label: "Dotted", borderTopStyle: "dotted" },
];

export function EdgeContextMenu({
  edgeId,
  clientX,
  clientY,
  onClose,
}: EdgeContextMenuProps) {
  const edge = useCanvasStore((state) => state.edges[edgeId]);
  const updateEdge = useCanvasStore((state) => state.updateEdge);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({
    left: clientX,
    top: clientY,
  });

  const updateMenuPosition = useCallback(() => {
    const menuElement = menuRef.current;
    const menuWidth = menuElement?.offsetWidth ?? 0;
    const menuHeight = menuElement?.offsetHeight ?? 0;
    const maxLeft =
      window.innerWidth - MENU_VIEWPORT_PADDING - Math.max(menuWidth, 0);
    const maxTop =
      window.innerHeight - MENU_VIEWPORT_PADDING - Math.max(menuHeight, 0);

    setMenuPosition({
      left: clamp(
        clientX,
        MENU_VIEWPORT_PADDING,
        Math.max(maxLeft, MENU_VIEWPORT_PADDING),
      ),
      top: clamp(
        clientY,
        MENU_VIEWPORT_PADDING,
        Math.max(maxTop, MENU_VIEWPORT_PADDING),
      ),
    });
  }, [clientX, clientY]);

  useEffect(() => {
    if (edge) {
      return;
    }

    onClose();
  }, [edge, onClose]);

  useEffect(() => {
    let frameId: number | null =
      window.requestAnimationFrame(updateMenuPosition);
    const handleWindowResize = () => {
      updateMenuPosition();
    };

    window.addEventListener("resize", handleWindowResize);
    window.addEventListener("scroll", handleWindowResize, true);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      window.removeEventListener("resize", handleWindowResize);
      window.removeEventListener("scroll", handleWindowResize, true);
    };
  }, [updateMenuPosition]);

  useEffect(() => {
    const handleWindowPointerDown = (event: PointerEvent) => {
      const menuElement = menuRef.current;
      if (!menuElement) {
        onClose();
        return;
      }

      const target = event.target;
      const isInsideTarget =
        target instanceof Node && menuElement.contains(target);
      const composedPath =
        typeof event.composedPath === "function" ? event.composedPath() : null;
      const isInsidePath =
        Array.isArray(composedPath) && composedPath.includes(menuElement);
      if (isInsideTarget || isInsidePath) {
        return;
      }

      onClose();
    };

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("pointerdown", handleWindowPointerDown, {
      capture: true,
    });
    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handleWindowPointerDown, {
        capture: true,
      });
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [onClose]);

  const menuStyle = useMemo<CSSProperties>(
    () => ({
      position: "fixed",
      left: `${menuPosition.left}px`,
      top: `${menuPosition.top}px`,
      zIndex: MENU_Z_INDEX,
      maxHeight: `calc(100vh - ${MENU_VIEWPORT_PADDING * 2}px)`,
      overflowY: "auto",
    }),
    [menuPosition.left, menuPosition.top],
  );

  if (!edge || typeof document === "undefined") {
    return null;
  }

  const handleSelectLineStyle = (lineStyle: EdgeLineStyle) => {
    updateEdge(edge.id, { lineStyle });
  };

  const handleSelectColor = (color: CanvasNodeColor) => {
    updateEdge(edge.id, { color });
  };

  const handleDirectionChange = (direction: EdgeDirection) => {
    updateEdge(edge.id, { direction });
  };

  return createPortal(
    <div
      ref={menuRef}
      className="card-widget__settings-dropdown w-64"
      style={menuStyle}
      data-edge-context-menu="true"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="px-1 pb-1">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">
          Line Style
        </p>
        <div className="flex gap-2">
          {LINE_STYLE_OPTIONS.map((option) => {
            const isActive = edge.lineStyle === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "inline-flex h-8 flex-1 items-center justify-center rounded-md border bg-elevated transition-colors",
                  isActive
                    ? "border-sage bg-sage-lighter/60"
                    : "border-border hover:bg-surface",
                )}
                aria-label={`Set line style to ${option.label}`}
                onClick={() => handleSelectLineStyle(option.id)}
              >
                <span
                  className="block w-10 border-t-2 border-foreground"
                  style={{
                    borderTopStyle: option.borderTopStyle,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="card-widget__settings-divider" />

      <div className="card-color-picker px-1 pb-1 pt-0">
        <div className="card-color-picker__title">Color</div>
        <div className="card-color-picker__grid">
          <button
            type="button"
            className={cn("card-color-picker__option", {
              "card-color-picker__option--active": edge.color === null,
            })}
            aria-label="Set edge color to none"
            title="None"
            onClick={() => handleSelectColor(null)}
          >
            <span className="card-color-picker__swatch card-color-picker__swatch--none" />
          </button>

          {CANVAS_COLOR_PRESETS.map((preset) => {
            const isActive = edge.color === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={cn("card-color-picker__option", {
                  "card-color-picker__option--active": isActive,
                })}
                aria-label={`Set edge color to ${preset.label}`}
                title={preset.label}
                onClick={() => handleSelectColor(preset.id)}
              >
                <span
                  className="card-color-picker__swatch"
                  style={{
                    borderColor: preset.border,
                    backgroundColor: getEdgeStrokeColor(preset.id),
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="card-widget__settings-divider" />

      <div className="px-1 pb-1">
        <label
          className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted"
          htmlFor={`edge-direction-${edge.id}`}
        >
          Direction
        </label>
        <select
          id={`edge-direction-${edge.id}`}
          className="input-calm h-9 w-full px-2 text-sm"
          value={edge.direction}
          onChange={(event) =>
            handleDirectionChange(event.target.value as EdgeDirection)
          }
        >
          <option value="forward">Forward</option>
          <option value="both">Both</option>
          <option value="none">None</option>
        </select>
      </div>
    </div>,
    document.body,
  );
}
