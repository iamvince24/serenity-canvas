export const InteractionState = {
  Idle: "idle",
  Dragging: "dragging",
  Panning: "panning",
  BoxSelecting: "box-selecting",
  Resizing: "resizing",
  Connecting: "connecting",
  Editing: "editing",
} as const;

export type InteractionState =
  (typeof InteractionState)[keyof typeof InteractionState];

export const InteractionEvent = {
  NODE_POINTER_DOWN: "node-pointer-down",
  NODE_POINTER_UP: "node-pointer-up",
  NODE_DOUBLE_CLICK: "node-double-click",
  NODE_DRAG_START: "node-drag-start",
  NODE_DRAG_END: "node-drag-end",
  STAGE_POINTER_DOWN: "stage-pointer-down",
  STAGE_POINTER_UP: "stage-pointer-up",
  PAN_START: "pan-start",
  PAN_END: "pan-end",
  BOX_SELECT_START: "box-select-start",
  BOX_SELECT_END: "box-select-end",
  RESIZE_START: "resize-start",
  RESIZE_END: "resize-end",
  CONNECT_START: "connect-start",
  CONNECT_END: "connect-end",
  EDIT_START: "edit-start",
  EDIT_END: "edit-end",
  ESCAPE: "escape",
} as const;

export type InteractionEvent =
  (typeof InteractionEvent)[keyof typeof InteractionEvent];

// Returns a transition row where every event loops back to `state`.
// Spread this as a base, then override only the transitions that actually move states.
function stayOn(
  state: InteractionState,
): Record<InteractionEvent, InteractionState> {
  return {
    [InteractionEvent.NODE_POINTER_DOWN]: state,
    [InteractionEvent.NODE_POINTER_UP]: state,
    [InteractionEvent.NODE_DOUBLE_CLICK]: state,
    [InteractionEvent.NODE_DRAG_START]: state,
    [InteractionEvent.NODE_DRAG_END]: state,
    [InteractionEvent.STAGE_POINTER_DOWN]: state,
    [InteractionEvent.STAGE_POINTER_UP]: state,
    [InteractionEvent.PAN_START]: state,
    [InteractionEvent.PAN_END]: state,
    [InteractionEvent.BOX_SELECT_START]: state,
    [InteractionEvent.BOX_SELECT_END]: state,
    [InteractionEvent.RESIZE_START]: state,
    [InteractionEvent.RESIZE_END]: state,
    [InteractionEvent.CONNECT_START]: state,
    [InteractionEvent.CONNECT_END]: state,
    [InteractionEvent.EDIT_START]: state,
    [InteractionEvent.EDIT_END]: state,
    [InteractionEvent.ESCAPE]: state,
  };
}

// Full transition table: given a state, maps each event to the next state.
export const transitions: Record<
  InteractionState,
  Record<InteractionEvent, InteractionState>
> = {
  [InteractionState.Idle]: {
    ...stayOn(InteractionState.Idle),
    [InteractionEvent.NODE_POINTER_DOWN]: InteractionState.Dragging,
    [InteractionEvent.NODE_DRAG_START]: InteractionState.Dragging,
    [InteractionEvent.NODE_DOUBLE_CLICK]: InteractionState.Editing,
    [InteractionEvent.STAGE_POINTER_DOWN]: InteractionState.Panning,
    [InteractionEvent.PAN_START]: InteractionState.Panning,
    [InteractionEvent.BOX_SELECT_START]: InteractionState.BoxSelecting,
    [InteractionEvent.RESIZE_START]: InteractionState.Resizing,
    [InteractionEvent.CONNECT_START]: InteractionState.Connecting,
    [InteractionEvent.EDIT_START]: InteractionState.Editing,
  },
  [InteractionState.Dragging]: {
    ...stayOn(InteractionState.Dragging),
    [InteractionEvent.NODE_DOUBLE_CLICK]: InteractionState.Editing,
    [InteractionEvent.NODE_POINTER_UP]: InteractionState.Idle,
    [InteractionEvent.NODE_DRAG_END]: InteractionState.Idle,
    [InteractionEvent.ESCAPE]: InteractionState.Idle,
  },
  [InteractionState.Panning]: {
    ...stayOn(InteractionState.Panning),
    [InteractionEvent.STAGE_POINTER_UP]: InteractionState.Idle,
    [InteractionEvent.PAN_END]: InteractionState.Idle,
    [InteractionEvent.ESCAPE]: InteractionState.Idle,
  },
  [InteractionState.BoxSelecting]: {
    ...stayOn(InteractionState.BoxSelecting),
    [InteractionEvent.BOX_SELECT_END]: InteractionState.Idle,
    [InteractionEvent.ESCAPE]: InteractionState.Idle,
  },
  [InteractionState.Resizing]: {
    ...stayOn(InteractionState.Resizing),
    [InteractionEvent.RESIZE_END]: InteractionState.Idle,
    [InteractionEvent.ESCAPE]: InteractionState.Idle,
  },
  [InteractionState.Connecting]: {
    ...stayOn(InteractionState.Connecting),
    [InteractionEvent.CONNECT_END]: InteractionState.Idle,
    [InteractionEvent.ESCAPE]: InteractionState.Idle,
  },
  [InteractionState.Editing]: {
    ...stayOn(InteractionState.Editing),
    [InteractionEvent.EDIT_END]: InteractionState.Idle,
    [InteractionEvent.ESCAPE]: InteractionState.Idle,
  },
};

export function transition(
  current: InteractionState,
  event: InteractionEvent,
): InteractionState {
  return transitions[current][event] ?? current;
}
