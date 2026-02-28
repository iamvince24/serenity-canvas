import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Settings,
} from "lucide-react";
import type { Board } from "../../types/board";
import { cn } from "../../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

export interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  boards: Board[];
  activeBoardId: string | undefined;
  onSelectBoard: (id: string) => void;
  onCreateBoard: (title: string) => void;
  onRenameBoard: (id: string, title: string) => void;
  onDeleteBoard: (id: string) => void;
}

type BoardRowProps = {
  board: Board;
  activeBoardId: string | undefined;
  canDelete: boolean;
  onSelectBoard: (id: string) => void;
  onRenameBoard: (id: string, title: string) => void;
  onDeleteBoard: (id: string) => void;
};

function BoardRow({
  board,
  activeBoardId,
  canDelete,
  onSelectBoard,
  onRenameBoard,
  onDeleteBoard,
}: BoardRowProps) {
  const isActive = board.id === activeBoardId;
  const rowRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(board.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isEditing]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const isInsideRow = rowRef.current?.contains(target) ?? false;
      const isInsideMenu = target.closest(
        `[data-board-menu-content="${board.id}"]`,
      );
      if (!isInsideRow && !isInsideMenu) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [board.id, isMenuOpen]);

  const handleSelect = () => {
    onSelectBoard(board.id);
  };

  const confirmRename = () => {
    const nextTitle = draftTitle.trim();
    setIsEditing(false);
    setDraftTitle(board.title);

    if (nextTitle.length === 0 || nextTitle === board.title) {
      return;
    }

    onRenameBoard(board.id, nextTitle);
  };

  const cancelRename = () => {
    setIsEditing(false);
    setDraftTitle(board.title);
  };

  return (
    <>
      <div
        ref={rowRef}
        role="button"
        tabIndex={0}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={(event) => {
          event.preventDefault();
          setIsMenuOpen(true);
        }}
        onClick={handleSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleSelect();
          }
        }}
        className={cn(
          "group flex items-center gap-2 rounded-[6px] border px-3 py-2 text-[14px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isActive
            ? "border-[#E5E3DF] bg-[#FFFFFF] text-[#1C1C1A] shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
            : "border-transparent bg-transparent text-[#6B6B66] hover:bg-[#EBF0E9] hover:text-[#5E6E58]",
        )}
      >
        <LayoutDashboard
          className={cn("h-4 w-4 shrink-0", isActive ? "text-[#8B9D83]" : "")}
        />

        {isEditing ? (
          <input
            ref={inputRef}
            value={draftTitle}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={confirmRename}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                event.preventDefault();
                confirmRename();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelRename();
              }
            }}
            className="h-6 min-w-0 flex-1 rounded border border-[#E5E3DF] bg-[#FFFFFF] px-2 text-[14px] text-[#1C1C1A] outline-none"
            aria-label={`Rename ${board.title}`}
          />
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate">{board.title}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-[#A3A29D]">
              {board.nodeCount}
            </span>
          </>
        )}

        <DropdownMenu
          open={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          modal={false}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Board actions for ${board.title}`}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-[6px] text-[#6B6B66] transition-opacity duration-200 hover:bg-[#EBF0E9] hover:text-[#5E6E58]",
                isHovered || isMenuOpen ? "opacity-100" : "opacity-0",
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-36 border-[#E5E3DF] bg-[#FFFFFF]"
            onClick={(event) => event.stopPropagation()}
            onInteractOutside={() => setIsMenuOpen(false)}
            onEscapeKeyDown={() => setIsMenuOpen(false)}
            data-board-menu-content={board.id}
          >
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setIsMenuOpen(false);
                setDraftTitle(board.title);
                setIsEditing(true);
              }}
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!canDelete}
              className="text-[#B8635A] focus:text-[#B8635A]"
              onSelect={(event) => {
                event.preventDefault();
                if (!canDelete) {
                  return;
                }

                setIsDeleteDialogOpen(true);
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => setIsDeleteDialogOpen(open)}
      >
        <AlertDialogContent className="border-[#E5E3DF] bg-[#FFFFFF]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete board?</AlertDialogTitle>
            <AlertDialogDescription>
              This action permanently removes "{board.title}".
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#B8635A] hover:bg-[#A65850]"
              onClick={() => onDeleteBoard(board.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function Sidebar({
  isOpen,
  setIsOpen,
  boards,
  activeBoardId,
  onSelectBoard,
  onCreateBoard,
  onRenameBoard,
  onDeleteBoard,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "shrink-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden",
        isOpen
          ? "w-64 border-r border-[#E5E3DF] opacity-100"
          : "w-0 border-r-0 opacity-0",
      )}
      aria-hidden={!isOpen}
    >
      <div className="relative flex h-full w-64 flex-col bg-[#FAFAF8]">
        <div className="pointer-events-none absolute inset-0 bg-[#F3F2EF] opacity-40" />

        <div className="relative z-10 flex h-full flex-col">
          <header className="flex h-14 items-center justify-between border-b border-[#F0EEEA] px-4">
            <div className="flex items-center gap-2">
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full bg-[#8B9D83] text-[12px] font-bold text-white"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                E
              </div>
              <span className="text-[14px] font-medium text-[#1C1C1A]">
                Workspace
              </span>
            </div>

            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#6B6B66] transition-colors duration-300 hover:bg-[#EBF0E9] hover:text-[#5E6E58]"
              onClick={() => setIsOpen(false)}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-2 py-3">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-[12px] tracking-wider text-[#A3A29D] uppercase">
                BOARDS
              </p>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[#6B6B66] transition-colors duration-300 hover:bg-[#EBF0E9] hover:text-[#5E6E58]"
                aria-label="Create board"
                onClick={() => onCreateBoard("Untitled Board")}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <ul className="space-y-1">
              {boards.map((board) => (
                <li key={board.id}>
                  <BoardRow
                    board={board}
                    activeBoardId={activeBoardId}
                    canDelete={boards.length > 1}
                    onSelectBoard={onSelectBoard}
                    onRenameBoard={onRenameBoard}
                    onDeleteBoard={onDeleteBoard}
                  />
                </li>
              ))}
            </ul>
          </div>

          <footer className="border-t border-[#F0EEEA] p-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-[6px] border border-transparent px-3 py-2 text-[14px] text-[#6B6B66] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[#EBF0E9] hover:text-[#5E6E58]"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
          </footer>
        </div>
      </div>
    </aside>
  );
}
