import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useShareStore } from "@/stores/shareStore";
import { generateShareId } from "@serenity/shared/share";

type ShareMode = "private" | "public";
type AssetsStatus = "pending" | "ready" | "partial" | "failed" | null;

type ShareState = {
  shareMode: ShareMode;
  shareId: string | null;
  assetsStatus: AssetsStatus;
  isLoading: boolean;
};

type UseShareStateReturn = ShareState & {
  load: (boardId: string) => Promise<void>;
  setShareMode: (boardId: string, mode: ShareMode) => Promise<void>;
  retryPublishAssets: (boardId: string) => Promise<void>;
};

async function revalidateShare(shareId: string): Promise<void> {
  try {
    await fetch("/api/revalidate-share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId }),
    });
  } catch (err) {
    console.warn("[useShareState] revalidate-share failed:", err);
  }
}

export function useShareState(): UseShareStateReturn {
  const [shareMode, setShareModeState] = useState<ShareMode>("private");
  const [shareId, setShareId] = useState<string | null>(null);
  const [assetsStatus, setAssetsStatus] = useState<AssetsStatus>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { setUpdating, setError, clearError } = useShareStore();

  const publishAssets = useCallback(
    async (boardId: string, currentShareId: string): Promise<void> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      try {
        const res = await fetch("/api/share-publish-assets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ boardId }),
          signal: controller.signal,
        });

        if (res.status === 429) {
          setError("share.toast.rateLimited");
          setAssetsStatus("failed");
          return;
        }

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            code?: string;
          };
          if (body.code === "too_many_assets") {
            setError("share.error.tooManyAssets");
          }
          setAssetsStatus("failed");
          return;
        }

        const body = (await res.json()) as {
          share_assets_status: AssetsStatus;
        };
        setAssetsStatus(body.share_assets_status);

        const finalStatus = body.share_assets_status;
        if (finalStatus === "ready" || finalStatus === "partial") {
          void revalidateShare(currentShareId);
        }
      } catch {
        setAssetsStatus("failed");
      } finally {
        clearTimeout(timer);
      }
    },
    [setError],
  );

  const load = useCallback(
    async (boardId: string): Promise<void> => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("boards")
          .select("share_mode, share_id, share_assets_status")
          .eq("id", boardId)
          .single();

        if (error || !data) {
          setError("share.error.updateFailed");
          return;
        }

        setShareModeState((data.share_mode as ShareMode) ?? "private");
        setShareId(data.share_id ?? null);
        setAssetsStatus((data.share_assets_status as AssetsStatus) ?? null);
      } finally {
        setIsLoading(false);
      }
    },
    [setError],
  );

  const setShareMode = useCallback(
    async (boardId: string, mode: ShareMode): Promise<void> => {
      const prevMode = shareMode;
      const prevShareId = shareId;
      const prevAssetsStatus = assetsStatus;

      setShareModeState(mode);
      setUpdating(true);
      clearError();

      try {
        if (mode === "public") {
          let newShareId = shareId ?? generateShareId();

          const { error } = await supabase
            .from("boards")
            .update({
              share_mode: "public",
              share_id: newShareId,
              share_assets_status: "pending",
            })
            .eq("id", boardId);

          if (error) {
            if (error.code === "23505") {
              newShareId = generateShareId();
              const { error: retryError } = await supabase
                .from("boards")
                .update({
                  share_mode: "public",
                  share_id: newShareId,
                  share_assets_status: "pending",
                })
                .eq("id", boardId);

              if (retryError) {
                setShareModeState(prevMode);
                setShareId(prevShareId);
                setAssetsStatus(prevAssetsStatus);
                setError("share.error.updateFailed");
                return;
              }
            } else {
              setShareModeState(prevMode);
              setShareId(prevShareId);
              setAssetsStatus(prevAssetsStatus);
              setError("share.error.updateFailed");
              return;
            }
          }

          setShareId(newShareId);
          setAssetsStatus("pending");
          await publishAssets(boardId, newShareId);
        } else {
          const { error } = await supabase
            .from("boards")
            .update({ share_mode: "private" })
            .eq("id", boardId);

          if (error) {
            setShareModeState(prevMode);
            setError("share.error.updateFailed");
            return;
          }

          if (shareId) {
            void revalidateShare(shareId);
          }
        }
      } finally {
        setUpdating(false);
      }
    },
    [
      shareMode,
      shareId,
      assetsStatus,
      setUpdating,
      clearError,
      setError,
      publishAssets,
    ],
  );

  const retryPublishAssets = useCallback(
    async (boardId: string): Promise<void> => {
      if (!shareId) return;

      setUpdating(true);
      clearError();

      try {
        const { error } = await supabase
          .from("boards")
          .update({ share_assets_status: "pending" })
          .eq("id", boardId);

        if (error) {
          setError("share.error.updateFailed");
          return;
        }

        setAssetsStatus("pending");
        await publishAssets(boardId, shareId);
      } finally {
        setUpdating(false);
      }
    },
    [shareId, setUpdating, clearError, setError, publishAssets],
  );

  return {
    shareMode,
    shareId,
    assetsStatus,
    isLoading,
    load,
    setShareMode,
    retryPublishAssets,
  };
}
