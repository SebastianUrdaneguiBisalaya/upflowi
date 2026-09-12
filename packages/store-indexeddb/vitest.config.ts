import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Points straight at @upflowi/core's source, matching the tsconfig `paths` alias — Vitest
// resolves via node_modules -> package.json `exports` -> dist/, which doesn't exist yet when
// `test` runs before `build` (CI's gate order per AGENTS.md is typecheck -> lint -> test -> build,
// and locally too). Without this, every test here would fail to resolve @upflowi/core on a fresh
// checkout where core hasn't been built yet.
export default defineConfig({
  resolve: {
    alias: {
      "@upflowi/core": fileURLToPath(
        new URL("../core/src/index.ts", import.meta.url),
      ),
    },
  },
});
