import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    serializers: "src/serializers.ts",
    supabase: "src/supabase/index.ts",
    types: "src/types/index.ts",
    share: "src/share/index.ts",
    edgeUtils: "src/edgeUtils/index.ts",
  },
  format: ["esm"],
  dts: { resolve: true },
  splitting: true,
  sourcemap: true,
  clean: true,
  target: "node20",
  treeshake: true,
});
