import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanvasNode, Edge, FileRecord, Group } from "../../types/canvas";
import { serenityDB } from "../database";
import {
  BoardRepository,
  EdgeRepository,
  FileRepository,
  GroupRepository,
  NodeRepository,
  fromPersistedEdge,
  toPersistedEdge,
} from "../repositories";

async function resetDatabase() {
  serenityDB.close();
  await serenityDB.delete();
}

function createTextNode(id: string, contentMarkdown = "hello"): CanvasNode {
  return {
    id,
    type: "text",
    x: 10,
    y: 20,
    width: 280,
    height: 200,
    heightMode: "auto",
    color: null,
    contentMarkdown,
    updatedAt: 1,
  };
}

function createEdge(id: string, fromNode: string, toNode: string): Edge {
  return {
    id,
    fromNode,
    toNode,
    direction: "forward",
    label: "edge",
    lineStyle: "dashed",
    color: "green",
    updatedAt: 1,
  };
}

function createGroup(id: string, nodeIds: string[]): Group {
  return {
    id,
    label: "Group",
    color: "orange",
    nodeIds,
  };
}

function createFile(id: string): FileRecord {
  return {
    id,
    mime_type: "image/png",
    original_width: 1200,
    original_height: 800,
    byte_size: 2048,
    created_at: 111,
    updatedAt: 111,
  };
}

describe("repositories", () => {
  beforeEach(async () => {
    await resetDatabase();
    await serenityDB.open();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it("converts edge fields between camelCase and snake_case", () => {
    const edge = createEdge("edge-1", "node-1", "node-2");
    const persisted = toPersistedEdge("board-a", edge);

    expect(persisted).toEqual({
      id: "edge-1",
      boardId: "board-a",
      from_node: "node-1",
      to_node: "node-2",
      direction: "forward",
      label: "edge",
      line_style: "dashed",
      color: "green",
      updatedAt: 1,
    });

    expect(
      fromPersistedEdge({
        id: persisted.id,
        from_node: persisted.from_node,
        to_node: persisted.to_node,
        direction: persisted.direction,
        label: persisted.label,
        line_style: persisted.line_style,
        color: persisted.color,
        updatedAt: persisted.updatedAt,
      }),
    ).toEqual(edge);
  });

  it("BoardRepository supports create/get/update/delete", async () => {
    await BoardRepository.createDefault("board-a");

    expect(await BoardRepository.getById("board-a")).toEqual(
      expect.objectContaining({
        id: "board-a",
        nodeOrder: [],
        nodeCount: 0,
      }),
    );

    await BoardRepository.update("board-a", {
      nodeOrder: ["node-1"],
      nodeCount: 1,
      updatedAt: 999,
    });

    expect(await BoardRepository.getById("board-a")).toEqual({
      id: "board-a",
      nodeOrder: ["node-1"],
      nodeCount: 1,
      updatedAt: 999,
    });

    await BoardRepository.delete("board-a");
    expect(await BoardRepository.getById("board-a")).toBeNull();
  });

  it("NodeRepository stores boardId and supports bulk put/delete", async () => {
    const nodeA = createTextNode("node-a", "board-a text");
    const nodeB = createTextNode("node-b", "board-b text");

    await NodeRepository.bulkPut("board-a", [nodeA]);
    await NodeRepository.bulkPut("board-b", [nodeB]);

    const storedNodeA = await serenityDB.nodes.get("node-a");
    expect(storedNodeA).toEqual(
      expect.objectContaining({
        id: "node-a",
        boardId: "board-a",
        content_markdown: "board-a text",
      }),
    );

    expect(await NodeRepository.getByBoardId("board-a")).toEqual({
      "node-a": nodeA,
    });
    expect(await NodeRepository.getByBoardId("board-b")).toEqual({
      "node-b": nodeB,
    });

    await NodeRepository.bulkDelete(["node-a"]);
    expect(await NodeRepository.getByBoardId("board-a")).toEqual({});
    expect(await NodeRepository.getByBoardId("board-b")).toEqual({
      "node-b": nodeB,
    });
  });

  it("EdgeRepository supports CRUD by board", async () => {
    const edgeA = createEdge("edge-a", "node-1", "node-2");
    const edgeB = createEdge("edge-b", "node-3", "node-4");

    await EdgeRepository.bulkPut("board-a", [edgeA]);
    await EdgeRepository.bulkPut("board-b", [edgeB]);

    const storedEdgeA = await serenityDB.edges.get("edge-a");
    expect(storedEdgeA).toEqual(
      expect.objectContaining({
        id: "edge-a",
        boardId: "board-a",
        from_node: "node-1",
        to_node: "node-2",
        line_style: "dashed",
      }),
    );

    expect(await EdgeRepository.getByBoardId("board-a")).toEqual({
      "edge-a": edgeA,
    });

    await EdgeRepository.bulkDelete(["edge-a"]);
    expect(await EdgeRepository.getByBoardId("board-a")).toEqual({});
    expect(await EdgeRepository.getByBoardId("board-b")).toEqual({
      "edge-b": edgeB,
    });
  });

  it("GroupRepository supports CRUD by board", async () => {
    const groupA = createGroup("group-a", ["node-1", "node-2"]);
    const groupB = createGroup("group-b", ["node-3", "node-4"]);

    await GroupRepository.bulkPut("board-a", [groupA]);
    await GroupRepository.bulkPut("board-b", [groupB]);

    const storedGroupA = await serenityDB.groups.get("group-a");
    expect(storedGroupA).toEqual(
      expect.objectContaining({
        id: "group-a",
        boardId: "board-a",
        nodeIds: ["node-1", "node-2"],
      }),
    );

    expect(await GroupRepository.getByBoardId("board-a")).toEqual({
      "group-a": groupA,
    });

    await GroupRepository.bulkDelete(["group-a"]);
    expect(await GroupRepository.getByBoardId("board-a")).toEqual({});
    expect(await GroupRepository.getByBoardId("board-b")).toEqual({
      "group-b": groupB,
    });
  });

  it("FileRepository supports CRUD by board", async () => {
    const fileA = createFile("file-a");
    const fileB = createFile("file-b");

    await FileRepository.bulkPut("board-a", [fileA]);
    await FileRepository.bulkPut("board-b", [fileB]);

    const storedFileA = await serenityDB.files.get("file-a");
    expect(storedFileA).toEqual(
      expect.objectContaining({
        id: "file-a",
        boardId: "board-a",
        mime_type: "image/png",
      }),
    );

    expect(await FileRepository.getByBoardId("board-a")).toEqual({
      "file-a": fileA,
    });

    await FileRepository.bulkDelete(["file-a"]);
    expect(await FileRepository.getByBoardId("board-a")).toEqual({});
    expect(await FileRepository.getByBoardId("board-b")).toEqual({
      "file-b": fileB,
    });
  });

  it("deleteAllForBoard only removes targeted board records", async () => {
    const nodeA = createTextNode("node-a");
    const nodeB = createTextNode("node-b");
    const edgeA = createEdge("edge-a", "node-a", "node-b");
    const edgeB = createEdge("edge-b", "node-b", "node-a");
    const groupA = createGroup("group-a", ["node-a"]);
    const groupB = createGroup("group-b", ["node-b"]);
    const fileA = createFile("file-a");
    const fileB = createFile("file-b");

    await BoardRepository.put({
      id: "board-a",
      nodeOrder: ["node-a"],
      nodeCount: 1,
      updatedAt: 1,
    });
    await BoardRepository.put({
      id: "board-b",
      nodeOrder: ["node-b"],
      nodeCount: 1,
      updatedAt: 1,
    });
    await NodeRepository.bulkPut("board-a", [nodeA]);
    await NodeRepository.bulkPut("board-b", [nodeB]);
    await EdgeRepository.bulkPut("board-a", [edgeA]);
    await EdgeRepository.bulkPut("board-b", [edgeB]);
    await GroupRepository.bulkPut("board-a", [groupA]);
    await GroupRepository.bulkPut("board-b", [groupB]);
    await FileRepository.bulkPut("board-a", [fileA]);
    await FileRepository.bulkPut("board-b", [fileB]);

    await Promise.all([
      NodeRepository.deleteAllForBoard("board-a"),
      EdgeRepository.deleteAllForBoard("board-a"),
      GroupRepository.deleteAllForBoard("board-a"),
      FileRepository.deleteAllForBoard("board-a"),
      BoardRepository.delete("board-a"),
    ]);

    expect(await BoardRepository.getById("board-a")).toBeNull();
    expect(await BoardRepository.getById("board-b")).toEqual(
      expect.objectContaining({ id: "board-b" }),
    );
    expect(await NodeRepository.getByBoardId("board-a")).toEqual({});
    expect(await EdgeRepository.getByBoardId("board-a")).toEqual({});
    expect(await GroupRepository.getByBoardId("board-a")).toEqual({});
    expect(await FileRepository.getByBoardId("board-a")).toEqual({});

    expect(await NodeRepository.getByBoardId("board-b")).toEqual({
      "node-b": nodeB,
    });
    expect(await EdgeRepository.getByBoardId("board-b")).toEqual({
      "edge-b": edgeB,
    });
    expect(await GroupRepository.getByBoardId("board-b")).toEqual({
      "group-b": groupB,
    });
    expect(await FileRepository.getByBoardId("board-b")).toEqual({
      "file-b": fileB,
    });
  });

  it("bulk operations handle empty arrays", async () => {
    await expect(
      NodeRepository.bulkPut("board-a", []),
    ).resolves.toBeUndefined();
    await expect(NodeRepository.bulkDelete([])).resolves.toBeUndefined();
    await expect(
      EdgeRepository.bulkPut("board-a", []),
    ).resolves.toBeUndefined();
    await expect(EdgeRepository.bulkDelete([])).resolves.toBeUndefined();
    await expect(
      GroupRepository.bulkPut("board-a", []),
    ).resolves.toBeUndefined();
    await expect(GroupRepository.bulkDelete([])).resolves.toBeUndefined();
    await expect(
      FileRepository.bulkPut("board-a", []),
    ).resolves.toBeUndefined();
    await expect(FileRepository.bulkDelete([])).resolves.toBeUndefined();
  });
});
