import { useCallback, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/stores/canvasStore";
import type { StressFixtureConfig } from "./core/stressFixture";

const DEFAULT_NODE_COUNT = 100;
const DEFAULT_EDGE_COUNT = 150;
const DEFAULT_GROUP_COUNT = 12;
const DEFAULT_SPACING = 20;
const MIN_NODE_COUNT = 1;
const MAX_NODE_COUNT = 500;
const MIN_EDGE_COUNT = 0;
const MAX_EDGE_COUNT = 1000;
const MIN_GROUP_COUNT = 0;
const MAX_GROUP_COUNT = 50;
const MIN_SPACING = 0;
const MAX_SPACING = 200;

type StressFixtureDialogProps = {
  trigger: React.ReactNode;
};

export function StressFixtureDialog({ trigger }: StressFixtureDialogProps) {
  const [open, setOpen] = useState(false);
  const [nodeCount, setNodeCount] = useState(DEFAULT_NODE_COUNT);
  const [edgeCount, setEdgeCount] = useState(DEFAULT_EDGE_COUNT);
  const [groupCount, setGroupCount] = useState(DEFAULT_GROUP_COUNT);
  const [noOverlap, setNoOverlap] = useState(false);
  const [spacing, setSpacing] = useState(DEFAULT_SPACING);

  const insertStressFixture = useCanvasStore(
    (state) => state.insertStressFixture,
  );

  const maxValidEdgeCount = nodeCount < 2 ? 0 : nodeCount * (nodeCount - 1);
  const maxValidGroupCount = Math.floor(nodeCount / 4);
  const clampedEdgeCount = Math.min(edgeCount, maxValidEdgeCount);
  const clampedGroupCount = Math.min(groupCount, maxValidGroupCount);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();

      const config: StressFixtureConfig = {
        nodeCount,
        edgeCount: clampedEdgeCount,
        groupCount: clampedGroupCount,
        noOverlap,
        spacing: noOverlap ? spacing : undefined,
      };

      insertStressFixture(config);
      setOpen(false);
    },
    [
      nodeCount,
      clampedEdgeCount,
      clampedGroupCount,
      noOverlap,
      spacing,
      insertStressFixture,
    ],
  );

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>插入壓力測試資料</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label
                htmlFor="stress-node-count"
                className="text-sm font-medium leading-none"
              >
                卡片數量
              </label>
              <input
                id="stress-node-count"
                type="number"
                min={MIN_NODE_COUNT}
                max={MAX_NODE_COUNT}
                value={nodeCount}
                onChange={(e) =>
                  setNodeCount(
                    Math.min(
                      MAX_NODE_COUNT,
                      Math.max(MIN_NODE_COUNT, Number(e.target.value) || 0),
                    ),
                  )
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-describedby="stress-node-count-desc"
              />
              <span
                id="stress-node-count-desc"
                className="text-xs text-muted-foreground"
              >
                {MIN_NODE_COUNT}–{MAX_NODE_COUNT}
              </span>
            </div>
            <div className="grid gap-2">
              <label
                htmlFor="stress-edge-count"
                className="text-sm font-medium leading-none"
              >
                連線數量
              </label>
              <input
                id="stress-edge-count"
                type="number"
                min={MIN_EDGE_COUNT}
                max={MAX_EDGE_COUNT}
                value={edgeCount}
                onChange={(e) =>
                  setEdgeCount(
                    Math.min(
                      MAX_EDGE_COUNT,
                      Math.max(MIN_EDGE_COUNT, Number(e.target.value) || 0),
                    ),
                  )
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-describedby="stress-edge-count-desc"
              />
              <span
                id="stress-edge-count-desc"
                className="text-xs text-muted-foreground"
              >
                上限 {maxValidEdgeCount}（依卡片數）
              </span>
            </div>
            <div className="grid gap-2">
              <label
                htmlFor="stress-group-count"
                className="text-sm font-medium leading-none"
              >
                群組數量
              </label>
              <input
                id="stress-group-count"
                type="number"
                min={MIN_GROUP_COUNT}
                max={MAX_GROUP_COUNT}
                value={groupCount}
                onChange={(e) =>
                  setGroupCount(
                    Math.min(
                      MAX_GROUP_COUNT,
                      Math.max(MIN_GROUP_COUNT, Number(e.target.value) || 0),
                    ),
                  )
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-describedby="stress-group-count-desc"
              />
              <span
                id="stress-group-count-desc"
                className="text-xs text-muted-foreground"
              >
                每組 4 張卡片，上限 {maxValidGroupCount}
              </span>
            </div>
            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-sm font-medium leading-none">
                <input
                  type="checkbox"
                  checked={noOverlap}
                  onChange={(e) => setNoOverlap(e.target.checked)}
                  className="h-4 w-4 rounded border border-input accent-sage"
                />
                卡片不重疊
              </label>
            </div>
            {noOverlap && (
              <div className="grid gap-2">
                <label
                  htmlFor="stress-spacing"
                  className="text-sm font-medium leading-none"
                >
                  最小間距（px）
                </label>
                <input
                  id="stress-spacing"
                  type="number"
                  min={MIN_SPACING}
                  max={MAX_SPACING}
                  value={spacing}
                  onChange={(e) =>
                    setSpacing(
                      Math.min(
                        MAX_SPACING,
                        Math.max(MIN_SPACING, Number(e.target.value) || 0),
                      ),
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-describedby="stress-spacing-desc"
                />
                <span
                  id="stress-spacing-desc"
                  className="text-xs text-muted-foreground"
                >
                  {MIN_SPACING}–{MAX_SPACING} px
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                取消
              </Button>
            </DialogClose>
            <Button type="submit">插入</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
