# Phase 1 執行計劃

## 進度總覽

| #    | Step                                                                 | 狀態    | 主題                                         |
| ---- | -------------------------------------------------------------------- | ------- | -------------------------------------------- |
| 0-1  | [首頁與路由基礎](../done/Phase0-Step1-首頁與路由基礎.md)             | ✅ 完成 | Landing Page + 路由                          |
| 1-1  | [空白畫布與卡片拖動](../done/Phase1-Step1-空白畫布與卡片拖動.md)     | ✅ 完成 | Konva Stage + Pan/Zoom + TextNode 拖動       |
| 1-2  | [狀態機與選取刪除](Phase1-Step2-狀態機與選取刪除.md)                 | ⬜ 待做 | 互動狀態機 + 卡片選取/刪除                   |
| 1-3  | [卡片寬度調整與自適應高度](Phase1-Step3-卡片寬度調整與自適應高度.md) | ⬜ 待做 | Resize handle + 自適應高度                   |
| 1-4  | [Markdown 編輯](Phase1-Step4-Markdown編輯-Tiptap整合.md)             | ⬜ 待做 | Tiptap DOM Overlay + 內容契約                |
| 1-5  | [卡片顏色系統](Phase1-Step5-卡片顏色系統.md)                         | ⬜ 待做 | 6 色 Obsidian 對應 + 顏色選擇器              |
| 1-9A | [Undo/Redo 第一階段](Phase1-Step9-Undo-Redo-Command-Pattern.md)      | ⬜ 待做 | Command 基礎 + node 操作                     |
| 1-6  | [圖片卡片](Phase1-Step6-圖片卡片.md)                                 | ⬜ 待做 | 圖片上傳/壓縮 + Web Worker + 圖片持久化契約  |
| 1-7  | [連線系統](Phase1-Step7-連線系統.md)                                 | ⬜ 待做 | 錨點 + 連線建立 + 方向/標籤（不含 culling）  |
| 1-8  | [框選與群組](Phase1-Step8-框選與群組.md)                             | ⬜ 待做 | Shift+拖曳框選 + 群組 + 右鍵選單             |
| 1-9B | [Undo/Redo 第二階段](Phase1-Step9-Undo-Redo-Command-Pattern.md)      | ⬜ 待做 | Edge/Group Command 補齊                      |
| 1-10 | [Viewport Culling](Phase1-Step10-Viewport-Culling.md)                | ⬜ 待做 | Node + Edge 統一視口剔除 + 拖曳/縮放整合測試 |
| 1-11 | [IndexedDB 持久化](Phase1-Step11-IndexedDB本地持久化.md)             | ⬜ 待做 | Dexie.js + 自動存取                          |
| 1-12 | [Supabase 設置與認證](Phase1-Step12-Supabase設置與認證.md)           | ⬜ 待做 | DB Schema + RLS + Auth UI                    |
| 1-13 | [Supabase 資料同步](Phase1-Step13-Supabase資料同步.md)               | ⬜ 待做 | LWW 同步 + 離線支援                          |
| 1-14 | [Dashboard 多白板](Phase1-Step14-Dashboard多白板管理.md)             | ⬜ 待做 | 白板列表 + CRUD                              |
| 1-15 | [收件匣 Inbox](Phase1-Step15-收件匣Inbox.md)                         | ⬜ 待做 | 側邊欄 + 拖曳至白板                          |
| 1-16 | [匯出 Obsidian](Phase1-Step16-匯出Obsidian格式.md)                   | ⬜ 待做 | .canvas + .md + .zip (Web Worker)            |

---

## 執行順序邏輯（風險收斂版）

```
互動基礎 (Step 2-5)
  ↓
Command 基礎先行 (Step 9 第一階段)
  ↓
進階元素 (Step 6-8，統一走 Command)
  ↓
Command 補齊 (Step 9 第二階段)
  ↓
效能與渲染邊界 (Step 10) ← 含拖曳/縮放整合測試
  ↓
本地持久化 (Step 11)
  ↓
雲端與認證 (Step 12 → Step 13)
  ↓
產品功能層 (Step 14 → Step 15)
  ↓
匯出 (Step 16)
```

**核心原則**：先凍結資料契約，再擴功能；先完成可回滾機制，再做高複雜互動。

---

## 決策閘門（必先確認）

### Gate A（Step 4 前）：內容契約

- 定義唯一持久化格式：`content_markdown: string`
- 定義編輯態：Tiptap/ProseMirror JSON 僅作 runtime 狀態
- 定義匯出態：`.md` 直接來自 `content_markdown`
- 定義 fallback：Markdown 解析失敗時降級為純文字並記錄 warning

### Gate B（Step 6 前）：圖片持久化契約

- `object URL` 僅 runtime 用，不可作持久化來源
- Phase 1 本地持久化使用 IndexedDB Blob + metadata
- Phase 2 再接 Supabase Storage（`storage_path`）

### Gate C（Step 7 前）：選取契約

- 統一管理 node/edge/group 的 selected state
- 明確 Delete 優先順序（避免同時選取時行為不確定）
- 明確多選互斥策略（是否允許跨類型同時選取）

---

## 公開介面 / 型別契約（跨步驟共用）

### 內容契約

- 持久化來源：`content_markdown: string`
- 編輯器態：ProseMirror JSON（非持久化主來源）
- 匯出態：`.md` 由 `content_markdown` 生成

### 圖片節點契約

- 圖片節點不以 object URL 做持久化
- 持久化欄位：`asset_id`, `mime_type`, `width`, `height`, `byte_size`, `storage_path?`（雲端可用時）

### 選取契約

- `selectedNodeIds: string[]`
- `selectedEdgeIds: string[]`
- `selectedGroupIds: string[]`

### History 契約

- Command 可序列化（至少 `type + payload + inverse`）
- 需支援 CompositeCommand
- 需有「不記錄 history」白名單（viewport pan/zoom、hover、暫態 UI state）

---

## 依賴關係

- Step 3 (Resize) 必須先於 Step 4 (Markdown Overlay)，編輯器寬度需依卡片寬度計算。
- Step 4 完成時需同時產出內容序列化策略，Step 11 / Step 13 / Step 16 直接沿用。
- Step 9 拆為兩階段：第一階段在 Step 5 後先上線 node/content/resize 的 command；第二階段在 Step 8 後補 edge/group command。
- Step 7 先不落地 edge culling；統一於 Step 10 實作 node + edge culling，避免重工。
- Step 8 明確規則：空白拖曳預設 panning，`Shift + 拖曳` 為 box-selecting。
- Step 11 在 Step 10 後執行，避免持久化早於渲染/資料結構穩定而頻繁 migration。
- Step 12-13 (Supabase) 必須依序。
- Step 14-15 (Dashboard/Inbox) 依賴 Step 12，且需與 Step 13 的 boardId 與同步策略一致。
- Step 16 最後執行，前提是 node/edge/group/image 型別與內容契約已凍結。

---

## 最小測試門檻（每階段）

- **Step 2-5**：狀態機轉換表的 unit test（純邏輯，快速驗證合法轉換與非法事件忽略）。
- **Step 9 第一階段**：Undo/Redo 對 add/move/resize/edit 必須有回歸測試（含多步連續操作）。
- **Step 6-8**：image upload、edge create/delete、group create/delete 各至少一個整合測試。所有新操作需走 Command。
- **Step 9 第二階段**：Edge/Group Command 的 undo/redo 回歸測試。
- **Step 10**：100+ 節點 + 150+ 連線的效能驗證（固定場景 + 基準數據）。**同時補上拖曳與縮放的整合測試**（此時渲染與互動層均已穩定）。
- **Step 11-13**：離線編輯、重新上線同步、衝突處理（LWW）需有端對端流程測試。
- **Step 16**：匯出結果需有檔案快照測試（`.canvas` 結構、`.md` 內容、附件路徑）。
