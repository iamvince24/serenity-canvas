# Phase 1 Step 12：Supabase 設置與認證 (Auth)

## Context

登入功能解鎖多白板、收件匣、Chrome 剪藏等進階功能。此步驟建立 Supabase 專案、DB schema、認證流程。

## 目標

- 建立 Supabase 專案，設定 DB schema + RLS
- 實作 Google OAuth + Email/Password 登入
- Header 顯示登入/登出狀態
- 登入後可跳轉至 Dashboard

---

## 實作步驟

### Step 1：Supabase 專案設置

- 在 Supabase Dashboard 建立專案
- 設定 Google OAuth Provider（需 Google Cloud Console 的 Client ID/Secret）
- 啟用 Email/Password Auth

### Step 2：DB Schema 建立

在 Supabase SQL Editor 執行：

- 建立 `boards`, `nodes`, `edges`, `groups`, `group_members`, `inbox_items` 表（依照 `06-data-model.md`）
- 建立 `sync_guard` trigger function + triggers
- 建立 RLS policies

### Step 3：安裝 Supabase Client

```bash
pnpm add @supabase/supabase-js
```

**`src/lib/supabase.ts`** — 新建：

- 初始化 Supabase client
- 環境變數：`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**`.env.local`** — 新建（不進 git）：

- 設定 Supabase URL 和 anon key

### Step 4：Auth Store

**`src/stores/authStore.ts`** — 新建：

- `user: User | null`
- `loading: boolean`
- `signInWithGoogle()`
- `signInWithEmail(email, password)`
- `signUp(email, password)`
- `signOut()`
- 初始化時監聽 `onAuthStateChange`

### Step 5：登入 UI

**`src/components/auth/AuthModal.tsx`** — 新建：

- Modal 包含：Google OAuth 按鈕 + Email/Password 表單
- 表單驗證（基本格式檢查）
- 錯誤訊息顯示
- 使用 shadcn/ui 的 Dialog、Input、Button

**`src/components/layout/Header.tsx`** — 修改：

- 未登入：顯示「登入」按鈕 → 開啟 AuthModal
- 已登入：顯示使用者頭像/名稱 + 登出按鈕

### Step 6：路由保護

**`src/components/auth/ProtectedRoute.tsx`** — 新建：

- 包裝需要登入的路由（`/dashboard`, `/canvas/:id`）
- 未登入 → 重導向至首頁或顯示登入提示

---

## 關鍵檔案

| 檔案                                     | 動作             |
| ---------------------------------------- | ---------------- |
| `src/lib/supabase.ts`                    | 新建             |
| `.env.local`                             | 新建             |
| `src/stores/authStore.ts`                | 新建             |
| `src/components/auth/AuthModal.tsx`      | 新建             |
| `src/components/auth/ProtectedRoute.tsx` | 新建             |
| `src/components/layout/Header.tsx`       | 修改             |
| `src/App.tsx`                            | 修改（路由保護） |

---

## 驗證方式

- [ ] Supabase Dashboard 可看到所有表和 RLS policies
- [ ] 點擊「登入」→ 顯示 Auth Modal
- [ ] Google OAuth 登入/登出正常
- [ ] Email/Password 註冊/登入正常
- [ ] Header 正確顯示登入狀態
- [ ] `/dashboard` 未登入時重導向
- [ ] `pnpm build` 無錯誤
