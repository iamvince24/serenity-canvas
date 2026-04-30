# CLAUDE.md

## Project Overview

Serenity Canvas — web-based visual whiteboard (Obsidian Canvas alternative). Text/image cards on an infinite canvas. Routes: `/` → `/dashboard` → `/canvas/:id`. Offline-first with Dexie (IndexedDB); Supabase for cloud sync; MCP server for AI editing.

**Monorepo structure** (Turborepo + pnpm workspaces):

| Package                | Path               | Description                                 |
| ---------------------- | ------------------ | ------------------------------------------- |
| `web`                  | `apps/web/`        | Main React app (Vite)                       |
| `site`                 | `apps/site/`       | Public marketing / share pages (Next.js 16) |
| `@serenity/mcp-server` | `apps/mcp-server/` | MCP Stdio server                            |
| `@serenity/shared`     | `packages/shared/` | Shared types, serializers, edge utils       |

## Workflow Rules

- Always run `pnpm typecheck` after code changes before reporting completion.
- **DB changes require migration files** — never modify schema directly in Supabase Studio.
  - Workflow: `pnpm db:migration:new <name>` → edit SQL → `pnpm db:reset` → `pnpm db:types` → `pnpm typecheck` → commit.
- Deploy: `pnpm db:push` (migrations first) → deploy code.
- Local dev login: `test@example.com` / `password123`

## Commands

```bash
# Root (Turborepo — runs all affected workspaces)
pnpm dev              # turbo dev: starts apps/web (Vite) + apps/site (Next.js) in parallel
pnpm build            # turbo build (all workspaces)
pnpm typecheck        # turbo typecheck (all workspaces)
pnpm test             # turbo test
pnpm lint             # turbo lint

# Web-specific
pnpm e2e              # Playwright E2E (apps/web)
pnpm -C apps/web dev  # web only

# MCP server
pnpm mcp:dev          # run MCP server locally (tsx src/index.ts)
pnpm build:mcp        # compile MCP server → apps/mcp-server/dist/

# DB (delegates to apps/web supabase CLI)
pnpm db:reset         # Reset local DB (migrations + seed)
pnpm db:push          # Push migrations to production
pnpm db:migration:new # Create migration file
pnpm db:types         # Generate TS types → packages/shared/src/types/supabase.ts
```

Pre-commit: Husky + lint-staged runs prettier, eslint --fix on staged `.ts/.tsx/.json/.md/.css`.
Single test: `pnpm -C apps/web vitest run src/features/canvas/__tests__/layerOrder.test.ts`

## Tech Stack

**apps/web**: React 19, TypeScript 5.9 (strict), Vite 7, Zustand 5, Tiptap 2, Konva + react-konva, Tailwind 4, shadcn/ui (New York), React Router 7, Dexie 4 (IndexedDB), i18next (zh-TW/en), Zod, JSZip, Vitest 4 + Testing Library, Playwright.

**apps/site**: Next.js 16, React 19, Tailwind 4, `@supabase/ssr`, markdown-it.

**packages/shared**: Domain types, serializers, edge utilities, Supabase generated types. Consumed by both `web` and `mcp-server` via `@serenity/shared`.

### React 19 Rules

- Never write to refs during render — use `useEffect` or event handlers
- Always pass initial value to `useRef()` (e.g., `useRef<HTMLDivElement>(null)`)
- Prefer derived state over `setState` inside `useEffect`

## Architecture

**Routing**: React Router v7 — `HomePage` (`/`), `DashboardPage` (`/dashboard`, protected), `CanvasPage` (`/canvas/:id`, guarded). `CanvasRouteGuard` validates board existence. First login triggers `LocalDataMigrationDialog`.

**Hybrid Rendering**: Image nodes on Konva `<Stage>`, text nodes as absolutely-positioned DOM elements synced via `canvasCoordinates.ts`. Culling via `culling.ts` / `useVisibleElements`.

**State**: Zustand `canvasStore.ts` with 5 slices (`viewport`, `selection`, `interaction`, `history`, `file`). FSM in `stateMachine.ts`: `idle | dragging | panning | box-selecting | resizing | connecting`.

**Commands**: All undoable mutations via `Command` objects (`apps/web/src/commands/`) with `execute()`/`undo()`. `HistoryManager` (max 50). `CompositeCommand` for batched ops. Non-undoable changes use direct `set()`.

**Overlay Slot**: Tagged union — one overlay at a time: `idle | nodeContextMenu | edgeContextMenu | edgeLabelEditor | edgeEndpointDrag`.

**DB**: Dexie v3, tables: boards, nodes, edges, groups, files, dirtyChanges. `changeTracker.ts` tracks sync dirty flags.

**Sync**: `syncService.ts` ↔ Supabase with RLS. `syncManager.ts` coordinates lifecycle. Local→cloud migration on first login.

**Images**: Drop/paste → `useImageUpload` → Web Worker (Comlink, WebP ≤1MB) → IndexedDB (`imageAssetStorage.ts`) → `imageUrlCache.ts` (createObjectURL with ref-counting).

**Groups**: `GroupRect.tsx` on Konva. `groupCommands.ts` for CRUD. `nodeOrder: string[]` defines z-order; text/image nodes reorder independently.

**Changeset (AI)**: MCP changes arrive as pending changesets. `changesetStore` manages accept/reject. UI: `ChangesetReviewPanel.tsx` + `PendingNodeOverlay.tsx`.

**MCP Server**: `apps/mcp-server/` (Stdio); `apps/web/api/mcp.ts` (HTTP/Vercel, Bearer auth, 60 req/min). Tools: boardTools, nodeTools, edgeTools, changesetTools. Shared serializers: `packages/shared/src/serializers.ts`.

**Vercel API** (all under `apps/web/api/`): `mcp.ts`, `oauth/` (authorize/callback/register/token), `well-known/`, `cron/`, `share-publish-assets.ts`.

**i18n**: zh-TW (default) + en. All UI text via `t()`. Keys in `apps/web/src/i18n/locales/{zh-TW,en}.json`.

## Key Conventions

- **Imports**: `@/` for `apps/web/src/`; `@serenity/shared` for shared package; relative within a feature
- **Types**: `type` imports (`verbatimModuleSyntax`); tagged unions (`node.type === "text" | "image"`); no `any`; domain types in `packages/shared/src/types/` re-exported from `@serenity/shared`
- **State**: Immutable spread; undoable via Command; direct `set()` only for transient state
- **Hooks**: One concern per hook; use `useCanvasStore(s => s.field)` selectors, never the whole store
- **Tests**: `__tests__/` subdirectory; AAA pattern; `fake-indexeddb` for IDB. E2E in `apps/web/e2e/specs/` with POM `CanvasPage` fixture
- **Styling**: `cn()` utility (`clsx` + `tailwind-merge`); CSS custom properties (`--canvas`, `--surface`, `--elevated`, `--sage`)
- **Colors**: `CanvasNodeColor = CanvasColorId | null` (null = default white); 6 Obsidian-compatible presets
- **Codec**: `markdownCodec.ts` — custom bidirectional Markdown ↔ Tiptap JSON serializer
- **Serialization**: `packages/shared/src/serializers.ts` — DB ↔ domain types (shared by web & MCP server)
- **Constants**: `SCREAMING_SNAKE_CASE` in `constants.ts`

## Project Structure

```
apps/web/
  src/
    features/canvas/   # Canvas feature (card/, edges/, nodes/, groups/, images/, editor/, hooks/, core/, changeset/, export/, share/)
    stores/            # Zustand stores (canvasStore + slices, dashboardStore, changesetStore, authStore, syncStatusStore, shareStore)
    commands/          # Command pattern (nodeCommands, edgeCommands, groupCommands, historyManager)
    db/                # Dexie abstraction (database.ts, repositories.ts, changeTracker.ts)
    services/          # Sync layer (syncService, syncManager, imageSyncService, localDataMigrationService)
    types/             # App-level types (canvas re-export from @serenity/shared)
    pages/             # HomePage, DashboardPage, CanvasPage
    components/        # auth/, layout/, ui/ (shadcn)
    i18n/              # i18next init + locales/
  api/                 # Vercel serverless (mcp.ts, oauth/, well-known/, cron/, share-publish-assets.ts)
  e2e/                 # Playwright tests (fixtures/canvas-page.ts, specs/)

apps/site/             # Next.js public site (share pages /s/[slug], marketing)
apps/mcp-server/
  src/
    tools/             # boardTools, nodeTools, edgeTools, changesetTools
    heightEstimator.ts # Auto-calculates card height from content
    labelWidthEstimator.ts
    server.ts          # MCP server entry

packages/shared/
  src/
    types/             # Domain types (node, edge, viewport, board, group, canvas) + supabase.ts (generated)
    serializers.ts     # DB ↔ domain types
    edgeUtils/         # Shared edge utilities
    share/             # Share-related types/utils
    constants/         # Shared constants
```

Architecture specs: `docs/spec/` (Traditional Chinese).

## Serenity Canvas MCP — Card Layout Rules

When creating cards via MCP (`create_node` / `update_node`), follow these rules to prevent overlap.

### Height — Server Auto-calculated

`create_node` and `update_node` now auto-compute height from content via `estimateContentHeight()` (`apps/mcp-server/src/heightEstimator.ts`). Every card is at least **240px** (matching frontend `DEFAULT_NODE_HEIGHT`). Longer content grows beyond 240px. The response includes `estimated_height` — use it to position subsequent cards.

### Position Calculation Rules

1. **Use `estimated_height` from the response** (or 240px minimum if planning ahead).
2. **Formula:** `next_y = current_y + estimated_height + gap`
3. **Minimum gaps:**
   - Same section (header → content): **40px**
   - Between logical sections: **200px**
4. **For rows with multiple cards**, use the tallest card's height to compute the next row Y.
5. **Verify bounding boxes** `(x, x+w, y, y+h)` don't overlap before calling MCP.

### Edge Label Spacing

`create_edge` returns `estimated_label_width` and `estimated_label_height` when a label is provided (`apps/mcp-server/src/labelWidthEstimator.ts`). Use these to ensure connected cards are spaced far enough apart:

- **Horizontal edges** (right → left): gap ≥ `estimated_label_width + 80px`
- **Vertical edges** (bottom → top): gap ≥ `estimated_label_height + 40px`
- **Minimum horizontal gap for any labeled horizontal edge: 160px** (never use 40px with a label)
- **Pre-estimate** when planning (CJK-aware): Latin chars × 7.5 + CJK chars × 12 + 16px (min 40px)
  - e.g., "前置" (2 CJK) → 2×12+16 = 40px label → gap ≥ 120px
  - e.g., "depends on" (10 Latin) → 10×7.5+16 = 91px label → gap ≥ 171px
- **Flow layouts**: use gap = `max(200, label_width + 80)` between horizontal cards
