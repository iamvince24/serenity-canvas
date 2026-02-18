# Phase 1 Step 15：收件匣 Inbox（登入使用者限定）

## Context

收件匣是收集資訊的暫存區，位於側邊欄。使用者可手動新增項目或從 Chrome Extension 剪藏（Phase 2），然後拖曳至白板。此步驟實作收件匣的 UI 與基本功能。

## 目標

- 側邊欄顯示收件匣
- 支援手動新增項目（文字 + 選填目標白板）
- 支援依目標白板篩選（全部 / 特定白板 / 未分類）
- 收件匣卡片可拖曳至白板

---

## 實作步驟

### Step 1：側邊欄 Layout

**`src/components/layout/Sidebar.tsx`** — 新建：

- 可收合的側邊欄，位於畫布左側
- 寬度約 320px，收合時隱藏
- Toggle 按鈕（收件匣 icon）

**`src/pages/CanvasPage.tsx`** — 修改：

- 整合 Sidebar，畫布區域自適應寬度

### Step 2：收件匣 Store

**`src/stores/inboxStore.ts`** — 新建：

- `items: InboxItem[]`
- `filter: 'all' | boardId | 'uncategorized'`
- `loadItems()` — 從 Supabase 載入
- `addItem(content, targetBoardId?)` — 新增項目
- `deleteItem(id)` — 刪除項目（拖入白板後觸發）
- `setFilter(filter)` — 設定篩選

### Step 3：收件匣列表 UI

**`src/features/inbox/InboxPanel.tsx`** — 新建：

- 頂部：「新增」按鈕 + 篩選下拉選單
- 列表：卡片式顯示每個項目（內容摘要 + 來源 URL + 目標白板標記）
- 空狀態提示

**`src/features/inbox/InboxItem.tsx`** — 新建：

- 單一項目卡片
- 顯示 Markdown 內容預覽
- 來源標註（URL + Title）
- 目標白板標記

### Step 4：新增項目表單

**`src/features/inbox/AddInboxItemForm.tsx`** — 新建：

- Markdown 文字輸入
- 目標白板下拉選單（可選）
- 送出後寫入 Supabase `inbox_items`

### Step 5：拖曳至白板

**`src/features/inbox/useInboxDrag.ts`** — 新建：

- HTML5 Drag and Drop API 或自訂拖曳
- 拖曳開始 → 設定 drag data
- 放到畫布上 → 建立 TextNode + 保留 source_url/source_title
- 同時刪除對應的 inbox_item（前端 Promise.all）

---

## 關鍵檔案

| 檔案                                      | 動作 |
| ----------------------------------------- | ---- |
| `src/components/layout/Sidebar.tsx`       | 新建 |
| `src/stores/inboxStore.ts`                | 新建 |
| `src/features/inbox/InboxPanel.tsx`       | 新建 |
| `src/features/inbox/InboxItem.tsx`        | 新建 |
| `src/features/inbox/AddInboxItemForm.tsx` | 新建 |
| `src/features/inbox/useInboxDrag.ts`      | 新建 |
| `src/pages/CanvasPage.tsx`                | 修改 |

---

## 驗證方式

- [ ] 白板頁面左側顯示收件匣側邊欄
- [ ] 側邊欄可收合/展開
- [ ] 可手動新增收件匣項目
- [ ] 可選擇目標白板標記
- [ ] 篩選功能正常（全部/特定白板/未分類）
- [ ] 拖曳收件匣項目至白板 → 建立卡片 + 從收件匣移除
- [ ] 卡片保留來源 URL 和標題
- [ ] `pnpm build` 無錯誤
