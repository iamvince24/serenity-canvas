import { useCallback, useEffect } from "react";
import { Check, X, Bot } from "lucide-react";
import {
  useChangesetStore,
  type PendingChangeset,
} from "@/stores/changesetStore";

type ChangesetReviewPanelProps = {
  boardId: string;
};

function ChangesetItem({
  changeset,
  boardId,
}: {
  changeset: PendingChangeset;
  boardId: string;
}) {
  const acceptChangeset = useChangesetStore((s) => s.acceptChangeset);
  const rejectChangeset = useChangesetStore((s) => s.rejectChangeset);

  const handleAccept = useCallback(() => {
    void acceptChangeset(boardId, changeset.changesetId);
  }, [acceptChangeset, boardId, changeset.changesetId]);

  const handleReject = useCallback(() => {
    void rejectChangeset(boardId, changeset.changesetId);
  }, [rejectChangeset, boardId, changeset.changesetId]);

  const nodeCount = changeset.nodes.length;
  const edgeCount = changeset.edges.length;

  return (
    <div className="rounded-lg border border-sage-light bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-sage-dark">
        <Bot className="h-4 w-4 text-sage" />
        <span>AI Changeset</span>
      </div>
      <p className="mb-3 text-xs text-sage">
        {nodeCount > 0 && `${nodeCount} card${nodeCount > 1 ? "s" : ""}`}
        {nodeCount > 0 && edgeCount > 0 && ", "}
        {edgeCount > 0 && `${edgeCount} connection${edgeCount > 1 ? "s" : ""}`}
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-sage px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sage-dark"
        >
          <Check className="h-3.5 w-3.5" />
          Accept
        </button>
        <button
          onClick={handleReject}
          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-sage-light px-3 py-1.5 text-xs font-medium text-sage transition-colors hover:bg-sage-wash"
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </button>
      </div>
    </div>
  );
}

export function ChangesetReviewPanel({ boardId }: ChangesetReviewPanelProps) {
  const pendingChangesets = useChangesetStore((s) => s.pendingChangesets);
  const fetchPendingChangesets = useChangesetStore(
    (s) => s.fetchPendingChangesets,
  );

  useEffect(() => {
    void fetchPendingChangesets(boardId);
    // Poll every 10 seconds for new changesets
    const interval = setInterval(() => {
      void fetchPendingChangesets(boardId);
    }, 10_000);
    return () => clearInterval(interval);
  }, [boardId, fetchPendingChangesets]);

  const changesets = Object.values(pendingChangesets);
  if (changesets.length === 0) return null;

  return (
    <div className="pointer-events-auto fixed right-4 top-4 z-50 flex w-64 flex-col gap-2">
      {changesets.map((cs) => (
        <ChangesetItem key={cs.changesetId} changeset={cs} boardId={boardId} />
      ))}
    </div>
  );
}
