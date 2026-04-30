import sanitize from "sanitize-filename";

const DEFAULT_IMAGE_CAPTION = "新增說明文字…";

/** 判斷內容是否為 nodeFactory 的預設佔位說明文字。 */
export function isDefaultCaption(content: string): boolean {
  return content.trim() === DEFAULT_IMAGE_CAPTION;
}

/**
 * 提取 markdown 的第一行有意義的文字，移除標題標記，
 * 淨化為可用的檔名，並截斷至 `maxLength` 字元。
 */
export function slugifyFirstLine(
  markdown: string,
  fallback: string,
  maxLength = 50,
): string {
  const firstLine = markdown.split("\n").find((l) => l.trim().length > 0);
  if (!firstLine) return fallback;

  // 移除標題標記與行內格式
  const cleaned = firstLine
    .replace(/^#{1,6}\s+/, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();

  if (cleaned.length === 0) return fallback;

  const sanitized = sanitize(cleaned).trim();
  if (sanitized.length === 0) return fallback;

  return sanitized.length > maxLength
    ? sanitized.slice(0, maxLength).trimEnd()
    : sanitized;
}

/**
 * 確保 `baseName` 在 `usedNames` 中唯一。
 * 重複時加上 ` 2`、` 3` 等後綴。
 */
export function resolveUniqueFilename(
  baseName: string,
  usedNames: Set<string>,
): string {
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }

  let counter = 2;
  while (usedNames.has(`${baseName} ${counter}`)) {
    counter++;
  }

  const unique = `${baseName} ${counter}`;
  usedNames.add(unique);
  return unique;
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** 根據 MIME 類型回傳 `{assetId}.{ext}`。預設為 `webp`。 */
export function imageFileName(assetId: string, mimeType: string): string {
  const ext = MIME_TO_EXT[mimeType] ?? "webp";
  return `${assetId}.${ext}`;
}

/** 淨化白板標題並附加 `.canvas` 副檔名。 */
export function canvasFileName(boardTitle: string): string {
  const sanitized = sanitize(boardTitle).trim();
  const name = sanitized.length > 0 ? sanitized : "未命名";
  return `${name}.canvas`;
}
