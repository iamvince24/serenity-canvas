import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { LocalDataMigrationDialog } from "./components/auth/LocalDataMigrationDialog";
import { CanvasRouteGuard } from "./components/auth/CanvasRouteGuard";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { SyncNoticeToast } from "./components/layout/SyncNoticeToast";
import { LOCAL_BOARD_ID } from "./features/canvas/core/constants";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import {
  deferLocalBoardMigration,
  discardLocalBoard,
  migrateLocalBoardToRemote,
  prepareMigrationOnLogin,
} from "./services/localDataMigrationService";
import { useAuthStore } from "./stores/authStore";
import { useDashboardStore } from "./stores/dashboardStore";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "本地資料遷移失敗，請稍後再試。";
}

function App() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const loadBoards = useDashboardStore((state) => state.loadBoards);
  const [isMigrationDialogOpen, setIsMigrationDialogOpen] = useState(false);
  const [isMigrationSubmitting, setIsMigrationSubmitting] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  // 用 ref 而非 state 做重入防護，避免 effect 因 state 變化而重複觸發。
  // handledUserIdRef 記錄已處理過的 userId，防止同一使用者重複檢查。
  const handledUserIdRef = useRef<string | null>(null);
  const checkingMigrationRef = useRef(false);

  useEffect(() => {
    void useAuthStore.getState().initialize();
  }, []);

  // 登入後自動檢查本地白板遷移狀態：
  // - 若有未完成的遷移（in_progress），自動恢復推送。
  // - 若有本地資料但尚未處理，顯示遷移對話框讓使用者選擇。
  useEffect(() => {
    if (loading) {
      return;
    }

    // 登出時重置所有遷移相關狀態
    if (!user) {
      handledUserIdRef.current = null;
      checkingMigrationRef.current = false;
      setIsMigrationDialogOpen(false);
      setMigrationError(null);
      setIsMigrationSubmitting(false);
      return;
    }

    if (handledUserIdRef.current === user.id || checkingMigrationRef.current) {
      return;
    }

    checkingMigrationRef.current = true;
    void (async () => {
      try {
        const action = await prepareMigrationOnLogin();
        if (action === "none") {
          return;
        }

        if (action === "show_dialog") {
          setMigrationError(null);
          setIsMigrationDialogOpen(true);
          return;
        }

        // auto_retry: resume a previously interrupted migration
        setIsMigrationSubmitting(true);
        setMigrationError(null);
        const boardId = await migrateLocalBoardToRemote();
        if (boardId) {
          loadBoards();
          navigate(`/canvas/${boardId}`, { replace: true });
        }
      } catch (error) {
        setMigrationError(toErrorMessage(error));
        setIsMigrationDialogOpen(true);
      } finally {
        setIsMigrationSubmitting(false);
      }
    })().finally(() => {
      handledUserIdRef.current = user.id;
      checkingMigrationRef.current = false;
    });
  }, [loadBoards, loading, navigate, user]);

  /** 共用的遷移操作執行器：管理 submitting 狀態、錯誤處理與對話框關閉。 */
  const runMigrationAction = useCallback(
    async (action: () => Promise<void>) => {
      if (isMigrationSubmitting) {
        return;
      }

      setIsMigrationSubmitting(true);
      setMigrationError(null);
      try {
        await action();
        setIsMigrationDialogOpen(false);
      } catch (error) {
        setMigrationError(toErrorMessage(error));
      } finally {
        setIsMigrationSubmitting(false);
      }
    },
    [isMigrationSubmitting],
  );

  const handleMergeLocalData = useCallback(() => {
    void runMigrationAction(async () => {
      const boardId = await migrateLocalBoardToRemote();
      if (boardId) {
        loadBoards();
        navigate(`/canvas/${boardId}`, { replace: true });
      }
    });
  }, [loadBoards, navigate, runMigrationAction]);

  const handleDiscardLocalData = useCallback(() => {
    void runMigrationAction(async () => {
      await discardLocalBoard();
      loadBoards();
    });
  }, [loadBoards, runMigrationAction]);

  const handleDeferMigration = useCallback(() => {
    if (isMigrationSubmitting) {
      return;
    }
    deferLocalBoardMigration();
    setMigrationError(null);
    setIsMigrationDialogOpen(false);
  }, [isMigrationSubmitting]);

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/canvas"
          element={<Navigate to={`/canvas/${LOCAL_BOARD_ID}`} replace />}
        />
        <Route path="/canvas/:id" element={<CanvasRouteGuard />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <LocalDataMigrationDialog
        open={isMigrationDialogOpen}
        isSubmitting={isMigrationSubmitting}
        errorMessage={migrationError}
        onMerge={handleMergeLocalData}
        onDiscard={handleDiscardLocalData}
        onDefer={handleDeferMigration}
      />
      <SyncNoticeToast />
    </>
  );
}

export default App;
