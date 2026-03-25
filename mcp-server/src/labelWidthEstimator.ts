/**
 * Server-side edge label dimension estimation.
 *
 * Mirrors the frontend layout logic in
 *   src/features/canvas/edges/edgeLabelLayout.ts
 * so that MCP clients can account for label size when positioning cards.
 */

const EDGE_LABEL_FONT_SIZE = 12;
const EDGE_LABEL_PADDING_X = 8;
const EDGE_LABEL_PADDING_Y = 4;
const EDGE_LABEL_LINE_HEIGHT = 1.25;

const LABEL_MAX_WIDTH = 300;
const LABEL_MIN_TEXT_WIDTH = 24;
const LABEL_MIN_CHARS_PER_LINE = 4;

// CJK character ranges: Chinese, Japanese, Korean and related blocks
const CJK_REGEX =
  /[\u2E80-\u2EFF\u2F00-\u2FDF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3200-\u32FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA48F\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]/;

/** Compute the rendered pixel width of a string, accounting for CJK characters. */
function measureTextWidth(text: string): number {
  const latinCharWidth = EDGE_LABEL_FONT_SIZE * 0.62;
  const cjkCharWidth = EDGE_LABEL_FONT_SIZE * 1.0; // CJK cells are square at this font size

  let width = 0;
  for (const ch of text) {
    width += CJK_REGEX.test(ch) ? cjkCharWidth : latinCharWidth;
  }
  return width;
}

/** Effective "char width" used for line-wrapping budgets (worst-case: all Latin). */
const AVERAGE_CHAR_WIDTH = EDGE_LABEL_FONT_SIZE * 0.62;

export type LabelDimensions = {
  width: number;
  height: number;
};

/**
 * Estimate the rendered dimensions (width × height) of an edge label.
 * Returns null for empty labels.
 */
export function estimateLabelDimensions(label: string): LabelDimensions | null {
  const text = label.trim();
  if (!text) return null;

  const maxCharsPerLine = Math.max(
    LABEL_MIN_CHARS_PER_LINE,
    Math.floor(
      (LABEL_MAX_WIDTH - EDGE_LABEL_PADDING_X * 2) / AVERAGE_CHAR_WIDTH,
    ),
  );

  const rawLines = text.split("\n");
  let wrappedLineCount = 0;
  let longestLineWidth = 0; // in pixels, not chars

  for (const rawLine of rawLines) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) {
      wrappedLineCount += 1;
      longestLineWidth = Math.max(longestLineWidth, LABEL_MIN_TEXT_WIDTH);
      continue;
    }

    const words = trimmedLine.split(/\s+/);
    let currentLineChars = 0;
    let currentLineWidth = 0;

    for (const word of words) {
      const wordLength = word.length;
      const wordWidth = measureTextWidth(word);
      if (wordLength > maxCharsPerLine) {
        if (currentLineChars > 0) {
          wrappedLineCount += 1;
          longestLineWidth = Math.max(longestLineWidth, currentLineWidth);
          currentLineChars = 0;
          currentLineWidth = 0;
        }
        const fullLineCount = Math.floor(wordLength / maxCharsPerLine);
        const remainder = wordLength % maxCharsPerLine;
        wrappedLineCount += fullLineCount;
        longestLineWidth = Math.max(
          longestLineWidth,
          LABEL_MAX_WIDTH - EDGE_LABEL_PADDING_X * 2,
        );
        currentLineChars = remainder;
        currentLineWidth = measureTextWidth(
          word.slice(fullLineCount * maxCharsPerLine),
        );
        continue;
      }

      if (currentLineChars === 0) {
        currentLineChars = wordLength;
        currentLineWidth = wordWidth;
        continue;
      }

      if (currentLineChars + 1 + wordLength <= maxCharsPerLine) {
        currentLineChars += 1 + wordLength;
        currentLineWidth += AVERAGE_CHAR_WIDTH + wordWidth; // space + word
      } else {
        wrappedLineCount += 1;
        longestLineWidth = Math.max(longestLineWidth, currentLineWidth);
        currentLineChars = wordLength;
        currentLineWidth = wordWidth;
      }
    }

    wrappedLineCount += 1;
    longestLineWidth = Math.max(longestLineWidth, currentLineWidth);
  }

  const textWidth = Math.max(LABEL_MIN_TEXT_WIDTH, Math.ceil(longestLineWidth));
  const lineHeightPixels = Math.ceil(
    EDGE_LABEL_FONT_SIZE * EDGE_LABEL_LINE_HEIGHT,
  );
  const textHeight = Math.max(
    lineHeightPixels,
    wrappedLineCount * lineHeightPixels,
  );

  const width = Math.min(textWidth + EDGE_LABEL_PADDING_X * 2, LABEL_MAX_WIDTH);
  const height = textHeight + EDGE_LABEL_PADDING_Y * 2;

  return { width, height };
}
