---
name: commenting-philosophy
description: Commenting philosophy based on John Ousterhout's "A Philosophy of Software Design". Use when writing, reviewing, or auditing comments and documentation. Emphasizes comments that capture what code cannot express — the why, the intent, and the abstraction.
---

# Commenting Philosophy (A Philosophy of Software Design)

Based on John Ousterhout's _A Philosophy of Software Design_. Comments are not just documentation — they are a design tool.

## When to Activate

- Writing new modules, classes, or functions
- Reviewing or auditing existing comments
- Noticing that a piece of code feels hard to understand
- Before committing code — checking if comments are accurate
- Refactoring an abstraction or interface
- Finding a comment that just repeats the code

---

## Core Principle: Capture What Code Cannot Express

Code shows _how_. Comments must express _why_, _what it represents_, and _design intent_.

```typescript
// ❌ BAD: Repeats the code — adds zero value
// Increment retry count by 1
retryCount++;

// ✅ GOOD: Explains the why
// Cap at MAX_RETRIES to avoid overwhelming the server during outages
retryCount++;
```

**The test**: If you removed the comment, would the reader lose any information that isn't already obvious from the code? If not, delete it.

---

## Rule 1 — Low-Level Comments: Add Precision

Use these for variable declarations, parameters, and return values.

They answer what code names alone cannot:

- What are the units?
- Are boundaries inclusive or exclusive?
- What does `null` / `undefined` / `-1` mean here?
- Who owns the lifecycle of this resource?

```typescript
// ❌ BAD: Name alone is ambiguous
let timeout: number;
let end: number;
let items: string[];

// ✅ GOOD: Precision added via comment
/** Milliseconds to wait before retrying. 0 means no delay. */
let timeoutMs: number;

/** Index of the last included character (exclusive upper bound). */
let end: number;

/**
 * IDs of nodes selected by the user.
 * Empty array means nothing is selected (never null).
 */
let selectedIds: string[];
```

**Think nouns, not verbs** — describe what the variable _represents_, not how it is _manipulated_.

---

## Rule 2 — High-Level Comments: Enhance Intuition

Use these for methods, classes, and complex code blocks.

They answer:

- What is this code trying to do overall?
- Why does this block exist at all?

Omit low-level details — the reader can see those in the code. Focus on intent and structure.

```typescript
// ❌ BAD: Describes every step (restates code)
// Check if node exists, then get its children, then filter by type, then sort

// ✅ GOOD: Explains overall intent
// Build the ordered subtree used for keyboard navigation.
// Sorting ensures Tab order matches visual top-to-bottom layout.
function buildNavigationTree(root: Node): Node[] { ... }
```

---

## Rule 3 — Interface vs. Implementation Comments

### Interface Comments (public contract)

Goes **before** the class or function declaration. Defines the abstraction — what callers need to know to **use** it correctly.

Must include:

- What it does (not how)
- All parameters and return values
- Side effects and thrown errors
- Preconditions / invariants

Must NOT include: internal implementation details.

```typescript
/**
 * Searches the canvas for nodes matching the query string.
 *
 * Matching is case-insensitive and checks both title and body content.
 * Returns nodes sorted by relevance score (highest first).
 *
 * @param query - Search string. Empty string returns all nodes.
 * @param limit - Maximum results to return. Defaults to 20.
 * @returns Matching nodes. Empty array if none found — never null.
 * @throws {SearchError} If the canvas index is not yet initialized.
 */
export function searchNodes(query: string, limit = 20): CanvasNode[] { ... }
```

### Implementation Comments (internal logic)

Goes **inside** the function body. Explains _how_ and _why_ — for the maintainer, not the caller.

Use sparingly — short, clean functions often need none. Target complex algorithms, non-obvious branching, or performance trade-offs.

```typescript
function layoutNodes(nodes: CanvasNode[]): LayoutResult {
  // Sort by creation time first to give deterministic output when
  // x-positions are equal — avoids visual jitter on re-layout.
  const sorted = [...nodes].sort(
    (a, b) => a.createdAt - b.createdAt || a.x - b.x,
  );

  // Use a two-pass algorithm: first pass calculates column widths,
  // second pass assigns final positions. Single-pass would require
  // look-ahead that complicates the logic significantly.
  const columnWidths = computeColumnWidths(sorted);
  return assignPositions(sorted, columnWidths);
}
```

---

## Rule 4 — Write Comments First (Comments as Design)

Before writing code, write the interface comment.

**Why this matters:**

- Forces you to think about the abstraction before getting lost in implementation
- If you can't describe the function simply, the design is probably wrong
- Guarantees documentation is never skipped under time pressure

```typescript
// Step 1: Write the interface comment first
/**
 * Merges two canvas states, preferring remote changes on conflict.
 * Local-only nodes are always preserved.
 *
 * @param local - The user's current canvas state
 * @param remote - The state received from the server
 * @returns A merged state safe to render
 */
function mergeCanvasState(
  local: CanvasState,
  remote: CanvasState,
): CanvasState {
  // Step 2: Now implement — guided by the contract you just defined
}
```

### Red Flag: Hard-to-Comment Code

If writing the interface comment feels awkward or produces a long paragraph, this is a **design warning**:

- The function may have too many responsibilities
- The interface may be leaking implementation details
- The abstraction may not be clean

Fix the design first. A simple function is easy to describe in one or two sentences.

---

## Rule 5 — Maintenance Principles

### Keep Comments Near Their Code

Place comments as close as possible to what they describe. Distant comments go stale silently.

```typescript
// ❌ BAD: Comment far from the code it describes
// We use exponential backoff here
function retry() {
  // ... 40 lines later ...
  const delay = Math.min(1000 * 2 ** attempt, 30_000);
}

// ✅ GOOD: Comment immediately precedes the relevant line
function retry() {
  // Exponential backoff capped at 30s to avoid unbounded waits
  const delay = Math.min(1000 * 2 ** attempt, 30_000);
}
```

### One Source of Truth

Document each design decision exactly once. If multiple sites share the same complex logic, document it at the primary declaration and reference it elsewhere.

```typescript
// ✅ In the primary location
/**
 * Coordinate system: origin (0,0) is top-left of the infinite canvas.
 * X increases rightward, Y increases downward.
 * All node positions are stored in this coordinate space.
 */
interface Position { x: number; y: number; }

// ✅ At a usage site — reference, don't repeat
// Converts viewport coordinates to canvas coordinates (see Position).
function viewportToCanvas(vp: Position, camera: Camera): Position { ... }
```

### Comments Belong in Code, Not Commit Messages

Future readers read the code — they rarely read git history. Any non-obvious decision that matters to a future maintainer belongs in a code comment.

```typescript
// ✅ Important fix documented in code, not just git log
// Using requestAnimationFrame instead of setTimeout(0) here because
// Safari has a bug where setTimeout fires before layout is complete,
// causing the measured width to be 0. (See issue #412)
requestAnimationFrame(() => measureNodeWidth(node));
```

### Review Diffs Before Committing

Before every commit, check: did any changed code have a comment that now needs updating? Stale comments are worse than no comments — they actively mislead.

---

## Rule 6 — Cross-Module Decisions

For decisions that span multiple files (shared invariants, system-wide conventions), a single scattered comment is not enough.

**Options:**

- Use a central `designNotes.md` file and reference it from related code
- Put the canonical explanation in the most relevant type definition or module entry point
- Use `// See: <file>#<section>` references to point readers to the canonical source

```typescript
// designNotes.md — canonical location for cross-cutting decisions

// In individual files:
// Node IDs are ULIDs, not UUIDs. See designNotes.md#id-format for rationale.
const nodeId: string;
```

---

## Comment Quality Checklist

Before committing, verify each comment:

- [ ] Does it say something the code cannot already express?
- [ ] Interface comments: describe **what**, not **how**?
- [ ] Variable comments: clarify units, nullability, ownership, or bounds?
- [ ] High-level comments: explain intent, not steps?
- [ ] Is the comment still accurate after the latest code change?
- [ ] Is this design decision documented in exactly one place?
- [ ] Would a new developer understand the abstraction from the interface comment alone?

---

## Anti-Pattern Reference

| Anti-pattern                                        | Problem                    | Fix                               |
| --------------------------------------------------- | -------------------------- | --------------------------------- |
| `// increment count` before `count++`               | Restates the code          | Delete it                         |
| Interface comment mentions internal data structures | Leaks implementation       | Describe behavior only            |
| Comment 30 lines away from the code it describes    | Goes stale silently        | Move it next to the code          |
| Same explanation copy-pasted to three files         | Gets out of sync           | One canonical source + references |
| Complex method with no interface comment            | Caller must read internals | Write the contract                |
| Comment explains what; code makes it obvious        | Zero added value           | Delete or explain why             |

---

**Remember**: The goal of comments is to make the code _obvious_ — to reduce the cognitive load on anyone who reads it next. Write the comment you wish existed when you first opened the file.
