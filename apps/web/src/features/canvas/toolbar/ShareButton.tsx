import { useCallback, useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabase";
import { useIsBoardOwner } from "../hooks/useIsBoardOwner";
import { ShareDialog } from "../share/ShareDialog";

type ShareButtonProps = {
  boardId: string;
};

export function ShareButton({ boardId }: ShareButtonProps) {
  const { t } = useTranslation();
  const isOwner = useIsBoardOwner(boardId);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  const refreshBadge = useCallback(() => {
    supabase
      .from("boards")
      .select("share_mode")
      .eq("id", boardId)
      .single()
      .then(({ data }) => setIsPublic(data?.share_mode === "public"));
  }, [boardId]);

  useEffect(() => {
    refreshBadge();
  }, [refreshBadge]);

  if (!isOwner) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="btn-secondary relative h-9 w-9 justify-center px-0"
            aria-label={t("share.button.tooltip")}
            onClick={() => setIsShareDialogOpen(true)}
          >
            <Share2 size={16} />
            {isPublic && (
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-500"
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {t("share.button.tooltip")}
        </TooltipContent>
      </Tooltip>

      <ShareDialog
        open={isShareDialogOpen}
        onOpenChange={(open) => {
          setIsShareDialogOpen(open);
          if (!open) refreshBadge();
        }}
        boardId={boardId}
      />
    </>
  );
}
