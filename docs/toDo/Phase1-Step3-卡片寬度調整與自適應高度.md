# Phase 1 Step 3：卡片寬度調整與自適應高度

## Context

目前卡片大小是固定的。需求規格要求使用者可手動拖拉調整寬度，高度隨內容自動延展。這是卡片系統的基礎能力，需要在 Markdown 編輯之前完成。

## 目標

- 選取卡片後，右側邊緣出現 resize handle
- 拖拉 handle 可調整卡片寬度
- 高度根據內容（Konva Text 行數）自動計算
- 狀態機新增 `resizing` 狀態

---

## 實作步驟

### Step 1：Resize Handle 元件

**`src/features/canvas/ResizeHandle.tsx`** — 新建：

- 在選取卡片的右側邊緣繪製一個可拖曳的 handle（小矩形或線條）
- 只在卡片被選取時顯示
- Cursor 改為 `ew-resize`

### Step 2：Resize 互動邏輯

**`src/features/canvas/CanvasNode.tsx`** — 修改：

- 整合 ResizeHandle
- 拖曳 handle 時更新卡片 `width`
- 設定最小寬度（如 120px）
- resize 結束後更新 store

### Step 3：自適應高度

**`src/stores/canvasStore.ts`** — 修改：

- 新增 `updateNodeSize(id, width, height)` action
- Width 由使用者手動設定，height 由內容計算

**`src/features/canvas/CanvasNode.tsx`** — 修改：

- 使用 Konva Text 的 `width` 屬性限定文字寬度
- 利用 Konva Text node ref 取得實際渲染高度
- 計算卡片總高度 = padding + text height + padding
- 更新 store 中的 height

### Step 4：狀態機更新

**`src/features/canvas/stateMachine.ts`** — 修改：

- `idle` + mouseDown on resize handle → `resizing`
- `resizing` + mouseMove → 持續更新寬度
- `resizing` + mouseUp → `idle`

---

## 關鍵檔案

| 檔案                                   | 動作 |
| -------------------------------------- | ---- |
| `src/features/canvas/ResizeHandle.tsx` | 新建 |
| `src/features/canvas/CanvasNode.tsx`   | 修改 |
| `src/stores/canvasStore.ts`            | 修改 |
| `src/features/canvas/stateMachine.ts`  | 修改 |

---

## 驗證方式

- [ ] 選取卡片後右側出現 resize handle
- [ ] 拖拉 handle 可改變卡片寬度
- [ ] 寬度有最小值限制
- [ ] 卡片高度隨內容自動延展（測試：新增多行文字的卡片）
- [ ] 未選取的卡片不顯示 resize handle
- [ ] `pnpm build` 無錯誤
