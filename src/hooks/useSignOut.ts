import { useState } from "react";
import { useNavigate } from "react-router";
import { BoardRepository } from "@/db/repositories";
import { LOCAL_BOARD_ID } from "@/features/canvas/core/constants";
import { syncManager } from "@/services/syncManager";
import { useAuthStore } from "@/stores/authStore";
import { useDashboardStore } from "@/stores/dashboardStore";

type UseSignOutResult = {
  isSigningOut: boolean;
  handleSignOut: () => void;
};

export function useSignOut(): UseSignOutResult {
  const signOut = useAuthStore((state) => state.signOut);
  const loadBoards = useDashboardStore((state) => state.loadBoards);
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = () => {
    setIsSigningOut(true);
    void signOut()
      .then(async () => {
        // 登出後停止同步、重建預設的 local-board，並導回本地白板頁面。
        syncManager.stop();
        await BoardRepository.createDefault(LOCAL_BOARD_ID);
        loadBoards();
        navigate(`/canvas/${LOCAL_BOARD_ID}`, { replace: true });
      })
      .catch((error: unknown) => {
        console.error("Failed to sign out", error);
      })
      .finally(() => {
        setIsSigningOut(false);
      });
  };

  return { isSigningOut, handleSignOut };
}
