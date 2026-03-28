import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query. Returns `true` when the query matches.
 * Safe for SSR (always returns `false` on the server).
 */
export function useMediaQuery(query: string): boolean {
  const mql = typeof window !== "undefined" ? window.matchMedia(query) : null;

  return useSyncExternalStore(
    (cb) => {
      mql?.addEventListener("change", cb);
      return () => mql?.removeEventListener("change", cb);
    },
    () => mql?.matches ?? false,
    () => false,
  );
}
