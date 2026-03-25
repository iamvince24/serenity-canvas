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

  const averageCharacterWidth = EDGE_LABEL_FONT_SIZE * 0.62;
  const maxCharsPerLine = Math.max(
    LABEL_MIN_CHARS_PER_LINE,
    Math.floor(
      (LABEL_MAX_WIDTH - EDGE_LABEL_PADDING_X * 2) / averageCharacterWidth,
    ),
  );

  const rawLines = text.split("\n");
  let wrappedLineCount = 0;
  let longestLineChars = 0;

  for (const rawLine of rawLines) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) {
      wrappedLineCount += 1;
      longestLineChars = Math.max(longestLineChars, LABEL_MIN_CHARS_PER_LINE);
      continue;
    }

    const words = trimmedLine.split(/\s+/);
    let currentLineChars = 0;

    for (const word of words) {
      const wordLength = word.length;
      if (wordLength > maxCharsPerLine) {
        if (currentLineChars > 0) {
          wrappedLineCount += 1;
          longestLineChars = Math.max(longestLineChars, currentLineChars);
          currentLineChars = 0;
        }
        const fullLineCount = Math.floor(wordLength / maxCharsPerLine);
        const remainder = wordLength % maxCharsPerLine;
        wrappedLineCount += fullLineCount;
        longestLineChars = Math.max(longestLineChars, maxCharsPerLine);
        currentLineChars = remainder;
        continue;
      }

      if (currentLineChars === 0) {
        currentLineChars = wordLength;
        continue;
      }

      if (currentLineChars + 1 + wordLength <= maxCharsPerLine) {
        currentLineChars += 1 + wordLength;
      } else {
        wrappedLineCount += 1;
        longestLineChars = Math.max(longestLineChars, currentLineChars);
        currentLineChars = wordLength;
      }
    }

    wrappedLineCount += 1;
    longestLineChars = Math.max(longestLineChars, currentLineChars);
  }

  const textWidth = Math.max(
    LABEL_MIN_TEXT_WIDTH,
    Math.ceil(longestLineChars * averageCharacterWidth),
  );
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
