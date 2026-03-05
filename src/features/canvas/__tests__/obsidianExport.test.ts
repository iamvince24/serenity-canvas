import { describe, expect, it } from "vitest";
import {
  isDefaultCaption,
  slugifyFirstLine,
  resolveUniqueFilename,
  imageFileName,
  canvasFileName,
} from "../export/exportFilenaming";
import {
  buildObsidianExport,
  type BuilderInput,
} from "../export/obsidianCanvasBuilder";
import type {
  Edge,
  FileRecord,
  Group,
  TextNode,
  ImageNode,
} from "@/types/canvas";
import type {
  ObsidianFileNode,
  ObsidianGroupNode,
  ObsidianTextNode,
} from "../export/obsidianExport.types";

// ─── 匯出檔名工具 ───

describe("isDefaultCaption", () => {
  it("returns true for the placeholder text", () => {
    expect(isDefaultCaption("Add a caption...")).toBe(true);
    expect(isDefaultCaption("  Add a caption...  ")).toBe(true);
  });

  it("returns false for real content", () => {
    expect(isDefaultCaption("My photo")).toBe(false);
    expect(isDefaultCaption("")).toBe(false);
  });
});

describe("slugifyFirstLine", () => {
  it("strips heading markers", () => {
    expect(slugifyFirstLine("# Hello World", "fallback")).toBe("Hello World");
    expect(slugifyFirstLine("## Sub heading", "fallback")).toBe("Sub heading");
  });

  it("truncates to maxLength", () => {
    const long = "A".repeat(100);
    const result = slugifyFirstLine(long, "fallback", 50);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("returns fallback for empty string", () => {
    expect(slugifyFirstLine("", "Card")).toBe("Card");
    expect(slugifyFirstLine("   \n  \n  ", "Card")).toBe("Card");
  });

  it("handles CJK characters", () => {
    const result = slugifyFirstLine("# 你好世界", "Card");
    expect(result).toBe("你好世界");
  });

  it("strips inline formatting", () => {
    expect(slugifyFirstLine("**bold** and _italic_", "Card")).toBe(
      "bold and italic",
    );
  });

  it("strips markdown links", () => {
    expect(slugifyFirstLine("[link](http://example.com) text", "Card")).toBe(
      "link text",
    );
  });

  it("strips image references", () => {
    expect(slugifyFirstLine("![alt](asset:abc123)", "Card")).toBe("Card");
  });
});

describe("resolveUniqueFilename", () => {
  it("returns baseName when not taken", () => {
    const used = new Set<string>();
    expect(resolveUniqueFilename("Card", used)).toBe("Card");
    expect(used.has("Card")).toBe(true);
  });

  it("adds suffix on collision", () => {
    const used = new Set(["Card"]);
    expect(resolveUniqueFilename("Card", used)).toBe("Card 2");
  });

  it("increments suffix for multiple collisions", () => {
    const used = new Set(["Card", "Card 2", "Card 3"]);
    expect(resolveUniqueFilename("Card", used)).toBe("Card 4");
  });
});

describe("imageFileName", () => {
  it("maps MIME types to extensions", () => {
    expect(imageFileName("abc", "image/jpeg")).toBe("abc.jpg");
    expect(imageFileName("abc", "image/png")).toBe("abc.png");
    expect(imageFileName("abc", "image/gif")).toBe("abc.gif");
    expect(imageFileName("abc", "image/webp")).toBe("abc.webp");
  });

  it("defaults to webp for unknown MIME", () => {
    expect(imageFileName("abc", "image/bmp")).toBe("abc.webp");
  });
});

describe("canvasFileName", () => {
  it("appends .canvas", () => {
    expect(canvasFileName("My Board")).toBe("My Board.canvas");
  });

  it("uses Untitled for empty", () => {
    expect(canvasFileName("")).toBe("Untitled.canvas");
  });

  it("sanitizes unsafe characters", () => {
    const result = canvasFileName("my/board:name");
    expect(result).not.toContain("/");
    expect(result).not.toContain(":");
    expect(result).toMatch(/\.canvas$/);
  });
});

// ─── Obsidian Canvas 建構器 ───

function makeTextNode(overrides: Partial<TextNode> = {}): TextNode {
  return {
    id: "t1",
    type: "text",
    x: 0,
    y: 0,
    width: 200,
    height: 150,
    heightMode: "auto",
    contentMarkdown: "Hello",
    color: null,
    ...overrides,
  };
}

function makeImageNode(overrides: Partial<ImageNode> = {}): ImageNode {
  return {
    id: "i1",
    type: "image",
    x: 300,
    y: 0,
    width: 200,
    height: 200,
    heightMode: "fixed",
    content: "Add a caption...",
    asset_id: "asset123",
    color: null,
    ...overrides,
  };
}

function makeEdge(overrides: Partial<Edge> = {}): Edge {
  return {
    id: "e1",
    fromNode: "t1",
    toNode: "i1",
    direction: "forward",
    label: "",
    lineStyle: "solid",
    color: null,
    ...overrides,
  };
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: "g1",
    label: "Group 1",
    color: null,
    nodeIds: ["t1"],
    ...overrides,
  };
}

function makeFileRecord(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: "f1",
    asset_id: "asset123",
    mime_type: "image/webp",
    original_width: 800,
    original_height: 600,
    byte_size: 50000,
    created_at: Date.now(),
    ...overrides,
  };
}

function makeInput(overrides: Partial<BuilderInput> = {}): BuilderInput {
  const textNode = makeTextNode();
  const imageNode = makeImageNode();
  return {
    nodes: { t1: textNode, i1: imageNode },
    nodeOrder: ["t1", "i1"],
    edges: {},
    groups: {},
    files: { f1: makeFileRecord() },
    ...overrides,
  };
}

describe("buildObsidianExport", () => {
  it("generates 16-char hex IDs for all nodes and edges", () => {
    const input = makeInput({
      edges: { e1: makeEdge() },
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(
      input,
      "Test",
      new Map([["asset123", "image/webp"]]),
      logLines,
    );

    for (const node of result.canvasJson.nodes) {
      expect(node.id).toMatch(/^[a-f0-9]{16}$/);
    }
    for (const edge of result.canvasJson.edges) {
      expect(edge.id).toMatch(/^[a-f0-9]{16}$/);
      expect(edge.fromNode).toMatch(/^[a-f0-9]{16}$/);
      expect(edge.toNode).toMatch(/^[a-f0-9]{16}$/);
    }
  });

  it("renders text nodes as inline type:text", () => {
    const input = makeInput();
    const logLines: string[] = [];
    const result = buildObsidianExport(
      input,
      "Test Board",
      new Map([["asset123", "image/webp"]]),
      logLines,
    );

    const textNode = result.canvasJson.nodes.find(
      (n) => n.type === "text" && (n as ObsidianTextNode).text === "Hello",
    ) as ObsidianTextNode | undefined;
    expect(textNode).toBeDefined();
  });

  it("renders image nodes with caption as inline type:text", () => {
    const imageNode = makeImageNode({ content: "My photo description" });
    const input = makeInput({
      nodes: { i1: imageNode },
      nodeOrder: ["i1"],
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(
      input,
      "Test",
      new Map([["asset123", "image/webp"]]),
      logLines,
    );

    const node = result.canvasJson.nodes.find((n) => n.type === "text") as
      | ObsidianTextNode
      | undefined;
    expect(node).toBeDefined();
    expect(node!.text).toContain("![[Test/assets/asset123.webp]]");
    expect(node!.text).toContain("My photo description");
  });

  it("renders image nodes with default caption as type:file", () => {
    const imageNode = makeImageNode({ content: "Add a caption..." });
    const input = makeInput({
      nodes: { i1: imageNode },
      nodeOrder: ["i1"],
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(
      input,
      "Test",
      new Map([["asset123", "image/webp"]]),
      logLines,
    );

    const fileNode = result.canvasJson.nodes.find((n) => n.type === "file") as
      | ObsidianFileNode
      | undefined;
    expect(fileNode).toBeDefined();
    expect(fileNode!.file).toBe("Test/assets/asset123.webp");
  });

  it("uses folder-prefixed asset paths", () => {
    const input = makeInput();
    const logLines: string[] = [];
    const result = buildObsidianExport(
      input,
      "My Board",
      new Map([["asset123", "image/webp"]]),
      logLines,
    );

    expect(result.folderName).toBe("My Board");

    const fileNode = result.canvasJson.nodes.find((n) => n.type === "file") as
      | ObsidianFileNode
      | undefined;
    expect(fileNode).toBeDefined();
    expect(fileNode!.file).toMatch(/^My Board\/assets\//);
  });

  it("maps edge direction correctly", () => {
    const input = makeInput({
      edges: {
        e1: makeEdge({ direction: "forward" }),
        e2: makeEdge({ id: "e2", direction: "none" }),
        e3: makeEdge({ id: "e3", direction: "both" }),
      },
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(
      input,
      "Test",
      new Map([["asset123", "image/webp"]]),
      logLines,
    );

    // 邊線保持 Object.values 的順序，以 fromEnd/toEnd 組合搜尋
    const forwardEdge = result.canvasJson.edges.find(
      (e) => e.fromEnd === "none" && e.toEnd === "arrow",
    )!;
    expect(forwardEdge).toBeDefined();

    const noneEdge = result.canvasJson.edges.find(
      (e) => e.fromEnd === "none" && e.toEnd === "none",
    )!;
    expect(noneEdge).toBeDefined();

    const bothEdge = result.canvasJson.edges.find(
      (e) => e.fromEnd === "arrow" && e.toEnd === "arrow",
    )!;
    expect(bothEdge).toBeDefined();
  });

  it("edge fromNode/toNode reference the mapped node IDs", () => {
    const input = makeInput({
      edges: { e1: makeEdge() },
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(
      input,
      "Test",
      new Map([["asset123", "image/webp"]]),
      logLines,
    );

    const edge = result.canvasJson.edges[0];
    const nodeIds = result.canvasJson.nodes.map((n) => n.id);
    expect(nodeIds).toContain(edge.fromNode);
    expect(nodeIds).toContain(edge.toNode);
  });

  it("computes group bounding box with padding", () => {
    const t1 = makeTextNode({
      id: "t1",
      x: 100,
      y: 100,
      width: 200,
      height: 150,
    });
    const t2 = makeTextNode({
      id: "t2",
      x: 400,
      y: 200,
      width: 200,
      height: 150,
    });
    const group = makeGroup({ nodeIds: ["t1", "t2"] });
    const input = makeInput({
      nodes: { t1, t2 },
      nodeOrder: ["t1", "t2"],
      groups: { g1: group },
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(input, "Test", new Map(), logLines);

    const groupNode = result.canvasJson.nodes.find(
      (n) => n.type === "group",
    ) as ObsidianGroupNode | undefined;
    expect(groupNode).toBeDefined();
    expect(groupNode!.x).toBe(80);
    expect(groupNode!.y).toBe(80);
    expect(groupNode!.width).toBe(540);
    expect(groupNode!.height).toBe(290);
  });

  it("skips empty groups and logs", () => {
    const group = makeGroup({ nodeIds: ["nonexistent"] });
    const input = makeInput({
      nodes: {},
      nodeOrder: [],
      groups: { g1: group },
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(input, "Test", new Map(), logLines);

    const groupNodes = result.canvasJson.nodes.filter(
      (n) => n.type === "group",
    );
    expect(groupNodes.length).toBe(0);
    expect(logLines.some((l) => l.includes("Skipped empty group"))).toBe(true);
  });

  it("maps colors to Obsidian values", () => {
    const textNode = makeTextNode({ color: "red" });
    const input = makeInput({
      nodes: { t1: textNode },
      nodeOrder: ["t1"],
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(input, "Test", new Map(), logLines);

    const node = result.canvasJson.nodes.find((n) => n.type === "text");
    expect(node?.color).toBe("1");
  });

  it("omits color when null", () => {
    const textNode = makeTextNode({ color: null });
    const input = makeInput({
      nodes: { t1: textNode },
      nodeOrder: ["t1"],
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(input, "Test", new Map(), logLines);

    const node = result.canvasJson.nodes.find((n) => n.type === "text");
    expect(node?.color).toBeUndefined();
  });

  it("places groups before regular nodes", () => {
    const t1 = makeTextNode();
    const group = makeGroup({ nodeIds: ["t1"] });
    const input = makeInput({
      nodes: { t1 },
      nodeOrder: ["t1"],
      groups: { g1: group },
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(input, "Test", new Map(), logLines);

    const nodeTypes = result.canvasJson.nodes.map((n) => n.type);
    const groupIndex = nodeTypes.indexOf("group");
    const textIndex = nodeTypes.indexOf("text");
    expect(groupIndex).toBeLessThan(textIndex);
  });

  it("rewrites asset refs in text node markdown with folder prefix", () => {
    const t1 = makeTextNode({
      contentMarkdown: "Look: ![photo](asset:abc123)",
    });
    const input = makeInput({
      nodes: { t1 },
      nodeOrder: ["t1"],
      files: {
        f1: makeFileRecord({ asset_id: "abc123", mime_type: "image/png" }),
      },
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(
      input,
      "Test",
      new Map([["abc123", "image/png"]]),
      logLines,
    );

    const node = result.canvasJson.nodes.find((n) => n.type === "text") as
      | ObsidianTextNode
      | undefined;
    expect(node).toBeDefined();
    expect(node!.text).toBe("Look: ![[Test/assets/abc123.png]]");
  });

  it("skips edges when source/target node is missing", () => {
    const t1 = makeTextNode();
    const edge = makeEdge({ fromNode: "t1", toNode: "missing" });
    const input = makeInput({
      nodes: { t1 },
      nodeOrder: ["t1"],
      edges: { e1: edge },
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(input, "Test", new Map(), logLines);

    expect(result.canvasJson.edges.length).toBe(0);
    expect(logLines.some((l) => l.includes("Skipped edge"))).toBe(true);
  });

  it("edge includes fromSide/toSide based on smart anchors", () => {
    // t1 在 (0,0)，i1 在 (300,0) → 水平方向，從右到左
    const input = makeInput({
      edges: { e1: makeEdge() },
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(
      input,
      "Test",
      new Map([["asset123", "image/webp"]]),
      logLines,
    );

    const edge = result.canvasJson.edges[0];
    expect(edge.fromSide).toBe("right");
    expect(edge.toSide).toBe("left");
  });

  it("includes edge label when non-empty", () => {
    const input = makeInput({
      edges: { e1: makeEdge({ label: "  connects  " }) },
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(
      input,
      "Test",
      new Map([["asset123", "image/webp"]]),
      logLines,
    );

    expect(result.canvasJson.edges[0].label).toBe("connects");
  });

  it("omits edge label when empty", () => {
    const input = makeInput({
      edges: { e1: makeEdge({ label: "   " }) },
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(
      input,
      "Test",
      new Map([["asset123", "image/webp"]]),
      logLines,
    );

    expect(result.canvasJson.edges[0].label).toBeUndefined();
  });

  it("collapses paragraph breaks (\\n\\n → \\n) in text node content", () => {
    const t1 = makeTextNode({
      contentMarkdown: "Line 1\n\nLine 2\n\nLine 3",
    });
    const input = makeInput({
      nodes: { t1 },
      nodeOrder: ["t1"],
    });
    const logLines: string[] = [];
    const result = buildObsidianExport(input, "Test", new Map(), logLines);

    const node = result.canvasJson.nodes.find((n) => n.type === "text") as
      | ObsidianTextNode
      | undefined;
    expect(node).toBeDefined();
    expect(node!.text).toBe("Line 1\nLine 2\nLine 3");
  });
});
