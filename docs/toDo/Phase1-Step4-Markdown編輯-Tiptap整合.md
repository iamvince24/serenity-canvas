# Phase 1 Step 4：Markdown 編輯 — Tiptap DOM Overlay 整合

## 前置條件

- **Gate A 已確認**：內容契約已凍結（見 README.md 決策閘門）。

## Context

目前卡片內容只是 Konva Text 靜態顯示。規格要求所見即所得的 Markdown 編輯體驗，使用 Tiptap 作為編輯器，以 DOM Overlay 方式疊在 Canvas 上層。這是白板的核心功能之一。

## 目標

- 雙擊卡片進入編輯模式
- 編輯模式下顯示 Tiptap 編輯器（DOM overlay），支援 Markdown 語法
- 點擊卡片外部退出編輯，卡片顯示渲染後的 Markdown
- 編輯器跟隨 zoom 等比縮放

---

## 內容三態規範（Gate A 產出）

| 狀態       | 格式                       | 用途                        | 來源                             |
| ---------- | -------------------------- | --------------------------- | -------------------------------- |
| **儲存態** | `content_markdown: string` | IndexedDB / Supabase 持久化 | 唯一真相來源                     |
| **編輯態** | ProseMirror JSON           | Tiptap runtime 使用         | 從 `content_markdown` parse 而來 |
| **匯出態** | `.md` 檔案                 | Obsidian 匯出               | 直接使用 `content_markdown`      |

**Round-trip 規則**：`markdown → Tiptap parse → Tiptap serialize → markdown`，核心語意（heading, bold, italic, list, code block, link）不可丟失。

**失敗處理**：

- Tiptap parse 失敗 → 降級為純文字節點（`<p>` 包裝原始字串），console.warn 記錄。
- Tiptap serialize 失敗 → 保留上一次成功的 `content_markdown`，不覆蓋。

---

## 實作步驟

### Step 1：安裝 Tiptap 依賴

```bash
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/pm
```

### Step 2：建立 Tiptap 編輯器元件

**`src/features/canvas/CardEditor.tsx`** — 新建：

- 使用 `@tiptap/react` 的 `useEditor` + `EditorContent`
- 配置 `StarterKit`（含 heading, bold, italic, list, code block 等）
- 初始化內容：從 `content_markdown` parse 為 ProseMirror JSON
- `onBlur` / 退出時：serialize 回 markdown 字串，更新 store 的 `content_markdown`
- 樣式：無邊框，背景透明，融入卡片

### Step 3：DOM Overlay 定位

**`src/features/canvas/CardEditorOverlay.tsx`** — 新建：

- 使用 React Portal 將編輯器渲染到 Canvas 外層的 DOM 中
- 根據卡片的畫布座標 + viewport 計算螢幕位置：
  - `x_screen = x_canvas * zoom + viewport.x`
  - `y_screen = y_canvas * zoom + viewport.y`
- 使用 `transform: scale(zoom)` 讓編輯器跟隨縮放（搭配原始 width，不重複乘 zoom）
- 設定 `transform-origin: top left`

### Step 4：編輯模式整合

**`src/stores/canvasStore.ts`** — 修改：

- 新增 `editingNodeId: string | null` 狀態
- 新增 `startEditing(nodeId)` / `stopEditing()` actions
- 新增 `updateNodeContent(id, content_markdown)` action

**`src/features/canvas/Canvas.tsx`** — 修改：

- 監聽卡片雙擊 → 進入 `editing` 狀態
- 渲染 `CardEditorOverlay`（當 editingNodeId 存在時）
- 編輯狀態下禁止平移/縮放（或限定不影響編輯區域）

### Step 5：狀態機更新

**`src/features/canvas/stateMachine.ts`** — 修改：

- `idle` + doubleClick on node → `editing`
- `editing` + click outside / Escape → `idle`
- `editing` 狀態下忽略 drag、delete 等事件

### Step 6：Konva 卡片的 Markdown 預覽渲染

**`src/features/canvas/CanvasNode.tsx`** — 修改：

- 非編輯模式下，將 Markdown 內容渲染為純文字摘要（Konva Text 不支援富文字）
- 或考慮用 Konva `<Html>` 擴充渲染 HTML（需評估效能）
- 暫時方案：顯示純文字，後續優化

---

## 關鍵檔案

| 檔案                                        | 動作 |
| ------------------------------------------- | ---- |
| `src/features/canvas/CardEditor.tsx`        | 新建 |
| `src/features/canvas/CardEditorOverlay.tsx` | 新建 |
| `src/features/canvas/CanvasNode.tsx`        | 修改 |
| `src/features/canvas/Canvas.tsx`            | 修改 |
| `src/stores/canvasStore.ts`                 | 修改 |
| `src/features/canvas/stateMachine.ts`       | 修改 |

---

## 技術細節

### DOM Overlay 定位公式

```typescript
// 使用 scale 方案：原始 width + transform scale
const overlayStyle = {
  position: "absolute",
  left: `${node.x * viewport.zoom + viewport.x}px`,
  top: `${node.y * viewport.zoom + viewport.y}px`,
  width: `${node.width}px`, // 原始寬度，由 scale 放大
  transform: `scale(${viewport.zoom})`,
  transformOrigin: "top left",
};
```

---

## 驗證方式

- [ ] 雙擊卡片進入編輯模式，出現 Tiptap 編輯器
- [ ] 可輸入 Markdown 語法（標題、粗體、列表等），即時預覽
- [ ] 點擊卡片外部退出編輯模式
- [ ] 按 Escape 退出編輯模式
- [ ] 編輯器位置正確跟隨卡片
- [ ] 縮放畫布時編輯器等比縮放
- [ ] 退出編輯後卡片顯示內容摘要
- [ ] **Round-trip 驗證**：輸入 `# Title\n**bold** _italic_\n- list` → 退出 → 重新雙擊 → 內容語意完整保留
- [ ] **降級驗證**：手動在 store 塞入非法 markdown → 卡片不 crash，顯示純文字
- [ ] `pnpm build` 無錯誤
