# Phase 1 Step 13：Supabase 資料同步

## Context

登入使用者的資料需要同步至 Supabase。Phase 1 採用 Last-Write-Wins (LWW) 策略，搭配 IndexedDB 離線快取。此步驟實作 IndexedDB → Supabase 的同步層。

## 目標

- 登入使用者的操作自動同步至 Supabase
- 離線時操作寫入 IndexedDB，上線後自動同步
- 切換裝置時可載入雲端資料
- LWW conflict resolution（DB trigger 處理）

---

## 實作步驟

### Step 1：Sync Service

**`src/services/syncService.ts`** — 新建：

- `SyncService` class
- `pushToRemote(changes)` — 將本地變更推送至 Supabase
- `pullFromRemote(boardId)` — 從 Supabase 拉取最新資料
- `fullSync(boardId)` — 完整同步（pull + push）
- 使用 `updated_at` 做 LWW 判斷

### Step 2：Change Tracking

**`src/db/changeTracker.ts`** — 新建：

- 在 IndexedDB 中記錄未同步的變更（dirty flag 或 change log）
- 同步成功後清除 dirty flag
- 提供 `getPendingChanges()` 查詢待同步項目

### Step 3：自動同步觸發

**`src/services/syncManager.ts`** — 新建：

- 監聯網路狀態（`navigator.onLine` + `online`/`offline` events）
- 登入狀態下，state 變更後 debounce 同步（如 2 秒）
- 離線 → 上線時觸發完整同步
- 同步中顯示狀態指示（如 Header 小 icon）

### Step 4：登入時的本地 → 雲端遷移

- 使用者在未登入時已有本地白板資料
- 登入後詢問是否將本地資料同步至雲端
- 遷移：將 `local-board` 的資料建立為雲端白板

### Step 5：Store 整合

**`src/stores/canvasStore.ts`** — 修改：

- 根據登入狀態決定是否觸發同步
- 載入白板時優先用 IndexedDB 快取，背景更新

---

## 關鍵檔案

| 檔案                          | 動作 |
| ----------------------------- | ---- |
| `src/services/syncService.ts` | 新建 |
| `src/db/changeTracker.ts`     | 新建 |
| `src/services/syncManager.ts` | 新建 |
| `src/stores/canvasStore.ts`   | 修改 |

---

## 驗證方式

- [ ] 登入使用者新增卡片 → Supabase Dashboard 可看到資料
- [ ] 關閉分頁 → 重新開啟 → 資料從雲端/快取恢復
- [ ] 斷網 → 編輯 → 重新連網 → 資料自動同步至 Supabase
- [ ] 未登入使用者 → 登入 → 本地資料遷移至雲端
- [ ] `pnpm build` 無錯誤
