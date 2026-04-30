import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageBlockExtension } from "../images/imageBlockExtension";

vi.mock("@tiptap/react", () => ({
  ReactNodeViewRenderer: () => () => ({
    dom: document.createElement("div"),
  }),
}));

describe("ImageBlockExtension", () => {
  let editor: Editor | null = null;

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it("setImageBlock command 會插入 imageBlock 節點", () => {
    editor = new Editor({
      extensions: [StarterKit, ImageBlockExtension],
      content: "<p>hello</p>",
    });

    const inserted = editor.commands.setImageBlock({
      assetId: "abc123",
      alt: "封面",
    });

    expect(inserted).toBe(true);
    const imageNode = editor
      .getJSON()
      .content?.find((node) => node.type === "imageBlock");
    expect(imageNode).toMatchObject({
      type: "imageBlock",
      attrs: {
        assetId: "abc123",
        alt: "封面",
      },
    });
  });

  it("assetId 缺失時 command 回傳 false", () => {
    editor = new Editor({
      extensions: [StarterKit, ImageBlockExtension],
      content: "<p>hello</p>",
    });

    const inserted = editor.commands.setImageBlock({
      assetId: "",
      alt: "x",
    });

    expect(inserted).toBe(false);
    const imageNodes =
      editor.getJSON().content?.filter((node) => node.type === "imageBlock") ??
      [];
    expect(imageNodes).toHaveLength(0);
  });
});
