# Chrome Extension 認證規格

## 核心挑戰

Extension 和 Web App 是**不同的 origin**，無法直接共享 cookie 或 localStorage。需要一個機制讓 Extension 取得 Supabase session。

---

## 採用策略：A + B 混合

結合「Web App 主動同步」與「Extension 獨立 OAuth」兩種策略：

- **策略 A（主要路徑）**：Web App 登入時，自動透過 `chrome.runtime.sendMessage` 將 token 同步至 Extension。使用者無感。
- **策略 B（Fallback）**：Extension Popup 提供獨立登入按鈕，走 PKCE OAuth flow。適用於 Web App 未開啟或使用者先安裝 Extension 的情境。

```
                    ┌────────────────────────┐
                    │  Extension 有有效 session？│
                    └────────┬───────┬────────┘
                         Yes │       │ No
                             │       │
                    ┌────────▼──┐  ┌─▼──────────────────┐
                    │ 直接使用   │  │ Web App 是否已登入？  │
                    │ 現有 token │  └──┬───────┬─────────┘
                    └───────────┘  Yes│       │No
                                     │       │
                        ┌────────────▼──┐  ┌─▼───────────────┐
                        │ 策略 A:        │  │ 策略 B:          │
                        │ Web App 同步   │  │ Extension Popup  │
                        │ token 過來     │  │ 獨立 OAuth 登入   │
                        └───────────────┘  └─────────────────┘
```

---

## 策略 A：Web App 主動同步 Token

### 流程

```
Web App 登入成功
  → supabase.auth.onAuthStateChange 觸發
  → 偵測 Extension 已安裝（PING/PONG）
  → chrome.runtime.sendMessage(EXTENSION_ID, { type: "SYNC_SESSION", payload })
  → Extension Background 收到後呼叫 supabase.auth.setSession()
  → 認證狀態同步完成
```

### Web App 端

```ts
// hooks/useExtensionSync.ts
const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID;

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
    chrome.runtime.sendMessage(EXTENSION_ID, {
      type: "SYNC_SESSION",
      payload: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
    });
  }

  if (event === "SIGNED_OUT") {
    chrome.runtime.sendMessage(EXTENSION_ID, {
      type: "CLEAR_SESSION",
    });
  }
});
```

### Extension 端

- 透過 `browser.runtime.onMessageExternal` 接收
- **白名單驗證**：只接受 `https://your-app.com` 和 `http://localhost:3000`
- 收到後呼叫 `supabase.auth.setSession()` 完成登入

### 必要的 Manifest 設定

```ts
// wxt.config.ts
manifest: {
  externally_connectable: {
    matches: ["https://your-app.com/*"];
  }
}
```

### 限制

- Web App 必須知道 Extension ID（上架後固定，開發時會變）
- 若 Web App 未開啟，token 過期後 Extension 無法自動刷新 → 需搭配策略 B 或 alarm 自動刷新

---

## 策略 B：Extension 獨立 PKCE OAuth

### 流程

```
Extension Popup 點「登入」
  → 產生 PKCE code_verifier + code_challenge
  → 儲存 code_verifier 至 chrome.storage.local
  → 開新分頁到 Supabase /auth/v1/authorize（帶 code_challenge）
  → 使用者完成 Google OAuth
  → Supabase redirect 到 Web App /auth/extension-callback
  → Callback 頁面將 auth code 傳給 Extension（chrome.runtime.sendMessage）
  → Extension 用 code + code_verifier 呼叫 exchangeCodeForSession
  → 登入完成，自動關閉 callback 分頁
```

### 時序圖

```
Extension Popup    New Tab (OAuth)    Supabase Auth    Web App Callback
      │                  │                  │                  │
      │─ 開新分頁 ───────→│                  │                  │
      │                  │─ /authorize ────→│                  │
      │                  │                  │─ Google OAuth    │
      │                  │                  │                  │
      │                  │                  │─ redirect ──────→│
      │                  │                  │                  │
      │←─────────── sendMessage(AUTH_CALLBACK, { code }) ─────│
      │                                                        │
      │─ exchangeCodeForSession(code, code_verifier)           │
      │                                                        │
      │─ 登入完成                               自動關閉分頁 ──→│
```

### Web App Callback 頁面

路由：`/auth/extension-callback`

```
接收 URL 中的 ?code=xxx
  → chrome.runtime.sendMessage(EXTENSION_ID, { type: "AUTH_CALLBACK", payload: { code } })
  → 等待 Extension 回應 { success: true }
  → 顯示「登入成功，此分頁將自動關閉」
  → 3 秒後 window.close()
```

### 安全性

- **PKCE**：防止 auth code 被攔截，符合 OAuth 2.1 最佳實踐
- code_verifier 只存在 Extension 的 `chrome.storage.local`，callback 頁面只傳 code，不傳 verifier

---

## Token 管理

### Supabase Client 的 Storage Adapter

MV3 Service Worker **沒有 localStorage**，必須使用 `chrome.storage.local` 作為 Supabase Auth 的持久化層：

```ts
// lib/supabase.ts
supabase = createClient(URL, ANON_KEY, {
  auth: {
    storage: {
      getItem: (key) => storage.getItem(`local:supabase:${key}`),
      setItem: (key, value) => storage.setItem(`local:supabase:${key}`, value),
      removeItem: (key) => storage.removeItem(`local:supabase:${key}`),
    },
    flowType: "pkce",
    detectSessionInUrl: false,
  },
});
```

### Token 自動刷新

Service Worker 會被瀏覽器**休眠**，不能依賴 `setInterval`。採用 `chrome.alarms` API：

```
chrome.alarms.create("refresh-token", { periodInMinutes: 4 })

每 4 分鐘觸發：
  → getSession() → 檢查 expires_at
  → 若 5 分鐘內過期 → refreshSession()
```

額外觸發點：

- `browser.runtime.onStartup`：瀏覽器啟動時
- 每次收到 API 請求前：確保 token 有效

### 認證狀態的跨 Context 同步

使用 WXT 的 `storage.defineItem` 定義響應式認證狀態，所有 context（popup、content-ui、background）都能即時監聽：

```ts
// lib/auth.ts
const authState = storage.defineItem<AuthState>("local:auth_state", {
  defaultValue: {
    isLoggedIn: false,
    userId: null,
    email: null,
    expiresAt: null,
  },
});

// 任何 context 都能 watch
authState.watch((state) => {
  /* 更新 UI */
});
```

---

## 訊息協議

### External Messages（Web App → Extension）

| type            | payload                           | 回應                  | 說明                          |
| --------------- | --------------------------------- | --------------------- | ----------------------------- |
| `PING`          | —                                 | `{ pong: true }`      | 偵測 Extension 是否已安裝     |
| `SYNC_SESSION`  | `{ access_token, refresh_token }` | `{ success }`         | Web App 同步 token            |
| `CLEAR_SESSION` | —                                 | `{ success }`         | Web App 登出通知              |
| `AUTH_CALLBACK` | `{ code }`                        | `{ success, error? }` | OAuth callback 傳回 auth code |

### Internal Messages（Popup / Content → Background）

| type             | payload                                | 回應                         | 說明                |
| ---------------- | -------------------------------------- | ---------------------------- | ------------------- |
| `START_OAUTH`    | —                                      | `{ success }`                | 啟動獨立 OAuth flow |
| `SIGN_OUT`       | —                                      | `{ success }`                | 登出                |
| `GET_AUTH_STATE` | —                                      | `{ isLoggedIn, email }`      | 查詢認證狀態        |
| `CLIP_TEXT`      | `{ content, url, title, destination }` | `{ success, error? }`        | 剪藏文字            |
| `GET_BOARDS`     | —                                      | `{ boards: [{ id, name }] }` | 取得白板列表        |

### Background → Content Script

| type                  | payload                | 說明              |
| --------------------- | ---------------------- | ----------------- |
| `SHOW_TOAST`          | `{ message, variant }` | 顯示操作結果通知  |
| `SHOW_BOARD_SELECTOR` | `{ content }`          | 開啟白板選擇器 UI |

---

## 安全性檢查清單

- [x] **PKCE flow**（策略 B）— 防止 auth code 攔截
- [x] **externally_connectable 白名單** — 只接受自己的域名
- [x] **sender.url 驗證** — onMessageExternal 中二次確認來源
- [x] **Token 存在 chrome.storage.local** — 不暴露在 DOM
- [x] **Supabase anon key 可公開** — 搭配 RLS 保護資料
- [x] **Alarm 定期刷新** — 避免過期 token 累積
- [x] **Content Script 不持有 token** — 所有 API 呼叫都在 Background 執行
- [x] **Refresh token 不傳給 Content Script** — 僅 Background 可存取

---

## 各場景的認證時序

### 場景 1：使用者先登入 Web App，再使用 Extension

```
Web App 登入 → onAuthStateChange → sendMessage(SYNC_SESSION)
→ Extension 收到 → setSession → authState 更新 → 可直接使用
```

### 場景 2：使用者先安裝 Extension，未登入 Web App

```
Extension Popup 顯示「登入」→ 點擊 → 開新分頁走 PKCE OAuth
→ callback 頁面傳 code → exchangeCodeForSession → 完成
```

### 場景 3：Token 過期

```
Alarm 觸發（每 4 分鐘）→ 檢查 expires_at → 即將過期
→ refreshSession() → onAuthStateChange → authState 更新
```

### 場景 4：Web App 登出

```
Web App 登出 → sendMessage(CLEAR_SESSION)
→ Extension signOut() → authState 清空 → UI 顯示登入按鈕
```

### 場景 5：Extension 獨立登出

```
Popup 點「登出」→ sendMessage(SIGN_OUT)
→ Background signOut() → authState 清空
（不影響 Web App 的 session）
```
