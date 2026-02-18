# Phase 1 Step 2：互動狀態機 + 卡片選取與刪除

## Context

目前畫布已有基本的平移縮放與卡片拖動，但所有互動邏輯散落在事件處理中。隨著功能增加（拖曳、框選、調整大小、連線、編輯），需要一個狀態機統一管理互動狀態，避免 if-else 爆炸。同時補上卡片的選取視覺回饋與刪除功能。

## 目標

- 建立自訂狀態機（`Record<State, Record<Event, State>>`），約 50-80 行
- 卡片點擊後顯示選取外框
- 支援 `Delete` / `Backspace` 刪除選取的卡片
- 點擊空白處取消選取

---

## 實作步驟

### Step 1：定義狀態機型別與轉換表

**`src/features/canvas/stateMachine.ts`** — 新建：

- 定義 `InteractionState` enum：`idle` | `dragging` | `panning` | `box-selecting` | `resizing` | `connecting` | `editing`
- 定義 `InteractionEvent` enum：對應滑鼠/鍵盤事件
- 建立轉換表 `transitions: Record<InteractionState, Record<InteractionEvent, InteractionState>>`
- 提供 `transition(current, event)` 函式

### Step 2：整合狀態機至 Zustand Store

**`src/stores/canvasStore.ts`** — 修改：

- 新增 `interactionState: InteractionState` 狀態（初始為 `idle`）
- 新增 `dispatch(event: InteractionEvent)` action，透過狀態機決定下一個狀態
- 新增 `deleteNode(id: string)` action
- 新增 `deleteSelectedNodes()` action

### Step 3：卡片選取視覺回饋

**`src/features/canvas/CanvasNode.tsx`** — 修改：

- 從 store 讀取 `selectedNodeIds`
- 選取時顯示 Sage 色 (#8B9D83) 的外框（Konva `Rect` stroke）
- 點擊卡片觸發 `selectNode(id)`

### Step 4：鍵盤刪除

**`src/features/canvas/Canvas.tsx`** — 修改：

- 監聽全域 `keydown` 事件
- `Delete` / `Backspace` → 刪除所有選取的卡片
- 確保在 `editing` 狀態時不攔截刪除鍵（留給文字編輯器）

### Step 5：重構現有拖曳邏輯

- 將 Canvas.tsx 中的拖曳/平移邏輯改為由狀態機驅動
- `idle` + mouseDown on node → `dragging`
- `idle` + mouseDown on stage → `panning`
- `dragging` + mouseUp → `idle`

---

## 關鍵檔案

| 檔案                                  | 動作 |
| ------------------------------------- | ---- |
| `src/features/canvas/stateMachine.ts` | 新建 |
| `src/stores/canvasStore.ts`           | 修改 |
| `src/features/canvas/CanvasNode.tsx`  | 修改 |
| `src/features/canvas/Canvas.tsx`      | 修改 |

---

## 驗證方式

- [ ] 點擊卡片，卡片出現選取外框（Sage 色）
- [ ] 點擊空白處，選取外框消失
- [ ] 選取卡片後按 Delete/Backspace，卡片被刪除
- [ ] 拖曳卡片仍正常運作
- [ ] 平移畫布仍正常運作
- [ ] `pnpm build` 無錯誤
