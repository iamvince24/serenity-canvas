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
