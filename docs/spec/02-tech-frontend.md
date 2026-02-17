# 技術規格：前端應用 (Web App)

| 模組                   | 技術選項                                                 | 選擇理由                                                                                                                                                           |
| :--------------------- | :------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **核心框架**           | **React** + **Vite**                                     | 生態系最豐富，開發與建置速度快。                                                                                                                                   |
| **語言**               | **TypeScript**                                           | 確保專案結構穩固，特別是處理複雜的 JSON 結構時。                                                                                                                   |
| **白板引擎**           | **Konva.js** + **react-konva**                           | 基於 Canvas API 渲染，符合效能展示目標；內建事件系統與拖曳支援，搭配 DOM overlay 處理富文字編輯。                                                                  |
| **狀態管理**           | **Zustand**                                              | 輕量級狀態管理，適合處理畫布上的複雜互動。                                                                                                                         |
| **本地快取**           | **Dexie.js** (IndexedDB wrapper)                         | 作為離線快取層，搭配 Supabase 做資料同步。                                                                                                                         |
| **樣式與 UI**          | **Tailwind CSS** + **shadcn/ui**                         | 快速構建美觀且現代化的使用者介面。                                                                                                                                 |
| **Markdown 編輯器**    | **Tiptap**                                               | 所見即所得 (WYSIWYG) 富文字編輯體驗，社群成熟、React 整合完善，以 DOM overlay 方式疊在 Canvas 上層進行編輯。編輯時跟隨 zoom 等比縮放（所見即所得）。詳見 ADR-012。 |
| **圖片壓縮**           | **browser-image-compression**                            | 主流客戶端圖片壓縮庫，支援設定目標大小與最大寬高，搭配 Web Worker 在背景執行。                                                                                     |
| **檔案打包**           | **JSZip**                                                | 在瀏覽器端生成包含目錄結構的 ZIP 檔。                                                                                                                              |
| **Web Worker 通訊**    | **Comlink**                                              | 簡化 Web Worker 的 RPC 呼叫，用於圖片壓縮與 ZIP 打包等耗時任務，避免阻塞主線程。                                                                                   |
| **認證與後端**         | **Supabase** (`@supabase/supabase-js`)                   | 提供 Auth（Google OAuth、Email/Password）、PostgreSQL 資料庫、即時同步，一站式解決登入與資料持久化。                                                               |
| **路由**               | **React Router**                                         | 社群成熟、學習成本低、問題排除快速；本專案路由結構簡單，將精力集中於畫布核心功能。                                                                                 |
| **離線同步策略**       | **Phase 1: LWW → Phase 1.5: 自訂 Queue**                 | Phase 1 採用 Last-Write-Wins（以 timestamp 決定勝出），單人使用場景足夠；後續如需真正離線編輯再升級為自訂 Queue。不採用 CRDT，因非多人協作場景，複雜度不符效益。   |
| **測試框架**           | **Vitest** + **Playwright**（後期）                      | Vitest 負責 unit test（純邏輯：座標轉換、Command Pattern、格式轉換）；Playwright 負責 E2E（Canvas 互動、使用者流程），安排在後期階段實作。                         |
| **Undo/Redo**          | **自製 Command Pattern**                                 | 操作集有限且反向邏輯明確，不需要額外套件；Command 可序列化為 JSON，與 Offline-first 同步架構天然契合；批次操作以 CompositeCommand 包裝。                           |
| **狀態機**             | **自訂 State Machine**                                   | 白板互動狀態約 6-8 個、轉換約 15-20 條，規模不大；自訂以 `Record<State, Record<Event, State>>` 表達即可，與 Zustand 整合更直接，無需額外依賴。                     |
| **SSE / Streaming**    | **`fetch` + `eventsource-parser`**                       | 標準 SSE 格式、無框架耦合；`fetch` 支援 POST 與自訂 Header（帶 Supabase JWT + Gemini API Key）；`eventsource-parser` 只做解析（~3 KB），職責單一、零依賴。         |
| **Chrome Extension**   | **WXT** (Vite-based)                                     | 框架無關、基於 Vite（與 Web App 技術棧一致）、跨瀏覽器打包開箱即用、抽象層適中保留技術展示空間。詳見 `04-tech-extension.md`。                                      |
| **Extension 認證策略** | **A+B 混合：Web App 同步 + 獨立 OAuth**                  | Web App 登入時自動同步 token 至 Extension（策略 A）；Extension 也支援獨立 PKCE OAuth 登入作為 fallback（策略 B）。詳見 `04a-tech-extension-auth.md`。              |
| **部署平台**           | **Vercel**                                               | 純靜態部署（SPA）；Preview Deployments 開箱即用；與 Turborepo monorepo 整合最成熟；SSE streaming 走 Supabase Edge Functions，不受 Vercel Serverless 執行時間限制。 |
| **CI/CD**              | **Husky + lint-staged + GitHub Actions + Vercel**        | 兩層防護：本機 pre-commit 跑快速檢查、CI 跑完整檢查；Vercel CD 自動部署。詳見 `05a-tech-cicd.md` & ADR-010。                                                       |
| **Monorepo 管理**      | **Phase 1 不拆；Phase 2 採 pnpm workspaces + Turborepo** | Phase 1 只有 Web App，不需要 monorepo；Phase 2 開始做 Extension 時再拆，共用型別與認證邏輯。詳見 ADR-011。                                                         |

---

## 待補充的實作策略

### Viewport Culling（視口剔除）與座標轉換

> 詳細決策理由見 ADR-013。

#### 核心概念

Viewport Culling 是指**只渲染使用者目前螢幕看得到的元素，視口外的全部跳過不畫**。當畫布有 500 個元素但螢幕只看得到 30 個時，效能差距可達 10-100 倍。

#### 座標轉換

Konva 的 `Stage` 元件直接管理視口的平移與縮放，透過 props 控制：

```tsx
<Stage
  x={viewport.x}
  y={viewport.y}
  scaleX={viewport.zoom}
  scaleY={viewport.zoom}
  width={window.innerWidth}
  height={window.innerHeight}
>
```

**螢幕座標 → 畫布座標**（用於：點擊時判斷點到哪張卡片）：

```typescript
x_canvas = (x_screen - viewport.x) / viewport.zoom;
y_canvas = (y_screen - viewport.y) / viewport.zoom;
```

**畫布座標 → 螢幕座標**（用於：DOM Overlay 定位，如 Tiptap 編輯器）：

```typescript
x_screen = x_canvas * viewport.zoom + viewport.x;
y_screen = y_canvas * viewport.zoom + viewport.y;
```

> [!tip] Konva API 捷徑
> Konva 提供 `stage.getPointerPosition()`（螢幕座標）和 `stage.getRelativePointerPosition()`（畫布座標），多數情況不需要手動計算。但 DOM Overlay 定位和 culling 判斷仍需要理解上述公式。

#### Culling 策略：React 條件渲染

視口外的元素**完全不進入 React tree 和 Konva scene graph**：

```tsx
function useVisibleElementIds(): string[] {
  return useStore(
    useShallow((s) => getVisibleElementIds(s.elements, s.viewport)),
  );
}

function CanvasLayer() {
  const visibleIds = useVisibleElementIds();
  return (
    <Layer>
      {visibleIds.map((id) => (
        <CanvasNode key={id} id={id} />
      ))}
    </Layer>
  );
}
```

**關鍵細節**：

- **`useShallow` 淺比較**：平移時 viewport 每秒變化 60 次，但可見元素集合不一定改變。`useShallow` 逐一比對 id 陣列內容，只有集合真正改變時才觸發重渲染。
- **Padding 緩衝區**：在視口四邊各往外擴 100px（畫布座標）判定可見範圍，預先渲染即將進入螢幕的元素，防止平移時邊緣出現元素「突然出現」的閃爍。

#### Culling 判斷邏輯

```typescript
const VIEWPORT_PADDING = 100;

function getVisibleElementIds(
  elements: Record<string, BaseElement>,
  viewport: ViewportState,
): string[] {
  const bounds = getViewportBounds(viewport, VIEWPORT_PADDING);
  return Object.keys(elements).filter((id) => intersects(elements[id], bounds));
}

function getViewportBounds(viewport: ViewportState, padding: number): Bounds {
  return {
    x: -viewport.x / viewport.zoom - padding,
    y: -viewport.y / viewport.zoom - padding,
    width: window.innerWidth / viewport.zoom + padding * 2,
    height: window.innerHeight / viewport.zoom + padding * 2,
  };
}
```

#### 連線（Edges）的 Culling

連線的兩端卡片可能都在視口外，但線段穿越視口。解法：以兩端點座標構成的外接矩形做判定——只要這個矩形與視口重疊就渲染該連線。可能偶爾多渲染幾條看不到的線，但成本可忽略。

```typescript
function getEdgeBounds(
  edge: Edge,
  elements: Record<string, BaseElement>,
): Bounds {
  const source = elements[edge.fromNode];
  const target = elements[edge.toNode];
  const x1 = source.x + source.width / 2;
  const y1 = source.y + source.height / 2;
  const x2 = target.x + target.width / 2;
  const y2 = target.y + target.height / 2;
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}
```

#### 空間索引：Phase 1 不導入，預留介面

Phase 1 目標場景不超過 200 個元素，線性 filter 每幀 < 0.2ms，使用者完全無感。空間索引（如 R-tree）在 500+ 元素時才有明顯效益，但每次元素變化（移動、新增、刪除、Undo/Redo）都要同步更新索引，維護成本不低。

策略：Phase 1 用線性 filter，但 culling 邏輯封裝為獨立函式 `getVisibleElementIds`，日後需要時**只換這個函式的內部實作**，呼叫端不用改。

| 元素數量 | 線性 filter 每幀耗時 | 是否引入空間索引 |
| :------- | :------------------- | :--------------- |
| < 200    | < 0.2ms              | 不需要           |
| 200-500  | < 0.5ms              | 觀察             |
| 500+     | > 1ms                | 建議引入         |

### Markdown 與 .canvas 的轉換管線細節

> 待補充。

### 連線（Edges）的路徑/互動實作策略

> 待補充。
