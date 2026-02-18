# Phase 1 Step 8：框選與群組 (Box Select & Groups)

## 前置條件

- **Gate C 已確認**：選取契約已凍結。
- **Step 9 第一階段已完成**：群組操作需走 Command。

## Context

規格要求支援框選多張卡片並建立群組。框選是多選的基礎操作，群組則是視覺化整理的進階功能。

## 目標

- `Shift + 空白處拖曳` 框選多張卡片（空白拖曳預設 panning）
- 框選後可批次移動、刪除
- 可將選取的卡片建立為群組
- 群組顯示外框，可設定名稱與顏色

---

## 互動規則（已鎖定）

- **空白處拖曳 = panning**（預設行為，與 Step 1 一致）
- **Shift + 空白處拖曳 = box-selecting**
- **Shift + Click 卡片 = 追加/移除選取**
- **Delete 優先順序**（Gate C）：先刪 selected nodes，再刪 selected edges，再刪 selected groups
- **跨類型選取**：允許同時選取 node + group；選取 edge 時清除 node/group 選取（edge 是獨立互動）

---

## 實作步驟

### Step 1：框選互動

**`src/features/canvas/BoxSelect.tsx`** — 新建：

- Shift + 空白處 mouseDown → 進入 `box-selecting` 狀態
- mouseMove → 繪製半透明 Sage 色矩形框
- mouseUp → 計算框內的卡片 → 加入 `selectedNodeIds`

**`src/features/canvas/stateMachine.ts`** — 修改：

- `idle` + Shift + mouseDown on blank → `box-selecting`
- `box-selecting` + mouseUp → `idle`
- 無 Shift 的空白 mouseDown 仍為 panning

### Step 2：多選操作

**`src/stores/canvasStore.ts`** — 修改：

- `selectNode` 支援 additive 模式（Shift+Click 追加選取）
- 新增 `selectNodes(ids: string[])` action
- `deleteSelected()` 依優先順序批次刪除（走 CompositeCommand）
- 批次拖曳：一張卡片移動時，同步移動所有選取的卡片（走 CompositeCommand）

**`src/features/canvas/CanvasNode.tsx`** — 修改：

- 拖曳選取的卡片群時，同步移動其他選取卡片
- 多選卡片均顯示選取外框

### Step 3：群組型別與 Store

**`src/types/canvas.ts`** — 修改：

- 新增 `Group` 型別：`{ id, label, color, nodeIds: string[] }`
- 更新 `CanvasState` 加入 `groups: Record<string, Group>`
- 更新 `CanvasState` 加入 `selectedGroupIds: string[]`（Gate C 選取契約）

**`src/stores/canvasStore.ts`** — 修改：

- 新增 `createGroup(nodeIds)`, `deleteGroup(id)`, `updateGroup(id, updates)` actions（走 Command）

### Step 4：群組渲染

**`src/features/canvas/GroupRect.tsx`** — 新建：

- 計算群組內所有卡片的外接矩形（含 padding）
- 繪製帶顏色的半透明背景 + 虛線邊框
- 左上角顯示群組名稱

### Step 5：右鍵選單

**`src/features/canvas/ContextMenu.tsx`** — 新建：

- 右鍵點擊 → 顯示上下文選單（DOM overlay）
- 選取多張卡片時：「建立群組」、「刪除」
- 選取群組時：「解散群組」、「重新命名」

---

## 關鍵檔案

| 檔案                                  | 動作 |
| ------------------------------------- | ---- |
| `src/features/canvas/BoxSelect.tsx`   | 新建 |
| `src/features/canvas/GroupRect.tsx`   | 新建 |
| `src/features/canvas/ContextMenu.tsx` | 新建 |
| `src/types/canvas.ts`                 | 修改 |
| `src/stores/canvasStore.ts`           | 修改 |
| `src/features/canvas/stateMachine.ts` | 修改 |
| `src/features/canvas/CanvasNode.tsx`  | 修改 |

---

## 驗證方式

- [ ] **Shift + 空白拖曳**顯示框選範圍；無 Shift 拖曳仍為 panning
- [ ] 框選後卡片被多選（顯示選取外框）
- [ ] Shift+Click 可追加/移除選取
- [ ] 多選卡片可批次拖曳（走 CompositeCommand，可一次 Undo）
- [ ] 多選後按 Delete 批次刪除
- [ ] 右鍵 →「建立群組」可建立群組
- [ ] 群組顯示外框與名稱
- [ ] 選取 edge 時 node/group 選取被清除
- [ ] `pnpm build` 無錯誤
