# 後端技術選型紀錄 (Decision Log)

## ADR-B01: 後端架構模式

**日期**：2026-02-15
**狀態**：已決定

### 背景

前端已選定 Supabase 作為後端服務（Auth + DB + Realtime + Storage），需要決定是否在 Supabase 之上再建一層自訂 API server。

### 候選方案

| 方案                                    | 說明                                                                                                              | 優勢                                                 | 劣勢                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| **A. Supabase-only（前端直連）**        | 前端透過 `@supabase/supabase-js` 直接操作 DB（PostgREST），資料隔離靠 RLS，少數 server-side 邏輯用 Edge Functions | 最簡單、開發最快、Phase 1 不需維護額外服務           | 業務邏輯分散在前端 + RLS policy + database functions |
| **B. 中間加一層 API（Hono / Express）** | 前端 → 自建 API → Supabase，API 層用 Supabase Admin SDK 操作 DB                                                   | 集中業務邏輯、方便加 rate limiting / 複雜驗證 / 日誌 | 多一層維護成本，Phase 1 場景可能過度工程             |

### 決定

選擇 **A. Supabase-only（前端直連）**。

### 理由

1. **Phase 1 業務邏輯極其單純**：本質就是 per-user CRUD（白板、卡片、連線、群組、收件匣），沒有跨使用者互動、沒有複雜的業務規則。RLS 一句 `auth.uid() = user_id` 就能覆蓋所有資料隔離需求。
2. **專案技術深度目標在前端**：`01-features.md` 明確列出的技術亮點（Canvas 渲染、Viewport Culling、Command Pattern、State Machine、Web Worker、離線同步）全部在前端。後端不是這個專案要展示的重點，投資在自建 API layer 的 ROI 不高。
3. **逐 Phase 檢視，沒有一個 Phase 必須自建 API**：
   - Phase 1 CRUD → PostgREST + RLS
   - Phase 1 圖片上傳 → Supabase Storage
   - Phase 1 離線同步 LWW → 前端比較 timestamp + upsert
   - Phase 2 Extension 剪藏 → Extension 直接用 Supabase client SDK 寫入
   - Phase 3 AI SSE proxy → Supabase Edge Function（唯一需要 server-side 的地方，一個 function 就夠）
4. **選 B 的理由目前不成立**：
   - Rate limiting → Supabase 本身有基礎限制，個人專案不需要細粒度控制
   - 複雜驗證 → CRUD 的驗證用 DB constraints + RLS 足夠
   - 集中日誌 → Supabase Dashboard 已有查詢日誌
5. **未來不會被鎖死**：如果之後真的需要自建 API（如加了多人協作），可以隨時加。RLS policies 不用拆，只是多一個入口。

### 架構示意

```
瀏覽器 (React SPA)
  │
  ├─► Supabase Auth          → 認證（Google OAuth / Email）
  ├─► Supabase PostgREST     → CRUD（boards / nodes / edges / groups / inbox）
  │   └── RLS 強制資料隔離     auth.uid() = user_id
  ├─► Supabase Storage       → 圖片上傳 / 下載（private bucket + signed URL）
  └─► Supabase Edge Function → AI SSE proxy（Phase 3）

Chrome Extension
  └─► Supabase PostgREST     → 剪藏寫入（Phase 2，使用相同 auth token）
```

### 風險與緩解

| 風險                        | 緩解措施                                                        |
| --------------------------- | --------------------------------------------------------------- |
| RLS policy 寫錯導致資料外洩 | 撰寫 RLS 測試（用不同 user context 驗證存取）                   |
| 業務邏輯分散不好維護        | 前端將 Supabase 操作封裝在 repository 層，不散落在 component 中 |
| 未來需要自建 API 時遷移成本 | Repository 層抽象了資料存取，換底層實作不影響上層               |

---

## ADR-B02: Database Schema 設計決策

**日期**：2026-02-15
**狀態**：已決定

### 背景

需要定義 Supabase PostgreSQL 的資料表結構。涉及多個設計選擇：nodes 的 polymorphic 設計、groups 與 nodes 的關聯方式、edges 的方向表達、表名統一、以及 inbox_items 拖入白板後的處理。完整 schema 見 `06-data-model.md`。

### 決策 1：nodes 單表 vs. 分表

#### 候選方案

| 方案                      | 說明                                                           | 優勢                                                                             | 劣勢                                                                                                  |
| ------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **A. 單表 + `type` 欄位** | 一張 `nodes` 表，圖片卡片的 `image_path` 填值、文字卡片留 null | 查詢簡單（Culling、匯出、連線都查一張表）；前端用 discriminated union 做型別區分 | 圖片卡片獨有欄位對文字卡片來說是冗餘的 null                                                           |
| **B. 分表**               | `text_nodes` 和 `image_nodes` 各一張表                         | 欄位更嚴謹，無 nullable 冗餘                                                     | 連線的 `from_node` / `to_node` 需指向兩張表（polymorphic FK）；Culling 查詢需 UNION；匯出需合併兩張表 |

#### 決定

選擇 **A. 單表 + `type` 欄位**。

#### 理由

1. **差異極小**：文字卡片與圖片卡片的欄位差異僅 `image_path` 一個欄位，分表帶來的「嚴謹性」收益遠小於查詢複雜度的成本。
2. **Viewport Culling 效能**：單表查詢只要一句 `SELECT`，分表需要 `UNION ALL`，在頻繁的 culling 場景中不划算。
3. **連線關聯簡單**：edges 的 `from_node` / `to_node` 直接指向同一張表，不需要 polymorphic FK。
4. **前端型別安全不受影響**：TypeScript discriminated union 可以在型別層面強制 `type: 'image'` 時 `image_path` 必填。

### 決策 2：groups 與 nodes 的關聯

#### 候選方案

| 方案                                  | 說明                                | 優勢                   | 劣勢                     |
| ------------------------------------- | ----------------------------------- | ---------------------- | ------------------------ |
| **A. `group_id` 放在 nodes 上**       | 每個 node 有 `group_id`（nullable） | 查詢最簡單             | 一張卡片只能屬於一個群組 |
| **B. Junction table `group_members`** | 多對多關聯表                        | 一張卡片可屬於多個群組 | 多一張表、查詢需 JOIN    |

#### 決定

選擇 **B. Junction table `group_members`**。

#### 理由

1. **實際需求是多對多**：一張卡片可能同時屬於多個群組（例如按主題分組時有交集）。
2. **Junction table 的查詢成本可接受**：`JOIN` 在 PostgreSQL 中是基本操作，group_members 表資料量小，不會有效能問題。
3. **RLS 透過 JOIN groups 表驗證 ownership**：`group_members` 本身不需要 `user_id`，透過 `EXISTS (SELECT 1 FROM groups WHERE ...)` 即可確認。

### 決策 3：edges 的箭頭方向表達

#### 決定

使用單一 `direction` 欄位（`text` + CHECK constraint），值為 `'none'` / `'forward'` / `'both'`。

#### 理由

1. **需求只有三種狀態**：無箭頭、單向（from → to）、雙向。一個欄位就夠，不需要 `from_end` + `to_end` 兩個欄位。
2. **匯出時轉換簡單**：`direction` → Obsidian 的 `fromEnd` / `toEnd` 是單純的 mapping，在匯出邏輯中處理即可。
3. **語意更清晰**：`direction: 'forward'` 比 `fromEnd: 'none', toEnd: 'arrow'` 更直覺。

### 決策 4：表名用 `boards` 而非 `canvases`

#### 決定

統一使用 `boards`。

#### 理由

1. **避免混淆**：`canvas` 在專案中有多重含義（HTML Canvas API、Obsidian `.canvas` 檔案格式、我們的白板產品概念），用 `boards` 明確指「我們的白板資料」。
2. **`06-data-model.md` 原先用 `canvases`，已統一更新為 `boards`**。

### 決策 5：inbox_items 拖入白板後的處理

#### 候選方案

| 方案                                        | 說明                                                        | 優勢               | 劣勢                                |
| ------------------------------------------- | ----------------------------------------------------------- | ------------------ | ----------------------------------- |
| **A. 刪除 inbox_item，建立新 node**         | 乾淨刪除                                                    | 簡單               | 失去來源追蹤                        |
| **B. inbox_item 加 `status` 欄位**          | 標記 pending → placed，保留關聯                             | 可追溯來源         | 維護 inbox_item ↔ node 關聯的複雜度 |
| **C. 刪除 inbox_item，node 上保留來源欄位** | 刪除 inbox_item，`source_url` / `source_title` 存在 node 上 | 簡單且不失來源資訊 | inbox_item 本身不保留               |

#### 決定

選擇 **C. 刪除 inbox_item，來源資訊保留在 node 上**。

#### 理由

1. **最簡單**：不需要維護 inbox_item 和 node 之間的關聯，也不需要管 inbox_item 的生命週期狀態。
2. **來源資訊不會遺失**：`source_url` 和 `source_title` 直接存在 node 上，不管從哪裡來的卡片都能追溯。
3. **語意正確**：收件匣是「暫存區」，項目拖入白板後就完成了它的使命，沒有理由繼續保留。

---

## ADR-B03: 離線同步策略

**日期**：2026-02-15
**狀態**：已決定

### 背景

前端採 Offline-first 架構（`02-tech-frontend.md`），所有操作先寫入 IndexedDB，再背景同步至 Supabase。Phase 1 採用 LWW (Last-Write-Wins) 策略。需要定義 LWW 的實作位置、同步粒度、推送方式、狀態追蹤、拉取策略等具體做法。

### 決策 1：LWW 實作位置

#### 候選方案

| 方案                 | 說明                                                                           | 優勢                                                           | 劣勢                                                             |
| -------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| **A. 前端決定**      | 前端先從 server 拉資料，比較 `updated_at`，較新的勝出，再決定推或拉            | 前端完全掌控同步邏輯                                           | 拉→比較→推之間有時間差，多裝置同時寫入可能互相覆蓋；前端邏輯複雜 |
| **B. DB 層 trigger** | 前端直接 upsert，DB 用 `BEFORE UPDATE` trigger 比較 `updated_at`，舊的自動忽略 | 防禦性最強（所有裝置的寫入都經過同一個 trigger）；前端邏輯簡單 | 需要為每張表建 trigger                                           |

#### 決定

選擇 **B. DB 層 `BEFORE UPDATE` trigger**。

#### 理由

1. **防禦性更強**：不管前端邏輯有沒有 bug，DB 層都保證不會用舊資料覆蓋新資料。所有裝置的寫入都經過同一個 trigger，沒有時間差問題。
2. **前端更簡單**：前端只管「把 dirty 資料送出去」，不需要先拉再比較再推的複雜流程。
3. **與 Supabase-only 架構一致**：既然選擇讓 DB 層負責資料隔離（RLS），衝突解決也放在 DB 層是一致的設計哲學。

#### 實作

```sql
CREATE OR REPLACE FUNCTION lww_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.updated_at <= OLD.updated_at THEN
    RETURN NULL;  -- 取消這次更新，保留現有較新的資料
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 對每張需要 LWW 保護的表建立 trigger
CREATE TRIGGER lww_nodes BEFORE UPDATE ON nodes
  FOR EACH ROW EXECUTE FUNCTION lww_guard();
CREATE TRIGGER lww_edges BEFORE UPDATE ON edges
  FOR EACH ROW EXECUTE FUNCTION lww_guard();
CREATE TRIGGER lww_boards BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION lww_guard();
CREATE TRIGGER lww_groups BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION lww_guard();
```

### 決策 2：時間戳來源

#### 決定

`updated_at` 統一使用 **server 時間**（PostgreSQL `now()`），不信任客戶端時間。

#### 理由

如果用客戶端時間，不同裝置的時鐘可能不同步，導致 LWW 判斷錯誤。例如電腦時鐘快 5 分鐘，它的 `updated_at` 會比手機的還晚，即使手機的修改才是最新的。所有時間戳來自同一個 PostgreSQL 時鐘就不會有這個問題。

#### 實作

前端 upsert 時**不傳 `updated_at`**，由 DB trigger 自動填入 `now()`：

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_nodes BEFORE UPDATE ON nodes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- 其他表同理
```

> [!warning] trigger 執行順序
> `set_updated_at` 必須在 `lww_guard` **之前**執行（或合併為同一個 trigger），確保比較的是 server 時間而非客戶端傳入的值。實作時可合併為單一 trigger function。

### 決策 3：同步粒度

#### 決定

**逐筆記錄同步**，只推送有變更的個別 node / edge / group。

#### 理由

1. 一個 board 可能有 200 個 nodes，改了 1 個就推 200 個太浪費頻寬和 DB 寫入。
2. 搭配 dirty flag，只推有標記的記錄，精準且高效。
3. LWW trigger 已在 DB 層保護，即使多推幾筆也不會出錯（舊的會被忽略），但沒必要浪費。

### 決策 4：推送方式

#### 決定

使用 Supabase 的 **`upsert`**（`INSERT ON CONFLICT UPDATE`），一次 request 批次處理所有 dirty 記錄。

#### 理由

1. 比逐筆 `INSERT` 少很多 HTTP request。
2. 搭配 LWW trigger，舊資料自動被忽略，不需要前端逐筆判斷。
3. Supabase client SDK 原生支援 `upsert`，實作簡單。

### 決策 5：同步狀態追蹤

#### 決定

IndexedDB 每筆記錄加 **`dirty` flag**（`0` = 已同步，`1` = 待推送）。

#### 流程

1. 使用者操作 → 寫入 IndexedDB + 設 `dirty = 1`
2. 背景同步 → 所有 `dirty = 1` 記錄 upsert 至 Supabase → 成功後設 `dirty = 0`
3. 離線時 → 正常操作，dirty 記錄持續累積
4. 上線時 → 觸發同步，批次推送

#### 刪除的特殊處理

刪除不能直接從 IndexedDB 移除記錄（否則同步時不知道 server 上哪筆要刪）。採用 **soft delete**：

- 所有需要同步的表加 `deleted_at` 欄位（`timestamptz`，nullable）
- 「刪除」= 設 `deleted_at = now()` + `dirty = 1`
- 同步時推送至 server → server 也標記 soft delete → 確認成功後從 IndexedDB 真正移除
- 拉取時 `deleted_at IS NOT NULL` 的記錄 → 從本地 IndexedDB 移除

### 決策 6：Server → Client 拉取策略

#### 候選方案

| 方案                      | 說明                                                     | 優勢                   | 劣勢                                                          |
| ------------------------- | -------------------------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| **A. Timestamp 比較拉取** | 記住 `lastSyncAt`，只拉 `updated_at > lastSyncAt` 的記錄 | 實作簡單；不需維持連線 | 首次拉取需拉全部；依賴 server 時間一致性（已由決策 2 解決）   |
| **B. Supabase Realtime**  | 透過 WebSocket 即時推送變更                              | 即時性最好             | 需維持 WebSocket 連線；單人使用場景不需要即時推送；增加複雜度 |

#### 決定

選擇 **A. Timestamp 比較拉取**，Phase 1 不使用 Supabase Realtime。

#### 理由

1. **Phase 1 單人使用**：沒有「別人改了你的資料」的場景，不需要即時推送。唯一需要拉取的情況是「自己在另一台裝置改過」，App 啟動時拉一次就夠。
2. **實作簡單**：記一個 `lastSyncAt` 時間戳，啟動時查 `WHERE updated_at > lastSyncAt`，完成。
3. **搭配 soft delete 處理刪除**：拉取時也查 `deleted_at IS NOT NULL AND updated_at > lastSyncAt` 的記錄，就能知道哪些被刪了。

#### 已知限制與解法

| 限制                                       | 解法                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| 刪除偵測不到（已刪除的記錄不在查詢結果中） | Soft delete（`deleted_at` 欄位），拉取時能看到「這筆被刪了」                  |
| 客戶端時鐘不同步導致 `lastSyncAt` 不準     | `updated_at` 用 server 時間（決策 2），`lastSyncAt` 也從 server response 取得 |
| 首次拉取需拉全部資料                       | Phase 1 資料量小（幾十 KB），一次拉完無效能問題                               |

### 同步流程總結

```
App 啟動 / 網路恢復
  1. 推送（先推後拉，避免本地修改被覆蓋）
     → IndexedDB 中 dirty = 1 的記錄
     → upsert 至 Supabase
     → DB trigger: set_updated_at（server 時間）→ lww_guard（舊的忽略）
     → 成功 → dirty = 0

  2. 拉取
     → SELECT * WHERE updated_at > lastSyncAt
     → 比較後合併至 IndexedDB（server 較新就覆蓋，dirty = 0）
     → deleted_at IS NOT NULL 的 → 從 IndexedDB 移除
     → 更新 lastSyncAt（使用 server 回傳的時間）

一般操作（持續）
  → Zustand 更新 → IndexedDB 寫入（dirty = 1）
  → 背景每 N 秒執行推送（或用 navigator.onLine 偵測網路恢復時觸發）
```

### LWW 的已知限制

Phase 1 接受 LWW「較新覆蓋較舊」的行為：

- 同一使用者在兩台裝置同時編輯**同一張卡片的不同欄位**，只有較晚的那次會被保留，較早的修改丟失
- 要解決這個問題需要欄位層級合併（CRDT 或 OT），複雜度暴增
- Phase 1 單人使用，此場景機率極低，接受此限制
- Phase 1.5 的自訂 Queue 可改善此問題

---

## ADR-B04: 圖片儲存策略（Server-side）

**日期**：2026-02-15
**狀態**：已決定

### 背景

圖片卡片需要將實際圖片檔案儲存在 Supabase Storage。前端流程（壓縮、上傳、顯示）已於前端 ADR-003 定義，此處決定 Storage 端的配置：目錄結構、大小上限、刪除策略。

### 決策 1：Bucket 目錄結構

#### 候選方案

| 方案                                                    | 說明                     | 優勢                                                     | 劣勢                                      |
| ------------------------------------------------------- | ------------------------ | -------------------------------------------------------- | ----------------------------------------- |
| **A. 扁平：`images/{user_id}/{filename}`**              | 所有白板的圖片混在同一層 | RLS policy 最簡單；卡片搬到其他白板不用搬檔案            | 不能靠目錄結構列出某白板的所有圖片        |
| **B. 按白板：`images/{user_id}/{board_id}/{filename}`** | 按白板分資料夾           | 可以 `list()` 列出某白板所有圖片；刪白板時可整資料夾刪除 | 卡片搬白板要搬檔案；RLS policy 多一層判斷 |

#### 決定

選擇 **A. 扁平結構 `images/{user_id}/{uuid}.{ext}`**。

#### 理由

1. **資料庫才是唯一事實來源**：圖片歸屬記在 `nodes` 表的 `board_id` 和 `image_path` 欄位上，不需要目錄結構重複表達。
2. **卡片搬白板不用搬檔案**：如果用方案 B，把圖片卡片從白板 A 搬到白板 B 就要在 Storage 搬檔案 + 更新路徑，多此一舉。
3. **方案 B 的優勢不構成需求**：
   - 刪白板時 → 查 `SELECT image_path FROM nodes WHERE board_id = ?` 就能拿到所有要刪的圖片，不需要靠目錄。
   - 匯出時 → 本來就要讀 nodes 表拿卡片資料，順便拿 `image_path` 下載。
4. **filename 用 uuid 避免衝突**：例如 `a1b2c3d4.webp`，不用擔心不同白板的圖片同名。

#### Storage RLS Policy

```sql
CREATE POLICY "users_own_images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

### 決策 2：圖片大小上限

#### 決定

兩層限制：

| 層級           | 限制                        | 用途                                           |
| -------------- | --------------------------- | ---------------------------------------------- |
| 前端壓縮目標   | 最大 1MB、最大寬度 1920px   | 正常使用路徑，`browser-image-compression` 處理 |
| Storage 層限制 | 最大 5MB（`fileSizeLimit`） | 防禦性限制，防止繞過前端直接上傳               |

#### 理由

1. **白板上的卡片圖片不需要超高解析度**：1920px 寬度在任何 zoom 層級下都夠清晰。
2. **Storage 層限制比前端寬鬆**：給壓縮後仍偏大的圖片留餘量（如高解析度 PNG），同時防止惡意上傳巨型檔案。
3. **Storage 的 `fileSizeLimit` 在 Supabase Dashboard 設定**，不需要寫程式。

### 決策 3：Orphan cleanup（刪除卡片時清理圖片）

#### 候選方案

| 方案                     | 說明                                 | 優勢       | 劣勢                                                       |
| ------------------------ | ------------------------------------ | ---------- | ---------------------------------------------------------- |
| **A. 前端同步刪除**      | 刪卡片時同時呼叫 `storage.remove()`  | 最簡單直接 | 離線時無法刪 Storage                                       |
| **B. DB trigger 自動刪** | node 被刪時 trigger 呼叫 Storage API | 自動化     | PostgreSQL 呼叫外部 API 複雜（需 pg_net 或 Edge Function） |
| **C. 定期排程清理**      | 掃描沒被引用的圖片，批次刪除         | 不遺漏     | 過度工程；需要排程基礎設施                                 |

#### 決定

選擇 **A. 前端同步刪除**，搭配離線補刪機制。

#### 理由

1. **最簡單**：刪卡片和刪圖片放在同一個操作中，Phase 1 圖片數量不多，不需要複雜清理機制。
2. **DB trigger 呼叫外部 API 不好做**：PostgreSQL 原生不支援 HTTP 呼叫，需要 `pg_net` extension 或額外 Edge Function，增加架構複雜度。
3. **定期清理是過度工程**：需要排程基礎設施（cron job），Phase 1 完全不需要。

#### 離線刪除的處理

```
在線刪除：
  → 呼叫 storage.remove(image_path) 刪圖片
  → soft delete node (dirty = 1)
  → 同步時推送 soft delete

離線刪除：
  → soft delete node (dirty = 1)
  → 將 image_path 記入待刪清單（IndexedDB）
  → 上線同步時：推送 soft delete + 補刪 Storage 圖片
  → 兩者都成功後，從 IndexedDB 移除記錄
```

---

## ADR-B05: Chrome Extension 剪藏 API 與收件匣模型

**日期**：2026-02-15
**狀態**：已決定

### 背景

Phase 2 Chrome Extension 需要將剪藏內容寫入後端。需要決定：寫入方式、資料結構、目的地選擇。同時需要重新評估收件匣的模型——是否需要區分全域收件匣和專屬於特定白板的收件匣。

### 決策 1：寫入方式

#### 決定

Extension 直接使用 Supabase client SDK 寫入 `inbox_items` 表，不需要自建 API endpoint。

#### 理由

1. **與 ADR-B01 一致**：Supabase-only 架構，前端（包含 Extension）直連 PostgREST。
2. **RLS 已保護**：`auth.uid() = user_id`，Extension 持有使用者的 JWT token，寫入時自動限制為自己的資料。
3. **不需要額外邏輯**：剪藏就是一個 `INSERT`，沒有複雜的業務規則需要 server-side 處理。

### 決策 2：剪藏資料結構

#### 決定

Extension 送出的剪藏資料直接對應 `inbox_items` 表的欄位：

```typescript
{
  content: string,       // 使用者選取的文字
  source_url: string,    // 當前網頁的 URL（document.location.href）
  source_title: string,  // 當前網頁的標題（document.title）
  target_board_id?: string, // 目標白板（Phase 2 後續才加，選填）
}
```

`user_id` 不需要前端傳，由 RLS 從 JWT 自動取得。

### 決策 3：收件匣模型

#### 候選方案

| 方案                             | 說明                                                     | 優勢                                               | 劣勢                                                                  |
| -------------------------------- | -------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| **A. 全域收件匣 only**           | 原始設計，一個收件匣，不分類                             | 最簡單                                             | 剪藏量大時雜亂，不好找                                                |
| **B. 全域 + 專屬收件匣**         | 每個白板有自己的收件匣，另外有一個全域收件匣             | 分類清楚                                           | 兩種收件匣造成使用者困惑（「我的剪藏在哪？」）；schema 和 UI 都更複雜 |
| **C. 單一收件匣 + 目標白板標記** | 只有一個收件匣，但每個項目可選擇性標記 `target_board_id` | 一個地方找所有東西；可依白板篩選；改目標只要改標記 | 比方案 A 稍複雜（多一個欄位 + 篩選 UI）                               |

#### 決定

選擇 **C. 單一收件匣 + 目標白板標記**。

#### 理由

1. **不會造成困惑**：使用者只需要記住「東西都在收件匣」，不需要想「這個在全域還是專屬？」。
2. **解決方案 A 的雜亂問題**：透過 `target_board_id` 篩選，開白板時側邊欄可以只顯示「標記給這個白板的」+ 「未分類的」。
3. **比方案 B 簡單**：只多一個 nullable 欄位，不需要兩套收件匣的 UI 和邏輯。
4. **改目標很容易**：想把剪藏內容從「給 React 專案」改成「給面試準備」，改一個 `target_board_id` 就好，不用跨收件匣搬移。

#### Schema 變更

`inbox_items` 表新增一個欄位：

```sql
ALTER TABLE inbox_items
  ADD COLUMN target_board_id uuid REFERENCES boards(id) ON DELETE SET NULL;
```

- `target_board_id = null` → 未分類
- `target_board_id = 某白板 uuid` → 標記為該白板的候選內容
- 白板被刪除時 → `ON DELETE SET NULL`，標記自動變回未分類

#### 側邊欄 UI 行為

```
收件匣 (12)
├─ 全部              ← 顯示所有 inbox_items
├─ React 專案 (5)    ← WHERE target_board_id = 該白板 id
├─ 面試準備 (3)
└─ 未分類 (4)         ← WHERE target_board_id IS NULL
```

### 決策 4：目的地選擇的分階段實作

#### 決定

- **Phase 2 初版**：剪藏一律送收件匣，`target_board_id = null`。Extension UI 最簡單（不需要白板選擇器）。
- **Phase 2 後續**：Extension Popup 加白板下拉選單，讓使用者選擇目標白板（選填）。

#### 理由

1. **Phase 2 初版先求能用**：剪藏的核心價值是「快速擷取」，選白板是次要功能，可以之後在 Web App 的收件匣 UI 中補選。
2. **不直接送到白板建 node**：卡片的 `x, y` 位置需要使用者在白板上自己決定，Extension 不知道目前 viewport 在哪，隨便給座標體驗很差。收件匣 + 拖曳才是正確的 UX 流程。

### 決策 5：剪藏內容中的外部圖片處理

#### 背景

剪藏的網頁內容可能包含圖片，這些圖片實際存在外部伺服器（對方的 S3、CDN 等）。外部 URL 有失效風險（網站改版、CDN 過期、防盜連），對筆記工具來說內容持久性是核心價值。

#### 候選方案

| 方案                                 | 說明                                                                | 優勢                                                             | 劣勢                                                      |
| ------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| **A. Extension 端下載 + 重新上傳**   | Background Script 下載圖片 → 壓縮 → 上傳至 Supabase Storage         | 不需要新增 server-side 邏輯；Extension 有特殊網路權限可繞過 CORS | MV3 Service Worker 有 30 秒執行時間限制                   |
| **B. Edge Function 下載 + 重新上傳** | Extension 只送外部 URL → Edge Function server-side 下載、壓縮、上傳 | 沒有 CORS 問題；不受 Extension 限制                              | 需要新增 Edge Function；違反 Supabase-only 架構的簡潔原則 |
| **C. Web App 端背景處理**            | 先存外部 URL → 使用者開 Web App 時前端背景下載 + 上傳               | Extension 邏輯最簡單                                             | 使用者沒開 Web App 就不會處理；有延遲                     |

#### 決定

選擇 **A. Extension 端下載 + 重新上傳**，搭配 fallback。

#### 理由

1. **保持 Supabase-only 架構**（ADR-B01）：不為此新增 Edge Function，保持架構簡單。
2. **Extension Background Script 有特殊網路權限**：在 `manifest.json` 中聲明 `host_permissions: ["<all_urls>"]` 後，Background Script 的 `fetch` 不受 CORS 限制。因為 Extension 不在任何網頁的 context 中，Chrome 信任已安裝的 Extension，替它跳過 CORS 檢查。
3. **30 秒夠用**：壓縮後圖片 < 1MB，下載 + 壓縮 + 上傳通常幾秒內完成。
4. **Fallback 確保不 block 流程**：下載失敗（需登入的圖片、防盜連、timeout）時保留外部 URL，剪藏不會因為圖片問題而失敗。

#### 流程

```
Extension 剪藏包含圖片
  → Background Script 解析 content 中的 <img> / ![](url)
  → 對每張圖片：
    ├─ fetch(外部 URL)
    │  ├─ 成功 → 壓縮（browser-image-compression）→ 上傳 Supabase Storage
    │  │        → 替換 content 中的 URL 為 Storage 路徑
    │  └─ 失敗 → 保留原始外部 URL（fallback）
  → 寫入 inbox_items（content 中的圖片 URL 已盡量替換為自有路徑）
```

#### 分階段實作

- **Phase 2**：文字剪藏 only。選取範圍中的圖片保留外部 URL（作為 Markdown `![](url)` 嵌入 content）
- **Phase 3**：加入圖片下載 + 重新上傳機制，建立獨立的圖片卡片

#### Extension 繞過 CORS 的原理

```json
// manifest.json
{
  "host_permissions": ["<all_urls>"]
}
```

一般網頁的 `fetch` 受 CORS 限制（對方 server 的 response 沒有 `Access-Control-Allow-Origin` header 就會被瀏覽器攔截）。但 Extension 的 Background Script 跑在瀏覽器自己的環境中，不屬於任何網頁 origin，Chrome 看到 Extension 有 `host_permissions` 就允許請求通過，不檢查 CORS。

仍會失敗的情況：

- 圖片需要登入才能存取（私人 Google Drive 等）
- 伺服器檢查 Referer / User-Agent 拒絕非瀏覽器請求
- 圖片 URL 是臨時 token URL，已過期

---

## ADR-B06: AI 排版 SSE Streaming（Phase 3）

**日期**：2026-02-16
**狀態**：已決定

### 背景

Phase 3 的 AI 排版功能需要呼叫 Google Gemini API（使用者自帶 Gemini API Key），由 Supabase Edge Function 作為 proxy。需要定義五個面向：Gemini API Key 傳遞方式、Prompt 設計（board 序列化格式）、SSE event 格式、錯誤處理、Rate limiting。

### 決策 1：使用者 Gemini API Key 的傳遞方式

#### 候選方案

| 方案                | 說明                                                                                         | 優勢                                    | 劣勢                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| **A. 每次請求帶上** | 前端 localStorage 儲存 Gemini API Key，請求時以 `X-Gemini-Api-Key` header 送至 Edge Function | 簡單、Key 不落地到 DB、不需管理加密金鑰 | 頁面清除 localStorage 需重新輸入；多裝置不同步                        |
| **B. 加密存於 DB**  | Key 以 envelope encryption 加密後存 Supabase DB                                              | 跨裝置、跨 session 可用                 | 需管理加密金鑰（envelope encryption + key rotation）；DB 洩漏風險更高 |

#### 決定

選擇 **A. 每次請求帶上（前端 localStorage 儲存）**。

#### 討論過程與理由

初始疑慮是「把金鑰存前端是否不安全」。經過分析，此情境與一般「不要在前端存 API Key」的建議**本質不同**：

**一般說「不要存前端」的情境**——指的是**平台方的 Key**（例如 SaaS 服務的 OpenAI Key），因為任何使用者都能從前端偷到這把 Key，帳單是平台付的。

**本專案的情境**：

| 因素         | 本專案情況         |
| ------------ | ------------------ |
| Key 的擁有者 | 使用者自己         |
| 誰付帳單     | 使用者自己         |
| 使用者數量   | 單人使用           |
| Key 從哪來   | 使用者自己手動輸入 |

使用者本來就知道自己的 Key，「偷到自己的 Key」不構成威脅。

**真正的威脅是 XSS 攻擊**——惡意腳本讀取 localStorage 把 Key 外傳。但即使把 Key 存在 DB（加密），使用者輸入 Key 的瞬間、以及前端發送請求的瞬間，Key 仍然會經過前端記憶體。**XSS 一樣能攔截。存 DB 並沒有消除 XSS 風險，只是縮小了暴露的時間窗口。**

本 App 的 XSS 風險本身就很低：

- 純 SPA，自己寫的前端——不載入第三方廣告或不信任的 script
- Supabase 直連——沒有自建 API 可以被注入
- 基本的 CSP header + 輸入 sanitize 即可緩解

**如果對持久化仍有顧慮**，可用 `sessionStorage` 替代——Key 只活在當前分頁的生命週期，關掉就消失。但 `localStorage` 在單人使用場景下已足夠安全。

#### 結論

| 方案             | 安全性                      | 複雜度                                  | 適用性               |
| ---------------- | --------------------------- | --------------------------------------- | -------------------- |
| `localStorage`   | 對單人 app 足夠             | 極低                                    | **Phase 3 採用**     |
| `sessionStorage` | 關閉分頁就消失，稍安全      | 極低                                    | 如果介意持久化可降級 |
| DB 加密儲存      | 多一層保護，但 XSS 仍可繞過 | 需要 envelope encryption + key rotation | 過度工程，不採用     |

---

### 決策 2：傳給 LLM 的 Prompt 設計（Board 狀態序列化）

#### 2a. 卡片數量上限策略

##### 候選方案

| 方案                              | 說明                           | 優勢                 | 劣勢                             |
| --------------------------------- | ------------------------------ | -------------------- | -------------------------------- |
| **A. 硬性上限，超過要求精簡**     | 例如超過 50 張卡片就不讓排版   | 避免高 token 成本    | 使用者體驗差，被迫刪除或精簡內容 |
| **B. 不限制，但提供選擇排版範圍** | 使用者可全板排版，也可框選範圍 | 靈活、尊重使用者選擇 | 使用者可能不知道大白板會花更多錢 |

##### 決定

選擇 **B. 不硬性限制，引導使用者選擇排版範圍**。

##### 討論過程與理由

原始建議是設定 50 張卡片的硬上限，超過時提示使用者精簡。但「要求使用者精簡內容」是很差的體驗——使用者不應該為了使用 AI 排版而被迫刪除自己的卡片。

**讓使用者選擇排版範圍**更合理，同時解決了大白板的問題：

| 排版模式         | 做法                                    | 適用場景                    |
| ---------------- | --------------------------------------- | --------------------------- |
| **全板排版**     | 卡片 ≤ 100 張時預設此模式               | 中小型白板，一鍵完成        |
| **選取範圍排版** | 使用者框選 / 多選一組卡片，只排版選中的 | 大白板的主要操作方式        |
| **群組排版**     | 選一個 group，只排版群組內的卡片        | 與既有的 group 功能自然整合 |

**分界點設定**：

```
卡片數 ≤ 100  → 預設全板排版，也可選範圍
卡片數 > 100  → 不禁止，但 UI 預設引導「選取範圍」
             → 顯示預估 token 成本，讓使用者自己決定
```

100 張是合理的分界點——以中等內容（截斷後每張 ~80 tokens）算，100 張約 8K-10K tokens，成本低、速度快。超過也不是不能做，只是花更多錢和時間，讓使用者知情即可。

##### Context Window 參考數據（2026 年 2 月）

> [!note] 本專案使用 Google Gemini
> 以下列出主流模型作為參考，但本專案僅使用 Gemini。Gemini 的 2M context window 是目前最大的，白板排版場景不會有 context 不足的問題。

| 模型                     | Context Window  | Output 上限 |
| ------------------------ | --------------- | ----------- |
| **Gemini**（本專案採用） | **2M tokens**   | —           |
| GPT-4o                   | 128K tokens     | 16K tokens  |
| Claude Sonnet 4.5        | 200K（1M beta） | 64K tokens  |

**白板卡片容量估算**（以 Gemini 2M context window，扣除 system prompt + 指令 overhead ~5,000 tokens）：

| 卡片內容長度            | 每張卡片約佔 | Gemini (2M) 可容納 |
| ----------------------- | ------------ | ------------------ |
| 短（一句話，~30 字）    | ~80 tokens   | ~24,000 張         |
| 中（一段話，~150 字）   | ~250 tokens  | ~7,900 張          |
| 長（多段文字，~500 字） | ~700 tokens  | ~2,800 張          |

結論：Gemini 的 2M context window 遠超任何白板場景的需求。但截斷內容仍有必要——原因是省錢和降低延遲，而非怕超限。

#### 2b. 內容截斷與分層讀取

##### 決定

採用**分層讀取策略**：初版只做 Phase A（精簡版），預留 Phase B（補充讀取）機制。

##### Phase A — 精簡版序列化（Phase 3 初版實作）

```jsonc
{
  "nodes": [
    { "id": "n1", "summary": "React Fiber 架構", "type": "text" },
    { "id": "n2", "summary": "Virtual DOM diff 演算法", "type": "text" },
    { "id": "n3", "summary": "（圖片）", "type": "image" },
  ],
  "edges": [{ "source": "n1", "target": "n2", "direction": "forward" }],
  "groups": [{ "id": "g1", "label": "渲染相關", "members": ["n1", "n2"] }],
}
```

- `summary`：取前 50 字，或由前端先抽取標題 / 第一行
- 圖片卡片只標註「圖片」，不送完整內容
- 排版主要靠**既有的 edges 關係**和 summary 的語意，不需要完整內文

##### Phase B — 補充讀取（未來，視需求實作）

討論中提出的想法：如果截斷後的 summary 不足以判斷語意關聯，是否可以讓 LLM 主動要求更多資訊？

在 system prompt 中告訴 LLM：

> 如果你無法從 summary 判斷兩張卡片的語意關聯，可以回傳 `request_detail` 請求完整內容。

```jsonc
// LLM 回傳
{
  "request_detail": ["n3", "n7"],
  "reason": "無法從摘要判斷 n3 和 n7 的關聯",
}
```

前端收到後補送完整內容，LLM 再繼續排版。

**Phase 3 初版先不實作 Phase B**，理由：

1. 多輪來回會增加延遲和複雜度
2. 排版主要靠既有的 edges 關係，不是靠 LLM 讀懂內容
3. 實際跑起來再看 summary 夠不夠用，不夠再加

#### 2c. Prompt 指令與回傳 JSON Schema

##### 回傳格式定義

```jsonc
{
  // 必要：每個 node 的新位置
  "node_positions": [
    { "id": "n1", "x": 100, "y": 80 },
    { "id": "n2", "x": 350, "y": 80 },
    { "id": "n3", "x": 100, "y": 300 },
  ],

  // 可選：建議新增的 edges（需使用者確認）
  "suggested_edges": [
    { "source": "n2", "target": "n5", "reason": "都在討論 rendering 機制" },
  ],

  // 可選：建議的分群（需使用者確認）
  "suggested_groups": [{ "label": "渲染相關", "members": ["n1", "n2", "n3"] }],
}
```

##### Prompt 核心指令

> 你是一個白板排版助手。根據卡片的內容摘要和現有連線關係，重新計算每張卡片的 (x, y) 座標。
>
> 排版原則：
>
> - 有連線的卡片靠近彼此
> - 語意相關的卡片分群排列
> - 避免重疊，保持間距至少 40px
> - 整體佈局由上到下或由左到右，呈現邏輯流向
>
> 如果發現語意上應該有關聯但沒有連線的卡片，可以在 `suggested_edges` 中建議。

##### UX 設計決策

| 問題                            | 決定                                                       |
| ------------------------------- | ---------------------------------------------------------- |
| 排版後使用者能 undo 嗎？        | **必須能**。排版前先 snapshot 所有 node 位置，支援一鍵還原 |
| `suggested_edges` 自動建立嗎？  | **不自動**。UI 顯示建議，使用者逐條確認後才建立            |
| `suggested_groups` 自動建立嗎？ | **不自動**。同上，顯示為建議，使用者決定是否採用           |
| 座標基準                        | 告訴 LLM 目前 canvas 的可視範圍，避免排到畫面外            |

---

### 決策 3：SSE Event 格式

#### 候選方案

| 方案                         | 說明                                                                       | 優勢                                     | 劣勢                                       |
| ---------------------------- | -------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------ |
| **A. 等完整回應後推送**      | Edge Function 等 LLM 完整回應後解析 JSON，驗證格式，再分批推送結構化 event | 格式可控、可做 schema 驗證、錯誤處理簡單 | 延遲較高（需等 LLM 全部生成完）            |
| **B. 即時轉發 token stream** | 即時轉發 LLM 的 token stream，前端自行解析 JSON                            | 體驗更即時，使用者看到漸進式排版         | 解析 partial JSON 複雜、難以做 schema 驗證 |

#### 決定

選擇 **A. 等完整回應後推送**。

#### 理由

1. **Phase 3 初版不需要極致即時體驗**：排版是一次性操作，等幾秒完全可接受。
2. **格式可控**：可以先驗證 LLM 回傳的 JSON 是否符合預期 schema，再推送給前端，避免前端處理壞掉的 partial JSON。
3. **錯誤處理更簡單**：LLM 回傳格式異常時，Edge Function 可以做完整的驗證和 fallback，不需要前端處理 stream 中斷的情況。

#### SSE Event 格式

```
event: layout_start
data: {"total_nodes": 15}

event: node_position
data: {"node_id": "n1", "x": 120, "y": 80}

event: node_position
data: {"node_id": "n2", "x": 340, "y": 80}

event: edge_suggestion
data: {"source": "n3", "target": "n5", "reason": "概念相關"}

event: group_suggestion
data: {"label": "渲染相關", "members": ["n1", "n2", "n3"]}

event: layout_complete
data: {"message": "done"}
```

---

### 決策 4：錯誤處理

#### 決定

Edge Function 統一以 `event: error` 回傳結構化錯誤，前端依 error code 顯示對應訊息。

| 錯誤情境                                        | Error Code         | Edge Function 處理            | 前端顯示                                          |
| ----------------------------------------------- | ------------------ | ----------------------------- | ------------------------------------------------- |
| Gemini API Key 無效 (400/403 `API_KEY_INVALID`) | `invalid_api_key`  | 轉發 Gemini 的錯誤回應        | 「Gemini API Key 無效，請重新輸入」               |
| 免費額度用盡 (429 `RESOURCE_EXHAUSTED`)         | `quota_exceeded`   | 轉發 Gemini 的 429            | 「Gemini API 額度不足，請檢查帳戶餘額或稍後重試」 |
| LLM 回應超時                                    | `timeout`          | Edge Function 設 30s timeout  | 「排版請求逾時，請稍後重試」                      |
| LLM 回傳格式異常                                | `invalid_response` | JSON schema 驗證失敗          | 「AI 回傳格式錯誤，請重試」                       |
| 網路中斷                                        | —                  | 前端 EventSource 偵測連線中斷 | 「網路中斷，請檢查連線後重試」                    |

#### 補充說明

- 排版是一次性操作，網路中斷後**不自動重連重試**，顯示「請重試」讓使用者自行決定
- Error event 格式：`event: error\ndata: {"code": "invalid_api_key", "message": "..."}`

---

### 決策 5：Rate Limiting

#### 決定

| 層級                 | 方式                              | 說明                        |
| -------------------- | --------------------------------- | --------------------------- |
| **Edge Function 層** | 每個使用者每分鐘最多 5 次排版請求 | 用 Supabase DB 或記憶體計數 |
| **前端 UI 層**       | 按鈕點擊後 disable + cooldown     | 防止連點誤操作              |

#### 理由

單人使用場景，rate limiting 主要防誤操作（連續點擊排版按鈕），不需要太嚴格。每分鐘 5 次已足夠寬鬆。

---

## ADR-B07: 安全性與防護

**日期**：2026-02-16
**狀態**：已決定

### 背景

Supabase-only 架構（ADR-B01）沒有自建 API layer，資料保護的第一道也是唯一一道防線是 RLS。需要確認現有的安全機制是否足夠，以及是否需要額外防護。

### 決策 1：RLS 是否足以防止越權存取

#### 決定

**足夠**，但需搭配 RLS 整合測試與開發流程規範。

#### 理由

所有表的 RLS 核心原則是 `auth.uid() = user_id`，覆蓋以下攻擊情境：

| 攻擊情境                            | RLS 如何防護                                                      |
| ----------------------------------- | ----------------------------------------------------------------- |
| 使用者 A 嘗試讀取使用者 B 的 boards | `SELECT` policy：`auth.uid() = user_id` → 查不到                  |
| 使用者 A 嘗試修改使用者 B 的 nodes  | `UPDATE` policy：同上 → 更新 0 筆                                 |
| 未登入的匿名請求                    | `auth.uid()` 為 null → 什麼都看不到                               |
| 透過 `group_members` 間接存取       | RLS 透過 `EXISTS (SELECT 1 FROM groups WHERE ...)` 驗證 ownership |

#### 需要額外注意的風險與緩解措施

| 風險                                    | 緩解措施                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| RLS policy 寫錯（漏了某張表、某個操作） | 撰寫 **RLS 整合測試**：用兩個不同 user context 跑查詢，驗證 A 看不到 B 的資料                           |
| 新增表忘記啟用 RLS                      | Supabase 預設新表**不啟用** RLS。在 migration script 中強制 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` |
| `service_role` key 外洩                 | `service_role` key 繞過所有 RLS。僅限 Edge Function 環境變數使用，**絕不放前端**                        |

#### RLS 測試範例

```sql
-- 測試：user_a 看不到 user_b 的 boards
SET request.jwt.claims = '{"sub": "user_a_id"}';
SELECT count(*) FROM boards WHERE user_id = 'user_b_id';
-- 預期結果：0

-- 測試：未登入看不到任何資料
SET request.jwt.claims = '{}';
SELECT count(*) FROM boards;
-- 預期結果：0
```

#### 補充：Supabase `anon` key 與 `service_role` key 的差異

Supabase 專案有兩把 API Key：

| Key                    | 用途             | 權限                                      | 安全性                         |
| ---------------------- | ---------------- | ----------------------------------------- | ------------------------------ |
| **`anon` key**         | 前端使用（公開） | 受 RLS 限制，只能做 RLS policy 允許的操作 | 公開無風險——設計上就是給前端的 |
| **`service_role` key** | 後端使用（機密） | **繞過所有 RLS**，等於 DB admin 權限      | 外洩等於資料全裸，必須嚴格保護 |

`anon` key 出現在前端程式碼中是正常的，因為它只是告訴 Supabase「這個請求來自我的專案」。實際的資料保護靠 RLS + 使用者的 JWT token：

- 沒登入 → `auth.uid()` 是 null → RLS 全擋
- 有登入 → `auth.uid()` 是該使用者 ID → 只能操作自己的資料

即使有人拿到 `anon` key，沒有合法的 JWT token 就什麼都做不了。

---

### 決策 2：Supabase Storage 的存取控制

#### 決定

ADR-B04 已定義的 Storage RLS 足夠，補充以下額外設定。

#### 已有的防護（ADR-B04）

```sql
CREATE POLICY "users_own_images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

#### 額外設定

| 項目                    | 設定                                                          | 理由                                                                       |
| ----------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Bucket 類型**         | Private（確認）                                               | 所有存取透過 signed URL，無法直接以公開 URL 存取                           |
| **Signed URL 過期時間** | 1 小時                                                        | 太短影響體驗（頻繁刷新），太長增加 URL 外洩風險。前端在 URL 過期前自動刷新 |
| **上傳檔案類型限制**    | `allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']` | 防止上傳非圖片檔案（例如惡意腳本偽裝成圖片）                               |
| **上傳大小限制**        | 5MB（已定義於 ADR-B04）                                       | 防禦性限制，前端壓縮目標 1MB                                               |

---

### 決策 3：是否需要額外的 Rate Limiting

#### 決定

**Phase 1 CRUD 操作不需要額外 rate limiting**，Supabase 內建限制足夠。AI 排版的 rate limiting 已於 ADR-B06 定義。

#### 現有保護層

| 層級                         | 保護方式            | 說明                                |
| ---------------------------- | ------------------- | ----------------------------------- |
| **Supabase 平台層**          | 內建 rate limiting  | Free tier / Pro plan 皆有請求數限制 |
| **PostgREST**                | 連線池限制          | 同時連線數有上限，自然形成限流      |
| **Supabase Auth**            | 登入嘗試限制        | 防 brute force，已有基礎保護        |
| **RLS**                      | 越權請求返回空結果  | 不是 rate limit 但防止資料外洩      |
| **Edge Function（AI 排版）** | 每使用者每分鐘 5 次 | ADR-B06 已定義                      |

#### 理由

1. **單人使用**——不存在惡意使用者大量請求的場景
2. **前端是自己寫的 SPA**——不會有爬蟲或自動化工具呼叫
3. `anon` key 是公開的，但搭配 RLS，拿到 key 也只能操作自己的資料
4. 未來如果開放多人使用，再考慮 PostgREST 層的自訂 rate limiting

---

### 決策 4：帳號刪除時的資料清理

#### 決定

**Phase 1 不處理**，未來需要時再實作。

#### 預計方案（未來）

使用 Edge Function 統一處理，確保資料清理的完整性：

```
使用者點「刪除帳號」
  → 前端呼叫 Edge Function: delete-account
  → Edge Function（用 service_role key）：
    1. 刪除 Storage: images/{user_id}/ 整個資料夾
    2. 刪除 DB: DELETE FROM boards WHERE user_id = ? (CASCADE 處理關聯表)
    3. 刪除 DB: DELETE FROM inbox_items WHERE user_id = ?
    4. 刪除 Auth: supabase.auth.admin.deleteUser(user_id)
  → 回傳成功 → 前端清除 localStorage、登出
```

需要刪除的資料清單：

| 資料            | 儲存位置         | 刪除方式                            |
| --------------- | ---------------- | ----------------------------------- |
| `boards`        | Supabase DB      | CASCADE 處理關聯表                  |
| `nodes`         | Supabase DB      | boards 刪除時 CASCADE               |
| `edges`         | Supabase DB      | nodes 刪除時 CASCADE                |
| `groups`        | Supabase DB      | CASCADE                             |
| `group_members` | Supabase DB      | groups / nodes 刪除時 CASCADE       |
| `inbox_items`   | Supabase DB      | `WHERE user_id = ?`                 |
| 圖片檔案        | Supabase Storage | 刪除 `images/{user_id}/` 整個資料夾 |
| Auth 使用者記錄 | Supabase Auth    | `supabase.auth.admin.deleteUser()`  |

#### 不現在處理的理由

1. Phase 1 是個人使用，帳號刪除不是優先需求
2. 實作需要 Edge Function + `service_role` key，增加架構複雜度
3. 預計方案已記錄，未來實作時有明確方向
