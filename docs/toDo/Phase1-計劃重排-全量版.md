# Phase 1 計劃重排（全量版）

## 摘要

此文件將 Phase 1 從「功能清單」重排為「低返工、可直接實作」的執行計劃。核心策略是：

- 先凍結跨步驟契約（內容、圖片、選取）
- 提前導入 Command 基礎能力
- 避免重複實作（尤其 edge culling）
- 用最小測試門檻鎖住回歸風險

---

## 調整範圍

- 目標文件：
- `docs/toDo/README.md`
- `docs/toDo/Phase1-Step4-Markdown編輯-Tiptap整合.md`
- `docs/toDo/Phase1-Step6-圖片卡片.md`
- `docs/toDo/Phase1-Step7-連線系統.md`
- `docs/toDo/Phase1-Step8-框選與群組.md`
- `docs/toDo/Phase1-Step9-Undo-Redo-Command-Pattern.md`
- `docs/toDo/Phase1-Step10-Viewport-Culling.md`
- `docs/toDo/Phase1-Step16-匯出Obsidian格式.md`

- 非目標：
- `docs/spec/*` 母規格不改動
- `docs/done/*` 已完成紀錄不改動

---

## 執行順序（重排後）

```text
互動基礎 (Step 2-5)
  ↓
Command 基礎先行 (Step 9 第一階段)
  ↓
進階元素 (Step 6-8，統一走 Command)
  ↓
效能與渲染邊界 (Step 10)
  ↓
本地持久化 (Step 11)
  ↓
雲端與認證 (Step 12 → Step 13)
  ↓
產品功能層 (Step 14 → Step 15)
  ↓
匯出 (Step 16)
```

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

## 逐步修改要求（決策完成版）

### Step 4（Markdown 編輯）

- 補上內容三態規範：編輯態、儲存態、匯出態
- 補上 round-trip 規則：`md -> editor -> md`
- 補上失敗處理：parse/serialize 失敗時的降級策略

### Step 6（圖片卡片）

- 移除把 `object URL` 作為資料來源的描述
- 補上圖片節點 metadata 規格：
- `asset_id`, `mime_type`, `width`, `height`, `byte_size`, `storage_path?`
- 補上 IndexedDB Blob 儲存與載入流程

### Step 7（連線）

- 移除 Step 7 內 edge culling 落地要求
- 改為輸出可被 Step 10 重用的 edge bounds helper 介面
- 補齊 edge selection 與刪除規格

### Step 8（框選與群組）

- 鎖定互動規則：`drag blank = panning`，`Shift + drag blank = box-selecting`
- 明確 group selection 與 node/edge/group 的互動優先序

### Step 9（Undo/Redo）

- 改為兩階段：
- Phase A：node add/delete/move/resize/content/color
- Phase B：edge/group（與進階操作）
- 明確排除項目：viewport pan/zoom、hover、暫態 UI state

### Step 10（Viewport Culling）

- 統一承接 node + edge culling（edge 來自 Step 7 helper）
- 補上 performance 驗收場景與基準
- 補上 padding/hysteresis 規則以降低邊界閃爍

### Step 16（匯出）

- 依賴 Gate A/B，固定 `.md` 與附件來源
- 補上檔名衝突策略（slug 重複處理）
- 補上失敗策略（單檔失敗跳過或中止）與錯誤報告格式

---

## 公開介面 / 型別契約（跨步驟共用）

### 內容契約

- 持久化來源：`content_markdown: string`
- 編輯器態：ProseMirror JSON（非持久化主來源）
- 匯出態：`.md` 由 `content_markdown` 生成

### 圖片節點契約

- 圖片節點不以 object URL 做持久化
- 持久化欄位：
- `asset_id`
- `mime_type`
- `width`
- `height`
- `byte_size`
- `storage_path?`（雲端可用時）

### 選取契約

- `selectedNodeIds: string[]`
- `selectedEdgeIds: string[]`
- `selectedGroupIds: string[]`

### History 契約

- Command 可序列化（至少 `type + payload + inverse`）
- 需支援 CompositeCommand
- 需有「不記錄 history」白名單

---

## 測試與驗收場景

### Gate A 驗收

- Markdown round-trip 不丟失核心語意
- 編輯器退出後與持久化結果一致

### Gate B 驗收

- 圖片重整後可正常讀取
- 匯出附件與節點引用一致

### Gate C 驗收

- node/edge/group selection 與 Delete 行為符合優先序
- 多選規則在滑鼠與鍵盤流程下都一致

### Undo/Redo 驗收

- Phase A、Phase B 操作均可穩定 undo/redo
- 編輯模式下快捷鍵不干擾編輯器自身 history

### Culling 驗收

- 100+ nodes、150+ edges 場景可互動
- 平移/縮放時邊界不明顯閃爍

### 匯出驗收

- `.zip` 內的 `.canvas`、`.md`、`attachments/` 結構正確
- Obsidian 可成功開啟 `.canvas`

---

## 交付順序

1. 先改 `README`（順序、依賴、Gate、測試門檻）
2. 再改 Step 4/6/7/8/9/10/16（與 README 對齊）
3. 最後做一致性檢查（同一規則只定義一次）

---

## 預設與假設

- Phase 1 以「可落地 + 低返工」優先
- 內容主格式預設為 Markdown 字串
- 圖片持久化預設為 IndexedDB Blob
- 不修改 `docs/spec/*` 母規格，只在 `docs/toDo/*` 做可執行化修訂
