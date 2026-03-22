import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { HighlightMark } from "../editor/highlightExtension";

function createEditor(content?: string) {
  return new Editor({
    extensions: [StarterKit, HighlightMark],
    content: content ?? "<p>hello world</p>",
  });
}

describe("HighlightMark extension", () => {
  it("setHighlight applies highlight mark with color", () => {
    const editor = createEditor();
    editor.commands.selectAll();
    editor.commands.setHighlight({ color: "#D6E0CE" });

    const json = editor.getJSON();
    const textNode = json.content?.[0]?.content?.[0];
    expect(textNode?.marks).toEqual([
      { type: "highlight", attrs: { color: "#D6E0CE" } },
    ]);

    editor.destroy();
  });

  it("unsetHighlight removes highlight mark", () => {
    const editor = createEditor(
      '<p><mark data-hl-color="#D6E0CE" style="background-color: #D6E0CE">hello</mark></p>',
    );
    editor.commands.selectAll();
    editor.commands.unsetHighlight();

    const json = editor.getJSON();
    const textNode = json.content?.[0]?.content?.[0];
    expect(textNode?.marks).toBeUndefined();

    editor.destroy();
  });

  it("toggleHighlight toggles the mark on/off", () => {
    const editor = createEditor();
    editor.commands.selectAll();

    editor.commands.toggleHighlight({ color: "#F0D0CE" });
    let textNode = editor.getJSON().content?.[0]?.content?.[0];
    expect(textNode?.marks).toEqual([
      { type: "highlight", attrs: { color: "#F0D0CE" } },
    ]);

    editor.commands.toggleHighlight({ color: "#F0D0CE" });
    textNode = editor.getJSON().content?.[0]?.content?.[0];
    expect(textNode?.marks).toBeUndefined();

    editor.destroy();
  });

  it("parseHTML correctly reads data-hl-color attribute", () => {
    const editor = createEditor(
      '<p><mark data-hl-color="#AABBCC" style="background-color: #AABBCC">test</mark></p>',
    );

    const json = editor.getJSON();
    const textNode = json.content?.[0]?.content?.[0];
    expect(textNode?.text).toBe("test");
    expect(textNode?.marks).toEqual([
      { type: "highlight", attrs: { color: "#AABBCC" } },
    ]);

    editor.destroy();
  });

  it("renderHTML produces correct mark element", () => {
    const editor = createEditor();
    editor.commands.selectAll();
    editor.commands.setHighlight({ color: "#D6E0CE" });

    const html = editor.getHTML();
    expect(html).toContain('data-hl-color="#D6E0CE"');
    expect(html).toContain("background-color:");
    expect(html).toContain("<mark");

    editor.destroy();
  });
});
