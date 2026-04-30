import type { Group } from "../types/canvas";
import type { Command, CommandJSON } from "./types";

export type GroupCommandContext = {
  setGroup: (group: Group) => void;
  deleteGroup: (groupId: string) => void;
  restoreGroups: (snapshots: Group[]) => void;
};

function cloneGroup(group: Group): Group {
  return {
    ...group,
    nodeIds: [...group.nodeIds],
  };
}

function cloneGroups(groups: Group[]): Group[] {
  return groups.map((group) => cloneGroup(group));
}

type CreateGroupPayload = {
  group: Group;
};

type CreateGroupInverse = {
  groupId: string;
  affectedGroupSnapshots: Group[];
};

export class CreateGroupCommand implements Command {
  readonly type = "group.create";

  private readonly context: GroupCommandContext;
  private readonly payload: CreateGroupPayload;
  private readonly inverse: CreateGroupInverse;

  constructor(
    context: GroupCommandContext,
    group: Group,
    affectedGroupSnapshots: Group[],
  ) {
    this.context = context;
    this.payload = {
      group: cloneGroup(group),
    };
    this.inverse = {
      groupId: group.id,
      affectedGroupSnapshots: cloneGroups(affectedGroupSnapshots),
    };
  }

  execute(): void {
    this.context.setGroup(cloneGroup(this.payload.group));
  }

  undo(): void {
    this.context.deleteGroup(this.inverse.groupId);
    this.context.restoreGroups(
      cloneGroups(this.inverse.affectedGroupSnapshots),
    );
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        group: cloneGroup(this.payload.group),
      },
      inverse: {
        groupId: this.inverse.groupId,
        affectedGroupSnapshots: cloneGroups(
          this.inverse.affectedGroupSnapshots,
        ),
      },
    };
  }
}

type DeleteGroupPayload = {
  groupId: string;
};

type DeleteGroupInverse = {
  group: Group;
};

export class DeleteGroupCommand implements Command {
  readonly type = "group.delete";

  private readonly context: GroupCommandContext;
  private readonly payload: DeleteGroupPayload;
  private readonly inverse: DeleteGroupInverse;

  constructor(context: GroupCommandContext, group: Group) {
    this.context = context;
    this.payload = {
      groupId: group.id,
    };
    this.inverse = {
      group: cloneGroup(group),
    };
  }

  execute(): void {
    this.context.deleteGroup(this.payload.groupId);
  }

  undo(): void {
    this.context.setGroup(cloneGroup(this.inverse.group));
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        groupId: this.payload.groupId,
      },
      inverse: {
        group: cloneGroup(this.inverse.group),
      },
    };
  }
}

type UpdateGroupPayload = {
  next: Group;
};

type UpdateGroupInverse = {
  previous: Group;
  affectedGroupSnapshots: Group[];
};

export class UpdateGroupCommand implements Command {
  readonly type = "group.update";

  private readonly context: GroupCommandContext;
  private readonly payload: UpdateGroupPayload;
  private readonly inverse: UpdateGroupInverse;

  constructor(
    context: GroupCommandContext,
    previous: Group,
    next: Group,
    affectedGroupSnapshots: Group[],
  ) {
    this.context = context;
    this.payload = {
      next: cloneGroup(next),
    };
    this.inverse = {
      previous: cloneGroup(previous),
      affectedGroupSnapshots: cloneGroups(affectedGroupSnapshots),
    };
  }

  execute(): void {
    this.context.setGroup(cloneGroup(this.payload.next));
  }

  undo(): void {
    this.context.setGroup(cloneGroup(this.inverse.previous));
    this.context.restoreGroups(
      cloneGroups(this.inverse.affectedGroupSnapshots),
    );
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        next: cloneGroup(this.payload.next),
      },
      inverse: {
        previous: cloneGroup(this.inverse.previous),
        affectedGroupSnapshots: cloneGroups(
          this.inverse.affectedGroupSnapshots,
        ),
      },
    };
  }
}
