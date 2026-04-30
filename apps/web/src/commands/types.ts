export type CommandJSON = {
  type: string;
  payload: unknown;
  inverse: unknown;
};

export interface Command {
  readonly type: string;
  execute: () => void;
  undo: () => void;
  toJSON: () => CommandJSON;
}

export class CompositeCommand implements Command {
  readonly type: string;
  private readonly commands: Command[];

  constructor(commands: Command[], type = "composite") {
    this.commands = commands;
    this.type = type;
  }

  execute(): void {
    for (const command of this.commands) {
      command.execute();
    }
  }

  undo(): void {
    for (let index = this.commands.length - 1; index >= 0; index -= 1) {
      this.commands[index].undo();
    }
  }

  toJSON(): CommandJSON {
    return {
      type: this.type,
      payload: {
        commands: this.commands.map((command) => command.toJSON()),
      },
      inverse: {
        commands: this.commands.map((command) => command.toJSON()).reverse(),
      },
    };
  }
}

// Phase 1 reserves the API for sync/offline serialization.
export function fromJSON(json: CommandJSON): Command {
  void json;
  throw new Error("fromJSON is not implemented yet.");
}
