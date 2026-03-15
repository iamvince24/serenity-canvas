# Serenity Canvas

一款優雅的開源網頁視覺白板工具 — [Obsidian Canvas](https://obsidian.md/canvas) 的 Web 替代方案。

在無限畫布上建立、連線、上色、編輯文字與圖片卡片。離線優先，資料存於本地；可選搭配 Supabase 實現雲端同步與使用者驗證。

<!-- TODO: 新增截圖或 GIF 展示 -->
<!-- ![Serenity Canvas 截圖](docs/assets/screenshot.png) -->

## 功能特色

- **無限畫布** — 自由平移、縮放，在無邊界的工作空間中組織你的卡片
- **富文本編輯** — 基於 Tiptap 的完整 Markdown 支援，內建 Slash Commands
- **圖片卡片** — 拖放或貼上圖片，透過 Web Worker 自動壓縮（WebP，≤ 1 MB）
- **卡片連線** — 在卡片之間繪製邊線，支援標籤、方向箭頭與多種線條樣式
- **色彩標記** — 六種預設顏色，相容 Obsidian Canvas 格式
- **復原 / 重做** — 完整的 Command Pattern 歷史紀錄（最多 50 步）
- **離線優先** — 所有資料以 IndexedDB 儲存於本地，無需網路即可使用
- **雲端同步** _（選用）_ — 整合 Supabase 驗證、PostgreSQL 資料庫與檔案儲存
- **鍵盤導航** — 為進階使用者設計的完整快捷鍵
- **匯出功能** — 透過 JSZip 支援畫布匯出

## 技術棧

| 類別       | 技術                                                 |
| ---------- | ---------------------------------------------------- |
| 框架       | React 19、TypeScript 5.9（strict mode）、Vite 7      |
| 畫布渲染   | Konva + react-konva（圖片節點於 HTML Canvas 上渲染） |
| 富文本編輯 | Tiptap 2（文字節點以 DOM Overlay 方式呈現）          |
| 狀態管理   | Zustand 5（Slice Pattern + 有限狀態機）              |
| 樣式       | Tailwind CSS 4、shadcn/ui（New York 風格）           |
| 本地儲存   | IndexedDB via Dexie                                  |
| 雲端後端   | Supabase（Auth、PostgreSQL、Storage）                |
| 測試       | Vitest 4、Testing Library、fake-indexeddb            |
| 國際化     | i18next + react-i18next                              |

## 快速開始

### 環境需求

- **Node.js** ≥ 20
- **pnpm**（建議使用的套件管理工具）
- **Docker**（僅在使用本地 Supabase 時需要）

### 安裝與啟動

```bash
# 複製專案
git clone https://github.com/iamvince24/serenity-canvas.git
cd serenity-canvas

# 安裝依賴
pnpm install

# 啟動開發伺服器
pnpm dev
```

預設執行於 `http://localhost:5173`。

### 本地 Supabase（選用）

若需啟用雲端同步與使用者驗證：

```bash
# 啟動本地 Supabase（需要 Docker）
pnpm db:start

# 重置資料庫（執行 migrations + seed data）
pnpm db:reset
```

系統會自動建立測試帳號：`test@example.com` / `password123`

## 可用指令

| 指令                 | 說明                                |
| -------------------- | ----------------------------------- |
| `pnpm dev`           | 啟動 Vite 開發伺服器                |
| `pnpm build`         | 型別檢查並打包 production 版本      |
| `pnpm preview`       | 預覽 production 版本                |
| `pnpm typecheck`     | 執行 TypeScript 型別檢查            |
| `pnpm lint`          | ESLint + 型別檢查                   |
| `pnpm test`          | 執行測試（單次）                    |
| `pnpm test:watch`    | 以 watch 模式執行測試               |
| `pnpm test:coverage` | 執行測試並產生 V8 覆蓋率報告        |
| `pnpm db:start`      | 啟動本地 Supabase                   |
| `pnpm db:stop`       | 停止本地 Supabase                   |
| `pnpm db:reset`      | 重置本地資料庫（migrations + seed） |
| `pnpm db:types`      | 從本地資料庫產生 TypeScript 型別    |

## 架構概覽

Serenity Canvas 採用**混合渲染（Hybrid Rendering）**架構：

- **圖片節點**渲染於 Konva `<Stage>` / `<Layer>`（HTML5 Canvas）
- **文字節點**以絕對定位的 DOM 元素覆蓋於上方，與 Konva 視口變換同步

### 狀態管理

Zustand Store 由五個 Slice 組成（`viewport`、`selection`、`interaction`、`history`、`file`）。**有限狀態機**控制互動模式：

```
Idle → Dragging | Panning | BoxSelecting | Resizing | Connecting
```

### Command Pattern

所有可復原的變更皆透過 `Command` 物件流轉，具備 `execute()` / `undo()` 方法。`HistoryManager` 維護復原/重做堆疊，`CompositeCommand` 可批次處理相關操作。

### 專案結構

```
src/
├── features/canvas/     # 主要畫布功能
│   ├── core/            # 有限狀態機、座標轉換、常數
│   ├── card/            # 文字卡片渲染與互動
│   ├── edges/           # 邊線渲染與互動
│   ├── nodes/           # 節點工具與右鍵選單
│   ├── images/          # 圖片流程（上傳、壓縮、快取）
│   ├── editor/          # Tiptap 編輯器與 Markdown 編解碼器
│   └── hooks/           # 畫布層級 Hooks
├── stores/              # Zustand Store 與 Slices
├── commands/            # Command Pattern（復原/重做）
├── types/               # 領域型別（node、edge、viewport）
├── constants/           # 色彩調色盤與預設值
├── workers/             # Web Worker（圖片壓縮）
├── pages/               # 路由頁面
└── components/ui/       # shadcn/ui 基礎元件
```

> 詳細架構規格請參閱 [`docs/spec/`](docs/spec/)（以繁體中文撰寫）。

## 貢獻指南

1. Fork 此專案
2. 建立功能分支（`git checkout -b feat/your-feature`）
3. 進行修改
4. 確認檢查通過：
   ```bash
   pnpm lint
   pnpm test
   ```
5. 提交變更 — pre-commit hooks 會自動執行 Prettier、ESLint 與相關測試
6. 發起 Pull Request

## 授權條款

本專案尚未設定授權條款，使用前請聯繫維護者。
