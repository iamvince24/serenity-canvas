import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.d.ts",
        "src/**/__tests__/**",
      ],
    },
  },
});
