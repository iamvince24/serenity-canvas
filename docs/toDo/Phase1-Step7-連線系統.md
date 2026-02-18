# Phase 1 Step 7：連線系統 (Edges)

## 前置條件

- **Gate C 已確認**：選取契約已凍結（見 README.md 決策閘門）。
- **Step 9 第一階段已完成**：連線操作需走 Command。

## Context

規格要求卡片之間可建立連線，支援三種箭頭方向與文字標籤。連線是白板視覺化整理的核心功能之一，涉及錨點偵測、曲線繪製、互動狀態機擴充。

**注意**：此步驟**不實作** edge culling。Edge culling 統一於 Step 10 與 node culling 一起落地，避免重工。此步驟需輸出 `getEdgeBounds` helper 供 Step 10 使用。

## 目標

- 滑鼠移至卡片邊緣顯示連線錨點
- 從錨點拖曳至另一張卡片建立連線
- 連線支援三種方向：單向、雙向、無箭頭
- 連線可加文字標籤
- 點擊連線可選取並編輯屬性
- 連線選取使用統一選取模型（`selectedEdgeIds`）

---

## 實作步驟

### Step 1：擴充型別與 Store

**`src/types/canvas.ts`** — 修改：

- 新增 `Edge` 型別：`{ id, fromNode, toNode, direction, label }`
- `direction`: `'none'` | `'forward'` | `'both'`
- 更新 `CanvasState` 加入 `edges: Record<string, Edge>`
- 更新 `CanvasState` 加入 `selectedEdgeIds: string[]`（Gate C 選取契約）

**`src/stores/canvasStore.ts`** — 修改：

- 新增 `edges` 狀態 + `selectedEdgeIds` 狀態
- 新增 actions：`addEdge`, `updateEdge`, `deleteEdge`（均走 Command）
- 新增 `selectEdge(id)` / `deselectAll()` action
- 刪除 node 時自動清除關聯的 edges（DeleteNodeCommand 需包含關聯 edge 快照以支援 undo）

### Step 2：Edge Bounds Helper（供 Step 10 重用）

**`src/features/canvas/edgeUtils.ts`** — 新建：

- `getEdgeBounds(edge, elements)` — 以兩端點座標構成外接矩形（依 spec `02-tech-frontend.md`）
- 此函式在 Step 10 的 culling 流程中直接 import 使用

### Step 3：錨點系統

**`src/features/canvas/NodeAnchors.tsx`** — 新建：

- 在卡片四邊中點顯示小圓形錨點
- 只在 hover 或選取卡片時顯示
- 錨點為 Konva `Circle`，cursor 為 `crosshair`

### Step 4：連線建立互動

**`src/features/canvas/useConnectionDrag.ts`** — 新建 hook：

- mouseDown on anchor → 進入 `connecting` 狀態
- mouseMove → 繪製臨時連線（虛線，從起點到滑鼠位置）
- mouseUp on target anchor → 透過 `AddEdgeCommand` 建立 edge
- mouseUp on 空白處 → 取消

**`src/features/canvas/stateMachine.ts`** — 修改：

- `idle` + mouseDown on anchor → `connecting`
- `connecting` + mouseUp on anchor → `idle`（建立 edge）
- `connecting` + mouseUp on blank → `idle`（取消）

### Step 5：連線渲染

**`src/features/canvas/EdgeLine.tsx`** — 新建：

- 使用 Konva `Arrow` 或 `Line` + 自訂箭頭
- 計算起點與終點（從 node 邊緣中點出發）
- 根據 `direction` 決定箭頭：
  - `forward`：只有 toNode 端有箭頭
  - `both`：兩端都有箭頭
  - `none`：無箭頭，純線條
- 連線顏色：Muted (#6B6B66)
- 選取時高亮顯示（Sage 色）

### Step 6：連線標籤

**`src/features/canvas/EdgeLabel.tsx`** — 新建：

- 在連線中點顯示文字標籤
- 使用 Konva `Text` + `Rect` 背景
- 點擊標籤可編輯（DOM overlay input）

### Step 7：連線選取與設定

- 點擊連線 → `selectEdge(id)`，清除 node 選取（Gate C 互斥策略）
- 選取後顯示設定面板：方向切換、標籤編輯
- Delete 鍵刪除選取的連線（透過 `DeleteEdgeCommand`）

---

## 關鍵檔案

| 檔案                                       | 動作 |
| ------------------------------------------ | ---- |
| `src/types/canvas.ts`                      | 修改 |
| `src/stores/canvasStore.ts`                | 修改 |
| `src/features/canvas/edgeUtils.ts`         | 新建 |
| `src/features/canvas/NodeAnchors.tsx`      | 新建 |
| `src/features/canvas/useConnectionDrag.ts` | 新建 |
| `src/features/canvas/EdgeLine.tsx`         | 新建 |
| `src/features/canvas/EdgeLabel.tsx`        | 新建 |
| `src/features/canvas/stateMachine.ts`      | 修改 |

---

## 驗證方式

- [ ] hover 卡片邊緣顯示錨點
- [ ] 從錨點拖曳至另一張卡片建立連線
- [ ] 連線顯示箭頭（預設單向）
- [ ] 可切換連線方向（單向/雙向/無箭頭）
- [ ] 連線可加文字標籤
- [ ] 點擊連線可選取（使用 `selectedEdgeIds`），Delete 可刪除
- [ ] 選取連線時自動清除 node 選取（反之亦然）
- [ ] 刪除卡片時關聯連線自動移除，Undo 可恢復卡片 + 連線
- [ ] `pnpm build` 無錯誤
