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
  background: string;
  border: string;
  accent: string;
  text: string;
  muted: string;
  bgIcon: string;
  hl: [string, string, string];
  obsidianValue: `${1 | 2 | 3 | 4 | 5 | 6}`;
};

export const DEFAULT_NODE_COLOR: CanvasNodeColor = null;

export const DEFAULT_CARD_BACKGROUND = "#FFFFFF";
export const DEFAULT_CARD_BORDER = "#E5E3DF";

export const DEFAULT_THEME_TOKENS = {
  background: "#FFFFFF",
  border: "#E5E3DF",
  accent: "#8B9D83",
  text: "#1C1C1A",
  muted: "#6B6B66",
  bgIcon: "#ECEAE6",
  hl: ["#D6E0CE", "#F2E4D4", "#DAE6ED"] as [string, string, string],
};
export const DEFAULT_EDGE_STROKE = "#6B6B66";
export const SELECTED_EDGE_STROKE = "#8B9D83";

export const CANVAS_COLOR_PRESETS: readonly CanvasColorPreset[] = [
  {
    id: "red",
    label: "Red",
    background: "#FDF8F7",
    border: "#E5CACA",
    accent: "#B8635A",
    text: "#2C1A19",
    muted: "#7A5B5A",
    bgIcon: "#F5E6E5",
    hl: ["#F0D0CE", "#F5DCD4", "#EDCED6"],
    obsidianValue: "1",
  },
  {
    id: "orange",
    label: "Orange",
    background: "#FDF9F4",
    border: "#E5D3C5",
    accent: "#C48D4E",
    text: "#2C2219",
    muted: "#7A685A",
    bgIcon: "#F5EBE1",
    hl: ["#F0DCCE", "#F5E4D0", "#EDD8CE"],
    obsidianValue: "2",
  },
  {
    id: "yellow",
    label: "Yellow",
    background: "#FCFBF4",
    border: "#E5E0C5",
    accent: "#C4B44E",
    text: "#2C2A19",
    muted: "#7A765A",
    bgIcon: "#F3F0D8",
    hl: ["#EDE8CE", "#F5ECD0", "#E8E0CE"],
    obsidianValue: "3",
  },
  {
    id: "green",
    label: "Green",
    background: "#F4F7F3",
    border: "#D4DDD0",
    accent: "#8B9D83",
    text: "#1A2219",
    muted: "#5B685A",
    bgIcon: "#EBF0E9",
    hl: ["#D6E0CE", "#E4F0D4", "#CEE0D8"],
    obsidianValue: "4",
  },
  {
    id: "cyan",
    label: "Blue",
    background: "#F4F8F9",
    border: "#CDE0E5",
    accent: "#6B8E9B",
    text: "#1A242C",
    muted: "#5A6B7A",
    bgIcon: "#E3ECF0",
    hl: ["#CEE0E6", "#D4E8F0", "#CEDED8"],
    obsidianValue: "5",
  },
  {
    id: "purple",
    label: "Purple",
    background: "#F9F6F9",
    border: "#DCD0DC",
    accent: "#9B7E9B",
    text: "#2A1A2C",
    muted: "#765A7A",
    bgIcon: "#EFE5EF",
    hl: ["#E0CEE0", "#E8D4F0", "#D8CEE6"],
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

export type CardThemeTokens = {
  background: string;
  border: string;
  accent: string;
  text: string;
  muted: string;
  bgIcon: string;
  hl: [string, string, string];
};

export function getCardThemeTokens(color: CanvasNodeColor): CardThemeTokens {
  const preset = getCanvasColorPreset(color);
  if (!preset) {
    return { ...DEFAULT_THEME_TOKENS };
  }

  return {
    background: preset.background,
    border: preset.border,
    accent: preset.accent,
    text: preset.text,
    muted: preset.muted,
    bgIcon: preset.bgIcon,
    hl: preset.hl,
  };
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
