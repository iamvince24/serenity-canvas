# Phase 1 第一步：空白畫布 + 平移縮放 + 新增卡片拖動

## Context

Serenity Canvas 專案基礎設施已完成（GitHub、Husky、Vercel），`src/` 目前仍是 Vite 預設模板。需要開始實作 Phase 1 的第一個可互動功能：一個可平移縮放的無限畫布，上面能新增文字卡片並拖動。

## 目標

打開瀏覽器看到一個可以平移、縮放的空白畫布，能新增一張卡片並拖動它。

---

## 實作步驟

### Step 1：建立資料夾結構與型別定義

建立 `src/types/`、`src/stores/`、`src/features/canvas/`

**`src/types/canvas.ts`** — 核心型別：

- `ViewportState`：`{ x, y, zoom }`
- `TextNode`：`{ id, type, x, y, width, height, content, color }`
- `CanvasState`：`{ viewport, nodes, selectedNodeIds }`

### Step 2：建立 Zustand Store

**`src/stores/canvasStore.ts`**：

- `viewport` 狀態（x, y, zoom）
- `nodes` 狀態（`Record<string, TextNode>`）
- Actions：`setViewport`、`addNode`、`updateNodePosition`、`selectNode`

### Step 3：建立畫布元件

**`src/features/canvas/Canvas.tsx`** — 主畫布：

- 使用 `react-konva` 的 `<Stage>` + `<Layer>`
- Stage 的 `x`, `y`, `scaleX`, `scaleY` 綁定 viewport 狀態
- 監聽 `onWheel` 處理縮放（pinch zoom + scroll wheel）
- 監聯 `onDragEnd` on Stage 處理平移（需設 `draggable` on Stage）

**`src/features/canvas/CanvasNode.tsx`** — 卡片元件：

- 使用 Konva 的 `<Group>` + `<Rect>` + `<Text>`
- `draggable`，拖動結束更新 store 中的位置

### Step 4：建立工具列

**`src/features/canvas/Toolbar.tsx`**：

- 一個「新增卡片」按鈕（用 shadcn/ui `<Button>`）
- 點擊後在畫布中央新增一張預設文字卡片

### Step 5：替換 App.tsx

清掉 Vite 模板內容，改為：

- 全螢幕 Canvas 元件
- 浮動 Toolbar

### Step 6：清理

- 刪除 `src/App.css`（不再需要）
- 刪除 `src/assets/react.svg`、`public/vite.svg`

---

## 關鍵檔案

| 檔案                                 | 動作 |
| ------------------------------------ | ---- |
| `src/types/canvas.ts`                | 新建 |
| `src/stores/canvasStore.ts`          | 新建 |
| `src/features/canvas/Canvas.tsx`     | 新建 |
| `src/features/canvas/CanvasNode.tsx` | 新建 |
| `src/features/canvas/Toolbar.tsx`    | 新建 |
| `src/App.tsx`                        | 改寫 |
| `src/App.css`                        | 刪除 |
| `src/assets/react.svg`               | 刪除 |
| `public/vite.svg`                    | 刪除 |

---

## 技術細節

### 縮放邏輯

參考 spec [[02-tech-frontend|前端技術規格]]：

```
螢幕座標 → 畫布座標：
  x_canvas = (x_screen - viewport.x) / viewport.zoom
  y_canvas = (y_screen - viewport.y) / viewport.zoom
```

Zoom 以滑鼠位置為中心，zoom 範圍限制 0.1 ~ 3。

### Viewport Culling

此階段卡片數量極少，暫不實作 culling。但 store 結構預留 `getVisibleElementIds` 的空間。

---

## 驗證方式

- [ ] `pnpm dev` 啟動開發伺服器
- [ ] 畫面顯示空白畫布（無 Vite 預設模板內容）
- [ ] 滑鼠滾輪可縮放畫布
- [ ] 按住拖拉可平移畫布
- [ ] 點擊「新增卡片」按鈕，畫布上出現一張卡片
- [ ] 卡片可拖動，放開後位置保持
- [ ] `pnpm build` 無錯誤

---

## 相關文件

- [[01-features|功能需求]]
- [[02-tech-frontend|前端技術規格]]
- [[02a-tech-frontend-decisions|前端技術決策]]
