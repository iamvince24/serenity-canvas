import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { serenityDB } from "../database";

async function resetDatabase() {
  serenityDB.close();
  await serenityDB.delete();
}

describe("database", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it("opens IndexedDB with version 2 schema", async () => {
    await serenityDB.open();

    expect(serenityDB.isOpen()).toBe(true);
    expect(serenityDB.verno).toBe(2);
    expect(serenityDB.tables.map((table) => table.name).sort()).toEqual([
      "boards",
      "dirtyChanges",
      "edges",
      "files",
      "groups",
      "nodes",
    ]);
  });

  it("can reopen database without crashing", async () => {
    await serenityDB.open();
    serenityDB.close();

    await expect(serenityDB.open()).resolves.toBe(serenityDB);
  });
});
