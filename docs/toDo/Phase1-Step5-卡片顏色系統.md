# Phase 1 Step 5：卡片顏色系統

## Context

規格要求卡片支援顏色設定，對應 Obsidian Canvas 的 6 種顏色。這是視覺整理的重要功能，且需要在匯出時正確轉換為 Obsidian 格式。

## 目標

- 選取卡片後可設定顏色（6 種 + 預設無色）
- 卡片根據顏色顯示對應的邊框/背景色
- 顏色選擇器 UI

---

## 實作步驟

### Step 1：定義顏色常數

**`src/constants/colors.ts`** — 新建：

- 定義 Obsidian Canvas 6 色對應：`red`, `orange`, `yellow`, `green`, `cyan`, `purple`
- 每個顏色包含：`id`, `label`, `border`, `background`（淡色背景）, `obsidianValue`
- 預設 `null` = 無顏色（使用 Surface 底色）

### Step 2：卡片顏色渲染

**`src/features/canvas/CanvasNode.tsx`** — 修改：

- 根據 `node.color` 查找對應的顏色設定
- 設定 Rect 的 `fill`（淡色背景）和 `stroke`（對應色邊框）
- 無顏色時使用預設 Elevated (#FFFFFF) 底色 + Border (#E5E3DF) 邊框

### Step 3：顏色選擇器 UI

**`src/features/canvas/ColorPicker.tsx`** — 新建：

- 浮動在選取卡片上方或下方
- 顯示 6 個色塊 + 1 個「無色」選項
- 點擊色塊 → 更新卡片顏色
- 使用 shadcn/ui Popover 包裝

### Step 4：Store 更新

**`src/stores/canvasStore.ts`** — 修改：

- 新增 `updateNodeColor(id, color)` action

---

## 關鍵檔案

| 檔案                                  | 動作 |
| ------------------------------------- | ---- |
| `src/constants/colors.ts`             | 新建 |
| `src/features/canvas/ColorPicker.tsx` | 新建 |
| `src/features/canvas/CanvasNode.tsx`  | 修改 |
| `src/stores/canvasStore.ts`           | 修改 |

---

## 驗證方式

- [ ] 選取卡片後可開啟顏色選擇器
- [ ] 選擇顏色後卡片邊框/背景更新
- [ ] 6 種顏色都能正確顯示
- [ ] 選擇「無色」可重置卡片顏色
- [ ] `pnpm build` 無錯誤
