export const CANVAS_COLOR_IDS = [
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "purple",
] as const;

export type CanvasColorId = (typeof CANVAS_COLOR_IDS)[number];
export type CanvasNodeColor = CanvasColorId | null;

export type CanvasColorPreset = {
  id: CanvasColorId;
  label: string;
  border: string;
  background: string;
  obsidianValue: `${1 | 2 | 3 | 4 | 5 | 6}`;
};

export const DEFAULT_NODE_COLOR: CanvasNodeColor = null;

export const DEFAULT_CARD_BACKGROUND = "#FFFFFF";
export const DEFAULT_CARD_BORDER = "#E5E3DF";
export const DEFAULT_EDGE_STROKE = "#6B6B66";
export const SELECTED_EDGE_STROKE = "#8B9D83";

export const CANVAS_COLOR_PRESETS: readonly CanvasColorPreset[] = [
  {
    id: "red",
    label: "Red",
    border: "#D96578",
    background: "#FDECEE",
    obsidianValue: "1",
  },
  {
    id: "orange",
    label: "Orange",
    border: "#DB8A39",
    background: "#FFF3E5",
    obsidianValue: "2",
  },
  {
    id: "yellow",
    label: "Yellow",
    border: "#CFB14B",
    background: "#FFF9DD",
    obsidianValue: "3",
  },
  {
    id: "green",
    label: "Green",
    border: "#6FAF77",
    background: "#ECF7EC",
    obsidianValue: "4",
  },
  {
    id: "cyan",
    label: "Cyan",
    border: "#48A6B5",
    background: "#E8F7F8",
    obsidianValue: "5",
  },
  {
    id: "purple",
    label: "Purple",
    border: "#9A78D7",
    background: "#F2EDFC",
    obsidianValue: "6",
  },
] as const;

const PRESET_BY_ID: Record<CanvasColorId, CanvasColorPreset> =
  CANVAS_COLOR_PRESETS.reduce(
    (accumulator, preset) => {
      accumulator[preset.id] = preset;
      return accumulator;
    },
    {} as Record<CanvasColorId, CanvasColorPreset>,
  );

const PRESET_BY_OBSIDIAN_VALUE: Record<
  CanvasColorPreset["obsidianValue"],
  CanvasColorPreset
> = CANVAS_COLOR_PRESETS.reduce(
  (accumulator, preset) => {
    accumulator[preset.obsidianValue] = preset;
    return accumulator;
  },
  {} as Record<CanvasColorPreset["obsidianValue"], CanvasColorPreset>,
);

export function isCanvasColorId(value: unknown): value is CanvasColorId {
  return (
    typeof value === "string" &&
    (CANVAS_COLOR_IDS as readonly string[]).includes(value)
  );
}

export function getCanvasColorPreset(
  color: CanvasNodeColor,
): CanvasColorPreset | null {
  return color ? (PRESET_BY_ID[color] ?? null) : null;
}

export function getCardColorStyle(color: CanvasNodeColor): {
  background: string;
  border: string;
} {
  const preset = getCanvasColorPreset(color);
  if (!preset) {
    return {
      background: DEFAULT_CARD_BACKGROUND,
      border: DEFAULT_CARD_BORDER,
    };
  }

  return {
    background: preset.background,
    border: preset.border,
  };
}

export function getEdgeStrokeColor(color: CanvasNodeColor): string {
  const preset = getCanvasColorPreset(color);
  return preset ? preset.border : DEFAULT_EDGE_STROKE;
}

export function getColorPresetByObsidianValue(
  value: string | null | undefined,
): CanvasColorPreset | null {
  if (!value) {
    return null;
  }

  return (
    PRESET_BY_OBSIDIAN_VALUE[value as CanvasColorPreset["obsidianValue"]] ??
    null
  );
}

export function normalizeNodeColor(value: unknown): CanvasNodeColor {
  if (value === null || value === undefined) {
    return null;
  }

  if (isCanvasColorId(value)) {
    return value;
  }

  if (typeof value === "string") {
    if (
      value.toLowerCase() === DEFAULT_CARD_BACKGROUND.toLowerCase() ||
      value.toLowerCase() === "#fff" ||
      value.toLowerCase() === "#ffffff"
    ) {
      return null;
    }

    const presetFromObsidian = getColorPresetByObsidianValue(value);
    if (presetFromObsidian) {
      return presetFromObsidian.id;
    }
  }

  return null;
}
