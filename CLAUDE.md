# CLAUDE.md

## Project Overview

Serenity Canvas — web-based visual whiteboard (Obsidian Canvas alternative). Text/image cards on an infinite canvas. Routes: `/` → `/dashboard` → `/canvas/:id`. Offline-first with Dexie (IndexedDB); Supabase for cloud sync; MCP server for AI editing.

## Workflow Rules

- Always run `pnpm typecheck` after code changes before reporting completion.
- **DB changes require migration files** — never modify schema directly in Supabase Studio.
  - Workflow: `pnpm db:migration:new <name>` → edit SQL → `pnpm db:reset` → `pnpm db:types` → `pnpm typecheck` → commit.
- Deploy: `pnpm db:push` (migrations first) → deploy code.
- Local dev login: `test@example.com` / `password123`

## Commands

```bash
pnpm dev              # Vite dev server
pnpm build            # tsc -b && vite build
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run
pnpm lint             # eslint + typecheck
pnpm e2e              # Playwright E2E
pnpm db:reset         # Reset local DB (migrations + seed)
pnpm db:push          # Push migrations to production
pnpm db:migration:new # Create migration file
pnpm db:types         # Generate TS types from local DB
pnpm mcp:dev          # Run MCP server locally
```

Pre-commit: Husky + lint-staged runs prettier, eslint --fix, vitest related on staged `.ts/.tsx`.
Single test: `pnpm vitest run src/features/canvas/__tests__/layerOrder.test.ts`

## Tech Stack

React 19, TypeScript 5.9 (strict), Vite 7, Zustand 5, Tiptap 2, Konva + react-konva, Tailwind 4, shadcn/ui (New York), React Router 7, Dexie 4 (IndexedDB), i18next (zh-TW/en), Zod, JSZip, Vitest 4 + Testing Library, Playwright.

### React 19 Rules

- Never write to refs during render — use `useEffect` or event handlers
- Always pass initial value to `useRef()` (e.g., `useRef<HTMLDivElement>(null)`)
- Prefer derived state over `setState` inside `useEffect`

## Architecture

**Routing**: React Router v7 — `HomePage` (`/`), `DashboardPage` (`/dashboard`, protected), `CanvasPage` (`/canvas/:id`, guarded). `CanvasRouteGuard` validates board existence. First login triggers `LocalDataMigrationDialog`.

**Hybrid Rendering**: Image nodes on Konva `<Stage>`, text nodes as absolutely-positioned DOM elements synced via `canvasCoordinates.ts`. Culling via `culling.ts` / `useVisibleElements`.

**State**: Zustand `canvasStore.ts` with 5 slices (`viewport`, `selection`, `interaction`, `history`, `file`). FSM in `stateMachine.ts`: `idle | dragging | panning | box-selecting | resizing | connecting`.

**Commands**: All undoable mutations via `Command` objects (`src/commands/`) with `execute()`/`undo()`. `HistoryManager` (max 50). `CompositeCommand` for batched ops. Non-undoable changes use direct `set()`.

**Overlay Slot**: Tagged union — one overlay at a time: `idle | nodeContextMenu | edgeContextMenu | edgeLabelEditor | edgeEndpointDrag`.

**DB**: Dexie v3, tables: boards, nodes, edges, groups, files, dirtyChanges. `changeTracker.ts` tracks sync dirty flags.

**Sync**: `syncService.ts` ↔ Supabase with RLS. `syncManager.ts` coordinates lifecycle. Local→cloud migration on first login.

**Images**: Drop/paste → `useImageUpload` → Web Worker (Comlink, WebP ≤1MB) → IndexedDB (`imageAssetStorage.ts`) → `imageUrlCache.ts` (createObjectURL with ref-counting).

**Groups**: `GroupRect.tsx` on Konva. `groupCommands.ts` for CRUD. `nodeOrder: string[]` defines z-order; text/image nodes reorder independently.

**Changeset (AI)**: MCP changes arrive as pending changesets. `changesetStore` manages accept/reject. UI: `ChangesetReviewPanel.tsx` + `PendingNodeOverlay.tsx`.

**MCP Server**: `mcp-server/` (Stdio); `api/mcp.ts` (HTTP/Vercel, Bearer auth, 60 req/min). Tools: boardTools, nodeTools, edgeTools, changesetTools. Shared serializers: `src/shared/serializers.ts`.

**Vercel API**: `api/mcp.ts`, `api/oauth/` (authorize/callback/register/token), `api/well-known/`, `api/cron/`.

**i18n**: zh-TW (default) + en. All UI text via `t()`. Keys in `src/i18n/locales/{zh-TW,en}.json`.

## Key Conventions

- **Imports**: `@/` for `src/`; relative within a feature
- **Types**: `type` imports (`verbatimModuleSyntax`); tagged unions (`node.type === "text" | "image"`); no `any`; domain types in `types/` re-exported from `types/canvas.ts`
- **State**: Immutable spread; undoable via Command; direct `set()` only for transient state
- **Hooks**: One concern per hook; use `useCanvasStore(s => s.field)` selectors, never the whole store
- **Tests**: `__tests__/` subdirectory; AAA pattern; `fake-indexeddb` for IDB. E2E in `e2e/specs/` with POM `CanvasPage` fixture
- **Styling**: `cn()` utility (`clsx` + `tailwind-merge`); CSS custom properties (`--canvas`, `--surface`, `--elevated`, `--sage`)
- **Colors**: `CanvasNodeColor = CanvasColorId | null` (null = default white); 6 Obsidian-compatible presets
- **Codec**: `markdownCodec.ts` — custom bidirectional Markdown ↔ Tiptap JSON serializer
- **Serialization**: `src/shared/serializers.ts` — DB ↔ domain types (shared by frontend & MCP server)
- **Constants**: `SCREAMING_SNAKE_CASE` in `constants.ts`

## Project Structure

```
src/features/canvas/   # Canvas feature (card/, edges/, nodes/, groups/, images/, editor/, hooks/, core/, changeset/, export/)
src/stores/            # Zustand stores (canvasStore + slices, dashboardStore, changesetStore, authStore, syncStatusStore)
src/commands/          # Command pattern (nodeCommands, edgeCommands, groupCommands, historyManager)
src/db/                # Dexie abstraction (database.ts, repositories.ts, changeTracker.ts)
src/services/          # Sync layer (syncService, syncManager, imageSyncService, localDataMigrationService)
src/shared/            # Shared frontend↔MCP (serializers.ts)
src/types/             # Domain types (node, edge, viewport, board, group, canvas re-export)
src/pages/             # HomePage, DashboardPage, CanvasPage
src/components/        # auth/, layout/, ui/ (shadcn)
src/i18n/              # i18next init + locales/
e2e/                   # Playwright tests (fixtures/canvas-page.ts, specs/)
api/                   # Vercel serverless (mcp.ts, oauth/, well-known/, cron/)
mcp-server/            # MCP Stdio server (tools: boardTools, nodeTools, edgeTools, changesetTools)
```

Architecture specs: `docs/spec/` (Traditional Chinese).
