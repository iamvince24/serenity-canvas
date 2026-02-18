export type TiptapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type TiptapJSONContent = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapJSONContent[];
  marks?: TiptapMark[];
  text?: string;
};

const INLINE_TOKEN_PATTERN =
  /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|_([^_]+)_|\*([^*]+)\*|`([^`]+)`)/g;

function pushPlainTextNodes(
  target: TiptapJSONContent[],
  text: string,
  marks: TiptapMark[] = [],
): void {
  const lines = text.split("\n");
  const nodeMarks = marks.length > 0 ? marks : undefined;

  lines.forEach((line, index) => {
    if (line.length > 0) {
      target.push({ type: "text", text: line, marks: nodeMarks });
    }

    if (index < lines.length - 1) {
      target.push({ type: "hardBreak" });
    }
  });
}

function parseInlineText(
  text: string,
  activeMarks: TiptapMark[] = [],
): TiptapJSONContent[] {
  const nodes: TiptapJSONContent[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE_TOKEN_PATTERN)) {
    const fullMatch = match[0];
    const start = match.index ?? 0;

    if (start > cursor) {
      pushPlainTextNodes(nodes, text.slice(cursor, start), activeMarks);
    }

    if (match[2] && match[3]) {
      const href = match[3].trim();
      nodes.push(
        ...parseInlineText(match[2], [
          ...activeMarks,
          { type: "link", attrs: { href } },
        ]),
      );
    } else if (match[4]) {
      nodes.push(
        ...parseInlineText(match[4], [...activeMarks, { type: "bold" }]),
      );
    } else if (match[5] || match[6]) {
      nodes.push(
        ...parseInlineText(match[5] ?? match[6] ?? "", [
          ...activeMarks,
          { type: "italic" },
        ]),
      );
    } else if (match[7]) {
      pushPlainTextNodes(nodes, match[7], [...activeMarks, { type: "code" }]);
    } else {
      pushPlainTextNodes(nodes, fullMatch, activeMarks);
    }

    cursor = start + fullMatch.length;
  }

  if (cursor < text.length) {
    pushPlainTextNodes(nodes, text.slice(cursor), activeMarks);
  }

  return nodes;
}

function paragraphFromText(text: string): TiptapJSONContent {
  const content = parseInlineText(text);
  return content.length > 0
    ? { type: "paragraph", content }
    : { type: "paragraph" };
}

function isListBoundary(line: string): boolean {
  return (
    /^#{1,6}\s+/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^```/.test(line)
  );
}

function parseBlocks(markdown: string): TiptapJSONContent[] {
  const lines = markdown.split("\n");
  const blocks: TiptapJSONContent[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    const codeFence = line.match(/^```(\w+)?\s*$/);
    if (codeFence) {
      const codeLines: string[] = [];
      const language = codeFence[1];
      index += 1;

      while (index < lines.length && !/^```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length && /^```/.test(lines[index])) {
        index += 1;
      }

      const codeText = codeLines.join("\n");
      blocks.push({
        type: "codeBlock",
        attrs: language ? { language } : undefined,
        content:
          codeText.length > 0 ? [{ type: "text", text: codeText }] : undefined,
      });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = parseInlineText(headingMatch[2]);
      blocks.push({
        type: "heading",
        attrs: { level },
        content: content.length > 0 ? content : undefined,
      });
      index += 1;
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: TiptapJSONContent[] = [];

      while (index < lines.length) {
        const bulletMatch = lines[index].match(/^\s*[-*+]\s+(.+)$/);
        if (!bulletMatch) {
          break;
        }

        items.push({
          type: "listItem",
          content: [paragraphFromText(bulletMatch[1])],
        });
        index += 1;
      }

      blocks.push({ type: "bulletList", content: items });
      continue;
    }

    const orderedMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      const start = Number(orderedMatch[1]);
      const items: TiptapJSONContent[] = [];

      while (index < lines.length) {
        const itemMatch = lines[index].match(/^\s*(\d+)\.\s+(.+)$/);
        if (!itemMatch) {
          break;
        }

        items.push({
          type: "listItem",
          content: [paragraphFromText(itemMatch[2])],
        });
        index += 1;
      }

      blocks.push({
        type: "orderedList",
        attrs: start !== 1 ? { start } : undefined,
        content: items,
      });
      continue;
    }

    const paragraphLines = [line];
    index += 1;

    while (
      index < lines.length &&
      lines[index].trim().length > 0 &&
      !isListBoundary(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(paragraphFromText(paragraphLines.join("\n")));
  }

  return blocks;
}

function markSortWeight(type: string): number {
  if (type === "code") {
    return 1;
  }

  if (type === "bold" || type === "strong") {
    return 2;
  }

  if (type === "italic" || type === "em") {
    return 3;
  }

  if (type === "link") {
    return 4;
  }

  return 10;
}

function applyMarks(text: string, marks: TiptapMark[] | undefined): string {
  if (!marks || marks.length === 0) {
    return text;
  }

  const sortedMarks = [...marks].sort(
    (left, right) => markSortWeight(left.type) - markSortWeight(right.type),
  );

  return sortedMarks.reduce((result, mark) => {
    if (mark.type === "code") {
      return `\`${result}\``;
    }

    if (mark.type === "bold" || mark.type === "strong") {
      return `**${result}**`;
    }

    if (mark.type === "italic" || mark.type === "em") {
      return `_${result}_`;
    }

    if (mark.type === "link") {
      const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "";
      return href.length > 0 ? `[${result}](${href})` : result;
    }

    return result;
  }, text);
}

function extractText(node: TiptapJSONContent): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  if (node.type === "hardBreak") {
    return "\n";
  }

  return (node.content ?? []).map((child) => extractText(child)).join("");
}

function serializeInline(nodes: TiptapJSONContent[] | undefined): string {
  if (!nodes || nodes.length === 0) {
    return "";
  }

  return nodes
    .map((node) => {
      if (node.type === "hardBreak") {
        return "  \n";
      }

      if (node.type === "text") {
        return applyMarks(node.text ?? "", node.marks);
      }

      return serializeInline(node.content);
    })
    .join("");
}

function serializeListItem(node: TiptapJSONContent): string {
  const blocks = (node.content ?? [])
    .map((child) => serializeBlock(child))
    .filter((text) => text.length > 0);

  if (blocks.length === 0) {
    return "";
  }

  if (blocks.length === 1) {
    return blocks[0];
  }

  const [firstBlock, ...remainingBlocks] = blocks;
  const indentedRemainder = remainingBlocks
    .map((block) =>
      block
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n"),
    )
    .join("\n");

  return `${firstBlock}\n${indentedRemainder}`;
}

function serializeBlock(node: TiptapJSONContent): string {
  if (node.type === "paragraph") {
    return serializeInline(node.content);
  }

  if (node.type === "heading") {
    const rawLevel = node.attrs?.level;
    const level =
      typeof rawLevel === "number" ? Math.max(1, Math.min(rawLevel, 6)) : 1;
    return `${"#".repeat(level)} ${serializeInline(node.content)}`.trimEnd();
  }

  if (node.type === "bulletList") {
    return (node.content ?? [])
      .map((item) => `- ${serializeListItem(item)}`.trimEnd())
      .join("\n");
  }

  if (node.type === "orderedList") {
    const rawStart = node.attrs?.start;
    const start = typeof rawStart === "number" ? rawStart : 1;
    return (node.content ?? [])
      .map((item, offset) =>
        `${start + offset}. ${serializeListItem(item)}`.trimEnd(),
      )
      .join("\n");
  }

  if (node.type === "codeBlock") {
    const language =
      typeof node.attrs?.language === "string" && node.attrs.language.length > 0
        ? node.attrs.language
        : "";
    const codeText = extractText(node).replace(/\n+$/g, "");
    return `\`\`\`${language}\n${codeText}\n\`\`\``;
  }

  if (node.type === "blockquote") {
    const blockContent = (node.content ?? [])
      .map((child) => serializeBlock(child))
      .filter((text) => text.length > 0)
      .join("\n");
    return blockContent
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }

  if (node.type === "horizontalRule") {
    return "---";
  }

  return extractText(node);
}

export function markdownToTiptapDoc(markdown: string): TiptapJSONContent {
  const normalizedMarkdown = markdown.replace(/\r\n?/g, "\n");
  const blocks = parseBlocks(normalizedMarkdown);

  if (blocks.length === 0) {
    return {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
  }

  return {
    type: "doc",
    content: blocks,
  };
}

export function tiptapDocToMarkdown(doc: TiptapJSONContent): string {
  if (doc.type !== "doc") {
    throw new Error("Expected a ProseMirror doc node as root.");
  }

  const blocks = (doc.content ?? [])
    .map((block) => serializeBlock(block))
    .filter((block) => block.length > 0);

  return blocks.join("\n\n").trim();
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/```[^\n]*\n?/g, "").replace(/```/g, ""),
    )
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "- ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
