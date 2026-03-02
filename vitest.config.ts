import { defineConfig } from "vitest/config";
import pkg from "./package.json";

export default defineConfig({
  define: {
    __SDK_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/__tests__/setup.ts"],
    coverage: {
      exclude: ["src/react.ts", "src/vue.ts"],
    },
  },
});
