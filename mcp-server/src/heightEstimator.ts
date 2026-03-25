/**
 * Server-side height estimation for text cards.
 *
 * Mirrors the frontend auto-height behavior:
 *   nextHeight = Math.max(DEFAULT_NODE_HEIGHT, scrollHeight)
 * where DEFAULT_NODE_HEIGHT = 240 (from src/features/canvas/core/constants.ts).
 *
 * This ensures the height stored in the DB is close to the actual rendered
 * height, so AI clients can position cards accurately.
 */

const DEFAULT_NODE_HEIGHT = 240;

// Approximate pixel values matching Tiptap/ProseMirror rendered output
const HEADING_H1_PX = 36;
const HEADING_H2_PX = 28;
const HEADING_H3_PX = 24;
const BODY_LINE_PX = 22;
const CODE_LINE_PX = 18;
const LIST_ITEM_PX = 24;
const BLOCKQUOTE_LINE_PX = 22;
const TABLE_HEADER_PX = 36;
const TABLE_ROW_PX = 32;
const BLANK_LINE_PX = 12;
const PADDING_VERTICAL = 48; // top + bottom padding
const CODE_BLOCK_PADDING = 16; // top + bottom within fenced block

/**
 * Estimate the rendered height of a markdown text card in canvas units.
 * Returns at least DEFAULT_NODE_HEIGHT (240) to match frontend behavior.
 */
export function estimateContentHeight(markdown: string): number {
  if (!markdown || !markdown.trim()) return DEFAULT_NODE_HEIGHT;

  const lines = markdown.split("\n");
  let totalHeight = PADDING_VERTICAL;
  let inCodeBlock = false;
  let codeBlockLines = 0;
  let inTable = false;
  let isFirstTableRow = true;

  for (const line of lines) {
    const trimmed = line.trim();

    // --- Code block toggle ---
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        // End code block: accumulate code lines + block padding
        totalHeight += codeBlockLines * CODE_LINE_PX + CODE_BLOCK_PADDING;
        codeBlockLines = 0;
      }
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      codeBlockLines++;
      continue;
    }

    // --- Empty line ---
    if (!trimmed) {
      totalHeight += BLANK_LINE_PX;
      continue;
    }

    // --- Table ---
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Separator row (e.g., |---|---|)
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) continue;

      if (!inTable || isFirstTableRow) {
        inTable = true;
        isFirstTableRow = false;
        totalHeight += TABLE_HEADER_PX;
      } else {
        totalHeight += TABLE_ROW_PX;
      }
      continue;
    }
    if (inTable) {
      inTable = false;
      isFirstTableRow = true;
    }

    // --- Headings ---
    if (trimmed.startsWith("# ")) {
      totalHeight += HEADING_H1_PX;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      totalHeight += HEADING_H2_PX;
      continue;
    }
    if (trimmed.startsWith("### ") || trimmed.startsWith("#### ")) {
      totalHeight += HEADING_H3_PX;
      continue;
    }

    // --- List items ---
    if (/^[-*+] /.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      totalHeight += LIST_ITEM_PX;
      continue;
    }

    // --- Blockquote ---
    if (trimmed.startsWith("> ")) {
      totalHeight += BLOCKQUOTE_LINE_PX;
      continue;
    }

    // --- Regular body text ---
    totalHeight += BODY_LINE_PX;
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockLines > 0) {
    totalHeight += codeBlockLines * CODE_LINE_PX + CODE_BLOCK_PADDING;
  }

  return Math.max(DEFAULT_NODE_HEIGHT, totalHeight);
}
