# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Serenity Canvas is a web-based visual whiteboard (Obsidian Canvas alternative). Users create, connect, color, group, and edit text/image cards on an infinite canvas. Multi-board dashboard with routing (`/` → `/dashboard` → `/canvas/:id`). Offline-first with Dexie (IndexedDB) for local storage, Supabase for cloud sync (auth, PostgreSQL, Storage). Includes an MCP server for AI-assisted board editing and Obsidian Canvas export.

## Workflow Rules

- Always run `pnpm typecheck` after making code changes to verify no compile errors before reporting completion.
- **DB schema changes must go through migration files** — never modify schema directly in Supabase Studio/Dashboard.
- DB change workflow: `pnpm db:migration:new <name>` → edit SQL → `pnpm db:reset` → `pnpm db:types` → `pnpm typecheck` → commit.
- Deploy order: `pnpm db:push` (migration first) → deploy frontend code.
- Local dev login: `test@example.com` / `password123` (seeded by `supabase/seed.sql`).

## Commands

```bash
pnpm dev              # Vite dev server (auto-connects to local Supabase)
pnpm build            # tsc -b && vite build
pnpm build:mcp        # Compile MCP server (mcp-server/tsconfig.json)
pnpm mcp:dev          # Run MCP server locally (tsx)
pnpm lint             # eslint + typecheck
pnpm typecheck        # tsc --noEmit on tsconfig.app / tsconfig.node / e2e / api
pnpm test             # vitest run (single pass)
pnpm test:watch       # vitest watch mode
pnpm test:coverage    # vitest with v8 coverage
pnpm e2e              # Playwright E2E tests (all browsers)
pnpm e2e:ui           # Playwright interactive UI mode
pnpm e2e:headed       # Playwright headed mode
pnpm e2e:report       # Show Playwright HTML report
pnpm db:start         # Start local Supabase (Docker)
pnpm db:stop          # Stop local Supabase
pnpm db:reset         # Reset local DB (re-run migrations + seed)
pnpm db:push          # Push migrations to production
pnpm db:pull          # Pull schema from production
pnpm db:migration:new # Create new migration file
pnpm db:types         # Generate TypeScript types from local DB
pnpm db:types:remote  # Generate TypeScript types from production DB
```

Run a single test file: `pnpm vitest run src/features/canvas/__tests__/layerOrder.test.ts`

Pre-commit hooks (Husky + lint-staged) run prettier, eslint --fix, and `vitest related --run` on staged `.ts/.tsx` files.

## Tech Stack

React 19, TypeScript 5.9 (strict), Vite 7, Zustand 5, Tiptap 2 (rich text), Konva + react-konva (canvas rendering), Tailwind CSS 4, shadcn/ui (New York style), React Router 7, Dexie 4 (IndexedDB), i18next (zh-TW/en), Zod (validation), JSZip (export), Vitest 4 + Testing Library (unit), Playwright (E2E).

### React 19 Rules

- Never write to refs during render — use `useEffect` or event handlers for ref assignments
- Always pass an initial value to `useRef()` (e.g., `useRef<HTMLDivElement>(null)`)
- Avoid `setState` inside `useEffect` where possible — prefer derived state or event handlers

## Architecture

### Routing & Page Structure

React Router v7 manages three pages: `HomePage` (`/`), `DashboardPage` (`/dashboard`, protected), `CanvasPage` (`/canvas/:id`, guarded). `ProtectedRoute` wraps auth-required pages; `CanvasRouteGuard` validates board existence and handles loading. First login triggers `LocalDataMigrationDialog` to migrate local data to cloud.

### Hybrid Rendering

Image nodes render on a Konva `<Stage>/<Layer>` (HTML canvas). Text nodes render as absolutely-positioned DOM elements overlaid on top, synchronized with the Konva viewport transform. `canvasCoordinates.ts` handles screen-to-canvas coordinate conversion. `culling.ts` provides viewport frustum culling via `useVisibleElements` hook.

### State Management

Zustand store at `src/stores/canvasStore.ts` composes five slices (`viewportSlice`, `selectionSlice`, `interactionSlice`, `historySlice`, `fileSlice`) plus shared types in `storeTypes.ts` and pure helpers in `storeHelpers.ts`. Additional standalone stores: `dashboardStore` (multi-board CRUD), `changesetStore` (AI changeset review), `authStore`, `syncStatusStore`, `syncNoticeStore`. A finite-state machine (`core/stateMachine.ts`) governs interaction modes: `idle | dragging | panning | box-selecting | resizing | connecting`. The store dispatches events through `transition(current, event) → next`.

### Command Pattern + Undo/Redo

All undoable mutations go through `Command` objects (`src/commands/`) with `execute()`/`undo()` methods. `HistoryManager` maintains undo/redo stacks (max 50). `CompositeCommand` batches related operations. Non-undoable changes (viewport, selections, drag previews) use direct `set()`. Commands: `nodeCommands`, `edgeCommands`, `groupCommands`.

### Overlay Slot Pattern

`overlaySlot` is a tagged union in Canvas local state that determines which single overlay is active: `idle | nodeContextMenu | edgeContextMenu | edgeLabelEditor | edgeEndpointDrag`. Only one overlay at a time.

### Database Layer (Dexie)

`src/db/database.ts` defines a Dexie database (v1→v2→v3) with tables: boards, nodes, edges, groups, files, dirtyChanges. `repositories.ts` provides data access. `changeTracker.ts` tracks dirty flags for sync.

### Sync & Cloud

`src/services/syncService.ts` handles bidirectional Supabase sync with RLS. `syncManager.ts` coordinates sync lifecycle. `imageSyncService.ts` syncs image assets. `localDataMigrationService.ts` handles one-time local→cloud migration on first login.

### Image Pipeline

File drop/paste → `useImageUpload` → Web Worker compression (Comlink, target WebP ≤1MB) → IndexedDB storage (`imageAssetStorage.ts`) → `imageUrlCache.ts` manages `createObjectURL` lifetime with ref-counting. `imageGarbageCollector.ts` cleans orphaned entries.

### Node Layer Ordering

`nodeOrder: string[]` in the store defines z-order. `layerOrder.ts` provides pure helpers, `orderUtils.ts` provides z-order operations. Text and image nodes reorder independently within their subsets.

### Groups

Nodes can be grouped. `GroupRect.tsx` renders group rectangles on the Konva layer. `groupCommands.ts` provides create/delete/update/add-node/remove-node commands. `GroupContextMenu.tsx` in `nodes/` handles group-specific actions.

### Changeset (AI Review)

MCP-generated changes arrive as pending changesets. `changesetStore` manages fetch/accept/reject. `ChangesetReviewPanel.tsx` and `PendingNodeOverlay.tsx` provide the review UI.

### Obsidian Canvas Export

`ExportDialog.tsx` → `obsidianExportService.ts` → `obsidianCanvasBuilder.ts` builds `.canvas` JSON + assets via JSZip. `exportFilenaming.ts` uses `sanitize-filename`.

### i18n

`src/i18n/index.ts` initializes i18next with `zh-TW` (default) and `en` locales. Language detection: localStorage (`serenity-canvas:language`) → browser → HTML tag. `LanguageToggle.tsx` for manual switching.

### Card Drag Behavior

Card body is directly draggable (no handle bar). Cursor: `grab` in non-editing state, `text` in editing state. `useBatchDrag` handles multi-node dragging.

## MCP Server

`mcp-server/` is a standalone Model Context Protocol server (Stdio transport for CLI/desktop). `api/mcp.ts` provides an HTTP transport for Vercel deployment with Bearer token auth and rate limiting (60 req/min/user).

Tools: `boardTools` (CRUD), `nodeTools` (CRUD + query), `edgeTools` (CRUD), `changesetTools` (create/manage/accept/reject). Uses `src/shared/serializers.ts` for frontend↔backend type conversion.

## Vercel Serverless API

`api/` directory contains Vercel serverless functions:

- `api/mcp.ts` — MCP HTTP endpoint with auth + rate limiting
- `api/oauth/` — OAuth 2.0 flow (authorize, callback, register, token)
- `api/well-known/` — OAuth server & protected resource metadata
- `api/cron/` — Scheduled cleanup tasks
- `api/_helpers/` — Supabase admin client, rate limiting, encryption, env loading

## E2E Testing

Playwright tests in `e2e/` with Page Object Model pattern. `e2e/fixtures/canvas-page.ts` provides `CanvasPage` class. `e2e/global-setup.ts` handles auth persistence. Config targets Webkit, Chromium, and Firefox.

Specs: auth, card-no-handle, canvas-navigation, edge-operations, keyboard-shortcuts, multi-select, node-crud, text-editing, toolbar.

## Key Conventions

- **Imports**: Use `@/` alias for `src/` imports; relative imports within a feature
- **Types**: `type` imports enforced by `verbatimModuleSyntax`; tagged unions with discriminant fields (`node.type === "text" | "image"`); no `any`; domain types split across `types/node.ts`, `types/edge.ts`, `types/viewport.ts`, `types/board.ts`, `types/group.ts`, re-exported from `types/canvas.ts`
- **State updates**: Immutable spread patterns; undoable changes via Command objects; direct `set()` only for transient state
- **Hooks**: One interaction concern per hook (`useConnectionDrag`, `useResizeDrag`, `useBatchDrag`, etc.); use individual `useCanvasStore(s => s.field)` selectors, never the whole store
- **Tests**: Unit tests in `__tests__/` subdirectory; naming `FileName.description.test.ts(x)`; AAA pattern; `fake-indexeddb` for IDB mocking (auto-imported in setup). E2E tests in `e2e/specs/`; POM pattern with `CanvasPage` fixture
- **Constants**: `SCREAMING_SNAKE_CASE` in `constants.ts`
- **Colors**: `CanvasNodeColor = CanvasColorId | null` (null = default white); six presets with Obsidian-compatible numeric values
- **Styling**: `cn()` utility (`clsx` + `tailwind-merge`); CSS custom properties for semantic tokens (`--canvas`, `--surface`, `--elevated`, `--sage`)
- **Custom Markdown codec**: `markdownCodec.ts` — bidirectional Markdown ↔ Tiptap JSON serializer (not a library)
- **i18n**: All user-facing text via `t()` from `react-i18next`; keys in `src/i18n/locales/{zh-TW,en}.json`
- **Serialization**: `src/shared/serializers.ts` for DB ↔ domain type conversion (shared by frontend & MCP server)

## Project Structure

```
src/
├── features/canvas/           # Canvas feature — organized into subdirectories
│   ├── Canvas.tsx             # Root canvas component (Konva Stage + overlay composition)
│   ├── CanvasOverlays.tsx     # Overlay composition layer
│   ├── Toolbar.tsx            # Floating toolbar (mode toggle, add node, undo/redo)
│   ├── core/                  # FSM, coordinate conversion, overlay slot, constants
│   │   ├── stateMachine.ts    # Pure FSM for interaction states
│   │   ├── canvasCoordinates.ts
│   │   ├── overlaySlot.ts     # Tagged union: idle | nodeContextMenu | edgeContextMenu | …
│   │   ├── culling.ts         # Viewport frustum culling
│   │   ├── cursorUtils.ts     # Cursor state management
│   │   ├── pointerUtils.ts    # Pointer event handling
│   │   ├── marqueeUtils.ts    # Marquee selection math
│   │   ├── domUtils.ts        # DOM query helpers
│   │   └── constants.ts
│   ├── card/                  # Text card rendering and interaction
│   │   ├── CardOverlay.tsx    # DOM overlay layer synchronized with Konva viewport
│   │   ├── CardWidget.tsx     # Tiptap text card with body-drag, resize, color picker
│   │   ├── CardExpandModal.tsx # Expanded editing modal
│   │   ├── ColorPicker.tsx
│   │   ├── ResizeHandle.tsx
│   │   └── useResizeDrag.ts
│   ├── edges/                 # Edge rendering and interaction
│   │   ├── EdgeLine.tsx       # Konva edge renderer (Arrow/Line)
│   │   ├── EdgeLabel.tsx      # Konva label on edge
│   │   ├── EdgeLabelEditor.tsx
│   │   ├── EdgeContextMenu.tsx
│   │   ├── ConnectionPreviewLine.tsx
│   │   ├── edgeUtils.ts       # Pure routing helpers
│   │   ├── edgeLabelLayout.ts
│   │   ├── useConnectionDrag.ts
│   │   └── useEdgeOverlay.ts
│   ├── nodes/                 # Node utilities and context menu
│   │   ├── NodeContextMenu.tsx
│   │   ├── GroupContextMenu.tsx
│   │   ├── NodeAnchors.tsx
│   │   ├── layerOrder.ts      # Pure z-order helpers
│   │   ├── orderUtils.ts      # Z-order operations
│   │   ├── nodeFactory.ts     # createTextNode / createImageNode factories
│   │   ├── nodePersistenceAdapter.ts
│   │   ├── keyboardNavigation.ts
│   │   └── useContextMenuBase.ts
│   ├── groups/                # Node grouping
│   │   └── GroupRect.tsx      # Konva group rectangle rendering
│   ├── changeset/             # AI changeset review
│   │   ├── ChangesetReviewPanel.tsx
│   │   └── PendingNodeOverlay.tsx
│   ├── export/                # Obsidian Canvas export
│   │   ├── ExportDialog.tsx
│   │   ├── obsidianExportService.ts
│   │   ├── obsidianCanvasBuilder.ts
│   │   ├── obsidianExport.types.ts
│   │   └── exportFilenaming.ts
│   ├── images/                # Image node pipeline
│   │   ├── ImageCanvasNode.tsx
│   │   ├── ImageBlockView.tsx
│   │   ├── ImageCaptionWidget.tsx
│   │   ├── imageAssetStorage.ts
│   │   ├── imageUrlCache.ts
│   │   ├── imageGarbageCollector.ts
│   │   ├── imageBlockExtension.ts
│   │   ├── editorImageTransfer.ts
│   │   ├── useImageUpload.ts
│   │   └── useImageResize.ts
│   ├── editor/                # Tiptap editor and markdown codec
│   │   ├── CardEditor.tsx
│   │   ├── markdownCodec.ts
│   │   ├── slashCommandExtension.ts
│   │   ├── SlashCommandMenu.tsx
│   │   ├── taskItemExtension.ts
│   │   └── editorImageUtils.ts
│   ├── hooks/                 # Canvas-level interaction hooks
│   │   ├── useCanvasKeyboard.ts
│   │   ├── useCanvasWheel.ts
│   │   ├── useBatchDrag.ts    # Multi-node drag
│   │   ├── useVisibleElements.ts # Viewport culling hook
│   │   ├── useMarqueeSelect.ts
│   │   └── usePointerCapture.ts
│   └── __tests__/             # Co-located unit tests
├── stores/                    # Zustand stores
│   ├── canvasStore.ts         # Root store composing all slices
│   ├── storeTypes.ts          # CanvasStore / CanvasActions types
│   ├── storeHelpers.ts        # Pure store utilities
│   ├── slices/                # viewportSlice, selectionSlice, interactionSlice, historySlice, fileSlice, selectionPolicy
│   ├── dashboardStore.ts      # Multi-board CRUD
│   ├── changesetStore.ts      # AI changeset review state
│   ├── authStore.ts           # Auth state
│   ├── boardSnapshotStorage.ts # Board state snapshots
│   ├── syncStatusStore.ts     # Sync progress & status
│   ├── syncNoticeStore.ts     # Sync notification messages
│   ├── uploadNoticeStore.ts   # Upload notification
│   ├── commandContextFactory.ts
│   ├── groupHelpers.ts
│   └── persistMiddleware.ts
├── commands/                  # Command pattern (undo/redo)
│   ├── nodeCommands.ts
│   ├── edgeCommands.ts
│   ├── groupCommands.ts
│   ├── historyManager.ts
│   └── types.ts
├── db/                        # Dexie IndexedDB abstraction
│   ├── database.ts            # SerenityDB definition (v1/v2/v3)
│   ├── repositories.ts        # Data access layer
│   └── changeTracker.ts       # Dirty flag tracking for sync
├── services/                  # Business logic / sync layer
│   ├── syncService.ts         # Bidirectional Supabase sync
│   ├── syncManager.ts         # Sync lifecycle coordinator
│   ├── imageSyncService.ts    # Image asset sync
│   └── localDataMigrationService.ts # Local→cloud migration
├── shared/                    # Code shared between frontend & MCP server
│   └── serializers.ts         # toDbNode/fromDbNode, toDbEdge/fromDbEdge, etc.
├── i18n/                      # Internationalization
│   ├── index.ts               # i18next init (zh-TW default, en)
│   └── locales/               # zh-TW.json, en.json
├── types/                     # Domain types split by concern
│   ├── canvas.ts              # Re-exports + CanvasMode / CanvasState root shape
│   ├── node.ts                # TextNode, ImageNode, BaseNode, NodeHeightMode
│   ├── edge.ts                # Edge, EdgeDirection, EdgeLineStyle
│   ├── viewport.ts            # ViewportState
│   ├── board.ts               # Board (id/title/createdAt/updatedAt/nodeCount)
│   ├── group.ts               # Group (id/label/color/nodeIds[])
│   └── supabase.ts            # Auto-generated Supabase types
├── hooks/                     # App-level global hooks
│   ├── useDashboardKeyboard.ts
│   └── useSignOut.ts
├── pages/                     # Route pages
│   ├── HomePage.tsx            # Landing page (/)
│   ├── DashboardPage.tsx       # Multi-board dashboard (/dashboard)
│   └── CanvasPage.tsx          # Single board view (/canvas/:id)
├── components/
│   ├── auth/                  # Auth components
│   │   ├── AuthModal.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── CanvasRouteGuard.tsx
│   │   └── LocalDataMigrationDialog.tsx
│   ├── layout/                # Layout components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── LanguageToggle.tsx
│   │   ├── SyncIndicator.tsx
│   │   └── SyncNoticeToast.tsx
│   └── ui/                    # shadcn/ui primitives
├── constants/colors.ts        # Color palette and preset lookup
├── workers/                   # Web Worker for image compression (Comlink)
└── lib/utils.ts               # cn() utility

e2e/                           # Playwright E2E tests
├── global-setup.ts            # Auth persistence setup
├── fixtures/                  # Page Object Models
│   ├── canvas-page.ts         # CanvasPage class (goto, card, clickCanvas, etc.)
│   └── helpers.ts             # Seed data, test utilities
└── specs/                     # Test suites (auth, node-crud, text-editing, etc.)

api/                           # Vercel serverless functions
├── mcp.ts                     # MCP HTTP endpoint (Bearer auth + rate limit)
├── oauth/                     # OAuth 2.0 (authorize, callback, register, token)
├── well-known/                # OAuth metadata endpoints
├── cron/                      # Scheduled cleanup tasks
└── _helpers/                  # Supabase admin, rate limit, encryption

mcp-server/                    # MCP server (Stdio transport)
├── src/
│   ├── index.ts               # CLI entry point
│   ├── server.ts              # Tool registration
│   ├── supabaseClient.ts      # Auth client + service role
│   ├── changeset.ts           # Changeset types & logic
│   └── tools/                 # boardTools, nodeTools, edgeTools, changesetTools
└── tsconfig.json
```

Detailed architecture specs live in `docs/spec/` (written in Traditional Chinese).
