import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["src/__tests__/setup.ts"],
    coverage: {
      exclude: ["src/react.ts", "src/vue.ts"],
    },
  },
});
