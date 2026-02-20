import {
  InteractionEvent,
  InteractionState,
  transition,
} from "../../features/canvas/core/stateMachine";
import type { CanvasMode } from "../../types/canvas";
import type { CanvasStore } from "../storeTypes";

type SetState = (
  partial:
    | Partial<CanvasStore>
    | ((state: CanvasStore) => Partial<CanvasStore>),
) => void;

export type InteractionSlice = {
  canvasMode: CanvasMode;
  interactionState: InteractionState;
  setCanvasMode: (mode: CanvasMode) => void;
  dispatch: (event: InteractionEvent) => void;
};

export function createInteractionSlice(set: SetState): InteractionSlice {
  return {
    canvasMode: "select",
    interactionState: InteractionState.Idle,
    setCanvasMode: (mode) => {
      set((state) => {
        if (state.canvasMode === mode) {
          return state;
        }

        if (
          state.interactionState === InteractionState.Connecting &&
          mode === "select"
        ) {
          return {
            canvasMode: mode,
            interactionState: transition(
              state.interactionState,
              InteractionEvent.ESCAPE,
            ),
          };
        }

        if (state.interactionState !== InteractionState.Idle) {
          return state;
        }

        return {
          canvasMode: mode,
        };
      });
    },
    dispatch: (event) => {
      set((state) => ({
        interactionState: transition(state.interactionState, event),
      }));
    },
  };
}
