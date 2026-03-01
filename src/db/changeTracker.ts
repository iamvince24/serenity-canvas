import {
  serenityDB,
  type DirtyAction,
  type DirtyChangeRow,
  type DirtyEntityType,
} from "./database";

export type DirtyRecord = DirtyChangeRow;

class ChangeTracker {
  private toPk(boardId: string, entityType: DirtyEntityType, entityId: string) {
    return `${boardId}:${entityType}:${entityId}`;
  }

  async markDirty(
    boardId: string,
    entityType: DirtyEntityType,
    entityId: string,
    action: DirtyAction,
  ): Promise<void> {
    await serenityDB.dirtyChanges.put({
      pk: this.toPk(boardId, entityType, entityId),
      boardId,
      entityType,
      entityId,
      action,
      dirtyAt: Date.now(),
    });
  }

  async getPendingChanges(boardId: string): Promise<DirtyRecord[]> {
    return serenityDB.dirtyChanges.where("boardId").equals(boardId).toArray();
  }

  async clearChanges(boardId: string, entityIds?: string[]): Promise<void> {
    if (!entityIds || entityIds.length === 0) {
      await serenityDB.dirtyChanges.where("boardId").equals(boardId).delete();
      return;
    }

    const records = await serenityDB.dirtyChanges
      .where("boardId")
      .equals(boardId)
      .toArray();
    const idSet = new Set(entityIds);
    const targetPks = records
      .filter((record) => idSet.has(record.entityId))
      .map((record) => record.pk);
    if (targetPks.length > 0) {
      await serenityDB.dirtyChanges.bulkDelete(targetPks);
    }
  }

  async hasPendingChanges(boardId: string): Promise<boolean> {
    return (
      (await serenityDB.dirtyChanges.where("boardId").equals(boardId).count()) >
      0
    );
  }
}

export const changeTracker = new ChangeTracker();
