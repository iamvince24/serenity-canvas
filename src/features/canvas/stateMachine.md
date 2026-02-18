# Canvas Interaction State Machine

這份文件說明 `src/features/canvas/stateMachine.ts` 目前的設定與行為。

## 設計目的

- 用單一狀態機集中管理畫布互動狀態，避免互動事件散落在元件中。
- 讓 `Canvas`、`CanvasNode`、`canvasStore` 都走同一套 `dispatch -> transition` 流程。

## 型別與結構

- `InteractionState`：互動狀態常數集合（`as const`）。
- `InteractionEvent`：互動事件常數集合（`as const`）。
- `transitions`：`Record<State, Record<Event, State>>` 轉移表。
- `transition(current, event)`：查表回傳下一個狀態，找不到時回傳原狀態。

註記：

- 這裡使用 `const + union type`，不是 `enum`，因為專案 TypeScript 設定有 `erasableSyntaxOnly`，`enum` 會編譯失敗。

## 狀態列表

- `idle`：閒置
- `dragging`：拖曳卡片中
- `panning`：平移畫布中
- `box-selecting`：框選中（目前預留）
- `resizing`：調整大小中（目前預留）
- `connecting`：連線中（目前預留）
- `editing`：編輯內容中（目前預留）

## 事件列表

- `node-pointer-down` / `node-pointer-up`
- `node-drag-start` / `node-drag-end`
- `stage-pointer-down` / `stage-pointer-up`
- `pan-start` / `pan-end`
- `box-select-start` / `box-select-end`
- `resize-start` / `resize-end`
- `connect-start` / `connect-end`
- `edit-start` / `edit-end`
- `escape`

## 目前轉移規則

### idle

- `node-pointer-down`、`node-drag-start` -> `dragging`
- `stage-pointer-down`、`pan-start` -> `panning`
- `box-select-start` -> `box-selecting`
- `resize-start` -> `resizing`
- `connect-start` -> `connecting`
- `edit-start` -> `editing`
- 其他事件維持 `idle`

### dragging

- `node-pointer-up`、`node-drag-end`、`escape` -> `idle`
- 其他事件維持 `dragging`

### panning

- `stage-pointer-up`、`pan-end`、`escape` -> `idle`
- 其他事件維持 `panning`

### box-selecting

- `box-select-end`、`escape` -> `idle`
- 其他事件維持 `box-selecting`

### resizing

- `resize-end`、`escape` -> `idle`
- 其他事件維持 `resizing`

### connecting

- `connect-end`、`escape` -> `idle`
- 其他事件維持 `connecting`

### editing

- `edit-end`、`escape` -> `idle`
- 其他事件維持 `editing`

## 與目前程式碼的對應

- `CanvasNode` 會 dispatch：
  - `NODE_POINTER_DOWN`
  - `NODE_POINTER_UP`
  - `NODE_DRAG_START`
  - `NODE_DRAG_END`
- `Canvas` 會 dispatch：
  - `STAGE_POINTER_DOWN`
  - `STAGE_POINTER_UP`
  - `PAN_START`
  - `PAN_END`
  - `ESCAPE`
- `canvasStore.dispatch(event)` 透過 `transition` 更新 `interactionState`。
