import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@serenity/shared/serializers": path.resolve(
        __dirname,
        "../../packages/shared/src/serializers.ts",
      ),
      "@serenity/shared/supabase": path.resolve(
        __dirname,
        "../../packages/shared/src/supabase/index.ts",
      ),
      "@serenity/shared/types": path.resolve(
        __dirname,
        "../../packages/shared/src/types/index.ts",
      ),
      "@serenity/shared/share": path.resolve(
        __dirname,
        "../../packages/shared/src/share/index.ts",
      ),
      "@serenity/shared/edgeUtils": path.resolve(
        __dirname,
        "../../packages/shared/src/edgeUtils/index.ts",
      ),
      "@serenity/shared": path.resolve(
        __dirname,
        "../../packages/shared/src/index.ts",
      ),
    },
  },
  esbuild: {
    pure:
      mode === "production"
        ? ["console.log", "console.info", "console.debug"]
        : [],
  },
}));
