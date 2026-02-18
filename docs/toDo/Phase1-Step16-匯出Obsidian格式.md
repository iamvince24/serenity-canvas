# Phase 1 Step 16：匯出 Obsidian 格式 (.canvas + .md + .zip)

## 前置條件

- **Gate A 已確認**：`.md` 直接來自 `content_markdown`。
- **Gate B 已確認**：圖片附件來自 IndexedDB Blob（`asset_id`）。
- **所有元素型別已凍結**：node/edge/group/image 型別不再變動。

## Context

規格要求將畫布匯出為 Obsidian 相容的格式：`.canvas` JSON + `.md` 檔案 + 圖片，打包為 `.zip`。打包在 Web Worker 中執行避免阻塞 UI。這是 Phase 1 的最後一個功能。

## 目標

- 一鍵匯出為 `.zip`
- 包含：`.canvas` JSON（Obsidian 標準格式）、每張卡片的 `.md`、圖片檔案
- 打包在 Web Worker 中執行
- 匯出進度指示

---

## 檔名策略

- `.md` 檔名：以內容首行（去除 Markdown 標記）作為 slug，限長 50 字元
- **衝突處理**：slug 重複時加數字後綴（如 `my-note-1.md`, `my-note-2.md`）
- 圖片檔名：`{asset_id}.{ext}`，放入 `attachments/` 資料夾
- `.canvas` 檔名：白板名稱的 slug

## 失敗策略

- **單檔失敗**（如圖片 Blob 讀取失敗）→ **跳過該檔**，繼續打包其餘檔案
- 匯出完成時顯示跳過清單（如「3 個檔案匯出成功，1 張圖片跳過」）
- 錯誤資訊記錄在 `.zip` 根目錄的 `_export_log.txt`

---

## 實作步驟

### Step 1：安裝依賴

```bash
pnpm add jszip comlink
```

（如 Step 6 已安裝 comlink 則跳過）

### Step 2：Obsidian Canvas 格式轉換

**`src/export/canvasConverter.ts`** — 新建：

- 將內部 nodes/edges/groups 轉換為 Obsidian `.canvas` JSON 格式
- 處理 edge direction 對應（`forward` → fromEnd:none/toEnd:arrow 等）
- 處理 group 轉換
- 處理邊界情況：
  - 空卡片 → 空 `.md`
  - 斷開的連線（端點 node 已刪除）→ 跳過該 edge
  - 無 node 的群組 → 跳過該 group

### Step 3：Markdown 檔案生成

**`src/export/markdownConverter.ts`** — 新建：

- 每張文字卡片 → 一個 `.md` 檔案
- **內容來源**：直接使用 `content_markdown`（Gate A 契約）
- 檔案名稱：依檔名策略生成 slug
- `.canvas` 中的 node 引用指向對應的 `.md` 路徑

### Step 4：圖片處理

**`src/export/imageExporter.ts`** — 新建：

- **來源**：從 IndexedDB 以 `asset_id` 取得 Blob（Gate B 契約）
- 放入 `attachments/` 資料夾，檔名 `{asset_id}.{ext}`
- `.canvas` 中的 node 引用指向圖片路徑
- 取得失敗 → 記錄到 export log，跳過

### Step 5：ZIP 打包 Worker

**`src/workers/zipWorker.ts`** — 新建：

- 在 Worker 中使用 JSZip 打包所有檔案
- Comlink 介面：`pack(files: { path: string, content: Blob | string }[])` → `Blob`
- 回傳進度回調

**`src/workers/zip.worker.ts`** — 新建：

- Worker 入口

### Step 6：匯出 UI

**`src/features/export/ExportModal.tsx`** — 新建：

- 匯出預覽：檔案清單（`.canvas` + N 個 `.md` + N 個附件）
- 「確認匯出」按鈕
- 進度指示（Processing... → Done）
- 完成後顯示結果摘要（成功 / 跳過數量）+ 自動觸發下載

**`src/features/canvas/Toolbar.tsx`** — 修改：

- 新增「匯出」按鈕 → 開啟 ExportModal

---

## 關鍵檔案

| 檔案                                  | 動作 |
| ------------------------------------- | ---- |
| `src/export/canvasConverter.ts`       | 新建 |
| `src/export/markdownConverter.ts`     | 新建 |
| `src/export/imageExporter.ts`         | 新建 |
| `src/workers/zipWorker.ts`            | 新建 |
| `src/workers/zip.worker.ts`           | 新建 |
| `src/features/export/ExportModal.tsx` | 新建 |
| `src/features/canvas/Toolbar.tsx`     | 修改 |

---

## 驗證方式

- [ ] 點擊「匯出」→ 顯示匯出預覽 Modal
- [ ] 確認匯出 → 下載 `.zip` 檔案
- [ ] `.zip` 內含 `.canvas` JSON、`.md` 檔案、`attachments/` 圖片
- [ ] `.canvas` 檔案可在 Obsidian 中正確開啟
- [ ] `.md` 檔案內容與卡片 `content_markdown` 一致
- [ ] **檔名衝突**：同名卡片匯出為 `note.md`, `note-1.md`
- [ ] **單檔失敗**：模擬圖片 Blob 讀取失敗 → 匯出不中止，顯示跳過清單 + `_export_log.txt`
- [ ] 大量卡片匯出時 UI 不凍結（Web Worker）
- [ ] 匯出過程有進度指示
- [ ] 空白板匯出不報錯（產出空 `.canvas`）
- [ ] `pnpm build` 無錯誤
