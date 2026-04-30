import { describe, expect, it } from "vitest";
import type { CanvasNode, Group, TextNode } from "../../types/canvas";
import {
  removeNodeFromGroups,
  restoreGroupSnapshots,
  setGroupWithExclusivity,
} from "../groupHelpers";

function createTextNode(id: string): TextNode {
  return {
    id,
    type: "text",
    x: 0,
    y: 0,
    width: 200,
    height: 120,
    heightMode: "fixed",
    color: null,
    contentMarkdown: id,
  };
}

describe("groupHelpers", () => {
  it("removeNodeFromGroups 會移除空群組並回傳 removed ids", () => {
    const groups: Record<string, Group> = {
      "group-a": {
        id: "group-a",
        label: "A",
        color: null,
        nodeIds: ["n1", "n2"],
      },
      "group-b": {
        id: "group-b",
        label: "B",
        color: null,
        nodeIds: ["n2"],
      },
    };

    const result = removeNodeFromGroups(groups, "n2");

    expect(result.groups).toMatchObject({
      "group-a": {
        nodeIds: ["n1"],
      },
    });
    expect(result.groups["group-b"]).toBeUndefined();
    expect(result.removedGroupIds).toEqual(["group-b"]);
  });

  it("setGroupWithExclusivity 會讓 node 只屬於新群組", () => {
    const groups: Record<string, Group> = {
      "group-old": {
        id: "group-old",
        label: "Old",
        color: null,
        nodeIds: ["n1", "n2"],
      },
      "group-other": {
        id: "group-other",
        label: "Other",
        color: null,
        nodeIds: ["n3"],
      },
    };

    const nextGroup: Group = {
      id: "group-new",
      label: "New",
      color: null,
      nodeIds: ["n2", "n4"],
    };

    const result = setGroupWithExclusivity(groups, nextGroup);

    expect(result["group-old"]?.nodeIds).toEqual(["n1"]);
    expect(result["group-new"]?.nodeIds).toEqual(["n2", "n4"]);
    expect(result["group-other"]?.nodeIds).toEqual(["n3"]);
  });

  it("restoreGroupSnapshots 會略過已刪除節點並保留可還原成員", () => {
    const nodes: Record<string, CanvasNode> = {
      n1: createTextNode("n1"),
      n2: createTextNode("n2"),
    };
    const groups: Record<string, Group> = {};
    const snapshots: Group[] = [
      {
        id: "group-a",
        label: "A",
        color: null,
        nodeIds: ["n1", "n-missing"],
      },
      {
        id: "group-b",
        label: "B",
        color: null,
        nodeIds: ["n-missing"],
      },
    ];

    const restored = restoreGroupSnapshots(groups, snapshots, nodes);

    expect(restored["group-a"]?.nodeIds).toEqual(["n1"]);
    expect(restored["group-b"]).toBeUndefined();
  });
});
