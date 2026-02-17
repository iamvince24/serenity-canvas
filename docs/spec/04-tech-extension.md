# 技術規格：Chrome Extension

| 模組          | 技術選項                       | 說明                                                                                                                    |
| :------------ | :----------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **架構標準**  | **Manifest V3**                | Chrome 最新擴充功能標準。                                                                                               |
| **開發框架**  | **WXT**                        | 基於 Vite 的 Extension 開發框架，框架無關（React/Vue/Svelte 皆可）、自動產生 manifest、內建 HMR、跨瀏覽器打包開箱即用。 |
| **UI 框架**   | **React**                      | 與 Web App 共用技術棧，Content Script UI 透過 WXT 的 `createShadowRootUi` 掛載。                                        |
| **認證策略**  | **A+B 混合**                   | Web App 同步 token（策略 A）+ Extension 獨立 OAuth（策略 B）。詳見 `04a-tech-extension-auth.md`。                       |
| **Storage**   | **WXT `storage` utility**      | 基於 `chrome.storage.local`，跨 context 響應式存取（popup / background / content script 共享）。                        |
| **Messaging** | **原生 `browser.runtime` API** | WXT 提供 `browser.*` 統一 API（Chrome/Firefox 通用），搭配自訂型別封裝。                                                |
| **API 通訊**  | **Supabase JS Client**         | Extension Background 直接呼叫 Supabase API（帶 JWT），不經過 Web App 中轉。                                             |

## 檔案結構

```
chrome-extension/
├── wxt.config.ts                   # 中央設定檔
├── entrypoints/
│   ├── background.ts               # Service Worker（右鍵選單、API、認證）
│   ├── content.ts                   # Content Script（快捷鍵、文字選取偵測）
│   ├── content-ui.tsx               # Content Script UI（Toast、白板選擇器）
│   └── popup/
│       ├── index.html
│       └── main.tsx                 # Popup UI（登入狀態、白板列表）
├── components/                      # 共用 React 元件
├── lib/
│   ├── auth.ts                      # 認證狀態模組
│   ├── supabase.ts                  # Supabase client（自訂 storage adapter）
│   ├── messaging.ts                 # 型別安全的 messaging 封裝
│   └── types.ts
├── assets/
└── .env
```

## 通訊架構

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌─────────┐   onMessageExternal   ┌──────────────────────┐ │
│  │ Web App │ ─────────────────────→│  Background          │ │
│  │         │   SYNC_SESSION /      │  (Service Worker)    │ │
│  │         │   CLEAR_SESSION       │                      │ │
│  └─────────┘                       │  - 右鍵選單處理       │ │
│                                    │  - Supabase API 呼叫  │ │
│  ┌─────────┐   sendMessage         │  - Token 管理/刷新    │ │
│  │ Popup   │ ─────────────────────→│                      │ │
│  │         │   START_OAUTH /       └──────┬───────────────┘ │
│  │         │   GET_AUTH_STATE             │                  │
│  └─────────┘                             │ sendMessage      │
│                                          ▼                  │
│  ┌──────────────┐  CustomEvent  ┌─────────────────┐        │
│  │ Content      │ ────────────→ │ Content UI      │        │
│  │ (快捷鍵偵測)  │              │ (Toast/選擇器)    │        │
│  └──────────────┘              └─────────────────┘        │
│                                                              │
│                        ┌──────────┐                         │
│                        │ Supabase │                         │
│                        │ (API)    │                         │
│                        └──────────┘                         │
└──────────────────────────────────────────────────────────────┘
```

## 技術選型理由

詳見 `02a-tech-frontend-decisions.md` ADR-007。
