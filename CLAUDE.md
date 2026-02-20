# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Serenity Canvas is a web-based visual whiteboard (Obsidian Canvas alternative). Users create, connect, color, and edit text/image cards on an infinite canvas. Currently Phase 1: local-only web app with IndexedDB storage, no backend.

## Commands

```bash
pnpm dev              # Vite dev server
pnpm build            # tsc -b && vite build
pnpm lint             # eslint + typecheck
pnpm typecheck        # tsc --noEmit on both tsconfigs
pnpm test             # vitest run (single pass)
pnpm test:watch       # vitest watch mode
pnpm test:coverage    # vitest with v8 coverage
```

Run a single test file: `pnpm vitest run src/features/canvas/__tests__/layerOrder.test.ts`

Pre-commit hooks (Husky + lint-staged) run prettier, eslint --fix, and `vitest related --run` on staged `.ts/.tsx` files.

## Tech Stack

React 19, TypeScript 5.9 (strict), Vite 7, Zustand 5, Tiptap 2 (rich text), Konva + react-konva (canvas rendering), Tailwind CSS 4, shadcn/ui (New York style), Vitest 4 + Testing Library.

## Architecture

### Hybrid Rendering

Image nodes render on a Konva `<Stage>/<Layer>` (HTML canvas). Text nodes render as absolutely-positioned DOM elements overlaid on top, synchronized with the Konva viewport transform. `canvasCoordinates.ts` handles screen-to-canvas coordinate conversion.

### State Management

Single Zustand store (`src/stores/canvasStore.ts`) holds all canvas state and actions. A finite-state machine (`stateMachine.ts`) governs interaction modes: `Idle | Dragging | Panning | BoxSelecting | Resizing | Connecting`. The store dispatches events through `transition(current, event) → next`.

### Command Pattern + Undo/Redo

All undoable mutations go through `Command` objects (`src/commands/`) with `execute()`/`undo()` methods. `HistoryManager` maintains undo/redo stacks (max 50). `CompositeCommand` batches related operations. Non-undoable changes (viewport, selections, drag previews) use direct `set()`.

### Overlay Slot Pattern

`overlaySlot` is a tagged union in Canvas local state that determines which single overlay is active: `idle | nodeContextMenu | edgeContextMenu | edgeLabelEditor | edgeEndpointDrag`. Only one overlay at a time.

### Image Pipeline

File drop/paste → `useImageUpload` → Web Worker compression (Comlink, target WebP ≤1MB) → IndexedDB storage (`imageAssetStorage.ts`) → `imageUrlCache.ts` manages `createObjectURL` lifetime with ref-counting. `imageGarbageCollector.ts` cleans orphaned entries.

### Node Layer Ordering

`nodeOrder: string[]` in the store defines z-order. `layerOrder.ts` provides pure helpers. Text and image nodes reorder independently within their subsets.

## Key Conventions

- **Imports**: Use `@/` alias for `src/` imports; relative imports within a feature
- **Types**: `type` imports enforced by `verbatimModuleSyntax`; tagged unions with discriminant fields (`node.type === "text" | "image"`); no `any`
- **State updates**: Immutable spread patterns; undoable changes via Command objects; direct `set()` only for transient state
- **Hooks**: One interaction concern per hook (`useConnectionDrag`, `useResizeDrag`, etc.); use individual `useCanvasStore(s => s.field)` selectors, never the whole store
- **Tests**: Files in `__tests__/` subdirectory; naming `FileName.description.test.ts(x)`; AAA pattern; `fake-indexeddb` for IDB mocking (auto-imported in setup)
- **Constants**: `SCREAMING_SNAKE_CASE` in `constants.ts`
- **Colors**: `CanvasNodeColor = CanvasColorId | null` (null = default white); six presets with Obsidian-compatible numeric values
- **Styling**: `cn()` utility (`clsx` + `tailwind-merge`); CSS custom properties for semantic tokens (`--canvas`, `--surface`, `--elevated`, `--sage`)
- **Custom Markdown codec**: `markdownCodec.ts` — bidirectional Markdown ↔ Tiptap JSON serializer (not a library)

## Project Structure

```
src/
├── features/canvas/     # All canvas feature code (flat structure)
│   ├── Canvas.tsx       # Root canvas component
│   ├── stateMachine.ts  # Pure FSM for interaction states
│   ├── *Widget.tsx      # Drag handles and toolbar overlays
│   ├── *Overlay.tsx     # DOM overlays positioned over Konva
│   ├── use*.ts          # Focused interaction hooks
│   └── __tests__/       # Co-located tests
├── stores/              # Zustand stores (canvasStore, uploadNoticeStore)
├── commands/            # Command pattern (node/edge commands, history manager)
├── types/canvas.ts      # Core domain types (CanvasNode, TextNode, ImageNode, Edge)
├── constants/colors.ts  # Color palette and preset lookup
├── workers/             # Web Worker for image compression (Comlink)
├── components/ui/       # shadcn/ui primitives
└── lib/utils.ts         # cn() utility
```

Detailed architecture specs live in `docs/spec/` (written in Traditional Chinese).
