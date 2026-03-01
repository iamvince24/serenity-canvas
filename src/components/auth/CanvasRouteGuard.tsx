import { Navigate, useParams } from "react-router";
import { LOCAL_BOARD_ID } from "@/features/canvas/core/constants";
import { CanvasPage } from "@/pages/CanvasPage";
import { useAuthStore } from "@/stores/authStore";

export function CanvasRouteGuard() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  if (!id) {
    return <Navigate to={`/canvas/${LOCAL_BOARD_ID}`} replace />;
  }

  // local board 永遠公開，保留 offline-first 使用情境。
  if (id === LOCAL_BOARD_ID) {
    return <CanvasPage boardId={id} />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#C9D3C4] border-t-[#708067]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <CanvasPage boardId={id} />;
}
