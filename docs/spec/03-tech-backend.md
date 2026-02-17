# 技術規格：後端服務 (Backend)

| 模組                 | 技術選項                           | 說明                                                                                                  |
| :------------------- | :--------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **架構模式**         | **Supabase-only（前端直連）**      | PostgREST + RLS 處理 CRUD，Edge Functions 處理少數 server-side 邏輯。不自建 API layer。詳見 ADR-B01。 |
| **資料庫**           | **Supabase** (PostgreSQL)          | 提供 DB + Auth + Realtime + Storage，一站式解決。                                                     |
| **身份驗證**         | **Supabase Auth**                  | Google OAuth + Email/Password，搭配 RLS 做資料隔離。                                                  |
| **圖片儲存**         | **Supabase Storage**               | Private bucket + signed URL，前端壓縮後直傳。詳見前端 ADR-003。                                       |
| **Server-side 邏輯** | **Supabase Edge Functions** (Deno) | Phase 3 AI SSE proxy 使用，Phase 1-2 不需要。                                                         |
| **資料隔離**         | **RLS (Row Level Security)**       | 每張表以 `auth.uid() = user_id` 限制存取，DB 層強制執行。                                             |
| **部署**             | **Supabase**（全託管）             | 前端部署在 Vercel（純 SPA），後端全由 Supabase 託管，不需另外部署服務。                               |

---

## Database Schema（已定義）

完整 schema 見 `06-data-model.md`，設計決策見 ADR-B02。

| 表名            | 用途                | 關鍵設計                                                |
| :-------------- | :------------------ | :------------------------------------------------------ |
| `boards`        | 白板                | 登入使用者可擁有多個                                    |
| `nodes`         | 卡片（文字 / 圖片） | 單表 + `type` 欄位區分，圖片卡片多一個 `image_path`     |
| `edges`         | 連線                | `direction` 欄位：`none` / `forward` / `both`           |
| `groups`        | 群組                | 透過 `group_members` junction table 與 nodes 多對多關聯 |
| `group_members` | 群組 ↔ 卡片關聯     | 複合主鍵 `(group_id, node_id)`                          |
| `inbox_items`   | 收件匣項目          | 全域；拖入白板後刪除，來源資訊保留在 node 上            |

所有表啟用 RLS，核心原則：`auth.uid() = user_id`。

---

## 圖片儲存策略（已定義）

> 前端流程見 ADR-003，Storage 配置決策見 ADR-B04。

| 項目               | 決定                                                             |
| :----------------- | :--------------------------------------------------------------- |
| **Bucket**         | Private bucket `images`，搭配 Storage RLS                        |
| **目錄結構**       | `images/{user_id}/{uuid}.{ext}`，扁平結構，不按白板分資料夾      |
| **Storage RLS**    | 使用者只能操作 `{user_id}/` 底下的檔案                           |
| **大小上限**       | 前端壓縮目標 1MB / 最大寬度 1920px；Storage 層限制 5MB（防禦性） |
| **Orphan cleanup** | 前端刪卡片時同步刪圖片；離線時記錄待刪路徑，同步時補刪           |

---

## 離線同步策略（已定義）

> 詳細決策見 ADR-B03。

Phase 1 採 **Offline-first + LWW (Last-Write-Wins)** 架構。

| 項目                     | 決定                                                                        |
| :----------------------- | :-------------------------------------------------------------------------- |
| **LWW 實作位置**         | DB 層 `BEFORE UPDATE` trigger，自動忽略 `updated_at` 較舊的寫入             |
| **時間戳來源**           | Server 時間（PostgreSQL `now()`），避免客戶端時鐘不同步問題                 |
| **同步粒度**             | 逐筆記錄（只推送 dirty 記錄，不整個 board 同步）                            |
| **推送方式**             | Supabase `upsert`（`INSERT ON CONFLICT UPDATE`），一次 request 批次處理     |
| **同步狀態追蹤**         | IndexedDB 每筆記錄加 `dirty` flag（0 = 已同步，1 = 待推送）                 |
| **刪除處理**             | Soft delete（`deleted_at` 欄位），同步確認後再從 IndexedDB 移除             |
| **Server → Client 拉取** | Timestamp 比較（`updated_at > lastSyncAt`），Phase 1 不用 Supabase Realtime |
| **衝突策略**             | LWW 接受「較新覆蓋較舊」的限制，Phase 1 單人使用風險極低                    |

### 同步流程

```
App 啟動 / 網路恢復
  → 推送：dirty = 1 的記錄 upsert 至 Supabase（DB trigger 自動忽略舊資料）
  →       成功後 dirty = 0
  → 拉取：updated_at > lastSyncAt 的記錄從 Supabase 拉回
  →       比較後合併至 IndexedDB
  → 更新 lastSyncAt

一般操作
  → Zustand 更新 → IndexedDB 寫入（dirty = 1）→ 背景定期同步
```

### Phase 1.5 自訂 Queue（未來）

- 將操作序列化為 queue，按順序重播至 server
- 與 Command Pattern 的關聯（Command 已可序列化為 JSON）

---

## Chrome Extension 剪藏 API（已定義）

> 詳細決策見 ADR-B05。認證策略見前端 ADR-008 及 `04a-tech-extension-auth.md`。

| 項目             | 決定                                                                           |
| :--------------- | :----------------------------------------------------------------------------- |
| **寫入方式**     | Extension 直接用 Supabase client SDK 寫入，不需自建 API                        |
| **剪藏資料結構** | `content` + `source_url` + `source_title`，對應 `inbox_items` 欄位             |
| **目的地**       | 一律寫入收件匣（`inbox_items`），可選擇性標記 `target_board_id`                |
| **收件匣模型**   | 單一收件匣 + 目標白板標記（nullable），不分全域 / 專屬收件匣                   |
| **外部圖片處理** | Extension 端下載 + 壓縮 + 重新上傳至 Storage；失敗時保留外部 URL 作為 fallback |
| **Phase 2 初版** | 文字剪藏 only，圖片保留外部 URL；不標記目標白板                                |
| **Phase 3**      | 加入圖片下載 + 重新上傳機制；Extension Popup 加白板選擇器                      |

---

## AI 排版 SSE Streaming（已定義）

> 詳細決策見 ADR-B06。AI 排版需呼叫 Google Gemini API（使用者自帶 Gemini API Key），不能在前端直接暴露 Key，需要 server-side proxy。使用 Supabase Edge Function 實作。

### 架構

```
前端 → Supabase Edge Function (Deno) → Google Gemini API
                                      ← SSE streaming response
```

| 項目              | 決定                                                                                   |
| :---------------- | :------------------------------------------------------------------------------------- |
| **API Key 傳遞**  | 每次請求由前端帶上（localStorage 儲存），不存 DB。詳見 ADR-B06 決策 1                  |
| **Board 序列化**  | 精簡版：每張卡片取前 50 字作為 summary，圖片卡片只標註類型。預留補充讀取機制           |
| **卡片數量策略**  | 不硬性限制。≤100 張預設全板排版，>100 張引導使用者選取範圍，並顯示成本預估             |
| **排版範圍選擇**  | 支援全板排版、框選範圍排版、群組排版三種模式                                           |
| **SSE 策略**      | 方案 A：Edge Function 等 LLM 完整回應後解析，再分批推送結構化 event                    |
| **回傳格式**      | `node_positions`（必要）+ `suggested_edges` / `suggested_groups`（可選，需使用者確認） |
| **錯誤處理**      | 依錯誤類型回傳 `event: error`，含 error code 與使用者可讀訊息                          |
| **Rate Limiting** | Edge Function 層每使用者每分鐘 5 次；前端 UI 按鈕 cooldown 防連點                      |
| **Undo 支援**     | 排版前 snapshot 所有 node 位置，支援一鍵還原                                           |

---

## 安全性與防護（已定義）

> 詳細決策見 ADR-B07。

| 項目                    | 決定                                                                                                                    |
| :---------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **RLS**                 | `auth.uid() = user_id` 足以防止越權存取。需撰寫 RLS 整合測試；新表強制啟用 RLS                                          |
| **Storage 存取控制**    | Private bucket + Storage RLS（ADR-B04）；signed URL 過期 1 小時；限制上傳類型為 `image/jpeg`, `image/png`, `image/webp` |
| **Rate Limiting**       | Phase 1 CRUD 不需額外限流（Supabase 內建足夠）；AI 排版已定義（ADR-B06）                                                |
| **`service_role` key**  | 僅限 Edge Function 環境變數，絕不放前端                                                                                 |
| **Gemini API Key 儲存** | 前端 localStorage，不存 DB（詳見 ADR-B06 決策 1）                                                                       |
| **帳號刪除**            | Phase 1 不處理，未來需要時再以 Edge Function 實作完整資料清理流程                                                       |
