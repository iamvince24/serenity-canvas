import { describe, expect, it } from "vitest";
import {
  extractAssetIdsFromMarkdown,
  markdownToPlainText,
  markdownToTiptapDoc,
  tiptapDocToMarkdown,
} from "../editor/markdownCodec";

describe("markdownCodec imageBlock", () => {
  it("asset image markdown 可 round-trip", () => {
    const markdown = "![封面](asset:abc123)";

    const doc = markdownToTiptapDoc(markdown);
    expect(doc).toMatchObject({
      type: "doc",
      content: [
        {
          type: "imageBlock",
          attrs: {
            alt: "封面",
            assetId: "abc123",
          },
        },
      ],
    });

    expect(tiptapDocToMarkdown(doc)).toBe(markdown);
  });

  it("混合段落與 imageBlock 可正確 parse + serialize", () => {
    const markdown = "段落 A\n\n![示意圖](asset:a551001)\n\n段落 B";

    const doc = markdownToTiptapDoc(markdown);
    expect(doc.content?.map((node) => node.type)).toEqual([
      "paragraph",
      "imageBlock",
      "paragraph",
    ]);

    expect(tiptapDocToMarkdown(doc)).toBe(markdown);
  });

  it("extractAssetIdsFromMarkdown 可提取多個資產引用", () => {
    const markdown = [
      "段落",
      "",
      "![a](asset:aaa111)",
      "![b](asset:bbb222)",
      "![c](https://example.com/c.png)",
    ].join("\n");

    expect(extractAssetIdsFromMarkdown(markdown)).toEqual(["aaa111", "bbb222"]);
  });

  it("markdownToPlainText 會移除 asset 圖片語法且不殘留 !", () => {
    const markdown =
      "開始\n\n![替代文字](asset:1ab001)\n\n[連結](https://example.com)";

    const plainText = markdownToPlainText(markdown);
    expect(plainText).not.toContain("asset:");
    expect(plainText).not.toContain("!");
    expect(plainText).toContain("開始");
    expect(plainText).toContain("連結");
  });
});

describe("markdownCodec highlight", () => {
  it("highlight with color can round-trip", () => {
    const markdown = "==重要文字=={#D6E0CE}";

    const doc = markdownToTiptapDoc(markdown);
    expect(doc).toMatchObject({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "重要文字",
              marks: [{ type: "highlight", attrs: { color: "#D6E0CE" } }],
            },
          ],
        },
      ],
    });

    expect(tiptapDocToMarkdown(doc)).toBe(markdown);
  });

  it("highlight without color can round-trip", () => {
    const markdown = "==plain highlight==";

    const doc = markdownToTiptapDoc(markdown);
    expect(doc).toMatchObject({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "plain highlight",
              marks: [{ type: "highlight" }],
            },
          ],
        },
      ],
    });

    expect(tiptapDocToMarkdown(doc)).toBe(markdown);
  });

  it("highlight wrapping bold/italic text", () => {
    const markdown = "==**bold text**=={#F0D0CE}";

    const doc = markdownToTiptapDoc(markdown);
    const textNode = doc.content?.[0]?.content?.[0];
    expect(textNode?.text).toBe("bold text");
    expect(textNode?.marks).toEqual(
      expect.arrayContaining([
        { type: "bold" },
        { type: "highlight", attrs: { color: "#F0D0CE" } },
      ]),
    );

    expect(tiptapDocToMarkdown(doc)).toBe(markdown);
  });

  it("highlight in heading", () => {
    const markdown = "## ==title=={#D6E0CE}";

    const doc = markdownToTiptapDoc(markdown);
    expect(doc.content?.[0]?.type).toBe("heading");
    expect(doc.content?.[0]?.content?.[0]?.marks).toEqual(
      expect.arrayContaining([
        { type: "highlight", attrs: { color: "#D6E0CE" } },
      ]),
    );

    expect(tiptapDocToMarkdown(doc)).toBe(markdown);
  });

  it("markdownToPlainText removes highlight syntax", () => {
    const markdown = "前文 ==highlighted=={#D6E0CE} 後文";
    const plainText = markdownToPlainText(markdown);
    expect(plainText).toBe("前文 highlighted 後文");
    expect(plainText).not.toContain("==");
    expect(plainText).not.toContain("{#");
  });

  it("multiple highlights in same paragraph", () => {
    const markdown = "==first=={#D6E0CE} normal ==second=={#F2E4D4}";

    const doc = markdownToTiptapDoc(markdown);
    const content = doc.content?.[0]?.content;
    expect(content).toHaveLength(3);
    expect(content?.[0]?.marks?.[0]?.type).toBe("highlight");
    expect(content?.[1]?.marks).toBeUndefined();
    expect(content?.[2]?.marks?.[0]?.type).toBe("highlight");

    expect(tiptapDocToMarkdown(doc)).toBe(markdown);
  });
});
