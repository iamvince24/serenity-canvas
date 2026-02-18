# Phase 1 Step 14：Dashboard 多白板管理

## Context

登入使用者可擁有多個白板。需要一個 Dashboard 頁面列出所有白板，並支援新增/刪除白板。

## 目標

- `/dashboard` 頁面顯示白板列表
- 支援新增白板、重新命名、刪除白板
- 點擊白板進入 `/canvas/:id`

---

## 實作步驟

### Step 1：Dashboard 頁面

**`src/pages/DashboardPage.tsx`** — 新建：

- 卡片式列表，每張卡片顯示：白板名稱、最後編輯時間、卡片數量
- 「新增白板」按鈕
- 右鍵或 hover 顯示操作選單（重新命名、刪除）
- Layered Calm 風格：Surface 背景、Elevated 卡片

### Step 2：Dashboard Store

**`src/stores/dashboardStore.ts`** — 新建：

- `boards: Board[]`
- `loadBoards()` — 從 Supabase + IndexedDB 載入
- `createBoard(title)` — 建立新白板
- `renameBoard(id, title)`
- `deleteBoard(id)` — soft delete

### Step 3：路由更新

**`src/App.tsx`** — 修改：

- `/dashboard` → `<DashboardPage />`（ProtectedRoute 包裝）
- `/canvas/:id` → `<CanvasPage />`（ProtectedRoute 包裝）
- `/canvas` → 未登入的本地白板（不需要 id）

### Step 4：CanvasPage 適配

**`src/pages/CanvasPage.tsx`** — 修改：

- 從 URL params 取得 `boardId`
- 根據 `boardId` 載入對應白板資料
- 無 `boardId` 時載入本地白板

### Step 5：Header 導航

**`src/components/layout/Header.tsx`** — 修改：

- 登入使用者：左上角 Logo 點擊 → `/dashboard`
- 白板頁面顯示「← 返回白板列表」

---

## 關鍵檔案

| 檔案                               | 動作 |
| ---------------------------------- | ---- |
| `src/pages/DashboardPage.tsx`      | 新建 |
| `src/stores/dashboardStore.ts`     | 新建 |
| `src/App.tsx`                      | 修改 |
| `src/pages/CanvasPage.tsx`         | 修改 |
| `src/components/layout/Header.tsx` | 修改 |

---

## 驗證方式

- [ ] 登入後進入 `/dashboard` 看到白板列表
- [ ] 可新增白板，列表即時更新
- [ ] 可重新命名白板
- [ ] 可刪除白板（確認對話框）
- [ ] 點擊白板進入 `/canvas/:id`
- [ ] 白板頁面載入正確的白板資料
- [ ] Logo 點擊可返回 Dashboard
- [ ] `pnpm build` 無錯誤
