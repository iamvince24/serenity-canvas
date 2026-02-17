# 技術規格：CI/CD 與程式碼品質

## 總覽

| 層級                | 工具                | 執行時機             | 執行位置    | 目的                           |
| ------------------- | ------------------- | -------------------- | ----------- | ------------------------------ |
| **Pre-commit Hook** | Husky + lint-staged | `git commit`         | 本機        | 即時回饋，擋住格式與 lint 問題 |
| **CI**              | GitHub Actions      | `git push` / PR      | GitHub 雲端 | 完整檢查，最終防線             |
| **CD**              | Vercel              | merge 到 `main` / PR | Vercel 雲端 | 自動部署                       |

---

## Husky（Pre-commit Hook）

### 工具組合

| 工具                   | 用途                     |
| ---------------------- | ------------------------ |
| **Husky**              | 管理 Git hooks           |
| **lint-staged**        | 只對 staged 的檔案跑檢查 |
| **Prettier**           | 程式碼格式化             |
| **ESLint**             | 程式碼品質檢查           |
| **commitlint**（可選） | Commit message 格式規範  |

### `pre-commit` Hook

只針對**這次 staged 的檔案**執行，確保 commit 流程在 2-3 秒內完成：

| 檢查項目             | 工具     | 速度   |
| -------------------- | -------- | ------ |
| 程式碼格式化         | Prettier | < 1 秒 |
| Lint（僅改過的檔案） | ESLint   | 1-3 秒 |

### `commit-msg` Hook（可選）

| 檢查項目            | 工具       | 說明                                  |
| ------------------- | ---------- | ------------------------------------- |
| Commit message 格式 | commitlint | 確保格式一致，如 `feat: 新增卡片拖曳` |

> **備註**：commitlint 為可選。一人開發階段不強制，但養成 conventional commits 習慣有助於未來自動生成 changelog。

### 不放在 Husky 的檢查

| 檢查             | 理由                                  |
| ---------------- | ------------------------------------- |
| `tsc` 型別檢查   | Monorepo 全量型別檢查需 5-15 秒，太慢 |
| 全部 unit test   | 太慢會導致開始用 `--no-verify` 跳過   |
| Build            | 更慢，完全沒必要在 commit 時擋        |
| E2E (Playwright) | 需開瀏覽器，不適合 commit hook        |

---

## GitHub Actions CI

### 觸發條件

- `push` 到任何分支
- 開啟 / 更新 Pull Request

### 必要檢查（開專案時就設定）

| 檢查               | 指令           | 對專案的意義                                           |
| ------------------ | -------------- | ------------------------------------------------------ |
| **型別檢查**       | `tsc --noEmit` | 畫布座標轉換、Command Pattern 型別複雜，一改容易牽連   |
| **ESLint（全量）** | `eslint .`     | Husky 只掃改過的，CI 補漏                              |
| **Build**          | `vite build`   | dev 模式正常但 build 會壞的情況（tree-shaking 問題等） |

### 有測試後加入

| 檢查              | 指令                    | 對專案的意義                                             |
| ----------------- | ----------------------- | -------------------------------------------------------- |
| **Unit Test**     | `vitest run`            | 座標轉換、Command undo/redo、格式轉換邏輯，改 A 可能壞 B |
| **Coverage 門檻** | `vitest run --coverage` | 確保核心邏輯有被測到                                     |
| **E2E Test**      | `playwright test`       | 畫布拖曳、卡片編輯、匯出等使用者流程                     |

### 可選但有價值

| 檢查                 | 工具                    | 對專案的意義                                                 |
| -------------------- | ----------------------- | ------------------------------------------------------------ |
| **Bundle Size 檢查** | `size-limit` 或類似工具 | Konva + Tiptap + JSZip 容易讓 bundle 變大，PR 裡直接看到差異 |
| **Lighthouse CI**    | `@lhci/cli`             | 白板 app 效能是賣點，確保改動不拖慢載入                      |
| **依賴安全掃描**     | GitHub Dependabot       | 免費開啟，檢查 npm 套件漏洞                                  |

### Monorepo 考量

Web App 和 Chrome Extension 共存於 monorepo，改了共用程式碼時兩邊都需要通過 CI。可搭配 Turborepo 的 affected 偵測，只跑受影響的 package，節省 CI 時間。

### 不建議做的

| 檢查               | 理由                                  |
| ------------------ | ------------------------------------- |
| 多瀏覽器 E2E 矩陣  | 一人 side project，只測 Chromium 就夠 |
| 多 Node 版本矩陣   | 部署在 Vercel，版本固定               |
| Docker image build | 純靜態部署，不需要                    |

---

## CD（Continuous Deployment）

由 **Vercel** 自動處理，幾乎零設定：

| 事件           | Vercel 行為          |
| -------------- | -------------------- |
| Push 到 `main` | 自動部署到正式環境   |
| 開 PR          | 自動產生 Preview URL |
| CI 檢查未通過  | 可設定為阻擋部署     |

> Vercel 的 CD 從第一天就自動運作，不需額外設定 GitHub Actions。

---

## 分階段導入路線

```
Phase 0（開專案時）
  ├─ ✅ Husky + lint-staged + Prettier + ESLint
  ├─ ⬜ GitHub Actions: tsc + ESLint + Build（等開始用 PR 工作流時再設定）
  ├─ ⬜ GitHub Branch Protection: main require status checks（同上）
  └─ Vercel CD（自動）

Phase 1（開始寫測試後）
  ├─ GitHub Actions: + Unit Test + Coverage
  └─ Dependabot 開啟

Phase 2（功能穩定後）
  ├─ GitHub Actions: + E2E (Playwright)
  └─ Bundle Size 檢查

Phase 3（想展示技術力）
  └─ Lighthouse CI
```

---

## 流程全景

```
開發者寫程式碼
  │
  ▼
git commit
  → 【Husky 第一關】Prettier 格式化 + ESLint 檢查（只掃改過的檔案）
  → commit 成功
  │
  ▼
git push
  → 【GitHub Actions 第二關】tsc + ESLint 全量 + Build + Unit Test
  → 全部通過 ✓
  │
  ▼
開 PR / merge 到 main
  → 【Vercel CD】自動部署 + Preview URL
```
