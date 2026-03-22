import { useEffect, useRef } from "react";

export function useCachedContainerRect(
  container: HTMLElement | null,
): React.RefObject<DOMRect | null> {
  const rectRef = useRef<DOMRect | null>(null);

  useEffect(() => {
    if (!container) {
      rectRef.current = null;
      return;
    }

    const update = () => {
      rectRef.current = container.getBoundingClientRect();
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(container);

    window.addEventListener("scroll", update, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update, true);
    };
  }, [container]);

  return rectRef;
}
