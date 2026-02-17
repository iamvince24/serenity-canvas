# Phase 0 Step 1：首頁 Landing Page 與路由基礎

## Context

Serenity Canvas 專案基礎設施已完成（Vite + React + TypeScript + Tailwind v4 + shadcn/ui + React Router + Zustand + Konva），`src/` 目前仍是 Vite 預設模板。在進入 Phase 1 的白板功能之前，需要先完成首頁的視覺呈現與基本路由架構。

設計風格依照 **Layered Calm** 設計系統（參見 `08a-design-system-prompt.md`）。

## 目標

打開瀏覽器看到一個具有 Layered Calm 風格的首頁，包含 Header 與 Hero 區塊。
點擊「馬上試用」按鈕可導向 `/canvas` 白板頁面。

---

## 路由架構

| 路徑          | 說明                 | 登入需求 |
| ------------- | -------------------- | -------- |
| `/`           | 首頁 Landing Page    | 不需要   |
| `/canvas`     | 未登入的單一本地白板 | 不需要   |
| `/dashboard`  | 管理多個白板（未來） | 需要     |
| `/canvas/:id` | 特定白板（未來）     | 需要     |

本步驟只建立 `/` 和 `/canvas` 兩條路由。

---

## 實作步驟

### Step 1：清理 Vite 預設模板

- 刪除 `src/App.css`
- 刪除 `src/assets/react.svg`
- 刪除 `public/vite.svg`
- 清空 `src/App.tsx` 中的預設內容

### Step 2：設定 React Router

**`src/main.tsx`** — 加入 BrowserRouter：

- 用 `react-router` 的 `BrowserRouter` 包裹 `<App />`

**`src/App.tsx`** — 設定路由：

- 定義兩條路由：
  - `/` → `<HomePage />`
  - `/canvas` → `<CanvasPage />`（佔位元件）

**新建檔案：**

- `src/pages/HomePage.tsx` — 首頁
- `src/pages/CanvasPage.tsx` — 白板頁（佔位，僅顯示「Canvas — Coming Soon」）

### Step 3：實作首頁 Header

**`src/components/layout/Header.tsx`**：

- 固定定位在頁面頂部
- 左側：產品名稱「Serenity Canvas」（使用 Serif 字型 Lora）
- 右側：「馬上試用」按鈕（Primary 按鈕樣式）
- 點擊按鈕用 `react-router` 的 `Link` 或 `useNavigate` 導向 `/canvas`
- 背景：Canvas 色 (#FAFAF8) + `backdrop-filter: blur(12px)` + 90% 透明度
- 下方分隔：`1px solid` Divider 色 (#F0EEEA)
- 高度：56px

**樣式重點（Layered Calm）：**

- 無 shadow，用極淡的 border-bottom 分隔
- 過渡動畫 300ms ease
- 按鈕 hover: Sage → Sage Dark，transition 320ms

### Step 4：實作首頁 Hero 區塊

**在 `src/pages/HomePage.tsx` 中：**

- 全螢幕高度（`min-h-screen`），扣除 Header 高度
- 垂直水平置中的內容區域
- 主標題：使用 Lora Serif 字型，Display 級別（48px）
  - 文案建議：「在寧靜中，理清思緒」或類似的安靜語調
- 副標題：使用 Inter Sans 字型，Body 級別（16px），Foreground Muted 色
  - 簡短一句話描述產品
- CTA 按鈕：「開始使用」或「馬上試用」，Primary 按鈕樣式，導向 `/canvas`

**背景處理（Layered Calm 多層背景）：**

- Layer 0：Canvas 色 (#FAFAF8) 主背景
- Layer 1：Sage Wash (#8B9D8312) 大面積固定覆蓋，`pointer-events: none`
- Layer 2：底部漸層 `linear-gradient(to bottom, transparent, #FAFAF8 90%)`

**動畫：**

- 進場動畫：標題與副標題 `opacity 0→1` + `translateY(8px→0)`，duration 500ms
- 使用 `cubic-bezier(0.16, 1, 0.3, 1)` 緩動曲線

### Step 5：引入 Google Fonts

**`index.html`** 中加入字型連結：

- Inter（400, 500, 600）
- Lora（400, 500, 700）
- IBM Plex Mono（400）

在 `src/index.css` 加入字型渲染優化：

```css
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

### Step 6：更新全局樣式

**`src/index.css`**：

- 設定 `body` 背景色為 Canvas (#FAFAF8)
- 設定預設字型為 Inter

---

## 關鍵檔案

| 檔案                               | 動作                       |
| ---------------------------------- | -------------------------- |
| `src/App.tsx`                      | 改寫（路由設定）           |
| `src/main.tsx`                     | 修改（加入 BrowserRouter） |
| `src/index.css`                    | 修改（全局樣式）           |
| `index.html`                       | 修改（引入 Google Fonts）  |
| `src/pages/HomePage.tsx`           | 新建                       |
| `src/pages/CanvasPage.tsx`         | 新建（佔位）               |
| `src/components/layout/Header.tsx` | 新建                       |
| `src/App.css`                      | 刪除                       |
| `src/assets/react.svg`             | 刪除                       |
| `public/vite.svg`                  | 刪除                       |

---

## 設計參考值（Layered Calm）

### 色彩快速參考

- Canvas: `#FAFAF8` | Surface: `#F3F2EF` | Elevated: `#FFFFFF`
- Foreground: `#1C1C1A` | Muted: `#6B6B66` | Subtle: `#A3A29D`
- Sage: `#8B9D83` | Sage Dark: `#5E6E58` | Sage Light: `#D4DDD0`
- Border: `#E5E3DF` | Divider: `#F0EEEA`

### 按鈕樣式

- Primary: bg `#8B9D83`, text white, radius 6px, hover `#5E6E58`
- Ghost: bg transparent, text `#6B6B66`, hover bg `#EBF0E9` + text `#5E6E58`

### 字型

- Serif 標題: `'Lora', serif`
- Sans 內文: `'Inter', sans-serif`
- Mono 標籤: `'IBM Plex Mono', monospace`

---

## 驗證方式

- [ ] `pnpm dev` 啟動後，首頁顯示 Header + Hero（無 Vite 預設模板內容）
- [ ] Header 固定在頂部，左側有產品名稱，右側有「馬上試用」按鈕
- [ ] 點擊「馬上試用」按鈕，頁面跳轉到 `/canvas`
- [ ] `/canvas` 頁面顯示佔位內容
- [ ] Hero 區塊有進場動畫（淡入 + 上移）
- [ ] 背景呈現 Layered Calm 的多層效果（微暖白底 + 淡綠覆蓋）
- [ ] 字型正確載入（Lora 用於標題，Inter 用於內文）
- [ ] `pnpm build` 無錯誤

---

## 相關文件

- [[08a-design-system-prompt]] — Layered Calm 設計系統
- [[01-features]] — 功能需求
- [[Phase1-Step1-空白畫布與卡片拖動]] — 下一步：白板功能實作
