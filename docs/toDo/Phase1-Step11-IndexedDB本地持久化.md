# Phase 1 Step 11：IndexedDB 本地持久化 (Dexie.js)

## Context

目前所有資料只在 Zustand 記憶體中，重新整理就消失。規格要求 Offline-first 架構：所有操作先寫入 IndexedDB，再背景同步至 Supabase。此步驟先完成 IndexedDB 層，未登入使用者的資料也能保留。

## 目標

- 使用 Dexie.js 包裝 IndexedDB
- 所有狀態變更自動寫入 IndexedDB
- 頁面載入時從 IndexedDB 恢復狀態
- 未登入使用者的唯一白板資料持久保存

---

## 實作步驟

### Step 1：安裝 Dexie

```bash
pnpm add dexie
```

### Step 2：定義 DB Schema

**`src/db/database.ts`** — 新建：

- 建立 `SerenityDB extends Dexie`
- 定義 tables：`boards`, `nodes`, `edges`, `groups`, `groupMembers`
- Schema 與 `06-data-model.md` 對齊
- 本地白板使用固定 id（如 `local-board`）

### Step 3：DB 存取層

**`src/db/repositories.ts`** — 新建：

- `BoardRepository`：CRUD for boards
- `NodeRepository`：CRUD for nodes（含批次操作）
- `EdgeRepository`：CRUD for edges
- `GroupRepository`：CRUD for groups

### Step 4：Zustand Middleware — 自動持久化

**`src/stores/persistMiddleware.ts`** — 新建：

- Zustand middleware：訂閱 state 變更，debounce 後寫入 IndexedDB
- 或改用 `subscribe` + 差異偵測，只寫入變更的部分
- Debounce 間隔：300ms（避免拖曳時頻繁寫入）

### Step 5：啟動時恢復狀態

**`src/stores/canvasStore.ts`** — 修改：

- 啟動時從 IndexedDB 讀取 nodes, edges, groups
- 載入完成前顯示 loading 狀態
- 如果 IndexedDB 為空（首次使用）→ 建立預設空白板

### Step 6：CanvasPage 整合

**`src/pages/CanvasPage.tsx`** — 修改：

- 載入時顯示 loading skeleton
- 資料就緒後渲染 Canvas

---

## 關鍵檔案

| 檔案                              | 動作 |
| --------------------------------- | ---- |
| `src/db/database.ts`              | 新建 |
| `src/db/repositories.ts`          | 新建 |
| `src/stores/persistMiddleware.ts` | 新建 |
| `src/stores/canvasStore.ts`       | 修改 |
| `src/pages/CanvasPage.tsx`        | 修改 |

---

## 驗證方式

- [ ] 新增卡片 → 重新整理頁面 → 卡片仍在
- [ ] 移動卡片/修改內容/改顏色 → 重新整理 → 狀態保留
- [ ] 連線和群組 → 重新整理 → 保留
- [ ] 首次載入顯示 loading 後進入空白畫布
- [ ] DevTools Application → IndexedDB 可看到儲存的資料
- [ ] `pnpm build` 無錯誤
