# Phase 1 Step 10：Viewport Culling 視口剔除

## Context

隨著卡片數量增加，需要實作 Viewport Culling：只渲染可視區域內的元素。技術規格中已有完整的實作策略（`02-tech-frontend.md`），此步驟將其落實。

**此步驟統一處理 node + edge 的 culling**。Edge culling 使用 Step 7 產出的 `getEdgeBounds` helper，避免重複實作。

此步驟也是**拖曳與縮放整合測試**的落地時機——此時渲染層與互動層均已穩定。

## 目標

- 視口外的卡片與連線不進入 React tree
- 平移時使用 `useShallow` 避免不必要的重渲染
- Padding 緩衝區 + hysteresis 防止邊緣閃爍
- 效能基準驗證

---

## 實作步驟

### Step 1：Culling 工具函式

**`src/features/canvas/culling.ts`** — 新建：

- `getViewportBounds(viewport, padding)` — 計算視口邊界（畫布座標）
- `intersects(element, bounds)` — 判斷元素是否與視口重疊
- `getVisibleElementIds(elements, viewport)` — 過濾可見 node
- `getVisibleEdgeIds(edges, elements, viewport)` — 過濾可見連線，**import `getEdgeBounds` from `edgeUtils.ts`**
- `VIEWPORT_PADDING = 100`（畫布座標）

### Step 2：Hysteresis 防抖規則

元素「進入」視口的 padding = 100px，「離開」視口的 padding = 150px。避免元素在邊界反覆切換渲染狀態造成閃爍。

```typescript
const ENTER_PADDING = 100; // 進入時提前渲染
const LEAVE_PADDING = 150; // 離開時延遲移除
```

### Step 3：Custom Hook

**`src/features/canvas/useVisibleElements.ts`** — 新建：

- `useVisibleNodeIds()` — 使用 `useShallow` 訂閱可見 node ids
- `useVisibleEdgeIds()` — 使用 `useShallow` 訂閱可見 edge ids

### Step 4：Canvas 整合

**`src/features/canvas/Canvas.tsx`** — 修改：

- 改用 `useVisibleNodeIds()` 和 `useVisibleEdgeIds()` 取代直接讀取所有 nodes/edges
- 只渲染可見的元素

### Step 5：效能驗證場景

建立固定測試場景（可作為 dev-only 工具或測試 fixture）：

- 生成 100 個隨機位置的 node + 150 條 edge
- 測量平移/縮放時的 FPS
- 基準：平移時 React 重渲染 < 2ms，FPS > 55

### Step 6：拖曳/縮放整合測試

此時互動層與渲染層均穩定，補上 Step 2-5 延遲的整合測試：

- 卡片拖曳後位置正確更新
- 畫布平移後 viewport 狀態正確
- 畫布縮放以滑鼠位置為中心
- Culling 後拖曳/縮放行為不受影響

---

## 關鍵檔案

| 檔案                                        | 動作                |
| ------------------------------------------- | ------------------- |
| `src/features/canvas/culling.ts`            | 新建                |
| `src/features/canvas/useVisibleElements.ts` | 新建                |
| `src/features/canvas/Canvas.tsx`            | 修改                |
| `src/features/canvas/edgeUtils.ts`          | 引用（Step 7 產出） |

---

## 驗證方式

- [ ] 畫布上放 100+ 卡片 + 150+ 連線，平移時 FPS > 55
- [ ] 視口外的元素不出現在 React DevTools 的 component tree 中
- [ ] 平移時邊緣卡片無閃爍（hysteresis 機制有效）
- [ ] 連線穿越視口時仍正常渲染（edge culling 以外接矩形判定）
- [ ] **整合測試通過**：卡片拖曳、畫布平移、畫布縮放在 culling 啟用後行為正確
- [ ] `pnpm build` 無錯誤
