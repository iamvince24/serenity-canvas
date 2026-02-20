export type EdgeLabelLayout = {
  text: string;
  width: number;
  height: number;
  textWidth: number;
  textHeight: number;
};

export const EDGE_LABEL_FONT_SIZE = 12;
export const EDGE_LABEL_PADDING_X = 8;
export const EDGE_LABEL_PADDING_Y = 4;
export const EDGE_LABEL_LINE_HEIGHT = 1.25;

const LABEL_MAX_WIDTH = 300;
const LABEL_MIN_TEXT_WIDTH = 24;
const LABEL_MIN_CHARS_PER_LINE = 4;

function measureLabelLayout(text: string): {
  textWidth: number;
  textHeight: number;
} {
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

  return {
    textWidth,
    textHeight,
  };
}

export function getEdgeLabelLayout(label: string): EdgeLabelLayout | null {
  const text = label.trim();
  if (!text) {
    return null;
  }

  const layout = measureLabelLayout(text);
  const width = Math.min(
    layout.textWidth + EDGE_LABEL_PADDING_X * 2,
    LABEL_MAX_WIDTH,
  );
  const textWidth = width - EDGE_LABEL_PADDING_X * 2;
  const height = layout.textHeight + EDGE_LABEL_PADDING_Y * 2;

  return {
    text,
    width,
    height,
    textWidth,
    textHeight: layout.textHeight,
  };
}
