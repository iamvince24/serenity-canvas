import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useIsBoardOwner(boardId: string | undefined): boolean {
  const [ownerBoardId, setOwnerBoardId] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId) return;

    let cancelled = false;

    supabase
      .from("boards")
      .select("id")
      .eq("id", boardId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOwnerBoardId(data ? data.id : null);
      });

    return () => {
      cancelled = true;
    };
  }, [boardId]);

  return useMemo(
    () => Boolean(boardId && ownerBoardId === boardId),
    [boardId, ownerBoardId],
  );
}
