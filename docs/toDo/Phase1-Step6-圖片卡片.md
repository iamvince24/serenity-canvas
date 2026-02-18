# Phase 1 Step 6：圖片卡片

## 前置條件

- **Gate B 已確認**：圖片持久化契約已凍結（見 README.md 決策閘門）。
- **Step 9 第一階段已完成**：圖片卡片的新增/刪除需走 Command。

## Context

規格要求支援「圖片卡片」——顯示圖片，底部附帶文字說明（Markdown）。此步驟也涉及圖片上傳時的格式檢查與客戶端壓縮（Web Worker）。圖片持久化使用 IndexedDB Blob + metadata，object URL 僅作 runtime 暫用。

## 目標

- 支援新增圖片卡片（拖放圖片或上傳按鈕）
- 圖片卡片：上方顯示圖片，下方顯示文字說明
- 上傳時進行格式/大小檢查 + 客戶端壓縮
- 圖片壓縮在 Web Worker 中執行
- 所有操作走 Command Pattern

---

## 實作步驟

### Step 1：擴充型別定義

**`src/types/canvas.ts`** — 修改：

- 新增 `ImageNode` 型別，使用 discriminated union：`CanvasNode = TextNode | ImageNode`
- `ImageNode` 欄位（依圖片持久化契約）：
  - 基礎：`id, type: 'image', x, y, width, height, content, color`
  - 圖片 metadata：`asset_id: string`, `mime_type: string`, `original_width: number`, `original_height: number`, `byte_size: number`
  - 雲端（Phase 2）：`storage_path?: string`
- **不使用** `imageSrc: string`（object URL / base64）作為持久化欄位
- Runtime 用 `runtimeImageUrl?: string`（由載入流程填入，不進 IndexedDB）
- 更新 `CanvasState.nodes` 型別為 `Record<string, TextNode | ImageNode>`

### Step 2：圖片壓縮 Worker

**`src/workers/imageCompression.ts`** — 新建：

- 安裝 `browser-image-compression` + `comlink`
- 在 Worker 中使用 `browser-image-compression` 進行壓縮
- 設定：最大寬度 1920px、最大檔案大小 1MB、輸出 webp
- 使用 Comlink 封裝 RPC 介面

**`src/workers/imageCompression.worker.ts`** — 新建：

- Worker 入口，expose compression function via Comlink

### Step 3：圖片上傳與持久化流程

**`src/features/canvas/useImageUpload.ts`** — 新建 hook：

- 檔案格式檢查（jpg, png, gif, webp）
- 檔案大小檢查（上限 10MB 原檔）
- 呼叫 Worker 壓縮
- 壓縮後生成 `asset_id`（uuid）
- **寫入 IndexedDB**：以 `asset_id` 為 key 儲存 Blob + metadata
- 生成 runtime object URL 供 Konva 渲染（`URL.createObjectURL(blob)`）
- 回傳 `{ asset_id, mime_type, original_width, original_height, byte_size, runtimeImageUrl }`

### Step 4：圖片卡片元件

**`src/features/canvas/ImageCanvasNode.tsx`** — 新建：

- Konva `<Group>` + `<Image>` + `<Rect>` + `<Text>`
- 圖片載入流程：`asset_id` → 從 IndexedDB 取 Blob → `createObjectURL` → Konva Image
- 底部文字說明區域
- 支援寬度調整（圖片等比縮放）

### Step 5：拖放上傳

**`src/features/canvas/Canvas.tsx`** — 修改：

- 監聽 `onDrop` + `onDragOver` 事件
- 拖放圖片檔案 → 觸發圖片上傳流程 → 在 drop 位置新增圖片卡片
- 新增操作走 `AddNodeCommand`

### Step 6：Toolbar 新增圖片按鈕

**`src/features/canvas/Toolbar.tsx`** — 修改：

- 新增「上傳圖片」按鈕
- 點擊開啟 file input
- 選取圖片後在畫布中央新增圖片卡片

---

## 關鍵檔案

| 檔案                                      | 動作 |
| ----------------------------------------- | ---- |
| `src/types/canvas.ts`                     | 修改 |
| `src/workers/imageCompression.ts`         | 新建 |
| `src/workers/imageCompression.worker.ts`  | 新建 |
| `src/features/canvas/useImageUpload.ts`   | 新建 |
| `src/features/canvas/ImageCanvasNode.tsx` | 新建 |
| `src/features/canvas/Canvas.tsx`          | 修改 |
| `src/features/canvas/Toolbar.tsx`         | 修改 |

---

## 驗證方式

- [ ] 可透過 Toolbar 上傳圖片，畫布上顯示圖片卡片
- [ ] 可拖放圖片至畫布新增圖片卡片
- [ ] 圖片卡片底部顯示文字說明區域
- [ ] 過大的圖片被自動壓縮（開 DevTools 確認 Worker 執行）
- [ ] 不支援的格式顯示錯誤提示
- [ ] 圖片卡片支援寬度調整，圖片等比縮放
- [ ] **持久化驗證**：重新整理頁面後圖片仍可從 IndexedDB 載入顯示（Step 11 前先手動驗證 DB 有資料）
- [ ] 新增/刪除圖片卡片走 Command，可 Undo/Redo
- [ ] `pnpm build` 無錯誤
