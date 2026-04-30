/** Well-known IDs from supabase/seed.sql */
export const SEED = {
  BOARD_ID: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  NODE_1: "bbbbbbbb-0001-0000-0000-000000000000",
  NODE_2: "bbbbbbbb-0002-0000-0000-000000000000",
  NODE_3: "bbbbbbbb-0003-0000-0000-000000000000",
  IMAGE_NODE: "bbbbbbbb-0004-0000-0000-000000000000",
  EDGE_1_2: "cccccccc-0001-0000-0000-000000000000",
  EDGE_1_3: "cccccccc-0002-0000-0000-000000000000",
  EDGE_2_3: "cccccccc-0003-0000-0000-000000000000",
} as const;

/** Modifier key: Meta on macOS, Control on others */
export function modKey(platform: string): string {
  return platform.includes("Mac") || platform.includes("darwin")
    ? "Meta"
    : "Control";
}
