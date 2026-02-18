# Phase 1 Step 9：Undo / Redo — Command Pattern（兩階段）

## Context

規格要求使用 Command Pattern 實作 Undo/Redo，而非 Immutable 快照。每個操作（建立、刪除、移動、變更等）都是一個可序列化的 Command，支援反向執行。批次操作（如群組拖曳）用 CompositeCommand 包裝。

**本步驟拆為兩階段，穿插在不同的時間點執行：**

## 目標

- `Cmd/Ctrl + Z` 復原、`Cmd/Ctrl + Shift + Z` 重做
- Command 可序列化為 JSON（至少 `type + payload + inverse`，為未來離線同步預留）
- 支援 CompositeCommand（批次操作一次 undo）

---

## 不記錄 History 的操作（白名單）

以下操作**不進入** undo/redo 堆疊：

- Viewport pan / zoom
- Hover 狀態
- 選取狀態（selectedNodeIds, selectedEdgeIds, selectedGroupIds）
- 暫態 UI state（editingNodeId, 彈窗開關等）

---

## Phase A：基礎 Command（在 Step 5 之後執行）

### 時機

Step 2-5 完成後、Step 6 開始前。確保 Step 6-8 的所有新操作直接走 Command。

### 實作步驟

#### A-1：Command 介面與基礎類別

**`src/commands/types.ts`** — 新建：

- `Command` 介面：`{ type: string, execute(), undo(), toJSON() }`
- `CompositeCommand`：包裝多個 Command，undo 時反向順序還原
- `fromJSON(json)` 反序列化（Phase 1 預留介面，可延後實作）

#### A-2：Node Command 實作

**`src/commands/nodeCommands.ts`** — 新建：

- `AddNodeCommand`：execute = addNode, undo = deleteNode
- `DeleteNodeCommand`：execute = deleteNode（保存完整 node 快照）, undo = addNode
- `MoveNodeCommand`：execute = updatePosition(new), undo = updatePosition(old)
- `ResizeNodeCommand`：execute = updateSize(new), undo = updateSize(old)
- `UpdateContentCommand`：execute = setContent(new), undo = setContent(old)
- `UpdateColorCommand`：execute = setColor(new), undo = setColor(old)

#### A-3：History Manager

**`src/commands/historyManager.ts`** — 新建：

- `undoStack: Command[]` 與 `redoStack: Command[]`
- `execute(command)` — 執行 command 並推入 undoStack，清空 redoStack
- `undo()` — pop undoStack，執行 command.undo()，推入 redoStack
- `redo()` — pop redoStack，執行 command.execute()，推入 undoStack
- 堆疊上限：50 步

#### A-4：整合至 Store

**`src/stores/canvasStore.ts`** — 修改：

- 所有 node 修改操作改為透過 History Manager 執行 Command
- 新增 `undo()` / `redo()` actions
- 提供 `canUndo` / `canRedo` 衍生狀態

#### A-5：快捷鍵綁定

**`src/features/canvas/Canvas.tsx`** — 修改：

- 全域 keydown 監聯：
  - `Cmd/Ctrl + Z` → `undo()`
  - `Cmd/Ctrl + Shift + Z` → `redo()`
- 確保在 `editing` 狀態時不攔截（讓 Tiptap 自己處理 undo）

#### A-6：Toolbar 按鈕

**`src/features/canvas/Toolbar.tsx`** — 修改：

- 新增 Undo / Redo 按鈕（icon button）
- 根據 `canUndo` / `canRedo` 設定 disabled 狀態

### Phase A 驗證

- [ ] 新增卡片 → Cmd+Z → 卡片消失 → Cmd+Shift+Z → 卡片回來
- [ ] 移動卡片 → Cmd+Z → 卡片回到原位
- [ ] 刪除卡片 → Cmd+Z → 卡片恢復（含內容、顏色、位置）
- [ ] 調整大小 → Cmd+Z → 回到原始大小
- [ ] 編輯內容 → Cmd+Z → 內容回復
- [ ] 修改顏色 → Cmd+Z → 顏色回復
- [ ] Toolbar 的 Undo/Redo 按鈕狀態正確
- [ ] 編輯模式下 Cmd+Z 由 Tiptap 處理（不影響畫布歷史）
- [ ] Viewport pan/zoom 不進入 undo 堆疊

---

## Phase B：Edge / Group Command（在 Step 8 之後執行）

### 時機

Step 6-8 完成後、Step 10 開始前。

### 實作步驟

#### B-1：Edge Command

**`src/commands/edgeCommands.ts`** — 新建：

- `AddEdgeCommand`：execute = addEdge, undo = deleteEdge
- `DeleteEdgeCommand`：execute = deleteEdge（保存完整 edge 快照）, undo = addEdge
- `UpdateEdgeCommand`：execute = updateEdge(new), undo = updateEdge(old)

#### B-2：Group Command

**`src/commands/groupCommands.ts`** — 新建：

- `CreateGroupCommand`：execute = createGroup, undo = deleteGroup
- `DeleteGroupCommand`：execute = deleteGroup（保存完整 group 快照 + nodeIds）, undo = createGroup

#### B-3：複合操作升級

- `DeleteNodeCommand` 升級：刪除 node 時同時保存關聯 edge 快照，undo 時一起恢復
- 批次移動：`CompositeCommand` 包裝多個 `MoveNodeCommand`
- 批次刪除：`CompositeCommand` 包裝多個 Delete Command

### Phase B 驗證

- [ ] 建立連線 → Cmd+Z → 連線消失
- [ ] 刪除連線 → Cmd+Z → 連線恢復
- [ ] 修改連線方向/標籤 → Cmd+Z → 回復
- [ ] 建立群組 → Cmd+Z → 群組消失
- [ ] 解散群組 → Cmd+Z → 群組恢復
- [ ] 刪除卡片 → 關聯連線也消失 → Cmd+Z → 卡片 + 連線都恢復
- [ ] 批次移動（多選拖曳）→ Cmd+Z → 所有卡片回到原位
- [ ] `pnpm build` 無錯誤

---

## 關鍵檔案

| 檔案                              | 動作 | 階段        |
| --------------------------------- | ---- | ----------- |
| `src/commands/types.ts`           | 新建 | Phase A     |
| `src/commands/nodeCommands.ts`    | 新建 | Phase A     |
| `src/commands/historyManager.ts`  | 新建 | Phase A     |
| `src/commands/edgeCommands.ts`    | 新建 | Phase B     |
| `src/commands/groupCommands.ts`   | 新建 | Phase B     |
| `src/stores/canvasStore.ts`       | 修改 | Phase A + B |
| `src/features/canvas/Canvas.tsx`  | 修改 | Phase A     |
| `src/features/canvas/Toolbar.tsx` | 修改 | Phase A     |
