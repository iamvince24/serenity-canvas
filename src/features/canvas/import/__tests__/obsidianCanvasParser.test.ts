import { describe, expect, it } from "vitest";
import type { ObsidianCanvas } from "../../export/obsidianExport.types";
import {
  collectImagePaths,
  parseObsidianCanvas,
  type AssetPathMap,
} from "../obsidianCanvasParser";

function makeAssetPathMap(): AssetPathMap {
  return new Map();
}

function makeImageNodeDataMap(): Map<
  string,
  { assetId: string; width: number; height: number }
> {
  return new Map();
}

describe("parseObsidianCanvas", () => {
  it("converts a text node with height reverse compensation", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "abc123",
          type: "text",
          text: "Hello",
          x: 100,
          y: 200,
          width: 300,
          height: 170, // obsidian height
        },
      ],
      edges: [],
    };

    const logLines: string[] = [];
    const result = parseObsidianCanvas(
      canvas,
      makeAssetPathMap(),
      makeImageNodeDataMap(),
      logLines,
    );

    expect(result.nodes).toHaveLength(1);
    const node = result.nodes[0];
    expect(node.type).toBe("text");
    expect(node.x).toBe(100);
    expect(node.y).toBe(200);
    expect(node.width).toBe(300);

    // Reverse: round((170 - 40) / 1.3 + 34) = round(100 + 34) = 134
    expect(node.height).toBe(134);

    if (node.type === "text") {
      // \n → \n\n expansion
      expect(node.contentMarkdown).toBe("Hello");
    }
    expect(logLines).toHaveLength(0);
  });

  it("expands paragraph breaks in text content", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "Line 1\nLine 2\nLine 3",
          x: 0,
          y: 0,
          width: 200,
          height: 100,
        },
      ],
      edges: [],
    };

    const logLines: string[] = [];
    const result = parseObsidianCanvas(
      canvas,
      makeAssetPathMap(),
      makeImageNodeDataMap(),
      logLines,
    );

    const node = result.nodes[0];
    if (node.type === "text") {
      expect(node.contentMarkdown).toBe("Line 1\n\nLine 2\n\nLine 3");
    }
  });

  it("maps obsidian colors to CanvasColorId", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "Red",
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          color: "1",
        },
        {
          id: "n2",
          type: "text",
          text: "Purple",
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          color: "6",
        },
      ],
      edges: [],
    };

    const logLines: string[] = [];
    const result = parseObsidianCanvas(
      canvas,
      makeAssetPathMap(),
      makeImageNodeDataMap(),
      logLines,
    );

    expect(result.nodes[0].color).toBe("red");
    expect(result.nodes[1].color).toBe("purple");
  });

  it("converts file node to text node when image not found", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "f1",
          type: "file",
          file: "assets/photo.png",
          x: 10,
          y: 20,
          width: 300,
          height: 200,
        },
      ],
      edges: [],
    };

    const logLines: string[] = [];
    const result = parseObsidianCanvas(
      canvas,
      makeAssetPathMap(),
      makeImageNodeDataMap(),
      logLines,
    );

    expect(result.nodes).toHaveLength(1);
    const node = result.nodes[0];
    expect(node.type).toBe("text");
    if (node.type === "text") {
      expect(node.contentMarkdown).toContain("assets/photo.png");
    }
    expect(logLines.length).toBeGreaterThan(0);
  });

  it("converts file node to image node when asset data is available", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "f1",
          type: "file",
          file: "assets/photo.png",
          x: 10,
          y: 20,
          width: 300,
          height: 200,
        },
      ],
      edges: [],
    };

    const imageNodeDataMap = new Map([
      ["assets/photo.png", { assetId: "abc123hash", width: 800, height: 600 }],
    ]);

    const logLines: string[] = [];
    const result = parseObsidianCanvas(
      canvas,
      makeAssetPathMap(),
      imageNodeDataMap,
      logLines,
    );

    expect(result.nodes).toHaveLength(1);
    const node = result.nodes[0];
    expect(node.type).toBe("image");
    if (node.type === "image") {
      expect(node.asset_id).toBe("abc123hash");
    }
  });

  it("converts non-image file node to text placeholder", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "f1",
          type: "file",
          file: "notes/readme.md",
          x: 0,
          y: 0,
          width: 200,
          height: 100,
        },
      ],
      edges: [],
    };

    const logLines: string[] = [];
    const result = parseObsidianCanvas(
      canvas,
      makeAssetPathMap(),
      makeImageNodeDataMap(),
      logLines,
    );

    const node = result.nodes[0];
    expect(node.type).toBe("text");
    if (node.type === "text") {
      expect(node.contentMarkdown).toContain("notes/readme.md");
    }
  });

  it("maps edge direction correctly", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "a",
          type: "text",
          text: "A",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
        {
          id: "b",
          type: "text",
          text: "B",
          x: 200,
          y: 0,
          width: 100,
          height: 100,
        },
        {
          id: "c",
          type: "text",
          text: "C",
          x: 400,
          y: 0,
          width: 100,
          height: 100,
        },
      ],
      edges: [
        {
          id: "e1",
          fromNode: "a",
          fromSide: "right",
          toNode: "b",
          toSide: "left",
          fromEnd: "none",
          toEnd: "arrow",
        },
        {
          id: "e2",
          fromNode: "b",
          fromSide: "right",
          toNode: "c",
          toSide: "left",
          fromEnd: "arrow",
          toEnd: "arrow",
        },
        {
          id: "e3",
          fromNode: "a",
          fromSide: "bottom",
          toNode: "c",
          toSide: "top",
          fromEnd: "none",
          toEnd: "none",
        },
      ],
    };

    const logLines: string[] = [];
    const result = parseObsidianCanvas(
      canvas,
      makeAssetPathMap(),
      makeImageNodeDataMap(),
      logLines,
    );

    expect(result.edges).toHaveLength(3);
    expect(result.edges[0].direction).toBe("forward");
    expect(result.edges[1].direction).toBe("both");
    expect(result.edges[2].direction).toBe("none");
  });

  it("maps anchor sides directly", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "a",
          type: "text",
          text: "A",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
        {
          id: "b",
          type: "text",
          text: "B",
          x: 200,
          y: 0,
          width: 100,
          height: 100,
        },
      ],
      edges: [
        {
          id: "e1",
          fromNode: "a",
          fromSide: "right",
          toNode: "b",
          toSide: "left",
        },
      ],
    };

    const logLines: string[] = [];
    const result = parseObsidianCanvas(
      canvas,
      makeAssetPathMap(),
      makeImageNodeDataMap(),
      logLines,
    );

    expect(result.edges[0].fromAnchor).toBe("right");
    expect(result.edges[0].toAnchor).toBe("left");
  });

  it("assigns group members by center-point containment", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "g1",
          type: "group",
          label: "My Group",
          x: 0,
          y: 0,
          width: 500,
          height: 500,
        },
        {
          id: "n1",
          type: "text",
          text: "Inside",
          x: 50,
          y: 50,
          width: 100,
          height: 100,
        },
        {
          id: "n2",
          type: "text",
          text: "Outside",
          x: 600,
          y: 600,
          width: 100,
          height: 100,
        },
      ],
      edges: [],
    };

    const logLines: string[] = [];
    const result = parseObsidianCanvas(
      canvas,
      makeAssetPathMap(),
      makeImageNodeDataMap(),
      logLines,
    );

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].label).toBe("My Group");
    expect(result.groups[0].nodeIds).toHaveLength(1);
    // The inside node should be a member
  });

  it("skips empty groups", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "g1",
          type: "group",
          label: "Empty",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
      ],
      edges: [],
    };

    const logLines: string[] = [];
    const result = parseObsidianCanvas(
      canvas,
      makeAssetPathMap(),
      makeImageNodeDataMap(),
      logLines,
    );

    expect(result.groups).toHaveLength(0);
    expect(logLines).toHaveLength(1);
  });

  it("generates unique IDs for all imported elements", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "A",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
        {
          id: "n2",
          type: "text",
          text: "B",
          x: 200,
          y: 0,
          width: 100,
          height: 100,
        },
      ],
      edges: [
        {
          id: "e1",
          fromNode: "n1",
          fromSide: "right",
          toNode: "n2",
          toSide: "left",
        },
      ],
    };

    const logLines: string[] = [];
    const result = parseObsidianCanvas(
      canvas,
      makeAssetPathMap(),
      makeImageNodeDataMap(),
      logLines,
    );

    // IDs should be UUIDs, not original obsidian IDs
    expect(result.nodes[0].id).not.toBe("n1");
    expect(result.nodes[1].id).not.toBe("n2");
    expect(result.edges[0].id).not.toBe("e1");

    // Edge references should point to new node IDs
    expect(result.edges[0].fromNode).toBe(result.nodes[0].id);
    expect(result.edges[0].toNode).toBe(result.nodes[1].id);
  });

  it("skips edges with missing source or target", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "A",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
      ],
      edges: [
        {
          id: "e1",
          fromNode: "n1",
          fromSide: "right",
          toNode: "missing",
          toSide: "left",
        },
      ],
    };

    const logLines: string[] = [];
    const result = parseObsidianCanvas(
      canvas,
      makeAssetPathMap(),
      makeImageNodeDataMap(),
      logLines,
    );

    expect(result.edges).toHaveLength(0);
    expect(logLines).toHaveLength(1);
  });
});

describe("collectImagePaths", () => {
  it("collects paths from file nodes", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "f1",
          type: "file",
          file: "images/photo.png",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
        {
          id: "f2",
          type: "file",
          file: "notes/readme.md",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
      ],
      edges: [],
    };

    const paths = collectImagePaths(canvas);
    expect(paths).toContain("images/photo.png");
    expect(paths).not.toContain("notes/readme.md");
  });

  it("collects embed paths from text nodes", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "t1",
          type: "text",
          text: "Hello ![[photo.jpg]] world",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
      ],
      edges: [],
    };

    const paths = collectImagePaths(canvas);
    expect(paths).toContain("photo.jpg");
  });

  it("deduplicates paths", () => {
    const canvas: ObsidianCanvas = {
      nodes: [
        {
          id: "f1",
          type: "file",
          file: "photo.png",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
        {
          id: "f2",
          type: "file",
          file: "photo.png",
          x: 100,
          y: 0,
          width: 100,
          height: 100,
        },
      ],
      edges: [],
    };

    const paths = collectImagePaths(canvas);
    expect(paths).toHaveLength(1);
  });
});
