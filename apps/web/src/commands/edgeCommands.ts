import type { Edge } from "../types/canvas";
import type { Command, CommandJSON } from "./types";

export type EdgeCommandContext = {
  addEdge: (edge: Edge) => void;
  deleteEdge: (edgeId: string) => void;
  setEdge: (edge: Edge) => void;
};

function cloneEdge(edge: Edge): Edge {
  return {
    ...edge,
  };
}

type AddEdgePayload = {
  edge: Edge;
};

type AddEdgeInverse = {
  edgeId: string;
};

export class AddEdgeCommand implements Command {
  readonly type = "edge.add";

  private readonly context: EdgeCommandContext;
  private readonly payload: AddEdgePayload;
  private readonly inverse: AddEdgeInverse;

  constructor(context: EdgeCommandContext, edge: Edge) {
    this.context = context;
    this.payload = {
      edge: cloneEdge(edge),
    };
    this.inverse = {
      edgeId: edge.id,
    };
  }

  execute(): void {
    this.context.addEdge(cloneEdge(this.payload.edge));
  }

  undo(): void {
    this.context.deleteEdge(this.inverse.edgeId);
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        edge: cloneEdge(this.payload.edge),
      },
      inverse: {
        edgeId: this.inverse.edgeId,
      },
    };
  }
}

type DeleteEdgePayload = {
  edgeId: string;
};

type DeleteEdgeInverse = {
  edge: Edge;
};

export class DeleteEdgeCommand implements Command {
  readonly type = "edge.delete";

  private readonly context: EdgeCommandContext;
  private readonly payload: DeleteEdgePayload;
  private readonly inverse: DeleteEdgeInverse;

  constructor(context: EdgeCommandContext, edge: Edge) {
    this.context = context;
    this.payload = {
      edgeId: edge.id,
    };
    this.inverse = {
      edge: cloneEdge(edge),
    };
  }

  execute(): void {
    this.context.deleteEdge(this.payload.edgeId);
  }

  undo(): void {
    this.context.addEdge(cloneEdge(this.inverse.edge));
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        edgeId: this.payload.edgeId,
      },
      inverse: {
        edge: cloneEdge(this.inverse.edge),
      },
    };
  }
}

type UpdateEdgePayload = {
  next: Edge;
};

type UpdateEdgeInverse = {
  previous: Edge;
};

export class UpdateEdgeCommand implements Command {
  readonly type = "edge.update";

  private readonly context: EdgeCommandContext;
  private readonly payload: UpdateEdgePayload;
  private readonly inverse: UpdateEdgeInverse;

  constructor(context: EdgeCommandContext, previous: Edge, next: Edge) {
    this.context = context;
    this.payload = {
      next: cloneEdge(next),
    };
    this.inverse = {
      previous: cloneEdge(previous),
    };
  }

  execute(): void {
    this.context.setEdge(cloneEdge(this.payload.next));
  }

  undo(): void {
    this.context.setEdge(cloneEdge(this.inverse.previous));
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        next: cloneEdge(this.payload.next),
      },
      inverse: {
        previous: cloneEdge(this.inverse.previous),
      },
    };
  }
}
