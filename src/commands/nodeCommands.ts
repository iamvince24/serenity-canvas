import type { CanvasNode, FileRecord, NodeHeightMode } from "../types/canvas";
import type { Command, CommandJSON } from "./types";

export type NodePositionSnapshot = {
  x: number;
  y: number;
};

export type NodeGeometrySnapshot = NodePositionSnapshot & {
  width: number;
  height: number;
  heightMode: NodeHeightMode;
};

export type NodeCommandContext = {
  addNode: (node: CanvasNode, file?: FileRecord) => void;
  deleteNode: (id: string) => void;
  setNodePosition: (id: string, x: number, y: number) => void;
  setNodeGeometry: (id: string, geometry: NodeGeometrySnapshot) => void;
  setNodeContent: (id: string, content: string) => void;
  setNodeColor: (id: string, color: CanvasNode["color"]) => void;
  setNodeHeightMode: (id: string, mode: NodeHeightMode) => void;
  setNodeOrder: (nodeOrder: string[]) => void;
};

function cloneNode(node: CanvasNode): CanvasNode {
  return { ...node };
}

function cloneFile(file: FileRecord | undefined): FileRecord | undefined {
  if (!file) {
    return undefined;
  }

  return { ...file };
}

function clonePosition(snapshot: NodePositionSnapshot): NodePositionSnapshot {
  return {
    x: snapshot.x,
    y: snapshot.y,
  };
}

function cloneGeometry(snapshot: NodeGeometrySnapshot): NodeGeometrySnapshot {
  return {
    x: snapshot.x,
    y: snapshot.y,
    width: snapshot.width,
    height: snapshot.height,
    heightMode: snapshot.heightMode,
  };
}

function cloneNodeOrder(nodeOrder: string[]): string[] {
  return [...nodeOrder];
}

type AddNodePayload = {
  node: CanvasNode;
  file?: FileRecord;
};

type AddNodeInverse = {
  nodeId: string;
};

export class AddNodeCommand implements Command {
  readonly type = "node.add";

  private readonly context: NodeCommandContext;
  private readonly payload: AddNodePayload;
  private readonly inverse: AddNodeInverse;

  constructor(
    context: NodeCommandContext,
    node: CanvasNode,
    file?: FileRecord,
  ) {
    this.context = context;
    this.payload = {
      node: cloneNode(node),
      file: cloneFile(file),
    };
    this.inverse = {
      nodeId: node.id,
    };
  }

  execute(): void {
    this.context.addNode(
      cloneNode(this.payload.node),
      cloneFile(this.payload.file),
    );
  }

  undo(): void {
    this.context.deleteNode(this.inverse.nodeId);
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        node: cloneNode(this.payload.node),
        file: cloneFile(this.payload.file),
      },
      inverse: {
        nodeId: this.inverse.nodeId,
      },
    };
  }
}

type DeleteNodePayload = {
  nodeId: string;
  nextNodeOrder: string[];
};

type DeleteNodeInverse = {
  node: CanvasNode;
  file?: FileRecord;
  previousNodeOrder: string[];
};

type DeleteNodeCommandParams = {
  node: CanvasNode;
  file?: FileRecord;
  previousNodeOrder: string[];
  nextNodeOrder: string[];
};

export class DeleteNodeCommand implements Command {
  readonly type = "node.delete";

  private readonly context: NodeCommandContext;
  private readonly payload: DeleteNodePayload;
  private readonly inverse: DeleteNodeInverse;

  constructor(context: NodeCommandContext, params: DeleteNodeCommandParams) {
    this.context = context;
    this.payload = {
      nodeId: params.node.id,
      nextNodeOrder: cloneNodeOrder(params.nextNodeOrder),
    };
    this.inverse = {
      node: cloneNode(params.node),
      file: cloneFile(params.file),
      previousNodeOrder: cloneNodeOrder(params.previousNodeOrder),
    };
  }

  execute(): void {
    this.context.deleteNode(this.payload.nodeId);
    this.context.setNodeOrder(cloneNodeOrder(this.payload.nextNodeOrder));
  }

  undo(): void {
    this.context.addNode(
      cloneNode(this.inverse.node),
      cloneFile(this.inverse.file),
    );
    this.context.setNodeOrder(cloneNodeOrder(this.inverse.previousNodeOrder));
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        nodeId: this.payload.nodeId,
        nextNodeOrder: cloneNodeOrder(this.payload.nextNodeOrder),
      },
      inverse: {
        node: cloneNode(this.inverse.node),
        file: cloneFile(this.inverse.file),
        previousNodeOrder: cloneNodeOrder(this.inverse.previousNodeOrder),
      },
    };
  }
}

type MoveNodePayload = {
  nodeId: string;
  to: NodePositionSnapshot;
};

type MoveNodeInverse = {
  from: NodePositionSnapshot;
};

export class MoveNodeCommand implements Command {
  readonly type = "node.move";

  private readonly context: NodeCommandContext;
  private readonly payload: MoveNodePayload;
  private readonly inverse: MoveNodeInverse;

  constructor(
    context: NodeCommandContext,
    nodeId: string,
    from: NodePositionSnapshot,
    to: NodePositionSnapshot,
  ) {
    this.context = context;
    this.payload = {
      nodeId,
      to: clonePosition(to),
    };
    this.inverse = {
      from: clonePosition(from),
    };
  }

  execute(): void {
    this.context.setNodePosition(
      this.payload.nodeId,
      this.payload.to.x,
      this.payload.to.y,
    );
  }

  undo(): void {
    this.context.setNodePosition(
      this.payload.nodeId,
      this.inverse.from.x,
      this.inverse.from.y,
    );
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        nodeId: this.payload.nodeId,
        to: clonePosition(this.payload.to),
      },
      inverse: {
        from: clonePosition(this.inverse.from),
      },
    };
  }
}

type ResizeNodePayload = {
  nodeId: string;
  to: NodeGeometrySnapshot;
};

type ResizeNodeInverse = {
  from: NodeGeometrySnapshot;
};

export class ResizeNodeCommand implements Command {
  readonly type = "node.resize";

  private readonly context: NodeCommandContext;
  private readonly payload: ResizeNodePayload;
  private readonly inverse: ResizeNodeInverse;

  constructor(
    context: NodeCommandContext,
    nodeId: string,
    from: NodeGeometrySnapshot,
    to: NodeGeometrySnapshot,
  ) {
    this.context = context;
    this.payload = {
      nodeId,
      to: cloneGeometry(to),
    };
    this.inverse = {
      from: cloneGeometry(from),
    };
  }

  execute(): void {
    this.context.setNodeGeometry(
      this.payload.nodeId,
      cloneGeometry(this.payload.to),
    );
  }

  undo(): void {
    this.context.setNodeGeometry(
      this.payload.nodeId,
      cloneGeometry(this.inverse.from),
    );
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        nodeId: this.payload.nodeId,
        to: cloneGeometry(this.payload.to),
      },
      inverse: {
        from: cloneGeometry(this.inverse.from),
      },
    };
  }
}

type UpdateNodeContentPayload = {
  nodeId: string;
  content: string;
};

type UpdateNodeContentInverse = {
  previousContent: string;
};

export class UpdateContentCommand implements Command {
  readonly type = "node.update-content";

  private readonly context: NodeCommandContext;
  private readonly payload: UpdateNodeContentPayload;
  private readonly inverse: UpdateNodeContentInverse;

  constructor(
    context: NodeCommandContext,
    nodeId: string,
    previousContent: string,
    content: string,
  ) {
    this.context = context;
    this.payload = {
      nodeId,
      content,
    };
    this.inverse = {
      previousContent,
    };
  }

  execute(): void {
    this.context.setNodeContent(this.payload.nodeId, this.payload.content);
  }

  undo(): void {
    this.context.setNodeContent(
      this.payload.nodeId,
      this.inverse.previousContent,
    );
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        nodeId: this.payload.nodeId,
        content: this.payload.content,
      },
      inverse: {
        previousContent: this.inverse.previousContent,
      },
    };
  }
}

type UpdateNodeColorPayload = {
  nodeId: string;
  color: CanvasNode["color"];
};

type UpdateNodeColorInverse = {
  previousColor: CanvasNode["color"];
};

export class UpdateColorCommand implements Command {
  readonly type = "node.update-color";

  private readonly context: NodeCommandContext;
  private readonly payload: UpdateNodeColorPayload;
  private readonly inverse: UpdateNodeColorInverse;

  constructor(
    context: NodeCommandContext,
    nodeId: string,
    previousColor: CanvasNode["color"],
    color: CanvasNode["color"],
  ) {
    this.context = context;
    this.payload = {
      nodeId,
      color,
    };
    this.inverse = {
      previousColor,
    };
  }

  execute(): void {
    this.context.setNodeColor(this.payload.nodeId, this.payload.color);
  }

  undo(): void {
    this.context.setNodeColor(this.payload.nodeId, this.inverse.previousColor);
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        nodeId: this.payload.nodeId,
        color: this.payload.color,
      },
      inverse: {
        previousColor: this.inverse.previousColor,
      },
    };
  }
}

type UpdateNodeHeightModePayload = {
  nodeId: string;
  mode: NodeHeightMode;
};

type UpdateNodeHeightModeInverse = {
  previousMode: NodeHeightMode;
};

export class UpdateHeightModeCommand implements Command {
  readonly type = "node.update-height-mode";

  private readonly context: NodeCommandContext;
  private readonly payload: UpdateNodeHeightModePayload;
  private readonly inverse: UpdateNodeHeightModeInverse;

  constructor(
    context: NodeCommandContext,
    nodeId: string,
    previousMode: NodeHeightMode,
    mode: NodeHeightMode,
  ) {
    this.context = context;
    this.payload = {
      nodeId,
      mode,
    };
    this.inverse = {
      previousMode,
    };
  }

  execute(): void {
    this.context.setNodeHeightMode(this.payload.nodeId, this.payload.mode);
  }

  undo(): void {
    this.context.setNodeHeightMode(
      this.payload.nodeId,
      this.inverse.previousMode,
    );
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        nodeId: this.payload.nodeId,
        mode: this.payload.mode,
      },
      inverse: {
        previousMode: this.inverse.previousMode,
      },
    };
  }
}

type ReorderNodePayload = {
  nextNodeOrder: string[];
};

type ReorderNodeInverse = {
  previousNodeOrder: string[];
};

export class ReorderNodeCommand implements Command {
  readonly type = "node.reorder";

  private readonly context: NodeCommandContext;
  private readonly payload: ReorderNodePayload;
  private readonly inverse: ReorderNodeInverse;

  constructor(
    context: NodeCommandContext,
    previousNodeOrder: string[],
    nextNodeOrder: string[],
  ) {
    this.context = context;
    this.payload = {
      nextNodeOrder: cloneNodeOrder(nextNodeOrder),
    };
    this.inverse = {
      previousNodeOrder: cloneNodeOrder(previousNodeOrder),
    };
  }

  execute(): void {
    this.context.setNodeOrder(cloneNodeOrder(this.payload.nextNodeOrder));
  }

  undo(): void {
    this.context.setNodeOrder(cloneNodeOrder(this.inverse.previousNodeOrder));
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        nextNodeOrder: cloneNodeOrder(this.payload.nextNodeOrder),
      },
      inverse: {
        previousNodeOrder: cloneNodeOrder(this.inverse.previousNodeOrder),
      },
    };
  }
}

export function toNodeGeometrySnapshot(node: CanvasNode): NodeGeometrySnapshot {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    heightMode: node.heightMode,
  };
}
