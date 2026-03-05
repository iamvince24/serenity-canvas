import { useCallback, useEffect, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { Sidebar } from "../components/layout/Sidebar";
import { useDashboardKeyboard } from "../hooks/useDashboardKeyboard";
import { removeBoardSnapshot } from "../stores/boardSnapshotStorage";
import { useDashboardStore } from "../stores/dashboardStore";
import { CanvasPage } from "./CanvasPage";

const SIDEBAR_OPEN_STORAGE_KEY = "serenity-canvas:sidebar-open";

export function DashboardPage() {
  const {
    boards,
    activeBoardId,
    loadBoards,
    setActiveBoardId,
    createBoard,
    renameBoard,
    deleteBoard,
  } = useDashboardStore();
  const [isOpen, setIsOpen] = useState(
    () => localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY) !== "false",
  );

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  const handleSetIsOpen = (nextIsOpen: boolean) => {
    setIsOpen(nextIsOpen);
    localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, String(nextIsOpen));
  };

  const handleToggleSidebar = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  useDashboardKeyboard({ onToggleSidebar: handleToggleSidebar });

  const handleDeleteBoard = (id: string) => {
    deleteBoard(id);
    removeBoardSnapshot(id);
  };

  return (
    <div className="flex min-h-screen w-full bg-[#FAFAF8]">
      <Sidebar
        isOpen={isOpen}
        setIsOpen={handleSetIsOpen}
        boards={boards}
        activeBoardId={activeBoardId ?? undefined}
        onSelectBoard={setActiveBoardId}
        onCreateBoard={createBoard}
        onRenameBoard={renameBoard}
        onDeleteBoard={handleDeleteBoard}
      />

      <div className="relative min-h-screen flex-1">
        {!isOpen ? (
          <button
            type="button"
            className="absolute top-4 left-4 z-40 flex h-9 w-9 items-center justify-center rounded-[6px] border border-[#E5E3DF] bg-[#FFFFFF] text-[#6B6B66] transition-colors duration-300 hover:bg-[#EBF0E9] hover:text-[#5E6E58]"
            onClick={() => handleSetIsOpen(true)}
            aria-label="展開側欄"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        ) : null}

        {activeBoardId ? <CanvasPage boardId={activeBoardId} /> : null}
      </div>
    </div>
  );
}
