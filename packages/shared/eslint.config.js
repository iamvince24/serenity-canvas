import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

const sharedRestrictedImports = {
  paths: [
    { name: "react", message: "shared package must be UI-agnostic" },
    { name: "react-dom", message: "shared package must be UI-agnostic" },
    { name: "konva", message: "shared package must be UI-agnostic" },
    { name: "react-konva", message: "shared package must be UI-agnostic" },
    { name: "zustand", message: "shared package must be UI-agnostic" },
  ],
  patterns: [
    { group: ["@tiptap/*"], message: "shared package must be UI-agnostic" },
  ],
};

const nodeOnlyRestrictedImports = {
  paths: [
    { name: "fs", message: "Node-only API not allowed in shared" },
    { name: "node:fs", message: "Node-only API not allowed in shared" },
    { name: "path", message: "Node-only API not allowed in shared" },
    { name: "node:path", message: "Node-only API not allowed in shared" },
    {
      name: "child_process",
      message: "Node-only API not allowed in shared",
    },
    {
      name: "node:child_process",
      message: "Node-only API not allowed in shared",
    },
  ],
};

export default defineConfig([
  globalIgnores(["dist", "coverage"]),
  {
    files: ["src/**/*.ts"],
    ignores: ["src/supabase/mcpStdio.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...sharedRestrictedImports.paths,
            ...nodeOnlyRestrictedImports.paths,
          ],
          patterns: sharedRestrictedImports.patterns,
        },
      ],
    },
  },
  {
    files: ["src/supabase/mcpStdio.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      "no-restricted-imports": ["error", sharedRestrictedImports],
    },
  },
]);
