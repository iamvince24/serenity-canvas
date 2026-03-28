export type TourPlacement = "top" | "right" | "bottom" | "left" | "center";

export interface TourStep {
  id: string;
  target: string; // data-tour attribute value
  i18nKey: string; // prefix for tour.step.{i18nKey}.title / .description
  placement: TourPlacement;
  mobilePlacement: TourPlacement;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "canvas-intro",
    target: "canvas-stage",
    i18nKey: "canvasIntro",
    placement: "center",
    mobilePlacement: "center",
  },
  {
    id: "create-card",
    target: "canvas-stage",
    i18nKey: "createCard",
    placement: "center",
    mobilePlacement: "center",
  },
  {
    id: "select-mode",
    target: "toolbar-select",
    i18nKey: "selectMode",
    placement: "right",
    mobilePlacement: "top",
  },
  {
    id: "pan-zoom",
    target: "canvas-stage",
    i18nKey: "panZoom",
    placement: "center",
    mobilePlacement: "center",
  },
  {
    id: "multi-select",
    target: "canvas-stage",
    i18nKey: "multiSelect",
    placement: "center",
    mobilePlacement: "center",
  },
  {
    id: "connect-mode",
    target: "toolbar-connect",
    i18nKey: "connectMode",
    placement: "right",
    mobilePlacement: "top",
  },
  {
    id: "create-group",
    target: "canvas-stage",
    i18nKey: "createGroup",
    placement: "center",
    mobilePlacement: "center",
  },
  {
    id: "text-editing",
    target: "canvas-stage",
    i18nKey: "textEditing",
    placement: "center",
    mobilePlacement: "center",
  },
  {
    id: "undo-redo",
    target: "toolbar-undo",
    i18nKey: "undoRedo",
    placement: "right",
    mobilePlacement: "top",
  },
  {
    id: "tour-complete",
    target: "toolbar-help",
    i18nKey: "tourComplete",
    placement: "right",
    mobilePlacement: "top",
  },
];
