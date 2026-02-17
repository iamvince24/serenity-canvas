# 命名規範與清單 (Naming Conventions)

> 本文件列出 Serenity Canvas 專案中所有會使用到專案名稱的位置，確保命名一致性。

---

## 📋 Serenity Canvas 命名位置清單

### 1️⃣ Git & GitHub

**Git Repository**

```
推薦名稱: serenity-canvas
URL: github.com/{你的帳號}/serenity-canvas
```

**README.md**

```markdown
# Serenity Canvas

> 一個優雅的視覺化白板工具...
```

---

### 2️⃣ Monorepo 結構（Phase 2 才需要）

**專案根目錄**

```
serenity-canvas/
├── package.json              # "name": "serenity-canvas"
├── apps/
│   ├── web/
│   │   └── package.json      # "name": "@serenity-canvas/web"
│   └── extension/
│       └── package.json      # "name": "@serenity-canvas/extension"
└── packages/
    └── shared/
        └── package.json      # "name": "@serenity-canvas/shared"
```

**Turborepo 配置**

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": { ... }
}
```

---

### 3️⃣ Chrome Extension

**manifest.json**

```json
{
  "name": "Serenity Canvas",
  "short_name": "Serenity",
  "description": "優雅的視覺化白板工具，無縫剪藏網頁內容至 Obsidian",
  "version": "1.0.0",
  ...
}
```

**Chrome Web Store**

- Extension 顯示名稱：**Serenity Canvas**
- Extension ID：（發布後由 Chrome 自動生成）
- 商店 URL：`https://chrome.google.com/webstore/detail/{extension-id}`

---

### 4️⃣ Supabase

**專案設定**

```
專案名稱: serenity-canvas
組織: {你的組織}
區域: Northeast Asia (Tokyo) / Southeast Asia (Singapore)
```

**自動生成的資源**

```
Project Reference: {隨機生成，例如 "abcdefghijklmnop"}
API URL: https://abcdefghijklmnop.supabase.co
Database: postgres
```

**Storage Bucket**

```
Bucket 名稱: images (已確定)
路徑格式: images/{user_id}/{uuid}.{ext}
```

**Edge Functions（Phase 3 AI 功能）**

```
Function 名稱: ai-layout
部署 URL: https://abcdefghijklmnop.supabase.co/functions/v1/ai-layout
```

**Database Tables**（已確定，不需改名）

- `boards`
- `nodes`
- `edges`
- `groups`
- `group_members`
- `inbox_items`

---

### 5️⃣ Vercel

**專案設定**

```
專案名稱: serenity-canvas
Framework: Vite
Root Directory: apps/web (Monorepo) 或 . (Phase 1)
```

**自動生成的 URL**

```
Production: https://serenity-canvas.vercel.app
Preview: https://serenity-canvas-{branch}-{user}.vercel.app
```

**環境變數命名**

```bash
# .env.production
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APP_NAME=Serenity Canvas
```

---

### 6️⃣ 網域名稱（如果購買自訂網域）

**建議選項**

```
第一優先: serenitycanvas.com
備選:
  - serenity-canvas.app
  - getserenity.app
  - serenity.tools
```

**Vercel 自訂網域設定**

```
Production: app.serenitycanvas.com
Staging: staging.serenitycanvas.com
```

---

### 7️⃣ Web App 前端

**index.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <title>Serenity Canvas</title>
    <meta name="description" content="優雅的視覺化白板工具" />

    <!-- Open Graph -->
    <meta property="og:title" content="Serenity Canvas" />
    <meta property="og:description" content="優雅的視覺化白板工具" />
    <meta property="og:image" content="/og-image.png" />

    <!-- Favicon -->
    <link rel="icon" href="/favicon.svg" />
  </head>
</html>
```

**package.json**

```json
{
  "name": "serenity-canvas",
  "version": "0.1.0",
  "description": "優雅的視覺化白板工具",
  "repository": {
    "type": "git",
    "url": "https://github.com/{你的帳號}/serenity-canvas"
  },
  "homepage": "https://serenitycanvas.com"
}
```

---

### 8️⃣ GitHub 相關

**GitHub Topics**（Repository Settings → Topics）

```
serenity-canvas
canvas
whiteboard
obsidian
note-taking
visual-thinking
react
typescript
vite
supabase
```

**GitHub Actions 工作流程**

```yaml
# .github/workflows/ci.yml
name: Serenity Canvas CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Test & Build
    ...
```

**Issue/PR Templates**

```markdown
## <!-- .github/ISSUE_TEMPLATE/bug_report.md -->

name: Bug Report
about: 回報 Serenity Canvas 的問題

---
```

---

### 9️⃣ 文檔與行銷

**Logo/Branding 檔案**

```
public/
├── favicon.svg              # Serenity Canvas 圖示
├── logo-light.svg
├── logo-dark.svg
├── og-image.png            # 1200x630 Open Graph 圖片
└── apple-touch-icon.png
```

**文件檔案**

```
serenity-canvas/
├── README.md               # Serenity Canvas
├── LICENSE                 # MIT License - Serenity Canvas
├── CONTRIBUTING.md         # 貢獻指南
└── docs/
    ├── getting-started.md
    └── architecture.md
```

---

## ✅ 已經確定不需要改的名稱

**Database Schema**（已在 spec 中確定）

- ✅ `boards`, `nodes`, `edges`, `groups`, `group_members`, `inbox_items`

**Supabase Storage Bucket**（已在 spec 中確定）

- ✅ `images`

**技術術語**（不應該改）

- ✅ "Obsidian Canvas"（指的是 Obsidian 的原生功能）
- ✅ "Canvas API"（Web 標準）
- ✅ ".canvas 格式"（Obsidian 檔案格式）

---

## 🎯 命名風格一致性指南

| 位置                 | 格式                 | 範例                                        |
| -------------------- | -------------------- | ------------------------------------------- |
| Git Repo             | kebab-case           | `serenity-canvas`                           |
| Package Name         | kebab-case 或 scoped | `serenity-canvas` 或 `@serenity-canvas/web` |
| Monorepo Scoped      | @{scope}/{package}   | `@serenity-canvas/shared`                   |
| 顯示名稱（UI）       | Title Case           | `Serenity Canvas`                           |
| 網域                 | 無空格、小寫         | `serenitycanvas.com`                        |
| Environment Variable | SCREAMING_SNAKE_CASE | `VITE_APP_NAME`                             |
| Database             | snake_case           | `boards`, `nodes`                           |

---

## 💡 實作時機

### Phase 0（專案初始化時）

- ✅ Git repository 名稱
- ✅ package.json name
- ✅ index.html title
- ✅ README.md

### Phase 1（Web App 開發）

- ✅ Supabase 專案名稱
- ✅ Vercel 專案名稱
- ✅ 環境變數

### Phase 2（Chrome Extension）

- ✅ Extension manifest.json
- ✅ Monorepo 結構重組
- ✅ Scoped packages

### Phase 3（正式發布）

- ✅ 自訂網域購買與設定
- ✅ Chrome Web Store 上架
- ✅ Open Graph 圖片製作
- ✅ Logo/Branding 完整化

---

## 📚 相關文件

- [[00-overview|專案概述]] - 專案定位與核心價值
- [[02-tech-frontend|前端技術規格]] - Monorepo 架構決策（ADR-011）
- [[03-tech-backend|後端技術規格]] - Supabase 專案設定
- [[04-tech-extension|Chrome Extension]] - Extension 命名與 manifest
- [[05a-tech-cicd|CI/CD]] - GitHub Actions 與 Vercel 設定
