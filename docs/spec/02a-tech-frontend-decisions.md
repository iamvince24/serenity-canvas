# 前端技術選型紀錄 (Decision Log)

## ADR-001: 白板引擎選擇

**日期**：2025-02-14
**狀態**：已決定

### 背景

功能需求 (`01-features.md`) 明確要求：

- 使用 **Canvas API** 渲染畫布（而非純 DOM），展示效能意識
- 實作 Viewport Culling、座標系轉換等技術深度目標

需要選擇一個符合此目標的白板引擎方案。

### 候選方案

| 方案                          | 說明                     | 優勢                                           | 劣勢                                                     |
| ----------------------------- | ------------------------ | ---------------------------------------------- | -------------------------------------------------------- |
| **A. React Flow**             | DOM-based 節點編輯庫     | 開發快、生態好、文件完整                       | 非 Canvas 渲染，不符合技術深度目標                       |
| **B. 純 Canvas API**          | 從零自幹所有渲染與互動   | 最大技術展示空間                               | 開發成本極高，hit test / 重繪管理 / 文字斷行都要自己處理 |
| **C. Konva.js + react-konva** | Canvas 2D scene graph 庫 | 基於 Canvas API、內建事件與拖曳、有 React 綁定 | 客製渲染偶爾需回到 raw Canvas                            |
| **D. Pixi.js**                | WebGL 2D 渲染引擎        | 效能極佳                                       | 偏遊戲/動畫場景，白板應用殺雞用牛刀                      |

### 決定

選擇 **C. Konva.js + react-konva**。

### 理由

1. **符合技術目標**：底層仍是 `<canvas>` 渲染，Viewport Culling 和座標轉換仍需自己實作，技術深度不打折。
2. **合理的開發效率**：拖曳、hit test、事件系統由 Konva 處理，省下的時間可投入 Command Pattern、狀態機、離線同步等其他技術亮點。
3. **混合架構可行**：富文字編輯（Tiptap）以 DOM overlay 疊在 Canvas 上層，這是業界常見做法。
4. **純 Canvas API 的痛點太多**：重繪管理、連線碰撞偵測、文字斷行等底層問題會消耗大量時間，投報比低。

### 架構示意

```
┌─ React (UI Layer) ──────────────────┐
│  Toolbar / Sidebar / Inbox          │
│                                     │
│  ┌─ react-konva (Canvas Layer) ──┐  │
│  │  Stage → Layer → 卡片/連線     │  │
│  │  Viewport Culling (自己實作)   │  │
│  │  座標轉換 (自己實作)           │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌─ DOM Overlay ─────────────────┐  │
│  │  Tiptap 編輯器 (編輯態疊上去)  │  │
│  └───────────────────────────────┘  │
│                                     │
│  Zustand (State) → Command History  │
└─────────────────────────────────────┘
```

---

## ADR-002: Markdown 編輯器選擇

**日期**：2025-02-14
**狀態**：已決定

### 候選方案

| 方案         | 優勢                                       | 劣勢               |
| ------------ | ------------------------------------------ | ------------------ |
| **Tiptap**   | 社群大、文件完整、React 整合成熟、擴充性強 | 較重               |
| **Milkdown** | 輕量、Markdown-first 設計                  | 社群較小、文件較少 |

### 決定

選擇 **Tiptap**。

### 理由

1. 需要以 DOM overlay 方式疊在 Canvas 上進行編輯，Tiptap 與 React 的整合更成熟穩定。
2. 社群資源豐富，遇到問題容易找到解法。
3. 未來如需擴充（如嵌入程式碼區塊、待辦清單等），Tiptap 的 extension 生態更完整。

---

## ADR-003: 圖片儲存與顯示機制

**日期**：2025-02-14
**狀態**：已決定

### 背景

圖片卡片需要處理上傳、儲存、顯示三個環節，且登入與未登入使用者的儲存後端不同。

### 決定

依使用者狀態採取不同策略：

**登入使用者**：

- 壓縮後上傳至 Supabase Storage（**Private bucket**），IndexedDB 只存檔案路徑（策略 B）
- 顯示時透過 signed URL 載入（有效期 1 小時），前端自動管理 URL 快取與過期刷新
- 未來可升級為下載後快取 Blob 至 IndexedDB（策略 A），改動成本低

**未登入使用者**：

- 壓縮後存 Blob 至 IndexedDB（沒有其他儲存選項）
- 設定限制：圖片數量上限與總容量上限（具體數值實作時決定）

**分片上傳**：不實作。壓縮後圖片預期在 1MB 以內，單次上傳即可。

### 上傳流程

```
使用者拖入/選擇圖片
  → 前置檢查（格式：JPEG/PNG/WebP、大小上限）
  → Web Worker 壓縮（browser-image-compression）
  → 儲存
     ├─ 未登入：Blob → IndexedDB（檢查是否超出限制）
     └─ 登入：上傳至 Supabase Storage → URL 存入資料庫
```

### 顯示流程

```
畫布渲染圖片卡片
  ├─ 未登入：IndexedDB Blob → Object URL → Konva Image
  └─ 登入：檔案路徑 → 取 signed URL（快取未過期直接用）→ Konva Image
```

### 理由

1. **先求簡單**：策略 B 實作最單純，不需要管快取 eviction 邏輯。
2. **升級路徑清晰**：B → A 只需在顯示時多一步「下載後存入 IndexedDB」，不影響現有架構。
3. **分片上傳不必要**：客戶端壓縮後檔案夠小，不值得為此增加複雜度。
4. **Private bucket**：白板內容屬於使用者私人筆記，圖片不應公開存取。Signed URL 過期後自動失效，前端透過 URL 快取層自動刷新，使用者無感。

---

## ADR-004: Undo/Redo 實作策略

**日期**：2025-02-14
**狀態**：已決定

### 背景

白板應用需要支援 Undo/Redo，涵蓋卡片的建立、刪除、移動、調整大小、編輯內容、連線操作、群組操作等。需要決定採用哪種實作模式。

### 候選方案

| 方案                                       | 說明                                                      | 優勢                                             | 劣勢                                           |
| ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| **A. Command Pattern**                     | 每個操作封裝為 Command 物件，包含 `execute()` 和 `undo()` | 只記差異、記憶體效率高；可序列化；支援語意化歷史 | 每種操作都要寫對應的 undo 邏輯                 |
| **B. Immutable 快照 + Structural Sharing** | 每次操作前存整個狀態快照，搭配 Immer 做結構共享           | 實作極簡單，不需反向邏輯                         | 狀態大時記憶體消耗高；與離線同步架構無直接關聯 |

### 決定

選擇 **A. 自製 Command Pattern**，不引入額外套件。

### 理由

1. **操作集有限且反向邏輯明確**：白板操作就那幾種（建立↔刪除、移動↔移回原位、變更↔還原舊值），不會遇到「反向邏輯難寫」的問題。
2. **狀態大、快照成本高**：畫布狀態包含所有卡片的位置、大小、Markdown 內容、圖片引用、連線、群組關係。隨卡片增加，每次操作都 clone 整個狀態不划算。Command 只記錄差異（如移動只存 fromPos / toPos）。
3. **與 Offline-first 架構契合**：Command 可序列化為 JSON，天然可作為 operation log 寫入 IndexedDB，再背景同步至 Supabase。這與 `02-tech-frontend.md` 的離線同步策略一致。
4. **批次操作自然支援**：框選多張卡片拖曳以 CompositeCommand 包裝，undo 時反向順序一次還原。
5. **不需要外部套件**：操作數量有限、結構單純，自製更可控且無額外依賴。

---

## ADR-005: 狀態機實作策略

**日期**：2025-02-14
**狀態**：已決定

### 背景

白板上同一個滑鼠動作在不同情境下代表完全不同的行為（例如 mouseDown 在空白處是框選、在卡片上是拖曳、在連接點上是拉連線）。需要一個狀態機來管理畫布的互動模式，避免條件判斷爆炸。需要決定使用 XState 還是自訂實作。

### 候選方案

| 方案                      | 說明                                                   | 優勢                                                                          | 劣勢                                                      |
| ------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| **A. XState**             | 成熟的狀態機框架，支援巢狀/平行狀態、guards、invoke 等 | 視覺化工具（Stately Editor）；內建 entry/exit actions；完整的 TypeScript 支援 | 學習成本中等、API 面積大（~45 KB）；與 Zustand 需額外同步 |
| **B. 自訂 State Machine** | 以 `Record<State, Record<Event, State>>` 定義轉換表    | 約 50-80 行即可完成；與 Zustand 直接整合；零依賴                              | 無視覺化工具；巢狀/平行狀態需自己設計                     |

### 決定

選擇 **B. 自訂 State Machine**。

### 理由

1. **規模適合自訂**：白板互動狀態約 6-8 個（idle / dragging / resizing / editing / connecting / box-selecting / panning），轉換約 15-20 條，一個轉換表就能清楚表達。
2. **不需要巢狀/平行狀態**：sidebar 開關與畫布互動是獨立的，各自管理即可，不需要 XState 的 parallel states。
3. **與 Zustand 整合更直接**：狀態機的 current state 直接放在 Zustand store 裡，不需要處理 XState actor 與 Zustand 之間的同步問題。
4. **零依賴**：對一個 50-80 行能解決的問題，不值得引入 ~45 KB 的框架和它的學習曲線。
5. **展示工程理解**：自己實作狀態機更能展示對此模式的理解，而非僅會使用套件。
6. **升級路徑存在**：若未來狀態複雜度暴增（超過 15 個狀態、需要深層巢狀），概念相通，遷移到 XState 不難。

---

## ADR-006: SSE / Streaming 處理

**日期**：2025-02-14
**狀態**：已決定

### 背景

Phase 3 AI 排版功能需要前端接收 Google Gemini API 的 streaming 回應，即時顯示排版建議。需要決定 SSE / Streaming 的接收方案。

後端預計使用 Supabase Edge Function 作為 Gemini API 的中繼層，前端需帶 Supabase Auth JWT 與使用者的 Gemini API Key（從 localStorage 讀取，透過 `X-Gemini-Api-Key` header 帶上）呼叫 Edge Function。

### 候選方案

| 方案                              | 說明                                         | 優勢                                                                  | 劣勢                                                                                                                               |
| --------------------------------- | -------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **A. 原生 EventSource**           | 瀏覽器內建 SSE API                           | 零依賴、自動重連                                                      | 只支援 GET、無法帶自訂 Header（無法帶 Authorization）                                                                              |
| **B. fetch + eventsource-parser** | fetch 取得 ReadableStream，套件解析 SSE 格式 | 支援 POST + 自訂 Header；eventsource-parser 只做解析（~3 KB）、無依賴 | 重連邏輯需自己處理                                                                                                                 |
| **C. Vercel AI SDK (`ai`)**       | 提供 `useChat`、`streamText` 等 React hook   | 全包（streaming 狀態、abort、錯誤處理）                               | 使用自訂協議格式（非標準 SSE）；前後端需都用其 SDK；設計偏向 Next.js 生態，與 Supabase Edge Function（Deno runtime）整合需額外適配 |

### 決定

選擇 **B. `fetch` + `eventsource-parser`**。

### 理由

1. **EventSource 直接排除**：只支援 GET 且無法帶 `Authorization` header，與 Supabase Auth 不相容。
2. **後端不在 Vercel 生態**：後端是 Supabase Edge Function（Deno runtime），不是 Next.js API Route。Vercel AI SDK 的 `useChat` 預期搭配其 `streamText` 後端，使用自訂協議格式（`0:` 文字 / `e:` metadata / `d:` 結束），硬接 Edge Function 反而要額外適配。
3. **只有單一功能需要 streaming**：Phase 3 AI 排版是特定功能，不是整個 App 都在做 chat，不需要一整套 chat framework。
4. **eventsource-parser 職責單一**：只解析標準 SSE 格式（`data:` 行），處理 buffer 拆行與不完整 chunk 等邊界情況，~3 KB 無依賴。
5. **不被綁定**：使用標準 SSE 格式，後端可以是任何能輸出 `text/event-stream` 的服務，未來遷移零成本。

### 前端接收流程

```
fetch(Edge Function URL, { method: 'POST', headers: { Authorization: Bearer JWT, X-Gemini-Api-Key: key } })
    │
    ▼
response.body (ReadableStream)
    │
    ▼
reader.read() → TextDecoder → 餵入 eventsource-parser
    │
    ▼
parser 回傳結構化事件 → 提取 delta content → 更新 React 狀態 → UI 即時顯示
```

---

## ADR-007: Chrome Extension 開發框架

**日期**：2025-02-14
**狀態**：已決定

### 背景

Phase 2 Chrome 剪藏功能需要開發 Chrome Extension，涵蓋 Content Script（偵測選取文字）、Background Service Worker（右鍵選單、API 呼叫）、Popup（選擇目的地）。需要決定使用什麼框架開發。

### 候選方案

| 方案                    | 說明                                           | 優勢                                                                     | 劣勢                                                     |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| **A. 原生 Manifest V3** | 直接使用 Chrome API，自己管理打包              | 零抽象、完全掌控、產出最小                                               | 無 HMR、樣板多、多入口打包需自己配、跨瀏覽器需自己處理   |
| **B. Plasmo**           | Convention-over-Configuration 框架，檔名即功能 | CSUI + Shadow DOM 開箱即用、`@plasmohq/messaging` 型別安全、開發速度最快 | 只支援 React、抽象層厚 debug 困難、框架耦合高、打包較大  |
| **C. WXT**              | Vite-based 框架，框架無關                      | 基於 Vite（與 Web App 一致）、框架無關、跨瀏覽器開箱即用、抽象層適中     | Content Script UI 比 Plasmo 稍繁瑣、Messaging 需自己封裝 |

### 決定

選擇 **C. WXT**。

### 理由

1. **技術棧一致**：Web App 使用 React + Vite，WXT 基於 Vite 且框架無關，開發體驗一致、共享 Vite plugin 生態。
2. **抽象層適中**：保留足夠的底層控制權，能展示 spec 中要求的「跨 context 通訊」和「Token 管理」等技術深度目標。Plasmo 把這些全部包掉，反而失去展示空間。
3. **跨瀏覽器支援**：`pnpm wxt build -b firefox` 一條指令切換，不需額外處理 API 差異。原生 MV3 需要自己處理 `chrome.*` vs `browser.*`。
4. **Content Script UI 控制權**：WXT 的 `createShadowRootUi` 比 Plasmo 的自動掛載更明確——你控制 mount/unmount 的時機和條件，適合白板選擇器這種「有條件顯示」的 UI。
5. **不綁定 React**：雖然目前使用 React，但 WXT 支援 Vue/Svelte/Vanilla，保留未來彈性。
6. **原生 MV3 的 ROI 不高**：manifest 管理、多入口打包、HMR 配置等樣板工作消耗時間，對技術展示沒有加分。

### 排除 CRXJS 的理由

原先 `04-tech-extension.md` 選用 CRXJS（Vite Plugin），但經評估後改為 WXT：

- CRXJS 社群維護不活躍，MV3 支援不完整
- WXT 提供更完整的開發體驗（自動 manifest、跨瀏覽器、內建 storage utility）
- WXT 社群成長快，文件品質高

---

## ADR-008: Chrome Extension 認證策略

**日期**：2025-02-14
**狀態**：已決定

### 背景

Extension 和 Web App 是不同的 origin，無法直接共享 cookie 或 localStorage。需要設計一個機制讓 Extension 取得有效的 Supabase session，以呼叫後端 API 進行剪藏。

### 候選策略

| 策略                             | 說明                                                                    | 優勢                                 | 劣勢                                                                             |
| -------------------------------- | ----------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| **A. Web App 主動同步 Token**    | Web App 登入後透過 `chrome.runtime.sendMessage` 將 token 傳給 Extension | 使用者只登入一次、體驗最好           | 依賴 Web App 開啟；token refresh 需 Web App 負責同步                             |
| **B. Extension 獨立 PKCE OAuth** | Extension Popup 啟動 OAuth flow，callback 頁面回傳 auth code            | Extension 獨立運作、安全性高（PKCE） | 使用者可能需登入兩次；實作較複雜（callback 頁面）                                |
| **C. launchWebAuthFlow**         | 使用 `chrome.identity.launchWebAuthFlow` 在 Extension 內完成 OAuth      | 不需 Web App 參與                    | Chrome only、redirect URL 格式特殊需 Supabase 後台設定、implicit flow 安全性較低 |

### 決定

採用 **A + B 混合策略**：Web App 同步為主要路徑，Extension 獨立 OAuth 為 fallback。

### 理由

1. **覆蓋所有使用場景**：
   - 先登入 Web App 再用 Extension → 策略 A 自動同步，使用者無感
   - 先裝 Extension 沒開 Web App → 策略 B，Popup 提供登入按鈕
   - Web App 未開啟時 token 過期 → Extension 自己 refresh，若失敗則引導重新登入（策略 B）
2. **安全性**：策略 B 使用 PKCE flow，符合 OAuth 2.1 最佳實踐。策略 A 的 token 傳輸透過 `externally_connectable` 白名單限制來源。
3. **排除策略 C**：`launchWebAuthFlow` 只支援 Chrome，且 redirect URL 格式特殊（`https://<ext-id>.chromiumapp.org/`），需要在 Supabase 後台和 Google OAuth 設定中額外配置，維護成本高。此外 implicit flow 不如 PKCE 安全。

### Token 管理要點

1. **Storage Adapter**：MV3 Service Worker 沒有 localStorage，Supabase client 必須使用 `chrome.storage.local` 作為持久化層。
2. **自動刷新**：Service Worker 會被休眠，不能用 `setInterval`。使用 `chrome.alarms`（每 4 分鐘）檢查 token 是否即將過期。
3. **跨 Context 狀態同步**：認證狀態以 WXT `storage.defineItem` 定義，popup / content-ui / background 都能透過 `watch()` 即時監聽變化。

### 詳細規格

見 `04a-tech-extension-auth.md`。

---

## ADR-009: 部署平台選擇

**日期**：2025-02-14
**狀態**：已決定

### 背景

Web App 需要選擇一個部署平台。本專案為 React + Vite SPA，後端邏輯（Auth、DB、SSE streaming）全部由 Supabase 處理，部署平台只需負責靜態資產的託管與分發。

### 候選方案

| 方案                    | 說明                                              | 優勢                                                                                                    | 劣勢                                                                 |
| ----------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **A. Vercel**           | 前端部署平台，Preview Deployments、Edge Functions | DX 極佳（push to deploy、自動 PR preview）；Turborepo monorepo 整合最成熟；免費方案對 side project 足夠 | Serverless Function 執行時間限制（Hobby 10 秒）；Vendor lock-in 中等 |
| **B. Cloudflare Pages** | 基於 Cloudflare CDN 的靜態部署                    | 免費方案更慷慨（無限請求/頻寬）；Workers 冷啟動趨近 0；全球 CDN 節點最多                                | Workers 運行環境非 Node.js，部分 npm 套件不相容；DX 稍遜於 Vercel    |
| **C. Netlify**          | 前端部署平台，功能與 Vercel 類似                  | Preview Deploy 成熟；Netlify Functions（AWS Lambda）                                                    | 相較 Vercel 無明顯差異化優勢；建置速度與 DX 略遜                     |

### 決定

選擇 **A. Vercel**。

### 理由

1. **純靜態部署，限制不影響**：本專案 SSE streaming 走 Supabase Edge Functions，Vercel 只負責 serve 靜態檔案（HTML/JS/CSS），Serverless Function 執行時間限制完全不影響。
2. **Monorepo 整合最成熟**：Web App + Chrome Extension 共存於 monorepo，Vercel 對 Turborepo 的支援最完整（自動偵測 workspace、只建置變更的 package）。
3. **DX 優先**：Side project 階段，開發體驗和上手速度比成本優化重要。Vercel 的 push to deploy、PR preview 等功能減少摩擦力。
4. **遷移成本低**：因為是純靜態部署，未來如有效能或成本需求，遷移到 Cloudflare Pages 幾乎無成本。

### 架構示意

```
瀏覽器 → Vercel CDN          → 靜態資產（HTML/JS/CSS）
瀏覽器 → Supabase            → Auth / DB / Realtime
瀏覽器 → Supabase Edge Fn    → SSE streaming（AI 功能）
```

---

## ADR-010: CI/CD 與程式碼品質策略

**日期**：2025-02-14
**狀態**：已決定

### 背景

Monorepo（Web App + Chrome Extension）需要自動化的程式碼品質檢查與部署流程。需要決定在哪個環節跑哪些檢查，以及使用什麼工具。

### 決定

採用**兩層防護**架構：

1. **Husky + lint-staged（本機，pre-commit）**：只跑快速檢查（Prettier + ESLint），針對 staged 檔案，2-3 秒完成
2. **GitHub Actions（雲端，push/PR）**：跑完整檢查（tsc + ESLint 全量 + Build + Unit Test）
3. **Vercel CD**：merge 到 main 自動部署，PR 自動產生 Preview URL

### 工具選擇

| 工具               | 用途                   |
| ------------------ | ---------------------- |
| Husky              | 管理 Git hooks         |
| lint-staged        | 只對 staged 檔案跑檢查 |
| Prettier           | 格式化                 |
| ESLint             | Lint                   |
| commitlint（可選） | Commit message 規範    |
| GitHub Actions     | CI pipeline            |
| Vercel             | CD（自動）             |

### 理由

1. **Husky 和 CI 互補而非替代**：Husky 提供即時回饋（commit 時），CI 提供最終防線（push 後）。只有 Husky 可以被 `--no-verify` 跳過；只有 CI 則回饋太慢。
2. **Husky 只跑快的**：型別檢查（5-15 秒）和完整測試放在 CI，避免 commit 卡住導致開發者養成跳過的習慣。
3. **分階段導入**：開專案先設定基本檢查（tsc + ESLint + Build），測試和 E2E 等到有測試程式碼後再加入。
4. **不做多瀏覽器 / 多 Node 版本矩陣**：Side project 規模不需要，部署平台（Vercel）版本固定。

### 詳細規格

見 `05a-tech-cicd.md`。

---

## ADR-011: Monorepo 管理策略

**日期**：2026-02-14
**狀態**：已決定

### 背景

專案有兩個獨立產出物：Web App（Phase 1）與 Chrome Extension（Phase 2），需要決定是否使用 monorepo 以及使用什麼工具管理。

### 候選方案

| 方案                               | 說明                                                                      | 優勢                                                                      | 劣勢                                                         |
| ---------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **A. 兩個獨立 repo**               | Web App 和 Extension 各自一個 repo                                        | 完全獨立、互不影響                                                        | 共用程式碼需發 npm package 或複製貼上；型別不同步時 bug 難追 |
| **B. pnpm workspaces + Turborepo** | pnpm 管依賴隔離，Turborepo 管任務快取與平行化                             | 嚴格依賴隔離（無幽靈依賴）；快取 + 平行化；學習成本低；與 Vercel 整合最好 | 需要額外設定 `turbo.json` 和 workspace 結構                  |
| **C. Nx**                          | 全功能 monorepo 框架（任務編排 + 程式碼產生器 + 依賴圖分析 + 外掛生態系） | 功能最完整；受影響分析省 CI 時間；程式碼產生器統一規範                    | 學習成本高；框架侵入性強；專案規模不需要                     |

### 決定

選擇 **B. pnpm workspaces + Turborepo**，但 **Phase 1 不拆 monorepo，Phase 2 開始做 Extension 時再拆**。

### 理由

**為什麼需要 monorepo？**

1. 兩個應用會共用：Supabase client 設定與型別定義、認證邏輯、資料模型的 TypeScript 型別（Card、Board、InboxItem 等）。
2. 不用 monorepo 的話，共用程式碼只能複製貼上或發 npm package，改一個型別定義要去兩個 repo 各改一次，型別不同步時 bug 很難追。

**為什麼選 pnpm workspaces + Turborepo？**

1. **pnpm workspaces**：嚴格依賴隔離（無幽靈依賴問題）、磁碟效率最佳（全域 content-addressable store 去重）、安裝速度最快。詳見 [[三種 Workspaces 比較（npm vs yarn vs pnpm）]]。
2. **Turborepo**：學習成本低、侵入性低（一個 `turbo.json` 搞定）；智慧快取 + 平行化已足夠；是 Vercel 的產品，與部署平台整合最好。詳見 [[Monorepo 管理工具比較]]。
3. **不選 Nx**：專案規模不大（2 個應用 + 少量共用 package），Nx 的程式碼產生器和外掛系統用不到，屬於過度工程。

**為什麼 Phase 1 先不拆？**

1. Phase 1 只有 Web App 一個應用，沒有共用程式碼的需求。
2. 從單一專案拆成 monorepo 成本很低（把共用檔案搬到 `packages/shared/`、加幾個設定檔），不需要提前搭架構。
3. **拆分時機判斷**：當開始做 Extension 並發現自己在「複製貼上型別定義」或「兩邊同步改同一份程式碼」時，就是該拆的時候。

---

## ADR-012: DOM Overlay 編輯時的縮放行為

**日期**：2026-02-15
**狀態**：已決定

### 背景

白板採用 Canvas（Konva.js）+ DOM Overlay（Tiptap）的混合架構。當使用者雙擊卡片進入文字編輯模式時，Tiptap 編輯器以絕對定位的 DOM 元素疊在 Canvas 上層。需要決定這個 DOM Overlay 是否跟隨畫布的 zoom 等比例縮放。

### 候選方案

| 方案                  | 說明                                               | 優勢                                                                         | 劣勢                                                               |
| --------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **A. 跟隨 zoom 縮放** | 編輯器的位置、尺寸、字體大小都乘以 `viewport.zoom` | 所見即所得，編輯態與顯示態視覺一致；符合白板心智模型（縮小看全局、放大編輯） | zoom 太小時文字難以閱讀和編輯                                      |
| **B. 不跟隨 zoom**    | 編輯器保持固定的可讀尺寸，僅位置對齊畫布座標       | 任何 zoom 下都能舒適編輯                                                     | 編輯態與顯示態視覺不一致；退出編輯後文字「跳回」縮放狀態，體驗突兀 |

### 決定

選擇 **A. 跟隨 zoom 縮放**。

### 理由

1. **符合白板心智模型**：Figma、Excalidraw 等主流白板工具都採用此做法。縮小時看到更多內容、放大時進入編輯，使用者已有預期。
2. **視覺一致性**：編輯態和顯示態的文字大小、卡片尺寸完全一致，不會產生「跳動」感。
3. **zoom 過小的問題可用 guard condition 解決**：zoom 低於閾值（如 `< 0.3`）時，狀態機禁止進入 editing 狀態，改為觸發 zoom-to-fit 該卡片。這是一條狀態機轉換規則，不需要額外的縮放邏輯。

### 實作要點

**DOM Overlay 定位公式**（畫布座標 → 螢幕座標）：

```typescript
const overlayStyle: CSSProperties = {
  position: "absolute",
  left: element.x * viewport.zoom + viewport.x,
  top: element.y * viewport.zoom + viewport.y,
  width: element.width * viewport.zoom,
  height: element.height * viewport.zoom,
  fontSize: baseFontSize * viewport.zoom,
};
```

**zoom 過小時的 guard condition**（與 ADR-005 狀態機整合）：

```typescript
// 狀態機轉換表中的 guard
const transitions = {
  idle: {
    DOUBLE_CLICK_CARD: (ctx) =>
      ctx.viewport.zoom >= MIN_EDIT_ZOOM // 例如 0.3
        ? "editing"
        : "zooming_to_card", // 先 zoom-to-fit 再自動進入編輯
  },
  // ...
};
```

**平移/縮放期間的 overlay 同步**：

viewport 變化時，overlay 位置必須即時更新。由於 overlay style 直接引用 Zustand 中的 `viewport` 狀態，React 會在 viewport 變更時自動觸發重新渲染，無需額外同步機制。

---

## ADR-013: Viewport Culling（視口剔除）策略

**日期**：2026-02-15
**狀態**：已決定

### 背景

畫布可能包含數百個元素，但使用者同一時間只看到其中一部分。需要決定如何只渲染視口內的元素以確保效能，以及是否引入空間索引加速查詢。

### 決策 1：Culling 的執行方式

#### 候選方案

| 方案                          | 說明                                                      | 優勢                                   | 劣勢                                                           |
| ----------------------------- | --------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| **A. React 條件渲染**         | 視口外的元素不出現在 React tree 中，完全不建立 Konva node | 記憶體使用最低；Konva scene graph 最小 | 快速平移時元素可能「突然出現」（用 Padding 緩解）              |
| **B. 全掛載，切換 `visible`** | 所有 Konva node 常駐，用 `visible` prop 控制是否繪製      | 不會有元素突然出現的問題               | 1000+ 元素時 React reconciliation 成本高；所有 node 常駐記憶體 |

#### 決定

選擇 **A. React 條件渲染**。

#### 理由

1. **效能更好**：視口外的元素完全不進入 Konva scene graph，省下 node 建立和 React diff 的成本。
2. **目標場景適用**：數百到低千量級元素，正好落在條件渲染能發揮最大效益的區間。
3. **「突然出現」問題已有成熟解法**：在視口四邊各加 100px Padding 緩衝區，預先渲染即將進入螢幕的元素，平移時不會閃爍。
4. **搭配 `useShallow` 避免多餘重渲染**：平移時 viewport 每秒變化 60 次，但可見元素集合不一定改變。`useShallow` 逐一比對 id 陣列內容，只有集合真正改變時才觸發 React 重渲染。

### 決策 2：空間索引的引入時機

#### 候選方案

| 方案                                 | 說明                              | 優勢                                 | 劣勢                                                                              |
| ------------------------------------ | --------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| **A. Phase 1 就引入 R-tree**         | 使用 `rbush` 等函式庫建立空間索引 | 查詢 O(log n)，元素多時效能更好      | 每次元素變化（移動、新增、刪除、Undo/Redo）都要同步更新索引；多一份資料結構要維護 |
| **B. Phase 1 線性 filter，預留介面** | 逐一檢查每個元素是否在視口內      | 實作極簡單（~10 行）；不需要額外維護 | 元素超過 500 個時每幀耗時 > 1ms                                                   |

#### 決定

選擇 **B. Phase 1 線性 filter，預留介面**。

#### 理由

1. **效益不成比例**：Phase 1 目標不超過 200 個元素，線性 filter 每幀 < 0.2ms，與空間索引的 < 0.05ms 在使用者感受上無任何差異。
2. **維護成本是真正的負擔**：空間索引不只是「建立一次」，每次拖曳、新增、刪除、調整大小、Undo/Redo 都要同步更新索引，是每個操作都多一個要處理的地方。
3. **升級路徑清晰**：culling 邏輯封裝為獨立函式 `getVisibleElementIds`，日後只換內部實作即可，呼叫端完全不用改。
4. **引入時機明確**：當元素數量超過 500、或 profiling 顯示 culling 成為瓶頸時，就是該升級的時候。

### 決策 3：連線（Edges）的 Culling 方式

#### 決定

以連線兩端點座標構成的**外接矩形**做判定，只要這個矩形與視口重疊就渲染該連線。

#### 理由

1. **解決穿越問題**：連線兩端卡片可能都在視口外，但線段穿越視口。只看端點會漏掉這種情況，外接矩形不會。
2. **簡單有效**：可能偶爾多渲染幾條實際看不到的線（矩形與視口重疊但線段沒穿過），但多畫幾條線的成本可忽略。
3. **不需要精確的線段-矩形相交測試**：那種演算法更複雜，且節省的渲染量極少，不值得。
