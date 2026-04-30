import { describe, expect, it } from "vitest";
import {
  hasAnySelection,
  resolveDeleteTarget,
  type SelectionState,
} from "../slices/selectionPolicy";

function createSelectionState(
  state: Partial<SelectionState> = {},
): SelectionState {
  return {
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedGroupIds: [],
    ...state,
  };
}

describe("selectionPolicy", () => {
  describe("resolveDeleteTarget", () => {
    it("returns nodes when only nodes are selected", () => {
      const state = createSelectionState({ selectedNodeIds: ["node-1"] });
      expect(resolveDeleteTarget(state)).toBe("nodes");
    });

    it("returns edges when only edges are selected", () => {
      const state = createSelectionState({ selectedEdgeIds: ["edge-1"] });
      expect(resolveDeleteTarget(state)).toBe("edges");
    });

    it("returns groups when only groups are selected", () => {
      const state = createSelectionState({ selectedGroupIds: ["group-1"] });
      expect(resolveDeleteTarget(state)).toBe("groups");
    });

    it("keeps Gate C priority when nodes and groups are both selected", () => {
      const state = createSelectionState({
        selectedNodeIds: ["node-1"],
        selectedGroupIds: ["group-1"],
      });
      expect(resolveDeleteTarget(state)).toBe("nodes");
    });

    it("returns null when nothing is selected", () => {
      expect(resolveDeleteTarget(createSelectionState())).toBeNull();
    });
  });

  describe("hasAnySelection", () => {
    it("returns true when only nodes are selected", () => {
      expect(
        hasAnySelection(
          createSelectionState({
            selectedNodeIds: ["node-1"],
          }),
        ),
      ).toBe(true);
    });

    it("returns true when only edges are selected", () => {
      expect(
        hasAnySelection(
          createSelectionState({
            selectedEdgeIds: ["edge-1"],
          }),
        ),
      ).toBe(true);
    });

    it("returns true when only groups are selected", () => {
      expect(
        hasAnySelection(
          createSelectionState({
            selectedGroupIds: ["group-1"],
          }),
        ),
      ).toBe(true);
    });

    it("returns false when nothing is selected", () => {
      expect(hasAnySelection(createSelectionState())).toBe(false);
    });
  });
});
