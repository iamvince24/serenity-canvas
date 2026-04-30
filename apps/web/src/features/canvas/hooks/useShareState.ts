import { useCallback, useState } from "react";
import { changeTracker } from "@/db/changeTracker";
import { supabase } from "@/lib/supabase";
import { imageSyncService } from "@/services/imageSyncService";
import { syncService } from "@/services/syncService";
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
  enableShare: (boardId: string) => Promise<void>;
  disableShare: (boardId: string) => Promise<void>;
  retryPublishAssets: (boardId: string) => Promise<void>;
};

// Flush local dirtyChanges (esp. new files rows) to Supabase before
// running syncImages — otherwise syncImages.updateRemoteImagePath uses
// .update().eq() which silently no-ops when the remote row doesn't exist
// yet, and /api/share-publish-assets ends up seeing missing rows or null
// image_path on first publish.
async function flushPendingChanges(boardId: string): Promise<void> {
  try {
    const changes = await changeTracker.getPendingChanges(boardId);
    if (changes.length === 0) return;
    await syncService.pushPendingChanges(boardId, changes);
    await changeTracker.clearChanges(boardId);
  } catch (err) {
    console.warn("[useShareState] flushPendingChanges failed:", err);
  }
}

async function revalidateShare(shareId: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/revalidate-share", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
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

  const enableShare = useCallback(
    async (boardId: string): Promise<void> => {
      const prevMode = shareMode;
      const prevShareId = shareId;
      const prevAssetsStatus = assetsStatus;

      setUpdating(true);
      clearError();

      try {
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

        setShareModeState("public");
        setShareId(newShareId);
        setAssetsStatus("pending");
        // Push pending file rows first so syncImages can write image_path,
        // then upload blobs — both must complete before publish-assets,
        // otherwise the endpoint sees missing rows or null image_path.
        await flushPendingChanges(boardId);
        await imageSyncService.syncImages(boardId);
        await publishAssets(boardId, newShareId);
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

  const disableShare = useCallback(
    async (boardId: string): Promise<void> => {
      const prevMode = shareMode;

      setUpdating(true);
      clearError();

      try {
        const { error } = await supabase
          .from("boards")
          .update({ share_mode: "private" })
          .eq("id", boardId);

        if (error) {
          setShareModeState(prevMode);
          setError("share.error.updateFailed");
          return;
        }

        setShareModeState("private");

        if (shareId) {
          void revalidateShare(shareId);
        }
      } finally {
        setUpdating(false);
      }
    },
    [shareMode, shareId, setUpdating, clearError, setError],
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
        await flushPendingChanges(boardId);
        await imageSyncService.syncImages(boardId);
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
    enableShare,
    disableShare,
    retryPublishAssets,
  };
}
