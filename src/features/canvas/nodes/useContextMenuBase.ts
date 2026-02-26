import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

type UseContextMenuBaseOptions = {
  clientX: number;
  clientY: number;
  onClose: () => void;
  shouldClose: boolean;
};

type MenuPosition = {
  left: number;
  top: number;
};

type UseContextMenuBaseResult = {
  menuRef: RefObject<HTMLDivElement | null>;
  menuStyle: CSSProperties;
  handleMenuKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

const MENU_VIEWPORT_PADDING = 12;
const MENU_Z_INDEX = 3000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function useContextMenuBase({
  clientX,
  clientY,
  onClose,
  shouldClose,
}: UseContextMenuBaseOptions): UseContextMenuBaseResult {
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

  const focusRelativeMenuItem = useCallback((delta: number) => {
    const menuElement = menuRef.current;
    if (!menuElement) {
      return;
    }

    const menuItems = Array.from(
      menuElement.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    );
    if (menuItems.length === 0) {
      return;
    }

    const activeElement =
      document.activeElement instanceof HTMLButtonElement
        ? document.activeElement
        : null;
    const activeIndex = activeElement ? menuItems.indexOf(activeElement) : -1;
    const nextIndex =
      activeIndex < 0
        ? delta >= 0
          ? 0
          : menuItems.length - 1
        : (activeIndex + delta + menuItems.length) % menuItems.length;

    menuItems[nextIndex]?.focus();
  }, []);

  useEffect(() => {
    if (!shouldClose) {
      return;
    }

    onClose();
  }, [onClose, shouldClose]);

  useEffect(() => {
    let frameId: number | null = window.requestAnimationFrame(() => {
      updateMenuPosition();
      focusRelativeMenuItem(1);
    });
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
  }, [focusRelativeMenuItem, updateMenuPosition]);

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

  const handleMenuKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        focusRelativeMenuItem(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        focusRelativeMenuItem(-1);
      }
    },
    [focusRelativeMenuItem],
  );

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

  return {
    menuRef,
    menuStyle,
    handleMenuKeyDown,
  };
}
