# 功能需求 (Functional Requirements)

e

## 使用者分層

|             | 未登入            | 登入                      |
| ----------- | ----------------- | ------------------------- |
| 白板數量    | 1 個              | 多個                      |
| 儲存位置    | Local (IndexedDB) | Supabase + IndexedDB 快取 |
| 收件匣      | ✗                 | ✓                         |
| Chrome 剪藏 | ✗                 | ✓                         |
| 匯出        | ✓                 | ✓                         |

**認證方式**：Google OAuth、Email/Password（透過 Supabase Auth）

---

## Phase 1: 核心白板與編輯 (Web App)

### 畫布操作

1. 支援無限畫布的拖曳 (Pan) 與縮放 (Zoom)。
2. 支援建立「**文字卡片 (Text Node)**」與「**圖片卡片 (Image Node)**」。
3. 支援框選多張卡片建立**群組 (Group)**。
4. 支援 **Undo / Redo**。

### 卡片功能

1. **文字卡片**：
   - 內容支援 Markdown 語法輸入與預覽。
   - 支援卡片**顏色**設定（對應 Obsidian Canvas 的 6 種顏色）。
   - **自適應高度**：高度隨內容自動延展，不出現內部捲軸。
   - 使用者可**手動拖拉調整寬度**，高度自動適應。
2. **圖片卡片**：
   - 顯示圖片，底部附帶**文字說明欄位**（支援 Markdown）。
   - 同樣支援顏色設定與寬度調整。

### 連線 (Edges)

1. 支援卡片之間的連線。
2. 箭頭方向支援三種：**單向、雙向、無箭頭**。
3. 連線可加**文字標籤**（如「因果關係」、「反對」等）。

### 資料持久化 (Persistence)

1. **登入使用者**：資料儲存於 Supabase (PostgreSQL)，搭配 IndexedDB 離線快取。
2. **未登入使用者**：資料僅存於 IndexedDB。

### 匯出功能 (Export)

1. 將畫布狀態轉換為 Obsidian 標準 JSON 格式 (`.canvas`)。
2. 將所有卡片內容轉換為 `.md` 檔案。
3. 圖片卡片的圖片**下載為檔案**一併放入。
4. 打包上述檔案為 `.zip` 供下載。
5. **單向匯出**，不支援匯入（避免資料模型被 Obsidian schema 限制）。

### 收件匣 (Inbox)（登入使用者限定）

1. **單一收件匣**，可選擇性標記**目標白板**（篩選用，不是歸屬關係）。
2. UI 位於**側邊欄**，支援依目標白板篩選（全部 / 特定白板 / 未分類）。
3. 卡片可從收件匣**拖曳至白板**，拖入後從收件匣移除。

---

## Phase 2: Chrome 剪藏外掛 (Extension)（需登入）

### 內容擷取

1. 選取網頁文字後，透過右鍵選單或快捷鍵發送內容。
2. 自動擷取當前網頁的 URL 與 Title 作為來源標註。

### 剪藏目的地

1. 剪藏內容送至**收件匣**，可選擇性標記**目標白板**（Phase 2 初版不標記，後續加白板選擇器）。

### 通訊方式

1. Extension 直接透過 Supabase client SDK 寫入 `inbox_items`（使用者已登入狀態，RLS 保護）。

---

## Phase 3: 進階功能 (Nice to have)

1. **AI 輔助排版**：整合 LLM API（使用者自帶 Google Gemini API Key），對卡片進行自動**空間排版** + **建議連線關係**。
2. **圖片剪藏**：Chrome Extension 支援剪藏網頁圖片，建立圖片卡片。Extension 下載外部圖片後重新上傳至 Supabase Storage（確保持久性），下載失敗時保留外部 URL 作為 fallback。

---

## 技術深度重點 (Engineering Depth Goals)

> 此專案的目標不只是功能完成，而是在實作中展示前端工程的技術深度。以下列出每個功能對應的技術挑戰，作為實作時的指引。

### 畫布渲染與效能

1. 使用 **Canvas API** 渲染畫布（而非純 DOM），展示效能意識。
2. 大量卡片時實作 **Viewport Culling**：只渲染可視區域內的元素。
3. Pan/Zoom 涉及**座標系轉換**（螢幕座標 ↔ 畫布座標）。

### 狀態管理與歷史紀錄

1. Undo/Redo 採用 **Command Pattern**（而非 Immutable 快照），支援操作的序列化與批次操作。
   - 白板操作集有限且反向邏輯明確（建立↔刪除、移動↔移回、變更↔還原），適合逐一實作 Command。
   - 狀態包含大量卡片位置、內容與連線，**快照成本高**；Command 只記錄差異，記憶體效率更佳。
   - Command 可序列化為 JSON，與 **Offline-first 同步架構**（IndexedDB → Supabase）天然契合。
   - 框選多卡片拖曳等批次操作以 **CompositeCommand** 包裝，undo 時反向順序一次還原。
2. 複雜的拖曳、群組、連線操作採用**自訂狀態機 (State Machine)**（而非 XState）。
   - 同一個滑鼠動作在不同狀態下代表不同行為（如 mouseDown 在空白處是框選、在卡片上是拖曳），狀態機強制定義合法路徑，未定義的事件自動忽略，避免 if-else 爆炸。
   - 白板互動狀態約 6-8 個（idle / dragging / resizing / editing / connecting / box-selecting / panning），規模適合自訂。
   - 以 `Record<State, Record<Event, State>>` 表達，約 50-80 行，與 Zustand 整合直接，不需要處理 XState 與 Zustand 之間的同步。

### 圖片處理

1. 圖片上傳時進行**格式檢查**（type, size）與**客戶端壓縮**（降低傳輸成本）。
2. 圖片處理（壓縮、格式轉換）放到 **Web Worker**，避免阻塞主線程。

### 離線架構與資料同步

1. **Offline-first** 架構：所有操作先寫入 IndexedDB，再背景同步至 Supabase。
2. 設計明確的 **Cache Invalidation** 策略（何時從 server 拉新資料、何時信任本地快取）。
3. 離線期間的編輯需有 **Conflict Resolution** 機制（如 last-write-wins 或 operational transform）。

### 檔案匯出

1. zip 打包放到 **Web Worker** 執行，避免大量檔案時凍結 UI。
2. Markdown 與 `.canvas` JSON 的**格式轉換邏輯**需處理邊界情況（空卡片、斷開的連線等）。

### AI 功能與 Streaming

1. AI 排版結果透過 **SSE (Server-Sent Events)** streaming 回傳，展示 event streaming 實作。
2. 前端需處理 streaming 的**漸進式渲染**（排版結果逐步呈現，而非等待全部完成）。

### Chrome Extension 通訊

1. Extension 與 Web App 之間的**跨 context 通訊**（Background Script → Content Script → Web App）。
2. 處理認證狀態傳遞與 token 管理。
